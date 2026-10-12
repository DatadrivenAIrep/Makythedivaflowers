import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { getMetrics } from "@/lib/metrics-storage";

// 2026-10-12 15:00 New York.
const NOW = new Date("2026-10-12T19:00:00Z");
const LABELS = { customProducts: "Personalizados", unknownZone: "Sin zona" };

beforeEach(() => { vi.stubEnv("SQLITE_FILE", ":memory:"); runMigrations(); });
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

let n = 0;
function seed(p: {
  at: string; paid?: number; total?: number; source?: string; payment?: string; status?: string;
  customerId?: string | null; phone?: string; name?: string; zip?: string; lines?: unknown[];
  windowDate?: string; slot?: string; funeral?: boolean; discount?: number; promo?: string; giftCard?: number;
}) {
  n += 1;
  const address = p.zip ? JSON.stringify({ street1: "1 A", city: "X", state: "NY", zip: p.zip, country: "US" }) : null;
  getDb().prepare(
    `INSERT INTO orders (id, customer_id, locale, source, recipient_name, recipient_phone, contact_name, contact_phone,
       fulfillment_method, address_json, window_date, window_slot, lines_json, subtotal_cents, delivery_cents, tax_cents,
       total_cents, amount_paid_cents, fulfillment_status, payment_status, funeral, discount_cents, promo_code,
       gift_card_cents, created_at, updated_at)
     VALUES (?, ?, 'es', ?, 'R', '1', ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    `o${n}`, p.customerId ?? null, p.source ?? "phone", p.name ?? "Ana", p.phone ?? "5165550100",
    p.zip ? "delivery" : p.windowDate ? "pickup" : "in-store", address, p.windowDate ?? null,
    p.slot ?? (p.windowDate ? "midday" : null), JSON.stringify(p.lines ?? []),
    p.total ?? p.paid ?? 10000, p.paid ?? 10000, p.status ?? "delivered", p.payment ?? "paid",
    p.funeral ? 1 : 0, p.discount ?? 0, p.promo ?? null, p.giftCard ?? null, p.at, p.at,
  );
}

describe("getMetrics", () => {
  it("compares the period with the one before, in shop time", () => {
    seed({ at: "2026-10-13T01:30:00Z", paid: 6000 }); // 9:30 pm Oct 12 NY: inside 30d
    seed({ at: "2026-10-01T15:00:00Z", paid: 4000, source: "web" });
    seed({ at: "2026-09-01T15:00:00Z", paid: 5000 }); // previous 30 days
    const m = getMetrics("30d", NOW, "es", LABELS);
    expect(m.today).toBe("2026-10-12");
    expect(m.kpis.revenue).toEqual({ value: 10000, delta: { kind: "pct", pct: 100 } });
    expect(m.kpis.orders).toEqual({ value: 2, delta: { kind: "pct", pct: 100 } });
    expect(m.trend.find((p) => p.key === "2026-10-12")?.revenueCents).toBe(6000);
    expect(m.sales.channels.find((c) => c.channel === "web")?.sharePct).toBe(40);
  });

  it("puts last year's same dates on the trend", () => {
    seed({ at: "2025-10-10T15:00:00Z", paid: 4000 });
    const m = getMetrics("30d", NOW, "es", LABELS);
    expect(m.trend.find((p) => p.key === "2026-10-10")?.prevRevenueCents).toBe(4000);
  });

  it("values custom lines for product revenue and counts pending balances", () => {
    seed({ at: "2026-10-05T15:00:00Z", lines: [{ kind: "custom", title: "Especial", priceCents: 4000, qty: 2 }] });
    seed({ at: "2026-10-06T15:00:00Z", total: 9000, paid: 2000, payment: "pending" });
    const m = getMetrics("30d", NOW, "es", LABELS);
    expect(m.sales.products[0]).toMatchObject({ key: "__custom__", name: "Personalizados", qty: 2, cents: 8000 });
    expect(m.kpis.pendingCount).toBe(1);
    expect(m.kpis.pendingCents).toBe(7000);
  });

  it("builds the operations tab from scheduled days", () => {
    seed({ at: "2026-10-01T15:00:00Z", windowDate: "2026-10-10", slot: "midday" });
    seed({ at: "2026-10-11T15:00:00Z", windowDate: "2026-10-17", slot: "evening" });
    const m = getMetrics("30d", NOW, "es", LABELS);
    expect(m.operations.heatmap.counts[5]).toEqual([0, 1, 0, 0]);
    expect(m.operations.upcoming[5]).toEqual({ date: "2026-10-17", count: 1 });
  });

  it("matches unlinked orders to their customer by phone for new vs returning", () => {
    getDb().prepare(
      `INSERT INTO customers (id, name, phone, order_count, first_seen_at, last_seen_at)
       VALUES ('cus_a', 'Ana', '5165550100', 2, '2026-03-01T15:00:00Z', '2026-10-05T15:00:00Z')`,
    ).run();
    seed({ at: "2026-03-01T15:00:00Z", customerId: "cus_a" });
    seed({ at: "2026-10-05T15:00:00Z", customerId: null }); // unlinked, same phone → returning
    seed({ at: "2026-10-06T15:00:00Z", phone: "5165550199", name: "Beto" }); // new
    const m = getMetrics("30d", NOW, "es", LABELS);
    expect(m.customers.split).toMatchObject({ newBuyers: 1, returningBuyers: 1 });
    expect(m.kpis.newCustomers.value).toBe(1);
    expect(m.customers.top.map((c) => c.name).sort()).toEqual(["Ana", "Beto"]);
  });

  it("always returns at least one insight", () => {
    expect(getMetrics("7d", NOW, "es", LABELS).insights.length).toBeGreaterThan(0);
  });
});
