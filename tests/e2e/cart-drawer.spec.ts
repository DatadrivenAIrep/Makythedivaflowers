import { test, expect } from "@playwright/test";

test.describe("cart drawer", () => {
  test("add to bag opens drawer with correct line", async ({ page }) => {
    await page.goto("/en/shop/arrangements");
    const firstCard = page.locator("[data-testid='product-card']").first();
    const productTitle = await firstCard.locator("h3").textContent();
    await firstCard.click();
    await page.getByRole("button", { name: /add to bag/i }).click();
    const drawer = page.getByRole("dialog", { name: /your bag/i });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByText(productTitle ?? "")).toBeVisible();
  });

  test("ESC closes drawer", async ({ page }) => {
    await page.goto("/en/shop/bouquets");
    await page.locator("[data-testid='product-card']").first().click();
    await page.getByRole("button", { name: /add to bag/i }).click();
    const drawer = page.getByRole("dialog", { name: /your bag/i });
    await expect(drawer).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(drawer).not.toBeVisible();
  });

  test("qty stepper updates subtotal", async ({ page }) => {
    await page.goto("/en/shop/arrangements");
    await page.locator("[data-testid='product-card']").first().click();
    await page.getByRole("button", { name: /add to bag/i }).click();
    const drawer = page.getByRole("dialog", { name: /your bag/i });
    const initialSubtotal = await drawer.locator("[data-testid='cart-subtotal']").textContent();
    await drawer.getByRole("button", { name: /increase quantity/i }).click();
    await expect(drawer.locator("[data-testid='cart-subtotal']")).not.toHaveText(initialSubtotal ?? "");
  });

  test("count badge in nav updates", async ({ page }) => {
    await page.goto("/en/shop/arrangements");
    await page.locator("[data-testid='product-card']").first().click();
    await page.getByRole("button", { name: /add to bag/i }).click();
    const cartButton = page.getByRole("button", { name: /bag \(\d+\)/i });
    await expect(cartButton).toBeVisible();
  });
});
