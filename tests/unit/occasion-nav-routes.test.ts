import { describe, it, expect } from "vitest";
import { OCCASION_NAV } from "@/lib/occasions-nav";
import { OCCASIONS_ALL, OCCASION_CONTENT } from "@/data/occasion-content";
import type { Occasion } from "@/types/product";

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
});
