import { describe, it, expect } from "vitest";
import { addOnsForProduct, UNIVERSAL_ADD_ON_IDS } from "@/lib/product-add-ons";
import { resolveCartLine, cartSubtotalCents } from "@/lib/cart-helpers";
import { PRODUCTS } from "@/data/products";
import type { Product } from "@/types/product";

const find = (slug: string): Product => {
  const p = PRODUCTS.find((x) => x.slug === slug);
  if (!p) throw new Error(`fixture product missing: ${slug}`);
  return p;
};

describe("addOnsForProduct", () => {
  it("offers the universal extras on an ordinary bouquet", () => {
    const ids = addOnsForProduct(find("velvet-sun")).map((a) => a.id);
    expect(ids).toEqual(expect.arrayContaining([...UNIVERSAL_ADD_ON_IDS]));
  });

  it("keeps a product's own add-ons alongside the universal ones", () => {
    // Champagne is specific to this piece and must survive.
    const withChampagne = PRODUCTS.find((p) => p.addOns?.some((a) => a.id === "champagne"));
    expect(withChampagne).toBeTruthy();
    const ids = addOnsForProduct(withChampagne!).map((a) => a.id);
    expect(ids).toContain("champagne");
    expect(ids).toContain("x-card-premium");
  });

  it("offers a sympathy piece the card but not chocolates or ribbon", () => {
    const ids = addOnsForProduct(find("celestial-peace")).map((a) => a.id);
    expect(ids).toContain("x-card-premium");
    expect(ids).not.toContain("x-chocolates-mini");
    expect(ids).not.toContain("x-ribbon-silk");
  });

  it("does not offer add-ons on an add-on", () => {
    expect(addOnsForProduct(find("premium-card"))).toEqual([]);
  });

  it("prices each universal extra from the gift-extra product, not a copy", () => {
    const chocolates = PRODUCTS.find((p) => p.id === "x-chocolates-mini")!;
    const offered = addOnsForProduct(find("velvet-sun")).find((a) => a.id === "x-chocolates-mini");
    expect(offered!.priceCents).toBe(chocolates.variants[0].priceCents);
  });

  it("never offers the same add-on twice", () => {
    for (const p of PRODUCTS) {
      const ids = addOnsForProduct(p).map((a) => a.id);
      expect(new Set(ids).size, `${p.slug} has duplicate add-ons`).toBe(ids.length);
    }
  });
});

describe("cart pricing with universal add-ons", () => {
  const product = () => find("velvet-sun");

  it("charges the extra on the line total", () => {
    const p = product();
    const chocolates = PRODUCTS.find((x) => x.id === "x-chocolates-mini")!.variants[0].priceCents;
    const resolved = resolveCartLine(
      { kind: "catalog", productId: p.id, variantId: p.variants[0].id, addOnIds: ["x-chocolates-mini"], qty: 1 },
      PRODUCTS,
    );
    expect(resolved!.unitPriceCents).toBe(p.variants[0].priceCents + chocolates);
  });

  it("multiplies the extra by the quantity", () => {
    const p = product();
    const chocolates = PRODUCTS.find((x) => x.id === "x-chocolates-mini")!.variants[0].priceCents;
    const resolved = resolveCartLine(
      { kind: "catalog", productId: p.id, variantId: p.variants[0].id, addOnIds: ["x-chocolates-mini"], qty: 3 },
      PRODUCTS,
    );
    expect(resolved!.lineTotalCents).toBe((p.variants[0].priceCents + chocolates) * 3);
  });

  it("reaches the subtotal the server charges", () => {
    // resolveCartLine is the one place add-ons are priced, so what the cart
    // shows and what checkout charges cannot drift apart.
    const p = product();
    const card = PRODUCTS.find((x) => x.id === "x-card-premium")!.variants[0].priceCents;
    const subtotal = cartSubtotalCents(
      [{ kind: "catalog", productId: p.id, variantId: p.variants[0].id, addOnIds: ["x-card-premium"], qty: 1 }],
      PRODUCTS,
    );
    expect(subtotal).toBe(p.variants[0].priceCents + card);
  });

  it("ignores an extra that product is not offered", () => {
    // A tampered cart asking for chocolates on a funeral spray must not be
    // charged for them, and must not receive them.
    const sympathy = find("celestial-peace");
    const resolved = resolveCartLine(
      {
        kind: "catalog",
        productId: sympathy.id,
        variantId: sympathy.variants[0].id,
        addOnIds: ["x-chocolates-mini"],
        qty: 1,
      },
      PRODUCTS,
    );
    expect(resolved!.addOns).toEqual([]);
    expect(resolved!.unitPriceCents).toBe(sympathy.variants[0].priceCents);
  });
});
