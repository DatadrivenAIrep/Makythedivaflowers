import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { PRODUCTS } from "@/data/products";
import { buildMerchantFeed } from "@/lib/merchant-feed";
import { CATS, EXOTIC_SLUGS_FOR_TEST } from "@/lib/shop-categories";

const orchid = () => PRODUCTS.find((p) => p.slug === "phalaenopsis-orchid");

describe("phalaenopsis-orchid", () => {
  it("exists, is active, and lives in the plants category", () => {
    const p = orchid();
    expect(p).toBeDefined();
    expect(p!.active).toBe(true);
    expect(p!.category).toBe("plants");
  });

  it("has exactly two variants at $65 and $85 pre-tax", () => {
    const p = orchid()!;
    expect(p.variants.map((v) => v.priceCents)).toEqual([6500, 8500]);
    expect(p.variants.map((v) => v.id)).toEqual(["single", "double"]);
  });

  it("is flagged for same-day delivery", () => {
    expect(orchid()!.tags).toContain("same-day");
  });

  it("carries the four real photos, white-single first", () => {
    const srcs = orchid()!.images.map((i) => i.src);
    expect(srcs).toEqual([
      "/products/phalaenopsis-white-single.webp",
      "/products/phalaenopsis-pink-single.webp",
      "/products/phalaenopsis-pink-double.webp",
      "/products/phalaenopsis-fuchsia-double.webp",
    ]);
  });

  it("every photo it references exists on disk", () => {
    for (const img of orchid()!.images) {
      expect(existsSync(join(process.cwd(), "public", img.src))).toBe(true);
    }
  });
});

describe("mislabeled orchid entries are retired", () => {
  for (const slug of ["cattleya-orchid", "opal-orchid"]) {
    it(`${slug} is inactive`, () => {
      const p = PRODUCTS.find((x) => x.slug === slug);
      expect(p, `${slug} should still exist in the catalog`).toBeDefined();
      expect(p!.active).toBe(false);
    });
  }

  it("neither appears in the Google Merchant feed", () => {
    const feed = buildMerchantFeed(PRODUCTS, "https://makythedivaflowers.com");
    expect(feed).not.toContain("cattleya-orchid");
    expect(feed).not.toContain("opal-orchid");
  });

  it("the real orchid does appear in the feed", () => {
    const feed = buildMerchantFeed(PRODUCTS, "https://makythedivaflowers.com");
    expect(feed).toContain("phalaenopsis-orchid");
  });

  it("cattleya-orchid is no longer listed as an exotic", () => {
    expect(EXOTIC_SLUGS_FOR_TEST.has("cattleya-orchid")).toBe(false);
  });

  it("the plants category tile uses a real orchid photo", () => {
    const plants = CATS.find((c) => c.slug === "plants")!;
    expect(plants.img).toBe("/products/phalaenopsis-white-single.webp");
    expect(existsSync(join(process.cwd(), "public", plants.img))).toBe(true);
  });
});
