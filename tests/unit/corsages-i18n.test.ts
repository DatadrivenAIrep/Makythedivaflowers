import { describe, it, expect } from "vitest";
import en from "@/messages/en.json";
import es from "@/messages/es.json";

const CORSAGES_KEYS = [
  "page_title",
  "meta_description",
  "hero_eyebrow",
  "hero_title",
  "hero_sub",
  "pieces_eyebrow",
  "pieces_title",
  "reserve_this",
  "how_eyebrow",
  "how_title",
  "how_step1_title",
  "how_step1_body",
  "how_step2_title",
  "how_step2_body",
  "how_step3_title",
  "how_step3_body",
  "cta_title",
  "cta_button",
] as const;

const BENTO_CORSAGES_KEYS = ["eyebrow", "title", "count", "cta"] as const;

describe("corsages i18n", () => {
  it("en.json has all corsages.* keys", () => {
    const corsages = (en as Record<string, unknown>).corsages as Record<string, string>;
    expect(corsages).toBeDefined();
    for (const key of CORSAGES_KEYS) {
      expect(typeof corsages[key], `en.corsages.${key}`).toBe("string");
      expect(corsages[key].trim().length, `en.corsages.${key} is empty`).toBeGreaterThan(0);
    }
  });

  it("es.json has all corsages.* keys", () => {
    const corsages = (es as Record<string, unknown>).corsages as Record<string, string>;
    expect(corsages).toBeDefined();
    for (const key of CORSAGES_KEYS) {
      expect(typeof corsages[key], `es.corsages.${key}`).toBe("string");
      expect(corsages[key].trim().length, `es.corsages.${key} is empty`).toBeGreaterThan(0);
    }
  });

  it("en.json has home.bento.corsages.* keys", () => {
    const bento = ((en as Record<string, unknown>).home as Record<string, unknown>)
      .bento as Record<string, unknown>;
    const tile = bento.corsages as Record<string, string>;
    expect(tile).toBeDefined();
    for (const key of BENTO_CORSAGES_KEYS) {
      expect(typeof tile[key], `en.home.bento.corsages.${key}`).toBe("string");
    }
  });

  it("es.json has home.bento.corsages.* keys", () => {
    const bento = ((es as Record<string, unknown>).home as Record<string, unknown>)
      .bento as Record<string, unknown>;
    const tile = bento.corsages as Record<string, string>;
    expect(tile).toBeDefined();
    for (const key of BENTO_CORSAGES_KEYS) {
      expect(typeof tile[key], `es.home.bento.corsages.${key}`).toBe("string");
    }
  });
});
