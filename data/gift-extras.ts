// data/gift-extras.ts
import type { CartLine } from "@/lib/cart-store";
import type { Occasion, Product } from "@/types/product";

export const GIFT_EXTRA_IDS = [
  "x-card-premium",
  "x-vase-upgrade",
  "x-ribbon-silk",
  "x-chocolates-mini",
] as const;

export type GiftExtraId = (typeof GIFT_EXTRA_IDS)[number];

const PRIORITY_BY_OCCASION: Record<Occasion, GiftExtraId[]> = {
  romance:        ["x-card-premium", "x-chocolates-mini", "x-vase-upgrade"],
  anniversary:    ["x-card-premium", "x-chocolates-mini", "x-vase-upgrade"],
  birthday:       ["x-chocolates-mini", "x-card-premium", "x-vase-upgrade"],
  sympathy:       ["x-card-premium", "x-vase-upgrade"],
  congrats:       ["x-card-premium", "x-chocolates-mini", "x-ribbon-silk"],
  "just-because": ["x-card-premium", "x-vase-upgrade", "x-chocolates-mini"],
  "mothers-day":  ["x-card-premium", "x-chocolates-mini", "x-vase-upgrade"],
};

export function suggestExtrasForCart(
  lines: CartLine[],
  allProducts: Product[],
): GiftExtraId[] {
  const catalogLines = lines.filter((l) => l.kind === "catalog");
  const inCart = new Set(catalogLines.map((l) => l.productId));
  const productOccasions = catalogLines
    .map((l) => allProducts.find((p) => p.id === l.productId))
    .filter((p): p is Product => Boolean(p))
    .flatMap((p) => p.occasions);

  if (productOccasions.length === 0) return [];

  const isSympathyOnly = productOccasions.every((o) => o === "sympathy");
  const occasionsToUse: Occasion[] = isSympathyOnly
    ? ["sympathy"]
    : productOccasions.filter((o) => o !== "sympathy");

  const seen = new Set<GiftExtraId>();
  const ordered: GiftExtraId[] = [];
  for (const occ of occasionsToUse) {
    for (const extra of PRIORITY_BY_OCCASION[occ] ?? []) {
      if (!seen.has(extra) && !inCart.has(extra)) {
        seen.add(extra);
        ordered.push(extra);
        if (ordered.length === 3) return ordered;
      }
    }
  }
  return ordered;
}
