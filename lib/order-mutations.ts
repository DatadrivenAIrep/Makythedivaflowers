import "server-only";
import { getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { rowToOrder, orderToRow, type OrderRow } from "@/lib/order-row";
import type { Order, PaymentMethod, FulfillmentStatus } from "@/types/order";
import { recordOrderChange } from "@/lib/order-history";

function money(c: number): string { return `$${(c / 100).toFixed(2)}`; }

const MANUAL_PAYMENT_METHODS: PaymentMethod[] = ["cash", "zelle", "card-terminal", "ach"];

export async function markPaidManual(
  orderId: string,
  args: { method: PaymentMethod; note?: string },
): Promise<Order> {
  runMigrations();
  const db = getDb();
  const row = db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId) as OrderRow | undefined;
  if (!row) throw new Error(`order not found: ${orderId}`);
  const cur = rowToOrder(row);
  // Idempotent: if already paid, return as-is regardless of method arg.
  if (cur.paymentStatus === "paid") return cur;

  if (!MANUAL_PAYMENT_METHODS.includes(args.method)) {
    throw new Error(`unsupported manual method: ${args.method}`);
  }

  const now = new Date().toISOString();
  const noteLine = `[${now}] [paid manually as ${args.method}]${args.note ? " " + args.note : ""}`;
  const internalNotes = cur.internalNotes ? `${cur.internalNotes}\n${noteLine}` : noteLine;

  const next: Order = {
    ...cur,
    paymentStatus: "paid",
    paymentMethod: args.method,
    paidAt: now,
    amountPaidCents: cur.totals.totalCents,
    internalNotes,
    updatedAt: now,
  };
  upsert(next);
  await recordOrderChange({
    orderId, actor: "maky", kind: "payment",
    summary: `Pagado en ${args.method} · ${money(cur.totals.totalCents)}`,
  });

  // Mirror the Stripe webhook side-effects so customers get the same paid-order
  // confirmation regardless of whether payment landed via Stripe or manual.
  // Failures are swallowed: the DB mutation already succeeded, and dispatch can
  // be retried via the resend endpoint.
  try {
    const { dispatchPaymentConfirmed } = await import("@/lib/order-dispatch");
    await dispatchPaymentConfirmed(next);
  } catch (e) {
    console.error(JSON.stringify({ event: "dispatch_payment_confirmed_failed", orderId, error: String(e) }));
  }
  if (next.contact.email) {
    try {
      const { notifyOrderPaid } = await import("@/lib/order-notifications");
      await notifyOrderPaid(next);
    } catch (e) {
      console.error(JSON.stringify({ event: "notify_order_paid_failed", orderId, error: String(e) }));
    }
  }

  return next;
}

function upsert(order: Order): void {
  const db = getDb();
  const row = orderToRow(order);
  db.prepare(
    `UPDATE orders SET payment_status=@payment_status, payment_method=@payment_method,
       paid_at=@paid_at, amount_paid_cents=@amount_paid_cents, fulfillment_status=@fulfillment_status,
       internal_notes=@internal_notes, updated_at=@updated_at WHERE id=@id`,
  ).run({
    id: row.id,
    payment_status: row.payment_status,
    payment_method: row.payment_method,
    paid_at: row.paid_at,
    amount_paid_cents: row.amount_paid_cents,
    fulfillment_status: row.fulfillment_status,
    internal_notes: row.internal_notes,
    updated_at: row.updated_at,
  });
}

const STATUS_ORDER: FulfillmentStatus[] = ["pending", "preparing", "out-for-delivery", "delivered"];

export async function changeFulfillmentStatus(
  orderId: string,
  status: FulfillmentStatus,
): Promise<Order> {
  runMigrations();
  if (!STATUS_ORDER.includes(status)) {
    throw new Error(`unsupported status: ${status}`);
  }
  const db = getDb();
  const row = db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId) as OrderRow | undefined;
  if (!row) throw new Error(`order not found: ${orderId}`);
  const cur = rowToOrder(row);
  if (cur.status === status) return cur;
  const fromIdx = STATUS_ORDER.indexOf(cur.status as FulfillmentStatus);
  const toIdx = STATUS_ORDER.indexOf(status);
  if (fromIdx === -1) throw new Error(`cannot advance from ${cur.status}`);
  if (toIdx <= fromIdx) throw new Error(`invalid transition ${cur.status} → ${status}`);
  const now = new Date().toISOString();
  const next: Order = { ...cur, status, updatedAt: now };
  upsert(next);
  await recordOrderChange({
    orderId, actor: "maky", kind: "fulfillment",
    summary: `Estado: ${cur.status} → ${status}`,
  });
  return next;
}

// Records cancellation (and optional refund) state. Does NOT process a real
// Stripe/Zelle refund — that is handled manually by staff; this only reflects
// the resulting status so the ledger and customer notifications stay accurate.
export async function cancelOrder(
  orderId: string,
  args: { refund: boolean; reason?: string },
): Promise<Order> {
  runMigrations();
  const db = getDb();
  const row = db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId) as OrderRow | undefined;
  if (!row) throw new Error(`order not found: ${orderId}`);
  const cur = rowToOrder(row);
  if (cur.status === "delivered") throw new Error("cannot cancel a delivered order");
  if (cur.status === "canceled") return cur;
  if (args.refund && cur.paymentStatus !== "paid") {
    throw new Error("cannot refund an unpaid order");
  }

  const now = new Date().toISOString();
  const noteLine = `[${now}] [canceled${args.refund ? " + refunded" : ""}]${args.reason ? " " + args.reason : ""}`;
  const internalNotes = cur.internalNotes ? `${cur.internalNotes}\n${noteLine}` : noteLine;

  const next: Order = {
    ...cur,
    status: "canceled",
    paymentStatus: args.refund ? "refunded" : cur.paymentStatus,
    internalNotes,
    updatedAt: now,
  };
  upsert(next);
  await recordOrderChange({
    orderId, actor: "maky", kind: "cancel",
    summary: `Cancelada${args.refund ? " + reembolso" : ""}${args.reason ? ` · ${args.reason}` : ""}`,
  });
  return next;
}

export async function appendInternalNote(
  orderId: string,
  text: string,
  author: string,
): Promise<Order> {
  runMigrations();
  const trimmed = text.trim();
  if (!trimmed) throw new Error("note text required");
  const db = getDb();
  const row = db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId) as OrderRow | undefined;
  if (!row) throw new Error(`order not found: ${orderId}`);
  const cur = rowToOrder(row);
  const now = new Date().toISOString();
  const noteLine = `[${now} · ${author}] ${trimmed}`;
  const internalNotes = cur.internalNotes ? `${cur.internalNotes}\n${noteLine}` : noteLine;
  const next: Order = { ...cur, internalNotes, updatedAt: now };
  upsert(next);
  await recordOrderChange({ orderId, actor: author, kind: "note", summary: "Nota agregada" });
  return next;
}

// Records that the in-person difference was settled: sets amount_paid to the
// current total so the balance reads zero. Does NOT move money in Stripe.
export async function settleBalance(orderId: string, actor: string): Promise<Order> {
  runMigrations();
  const db = getDb();
  const row = db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId) as OrderRow | undefined;
  if (!row) throw new Error(`order not found: ${orderId}`);
  const cur = rowToOrder(row);
  const now = new Date().toISOString();
  const next: Order = { ...cur, amountPaidCents: cur.totals.totalCents, updatedAt: now };
  upsert(next);
  await recordOrderChange({
    orderId, actor, kind: "payment", summary: `Saldo saldado · ${money(cur.totals.totalCents)}`,
  });
  return next;
}
