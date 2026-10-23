import type {
  Product,
  ProductCategory,
  Occasion,
  ColorFamily,
} from "@/types/product";

// Bands are cut against the live catalog (starting prices run ~$65–$345,
// median ~$125), so each one actually holds products. The previous
// 200/300 split put nearly the whole shop in a single band.
export type PriceBand = "under-100" | "100-150" | "150-200" | "200-plus";
export type Sort = "recommended" | "newest" | "price-asc" | "price-desc";

export type Filter = {
  occasion?: Occasion;
  color?: ColorFamily;
  size?: "standard" | "grand" | "diva";
  price?: PriceBand;
  sameDay?: boolean;
  q?: string;
};

function matchesQuery(p: Product, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  const haystack = [
    p.title.en,
    p.title.es,
    p.blurb.en,
    p.blurb.es,
    p.tags.join(" "),
    p.occasions.join(" "),
    p.colorFamily.join(" "),
    p.category,
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(needle);
}

export function startingPriceCents(p: Product): number {
  if (p.variants.length === 0) return 0;
  return p.variants.reduce((min, v) => (v.priceCents < min ? v.priceCents : min), p.variants[0].priceCents);
}

export function isInSeason(p: Product, date: Date = new Date()): boolean {
  if (p.category === "sympathy") return true;
  if (!p.seasonMonths || p.seasonMonths.length === 0) return true;
  return p.seasonMonths.includes(date.getMonth() + 1);
}

export function isAvailableNow(p: Product, date: Date = new Date()): boolean {
  return p.active && !p.giftExtra && isInSeason(p, date);
}

// Most pieces size as standard/grand/diva; a few use standard/lush/opulent for
// the same three tiers, so the size filter has to know both names.
const SIZE_VARIANT_IDS: Record<NonNullable<Filter["size"]>, readonly string[]> = {
  standard: ["standard"],
  grand: ["grand", "lush"],
  diva: ["diva", "opulent"],
};

export function filterProducts(products: Product[], f: Filter): Product[] {
  return products.filter((p) => {
    if (!p.active) return false;
    if (p.giftExtra) return false;
    if (!isInSeason(p)) return false;
    if (f.occasion && !p.occasions.includes(f.occasion)) return false;
    if (f.color && !p.colorFamily.includes(f.color)) return false;
    if (f.size) {
      const ids = SIZE_VARIANT_IDS[f.size];
      if (!p.variants.some((v) => ids.includes(v.id))) return false;
    }
    if (f.sameDay && !p.tags.includes("same-day")) return false;
    if (f.price) {
      const c = startingPriceCents(p);
      if (f.price === "under-100" && c >= 10000) return false;
      if (f.price === "100-150" && (c < 10000 || c >= 15000)) return false;
      if (f.price === "150-200" && (c < 15000 || c >= 20000)) return false;
      if (f.price === "200-plus" && c < 20000) return false;
    }
    if (f.q && !matchesQuery(p, f.q)) return false;
    return true;
  });
}

/** How long a product counts as new after it joins the catalog. */
export const NEW_ARRIVAL_DAYS = 30;

export function isNewArrival(p: Product, now: Date = new Date()): boolean {
  if (!p.addedAt) return false;
  const cutoff = new Date(now.getTime() - NEW_ARRIVAL_DAYS * 86_400_000).toISOString().slice(0, 10);
  return p.addedAt >= cutoff;
}

const byNewest = (a: Product, b: Product) => (b.addedAt ?? "").localeCompare(a.addedAt ?? "");

// Unsold pieces above this starting price sink to the end of "Recommended":
// they are bought on purpose, not browsed into.
const PREMIUM_CENTS = 30_000;

export type RankOptions = {
  /** Sales score per product id (see lib/product-ranking.ts). */
  sales?: ReadonlyMap<string, number>;
  /** Send funeral pieces to the end: they have their own page. */
  demoteSympathy?: boolean;
};

/**
 * "Recommended": what sells first (recent sales weigh more), then Maky's
 * staff picks, then the newest pieces. Premium pieces nobody has bought yet
 * and, on general listings, funeral pieces go last.
 */
function recommendedOrder(products: Product[], { sales, demoteSympathy }: RankOptions): Product[] {
  const score = (p: Product) => sales?.get(p.id) ?? 0;
  const key = (p: Product) => {
    const sold = score(p) > 0;
    return [
      demoteSympathy && p.category === "sympathy" ? 1 : 0,
      sold ? 0 : 1,
      !sold && startingPriceCents(p) > PREMIUM_CENTS ? 1 : 0,
      !sold && !p.tags.includes("staff-pick") ? 1 : 0,
    ];
  };
  return products
    .map((p) => ({ p, k: key(p) }))
    .sort((a, b) => {
      for (let i = 0; i < a.k.length; i++) if (a.k[i] !== b.k[i]) return a.k[i] - b.k[i];
      return score(b.p) - score(a.p) || byNewest(a.p, b.p);
    })
    .map(({ p }) => p);
}

export function sortProducts(products: Product[], sort: Sort, opts: RankOptions = {}): Product[] {
  const arr = [...products];
  switch (sort) {
    case "price-asc":
      return arr.sort((a, b) => startingPriceCents(a) - startingPriceCents(b));
    case "price-desc":
      return arr.sort((a, b) => startingPriceCents(b) - startingPriceCents(a));
    case "newest":
      return arr.sort(byNewest);
    case "recommended":
      return recommendedOrder(arr, opts);
  }
}

export function productsByCategory(
  products: Product[],
  category: ProductCategory,
): Product[] {
  return products.filter(
    (p) => p.active && !p.giftExtra && isInSeason(p) && p.category === category,
  );
}

export function newestArrivals(products: Product[], limit = 12): Product[] {
  return products
    .filter((p) => p.active && !p.giftExtra && isInSeason(p))
    .sort(byNewest)
    .slice(0, limit);
}
