import { describe, it, expect } from "vitest";
import { isBarePath, isShopTvPath } from "@/lib/bare-paths";

describe("isBarePath", () => {
  it.each(["/en/admin", "/es/admin/tv", "/en/vitrina"])("is true for %s", (p) => {
    expect(isBarePath(p)).toBe(true);
  });
  it.each(["/en/shop", "/en/vitrinas-de-boda", "/en"])("is false for %s", (p) => {
    expect(isBarePath(p)).toBe(false);
  });
});

describe("isShopTvPath", () => {
  it("is true for the shop TV and its sub-paths", () => {
    expect(isShopTvPath("/en/vitrina")).toBe(true);
    expect(isShopTvPath("/es/vitrina/x")).toBe(true);
  });
  it("is false for admin and look-alikes", () => {
    expect(isShopTvPath("/en/admin")).toBe(false);
    expect(isShopTvPath("/en/vitrinas-de-boda")).toBe(false);
  });
});
