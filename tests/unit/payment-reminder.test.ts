import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { getOrder } from "@/lib/order-storage";

const createCheckoutSession = vi.fn();
vi.mock("@/lib/stripe-payment-link", () => ({ createCheckoutSession: (...a: unknown[]) => createCheckoutSession(...a) }));
const sendSms = vi.fn();
vi.mock("@/lib/twilio-server", () => ({ sendSms: (...a: unknown[]) => sendSms(...a) }));
vi.mock("@/lib/twilio-config", () => ({ twilioSmsEnabled: () => true, twilioDryRun: () => false }));

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  createCheckoutSession.mockReset();
  createCheckoutSession.mockResolvedValue({ id: "cs_1", url: "https://pay.test/cs_1" });
  sendSms.mockReset(); sendSms.mockResolvedValue({ sid: "SM1" });
  runMigrations();
});
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

function seed(id: string, o: { locale?: string; payment?: string; paid?: number; account?: string | null } = {}) {
  getDb().prepare(
    `INSERT INTO orders (id, locale, source, recipient_name, recipient_phone, contact_phone, contact_name,
       fulfillment_method, window_date, window_slot, lines_json, subtotal_cents, delivery_cents,
       tax_cents, total_cents, amount_paid_cents, fulfillment_status, payment_status, house_account_id,
       order_number, created_at, updated_at)
     VALUES (?, ?, 'phone', 'Ana', '555', '5165551234', 'Robyn Lee', 'delivery', '2026-10-10', 'morning', '[]', 0, 0, 0,
       10000, ?, 'delivered', ?, ?, 1042, '2026-10-01T15:00:00Z', '2026-10-01T15:00:00Z')`,
  ).run(id, o.locale ?? "en", o.paid ?? 0, o.payment ?? "pending", o.account ?? null);
}
function seedCustomer(channel: string) {
  getDb().prepare("INSERT INTO customers (id, name, phone, order_count, first_seen_at, last_seen_at, messaging_channel) VALUES ('cus_1', 'Robyn', '5165551234', 0, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', ?)").run(channel);
}
async function order(id: string) {
  const o = await getOrder(id);
  if (!o) throw new Error("seed missing");
  return o;
}
async function remind(id: string) {
  const { sendPaymentReminder } = await import("@/lib/payment-reminder");
  return sendPaymentReminder(await order(id));
}
function reminderRows() {
  return getDb().prepare("SELECT template, status, to_phone, body FROM messages WHERE template = 'payment_reminder'").all() as
    { template: string; status: string; to_phone: string; body: string }[];
}

describe("sendPaymentReminder", () => {
  it("texts the buyer the remaining balance with a fresh payment link, and logs it", async () => {
    seed("o1", { paid: 4000 });
    expect(await remind("o1")).toEqual({ ok: true });
    expect(createCheckoutSession).toHaveBeenCalledTimes(1);
    const [to, body] = sendSms.mock.calls[0] as [string, string];
    expect(to).toBe("5165551234");
    expect(body).toContain("Robyn");
    expect(body).toContain("#1042");
    expect(body).toContain("$60.00");
    expect(body).toContain("https://pay.test/cs_1");
    expect(reminderRows()).toMatchObject([{ status: "sent", to_phone: "5165551234" }]);
  });

  it("writes in the order's language", async () => {
    seed("o1", { locale: "es" });
    await remind("o1");
    expect(sendSms.mock.calls[0][1]).toContain("saldo");
  });

  it("refuses orders it must not chase, without creating a link", async () => {
    seed("acct", { account: "ha_1" });
    seed("settled", { payment: "paid", paid: 10000 });
    seed("edited", { payment: "paid", paid: 8000 });
    expect(await remind("acct")).toEqual({ ok: false, reason: "on_account" });
    expect(await remind("settled")).toEqual({ ok: false, reason: "nothing_due" });
    expect(await remind("edited")).toEqual({ ok: false, reason: "not_pending" });
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });

  it("respects an SMS opt-out", async () => {
    seed("o1");
    seedCustomer("none");
    expect(await remind("o1")).toEqual({ ok: false, reason: "opted_out" });
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });

  it("sends at most one reminder per order every 24 hours", async () => {
    seed("o1");
    expect(await remind("o1")).toEqual({ ok: true });
    expect(await remind("o1")).toEqual({ ok: false, reason: "already_sent" });
    expect(sendSms).toHaveBeenCalledTimes(1);
  });

  it("reports a payment-link failure without texting", async () => {
    seed("o1");
    createCheckoutSession.mockRejectedValue(new Error("stripe down"));
    expect(await remind("o1")).toEqual({ ok: false, reason: "link_failed" });
    expect(sendSms).not.toHaveBeenCalled();
  });

  it("reports an SMS failure", async () => {
    seed("o1");
    sendSms.mockRejectedValue(new Error("Twilio down"));
    expect(await remind("o1")).toEqual({ ok: false, reason: "Twilio down" });
    expect(reminderRows()).toMatchObject([{ status: "failed" }]);
  });
});
