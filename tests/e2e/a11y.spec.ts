import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "@playwright/test";

// color-contrast violations are deferred to v2 — they require design-level decisions
// about decorative opacity tokens (text-petal/40, text-bone/40) on dark bento tiles.
// All structural a11y (roles, labels, keyboard, focus) must remain zero-violation.
const AXE_DISABLE = ["color-contrast"];

const PAGES = [
  { name: "home (en)", url: "/en" },
  { name: "home (es)", url: "/es" },
  { name: "shop (en)", url: "/en/shop/arrangements" },
  { name: "checkout (en)", url: "/en/checkout" },
];

for (const { name, url } of PAGES) {
  test(`a11y — ${name}`, async ({ page }) => {
    await page.goto(url);
    await page.waitForLoadState("networkidle");
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .disableRules(AXE_DISABLE)
      .analyze();
    expect(results.violations).toEqual([]);
  });
}

test("a11y — pdp (en)", async ({ page }) => {
  await page.goto("/en/shop/arrangements");
  await page.waitForLoadState("networkidle");
  const productLink = page.locator("a[href*='/product/']").first();
  await productLink.waitFor({ state: "visible" });
  await productLink.click();
  await page.waitForURL(/\/product\//);
  await page.waitForLoadState("networkidle");
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .disableRules(AXE_DISABLE)
    .analyze();
  expect(results.violations).toEqual([]);
});
