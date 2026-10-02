// tests/unit/house-account-statements.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { createAccount, updateAccount } from "@/lib/house-account-storage";
import { recordCharge, recordPayment, listEntries } from "@/lib/house-account-ledger";
import { issueStatement, accountsDueToIssue, getStatementByCode, listStatements, voidStatement, getStatement } from "@/lib/house-account-statements";
import { listForAccount } from "@/lib/house-account-sends";
import { recomputeSettlement } from "@/lib/house-account-settlement";
import { CODE_PATTERN } from "@/lib/short-code";

beforeEach(() => { vi.stubEnv("SQLITE_FILE", ":memory:"); runMigrations(); });
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

// Timestamps use T12:00Z so the shop-local (America/New_York) date equals the UTC date.
function seedOrder(id: string, accountId: string, total: number, createdAt: string, recipient = "Dest") {
  getDb().prepare(
    `INSERT INTO orders (id, locale, source, recipient_name, recipient_phone, contact_phone, fulfillment_method, window_date,
       lines_json, subtotal_cents, delivery_cents, tax_cents, total_cents, amount_paid_cents, fulfillment_status,
       payment_status, payment_method, house_account_id, order_number, created_at, updated_at)
     VALUES (?, 'es', 'phone', ?, '555', '5165550100', 'delivery', '2026-10-01', '[]', ?, 0, 0, ?, 0, 'pending',
       'pending', 'house-account', ?, ?, ?, ?)`,
  ).run(id, recipient, total, total, accountId, Number(id.replace(/\D/g, "")), createdAt, createdAt);
}
function backdate(entryId: string, iso: string) {
  getDb().prepare("UPDATE house_account_entries SET created_at = ? WHERE id = ?").run(iso, entryId);
}
function seedAccountWithCharges(name = "Org") {
  const a = createAccount({ name, termsDays: 15, reminderPlan: [{ offsetDays: -3, channel: "sms" }, { offsetDays: 0, channel: "sms" }, { offsetDays: 7, channel: "both" }], statementChannel: "both" }, "2026-09-01");
  getDb().prepare("UPDATE house_accounts SET created_at = '2026-09-01T12:00:00Z' WHERE id = ?").run(a.id);
  seedOrder("o1001", a.id, 5000, "2026-09-10T12:00:00Z", "Lobby");
  seedOrder("o1002", a.id, 3000, "2026-09-20T12:00:00Z", "Suite 4");
  backdate(recordCharge({ accountId: a.id, orderId: "o1001", amountCents: 5000, actor: "m" }).id, "2026-09-10T12:00:00Z");
  backdate(recordCharge({ accountId: a.id, orderId: "o1002", amountCents: 3000, actor: "m" }).id, "2026-09-20T12:00:00Z");
  backdate(recordPayment({ accountId: a.id, amountCents: 1000, method: "zelle", actor: "m" }).entry!.id, "2026-09-25T12:00:00Z");
  return a;
}

