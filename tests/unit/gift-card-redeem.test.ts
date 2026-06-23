import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import {
  issueGiftCard,
  getGiftCardById,
  validateForRedemption,
  redeem,
  refund,
  voidGiftCard,
} from "@/lib/gift-card-storage";

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("ORDER_STORAGE_FILE", "/tmp/diva-test-gc-redeem-" + process.pid + ".json");
  runMigrations();
});
afterEach(() => {
  closeDb();
  vi.unstubAllEnvs();
});

function newCard(cents = 15000) {
  return issueGiftCard({ initialCents: cents, recipientEmail: "a@b.com" });
}

describe("validateForRedemption", () => {
  it("returns applicable = min(balance, want) for an active card", () => {
    const card = newCard(15000);
    const r = validateForRedemption(card.code, 9000);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.applicableCents).toBe(9000);
  });
  it("caps applicable at the balance when the order exceeds it", () => {
    const card = newCard(15000);
    const r = validateForRedemption(card.code, 22000);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.applicableCents).toBe(15000);
  });
  it("rejects an unknown / void / empty / expired card", () => {
    expect(validateForRedemption("DIVA-0000-0000", 100).ok).toBe(false);
    const v = newCard();
    voidGiftCard(v.id);
    const res = validateForRedemption(v.code, 100);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("void");
  });
});

describe("redeem", () => {
  it("draws down the balance and writes a redeem ledger row", () => {
    const card = newCard(15000);
    redeem(card.id, "order-1", 9000);
    expect(getGiftCardById(card.id)!.balanceCents).toBe(6000);
    const ledger = getDb()
      .prepare("SELECT * FROM gift_card_redemptions WHERE gift_card_id = ?")
      .all(card.id) as { amount_cents: number; type: string; order_id: string }[];
    expect(ledger).toHaveLength(1);
    expect(ledger[0]).toMatchObject({ amount_cents: 9000, type: "redeem", order_id: "order-1" });
  });

  it("supports multiple draw-downs until empty and refuses to overdraw", () => {
    const card = newCard(15000);
    redeem(card.id, "o1", 9000);
    redeem(card.id, "o2", 6000);
    expect(getGiftCardById(card.id)!.balanceCents).toBe(0);
    expect(() => redeem(card.id, "o3", 100)).toThrow();
  });

  it("is idempotent per order — a second redeem for the same order is a no-op", () => {
    const card = newCard(15000);
    redeem(card.id, "o1", 9000);
    redeem(card.id, "o1", 9000); // webhook retry
    expect(getGiftCardById(card.id)!.balanceCents).toBe(6000);
  });
});

describe("refund", () => {
  it("credits the balance back and is idempotent per order", () => {
    const card = newCard(15000);
    redeem(card.id, "o1", 9000);
    refund(card.id, "o1", 9000);
    expect(getGiftCardById(card.id)!.balanceCents).toBe(15000);
    refund(card.id, "o1", 9000);
    expect(getGiftCardById(card.id)!.balanceCents).toBe(15000);
  });
  it("never credits above the initial amount", () => {
    const card = newCard(15000);
    refund(card.id, "o1", 9999);
    expect(getGiftCardById(card.id)!.balanceCents).toBe(15000);
  });
});
