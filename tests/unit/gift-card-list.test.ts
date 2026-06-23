import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import {
  issueGiftCard,
  redeem,
  listGiftCards,
  getGiftCardWithHistory,
} from "@/lib/gift-card-storage";

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("ORDER_STORAGE_FILE", "/tmp/diva-test-gc-list-" + process.pid + ".json");
  runMigrations();
});
afterEach(() => {
  closeDb();
  vi.unstubAllEnvs();
});

describe("listGiftCards", () => {
  it("returns cards plus liability/issued/redeemed stats", () => {
    const a = issueGiftCard({ initialCents: 15000, recipientEmail: "a@b.com" });
    issueGiftCard({ initialCents: 15000, recipientEmail: "c@d.com" });
    redeem(a.id, "o1", 9000); // a now has 6000 left

    const { cards, stats } = listGiftCards();
    expect(cards.length).toBe(2);
    expect(stats.issuedCents).toBe(30000);
    expect(stats.pendingCents).toBe(21000); // 6000 + 15000
    expect(stats.redeemedCents).toBe(9000);
    expect(stats.activeCount).toBe(2);
  });
});

describe("getGiftCardWithHistory", () => {
  it("returns the card with its redemption ledger newest-first", () => {
    const a = issueGiftCard({ initialCents: 15000, recipientEmail: "a@b.com" });
    redeem(a.id, "o1", 5000);
    redeem(a.id, "o2", 4000);
    const res = getGiftCardWithHistory(a.id)!;
    expect(res.card.balanceCents).toBe(6000);
    expect(res.redemptions).toHaveLength(2);
    expect(res.redemptions[0].orderId).toBe("o2");
  });
});
