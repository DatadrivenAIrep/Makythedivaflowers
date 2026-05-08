// @vitest-environment node
import { describe, it, expect } from "vitest";
import { renderHtmlToPdf } from "@/lib/print-chromium";

describe("renderHtmlToPdf", () => {
  it("returns a non-empty PDF buffer for a trivial HTML document", async () => {
    const html = `<!doctype html><html><head><meta charset="utf-8"></head><body><p>hello chromium</p></body></html>`;
    const buf = await renderHtmlToPdf(html);
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(500);
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
  }, 30_000);
});
