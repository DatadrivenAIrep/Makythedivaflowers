import { test, expect } from "@playwright/test";

const PASSWORD = process.env.INTAKE_PASSWORD ?? "test-pass";
const CARD_URL = "https://tarjetas.makythedivaflowers.com/i/e2e-demo";

test("an order's digital card link prepares, then redirects", async ({ page }) => {
  await page.goto("/en/admin/login?next=/en/admin/intake");
  await page.fill("input[type='password']", PASSWORD);
  await page.click("button[type='submit']");
  await page.waitForURL(/\/admin\/intake/);

  // Same walk-in delivery flow as admin-intake.spec.ts, to get a real order id.
  // Note: the intake UI under /en renders English copy (see messages/en.json),
  // not the Spanish placeholders admin-intake.spec.ts uses — that mismatch is
  // pre-existing on this branch (confirmed by running admin-intake.spec.ts,
  // which fails the same way). Selectors below use the actual English text.
  await page.click("button:has-text('Walk-in')");
  await page.fill("input[placeholder='Phone']", "5165550300");
  await page.fill("input[placeholder='Name']", "E2E Digital Card");
  await page.click("button:has-text('Delivery')");
  await page.fill("input[placeholder='Recipient']", "Raymond");
  await page.fill("input[placeholder='Recipient phone']", "5165550399");
  await page.fill("input[placeholder*='Street']", "1 Main St, Albertson NY 11507");
  // No Google Places API key in the test env, so the address autocomplete
  // dropdown never appears (see app/api/admin/places/autocomplete/route.ts);
  // city/zip must be filled directly. "City"/"ZIP" also appear in the buyer
  // address block above, so scope to the second (recipient) occurrence.
  await page.locator("input[placeholder='City']").nth(1).fill("Albertson");
  await page.locator("input[placeholder='ZIP']").nth(1).fill("11507");
  await page.locator(".grid-cols-3 > button").first().click();
  await page.click("button:has-text('Cash')");
  await page.click("button:has-text('Save and print ticket')");
  await page.waitForURL(/\?ok=do_/);
  const orderId = new URL(page.url()).searchParams.get("ok")!;

  const activated = await page.request.post(`/api/admin/orders/${orderId}/digital-card`);
  expect(activated.ok()).toBe(true);
  const { code } = (await activated.json()) as { code: string };

  const preparing = await page.request.get(`/c/${code}`, { maxRedirects: 0 });
  expect(preparing.status()).toBe(200);
  expect(await preparing.text()).toContain('<meta name="robots" content="noindex">');

  const patched = await page.request.patch(`/api/admin/orders/${orderId}/digital-card`, {
    data: { targetUrl: CARD_URL },
  });
  expect(patched.ok()).toBe(true);

  const redirect = await page.request.get(`/c/${code}`, { maxRedirects: 0 });
  expect(redirect.status()).toBe(302);
  expect(redirect.headers()["location"]).toBe(CARD_URL);

  const unknown = await page.request.get("/c/Nope1234", { maxRedirects: 0 });
  expect(unknown.status()).toBe(404);
});
