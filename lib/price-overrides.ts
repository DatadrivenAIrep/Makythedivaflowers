import type { Product } from "@/types/product";

export type PriceOverride = {
  productId: string;
  variantId: string;
  priceCents: number;
  updatedAt: string;
};

/**
 * Returns a new products array where each variant's priceCents is replaced
 * by its override when one exists. The original PRODUCTS array is NOT mutated.
 */
export function applyPriceOverrides(
  products: readonly Product[],
  overrides: readonly PriceOverride[],
): Product[] {
  if (overrides.length === 0) return products as Product[];
  const map = new Map(overrides.map((o) => [`${o.productId}::${o.variantId}`, o.priceCents]));
  return products.map((p) => {
    const patchedVariants = p.variants.map((v) => {
      const key = `${p.id}::${v.id}`;
      return map.has(key) ? { ...v, priceCents: map.get(key)! } : v;
    });
    const changed = patchedVariants.some((v, i) => v.priceCents !== p.variants[i].priceCents);
    return changed ? { ...p, variants: patchedVariants } : p;
  });
}
