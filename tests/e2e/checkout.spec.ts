import { test, expect } from "@playwright/test";

test.describe("checkout", () => {
  test("end-to-end: PDP → drawer → checkout → confirmation", async ({ page }) => {
    await page.goto("/en/shop/arrangements");
    await page.locator("[data-testid='product-card']").first().click();
    await page.getByRole("button", { name: /add to bag/i }).click();
    const drawer = page.getByRole("dialog", { name: /your bag/i });
    await expect(drawer).toBeVisible();
    await drawer.getByRole("link", { name: /continue to checkout/i }).click();
    await expect(page.getByRole("heading", { name: /checkout/i })).toBeVisible();
    await page.getByRole("textbox", { name: "Email", exact: true }).fill("test@example.com");
    await page.getByLabel(/phone/i).first().fill("5165550100");
    await page.getByRole("button", { name: /continue/i }).first().click();
    const future = new Date();
    future.setDate(future.getDate() + 7);
    const futureStr = future.toISOString().slice(0, 10);
    await page.getByLabel(/recipient name/i).fill("Lola Cardona");
    await page.getByLabel(/recipient phone/i).fill("5165550101");
    await page.getByLabel(/street address/i).fill("1077 Hempstead Tpke");
    await page.getByLabel(/^city$/i).fill("Franklin Square");
    await page.getByLabel(/^state$/i).fill("NY");
    await page.getByLabel(/zip code/i).fill("11010");
    await page.locator('input[type="date"]').fill(futureStr);
    await page.getByLabel(/midday/i).check();
    await page.getByRole("button", { name: /continue/i }).nth(1).click();
    await page.getByRole("button", { name: /place order/i }).click();
    await expect(page).toHaveURL(/\/en\/order\/.+\/confirmation/);
    await expect(page.getByRole("heading", { name: /thank you, lola cardona/i })).toBeVisible();
    await expect(page.getByText(/payment received/i)).toBeVisible();
  });

  test("validation blocks step transitions", async ({ page }) => {
    await page.goto("/en/checkout");
    await page.getByRole("button", { name: /continue/i }).first().click();
    await expect(page.getByText(/enter a valid email/i)).toBeVisible();
  });
});
