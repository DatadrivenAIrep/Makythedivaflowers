import "server-only";
import crypto from "node:crypto";
import { getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import type { FieldDiff, OrderChange, OrderChangeKind } from "@/types/order";

type ChangeRow = {
  id: string; order_id: string; at: string; actor: string;
  kind: string; summary: string; changes_json: string | null;
};

export async function recordOrderChange(input: {
  orderId: string;
  actor: string;
  kind: OrderChangeKind;
  summary: string;
  changes?: FieldDiff[];
}): Promise<OrderChange> {
  runMigrations();
  const entry: OrderChange = {
    id: crypto.randomUUID(),
    orderId: input.orderId,
    at: new Date().toISOString(),
    actor: input.actor,
    kind: input.kind,
    summary: input.summary,
    ...(input.changes ? { changes: input.changes } : {}),
  };
  getDb().prepare(
    `INSERT INTO order_changes (id, order_id, at, actor, kind, summary, changes_json)
     VALUES (@id, @order_id, @at, @actor, @kind, @summary, @changes_json)`,
  ).run({
    id: entry.id, order_id: entry.orderId, at: entry.at, actor: entry.actor,
    kind: entry.kind, summary: entry.summary,
    changes_json: input.changes ? JSON.stringify(input.changes) : null,
  });
  return entry;
}

export async function listOrderHistory(orderId: string): Promise<OrderChange[]> {
  runMigrations();
  // rowid (implicit, monotonically increasing) breaks ties when two changes
  // share an `at` timestamp, preserving insertion order.
  const rows = getDb()
    .prepare("SELECT * FROM order_changes WHERE order_id = ? ORDER BY at ASC, rowid ASC")
    .all(orderId) as ChangeRow[];
  return rows.map((r) => ({
    id: r.id, orderId: r.order_id, at: r.at, actor: r.actor,
    kind: r.kind as OrderChangeKind, summary: r.summary,
    ...(r.changes_json ? { changes: JSON.parse(r.changes_json) as FieldDiff[] } : {}),
  }));
}
