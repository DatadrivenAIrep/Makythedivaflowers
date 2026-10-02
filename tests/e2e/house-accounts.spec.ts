// tests/e2e/house-accounts.spec.ts
import { test, expect } from "@playwright/test";

const PASSWORD = process.env.INTAKE_PASSWORD ?? "test-pass";

test("house account: charge an order, issue, view the public statement, pay, see it settled", async ({ page }) => {
  await page.goto("/en/admin/login?next=/en/admin/accounts");
  await page.fill("input[type='password']", PASSWORD);
  await page.click("button[type='submit']");
  // The login URL itself contains "admin/accounts" in its ?next=, so match on pathname.
  await page.waitForURL((url) => url.pathname.endsWith("/admin/accounts"));

  const unique = Date.now().toString(36);
  const created = await page.request.post("/api/admin/accounts", {
    data: { name: `E2E Hotel ${unique}`, billingPhone: `516555${unique.slice(-4).padStart(4, "0")}`, locale: "en", termsDays: 15 },
  });
  expect(created.status()).toBe(201);
  const { account } = (await created.json()) as { account: { id: string } };

  const order = await page.request.post("/api/admin/orders", {
    data: {
      source: "phone",
      customer: { phone: "5165550371", name: "E2E Buyer" },
      fulfillment: { method: "in-store" },
      lines: [{ kind: "custom", title: "Lobby arrangement", priceCents: 12000, qty: 1 }],
      payment: { status: "account", accountId: account.id },
    },
  });
  expect(order.status()).toBe(201);

  const issued = await page.request.post(`/api/admin/accounts/${account.id}/statements`);
  expect(issued.status()).toBe(201);
  const { statement } = (await issued.json()) as { statement: { id: string; code: string; number: string } };

  const open = await page.request.get(`/s/${statement.code}`);
  expect(open.status()).toBe(200);
  const openHtml = await open.text();
  expect(openHtml).toContain(statement.number);
  expect(openHtml).toContain("Balance due");
  expect(openHtml).toContain(`/s/${statement.code}/pay`);

  await page.goto(`/en/admin/accounts/${account.id}`);
  await expect(page.getByRole("heading", { name: `E2E Hotel ${unique}` })).toBeVisible();
  await expect(page.getByRole("cell", { name: statement.number, exact: true })).toBeVisible();

  const detail = await (await page.request.get(`/api/admin/accounts/${account.id}`)).json() as { balanceCents: number };
  const paid = await page.request.post(`/api/admin/accounts/${account.id}/payments`, {
    data: { amountCents: detail.balanceCents, method: "zelle", note: "e2e" },
  });
  expect(paid.status()).toBe(200);

  const settled = await (await page.request.get(`/s/${statement.code}`)).text();
  expect(settled).toContain("Paid");
  expect(settled).not.toContain(`/s/${statement.code}/pay`);

  await page.reload();
  await expect(page.getByText("$0.00").first()).toBeVisible();
});
