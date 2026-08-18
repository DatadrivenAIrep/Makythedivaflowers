import { describe, it, expect, beforeEach, vi } from "vitest";

const getTwilioClientMock = vi.fn();
const sendSmsMock = vi.fn();
vi.mock("@/lib/twilio-server", () => ({
  getTwilioClient: () => getTwilioClientMock(),
  sendSms: (...a: unknown[]) => sendSmsMock(...a),
}));

const twilioSmsEnabledMock = vi.fn();
vi.mock("@/lib/twilio-config", () => ({
  twilioSmsEnabled: () => twilioSmsEnabledMock(),
}));

import { POST } from "@/app/api/admin/settings/twilio-test/route";
import { SITE } from "@/data/site";

beforeEach(() => {
  getTwilioClientMock.mockReset().mockReturnValue({}); // a truthy client
  sendSmsMock.mockReset().mockResolvedValue({ sid: "SM1" });
  twilioSmsEnabledMock.mockReset().mockReturnValue(true);
});

describe("twilio test-send endpoint", () => {
  it("returns no_credentials when the client is null", async () => {
    getTwilioClientMock.mockReturnValue(null);
    const body = await (await POST()).json();
    expect(body).toEqual({ ok: false, error: "no_credentials" });
    expect(sendSmsMock).not.toHaveBeenCalled();
  });

  it("returns sms_disabled when SMS is off", async () => {
    twilioSmsEnabledMock.mockReturnValue(false);
    const body = await (await POST()).json();
    expect(body).toEqual({ ok: false, error: "sms_disabled" });
    expect(sendSmsMock).not.toHaveBeenCalled();
  });

  it("sends to the owner mobile and returns ok on success", async () => {
    const body = await (await POST()).json();
    expect(body).toEqual({ ok: true });
    expect(sendSmsMock).toHaveBeenCalledWith(SITE.mobile.e164, expect.any(String));
  });

  it("surfaces the twilio error verbatim on failure", async () => {
    sendSmsMock.mockRejectedValue(new Error("21610 unregistered"));
    const body = await (await POST()).json();
    expect(body).toEqual({ ok: false, error: "21610 unregistered" });
  });
});
