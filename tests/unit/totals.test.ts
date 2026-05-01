// tests/unit/totals.test.ts
import { describe, it, expect } from "vitest";
import { computeOrderTotals, DELIVERY_FLAT_CENTS, TAX_RATE } from "@/lib/totals";

describe("computeOrderTotals", () => {
  it("adds delivery + tax to subtotal, rounded to nearest cent", () => {
    const totals = computeOrderTotals(20000); // $200
    expect(totals.subtotalCents).toBe(20000);
    expect(totals.deliveryCents).toBe(DELIVERY_FLAT_CENTS);
    expect(totals.taxCents).toBe(Math.round((20000 + DELIVERY_FLAT_CENTS) * TAX_RATE));
    expect(totals.totalCents).toBe(20000 + DELIVERY_FLAT_CENTS + totals.taxCents);
  });

  it("treats zero subtotal as zero everything", () => {
    const totals = computeOrderTotals(0);
    expect(totals).toEqual({ subtotalCents: 0, deliveryCents: 0, taxCents: 0, totalCents: 0 });
  });
});
