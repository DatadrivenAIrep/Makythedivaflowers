import { describe, it, expect } from "vitest";
import { weddingEvents, type WeddingEvent } from "@/data/wedding-events";

describe("weddingEvents", () => {
  it("has at least one event", () => {
    expect(weddingEvents.length).toBeGreaterThanOrEqual(1);
  });

  it("each event has all required fields", () => {
    weddingEvents.forEach((e: WeddingEvent) => {
      expect(typeof e.id).toBe("string");
      expect(e.id.trim().length).toBeGreaterThan(0);
      expect(typeof e.venue.en).toBe("string");
      expect(typeof e.venue.es).toBe("string");
      expect(typeof e.date.en).toBe("string");
      expect(typeof e.date.es).toBe("string");
      expect(typeof e.heroSrc).toBe("string");
      expect(e.heroSrc.startsWith("/")).toBe(true);
      expect(typeof e.heroAlt.en).toBe("string");
      expect(typeof e.heroAlt.es).toBe("string");
      expect(Array.isArray(e.photos)).toBe(true);
      expect(e.photos.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("event ids are unique", () => {
    const ids = weddingEvents.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("each photo has a src and bilingual alt", () => {
    weddingEvents.forEach((e: WeddingEvent) => {
      e.photos.forEach((p) => {
        expect(typeof p.src).toBe("string");
        expect(p.src.length).toBeGreaterThan(0);
        expect(p.alt.en.trim().length).toBeGreaterThan(0);
        expect(p.alt.es.trim().length).toBeGreaterThan(0);
      });
    });
  });
});
