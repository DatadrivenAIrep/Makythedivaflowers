import { test, expect } from "@playwright/test";

test("contact form submits", async ({ page }) => {
  await page.goto("/en/contact");
  await page.getByLabel(/your name/i).fill("Lola");
  await page.getByLabel(/email/i).fill("lola@example.com");
  await page.getByLabel(/subject/i).fill("Hello");
  await page.getByLabel(/message/i).fill("I'd love to chat about a small dinner.");
  await page.getByRole("button", { name: /send/i }).click();
  await expect(page.getByText(/got it — thank you/i)).toBeVisible();
});

test("delivery zone pills render", async ({ page }) => {
  await page.goto("/en/contact");
  await expect(page.getByText(/queens/i)).toBeVisible();
  await expect(page.getByText(/south nassau/i)).toBeVisible();
});
