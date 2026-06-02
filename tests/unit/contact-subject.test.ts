import { describe, it, expect } from "vitest";
import { getSubjectKey, isAllowlistedRoute, type ContactOverride } from "@/lib/contact-subject";

describe("getSubjectKey", () => {
  it("returns pdp_named when override provides product name", () => {
    const result = getSubjectKey({
      pathname: "/en/product/garden-bloom",
      override: { kind: "pdp", productName: "Garden Bloom" },
    });
    expect(result).toEqual({ key: "pdp_named", vars: { product: "Garden Bloom" } });
  });

  it("returns pdp_generic when on PDP without override", () => {
    const result = getSubjectKey({
      pathname: "/en/product/garden-bloom",
      override: null,
    });
    expect(result).toEqual({ key: "pdp_generic" });
  });

  it("returns shop_category when override provides category", () => {
    const result = getSubjectKey({
      pathname: "/es/shop/bouquets",
      override: { kind: "shop", category: "Ramos" },
    });
    expect(result).toEqual({ key: "shop_category", vars: { category: "Ramos" } });
  });

  it("returns shop_all on /shop without override", () => {
    expect(getSubjectKey({ pathname: "/es/shop", override: null })).toEqual({ key: "shop_all" });
  });

  it("returns shop_all on /shop/[category] without override", () => {
    expect(getSubjectKey({ pathname: "/es/shop/bouquets", override: null })).toEqual({
      key: "shop_all",
    });
  });

  it("returns weddings on /weddings", () => {
    expect(getSubjectKey({ pathname: "/en/weddings", override: null })).toEqual({ key: "weddings" });
  });

  it("returns events on /events", () => {
    expect(getSubjectKey({ pathname: "/en/events", override: null })).toEqual({ key: "events" });
  });

  it("returns checkout on /cart", () => {
    expect(getSubjectKey({ pathname: "/en/cart", override: null })).toEqual({ key: "checkout" });
  });

  it("returns checkout on /checkout", () => {
    expect(getSubjectKey({ pathname: "/en/checkout", override: null })).toEqual({ key: "checkout" });
  });

  it("returns default on /journal", () => {
    expect(getSubjectKey({ pathname: "/en/journal", override: null })).toEqual({ key: "default" });
  });

  it("returns default on home", () => {
    expect(getSubjectKey({ pathname: "/en", override: null })).toEqual({ key: "default" });
  });

  it("returns default on /story", () => {
    expect(getSubjectKey({ pathname: "/es/story", override: null })).toEqual({ key: "default" });
  });

  it("strips locale prefix correctly even without trailing slash", () => {
    expect(getSubjectKey({ pathname: "/en/cart/", override: null })).toEqual({ key: "checkout" });
  });

  it("treats unknown override kinds as pathname-only", () => {
    const result = getSubjectKey({
      pathname: "/en/weddings",
      override: { kind: "unknown" } as unknown as ContactOverride,
    });
    expect(result).toEqual({ key: "weddings" });
  });

  it("returns prom on /prom", () => {
    expect(getSubjectKey({ pathname: "/en/prom", override: null })).toEqual({ key: "prom" });
  });

  it("returns prom on /es/prom", () => {
    expect(getSubjectKey({ pathname: "/es/prom", override: null })).toEqual({ key: "prom" });
  });

  it("returns corsages on /corsages-boutonnieres", () => {
    expect(getSubjectKey({ pathname: "/en/corsages-boutonnieres", override: null })).toEqual({
      key: "corsages",
    });
  });

  it("returns corsages on /es/corsages-boutonnieres", () => {
    expect(getSubjectKey({ pathname: "/es/corsages-boutonnieres", override: null })).toEqual({
      key: "corsages",
    });
  });
});

describe("isAllowlistedRoute", () => {
  it("is true for home, product, shop, weddings, events, cart, checkout", () => {
    for (const p of [
      "/en",
      "/es",
      "/en/product/x",
      "/en/shop",
      "/en/shop/bouquets",
      "/en/weddings",
      "/en/events",
      "/en/cart",
      "/en/checkout",
      "/en/prom",
      "/en/corsages-boutonnieres",
    ]) {
      expect(isAllowlistedRoute(p)).toBe(true);
    }
  });

  it("is false for editorial routes", () => {
    for (const p of [
      "/en/story",
      "/en/journal",
      "/en/journal/some-post",
      "/en/contact",
      "/en/legal/privacy",
      "/en/account",
      "/en/order/abc/confirmation",
    ]) {
      expect(isAllowlistedRoute(p)).toBe(false);
    }
  });
});
