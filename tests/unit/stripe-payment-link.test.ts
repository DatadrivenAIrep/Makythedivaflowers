import { describe, it, expect, beforeEach, vi } from "vitest";

// Prevent stripe-server from throwing at import time (no real key needed for unit tests)
vi.mock("@/lib/stripe-server", () => ({
  stripe: {
    checkout: { sessions: { create: vi.fn() } },
  },
}));

import { buildCheckoutSessionParams } from "@/lib/stripe-payment-link";
import type { Order } from "@/types/order";

const sampleOrder: Order = {
  id: "do_test_abc",
  source: "phone",
  locale: "en",
  customerId: "cus_1",
  lines: [{ kind: "catalog", productId: "p1", variantId: "standard", addOnIds: [], qty: 1 }],
  fulfillment: {
    method: "delivery",
    recipient: { name: "Lola", phone: "5165550199" },
    address: { street1: "1 Main", city: "Albertson", state: "NY", zip: "11507", country: "US" },
    window: { date: "2099-01-01", slot: "midday" },
  },
  contact: { email: "lola@example.com", phone: "5165550100" },
  totals: { subtotalCents: 9400, deliveryCents: 1500, taxCents: 891, totalCents: 11791 },
  status: "pending",
  paymentStatus: "pending",
  createdAt: "2026-05-17T10:00:00.000Z",
  updatedAt: "2026-05-17T10:00:00.000Z",
};

beforeEach(() => {
  vi.stubEnv("SITE_URL", "https://example.com");
});

describe("buildCheckoutSessionParams", () => {
  it("includes orderId in metadata", () => {
    const p = buildCheckoutSessionParams(sampleOrder, "en");
    expect(p.metadata?.orderId).toBe("do_test_abc");
    expect(p.client_reference_id).toBe("do_test_abc");
    expect(p.payment_intent_data?.metadata?.orderId).toBe("do_test_abc");
  });

  it("uses the order total in unit_amount", () => {
    const p = buildCheckoutSessionParams(sampleOrder, "en");
    const item = p.line_items![0];
    expect(item.price_data!.unit_amount).toBe(11791);
    expect(item.price_data!.currency).toBe("usd");
    expect(item.quantity).toBe(1);
  });

  it("sets expires_at to ~24h from now", () => {
    const p = buildCheckoutSessionParams(sampleOrder, "en");
    const nowSec = Math.floor(Date.now() / 1000);
    expect(p.expires_at).toBeGreaterThan(nowSec + 60 * 60 * 23);
    expect(p.expires_at).toBeLessThanOrEqual(nowSec + 60 * 60 * 24);
  });

  it("uses locale-prefixed success_url + cancel_url", () => {
    const p = buildCheckoutSessionParams(sampleOrder, "es");
    expect(p.success_url).toBe("https://example.com/es/order/do_test_abc/confirmation");
    expect(p.cancel_url).toBe("https://example.com/es/admin/intake");
  });

  it("pre-fills customer_email when available", () => {
    const p = buildCheckoutSessionParams(sampleOrder, "en");
    expect(p.customer_email).toBe("lola@example.com");
  });

  it("omits customer_email when not present", () => {
    const noEmail: Order = { ...sampleOrder, contact: { phone: "5165550100" } };
    const p = buildCheckoutSessionParams(noEmail, "en");
    expect(p.customer_email).toBeUndefined();
  });
});
