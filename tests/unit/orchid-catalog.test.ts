import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { PRODUCTS } from "@/data/products";

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
