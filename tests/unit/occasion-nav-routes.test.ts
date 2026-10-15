import { describe, it, expect } from "vitest";
import { EXOTIC_LINK, OCCASION_LINKS, OCCASION_NAV } from "@/lib/occasions-nav";
import { isExoticProduct } from "@/lib/shop-categories";
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
    expect(OCCASION_LINKS.at(-1)).toBe(EXOTIC_LINK);
    expect(EXOTIC_LINK.path("es")).toBe("/es/shop/exotic");
    const owner = PRODUCTS.find((p) => p.images[0]?.src === EXOTIC_LINK.img);
    expect(owner && isExoticProduct(owner), `${EXOTIC_LINK.img} is not an exotic piece`).toBe(true);
  });
});
