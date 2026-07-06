// tests/unit/wedding-projects.test.ts
import { describe, it, expect } from "vitest";
import { weddingProjects } from "@/data/wedding-projects";

describe("weddingProjects", () => {
  it("has at least the 4 existing + 3 new = 7 events, all kind wedding, unique ids", () => {
    expect(weddingProjects.length).toBeGreaterThanOrEqual(7);
    expect(weddingProjects.every((e) => e.kind === "wedding")).toBe(true);
    const ids = weddingProjects.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("each event has bilingual venue/date and at least one media item", () => {
    weddingProjects.forEach((e) => {
      expect(typeof e.venue.en).toBe("string");
      expect(typeof e.venue.es).toBe("string");
      expect(typeof e.date.en).toBe("string");
      expect(typeof e.date.es).toBe("string");
      expect(e.media.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("each media item is a valid photo or video with bilingual alt", () => {
    weddingProjects.forEach((e) => {
      e.media.forEach((m) => {
        expect(m.src.startsWith("/")).toBe(true);
        expect(m.alt.en.trim().length).toBeGreaterThan(0);
        expect(m.alt.es.trim().length).toBeGreaterThan(0);
        if (m.type === "video") expect(m.poster.startsWith("/")).toBe(true);
      });
    });
  });

  it("includes the 3 new bodas", () => {
    const ids = weddingProjects.map((e) => e.id);
    expect(ids).toEqual(expect.arrayContaining(["boda-01", "boda-02", "boda-03"]));
  });
});
