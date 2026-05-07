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
});
