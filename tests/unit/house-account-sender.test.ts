// tests/unit/house-account-sender.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { createAccount } from "@/lib/house-account-storage";
import { enqueue, getSend } from "@/lib/house-account-sends";

const sendSms = vi.fn();
vi.mock("@/lib/twilio-server", () => ({ sendSms: (...a: unknown[]) => sendSms(...a) }));
const twilio = { enabled: true, dry: false };
vi.mock("@/lib/twilio-config", () => ({ twilioSmsEnabled: () => twilio.enabled, twilioDryRun: () => twilio.dry }));
const emailSend = vi.fn();
vi.mock("resend", () => ({ Resend: class { emails = { send: (...a: unknown[]) => emailSend(...a) }; } }));

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("RESEND_API_KEY", "re_test");
  vi.stubEnv("ORDER_NOTIFICATIONS_FROM", "Diva <studio@divaflowers.com>");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://x.test");
  sendSms.mockReset(); sendSms.mockResolvedValue({ sid: "SM1" });
  emailSend.mockReset(); emailSend.mockResolvedValue({ data: { id: "em_1" }, error: null });
  twilio.enabled = true; twilio.dry = false;
  runMigrations();
});
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

function seedStatement(accountId: string, id = "s1", dueDate = "2026-10-16", status = "open") {
  getDb().prepare(
    `INSERT INTO house_account_statements (id, account_id, number, code, period_start, period_end, issued_at, due_date,
       opening_cents, charges_cents, credits_cents, payments_cents, closing_cents, settled_cents, status, lines_json, created_at)
     VALUES (?, ?, 'ST-1001', 'AbCdEfGh', '2026-09-01', '2026-09-30', '2026-10-01T13:00:00Z', ?, 0, 7000, 0, 0, 7000, 0, ?, '[]', '2026-10-01T13:00:00Z')`,
  ).run(id, accountId, dueDate, status);
}
function seedCustomer(phone: string, channel = "sms") {
  getDb().prepare("INSERT INTO customers (id, name, phone, order_count, first_seen_at, last_seen_at, messaging_channel) VALUES ('cus_1', 'Ana', ?, 0, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', ?)").run(phone, channel);
}
async function load() { return import("@/lib/house-account-sender"); }

