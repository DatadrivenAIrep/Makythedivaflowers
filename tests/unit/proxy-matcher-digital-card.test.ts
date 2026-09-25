// @vitest-environment node
import { it, expect, vi } from "vitest";

vi.mock("next-intl/middleware", () => ({ default: () => () => undefined }));

it("the locale matcher skips /c/<code> but still covers normal pages", async () => {
  const { config } = await import("@/proxy");
  const pageMatcher = new RegExp(`^${config.matcher[0]}$`);
  expect(pageMatcher.test("/c/Ab3dE5fG")).toBe(false);
  expect(pageMatcher.test("/catalog")).toBe(true);
  expect(pageMatcher.test("/contact")).toBe(true);
  expect(pageMatcher.test("/en/shop")).toBe(true);
});
