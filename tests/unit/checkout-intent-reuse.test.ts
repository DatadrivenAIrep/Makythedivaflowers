import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { getOrder } from "@/lib/order-storage";

const { createPI, updatePI } = vi.hoisted(() => ({ createPI: vi.fn(), updatePI: vi.fn() }));
vi.mock("@/lib/stripe-server", () => ({
  stripe: { paymentIntents: { create: createPI, update: updatePI } },
}));

const TEST_FILE = path.join(os.tmpdir(), `diva-test-reuse-${process.pid}.json`);

beforeEach(async () => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("ORDER_STORAGE_FILE", TEST_FILE);
  await fs.writeFile(TEST_FILE, "[]", "utf8");
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_dummy");
  createPI.mockReset();
  updatePI.mockReset();
  let n = 0;
  createPI.mockImplementation(async () => {
    n += 1;
    return { id: `pi_${n}`, client_secret: `cs_${n}` };
  });
  updatePI.mockImplementation(async (id: string) => ({ id, client_secret: `cs_${id}_v2` }));
  runMigrations();
});
afterEach(async () => {
  try { await fs.unlink(TEST_FILE); } catch {}
  closeDb();
  vi.unstubAllEnvs();
});

const BUYER = { name: "Robyn Buyer", email: "buyer@example.com", phone: "5165551234" };

function body(extra: Record<string, unknown> = {}, contact = BUYER) {
  return {
    locale: "en",
    lines: [{ productId: "p-arr-m01", variantId: "standard", addOnIds: [], qty: 1 }],
    form: {
      contact,
      delivery: {
        method: "pickup",
        recipient: { name: "Recipient Name", phone: "5165551234" },
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

function orderCount(): number {
  return (getDb().prepare("SELECT COUNT(*) AS n FROM orders").get() as { n: number }).n;
}

async function firstOrderId(): Promise<string> {
  const res = await post(body());
  expect(res.status).toBe(200);
  return (await res.json()).orderId as string;
}

describe("POST /api/checkout/intent reusing a checkout in progress", () => {
  it("writes one order for the first request", async () => {
    await firstOrderId();
    expect(orderCount()).toBe(1);
  });

  it("keeps a single order when the buyer changes the tip", async () => {
    // The whole point: eight tries used to leave eight pending rows behind.
    const orderId = await firstOrderId();
    await post(body({ orderId, tipCents: 1000 }));
    await post(body({ orderId, tipCents: 1500 }));

    expect(orderCount()).toBe(1);
    const order = await getOrder(orderId);
    expect(order?.totals.tipCents).toBe(1500);
  });

  it("updates the existing PaymentIntent rather than opening another", async () => {
    // Stripe filled up with "incomplete" intents for the same reason.
    const orderId = await firstOrderId();
    await post(body({ orderId, tipCents: 1000 }));

    expect(createPI).toHaveBeenCalledTimes(1);
    expect(updatePI).toHaveBeenCalledTimes(1);
    const [piId, args] = updatePI.mock.calls[0];
    expect(piId).toBe("pi_1");
    expect(args.amount).toBeGreaterThan(0);
  });

  it("returns the same order id it was handed", async () => {
    const orderId = await firstOrderId();
    const res = await post(body({ orderId, tipCents: 500 }));
    expect((await res.json()).orderId).toBe(orderId);
  });

  it("starts a fresh order when the id belongs to a different buyer", async () => {
    const orderId = await firstOrderId();
    await post(body({ orderId }, { name: "Someone Else", email: "other@example.com", phone: "5165559999" }));
    expect(orderCount()).toBe(2);
  });

  it("starts a fresh order when the referenced one is already paid", async () => {
    const orderId = await firstOrderId();
    getDb().prepare("UPDATE orders SET payment_status = 'paid' WHERE id = ?").run(orderId);

    await post(body({ orderId, tipCents: 1000 }));
    expect(orderCount()).toBe(2);
    // The paid order must be left exactly as it was.
    expect((await getOrder(orderId))?.totals.tipCents).toBe(0);
  });

  it("ignores an unknown order id instead of failing the checkout", async () => {
    const res = await post(body({ orderId: "do_does_not_exist" }));
    expect(res.status).toBe(200);
    expect(orderCount()).toBe(1);
  });

  it("opens a new PaymentIntent when the old one can no longer be updated", async () => {
    const orderId = await firstOrderId();
    updatePI.mockRejectedValueOnce(new Error("intent already succeeded"));

    const res = await post(body({ orderId, tipCents: 1000 }));
    expect(res.status).toBe(200);
    expect(createPI).toHaveBeenCalledTimes(2);
    expect(orderCount()).toBe(1);
  });
});
