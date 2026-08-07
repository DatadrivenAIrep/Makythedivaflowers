import { describe, it, expect } from "vitest";
import { buildMerchantFeed } from "@/lib/merchant-feed";
import type { Product } from "@/types/product";

const ORIGIN = "https://makythedivaflowers.com";

const fx = (over: Partial<Product>): Product => ({
  id: over.id ?? "p1",
  slug: over.slug ?? "test-arrangement",
  title: over.title ?? { en: "Test Arrangement", es: "Arreglo de Prueba" },
  category: over.category ?? "arrangements",
  blurb: { en: "", es: "" },
  description: over.description ?? { en: "A lovely test.", es: "Una prueba." },
  images: over.images ?? [{ src: "/products/test.jpg", alt: { en: "", es: "" }, aspect: "4/5" }],
  variants: over.variants ?? [
    { id: "standard", label: { en: "S", es: "S" }, priceCents: 19100 },
    { id: "lush", label: { en: "L", es: "L" }, priceCents: 25500 },
  ],
  tags: over.tags ?? [],
  occasions: over.occasions ?? [],
  colorFamily: over.colorFamily ?? [],
  active: over.active ?? true,
  seo: { title: { en: "", es: "" }, description: { en: "", es: "" } },
  ...over,
});

describe("buildMerchantFeed", () => {
  it("includes only active products", () => {
    const feed = buildMerchantFeed([fx({ id: "a", active: true }), fx({ id: "b", slug: "b", active: false })], ORIGIN);
    expect(feed).toContain("<g:id>a</g:id>");
    expect(feed).not.toContain("<g:id>b</g:id>");
  });

  it("excludes products with no images", () => {
    const feed = buildMerchantFeed(
      [fx({ id: "a" }), fx({ id: "b", slug: "b", images: [] })],
      ORIGIN,
    );
    expect(feed).toContain("<g:id>a</g:id>");
    expect(feed).not.toContain("<g:id>b</g:id>");
  });

  it("emits required attributes with the Standard (lowest) price", () => {
    const feed = buildMerchantFeed([fx({})], ORIGIN);
    expect(feed).toContain("<g:price>191.00 USD</g:price>");
    expect(feed).toContain("<g:availability>in_stock</g:availability>");
    expect(feed).toContain("<g:condition>new</g:condition>");
    expect(feed).toContain("<g:identifier_exists>no</g:identifier_exists>");
    expect(feed).toContain("Maky The Diva Flowers");
  });

  it("builds absolute link and image_link", () => {
    const feed = buildMerchantFeed([fx({ slug: "roses" })], ORIGIN);
    expect(feed).toContain(`<g:link><![CDATA[${ORIGIN}/en/product/roses]]></g:link>`);
    expect(feed).toContain(`${ORIGIN}/products/test.jpg`);
  });

  it("maps arrangements to Fresh Cut Flowers and omits category for gifts", () => {
    const feed = buildMerchantFeed(
      [fx({ id: "arr", category: "arrangements" }), fx({ id: "gift", slug: "g", category: "gifts" })],
      ORIGIN,
    );
    expect(feed).toContain("<g:google_product_category>6248</g:google_product_category>");
    const giftItem = feed.slice(feed.indexOf("<g:id>gift</g:id>"));
    expect(giftItem.slice(0, giftItem.indexOf("</item>"))).not.toContain("google_product_category");
  });

  it("CDATA-wraps titles", () => {
    const feed = buildMerchantFeed([fx({ title: { en: "Milk & Honey", es: "x" } })], ORIGIN);
    expect(feed).toContain("<![CDATA[Milk & Honey]]>");
  });

  it("XML-escapes ampersands in URLs", () => {
    const feed = buildMerchantFeed(
      [fx({ images: [{ src: "/products/a&b.jpg", alt: { en: "", es: "" }, aspect: "4/5" }] })],
      ORIGIN,
    );
    expect(feed).toContain(`${ORIGIN}/products/a&amp;b.jpg`);
    expect(feed).not.toContain(`${ORIGIN}/products/a&b.jpg`);
  });

  it("wraps the document in an rss/channel envelope", () => {
    const feed = buildMerchantFeed([fx({})], ORIGIN);
    expect(feed).toContain('<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">');
    expect(feed).toContain("<channel>");
    expect(feed.trim().endsWith("</rss>")).toBe(true);
  });
});
