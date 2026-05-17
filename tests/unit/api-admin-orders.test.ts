import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import path from "node:path";
import os from "node:os";
import { promises as fs } from "node:fs";
import { POST } from "@/app/api/admin/orders/route";
import { closeDb, getDb } from "@/lib/db";

const ORDER_FILE = path.join(os.tmpdir(), `diva-intake-orders-${process.pid}.json`);
const PRINT_FILE = path.join(os.tmpdir(), `diva-intake-print-${process.pid}.json`);

beforeEach(async () => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("ORDER_STORAGE_FILE", ORDER_FILE);
  vi.stubEnv("PRINT_QUEUE_FILE", PRINT_FILE);
  await fs.writeFile(ORDER_FILE, "[]");
  await fs.writeFile(PRINT_FILE, "[]");
});
afterEach(async () => {
  closeDb();
  vi.unstubAllEnvs();
  try { await fs.unlink(ORDER_FILE); } catch {}
  try { await fs.unlink(PRINT_FILE); } catch {}
});

const body = {
  source: "walk-in" as const,
  customer: { phone: "5165550100", name: "Maria" },
  fulfillment: {
    method: "delivery" as const,
    recipient: { name: "Lola", phone: "5165550199" },
    address: { street1: "1 A", city: "Albertson", state: "NY", zip: "11507", country: "US" as const },
    window: { date: "2099-01-01", slot: "midday" as const },
  },
  lines: [{ kind: "catalog" as const, productId: "p-arr-m01", variantId: "standard", addOnIds: [], qty: 1 }],
  payment: { status: "paid" as const, method: "zelle" as const },
};

function req(b: unknown): Request {
  return new Request("http://localhost/api/admin/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(b),
  });
}

describe("POST /api/admin/orders", () => {
  it("creates an order, enqueues a print job, upserts the customer", async () => {
    const res = await POST(req(body));
    expect(res.status).toBe(201);
    const out = await res.json();
    expect(out.orderId).toMatch(/^do_/);
    expect(out.printJobId).toBeTruthy();

    const db = getDb();
    const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(out.orderId) as { source: string; payment_status: string };
    expect(order.source).toBe("walk-in");
    expect(order.payment_status).toBe("paid");

    const cust = db.prepare("SELECT * FROM customers WHERE phone = ?").get("5165550100") as { order_count: number };
    expect(cust.order_count).toBe(1);
  });

  it("rejects empty lines", async () => {
    const res = await POST(req({ ...body, lines: [] }));
    expect(res.status).toBe(400);
  });

  it("records pending payment when status is pending", async () => {
    const res = await POST(req({ ...body, payment: { status: "pending" } }));
    expect(res.status).toBe(201);
    const out = await res.json();
    const order = getDb().prepare("SELECT payment_status FROM orders WHERE id = ?").get(out.orderId) as { payment_status: string };
    expect(order.payment_status).toBe("pending");
  });
});
