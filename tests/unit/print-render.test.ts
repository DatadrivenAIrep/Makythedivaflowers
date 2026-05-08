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

  it("returns a 2-page Letter-landscape PDF", () => {
    expect(baseBuf).toBeInstanceOf(Buffer);
    expect(baseBuf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(basePages).toHaveLength(2);
  });

  it("page 1 contains worksheet info: order id, total, recipient, items, buyer", () => {
    const [pageA] = basePages;
    expect(pageA).toContain("do_test123");
    expect(pageA).toContain("$207.47");
    expect(pageA).toContain("Lola Cardona");
    expect(pageA).toContain("buyer@example.com");
    expect(pageA).toContain("Abundant Table");
  });

  it("page 1 contains the Maky front-cover wordmark", () => {
    const [pageA] = basePages;
    expect(pageA.toLowerCase()).toContain("maky");
  });

  it("page 2 contains the customer's cardMessage", () => {
    const [, pageB] = basePages;
    expect(pageB).toContain("Happy birthday");
  });

  it("page 2 does NOT contain the order id (back of worksheet is blank)", () => {
    const [, pageB] = basePages;
    expect(pageB).not.toContain("do_test123");
    expect(pageB).not.toContain("Lola Cardona");
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
    const [pageA] = await extractPageTexts(buf);
    expect(pageA).toContain("DELIVER TO");
    expect(pageA).toContain("123 Park Ave");
    expect(pageA).not.toContain("PICK");
  }, 120_000);

  it("renders PICK UP AT SHOP for pickup orders (en)", () => {
    const [pageA] = basePages;
    // pdf-parse may insert spaces inside letter-spaced glyphs; match on the
    // address which is plain text and on "SHOP" which always appears.
    expect(pageA).toContain("SHOP");
    expect(pageA).toContain("1077 Willis Ave");
  });

  it("localizes worksheet to Spanish when order.locale === 'es'", async () => {
    const order: Order = { ...baseOrder, locale: "es" };
    const buf = await renderOrderPdf(order);
    const [pageA] = await extractPageTexts(buf);
    // Headings are letter-spaced and pdf-parse inserts gaps inside words.
    // Use reliable plain-text strings: the order prefix in Spanish ("Orden #")
    // and the address, which is plain text.
    expect(pageA).toContain("Orden #");
    expect(pageA).not.toContain("Order #");
    expect(pageA).toContain("1077 Willis Ave");
  }, 120_000);

  it("renders without crashing when cardMessage is empty", async () => {
    const order: Order = {
      ...baseOrder,
      delivery: { ...baseOrder.delivery, cardMessage: "" } as Order["delivery"],
    };
    const buf = await renderOrderPdf(order);
    expect(buf.length).toBeGreaterThan(1000);
    const [, pageB] = await extractPageTexts(buf);
    expect(pageB).not.toContain("Happy birthday");
  }, 120_000);
});
