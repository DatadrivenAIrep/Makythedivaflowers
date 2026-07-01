import { describe, it, expect } from "vitest";
import { resolveOrderTotals } from "@/lib/totals";
import type { CartLine } from "@/types/order";

const customLine = (priceCents: number, qty: number): CartLine => ({
  kind: "custom", title: "Custom", priceCents, qty,
});

describe("resolveOrderTotals", () => {
  it("computes subtotal from lines and tax on top (in-store, no delivery)", () => {
    const t = resolveOrderTotals({ lines: [customLine(5000, 2)], fulfillmentMethod: "in-store" });
    expect(t.subtotalCents).toBe(10000);
    expect(t.deliveryCents).toBe(0);
    expect(t.totalCents).toBe(t.subtotalCents + t.taxCents);
  });

  it("prices delivery from the address ZIP", () => {
    const t = resolveOrderTotals({
      lines: [customLine(5000, 1)],
      fulfillmentMethod: "delivery",
      address: { zip: "11507", city: "Albertson" },
    });
    expect(t.deliveryCents).toBeGreaterThan(0);
  });

  it("applies an override over the computed values", () => {
    const t = resolveOrderTotals({
      lines: [customLine(5000, 1)],
      fulfillmentMethod: "in-store",
      override: { totalCents: 9999 },
    });
    expect(t.totalCents).toBe(9999);
  });

  it("cascades: overriding the subtotal recomputes tax + total", () => {
    const t = resolveOrderTotals({
      lines: [customLine(5000, 1)],
      fulfillmentMethod: "in-store",
      override: { subtotalCents: 10000 },
    });
    expect(t.subtotalCents).toBe(10000);
    expect(t.taxCents).toBe(Math.round(10000 * 0.08625));
    expect(t.totalCents).toBe(10000 + t.taxCents);
  });

  it("cascades: overriding delivery recomputes tax + total", () => {
    const t = resolveOrderTotals({
      lines: [customLine(5000, 1)],
      fulfillmentMethod: "delivery",
      address: { zip: "11507", city: "Albertson" },
      override: { deliveryCents: 2000 },
    });
    expect(t.deliveryCents).toBe(2000);
    expect(t.taxCents).toBe(Math.round((t.subtotalCents + 2000) * 0.08625));
    expect(t.totalCents).toBe(t.subtotalCents + 2000 + t.taxCents);
  });
});
