import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import {
  enqueue, getSend, dueSends, claim, markSent, markFailed, markSkipped, rescheduleSend,
  cancelForStatement, skipStaleForAccount, failStaleSending, upcomingSends, listForAccount,
} from "@/lib/house-account-sends";

beforeEach(() => { vi.stubEnv("SQLITE_FILE", ":memory:"); runMigrations(); });
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

function seedAccount(id: string, status = "active") {
  getDb().prepare("INSERT INTO house_accounts (id, name, status, created_at, updated_at) VALUES (?, ?, ?, '2026-09-01T00:00:00Z', '2026-09-01T00:00:00Z')")
    .run(id, `Org ${id}`, status);
}
function seedStatement(accountId: string, id: string, status = "open") {
  getDb().prepare(
    `INSERT INTO house_account_statements (id, account_id, number, code, period_start, period_end, issued_at, due_date,
       opening_cents, charges_cents, credits_cents, payments_cents, closing_cents, settled_cents, status, lines_json, created_at)
     VALUES (?, ?, ?, ?, '2026-09-01', '2026-09-30', '2026-10-01T13:00:00Z', '2026-10-16', 0, 100, 0, 0, 100, 0, ?, '[]', '2026-10-01T13:00:00Z')`,
  ).run(id, accountId, `ST-${id}`, id.padEnd(8, "x").slice(0, 8), status);
}

describe("queue", () => {
  it("enqueues and lists due rows only for open statements of active accounts", () => {
    seedAccount("ha_a"); seedStatement("ha_a", "s1");
    seedAccount("ha_p", "paused"); seedStatement("ha_p", "s2");
    seedAccount("ha_b"); seedStatement("ha_b", "s3", "paid");
    enqueue([
      { accountId: "ha_a", statementId: "s1", kind: "statement", channel: "both", scheduledFor: "2026-10-01" },
      { accountId: "ha_a", statementId: "s1", kind: "reminder", stepIndex: 0, channel: "sms", scheduledFor: "2026-10-13" },
      { accountId: "ha_p", statementId: "s2", kind: "statement", channel: "sms", scheduledFor: "2026-10-01" },
      { accountId: "ha_b", statementId: "s3", kind: "statement", channel: "sms", scheduledFor: "2026-10-01" },
    ]);
    const due = dueSends("2026-10-02");
    expect(due.map((d) => [d.statementId, d.kind])).toEqual([["s1", "statement"]]);
    expect(dueSends("2026-10-13").length).toBe(2);
  });

  it("claim wins once; mark* record outcomes", () => {
    seedAccount("ha_a"); seedStatement("ha_a", "s1");
    const [row] = enqueue([{ accountId: "ha_a", statementId: "s1", kind: "statement", channel: "sms", scheduledFor: "2026-10-01" }]);
    expect(claim(row.id)).toBe(true);
    expect(claim(row.id)).toBe(false);
    expect(getSend(row.id)?.status).toBe("sending");
    expect(getSend(row.id)?.claimedAt).toBeTruthy();
    markSent(row.id, { smsSid: "SM1", body: "hola" });
    const sent = getSend(row.id)!;
    expect(sent.status).toBe("sent");
    expect(sent.smsSid).toBe("SM1");
    expect(sent.body).toBe("hola");
    expect(sent.sentAt).toBeTruthy();
    const [r2, r3] = enqueue([
      { accountId: "ha_a", statementId: "s1", kind: "reminder", stepIndex: 0, channel: "sms", scheduledFor: "2026-10-05" },
      { accountId: "ha_a", statementId: "s1", kind: "reminder", stepIndex: 1, channel: "sms", scheduledFor: "2026-10-06" },
    ]);
    markFailed(r2.id, "boom");
    markSkipped(r3.id, "opt-out SMS");
    expect(getSend(r2.id)).toMatchObject({ status: "failed", error: "boom" });
    expect(getSend(r3.id)).toMatchObject({ status: "skipped", error: "opt-out SMS" });
  });

  it("reschedule only while scheduled; cancelForStatement cancels scheduled rows", () => {
    seedAccount("ha_a"); seedStatement("ha_a", "s1");
    const [a, b] = enqueue([
      { accountId: "ha_a", statementId: "s1", kind: "statement", channel: "sms", scheduledFor: "2026-10-01" },
      { accountId: "ha_a", statementId: "s1", kind: "reminder", stepIndex: 0, channel: "sms", scheduledFor: "2026-10-13" },
    ]);
    expect(rescheduleSend(b.id, "2026-10-20")?.scheduledFor).toBe("2026-10-20");
    claim(a.id); markSent(a.id, {});
    expect(rescheduleSend(a.id, "2026-10-20")).toBeNull();
    expect(cancelForStatement("s1")).toBe(1);
    expect(getSend(b.id)?.status).toBe("canceled");
    expect(getSend(a.id)?.status).toBe("sent");
  });

  it("skipStaleForAccount skips past-due scheduled rows and keeps future ones", () => {
    seedAccount("ha_a"); seedStatement("ha_a", "s1");
    const [past, future] = enqueue([
      { accountId: "ha_a", statementId: "s1", kind: "reminder", stepIndex: 0, channel: "sms", scheduledFor: "2026-10-01" },
      { accountId: "ha_a", statementId: "s1", kind: "reminder", stepIndex: 1, channel: "sms", scheduledFor: "2026-10-30" },
    ]);
    expect(skipStaleForAccount("ha_a", "2026-10-10")).toBe(1);
    expect(getSend(past.id)).toMatchObject({ status: "skipped", error: "pausa" });
    expect(getSend(future.id)?.status).toBe("scheduled");
  });

  it("failStaleSending turns an old 'sending' row into failed", () => {
    seedAccount("ha_a"); seedStatement("ha_a", "s1");
    const [row] = enqueue([{ accountId: "ha_a", statementId: "s1", kind: "statement", channel: "sms", scheduledFor: "2026-10-01" }]);
    claim(row.id);
    expect(failStaleSending(new Date(Date.now() - 3600_000).toISOString())).toBe(0);
    expect(failStaleSending(new Date(Date.now() + 1000).toISOString())).toBe(1);
    expect(getSend(row.id)).toMatchObject({ status: "failed", error: "interrumpido" });
  });

  it("upcomingSends joins account name and statement number within the window", () => {
    seedAccount("ha_a"); seedStatement("ha_a", "s1");
    enqueue([
      { accountId: "ha_a", statementId: "s1", kind: "reminder", stepIndex: 0, channel: "sms", scheduledFor: "2026-10-05" },
      { accountId: "ha_a", statementId: "s1", kind: "reminder", stepIndex: 1, channel: "sms", scheduledFor: "2026-10-25" },
    ]);
    const up = upcomingSends(7, "2026-10-02");
    expect(up).toHaveLength(1);
    expect(up[0]).toMatchObject({ accountName: "Org ha_a", statementNumber: "ST-s1", dueDate: "2026-10-16", scheduledFor: "2026-10-05" });
    expect(listForAccount("ha_a")).toHaveLength(2);
  });
});
