import { test, expect } from "@playwright/test";

test("locale switcher navigates en → es", async ({ page }) => {
  await page.goto("/en");
  await page.getByLabel(/Switch language to ES/i).click();
  await expect(page).toHaveURL(/\/es/);
  await expect(page.getByRole("heading", { level: 1, name: /tallo a tallo/ })).toBeVisible();
});

test("root redirects to default locale", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/en/);
});
