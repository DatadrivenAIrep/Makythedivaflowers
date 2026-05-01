// tests/e2e/pdp.spec.ts
import { test, expect } from "@playwright/test";

test.describe("pdp", () => {
  test("ruby-altar renders with title, blurb, variants, default delivery", async ({ page }) => {
    await page.goto("/en/product/ruby-altar");
    await expect(page.getByRole("heading", { name: "Ruby Altar", level: 1 })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Standard\s/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Grand\s/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Diva\s/i })).toBeVisible();
    // delivery default selected — exactly one selected button in the date strip
    // date buttons do not contain a price symbol ($), unlike variant/size chips
    const dateButtons = page.locator('button[aria-pressed="true"]').filter({ hasNotText: /\$/ });
    await expect(dateButtons).toHaveCount(1);
  });

  test("changing variant updates the visible price on the CTA", async ({ page }) => {
    await page.goto("/en/product/ruby-altar");
    // wait for date to be auto-selected so CTA is enabled
    await page.waitForSelector('button[aria-pressed="true"]');
    const cta = page.getByRole("button", { name: /Add to bag/i });
    await expect(cta).toBeEnabled();
    const standardPrice = await cta.innerText();
    await page.getByRole("button", { name: /^Diva\s/i }).click();
    const divaPrice = await cta.innerText();
    expect(divaPrice).not.toBe(standardPrice);
  });

  test("add to bag morphs to confirmation and increments the cart counter", async ({ page }) => {
    await page.goto("/en/product/ruby-altar");
    // wait for the Add to bag button to become enabled (date auto-selected via useEffect)
    const cta = page.getByRole("button", { name: /Add to bag/i });
    await expect(cta).toBeEnabled({ timeout: 5000 });
    await cta.click();
    await expect(page.getByText(/Added/i)).toBeVisible();
    // cart counter increments by 1; cart button is in the top nav
    await expect(page.locator("header").getByText(/^1$/)).toBeVisible();
  });

  test("Spanish PDP renders ES copy", async ({ page }) => {
    await page.goto("/es/product/ruby-altar");
    await expect(page.getByRole("heading", { name: "Altar Rubí", level: 1 })).toBeVisible();
    await expect(page.getByRole("button", { name: /Añadir a la bolsa/i })).toBeVisible();
  });

  test("subscription PDP shows cadence picker and 'First delivery'", async ({ page }) => {
    await page.goto("/en/product/petite-subscription");
    await expect(page.getByRole("button", { name: /^Weekly$/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Biweekly$/ })).toBeVisible();
    await expect(page.getByText(/First delivery/i)).toBeVisible();
  });
});
