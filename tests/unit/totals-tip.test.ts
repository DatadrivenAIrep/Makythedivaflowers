import { describe, it, expect } from "vitest";
import { computeOrderTotals, TAX_RATE } from "@/lib/totals";

/**
 * A tip is not a sale. It is money the shop collects and hands to the person who
 * built or drove the order, so it must ride on top of the total without ever
 * entering the taxable base.
 */
describe("computeOrderTotals with a tip", () => {
  it("adds the tip to the total", () => {
    const withTip = computeOrderTotals(20000, 1500, 0, 1000);
    const without = computeOrderTotals(20000, 1500);
    expect(withTip.tipCents).toBe(1000);
    expect(withTip.totalCents).toBe(without.totalCents + 1000);
  });

  it("does not tax the tip", () => {
    const withTip = computeOrderTotals(20000, 1500, 0, 1000);
    const without = computeOrderTotals(20000, 1500);
    expect(withTip.taxCents).toBe(without.taxCents);
    expect(withTip.taxCents).toBe(Math.round((20000 + 1500) * TAX_RATE));
  });

  it("reports no tip when none is given", () => {
    expect(computeOrderTotals(20000, 1500).tipCents).toBe(0);
  });

  it("ignores a negative tip", () => {
    expect(computeOrderTotals(20000, 1500, 0, -500).tipCents).toBe(0);
  });

  it("a discount and a tip do not cancel each other out", () => {
    // The discount comes off the taxable goods; the tip sits outside it.
    const t = computeOrderTotals(20000, 1500, 2000, 1000);
    const taxable = 20000 + 1500 - 2000;
    expect(t.taxCents).toBe(Math.round(taxable * TAX_RATE));
    expect(t.totalCents).toBe(taxable + t.taxCents + 1000);
  });

  it("a tip on a zero-value order stays zero", () => {
    // Nothing to build and nothing to deliver means nobody to tip.
    expect(computeOrderTotals(0, 0, 0, 1000)).toEqual({
      subtotalCents: 0,
      deliveryCents: 0,
      discountCents: 0,
      tipCents: 0,
      taxCents: 0,
      totalCents: 0,
    });
  });

  it("a fully discounted order can still carry a tip", () => {
    const t = computeOrderTotals(10000, 0, 10000, 500);
    expect(t.taxCents).toBe(0);
    expect(t.totalCents).toBe(500);
  });
});
