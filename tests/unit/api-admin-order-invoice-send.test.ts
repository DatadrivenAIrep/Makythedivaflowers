import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { signSession } from "@/lib/admin-auth";

const sendInvoice = vi.fn();
vi.mock("@/lib/invoice-sender", () => ({ sendInvoice: (...a: unknown[]) => sendInvoice(...a) }));

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("INTAKE_SESSION_SECRET", "test-secret-test-secret-test-secret");
  sendInvoice.mockReset();
  sendInvoice.mockResolvedValue({ link: "https://x.test/i/AbCdEfGh", sms: { status: "sent" } });
  runMigrations();
});
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

function seed(id: string) {
  getDb().prepare(
    `INSERT INTO orders (id, locale, source, recipient_name, recipient_phone, contact_phone,
       fulfillment_method, window_date, window_slot, lines_json, subtotal_cents, delivery_cents,
       tax_cents, total_cents, fulfillment_status, payment_status, order_number, created_at, updated_at)
     VALUES (?, 'en', 'walk-in', 'Ana', '555', '5165551234', 'in-store', NULL, NULL, '[]', 10000,0,863,10863,
       'pending', 'pending', 1001, '2026-06-01T08:00:00Z', '2026-06-01T08:00:00Z')`,
  ).run(id);
}
async function post(id: string, body: unknown, authed = true) {
  const { POST } = await import("@/app/api/admin/orders/[id]/invoice/send/route");
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (authed) headers.cookie = `intake_session=${signSession()}`;
  return POST(new Request("http://x", { method: "POST", headers, body: JSON.stringify(body) }), { params: Promise.resolve({ id }) });
}

describe("POST /api/admin/orders/[id]/invoice/send", () => {
  it("401 without a session", async () => {
    seed("o1");
    expect((await post("o1", { channel: "sms" }, false)).status).toBe(401);
    expect(sendInvoice).not.toHaveBeenCalled();
  });

  it("400 for a bad channel, phone or email", async () => {
    seed("o1");
    expect((await post("o1", { channel: "fax" })).status).toBe(400);
    expect((await post("o1", { channel: "sms", phone: "123" })).status).toBe(400);
    expect((await post("o1", { channel: "email", email: "not-an-email" })).status).toBe(400);
    expect(sendInvoice).not.toHaveBeenCalled();
  });

  it("404 for an unknown order", async () => {
    expect((await post("nope", { channel: "sms" })).status).toBe(404);
  });

  it("passes the edited recipients through and returns per-channel results", async () => {
    seed("o1");
    const res = await post("o1", { channel: "both", phone: "(516) 555-0199", email: " AP@Corp.com " });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ link: "https://x.test/i/AbCdEfGh", sms: { status: "sent" } });
    const [order, req] = sendInvoice.mock.calls[0] as [{ id: string }, unknown];
    expect(order.id).toBe("o1");
    expect(req).toEqual({ channel: "both", phone: "(516) 555-0199", email: "AP@Corp.com" });
  });

  it("treats blank recipients as 'use the order's'", async () => {
    seed("o1");
    await post("o1", { channel: "both", phone: "", email: "" });
    expect(sendInvoice.mock.calls[0][1]).toEqual({ channel: "both" });
  });

  it("502 when nothing was sent", async () => {
    seed("o1");
    sendInvoice.mockResolvedValue({ link: "l", sms: { status: "failed", error: "Twilio down" }, email: { status: "skipped", error: "no_email" } });
    const res = await post("o1", { channel: "both" });
    expect(res.status).toBe(502);
    expect((await res.json()).sms.error).toBe("Twilio down");
  });
});
