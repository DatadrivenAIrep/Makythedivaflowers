import "server-only";
import { getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { rowToOrder, type OrderRow } from "@/lib/order-row";
import type { Order } from "@/types/order";

export const INTAKE_UNPAID_STALE_HOURS = 1;
export const WEB_UNACK_CAP_HOURS = 72;

export type PendingReason =
  | "delivery_today_unpaid"
  | "pickup_today_unpaid"
  | "delivery_today_undispatched"
  | "intake_unpaid_stale"
  | "web_unacknowledged";

const URGENCY_RANK: Record<PendingReason, number> = {
  delivery_today_unpaid: 5,
  pickup_today_unpaid: 4,
  delivery_today_undispatched: 3,
  intake_unpaid_stale: 2,
  web_unacknowledged: 1,
};

export type PendingItem = {
  orderId: string;
  reason: PendingReason;
  order: Order;
};

function todayISODate(now = new Date()): string {
  // Local YYYY-MM-DD matching how intake form writes window_date
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export async function getPendingQueue(): Promise<PendingItem[]> {
  runMigrations();
  const db = getDb();
  const now = new Date();
  const today = todayISODate(now);
  const cutoffStale = new Date(now.getTime() - INTAKE_UNPAID_STALE_HOURS * 3600_000).toISOString();
  const cutoffCap = new Date(now.getTime() - WEB_UNACK_CAP_HOURS * 3600_000).toISOString();

  // Candidate set: any order matching ANY rule. Then we annotate the reason per row.
  const rows = db.prepare(`
    SELECT o.* FROM orders o
    LEFT JOIN order_acknowledgments a ON a.order_id = o.id
    WHERE (
      -- web_unacknowledged
      (o.source = 'web' AND a.order_id IS NULL AND o.created_at >= ?)
      -- intake_unpaid_stale
      OR (o.source != 'web' AND o.payment_status = 'pending'
          AND o.created_at <= ? AND o.stripe_checkout_session_id IS NOT NULL)
      -- delivery_today_undispatched
      OR (o.fulfillment_method = 'delivery' AND o.window_date = ?
          AND o.fulfillment_status NOT IN ('out-for-delivery','delivered','canceled'))
      -- delivery_today_unpaid
      OR (o.fulfillment_method = 'delivery' AND o.window_date = ? AND o.payment_status = 'pending')
      -- pickup_today_unpaid
      OR (o.fulfillment_method = 'pickup' AND o.window_date = ? AND o.payment_status = 'pending')
    )
  `).all(cutoffCap, cutoffStale, today, today, today) as OrderRow[];

  const acked = new Set<string>(
    (db.prepare("SELECT order_id FROM order_acknowledgments").all() as { order_id: string }[])
      .map((r) => r.order_id),
  );

  const items: PendingItem[] = [];
  for (const row of rows) {
    const order = rowToOrder(row);
    const reasons: PendingReason[] = [];
    if (
      order.fulfillment.method === "delivery" &&
      order.fulfillment.window.date === today &&
      order.paymentStatus === "pending"
    ) reasons.push("delivery_today_unpaid");
    if (
      order.fulfillment.method === "pickup" &&
      order.fulfillment.window.date === today &&
      order.paymentStatus === "pending"
    ) reasons.push("pickup_today_unpaid");
    if (
      order.fulfillment.method === "delivery" &&
      order.fulfillment.window.date === today &&
      !["out-for-delivery", "delivered", "canceled"].includes(order.status)
    ) reasons.push("delivery_today_undispatched");
    if (
      order.source !== "web" &&
      order.paymentStatus === "pending" &&
      order.createdAt <= cutoffStale &&
      !!order.stripeCheckoutSessionId
    ) reasons.push("intake_unpaid_stale");
    if (
      order.source === "web" &&
      !acked.has(order.id) &&
      order.createdAt >= cutoffCap
    ) reasons.push("web_unacknowledged");

    if (reasons.length === 0) continue;
    reasons.sort((a, b) => URGENCY_RANK[b] - URGENCY_RANK[a]);
    items.push({ orderId: order.id, reason: reasons[0], order });
  }

  items.sort((a, b) => URGENCY_RANK[b.reason] - URGENCY_RANK[a.reason]);
  return items;
}
