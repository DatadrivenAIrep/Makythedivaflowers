import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import path from "node:path";
import os from "node:os";
import { promises as fs } from "node:fs";

vi.mock("@/lib/stripe-server", () => ({
  stripe: {
    checkout: { sessions: { create: vi.fn().mockResolvedValue({ id: "cs_test", url: "https://buy.stripe.com/test", expires_at: 9999999999 }) } },
  },
}));

import { POST } from "@/app/api/admin/orders/route";
import { closeDb, getDb } from "@/lib/db";

const ORDER_FILE = path.join(os.tmpdir(), `diva-instore-orders-${process.pid}.json`);
const PRINT_FILE = path.join(os.tmpdir(), `diva-instore-print-${process.pid}.json`);

beforeEach(async () => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("ORDER_STORAGE_FILE", ORDER_FILE);
  vi.stubEnv("PRINT_QUEUE_FILE", PRINT_FILE);
  vi.stubEnv("TWILIO_DRY_RUN", "true");
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_dummy");
  vi.stubEnv("SITE_URL", "https://example.com");
  await fs.writeFile(ORDER_FILE, "[]");
  await fs.writeFile(PRINT_FILE, "[]");
});
afterEach(async () => {
  closeDb();
  vi.unstubAllEnvs();
  try { await fs.unlink(ORDER_FILE); } catch {}
  try { await fs.unlink(PRINT_FILE); } catch {}
});

// Exactly what the intake UI sends for a "Take it now" (in-store) order:
// FulfillmentBlock never renders recipient inputs for in-store, so recipient is empty.
const inStoreBody = {
  source: "walk-in" as const,
  customer: { phone: "5165550100", name: "Maria", messagingChannel: "none" as const },
  fulfillment: { method: "in-store" as const, recipient: { name: "", phone: "" } },
  lines: [{ kind: "custom" as const, title: "Rosas", priceCents: 5000, designerNotes: undefined, qty: 1 }],
  payment: { status: "paid" as const, method: "cash" as const },
};

function req(b: unknown): Request {
  return new Request("http://localhost/api/admin/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(b),
  });
}

describe("POST /api/admin/orders — in-store (Take it now)", () => {
  it("creates an in-store order (recipient defaults to the buyer)", async () => {
    const res = await POST(req(inStoreBody));
    expect(res.status).toBe(201);
    const out = await res.json();
    expect(out.orderId).toMatch(/^do_/);

    const order = getDb()
      .prepare("SELECT fulfillment_method, recipient_name, recipient_phone FROM orders WHERE id = ?")
      .get(out.orderId) as { fulfillment_method: string; recipient_name: string; recipient_phone: string };
    expect(order.fulfillment_method).toBe("in-store");
    // buyer becomes the recipient for an in-store sale
    expect(order.recipient_name).toBe("Maria");
    expect(order.recipient_phone).toBe("5165550100");
  });
});
