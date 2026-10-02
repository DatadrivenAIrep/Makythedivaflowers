import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { setSetting } from "@/lib/settings-storage";
import {
  createAccount, getAccount, updateAccount, accountBalanceCents, linkContact, unlinkContact,
  listContacts, findAccountForCustomer, findAccountForPhone, searchAccounts, listAccounts, receivablesSummary,
} from "@/lib/house-account-storage";

beforeEach(() => { vi.stubEnv("SQLITE_FILE", ":memory:"); runMigrations(); });
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

function seedCustomer(id: string, phone: string, name = "Ana") {
  const now = "2026-09-01T00:00:00Z";
  getDb().prepare(
    `INSERT INTO customers (id, name, phone, order_count, first_seen_at, last_seen_at) VALUES (?, ?, ?, 0, ?, ?)`,
  ).run(id, name, phone, now, now);
}
function seedEntry(accountId: string, kind: string, cents: number, createdAt = "2026-09-10T12:00:00Z") {
  getDb().prepare(
    `INSERT INTO house_account_entries (id, account_id, kind, amount_cents, actor, created_at) VALUES (?, ?, ?, ?, 'test', ?)`,
  ).run(`hae_${Math.random().toString(36).slice(2)}`, accountId, kind, cents, createdAt);
}
function seedStatement(accountId: string, id: string, dueDate: string, closing: number, settled = 0, status = "open", periodEnd = "2026-09-30") {
  getDb().prepare(
    `INSERT INTO house_account_statements (id, account_id, number, code, period_start, period_end, issued_at, due_date,
       opening_cents, charges_cents, credits_cents, payments_cents, closing_cents, settled_cents, status, lines_json, created_at)
     VALUES (?, ?, ?, ?, '2026-09-01', ?, '2026-10-01T13:00:00Z', ?, 0, ?, 0, 0, ?, ?, ?, '[]', '2026-10-01T13:00:00Z')`,
  ).run(id, accountId, `ST-${id}`, id.padEnd(8, "x").slice(0, 8), periodEnd, dueDate, closing, closing, settled, status);
}

describe("createAccount / getAccount / updateAccount", () => {
  it("creates with plan defaults and round-trips", () => {
    const a = createAccount({ name: "  Hotel Roslyn ", billingPhone: "(516) 555-0100", billingEmail: "ap@hotel.com" }, "2026-10-02");
    expect(a.id).toMatch(/^ha_/);
    expect(a.name).toBe("Hotel Roslyn");
    expect(a.billingPhone).toBe("5165550100");
    expect(a.cadence).toBe("monthly");
    expect(a.issueDay).toBe(1);
    expect(a.termsDays).toBe(15);
    expect(a.reminderPlan).toHaveLength(3);
    expect(a.statementChannel).toBe("both");
    expect(a.status).toBe("active");
    expect(getAccount(a.id)).toEqual(a);
  });
  it("reads defaults from the settings row", () => {
    setSetting("house_account_defaults", JSON.stringify({ termsDays: 30, cadence: "weekly", issueDay: 1 }));
    const a = createAccount({ name: "Iglesia" }, "2026-10-02");
    expect(a.termsDays).toBe(30);
    expect(a.cadence).toBe("weekly");
  });
  it("rejects an empty name and an out-of-range issue day", () => {
    expect(() => createAccount({ name: "  " })).toThrow("name_required");
    expect(() => createAccount({ name: "X", cadence: "monthly", issueDay: 31 })).toThrow("issue_day_invalid");
    expect(() => createAccount({ name: "X", cadence: "weekly", issueDay: 7 })).toThrow("issue_day_invalid");
  });
  it("sets the biweekly anchor from today and clears it when cadence changes", () => {
    const a = createAccount({ name: "Funeraria", cadence: "biweekly", issueDay: 1 }, "2026-10-06"); // Tuesday
    expect(a.anchorDate).toBe("2026-10-12");
    const b = updateAccount(a.id, { cadence: "monthly", issueDay: 5 }, "2026-10-06")!;
    expect(b.anchorDate).toBeUndefined();
    expect(b.issueDay).toBe(5);
    const c = updateAccount(a.id, { status: "paused", notes: "vacaciones" })!;
    expect(c.status).toBe("paused");
    expect(c.notes).toBe("vacaciones");
    expect(updateAccount("ha_nope", { notes: "x" })).toBeNull();
  });
});

