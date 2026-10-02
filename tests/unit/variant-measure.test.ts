import { describe, it, expect } from "vitest";
import type { Product } from "@/types/product";
import { baseInches, baseSizeLabel, baseSizeShort } from "@/lib/variant-measure";

const label = { en: "", es: "" };
const product = (category: Product["category"], ids: string[]) =>
  ({ category, variants: ids.map((id) => ({ id, label, priceCents: 1000 })) }) as unknown as Product;

const arrangement = product("arrangements", ["standard", "grand", "diva"]);

describe("base size of an arrangement", () => {
  it.each([
    ["standard", 5],
    ["grand", 6],
    ["diva", 8],
  ])("%s is built on a %i inch base", (id, inches) => {
    expect(baseInches(arrangement, { id })).toBe(inches);
  });

  it("is told to the shopper in both languages", () => {
    expect(baseSizeLabel(arrangement, { id: "grand" })).toEqual({
      en: "6″ × 6″ base",
      es: "Base de 6″ × 6″",
    });
  });

  it("is short on the work sheet, where space is tight", () => {
    expect(baseSizeShort(arrangement, { id: "diva" })).toBe("8×8");
  });

  it("is not claimed for a hand-tied bouquet, which has no base", () => {
    const bouquet = product("bouquets", ["standard", "grand", "diva"]);
    expect(baseInches(bouquet, { id: "standard" })).toBeNull();
    expect(baseSizeLabel(bouquet, { id: "standard" })).toBeNull();
    expect(baseSizeShort(bouquet, { id: "standard" })).toBeNull();
  });

  it("is not claimed for an arrangement sold in a single size", () => {
    expect(baseInches(product("arrangements", ["standard"]), { id: "standard" })).toBeNull();
  });

  it("is not claimed for the first-batch size names", () => {
    const firstBatch = product("arrangements", ["standard", "lush", "opulent"]);
    expect(baseInches(firstBatch, { id: "standard" })).toBeNull();
  });
});
