import { describe, it, expect } from "vitest";
import { weddingPortfolio, type PortfolioPhoto } from "@/data/wedding-portfolio";
import fs from "node:fs";
import path from "node:path";

describe("wedding-portfolio", () => {
  it("has exactly 17 entries", () => {
    expect(weddingPortfolio).toHaveLength(17);
  });

  it("has the expected layout sequence: 5 mosaic, hero, 5 mosaic, hero, 5 mosaic", () => {
    const layouts = weddingPortfolio.map((p) => p.layout);
    expect(layouts).toEqual([
      "mosaic", "mosaic", "mosaic", "mosaic", "mosaic",
      "hero",
      "mosaic", "mosaic", "mosaic", "mosaic", "mosaic",
      "hero",
      "mosaic", "mosaic", "mosaic", "mosaic", "mosaic",
    ]);
  });

  it("has unique ids", () => {
    const ids = weddingPortfolio.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(["4/5", "1/1", "16/9", "3/4"] as const)("only uses allowed aspect %s when present", (aspect) => {
    const allowed = new Set(["4/5", "1/1", "16/9", "3/4"]);
    weddingPortfolio.forEach((p: PortfolioPhoto) => {
      expect(allowed.has(p.aspect)).toBe(true);
    });
  });

  it("references files that exist in public/weddings/", () => {
    weddingPortfolio.forEach((p) => {
      expect(p.src).toMatch(/^\/weddings\/\d{2}\.webp$/);
      const filePath = path.join(process.cwd(), "public", p.src);
      expect(fs.existsSync(filePath), `missing file: ${filePath}`).toBe(true);
    });
  });

  it("has non-empty bilingual alt text for every photo", () => {
    weddingPortfolio.forEach((p) => {
      expect(p.alt.en.trim().length).toBeGreaterThan(0);
      expect(p.alt.es.trim().length).toBeGreaterThan(0);
    });
  });
});
