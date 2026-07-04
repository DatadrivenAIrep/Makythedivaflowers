import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { rangeLowerBound, fetchOrderRows, getMetrics } from "@/lib/metrics-storage";

const NOW = new Date("2026-07-04T12:00:00Z");
const DAY = 86_400_000;

beforeEach(() => { vi.stubEnv("SQLITE_FILE", ":memory:"); runMigrations(); });
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

const LABELS = { customProducts: "Personalizados", unknownZone: "Sin zona" };

function seedOrder(p: {
  id: string; daysAgo: number; total: number; paid: number;
  payment?: string; fulfillment?: string; zip?: string | null; lines?: unknown[];
  customerId?: string;
}) {
  const at = new Date(NOW.getTime() - p.daysAgo * DAY).toISOString();
  const address = p.zip ? JSON.stringify({ street1: "1", city: "X", state: "NY", zip: p.zip, country: "US" }) : null;
  getDb().prepare(
    `INSERT INTO orders (id, customer_id, locale, source, recipient_name, recipient_phone, contact_phone,
       fulfillment_method, address_json, lines_json, subtotal_cents, delivery_cents, tax_cents,
       total_cents, amount_paid_cents, fulfillment_status, payment_status, created_at, updated_at)
     VALUES (?, ?, 'es', 'web', 'R', '1', '1', ?, ?, ?, 0, 0, 0, ?, ?, ?, ?, ?, ?)`,
  ).run(
    p.id, p.customerId ?? null, p.zip ? "delivery" : "pickup", address, JSON.stringify(p.lines ?? []),
    p.total, p.paid, p.fulfillment ?? "delivered", p.payment ?? "paid", at, at,
  );
}

// Seeds a customer plus `orderCount` linked orders so customerStats() (which
// derives repeat rate from COUNT(*) of orders joined on customer_id, not the
// order_count column) sees the intended order history.
function seedCustomer(id: string, orderCount: number) {
  getDb().prepare(
    `INSERT INTO customers (id, name, phone, order_count, first_seen_at, last_seen_at)
     VALUES (?, ?, ?, ?, '2026-01-01T00:00:00Z', '2026-06-01T00:00:00Z')`,
  ).run(id, `C${id}`, `phone-${id}`, orderCount);
  for (let i = 0; i < orderCount; i++) {
    seedOrder({ id: `cust-${id}-${i}`, daysAgo: 200, total: 1000, paid: 1000, customerId: id });
  }
}

describe("rangeLowerBound", () => {
  it("computes each preset bound; all → null", () => {
    expect(rangeLowerBound("30d", NOW)).toBe(new Date(NOW.getTime() - 30 * DAY).toISOString());
    expect(rangeLowerBound("90d", NOW)).toBe(new Date(NOW.getTime() - 90 * DAY).toISOString());
    expect(rangeLowerBound("ytd", NOW)).toBe("2026-01-01T00:00:00.000Z");
    expect(rangeLowerBound("all", NOW)).toBeNull();
  });
});

describe("fetchOrderRows", () => {
  it("respects the range window and parses the zip from address_json", () => {
    seedOrder({ id: "recent", daysAgo: 5, total: 5000, paid: 5000, zip: "11507" });
    seedOrder({ id: "old", daysAgo: 200, total: 8000, paid: 8000, zip: "11576" });
    const within90 = fetchOrderRows("90d", NOW);
    expect(within90).toHaveLength(1);
    expect(within90[0].addressZip).toBe("11507");
    expect(fetchOrderRows("all", NOW)).toHaveLength(2);
  });
});

describe("getMetrics", () => {
  it("assembles KPIs, 12-month trend, top products, and by-zone", () => {
    seedOrder({ id: "o1", daysAgo: 3, total: 6000, paid: 6000, zip: "11507",
      lines: [{ kind: "catalog", productId: "p-arr-m01", variantId: "standard", addOnIds: [], qty: 2 }] });
    seedOrder({ id: "o2", daysAgo: 10, total: 10000, paid: 4000, payment: "pending", zip: "11576",
      lines: [{ kind: "custom", title: "Especial", priceCents: 4000, qty: 1 }] });
    seedCustomer("a", 3); // recurring
    seedCustomer("b", 1); // not

    const m = getMetrics("90d", NOW, "es", LABELS);
    expect(m.kpis.revenueCents).toBe(10000); // 6000 + 4000 collected
    expect(m.kpis.outstandingCents).toBe(6000); // o2 remainder (10000 - 4000)
    expect(m.kpis.orderCount).toBe(2);
    expect(m.kpis.paidOrderCount).toBe(2); // both o1 and o2 have amount_paid > 0
    expect(m.kpis.aovCents).toBe(5000); // 10000 / 2
    expect(m.kpis.repeatRatePct).toBe(50); // a out of {a,b}
    expect(m.monthly).toHaveLength(12);
    expect(m.topProducts.length).toBeGreaterThanOrEqual(1);
    expect(m.byZone.map((z) => z.zoneId).sort()).toEqual(["albertson", "roslyn"]);
  });

  it("uses the requested locale for product/zone names", () => {
    seedOrder({ id: "o1", daysAgo: 1, total: 6000, paid: 6000, zip: "11507",
      lines: [{ kind: "catalog", productId: "p-arr-m01", variantId: "standard", addOnIds: [], qty: 1 }] });
    const es = getMetrics("30d", NOW, "es", LABELS);
    expect(es.byZone[0].label).toBe("Albertson");
    expect(es.topProducts[0].name).not.toBe("p-arr-m01"); // resolved to localized title
  });
});