describe("sendStep", () => {
  it("sends SMS and email for 'both' and records ids", async () => {
    const a = createAccount({ name: "Org", billingPhone: "5165550100", billingEmail: "ap@org.com", locale: "es" });
    seedStatement(a.id);
    const [row] = enqueue([{ accountId: a.id, statementId: "s1", kind: "statement", channel: "both", scheduledFor: "2026-10-01" }]);
    const { sendStep } = await load();
    const out = await sendStep(row, "2026-10-01");
    expect(out.status).toBe("sent");
    expect(out.smsSid).toBe("SM1");
    expect(out.emailId).toBe("em_1");
    expect(out.body).toContain("estado de cuenta ST-1001 por $70");
    expect(out.body).toContain("https://x.test/s/AbCdEfGh");
    expect(sendSms).toHaveBeenCalledWith("5165550100", out.body);
    const [emailArgs] = emailSend.mock.calls[0] as [{ to: string; subject: string; html: string; replyTo: string }];
    expect(emailArgs.to).toBe("ap@org.com");
    expect(emailArgs.subject).toBe("Estado de cuenta ST-1001 · Diva Flowers");
    expect(emailArgs.html).toContain("ST-1001");
    expect(emailArgs.html).toContain('href="https://x.test/s/AbCdEfGh"');
    expect(emailArgs.html).not.toContain("<form");
    expect(emailArgs.replyTo).toBe("studio@divaflowers.com");
  });
  it("skips when neither channel is available, naming the reasons", async () => {
    const a = createAccount({ name: "Org" });
    seedStatement(a.id);
    const [row] = enqueue([{ accountId: a.id, statementId: "s1", kind: "statement", channel: "both", scheduledFor: "2026-10-01" }]);
    const { sendStep } = await load();
    expect(await sendStep(row, "2026-10-01")).toEqual({ status: "skipped", error: "sin teléfono, sin email" });
    expect(sendSms).not.toHaveBeenCalled();
  });
  it("respects an SMS opt-out but still emails; notes the skip", async () => {
    seedCustomer("5165550100", "none");
    const a = createAccount({ name: "Org", billingPhone: "5165550100", billingEmail: "ap@org.com" });
    seedStatement(a.id);
    const [row] = enqueue([{ accountId: a.id, statementId: "s1", kind: "reminder", stepIndex: 0, channel: "both", scheduledFor: "2026-10-13" }]);
    const { sendStep } = await load();
    const out = await sendStep(row, "2026-10-13");
    expect(out.status).toBe("sent");
    expect(out.smsSid).toBeUndefined();
    expect(out.emailId).toBe("em_1");
    expect(out.error).toBe("opt-out SMS");
    expect(sendSms).not.toHaveBeenCalled();
  });
  it("email requested but not configured → skipped", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    const a = createAccount({ name: "Org", billingEmail: "ap@org.com" });
    seedStatement(a.id);
    const [row] = enqueue([{ accountId: a.id, statementId: "s1", kind: "statement", channel: "email", scheduledFor: "2026-10-01" }]);
    const { sendStep } = await load();
    expect(await sendStep(row, "2026-10-01")).toEqual({ status: "skipped", error: "email no configurado" });
  });
  it("dry run records a fake sid and does not call Twilio", async () => {
    twilio.dry = true;
    const a = createAccount({ name: "Org", billingPhone: "5165550100" });
    seedStatement(a.id);
    const [row] = enqueue([{ accountId: a.id, statementId: "s1", kind: "statement", channel: "sms", scheduledFor: "2026-10-01" }]);
    const { sendStep } = await load();
    const out = await sendStep(row, "2026-10-01");
    expect(out).toMatchObject({ status: "sent", smsSid: "dry-run" });
    expect(sendSms).not.toHaveBeenCalled();
  });
  it("uses the overdue text after the due date and the reminder text before", async () => {
    const a = createAccount({ name: "Org", billingPhone: "5165550100", locale: "en" });
    seedStatement(a.id);
    const [before, after] = enqueue([
      { accountId: a.id, statementId: "s1", kind: "reminder", stepIndex: 0, channel: "sms", scheduledFor: "2026-10-13" },
      { accountId: a.id, statementId: "s1", kind: "reminder", stepIndex: 2, channel: "sms", scheduledFor: "2026-10-23" },
    ]);
    const { sendStep } = await load();
    expect((await sendStep(before, "2026-10-13")).body).toContain("is due");
    expect((await sendStep(after, "2026-10-23")).body).toContain("was due");
  });
  it("a Twilio failure on the only channel → failed with the message", async () => {
    sendSms.mockRejectedValueOnce(new Error("21610 blocked"));
    const a = createAccount({ name: "Org", billingPhone: "5165550100" });
    seedStatement(a.id);
    const [row] = enqueue([{ accountId: a.id, statementId: "s1", kind: "statement", channel: "sms", scheduledFor: "2026-10-01" }]);
    const { sendStep } = await load();
    expect(await sendStep(row, "2026-10-01")).toEqual({ status: "failed", error: "sms: 21610 blocked" });
  });
});

describe("dispatchSend", () => {
  it("claims, sends, marks; a second dispatch is a no-op", async () => {
    const a = createAccount({ name: "Org", billingPhone: "5165550100" });
    seedStatement(a.id);
    const [row] = enqueue([{ accountId: a.id, statementId: "s1", kind: "statement", channel: "sms", scheduledFor: "2026-10-01" }]);
    const { dispatchSend } = await load();
    const done = await dispatchSend(row, "2026-10-01");
    expect(done.status).toBe("sent");
    expect(done.smsSid).toBe("SM1");
    expect(done.body).toContain("ST-1001");
    await dispatchSend(row, "2026-10-01");
    expect(sendSms).toHaveBeenCalledTimes(1);
    expect(getSend(row.id)?.status).toBe("sent");
  });
  it("marks skipped and failed outcomes", async () => {
    const a = createAccount({ name: "Org" });
    seedStatement(a.id);
    const [row] = enqueue([{ accountId: a.id, statementId: "s1", kind: "statement", channel: "sms", scheduledFor: "2026-10-01" }]);
    const { dispatchSend } = await load();
    expect((await dispatchSend(row, "2026-10-01"))).toMatchObject({ status: "skipped", error: "sin teléfono" });
  });
});
