import { describe, it, expect, vi } from "vitest";
import { EVERGREEN_PICKS, THANKSGIVING_IMG, seasonalPicks } from "@/lib/seasonal-picks";
import { isCenterpieceProduct, isRoseProduct } from "@/lib/shop-categories";
import { PRODUCTS } from "@/data/products";

const slugsAt = (iso: string) => seasonalPicks(new Date(iso)).map((p) => p.slug);

describe("home seasonal picks", () => {
  it("leads with fall and Thanksgiving in late October", () => {
    expect(slugsAt("2026-10-28T16:00:00Z")).toEqual([
      "fall",
      "thanksgiving",
      "roses",
      "designers-choice",
      "centerpieces",
      "exotic",
      "sympathy",
    ]);
  });

  it("keeps Thanksgiving through the day itself, then hands over to Christmas", () => {
    expect(slugsAt("2026-11-26T16:00:00Z")).toContain("thanksgiving");
    expect(slugsAt("2026-11-27T16:00:00Z")[0]).toBe("christmas");
    expect(slugsAt("2026-11-27T16:00:00Z")).not.toContain("thanksgiving");
  });

  it("does not show Thanksgiving before mid-October", () => {
    expect(slugsAt("2026-10-01T16:00:00Z")).toEqual(["fall", ...EVERGREEN_PICKS.map((p) => p.slug)]);
  });

  it("puts Valentine's Day first in February", () => {
    expect(slugsAt("2027-02-10T16:00:00Z")[0]).toBe("valentines");
  });

  it("shows only the evergreen picks outside every season", () => {
    expect(slugsAt("2026-07-01T16:00:00Z")).toEqual(EVERGREEN_PICKS.map((p) => p.slug));
  });

  it("dates the Thanksgiving badge in both languages", () => {
    const tg = seasonalPicks(new Date("2026-10-28T16:00:00Z")).find((p) => p.slug === "thanksgiving")!;
    expect(tg.badge!.en).toBe("Thu, Nov 26");
    expect(tg.badge!.es).toMatch(/^Jue 26/);
    expect(tg.path("es")).toBe("/es/shop/centerpieces");
  });

  it("covers each chip with a piece from the collection it opens", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-28T16:00:00Z")); // fall pieces are only on sale in autumn
    try {
      const owner = (img: string) => PRODUCTS.find((p) => p.images[0]?.src === img);
      const roses = owner(EVERGREEN_PICKS.find((p) => p.slug === "roses")!.img);
      expect(roses && isRoseProduct(roses)).toBe(true);
      const centerpiece = owner(EVERGREEN_PICKS.find((p) => p.slug === "centerpieces")!.img);
      expect(centerpiece && isCenterpieceProduct(centerpiece)).toBe(true);
      const harvest = owner(THANKSGIVING_IMG);
      expect(harvest && isCenterpieceProduct(harvest)).toBe(true);
      const sympathy = owner(EVERGREEN_PICKS.find((p) => p.slug === "sympathy")!.img);
      expect(sympathy?.active).toBe(true);
      const pick = EVERGREEN_PICKS.find((p) => p.slug === "designers-choice")!;
      const choice = owner(pick.img);
      expect(choice?.active).toBe(true);
      expect(pick.path("en")).toBe(`/en/product/${choice!.slug}`);
    } finally {
      vi.useRealTimers();
    }
  });
});
