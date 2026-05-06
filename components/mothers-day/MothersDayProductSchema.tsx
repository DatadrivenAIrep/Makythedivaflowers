import { PRODUCTS } from "@/data/products";
import { startingPriceCents } from "@/data/product-helpers";
import { SITE } from "@/data/site";
import type { Locale } from "@/types/locale";

export function MothersDayProductSchema({
  locale,
  slugs,
}: {
  locale: Locale;
  slugs: string[];
}) {
  const products = slugs
    .map((s) => PRODUCTS.find((p) => p.slug === s))
    .filter((p): p is NonNullable<typeof p> => Boolean(p && p.active));

  const items = products.map((p, i) => ({
    "@type": "Product",
    "@id": `${SITE.url}/${locale}/product/${p.slug}#md`,
    position: i + 1,
    name: p.title[locale],
    description: p.blurb[locale],
    image: `${SITE.url}${p.images[0]?.src ?? ""}`,
    brand: { "@type": "Brand", name: SITE.brand },
    offers: {
      "@type": "Offer",
      price: (startingPriceCents(p) / 100).toFixed(2),
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
      shippingDetails: {
        "@type": "OfferShippingDetails",
        shippingDestination: {
          "@type": "DefinedRegion",
          addressRegion: "NY",
          addressCountry: "US",
        },
        deliveryTime: {
          "@type": "ShippingDeliveryTime",
          handlingTime: { "@type": "QuantitativeValue", minValue: 0, maxValue: 0, unitCode: "DAY" },
          transitTime: { "@type": "QuantitativeValue", minValue: 0, maxValue: 1, unitCode: "DAY" },
        },
      },
    },
  }));

  const ld = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Mother's Day Edit",
    itemListElement: items,
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }}
    />
  );
}
