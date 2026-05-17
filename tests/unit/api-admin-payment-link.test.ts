import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import path from "node:path";
import os from "node:os";
import { promises as fs } from "node:fs";
import { closeDb, getDb } from "@/lib/db";
import { saveOrder, updateOrderCheckoutSessionId } from "@/lib/order-storage";
import type { Order } from "@/types/order";

vi.mock("@/lib/stripe-server", () => ({
  stripe: {
    checkout: {
      sessions: {
        create: vi.fn().mockResolvedValue({
          id: "cs_new",
          url: "https://buy.stripe.com/new",
          expires_at: 9999999999,
        }),
      },
    },
  },
}));

const ORDER_FILE = path.join(os.tmpdir(), `diva-pl-orders-${process.pid}.json`);
const PRINT_FILE = path.join(os.tmpdir(), `diva-pl-print-${process.pid}.json`);

const baseOrder: Order = {
  id: "do_test_link",
  source: "phone",
  locale: "en",
  lines: [{ kind: "catalog", productId: "p1", variantId: "standard", addOnIds: [], qty: 1 }],
  fulfillment: {
    method: "delivery",
    recipient: { name: "Lola", phone: "5165550199" },
    address: { street1: "1 Main", city: "Albertson", state: "NY", zip: "11507", country: "US" },
    window: { date: "2099-01-01", slot: "midday" },
  },
  contact: { phone: "5165550100" },
  totals: { subtotalCents: 9400, deliveryCents: 1500, taxCents: 891, totalCents: 11791 },
  status: "pending",
  paymentStatus: "pending",
  createdAt: "2026-05-17T10:00:00Z",
  updatedAt: "2026-05-17T10:00:00Z",
};

beforeEach(async () => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("SITE_URL", "https://example.com");
  vi.stubEnv("ORDER_STORAGE_FILE", ORDER_FILE);
  vi.stubEnv("PRINT_QUEUE_FILE", PRINT_FILE);
  vi.stubEnv("TWILIO_DRY_RUN", "true");
  vi.stubEnv("TWILIO_SMS_ENABLED", "true");
  await fs.writeFile(ORDER_FILE, "[]");
  await fs.writeFile(PRINT_FILE, "[]");
});
afterEach(async () => {
  closeDb();
  vi.unstubAllEnvs();
  try { await fs.unlink(ORDER_FILE); } catch {}
  try { await fs.unlink(PRINT_FILE); } catch {}
});

function req(): Request {
  return new Request("http://localhost/api/admin/orders/do_test_link/payment-link", { method: "POST" });
}

describe("POST /api/admin/orders/[id]/payment-link", () => {
  it("404s when the order does not exist", async () => {
    const { POST } = await import("@/app/api/admin/orders/[id]/payment-link/route");
    const res = await POST(req(), { params: Promise.resolve({ id: "do_does_not_exist" }) });
    expect(res.status).toBe(404);
  });

  it("returns the new session URL and stores it on the order", async () => {
    await saveOrder(baseOrder);
    const { POST } = await import("@/app/api/admin/orders/[id]/payment-link/route");
    const res = await POST(req(), { params: Promise.resolve({ id: "do_test_link" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url).toBe("https://buy.stripe.com/new");
    const row = getDb()
      .prepare("SELECT stripe_checkout_session_id FROM orders WHERE id = ?")
      .get("do_test_link") as { stripe_checkout_session_id: string };
    expect(row.stripe_checkout_session_id).toBe("cs_new");
  });

  it("409s when the order is already paid", async () => {
    await saveOrder({ ...baseOrder, paymentStatus: "paid", paidAt: "2026-05-17T11:00:00Z" });
    const { POST } = await import("@/app/api/admin/orders/[id]/payment-link/route");
    const res = await POST(req(), { params: Promise.resolve({ id: "do_test_link" }) });
    expect(res.status).toBe(409);
  });
});
