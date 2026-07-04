import { describe, it, expect } from "vitest";
import {
  revenueCollectedCents, outstandingCents, paidOrderCount, aovCents,
  monthlyRevenue, topProducts, byZone,
  type OrderMetricRow,
} from "@/lib/metrics";

const NOW = new Date("2026-07-04T12:00:00Z");

function row(p: Partial<OrderMetricRow>): OrderMetricRow {
  return {
    totalCents: 10000, amountPaidCents: 10000, paymentStatus: "paid",
    fulfillmentStatus: "delivered", createdAt: "2026-07-01T00:00:00Z",
    linesJson: "[]", addressZip: null, ...p,
  };
}

describe("money aggregates", () => {
  it("revenue = sum of collected; AOV over paid orders only", () => {
    const rows = [
      row({ amountPaidCents: 6000 }),
      row({ amountPaidCents: 9000 }),
      row({ amountPaidCents: 0, paymentStatus: "pending", totalCents: 5000 }),
    ];
    expect(revenueCollectedCents(rows)).toBe(15000);
    expect(paidOrderCount(rows)).toBe(2);
    expect(aovCents(rows)).toBe(7500);
  });

  it("AOV is 0 with no paid orders", () => {
    expect(aovCents([row({ amountPaidCents: 0, paymentStatus: "pending" })])).toBe(0);
    expect(aovCents([])).toBe(0);
  });

  it("outstanding = unpaid remainder, excluding canceled and refunded", () => {
    const rows = [
      row({ totalCents: 10000, amountPaidCents: 4000, paymentStatus: "pending" }), // 6000 due
      row({ totalCents: 8000, amountPaidCents: 0, paymentStatus: "pending", fulfillmentStatus: "canceled" }), // excluded
      row({ totalCents: 5000, amountPaidCents: 5000, paymentStatus: "refunded" }), // excluded
      row({ totalCents: 3000, amountPaidCents: 3000, paymentStatus: "paid" }), // 0 due
    ];
    expect(outstandingCents(rows)).toBe(6000);
  });
});

describe("monthlyRevenue", () => {
  it("returns 12 zero-filled UTC month buckets oldest→newest, summing collected", () => {
    const rows = [
      row({ createdAt: "2026-07-02T00:00:00Z", amountPaidCents: 5000 }),
      row({ createdAt: "2026-07-30T00:00:00Z", amountPaidCents: 3000 }),
      row({ createdAt: "2025-08-15T00:00:00Z", amountPaidCents: 1000 }), // oldest bucket
      row({ createdAt: "2024-01-01T00:00:00Z", amountPaidCents: 9999 }), // out of window → ignored
    ];
    const m = monthlyRevenue(rows, NOW);
    expect(m).toHaveLength(12);
    expect(m[0].month).toBe("2025-08");
    expect(m[11].month).toBe("2026-07");
    expect(m[0].cents).toBe(1000);
    expect(m[11].cents).toBe(8000);
    expect(m[5].cents).toBe(0); // some empty month
  });
});

describe("topProducts", () => {
  const resolve = (id: string) => (id === "p1" ? "Ramo Rosa" : id === "p2" ? "Caja Lujo" : id);

  it("ranks catalog by qty (cents null), collapses custom into one bucket with summed cents", () => {
    const rows = [
      row({ linesJson: JSON.stringify([
        { kind: "catalog", productId: "p1", variantId: "s", addOnIds: [], qty: 2 },
        { kind: "custom", title: "Especial", priceCents: 4000, qty: 1 },
      ]) }),
      row({ linesJson: JSON.stringify([
        { kind: "catalog", productId: "p1", variantId: "s", addOnIds: [], qty: 1 },
        { kind: "catalog", productId: "p2", variantId: "s", addOnIds: [], qty: 5 },
        { kind: "custom", title: "Otra", priceCents: 2000, qty: 2 },
      ]) }),
      row({ amountPaidCents: 0, paymentStatus: "pending", linesJson: JSON.stringify([
        { kind: "catalog", productId: "p2", variantId: "s", addOnIds: [], qty: 99 },
      ]) }), // unpaid → ignored
    ];
    const top = topProducts(rows, resolve, "Personalizados");
    expect(top).toEqual([
      { key: "p2", name: "Caja Lujo", qty: 5, cents: null },
      { key: "p1", name: "Ramo Rosa", qty: 3, cents: null },
      { key: "__custom__", name: "Personalizados", qty: 3, cents: 8000 },
    ]);
  });

  it("tolerates empty/malformed lines and caps at the limit", () => {
    const rows = [
      row({ linesJson: "[]" }),
      row({ linesJson: "not json" }),
      row({ linesJson: JSON.stringify([{ kind: "catalog", productId: "p1", variantId: "s", addOnIds: [], qty: 1 }]) }),
    ];
    expect(topProducts(rows, resolve, "Personalizados", 1)).toEqual([
      { key: "p1", name: "Ramo Rosa", qty: 1, cents: null },
    ]);
  });
});

describe("byZone", () => {
  const resolve = (zip: string) =>
    zip === "11507" ? { id: "albertson", label: "Albertson" }
    : zip === "11576" ? { id: "roslyn", label: "Roslyn" }
    : null;

  it("groups delivery rows by zone, sums collected, unknown zip → unknown bucket, sorted by cents", () => {
    const rows = [
      row({ addressZip: "11507", amountPaidCents: 5000 }),
      row({ addressZip: "11507", amountPaidCents: 3000 }),
      row({ addressZip: "11576", amountPaidCents: 10000 }),
      row({ addressZip: "99999", amountPaidCents: 2000 }), // unknown
      row({ addressZip: null, amountPaidCents: 7000 }), // pickup → excluded
    ];
    expect(byZone(rows, resolve, "Sin zona")).toEqual([
      { zoneId: "roslyn", label: "Roslyn", orderCount: 1, cents: 10000 },
      { zoneId: "albertson", label: "Albertson", orderCount: 2, cents: 8000 },
      { zoneId: "unknown", label: "Sin zona", orderCount: 1, cents: 2000 },
    ]);
  });
});
