import { describe, it, expect } from "vitest";
import { rewardPercent, applicableRewards, rewardDiscountCents } from "@/lib/loyalty-rewards";

describe("rewardPercent", () => {
  it("reads a single percent", () => {
    expect(rewardPercent("15% de descuento")).toBe(15);
    expect(rewardPercent("15 % off")).toBe(15);
  });
  it("rejects non-percent, ambiguous and out-of-range text", () => {
    expect(rewardPercent("Un ramo gratis")).toBeNull();
    expect(rewardPercent("10% + 5% extra")).toBeNull();
    expect(rewardPercent("100%")).toBeNull();
    expect(rewardPercent("0%")).toBeNull();
  });
  it("does not read the tail of a longer number as the percent", () => {
    expect(rewardPercent("12.5%")).toBeNull();
    expect(rewardPercent("12,5%")).toBeNull();
    expect(rewardPercent("1015%")).toBeNull();
    expect(rewardPercent("15%")).toBe(15);
    expect(rewardPercent("Premio: 15% de descuento")).toBe(15);
  });
  it("still counts a decimal percent as a second percent", () => {
    expect(rewardPercent("10% + 12.5% extra")).toBeNull();
  });
});

describe("applicableRewards", () => {
  it("keeps percent rewards, highest first", () => {
    const r = applicableRewards([
      { id: "a", reward: "15%" },
      { id: "b", reward: "Café" },
      { id: "final", reward: "50%" },
    ]);
    expect(r.map((x) => x.id)).toEqual(["final", "a"]);
    expect(r[0]).toEqual({ id: "final", percent: 50, label: "50%" });
  });
});

describe("rewardDiscountCents", () => {
  it("rounds to the nearest cent and never exceeds the subtotal", () => {
    expect(rewardDiscountCents(10001, 15)).toBe(1500);
    expect(rewardDiscountCents(10004, 15)).toBe(1501); // 1500.6: round differs from floor
    expect(rewardDiscountCents(0, 50)).toBe(0);
    expect(rewardDiscountCents(1, 99)).toBe(1); // capped at the subtotal
  });
});
