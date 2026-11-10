import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import path from "node:path";
import os from "node:os";
import { promises as fs } from "node:fs";

vi.mock("@/lib/stripe-server", () => ({
  stripe: { checkout: { sessions: { create: vi.fn().mockResolvedValue({ id: "cs_test", url: "https://buy.stripe.com/test", expires_at: 9999999999 }) } } },
}));
// The reader blows up, so the REAL scanOrderByIdSafe fails from inside and must contain it.
vi.mock("@/lib/card-dates", () => ({
  readCard: () => {
    throw new Error("reader exploded");
  },
}));

import { POST } from "@/app/api/admin/orders/route";
import { closeDb, getDb } from "@/lib/db";

const ORDER_FILE = path.join(os.tmpdir(), `diva-card-hooks-fail-orders-${process.pid}.json`);
const PRINT_FILE = path.join(os.tmpdir(), `diva-card-hooks-fail-print-${process.pid}.json`);

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
  vi.restoreAllMocks();
  try { await fs.unlink(ORDER_FILE); } catch {}
  try { await fs.unlink(PRINT_FILE); } catch {}
});

describe("intake when the card scan fails", () => {
  it("intake still answers 201 if the scan blows up", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await POST(new Request("http://localhost/api/admin/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "phone",
        customer: { phone: "5165550100", name: "Ana", messagingChannel: "none" },
        fulfillment: {
          method: "pickup",
          recipient: { name: "Mamá Rosa", phone: "(516) 555-0902" },
          window: { date: "2099-03-21", slot: "midday" },
          cardMessage: "Happy birthday Mom",
        },
        lines: [{ kind: "custom", title: "Rosas", priceCents: 5000, qty: 1 }],
        payment: { status: "paid", method: "cash" },
      }),
    }));
    expect(res.status).toBe(201);
    expect(err.mock.calls.some((c) => String(c[0]).includes("card_dates_scan_failed"))).toBe(true);
    expect(getDb().prepare("SELECT COUNT(*) AS n FROM customer_important_dates").get()).toEqual({ n: 0 });
  });
});
