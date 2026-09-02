import { test, expect } from "@playwright/test";

// Sign-in is by SMS code now, and there is no sign-up: an account exists once
// you have ordered. These cover what a signed-out visitor can see and do.

test("sign-in page offers the phone step and the orders tab", async ({ page }) => {
  await page.goto("/en/account");
  await expect(page.getByRole("link", { name: /sign in/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /orders/i })).toBeVisible();
  await expect(page.getByLabel(/phone number/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /send me a code/i })).toBeVisible();
});

test("there is no sign-up page any more", async ({ page }) => {
  await page.goto("/en/account/sign-up");
  await expect(page).toHaveURL(/\/en\/account$/);
});

test("orders sends a signed-out visitor to sign in", async ({ page }) => {
  await page.goto("/en/account/orders");
  await expect(page).toHaveURL(/\/en\/account$/);
});

test("asking for a code moves to the code step without saying who has an account", async ({
  page,
}) => {
  await page.goto("/en/account");
  await page.getByLabel(/phone number/i).fill("5165550199");
  await page.getByRole("button", { name: /send me a code/i }).click();

  // Same screen whether or not that number is on file.
  await expect(page.getByLabel(/six-digit code/i)).toBeVisible();
  await expect(page.getByText(/is on file/i)).toBeVisible();
});

test("a wrong code is refused", async ({ page }) => {
  await page.goto("/en/account");
  await page.getByLabel(/phone number/i).fill("5165550199");
  await page.getByRole("button", { name: /send me a code/i }).click();
  await page.getByLabel(/six-digit code/i).fill("000000");
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await expect(page.getByRole("alert")).toBeVisible();
});
