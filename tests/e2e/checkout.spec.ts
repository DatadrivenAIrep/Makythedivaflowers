import { test, expect, type Page } from "@playwright/test";

/**
 * Walk a real order from the product page to the open payment step.
 *
 * Straight to a purchasable product: clicking the first card in the shop grid
 * used to work, but the newest arrangement is a quote-only showpiece with no
 * add-to-bag button.
 */
async function reachPaymentStep(page: Page) {
  await page.goto("/en/product/a-thousand-heartbeats");
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
  await page.getByLabel(/recipient name/i).fill("Lola Cardona");
  await page.getByLabel(/recipient phone/i).fill("5165550101");
  await page.getByLabel(/street address/i).fill("1077 Hempstead Tpke");
  // Queried by accessible name, not label text: FormField appends a required
  // asterisk to the visible label, so an anchored /^city$/ never matches. The
  // asterisk is aria-hidden, so the accessible name is just "City".
  await page.getByRole("textbox", { name: "City", exact: true }).fill("Franklin Square");
  await page.getByRole("textbox", { name: "State", exact: true }).fill("NY");
  await page.getByLabel(/zip code/i).fill("11010");
  await page.locator('input[type="date"]').fill(future.toISOString().slice(0, 10));
  await page.getByLabel(/midday/i).check();
  await page.getByRole("button", { name: /continue/i }).nth(1).click();
}

test.describe("checkout", () => {
  test("PDP → drawer → checkout, up to a ready payment step", async ({ page }) => {
    await reachPaymentStep(page);

    // Stops here on purpose. Submitting card details would need Stripe *test*
    // keys, and this project's .env.local carries live ones — a test that pays
    // would be charging a real card. What it can prove without that: the intent
    // was created for the priced order, and everything the buyer needs on the
    // payment step is present and usable.
    await expect(page.getByRole("button", { name: /place order/i })).toBeEnabled();
    await expect(page.frameLocator("iframe").first().getByText(/card number/i)).toBeVisible();
    await expect(page.getByText(/^\$\d/).first()).toBeVisible();
  });

  test("a promo code is offered on the payment step and a bad one is refused", async ({
    page,
  }) => {
    await reachPaymentStep(page);
    const promo = page.getByLabel(/promo code/i);
    await expect(promo).toBeVisible();
    await promo.fill("DEFINITELY-NOT-A-CODE");
    await page.getByRole("button", { name: /^apply$/i }).click();
    // Filtered: Next's route announcer is also role="alert", so an unfiltered
    // query resolves to it rather than to the field's message.
    await expect(
      page.getByRole("alert").filter({ hasText: /isn't valid/i }),
    ).toBeVisible();
  });

  test("the tip step offers fixed amounts", async ({ page }) => {
    await reachPaymentStep(page);
    await expect(page.getByRole("button", { name: /^no tip$/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await page.getByRole("button", { name: "$10", exact: true }).click();
    await expect(page.getByRole("button", { name: "$10", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  test("validation blocks step transitions", async ({ page }) => {
    await page.goto("/en/checkout");
    await page.getByRole("button", { name: /continue/i }).first().click();
    await expect(page.getByText(/enter a valid email/i)).toBeVisible();
  });
});
