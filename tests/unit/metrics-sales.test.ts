// tests/unit/metrics-sales.test.ts
import { describe, it, expect } from "vitest";
import { resolvePeriod } from "@/lib/metrics/period";
import { channelOf, channelTrend, channelShares, productRevenue, promoStats, type LineValue } from "@/lib/metrics/sales";
import { mo } from "./metrics-fixtures";

describe("channelOf", () => {
  it("maps known sources and folds anything else into the shop", () => {
    expect(channelOf("web")).toBe("web");
    expect(channelOf("whatsapp")).toBe("whatsapp");
    expect(channelOf("mystery")).toBe("walk-in");
  });
});

describe("channelTrend", () => {
  it("splits each bucket's revenue by channel", () => {
    const p = resolvePeriod("7d", "2026-10-12");
    const b = channelTrend([
      mo({ day: "2026-10-12", source: "web", amountPaidCents: 3000 }),
      mo({ day: "2026-10-12", source: "phone", amountPaidCents: 2000 }),
    ], p);
    expect(b).toHaveLength(7);
    expect(b[6]).toEqual({ key: "2026-10-12", web: 3000, phone: 2000, whatsapp: 0, "walk-in": 0, event: 0 });
  });
});

describe("channelShares", () => {
  it("gives every channel in fixed order with its share and change in points", () => {
    const cur = [mo({ day: "2026-10-01", source: "web", amountPaidCents: 6000 }), mo({ day: "2026-10-01", source: "phone", amountPaidCents: 4000 })];
    const prev = [mo({ day: "2026-09-01", source: "web", amountPaidCents: 5000 }), mo({ day: "2026-09-01", source: "phone", amountPaidCents: 5000 })];
    const s = channelShares(cur, prev);
    expect(s.map((x) => x.channel)).toEqual(["web", "phone", "whatsapp", "walk-in", "event"]);
    expect(s[0]).toEqual({ channel: "web", cents: 6000, orders: 1, sharePct: 60, shareDeltaPts: 10 });
    expect(channelShares(cur, null)[0].shareDeltaPts).toBeNull();
  });
});

describe("productRevenue", () => {
  const resolve = (line: Record<string, unknown>): LineValue | null =>
    line.kind === "custom"
      ? { key: "__custom__", name: "Personalizados", cents: (line.priceCents as number) * (line.qty as number) }
      : { key: line.productId as string, name: `P ${line.productId}`, cents: 5000 * (line.qty as number) };
  const lines = (...ls: object[]) => JSON.stringify(ls);

  it("ranks by revenue from paid orders and compares with the previous period", () => {
    const cur = [
      mo({ day: "2026-10-01", linesJson: lines({ kind: "catalog", productId: "a", qty: 2 }) }),
      mo({ day: "2026-10-02", linesJson: lines({ kind: "custom", priceCents: 20000, qty: 1 }) }),
      mo({ day: "2026-10-03", amountPaidCents: 0, paymentStatus: "pending", linesJson: lines({ kind: "catalog", productId: "b", qty: 9 }) }),
    ];
    const prev = [mo({ day: "2026-09-01", linesJson: lines({ kind: "catalog", productId: "a", qty: 1 }) })];
    expect(productRevenue(cur, prev, resolve)).toEqual([
      { key: "__custom__", name: "Personalizados", qty: 1, cents: 20000, delta: { kind: "new" } },
      { key: "a", name: "P a", qty: 2, cents: 10000, delta: { kind: "pct", pct: 100 } },
    ]);
  });
});

describe("promoStats", () => {
  it("adds up discounts, codes, gift cards and the funeral share", () => {
    expect(promoStats([
      mo({ day: "2026-10-01", discountCents: 1000, promoCode: "DIVA10", amountPaidCents: 9000 }),
      mo({ day: "2026-10-02", giftCardCents: 2500, funeral: true, amountPaidCents: 1000 }),
      mo({ day: "2026-10-03", fulfillmentStatus: "canceled", discountCents: 999, promoCode: "X" }),
    ])).toEqual({ discountCents: 1000, promoOrders: 1, giftCardRedeemedCents: 2500, funeralOrders: 1, funeralSharePct: 10 });
  });
});
