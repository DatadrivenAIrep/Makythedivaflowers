import type { Product } from "@/types/product";
import type { Locale } from "@/types/locale";
import { startingPriceCents } from "@/data/product-helpers";
import { SITE } from "@/data/site";

export function buildProductJsonLd(product: Product, locale: Locale, origin: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title[locale],
    description: product.description[locale],
    image: product.images.map((i) => `${origin}${i.src}`),
    brand: { "@type": "Brand", name: SITE.merchantName },
    // Quote-only pieces have no public price — omit the Offer entirely
    // (JSON.stringify drops `undefined`) so we never emit a $0 / InStock offer
    // that Google would flag as invalid.
    offers: product.quoteOnly
      ? undefined
      : {
          "@type": "AggregateOffer",
          priceCurrency: "USD",
          lowPrice: (startingPriceCents(product) / 100).toFixed(2),
          offerCount: product.variants.length,
          availability: product.active
            ? "https://schema.org/InStock"
            : "https://schema.org/OutOfStock",
          itemCondition: "https://schema.org/NewCondition",
          url: `${origin}/${locale}/product/${product.slug}`,
        },
    hasMerchantReturnPolicy: {
      "@type": "MerchantReturnPolicy",
      applicableCountry: "US",
      merchantReturnLink: `${origin}/en/legal/returns`,
    },
  };
}
