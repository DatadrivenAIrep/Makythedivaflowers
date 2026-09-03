import { describe, it, expect } from "vitest";
import { PRODUCTS } from "@/data/products";
import { filterProducts } from "@/data/product-helpers";
import { parseFilterParams } from "@/lib/search-params";
import { suggestExtrasForCart } from "@/data/gift-extras";
import { OCCASIONS_ALL, OCCASION_CONTENT } from "@/data/occasion-content";
import type { Filter } from "@/data/product-helpers";
import type { Occasion } from "@/types/product";

/**
 * An occasion is a promise: it appears in the menu, gets its own landing page,
 * and is offered as a filter. These guard the two ways that promise breaks —
 * an occasion with nothing to sell, and an occasion the URL layer silently
 * throws away.
 */
describe("occasion taxonomy", () => {
  it("every occasion has copy for the landing page", () => {
    for (const o of OCCASIONS_ALL) {
      const c = OCCASION_CONTENT[o];
      expect(c, `missing content for ${o}`).toBeTruthy();
      expect(c.label.en.length, `${o} label`).toBeGreaterThan(0);
      expect(c.label.es.length, `${o} label es`).toBeGreaterThan(0);
      expect(c.lead.en.length, `${o} lead`).toBeGreaterThan(40);
      expect(c.lead.es.length, `${o} lead es`).toBeGreaterThan(40);
    }
  });

  it("every occasion has enough live products to fill a page", () => {
    const thin = OCCASIONS_ALL.map((o) => ({
      occasion: o,
      count: filterProducts(PRODUCTS, { occasion: o } as Filter).length,
    })).filter((r) => r.count < 4);
    expect(thin, `occasions with fewer than 4 products: ${JSON.stringify(thin)}`).toEqual([]);
  });

  it("every occasion survives a round trip through the URL", () => {
    for (const o of OCCASIONS_ALL) {
      expect(parseFilterParams({ occasion: o }).filter.occasion, `${o} was dropped`).toBe(o);
    }
  });

  it("every occasion suggests gift extras in the cart", () => {
    for (const o of OCCASIONS_ALL) {
      const product = PRODUCTS.find((p) => p.active && !p.giftExtra && p.occasions.includes(o));
      expect(product, `no product for ${o}`).toBeTruthy();
      const extras = suggestExtrasForCart(
        [
          {
            kind: "catalog",
            productId: product!.id,
            variantId: product!.variants[0].id,
            addOnIds: [],
            qty: 1,
          },
        ],
        PRODUCTS,
      );
      expect(extras.length, `no extras suggested for ${o}`).toBeGreaterThan(0);
    }
  });

  it("sympathy never suggests a celebratory extra", () => {
    const sympathy = PRODUCTS.find(
      (p) => p.active && p.occasions.length === 1 && p.occasions[0] === "sympathy",
    );
    expect(sympathy).toBeTruthy();
    const extras = suggestExtrasForCart(
      [
        {
          kind: "catalog",
          productId: sympathy!.id,
          variantId: sympathy!.variants[0].id,
          addOnIds: [],
          qty: 1,
        },
      ],
      PRODUCTS,
    );
    expect(extras).not.toContain("x-chocolates-mini");
  });

  it("the product union and the content map describe the same set", () => {
    const used = new Set<Occasion>();
    for (const p of PRODUCTS) for (const o of p.occasions) used.add(o);
    for (const o of used) {
      expect(OCCASIONS_ALL, `${o} is tagged on a product but has no content`).toContain(o);
    }
  });
});
