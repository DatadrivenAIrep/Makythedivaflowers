import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const sendSms = vi.fn();
vi.mock("@/lib/twilio-server", () => ({
  sendSms: (...a: unknown[]) => sendSms(...a),
  sendWhatsApp: vi.fn(),
}));

import { sendMessage } from "@/lib/messaging";
import { closeDb } from "@/lib/db";

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("TWILIO_DRY_RUN", "false");
  vi.stubEnv("TWILIO_SMS_ENABLED", "true");
  sendSms.mockReset().mockResolvedValue({ sid: "SM1" });
});
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

const req = {
  orderId: "do_mms",
  channel: "sms" as const,
  locale: "en" as const,
  template: "order_received" as const,
  vars: { buyer_name: "Sofia", recipient_name: "Lola", total: "$1", window: "w", shop_phone: "(516) 484-3456" },
  to: { phone: "+15165550100" },
};

describe("sendMessage (live path)", () => {
  it("passes the mediaUrl through to sendSms", async () => {
    const res = await sendMessage({ ...req, mediaUrl: "https://makythedivaflowers.com/api/delivery-photo/abc" });
    expect(res.status).toBe("sent");
    expect(sendSms).toHaveBeenCalledWith(
      "+15165550100", expect.any(String), { mediaUrl: "https://makythedivaflowers.com/api/delivery-photo/abc" },
    );
  });

  it("without a mediaUrl sendSms gets no options", async () => {
    await sendMessage(req);
    expect(sendSms).toHaveBeenCalledWith("+15165550100", expect.any(String), undefined);
  });
});
