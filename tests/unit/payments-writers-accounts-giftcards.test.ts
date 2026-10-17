import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { createAccount } from "@/lib/house-account-storage";
import { recordPayment, recordStripeStatementPayment } from "@/lib/house-account-ledger";
import { issueGiftCard, issueGiftCardForPayment } from "@/lib/gift-card-storage";

beforeEach(() => { vi.stubEnv("SQLITE_FILE", ":memory:"); runMigrations(); });
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

const rows = () =>
  getDb().prepare(
    "SELECT kind, method, amount_cents AS amount, source, actor, house_account_id AS acct, gift_card_id AS card FROM payments ORDER BY rowid",
  ).all() as { kind: string; method: string; amount: number; source: string; actor: string; acct: string | null; card: string | null }[];

function seedStatement(accountId: string, id: string) {
  getDb().prepare(
    `INSERT INTO house_account_statements (id, account_id, number, code, period_start, period_end, issued_at, due_date,
       opening_cents, charges_cents, credits_cents, payments_cents, closing_cents, settled_cents, status, lines_json, created_at)
     VALUES (?, ?, ?, ?, '2026-09-01', '2026-09-30', '2026-10-01T13:00:00Z', '2026-10-16', 0, 5000, 0, 0, 5000, 0, 'open', '[]', '2026-10-01T13:00:00Z')`,
  ).run(id, accountId, `ST-${id}`, id.padEnd(8, "x").slice(0, 8));
}

describe("house-account payments", () => {
  it("a cash payment logs one payment row tied to the account", () => {
    const a = createAccount({ name: "Org" });
    recordPayment({ accountId: a.id, amountCents: 4000, method: "cash", actor: "maky" });
    expect(rows()).toEqual([
      { kind: "payment", method: "cash", amount: 4000, source: "house_account", actor: "maky", acct: a.id, card: null },
    ]);
  });

  it("the same Stripe session twice logs only one stripe row", () => {
    const a = createAccount({ name: "Org" });
    seedStatement(a.id, "st1");
    recordStripeStatementPayment({ statementId: "st1", sessionId: "cs_1", amountCents: 5000 });
    recordStripeStatementPayment({ statementId: "st1", sessionId: "cs_1", amountCents: 5000 });
    expect(rows()).toEqual([
      { kind: "payment", method: "stripe", amount: 5000, source: "house_account_stripe", actor: "stripe", acct: a.id, card: null },
    ]);
  });
});

describe("gift-card sales", () => {
  const base = { initialCents: 15000, recipientEmail: "a@b.com" };

  it("an in-store purchase logs a gift_card_sale with the method and the card amount", () => {
    const card = issueGiftCard({ ...base, reason: "purchase", paymentMethod: "cash" });
    expect(rows()).toEqual([
      { kind: "gift_card_sale", method: "cash", amount: 15000, source: "gift_card_admin", actor: "maky", acct: null, card: card.id },
    ]);
  });

  it("a card that was not bought (loyalty) logs nothing", () => {
    issueGiftCard({ ...base, reason: "loyalty" });
    expect(rows()).toEqual([]);
  });

  it("a Stripe-paid card logs one stripe sale, and a replay logs none", () => {
    const input = { paymentIntentId: "pi_1", initialCents: 7500, recipientEmail: "a@b.com" };
    const card = issueGiftCardForPayment(input);
    issueGiftCardForPayment(input);
    expect(rows()).toEqual([
      { kind: "gift_card_sale", method: "stripe", amount: 7500, source: "gift_card_stripe", actor: "stripe", acct: null, card: card.id },
    ]);
  });
});
