// @vitest-environment node
import { describe, it, expect, afterEach, vi } from "vitest";
import { isAllowedCardUrl, allowedDigitalCardHosts, digitalCardPatchSchema } from "@/schemas/digital-card";
import { generateCardCode, CODE_PATTERN, shortUrl } from "@/lib/digital-card-code";

afterEach(() => vi.unstubAllEnvs());

describe("isAllowedCardUrl", () => {
  it("accepts https on the default host", () => {
    expect(isAllowedCardUrl("https://tarjetas.makythedivaflowers.com/i/raymond-50-k3x9")).toBe(true);
  });
  it("rejects http, other hosts and garbage", () => {
    expect(isAllowedCardUrl("http://tarjetas.makythedivaflowers.com/i/x")).toBe(false);
    expect(isAllowedCardUrl("https://evil.example.com/i/x")).toBe(false);
    expect(isAllowedCardUrl("https://tarjetas.makythedivaflowers.com.evil.com/i/x")).toBe(false);
    expect(isAllowedCardUrl("not a url")).toBe(false);
    expect(isAllowedCardUrl("")).toBe(false);
  });
  it("uses DIGITAL_CARD_HOSTS when set", () => {
    vi.stubEnv("DIGITAL_CARD_HOSTS", " cards.example.com , other.example.com ");
    expect(allowedDigitalCardHosts()).toEqual(["cards.example.com", "other.example.com"]);
    expect(isAllowedCardUrl("https://cards.example.com/i/a")).toBe(true);
    expect(isAllowedCardUrl("https://tarjetas.makythedivaflowers.com/i/a")).toBe(false);
  });
});

describe("digitalCardPatchSchema", () => {
  it("accepts an allowed url (trimmed) and null", () => {
    expect(digitalCardPatchSchema.parse({ targetUrl: "  https://tarjetas.makythedivaflowers.com/i/a  " }))
      .toEqual({ targetUrl: "https://tarjetas.makythedivaflowers.com/i/a" });
    expect(digitalCardPatchSchema.parse({ targetUrl: null })).toEqual({ targetUrl: null });
  });
  it("rejects a disallowed url", () => {
    expect(digitalCardPatchSchema.safeParse({ targetUrl: "https://evil.example.com" }).success).toBe(false);
  });
});

describe("generateCardCode", () => {
  it("returns 8 base62 chars", () => {
    for (let i = 0; i < 50; i++) expect(generateCardCode()).toMatch(CODE_PATTERN);
  });
  it("skips bytes >= 248 to avoid modulo bias", () => {
    const bytes = Buffer.from([255, 250, 248, 0, 1, 2, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70]);
    expect(generateCardCode(() => bytes)).toBe("012z0123");
  });
});

describe("shortUrl", () => {
  it("uses NEXT_PUBLIC_SITE_URL without a trailing slash", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://staging.example.com/");
    expect(shortUrl("Ab3dE5fG")).toBe("https://staging.example.com/c/Ab3dE5fG");
  });
  it("defaults to the shop domain", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    expect(shortUrl("Ab3dE5fG")).toBe("https://makythedivaflowers.com/c/Ab3dE5fG");
  });
});
