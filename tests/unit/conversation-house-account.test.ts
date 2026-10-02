import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { createAccount } from "@/lib/house-account-storage";
import { enqueue, claim, markSent } from "@/lib/house-account-sends";
import { conversationThread, listConversations } from "@/lib/conversation-storage";

beforeEach(() => { vi.stubEnv("SQLITE_FILE", ":memory:"); runMigrations(); });
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

it("a sent statement SMS shows in the billing contact's thread", () => {
  getDb().prepare("INSERT INTO customers (id, name, phone, order_count, first_seen_at, last_seen_at) VALUES ('cus_1', 'Ana', '5165550100', 0, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')").run();
  const a = createAccount({ name: "Hotel", billingPhone: "5165550100" });
  getDb().prepare(
    `INSERT INTO house_account_statements (id, account_id, number, code, period_start, period_end, issued_at, due_date,
       opening_cents, charges_cents, credits_cents, payments_cents, closing_cents, settled_cents, status, lines_json, created_at)
     VALUES ('hst_1', ?, 'ST-1001', 'AbCdEfGh', '2026-09-01', '2026-09-30', '2026-10-01T13:00:00Z', '2026-10-16', 0, 7000, 0, 0, 7000, 0, 'open', '[]', '2026-10-01T13:00:00Z')`,
  ).run(a.id);
  const [sent, skipped] = enqueue([
    { accountId: a.id, statementId: "hst_1", kind: "statement", channel: "sms", scheduledFor: "2026-10-01" },
    { accountId: a.id, statementId: "hst_1", kind: "reminder", stepIndex: 0, channel: "sms", scheduledFor: "2026-10-13" },
  ]);
  claim(sent.id); markSent(sent.id, { smsSid: "SM1", body: "Diva Flowers: tu estado de cuenta ST-1001 …" });
  claim(skipped.id);
  const { thread } = conversationThread("cus_1");
  expect(thread).toHaveLength(1);
  expect(thread[0]).toMatchObject({ direction: "out", kind: "transactional", template: "house_statement", status: "sent" });
  expect(thread[0].text).toContain("ST-1001");
  expect(listConversations()[0]).toMatchObject({ customerId: "cus_1", name: "Ana" });
});
