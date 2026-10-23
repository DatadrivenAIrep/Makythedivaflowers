import { PRODUCTS } from "@/data/products";
import { describe, it, expect } from "vitest";
import { computeOrderTotals, resolveOrderTotals } from "@/lib/totals";
import type { CartLine } from "@/types/order";

const LINES: CartLine[] = [{ kind: "custom", title: "Ramo", priceCents: 5000, qty: 1 }];

describe("computeOrderTotals with taxExempt", () => {
  it("charges no tax but keeps discount and tip math", () => {
    const t = computeOrderTotals(5000, 1000, 500, 300, { taxExempt: true });
    expect(t).toEqual({ subtotalCents: 5000, deliveryCents: 1000, discountCents: 500, tipCents: 300, taxCents: 0, totalCents: 5800 });
  });
  it("defaults to taxed", () => {
    expect(computeOrderTotals(5000).taxCents).toBe(Math.round(5000 * 0.08625));
  });
});

describe("resolveOrderTotals with taxExempt", () => {
  it("zeroes tax for an exempt order", () => {
    const t = resolveOrderTotals({ lines: LINES, products: PRODUCTS, fulfillmentMethod: "pickup", taxExempt: true });
    expect(t.taxCents).toBe(0);
    expect(t.totalCents).toBe(5000);
  });
  it("ignores a manual tax override when exempt", () => {
    const t = resolveOrderTotals({ lines: LINES, products: PRODUCTS, fulfillmentMethod: "pickup", taxExempt: true, override: { taxCents: 999 } });
    expect(t.taxCents).toBe(0);
    expect(t.totalCents).toBe(5000);
  });
  it("still honours a pinned total override", () => {
    const t = resolveOrderTotals({ lines: LINES, products: PRODUCTS, fulfillmentMethod: "pickup", taxExempt: true, override: { totalCents: 4000 } });
    expect(t.totalCents).toBe(4000);
  });
  it("cascades a subtotal override with no tax", () => {
    const t = resolveOrderTotals({ lines: LINES, products: PRODUCTS, fulfillmentMethod: "pickup", taxExempt: true, override: { subtotalCents: 8000, discountCents: 1000, tipCents: 200 } });
    expect(t).toMatchObject({ taxCents: 0, totalCents: 8000 - 1000 + 200 });
  });
});
