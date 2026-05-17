import { describe, it, expect } from "vitest";
import {
  resolveCartLine,
  resolveCartLines,
  cartSubtotalCents,
  cartCount,
} from "@/lib/cart-helpers";
import type { Product } from "@/types/product";
import type { CartLine } from "@/lib/cart-store";

const products: Product[] = [
  {
    id: "p1",
    slug: "rose-noir",
    title: { en: "Rose Noir", es: "Rosa Noir" },
    category: "arrangements",
    blurb: { en: "", es: "" },
    description: { en: "", es: "" },
    images: [{ src: "/x.jpg", alt: { en: "", es: "" }, aspect: "4/5" }],
    variants: [
      { id: "std", label: { en: "Standard", es: "Estándar" }, priceCents: 18700 },
      { id: "grand", label: { en: "Grand", es: "Grande" }, priceCents: 26400 },
    ],
    addOns: [
      { id: "vase", label: { en: "Vase upgrade", es: "Florero" }, priceCents: 3500 },
    ],
    tags: [],
    occasions: [],
    colorFamily: [],
    active: true,
    seo: {
      title: { en: "", es: "" },
      description: { en: "", es: "" },
    },
  },
];

describe("resolveCartLine", () => {
  it("returns null when product or variant missing", () => {
    expect(resolveCartLine({ kind: "catalog", productId: "missing", variantId: "std", addOnIds: [], qty: 1 }, products)).toBeNull();
    expect(resolveCartLine({ kind: "catalog", productId: "p1", variantId: "missing", addOnIds: [], qty: 1 }, products)).toBeNull();
  });

  it("returns null for custom lines (not catalog)", () => {
    expect(resolveCartLine({ kind: "custom", title: "Custom", priceCents: 5000, qty: 1 }, products)).toBeNull();
  });

  it("computes line total from variant + add-ons × qty", () => {
    const line: CartLine = { kind: "catalog", productId: "p1", variantId: "grand", addOnIds: ["vase"], qty: 2 };
    const r = resolveCartLine(line, products);
    expect(r).not.toBeNull();
    expect(r!.product.id).toBe("p1");
    expect(r!.variant.id).toBe("grand");
    expect(r!.addOns).toHaveLength(1);
    expect(r!.unitPriceCents).toBe(26400 + 3500);
    expect(r!.lineTotalCents).toBe((26400 + 3500) * 2);
  });
});

describe("resolveCartLines", () => {
  it("filters out unresolvable lines", () => {
    const lines: CartLine[] = [
      { kind: "catalog", productId: "p1", variantId: "std", addOnIds: [], qty: 1 },
      { kind: "catalog", productId: "missing", variantId: "x", addOnIds: [], qty: 1 },
    ];
    const r = resolveCartLines(lines, products);
    expect(r).toHaveLength(1);
  });

  it("filters out custom lines (not catalog)", () => {
    const lines: CartLine[] = [
      { kind: "catalog", productId: "p1", variantId: "std", addOnIds: [], qty: 1 },
      { kind: "custom", title: "Custom", priceCents: 5000, qty: 1 },
    ];
    const r = resolveCartLines(lines, products);
    expect(r).toHaveLength(1);
  });
});

describe("cartSubtotalCents", () => {
  it("sums line totals, ignoring missing products", () => {
    const lines: CartLine[] = [
      { kind: "catalog", productId: "p1", variantId: "std", addOnIds: [], qty: 1 },
      { kind: "catalog", productId: "p1", variantId: "grand", addOnIds: ["vase"], qty: 2 },
    ];
    expect(cartSubtotalCents(lines, products)).toBe(18700 + (26400 + 3500) * 2);
  });

  it("includes custom line prices in subtotal", () => {
    const lines: CartLine[] = [
      { kind: "catalog", productId: "p1", variantId: "std", addOnIds: [], qty: 1 },
      { kind: "custom", title: "Custom bouquet", priceCents: 5000, qty: 2 },
    ];
    expect(cartSubtotalCents(lines, products)).toBe(18700 + 5000 * 2);
  });
});

describe("cartCount", () => {
  it("sums qty across lines", () => {
    expect(cartCount([
      { kind: "catalog", productId: "p1", variantId: "std", addOnIds: [], qty: 2 },
      { kind: "catalog", productId: "p1", variantId: "grand", addOnIds: [], qty: 3 },
    ])).toBe(5);
  });
});
