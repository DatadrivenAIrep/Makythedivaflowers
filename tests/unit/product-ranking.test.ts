import { describe, it, expect } from "vitest";
import { salesScores, SALES_HALF_LIFE_DAYS, type RankedOrder } from "@/lib/product-ranking";
import { PRODUCTS } from "@/data/products";

const now = new Date("2026-10-15T12:00:00Z");
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000).toISOString();
const line = (productId: string, qty = 1) => ({ kind: "catalog", productId, variantId: "standard", addOnIds: [], qty });

const order = (over: Partial<RankedOrder> & { lines?: unknown[] }): RankedOrder => ({
  source: "web",
  paymentStatus: "paid",
  fulfillmentStatus: "delivered",
  amountPaidCents: 10000,
  createdAt: daysAgo(0),
  linesJson: JSON.stringify(over.lines ?? []),
  ...over,
});

describe("salesScores", () => {
  it("counts each order once per product, whatever the quantity", () => {
    const s = salesScores([order({ lines: [line("a", 50), line("a", 2), line("b")] })], now);
    expect(s.get("a")).toBeCloseTo(1);
    expect(s.get("b")).toBeCloseTo(1);
  });

  it("halves an order's weight every half-life", () => {
    const s = salesScores([order({ createdAt: daysAgo(SALES_HALF_LIFE_DAYS), lines: [line("a")] })], now);
    expect(s.get("a")).toBeCloseTo(0.5);
  });

  it("skips canceled, refunded and abandoned web orders but keeps unpaid shop orders", () => {
    const s = salesScores(
      [
        order({ fulfillmentStatus: "canceled", lines: [line("canceled")] }),
        order({ paymentStatus: "refunded", lines: [line("refunded")] }),
        order({ paymentStatus: "pending", lines: [line("abandoned")] }),
        order({ source: "phone", paymentStatus: "pending", amountPaidCents: 0, lines: [line("house")] }),
      ],
      now,
    );
    expect([...s.keys()]).toEqual(["house"]);
  });

  it("ignores custom lines and unreadable line data", () => {
    const s = salesScores(
      [
        order({ lines: [{ kind: "custom", priceCents: 5000, qty: 1 }] }),
        order({ linesJson: "not json" }),
      ],
      now,
    );
    expect(s.size).toBe(0);
  });
});

describe("catalog dates", () => {
  it("every product carries the day it joined the catalog", () => {
    const missing = PRODUCTS.filter((p) => !/^\d{4}-\d{2}-\d{2}$/.test(p.addedAt ?? "")).map((p) => p.slug);
    expect(missing).toEqual([]);
  });
});
