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
  it("rounds down to whole cents", () => {
    expect(rewardDiscountCents(10001, 15)).toBe(1500);
  });
});
