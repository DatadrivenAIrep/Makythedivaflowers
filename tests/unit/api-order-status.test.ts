import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { saveOrder } from "@/lib/order-storage";
import type { Order } from "@/types/order";

const FILE = path.join(process.cwd(), "pending-orders.json");
let backup: string | null = null;

beforeEach(async () => {
  try { backup = await fs.readFile(FILE, "utf8"); } catch { backup = null; }
  await fs.writeFile(FILE, "[]", "utf8");
});
afterEach(async () => {
  if (backup === null) {
    try { await fs.unlink(FILE); } catch {}
  } else {
    await fs.writeFile(FILE, backup, "utf8");
  }
});

function makeOrder(id: string, status: Order["status"]): Order {
  return {
    id,
    locale: "en",
    lines: [],
    delivery: {
      recipient: { name: "T", phone: "5555555555" },
      address: { street1: "1", city: "Albertson", state: "NY", zip: "11507", country: "US" },
      window: { date: "2099-01-01", slot: "midday" },
    },
    contact: { email: "t@example.com", phone: "5555555555" },
    totals: { subtotalCents: 1000, deliveryCents: 1000, taxCents: 173, totalCents: 2173 },
    status,
    createdAt: "2026-05-06T00:00:00.000Z",
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
