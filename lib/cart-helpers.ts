import type { Product, ProductAddOn, ProductVariant } from "@/types/product";
import type { CartLine } from "@/lib/cart-store";

export type ResolvedCartLine = {
  line: CartLine;
  product: Product;
  variant: ProductVariant;
  addOns: ProductAddOn[];
  unitPriceCents: number;
  lineTotalCents: number;
};

export function resolveCartLine(
  line: CartLine,
  products: readonly Product[],
): ResolvedCartLine | null {
  const product = products.find((p) => p.id === line.productId);
  if (!product) return null;
  const variant = product.variants.find((v) => v.id === line.variantId);
  if (!variant) return null;
  const addOns = (product.addOns ?? []).filter((a) => line.addOnIds.includes(a.id));
  const addOnTotal = addOns.reduce((s, a) => s + a.priceCents, 0);
  const unitPriceCents = variant.priceCents + addOnTotal;
  return {
    line,
    product,
    variant,
    addOns,
    unitPriceCents,
    lineTotalCents: unitPriceCents * line.qty,
  };
}

export function resolveCartLines(
  lines: readonly CartLine[],
  products: readonly Product[],
): ResolvedCartLine[] {
  return lines
    .map((l) => resolveCartLine(l, products))
    .filter((r): r is ResolvedCartLine => r !== null);
}

export function cartSubtotalCents(
  lines: readonly CartLine[],
  products: readonly Product[],
): number {
  return resolveCartLines(lines, products).reduce((s, r) => s + r.lineTotalCents, 0);
}

export function cartCount(lines: readonly CartLine[]): number {
  return lines.reduce((s, l) => s + l.qty, 0);
}
