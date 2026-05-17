import { test, expect } from "@playwright/test";

const PASSWORD = process.env.INTAKE_PASSWORD ?? "test-pass";

test.beforeEach(async ({ page }) => {
  await page.goto("/en/admin/login?next=/en/admin/intake");
  await page.fill("input[type='password']", PASSWORD);
  await page.click("button[type='submit']");
  await page.waitForURL(/\/admin\/intake/);
});

test("walk-in delivery with cash creates order + print job", async ({ page }) => {
  // Channel defaults to Walk-in; click to make explicit.
  await page.click("button:has-text('Walk-in')");
  await page.fill("input[placeholder='Teléfono']", "5165550100");
  await page.fill("input[placeholder='Nombre']", "E2E Test");

  // Fulfillment defaults to Delivery.
  await page.click("button:has-text('Delivery')");
  await page.fill("input[placeholder='Destinatario']", "Lola");
  await page.fill("input[placeholder='Tel destinatario']", "5165550199");
  await page.fill(
    "input[placeholder*='Dirección']",
    "1 Main St, Albertson NY 11507",
  );

  // Pick the first product in the grid.
  await page.locator(".grid-cols-3 > button").first().click();

  // Select cash payment.
  await page.click("button:has-text('Efectivo')");

  await page.click("button:has-text('Guardar e imprimir ticket')");
  await page.waitForURL(/\?ok=do_/);
  await expect(page).toHaveURL(/\?ok=do_/);
});

test("phone order with delivery and pending payment is saved", async ({ page }) => {
  await page.click("button:has-text('Teléfono')");
  await page.fill("input[placeholder='Teléfono']", "5165550200");
  await page.fill("input[placeholder='Nombre']", "Phone Caller");

  // Use Delivery (default) so recipient fields are visible and schema passes.
  await page.click("button:has-text('Delivery')");
  await page.fill("input[placeholder='Destinatario']", "Recipient Name");
  await page.fill("input[placeholder='Tel destinatario']", "5165550298");
  await page.fill(
    "input[placeholder*='Dirección']",
    "2 Oak Ave, Albertson NY 11507",
  );

  await page.locator(".grid-cols-3 > button").first().click();
  await page.click("button:has-text('Pendiente')");

  await page.click("button:has-text('Guardar e imprimir ticket')");
  await page.waitForURL(/\?ok=do_/);
  await expect(page).toHaveURL(/\?ok=do_/);
});

test("recurring customer prefills name on second order", async ({ page }) => {
  // First order — creates the customer record.
  await page.fill("input[placeholder='Teléfono']", "5165550300");
  await page.fill("input[placeholder='Nombre']", "Recurring Person");

  // Delivery is the default; fill required recipient fields.
  await page.fill("input[placeholder='Destinatario']", "Dest Person");
  await page.fill("input[placeholder='Tel destinatario']", "5165550399");
  await page.fill(
    "input[placeholder*='Dirección']",
    "3 Pine Rd, Albertson NY 11507",
  );

  await page.locator(".grid-cols-3 > button").first().click();
  await page.click("button:has-text('Efectivo')");
  await page.click("button:has-text('Guardar e imprimir ticket')");
  await page.waitForURL(/\?ok=do_/);

  // Form has been reset. Type the same phone again — lookup debounce is 300 ms.
  await page.fill("input[placeholder='Teléfono']", "5165550300");
  await expect(page.locator("text=Cliente recurrente")).toBeVisible({ timeout: 5000 });
  await expect(page.locator("input[placeholder='Nombre']")).toHaveValue("Recurring Person");
});
