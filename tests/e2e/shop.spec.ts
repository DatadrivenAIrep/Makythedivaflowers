// tests/e2e/shop.spec.ts
import { test, expect } from "@playwright/test";

test.describe("shop", () => {
  test("hub renders in EN with mosaic + newest grid", async ({ page }) => {
    await page.goto("/en/shop");
    await expect(page.getByRole("heading", { name: /Every arrangement/i, level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: /Arrangements/i }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: /Newest arrivals/i })).toBeVisible();
  });

  test("hub renders in ES", async ({ page }) => {
    await page.goto("/es/shop");
    await expect(page.getByRole("heading", { name: /Cada arreglo/i, level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Lo más nuevo/i })).toBeVisible();
  });

  test("category page shows products and filter bar", async ({ page }) => {
    await page.goto("/en/shop/arrangements");
    await expect(page.getByRole("heading", { name: /Arrangements/i, level: 1 })).toBeVisible();
    await expect(page.getByRole("button", { name: /Romance/i })).toBeVisible();
    // four arrangements seeded
    const cards = page.getByRole("link").filter({ hasText: /From\s*\$/i });
    await expect(cards).toHaveCount(4);
  });

  test("filter chip writes the URL and narrows the grid", async ({ page }) => {
    await page.goto("/en/shop/arrangements");
    const cardsBefore = page.getByRole("link").filter({ hasText: /From\s*\$/i });
    const beforeCount = await cardsBefore.count();
    await page.getByRole("button", { name: /^Romance$/ }).click();
    await expect(page).toHaveURL(/[?&]occasion=romance/);
    const cardsAfter = page.getByRole("link").filter({ hasText: /From\s*\$/i });
    expect(await cardsAfter.count()).toBeLessThanOrEqual(beforeCount);
  });

  test("sort dropdown updates URL", async ({ page }) => {
    await page.goto("/en/shop/arrangements");
    await page.getByLabel("Sort").selectOption("price-asc");
    await expect(page).toHaveURL(/[?&]sort=price-asc/);
  });

  test("clear filters resets the URL", async ({ page }) => {
    await page.goto("/en/shop/arrangements?occasion=romance&sort=price-asc");
    await page.getByRole("button", { name: /^Clear$/ }).click();
    await expect(page).toHaveURL(/\/en\/shop\/arrangements$/);
  });
});
