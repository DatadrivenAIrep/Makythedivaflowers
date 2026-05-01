// tests/e2e/sympathy.spec.ts
import { test, expect } from "@playwright/test";

test.describe("sympathy variant", () => {
  test("/en/shop/sympathy hides color filter and shows phone CTA", async ({ page }) => {
    await page.goto("/en/shop/sympathy");
    // color chip ("Pink") should NOT be present
    await expect(page.getByRole("button", { name: /^Pink$/ })).toHaveCount(0);
    // phone number should be visible in the sympathy callout section (main, not footer)
    await expect(page.locator("main a[href^='tel:']")).toBeVisible();
  });

  test("ES copy on sympathy hub uses 'Cuando las palabras no bastan'", async ({ page }) => {
    await page.goto("/es/shop/sympathy");
    await expect(page.getByText(/Cuando las palabras no bastan/i)).toBeVisible();
  });

  test("sympathy PDP suppresses lilac journal tile", async ({ page }) => {
    await page.goto("/en/product/white-vespers");
    await expect(page.getByText(/From our journal/i)).toHaveCount(0);
  });
});
