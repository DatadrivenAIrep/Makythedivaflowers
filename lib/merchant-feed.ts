import type { Product, ProductCategory } from "@/types/product";
import { startingPriceCents } from "@/data/product-helpers";
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

export function buildItemXml(p: Product, origin: string): string {
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
    `    <g:availability>in_stock</g:availability>`,
    `    <g:price>${priceUsd(startingPriceCents(p))}</g:price>`,
    `    <g:brand>${cdata(SITE.merchantName)}</g:brand>`,
    `    <g:condition>new</g:condition>`,
    `    <g:identifier_exists>no</g:identifier_exists>`,
    ...(gCat ? [`    <g:google_product_category>${gCat}</g:google_product_category>`] : []),
    `    <g:product_type>${cdata(PRODUCT_TYPE[p.category])}</g:product_type>`,
    "  </item>",
  ];
  return lines.join("\n");
}

export function buildMerchantFeed(products: Product[], origin: string): string {
  const items = products
    .filter((p) => p.active && p.images.length > 0)
    .map((p) => buildItemXml(p, origin))
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
