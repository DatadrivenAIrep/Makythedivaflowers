import "server-only";
import { getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import type { Product } from "@/types/product";

export type PriceOverride = {
  productId: string;
  variantId: string;
  priceCents: number;
  updatedAt: string;
};

type OverrideRow = {
  product_id: string;
  variant_id: string;
  price_cents: number;
  updated_at: string;
};

export function getAllPriceOverrides(): PriceOverride[] {
  runMigrations();
  return (getDb().prepare("SELECT * FROM product_price_overrides").all() as OverrideRow[]).map(
    (r) => ({
      productId: r.product_id,
      variantId: r.variant_id,
      priceCents: r.price_cents,
      updatedAt: r.updated_at,
    }),
  );
}

export function setPriceOverride(productId: string, variantId: string, priceCents: number): void {
  runMigrations();
  getDb()
    .prepare(
      `INSERT INTO product_price_overrides (product_id, variant_id, price_cents, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(product_id, variant_id) DO UPDATE
         SET price_cents = excluded.price_cents, updated_at = excluded.updated_at`,
    )
    .run(productId, variantId, priceCents, new Date().toISOString());
}

export function deletePriceOverride(productId: string, variantId: string): void {
  getDb()
    .prepare("DELETE FROM product_price_overrides WHERE product_id = ? AND variant_id = ?")
    .run(productId, variantId);
}

/**
 * Returns a new products array where each variant's priceCents is replaced
 * by its override when one exists. The original PRODUCTS array is NOT mutated.
 */
export function applyPriceOverrides(
  products: readonly Product[],
  overrides: PriceOverride[],
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
