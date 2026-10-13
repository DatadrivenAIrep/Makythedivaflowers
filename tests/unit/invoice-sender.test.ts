import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { getOrder } from "@/lib/order-storage";
import { ensureInvoiceCode } from "@/lib/invoice-links";

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

function seed(id: string, locale: "en" | "es" = "en") {
  getDb().prepare(
    `INSERT INTO orders (id, locale, source, recipient_name, recipient_phone, contact_phone, contact_email, contact_name,
       fulfillment_method, window_date, window_slot, lines_json, subtotal_cents, delivery_cents,
       tax_cents, total_cents, fulfillment_status, payment_status, order_number, created_at, updated_at)
     VALUES (?, ?, 'walk-in', 'Ana', '555', '5165551234', 'buyer@mail.com', 'Robyn Lee', 'in-store', NULL, NULL, '[]', 10000,0,863,10863,
       'pending', 'paid', 1001, '2026-06-01T08:00:00Z', '2026-06-01T08:00:00Z')`,
  ).run(id, locale);
}
function seedCustomer(phone: string, channel: string) {
  getDb().prepare("INSERT INTO customers (id, name, phone, order_count, first_seen_at, last_seen_at, messaging_channel) VALUES ('cus_1', 'Robyn', ?, 0, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', ?)").run(phone, channel);
}
function messageRows() {
  return getDb().prepare("SELECT channel, template, status, to_phone, to_email, error, body FROM messages ORDER BY channel").all() as {
    channel: string; template: string; status: string; to_phone: string | null; to_email: string | null; error: string | null; body: string | null;
  }[];
}
async function order(id: string) {
  const o = await getOrder(id);
  if (!o) throw new Error("seed missing");
  return o;
}
async function load() { return import("@/lib/invoice-sender"); }

describe("sendInvoice", () => {
  it("sends both channels to the edited recipients with the public link, and logs them", async () => {
    seed("o1");
    const { sendInvoice } = await load();
    const out = await sendInvoice(await order("o1"), { channel: "both", phone: "(516) 555-0199", email: "ap@corp.com" });
    const link = `https://x.test/i/${ensureInvoiceCode("o1")}`;
    expect(out.link).toBe(link);
    expect(out.sms).toEqual({ status: "sent" });
    expect(out.email).toEqual({ status: "sent" });

    const [to, body] = sendSms.mock.calls[0] as [string, string];
    expect(to).toBe("5165550199");
    expect(body).toContain("Robyn");
    expect(body).toContain("INV-1001");
    expect(body).toContain("$108.63");
    expect(body).toContain(link);

    const [mail] = emailSend.mock.calls[0] as [{ to: string; subject: string; html: string; replyTo: string; from: string }];
    expect(mail.to).toBe("ap@corp.com");
    expect(mail.subject).toBe("Invoice INV-1001 · Diva Flowers");
    expect(mail.replyTo).toBe("studio@divaflowers.com");
    expect(mail.html).toContain("INV-1001");
    expect(mail.html).toContain(`href="${link}"`);
    expect(mail.html).toContain('src="https://x.test/print/logo.jpg"');
    expect(mail.html).not.toContain("window.print");
    expect(mail.html).not.toContain("data:image");

    const rows = messageRows();
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => [r.channel, r.template, r.status])).toEqual([["email", "invoice", "sent"], ["sms", "invoice", "sent"]]);
    expect(rows[0].to_email).toBe("ap@corp.com");
    expect(rows[1].to_phone).toBe("5165550199");
  });

  it("falls back to the buyer's phone and email on the order", async () => {
    seed("o1");
    const { sendInvoice } = await load();
    await sendInvoice(await order("o1"), { channel: "both" });
    expect(sendSms.mock.calls[0][0]).toBe("5165551234");
    expect((emailSend.mock.calls[0][0] as { to: string }).to).toBe("buyer@mail.com");
  });

  it("writes the SMS and the email subject in the order's language", async () => {
    seed("o1", "es");
    const { sendInvoice } = await load();
    await sendInvoice(await order("o1"), { channel: "both" });
    expect(sendSms.mock.calls[0][1]).toContain("factura");
    expect((emailSend.mock.calls[0][0] as { subject: string }).subject).toBe("Factura INV-1001 · Diva Flowers");
  });

  it("only touches the requested channel", async () => {
    seed("o1");
    const { sendInvoice } = await load();
    const out = await sendInvoice(await order("o1"), { channel: "email" });
    expect(out.sms).toBeUndefined();
    expect(out.email).toEqual({ status: "sent" });
    expect(sendSms).not.toHaveBeenCalled();
  });

  it("skips an opted-out phone but still emails", async () => {
    seed("o1");
    seedCustomer("5165551234", "none");
    const { sendInvoice } = await load();
    const out = await sendInvoice(await order("o1"), { channel: "both" });
    expect(out.sms).toEqual({ status: "skipped", error: "opted_out" });
    expect(out.email).toEqual({ status: "sent" });
    expect(sendSms).not.toHaveBeenCalled();
  });

  it("skips email when Resend is not configured", async () => {
    seed("o1");
    vi.stubEnv("RESEND_API_KEY", "");
    const { sendInvoice } = await load();
    const out = await sendInvoice(await order("o1"), { channel: "email" });
    expect(out.email).toEqual({ status: "skipped", error: "email_not_configured" });
    expect(emailSend).not.toHaveBeenCalled();
  });

  it("skips a channel with no destination", async () => {
    seed("o1");
    getDb().prepare("UPDATE orders SET contact_email = NULL WHERE id = 'o1'").run();
    const { sendInvoice } = await load();
    const out = await sendInvoice(await order("o1"), { channel: "email" });
    expect(out.email).toEqual({ status: "skipped", error: "no_email" });
  });

  it("reports provider failures per channel and logs them", async () => {
    seed("o1");
    sendSms.mockRejectedValue(new Error("Twilio down"));
    emailSend.mockResolvedValue({ data: null, error: { message: "bad domain" } });
    const { sendInvoice } = await load();
    const out = await sendInvoice(await order("o1"), { channel: "both" });
    expect(out.sms).toEqual({ status: "failed", error: "Twilio down" });
    expect(out.email).toEqual({ status: "failed", error: "bad domain" });
    expect(messageRows().map((r) => [r.channel, r.status, r.error])).toEqual([
      ["email", "failed", "bad domain"],
      ["sms", "failed", "Twilio down"],
    ]);
  });
});
