import { describe, it, expect } from "vitest";
import { resolvePeriod } from "@/lib/metrics/period";
import { between, periodStats, salesTrend, pendingPayments } from "@/lib/metrics/orders";
import { mo } from "./metrics-fixtures";

describe("periodStats", () => {
  it("counts non-canceled orders and collected, non-refunded revenue", () => {
    const s = periodStats([
      mo({ day: "2026-10-01", amountPaidCents: 6000 }),
      mo({ day: "2026-10-02", amountPaidCents: 0, paymentStatus: "pending" }),
      mo({ day: "2026-10-03", fulfillmentStatus: "canceled" }),
      mo({ day: "2026-10-04", paymentStatus: "refunded" }),
    ]);
    expect(s).toEqual({ revenueCents: 6000, orderCount: 3, paidOrderCount: 1, aovCents: 6000 });
  });
});

describe("between", () => {
  it("keeps orders whose shop day is inside the range", () => {
    const os = [mo({ day: "2026-09-12" }), mo({ day: "2026-09-13" }), mo({ day: "2026-10-12" })];
    expect(between(os, "2026-09-13", "2026-10-12").map((o) => o.day)).toEqual(["2026-09-13", "2026-10-12"]);
  });
});

describe("salesTrend", () => {
  it("puts this year in each bucket and last year's same dates beside it", () => {
    const p = resolvePeriod("7d", "2026-10-12");
    const pts = salesTrend([
      mo({ day: "2026-10-10", amountPaidCents: 5000 }),
      mo({ day: "2026-10-10", amountPaidCents: 3000 }),
      mo({ day: "2025-10-10", amountPaidCents: 4000 }),
      mo({ day: "2026-10-12", fulfillmentStatus: "canceled" }),
    ], p);
    expect(pts).toHaveLength(7);
    expect(pts.find((x) => x.key === "2026-10-10")).toEqual({
      key: "2026-10-10", revenueCents: 8000, orders: 2, prevRevenueCents: 4000, prevOrders: 1,
    });
    expect(pts.find((x) => x.key === "2026-10-12")).toMatchObject({ orders: 0 });
  });
});

describe("pendingPayments", () => {
  it("sums open balances of live orders, leaving house-account orders to their statements", () => {
    expect(pendingPayments([
      mo({ day: "2026-10-01", totalCents: 10000, amountPaidCents: 4000, paymentStatus: "pending" }),
      mo({ day: "2026-10-02", totalCents: 5000, amountPaidCents: 0, paymentStatus: "pending", houseAccount: true }),
      mo({ day: "2026-10-03", totalCents: 5000, amountPaidCents: 0, paymentStatus: "pending", fulfillmentStatus: "canceled" }),
      mo({ day: "2026-10-04" }),
    ])).toEqual({ count: 1, cents: 6000 });
  });
});
