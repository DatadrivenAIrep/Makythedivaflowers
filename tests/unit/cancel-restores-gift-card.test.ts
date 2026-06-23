import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { issueGiftCard, getGiftCardById, redeem } from "@/lib/gift-card-storage";

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("ORDER_STORAGE_FILE", "/tmp/diva-test-cancel-gc-" + process.pid + ".json");
  runMigrations();
});
afterEach(() => {
  closeDb();
  vi.unstubAllEnvs();
});

describe("cancel restores gift card balance", () => {
  it("credits the used amount back when an order with a gift card is canceled", async () => {
    const card = issueGiftCard({ initialCents: 15000, recipientEmail: "a@b.com" });

    // Seed the order directly into SQLite (same pattern as api-admin-orders-cancel.test.ts)
    // so cancelOrder + getOrder can find it without the JSON-file side effects of saveOrder.
    getDb().prepare(
      `INSERT INTO orders (id, locale, source, recipient_name, recipient_phone, contact_phone,
         fulfillment_method, window_date, lines_json, subtotal_cents, delivery_cents,
         tax_cents, total_cents, fulfillment_status, payment_status, payment_method,
         gift_card_id, gift_card_cents, created_at, updated_at)
       VALUES (?, 'es', 'web', 'M', '5165550100', '5165550100', 'pickup', '2026-07-01', '[]',
         9000, 0, 776, 9776, 'pending', 'paid', 'gift-card',
         ?, ?, '2026-06-22T00:00:00Z', '2026-06-22T00:00:00Z')`,
    ).run("do_cancel", card.id, 9776);

    redeem(card.id, "do_cancel", 9776);
    expect(getGiftCardById(card.id)!.balanceCents).toBe(15000 - 9776);

    const { PATCH } = await import("@/app/api/admin/orders/[id]/cancel/route");
    await PATCH(
      new Request("http://t", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ refund: false }),
      }),
      { params: Promise.resolve({ id: "do_cancel" }) },
    );

    expect(getGiftCardById(card.id)!.balanceCents).toBe(15000);
  });
});
