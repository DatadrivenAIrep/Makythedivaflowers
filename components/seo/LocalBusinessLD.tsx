import { SITE } from "@/data/site";
import { REVIEWS_AGGREGATE } from "@/data/reviews";

/**
 * The site-wide entity graph: one Florist node, one Organization, one WebSite.
 *
 * `Florist` is a real schema.org subtype of LocalBusiness — Google treats it as
 * a stronger signal for "florist near me" than the generic type we emitted
 * before. Every node carries a stable @id (see SITE.ld) so the rating block on
 * the homepage attaches to *this* business instead of floating as a second,
 * unrelated LocalBusiness.
 */
export function LocalBusinessLD() {
  const business = {
    "@type": "Florist",
    "@id": SITE.ld.businessId,
    name: SITE.merchantName,
    alternateName: SITE.brand,
    description: SITE.metadata.description.en,
    url: SITE.url,
    telephone: SITE.phone,
    email: SITE.email,
    priceRange: SITE.priceRange,
    currenciesAccepted: "USD",
    paymentAccepted: "Cash, Credit Card, Debit Card, Apple Pay",
    foundingDate: String(SITE.founded),
    image: [`${SITE.url}/storefront.webp`],
    logo: `${SITE.url}/apple-icon.webp`,
    hasMap: REVIEWS_AGGREGATE.placeUrl,
    address: {
      "@type": "PostalAddress",
      streetAddress: SITE.address.line1,
      addressLocality: SITE.address.locality,
      addressRegion: SITE.address.region,
      postalCode: SITE.address.postal,
      addressCountry: "US",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: SITE.geo.lat,
      longitude: SITE.geo.lng,
    },
    openingHoursSpecification: SITE.hours.flatMap((h) => {
      const [days, range] = h.schema.split(" ");
      const [opens, closes] = range.split("-");
      const map: Record<string, string> = {
        Mo: "Monday", Tu: "Tuesday", We: "Wednesday", Th: "Thursday",
        Fr: "Friday", Sa: "Saturday", Su: "Sunday",
      };
      const order = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
      const codes = days.includes("-")
        ? (() => {
            const [a, b] = days.split("-");
            return order.slice(order.indexOf(a), order.indexOf(b) + 1);
          })()
        : [days];
      return [{
        "@type": "OpeningHoursSpecification",
        dayOfWeek: codes.map((c) => map[c]),
        opens,
        closes,
      }];
    }),
    // The towns we actually deliver to. This is what lets us rank for
    // "flower delivery <town>" without a physical address in each one.
    areaServed: SITE.servedTowns.map((name) => ({
      "@type": "City",
      name,
      containedInPlace: { "@type": "AdministrativeArea", name: "Nassau County, NY" },
    })),
    sameAs: [...SITE.social.map((s) => s.href), REVIEWS_AGGREGATE.placeUrl],
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: REVIEWS_AGGREGATE.rating,
      reviewCount: REVIEWS_AGGREGATE.total,
      bestRating: 5,
    },
    parentOrganization: { "@id": SITE.ld.orgId },
  };

  const organization = {
    "@type": "Organization",
    "@id": SITE.ld.orgId,
    name: SITE.merchantName,
    url: SITE.url,
    logo: { "@type": "ImageObject", url: `${SITE.url}/apple-icon.webp` },
    telephone: SITE.phone,
    email: SITE.email,
    sameAs: SITE.social.map((s) => s.href),
  };

  const website = {
    "@type": "WebSite",
    "@id": SITE.ld.websiteId,
    url: SITE.url,
    name: SITE.merchantName,
    inLanguage: ["en-US", "es-US"],
    publisher: { "@id": SITE.ld.orgId },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE.url}/en/shop?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };

  const graph = {
    "@context": "https://schema.org",
    "@graph": [business, organization, website],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
    />
  );
}
