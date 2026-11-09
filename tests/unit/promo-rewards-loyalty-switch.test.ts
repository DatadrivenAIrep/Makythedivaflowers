import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { getPromoByCode } from "@/lib/promo";
import { grantReferralCode } from "@/lib/promo-grants";
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

let enabled = false;
vi.mock("@/lib/loyalty-client", async (orig) => ({
  ...(await orig<typeof import("@/lib/loyalty-client")>()),
  loyaltyEnabled: () => enabled,
}));

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  sent.length = 0;
  enabled = false;
  runMigrations();
});
afterEach(() => {
  closeDb();
  vi.unstubAllEnvs();
});

function seedCustomer(id: string, phone: string) {
  const now = new Date().toISOString();
  const db = getDb();
  db.prepare(
    `INSERT INTO customers (id, name, phone, locale, messaging_channel, first_seen_at, last_seen_at)
     VALUES (?, 'María Pérez', ?, 'es', 'sms', ?, ?)`,
  ).run(id, phone, now, now);
  db.prepare("INSERT INTO customer_tags (customer_id, tag) VALUES (?, 'sms-marketing')").run(id);
}

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
    totals: { subtotalCents: 20000, deliveryCents: 0, discountCents: 0, tipCents: 0, taxCents: 1725, totalCents: 21725 },
    status: "pending",
    paymentStatus: "paid",
    createdAt: "2026-09-02T10:00:00Z",
    updatedAt: "2026-09-02T10:00:00Z",
    ...over,
  }) as Order;

function fourPaid() {
  seedCustomer("cus_1", "5165550100");
  for (const n of [1, 2, 3, 4]) seedPaidOrder(`do_${n}`, "cus_1", "5165550100");
}

describe("the $15 fifth-order reward and the loyalty connection", () => {
  it("with the connection on, a fourth paid order grants no GRACIAS code", async () => {
    enabled = true;
    fourPaid();
    await rewardsOnOrderPaid(order({ id: "do_4", customerId: "cus_1" }));
    expect(sent.find((m) => /GRACIAS-/.test(m.body))).toBeUndefined();
  });

  it("with the connection off, a fourth paid order still grants the GRACIAS code", async () => {
    enabled = false;
    fourPaid();
    await rewardsOnOrderPaid(order({ id: "do_4", customerId: "cus_1" }));
    expect(sent.find((m) => /GRACIAS-/.test(m.body))).toBeTruthy();
  });

  it("referral credit still runs with the connection on", async () => {
    enabled = true;
    seedCustomer("cus_ref", "5165550100");
    const g = grantReferralCode("cus_ref")!;
    await rewardsOnOrderPaid(
      order({ id: "do_friend", promoId: getPromoByCode(g.code)!.id, promoCode: g.code }),
    );
    expect(listGiftCards().cards).toHaveLength(1);
  });
});
