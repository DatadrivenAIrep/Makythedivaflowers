import { describe, it, expect, vi } from "vitest";
import type { Product } from "@/types/product";

// Control photo sizes: "/big/*" is TV quality, "/small/*" is not, anything else unmeasured.
vi.mock("@/lib/product-image-dims", () => ({
  productImageDims: (src: string) =>
    src.startsWith("/big/") ? { width: 1800, height: 2400 } : src.startsWith("/small/") ? { width: 500, height: 600 } : null,
}));

import {
  buildShowcase,
  defaultTvVisible,
  formatUsd,
  hasTvQualityCover,
  isTvVisible,
  showcasePrice,
  showcaseUrl,
} from "@/lib/tv-showcase";

function product(over: Partial<Product> & { id: string }): Product {
  return {
    slug: over.id,
    addedAt: "2026-10-01",
    title: { en: `${over.id} EN`, es: `${over.id} ES` },
    category: "arrangements",
    blurb: { en: "", es: "" },
    description: { en: "", es: "" },
    images: [{ src: `/big/${over.id}.jpg`, alt: { en: "", es: "" }, aspect: "4/5" }],
    variants: [{ id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 8500 }],
    tags: [],
    occasions: [],
    colorFamily: [],
    active: true,
    seo: { title: { en: "", es: "" }, description: { en: "", es: "" } },
    ...over,
  };
}

const NONE = new Map<string, boolean>();
const NOW = new Date("2026-10-15T12:00:00Z");

describe("formatUsd", () => {
  it("drops cents on whole dollars and groups thousands", () => {
    expect(formatUsd(8500)).toBe("$85");
    expect(formatUsd(108000)).toBe("$1,080");
  });
  it("keeps cents when not whole", () => {
    expect(formatUsd(8550)).toBe("$85.50");
  });
});

describe("showcasePrice", () => {
  it("uses the lowest variant", () => {
    const p = product({
      id: "a",
      variants: [
        { id: "grand", label: { en: "", es: "" }, priceCents: 12000 },
        { id: "standard", label: { en: "", es: "" }, priceCents: 9500 },
      ],
    });
    expect(showcasePrice(p)).toEqual({ en: "From $95", es: "Desde $95" });
  });
  it("says made to order for quote-only pieces", () => {
    expect(showcasePrice(product({ id: "q", quoteOnly: true }))).toEqual({ en: "Made to order", es: "Por encargo" });
  });
});

describe("showcaseUrl", () => {
  it("points at the English PDP with the shop-TV UTM", () => {
    expect(showcaseUrl("ivory-and-emerald")).toBe(
      "https://makythedivaflowers.com/en/product/ivory-and-emerald?utm_source=tienda-tv&utm_medium=qr",
    );
  });
});

describe("visibility", () => {
  it("hides sympathy by default, shows the rest", () => {
    expect(defaultTvVisible(product({ id: "s", category: "sympathy" }))).toBe(false);
    expect(defaultTvVisible(product({ id: "a" }))).toBe(true);
  });
  it("an explicit row wins over the default", () => {
    const s = product({ id: "s", category: "sympathy" });
    const a = product({ id: "a" });
    const rows = new Map([["s", true], ["a", false]]);
    expect(isTvVisible(s, rows)).toBe(true);
    expect(isTvVisible(a, rows)).toBe(false);
  });
});

describe("hasTvQualityCover", () => {
  it("needs a measured cover at least 900px tall", () => {
    expect(hasTvQualityCover(product({ id: "a" }))).toBe(true);
    expect(hasTvQualityCover(product({ id: "b", images: [{ src: "/small/b.jpg", alt: { en: "", es: "" }, aspect: "4/5" }] }))).toBe(false);
    expect(hasTvQualityCover(product({ id: "c", images: [{ src: "/uploads/c.jpg", alt: { en: "", es: "" }, aspect: "4/5" }] }))).toBe(false);
    expect(hasTvQualityCover(product({ id: "d", images: [] }))).toBe(false);
  });
});

describe("buildShowcase", () => {
  it("keeps only available, visible, TV-quality products", () => {
    const products = [
      product({ id: "ok" }),
      product({ id: "inactive", active: false }),
      product({ id: "extra", giftExtra: true }),
      product({ id: "offseason", seasonMonths: [2] }),
      product({ id: "funeral", category: "sympathy" }),
      product({ id: "lowres", images: [{ src: "/small/x.jpg", alt: { en: "", es: "" }, aspect: "4/5" }] }),
      product({ id: "hidden" }),
    ];
    const visibility = new Map([["hidden", false]]);
    const ids = buildShowcase(products, { visibility, sales: new Map(), now: NOW }).map((s) => s.id);
    expect(ids).toEqual(["ok"]);
  });

  it("the photo gate beats an explicit show row", () => {
    const p = product({ id: "lowres", images: [{ src: "/small/x.jpg", alt: { en: "", es: "" }, aspect: "4/5" }] });
    expect(buildShowcase([p], { visibility: new Map([["lowres", true]]), sales: new Map(), now: NOW })).toEqual([]);
  });

  it("orders best sellers first, like the shop's Recommended", () => {
    const products = [product({ id: "a" }), product({ id: "b" }), product({ id: "c" })];
    const sales = new Map([["c", 5], ["b", 2]]);
    expect(buildShowcase(products, { visibility: NONE, sales, now: NOW }).map((s) => s.id)).toEqual(["c", "b", "a"]);
  });

  it("maps a product to a slide", () => {
    const [slide] = buildShowcase([product({ id: "ivory", slug: "ivory-and-emerald" })], { visibility: NONE, sales: new Map(), now: NOW });
    expect(slide).toEqual({
      id: "ivory",
      slug: "ivory-and-emerald",
      src: "/big/ivory.jpg",
      width: 1800,
      height: 2400,
      nameEn: "ivory EN",
      nameEs: "ivory ES",
      price: { en: "From $85", es: "Desde $85" },
      url: "https://makythedivaflowers.com/en/product/ivory-and-emerald?utm_source=tienda-tv&utm_medium=qr",
    });
  });
});
