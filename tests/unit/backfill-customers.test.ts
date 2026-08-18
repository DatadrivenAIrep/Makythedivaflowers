import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { backfillCustomers } from "@/scripts/backfill-customers-from-orders";

const DAY = 86_400_000;

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  runMigrations();
});
afterEach(() => {
  closeDb();
  vi.unstubAllEnvs();
});

function seedOrder(
  id: string,
  phone: string,
  daysAgo: number,
  paidCents: number,
  paymentStatus: "paid" | "pending" = "paid",
  customerId: string | null = null,
) {
  const at = new Date(Date.now() - daysAgo * DAY).toISOString();
  getDb()
    .prepare(
      `INSERT INTO orders (id, locale, source, customer_id, recipient_name, recipient_phone,
         contact_name, contact_email, contact_phone, fulfillment_method, lines_json,
         subtotal_cents, delivery_cents, tax_cents, total_cents, amount_paid_cents,
         fulfillment_status, payment_status, created_at, updated_at)
       VALUES (?, 'en', 'web', ?, 'R', ?, 'Buyer Name', 'b@x.com', ?, 'pickup', '[]',
         ?, 0, 0, ?, ?, 'pending', ?, ?, ?)`,
    )
    .run(id, customerId, phone, phone, paidCents, paidCents, paidCents, paymentStatus, at, at);
}

function seedDeliveryOrder(id: string, phone: string, daysAgo: number, addressJson: string) {
  const at = new Date(Date.now() - daysAgo * DAY).toISOString();
  getDb()
    .prepare(
      `INSERT INTO orders (id, locale, source, customer_id, recipient_name, recipient_phone,
         contact_name, contact_email, contact_phone, fulfillment_method, address_json, lines_json,
         subtotal_cents, delivery_cents, tax_cents, total_cents, amount_paid_cents,
         fulfillment_status, payment_status, created_at, updated_at)
       VALUES (?, 'en', 'web', NULL, 'R', ?, 'Buyer Name', 'b@x.com', ?, 'delivery', ?, '[]',
         5000, 0, 0, 5000, 5000, 'pending', 'paid', ?, ?)`,
    )
    .run(id, phone, phone, addressJson, at, at);
}

describe("backfillCustomers", () => {
  it("groups orders sharing a phone into one customer with the right first/last seen", () => {
    seedOrder("o1", "5165550100", 200, 5000);
    seedOrder("o2", "5165550100", 10, 7000);

    const report = backfillCustomers({ commit: true });

    expect(report.ordersScanned).toBe(2);
    expect(report.customersCreated).toBe(1);
    const rows = getDb().prepare("SELECT * FROM customers").all() as Array<{
      phone: string; order_count: number; first_seen_at: string; last_seen_at: string;
    }>;
    expect(rows.length).toBe(1);
    expect(rows[0].order_count).toBe(2);
    expect(new Date(rows[0].first_seen_at).getTime())
      .toBeLessThan(new Date(rows[0].last_seen_at).getTime());
  });

  it("merges into an existing customer instead of duplicating", () => {
    getDb()
      .prepare(
        `INSERT INTO customers (id, name, phone, order_count, first_seen_at, last_seen_at)
         VALUES ('cus_old', 'Counter Bob', '5165550100', 3, ?, ?)`,
      )
      .run(new Date(Date.now() - 300 * DAY).toISOString(), new Date().toISOString());
    seedOrder("o1", "(516) 555-0100", 10, 5000);

    const report = backfillCustomers({ commit: true });

    expect(report.customersCreated).toBe(0);
    expect(report.ordersMerged).toBe(1);
    const rows = getDb().prepare("SELECT * FROM customers").all();
    expect(rows.length).toBe(1);
    const order = getDb().prepare("SELECT customer_id FROM orders WHERE id = 'o1'").get() as
      { customer_id: string };
    expect(order.customer_id).toBe("cus_old");
  });

  it("skips unpaid orders and orders that already have a customer", () => {
    seedOrder("o1", "5165550100", 10, 0, "pending");
    seedOrder("o2", "5165550200", 10, 5000, "paid", "cus_already");

    const report = backfillCustomers({ commit: true });

    expect(report.ordersScanned).toBe(0);
    expect(getDb().prepare("SELECT COUNT(*) n FROM customers").get()).toEqual({ n: 0 });
  });

  it("is a no-op on a second run", () => {
    seedOrder("o1", "5165550100", 10, 5000);
    backfillCustomers({ commit: true });
    const second = backfillCustomers({ commit: true });
    expect(second.ordersScanned).toBe(0);
    expect(second.customersCreated).toBe(0);
  });

  it("writes nothing in dry-run mode but still reports what it would do", () => {
    seedOrder("o1", "5165550100", 10, 5000);

    const report = backfillCustomers({ commit: false });

    expect(report.ordersScanned).toBe(1);
    expect(report.customersCreated).toBe(1);
    expect(getDb().prepare("SELECT COUNT(*) n FROM customers").get()).toEqual({ n: 0 });
    const order = getDb().prepare("SELECT customer_id FROM orders WHERE id = 'o1'").get() as
      { customer_id: string | null };
    expect(order.customer_id).toBeNull();
  });

  it("backfills the delivery address onto the customer, matching the live hook", () => {
    const address = { street1: "1 Main St", city: "Baldwin", state: "NY", zip: "11510", country: "US" };
    seedDeliveryOrder("o1", "5165550100", 10, JSON.stringify(address));

    backfillCustomers({ commit: true });

    const row = getDb().prepare("SELECT last_address_json FROM customers").get() as
      { last_address_json: string | null };
    expect(row.last_address_json).not.toBeNull();
    expect(JSON.parse(row.last_address_json as string)).toEqual(address);
  });

  it("never sends a message", async () => {
    seedOrder("o1", "5165550100", 10, 5000);
    const messaging = await import("@/lib/messaging");
    const spy = vi.spyOn(messaging, "sendMessage");

    backfillCustomers({ commit: true });

    expect(spy).not.toHaveBeenCalled();
    expect(getDb().prepare("SELECT COUNT(*) n FROM messages").get()).toEqual({ n: 0 });
    spy.mockRestore();
  });
});
