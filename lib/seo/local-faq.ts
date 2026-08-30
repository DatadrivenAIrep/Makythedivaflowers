import { SITE } from "@/data/site";
import type { Locale } from "@/types/locale";
import type { LocalCity, LocalOccasion } from "@/data/local-seo";
import { getIntersection } from "@/data/local-seo";

export type LocalFaqEntry = { q: string; a: string };

/**
 * Single source for a local page's Q&A — consumed by both the visible <dl> and
 * the FAQPage schema. Keeping one builder means the two can never drift, which
 * is what Google's structured-data guidelines require.
 *
 * Answers are derived from the same verified data the page renders (distances,
 * ZIPs, cutoff), so they cannot contradict the page body either.
 */
export function buildLocalFaq(
  locale: Locale,
  city: LocalCity,
  occasion?: LocalOccasion,
): LocalFaqEntry[] {
  const es = locale === "es";
  const entries: LocalFaqEntry[] = [
    {
      q: es
        ? `¿Entregan flores el mismo día en ${city.name}?`
        : `Do you deliver flowers same-day to ${city.name}?`,
      a: es
        ? `Sí. ${city.name} está a unas ${city.miles} millas del taller en ${SITE.address.line1}, ${SITE.address.locality} — unos ${city.driveMinutes} minutos en coche. Los pedidos hechos antes de las ${SITE.cutoffTime} salen ese mismo día.`
        : `Yes. ${city.name} is about ${city.miles} miles from the studio at ${SITE.address.line1}, ${SITE.address.locality} — roughly a ${city.driveMinutes} minute drive. Orders placed before ${SITE.cutoffTime} go out the same day.`,
    },
    {
      q: es
        ? `¿Qué códigos postales de ${city.name} cubren?`
        : `Which ${city.name} ZIP codes do you cover?`,
      a: es
        ? `Cubrimos ${city.zips.join(", ")}, además de ${city.neighbors.join(", ")} y el resto de Nassau County.`
        : `We cover ${city.zips.join(", ")}, along with ${city.neighbors.join(", ")} and the rest of Nassau County.`,
    },
    {
      q: es
        ? "¿Son una floristería local o un servicio de pedidos por cable?"
        : "Are you a local florist or a wire service?",
      a: es
        ? `Somos una floristería local. Todo se diseña a mano en nuestro taller de ${SITE.address.locality} y lo entregamos nosotros — tu pedido no se reenvía a una floristería desconocida, que es lo que ocurre en la mayoría de sitios nacionales.`
        : `We are a local florist. Everything is designed by hand in our ${SITE.address.locality} studio and delivered by us — your order is not handed off to a florist you will never meet, which is what happens on most national ordering sites.`,
    },
  ];

  if (occasion) {
    const intersection = getIntersection(city.slug, occasion.slug);
    entries.push({
      q: es
        ? `¿Con cuánta anticipación debo pedir ${occasion.keyword.es} en ${city.name}?`
        : `How far ahead should I order ${occasion.keyword.en} in ${city.name}?`,
      a: occasion.guidance[0].body[locale],
    });
    if (intersection) {
      entries.push({
        q: es
          ? `¿Hay algo específico de ${city.name} que deba saber?`
          : `Is there anything specific to ${city.name} I should know?`,
        a: intersection[locale],
      });
    }
  }

  return entries;
}
