// tests/unit/wedding-faq-minimum.test.ts
import { describe, it, expect } from "vitest";
import { weddingFAQ } from "@/data/wedding-faq";

describe("wedding FAQ minimum entry", () => {
  it("no longer states hard dollar figures", () => {
    const min = weddingFAQ.find((f) => f.id === "minimum");
    expect(min).toBeDefined();
    expect(min!.a.en).not.toMatch(/\$\s?\d/);
    expect(min!.a.es).not.toMatch(/\$\s?\d/);
  });

  it("still answers the minimum-spend question with a consultation-based statement", () => {
    const min = weddingFAQ.find((f) => f.id === "minimum")!;
    expect(min.a.en.toLowerCase()).toContain("consultation");
    expect(min.a.es.toLowerCase()).toContain("consulta");
  });
});
