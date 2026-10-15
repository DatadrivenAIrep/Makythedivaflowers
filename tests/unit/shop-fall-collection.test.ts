// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { PRODUCTS } from "@/data/products";
import type { Product } from "@/types/product";
import { productsInShopCategory, isFallProduct } from "@/lib/shop-categories";
import { generateMetadata, generateStaticParams } from "@/app/[locale]/shop/[category]/page";

// Most of the collection is marked Sep–Nov, so pin the clock inside autumn.
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-15T12:00:00-04:00"));
});
afterEach(() => {
  vi.useRealTimers();
});

const slugs = (list: { slug: string }[]) => list.map((p) => p.slug).sort();
const bySlug = (slug: string) => PRODUCTS.find((p) => p.slug === slug)!;

const FALL_COLLECTION = [
  "abundant-table",
  "autumn-orchard",
  "autumns-cornucopia",
  "falling-leaves",
  "natures-cornucopia",
  "painted-garden",
  "pumpkin-spice",
  "rustic-harvest",
  "tangerine-pop",
];

describe("fall collection", () => {
  it("lists the autumn pieces", () => {
    expect(slugs(productsInShopCategory(PRODUCTS, "fall"))).toEqual(FALL_COLLECTION);
  });

  it("picks up any product Maky marks for Sep–Nov", () => {
    const fresh: Product = { ...bySlug("pumpkin-spice"), slug: "brand-new-harvest", seasonMonths: [9, 10, 11] };
    expect(isFallProduct(fresh)).toBe(true);
  });

  it("leaves out holiday pieces and year-round flowers", () => {
    expect(isFallProduct(bySlug("santas-garden"))).toBe(false);
    expect(isFallProduct(bySlug("garden-party"))).toBe(false);
  });

  it("hides the Sep–Nov pieces once autumn is over", () => {
    vi.setSystemTime(new Date("2026-12-10T12:00:00-05:00"));
    expect(slugs(productsInShopCategory(PRODUCTS, "fall"))).not.toContain("pumpkin-spice");
  });
});

describe("fall collection page", () => {
  it("is built as a shop page", async () => {
    expect(await generateStaticParams()).toContainEqual({ category: "fall" });
  });

  it("is titled in both languages", async () => {
    const es = await generateMetadata({ params: Promise.resolve({ locale: "es", category: "fall" }) });
    const en = await generateMetadata({ params: Promise.resolve({ locale: "en", category: "fall" }) });
    expect(es.title).toBe("Colección de otoño — Diva Flowers");
    expect(en.title).toBe("Autumn Collection — Diva Flowers");
  });
});
