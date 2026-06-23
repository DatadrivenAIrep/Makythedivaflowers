import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { orderToRow, rowToOrder, type OrderRow } from "@/lib/order-row";
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

// Atomically assign the next sequential order number. node:sqlite is
// synchronous + single-threaded, so the increment + read run back-to-back
// without another request interleaving between them.
function nextOrderNumber(): number {
  const db = getDb();
  db.prepare("UPDATE order_number_seq SET last_value = last_value + 1").run();
  const row = db.prepare("SELECT last_value AS n FROM order_number_seq").get() as
    | { n: number }
    | undefined;
  if (!row) throw new Error("order_number_seq row missing");
  return row.n;
}

function upsertSqlite(order: Order): void {
  ensureSchema();
  const db = getDb();
  const row = orderToRow(order);
  db.prepare(
    `INSERT INTO orders (
       id, locale, source, customer_id, recipient_name, recipient_phone,
       contact_name, contact_email, contact_phone, fulfillment_method, address_json,
       window_date, window_slot, card_message, lines_json,
       subtotal_cents, delivery_cents, tax_cents, total_cents,
       fulfillment_status, payment_status, payment_method, paid_at,
       stripe_payment_intent_id, taken_by, internal_notes,
       stripe_checkout_session_id, order_number, created_at, updated_at
     ) VALUES (
       @id, @locale, @source, @customer_id, @recipient_name, @recipient_phone,
       @contact_name, @contact_email, @contact_phone, @fulfillment_method, @address_json,
       @window_date, @window_slot, @card_message, @lines_json,
       @subtotal_cents, @delivery_cents, @tax_cents, @total_cents,
       @fulfillment_status, @payment_status, @payment_method, @paid_at,
       @stripe_payment_intent_id, @taken_by, @internal_notes,
       @stripe_checkout_session_id, @order_number, @created_at, @updated_at
     )
     ON CONFLICT(id) DO UPDATE SET
       locale=excluded.locale,
       source=excluded.source,
       customer_id=excluded.customer_id,
       recipient_name=excluded.recipient_name,
       recipient_phone=excluded.recipient_phone,
       contact_name=excluded.contact_name,
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
       stripe_checkout_session_id=excluded.stripe_checkout_session_id,
       order_number=COALESCE(excluded.order_number, order_number),
       updated_at=excluded.updated_at`,
  ).run(row);
}

export async function saveOrder(order: Order): Promise<void> {
  ensureSchema();
  // Assign the short sequential number. Best-effort: if the counter fails,
  // the order (and payment) must still save — it just won't have a number.
  if (order.orderNumber == null) {
    try {
      order.orderNumber = nextOrderNumber();
    } catch (e) {
      console.error(JSON.stringify({ event: "order_number_assign_failed", orderId: order.id, error: String(e) }));
    }
  }
  upsertSqlite(order);
  const all = await readAll();
  all.push(order);
  await writeAll(all);
}

export async function getOrder(id: string): Promise<Order | null> {
  ensureSchema();
  const row = getDb().prepare("SELECT * FROM orders WHERE id = ?").get(id) as OrderRow | undefined;
  return row ? rowToOrder(row) : null;
}

export async function getOrderByPaymentIntent(piId: string): Promise<Order | null> {
  ensureSchema();
  const row = getDb()
    .prepare("SELECT * FROM orders WHERE stripe_payment_intent_id = ? LIMIT 1")
    .get(piId) as OrderRow | undefined;
  return row ? rowToOrder(row) : null;
}

export async function updateOrderPaymentIntent(
  orderId: string,
  paymentIntentId: string,
): Promise<void> {
  ensureSchema();
  const db = getDb();
  const row = db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId) as OrderRow | undefined;
  if (!row) return;
  const order = rowToOrder(row);
  const now = new Date().toISOString();
  const next: Order = { ...order, stripePaymentIntentId: paymentIntentId, updatedAt: now };
  upsertSqlite(next);
  // legacy mirror — JSON write continues for the dual-write safety window
  const all = await readAll();
  const idx = all.findIndex((o) => o.id === orderId);
  if (idx >= 0) {
    all[idx] = next;
    await writeAll(all);
  }
}

const TERMINAL_FULFILLMENT: FulfillmentStatus[] = ["delivered", "canceled"];

export async function updateOrderStatusByPaymentIntent(
  paymentIntentId: string,
  status: FulfillmentStatus | "paid",
): Promise<void> {
  ensureSchema();
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM orders WHERE stripe_payment_intent_id = ? LIMIT 1")
    .get(paymentIntentId) as OrderRow | undefined;
  if (!row) return;
  const cur = rowToOrder(row);
  const now = new Date().toISOString();

  let next: Order = { ...cur, updatedAt: now };
  if (status === "paid") {
    if (cur.paymentStatus === "paid") return;
    next = { ...next, paymentStatus: "paid", paidAt: now };
  } else {
    if (TERMINAL_FULFILLMENT.includes(cur.status) && cur.status !== status) return;
    if (cur.status === status) return;
    next = { ...next, status };
  }
  upsertSqlite(next);
  const all = await readAll();
  const idx = all.findIndex((o) => o.id === cur.id);
  if (idx >= 0) {
    all[idx] = next;
    await writeAll(all);
  }
}

