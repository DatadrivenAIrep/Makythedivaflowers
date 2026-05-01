import { describe, it, expect } from "vitest";
import { parseFilterParams, serializeFilterParams } from "@/lib/search-params";

describe("parseFilterParams", () => {
  it("returns empty filter + default sort for empty params", () => {
    const r = parseFilterParams({});
    expect(r.filter).toEqual({});
    expect(r.sort).toBe("newest");
  });

  it("ignores unknown values", () => {
    const r = parseFilterParams({
      occasion: "wat",
      color: "neon",
      sort: "garbage",
      same_day: "maybe",
    });
    expect(r.filter).toEqual({});
    expect(r.sort).toBe("newest");
  });

  it("parses every supported field", () => {
    const r = parseFilterParams({
      occasion: "romance",
      color: "pink",
      size: "grand",
      price: "200-300",
      same_day: "1",
      sort: "price-asc",
    });
    expect(r.filter).toEqual({
      occasion: "romance",
      color: "pink",
      size: "grand",
      price: "200-300",
      sameDay: true,
    });
    expect(r.sort).toBe("price-asc");
  });
});

describe("serializeFilterParams", () => {
  it("omits undefined values", () => {
    const s = serializeFilterParams({ filter: {}, sort: "newest" });
    expect(s).toBe("");
  });

  it("serializes set fields including same_day", () => {
    const s = serializeFilterParams({
      filter: { occasion: "romance", sameDay: true },
      sort: "price-asc",
    });
    expect(new URLSearchParams(s).get("occasion")).toBe("romance");
    expect(new URLSearchParams(s).get("same_day")).toBe("1");
    expect(new URLSearchParams(s).get("sort")).toBe("price-asc");
  });

  it("round-trips", () => {
    const original = {
      filter: { occasion: "anniversary", color: "red", price: "300-plus", sameDay: true },
      sort: "price-desc",
    } as const;
    const s = serializeFilterParams(original);
    const params = Object.fromEntries(new URLSearchParams(s));
    expect(parseFilterParams(params)).toEqual(original);
  });
});
