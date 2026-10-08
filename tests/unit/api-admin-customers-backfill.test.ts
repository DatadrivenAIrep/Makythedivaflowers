import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { GET, POST } from "@/app/api/admin/customers/backfill/route";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("ORDER_STORAGE_FILE", "/tmp/diva-test-backfill-" + process.pid + ".json");
  runMigrations();
});
afterEach(() => {
  closeDb();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

function seedOrder(id: string, phone: string, paidCents: number) {
  const at = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT INTO orders (id, locale, source, customer_id, recipient_name, recipient_phone,
         contact_name, contact_phone, fulfillment_method, lines_json,
         subtotal_cents, delivery_cents, tax_cents, total_cents, amount_paid_cents,
         fulfillment_status, payment_status, created_at, updated_at)
       VALUES (?, 'en', 'web', NULL, 'R', '1', 'Buyer', ?, 'pickup', '[]',
         ?, 0, 0, ?, ?, 'delivered', 'paid', ?, ?)`,
    )
    .run(id, phone, paidCents, paidCents, paidCents, at, at);
}

describe("GET /api/admin/customers/backfill", () => {
  it("returns zero counts when everything is linked", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ pendingOrders: 0, newCustomers: 0, ordersToMerge: 0 });
  });

  it("previews the pending orders without linking them", async () => {
    seedOrder("o1", "5165550100", 5000);
    seedOrder("o2", "5165550100", 6000);
    const body = await (await GET()).json();
    expect(body).toEqual({ pendingOrders: 2, newCustomers: 1, ordersToMerge: 1 });
    expect(getDb().prepare("SELECT COUNT(*) n FROM customers").get()).toEqual({ n: 0 });
  });
});

describe("POST /api/admin/customers/backfill", () => {
  it("links the orders and reports what it did", async () => {
    seedOrder("o1", "5165550100", 5000);
    seedOrder("o2", "5165550200", 6000);
    vi.spyOn(console, "log").mockImplementation(() => {});

    const res = await POST();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ordersScanned: 2, customersCreated: 2, ordersMerged: 0, failures: [], remaining: 0,
    });
    expect(getDb().prepare("SELECT COUNT(*) n FROM orders WHERE customer_id IS NULL").get())
      .toEqual({ n: 0 });
  });

  it("is idempotent: a second POST finds nothing pending", async () => {
    seedOrder("o1", "5165550100", 5000);
    vi.spyOn(console, "log").mockImplementation(() => {});
    await POST();

    const body = await (await POST()).json();

    expect(body).toEqual({ ordersScanned: 0, customersCreated: 0, ordersMerged: 0, failures: [], remaining: 0 });
    expect(await (await GET()).json()).toEqual({ pendingOrders: 0, newCustomers: 0, ordersToMerge: 0 });
    const row = getDb().prepare("SELECT order_count FROM customers").get();
    expect(row).toEqual({ order_count: 1 });
  });

  it("sends nothing", async () => {
    seedOrder("o1", "5165550100", 5000);
    vi.spyOn(console, "log").mockImplementation(() => {});
    const messaging = await import("@/lib/messaging");
    const spy = vi.spyOn(messaging, "sendMessage");

    await POST();

    expect(spy).not.toHaveBeenCalled();
    expect(getDb().prepare("SELECT COUNT(*) n FROM messages").get()).toEqual({ n: 0 });
  });
});
