import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  saveOrder,
  getOrder,
  getOrderByPaymentIntent,
  updateOrderPaymentIntent,
  updateOrderStatusByPaymentIntent,
} from "@/lib/order-storage";
import type { Order } from "@/types/order";

const TEST_FILE = path.join(os.tmpdir(), `diva-test-orders-storage-${process.pid}.json`);

beforeEach(async () => {
  vi.stubEnv("ORDER_STORAGE_FILE", TEST_FILE);
  vi.stubEnv("SQLITE_FILE", ":memory:");
  await fs.writeFile(TEST_FILE, "[]", "utf8");
});
afterEach(async () => {
  try { await fs.unlink(TEST_FILE); } catch {}
  const { closeDb } = await import("@/lib/db");
  closeDb();
  vi.unstubAllEnvs();
});

function makeOrder(id: string, paymentIntentId?: string): Order {
  return {
    id,
    source: "web",
    locale: "en",
    lines: [],
    fulfillment: {
      method: "delivery",
      recipient: { name: "Test", phone: "5555555555" },
      address: {
        street1: "1 Main",
        city: "Albertson",
        state: "NY",
        zip: "11507",
        country: "US",
      },
      window: { date: "2099-01-01", slot: "midday" },
    },
    contact: { email: "test@example.com", phone: "5555555555" },
    totals: { subtotalCents: 1000, deliveryCents: 1000, taxCents: 173, totalCents: 2173 },
    stripePaymentIntentId: paymentIntentId,
    status: "pending",
    paymentStatus: "pending",
    createdAt: "2026-05-06T00:00:00.000Z",
    updatedAt: "2026-05-06T00:00:00.000Z",
  };
}

describe("order-storage", () => {
  it("getOrderByPaymentIntent returns the matching order", async () => {
    await saveOrder(makeOrder("o1", "pi_111"));
    await saveOrder(makeOrder("o2", "pi_222"));
    const found = await getOrderByPaymentIntent("pi_222");
    expect(found?.id).toBe("o2");
  });

  it("getOrderByPaymentIntent returns null when no match", async () => {
    await saveOrder(makeOrder("o1", "pi_111"));
    const found = await getOrderByPaymentIntent("pi_does_not_exist");
    expect(found).toBeNull();
  });

  it("updateOrderPaymentIntent attaches the PI id", async () => {
    await saveOrder(makeOrder("o1"));
    await updateOrderPaymentIntent("o1", "pi_999");
    const o = await getOrder("o1");
    expect(o?.stripePaymentIntentId).toBe("pi_999");
  });

  it("updateOrderStatusByPaymentIntent flips pending → paid (sets paymentStatus)", async () => {
    await saveOrder(makeOrder("o1", "pi_111"));
    await updateOrderStatusByPaymentIntent("pi_111", "paid");
    const o = await getOrder("o1");
    expect(o?.paymentStatus).toBe("paid");
    expect(o?.paidAt).toBeTruthy();
  });

  it("updateOrderStatusByPaymentIntent is a no-op when paymentStatus already paid", async () => {
    const order = makeOrder("o1", "pi_111");
    order.paymentStatus = "paid";
    await saveOrder(order);
    await updateOrderStatusByPaymentIntent("pi_111", "paid");
    const o = await getOrder("o1");
    expect(o?.paymentStatus).toBe("paid");
  });

  it("updateOrderStatusByPaymentIntent sets fulfillment status for non-paid transitions", async () => {
    const order = makeOrder("o1", "pi_111");
    await saveOrder(order);
    await updateOrderStatusByPaymentIntent("pi_111", "failed");
    const o = await getOrder("o1");
    expect(o?.status).toBe("failed");
  });

  it("updateOrderStatusByPaymentIntent silently ignores unknown PI", async () => {
    await expect(
      updateOrderStatusByPaymentIntent("pi_does_not_exist", "paid"),
    ).resolves.not.toThrow();
  });
});

describe("order-storage SQLite mirror", () => {
  it("saveOrder writes a row to the orders table", async () => {
    const { getDb } = await import("@/lib/db");
    const o = makeOrder("o_mirror", "pi_mirror");
    await saveOrder(o);
    const row = getDb().prepare("SELECT id FROM orders WHERE id = ?").get("o_mirror") as { id: string } | undefined;
    expect(row?.id).toBe("o_mirror");
  });
});
