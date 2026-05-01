import { describe, it, expect } from "vitest";
import {
  startingPriceCents,
  filterProducts,
  sortProducts,
  productsByCategory,
  newestArrivals,
  type Filter,
  type Sort,
} from "@/data/product-helpers";
import type { Product } from "@/types/product";

const fx = (over: Partial<Product>): Product => ({
  id: over.id ?? "x",
  slug: over.slug ?? "x",
  title: { en: "x", es: "x" },
  category: over.category ?? "arrangements",
  blurb: { en: "", es: "" },
  description: { en: "", es: "" },
  images: [],
  variants: over.variants ?? [{ id: "s", label: { en: "S", es: "S" }, priceCents: 15000 }],
  tags: over.tags ?? [],
  occasions: over.occasions ?? [],
  colorFamily: over.colorFamily ?? [],
  active: over.active ?? true,
  seo: { title: { en: "", es: "" }, description: { en: "", es: "" } },
  ...over,
});

describe("startingPriceCents", () => {
  it("returns the cheapest variant price", () => {
    const p = fx({
      variants: [
        { id: "s", label: { en: "S", es: "S" }, priceCents: 22000 },
        { id: "m", label: { en: "M", es: "M" }, priceCents: 15000 },
        { id: "l", label: { en: "L", es: "L" }, priceCents: 31000 },
      ],
    });
    expect(startingPriceCents(p)).toBe(15000);
  });
});

describe("filterProducts", () => {
  const a = fx({
    id: "a",
    occasions: ["romance"],
    colorFamily: ["pink"],
    tags: ["same-day"],
    variants: [{ id: "s", label: { en: "", es: "" }, priceCents: 12000 }],
  });
  const b = fx({
    id: "b",
    occasions: ["birthday"],
    colorFamily: ["red"],
    tags: [],
    variants: [{ id: "s", label: { en: "", es: "" }, priceCents: 28000 }],
  });
  const c = fx({
    id: "c",
    occasions: ["sympathy"],
    colorFamily: ["white"],
    tags: ["same-day"],
    variants: [{ id: "s", label: { en: "", es: "" }, priceCents: 38000 }],
    active: false,
  });
  const d = fx({
    id: "d",
    occasions: ["congrats"],
    colorFamily: ["white"],
    tags: [],
    variants: [{ id: "s", label: { en: "", es: "" }, priceCents: 38000 }],
    active: true,
  });

  it("hides inactive products", () => {
    expect(filterProducts([a, b, c, d], {} as Filter).map((p) => p.id)).toEqual(["a", "b", "d"]);
  });

  it("filters by occasion", () => {
    const r = filterProducts([a, b, c, d], { occasion: "romance" } as Filter);
    expect(r.map((p) => p.id)).toEqual(["a"]);
  });

  it("filters by color", () => {
    const r = filterProducts([a, b, c, d], { color: "red" } as Filter);
    expect(r.map((p) => p.id)).toEqual(["b"]);
  });

  it("filters by same-day", () => {
    const r = filterProducts([a, b, c, d], { sameDay: true } as Filter);
    expect(r.map((p) => p.id)).toEqual(["a"]);
  });

  it("filters by price band: under-$200", () => {
    const r = filterProducts([a, b, c, d], { price: "under-200" } as Filter);
    expect(r.map((p) => p.id)).toEqual(["a"]);
  });

  it("filters by price band: 200-300", () => {
    const r = filterProducts([a, b, c, d], { price: "200-300" } as Filter);
    expect(r.map((p) => p.id)).toEqual(["b"]);
  });

  it("filters by price band: 300-plus", () => {
    const r = filterProducts([a, b, c, d], { price: "300-plus" } as Filter);
    expect(r.map((p) => p.id)).toEqual(["d"]);
  });

  it("combines filters with AND", () => {
    const r = filterProducts([a, b, c, d], { color: "pink", sameDay: true } as Filter);
    expect(r.map((p) => p.id)).toEqual(["a"]);
  });
});

describe("sortProducts", () => {
  const p1 = fx({ id: "p1", variants: [{ id: "s", label: { en: "", es: "" }, priceCents: 20000 }], tags: [] });
  const p2 = fx({ id: "p2", variants: [{ id: "s", label: { en: "", es: "" }, priceCents: 10000 }], tags: ["new"] });
  const p3 = fx({ id: "p3", variants: [{ id: "s", label: { en: "", es: "" }, priceCents: 30000 }], tags: [] });

  it("price-asc", () => {
    expect(sortProducts([p1, p2, p3], "price-asc" as Sort).map((p) => p.id)).toEqual(["p2", "p1", "p3"]);
  });
  it("price-desc", () => {
    expect(sortProducts([p1, p2, p3], "price-desc" as Sort).map((p) => p.id)).toEqual(["p3", "p1", "p2"]);
  });
  it("newest puts tagged 'new' first", () => {
    expect(sortProducts([p1, p2, p3], "newest" as Sort).map((p) => p.id)[0]).toBe("p2");
  });
});

describe("sortProducts staff-pick", () => {
  const p1 = fx({ id: "p1", variants: [{ id: "s", label: { en: "", es: "" }, priceCents: 20000 }], tags: [] });
  const p2 = fx({ id: "p2", variants: [{ id: "s", label: { en: "", es: "" }, priceCents: 10000 }], tags: ["staff-pick"] });
  const p3 = fx({ id: "p3", variants: [{ id: "s", label: { en: "", es: "" }, priceCents: 30000 }], tags: [] });

  it("staff-pick puts tagged products first", () => {
    const result = sortProducts([p1, p2, p3], "staff-pick" as Sort);
    expect(result[0].id).toBe("p2");
  });
});

describe("productsByCategory", () => {
  const arr = fx({ id: "arr", category: "arrangements" });
  const bou = fx({ id: "bou", category: "bouquets" });
  const inact = fx({ id: "inact", category: "arrangements", active: false });

  it("returns only active products in the given category", () => {
    const result = productsByCategory([arr, bou, inact], "arrangements");
    expect(result.map((p) => p.id)).toEqual(["arr"]);
  });
});

describe("newestArrivals", () => {
  const n1 = fx({ id: "n1", tags: ["new"] });
  const n2 = fx({ id: "n2", tags: [] });
  const n3 = fx({ id: "n3", tags: ["new"] });
  const inact = fx({ id: "inact", tags: ["new"], active: false });

  it("puts 'new'-tagged products first and excludes inactive", () => {
    const result = newestArrivals([n2, n1, n3, inact]);
    expect(result.map((p) => p.id)).not.toContain("inact");
    expect(result[0].id === "n1" || result[0].id === "n3").toBe(true);
  });

  it("respects the limit", () => {
    const many = Array.from({ length: 10 }, (_, i) => fx({ id: `p${i}` }));
    expect(newestArrivals(many, 5)).toHaveLength(5);
  });
});
