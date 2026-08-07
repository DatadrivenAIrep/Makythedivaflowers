import { PRODUCTS } from "@/data/products";
import { SITE } from "@/data/site";
import { buildMerchantFeed } from "@/lib/merchant-feed";

// Catalog is static data; cache the response and regenerate at most hourly.
export const revalidate = 3600;

export function GET() {
  const xml = buildMerchantFeed(PRODUCTS, SITE.url);
  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
