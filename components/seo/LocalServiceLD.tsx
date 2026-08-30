import { SITE } from "@/data/site";
import type { Locale } from "@/types/locale";
import type { LocalCity, LocalOccasion } from "@/data/local-seo";
import { buildLocalFaq } from "@/lib/seo/local-faq";

/**
 * Service + FAQPage for one town (optionally scoped to one occasion).
 *
 * `provider` is a bare @id reference to the Florist node emitted by
 * LocalBusinessLD in the locale layout — repeating the full business here would
 * give Google a second, competing description of the same shop.
 */
export function LocalServiceLD({
  locale,
  city,
  occasion,
}: {
  locale: Locale;
  city: LocalCity;
  occasion?: LocalOccasion;
}) {
  const es = locale === "es";
  const what = occasion
    ? occasion.keyword[locale]
    : es
      ? "entrega de flores"
      : "flower delivery";

  const service = {
    "@type": "Service",
    name: es ? `${what} en ${city.name}, NY` : `${what} in ${city.name}, NY`,
    serviceType: occasion ? occasion.label.en : "Flower delivery",
    description: occasion ? occasion.leadIn[locale] : city.note[locale],
    provider: { "@id": SITE.ld.businessId },
    areaServed: {
      "@type": "City",
      name: city.name,
      address: {
        "@type": "PostalAddress",
        addressLocality: city.name,
        addressRegion: "NY",
        addressCountry: "US",
      },
      containedInPlace: { "@type": "AdministrativeArea", name: "Nassau County, NY" },
    },
    availableChannel: {
      "@type": "ServiceChannel",
      serviceUrl: `${SITE.url}/${locale}/flower-delivery/${city.slug}${occasion ? `/${occasion.slug}` : ""}`,
      servicePhone: SITE.phone,
    },
  };

  const faq = buildLocalFaq(locale, city, occasion);

  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      service,
      {
        "@type": "FAQPage",
        mainEntity: faq.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
    />
  );
}
