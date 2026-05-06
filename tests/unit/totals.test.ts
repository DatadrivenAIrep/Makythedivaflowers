// tests/unit/totals.test.ts
import { describe, it, expect } from "vitest";
import {
  computeOrderTotals,
  computeDeliveryCentsForZip,
  TAX_RATE,
} from "@/lib/totals";

describe("computeOrderTotals", () => {
  it("uses the deliveryCents argument and adds tax on (subtotal + delivery)", () => {
    const totals = computeOrderTotals(20000, 1500); // $200 + $15 delivery
    expect(totals.subtotalCents).toBe(20000);
    expect(totals.deliveryCents).toBe(1500);
    expect(totals.taxCents).toBe(Math.round((20000 + 1500) * TAX_RATE));
    expect(totals.totalCents).toBe(20000 + 1500 + totals.taxCents);
  });

  it("defaults deliveryCents to 0 when omitted", () => {
    const totals = computeOrderTotals(20000);
    expect(totals.deliveryCents).toBe(0);
    expect(totals.taxCents).toBe(Math.round(20000 * TAX_RATE));
  });

  it("treats zero subtotal as zero everything", () => {
    const totals = computeOrderTotals(0, 1500);
    expect(totals).toEqual({ subtotalCents: 0, deliveryCents: 0, taxCents: 0, totalCents: 0 });
  });
});

describe("computeDeliveryCentsForZip", () => {
  it("returns the named-city price for an in-zone ZIP", () => {
    expect(computeDeliveryCentsForZip("11507")).toBe(1000); // Albertson $10
    expect(computeDeliveryCentsForZip("11576")).toBe(1500); // Roslyn $15
    expect(computeDeliveryCentsForZip("11030")).toBe(1800); // Manhasset $18
    expect(computeDeliveryCentsForZip("11020")).toBe(2500); // Great Neck $25
    expect(computeDeliveryCentsForZip("11050")).toBe(1500); // Port Washington $15
  });

  it("returns the further-zone low end for non-named ZIPs in service area", () => {
    expect(computeDeliveryCentsForZip("11530")).toBe(2500); // Garden City
    expect(computeDeliveryCentsForZip("11375")).toBe(2500); // Forest Hills (Queens)
  });

  it("returns null for ZIPs outside the service area", () => {
    expect(computeDeliveryCentsForZip("90210")).toBeNull();
  });

  it("returns null for invalid ZIPs", () => {
    expect(computeDeliveryCentsForZip("nope")).toBeNull();
    expect(computeDeliveryCentsForZip("")).toBeNull();
  });
});
