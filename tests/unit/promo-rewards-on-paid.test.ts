import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { getPromoByCode } from "@/lib/promo";
import { grantReferralCode, REFERRAL_CENTS, LOYALTY_CENTS } from "@/lib/promo-grants";
import { rewardsOnOrderPaid } from "@/lib/promo-rewards";
import { listGiftCards } from "@/lib/gift-card-storage";
import type { Order } from "@/types/order";

const sent: { to: string; body: string }[] = [];
vi.mock("@/lib/twilio-server", () => ({
  sendSms: async (to: string, body: string) => {
    sent.push({ to, body });
    return { sid: "SM1" };
  },
}));
vi.mock("@/lib/twilio-config", () => ({
  twilioSmsEnabled: () => true,
  twilioDryRun: () => false,
}));

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  sent.length = 0;
  runMigrations();
});
afterEach(() => {
  closeDb();
  vi.unstubAllEnvs();
});

function seedCustomer(id: string, phone: string, marketing = true) {
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT INTO customers (id, name, phone, locale, messaging_channel, first_seen_at, last_seen_at)
       VALUES (?, 'María Pérez', ?, 'es', 'sms', ?, ?)`,
    )
    .run(id, phone, now, now);
  if (marketing) {
    getDb()
      .prepare("INSERT INTO customer_tags (customer_id, tag) VALUES (?, 'sms-marketing')")
      .run(id);
  }
}

/** A paid order row for a customer, so order counts are real. */
function seedPaidOrder(id: string, customerId: string, phone: string) {
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT INTO orders (
         id, source, locale, lines_json, fulfillment_method, recipient_name, recipient_phone,
         contact_phone, customer_id, subtotal_cents, delivery_cents, tax_cents, total_cents,
         fulfillment_status, payment_status, created_at, updated_at
       ) VALUES (?, 'web', 'es', '[]', 'pickup', 'X', ?, ?, ?, 10000, 0, 862, 10862,
                 'pending', 'paid', ?, ?)`,
    )
    .run(id, phone, phone, customerId, now, now);
}

const order = (over: Partial<Order> = {}): Order =>
  ({
    id: "do_new",
    source: "web",
    locale: "es",
    lines: [],
    fulfillment: {
      method: "pickup",
      recipient: { name: "X", phone: "5165550100" },
      window: { date: "2026-09-09", slot: "midday" },
    },
    contact: { phone: "5165550100" },
    totals: {
      subtotalCents: 20000,
      deliveryCents: 0,
      discountCents: 0,
      tipCents: 0,
      taxCents: 1725,
      totalCents: 21725,
    },
    status: "pending",
    paymentStatus: "paid",
    createdAt: "2026-09-02T10:00:00Z",
    updatedAt: "2026-09-02T10:00:00Z",
    ...over,
  }) as Order;

describe("crediting the referrer", () => {
  it("gives the referrer a $15 gift card once the friend's order is paid", async () => {
    seedCustomer("cus_ref", "5165550100");
    const g = grantReferralCode("cus_ref")!;
    await rewardsOnOrderPaid(
      order({ id: "do_friend", promoId: getPromoByCode(g.code)!.id, promoCode: g.code }),
    );
    const cards = listGiftCards().cards;
    expect(cards).toHaveLength(1);
    expect(cards[0].initialCents).toBe(REFERRAL_CENTS);
  });

  it("texts the referrer that they were credited", async () => {
    seedCustomer("cus_ref", "5165550100");
    const g = grantReferralCode("cus_ref")!;
    await rewardsOnOrderPaid(
      order({ id: "do_friend", promoId: getPromoByCode(g.code)!.id, promoCode: g.code }),
    );
    expect(sent).toHaveLength(1);
    expect(sent[0].body).toContain("$15");
  });

  it("credits once even if the paid hook runs twice", async () => {
    seedCustomer("cus_ref", "5165550100");
    const g = grantReferralCode("cus_ref")!;
    const paid = order({ id: "do_friend", promoId: getPromoByCode(g.code)!.id, promoCode: g.code });
    await rewardsOnOrderPaid(paid);
    await rewardsOnOrderPaid(paid);
    expect(listGiftCards().cards).toHaveLength(1);
  });

  it("does nothing when the order used an ordinary code", async () => {
    seedCustomer("cus_ref", "5165550100");
    await rewardsOnOrderPaid(order({ promoId: "promo_plain", promoCode: "PLAIN" }));
    expect(listGiftCards().cards).toHaveLength(0);
  });

  it("does nothing when the order used no code at all", async () => {
    await rewardsOnOrderPaid(order());
    expect(listGiftCards().cards).toHaveLength(0);
  });
});

describe("the loyalty reward", () => {
  it("arrives once the customer has four orders behind them", async () => {
    seedCustomer("cus_1", "5165550100");
    for (const n of [1, 2, 3, 4]) seedPaidOrder(`do_${n}`, "cus_1", "5165550100");
    await rewardsOnOrderPaid(order({ id: "do_4", customerId: "cus_1" }));

    const granted = sent.find((m) => m.body.includes("$15"));
    expect(granted, "expected a loyalty text").toBeTruthy();
    expect(granted!.body).toMatch(/GRACIAS-/);
  });

  it("does not arrive earlier", async () => {
    seedCustomer("cus_1", "5165550100");
    for (const n of [1, 2, 3]) seedPaidOrder(`do_${n}`, "cus_1", "5165550100");
    await rewardsOnOrderPaid(order({ id: "do_3", customerId: "cus_1" }));
    expect(sent).toHaveLength(0);
  });

  it("does not arrive again on the order after it", async () => {
    seedCustomer("cus_1", "5165550100");
    for (const n of [1, 2, 3, 4, 5]) seedPaidOrder(`do_${n}`, "cus_1", "5165550100");
    await rewardsOnOrderPaid(order({ id: "do_5", customerId: "cus_1" }));
    expect(sent).toHaveLength(0);
  });

  it("skips a customer who never opted in to marketing texts", async () => {
    seedCustomer("cus_2", "5165550200", false);
    for (const n of [1, 2, 3, 4]) seedPaidOrder(`do_b${n}`, "cus_2", "5165550200");
    await rewardsOnOrderPaid(order({ id: "do_b4", customerId: "cus_2" }));
    expect(sent).toHaveLength(0);
  });

  it("never throws, so a reward can't cost the shop a paid order", async () => {
    await expect(
      rewardsOnOrderPaid(order({ customerId: "cus_missing", promoId: "nope" })),
    ).resolves.toBeUndefined();
  });
});
