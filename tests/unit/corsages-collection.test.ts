import { describe, it, expect } from "vitest";
import { CORSAGE_PIECES, type CorsagePiece } from "@/data/corsages-collection";

describe("CORSAGE_PIECES", () => {
  it("has exactly 4 pieces", () => {
    expect(CORSAGE_PIECES).toHaveLength(4);
  });

  it("piece ids are unique", () => {
    const ids = CORSAGE_PIECES.map((p) => p.id);
    expect(new Set(ids).size).toBe(4);
  });

  it("each piece has required fields", () => {
    CORSAGE_PIECES.forEach((p: CorsagePiece) => {
      expect(typeof p.id).toBe("string");
      expect(typeof p.priceUSD).toBe("number");
      expect(p.priceUSD).toBeGreaterThan(0);
      expect(typeof p.name.en).toBe("string");
      expect(typeof p.name.es).toBe("string");
      expect(typeof p.description.en).toBe("string");
      expect(typeof p.description.es).toBe("string");
      expect(p.image.src.startsWith("/corsages/")).toBe(true);
      expect(typeof p.image.alt.en).toBe("string");
      expect(typeof p.image.alt.es).toBe("string");
    });
  });

  it("covers rose and orchid flowers", () => {
    const flowers = new Set(CORSAGE_PIECES.map((p) => p.flower));
    expect(flowers.has("rose")).toBe(true);
    expect(flowers.has("orchid")).toBe(true);
  });

  it("covers corsage and boutonniere types", () => {
    const types = new Set(CORSAGE_PIECES.map((p) => p.type));
    expect(types.has("corsage")).toBe(true);
    expect(types.has("boutonniere")).toBe(true);
  });

  it("prices match spec: rose corsage $35, rose boutonniere $15, orchid corsage $45, orchid boutonniere $25", () => {
    const map = Object.fromEntries(CORSAGE_PIECES.map((p) => [p.id, p.priceUSD]));
    expect(map["rose-corsage"]).toBe(35);
    expect(map["rose-boutonniere"]).toBe(15);
    expect(map["orchid-corsage"]).toBe(45);
    expect(map["orchid-boutonniere"]).toBe(25);
  });
});
