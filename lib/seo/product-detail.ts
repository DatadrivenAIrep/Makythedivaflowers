import type { Product, Occasion } from "@/types/product";
import type { Locale } from "@/types/locale";
import { SITE } from "@/data/site";
import { extractFlowers, joinFlowers } from "@/lib/seo/flowers";

/**
 * Per-product detail blocks for the PDP accordion and the schema description.
 *
 * The accordion previously rendered the same three paragraphs on all 96
 * products — zero unique words. Measured against the competitor, our product
 * copy ran a median of 53 words to their 205, and thin product pages do not
 * rank. Everything here is derived from catalog data the shop already
 * maintains: the stems its own copy names, real variant prices, the occasion
 * tags, the delivery-zone table and the cutoff. Nothing is invented.
 */

const OCCASION: Record<Occasion, { en: string; es: string }> = {
  birthday: { en: "birthdays", es: "cumpleaños" },
  anniversary: { en: "anniversaries", es: "aniversarios" },
  sympathy: { en: "sympathy and funerals", es: "condolencias y funerales" },
  romance: { en: "romance", es: "romance" },
  congrats: { en: "congratulations", es: "felicitaciones" },
  "just-because": { en: "just-because gifts", es: "regalos porque sí" },
  "mothers-day": { en: "Mother's Day", es: "el Día de la Madre" },
  "get-well": { en: "get-well wishes", es: "deseos de pronta mejoría" },
};

const usd = (cents: number) => `$${(cents / 100).toFixed(0)}`;

function list(items: string[], locale: Locale): string {
  if (items.length <= 1) return items[0] ?? "";
  const and = locale === "es" ? "y" : "and";
  return `${items.slice(0, -1).join(", ")} ${and} ${items.at(-1)}`;
}

export type DetailBlock = { key: string; label: string; body: string };

export function productDetailBlocks(product: Product, locale: Locale): DetailBlock[] {
  const es = locale === "es";
  const blocks: DetailBlock[] = [];

  // --- What's in it -------------------------------------------------------
  const flowers = extractFlowers(`${product.description.en} ${product.blurb.en}`);
  const stems = flowers.length ? joinFlowers(flowers, locale) : null;
  const madeToOrder = es
    ? "Cada pieza se construye a mano el día que sale del taller, así que dos nunca son idénticas."
    : "Every piece is built by hand the day it leaves the studio, so no two are identical.";
  const substitution = es
    ? "Si el mercado no trae un tallo en su mejor momento esa mañana, lo sustituimos por algo equivalente en color y calidad antes que enviar una flor que no nos convence."
    : "If the market does not have a stem at its best that morning we substitute something equal in colour and quality, rather than send a flower we are not happy with.";
  blocks.push({
    key: "contains",
    label: es ? "Qué lleva" : "What's in it",
    body: [
      stems
        ? es
          ? `Construido alrededor de ${stems.toLowerCase()}.`
          : `Built around ${stems.toLowerCase()}.`
        : es
          ? "Diseñado con lo mejor que entre al taller esa mañana."
          : "Designed from the best of what comes into the studio that morning.",
      madeToOrder,
      substitution,
    ].join(" "),
  });

  // --- Sizes --------------------------------------------------------------
  if (!product.quoteOnly && product.variants.length) {
    const sizes = product.variants.map((v) => `${v.label[locale]} (${usd(v.priceCents)})`);
    const addOns = product.addOns?.length
      ? es
        ? ` Puedes añadir ${list(product.addOns.map((a) => `${a.label.es.toLowerCase()} (+${usd(a.priceCents)})`), "es")}.`
        : ` You can add ${list(product.addOns.map((a) => `${a.label.en.toLowerCase()} (+${usd(a.priceCents)})`), "en")}.`
      : "";
    blocks.push({
      key: "sizes",
      label: es ? "Tamaños y precios" : "Sizes & pricing",
      body: es
        ? `Disponible en ${list(sizes, "es")}. Los precios son antes de impuestos; el envío se calcula por zona en el checkout.${addOns}`
        : `Available in ${list(sizes, "en")}. Prices are before tax; delivery is calculated by zone at checkout.${addOns}`,
    });
  }

  // --- Good for -----------------------------------------------------------
  if (product.occasions.length) {
    const occs = list(product.occasions.map((o) => OCCASION[o][locale]), locale);
    blocks.push({
      key: "occasions",
      label: es ? "Para qué ocasión" : "What it's for",
      body: es
        ? `Lo enviamos sobre todo para ${occs}. Si no estás seguro de qué encaja, llámanos al ${SITE.phoneDisplay} y lo resolvemos en dos minutos — llevamos desde ${SITE.founded} haciendo justo esa pregunta.`
        : `We send this most often for ${occs}. If you are unsure what fits, call us on ${SITE.phoneDisplay} and we will sort it in two minutes — we have been answering exactly that question since ${SITE.founded}.`,
    });
  }

  // --- Delivery -----------------------------------------------------------
  // Albertson is named as the studio's own location in the sentence below, so
  // repeating it as a destination reads as "from Albertson to Albertson".
  const towns = ["Roslyn", "Manhasset", "Great Neck", "Garden City", "Mineola", "Westbury"];
  const sameDay = product.tags.includes("same-day");
  blocks.push({
    key: "delivery",
    label: es ? "Entrega" : "Delivery",
    body: es
      ? `${sameDay ? `Pide antes de las ${SITE.cutoffTime} y sale hoy mismo.` : "Esta pieza se hace por encargo; reserva con un día de antelación."} Entregamos a mano desde nuestro taller en ${SITE.address.line1}, ${SITE.address.locality}, a ${list(towns, "es")} y al resto de Nassau County, Queens y el oeste de Suffolk. No somos un intermediario: tu pedido no se reenvía a otra floristería.`
      : `${sameDay ? `Order before ${SITE.cutoffTime} and it goes out today.` : "This piece is made to order; reserve a day ahead."} We hand-deliver from our studio at ${SITE.address.line1}, ${SITE.address.locality} to ${list(towns, "en")} and the rest of Nassau County, Queens and western Suffolk. We are not a wire service — your order is never handed to another florist.`,
  });

  // --- Care ---------------------------------------------------------------
  if (product.category !== "gifts") {
    blocks.push({
      key: "care",
      label: es ? "Cuidado" : "Caring for it",
      body: es
        ? "Cambia el agua cada dos días y recorta un centímetro de tallo en diagonal cada vez. Mantenlo lejos del sol directo, de radiadores y del frutero — la fruta madura suelta etileno y acorta la vida de las flores más que ninguna otra cosa en la cocina."
        : "Change the water every couple of days and take half an inch off the stems on the diagonal each time. Keep it out of direct sun, away from radiators, and off the fruit bowl — ripening fruit gives off ethylene and shortens a vase life faster than anything else in a kitchen.",
    });
  }

  return blocks;
}

/** The blocks flattened for the Product schema's description. */
export function productRichDescription(product: Product, locale: Locale): string {
  return [product.description[locale], ...productDetailBlocks(product, locale).map((b) => b.body)]
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}
