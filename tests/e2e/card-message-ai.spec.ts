import { test, expect } from "@playwright/test";

test.describe("PDP card-message AI assistant", () => {
  test("happy path: pick relation, generate, select suggestion", async ({ page }) => {
    await page.route("**/api/card-message", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          suggestions: [
            "Five years and counting — every one of them, yes.",
            "To us, again. Same time next year.",
            "Pajamas, late toast, our usual chaos. I love you.",
          ],
        }),
      });
    });

    await page.goto("/en/product/all-my-love");
    await page.getByRole("button", { name: /suggest message/i }).click();
    await page.getByRole("button", { name: /^partner$/i }).click();
    await page.getByRole("button", { name: /generate 3 ideas/i }).click();

    const firstCard = page.getByRole("button", { name: /five years and counting/i });
    await expect(firstCard).toBeVisible();
    await firstCard.click();

    const textarea = page.getByRole("textbox", { name: /for someone special/i });
    await expect(textarea).toHaveValue(/five years and counting/i);
    await expect(page.getByRole("button", { name: /generate 3 ideas/i })).not.toBeVisible();
  });

  test("sympathy product shows sympathy chip set", async ({ page }) => {
    await page.goto("/en/product/lilies-for-lottie");
    await page.getByRole("button", { name: /suggest message/i }).click();
    await expect(page.getByRole("button", { name: /coworker/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^mom$/i })).not.toBeVisible();
  });

  test("rate-limit error shows specific copy", async ({ page }) => {
    await page.route("**/api/card-message", async (route) => {
      await route.fulfill({
        status: 429,
        contentType: "application/json",
        body: JSON.stringify({ error: "rate_limit" }),
      });
    });

    await page.goto("/en/product/all-my-love");
    await page.getByRole("button", { name: /suggest message/i }).click();
    await page.getByRole("button", { name: /^partner$/i }).click();
    await page.getByRole("button", { name: /generate 3 ideas/i }).click();
    await expect(page.getByText(/too many requests/i)).toBeVisible();
  });
});
