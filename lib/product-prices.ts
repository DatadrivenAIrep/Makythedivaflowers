import "server-only";
import { getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import type { Product } from "@/types/product";
import { PRODUCTS } from "@/data/products";
import { applyPriceOverrides, type PriceOverride } from "@/lib/price-overrides";

// The pure half lives in lib/price-overrides so client components can use it.
export { applyPriceOverrides, type PriceOverride };

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
 * The catalog with every admin price override applied: what a product costs
 * right now. Falls back to base prices if the overrides can't be read, so a
 * receipt, SMS or print job never fails over a price display.
 */
export function getPricedProducts(): Product[] {
  try {
    return applyPriceOverrides(PRODUCTS, getAllPriceOverrides());
  } catch (err) {
    console.error("[product-prices] overrides unavailable, using base prices", err);
    return PRODUCTS;
  }
}
