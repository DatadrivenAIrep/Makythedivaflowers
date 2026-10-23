// @vitest-environment node
import { describe, it, expect, afterEach, vi } from "vitest";
import sitemap from "@/app/sitemap";

afterEach(() => {
  vi.useRealTimers();
});

const shopUrls = (at: string) => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(at));
  return sitemap()
    .map((e) => e.url.replace(/^https?:\/\/[^/]+/, ""))
    .filter((u) => /^\/(en|es)\/shop\/(fall|christmas|valentines)$/.test(u));
};

describe("sitemap seasonal collections", () => {
  it("lists the autumn collection in October and leaves out an empty Christmas", () => {
    const urls = shopUrls("2026-10-15T12:00:00-04:00");
    expect(urls).toContain("/en/shop/fall");
    expect(urls).toContain("/es/shop/fall");
    expect(urls).not.toContain("/en/shop/christmas");
  });

  it("adds Christmas in December, once its pieces are in season", () => {
    const urls = shopUrls("2026-12-10T12:00:00-05:00");
    expect(urls).toContain("/en/shop/christmas");
    expect(urls).toContain("/es/shop/christmas");
  });

  it("keeps Valentine's Day listed while Maky has pieces tagged for it", () => {
    expect(shopUrls("2026-10-15T12:00:00-04:00")).toContain("/en/shop/valentines");
  });
});
