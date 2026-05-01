import { test, expect } from "@playwright/test";

test("wedding inquiry submits and shows success", async ({ page }) => {
  await page.goto("/en/weddings#inquire");
  await page.getByLabel(/your name/i).fill("Lola Cardona");
  await page.getByLabel(/^email$/i).fill("lola@example.com");
  await page.getByLabel(/^phone$/i).fill("5165550100");
  await page.getByLabel(/vibe/i).fill("Romantic, white and soft pink, candlelight, late September.");
  await page.getByLabel(/\$10–25k/i).check();
  await page.getByRole("button", { name: /send inquiry/i }).click();
  await expect(page.getByText(/thank you\. we'll be in touch soon/i)).toBeVisible();
});
