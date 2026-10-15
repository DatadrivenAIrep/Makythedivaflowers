import "server-only";
import { getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { salesScores } from "@/lib/product-ranking";

type Row = {
  source: string;
  payment_status: string;
  fulfillment_status: string;
  amount_paid_cents: number;
  created_at: string;
  lines_json: string;
};

// Past two years an order weighs under 1% of a fresh one: not worth reading.
const LOOKBACK_DAYS = 730;

/** Sales score per product id from the orders table, for the shop's "Recommended" order. */
export function getSalesRanking(now: Date = new Date()): Map<string, number> {
  try {
    runMigrations();
    const since = new Date(now.getTime() - LOOKBACK_DAYS * 86_400_000).toISOString();
    const rows = getDb()
      .prepare(
        `SELECT source, payment_status, fulfillment_status, amount_paid_cents, created_at, lines_json
         FROM orders WHERE created_at >= ?`,
      )
      .all(since) as Row[];
    return salesScores(
      rows.map((r) => ({
        source: r.source,
        paymentStatus: r.payment_status,
        fulfillmentStatus: r.fulfillment_status,
        amountPaidCents: r.amount_paid_cents,
        createdAt: r.created_at,
        linesJson: r.lines_json,
      })),
      now,
    );
  } catch (err) {
    // The shop must render even if the orders table can't be read: fall back
    // to staff picks and newest, which need no sales.
    console.error("[product-sales] ranking unavailable", err);
    return new Map();
  }
}
