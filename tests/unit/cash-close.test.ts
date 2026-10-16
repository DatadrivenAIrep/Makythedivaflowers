import { describe, it, expect } from "vitest";
import { summarizeDay, expectedCash, closeDifference, changeSinceClose, parseMoneyCents } from "@/lib/cash-close";

const rows = [
  { method: "cash" as const, kind: "payment" as const, amountCents: 30000 },
  { method: "cash" as const, kind: "deposit" as const, amountCents: 8500 },
  { method: "cash" as const, kind: "refund" as const, amountCents: -2000 },
  { method: "zelle" as const, kind: "payment" as const, amountCents: 12000 },
  { method: "stripe" as const, kind: "payment" as const, amountCents: 9900 },
  { method: "gift-card" as const, kind: "payment" as const, amountCents: 5000 },
];

describe("summarizeDay", () => {
  it("totals money per method, keeps gift cards apart, nets refunds", () => {
    const s = summarizeDay(rows);
    expect(s.byMethod.cash).toBe(36500);
    expect(s.byMethod.zelle).toBe(12000);
    expect(s.byMethod.stripe).toBe(9900);
    expect(s.byMethod["card-terminal"]).toBe(0);
    expect(s.cashInCents).toBe(38500);
    expect(s.cashRefundsCents).toBe(2000);
    expect(s.giftCardRedeemedCents).toBe(5000);
    expect(s.totalCollectedCents).toBe(36500 + 12000 + 9900);
  });
  it("is all zeros for an empty day", () => {
    expect(summarizeDay([]).totalCollectedCents).toBe(0);
  });
});

describe("cuadre", () => {
  it("expected = float + cash in − cash refunds − cash out", () => {
    expect(expectedCash({ openingFloatCents: 10000, cashInCents: 38500, cashRefundsCents: 2000, cashOutCents: 1200 })).toBe(45300);
  });
  it("difference is counted − expected (negative = short)", () => {
    expect(closeDifference(44800, 45300)).toBe(-500);
    expect(closeDifference(45300, 45300)).toBe(0);
  });
});

describe("changeSinceClose", () => {
  it("reports money recorded after the close", () => {
    const saved = summarizeDay(rows);
    const live = summarizeDay([...rows, { method: "cash", kind: "payment", amountCents: 4000 }]);
    expect(changeSinceClose(live, saved)).toBe(4000);
    expect(changeSinceClose(saved, saved)).toBe(0);
  });
  it("notices a method swap that keeps the total", () => {
    const saved = summarizeDay([{ method: "cash", kind: "payment", amountCents: 100 }]);
    const live = summarizeDay([{ method: "zelle", kind: "payment", amountCents: 100 }]);
    expect(changeSinceClose(live, saved)).not.toBe(0);
  });
});

describe("parseMoneyCents", () => {
  it.each([["$1,234.50", 123450], ["12,50", 1250], ["12", 1200], [" 7.5 ", 750], ["0", 0]])("%s → %d", (t, c) => {
    expect(parseMoneyCents(t)).toBe(c);
  });
  it.each(["", "abc", "-5", "1.234"])("rejects %s", (t) => {
    expect(parseMoneyCents(t)).toBeNull();
  });
});
