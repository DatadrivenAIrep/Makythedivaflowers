import type { Localized, Product, ProductVariant } from "@/types/product";

/**
 * Side of the square container, in inches, for the three arrangement sizes.
 *
 * The workshop builds every Standard / Grand / Diva arrangement on these bases,
 * so the size is stated once here rather than on each of the products. It is
 * the container that is measured, not the finished piece.
 */
const BASE_INCHES: Record<string, number> = { standard: 5, grand: 6, diva: 8 };
const SIZE_IDS = Object.keys(BASE_INCHES);

type VariantRef = Pick<ProductVariant, "id">;

/**
 * Inches of the base a variant is built on, or null when it has no fixed base:
 * hand-tied bouquets, baskets, plants, single-size pieces and the first-batch
 * size names all fall outside the three-size ladder.
 */
export function baseInches(product: Product, variant: VariantRef): number | null {
  if (product.category !== "arrangements") return null;
  const ids = product.variants.map((v) => v.id);
  const isLadder = ids.length === SIZE_IDS.length && SIZE_IDS.every((id, i) => ids[i] === id);
  if (!isLadder) return null;
  return BASE_INCHES[variant.id] ?? null;
}

/** For the shopper, under the size they are choosing. */
export function baseSizeLabel(product: Product, variant: VariantRef): Localized | null {
  const n = baseInches(product, variant);
  if (n === null) return null;
  return { en: `${n}″ × ${n}″ base`, es: `Base de ${n}″ × ${n}″` };
}

/** For the work sheet, where space is tight. */
export function baseSizeShort(product: Product, variant: VariantRef): string | null {
  const n = baseInches(product, variant);
  return n === null ? null : `${n}×${n}`;
}
