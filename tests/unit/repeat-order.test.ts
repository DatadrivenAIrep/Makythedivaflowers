import { describe, it, expect } from "vitest";
import { repeatOrderPayload } from "@/lib/repeat-order";
import type { Order, CartLine } from "@/types/order";
import type { Product } from "@/types/product";

const product = (over: Partial<Product>): Product => ({
  id: "p1",
  slug: "p1",
  title: { en: "Rose Cloud", es: "Nube de Rosas" },
  category: "arrangements",
  blurb: { en: "", es: "" },
  description: { en: "", es: "" },
  images: [],
  variants: [
    { id: "standard", label: { en: "Standard", es: "Clásico" }, priceCents: 10000 },
    { id: "grand", label: { en: "Grand", es: "Grande" }, priceCents: 15000 },
  ],
  tags: [],
  occasions: [],
  colorFamily: [],
  active: true,
  seo: { title: { en: "", es: "" }, description: { en: "", es: "" } },
  ...over,
});

const PRODUCTS = [
  product({}),
  product({ id: "retired", title: { en: "Santa's Garden", es: "Jardín de Santa" }, active: false }),
  product({ id: "quote", quoteOnly: true }),
];

const catalog = (productId: string, variantId = "standard", qty = 1): CartLine => ({
  kind: "catalog", productId, variantId, addOnIds: [], qty,
});

const order = (over: Partial<Order> = {}): Order => ({
  id: "ord_1",
  orderNumber: 1234,
  source: "phone",
  locale: "es",
  lines: [catalog("p1", "grand", 2), { kind: "custom", title: "Corona especial", priceCents: 45000, qty: 1 }],
  fulfillment: {
    method: "delivery",
    recipient: { name: "Iglesia San José", phone: "5165550199" },
    address: { street1: "1 Main St", city: "Albertson", state: "NY", zip: "11507", country: "US" },
    window: { date: "2026-10-03", slot: "morning", time: "09:30" },
    cardMessage: "Feliz cumpleaños, mamá",
  },
  contact: { name: "Ana Pérez", email: "ana@example.com", phone: "5165550100" },
  totals: { subtotalCents: 75000, deliveryCents: 1000, discountCents: 5000, tipCents: 500, taxCents: 6000, totalCents: 77500 },
  status: "delivered",
  paymentStatus: "paid",
  paymentMethod: "cash",
  amountPaidCents: 77500,
  promoCode: "DIVA25",
  funeral: true,
  createdAt: "2026-10-03T15:00:00Z",
  updatedAt: "2026-10-03T15:00:00Z",
  ...over,
});

describe("repeatOrderPayload", () => {
  it("copies the buyer, the recipient, the address and the pieces", () => {
    const { payload } = repeatOrderPayload(order(), PRODUCTS);
    expect(payload.channel).toBe("phone");
    expect(payload.customer).toMatchObject({ name: "Ana Pérez", phone: "5165550100", email: "ana@example.com", locale: "es" });
    expect(payload.fulfillment.method).toBe("delivery");
    expect(payload.fulfillment.recipient).toEqual({ name: "Iglesia San José", phone: "5165550199" });
    expect(payload.fulfillment.address).toMatchObject({ street1: "1 Main St", zip: "11507" });
    expect(payload.fulfillment.funeral).toBe(true);
    expect(payload.lines).toEqual([
      catalog("p1", "grand", 2),
      { kind: "custom", title: "Corona especial", priceCents: 45000, qty: 1 },
    ]);
  });

  it("starts the date, the card, the payment and the money adjustments fresh", () => {
    const { payload, previousCardMessage } = repeatOrderPayload(order(), PRODUCTS);
    expect(payload.fulfillment.window.date).not.toBe("2026-10-03");
    expect(payload.fulfillment.window.time).toBeUndefined();
    expect(payload.fulfillment.cardMessage).toBe("");
    expect(previousCardMessage).toBe("Feliz cumpleaños, mamá");
    expect(payload.payment).toEqual({ status: "pending" });
    expect(payload.override).toEqual({});
    expect(payload.promoCode).toBeUndefined();
    expect(payload.giftCardCode).toBe("");
    expect(payload.taxExempt).toBeUndefined();
  });

  it("drops pieces no longer on sale and says which", () => {
    const r = repeatOrderPayload(
      order({ lines: [catalog("p1"), catalog("retired", "grand"), catalog("quote"), catalog("p1", "gone"), catalog("deleted")] }),
      PRODUCTS,
    );
    expect(r.payload.lines).toEqual([catalog("p1")]);
    expect(r.dropped.map((d) => d.es)).toEqual(["Jardín de Santa (Grande)", "Nube de Rosas", "Nube de Rosas (gone)", "deleted"]);
  });

  it("keeps a pickup a pickup, and a web order comes back as a phone order", () => {
    const { payload } = repeatOrderPayload(
      order({
        source: "web",
        fulfillment: { method: "pickup", recipient: { name: "Ana", phone: "5165550100" }, window: { date: "2026-10-03", slot: "afternoon" } },
      }),
      PRODUCTS,
    );
    expect(payload.channel).toBe("phone");
    expect(payload.fulfillment.method).toBe("pickup");
    expect(payload.fulfillment.recipient.name).toBe("Ana");
    expect(payload.fulfillment.address.street1).toBe("");
  });

  it("names the order it came from", () => {
    expect(repeatOrderPayload(order(), PRODUCTS).from).toEqual({ id: "ord_1", orderNumber: 1234, createdAt: "2026-10-03T15:00:00Z" });
  });
});
