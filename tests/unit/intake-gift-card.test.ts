import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { issueGiftCard, getGiftCardById } from "@/lib/gift-card-storage";
import { getOrder } from "@/lib/order-storage";

vi.mock("@/lib/stripe-server", () => ({
  stripe: {
    checkout: {
      sessions: {
        create: vi.fn().mockResolvedValue({ id: "cs_test", url: "https://buy.stripe.com/test", expires_at: 9999999999 }),
      },
    },
  },
}));
vi.mock("@/lib/print-queue", () => ({ enqueuePrintJob: vi.fn(async () => ({ id: "pj_test" })) }));
vi.mock("@/lib/order-notifications", () => ({ notifyOrderPaid: vi.fn(async () => {}) }));
// Verified intake imports: dispatchOrderReceived is from @/lib/order-dispatch.
vi.mock("@/lib/order-dispatch", () => ({ dispatchOrderReceived: vi.fn(async () => {}) }));

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("ORDER_STORAGE_FILE", "/tmp/diva-test-intake-gc-" + process.pid + ".json");
  runMigrations();
});
afterEach(() => {
  closeDb();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

function intakeBody(code: string) {
  return {
    source: "walk-in",
    customer: { name: "Cliente", phone: "5165550100" },
    fulfillment: { method: "pickup", recipient: { name: "Cliente", phone: "5165550100" }, window: { date: "2026-07-01", slot: "midday" } },
    lines: [{ kind: "custom", title: "Ramo", priceCents: 5000, qty: 1 }],
    giftCardCode: code,
    payment: { status: "paid", method: "cash" },
  };
}

describe("intake with gift card", () => {
  it("debits the gift card when the order is paid immediately", async () => {
    const card = issueGiftCard({ initialCents: 15000, recipientEmail: "a@b.com" });
    const { POST } = await import("@/app/api/admin/orders/route");
    const res = await POST(new Request("http://t", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(intakeBody(card.code)) }));
    const data = await res.json();
    const order = await getOrder(data.orderId);
    expect(order?.giftCardId).toBe(card.id);
    expect(order?.giftCardCents).toBeGreaterThan(0);
    expect(getGiftCardById(card.id)!.balanceCents).toBeLessThan(15000);
  });
});
