import type { Product } from "@/types/product";
import type { Locale } from "@/types/locale";
import { startingPriceCents, isAvailableNow } from "@/data/product-helpers";
import { SITE } from "@/data/site";

const usd = (cents: number) => (cents / 100).toFixed(2);

/** Cheapest and dearest variant, so AggregateOffer can state a real range. */
function priceRange(product: Product): { low: number; high: number } {
  const prices = product.variants.map((v) => v.priceCents);
  return {
    low: startingPriceCents(product),
    high: prices.length ? Math.max(...prices) : startingPriceCents(product),
  };
}

/**
 * Delivery, as we actually charge it: 16 zones between $10 and $25, same-day
 * on orders placed before the cutoff. Stating this in the offer is what lets
 * Google show a delivery line in the product result instead of nothing.
 */
const shippingDetails = {
  "@type": "OfferShippingDetails",
  shippingRate: {
    "@type": "MonetaryAmount",
    minValue: 10,
    maxValue: 25,
    currency: "USD",
  },
  shippingDestination: {
    "@type": "DefinedRegion",
    addressCountry: "US",
    addressRegion: "NY",
  },
  deliveryTime: {
    "@type": "ShippingDeliveryTime",
    handlingTime: { "@type": "QuantitativeValue", minValue: 0, maxValue: 1, unitCode: "DAY" },
    transitTime: { "@type": "QuantitativeValue", minValue: 0, maxValue: 1, unitCode: "DAY" },
  },
};

/**
 * Returns, as the policy on /legal/returns actually reads: flowers are
 * perishable, so we take no physical returns and stand behind orders with a
 * freshness guarantee instead.
 *
 * This previously emitted a bare `merchantReturnLink` with no
 * `returnPolicyCategory` — invalid to Google, and it implied returns were
 * accepted when they are not. `MerchantReturnNotPermitted` is the honest map.
 */
const returnPolicy = {
  "@type": "MerchantReturnPolicy",
  applicableCountry: "US",
  returnPolicyCategory: "https://schema.org/MerchantReturnNotPermitted",
  merchantReturnLink: `${SITE.url}/en/legal/returns`,
};

/**
 * NOT INCLUDED, deliberately: aggregateRating / review.
 *
 * REVIEWS_AGGREGATE (4.9 from 127 Google reviews) rates the *business*, not any
 * one arrangement. Google requires a Product's rating to be for that product,
 * and attaching the shop's rating to all 106 items is a structured-data policy
 * violation that risks losing rich results across the whole site — including the
 * ones the Florist node legitimately earns.
 *
 * If per-product reviews are ever collected, add them here keyed to the product.
 * Until then this stays out. Enforced by tests/unit/product-jsonld.test.ts.
 */
export function buildProductJsonLd(
  product: Product,
  locale: Locale,
  origin: string = SITE.url,
  now: Date = new Date(),
) {
  const { low, high } = priceRange(product);
  const url = `${origin}/${locale}/product/${product.slug}`;
  const available = isAvailableNow(product, now);

  // Refreshed on every build. The site redeploys often enough that a one-year
  // horizon never goes stale; a lapsed date is a Search Console error.
  const priceValidUntil = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate())
    .toISOString()
    .slice(0, 10);

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title[locale],
    description: product.description[locale],
    sku: product.id,
    category: product.category,
    image: product.images.map((i) => `${origin}${i.src}`),
    brand: { "@type": "Brand", name: SITE.merchantName },
    // Bare @id reference to the Florist node in LocalBusinessLD, so the shop is
    // described once for the whole site rather than re-stated on 106 pages.
    seller: { "@id": SITE.ld.businessId },
    // Quote-only pieces have no public price — omit the Offer entirely
    // (JSON.stringify drops `undefined`) so we never emit a $0 / InStock offer
    // that Google would flag as invalid.
    offers: product.quoteOnly
      ? undefined
      : {
          "@type": "AggregateOffer",
          priceCurrency: "USD",
          lowPrice: usd(low),
          highPrice: usd(high),
          offerCount: product.variants.length,
          priceValidUntil,
          // Seasonal pieces go OutOfStock out of season instead of advertising
          // stock we cannot build.
          availability: available
            ? "https://schema.org/InStock"
            : "https://schema.org/OutOfStock",
          itemCondition: "https://schema.org/NewCondition",
          url,
          shippingDetails,
          hasMerchantReturnPolicy: returnPolicy,
        },
  };
}
