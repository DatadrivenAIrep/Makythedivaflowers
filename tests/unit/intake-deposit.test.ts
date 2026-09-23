import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import path from "node:path";
import os from "node:os";
import { promises as fs } from "node:fs";

vi.mock("@/lib/stripe-server", () => ({
  stripe: { checkout: { sessions: { create: vi.fn() } } },
}));

import { POST } from "@/app/api/admin/orders/route";
import { closeDb, getDb } from "@/lib/db";

const ORDER_FILE = path.join(os.tmpdir(), `diva-deposit-orders-${process.pid}.json`);
const PRINT_FILE = path.join(os.tmpdir(), `diva-deposit-print-${process.pid}.json`);

beforeEach(async () => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("ORDER_STORAGE_FILE", ORDER_FILE);
  vi.stubEnv("PRINT_QUEUE_FILE", PRINT_FILE);
  vi.stubEnv("TWILIO_DRY_RUN", "true");
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_dummy");
  await fs.writeFile(ORDER_FILE, "[]");
  await fs.writeFile(PRINT_FILE, "[]");
});
afterEach(async () => {
  closeDb();
  vi.unstubAllEnvs();
  try { await fs.unlink(ORDER_FILE); } catch {}
  try { await fs.unlink(PRINT_FILE); } catch {}
});

const base = {
  source: "phone" as const,
  customer: { phone: "5165550100", name: "Maria", messagingChannel: "none" as const },
  fulfillment: { method: "in-store" as const, recipient: { name: "", phone: "" } },
  lines: [{ kind: "custom" as const, title: "Evento", priceCents: 50000, qty: 1 }],
};

function req(b: unknown): Request {
  return new Request("http://localhost/api/admin/orders", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b),
  });
}

function row(id: string) {
  return getDb()
    .prepare("SELECT payment_status, payment_method, amount_paid_cents, total_cents FROM orders WHERE id = ?")
    .get(id) as { payment_status: string; payment_method: string | null; amount_paid_cents: number; total_cents: number };
}

describe("POST /api/admin/orders — deposit at intake", () => {
  it("stores the deposit as amount paid and keeps the order pending", async () => {
    const res = await POST(req({ ...base, payment: { status: "pending", deposit: { amountCents: 20000, method: "zelle" } } }));
    expect(res.status).toBe(201);
    const r = row((await res.json()).orderId);
    expect(r.payment_status).toBe("pending");
    expect(r.amount_paid_cents).toBe(20000);
    expect(r.payment_method).toBe("zelle");
  });

  it("pending without deposit stays at zero paid", async () => {
    const res = await POST(req({ ...base, payment: { status: "pending" } }));
    const r = row((await res.json()).orderId);
    expect(r.amount_paid_cents).toBe(0);
    expect(r.payment_method).toBeNull();
  });

  it("rejects a deposit that is not less than the total", async () => {
    const res = await POST(req({ ...base, payment: { status: "pending", deposit: { amountCents: 999999, method: "cash" } } }));
    expect(res.status).toBe(400);
  });
});
