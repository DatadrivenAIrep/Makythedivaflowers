// @vitest-environment node
import { describe, it, expect } from "vitest";
import { generateMetadata, generateStaticParams } from "@/app/[locale]/shop/[category]/page";

describe("shop category page", () => {
  it("builds a page for centerpieces", async () => {
    expect(await generateStaticParams()).toContainEqual({ category: "centerpieces" });
  });

  it("titles the centerpieces page in Spanish", async () => {
    const meta = await generateMetadata({
      params: Promise.resolve({ locale: "es", category: "centerpieces" }),
    });
    expect(meta.title).toBe("Centros de mesa — Diva Flowers");
    expect(meta.description).toMatch(/mesa/);
  });

  it("titles the centerpieces page in English", async () => {
    const meta = await generateMetadata({
      params: Promise.resolve({ locale: "en", category: "centerpieces" }),
    });
    expect(meta.title).toBe("Centerpieces — Diva Flowers");
    expect(meta.description).toMatch(/table/);
  });
});
