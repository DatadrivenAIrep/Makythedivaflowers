import type {
  Product,
  ProductCategory,
  Occasion,
  ColorFamily,
} from "@/types/product";

export type PriceBand = "under-200" | "200-300" | "300-plus";
export type Sort = "newest" | "price-asc" | "price-desc" | "staff-pick";

export type Filter = {
  occasion?: Occasion;
  color?: ColorFamily;
  size?: "standard" | "grand" | "diva";
  price?: PriceBand;
  sameDay?: boolean;
};

export function startingPriceCents(p: Product): number {
  if (p.variants.length === 0) return 0;
  return p.variants.reduce((min, v) => (v.priceCents < min ? v.priceCents : min), p.variants[0].priceCents);
}

export function filterProducts(products: Product[], f: Filter): Product[] {
  return products.filter((p) => {
    if (!p.active) return false;
    if (f.occasion && !p.occasions.includes(f.occasion)) return false;
    if (f.color && !p.colorFamily.includes(f.color)) return false;
    if (f.size) {
      // Convention: variant IDs are "standard" | "grand" | "diva" in seed data.
      const has = p.variants.some((v) => v.id === f.size);
      if (!has) return false;
    }
    if (f.sameDay && !p.tags.includes("same-day")) return false;
    if (f.price) {
      const c = startingPriceCents(p);
      if (f.price === "under-200" && c >= 20000) return false;
      if (f.price === "200-300" && (c < 20000 || c >= 30000)) return false;
      if (f.price === "300-plus" && c < 30000) return false;
    }
    return true;
  });
}

export function sortProducts(products: Product[], sort: Sort): Product[] {
  const arr = [...products];
  switch (sort) {
    case "price-asc":
      return arr.sort((a, b) => startingPriceCents(a) - startingPriceCents(b));
    case "price-desc":
      return arr.sort((a, b) => startingPriceCents(b) - startingPriceCents(a));
    case "newest":
      return arr.sort((a, b) => Number(b.tags.includes("new")) - Number(a.tags.includes("new")));
    case "staff-pick":
      return arr.sort((a, b) => Number(b.tags.includes("staff-pick")) - Number(a.tags.includes("staff-pick")));
    default:
      return arr;
  }
}

export function productsByCategory(
  products: Product[],
  category: ProductCategory,
): Product[] {
  return products.filter((p) => p.active && p.category === category);
}

export function newestArrivals(products: Product[], limit = 12): Product[] {
  return [...products]
    .filter((p) => p.active)
    .sort((a, b) => Number(b.tags.includes("new")) - Number(a.tags.includes("new")))
    .slice(0, limit);
}
