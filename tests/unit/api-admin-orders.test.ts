import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import path from "node:path";
import os from "node:os";
import { promises as fs } from "node:fs";

vi.mock("@/lib/stripe-server", () => ({
  stripe: {
    checkout: {
      sessions: {
        create: vi.fn().mockResolvedValue({
          id: "cs_test",
          url: "https://buy.stripe.com/test",
          expires_at: 9999999999,
        }),
      },
    },
  },
}));

import { POST } from "@/app/api/admin/orders/route";
import { closeDb, getDb } from "@/lib/db";

const ORDER_FILE = path.join(os.tmpdir(), `diva-intake-orders-${process.pid}.json`);
const PRINT_FILE = path.join(os.tmpdir(), `diva-intake-print-${process.pid}.json`);

beforeEach(async () => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("ORDER_STORAGE_FILE", ORDER_FILE);
  vi.stubEnv("PRINT_QUEUE_FILE", PRINT_FILE);
  vi.stubEnv("TWILIO_DRY_RUN", "true");
  vi.stubEnv("TWILIO_SMS_ENABLED", "true");
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

  it("creates a checkout session and dispatches payment_link for pending orders with SMS channel", async () => {
    const res = await POST(req({
      ...body,
      payment: { status: "pending" },
      customer: { ...body.customer, messagingChannel: "sms" },
    }));
    expect(res.status).toBe(201);
    const out = await res.json();

    const order = getDb()
      .prepare("SELECT stripe_checkout_session_id FROM orders WHERE id = ?")
      .get(out.orderId) as { stripe_checkout_session_id: string };
    expect(order.stripe_checkout_session_id).toBe("cs_test");

    const msg = getDb()
      .prepare("SELECT template, status FROM messages WHERE order_id = ?")
      .get(out.orderId) as { template: string; status: string };
    expect(msg.template).toBe("payment_link");
    expect(msg.status).toBe("sent");
  });

  it("dispatches order_received for paid walk-in", async () => {
    const res = await POST(req({
      ...body,
      customer: { ...body.customer, messagingChannel: "sms" },
    }));
    expect(res.status).toBe(201);
    const out = await res.json();
    const msg = getDb()
      .prepare("SELECT template FROM messages WHERE order_id = ?")
      .get(out.orderId) as { template: string };
    expect(msg.template).toBe("order_received");
  });

  it("does not send any message when customer channel is 'none'", async () => {
    const res = await POST(req({
      ...body,
      customer: { ...body.customer, messagingChannel: "none" },
    }));
    expect(res.status).toBe(201);
    const out = await res.json();
    const count = (
      getDb()
        .prepare("SELECT COUNT(*) as c FROM messages WHERE order_id = ?")
        .get(out.orderId) as { c: number }
    ).c;
    expect(count).toBe(0);
  });
});
