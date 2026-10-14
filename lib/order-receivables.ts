// lib/order-receivables.ts
// "Por cobrar": orders whose delivery/pickup day (or in-store sale day) has
// passed and that still owe money. Today's unpaid orders are the pending
// queue's job (lib/order-queue.ts); house-account orders are billed through
// their statements; canceled and refunded orders owe nothing.
import "server-only";
import { getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { rowToOrder, type OrderRow } from "@/lib/order-row";
import { activeOrderVisibilitySql } from "@/lib/order-visibility";
import { orderBalanceCents } from "@/lib/order-balance";
import { shopDateStr } from "@/lib/tv-slots";
import type { Order } from "@/types/order";

export type Receivable = {
  orderId: string;
  orderNumber: number | null;
  buyerName: string;
  phone: string;
  method: Order["fulfillment"]["method"];
  /** Shop-local YYYY-MM-DD the money was due: the delivery/pickup day, or the sale day in-store. */
  dueDate: string;
  daysOverdue: number;
  balanceCents: number;
  /** A payment link only settles an order still pending; one already marked paid
   *  (edited upward afterwards) is collected by hand. */
  canRemind: boolean;
  lastReminderAt?: string;
};

export type Receivables = { items: Receivable[]; totalCents: number };

function dueDateOf(order: Order): string {
  return order.fulfillment.method !== "in-store" && "window" in order.fulfillment
    ? order.fulfillment.window.date
    : shopDateStr(new Date(order.createdAt));
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

export function getReceivables(now: Date = new Date()): Receivables {
  runMigrations();
  const db = getDb();
  const today = shopDateStr(now);
  const rows = db.prepare(`
    SELECT o.* FROM orders o
    WHERE ${activeOrderVisibilitySql("o")}
      AND o.fulfillment_status != 'canceled'
      AND o.payment_status != 'refunded'
      AND o.house_account_id IS NULL
      AND o.payment_method IS NOT 'house-account'
      AND o.total_cents > COALESCE(o.amount_paid_cents, 0)
  `).all() as OrderRow[];

  const reminded = new Map(
    (db.prepare(`
      SELECT order_id, MAX(created_at) AS at FROM messages
      WHERE template = 'payment_reminder' AND status = 'sent'
      GROUP BY order_id
    `).all() as { order_id: string; at: string }[]).map((r) => [r.order_id, r.at]),
  );

  const items: Receivable[] = [];
  for (const row of rows) {
    const order = rowToOrder(row);
    const dueDate = dueDateOf(order);
    if (dueDate >= today) continue;
    const lastReminderAt = reminded.get(order.id);
    items.push({
      orderId: order.id,
      orderNumber: order.orderNumber ?? null,
      buyerName: order.contact.name?.trim() || order.fulfillment.recipient.name,
      phone: order.contact.phone,
      method: order.fulfillment.method,
      dueDate,
      daysOverdue: daysBetween(dueDate, today),
      balanceCents: orderBalanceCents(order),
      canRemind: order.paymentStatus !== "paid",
      ...(lastReminderAt ? { lastReminderAt } : {}),
    });
  }
  items.sort((a, b) => a.dueDate.localeCompare(b.dueDate) || (a.orderNumber ?? 0) - (b.orderNumber ?? 0));
  return { items, totalCents: items.reduce((sum, i) => sum + i.balanceCents, 0) };
}
