import { describe, it, expect } from "vitest";
import { DIGITAL_CARD_ID, hasDigitalCard } from "@/lib/digital-card-offer";
import { addOnsForProduct } from "@/lib/product-add-ons";
import { PRODUCTS } from "@/data/products";
import type { Product } from "@/types/product";

describe("hasDigitalCard", () => {
  it("finds it as a bouquet's add-on", () => {
    expect(
      hasDigitalCard([{ kind: "catalog", productId: "p-x", variantId: "lush", addOnIds: [DIGITAL_CARD_ID], qty: 1 }]),
    ).toBe(true);
  });

  it("finds it as its own line", () => {
    expect(
      hasDigitalCard([{ kind: "catalog", productId: DIGITAL_CARD_ID, variantId: "default", addOnIds: [], qty: 1 }]),
    ).toBe(true);
  });

  it("is false for an order without it", () => {
    expect(
      hasDigitalCard([{ kind: "catalog", productId: "p-x", variantId: "lush", addOnIds: ["x-card-premium"], qty: 1 }]),
    ).toBe(false);
  });
});

describe("where the digital card is offered", () => {
  it("is a gift extra kept out of the shop's listings", () => {
    const digital = PRODUCTS.find((p) => p.id === DIGITAL_CARD_ID);
    expect(digital?.giftExtra).toBe(true);
  });

  it("is not offered on a subscription", () => {
    // A weekly delivery has no one card to open. The catalog has no subscription
    // product today, so one is made from an ordinary bouquet.
    const bouquet = PRODUCTS.find((p) => p.slug === "velvet-sun")!;
    const subscription: Product = { ...bouquet, id: "sub-test", category: "subscriptions", subscription: { cadences: [] } };
    expect(addOnsForProduct(bouquet).map((a) => a.id)).toContain(DIGITAL_CARD_ID);
    expect(addOnsForProduct(subscription).map((a) => a.id)).not.toContain(DIGITAL_CARD_ID);
  });
});
