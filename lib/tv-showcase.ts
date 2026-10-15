import type { Product } from "@/types/product";
import { isAvailableNow, sortProducts, startingPriceCents } from "@/data/product-helpers";
import { productImageDims } from "@/lib/product-image-dims";
import { SITE } from "@/data/site";

/** The photo is drawn ~90% of a 1080-line screen; anything shorter looks soft on a TV. */
export const MIN_COVER_HEIGHT = 900;

export type ShowcasePrice = { en: string; es: string };

export type ShowcaseSlide = {
  id: string;
  slug: string;
  src: string;
  width: number;
  height: number;
  nameEn: string;
  nameEs: string;
  price: ShowcasePrice;
  url: string;
};

/** A slide as the TV receives it: with its QR already rendered server-side. */
export type TvSlide = ShowcaseSlide & { qr: string };

/** Maky's explicit choices per product id; products without a row use the default. */
export type TvVisibility = ReadonlyMap<string, boolean>;

/** Funeral pieces next to birthday ones feel wrong in the shop: off unless Maky turns one on. */
export function defaultTvVisible(p: Product): boolean {
  return p.category !== "sympathy";
}

export function isTvVisible(p: Product, visibility: TvVisibility): boolean {
  return visibility.get(p.id) ?? defaultTvVisible(p);
}

/** Hard gate: unmeasured (e.g. uploaded) or short covers never reach the TV. */
export function hasTvQualityCover(p: Product): boolean {
  const src = p.images[0]?.src;
  if (!src) return false;
  const dims = productImageDims(src);
  return !!dims && dims.height >= MIN_COVER_HEIGHT;
}

export function formatUsd(cents: number): string {
  const dollars = cents / 100;
  const whole = Number.isInteger(dollars);
  return `$${dollars.toLocaleString("en-US", {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  })}`;
}

export function showcasePrice(p: Product): ShowcasePrice {
  if (p.quoteOnly) return { en: "Made to order", es: "Por encargo" };
  const price = formatUsd(startingPriceCents(p));
  return { en: `From ${price}`, es: `Desde ${price}` };
}

export function showcaseUrl(slug: string): string {
  return `${SITE.url}/en/product/${slug}?utm_source=tienda-tv&utm_medium=qr`;
}

/**
 * The TV rotation: what the shop sells right now, minus what Maky hid and any
 * cover too small for a big screen, in the shop's "Recommended" order.
 */
export function buildShowcase(
  products: readonly Product[],
  opts: { visibility: TvVisibility; sales: ReadonlyMap<string, number>; now?: Date },
): ShowcaseSlide[] {
  const now = opts.now ?? new Date();
  const eligible = products.filter(
    (p) => isAvailableNow(p, now) && hasTvQualityCover(p) && isTvVisible(p, opts.visibility),
  );
  return sortProducts(eligible, "recommended", { sales: opts.sales, demoteSympathy: true }).map((p) => {
    const cover = p.images[0];
    const dims = productImageDims(cover.src)!;
    return {
      id: p.id,
      slug: p.slug,
      src: cover.src,
      width: dims.width,
      height: dims.height,
      nameEn: p.title.en,
      nameEs: p.title.es,
      price: showcasePrice(p),
      url: showcaseUrl(p.slug),
    };
  });
}
