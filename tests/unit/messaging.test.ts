import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { sendMessage } from "@/lib/messaging";
import { recentMessagesForOrder } from "@/lib/message-storage";
import { closeDb } from "@/lib/db";

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("TWILIO_DRY_RUN", "true");
  vi.stubEnv("TWILIO_SMS_ENABLED", "true");
  vi.stubEnv("TWILIO_WHATSAPP_ENABLED", "true");
  vi.stubEnv("TWILIO_TEMPLATE_ORDER_RECEIVED_EN", "HXtest");
});
afterEach(() => {
  closeDb();
  vi.unstubAllEnvs();
});

const baseReq = {
  orderId: "do_test",
  channel: "sms" as const,
  locale: "en" as const,
  template: "order_received" as const,
  vars: {
    recipient_name: "Lola",
    total: "$205.51",
    window: "Sat May 17 · afternoon (12–4 pm)",
    shop_phone: "(516) 484-3456",
  },
  to: { phone: "+15165550100" },
};

describe("sendMessage", () => {
  it("logs a sent row in dry-run mode for sms", async () => {
    const res = await sendMessage(baseReq);
    expect(res.status).toBe("sent");
    const rows = recentMessagesForOrder("do_test", 10);
    expect(rows.length).toBe(1);
    expect(rows[0].status).toBe("sent");
    expect(rows[0].providerSid).toMatch(/^dry_run_/);
  });

  it("skips sms when TWILIO_SMS_ENABLED is not true", async () => {
    vi.stubEnv("TWILIO_SMS_ENABLED", "false");
    const res = await sendMessage(baseReq);
    expect(res.status).toBe("skipped");
    const rows = recentMessagesForOrder("do_test", 10);
    expect(rows[0].status).toBe("skipped");
  });

  it("skips whatsapp when template SID is missing for that locale", async () => {
    const res = await sendMessage({
      ...baseReq,
      channel: "whatsapp",
      locale: "es",
    });
    expect(res.status).toBe("skipped");
    expect(res.error).toBe("missing_whatsapp_template");
  });

  it("skips email with use_existing_email_pipeline reason", async () => {
    const res = await sendMessage({
      ...baseReq,
      channel: "email",
      to: { email: "a@b.com" },
    });
    expect(res.status).toBe("skipped");
    expect(res.error).toBe("use_existing_email_pipeline");
  });
});
