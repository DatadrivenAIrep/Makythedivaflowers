import { test, expect } from "@playwright/test";

test.describe("Mother's Day landing", () => {
  test("renders all key sections", async ({ page }) => {
    await page.goto("/en/mothers-day");

    await expect(page.getByRole("heading", { level: 1 })).toContainText(/Mother's Day Flowers/i);
    await expect(page.getByTestId("md-cutoff-banner")).toBeVisible();
    await expect(page.getByPlaceholder(/Enter your ZIP/i)).toBeVisible();
    await expect(page.getByText(/4\.9 · 127 reviews/i)).toBeVisible();
    await expect(page.locator("#md-edit")).toBeVisible();
  });

  test("ZIP checker validates an in-zone ZIP and an out-of-zone ZIP", async ({ page }) => {
    await page.goto("/en/mothers-day");

    const input = page.getByPlaceholder(/Enter your ZIP/i);
    const button = page.getByRole("button", { name: /check/i });

    await input.fill("11010");
    await button.click();
    await expect(page.getByText(/We deliver to/i)).toBeVisible();

    await input.fill("90210");
    await button.click();
    await expect(page.getByText(/We don't deliver to 90210/i)).toBeVisible();
  });

  test("anchor link from hero CTA scrolls to edit grid", async ({ page }) => {
    await page.goto("/en/mothers-day");
    await page.getByRole("link", { name: /Shop the Mother's Day Edit/i }).first().click();
    await expect(page).toHaveURL(/#md-edit$/);
  });
});