describe("contacts", () => {
  it("links, lists, finds by customer and by phone, unlinks", () => {
    seedCustomer("cus_1", "5165550111", "Ana López");
    const a = createAccount({ name: "Org" });
    linkContact(a.id, "cus_1");
    expect(listContacts(a.id).map((c) => c.id)).toEqual(["cus_1"]);
    expect(findAccountForCustomer("cus_1")?.id).toBe(a.id);
    expect(findAccountForPhone("+1 (516) 555-0111")?.id).toBe(a.id);
    expect(findAccountForPhone("5165559999")).toBeNull();
    unlinkContact(a.id, "cus_1");
    expect(listContacts(a.id)).toEqual([]);
  });
  it("a customer belongs to one account only", () => {
    seedCustomer("cus_2", "5165550222");
    const a = createAccount({ name: "A" });
    const b = createAccount({ name: "B" });
    linkContact(a.id, "cus_2");
    linkContact(a.id, "cus_2"); // idempotent
    expect(() => linkContact(b.id, "cus_2")).toThrow("contact_taken");
    expect(() => linkContact(a.id, "cus_missing")).toThrow("customer_not_found");
  });
});

describe("balance, search, list, receivables", () => {
  it("balance is the signed sum of entries", () => {
    const a = createAccount({ name: "Org" });
    seedEntry(a.id, "charge", 10000);
    seedEntry(a.id, "payment", -2500);
    expect(accountBalanceCents(a.id)).toBe(7500);
    expect(accountBalanceCents("ha_nope")).toBe(0);
  });
  it("searchAccounts matches active accounts by name, case-insensitively", () => {
    createAccount({ name: "Hotel Roslyn" });
    const paused = createAccount({ name: "Hotel Garden" });
    updateAccount(paused.id, { status: "closed" });
    expect(searchAccounts("hotel").map((x) => x.name)).toEqual(["Hotel Roslyn"]);
    expect(searchAccounts("")).toEqual([]);
  });
  it("listAccounts annotates balance, oldest open statement, overdue and next issue", () => {
    const a = createAccount({ name: "Vencida", cadence: "monthly", issueDay: 1 }, "2026-10-02");
    seedEntry(a.id, "charge", 5000, "2026-09-10T12:00:00Z");
    seedStatement(a.id, "s1", "2026-09-30", 5000);
    const b = createAccount({ name: "Al día" }, "2026-10-02");
    seedEntry(b.id, "charge", 800, "2026-10-01T12:00:00Z");
    seedEntry(b.id, "payment", -800, "2026-10-01T13:00:00Z");
    const p = createAccount({ name: "Pausada" });
    updateAccount(p.id, { status: "paused" });

    const all = listAccounts({ today: "2026-10-02" });
    expect(all.map((x) => x.name)).toEqual(["Vencida", "Al día", "Pausada"]);
    const v = all[0];
    expect(v.balanceCents).toBe(5000);
    expect(v.oldestOpen).toMatchObject({ id: "s1", number: "ST-s1", dueDate: "2026-09-30", dueCents: 5000 });
    expect(v.overdue).toBe(true);
    expect(v.nextIssueDate).toBe("2026-11-01");
    expect(v.lastPaymentAt).toBeNull();
    expect(all[1].lastPaymentAt).toBe("2026-10-01T13:00:00Z");
    expect(listAccounts({ filter: "overdue", today: "2026-10-02" }).map((x) => x.name)).toEqual(["Vencida"]);
    expect(listAccounts({ filter: "with_balance", today: "2026-10-02" }).map((x) => x.name)).toEqual(["Vencida"]);
    expect(listAccounts({ filter: "paused" }).map((x) => x.name)).toEqual(["Pausada"]);
    expect(listAccounts({ q: "al d" }).map((x) => x.name)).toEqual(["Al día"]);
  });
  it("receivablesSummary totals positive balances and overdue open statements", () => {
    const a = createAccount({ name: "A" });
    seedEntry(a.id, "charge", 5000);
    seedStatement(a.id, "s1", "2026-09-30", 5000, 1000);
    const b = createAccount({ name: "B" });
    seedEntry(b.id, "credit", -300);
    seedStatement(b.id, "s2", "2026-10-20", 900);
    expect(receivablesSummary("2026-10-02")).toEqual({ balanceCents: 5000, overdueCents: 4000, overdueCount: 1 });
    // A second account with two cumulative overdue statements counts once, at its largest due.
    const c = createAccount({ name: "C" });
    seedEntry(c.id, "charge", 15000);
    seedStatement(c.id, "s3", "2026-09-15", 10000, 0, "open", "2026-08-31");
    seedStatement(c.id, "s4", "2026-09-30", 15000);
    expect(receivablesSummary("2026-10-02")).toEqual({ balanceCents: 20000, overdueCents: 19000, overdueCount: 2 });
  });
  it("receivablesSummary counts an account with two overdue statements once, at its largest due", () => {
    const a = createAccount({ name: "A" });
    seedEntry(a.id, "charge", 15000);
    seedStatement(a.id, "s1", "2026-09-15", 10000, 0, "open", "2026-08-31");
    seedStatement(a.id, "s2", "2026-09-30", 15000);
    expect(receivablesSummary("2026-10-02")).toEqual({ balanceCents: 15000, overdueCents: 15000, overdueCount: 1 });
  });
});
