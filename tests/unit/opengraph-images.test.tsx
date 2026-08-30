// @vitest-environment node
import { describe, expect, it } from "vitest";
import RootOgImage from "@/app/[locale]/opengraph-image";
import MothersDayOgImage from "@/app/[locale]/mothers-day/opengraph-image";

/**
 * The root OG card 500'd on every request for its whole life.
 *
 * Satori requires an explicit `display` on any div with more than one child,
 * and `{a}, {b} · {c}` is five JSX children, not one string. Nothing caught it
 * because nothing ever rendered these routes — and the homepage plus every page
 * without its own card falls back to this one, so all of them had a broken
 * preview on iMessage, WhatsApp, Facebook and X.
 *
 * These tests actually invoke the handlers, so a Satori layout error fails here
 * instead of in someone's group chat.
 */
async function renderOg(res: Response): Promise<{ type: string | null; bytes: number }> {
  const buf = await res.arrayBuffer();
  return { type: res.headers.get("content-type"), bytes: buf.byteLength };
}

describe("Open Graph images", () => {
  it("renders the root card for en", async () => {
    const res = await RootOgImage({ params: Promise.resolve({ locale: "en" }) });
    const { type, bytes } = await renderOg(res as unknown as Response);
    expect(type).toBe("image/png");
    expect(bytes).toBeGreaterThan(5_000);
  }, 30_000);

  it("renders the root card for es", async () => {
    const res = await RootOgImage({ params: Promise.resolve({ locale: "es" }) });
    const { type, bytes } = await renderOg(res as unknown as Response);
    expect(type).toBe("image/png");
    expect(bytes).toBeGreaterThan(5_000);
  }, 30_000);

  it("renders the Mother's Day card", async () => {
    const res = await MothersDayOgImage();
    const { type, bytes } = await renderOg(res as unknown as Response);
    expect(type).toBe("image/png");
    expect(bytes).toBeGreaterThan(5_000);
  }, 30_000);
});
