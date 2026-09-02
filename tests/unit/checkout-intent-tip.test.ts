import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { closeDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";

const createPI = vi.fn();
vi.mock("@/lib/stripe-server", () => ({
  stripe: { paymentIntents: { create: createPI } },
}));

const TEST_FILE = path.join(os.tmpdir(), `diva-test-orders-tip-${process.pid}.json`);

beforeEach(async () => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("ORDER_STORAGE_FILE", TEST_FILE);
  await fs.writeFile(TEST_FILE, "[]", "utf8");
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_dummy");
  createPI.mockReset();
  createPI.mockResolvedValue({ id: "pi_tip", client_secret: "cs_tip" });
  runMigrations();
});
afterEach(async () => {
  try { await fs.unlink(TEST_FILE); } catch {}
  closeDb();
  vi.unstubAllEnvs();
});

// A Thousand Heartbeats, standard = $191.00, delivered to Albertson ($10).
const SUBTOTAL = 19100;
const DELIVERY = 1000;
const TAX_RATE = 0.08625;

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
  return POST(
    new Request("http://localhost/api/checkout/intent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

describe("POST /api/checkout/intent with a tip", () => {
  it("charges the tip on top of the order", async () => {
    const res = await post({ ...validBody, tipCents: 1000 });
    expect(res.status).toBe(200);
    const taxable = SUBTOTAL + DELIVERY;
    const expected = taxable + Math.round(taxable * TAX_RATE) + 1000;
    expect(createPI).toHaveBeenCalledWith(
      expect.objectContaining({ amount: expected }),
      expect.anything(),
    );
  });

  it("does not tax the tip", async () => {
    await post({ ...validBody, tipCents: 5000 });
    const [withTip] = createPI.mock.calls[0];
    createPI.mockClear();
    await post(validBody);
    const [withoutTip] = createPI.mock.calls[0];
    expect(withTip.amount - withoutTip.amount).toBe(5000);
  });

  it("refuses a tip larger than the shop would ever take", async () => {
    // A typo turning $10 into $100000 must not be charged silently.
    expect((await post({ ...validBody, tipCents: 10_000_00 })).status).toBe(400);
  });

  it("refuses a negative tip", async () => {
    expect((await post({ ...validBody, tipCents: -500 })).status).toBe(400);
  });

  it("stores the tip on the order so the ledger can pay it out", async () => {
    await post({ ...validBody, tipCents: 1500 });
    const { getOrder } = await import("@/lib/order-storage");
    const [, opts] = createPI.mock.calls[0];
    const orderId = (opts as { idempotencyKey: string }).idempotencyKey;
    const order = await getOrder(orderId);
    expect(order?.totals.tipCents).toBe(1500);
  });
});
