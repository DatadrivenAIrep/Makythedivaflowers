import "server-only";
/**
 * Recovers CRM customers from historical paid orders — the ones lost while the
 * web checkout was never calling upsertOnOrder. Without the link those orders
 * count for nobody: the customers list shows $0 lifetime value and the wrong
 * segment (VIP / "Sin volver") for anyone who bought on the web.
 *
 * Reuses upsertOnOrder so a backfilled customer is indistinguishable from an
 * organically created one, and matches on normalised phone so a web buyer who is
 * already a counter customer is merged rather than duplicated.
 *
 * Run from the admin (Clientes → "Ligar pedidos", /api/admin/customers/backfill)
 * or from the shell (scripts/backfill-customers-from-orders.ts).
 *
 * This module SENDS NOTHING. It never touches lib/messaging or lib/order-dispatch.
 * Replaying confirmations for months-old orders would be an incident, not a
 * feature. Keep it that way.
 */
import { getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { upsertOnOrder, normalizePhone } from "@/lib/customer-storage";
import type { Address } from "@/types/address";

type PendingRow = {
  id: string;
  contact_name: string | null;
  contact_phone: string;
  contact_email: string | null;
  locale: string;
  paid_at: string | null;
  created_at: string;
  address_json: string | null;
  fulfillment_method: string;
};

type ExistingCustomer = {
  id: string;
  name: string;
  email: string | null;
  last_address_json: string | null;
  locale: string | null;
  first_seen_at: string;
  last_seen_at: string;
};

export type BackfillPreview = {
  /** Paid orders that no customer owns yet — what the run would link. */
  pendingOrders: number;
  /** Customers the run would create (phones with no customer record). */
  newCustomers: number;
  /** Pending orders that land on a customer that exists or is created earlier in the run. */
  ordersToMerge: number;
};

export type BackfillReport = {
  ordersScanned: number;
  customersCreated: number;
  ordersMerged: number;
  failures: Array<{ orderId: string; error: string }>;
};

/** Paid, unlinked orders with a usable phone, oldest first, so first_seen_at /
 *  last_seen_at land in the right order as upsertOnOrder walks each customer's
 *  history forward. A phone with no digits would normalise to "" and lump every
 *  such order onto one blank-phone customer, so those are left alone. */
function pendingRows(): PendingRow[] {
  const rows = getDb()
    .prepare(
      `SELECT id, contact_name, contact_phone, contact_email,
              locale, paid_at, created_at, address_json, fulfillment_method
         FROM orders
        WHERE payment_status = 'paid'
          AND customer_id IS NULL
          AND contact_phone <> ''
        ORDER BY created_at ASC`,
    )
    .all() as PendingRow[];
  return rows.filter((r) => normalizePhone(r.contact_phone) !== "");
}

function knownPhones(): Set<string> {
  return new Set(
    (getDb().prepare("SELECT phone FROM customers").all() as Array<{ phone: string }>).map(
      (r) => r.phone,
    ),
  );
}

function time(iso: string): number {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : t;
}

/** Counts what a run would do, writing nothing. */
export function previewBackfill(): BackfillPreview {
  runMigrations();
  const rows = pendingRows();
  const known = knownPhones();
  let newCustomers = 0;
  for (const row of rows) {
    const phone = normalizePhone(row.contact_phone);
    if (!known.has(phone)) {
      newCustomers += 1;
      known.add(phone);
    }
  }
  return { pendingOrders: rows.length, newCustomers, ordersToMerge: rows.length - newCustomers };
}

/** Links every pending order to its customer (creating or merging). Idempotent:
 *  a linked order is no longer pending, so a second run finds nothing. */
export function runBackfill(): BackfillReport {
  runMigrations();
  const db = getDb();
  const rows = pendingRows();
  const report: BackfillReport = {
    ordersScanned: rows.length,
    customersCreated: 0,
    ordersMerged: 0,
    failures: [],
  };
  // Customers that existed before this run. Their record was curated by the shop
  // (counter intake, edits in the admin), so an old web order must not rewrite it.
  const preExisting = knownPhones();

  const stillPending = db.prepare(
    "SELECT 1 FROM orders WHERE id = ? AND customer_id IS NULL AND payment_status = 'paid'",
  );
  const findCustomer = db.prepare(
    `SELECT id, name, email, last_address_json, locale, first_seen_at, last_seen_at
       FROM customers WHERE phone = ?`,
  );
  const link = db.prepare("UPDATE orders SET customer_id = ? WHERE id = ?");
  const restoreNewer = db.prepare(
    `UPDATE customers SET
       first_seen_at = ?,
       last_seen_at = ?,
       email = COALESCE(?, email),
       last_address_json = COALESCE(?, last_address_json),
       locale = COALESCE(?, locale)
     WHERE id = ?`,
  );

  for (const row of rows) {
    const phone = normalizePhone(row.contact_phone);
    // runMigrations() already ran for this connection, so upsertOnOrder's own call
    // is a no-op and opens no transaction — nesting it inside ours is safe. One
    // transaction per order keeps the count bump and the link together (a crash
    // between them can no longer inflate order_count on a re-run), and IMMEDIATE
    // serialises two runs started at once (double click, two workers).
    db.exec("BEGIN IMMEDIATE");
    try {
      if (!stillPending.get(row.id)) {
        // Another run linked it between our SELECT and this lock.
        db.exec("COMMIT");
        report.ordersScanned -= 1;
        continue;
      }
      const before = findCustomer.get(phone) as ExistingCustomer | undefined;
      const orderAt = row.paid_at ?? row.created_at;

      // The buyer names the record — never the recipient, mirroring the live hook
      // (lib/on-web-order-paid.ts). Old web orders often have no buyer name at all;
      // a blank must not erase a name the shop already has, and a customer that
      // predates the run keeps the name the shop gave it.
      const orderName = row.contact_name?.trim() ?? "";
      const keepName = before && before.name.trim() && (preExisting.has(phone) || !orderName);
      const name = keepName ? before.name : orderName;

      const customer = upsertOnOrder({
        name,
        phone: row.contact_phone,
        email: row.contact_email || undefined,
        // Mirrors the live hook: last_address_json is "last delivery address" by
        // convention, updated only for delivery orders. Oldest-first processing
        // means the newest delivery order's address wins, via upsertOnOrder's COALESCE.
        address:
          row.fulfillment_method === "delivery" && row.address_json
            ? (JSON.parse(row.address_json) as Address)
            : undefined,
        orderAt,
        locale: row.locale === "es" ? "es" : "en",
      });

      // upsertOnOrder assumes the order it records is the newest one. Merging an
      // old web order into a customer seen more recently (a counter regular) would
      // move last_seen_at back in time and replace their current email / address /
      // language with stale ones — put those back.
      if (before && time(orderAt) < time(before.last_seen_at)) {
        restoreNewer.run(
          time(orderAt) < time(before.first_seen_at) ? orderAt : before.first_seen_at,
          before.last_seen_at,
          before.email,
          before.last_address_json,
          before.locale,
          customer.id,
        );
      }

      link.run(customer.id, row.id);
      db.exec("COMMIT");
      if (before) report.ordersMerged += 1;
      else report.customersCreated += 1;
    } catch (e) {
      try { db.exec("ROLLBACK"); } catch { /* already rolled back */ }
      // One malformed row must not strand the run, and must not be counted as success.
      report.failures.push({
        orderId: row.id,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return report;
}

/** Script-shaped entry point: dry run reports what WOULD happen and writes nothing. */
export function backfillCustomers(opts: { commit: boolean }): BackfillReport {
  if (opts.commit) return runBackfill();
  const p = previewBackfill();
  return {
    ordersScanned: p.pendingOrders,
    customersCreated: p.newCustomers,
    ordersMerged: p.ordersToMerge,
    failures: [],
  };
}
