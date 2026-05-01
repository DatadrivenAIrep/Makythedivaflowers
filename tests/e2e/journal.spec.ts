import { test, expect } from "@playwright/test";

test("journal index links to articles", async ({ page }) => {
  await page.goto("/en/journal");
  await expect(page.getByRole("heading", { name: /notes from the studio/i })).toBeVisible();
  await page.getByRole("link", { name: /the color of the season is rouge/i }).click();
  await expect(page).toHaveURL(/\/en\/journal\/color-of-the-season-rouge/);
  await expect(page.getByRole("heading", { name: /the color of the season is rouge/i })).toBeVisible();
});

test("journal article renders pull-quote", async ({ page }) => {
  await page.goto("/en/journal/color-of-the-season-rouge");
  await expect(page.getByRole("blockquote").filter({ hasText: /rouge only sings when it's surrounded by quiet/i })).toBeVisible();
});

test("ES locale renders Spanish article", async ({ page }) => {
  await page.goto("/es/journal/color-of-the-season-rouge");
  await expect(page.getByRole("blockquote").filter({ hasText: /rouge solo canta/i })).toBeVisible();
});
