import { test, expect } from "@playwright/test";

test.use({ viewport: { width: 390, height: 844 } });

test.describe("mobile navigation drawer", () => {
  test("hamburger button is visible on mobile", async ({ page }) => {
    await page.goto("/en");
    const btn = page.getByRole("button", { name: /open menu/i });
    await expect(btn).toBeVisible();
  });

  test("nav links are hidden on mobile (desktop-only ul)", async ({ page }) => {
    await page.goto("/en");
    // The desktop NavLinks ul is hidden — it shouldn't be visible
    const shopLink = page.locator("ul.hidden.md\\:flex");
    await expect(shopLink).toBeHidden();
  });

  test("clicking hamburger opens the drawer", async ({ page }) => {
    await page.goto("/en");
    await page.getByRole("button", { name: /open menu/i }).click();
    const drawer = page.getByRole("dialog");
    await expect(drawer).toBeVisible();
  });

  test("drawer contains main nav links", async ({ page }) => {
    await page.goto("/en");
    await page.getByRole("button", { name: /open menu/i }).click();
    const drawer = page.getByRole("dialog");
    await expect(drawer.getByRole("link", { name: /weddings/i })).toBeVisible();
    await expect(drawer.getByRole("link", { name: /events/i })).toBeVisible();
    await expect(drawer.getByRole("link", { name: /^story$/i })).toBeVisible();
  });

  test("drawer contains Shop and category chips", async ({ page }) => {
    await page.goto("/en");
    await page.getByRole("button", { name: /open menu/i }).click();
    const drawer = page.getByRole("dialog");
    await expect(drawer.getByRole("link", { name: /^shop/i })).toBeVisible();
    await expect(drawer.getByRole("link", { name: /arrangements/i })).toBeVisible();
    await expect(drawer.getByRole("link", { name: /bouquets/i })).toBeVisible();
  });

  test("close button closes the drawer", async ({ page }) => {
    await page.goto("/en");
    await page.getByRole("button", { name: /open menu/i }).click();
    const drawer = page.getByRole("dialog");
    await expect(drawer).toBeVisible();
    await page.getByRole("button", { name: /close menu/i }).click();
    await expect(drawer).not.toBeVisible();
  });

  test("Escape key closes the drawer", async ({ page }) => {
    await page.goto("/en");
    await page.getByRole("button", { name: /open menu/i }).click();
    const drawer = page.getByRole("dialog");
    await expect(drawer).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(drawer).not.toBeVisible();
  });

  test("clicking overlay closes the drawer", async ({ page }) => {
    await page.goto("/en");
    await page.getByRole("button", { name: /open menu/i }).click();
    const drawer = page.getByRole("dialog");
    await expect(drawer).toBeVisible();
    // Click left of the panel (overlay area)
    await page.mouse.click(50, 400);
    await expect(drawer).not.toBeVisible();
  });

  test("clicking a link navigates and closes drawer", async ({ page }) => {
    await page.goto("/en");
    await page.getByRole("button", { name: /open menu/i }).click();
    await page.getByRole("dialog").getByRole("link", { name: /^weddings$/i }).click();
    await expect(page).toHaveURL(/\/en\/weddings/);
    await expect(page.getByRole("dialog")).not.toBeVisible();
  });

  test("drawer shows Spanish labels when locale is es", async ({ page }) => {
    await page.goto("/es");
    await page.getByRole("button", { name: /abrir menú/i }).click();
    const drawer = page.getByRole("dialog");
    await expect(drawer.getByRole("link", { name: /arreglos/i })).toBeVisible();
    await expect(drawer.getByRole("link", { name: /ramos/i })).toBeVisible();
  });

  test("hamburger button is NOT visible on desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/en");
    const btn = page.getByRole("button", { name: /open menu/i });
    await expect(btn).toBeHidden();
  });
});
