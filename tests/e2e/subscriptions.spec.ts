import { test, expect } from "@playwright/test";

test.describe("subscriptions", () => {
  test("English happy path: choose Atelier, fill form, see confirmation", async ({ page }) => {
    await page.goto("/en/subscriptions");

    // Verify hero section is visible
    await expect(
      page.getByRole("heading", { name: /flores frescas, todas las semanas/i }),
    ).toBeVisible();

    // Click the "Choose Atelier" tier CTA button
    await page.getByRole("button", { name: /choose atelier/i }).click();

    // Verify form section is visible (the click scrolls to it)
    const inquireSection = page.locator("#inquire");
    await expect(inquireSection).toBeVisible();
    await inquireSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);

    // Cadence: select "Weekly" radio (already default, but click to be explicit)
    await page.locator('input[type="radio"][value="weekly"]').check();

    // Start date (at least 2 days from today — computed dynamically so tests don't expire)
    const startDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const startDateStr = startDate.toISOString().slice(0, 10);
    await page.locator("#f-startdate").fill(startDateStr);

    // Recipient
    await page.locator("#f-recipient\\.name").fill("Test Recipient");
    await page.locator("#f-recipient\\.phone").fill("555-000-0000");

    // Delivery address
    await page.locator("#f-address\\.street1").fill("123 Test St");
    await page.locator("#f-address\\.city").fill("Miami");
    await page.locator("#f-address\\.state").fill("FL");
    await page.locator("#f-address\\.zip").fill("33101");

    // Preferred delivery window: select "Morning"
    await page.locator('input[type="radio"][value="morning"]').check();

    // Contact info
    await page.locator("#f-contact\\.email").fill("test@example.com");
    await page.locator("#f-contact\\.phone").fill("555-111-2222");

    // Submit
    const submitBtn = page.getByRole("button", { name: /send subscription request/i });
    await submitBtn.scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    await submitBtn.click();

    // Wait for success confirmation panel
    await expect(page.getByText(/we'll be in touch/i)).toBeVisible({ timeout: 15000 });
  });

  test("Spanish smoke check: page loads with Spanish hero title", async ({ page }) => {
    await page.goto("/es/subscriptions");

    // Verify the Spanish hero title is visible
    await expect(
      page.getByRole("heading", { name: /flores frescas, todas las semanas/i }),
    ).toBeVisible();

    // Verify the Spanish tier heading is visible
    await expect(page.getByText(/tres planes, una rutina/i)).toBeVisible();
  });
});
