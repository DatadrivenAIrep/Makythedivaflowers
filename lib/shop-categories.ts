import type { Product } from "@/types/product";
import { isInSeason } from "@/data/product-helpers";

export const CATS = [
  { slug: "arrangements", img: "/products/flamingo-garden.jpg" },
  { slug: "bouquets", img: "/products/dozen-roses-bouquet.jpg" },
  { slug: "roses", img: "/products/hundred-roses-vase.png" },
  { slug: "exotic", img: "/products/paradise-found.jpg" },
  { slug: "plants", img: "/products/opal-orchid.jpg" },
  { slug: "gifts", img: "/products/daydream-parcel.jpg" },
  { slug: "subscriptions", img: "/products/timeless-romance.jpg" },
] as const;

export type CatSlug = (typeof CATS)[number]["slug"];

export const LABELS: Record<CatSlug, { en: string; es: string }> = {
  arrangements: { en: "Arrangements", es: "Arreglos" },
  bouquets: { en: "Bouquets", es: "Ramos" },
  roses: { en: "Roses", es: "Rosas" },
  exotic: { en: "Exotic", es: "Exóticas" },
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
  "cattleya-orchid",
  "lush-horizons",
  "jungle-whirl",
  "paradise-found",
  "sunlit-tropics",
  "tropic-thunder",
  "tropical-paradise",
  "rainforest-rhapsody",
]);

export function isExoticProduct(p: Product): boolean {
  if (!p.active || p.giftExtra) return false;
  if (!isInSeason(p)) return false;
  return EXOTIC_SLUGS.has(p.slug);
}
