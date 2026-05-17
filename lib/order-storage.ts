import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { orderToRow } from "@/lib/order-row";
import type { Order, FulfillmentStatus } from "@/types/order";

function storageFile(): string {
  const override = process.env.ORDER_STORAGE_FILE;
  if (override) return path.isAbsolute(override) ? override : path.resolve(override);
  return path.join(process.cwd(), "pending-orders.json");
}

async function readAll(): Promise<Order[]> {
  try {
    const raw = await fs.readFile(storageFile(), "utf8");
    return JSON.parse(raw) as Order[];
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw e;
  }
}

async function writeAll(all: Order[]): Promise<void> {
  await fs.writeFile(storageFile(), JSON.stringify(all, null, 2), "utf8");
}

function ensureSchema(): void {
  runMigrations();
}

function upsertSqlite(order: Order): void {
  ensureSchema();
  const db = getDb();
  const row = orderToRow(order);
  db.prepare(
    `INSERT INTO orders (
       id, locale, source, customer_id, recipient_name, recipient_phone,
       contact_email, contact_phone, fulfillment_method, address_json,
       window_date, window_slot, card_message, lines_json,
       subtotal_cents, delivery_cents, tax_cents, total_cents,
       fulfillment_status, payment_status, payment_method, paid_at,
       stripe_payment_intent_id, taken_by, internal_notes, created_at, updated_at
     ) VALUES (
       @id, @locale, @source, @customer_id, @recipient_name, @recipient_phone,
       @contact_email, @contact_phone, @fulfillment_method, @address_json,
       @window_date, @window_slot, @card_message, @lines_json,
       @subtotal_cents, @delivery_cents, @tax_cents, @total_cents,
       @fulfillment_status, @payment_status, @payment_method, @paid_at,
       @stripe_payment_intent_id, @taken_by, @internal_notes, @created_at, @updated_at
     )
     ON CONFLICT(id) DO UPDATE SET
       locale=excluded.locale,
       source=excluded.source,
       customer_id=excluded.customer_id,
       recipient_name=excluded.recipient_name,
       recipient_phone=excluded.recipient_phone,
       contact_email=excluded.contact_email,
       contact_phone=excluded.contact_phone,
       fulfillment_method=excluded.fulfillment_method,
       address_json=excluded.address_json,
       window_date=excluded.window_date,
       window_slot=excluded.window_slot,
       card_message=excluded.card_message,
       lines_json=excluded.lines_json,
       subtotal_cents=excluded.subtotal_cents,
       delivery_cents=excluded.delivery_cents,
       tax_cents=excluded.tax_cents,
       total_cents=excluded.total_cents,
       fulfillment_status=excluded.fulfillment_status,
       payment_status=excluded.payment_status,
       payment_method=excluded.payment_method,
       paid_at=excluded.paid_at,
       stripe_payment_intent_id=excluded.stripe_payment_intent_id,
       taken_by=excluded.taken_by,
       internal_notes=excluded.internal_notes,
       updated_at=excluded.updated_at`,
  ).run(row);
}

function safeMirror(order: Order): void {
  try {
    upsertSqlite(order);
  } catch (e) {
    console.error(JSON.stringify({ event: "sqlite_mirror_failed", orderId: order.id, error: String(e) }));
  }
}

export async function saveOrder(order: Order): Promise<void> {
  const all = await readAll();
  all.push(order);
  await writeAll(all);
  safeMirror(order);
}

export async function getOrder(id: string): Promise<Order | null> {
  const all = await readAll();
  return all.find((o) => o.id === id) ?? null;
}

export async function getOrderByPaymentIntent(piId: string): Promise<Order | null> {
  const all = await readAll();
  return all.find((o) => o.stripePaymentIntentId === piId) ?? null;
}

export async function updateOrderPaymentIntent(
  orderId: string,
  paymentIntentId: string,
): Promise<void> {
  const all = await readAll();
  const idx = all.findIndex((o) => o.id === orderId);
  if (idx < 0) return;
  const next = { ...all[idx], stripePaymentIntentId: paymentIntentId, updatedAt: new Date().toISOString() };
  all[idx] = next;
  await writeAll(all);
  safeMirror(next);
}

const TERMINAL_FULFILLMENT: FulfillmentStatus[] = ["delivered", "canceled"];

export async function updateOrderStatusByPaymentIntent(
  paymentIntentId: string,
  status: FulfillmentStatus | "paid",
): Promise<void> {
  const all = await readAll();
  const idx = all.findIndex((o) => o.stripePaymentIntentId === paymentIntentId);
  if (idx < 0) return;
  const cur = all[idx];
  const now = new Date().toISOString();

  let next = { ...cur, updatedAt: now };
  if (status === "paid") {
    if (cur.paymentStatus === "paid") return;
    next = { ...next, paymentStatus: "paid", paidAt: now };
  } else {
    if (TERMINAL_FULFILLMENT.includes(cur.status) && cur.status !== status) return;
    if (cur.status === status) return;
    next = { ...next, status };
  }
  all[idx] = next;
  await writeAll(all);
  safeMirror(next);
}
