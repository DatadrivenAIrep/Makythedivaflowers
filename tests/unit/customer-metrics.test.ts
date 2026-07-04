import { describe, it, expect } from "vitest";
import {
  computeMetrics, atRiskCutoffIso,
  AT_RISK_DAYS,
  type MetricsOrder,
} from "@/lib/customer-metrics";

const NOW = new Date("2026-07-04T12:00:00Z");
const DAY = 86_400_000;

function order(daysAgo: number, paidCents: number): MetricsOrder {
  return {
    totalCents: paidCents > 0 ? paidCents : 5000,
    amountPaidCents: paidCents,
    createdAt: new Date(NOW.getTime() - daysAgo * DAY).toISOString(),
  };
}

describe("computeMetrics", () => {
  it("no orders, no fallback → new segment with null dates", () => {
    const m = computeMetrics([], NOW);
    expect(m).toMatchObject({
      ltvCents: 0, orderCount: 0, paidOrderCount: 0, aovCents: 0,
      firstOrderAt: null, lastOrderAt: null, daysSinceLastOrder: null,
      segment: "new", isVip: false, isAtRisk: false, isRecurring: false,
    });
  });

  it("no orders + seen fallback → dates fall back to first/last seen", () => {
    const m = computeMetrics([], NOW, {
      firstSeenAt: "2026-01-01T00:00:00Z",
      lastSeenAt: "2026-06-01T00:00:00Z",
    });
    expect(m.firstOrderAt).toBe("2026-01-01T00:00:00Z");
    expect(m.lastOrderAt).toBe("2026-06-01T00:00:00Z");
    expect(m.segment).toBe("new");
  });

  it("1 order → new; LTV and AOV from collected cents", () => {
    const m = computeMetrics([order(3, 7500)], NOW);
    expect(m.segment).toBe("new");
    expect(m.ltvCents).toBe(7500);
    expect(m.aovCents).toBe(7500);
    expect(m.daysSinceLastOrder).toBe(3);
  });

  it("2 recent orders → recurring; AOV averages paid orders only", () => {
    const m = computeMetrics([order(10, 6000), order(5, 9000), order(2, 0)], NOW);
    expect(m.segment).toBe("recurring");
    expect(m.orderCount).toBe(3);
    expect(m.paidOrderCount).toBe(2);
    expect(m.ltvCents).toBe(15000);
    expect(m.aovCents).toBe(7500);
    expect(m.firstOrderAt).toBe(order(10, 6000).createdAt);
    expect(m.lastOrderAt).toBe(order(2, 0).createdAt);
  });

  it("VIP by order count (5 orders)", () => {
    const m = computeMetrics([1, 2, 3, 4, 5].map((d) => order(d, 4000)), NOW);
    expect(m.segment).toBe("vip");
    expect(m.isVip).toBe(true);
  });

  it("VIP by LTV boundary (exactly $500 collected)", () => {
    const m = computeMetrics([order(5, 25000), order(3, 25000)], NOW);
    expect(m.ltvCents).toBe(50000);
    expect(m.segment).toBe("vip");
  });

  it("4 orders / $499.99 → not VIP", () => {
    const m = computeMetrics([1, 2, 3, 4].map((d) => order(d, 12499)), NOW);
    expect(m.ltvCents).toBe(49996);
    expect(m.isVip).toBe(false);
    expect(m.segment).toBe("recurring");
  });

  it("at-risk: recurring + last order 91 days ago; primary badge wins over vip", () => {
    const m = computeMetrics([91, 120, 200, 300, 400].map((d) => order(d, 20000)), NOW);
    expect(m.isVip).toBe(true);
    expect(m.isAtRisk).toBe(true);
    expect(m.segment).toBe("at_risk");
  });

  it("boundary: exactly 90 days since last order is NOT at risk", () => {
    const m = computeMetrics([order(AT_RISK_DAYS, 5000), order(120, 5000)], NOW);
    expect(m.daysSinceLastOrder).toBe(90);
    expect(m.isAtRisk).toBe(false);
    expect(m.segment).toBe("recurring");
  });

  it("single old order is NOT at risk (needs recurring)", () => {
    const m = computeMetrics([order(200, 5000)], NOW);
    expect(m.isAtRisk).toBe(false);
    expect(m.segment).toBe("new");
  });
});

describe("atRiskCutoffIso", () => {
  it("is exactly AT_RISK_DAYS before now", () => {
    expect(atRiskCutoffIso(NOW)).toBe(new Date(NOW.getTime() - AT_RISK_DAYS * DAY).toISOString());
  });
});
