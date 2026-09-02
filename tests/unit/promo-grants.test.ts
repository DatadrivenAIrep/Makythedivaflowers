import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { validatePromo, getPromoByCode, listPromos } from "@/lib/promo";
import {
  grantWelcomeOffer,
  grantReferralCode,
  grantLoyaltyReward,
  WELCOME_PERCENT,
  WELCOME_MIN_SUBTOTAL_CENTS,
  REFERRAL_CENTS,
  LOYALTY_CENTS,
  LOYALTY_AT_ORDER,
} from "@/lib/promo-grants";

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  runMigrations();
});
afterEach(() => {
  closeDb();
  vi.unstubAllEnvs();
});

function seedCustomer(id: string, phone: string) {
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT INTO customers (id, name, phone, first_seen_at, last_seen_at)
       VALUES (?, 'María', ?, ?, ?)`,
    )
    .run(id, phone, now, now);
}

const big = { subtotalCents: 20000, deliveryCents: 1000 };

describe("grantWelcomeOffer", () => {
  it("gives the agreed 10% with a $75 minimum", () => {
    const g = grantWelcomeOffer("5165550100")!;
    const promo = getPromoByCode(g.code)!;
    expect(promo.kind).toBe("percent");
    expect(promo.value).toBe(WELCOME_PERCENT);
    expect(promo.minSubtotalCents).toBe(WELCOME_MIN_SUBTOTAL_CENTS);
  });

  it("is for a first order only, and only for the number it was texted to", () => {
    const g = grantWelcomeOffer("5165550100")!;
    const promo = getPromoByCode(g.code)!;
    expect(promo.firstOrderOnly).toBe(true);
    expect(promo.maxRedemptions).toBe(1);
    expect(promo.assignedPhone).toBe("5165550100");
  });

  it("refuses an order under the minimum", () => {
    const g = grantWelcomeOffer("5165550100")!;
    const r = validatePromo(g.code, {
      subtotalCents: 5000,
      deliveryCents: 0,
      buyerPhone: "5165550100",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("below_minimum");
  });

  it("takes 10% off an order that qualifies", () => {
    const g = grantWelcomeOffer("5165550100")!;
    const r = validatePromo(g.code, { ...big, buyerPhone: "5165550100" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.discountCents).toBe(2000);
  });

  it("hands back the same code rather than minting a new one each time", () => {
    // Someone who taps the popup twice should not end up with two live offers.
    const first = grantWelcomeOffer("5165550100")!;
    const second = grantWelcomeOffer("(516) 555-0100")!;
    expect(second.code).toBe(first.code);
    expect(listPromos()).toHaveLength(1);
  });

  it("refuses a number that is not a number", () => {
    expect(grantWelcomeOffer("123")).toBeNull();
  });
});

describe("grantReferralCode", () => {
  it("gives the friend the agreed $15 and remembers who to credit", () => {
    seedCustomer("cus_ref", "5165550100");
    const g = grantReferralCode("cus_ref")!;
    const promo = getPromoByCode(g.code)!;
    expect(promo.kind).toBe("fixed");
    expect(promo.value).toBe(REFERRAL_CENTS);
    expect(promo.referrerCustomerId).toBe("cus_ref");
  });

  it("is not usable by the referrer themselves", () => {
    seedCustomer("cus_ref", "5165550100");
    const g = grantReferralCode("cus_ref")!;
    const r = validatePromo(g.code, { ...big, buyerPhone: "5165550100" });
    expect(r).toEqual({ ok: false, reason: "not_yours" });
  });

  it("works for a friend on a qualifying order", () => {
    seedCustomer("cus_ref", "5165550100");
    const g = grantReferralCode("cus_ref")!;
    const r = validatePromo(g.code, { ...big, buyerPhone: "5169998888" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.discountCents).toBe(REFERRAL_CENTS);
  });

  it("gives one customer a stable code they can keep sharing", () => {
    seedCustomer("cus_ref", "5165550100");
    expect(grantReferralCode("cus_ref")!.code).toBe(grantReferralCode("cus_ref")!.code);
  });

  it("returns nothing for a customer who does not exist", () => {
    expect(grantReferralCode("cus_nobody")).toBeNull();
  });
});

describe("grantLoyaltyReward", () => {
  it("gives the agreed $15 to that customer's phone only", () => {
    seedCustomer("cus_1", "5165550100");
    const g = grantLoyaltyReward("cus_1")!;
    const promo = getPromoByCode(g.code)!;
    expect(promo.kind).toBe("fixed");
    expect(promo.value).toBe(LOYALTY_CENTS);
    expect(promo.assignedPhone).toBe("5165550100");
    expect(promo.maxRedemptions).toBe(1);
  });

  it("is not a first-order offer — it is for someone who already orders", () => {
    seedCustomer("cus_1", "5165550100");
    const promo = getPromoByCode(grantLoyaltyReward("cus_1")!.code)!;
    expect(promo.firstOrderOnly).toBe(false);
    expect(
      validatePromo(promo.code, { ...big, buyerPhone: "5165550100", buyerHasOrdered: true }).ok,
    ).toBe(true);
  });

  it("does not stack a second reward while one is unused", () => {
    seedCustomer("cus_1", "5165550100");
    const first = grantLoyaltyReward("cus_1")!;
    expect(grantLoyaltyReward("cus_1")!.code).toBe(first.code);
  });

  it("rewards the fifth order, so it is granted once four are behind them", () => {
    expect(LOYALTY_AT_ORDER).toBe(5);
  });
});
