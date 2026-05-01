import type { Product } from "@/types/product";
import type { Locale } from "@/types/locale";
import { startingPriceCents } from "@/data/product-helpers";

export function PdpStructuredData({
  product,
  locale,
  origin,
}: {
  product: Product;
  locale: Locale;
  origin: string;
}) {
  const data = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title[locale],
    description: product.description[locale],
    image: product.images.map((i) => i.src),
    brand: { "@type": "Brand", name: "Diva Flowers" },
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "USD",
      lowPrice: (startingPriceCents(product) / 100).toFixed(2),
      offerCount: product.variants.length,
      availability: product.active ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url: `${origin}/${locale}/product/${product.slug}`,
    },
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
