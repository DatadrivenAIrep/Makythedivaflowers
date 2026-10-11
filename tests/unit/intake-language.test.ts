import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import path from "node:path";
import os from "node:os";
import { promises as fs } from "node:fs";

vi.mock("@/lib/stripe-server", () => ({
  stripe: { checkout: { sessions: { create: vi.fn().mockResolvedValue({ id: "cs_test", url: "https://buy.stripe.com/test", expires_at: 9999999999 }) } } },
}));

import { POST } from "@/app/api/admin/orders/route";
import { closeDb, getDb } from "@/lib/db";

const ORDER_FILE = path.join(os.tmpdir(), `diva-lang-orders-${process.pid}.json`);
const PRINT_FILE = path.join(os.tmpdir(), `diva-lang-print-${process.pid}.json`);

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

function body(locale?: "en" | "es") {
  return {
    source: "phone",
    customer: { phone: "5165550100", name: "Ana", messagingChannel: "sms", ...(locale ? { locale } : {}) },
    fulfillment: {
      method: "pickup",
      recipient: { name: "Rosa", phone: "5165550902" },
      window: { date: "2099-03-21", slot: "midday" },
    },
    lines: [{ kind: "custom", title: "Rosas", priceCents: 5000, qty: 1 }],
    payment: { status: "paid", method: "cash" },
  };
}

async function post(b: unknown): Promise<string> {
  const res = await POST(new Request("http://localhost/api/admin/orders", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b),
  }));
  expect(res.status).toBe(201);
  return (await res.json()).orderId;
}

const orderLocale = (id: string) =>
  (getDb().prepare("SELECT locale FROM orders WHERE id = ?").get(id) as { locale: string }).locale;
const customerLocale = () =>
  (getDb().prepare("SELECT locale FROM customers WHERE phone = '5165550100'").get() as { locale: string | null }).locale;

describe("intake message language", () => {
  it("saves the picked language on the order and the customer", async () => {
    const id = await post(body("es"));
    expect(orderLocale(id)).toBe("es");
    expect(customerLocale()).toBe("es");
  });

  it("defaults to English when no language is sent", async () => {
    const id = await post(body());
    expect(orderLocale(id)).toBe("en");
  });

  it("a later order in another language updates the customer's language", async () => {
    await post(body("es"));
    await post(body("en"));
    expect(customerLocale()).toBe("en");
  });
});
