// tests/unit/event-projects.test.ts
import { describe, it, expect } from "vitest";
import { eventProjects } from "@/data/event-projects";

describe("eventProjects", () => {
  it("has the 4 events (3 events + communion), all kind event, unique ids", () => {
    expect(eventProjects.map((e) => e.id)).toEqual(
      expect.arrayContaining(["evento-01", "evento-02", "evento-03", "comunion-01"]),
    );
    expect(eventProjects.every((e) => e.kind === "event")).toBe(true);
    const ids = eventProjects.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("each media item is a valid photo/video with bilingual alt", () => {
    eventProjects.forEach((e) => {
      expect(e.media.length).toBeGreaterThanOrEqual(1);
      e.media.forEach((m) => {
        expect(m.src.startsWith("/")).toBe(true);
        expect(m.alt.en.trim().length).toBeGreaterThan(0);
        expect(m.alt.es.trim().length).toBeGreaterThan(0);
        if (m.type === "video") expect(m.poster.startsWith("/")).toBe(true);
      });
    });
  });
});
