import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { closeDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { createPromo, listPromos } from "@/lib/promo";

const createPI = vi.fn();
vi.mock("@/lib/stripe-server", () => ({
  stripe: { paymentIntents: { create: createPI } },
}));

const TEST_FILE = path.join(os.tmpdir(), `diva-test-orders-promo-${process.pid}.json`);

beforeEach(async () => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("ORDER_STORAGE_FILE", TEST_FILE);
  await fs.writeFile(TEST_FILE, "[]", "utf8");
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_dummy");
  createPI.mockReset();
  createPI.mockResolvedValue({ id: "pi_1", client_secret: "cs_1" });
  runMigrations();
});
afterEach(async () => {
  try { await fs.unlink(TEST_FILE); } catch {}
  closeDb();
  vi.unstubAllEnvs();
});

function makeReq(body: unknown) {
  return new Request("http://localhost/api/checkout/intent", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

// A Thousand Heartbeats, standard = $191.00, delivered to Albertson ($10).
const SUBTOTAL = 19100;
const DELIVERY = 1000;

const validBody = {
  locale: "en",
  lines: [{ productId: "p-arr-m01", variantId: "standard", addOnIds: [], qty: 1 }],
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

async function post(body: unknown) {
  const { POST } = await import("@/app/api/checkout/intent/route");
  return POST(makeReq(body));
}

describe("POST /api/checkout/intent with a promo code", () => {
  it("charges the discounted amount", async () => {
    createPromo({ code: "TEN", kind: "percent", value: 10 });
    const res = await post({ ...validBody, promoCode: "ten" });
    expect(res.status).toBe(200);

    const discount = Math.round(SUBTOTAL * 0.1);
    const taxable = SUBTOTAL + DELIVERY - discount;
    const expected = taxable + Math.round(taxable * 0.08625);
    expect(createPI).toHaveBeenCalledWith(
      expect.objectContaining({ amount: expected }),
      expect.anything(),
    );
  });

  it("charges the undiscounted amount when no code is sent", async () => {
    await post(validBody);
    const taxable = SUBTOTAL + DELIVERY;
    const expected = taxable + Math.round(taxable * 0.08625);
    expect(createPI).toHaveBeenCalledWith(
      expect.objectContaining({ amount: expected }),
      expect.anything(),
    );
  });

  it("rejects the order when the code is not valid", async () => {
    const res = await post({ ...validBody, promoCode: "NOSUCHCODE" });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.errors.formErrors).toContain("promo_invalid");
  });

  it("does not redeem the code while payment is still pending", async () => {
    const p = createPromo({ code: "PENDING", kind: "percent", value: 10 });
    await post({ ...validBody, promoCode: "PENDING" });
    // An abandoned checkout must not burn a single-use code.
    expect(listPromos().find((x) => x.id === p.id)?.redemptionCount).toBe(0);
  });

  it("passes the promo through Stripe metadata so the webhook can redeem it", async () => {
    const p = createPromo({ code: "META", kind: "percent", value: 10 });
    await post({ ...validBody, promoCode: "META" });
    const [args] = createPI.mock.calls[0];
    expect(args.metadata.promoId).toBe(p.id);
    expect(Number(args.metadata.promoDiscountCents)).toBe(Math.round(SUBTOTAL * 0.1));
  });

  it("refuses a code whose minimum this order does not meet", async () => {
    createPromo({ code: "MIN500", kind: "percent", value: 10, minSubtotalCents: 50000 });
    const res = await post({ ...validBody, promoCode: "MIN500" });
    expect(res.status).toBe(400);
  });

  it("recomputes the discount server-side rather than trusting the client", async () => {
    // The client only ever sends a code; there is no field for an amount, so a
    // tampered request cannot inflate the discount.
    createPromo({ code: "FIXED5", kind: "fixed", value: 500 });
    await post({ ...validBody, promoCode: "FIXED5", discountCents: 999999 });
    const taxable = SUBTOTAL + DELIVERY - 500;
    const expected = taxable + Math.round(taxable * 0.08625);
    expect(createPI).toHaveBeenCalledWith(
      expect.objectContaining({ amount: expected }),
      expect.anything(),
    );
  });
});
