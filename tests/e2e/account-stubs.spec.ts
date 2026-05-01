import { test, expect } from "@playwright/test";

test("account routes render with tabs", async ({ page }) => {
  await page.goto("/en/account");
  await expect(page.getByRole("link", { name: /sign in/i, exact: false })).toBeVisible();
  await expect(page.getByRole("link", { name: /create account/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /orders/i })).toBeVisible();
});

test("orders empty state", async ({ page }) => {
  await page.goto("/en/account/orders");
  await expect(page.getByText(/no orders yet/i)).toBeVisible();
});

test("auth form submit shows stub notice", async ({ page }) => {
  await page.goto("/en/account");
  await page.getByLabel(/email/i).fill("lola@example.com");
  await page.getByLabel(/password/i).fill("supersecret");
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page.getByText(/sign-in is coming soon/i)).toBeVisible();
});
