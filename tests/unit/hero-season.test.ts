// tests/unit/hero-season.test.ts
import { describe, it, expect } from "vitest";
import { heroSeason, thanksgiving } from "@/lib/hero-season";

// 16:00 UTC keeps the shop-local (America/New_York) date the same day.
const at = (iso: string) => new Date(`${iso}T16:00:00Z`);

describe("thanksgiving", () => {
  it("is the fourth Thursday of November", () => {
    expect(thanksgiving(2026)).toBe("2026-11-26");
    expect(thanksgiving(2027)).toBe("2027-11-25");
    expect(thanksgiving(2025)).toBe("2025-11-27");
  });
});

describe("heroSeason", () => {
  it("shows the fall hero from Sep 15 through Thanksgiving", () => {
    expect(heroSeason(at("2026-09-15")).key).toBe("fall");
    expect(heroSeason(at("2026-10-14")).key).toBe("fall");
    expect(heroSeason(at("2026-11-26")).key).toBe("fall");
  });

  it("falls back to the signature video outside the window", () => {
    expect(heroSeason(at("2026-09-14")).key).toBe("default");
    expect(heroSeason(at("2026-11-27")).key).toBe("default");
    expect(heroSeason(at("2027-05-10")).key).toBe("default");
  });

  it("uses the shop's local date, not UTC", () => {
    // 02:00 UTC on Sep 15 is still Sep 14 in New York.
    expect(heroSeason(new Date("2026-09-15T02:00:00Z")).key).toBe("default");
  });

  it("points each season at its own media and copy", () => {
    const fall = heroSeason(at("2026-10-14"));
    expect(fall.video).toBe("/hero/fall.mp4");
    expect(fall.copyNamespace).toBe("home.hero_fall");
    expect(heroSeason(at("2026-12-10")).video).toBe("/hero/divavideo.mp4");
  });

  it("sends the main button to the season's collection", () => {
    expect(heroSeason(at("2026-10-14")).ctaPath).toBe("/shop/fall");
    expect(heroSeason(at("2026-12-10")).ctaPath).toBe("/shop/arrangements");
  });
});
