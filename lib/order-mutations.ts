import "server-only";
import { getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { rowToOrder, orderToRow, type OrderRow } from "@/lib/order-row";
import type { Order, PaymentMethod, FulfillmentStatus } from "@/types/order";

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
    internalNotes,
    updatedAt: now,
  };
  upsert(next);
  return next;
}

function upsert(order: Order): void {
  const db = getDb();
  const row = orderToRow(order);
  db.prepare(
    `UPDATE orders SET payment_status=@payment_status, payment_method=@payment_method,
       paid_at=@paid_at, fulfillment_status=@fulfillment_status, internal_notes=@internal_notes,
       updated_at=@updated_at WHERE id=@id`,
  ).run({
    id: row.id,
    payment_status: row.payment_status,
    payment_method: row.payment_method,
    paid_at: row.paid_at,
    fulfillment_status: row.fulfillment_status,
    internal_notes: row.internal_notes,
    updated_at: row.updated_at,
  });
}

// Exported so later tasks can reuse the same upsert path.
export const __testing_upsert = upsert;

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
  return next;
}
