import { test, expect } from "@playwright/test";

test("wedding inquiry submits and shows success", async ({ page }) => {
  await page.goto("/en/weddings");
  // Scroll to the inquiry section
  const inquire = page.locator("#inquire");
  await inquire.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);

  // Fill required fields using explicit IDs from WeddingsForm
  await page.locator("#w-name").fill("Lola Cardona");
  await page.locator("#w-email").fill("lola@example.com");
  await page.locator("#w-phone").fill("5165550100");
  await page.locator("#w-vibe").fill("Romantic, white and soft pink, candlelight, late September.");
  // Fill guests to satisfy schema validation (min:1 when provided)
  await page.locator("#w-guests").fill("50");

  // Submit
  const submitBtn = page.getByRole("button", { name: /send inquiry/i });
  await submitBtn.scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, 100));
  await page.waitForTimeout(200);
  await submitBtn.click();

  // Wait for success card — success_title is "We'll be in touch."
  await expect(page.getByText(/in touch/i)).toBeVisible({ timeout: 15000 });
});
