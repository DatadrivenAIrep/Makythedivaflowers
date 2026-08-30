import type { Product, ProductCategory } from "@/types/product";
import { startingPriceCents, isAvailableNow } from "@/data/product-helpers";
import { SITE } from "@/data/site";

// Google product taxonomy IDs. Only categories we can map confidently are set;
// unmapped ones are omitted so Google auto-categorizes them.
const GOOGLE_CATEGORY: Partial<Record<ProductCategory, string>> = {
  arrangements: "6248", // Home & Garden > Decor > Flowers > Fresh Cut Flowers
  bouquets: "6248",
  sympathy: "6248",
  plants: "985", // Home & Garden > Plants
};

const PRODUCT_TYPE: Record<ProductCategory, string> = {
  arrangements: "Flowers > Arrangements",
  bouquets: "Flowers > Bouquets",
  sympathy: "Flowers > Sympathy",
  plants: "Plants",
  gifts: "Gifts",
  subscriptions: "Subscriptions",
};

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function cdata(s: string): string {
  // Guard against a literal "]]>" sequence breaking the CDATA block.
  return `<![CDATA[${s.replace(/]]>/g, "]]]]><![CDATA[>")}]]>`;
}

function priceUsd(cents: number): string {
  return `${(cents / 100).toFixed(2)} USD`;
}

export function buildItemXml(p: Product, origin: string, now: Date = new Date()): string {
  const link = `${origin}/en/product/${p.slug}`;
  const [first, ...rest] = p.images;
  const imageLink = first ? `${origin}${first.src}` : "";
  const gCat = GOOGLE_CATEGORY[p.category];

  const lines = [
    "  <item>",
    `    <g:id>${xmlEscape(p.id)}</g:id>`,
    `    <g:title>${cdata(p.title.en.slice(0, 150))}</g:title>`,
    `    <g:description>${cdata(p.description.en.slice(0, 5000))}</g:description>`,
    `    <g:link>${cdata(link)}</g:link>`,
    `    <g:image_link>${xmlEscape(imageLink)}</g:image_link>`,
    ...rest
      .slice(0, 10)
      .map((img) => `    <g:additional_image_link>${xmlEscape(origin + img.src)}</g:additional_image_link>`),
    // Was hardcoded in_stock, which advertised seasonal pieces we cannot build
    // that month. Merchant Center suspends accounts for availability mismatches.
    `    <g:availability>${isAvailableNow(p, now) ? "in_stock" : "out_of_stock"}</g:availability>`,
    `    <g:price>${priceUsd(startingPriceCents(p))}</g:price>`,
    `    <g:brand>${cdata(SITE.merchantName)}</g:brand>`,
    `    <g:condition>new</g:condition>`,
    `    <g:identifier_exists>no</g:identifier_exists>`,
    ...(gCat ? [`    <g:google_product_category>${gCat}</g:google_product_category>`] : []),
    `    <g:product_type>${cdata(PRODUCT_TYPE[p.category])}</g:product_type>`,
    // Without a shipping block Merchant Center falls back to account settings,
    // and disapproves the item outright if none are configured. These are the
    // real delivery-zone bounds from data/delivery-zones.
    "    <g:shipping>",
    "      <g:country>US</g:country>",
    "      <g:region>NY</g:region>",
    "      <g:service>Local delivery</g:service>",
    "      <g:price>10.00 USD</g:price>",
    "    </g:shipping>",
    `    <g:max_handling_time>${p.tags.includes("same-day") ? 0 : 1}</g:max_handling_time>`,
    "    <g:transit_time_label>local</g:transit_time_label>",
    "  </item>",
  ];
  return lines.join("\n");
}

export function buildMerchantFeed(products: Product[], origin: string, now: Date = new Date()): string {
  const items = products
    .filter((p) => p.active && !p.giftExtra && !p.quoteOnly && p.images.length > 0)
    .map((p) => buildItemXml(p, origin, now))
    .join("\n");
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">',
    "  <channel>",
    `    <title>${cdata(SITE.merchantName)}</title>`,
    `    <link>${xmlEscape(origin)}</link>`,
    "    <description>Fresh flowers, hand-built and delivered on Long Island.</description>",
    items,
    "  </channel>",
    "</rss>",
  ].join("\n");
}
