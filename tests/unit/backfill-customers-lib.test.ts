import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { previewBackfill, runBackfill } from "@/lib/backfill-customers";
import { listCustomers } from "@/lib/customer-storage";

const DAY = 86_400_000;

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  runMigrations();
});
afterEach(() => {
  closeDb();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

function iso(daysAgo: number) {
  return new Date(Date.now() - daysAgo * DAY).toISOString();
}

function seedOrder(
  id: string,
  phone: string,
  daysAgo: number,
  paidCents: number,
  opts: { contactName?: string | null; customerId?: string | null; status?: "paid" | "pending" } = {},
) {
  const at = iso(daysAgo);
  getDb()
    .prepare(
      `INSERT INTO orders (id, locale, source, customer_id, recipient_name, recipient_phone,
         contact_name, contact_email, contact_phone, fulfillment_method, lines_json,
         subtotal_cents, delivery_cents, tax_cents, total_cents, amount_paid_cents,
         fulfillment_status, payment_status, created_at, updated_at)
       VALUES (?, 'es', 'web', ?, 'Mamá Recipient', '5165559999', ?, NULL, ?, 'pickup', '[]',
         ?, 0, 0, ?, ?, 'delivered', ?, ?, ?)`,
    )
    .run(
      id, opts.customerId ?? null, opts.contactName === undefined ? "Buyer" : opts.contactName,
      phone, paidCents, paidCents, paidCents, opts.status ?? "paid", at, at,
    );
}

function seedCustomer(id: string, name: string, phone: string, lastDaysAgo: number, email: string | null = null) {
  getDb()
    .prepare(
      `INSERT INTO customers (id, name, phone, email, order_count, first_seen_at, last_seen_at, locale)
       VALUES (?, ?, ?, ?, 1, ?, ?, 'en')`,
    )
    .run(id, name, phone, email, iso(lastDaysAgo), iso(lastDaysAgo));
}

function customer(phone: string) {
  return getDb().prepare("SELECT * FROM customers WHERE phone = ?").get(phone) as {
    id: string; name: string; email: string | null; order_count: number;
    first_seen_at: string; last_seen_at: string; locale: string | null;
  };
}

describe("previewBackfill", () => {
  it("counts pending paid orders, new customers and merges without writing", () => {
    seedCustomer("cus_bob", "Bob", "5165550100", 5);
    seedOrder("o1", "(516) 555-0100", 30, 5000); // merges into Bob
    seedOrder("o2", "5165550200", 40, 6000);     // new customer
    seedOrder("o3", "516-555-0200", 20, 7000);   // same new customer
    seedOrder("o4", "5165550300", 10, 0, { status: "pending" }); // unpaid: ignored
    seedOrder("o5", "5165550400", 10, 5000, { customerId: "cus_bob" }); // already linked

    expect(previewBackfill()).toEqual({ pendingOrders: 3, newCustomers: 1, ordersToMerge: 2 });
    expect(getDb().prepare("SELECT COUNT(*) n FROM customers").get()).toEqual({ n: 1 });
    expect(getDb().prepare("SELECT COUNT(*) n FROM orders WHERE customer_id IS NULL").get())
      .toEqual({ n: 4 });
  });

  it("ignores orders whose phone has no digits", () => {
    seedOrder("o1", "n/a", 10, 5000);
    expect(previewBackfill().pendingOrders).toBe(0);
    expect(runBackfill().ordersScanned).toBe(0);
    expect(getDb().prepare("SELECT COUNT(*) n FROM customers").get()).toEqual({ n: 0 });
  });
});

describe("runBackfill", () => {
  it("links every pending order, so lifetime value stops reading $0", () => {
    seedCustomer("cus_bob", "Bob", "5165550100", 5);
    seedOrder("o1", "5165550100", 30, 5000);
    seedOrder("o2", "5165550200", 40, 6000);
    seedOrder("o3", "5165550200", 20, 7000);

    const report = runBackfill();

    expect(report).toEqual({ ordersScanned: 3, customersCreated: 1, ordersMerged: 2, failures: [] });
    const unlinked = getDb()
      .prepare("SELECT COUNT(*) n FROM orders WHERE customer_id IS NULL AND payment_status = 'paid'")
      .get();
    expect(unlinked).toEqual({ n: 0 });
    expect(customer("5165550100").order_count).toBe(2);
    expect(customer("5165550200").order_count).toBe(2);
    const ltv = Object.fromEntries(
      listCustomers({}).customers.map((c) => [c.phone, c.metrics.ltvCents]),
    );
    expect(ltv["5165550200"]).toBe(13000);
    expect(ltv["5165550100"]).toBe(5000);
  });

  it("is idempotent: a second run finds nothing and changes no counts", () => {
    seedOrder("o1", "5165550100", 30, 5000);
    runBackfill();
    const before = customer("5165550100");

    const second = runBackfill();

    expect(second).toEqual({ ordersScanned: 0, customersCreated: 0, ordersMerged: 0, failures: [] });
    expect(previewBackfill().pendingOrders).toBe(0);
    expect(customer("5165550100")).toEqual(before);
  });

  it("never names a customer after the recipient", () => {
    seedOrder("o1", "5165550100", 30, 5000, { contactName: null });
    runBackfill();
    expect(customer("5165550100").name).toBe("");
  });

  it("keeps the shop's name and newer details when merging an older web order", () => {
    seedCustomer("cus_bob", "Bob del mostrador", "5165550100", 5, "bob@new.com");
    seedOrder("o1", "5165550100", 200, 5000, { contactName: "B. M." });
    getDb().prepare("UPDATE orders SET contact_email = 'old@x.com' WHERE id = 'o1'").run();

    runBackfill();

    const c = customer("5165550100");
    expect(c.name).toBe("Bob del mostrador");
    expect(c.email).toBe("bob@new.com");
    expect(c.locale).toBe("en");
    expect(c.order_count).toBe(2);
    // last_seen stays at the recent counter visit; first_seen moves back to the web order.
    expect(Date.parse(c.last_seen_at)).toBeGreaterThan(Date.now() - 6 * DAY);
    expect(Date.parse(c.first_seen_at)).toBeLessThan(Date.now() - 199 * DAY);
  });

  it("records a bad row as a failure without linking it or bumping a count", () => {
    seedOrder("o1", "5165550100", 30, 5000);
    getDb()
      .prepare("UPDATE orders SET fulfillment_method = 'delivery', address_json = '{not json' WHERE id = 'o1'")
      .run();
    seedOrder("o2", "5165550200", 20, 5000);

    const report = runBackfill();

    expect(report.failures.map((f) => f.orderId)).toEqual(["o1"]);
    expect(report.customersCreated).toBe(1);
    expect(getDb().prepare("SELECT customer_id FROM orders WHERE id = 'o1'").get())
      .toEqual({ customer_id: null });
  });

  it("rolls the customer write back when linking the order fails", () => {
    seedCustomer("cus_bob", "Bob", "5165550100", 5);
    seedOrder("o1", "5165550100", 30, 5000);
    getDb().exec(
      `CREATE TRIGGER fail_link BEFORE UPDATE OF customer_id ON orders
       WHEN NEW.id = 'o1' BEGIN SELECT RAISE(ABORT, 'link failed'); END`,
    );

    const report = runBackfill();

    expect(report.failures).toEqual([{ orderId: "o1", error: expect.stringContaining("link failed") }]);
    expect(report.ordersMerged).toBe(0);
    // upsertOnOrder had already bumped the count — the rollback must undo it.
    expect(customer("5165550100").order_count).toBe(1);
  });

  it("sends nothing", async () => {
    seedOrder("o1", "5165550100", 30, 5000);
    const messaging = await import("@/lib/messaging");
    const spy = vi.spyOn(messaging, "sendMessage");

    runBackfill();

    expect(spy).not.toHaveBeenCalled();
    expect(getDb().prepare("SELECT COUNT(*) n FROM messages").get()).toEqual({ n: 0 });
  });
});
