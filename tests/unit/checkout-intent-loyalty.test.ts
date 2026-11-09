import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { closeDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { createPromo } from "@/lib/promo";
import { issueGiftCard } from "@/lib/gift-card-storage";
import { getOrder } from "@/lib/order-storage";
import { signProof } from "@/lib/loyalty-proof";
import { PRODUCTS } from "@/data/products";

const createPI = vi.fn();
vi.mock("@/lib/stripe-server", () => ({
  stripe: { paymentIntents: { create: createPI, update: vi.fn() } },
}));
vi.mock("@/lib/order-notifications", () => ({ notifyOrderPaid: vi.fn(async () => {}) }));
vi.mock("@/lib/print-queue", () => ({ enqueuePrintJob: vi.fn(async () => {}) }));
vi.mock("@/lib/on-web-order-paid", () => ({ onWebOrderPaid: vi.fn(async () => {}) }));

const lookup = vi.fn();
vi.mock("@/lib/loyalty-client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/loyalty-client")>("@/lib/loyalty-client");
  return { ...actual, lookupCustomer: lookup };
});

const TEST_FILE = path.join(os.tmpdir(), `diva-test-orders-loyalty-${process.pid}.json`);
const PHONE = "5165551234";

beforeEach(async () => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("ORDER_STORAGE_FILE", TEST_FILE);
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_dummy");
  vi.stubEnv("LOYALTY_API_URL", "http://loyalty.test/api/v1");
  vi.stubEnv("LOYALTY_API_KEY", "key_test");
  await fs.writeFile(TEST_FILE, "[]", "utf8");
  createPI.mockReset();
  createPI.mockResolvedValue({ id: "pi_1", client_secret: "cs_1" });
  lookup.mockReset();
  runMigrations();
});
afterEach(async () => {
  try { await fs.unlink(TEST_FILE); } catch {}
  closeDb();
  vi.unstubAllEnvs();
});

const SUBTOTAL = PRODUCTS.find((p) => p.id === "p-arr-m01")!
  .variants.find((v) => v.id === "standard")!.priceCents;
const DELIVERY = 1000;

function body(extra: Record<string, unknown> = {}, method: "delivery" | "pickup" = "delivery") {
  return {
    locale: "en",
    lines: [{ productId: "p-arr-m01", variantId: "standard", addOnIds: [], qty: 1 }],
    form: {
      contact: { name: "Robyn Buyer", email: "buyer@example.com", phone: PHONE },
      delivery:
        method === "delivery"
          ? {
              method: "delivery",
              recipient: { name: "Recipient Name", phone: PHONE },
              address: { street1: "1 Main St", street2: "", city: "Albertson", state: "NY", zip: "11507", country: "US" },
              window: { date: "2099-01-01", slot: "midday" },
              cardMessage: "",
            }
          : {
              method: "pickup",
              recipient: { name: "Recipient Name", phone: PHONE },
              window: { date: "2099-01-01", slot: "midday" },
              cardMessage: "",
            },
    },
    ...extra,
  };
}

async function post(b: unknown) {
  const { POST } = await import("@/app/api/checkout/intent/route");
  return POST(
    new Request("http://localhost/api/checkout/intent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(b),
    }),
  );
}

const reward = { id: "r1", percent: 10, label: "10% off" };
const proof = (rewards = [reward], phone = PHONE) => signProof(phone, rewards);
const listed = (reward_text = "10% off", id = "r1") => ({
  id: 1,
  cardUrl: "x",
  rewards: { available: [{ id, reward: reward_text, final: false }] },
});

function expectedCharge(percent: number) {
  const discount = Math.min(Math.round((SUBTOTAL * percent) / 100), SUBTOTAL);
  const taxable = SUBTOTAL + DELIVERY - discount;
  return taxable + Math.round(taxable * 0.08625);
}

