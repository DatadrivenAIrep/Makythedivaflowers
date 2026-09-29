// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { PRODUCTS } from "@/data/products";
import sitemap from "@/app/sitemap";
import {
  CATS,
  LABELS,
  EXOTIC_SLUGS_FOR_TEST,
  CENTERPIECE_SLUGS_FOR_TEST,
  isCenterpieceProduct,
  productsInShopCategory,
} from "@/lib/shop-categories";

// Two of these pieces are autumn-only, so the clock is pinned to October:
// without it the lists below would shrink on their own every December.
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-15T12:00:00-04:00"));
});
afterEach(() => {
  vi.useRealTimers();
});

const bySlug = (slug: string) => PRODUCTS.find((p) => p.slug === slug)!;
const slugs = (list: { slug: string }[]) => list.map((p) => p.slug).sort();

const CENTERPIECES = [
  "autumn-orchard",
  "autumns-cornucopia",
  "evergreen-horizon",
  "eye-candy",
  "falling-leaves",
  "garden-party",
  "natures-cornucopia",
  "neon-tropic",
];

describe("exotic category", () => {
  it.each(["abundant-table", "autumn-orchard"])("now lists %s", (slug) => {
    expect(slugs(productsInShopCategory(PRODUCTS, "exotic"))).toContain(slug);
  });

  it("only names products that exist and are on sale", () => {
    for (const slug of EXOTIC_SLUGS_FOR_TEST) {
      expect(bySlug(slug)?.active, slug).toBe(true);
    }
  });
});

describe("centerpieces category", () => {
  it("lists exactly the eight pieces Maky marked as centerpieces", () => {
    expect(slugs(productsInShopCategory(PRODUCTS, "centerpieces"))).toEqual(CENTERPIECES);
  });

  it("leaves out a piece nobody marked", () => {
    expect(isCenterpieceProduct(bySlug("flower-pop"))).toBe(false);
  });

  it("only names products that exist and are on sale", () => {
    expect([...CENTERPIECE_SLUGS_FOR_TEST].sort()).toEqual(CENTERPIECES);
    for (const slug of CENTERPIECE_SLUGS_FOR_TEST) {
      expect(bySlug(slug)?.active, slug).toBe(true);
    }
  });

  it("hides an autumn-only centerpiece once its season is over", () => {
    vi.setSystemTime(new Date("2027-01-15T12:00:00-05:00"));
    expect(slugs(productsInShopCategory(PRODUCTS, "centerpieces"))).not.toContain(
      "natures-cornucopia",
    );
  });

  it("keeps every piece in its own category as well", () => {
    expect(slugs(productsInShopCategory(PRODUCTS, "arrangements"))).toContain("garden-party");
  });

  it("has a menu tile with a real photo and a name in both languages", () => {
    const tile = CATS.find((c) => c.slug === "centerpieces");
    expect(tile).toBeDefined();
    expect(existsSync(join(process.cwd(), "public", tile!.img))).toBe(true);
    expect(LABELS.centerpieces).toEqual({ en: "Centerpieces", es: "Centros de mesa" });
  });

  it("is in the sitemap in both languages", () => {
    const urls = sitemap().map((e) => e.url);
    expect(urls.some((u) => u.endsWith("/en/shop/centerpieces"))).toBe(true);
    expect(urls.some((u) => u.endsWith("/es/shop/centerpieces"))).toBe(true);
  });
});
