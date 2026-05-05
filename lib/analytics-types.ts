import type { ResolvedCartLine } from "@/lib/cart-helpers";
export type { Occasion } from "@/types/product";

export type AnalyticsItem = {
  item_id: string;
  item_name: string;
  item_category: string;
  item_variant?: string;
  price: number;
  quantity: number;
  currency: "USD";
};

export type EngagementLocation =
  | "footer"
  | "header"
  | "pdp"
  | "contact"
  | "home"
  | "checkout"
  | "cart";

export function resolvedLineToAnalyticsItem(line: ResolvedCartLine): AnalyticsItem {
  return {
    item_id: line.product.id,
    item_name: line.product.title.en,
    item_category: line.product.category,
    item_variant: line.variant.label.en,
    price: centsToDollars(line.unitPriceCents),
    quantity: line.line.qty,
    currency: "USD",
  };
}

export function centsToDollars(cents: number): number {
  return Math.round(cents) / 100;
}
