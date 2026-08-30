import { PRODUCTS } from "@/data/products";
import { SITE } from "@/data/site";
import { buildMerchantFeed } from "@/lib/merchant-feed";
import { getAllPriceOverrides, applyPriceOverrides } from "@/lib/product-prices";

// Catalog is static data; cache the response and regenerate at most hourly.
export const revalidate = 3600;

export function GET() {
  // Google compares feed price against the landing page and disapproves on a
  // mismatch, so the feed reads the same overridden prices the PDP does.
  const xml = buildMerchantFeed(applyPriceOverrides(PRODUCTS, getAllPriceOverrides()), SITE.url);
  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
