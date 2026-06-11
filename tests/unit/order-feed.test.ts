import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { getRecentFeed } from "@/lib/order-feed";

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  runMigrations();
  vi.useFakeTimers().setSystemTime(new Date("2026-05-25T14:00:00Z"));
});
afterEach(() => { vi.useRealTimers(); closeDb(); vi.unstubAllEnvs(); });

function seed(o: {
  id: string; createdAt: string; paidAt?: string | null; updatedAt?: string;
  status?: string; paymentStatus?: string; source?: string;
}) {
  getDb().prepare(
    `INSERT INTO orders (id, locale, source, recipient_name, recipient_phone, contact_phone,
       fulfillment_method, window_date, lines_json, subtotal_cents, delivery_cents,
       tax_cents, total_cents, fulfillment_status, payment_status, paid_at,
       created_at, updated_at)
     VALUES (?, 'es', ?, 'R', '555', '555', 'delivery', '2026-06-01', '[]', 0,0,0,15000,
       ?, ?, ?, ?, ?)`,
  ).run(
    o.id, o.source ?? "web", o.status ?? "pending", o.paymentStatus ?? "paid",
    o.paidAt ?? null, o.createdAt, o.updatedAt ?? o.createdAt,
  );
}

describe("getRecentFeed", () => {
  it("emits a 'created' event per order in the window, newest first", async () => {
    seed({ id: "a", createdAt: "2026-05-25T13:00:00Z" });
    seed({ id: "b", createdAt: "2026-05-25T13:30:00Z" });
    const r = await getRecentFeed(24);
    const created = r.events.filter(e => e.kind === "created");
    expect(created.map(e => e.orderId)).toEqual(["b", "a"]);
  });

  it("emits a 'paid' event when paid_at is within the window", async () => {
    seed({ id: "p1", createdAt: "2026-05-24T13:00:00Z",
      paidAt: "2026-05-25T13:00:00Z", paymentStatus: "paid" });
    const r = await getRecentFeed(24);
    expect(r.events.some(e => e.kind === "paid" && e.orderId === "p1")).toBe(true);
  });

  it("respects the sinceHours window", async () => {
    seed({ id: "old", createdAt: "2026-05-20T13:00:00Z" });
    seed({ id: "new", createdAt: "2026-05-25T13:00:00Z" });
    const r = await getRecentFeed(24);
    expect(r.events.some(e => e.orderId === "old")).toBe(false);
    expect(r.events.some(e => e.orderId === "new")).toBe(true);
  });

  it("hides unpaid web orders but keeps unpaid intake orders", async () => {
    seed({ id: "web_unpaid", source: "web", paymentStatus: "pending", createdAt: "2026-05-25T13:00:00Z" });
    seed({ id: "intake_unpaid", source: "phone", paymentStatus: "pending", createdAt: "2026-05-25T13:10:00Z" });
    const r = await getRecentFeed(24);
    expect(r.events.some(e => e.orderId === "web_unpaid")).toBe(false);
    expect(r.events.some(e => e.orderId === "intake_unpaid")).toBe(true);
  });

  it("sorts events by timestamp DESC across kinds", async () => {
    seed({ id: "a", createdAt: "2026-05-25T13:00:00Z",
      paidAt: "2026-05-25T13:30:00Z", paymentStatus: "paid" });
    const r = await getRecentFeed(24);
    const times = r.events.map(e => e.at);
    const sorted = [...times].sort((x, y) => y.localeCompare(x));
    expect(times).toEqual(sorted);
  });
});
