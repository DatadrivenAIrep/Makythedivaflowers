import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { SITE } from "@/data/site";

describe("SITE content", () => {
  it("exposes every §13 open-item placeholder under a stable key", () => {
    expect(SITE.brand).toBeTruthy();
    expect(SITE.founded).toBeTypeOf("number");
    expect(SITE.phoneDisplay).toMatch(/\d{3}\s?\d{3}\s?\d{4}/);
    expect(SITE.address.line1).toBeTruthy();
    expect(SITE.cutoffTime).toBeTruthy();
    expect(SITE.cutoff24).toMatch(/^\d{2}:\d{2}$/);
    expect(SITE.tagline.en).toBeTruthy();
    expect(SITE.tagline.es).toBeTruthy();
    expect(SITE.metadata.title.en).toBeTruthy();
    expect(SITE.metadata.title.es).toBeTruthy();
  });

  it("exposes marquee tokens as a non-empty array", () => {
    expect(Array.isArray(SITE.marquee.tokens)).toBe(true);
    expect(SITE.marquee.tokens.length).toBeGreaterThan(0);
  });

  it("exposes a canonical email address used across the site", () => {
    expect(SITE.email).toBe("studio@divaflowers.com");
    expect(SITE.emailHref).toBe(`mailto:${SITE.email}`);
  });

  it("exposes structured studio hours (no obsolete hours_value string)", () => {
    expect(Array.isArray(SITE.hours)).toBe(true);
    expect(SITE.hours.length).toBeGreaterThan(0);
    for (const row of SITE.hours) {
      expect(row.day).toBeTruthy();
      expect(row.value).toBeTruthy();
    }
  });
});

describe("StudioInfo content sourcing", () => {
  // The component is async/server, so we verify by source inspection — it
  // must read phone/email/hours from SITE rather than re-hardcoding them.
  const studioInfoSrc = readFileSync(
    resolve(__dirname, "../../components/contact/StudioInfo.tsx"),
    "utf8",
  );

  it("does not hardcode the legacy hello@ email literal", () => {
    expect(studioInfoSrc).not.toMatch(/hello@divaflowers\.com/);
  });

  it("does not hardcode a raw phone digit string", () => {
    expect(studioInfoSrc).not.toMatch(/"5164843456"/);
  });

  it("references SITE.email and SITE.phone(Display) for studio fields", () => {
    expect(studioInfoSrc).toMatch(/SITE\.email/);
    expect(studioInfoSrc).toMatch(/SITE\.phone(Display)?/);
  });

  it("renders hours from SITE.hours rather than t('hours_value')", () => {
    expect(studioInfoSrc).toMatch(/SITE\.hours/);
    expect(studioInfoSrc).not.toMatch(/t\("hours_value"\)/);
  });
});

describe("legal/contact messages", () => {
  const en = readFileSync(resolve(__dirname, "../../messages/en.json"), "utf8");
  const es = readFileSync(resolve(__dirname, "../../messages/es.json"), "utf8");

  it("contains no references to the legacy hello@ email", () => {
    expect(en).not.toMatch(/hello@divaflowers\.com/);
    expect(es).not.toMatch(/hello@divaflowers\.com/);
  });

  it("does not ship the obsolete hours_value key", () => {
    expect(en).not.toMatch(/"hours_value"/);
    expect(es).not.toMatch(/"hours_value"/);
  });
});
