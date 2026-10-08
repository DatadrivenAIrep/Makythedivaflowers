import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import path from "node:path";
import os from "node:os";
import { promises as fs } from "node:fs";

vi.mock("@/lib/stripe-server", () => ({
  stripe: { checkout: { sessions: { create: vi.fn().mockResolvedValue({ id: "cs_test", url: "https://buy.stripe.com/test", expires_at: 9999999999 }) } } },
}));

import { POST } from "@/app/api/admin/orders/route";
import { closeDb, getDb } from "@/lib/db";

const ORDER_FILE = path.join(os.tmpdir(), `diva-remember-orders-${process.pid}.json`);
const PRINT_FILE = path.join(os.tmpdir(), `diva-remember-print-${process.pid}.json`);

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

function body(over: Record<string, unknown> = {}) {
  return {
    source: "phone",
    customer: { phone: "5165550100", name: "Ana", messagingChannel: "none" },
    fulfillment: {
      method: "pickup",
      recipient: { name: "Mamá Rosa", phone: "(516) 555-0902" },
      window: { date: "2099-03-21", slot: "midday" },
    },
    lines: [{ kind: "custom", title: "Rosas", priceCents: 5000, qty: 1 }],
    payment: { status: "paid", method: "cash" },
    ...over,
  };
}

function post(b: unknown) {
  return POST(new Request("http://localhost/api/admin/orders", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b),
  }));
}

function dates() {
  return getDb()
    .prepare("SELECT kind, label, month, day, recipient_phone FROM customer_important_dates ORDER BY created_at")
    .all();
}

describe("intake 'remember this date'", () => {
  it("saves the delivery day as the recipient's birthday on the buyer's profile", async () => {
    expect((await post(body({ rememberDate: "birthday" }))).status).toBe(201);
    expect(dates()).toEqual([
      { kind: "birthday", label: "Mamá Rosa", month: 3, day: 21, recipient_phone: "5165550902" },
    ]);
  });

  it("does not save the same birthday twice", async () => {
    await post(body({ rememberDate: "birthday" }));
    await post(body({ rememberDate: "birthday" }));
    expect(dates()).toHaveLength(1);
  });

  it("saves nothing when the box is not ticked, or the order is for the buyer themselves", async () => {
    await post(body());
    await post(body({
      rememberDate: "anniversary",
      fulfillment: { method: "pickup", recipient: { name: "Ana", phone: "5165550100" }, window: { date: "2099-03-21", slot: "midday" } },
    }));
    expect(dates()).toEqual([]);
  });
});
