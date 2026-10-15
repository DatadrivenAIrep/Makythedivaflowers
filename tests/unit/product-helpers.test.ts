import { describe, it, expect } from "vitest";
import {
  startingPriceCents,
  filterProducts,
  sortProducts,
  productsByCategory,
  newestArrivals,
  isNewArrival,
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
  // Extra fixtures exist only for the price-band cases below, so the
  // membership assertions above keep their original [a, b, c, d] input.
  const e = fx({
    id: "e",
    occasions: ["birthday"],
    colorFamily: ["mixed"],
    tags: [],
    variants: [{ id: "s", label: { en: "", es: "" }, priceCents: 8500 }],
  });
  const f = fx({
    id: "f",
    occasions: ["birthday"],
    colorFamily: ["mixed"],
    tags: [],
    variants: [{ id: "s", label: { en: "", es: "" }, priceCents: 17500 }],
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

  it("filters by price band: under-$100", () => {
    const r = filterProducts([a, b, d, e, f], { price: "under-100" } as Filter);
    expect(r.map((p) => p.id)).toEqual(["e"]);
  });

  it("filters by price band: $100-$150", () => {
    const r = filterProducts([a, b, d, e, f], { price: "100-150" } as Filter);
    expect(r.map((p) => p.id)).toEqual(["a"]);
  });

  it("filters by price band: $150-$200", () => {
    const r = filterProducts([a, b, d, e, f], { price: "150-200" } as Filter);
    expect(r.map((p) => p.id)).toEqual(["f"]);
  });

  it("filters by price band: $200+", () => {
    const r = filterProducts([a, b, d, e, f], { price: "200-plus" } as Filter);
    expect(r.map((p) => p.id)).toEqual(["b", "d"]);
  });

  it("bands are contiguous: every product lands in exactly one band", () => {
    const all = [a, b, d, e, f];
    const bands = ["under-100", "100-150", "150-200", "200-plus"] as const;
    const hits = all.map(
      (p) => bands.filter((band) => filterProducts([p], { price: band } as Filter).length === 1).length,
    );
    expect(hits).toEqual([1, 1, 1, 1, 1]);
  });

  it("combines filters with AND", () => {
    const r = filterProducts([a, b, c, d], { color: "pink", sameDay: true } as Filter);
    expect(r.map((p) => p.id)).toEqual(["a"]);
  });
});

const priced = (cents: number) => [{ id: "s", label: { en: "", es: "" }, priceCents: cents }];

describe("sortProducts", () => {
  const p1 = fx({ id: "p1", variants: priced(20000), addedAt: "2026-05-01" });
  const p2 = fx({ id: "p2", variants: priced(10000), addedAt: "2026-10-14" });
  const p3 = fx({ id: "p3", variants: priced(30000), addedAt: "2026-09-11" });

  it("price-asc", () => {
    expect(sortProducts([p1, p2, p3], "price-asc" as Sort).map((p) => p.id)).toEqual(["p2", "p1", "p3"]);
  });
  it("price-desc", () => {
    expect(sortProducts([p1, p2, p3], "price-desc" as Sort).map((p) => p.id)).toEqual(["p3", "p1", "p2"]);
  });
  it("newest orders by the day the product joined the catalog", () => {
    expect(sortProducts([p1, p2, p3], "newest").map((p) => p.id)).toEqual(["p2", "p3", "p1"]);
  });
});

describe("sortProducts recommended", () => {
  const old = fx({ id: "old", addedAt: "2026-05-01" });
  const fresh = fx({ id: "fresh", addedAt: "2026-10-14" });
  const pick = fx({ id: "pick", addedAt: "2026-05-01", tags: ["staff-pick"] });
  const premium = fx({ id: "premium", addedAt: "2026-10-14", variants: priced(108000) });
  const funeral = fx({ id: "funeral", category: "sympathy", addedAt: "2026-10-14", tags: ["staff-pick"] });
  const ids = (ps: Product[]) => ps.map((p) => p.id);

  it("without sales: staff picks, then newest, premium last", () => {
    expect(ids(sortProducts([old, premium, fresh, pick], "recommended"))).toEqual(["pick", "fresh", "old", "premium"]);
  });

  it("sold products come first, by sales score, whatever their price", () => {
    const sales = new Map([["old", 1], ["premium", 3]]);
    expect(ids(sortProducts([pick, old, fresh, premium], "recommended", { sales }))).toEqual([
      "premium", "old", "pick", "fresh",
    ]);
  });

  it("demoteSympathy sends funeral pieces after everything else, even best sellers", () => {
    const sales = new Map([["funeral", 9]]);
    const r = sortProducts([funeral, old, premium], "recommended", { sales, demoteSympathy: true });
    expect(ids(r)).toEqual(["old", "premium", "funeral"]);
    expect(ids(sortProducts([old, funeral], "recommended", { sales }))[0]).toBe("funeral");
  });
});

describe("size filter", () => {
  const tiers = (...ids: string[]) => ids.map((id) => ({ id, label: { en: id, es: id }, priceCents: 10000 }));
  const classic = fx({ id: "classic", variants: tiers("standard", "grand", "diva") });
  const lush = fx({ id: "lush", variants: tiers("standard", "lush", "opulent") });
  const single = fx({ id: "single", variants: tiers("standing") });

  it("treats lush/opulent as the grand/diva tiers", () => {
    expect(filterProducts([classic, lush, single], { size: "grand" }).map((p) => p.id)).toEqual(["classic", "lush"]);
    expect(filterProducts([classic, lush, single], { size: "diva" }).map((p) => p.id)).toEqual(["classic", "lush"]);
    expect(filterProducts([classic, lush, single], { size: "standard" }).map((p) => p.id)).toEqual(["classic", "lush"]);
  });
});

describe("isNewArrival", () => {
  const now = new Date("2026-10-15T12:00:00Z");
  it("is new for 30 days after joining the catalog", () => {
    expect(isNewArrival(fx({ addedAt: "2026-10-14" }), now)).toBe(true);
    expect(isNewArrival(fx({ addedAt: "2026-09-15" }), now)).toBe(true);
    expect(isNewArrival(fx({ addedAt: "2026-09-11" }), now)).toBe(false);
    expect(isNewArrival(fx({}), now)).toBe(false);
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
  const n1 = fx({ id: "n1", addedAt: "2026-10-07" });
  const n2 = fx({ id: "n2", addedAt: "2026-05-01" });
  const n3 = fx({ id: "n3", addedAt: "2026-10-14" });
  const inact = fx({ id: "inact", addedAt: "2026-10-15", active: false });

  it("orders by date added and excludes inactive", () => {
    expect(newestArrivals([n2, n1, n3, inact]).map((p) => p.id)).toEqual(["n3", "n1", "n2"]);
  });

  it("respects the limit", () => {
    const many = Array.from({ length: 10 }, (_, i) => fx({ id: `p${i}` }));
    expect(newestArrivals(many, 5)).toHaveLength(5);
  });
});

describe("Occasion 'mothers-day' value", () => {
  it("filters products by the mothers-day occasion", () => {
    const target = fx({ id: "md-1", occasions: ["mothers-day"] });
    const other = fx({ id: "other", occasions: ["birthday"] });
    const filtered = filterProducts([target, other], { occasion: "mothers-day" });
    expect(filtered.map((p) => p.id)).toEqual(["md-1"]);
  });
});
