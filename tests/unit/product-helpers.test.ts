import { describe, it, expect } from "vitest";
import {
  startingPriceCents,
  filterProducts,
  sortProducts,
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

  it("hides inactive products", () => {
    expect(filterProducts([a, b, c], {} as Filter).map((p) => p.id)).toEqual(["a", "b"]);
  });

  it("filters by occasion", () => {
    const r = filterProducts([a, b, c], { occasion: "romance" } as Filter);
    expect(r.map((p) => p.id)).toEqual(["a"]);
  });

  it("filters by color", () => {
    const r = filterProducts([a, b, c], { color: "red" } as Filter);
    expect(r.map((p) => p.id)).toEqual(["b"]);
  });

  it("filters by same-day", () => {
    const r = filterProducts([a, b, c], { sameDay: true } as Filter);
    expect(r.map((p) => p.id)).toEqual(["a"]);
  });

  it("filters by price band: under-$200", () => {
    const r = filterProducts([a, b, c], { price: "under-200" } as Filter);
    expect(r.map((p) => p.id)).toEqual(["a"]);
  });

  it("filters by price band: 200-300", () => {
    const r = filterProducts([a, b, c], { price: "200-300" } as Filter);
    expect(r.map((p) => p.id)).toEqual(["b"]);
  });

  it("filters by price band: 300-plus", () => {
    const r = filterProducts([a, b, c], { price: "300-plus" } as Filter);
    expect(r.map((p) => p.id)).toEqual([]);
  });

  it("combines filters with AND", () => {
    const r = filterProducts([a, b, c], { color: "pink", sameDay: true } as Filter);
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
