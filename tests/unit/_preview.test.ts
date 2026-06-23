// @vitest-environment node
import { describe, it } from "vitest";
import { writeFileSync } from "node:fs";
import puppeteer from "puppeteer-core";
import type { Order } from "@/types/order";
import { buildSheetHtml } from "@/lib/print-render-html";

const order: Order = {
  id: "do_preview1",
  orderNumber: 1042,
  source: "web",
  locale: "es",
  lines: [
    { kind: "catalog", productId: "p-arr-b1-01", variantId: "standard", addOnIds: ["candles"], qty: 1 },
  ],
  contact: { name: "Carlos Ramírez", email: "buyer@example.com", phone: "5165551234" },
  totals: { subtotalCents: 19100, deliveryCents: 1500, taxCents: 1647, totalCents: 22247 },
  status: "pending",
  paymentStatus: "paid",
  createdAt: "2026-06-16T15:30:00.000Z",
  updatedAt: "2026-06-16T15:30:00.000Z",
  stripePaymentIntentId: "pi_preview",
  fulfillment: {
    method: "delivery",
    recipient: { name: "María González", phone: "5165550142" },
    address: { street1: "123 Park Ave", street2: "Apt 4B", city: "Great Neck", state: "NY", zip: "11021", country: "US" },
    window: { date: "2026-06-18", slot: "afternoon" },
    cardMessage: "Con todo mi cariño, feliz cumpleaños.",
  },
};

describe("preview", () => {
  it("renders worksheet with order number + photo", async () => {
    const html = await buildSheetHtml(order);
    const browser = await puppeteer.launch({
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
      defaultViewport: { width: 1100, height: 850 },
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load", timeout: 30_000 });
    await page.screenshot({ path: "/tmp/preview-v3.png" });
    await browser.close();
  }, 90_000);
});
