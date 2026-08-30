import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { listCustomers } from "@/lib/customer-storage";
import { getCustomerProfile } from "@/lib/customer-profile";

const DAY = 86_400_000;
const NOW = new Date("2026-08-30T12:00:00.000Z");

beforeEach(() => { vi.stubEnv("SQLITE_FILE", ":memory:"); runMigrations(); });
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

/** A customer row whose order_count was maintained by upsertOnOrder. */
function seedCustomer(id: string, name: string, phone: string, orderCount: number, lastDaysAgo: number) {
  const seen = new Date(NOW.getTime() - lastDaysAgo * DAY).toISOString();
  getDb().prepare(
    `INSERT INTO customers (id, name, phone, order_count, first_seen_at, last_seen_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(id, name, phone, orderCount, seen, seen);
}

/** `customerId: null` reproduces the historical orders that were never stamped
 *  with a customer_id (the drift scripts/backfill-customers-from-orders.ts exists for). */
function seedOrder(id: string, customerId: string | null, daysAgo: number, paidCents: number) {
  const at = new Date(NOW.getTime() - daysAgo * DAY).toISOString();
  getDb().prepare(
    `INSERT INTO orders (id, locale, source, customer_id, recipient_name, recipient_phone,
       contact_phone, fulfillment_method, lines_json, subtotal_cents, delivery_cents,
       tax_cents, total_cents, amount_paid_cents, fulfillment_status, payment_status,
       created_at, updated_at)
     VALUES (?, 'es', 'walk-in', ?, 'R', '1', '1', 'pickup', '[]', 0, 0, 0, ?, ?,
       'pending', 'paid', ?, ?)`,
  ).run(id, customerId, paidCents, paidCents, at, at);
}

const ids = (r: { customers: Array<{ id: string }> }) => r.customers.map((c) => c.id).sort();

describe("segment filters for customers whose orders were never linked", () => {
  it("finds a repeat buyer gone quiet under 'at risk' even with unlinked orders", () => {
    seedCustomer("dora", "Dora", "5550001", 3, 116);
    [116, 200, 260].forEach((d, i) => seedOrder(`d${i}`, null, d, 9000));

    expect(ids(listCustomers({ segment: "at_risk" }, NOW))).toEqual(["dora"]);
  });

  it("finds a one-time buyer under 'lapsed' even with an unlinked order", () => {
    seedCustomer("bea", "Bea", "5550002", 1, 150);
    seedOrder("b0", null, 150, 6000);

    expect(ids(listCustomers({ segment: "lapsed" }, NOW))).toEqual(["bea"]);
  });

  it("badges an unlinked repeat buyer at_risk instead of new, and shows their order count", () => {
    seedCustomer("dora", "Dora", "5550001", 3, 116);
    [116, 200, 260].forEach((d, i) => seedOrder(`d${i}`, null, d, 9000));

    const row = listCustomers({}, NOW).customers.find((c) => c.id === "dora")!;
    expect(row.metrics.orderCount).toBe(3);
    expect(row.metrics.segment).toBe("at_risk");
  });

  it("counts unlinked customers in the at-risk and lapsed header stats", () => {
    seedCustomer("dora", "Dora", "5550001", 3, 116);
    [116, 200, 260].forEach((d, i) => seedOrder(`d${i}`, null, d, 9000));
    seedCustomer("bea", "Bea", "5550002", 1, 150);
    seedOrder("b0", null, 150, 6000);

    const stats = listCustomers({}, NOW).stats;
    expect(stats.atRiskCount).toBe(1);
    expect(stats.lapsedCount).toBe(1);
    expect(stats.repeatRatePct).toBe(50);
  });

  it("keeps the linked aggregate authoritative when orders are linked", () => {
    // order_count drifted high; the four linked orders are the truth.
    seedCustomer("eva", "Eva", "5550003", 99, 3);
    [3, 20, 40, 60].forEach((d, i) => seedOrder(`e${i}`, "eva", d, 9000));

    const row = listCustomers({}, NOW).customers.find((c) => c.id === "eva")!;
    expect(row.metrics.orderCount).toBe(4);
    expect(row.metrics.ltvCents).toBe(36000);
    expect(row.metrics.segment).toBe("recurring");
  });

  it("shows the same segment on the customer's own profile page", () => {
    seedCustomer("dora", "Dora", "5550001", 3, 116);
    [116, 200, 260].forEach((d, i) => seedOrder(`d${i}`, null, d, 9000));

    expect(getCustomerProfile("dora", NOW)!.metrics.segment).toBe("at_risk");
  });
});
