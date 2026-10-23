#!/usr/bin/env tsx
/**
 * Recovers CRM customers from historical paid orders — the ones lost while the
 * web checkout was never calling upsertOnOrder.
 *
 * The logic lives in lib/backfill-customers.ts so the admin can run the same
 * thing from Clientes → "Ligar pedidos" without shell access to the server.
 *
 * This script SENDS NOTHING. It never touches lib/messaging or lib/order-dispatch.
 * Replaying confirmations for months-old orders would be an incident, not a
 * feature. Keep it that way.
 *
 *   npm run backfill:customers            # dry run, prints the report
 *   npm run backfill:customers -- --commit
 */
import { backfillCustomers } from "../lib/backfill-customers";

export { backfillCustomers };
export type { BackfillReport } from "../lib/backfill-customers";

// CLI wrapper. Guarded so importing this module in tests does not execute it.
if (process.argv[1] && process.argv[1].includes("backfill-customers-from-orders")) {
  const commit = process.argv.includes("--commit");
  const report = backfillCustomers({ commit });
  console.log(JSON.stringify({ mode: commit ? "COMMIT" : "DRY RUN", ...report }, null, 2));
  if (!commit) {
    console.log("\nDry run — nothing was written. Re-run with --commit to apply.");
  }
}
