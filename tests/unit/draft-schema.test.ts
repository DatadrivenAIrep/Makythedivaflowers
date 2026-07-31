import { describe, it, expect } from "vitest";
import { draftRequestSchema } from "@/schemas/draft";

const validPayload = {
  version: 1,
  channel: "walk-in",
  customer: { name: "", phone: "", email: "", messagingChannel: "sms" },
  fulfillment: {
    method: "delivery",
    recipient: { name: "", phone: "" },
    address: { street1: "", city: "", state: "NY", zip: "", country: "US" },
    window: { date: "2099-01-01", slot: "midday" },
    cardMessage: "",
  },
  lines: [],
  override: {},
  giftCardCode: "",
  payment: { status: "pending" },
};

describe("draftRequestSchema", () => {
  it("accepts a minimal / incomplete draft (no lines, empty fields)", () => {
    const parsed = draftRequestSchema.safeParse({ payload: validPayload, label: "", itemCount: 0, totalCents: 0 });
    expect(parsed.success).toBe(true);
  });

  it("defaults label/itemCount/totalCents when omitted", () => {
    const parsed = draftRequestSchema.safeParse({ payload: validPayload });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.label).toBe("");
      expect(parsed.data.itemCount).toBe(0);
      expect(parsed.data.totalCents).toBe(0);
    }
  });

  it("rejects a missing payload", () => {
    expect(draftRequestSchema.safeParse({ label: "x" }).success).toBe(false);
  });

  it("rejects an oversized payload (aggregate size, not a single field)", () => {
    const bigCustomer: Record<string, string> = {};
    for (let i = 0; i < 3000; i++) bigCustomer["k" + i] = "0123456789012345";
    const huge = { ...validPayload, customer: bigCustomer };
    const parsed = draftRequestSchema.safeParse({ payload: huge });
    expect(parsed.success).toBe(false);
    // ensure rejection is specifically the aggregate-size refine, not a per-field cap
    if (!parsed.success) {
      expect(parsed.error.issues.some((iss) => iss.message === "payload_too_large")).toBe(true);
    }
  });
});
