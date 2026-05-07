import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";

const createPI = vi.fn();
vi.mock("@/lib/stripe-server", () => ({
  stripe: {
    paymentIntents: { create: createPI },
  },
}));

const TEST_FILE = path.join(os.tmpdir(), `diva-test-orders-intent-${process.pid}.json`);

beforeEach(async () => {
  vi.stubEnv("ORDER_STORAGE_FILE", TEST_FILE);
  await fs.writeFile(TEST_FILE, "[]", "utf8");
  createPI.mockReset();
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_dummy");
});
afterEach(async () => {
  try { await fs.unlink(TEST_FILE); } catch {}
  vi.unstubAllEnvs();
});

function makeReq(body: unknown) {
  return new Request("http://localhost/api/checkout/intent", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validBody = {
  locale: "en",
  // Real product+variant from data/products.ts: A Thousand Heartbeats, standard ($191).
  lines: [
    { productId: "p-arr-m01", variantId: "standard", addOnIds: [], qty: 1 },
  ],
  form: {
    contact: { email: "buyer@example.com", phone: "5165551234" },
    delivery: {
      method: "delivery",
      recipient: { name: "Recipient Name", phone: "5165551234" },
      address: {
        street1: "1 Main St",
        street2: "",
        city: "Albertson",
        state: "NY",
        zip: "11507",
        country: "US",
      },
      window: { date: "2099-01-01", slot: "midday" },
      cardMessage: "",
    },
  },
};

describe("POST /api/checkout/intent", () => {
  it("returns 400 on invalid body", async () => {
    const { POST } = await import("@/app/api/checkout/intent/route");
    const res = await POST(makeReq({ bogus: 1 }));
    expect(res.status).toBe(400);
  });

  it("returns 400 with cart_empty when cart resolves to 0 subtotal", async () => {
    const { POST } = await import("@/app/api/checkout/intent/route");
    const res = await POST(makeReq({
      ...validBody,
      lines: [{ productId: "DOES_NOT_EXIST", variantId: "X", addOnIds: [], qty: 1 }],
    }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.errors.formErrors).toContain("cart_empty");
  });

  it("returns 400 with zip_not_in_zone when ZIP not covered", async () => {
    const { POST } = await import("@/app/api/checkout/intent/route");
    const res = await POST(makeReq({
      ...validBody,
      form: {
        ...validBody.form,
        delivery: {
          ...validBody.form.delivery,
          address: { ...validBody.form.delivery.address, zip: "90001" },
        },
      },
    }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.errors.formErrors).toContain("zip_not_in_zone");
  });

  it("returns 200 with clientSecret + orderId on happy path", async () => {
    createPI.mockResolvedValue({
      id: "pi_test_123",
      client_secret: "pi_test_123_secret_abc",
    });
    const { POST } = await import("@/app/api/checkout/intent/route");
    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.clientSecret).toBe("pi_test_123_secret_abc");
    expect(json.orderId).toMatch(/^do_/);
  });

  it("passes idempotencyKey = orderId to PaymentIntents.create", async () => {
    createPI.mockResolvedValue({ id: "pi_test_123", client_secret: "secret" });
    const { POST } = await import("@/app/api/checkout/intent/route");
    const res = await POST(makeReq(validBody));
    const json = await res.json();
    expect(createPI).toHaveBeenCalledTimes(1);
    const [_params, options] = createPI.mock.calls[0];
    expect(options.idempotencyKey).toBe(json.orderId);
  });

  it("returns 502 with payment_init_failed if Stripe throws", async () => {
    createPI.mockRejectedValue(new Error("stripe down"));
    const { POST } = await import("@/app/api/checkout/intent/route");
    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(502);
    const json = await res.json();
    expect(json.errors.formErrors).toContain("payment_init_failed");
  });

  it("returns 200 for pickup orders without an address", async () => {
    createPI.mockResolvedValue({ id: "pi_pickup_1", client_secret: "pi_pickup_1_secret" });
    const { POST } = await import("@/app/api/checkout/intent/route");
    const res = await POST(makeReq({
      locale: "en",
      lines: validBody.lines,
      form: {
        contact: validBody.form.contact,
        delivery: {
          method: "pickup",
          recipient: validBody.form.delivery.recipient,
          window: validBody.form.delivery.window,
          cardMessage: "",
        },
      },
    }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.clientSecret).toBe("pi_pickup_1_secret");
  });

  it("forces deliveryCents to 0 for pickup orders", async () => {
    createPI.mockResolvedValue({ id: "pi_pickup_2", client_secret: "pi_pickup_2_secret" });
    const { POST } = await import("@/app/api/checkout/intent/route");
    await POST(makeReq({
      locale: "en",
      lines: validBody.lines,
      form: {
        contact: validBody.form.contact,
        delivery: {
          method: "pickup",
          recipient: validBody.form.delivery.recipient,
          window: validBody.form.delivery.window,
          cardMessage: "",
        },
      },
    }));
    // The product is $191 (p-arr-m01 standard). Pickup => no delivery fee.
    // Tax is 8.625% of (subtotal + delivery).
    // Expected total: 19100 + 0 + round(19100 * 0.08625) = 19100 + 1647 = 20747
    const [params] = createPI.mock.calls[0];
    expect(params.amount).toBe(20747);
  });

  it("ignores zip_not_in_zone for pickup orders even if address-shaped data is sent", async () => {
    createPI.mockResolvedValue({ id: "pi_pickup_3", client_secret: "pi_pickup_3_secret" });
    const { POST } = await import("@/app/api/checkout/intent/route");
    // Send an out-of-zone ZIP alongside method=pickup. Zod's discriminatedUnion
    // selects the pickup branch (which has no address field), so the address
    // key is stripped before the route sees it. The route never runs the ZIP
    // zone check on pickup, so this returns 200 even though "90001" is not in zone.
    const res = await POST(makeReq({
      locale: "en",
      lines: validBody.lines,
      form: {
        contact: validBody.form.contact,
        delivery: {
          method: "pickup",
          recipient: validBody.form.delivery.recipient,
          window: validBody.form.delivery.window,
          cardMessage: "",
          address: { street1: "1 Out Of Zone", city: "Los Angeles", state: "CA", zip: "90001", country: "US" },
        },
      },
    }));
    expect(res.status).toBe(200);
  });
});
