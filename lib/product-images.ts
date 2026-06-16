import "server-only";
import { getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import type { Product } from "@/types/product";

export type ImageOverride = {
  productId: string;
  src: string;
  updatedAt: string;
};

type Row = { product_id: string; src: string; updated_at: string };

export function getAllImageOverrides(): ImageOverride[] {
  runMigrations();
  return (getDb().prepare("SELECT * FROM product_image_overrides").all() as Row[]).map((r) => ({
    productId: r.product_id,
    src: r.src,
    updatedAt: r.updated_at,
  }));
}

export function setImageOverride(productId: string, src: string): void {
  runMigrations();
  getDb()
    .prepare(
      `INSERT INTO product_image_overrides (product_id, src, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(product_id) DO UPDATE
         SET src = excluded.src, updated_at = excluded.updated_at`,
    )
    .run(productId, src, new Date().toISOString());
}

export function deleteImageOverride(productId: string): void {
  getDb().prepare("DELETE FROM product_image_overrides WHERE product_id = ?").run(productId);
}

export function applyImageOverrides(
  products: readonly Product[],
  overrides: ImageOverride[],
): Product[] {
  if (overrides.length === 0) return products as Product[];
  const map = new Map(overrides.map((o) => [o.productId, o.src]));
  return products.map((p) => {
    const src = map.get(p.id);
    if (!src) return p;
    const images = p.images.map((img, i) => (i === 0 ? { ...img, src } : img));
    return { ...p, images };
  });
}
