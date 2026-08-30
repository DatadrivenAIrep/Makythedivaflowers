import { describe, it, expect } from "vitest";
import { buildProductJsonLd } from "@/lib/product-jsonld";
import type { Product } from "@/types/product";
import { SITE } from "@/data/site";

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

  it("states the real price range, not just the floor", () => {
    const data = buildProductJsonLd(fx(), "en", ORIGIN);
    expect(data.offers?.lowPrice).toBe("79.00");
    expect(data.offers?.highPrice).toBe("105.00");
    expect(data.offers?.offerCount).toBe(2);
  });

  it("carries a return policy Google will accept, inside the offer", () => {
    const rp = buildProductJsonLd(fx(), "en", ORIGIN).offers?.hasMerchantReturnPolicy;
    // Without returnPolicyCategory the whole policy is dropped as invalid, and
    // the old markup implied returns were accepted when flowers are perishable
    // and they are not.
    expect(rp?.returnPolicyCategory).toBe("https://schema.org/MerchantReturnNotPermitted");
    expect(rp?.merchantReturnLink).toBe(`${ORIGIN}/en/legal/returns`);
    expect(rp?.applicableCountry).toBe("US");
  });

  it("declares delivery matching what we actually charge", () => {
    const sd = buildProductJsonLd(fx(), "en", ORIGIN).offers?.shippingDetails;
    expect(sd?.shippingRate.minValue).toBe(10);
    expect(sd?.shippingRate.maxValue).toBe(25);
    expect(sd?.shippingDestination.addressRegion).toBe("NY");
  });

  it("carries sku and seller so the offer resolves to a real business", () => {
    const data = buildProductJsonLd(fx(), "en", ORIGIN);
    expect(data.sku).toBe("p1");
    expect(data.seller).toEqual({ "@id": SITE.ld.businessId });
  });

  it("marks inactive products out of stock", () => {
    const data = buildProductJsonLd(fx({ active: false }), "en", ORIGIN);
    expect(data.offers?.availability).toBe("https://schema.org/OutOfStock");
  });

  it("marks out-of-season products out of stock rather than advertising them", () => {
    const june = new Date(2026, 5, 15);
    const peonies = fx({ seasonMonths: [5, 6] });
    expect(buildProductJsonLd(peonies, "en", ORIGIN, june).offers?.availability).toBe(
      "https://schema.org/InStock",
    );
    const december = new Date(2026, 11, 15);
    expect(buildProductJsonLd(peonies, "en", ORIGIN, december).offers?.availability).toBe(
      "https://schema.org/OutOfStock",
    );
  });

  it("keeps priceValidUntil in the future", () => {
    const now = new Date(2026, 0, 15);
    const d = buildProductJsonLd(fx(), "en", ORIGIN, now).offers?.priceValidUntil;
    expect(d).toBe("2027-01-15");
  });
});
