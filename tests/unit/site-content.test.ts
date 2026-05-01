import { describe, expect, it } from "vitest";
import { SITE } from "@/data/site";

describe("SITE content", () => {
  it("exposes every §13 open-item placeholder under a stable key", () => {
    expect(SITE.brand).toBeTruthy();
    expect(SITE.founded).toBeTypeOf("number");
    expect(SITE.phoneDisplay).toMatch(/\d{3}\s?\d{3}\s?\d{4}/);
    expect(SITE.address.line1).toBeTruthy();
    expect(SITE.cutoffTime).toBeTruthy();
    expect(SITE.cutoff24).toMatch(/^\d{2}:\d{2}$/);
    expect(SITE.tagline.en).toBeTruthy();
    expect(SITE.tagline.es).toBeTruthy();
    expect(SITE.metadata.title.en).toBeTruthy();
    expect(SITE.metadata.title.es).toBeTruthy();
  });

  it("exposes marquee tokens as a non-empty array", () => {
    expect(Array.isArray(SITE.marquee.tokens)).toBe(true);
    expect(SITE.marquee.tokens.length).toBeGreaterThan(0);
  });
});
