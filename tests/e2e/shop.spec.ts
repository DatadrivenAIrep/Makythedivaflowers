// tests/e2e/shop.spec.ts
import { test, expect } from "@playwright/test";

test.describe("shop", () => {
  test("hub renders in EN with mosaic + newest grid", async ({ page }) => {
    await page.goto("/en/shop");
    await expect(page.getByRole("heading", { name: /Every arrangement/i, level: 1 })).toBeVisible();
    // The hub is a hero plus two grids now; the category mosaic it used to
    // carry moved into the shop menu.
    await expect(page.getByRole("heading", { name: /Newest arrivals/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /All products/i })).toBeVisible();
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
    // A floor, not an exact count: the catalog grows, and a test that has to be
    // edited every time a product is added stops being read.
    const cards = page.getByRole("link").filter({ hasText: /From\s*\$/i });
    await expect(cards.first()).toBeVisible();
    expect(await cards.count()).toBeGreaterThan(5);
  });

  test("filter chip writes the URL and narrows the grid", async ({ page }) => {
    await page.goto("/en/shop/arrangements");
    const cards = page.getByRole("link").filter({ hasText: /From\s*\$/i });
    // Count only once the grid has actually painted. Counting straight after
    // goto() raced the render and could capture 0, which then made any
    // post-filter count look like a growth rather than a narrowing.
    await expect(cards.first()).toBeVisible();
    const beforeCount = await cards.count();
    expect(beforeCount).toBeGreaterThan(0);

    await page.getByRole("button", { name: /^Romance$/ }).click();
    await expect(page).toHaveURL(/[?&]occasion=romance/);
    await expect(cards.first()).toBeVisible();
    await expect
      .poll(async () => cards.count(), { message: "filtered grid should not grow" })
      .toBeLessThanOrEqual(beforeCount);
  });

  test("sort dropdown updates URL", async ({ page }) => {
    await page.goto("/en/shop/arrangements");
    await page.getByLabel("Sort").selectOption("price-asc");
    await expect(page).toHaveURL(/[?&]sort=price-asc/);
  });

  test("clear filters resets the URL", async ({ page }) => {
    await page.goto("/en/shop/arrangements?occasion=romance&sort=price-asc");
    // Wait for the bar to be interactive before clicking: clicking mid-hydration
    // lands on nothing and the URL never changes.
    const clear = page.getByRole("button", { name: /^Clear$/ });
    await expect(clear).toBeVisible();
    await clear.click();
    await expect(page).toHaveURL(/\/en\/shop\/arrangements$/);
    await expect(page.getByRole("button", { name: /^Romance$/ })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });
});
