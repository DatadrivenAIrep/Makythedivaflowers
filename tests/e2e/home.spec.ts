import { test, expect } from "@playwright/test";

test("home renders in English with hero, marquee, bento, studio visit", async ({ page }) => {
  await page.goto("/en");
  await expect(page.getByRole("heading", { level: 1, name: /Romance, by the stem/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Shop arrangements/ })).toBeVisible();
  await expect(page.getByText("The Ingrid Bouquet")).toBeVisible();
  await expect(page.getByRole("heading", { name: /Find your bloom/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Walk in, ring the bell/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Get directions/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Installations, by Diva/ })).toBeVisible();
  await expect(page.getByPlaceholder("you@email.com")).toBeVisible();
  await expect(page.getByText("516 484 3456")).toBeVisible();
});

test("home renders in Spanish", async ({ page }) => {
  await page.goto("/es");
  await expect(page.getByRole("heading", { level: 1, name: /Romance, tallo a tallo/ })).toBeVisible();
  await expect(page.getByText(/Encuentra tu flor/)).toBeVisible();
});

test("home has no console errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));
  page.on("console", (msg) => {
    if (msg.type() === "error" && !msg.text().includes("[HMR]")) errors.push(msg.text());
  });
  await page.goto("/en");
  await page.waitForLoadState("networkidle");
  expect(errors).toEqual([]);
});
