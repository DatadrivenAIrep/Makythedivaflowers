import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { PRODUCTS } from "@/data/products";
import { fitInStage, productImageDims } from "@/lib/product-image-dims";

describe("productImageDims", () => {
  it("knows the size of every catalog photo that exists on disk", () => {
    const missing: string[] = [];
    for (const product of PRODUCTS) {
      for (const image of product.images) {
        if (!image.src.startsWith("/products/")) continue;
        if (!existsSync(join(process.cwd(), "public", image.src))) continue;
        if (!productImageDims(image.src)) missing.push(image.src);
      }
    }
    expect(missing, "run `npm run images:dims` after adding or replacing photos").toEqual([]);
  });

  it("returns null for a photo that was never measured", () => {
    expect(productImageDims("/products/does-not-exist.jpg")).toBeNull();
  });

  it("reports positive integer pixel sizes", () => {
    const measured = PRODUCTS.flatMap((p) => p.images).find((i) => productImageDims(i.src));
    expect(measured).toBeDefined();
    const dims = productImageDims(measured!.src)!;
    expect(Number.isInteger(dims.width) && dims.width > 0).toBe(true);
    expect(Number.isInteger(dims.height) && dims.height > 0).toBe(true);
  });
});

describe("fitInStage", () => {
  const stage = 3 / 4;

  it("spans the full height for a photo taller than the stage", () => {
    expect(fitInStage({ width: 1000, height: 2000 }, stage)).toEqual({ widthPct: 66.67, heightPct: 100 });
  });

  it("spans the full width for a photo wider than the stage", () => {
    expect(fitInStage({ width: 1200, height: 900 }, stage)).toEqual({ widthPct: 100, heightPct: 56.25 });
  });

  it("fills the stage exactly when the photo has the stage's ratio", () => {
    expect(fitInStage({ width: 1800, height: 2400 }, stage)).toEqual({ widthPct: 100, heightPct: 100 });
  });

  it("falls back to the full stage for degenerate sizes", () => {
    expect(fitInStage({ width: 0, height: 0 }, stage)).toEqual({ widthPct: 100, heightPct: 100 });
  });
});
