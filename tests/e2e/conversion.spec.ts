import { test, expect } from "@playwright/test";

test.describe("conversion tactics", () => {
  test("PDP: cutoff countdown is visible and reflects time", async ({ page }) => {
    await page.clock.install({ time: new Date("2026-05-01T12:13:00") });
    await page.goto("/en/product/a-thousand-heartbeats");
    await expect(page.locator('[data-conv-event="cutoff_view"]').first()).toBeVisible();
    await expect(page.getByText(/Order in the next.*1h 47m/)).toBeVisible();
  });

  test("PDP: review block renders with matched anniversary copy", async ({ page }) => {
    await page.goto("/en/product/a-thousand-heartbeats");
    await expect(page.locator('[data-conv-event="pdp_reviews_view"]')).toBeVisible();
    await expect(page.getByText(/anniversary buyers/)).toBeVisible();
  });

  test("PDP: anchor pricing shows three variants with Lush as default", async ({ page }) => {
    await page.goto("/en/product/a-thousand-heartbeats");
    await expect(page.getByRole("button", { name: /Lush/ }).first()).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("Most popular")).toBeVisible();
  });

  test("Drawer: cutoff pill appears after adding to bag", async ({ page }) => {
    await page.goto("/en/product/a-thousand-heartbeats");
    await page.getByRole("button", { name: /Add to bag/i }).click();
    const drawer = page.getByRole("dialog");
    await expect(drawer).toBeVisible();
    await expect(drawer.locator('[data-conv-event="cutoff_view"]')).toBeVisible();
  });

  test("Drawer: upsell strip appears in cart drawer", async ({ page }) => {
    await page.goto("/en/product/a-thousand-heartbeats");
    await page.getByRole("button", { name: /Add to bag/i }).click();
    const drawer = page.getByRole("dialog");
    await expect(drawer).toBeVisible();
    await expect(drawer.locator('[data-conv-event="cart_upsell_view"]')).toBeVisible();
  });

  test("Shop: gift-extras do not appear in browse catalog", async ({ page }) => {
    await page.goto("/en/shop");
    await expect(page.getByText("Premium handwritten card")).not.toBeVisible();
    await expect(page.getByText("Glass vase upgrade")).not.toBeVisible();
  });
});
