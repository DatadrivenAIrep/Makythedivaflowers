// tests/unit/conversion/gift-extras.test.ts
import { describe, it, expect } from "vitest";
import { suggestExtrasForCart, GIFT_EXTRA_IDS } from "@/data/gift-extras";
import type { Product } from "@/types/product";
import type { CartLine } from "@/lib/cart-store";

const fakeProducts: Product[] = [
  { id: "rom1", slug: "rom1", title: { en: "", es: "" }, category: "arrangements",
    blurb: { en: "", es: "" }, description: { en: "", es: "" }, images: [], variants: [],
    tags: [], occasions: ["romance"], colorFamily: ["red"], active: true,
    seo: { title: { en: "", es: "" }, description: { en: "", es: "" } } },
  { id: "sym1", slug: "sym1", title: { en: "", es: "" }, category: "sympathy",
    blurb: { en: "", es: "" }, description: { en: "", es: "" }, images: [], variants: [],
    tags: [], occasions: ["sympathy"], colorFamily: ["white"], active: true,
    seo: { title: { en: "", es: "" }, description: { en: "", es: "" } } },
];

describe("suggestExtrasForCart", () => {
  it("suggests card, chocolates, vase for romance cart", () => {
    const result = suggestExtrasForCart(
      [{ kind: "catalog", productId: "rom1", variantId: "lush", addOnIds: [], qty: 1 }],
      fakeProducts,
    );
    expect(result.slice(0, 3)).toEqual(["x-card-premium", "x-chocolates-mini", "x-vase-upgrade"]);
  });

  it("suggests only card and vase for sympathy-only cart (no chocolates, no ribbon)", () => {
    const result = suggestExtrasForCart(
      [{ kind: "catalog", productId: "sym1", variantId: "lush", addOnIds: [], qty: 1 }],
      fakeProducts,
    );
    expect(result).toEqual(["x-card-premium", "x-vase-upgrade"]);
    expect(result).not.toContain("x-chocolates-mini");
    expect(result).not.toContain("x-ribbon-silk");
  });

  it("excludes extras already in cart", () => {
    const result = suggestExtrasForCart(
      [
        { kind: "catalog", productId: "rom1", variantId: "lush", addOnIds: [], qty: 1 },
        { kind: "catalog", productId: "x-card-premium", variantId: "default", addOnIds: [], qty: 1 },
      ],
      fakeProducts,
    );
    expect(result).not.toContain("x-card-premium");
    expect(result.length).toBeGreaterThan(0);
  });

  it("returns empty array when all extras are in cart", () => {
    const lines: CartLine[] = GIFT_EXTRA_IDS.map((id) => ({ kind: "catalog" as const, productId: id, variantId: "default", addOnIds: [], qty: 1 }));
    lines.push({ kind: "catalog", productId: "rom1", variantId: "lush", addOnIds: [], qty: 1 });
    expect(suggestExtrasForCart(lines, fakeProducts)).toEqual([]);
  });

  it("caps suggestions at 3", () => {
    const result = suggestExtrasForCart(
      [{ kind: "catalog", productId: "rom1", variantId: "lush", addOnIds: [], qty: 1 }],
      fakeProducts,
    );
    expect(result.length).toBeLessThanOrEqual(3);
  });

  it("returns empty array for an empty cart", () => {
    expect(suggestExtrasForCart([], fakeProducts)).toEqual([]);
  });

  it("uses non-sympathy priority when cart is mixed", () => {
    const result = suggestExtrasForCart(
      [
        { kind: "catalog", productId: "rom1", variantId: "lush", addOnIds: [], qty: 1 },
        { kind: "catalog", productId: "sym1", variantId: "lush", addOnIds: [], qty: 1 },
      ],
      fakeProducts,
    );
    // Mixed cart: non-sympathy logic applies → can include chocolates
    expect(result).toContain("x-chocolates-mini");
  });
});
