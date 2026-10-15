import type { Product, ProductCategory } from "@/types/product";
import { isInSeason, productsByCategory } from "@/data/product-helpers";

export const CATS = [
  { slug: "arrangements", img: "/products/island-sunrise.jpg" },
  { slug: "bouquets", img: "/products/dozen-roses-bouquet.jpg" },
  { slug: "roses", img: "/products/hundred-roses.jpg" },
  { slug: "exotic", img: "/products/paradise-found.jpg" },
  { slug: "centerpieces", img: "/products/garden-party.jpg" },
  { slug: "plants", img: "/products/phalaenopsis-white-single.webp" },
  { slug: "gifts", img: "/products/daydream-parcel.jpg" },
  { slug: "subscriptions", img: "/products/blush-enchantment.jpg" },
] as const;

export type CatSlug = (typeof CATS)[number]["slug"];

// Sympathy and subscriptions have their own pages; their /shop/ URLs only redirect there.
const OWN_PAGE = new Set(["sympathy", "subscriptions"]);

export function shopCategoryHref(locale: string, slug: string): string {
  return OWN_PAGE.has(slug) ? `/${locale}/${slug}` : `/${locale}/shop/${slug}`;
}

export const LABELS: Record<CatSlug, { en: string; es: string }> = {
  arrangements: { en: "Arrangements", es: "Arreglos" },
  bouquets: { en: "Bouquets", es: "Ramos" },
  roses: { en: "Roses", es: "Rosas" },
  exotic: { en: "Exotic", es: "Exóticas" },
  centerpieces: { en: "Centerpieces", es: "Centros de mesa" },
  plants: { en: "Plants & Orchids", es: "Plantas y Orquídeas" },
  gifts: { en: "Gifts", es: "Regalos" },
  subscriptions: { en: "Subscriptions", es: "Suscripciones" },
};

export function isRoseProduct(p: Product): boolean {
  if (!p.active || p.giftExtra) return false;
  if (!isInSeason(p)) return false;
  if (p.category !== "bouquets" && p.category !== "arrangements") return false;
  if (p.slug.includes("rose")) return true;
  const onlyPink = p.colorFamily.length === 1 && p.colorFamily[0] === "pink";
  return p.colorFamily.includes("red") || onlyPink;
}

const EXOTIC_SLUGS = new Set([
  "carnival",
  "island-sunrise",
  "lavender-serenade",
  "lush-horizons",
  "jungle-whirl",
  "paradise-found",
  "sunlit-tropics",
  "tropic-thunder",
  "tropical-paradise",
  "rainforest-rhapsody",
  "abundant-table",
  "autumn-orchard",
  "crimson-zen",
  "fuchsia-tropics",
]);

// Exposed for tests: asserts that retired products don't linger in this set.
export const EXOTIC_SLUGS_FOR_TEST: ReadonlySet<string> = EXOTIC_SLUGS;

export function isExoticProduct(p: Product): boolean {
  if (!p.active || p.giftExtra) return false;
  if (!isInSeason(p)) return false;
  return EXOTIC_SLUGS.has(p.slug);
}

// Low, full pieces built for a table. Like the exotics, this is a curated list:
// every piece keeps its own category and is listed here as well.
const CENTERPIECE_SLUGS = new Set([
  "autumn-orchard",
  "autumns-cornucopia",
  "evergreen-horizon",
  "eye-candy",
  "falling-leaves",
  "garden-party",
  "natures-cornucopia",
  "neon-tropic",
  "coral-chalice",
  "mint-julep-trio",
  "long-table-romance",
  "tangerine-pop",
]);

export const CENTERPIECE_SLUGS_FOR_TEST: ReadonlySet<string> = CENTERPIECE_SLUGS;

export function isCenterpieceProduct(p: Product): boolean {
  if (!p.active || p.giftExtra) return false;
  if (!isInSeason(p)) return false;
  return CENTERPIECE_SLUGS.has(p.slug);
}

// The autumn collection the fall home hero links to: these named pieces plus
// anything Maky marks for Sep–Nov, so new harvest arrangements join on their own.
const FALL_SLUGS = new Set(["autumn-orchard", "autumns-cornucopia", "falling-leaves"]);
const FALL_MONTHS = [9, 10, 11];

export const FALL_SLUGS_FOR_TEST: ReadonlySet<string> = FALL_SLUGS;

export function isFallProduct(p: Product): boolean {
  if (!p.active || p.giftExtra) return false;
  if (!isInSeason(p)) return false;
  if (FALL_SLUGS.has(p.slug)) return true;
  const months = p.seasonMonths ?? [];
  return months.length > 0 && months.every((m) => FALL_MONTHS.includes(m));
}

export type ShopSlug = ProductCategory | "roses" | "exotic" | "centerpieces" | "fall";

/** What a shop page lists: four slugs are curated lists, the rest are real categories. */
export function productsInShopCategory(products: Product[], slug: ShopSlug): Product[] {
  if (slug === "roses") return products.filter(isRoseProduct);
  if (slug === "exotic") return products.filter(isExoticProduct);
  if (slug === "centerpieces") return products.filter(isCenterpieceProduct);
  if (slug === "fall") return products.filter(isFallProduct);
  return productsByCategory(products, slug);
}
