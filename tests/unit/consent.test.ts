import { describe, it, expect, beforeEach, vi } from "vitest";
import { hasConsent, setConsent, COOKIE_NAME } from "@/lib/consent";

function clearCookies() {
  document.cookie.split(";").forEach((c) => {
    const eq = c.indexOf("=");
    const name = (eq > -1 ? c.substring(0, eq) : c).trim();
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  });
}

describe("consent", () => {
  beforeEach(() => {
    clearCookies();
    vi.unstubAllGlobals();
  });

  it("defaults to true when no cookie set and no GPC signal", () => {
    expect(hasConsent()).toBe(true);
  });

  it("returns false when GPC signal is true (regardless of cookie)", () => {
    setConsent(true); // pre-set a granted cookie
    vi.stubGlobal("navigator", { ...navigator, globalPrivacyControl: true });
    expect(hasConsent()).toBe(false);
  });

  it("setConsent(false) writes the cookie and is then read as false", () => {
    setConsent(false);
    expect(document.cookie).toContain(`${COOKIE_NAME}=denied`);
    expect(hasConsent()).toBe(false);
  });

  it("setConsent(true) writes 'granted' and is then read as true", () => {
    setConsent(true);
    expect(document.cookie).toContain(`${COOKIE_NAME}=granted`);
    expect(hasConsent()).toBe(true);
  });

  it("returns false on the server (no document)", () => {
    const originalDoc = globalThis.document;
    // @ts-expect-error simulate SSR
    delete globalThis.document;
    try {
      expect(hasConsent()).toBe(false);
    } finally {
      globalThis.document = originalDoc;
    }
  });
});
