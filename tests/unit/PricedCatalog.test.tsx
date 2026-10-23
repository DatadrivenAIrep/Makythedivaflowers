import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { PricedCatalogProvider, usePricedProducts } from "@/components/catalog/PricedCatalog";
import { PRODUCTS } from "@/data/products";
import { cartSubtotalCents } from "@/lib/cart-helpers";

const product = PRODUCTS.find((p) => p.active && !p.quoteOnly && p.variants.length > 0)!;
const variant = product.variants[0];
const line = { kind: "catalog" as const, productId: product.id, variantId: variant.id, addOnIds: [], qty: 2 };

describe("usePricedProducts", () => {
  it("returns base prices without a provider", () => {
    const { result } = renderHook(() => usePricedProducts());
    expect(cartSubtotalCents([line], result.current)).toBe(variant.priceCents * 2);
  });

  it("prices the bag with the admin override the checkout will charge", () => {
    const overrides = [{ productId: product.id, variantId: variant.id, priceCents: 1234, updatedAt: "2026-10-15T00:00:00Z" }];
    const wrapper = ({ children }: { children: ReactNode }) => (
      <PricedCatalogProvider overrides={overrides}>{children}</PricedCatalogProvider>
    );
    const { result } = renderHook(() => usePricedProducts(), { wrapper });
    expect(cartSubtotalCents([line], result.current)).toBe(2468);
  });
});
