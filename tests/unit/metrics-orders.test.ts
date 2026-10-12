import { describe, it, expect } from "vitest";
import { resolvePeriod } from "@/lib/metrics/period";
import { between, isLive, periodStats, salesTrend, pendingPayments } from "@/lib/metrics/orders";
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

describe("pendingPayments and gift cards", () => {
  it("skips orders already marked paid, even when a gift card covered them (amount paid 0)", () => {
    expect(pendingPayments([
      mo({ day: "2026-10-01", source: "web", totalCents: 5000, amountPaidCents: 0, giftCardCents: 5000, paymentStatus: "paid" }),
    ])).toEqual({ count: 0, cents: 0 });
  });
  it("subtracts the gift card from the open balance", () => {
    expect(pendingPayments([
      mo({ day: "2026-10-01", totalCents: 10000, amountPaidCents: 4000, giftCardCents: 3000, paymentStatus: "pending" }),
      mo({ day: "2026-10-02", totalCents: 5000, amountPaidCents: 0, giftCardCents: 5000, paymentStatus: "pending" }),
    ])).toEqual({ count: 1, cents: 3000 });
  });
});

describe("isLive", () => {
  it("drops canceled orders and web checkouts that never got paid", () => {
    expect(isLive(mo({ day: "2026-10-01", fulfillmentStatus: "canceled" }))).toBe(false);
    expect(isLive(mo({ day: "2026-10-01", source: "web", paymentStatus: "pending", amountPaidCents: 0 }))).toBe(false);
    expect(isLive(mo({ day: "2026-10-01", source: "web", paymentStatus: "failed", amountPaidCents: 0 }))).toBe(false);
    expect(isLive(mo({ day: "2026-10-01", source: "web", paymentStatus: "paid" }))).toBe(true);
    expect(isLive(mo({ day: "2026-10-01", source: "web", paymentStatus: "refunded" }))).toBe(true);
    // Shop-taken orders can legitimately wait for payment.
    expect(isLive(mo({ day: "2026-10-01", source: "phone", paymentStatus: "pending", amountPaidCents: 0 }))).toBe(true);
  });
});

describe("salesTrend compares like with like", () => {
  it("compares the current month only with last year's same days (ytd)", () => {
    const p = resolvePeriod("ytd", "2026-10-12");
    const pts = salesTrend([
      mo({ day: "2026-10-05", amountPaidCents: 1000 }),
      mo({ day: "2025-10-05", amountPaidCents: 2000 }),
      mo({ day: "2025-10-20", amountPaidCents: 9000 }), // after the 12th: not comparable yet
    ], p);
    expect(pts.find((x) => x.key === "2026-10")).toMatchObject({ revenueCents: 1000, prevRevenueCents: 2000, prevOrders: 1 });
  });
  it("leaves out days before the period starts (90d first week)", () => {
    const p = resolvePeriod("90d", "2026-10-12");
    const before = "2026-07-14"; // start is 2026-07-15, same week bucket
    const pts = salesTrend([
      mo({ day: before, amountPaidCents: 7000 }),
      mo({ day: p.start as string, amountPaidCents: 1000 }),
      mo({ day: "2025-07-14", amountPaidCents: 6000 }), // shifts to before the start
      mo({ day: "2025-07-16", amountPaidCents: 2000 }),
    ], p);
    expect(pts[0]).toMatchObject({ revenueCents: 1000, orders: 1, prevRevenueCents: 2000, prevOrders: 1 });
  });
});
