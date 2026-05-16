// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Order } from "@/types/order";
import { renderOrderPdf } from "@/lib/print-render";
import { __closeBrowser } from "@/lib/print-chromium";
import { extractPageTexts } from "./helpers/pdf-text";

afterAll(async () => {
  await __closeBrowser();
});

const baseOrder: Order = {
  id: "do_test123",
  locale: "en",
  lines: [
    { productId: "p-arr-b1-01", variantId: "standard", addOnIds: ["candles"], qty: 1 },
  ],
  contact: { email: "buyer@example.com", phone: "5165551234" },
  totals: { subtotalCents: 19100, deliveryCents: 0, taxCents: 1647, totalCents: 20747 },
  status: "paid",
  createdAt: "2026-05-07T15:30:00.000Z",
  stripePaymentIntentId: "pi_3O123abc",
  delivery: {
    method: "pickup",
    recipient: { name: "Lola Cardona", phone: "5165550101" },
    window: { date: "2026-05-15", slot: "midday" },
    cardMessage: "Happy birthday",
  },
};

describe("renderOrderPdf — v2", () => {
  // Render the base order once; share across multiple tests to avoid
  // launching Chrome per assertion (each renderOrderPdf call takes ~50s).
  let baseBuf: Buffer;
  let basePages: string[];

  beforeAll(async () => {
    baseBuf = await renderOrderPdf(baseOrder);
    basePages = await extractPageTexts(baseBuf);
  }, 120_000);

  it("returns a 1-page Letter-landscape PDF", () => {
    expect(baseBuf).toBeInstanceOf(Buffer);
    expect(baseBuf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(basePages).toHaveLength(1);
  });

  it("contains worksheet info: order id, total, recipient, items, buyer", () => {
    const [page] = basePages;
    expect(page).toContain("do_test123");
    expect(page).toContain("$207.47");
    expect(page).toContain("Lola Cardona");
    expect(page).toContain("buyer@example.com");
    expect(page).toContain("Abundant Table");
  });

  it("contains the Maky brand-cover wordmark on the tri-fold card", () => {
    const [page] = basePages;
    expect(page.toLowerCase()).toContain("maky");
  });

  it("contains the customer's cardMessage on the same page (middle panel)", () => {
    const [page] = basePages;
    expect(page).toContain("Happy birthday");
  });

  it("renders DELIVER TO block for delivery orders (en)", async () => {
    const order: Order = {
      ...baseOrder,
      delivery: {
        method: "delivery",
        recipient: { name: "María González", phone: "2125550142" },
        address: { street1: "123 Park Ave", street2: "Apt 4B", city: "New York", state: "NY", zip: "10016", country: "US" },
        window: { date: "2026-05-07", slot: "afternoon" },
        cardMessage: "Te quiero",
      },
    };
    const buf = await renderOrderPdf(order);
    const [page] = await extractPageTexts(buf);
    expect(page).toContain("DELIVER TO");
    expect(page).toContain("123 Park Ave");
    expect(page).not.toContain("PICK");
  }, 120_000);

  it("renders PICK UP AT SHOP for pickup orders (en)", () => {
    const [page] = basePages;
    // pdf-parse may insert spaces inside letter-spaced glyphs; match on the
    // address which is plain text and on "SHOP" which always appears.
    expect(page).toContain("SHOP");
    expect(page).toContain("1077 Willis Ave");
  });

  it("localizes worksheet to Spanish when order.locale === 'es'", async () => {
    const order: Order = { ...baseOrder, locale: "es" };
    const buf = await renderOrderPdf(order);
    const [page] = await extractPageTexts(buf);
    expect(page).toContain("Orden #");
    expect(page).not.toContain("Order #");
    expect(page).toContain("1077 Willis Ave");
  }, 120_000);

  it("renders without crashing when cardMessage is empty", async () => {
    const order: Order = {
      ...baseOrder,
      delivery: { ...baseOrder.delivery, cardMessage: "" } as Order["delivery"],
    };
    const buf = await renderOrderPdf(order);
    expect(buf.length).toBeGreaterThan(1000);
    const [page] = await extractPageTexts(buf);
    expect(page).not.toContain("Happy birthday");
  }, 120_000);
});
