import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import path from "node:path";
import os from "node:os";
import { promises as fs } from "node:fs";

vi.mock("@/lib/stripe-server", () => ({
  stripe: { checkout: { sessions: { create: vi.fn().mockResolvedValue({ id: "cs_test", url: "https://buy.stripe.com/test", expires_at: 9999999999 }) } } },
}));
// onWebOrderPaid's side effects (SMS, owner alert, loyalty stamp, rewards) are not under test.
vi.mock("@/lib/order-dispatch", () => ({
  dispatchPaymentConfirmed: vi.fn().mockResolvedValue(undefined),
  dispatchOrderReceived: vi.fn().mockResolvedValue(undefined),
  windowLabel: () => "sáb, 21 mar",
}));
vi.mock("@/lib/notify-owner", () => ({ notifyOwner: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/loyalty-sync", () => ({ enqueueOrderSync: vi.fn(), runSync: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/promo-rewards", () => ({ rewardsOnOrderPaid: vi.fn().mockResolvedValue(undefined) }));

import { POST } from "@/app/api/admin/orders/route";
import { PATCH } from "@/app/api/admin/orders/[id]/route";
import { onWebOrderPaid } from "@/lib/on-web-order-paid";
import { runBackfill } from "@/lib/backfill-customers";
import { saveOrder } from "@/lib/order-storage";
import { signSession } from "@/lib/admin-auth";
import { closeDb, getDb } from "@/lib/db";
import type { Order } from "@/types/order";

// Invented people and messages only.
const ORDER_FILE = path.join(os.tmpdir(), `diva-card-hooks-orders-${process.pid}.json`);
const PRINT_FILE = path.join(os.tmpdir(), `diva-card-hooks-print-${process.pid}.json`);

beforeEach(async () => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("ORDER_STORAGE_FILE", ORDER_FILE);
  vi.stubEnv("PRINT_QUEUE_FILE", PRINT_FILE);
  vi.stubEnv("TWILIO_DRY_RUN", "true");
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_dummy");
  vi.stubEnv("SITE_URL", "https://example.com");
  vi.stubEnv("INTAKE_SESSION_SECRET", "test-secret-test-secret-test-secret");
  await fs.writeFile(ORDER_FILE, "[]");
  await fs.writeFile(PRINT_FILE, "[]");
});
afterEach(async () => {
  closeDb();
  vi.unstubAllEnvs();
  try { await fs.unlink(ORDER_FILE); } catch {}
  try { await fs.unlink(PRINT_FILE); } catch {}
});

function body(over: Record<string, unknown> = {}, cardMessage?: string) {
  return {
    source: "phone",
    customer: { phone: "5165550100", name: "Ana", messagingChannel: "none" },
    fulfillment: {
      method: "pickup",
      recipient: { name: "Mamá Rosa", phone: "(516) 555-0902" },
      window: { date: "2099-03-21", slot: "midday" },
      ...(cardMessage ? { cardMessage } : {}),
    },
    lines: [{ kind: "custom", title: "Rosas", priceCents: 5000, qty: 1 }],
    payment: { status: "paid", method: "cash" },
    ...over,
  };
}

async function post(b: unknown) {
  const res = await POST(new Request("http://localhost/api/admin/orders", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b),
  }));
  return res;
}

function dates() {
  return getDb()
    .prepare("SELECT kind, label, source FROM customer_important_dates ORDER BY created_at")
    .all();
}

function webOrder(id: string, over: Partial<Order> = {}): Order {
  return {
    id,
    source: "web",
    locale: "en",
    lines: [{ kind: "custom", title: "Rosas", priceCents: 5000, qty: 1 }],
    fulfillment: {
      method: "pickup",
      recipient: { name: "Mamá Rosa", phone: "5165550902" },
      window: { date: "2099-03-21", slot: "midday" },
      cardMessage: "Happy birthday Mom",
    },
    contact: { name: "Bob Buyer", phone: "5165550177" },
    totals: { subtotalCents: 5000, deliveryCents: 0, discountCents: 0, tipCents: 0, taxCents: 0, totalCents: 5000 },
    status: "pending",
    paymentStatus: "paid",
    paidAt: "2026-03-01T15:00:00.000Z",
    createdAt: "2026-03-01T14:00:00.000Z",
    updatedAt: "2026-03-01T15:00:00.000Z",
    ...over,
  };
}

describe("card dates are read when an order is saved", () => {
  it("intake reads a birthday card", async () => {
    expect((await post(body({}, "Happy birthday Mom"))).status).toBe(201);
    expect(dates()).toEqual([{ kind: "birthday", label: "Mamá Rosa", source: "card" }]);
  });

  it("intake remember-date wins", async () => {
    expect((await post(body({ rememberDate: "birthday" }, "Happy birthday Mom"))).status).toBe(201);
    const rows = dates() as Array<{ source: string }>;
    expect(rows).toHaveLength(1);
    expect(rows[0].source).toBe("admin");
  });

  it("edit that adds a card is read", async () => {
    const created = await (await post(body())).json();
    expect(dates()).toEqual([]);
    const res = await PATCH(
      new Request("http://x", {
        method: "PATCH",
        headers: { "content-type": "application/json", cookie: `intake_session=${signSession()}` },
        body: JSON.stringify({ cardMessage: "Feliz cumpleaños" }),
      }),
      { params: Promise.resolve({ id: created.orderId }) },
    );
    expect(res.status).toBe(200);
    expect(dates()).toHaveLength(1);
  });

  it("web order is read when paid", async () => {
    await saveOrder(webOrder("o_web_1"));
    await onWebOrderPaid("o_web_1");
    const rows = getDb()
      .prepare("SELECT d.kind, d.source FROM customer_important_dates d JOIN customers c ON c.id = d.customer_id WHERE c.phone = '5165550177'")
      .all();
    expect(rows).toEqual([{ kind: "birthday", source: "card" }]);
  });

  it("backfill reads the orders it links", async () => {
    await saveOrder(webOrder("o_bf_1"));
    const report = runBackfill();
    expect(report.failures).toEqual([]);
    expect(report.customersCreated).toBe(1);
    expect(dates()).toEqual([{ kind: "birthday", label: "Mamá Rosa", source: "card" }]);
  });
});