describe("issueStatement", () => {
  it("freezes the period, numbers it, stamps entries and enqueues the plan", () => {
    const a = seedAccountWithCharges();
    const s = issueStatement(a.id, "2026-09-30", { today: "2026-10-01" })!;
    expect(s.number).toBe("ST-1001");
    expect(s.code).toMatch(CODE_PATTERN);
    expect(s).toMatchObject({ periodStart: "2026-09-01", periodEnd: "2026-09-30", dueDate: "2026-10-16",
      openingCents: 0, chargesCents: 8000, creditsCents: 0, paymentsCents: 1000, closingCents: 7000, settledCents: 0, status: "open" });
    expect(s.lines.map((l) => [l.kind, l.amountCents, l.orderNumber ?? null])).toEqual([
      ["charge", 5000, 1001], ["charge", 3000, 1002], ["payment", -1000, null],
    ]);
    expect(s.lines[0].label).toContain("Lobby");
    expect(listEntries(a.id).every((e) => e.statementId === s.id)).toBe(true);
    const sends = listForAccount(a.id).sort((x, y) => x.scheduledFor.localeCompare(y.scheduledFor));
    expect(sends.map((x) => [x.kind, x.channel, x.scheduledFor])).toEqual([
      ["statement", "both", "2026-10-01"], ["reminder", "sms", "2026-10-13"], ["reminder", "sms", "2026-10-16"], ["reminder", "both", "2026-10-23"],
    ]);
    expect(getStatementByCode(s.code)?.id).toBe(s.id);
    expect(getStatementByCode("nope")).toBeNull();
  });

  it("is idempotent for the same period and carries the balance forward", () => {
    const a = seedAccountWithCharges();
    const s1 = issueStatement(a.id, "2026-09-30", { today: "2026-10-01" })!;
    expect(issueStatement(a.id, "2026-09-30", { today: "2026-10-01" })).toBeNull();
    expect(issueStatement(a.id, "2026-09-29", { today: "2026-10-01" })).toBeNull();
    // Next month: no activity, but the balance is still owed, so a statement goes out.
    const s2 = issueStatement(a.id, "2026-10-31", { today: "2026-11-01" })!;
    expect(s2).toMatchObject({ number: "ST-1002", periodStart: "2026-10-01", openingCents: 7000, chargesCents: 0, closingCents: 7000 });
    expect(listStatements(a.id).map((s) => s.id)).toEqual([s2.id, s1.id]);
  });

  it("does nothing for an account with no activity and no balance", () => {
    const a = createAccount({ name: "Quiet" }, "2026-09-01");
    getDb().prepare("UPDATE house_accounts SET created_at = '2026-09-01T12:00:00Z' WHERE id = ?").run(a.id);
    expect(issueStatement(a.id, "2026-09-30", { today: "2026-10-01" })).toBeNull();
    expect(listForAccount(a.id)).toEqual([]);
  });

  it("a payment made after the close but before the cron counts as settled", () => {
    const a = seedAccountWithCharges();
    backdate(recordPayment({ accountId: a.id, amountCents: 7000, method: "ach", actor: "m" }).entry!.id, "2026-10-01T11:00:00Z");
    const s = issueStatement(a.id, "2026-09-30", { today: "2026-10-01" })!;
    expect(s).toMatchObject({ closingCents: 7000, settledCents: 7000, status: "paid" });
    expect(listForAccount(a.id)).toEqual([]); // nothing to send for a paid statement
    expect(listEntries(a.id).filter((e) => !e.statementId)).toHaveLength(1); // the October payment stays unbilled
  });

  it("entries after the period end wait for the next statement", () => {
    const a = seedAccountWithCharges();
    seedOrder("o1003", a.id, 900, "2026-10-01T12:00:00Z");
    backdate(recordCharge({ accountId: a.id, orderId: "o1003", amountCents: 900, actor: "m" }).id, "2026-10-01T12:00:00Z");
    const s = issueStatement(a.id, "2026-09-30", { today: "2026-10-01" })!;
    expect(s.chargesCents).toBe(8000);
    expect(listEntries(a.id).filter((e) => !e.statementId).map((e) => e.amountCents)).toEqual([900]);
  });
});

describe("accountsDueToIssue", () => {
  it("picks active accounts on their issue day that have no statement for the period yet", () => {
    const a = createAccount({ name: "Monthly1", cadence: "monthly", issueDay: 1 }, "2026-09-01");
    const b = createAccount({ name: "Monthly5", cadence: "monthly", issueDay: 5 }, "2026-09-01");
    const c = createAccount({ name: "PausedMonthly1", cadence: "monthly", issueDay: 1 }, "2026-09-01");
    updateAccount(c.id, { status: "paused" });
    for (const id of [a.id, b.id, c.id]) getDb().prepare("UPDATE house_accounts SET created_at = '2026-09-01T12:00:00Z' WHERE id = ?").run(id);
    seedOrder("o1001", a.id, 100, "2026-09-10T12:00:00Z");
    backdate(recordCharge({ accountId: a.id, orderId: "o1001", amountCents: 100, actor: "m" }).id, "2026-09-10T12:00:00Z");
    expect(accountsDueToIssue("2026-10-01").map((x) => x.name)).toEqual(["Monthly1"]);
    issueStatement(a.id, "2026-09-30", { today: "2026-10-01" });
    expect(accountsDueToIssue("2026-10-01")).toEqual([]);
    expect(accountsDueToIssue("2026-10-05").map((x) => x.name)).toEqual(["Monthly5"]);
  });
});

describe("voidStatement", () => {
  it("returns entries to unbilled, cancels sends, and refuses paid or non-latest ones", () => {
    const a = seedAccountWithCharges();
    const s1 = issueStatement(a.id, "2026-09-30", { today: "2026-10-01" })!;
    const v = voidStatement(s1.id);
    expect(v.status).toBe("void");
    expect(listEntries(a.id).every((e) => !e.statementId)).toBe(true);
    expect(listForAccount(a.id).every((x) => x.status === "canceled")).toBe(true);
    // Re-issuing the same period is allowed after a void.
    const again = issueStatement(a.id, "2026-09-30", { today: "2026-10-02" })!;
    expect(again.number).toBe("ST-1002");
    const s3 = issueStatement(a.id, "2026-10-31", { today: "2026-11-01" })!;
    expect(() => voidStatement(again.id)).toThrow("not_latest");
    // Dated after s3's close so the settlement rule counts it (tests must not depend on the real clock).
    backdate(recordPayment({ accountId: a.id, amountCents: 7000, method: "cash", actor: "m" }).entry!.id, "2026-11-02T12:00:00Z");
    recomputeSettlement(a.id);
    expect(getStatement(s3.id)?.status).toBe("paid");
    expect(() => voidStatement(s3.id)).toThrow("statement_paid");
    expect(() => voidStatement("nope")).toThrow("statement_not_found");
  });
});
