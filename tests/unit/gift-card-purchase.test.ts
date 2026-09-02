import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { issueGiftCardForPayment, getGiftCardByPaymentIntent } from "@/lib/gift-card-storage";
import { listGiftCards } from "@/lib/gift-card-storage";

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  runMigrations();
});
afterEach(() => {
  closeDb();
  vi.unstubAllEnvs();
});

const input = {
  paymentIntentId: "pi_gc_1",
  initialCents: 10000,
  recipientEmail: "her@example.com",
  recipientName: "Lola",
  fromLabel: "Santiago",
  personalMessage: "Feliz cumpleaños",
  purchaserEmail: "buyer@example.com",
};

describe("issueGiftCardForPayment", () => {
  it("issues a card carrying the amount and the message", () => {
    const card = issueGiftCardForPayment(input);
    expect(card.initialCents).toBe(10000);
    expect(card.balanceCents).toBe(10000);
    expect(card.recipientEmail).toBe("her@example.com");
    expect(card.personalMessage).toBe("Feliz cumpleaños");
  });

  it("issues exactly one card per payment, however many times it is called", () => {
    // A replayed Stripe webhook must not mint a second card.
    const first = issueGiftCardForPayment(input);
    const second = issueGiftCardForPayment(input);
    expect(second.id).toBe(first.id);
    expect(listGiftCards().cards).toHaveLength(1);
  });

  it("can be found again by its payment", () => {
    const card = issueGiftCardForPayment(input);
    expect(getGiftCardByPaymentIntent("pi_gc_1")?.id).toBe(card.id);
  });

  it("returns nothing for a payment that never issued a card", () => {
    expect(getGiftCardByPaymentIntent("pi_never")).toBeNull();
  });

  it("keeps two different payments as two different cards", () => {
    issueGiftCardForPayment(input);
    issueGiftCardForPayment({ ...input, paymentIntentId: "pi_gc_2" });
    expect(listGiftCards().cards).toHaveLength(2);
  });

  it("records who bought it, so staff can answer a question about it later", () => {
    const card = issueGiftCardForPayment(input);
    expect(card.purchaserEmail).toBe("buyer@example.com");
  });
});
