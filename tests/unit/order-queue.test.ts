import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { acknowledgeOrder } from "@/lib/order-acknowledgments";
import { getPendingQueue } from "@/lib/order-queue";

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  runMigrations();
  // Freeze "now" to 2026-05-25 14:00 UTC for deterministic windowDate=today checks.
  vi.useFakeTimers().setSystemTime(new Date("2026-05-25T14:00:00Z"));
});
afterEach(() => { vi.useRealTimers(); closeDb(); vi.unstubAllEnvs(); });

function seed(o: {
  id: string; source: string; paymentStatus: string; fulfillmentStatus: string;
  fulfillmentMethod: string; windowDate: string | null; createdAt: string;
  checkoutSession?: string | null;
}) {
  getDb().prepare(
    `INSERT INTO orders (id, locale, source, recipient_name, recipient_phone, contact_phone,
       fulfillment_method, window_date, lines_json, subtotal_cents, delivery_cents, tax_cents,
       total_cents, fulfillment_status, payment_status, stripe_checkout_session_id,
       created_at, updated_at)
     VALUES (?, 'es', ?, 'R', '555', '555', ?, ?, '[]', 0, 0, 0, 0, ?, ?, ?, ?, ?)`,
  ).run(
    o.id, o.source, o.fulfillmentMethod, o.windowDate, o.fulfillmentStatus,
    o.paymentStatus, o.checkoutSession ?? null, o.createdAt, o.createdAt,
  );
}

describe("getPendingQueue", () => {
  it("flags unacknowledged web orders", async () => {
    seed({ id: "w1", source: "web", paymentStatus: "paid", fulfillmentStatus: "pending",
      fulfillmentMethod: "delivery", windowDate: "2026-06-01", createdAt: "2026-05-25T13:00:00Z" });
    const q = await getPendingQueue();
    expect(q.find(i => i.orderId === "w1")?.reason).toBe("web_unacknowledged");
  });

  it("skips acknowledged web orders", async () => {
    seed({ id: "w2", source: "web", paymentStatus: "paid", fulfillmentStatus: "pending",
      fulfillmentMethod: "delivery", windowDate: "2026-06-01", createdAt: "2026-05-25T13:00:00Z" });
    acknowledgeOrder("w2", "maky");
    const q = await getPendingQueue();
    expect(q.find(i => i.orderId === "w2")).toBeUndefined();
  });

  it("respects 72h cap on unacknowledged web orders", async () => {
    seed({ id: "w_old", source: "web", paymentStatus: "paid", fulfillmentStatus: "pending",
      fulfillmentMethod: "delivery", windowDate: "2026-06-01",
      createdAt: "2026-05-20T13:00:00Z" /* >72h before now */ });
    const q = await getPendingQueue();
    expect(q.find(i => i.orderId === "w_old")).toBeUndefined();
  });

  it("flags intake-unpaid > 1h with a checkout session", async () => {
    seed({ id: "i1", source: "walk-in", paymentStatus: "pending", fulfillmentStatus: "pending",
      fulfillmentMethod: "delivery", windowDate: "2026-06-01",
      createdAt: "2026-05-25T12:00:00Z" /* 2h ago */, checkoutSession: "cs_x" });
    const q = await getPendingQueue();
    expect(q.find(i => i.orderId === "i1")?.reason).toBe("intake_unpaid_stale");
  });

  it("does NOT flag intake-unpaid < 1h", async () => {
    seed({ id: "i2", source: "phone", paymentStatus: "pending", fulfillmentStatus: "pending",
      fulfillmentMethod: "delivery", windowDate: "2026-06-01",
      createdAt: "2026-05-25T13:45:00Z" /* 15min ago */, checkoutSession: "cs_y" });
    const q = await getPendingQueue();
    expect(q.find(i => i.orderId === "i2")).toBeUndefined();
  });

  it("flags delivery-today-undispatched", async () => {
    seed({ id: "d1", source: "walk-in", paymentStatus: "paid", fulfillmentStatus: "preparing",
      fulfillmentMethod: "delivery", windowDate: "2026-05-25", createdAt: "2026-05-25T08:00:00Z" });
    const q = await getPendingQueue();
    expect(q.find(i => i.orderId === "d1")?.reason).toBe("delivery_today_undispatched");
  });

  it("does NOT flag delivery-today already out-for-delivery", async () => {
    seed({ id: "d2", source: "walk-in", paymentStatus: "paid", fulfillmentStatus: "out-for-delivery",
      fulfillmentMethod: "delivery", windowDate: "2026-05-25", createdAt: "2026-05-25T08:00:00Z" });
    const q = await getPendingQueue();
    expect(q.find(i => i.orderId === "d2")).toBeUndefined();
  });

  it("flags delivery-today-unpaid with highest urgency (overrides undispatched)", async () => {
    seed({ id: "du", source: "walk-in", paymentStatus: "pending", fulfillmentStatus: "pending",
      fulfillmentMethod: "delivery", windowDate: "2026-05-25",
      createdAt: "2026-05-25T08:00:00Z", checkoutSession: "cs_z" });
    const q = await getPendingQueue();
    const item = q.find(i => i.orderId === "du");
    expect(item?.reason).toBe("delivery_today_unpaid");
  });

  it("flags pickup-today-unpaid", async () => {
    seed({ id: "p1", source: "walk-in", paymentStatus: "pending", fulfillmentStatus: "pending",
      fulfillmentMethod: "pickup", windowDate: "2026-05-25",
      createdAt: "2026-05-25T09:00:00Z", checkoutSession: "cs_p" });
    const q = await getPendingQueue();
    expect(q.find(i => i.orderId === "p1")?.reason).toBe("pickup_today_unpaid");
  });

  it("dedupes one order matching multiple rules by id", async () => {
    seed({ id: "dup", source: "walk-in", paymentStatus: "pending", fulfillmentStatus: "pending",
      fulfillmentMethod: "delivery", windowDate: "2026-05-25",
      createdAt: "2026-05-25T08:00:00Z", checkoutSession: "cs_dup" });
    const q = await getPendingQueue();
    expect(q.filter(i => i.orderId === "dup").length).toBe(1);
  });
});
