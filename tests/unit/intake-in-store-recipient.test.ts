import { describe, it, expect } from "vitest";
import { toOrderFulfillment, type FulfillmentState } from "@/components/admin/intake/FulfillmentBlock";
import { intakeSchema } from "@/schemas/intake";

// Repro for the "take it now" (in-store) intake bug: the FulfillmentBlock hides
// the recipient inputs for in-store, so `recipient` stays empty. The intake
// schema requires a valid recipient (name >= 2, phone >= 10 digits), so the API
// rejected every in-store order with a 400. Fix: use the buyer as the recipient.

function inStoreState(): FulfillmentState {
  return {
    method: "in-store",
    recipient: { name: "", phone: "" }, // UI never lets you fill these for in-store
    address: { street1: "", city: "", state: "NY", zip: "", country: "US" },
    window: { date: "2026-07-20", slot: "midday" },
    cardMessage: "",
  };
}

const buyer = { name: "Ana Ruiz", phone: "(516) 555-1234" };

function body(fulfillment: unknown, customer: Record<string, unknown>) {
  return {
    source: "walk-in",
    customer,
    fulfillment,
    lines: [{ kind: "custom", title: "Ramo del mostrador", priceCents: 5000, qty: 1 }],
    payment: { status: "pending" },
  };
}

describe("in-store 'take it now' uses the buyer as recipient", () => {
  it("fills the recipient from the buyer when the in-store recipient is empty", () => {
    const f = toOrderFulfillment(inStoreState(), buyer);
    expect(f.method).toBe("in-store");
    expect(f.recipient).toEqual({ name: "Ana Ruiz", phone: "(516) 555-1234" });
  });

  it("produces a payload the intake schema accepts", () => {
    const parsed = intakeSchema.safeParse(
      body(toOrderFulfillment(inStoreState(), buyer), {
        name: buyer.name,
        phone: buyer.phone,
        messagingChannel: "sms",
        locale: "es",
      }),
    );
    expect(parsed.success).toBe(true);
  });

  it("does not overwrite an explicitly entered recipient with the buyer", () => {
    const s: FulfillmentState = { ...inStoreState(), recipient: { name: "Lola", phone: "5165550101" } };
    const f = toOrderFulfillment(s, buyer);
    expect(f.recipient).toEqual({ name: "Lola", phone: "5165550101" });
  });

  it("still rejects an in-store order with no buyer and no recipient", () => {
    const parsed = intakeSchema.safeParse(
      body(toOrderFulfillment(inStoreState()), { messagingChannel: "sms", locale: "es" }),
    );
    expect(parsed.success).toBe(false);
  });
});
