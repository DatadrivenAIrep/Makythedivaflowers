import { PRODUCTS } from "@/data/products";
import type { CartLine, Order } from "@/types/order";

export type ResolvedLine = {
  productId: string | null; // null for custom lines
  name: string;
  variantLabel: string | null;
  addOnLabels: string[];
  qty: number;
  thumb: string | null;
  customPriceCents: number | null;
};

export function resolveLine(line: CartLine): ResolvedLine {
  if (line.kind === "custom") {
    return {
      productId: null,
      name: line.title,
      variantLabel: null,
      addOnLabels: [],
      qty: line.qty,
      thumb: null,
      customPriceCents: line.priceCents,
    };
  }
  const product = PRODUCTS.find((p) => p.id === line.productId);
  const variant = product?.variants.find((v) => v.id === line.variantId);
  const addOnLabels = (line.addOnIds ?? [])
    .map((id) => product?.addOns?.find((a) => a.id === id)?.label.es ?? id)
    .filter(Boolean);
  return {
    productId: line.productId,
    name: product ? product.title.es : line.productId,
    variantLabel: variant ? variant.label.es : line.variantId,
    addOnLabels,
    qty: line.qty,
    thumb: product?.images[0]?.src ?? null,
    customPriceCents: null,
  };
}

export function resolveOrderLines(order: Order): ResolvedLine[] {
  return order.lines.map(resolveLine);
}

// Short headline for cards/rows, e.g. "Winter Moss + 1 más".
export function lineSummaryName(order: Order): string {
  if (order.lines.length === 0) return "—";
  const first = resolveLine(order.lines[0]);
  const suffix = order.lines.length > 1 ? ` + ${order.lines.length - 1} más` : "";
  return first.name + suffix;
}

export function firstThumb(order: Order): string | null {
  if (order.lines.length === 0) return null;
  return resolveLine(order.lines[0]).thumb;
}