describe("POST /api/checkout/intent with a loyalty reward", () => {
  it("computes the discount on the server from the reward, ignoring anything the client sends", async () => {
    lookup.mockResolvedValue(listed());
    const res = await post(
      body({ loyaltyRewardId: "r1", loyaltyProof: proof(), loyaltyRewardPercent: 90, loyaltyRewardLabel: "free", discountCents: 99999 }),
    );
    expect(res.status).toBe(200);
    expect(createPI).toHaveBeenCalledWith(expect.objectContaining({ amount: expectedCharge(10) }), expect.anything());
    expect(lookup).toHaveBeenCalledWith("+15165551234", { timeoutMs: 2500 });
  });

  it("rejects promoCode and loyaltyRewardId together with loyalty_with_promo", async () => {
    createPromo({ code: "TEN", kind: "percent", value: 10 });
    const res = await post(body({ promoCode: "TEN", loyaltyRewardId: "r1", loyaltyProof: proof() }));
    expect(res.status).toBe(400);
    expect((await res.json()).errors.formErrors).toEqual(["loyalty_with_promo"]);
    expect(createPI).not.toHaveBeenCalled();
  });

  it("rejects a proof issued to another phone", async () => {
    const res = await post(body({ loyaltyRewardId: "r1", loyaltyProof: proof([reward], "5165559999") }));
    expect(res.status).toBe(400);
    expect((await res.json()).errors.formErrors).toEqual(["loyalty_proof_invalid"]);
    expect(lookup).not.toHaveBeenCalled();
  });

  it("rejects a proof that does not include the reward", async () => {
    const res = await post(body({ loyaltyRewardId: "other", loyaltyProof: proof() }));
    expect(res.status).toBe(400);
    expect((await res.json()).errors.formErrors).toEqual(["loyalty_proof_invalid"]);
  });

  it("rejects a reward id with no proof", async () => {
    const res = await post(body({ loyaltyRewardId: "r1" }));
    expect(res.status).toBe(400);
    expect((await res.json()).errors.formErrors).toEqual(["loyalty_proof_invalid"]);
  });

  it("returns loyalty_reward_unavailable when the program no longer lists it", async () => {
    lookup.mockResolvedValue(listed("10% off", "someone-else"));
    const res = await post(body({ loyaltyRewardId: "r1", loyaltyProof: proof() }));
    expect(res.status).toBe(400);
    expect((await res.json()).errors.formErrors).toEqual(["loyalty_reward_unavailable"]);
    expect(createPI).not.toHaveBeenCalled();
  });

  it("uses the current percent when the program answers with a different one", async () => {
    lookup.mockResolvedValue(listed("15% off"));
    await post(body({ loyaltyRewardId: "r1", loyaltyProof: proof() }));
    expect(createPI).toHaveBeenCalledWith(expect.objectContaining({ amount: expectedCharge(15) }), expect.anything());
  });

  it("honours the proof percent when the program is unavailable", async () => {
    const { LoyaltyApiError } = await import("@/lib/loyalty-client");
    lookup.mockRejectedValue(new LoyaltyApiError("timeout", 0));
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await post(body({ loyaltyRewardId: "r1", loyaltyProof: proof() }));
    expect(res.status).toBe(200);
    expect(createPI).toHaveBeenCalledWith(expect.objectContaining({ amount: expectedCharge(10) }), expect.anything());
    expect(err).toHaveBeenCalledWith("[loyalty] lookup failed, using proof", { name: "LoyaltyApiError", code: "timeout", status: 0 });
    err.mockRestore();
  });

  it("re-pricing the same order without the reward clears reward fields and discount", async () => {
    lookup.mockResolvedValue(listed());
    const first = await (await post(body({ loyaltyRewardId: "r1", loyaltyProof: proof(), tipCents: 0 }))).json();
    expect((await getOrder(first.orderId))?.loyaltyRewardId).toBe("r1");

    createPI.mockClear();
    const second = await (await post(body({ orderId: first.orderId }))).json();
    expect(second.orderId).toBe(first.orderId);
    const order = await getOrder(first.orderId);
    expect(order?.loyaltyRewardId).toBeUndefined();
    expect(order?.loyaltyRewardLabel).toBeUndefined();
    expect(order?.loyaltyRewardPercent).toBeUndefined();
    expect(order?.totals.discountCents ?? 0).toBe(0);
  });

  it("stores id, label, percent and loyaltyJoin on the order and leaves promoId empty", async () => {
    lookup.mockResolvedValue(listed());
    const b = body({ loyaltyRewardId: "r1", loyaltyProof: proof() });
    const data = await (await post({ ...b, form: { ...b.form, joinLoyaltyCard: true } })).json();
    const order = await getOrder(data.orderId);
    expect(order).toMatchObject({
      loyaltyRewardId: "r1",
      loyaltyRewardLabel: "10% off",
      loyaltyRewardPercent: 10,
      loyaltyJoin: true,
    });
    expect(order?.promoId).toBeUndefined();
    expect(order?.totals.discountCents).toBe(Math.round(SUBTOTAL * 0.1));
  });

  it("works alongside a gift card, including full coverage", async () => {
    lookup.mockResolvedValue(listed());
    const small = issueGiftCard({ initialCents: 500, recipientEmail: "a@b.com" });
    await post(body({ loyaltyRewardId: "r1", loyaltyProof: proof(), giftCardCode: small.code }));
    expect(createPI).toHaveBeenCalledWith(
      expect.objectContaining({ amount: expectedCharge(10) - 500 }),
      expect.anything(),
    );

    createPI.mockClear();
    const big = issueGiftCard({ initialCents: 100000, recipientEmail: "a@b.com" });
    const res = await post(body({ loyaltyRewardId: "r1", loyaltyProof: proof(), giftCardCode: big.code }));
    const data = await res.json();
    expect(data.paid).toBe(true);
    expect(createPI).not.toHaveBeenCalled();
    const order = await getOrder(data.orderId);
    expect(order?.loyaltyRewardId).toBe("r1");
  });

  it("with the connection off, a request with loyaltyRewardId gets loyalty_reward_unavailable", async () => {
    vi.stubEnv("LOYALTY_API_URL", "");
    const res = await post(body({ loyaltyRewardId: "r1", loyaltyProof: proof() }));
    expect(res.status).toBe(400);
    expect((await res.json()).errors.formErrors).toEqual(["loyalty_reward_unavailable"]);
  });

  it("with the connection off, a request without a reward behaves as before", async () => {
    vi.stubEnv("LOYALTY_API_URL", "");
    const res = await post(body());
    expect(res.status).toBe(200);
    expect(lookup).not.toHaveBeenCalled();
  });
});
