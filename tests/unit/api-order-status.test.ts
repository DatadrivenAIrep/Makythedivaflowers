import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { saveOrder } from "@/lib/order-storage";
import type { Order } from "@/types/order";

const TEST_FILE = path.join(os.tmpdir(), `diva-test-orders-status-${process.pid}.json`);

beforeEach(async () => {
  vi.stubEnv("ORDER_STORAGE_FILE", TEST_FILE);
  await fs.writeFile(TEST_FILE, "[]", "utf8");
});
afterEach(async () => {
  try { await fs.unlink(TEST_FILE); } catch {}
  vi.unstubAllEnvs();
});

function makeOrder(id: string, status: Order["status"]): Order {
  return {
    id,
    source: "web",
    locale: "en",
    lines: [],
    fulfillment: {
      method: "delivery",
      recipient: { name: "T", phone: "5555555555" },
      address: { street1: "1", city: "Albertson", state: "NY", zip: "11507", country: "US" },
      window: { date: "2099-01-01", slot: "midday" },
    },
    contact: { email: "t@example.com", phone: "5555555555" },
    totals: { subtotalCents: 1000, deliveryCents: 1000, taxCents: 173, totalCents: 2173 },
    status,
    paymentStatus: "pending",
    createdAt: "2026-05-06T00:00:00.000Z",
    updatedAt: "2026-05-06T00:00:00.000Z",
  };
}

describe("GET /api/order/[id]/status", () => {
  it("returns 200 with the status", async () => {
    await saveOrder(makeOrder("o1", "pending"));
    const { GET } = await import("@/app/api/order/[id]/status/route");
    const res = await GET(
      new Request("http://localhost/api/order/o1/status"),
      { params: Promise.resolve({ id: "o1" }) },
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe("pending");
  });

  it("returns 404 when order does not exist", async () => {
    const { GET } = await import("@/app/api/order/[id]/status/route");
    const res = await GET(
      new Request("http://localhost/api/order/nope/status"),
      { params: Promise.resolve({ id: "nope" }) },
    );
    expect(res.status).toBe(404);
  });
});
