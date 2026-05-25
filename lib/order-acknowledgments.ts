import "server-only";
import { getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";

function ensure() { runMigrations(); }

export function acknowledgeOrder(orderId: string, by: string): void {
  ensure();
  getDb().prepare(
    `INSERT INTO order_acknowledgments (order_id, acknowledged_at, acknowledged_by)
     VALUES (?, ?, ?)
     ON CONFLICT(order_id) DO NOTHING`,
  ).run(orderId, new Date().toISOString(), by);
}

export function isAcknowledged(orderId: string): boolean {
  ensure();
  const row = getDb()
    .prepare("SELECT 1 AS one FROM order_acknowledgments WHERE order_id = ?")
    .get(orderId) as { one: number } | undefined;
  return !!row;
}

export function listAcknowledgedIds(orderIds: string[]): string[] {
  if (orderIds.length === 0) return [];
  ensure();
  const placeholders = orderIds.map(() => "?").join(",");
  const rows = getDb()
    .prepare(`SELECT order_id FROM order_acknowledgments WHERE order_id IN (${placeholders})`)
    .all(...orderIds) as { order_id: string }[];
  return rows.map((r) => r.order_id);
}
