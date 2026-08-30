import type { Product, ProductCategory, ColorFamily } from "@/types/product";
import type { Locale } from "@/types/locale";
import { headlineFlowers, joinFlowers } from "@/lib/seo/flowers";

const CATEGORY: Record<ProductCategory, { en: string; es: string }> = {
  arrangements: { en: "Arrangement", es: "Arreglo" },
  bouquets: { en: "Bouquet", es: "Ramo" },
  plants: { en: "Plant", es: "Planta" },
  gifts: { en: "Gift Basket", es: "Cesta de Regalo" },
  sympathy: { en: "Sympathy Arrangement", es: "Arreglo de Condolencia" },
  subscriptions: { en: "Flower Subscription", es: "Suscripción Floral" },
};

const COLOR: Record<ColorFamily, { en: string; es: string }> = {
  pink: { en: "Pink", es: "Rosado" },
  red: { en: "Red", es: "Rojo" },
  white: { en: "White", es: "Blanco" },
  mixed: { en: "Mixed", es: "Multicolor" },
  green: { en: "Green", es: "Verde" },
  pastel: { en: "Pastel", es: "Pastel" },
};

/**
 * The searchable half of a product title.
 *
 * Catalog names are brand assets — "Amethyst Snowdrop", "Cloud Nine" — and
 * carry no search intent whatsoever. The competitor titles every product with
 * its flower, occasion and towns; 74 of our 96 had none of the three.
 *
 * Built from the stems the copy actually names, falling back to colour for the
 * dozen gift baskets and designer's-choice pieces that have no fixed flowers.
 */
export function productDescriptor(product: Product, locale: Locale, maxFlowers = 2): string {
  const category = CATEGORY[product.category][locale];
  const flowers = headlineFlowers(`${product.description.en} ${product.blurb.en}`, maxFlowers);

  if (flowers.length) {
    const stems = joinFlowers(flowers, locale);
    // With a single headline stem the descriptor collides across products
    // ("Rose Bouquet" five times over). Colour both separates them and targets
    // a better query — "red rose bouquet" beats "rose bouquet". Two stems are
    // distinctive enough already, and adding colour there overruns the title.
    const colour =
      flowers.length === 1 && product.colorFamily[0] && product.colorFamily[0] !== "mixed"
        ? COLOR[product.colorFamily[0]][locale]
        : null;
    if (locale === "es") {
      return colour ? `${category} de ${stems} ${colour.toLowerCase()}` : `${category} de ${stems}`;
    }
    return colour ? `${colour} ${stems} ${category}` : `${stems} ${category}`;
  }

  const colors = product.colorFamily.slice(0, 2).map((c) => COLOR[c][locale]);
  if (!colors.length) return category;
  return locale === "es"
    ? `${category} ${colors.join(" y ").toLowerCase()}`
    : `${colors.join(" & ")} ${category}`;
}
