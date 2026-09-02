import type { Product, ProductAddOn } from "@/types/product";
import { PRODUCTS } from "@/data/products";

/**
 * The add-ons offered on a product: its own, plus the four studio extras that
 * belong on almost anything.
 *
 * Every competitor in the benchmark puts a card, a vase or a small treat one tap
 * from the buy button; this site had them on 17 of 96 products. Rather than copy
 * the extras onto every product, they are derived here from the gift-extra
 * products themselves, so a price is edited in exactly one place.
 *
 * This is the single source used by both the product page and `resolveCartLine`,
 * which is what stops the price shown from drifting from the price charged: the
 * cart, the checkout intent, the webhook and the printed worksheet all resolve
 * lines through the same list.
 */

/** Gift-extra product ids, in the order they should read on the page. */
export const UNIVERSAL_ADD_ON_IDS = [
  "x-card-premium",
  "x-vase-upgrade",
  "x-ribbon-silk",
  "x-chocolates-mini",
] as const;

export type UniversalAddOnId = (typeof UNIVERSAL_ADD_ON_IDS)[number];

/**
 * A funeral piece takes a handwritten card; it does not take chocolates, a
 * ribbon or a vase upgrade. Offering them would be tone-deaf at exactly the
 * moment it matters most.
 */
const SYMPATHY_ALLOWED = new Set<UniversalAddOnId>(["x-card-premium"]);

function isSympathy(product: Product): boolean {
  return (
    product.category === "sympathy" ||
    (product.occasions.length > 0 && product.occasions.every((o) => o === "sympathy"))
  );
}

function universalAddOn(id: UniversalAddOnId): ProductAddOn | null {
  const extra = PRODUCTS.find((p) => p.id === id);
  const variant = extra?.variants[0];
  if (!extra || !variant) return null;
  return { id, label: extra.title, priceCents: variant.priceCents };
}

export function addOnsForProduct(product: Product): ProductAddOn[] {
  // An extra cannot carry extras of its own.
  if (product.giftExtra) return [];

  const own = product.addOns ?? [];
  const ownIds = new Set(own.map((a) => a.id));
  const sympathy = isSympathy(product);

  const universal = UNIVERSAL_ADD_ON_IDS.filter(
    (id) => !ownIds.has(id) && (!sympathy || SYMPATHY_ALLOWED.has(id)),
  )
    .map(universalAddOn)
    .filter((a): a is ProductAddOn => a !== null);

  return [...own, ...universal];
}
