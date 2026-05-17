import type { Product, ProductAddOn, ProductVariant } from "@/types/product";
import type { CartLine, CatalogCartLine } from "@/types/order";

export type ResolvedCartLine = {
  line: CatalogCartLine;
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
  if (line.kind !== "catalog") return null;
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
  return lines.reduce((sum, line) => {
    if (line.kind === "custom") {
      return sum + line.priceCents * line.qty;
    }
    const resolved = resolveCartLine(line, products);
    return sum + (resolved ? resolved.lineTotalCents : 0);
  }, 0);
}

export function cartCount(lines: readonly CartLine[]): number {
  return lines.reduce((s, l) => s + l.qty, 0);
}
