import { test, expect } from "@playwright/test";

test("home renders in English with hero, marquee, bento, studio visit", async ({ page }) => {
  await page.goto("/en");
  await expect(page.getByRole("heading", { level: 1, name: /Romance, by the stem/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Shop arrangements/ })).toBeVisible();
  await expect(page.getByText("A Thousand Heartbeats")).toBeVisible();
  await expect(page.getByRole("heading", { name: /Find your bloom/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Walk in, ring the bell/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Get directions/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Installations, by Diva/ })).toBeVisible();
  await expect(page.getByPlaceholder("you@email.com").first()).toBeVisible();
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

test("CategoryOrbit renders correctly on mobile (iPhone viewport)", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/en");

  // Header is present
  await expect(page.getByRole("heading", { name: /Find your bloom/ })).toBeVisible();

  // Hover-only chrome is hidden on mobile
  await expect(page.getByText("[hover to enter]")).toBeHidden();
  await expect(page.getByText(/LAT 40\.7000/)).toBeHidden();

  // Each of the six category links is visible and points to the right shop page
  const slugs = [
    "arrangements",
    "bouquets",
    "plants",
    "gifts",
    "sympathy",
    "subscriptions",
  ];
  for (const slug of slugs) {
    const link = page.locator(`a[href="/en/shop/${slug}"]`);
    await expect(link).toBeVisible();
    // Image inside the tile must be visible (it was hover-gated before)
    const img = link.locator("img");
    await expect(img).toBeVisible();
    const box = await img.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(0);
    expect(box!.height).toBeGreaterThan(0);
  }
});
