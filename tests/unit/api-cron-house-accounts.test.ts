import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { createAccount } from "@/lib/house-account-storage";
import { recordCharge } from "@/lib/house-account-ledger";
import { listStatements } from "@/lib/house-account-statements";
import { listForAccount, enqueue, claim } from "@/lib/house-account-sends";

const sendSms = vi.fn();
vi.mock("@/lib/twilio-server", () => ({ sendSms: (...a: unknown[]) => sendSms(...a) }));
vi.mock("@/lib/twilio-config", () => ({ twilioSmsEnabled: () => true, twilioDryRun: () => false }));
vi.mock("resend", () => ({ Resend: class { emails = { send: async () => ({ data: { id: "em" }, error: null }) }; } }));

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("CRON_SECRET", "s3cret");
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-01T14:00:00Z")); // 10:00 New York, the 1st
  sendSms.mockReset(); sendSms.mockResolvedValue({ sid: "SM1" });
  runMigrations();
});
afterEach(() => { closeDb(); vi.useRealTimers(); vi.unstubAllEnvs(); });

function seedOrder(id: string, accountId: string, total: number, createdAt: string) {
  getDb().prepare(
    `INSERT INTO orders (id, locale, source, recipient_name, recipient_phone, contact_phone, fulfillment_method, window_date,
       lines_json, subtotal_cents, delivery_cents, tax_cents, total_cents, amount_paid_cents, fulfillment_status,
       payment_status, payment_method, house_account_id, order_number, created_at, updated_at)
     VALUES (?, 'es', 'phone', 'Dest', '555', '5165550100', 'delivery', '2026-10-01', '[]', ?, 0, 0, ?, 0, 'pending',
       'pending', 'house-account', ?, 1001, ?, ?)`,
  ).run(id, total, total, accountId, createdAt, createdAt);
}
function monthlyAccountWithCharge(name: string, phone = "5165550100") {
  const a = createAccount({ name, billingPhone: phone, cadence: "monthly", issueDay: 1, termsDays: 15, statementChannel: "sms" }, "2026-09-01");
  getDb().prepare("UPDATE house_accounts SET created_at = '2026-09-01T12:00:00Z' WHERE id = ?").run(a.id);
  seedOrder(`o_${name}`, a.id, 5000, "2026-09-10T12:00:00Z");
  const e = recordCharge({ accountId: a.id, orderId: `o_${name}`, amountCents: 5000, actor: "m" });
  getDb().prepare("UPDATE house_account_entries SET created_at = '2026-09-10T12:00:00Z' WHERE id = ?").run(e.id);
  return a;
}
async function post(auth?: string) {
  const { POST } = await import("@/app/api/cron/house-accounts/route");
  return POST(new Request("http://t", { method: "POST", headers: auth ? { authorization: auth } : {} }));
}

describe("POST /api/cron/house-accounts", () => {
  it("503 without CRON_SECRET, 401 with a bad bearer", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await post("Bearer x")).status).toBe(503);
    vi.stubEnv("CRON_SECRET", "s3cret");
    expect((await post()).status).toBe(401);
    expect((await post("Bearer wrong")).status).toBe(401);
  });

  it("issues statements due today and sends what is due, once", async () => {
    const a = monthlyAccountWithCharge("A");
    const res = await post("Bearer s3cret");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, today: "2026-10-01", issued: 1, sent: 1, failed: 0, skipped: 0 });
    const [st] = listStatements(a.id);
    expect(st).toMatchObject({ periodEnd: "2026-09-30", closingCents: 5000, dueDate: "2026-10-16", status: "open" });
    expect(sendSms).toHaveBeenCalledTimes(1);
    expect(sendSms.mock.calls[0][1]).toContain(st.number);
    const again = await (await post("Bearer s3cret")).json();
    expect(again).toMatchObject({ issued: 0, sent: 0 });
    expect(sendSms).toHaveBeenCalledTimes(1);
    expect(listForAccount(a.id).filter((s) => s.status === "sent")).toHaveLength(1);
  });

  it("one failing number does not stop the batch", async () => {
    monthlyAccountWithCharge("A", "5165550100");
    monthlyAccountWithCharge("B", "5165550200");
    sendSms.mockRejectedValueOnce(new Error("bad number"));
    const data = await (await post("Bearer s3cret")).json();
    expect(data).toMatchObject({ issued: 2, sent: 1, failed: 1 });
  });

  it("turns a stale 'sending' row into failed", async () => {
    const a = monthlyAccountWithCharge("A");
    await post("Bearer s3cret");
    const [st] = listStatements(a.id);
    const [stale] = enqueue([{ accountId: a.id, statementId: st.id, kind: "manual", channel: "sms", scheduledFor: "2026-10-01" }]);
    claim(stale.id);
    getDb().prepare("UPDATE house_account_sends SET claimed_at = '2026-10-01T10:00:00Z' WHERE id = ?").run(stale.id);
    await post("Bearer s3cret");
    const row = listForAccount(a.id).find((s) => s.id === stale.id)!;
    expect(row).toMatchObject({ status: "failed", error: "interrumpido" });
  });

  it("quiet day", async () => {
    expect(await (await post("Bearer s3cret")).json()).toMatchObject({ issued: 0, sent: 0, failed: 0, skipped: 0 });
  });
});
