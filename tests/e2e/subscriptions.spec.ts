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
    // FormShell renders the form panel with id="form-content"
    const formPanel = page.locator("#form-content");
    await expect(formPanel).toBeVisible();
    await formPanel.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);

    // Cadence: select "Weekly" radio chip (click the visible label)
    await page.locator('label[for="cadence-weekly"]').click();

    // Start date (at least 2 days from today — computed dynamically so tests don't expire)
    const startDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const startDateStr = startDate.toISOString().slice(0, 10);
    await page.locator("#s-start").fill(startDateStr);

    // Recipient
    await page.locator("#s-rname").fill("Test Recipient");
    await page.locator("#s-rphone").fill("555-000-0000");

    // Delivery address
    await page.locator("#s-street1").fill("123 Test St");
    await page.locator("#s-city").fill("Miami");
    await page.locator("#s-state").fill("FL");
    await page.locator("#s-zip").fill("33101");

    // Preferred delivery window: select "Morning" (click the visible chip label)
    await page.locator('label[for="window.slot-morning"]').click();

    // Contact info
    await page.locator("#s-cemail").fill("test@example.com");
    await page.locator("#s-cphone").fill("555-111-2222");

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
