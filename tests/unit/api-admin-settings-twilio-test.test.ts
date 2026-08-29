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

function makeReq(body?: unknown) {
  return new Request("http://x/api/admin/settings/twilio-test", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

beforeEach(() => {
  getTwilioClientMock.mockReset().mockReturnValue({}); // a truthy client
  sendSmsMock.mockReset().mockResolvedValue({ sid: "SM1" });
  twilioSmsEnabledMock.mockReset().mockReturnValue(true);
});

describe("twilio test-send endpoint", () => {
  it("returns no_credentials when the client is null", async () => {
    getTwilioClientMock.mockReturnValue(null);
    const body = await (await POST(makeReq())).json();
    expect(body).toEqual({ ok: false, error: "no_credentials" });
    expect(sendSmsMock).not.toHaveBeenCalled();
  });

  it("returns sms_disabled when SMS is off", async () => {
    twilioSmsEnabledMock.mockReturnValue(false);
    const body = await (await POST(makeReq())).json();
    expect(body).toEqual({ ok: false, error: "sms_disabled" });
    expect(sendSmsMock).not.toHaveBeenCalled();
  });

  it("defaults to the owner mobile when no number is given", async () => {
    const body = await (await POST(makeReq({}))).json();
    expect(body).toEqual({ ok: true });
    expect(sendSmsMock).toHaveBeenCalledWith(SITE.mobile.e164, expect.any(String));
  });

  it("sends to a custom number when one is provided", async () => {
    const body = await (await POST(makeReq({ to: "7022716195" }))).json();
    expect(body).toEqual({ ok: true });
    expect(sendSmsMock).toHaveBeenCalledWith("7022716195", expect.any(String));
  });

  it("rejects a malformed custom number without sending", async () => {
    const body = await (await POST(makeReq({ to: "12" }))).json();
    expect(body).toEqual({ ok: false, error: "invalid_number" });
    expect(sendSmsMock).not.toHaveBeenCalled();
  });

  it("surfaces the twilio error verbatim on failure", async () => {
    sendSmsMock.mockRejectedValue(new Error("21610 unregistered"));
    const body = await (await POST(makeReq())).json();
    expect(body).toEqual({ ok: false, error: "21610 unregistered" });
  });

  it("catches a synchronous throw from getTwilioClient and reports it instead of crashing", async () => {
    getTwilioClientMock.mockImplementation(() => {
      throw new Error("accountSid must start with AC");
    });
    const body = await (await POST(makeReq())).json();
    expect(body).toEqual({ ok: false, error: "accountSid must start with AC" });
  });
});
