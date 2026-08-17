import { describe, it, expect } from "vitest";
import { buildProductJsonLd } from "@/lib/product-jsonld";
import type { Product } from "@/types/product";

const ORIGIN = "https://makythedivaflowers.com";

const fx = (over: Partial<Product> = {}): Product => ({
  id: "p1",
  slug: "roses",
  title: { en: "Roses", es: "Rosas" },
  category: "bouquets",
  blurb: { en: "", es: "" },
  description: { en: "Red roses.", es: "Rosas rojas." },
  images: [{ src: "/products/roses.jpg", alt: { en: "", es: "" }, aspect: "4/5" }],
  variants: [
    { id: "standard", label: { en: "S", es: "S" }, priceCents: 7900 },
    { id: "lush", label: { en: "L", es: "L" }, priceCents: 10500 },
  ],
  tags: [],
  occasions: [],
  colorFamily: [],
  active: true,
  seo: { title: { en: "", es: "" }, description: { en: "", es: "" } },
  ...over,
});

describe("buildProductJsonLd", () => {
  it("uses the merchant brand name", () => {
    const data = buildProductJsonLd(fx(), "en", ORIGIN);
    expect(data.brand.name).toBe("Maky The Diva Flowers");
  });

  it("sets lowPrice to the Standard (lowest) variant", () => {
    const data = buildProductJsonLd(fx(), "en", ORIGIN);
    expect(data.offers?.lowPrice).toBe("79.00");
    expect(data.offers?.priceCurrency).toBe("USD");
    expect(data.offers?.itemCondition).toBe("https://schema.org/NewCondition");
  });

  it("omits the offer entirely for quote-only products", () => {
    const data = buildProductJsonLd(fx({ quoteOnly: true }), "en", ORIGIN);
    expect(data.offers).toBeUndefined();
  });

  it("emits absolute image URLs", () => {
    const data = buildProductJsonLd(fx(), "en", ORIGIN);
    expect(data.image).toEqual([`${ORIGIN}/products/roses.jpg`]);
  });

  it("links a merchant return policy", () => {
    const data = buildProductJsonLd(fx(), "en", ORIGIN);
    expect(data.hasMerchantReturnPolicy.merchantReturnLink).toBe(`${ORIGIN}/en/legal/returns`);
    expect(data.hasMerchantReturnPolicy.applicableCountry).toBe("US");
  });

  it("marks inactive products out of stock", () => {
    const data = buildProductJsonLd(fx({ active: false }), "en", ORIGIN);
    expect(data.offers?.availability).toBe("https://schema.org/OutOfStock");
  });
});
