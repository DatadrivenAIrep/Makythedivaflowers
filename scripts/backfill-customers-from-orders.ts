#!/usr/bin/env tsx
/**
 * Recovers CRM customers from historical paid orders — the ones lost while the
 * web checkout was never calling upsertOnOrder.
 *
 * Reuses upsertOnOrder so a backfilled customer is indistinguishable from an
 * organically created one, and matches on normalised phone so a web buyer who is
 * already a counter customer is merged rather than duplicated.
 *
 * This script SENDS NOTHING. It never touches lib/messaging or lib/order-dispatch.
 * Replaying confirmations for months-old orders would be an incident, not a
 * feature. Keep it that way.
 *
 *   npm run backfill:customers            # dry run, prints the report
 *   npm run backfill:customers -- --commit
 */
import { getDb } from "../lib/db";
import { runMigrations } from "../lib/db-migrate";
import { upsertOnOrder, normalizePhone } from "../lib/customer-storage";

type PendingRow = {
  id: string;
  contact_name: string | null;
  recipient_name: string;
  contact_phone: string;
  contact_email: string | null;
  locale: string;
  paid_at: string | null;
  created_at: string;
};

export type BackfillReport = {
  ordersScanned: number;
  customersCreated: number;
  ordersMerged: number;
  failures: Array<{ orderId: string; error: string }>;
};

export function backfillCustomers(opts: { commit: boolean }): BackfillReport {
  runMigrations();
  const db = getDb();

  // Oldest first, so first_seen_at / last_seen_at land in the right order as
  // upsertOnOrder walks each customer's history forward.
  const rows = db
    .prepare(
      `SELECT id, contact_name, recipient_name, contact_phone, contact_email,
              locale, paid_at, created_at
         FROM orders
        WHERE payment_status = 'paid'
          AND customer_id IS NULL
          AND contact_phone <> ''
        ORDER BY created_at ASC`,
    )
    .all() as PendingRow[];

  const report: BackfillReport = {
    ordersScanned: rows.length,
    customersCreated: 0,
    ordersMerged: 0,
    failures: [],
  };

  const knownPhones = new Set(
    (db.prepare("SELECT phone FROM customers").all() as Array<{ phone: string }>).map((r) => r.phone),
  );
  const seenThisRun = new Set<string>();

  for (const row of rows) {
    const normalized = normalizePhone(row.contact_phone);
    const isNew = !knownPhones.has(normalized) && !seenThisRun.has(normalized);

    if (!opts.commit) {
      // Dry run: report what WOULD happen, write nothing.
      if (isNew) report.customersCreated += 1; else report.ordersMerged += 1;
      seenThisRun.add(normalized);
      continue;
    }

    try {
      const customer = upsertOnOrder({
        name: (row.contact_name?.trim() || row.recipient_name.trim()),
        phone: row.contact_phone,
        email: row.contact_email || undefined,
        orderAt: row.paid_at ?? row.created_at,
        locale: row.locale === "es" ? "es" : "en",
      });
      // Not wrapped in a transaction with the upsert: node:sqlite + upsertOnOrder's
      // own migration txn make nesting unsafe. If this UPDATE fails after the
      // upsert, the order stays unlinked and a re-run re-upserts it (rare; may
      // inflate order_count by 1).
      db.prepare("UPDATE orders SET customer_id = ? WHERE id = ?").run(customer.id, row.id);
      // Count only after both writes succeed.
      if (isNew) report.customersCreated += 1; else report.ordersMerged += 1;
      seenThisRun.add(normalized);
    } catch (e) {
      // One malformed row must not strand the run, and must not be counted as success.
      report.failures.push({
        orderId: row.id,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return report;
}

// CLI wrapper. Guarded so importing this module in tests does not execute it.
if (process.argv[1] && process.argv[1].includes("backfill-customers-from-orders")) {
  const commit = process.argv.includes("--commit");
  const report = backfillCustomers({ commit });
  console.log(JSON.stringify({ mode: commit ? "COMMIT" : "DRY RUN", ...report }, null, 2));
  if (!commit) {
    console.log("\nDry run — nothing was written. Re-run with --commit to apply.");
  }
}
