import { describe, it, expect, vi } from "vitest";
import { CHRISTMAS_LINK, EXOTIC_LINK, FALL_LINK, OCCASION_NAV, VALENTINES_LINK, occasionLinks, seasonalLink } from "@/lib/occasions-nav";
import { isChristmasProduct, isExoticProduct, isFallProduct, isValentinesProduct, productsInShopCategory } from "@/lib/shop-categories";
import { OCCASIONS_ALL, OCCASION_CONTENT } from "@/data/occasion-content";
import type { Occasion } from "@/types/product";
import { PRODUCTS } from "@/data/products";

/**
 * The nav is a promise of a page. These catch the two ways it can lie: a menu
 * entry pointing at a route that does not exist, and an occasion that has a
 * page nobody can reach.
 */
describe("occasion navigation", () => {
  const ROUTED_ELSEWHERE: Occasion[] = ["sympathy"];

  it("every menu entry points at a route that is generated", () => {
    for (const item of OCCASION_NAV) {
      const path = item.path("en");
      if (ROUTED_ELSEWHERE.includes(item.slug)) {
        expect(path, `${item.slug} should keep its own page`).toBe("/en/sympathy");
        continue;
      }
      expect(path, `${item.slug} does not point at an occasion page`).toBe(
        `/en/ocasiones/${item.slug}`,
      );
      expect(OCCASIONS_ALL, `${item.slug} has no content`).toContain(item.slug);
    }
  });

  it("keeps the Spanish locale in the path", () => {
    for (const item of OCCASION_NAV) {
      expect(item.path("es").startsWith("/es/"), `${item.slug} dropped the locale`).toBe(true);
    }
  });

  it("labels every menu entry in both languages", () => {
    for (const item of OCCASION_NAV) {
      expect(item.label.en.length, `${item.slug} en label`).toBeGreaterThan(0);
      expect(item.label.es.length, `${item.slug} es label`).toBeGreaterThan(0);
      // The menu label and the page H1 need not be identical, but an entry with
      // no content behind it is a dead end.
      expect(OCCASION_CONTENT[item.slug]).toBeTruthy();
    }
  });

  it("does not send a shopper to a bare query string any more", () => {
    for (const item of OCCASION_NAV) {
      expect(item.path("en")).not.toContain("?occasion=");
    }
  });

  it("covers each occasion with a piece tagged for it", () => {
    for (const item of OCCASION_NAV) {
      const owner = PRODUCTS.find((p) => p.images[0]?.src === item.img);
      expect(owner, `${item.slug}: ${item.img} is no product's cover`).toBeTruthy();
      expect(owner!.active, `${item.slug}: ${owner!.slug} is not on sale`).toBe(true);
      expect(owner!.occasions, `${item.slug}: ${owner!.slug} is not tagged for it`).toContain(item.slug);
    }
  });

  it("ends every occasion list with the exotic collection", () => {
    expect(occasionLinks().at(-1)).toBe(EXOTIC_LINK);
    expect(EXOTIC_LINK.path("es")).toBe("/es/shop/exotic");
    const owner = PRODUCTS.find((p) => p.images[0]?.src === EXOTIC_LINK.img);
    expect(owner && isExoticProduct(owner), `${EXOTIC_LINK.img} is not an exotic piece`).toBe(true);
  });

  it("lists the fall collection only in the fall window", () => {
    const at = (iso: string) => occasionLinks(new Date(iso)).map((l) => l.slug);
    expect(at("2026-10-15T16:00:00Z")).toContain("fall");
    expect(at("2026-10-15T16:00:00Z").slice(-2)).toEqual(["fall", "exotic"]);
    expect(at("2026-12-10T16:00:00Z")).not.toContain("fall");
    expect(at("2026-07-01T16:00:00Z")).not.toContain("fall");
    expect(FALL_LINK.path("es")).toBe("/es/shop/fall");
    const owner = PRODUCTS.find((p) => p.images[0]?.src === FALL_LINK.img);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-15T16:00:00Z")); // fall pieces are only on sale in autumn
    try {
      expect(owner && isFallProduct(owner), `${FALL_LINK.img} is not a fall piece`).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("hands the seasonal slot from fall to Christmas to Valentine's", () => {
    const at = (iso: string) => seasonalLink(new Date(iso))?.slug ?? null;
    expect(at("2026-10-15T16:00:00Z")).toBe("fall");
    expect(at("2026-11-26T16:00:00Z")).toBe("fall"); // Thanksgiving 2026
    expect(at("2026-11-27T16:00:00Z")).toBe("christmas");
    expect(at("2026-12-25T16:00:00Z")).toBe("christmas");
    expect(at("2026-12-28T16:00:00Z")).toBeNull();
    expect(at("2027-01-20T16:00:00Z")).toBe("valentines");
    expect(at("2027-02-14T16:00:00Z")).toBe("valentines");
    expect(at("2027-02-16T16:00:00Z")).toBeNull();
    expect(occasionLinks(new Date("2026-12-10T16:00:00Z")).slice(-2).map((l) => l.slug)).toEqual(["christmas", "exotic"]);
  });

  it("covers the Christmas and Valentine's cards with pieces from those collections", () => {
    const cover = (img: string) => PRODUCTS.find((p) => p.images[0]?.src === img)!;
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(new Date("2026-12-10T16:00:00Z"));
      expect(isChristmasProduct(cover(CHRISTMAS_LINK.img))).toBe(true);
      expect(productsInShopCategory(PRODUCTS, "christmas").length).toBeGreaterThan(0);
      vi.setSystemTime(new Date("2027-02-01T16:00:00Z"));
      expect(isValentinesProduct(cover(VALENTINES_LINK.img))).toBe(true);
      expect(productsInShopCategory(PRODUCTS, "valentines").some((p) => p.category === "sympathy")).toBe(false);
    } finally {
      vi.useRealTimers();
    }
    expect(CHRISTMAS_LINK.path("es")).toBe("/es/shop/christmas");
    expect(VALENTINES_LINK.path("es")).toBe("/es/shop/valentines");
  });
});
