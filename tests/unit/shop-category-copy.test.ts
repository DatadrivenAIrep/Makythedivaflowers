import { describe, it, expect } from "vitest";
import { SHOP_CATEGORY_COPY } from "@/data/shop-category-copy";

const INDEXED = ["arrangements", "bouquets", "roses", "exotic", "centerpieces", "fall", "christmas", "valentines", "plants", "gifts"] as const;

describe("shop category copy", () => {
  it("has a heading and a real paragraph in both languages for every indexable category", () => {
    for (const slug of INDEXED) {
      const copy = SHOP_CATEGORY_COPY[slug];
      expect(copy, slug).toBeDefined();
      for (const locale of ["en", "es"] as const) {
        expect(copy!.heading[locale].length, `${slug} ${locale} heading`).toBeGreaterThan(15);
        expect(copy!.body[locale].split(/\s+/).length, `${slug} ${locale} body`).toBeGreaterThan(60);
      }
    }
  });

  it("never repeats a paragraph across categories (duplicate text is why hubs went unindexed)", () => {
    for (const locale of ["en", "es"] as const) {
      const bodies = INDEXED.map((s) => SHOP_CATEGORY_COPY[s]!.body[locale]);
      expect(new Set(bodies).size).toBe(bodies.length);
    }
  });

  it("never hard-codes the same-day cutoff time", () => {
    for (const slug of INDEXED) {
      for (const locale of ["en", "es"] as const) {
        expect(SHOP_CATEGORY_COPY[slug]!.body[locale]).not.toMatch(/\d{1,2}:\d{2}/);
      }
    }
  });
});
