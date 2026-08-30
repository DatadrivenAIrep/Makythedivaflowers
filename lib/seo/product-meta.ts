import type { Product } from "@/types/product";
import type { Locale } from "@/types/locale";
import { SITE } from "@/data/site";
import { productDescriptor } from "@/lib/seo/product-descriptors";

/**
 * Geo-qualifies a product's title and description for search.
 *
 * The competitor we benchmarked against puts its towns in every one of its 308
 * product titles ("… | Flowers by Mike | East Rockaway & Oceanside, NY"). Ours
 * carried no location at all — 100 of 104 said only "Long Island".
 *
 * Applied at render rather than edited into all 106 catalog entries, so the
 * pattern stays consistent and the copy in data/products.ts stays readable.
 */

/** Towns named in product meta. Kept short — the town landing pages carry the long tail. */
const META_TOWNS = ["Roslyn", "Manhasset", "Great Neck", "Garden City", "Mineola"];

/**
 * A title only carries real intent if it names a FLOWER or a PRODUCT TYPE.
 *
 * Occasion words deliberately excluded: "A Thousand Heartbeats — Anniversary"
 * reads descriptive but tells a searcher nothing about what arrives, and it was
 * skipping the descriptor that would have added "Garden Rose & Dahlia
 * Arrangement".
 */
const ALREADY_DESCRIPTIVE =
  /rose|orchid|tulip|peon|lisianthus|anemone|ranunculus|dahlia|lil(y|ies)|hydrangea|sunflower|carnation|gerbera|anthurium|bouquet|arrangement|vase|plant|basket|wreath|spray|corsage|boutonniere|dozen|rosa|orquídea|tulipán|ramo|arreglo|cesta|planta|jarrón/i;

export function productMetaTitle(product: Product, locale: Locale): string {
  let base = product.seo.title[locale].trim();
  const suffix = ` · ${SITE.address.locality}, NY`;

  // Catalog names like "Amethyst Snowdrop" or "Cloud Nine" are brand assets
  // with zero search intent — 74 of 96 titles had no flower, occasion or
  // category in them. Insert what the arrangement actually contains ahead of
  // the brand, keeping the name first. Titles that already say "Dozen Red
  // Roses" are left alone rather than made redundant.
  if (!ALREADY_DESCRIPTIVE.test(base)) {
    const descriptor = productDescriptor(product, locale);
    // The catalog closes titles with the brand two different ways — 79 with an
    // em dash, 15 with a pipe — so match the brand tail rather than splitting on
    // one separator, which reordered the em-dash titles into nonsense
    // ("Abundant Table — Diva Flowers — Garden Rose Arrangement").
    const brand = base.match(/\s*[|—–-]\s*Diva Flowers\s*$/);
    base = brand
      ? `${base.slice(0, brand.index).trim()} — ${descriptor}${brand[0]}`
      : `${base} — ${descriptor}`;
  }

  // Titles already end in "| Diva Flowers"; append the location to that rather
  // than bolting a second brand mention on.
  return base.endsWith(suffix) ? base : `${base}${suffix}`;
}

export function productMetaDescription(product: Product, locale: Locale): string {
  let base = product.seo.description[locale].trim();

  // Most catalog descriptions already close with a generic same-day line. Drop
  // it rather than stack a second one in front of the specific town list.
  const REDUNDANT = [
    /\s*Same-day delivery on Long Island\.?$/i,
    /\s*Entrega el mismo d[ií]a en Long Island\.?$/i,
  ];
  for (const re of REDUNDANT) base = base.replace(re, "");
  if (!/[.!?]$/.test(base)) base += ".";

  // Only 86 of the catalog's products are same-day; the rest are made to order
  // or need sourcing. The `same-day` tag is the catalog's own signal for this —
  // matching on prose caught 1 of the 18 that must not make the claim.
  const sameDay = product.tags.includes("same-day");
  const towns = META_TOWNS.join(", ");
  const tail = !sameDay
    ? locale === "es"
      ? ` Entregamos desde ${SITE.address.locality}, NY a ${towns} y todo Nassau County.`
      : ` Delivered from ${SITE.address.locality}, NY to ${towns} and all of Nassau County.`
    : locale === "es"
      ? ` Entrega el mismo día desde ${SITE.address.locality}, NY a ${towns} y todo Nassau County — pide antes de las ${SITE.cutoffTime}.`
      : ` Same-day delivery from ${SITE.address.locality}, NY to ${towns} and all of Nassau County — order by ${SITE.cutoffTime}.`;
  return base.endsWith(tail) ? base : `${base}${tail}`;
}
