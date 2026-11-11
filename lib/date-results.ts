import "server-only";
import { getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import type { ReminderStage } from "@/lib/date-reminders";

export type StageResults = { sent: number; skipped: number; orders: number; revenueCents: number };
export type DateResults = {
  customersWithOwnDates: number;
  withSms: number;
  stages: Record<ReminderStage, StageResults>;
  stopsWithin48h: number;
};

const DAY_MS = 86400_000;
const ATTRIBUTION_DAYS = 10;
const STOP_WINDOW_MS = 48 * 3600_000;

/**
 * What the stamps-for-data program did in the last `days` days. Orders are attributed
 * (a coincidence, not a cause) to the stage of the latest `sent` message of one of the
 * customer's dates in the 10 days before the order; skipped rows never attribute.
 */
export function dateResults(now: Date = new Date(), days = 90): DateResults {
  runMigrations();
  const db = getDb();
  const since = new Date(now.getTime() - days * DAY_MS).toISOString();
  const stages: Record<ReminderStage, StageResults> = {
    d7: { sent: 0, skipped: 0, orders: 0, revenueCents: 0 },
    d3: { sent: 0, skipped: 0, orders: 0, revenueCents: 0 },
  };

  // Customers who saved a date themselves within the window (a date deleted since
  // no longer counts: the table keeps no history of deletions).
  const own = db
    .prepare(
      `SELECT COUNT(DISTINCT d.customer_id) AS n,
              COUNT(DISTINCT CASE WHEN EXISTS (
                SELECT 1 FROM customer_tags t WHERE t.customer_id = d.customer_id AND t.tag = 'sms-marketing'
              ) THEN d.customer_id END) AS sms
         FROM customer_important_dates d
        WHERE d.source = 'customer' AND d.created_at >= ? AND d.created_at <= ?`,
    )
    .get(since, now.toISOString()) as { n: number; sms: number };

  const counts = db
    .prepare(
      `SELECT stage, status, COUNT(*) AS n FROM date_reminder_sends
        WHERE recorded_at >= ? AND recorded_at <= ? GROUP BY stage, status`,
    )
    .all(since, now.toISOString()) as Array<{ stage: ReminderStage; status: "sent" | "skipped"; n: number }>;
  for (const c of counts) stages[c.stage][c.status === "sent" ? "sent" : "skipped"] = c.n;

  const orders = db
    .prepare(
      `SELECT customer_id, total_cents, created_at FROM orders
        WHERE customer_id IS NOT NULL AND payment_status = 'paid'
          AND fulfillment_status != 'canceled' AND created_at >= ? AND created_at <= ?`,
    )
    .all(since, now.toISOString()) as Array<{ customer_id: string; total_cents: number; created_at: string }>;
  const latestSent = db.prepare(
    `SELECT s.stage FROM date_reminder_sends s
       JOIN customer_important_dates d ON d.id = s.date_id
      WHERE d.customer_id = ? AND s.status = 'sent' AND s.recorded_at >= ? AND s.recorded_at <= ?
      ORDER BY s.recorded_at DESC LIMIT 1`,
  );
  for (const o of orders) {
    const from = new Date(new Date(o.created_at).getTime() - ATTRIBUTION_DAYS * DAY_MS).toISOString();
    const hit = latestSent.get(o.customer_id, from, o.created_at) as { stage: ReminderStage } | undefined;
    if (!hit) continue;
    stages[hit.stage].orders += 1;
    stages[hit.stage].revenueCents += o.total_cents;
  }

  const stoppers = db
    .prepare(
      `SELECT c.id, c.sms_stopped_at FROM customers c WHERE c.sms_stopped_at IS NOT NULL`,
    )
    .all() as Array<{ id: string; sms_stopped_at: string }>;
  const sentTimes = db.prepare(
    `SELECT s.recorded_at FROM date_reminder_sends s
       JOIN customer_important_dates d ON d.id = s.date_id
      WHERE d.customer_id = ? AND s.status = 'sent' AND s.recorded_at >= ? AND s.recorded_at <= ?`,
  );
  let stopsWithin48h = 0;
  for (const c of stoppers) {
    const stopped = new Date(c.sms_stopped_at).getTime();
    const rows = sentTimes.all(c.id, since, now.toISOString()) as Array<{ recorded_at: string }>;
    if (rows.some((r) => {
      const at = new Date(r.recorded_at).getTime();
      return stopped >= at && stopped - at <= STOP_WINDOW_MS;
    })) stopsWithin48h += 1;
  }

  return { customersWithOwnDates: own.n, withSms: own.sms, stages, stopsWithin48h };
}
