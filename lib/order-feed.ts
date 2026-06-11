import "server-only";
import { getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { activeOrderVisibilitySql } from "@/lib/order-visibility";

export type FeedEvent = {
  kind: "created" | "paid" | "status_changed";
  orderId: string;
  at: string; // ISO timestamp
  label: string;
  source: string;
  totalCents: number;
  recipientName: string;
};

function fmtMoney(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

const STATUS_LABEL_ES: Record<string, string> = {
  pending: "Pendiente",
  preparing: "Preparando",
  "out-for-delivery": "En camino",
  delivered: "Entregada",
  failed: "Fallida",
  canceled: "Cancelada",
};

export async function getRecentFeed(sinceHours = 24): Promise<{ events: FeedEvent[] }> {
  runMigrations();
  const since = new Date(Date.now() - sinceHours * 3600_000).toISOString();
  const rows = getDb().prepare(`
    SELECT id, source, recipient_name, total_cents, fulfillment_status, payment_status,
           created_at, paid_at, updated_at
      FROM orders
     WHERE ${activeOrderVisibilitySql()} AND (created_at >= ? OR paid_at >= ? OR updated_at >= ?)
  `).all(since, since, since) as {
    id: string; source: string; recipient_name: string; total_cents: number;
    fulfillment_status: string; payment_status: string;
    created_at: string; paid_at: string | null; updated_at: string;
  }[];

  const events: FeedEvent[] = [];
  for (const r of rows) {
    if (r.created_at >= since) {
      events.push({
        kind: "created", orderId: r.id, at: r.created_at,
        label: `Orden ${r.source}: ${r.recipient_name} · ${fmtMoney(r.total_cents)}`,
        source: r.source, totalCents: r.total_cents, recipientName: r.recipient_name,
      });
    }
    if (r.paid_at && r.paid_at >= since) {
      events.push({
        kind: "paid", orderId: r.id, at: r.paid_at,
        label: `Pago confirmado: ${r.recipient_name} · ${fmtMoney(r.total_cents)}`,
        source: r.source, totalCents: r.total_cents, recipientName: r.recipient_name,
      });
    }
    if (
      r.updated_at >= since &&
      r.updated_at !== r.created_at &&
      r.updated_at !== r.paid_at &&
      r.fulfillment_status !== "pending"
    ) {
      events.push({
        kind: "status_changed", orderId: r.id, at: r.updated_at,
        label: `${STATUS_LABEL_ES[r.fulfillment_status] ?? r.fulfillment_status}: ${r.recipient_name}`,
        source: r.source, totalCents: r.total_cents, recipientName: r.recipient_name,
      });
    }
  }

  events.sort((a, b) => b.at.localeCompare(a.at));
  return { events };
}
