// tests/unit/totals.test.ts
import { describe, it, expect } from "vitest";
import {
  computeOrderTotals,
  computeDeliveryCentsForZip,
  computeDeliveryCentsForAddress,
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
    expect(totals).toEqual({
      subtotalCents: 0,
      deliveryCents: 0,
      discountCents: 0,
      taxCents: 0,
      totalCents: 0,
    });
  });

  it("reports a zero discount when none is passed", () => {
    expect(computeOrderTotals(20000, 1500).discountCents).toBe(0);
  });
});

describe("computeOrderTotals with a discount", () => {
  it("subtracts the discount from the taxable base, not just the total", () => {
    // A merchant discount reduces the taxable receipt, so tax is charged on
    // what the customer actually pays for goods plus delivery.
    const totals = computeOrderTotals(20000, 1500, 2000);
    expect(totals.discountCents).toBe(2000);
    expect(totals.taxCents).toBe(Math.round((20000 + 1500 - 2000) * TAX_RATE));
    expect(totals.totalCents).toBe(20000 + 1500 - 2000 + totals.taxCents);
  });

  it("keeps subtotal and delivery at their pre-discount values", () => {
    const totals = computeOrderTotals(20000, 1500, 2000);
    expect(totals.subtotalCents).toBe(20000);
    expect(totals.deliveryCents).toBe(1500);
  });

  it("caps the discount at subtotal plus delivery so the total never goes negative", () => {
    const totals = computeOrderTotals(10000, 1000, 999999);
    expect(totals.discountCents).toBe(11000);
    expect(totals.taxCents).toBe(0);
    expect(totals.totalCents).toBe(0);
  });

  it("ignores a negative discount", () => {
    const totals = computeOrderTotals(20000, 1500, -500);
    expect(totals.discountCents).toBe(0);
    expect(totals.totalCents).toBe(computeOrderTotals(20000, 1500).totalCents);
  });

  it("a discount equal to delivery prices the order as free delivery", () => {
    const freeDelivery = computeOrderTotals(20000, 1500, 1500);
    const noDelivery = computeOrderTotals(20000, 0, 0);
    expect(freeDelivery.totalCents).toBe(noDelivery.totalCents);
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

describe("computeDeliveryCentsForAddress", () => {
  it("resolves by ZIP when the ZIP is in a zone", () => {
    expect(computeDeliveryCentsForAddress({ zip: "11507", city: "" })).toBe(1000);
  });

  it("falls back to the city when the ZIP is missing", () => {
    expect(computeDeliveryCentsForAddress({ zip: "", city: "Great Neck" })).toBe(2500);
  });

  it("falls back to the city when the ZIP is out of zone", () => {
    expect(computeDeliveryCentsForAddress({ zip: "90210", city: "Manhasset" })).toBe(1800);
  });

  it("lets the ZIP win when both ZIP and city resolve", () => {
    // ZIP says Albertson ($10), city says Great Neck ($25) — ZIP is more specific.
    expect(computeDeliveryCentsForAddress({ zip: "11507", city: "Great Neck" })).toBe(1000);
  });

  it("returns null when neither ZIP nor city resolves", () => {
    expect(computeDeliveryCentsForAddress({ zip: "", city: "" })).toBeNull();
    expect(computeDeliveryCentsForAddress({ zip: "90210", city: "Nowhere" })).toBeNull();
  });
});