export async function updateOrderCheckoutSessionId(
  orderId: string,
  sessionId: string,
): Promise<void> {
  ensureSchema();
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE orders SET stripe_checkout_session_id = ?, updated_at = ? WHERE id = ?`,
  ).run(sessionId, now, orderId);
}

export async function getOrderByCheckoutSessionId(sessionId: string): Promise<Order | null> {
  ensureSchema();
  const row = getDb()
    .prepare("SELECT * FROM orders WHERE stripe_checkout_session_id = ? LIMIT 1")
    .get(sessionId) as OrderRow | undefined;
  return row ? rowToOrder(row) : null;
}

export async function updateOrderPaidByCheckoutSession(sessionId: string): Promise<void> {
  ensureSchema();
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE orders SET payment_status = 'paid', paid_at = COALESCE(paid_at, ?), updated_at = ? WHERE stripe_checkout_session_id = ? AND payment_status != 'paid'`,
  ).run(now, now, sessionId);
}

// Deliveries scheduled for a given window date (not order-creation date),
// excluding canceled orders. Ordered by slot then time placed, for the driver
// run sheet. Returns delivered orders too so staff can see what's already done.
export async function listDeliveriesForDate(date: string): Promise<Order[]> {
  ensureSchema();
  const rows = getDb().prepare(
    `SELECT * FROM orders
     WHERE fulfillment_method = 'delivery'
       AND window_date = ?
       AND fulfillment_status != 'canceled'
     ORDER BY created_at ASC`,
  ).all(date) as OrderRow[];
  return rows.map(rowToOrder);
}

export type ListOrdersFilters = {
  q?: string;
  from?: string;
  to?: string;
  paymentStatus?: string[];
  fulfillmentStatus?: string[];
  source?: string[];
  fulfillmentMethod?: string[];
  limit?: number;
  cursor?: string; // base64url(`${createdAt}|${id}`)
};

export type ListOrdersResult = {
  orders: import("@/types/order").Order[];
  nextCursor: string | null;
  approxTotal: number;
};

function encodeCursor(createdAt: string, id: string): string {
  return Buffer.from(`${createdAt}|${id}`, "utf8").toString("base64url");
}

function decodeCursor(c: string): { createdAt: string; id: string } | null {
  try {
    const s = Buffer.from(c, "base64url").toString("utf8");
    const i = s.indexOf("|");
    if (i < 0) return null;
    return { createdAt: s.slice(0, i), id: s.slice(i + 1) };
  } catch { return null; }
}

export async function listOrders(filters: ListOrdersFilters): Promise<ListOrdersResult> {
  ensureSchema();
  const db = getDb();
  const where: string[] = [];
  const params: unknown[] = [];

  if (filters.from) { where.push("created_at >= ?"); params.push(filters.from); }
  if (filters.to)   { where.push("created_at <= ?"); params.push(filters.to); }
  if (filters.paymentStatus?.length) {
    where.push(`payment_status IN (${filters.paymentStatus.map(() => "?").join(",")})`);
    params.push(...filters.paymentStatus);
  }
  if (filters.fulfillmentStatus?.length) {
    where.push(`fulfillment_status IN (${filters.fulfillmentStatus.map(() => "?").join(",")})`);
    params.push(...filters.fulfillmentStatus);
  }
  if (filters.source?.length) {
    where.push(`source IN (${filters.source.map(() => "?").join(",")})`);
    params.push(...filters.source);
  }
  if (filters.fulfillmentMethod?.length) {
    where.push(`fulfillment_method IN (${filters.fulfillmentMethod.map(() => "?").join(",")})`);
    params.push(...filters.fulfillmentMethod);
  }
  if (filters.q) {
    const like = `%${filters.q}%`;
    where.push(
      "(recipient_name LIKE ? OR recipient_phone LIKE ? OR contact_email LIKE ? OR id LIKE ? OR card_message LIKE ?)",
    );
    params.push(like, like, like, like, like);
  }

  const baseWhere = where.length ? `WHERE ${where.join(" AND ")}` : "";

  // total (no cursor)
  const totalRow = db.prepare(`SELECT COUNT(*) AS n FROM orders ${baseWhere}`).get(...params) as { n: number };
  const approxTotal = totalRow.n;

  // page (with cursor)
  const limit = Math.min(Math.max(filters.limit ?? 50, 1), 200);
  const pageWhere = [...where];
  const pageParams = [...params];
  if (filters.cursor) {
    const c = decodeCursor(filters.cursor);
    if (c) {
      pageWhere.push("(created_at < ? OR (created_at = ? AND id < ?))");
      pageParams.push(c.createdAt, c.createdAt, c.id);
    }
  }
  const pageWhereSql = pageWhere.length ? `WHERE ${pageWhere.join(" AND ")}` : "";

  const rows = db.prepare(
    `SELECT * FROM orders ${pageWhereSql}
     ORDER BY created_at DESC, id DESC
     LIMIT ?`,
  ).all(...pageParams, limit + 1) as OrderRow[];

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page[page.length - 1];
  const nextCursor = hasMore && last ? encodeCursor(last.created_at, last.id) : null;

  return { orders: page.map(rowToOrder), nextCursor, approxTotal };
}
