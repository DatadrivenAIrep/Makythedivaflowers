// tests/unit/portfolio-assets.test.ts
import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { weddingProjects } from "@/data/wedding-projects";
import { eventProjects } from "@/data/event-projects";
import type { PortfolioEvent } from "@/types/portfolio";

const PUBLIC = join(process.cwd(), "public");
const all: PortfolioEvent[] = [...weddingProjects, ...eventProjects];

function paths(e: PortfolioEvent): string[] {
  return e.media.flatMap((m) => (m.type === "video" ? [m.src, m.poster] : [m.src]));
}

describe("portfolio assets exist on disk", () => {
  it("every referenced media file is present under public/", () => {
    const missing: string[] = [];
    for (const e of all) {
      for (const p of paths(e)) {
        if (!existsSync(join(PUBLIC, p))) missing.push(`${e.id}: ${p}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
