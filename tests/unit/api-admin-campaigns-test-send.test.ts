import { describe, it, expect, beforeEach, vi } from "vitest";

const getCampaignMock = vi.fn();
vi.mock("@/lib/campaign-storage", () => ({
  getCampaign: (...a: unknown[]) => getCampaignMock(...a),
}));

const renderCampaignBodyMock = vi.fn();
vi.mock("@/lib/campaign-sender", () => ({
  renderCampaignBody: (...a: unknown[]) => renderCampaignBodyMock(...a),
}));

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

import { POST } from "@/app/api/admin/campaigns/[id]/test/route";

const SAMPLE_CAMPAIGN = { id: "cmp_1", bodyEs: "Promo {nombre}", bodyEn: "", segment: "sms-marketing", status: "draft" };
const RENDERED = "¡Hola Ana! Promo Responde STOP para cancelar.";

function makeReq(body?: unknown) {
  return new Request("http://x/api/admin/campaigns/cmp_1/test", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function ctx(id = "cmp_1") {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  getCampaignMock.mockReset().mockReturnValue(SAMPLE_CAMPAIGN);
  renderCampaignBodyMock.mockReset().mockReturnValue(RENDERED);
  getTwilioClientMock.mockReset().mockReturnValue({}); // a truthy client
  sendSmsMock.mockReset().mockResolvedValue({ sid: "SM1" });
  twilioSmsEnabledMock.mockReset().mockReturnValue(true);
});

describe("POST /api/admin/campaigns/[id]/test", () => {
  it("404s when the campaign is missing", async () => {
    getCampaignMock.mockReturnValue(null);
    const res = await POST(makeReq(), ctx("nope"));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ ok: false, error: "not_found" });
    expect(sendSmsMock).not.toHaveBeenCalled();
  });

  it("returns no_credentials when the client is null (campaign exists)", async () => {
    getTwilioClientMock.mockReturnValue(null);
    const body = await (await POST(makeReq(), ctx())).json();
    expect(body).toEqual({ ok: false, error: "no_credentials" });
    expect(sendSmsMock).not.toHaveBeenCalled();
  });

  it("returns sms_disabled when SMS is off", async () => {
    twilioSmsEnabledMock.mockReturnValue(false);
    const body = await (await POST(makeReq(), ctx())).json();
    expect(body).toEqual({ ok: false, error: "sms_disabled" });
    expect(sendSmsMock).not.toHaveBeenCalled();
  });

  it("rejects a malformed custom number without sending", async () => {
    const body = await (await POST(makeReq({ to: "12" }), ctx())).json();
    expect(body).toEqual({ ok: false, error: "invalid_number" });
    expect(sendSmsMock).not.toHaveBeenCalled();
  });

  it("sends the rendered campaign body to a custom number", async () => {
    const body = await (await POST(makeReq({ to: "7022716195", locale: "es" }), ctx())).json();
    expect(body).toEqual({ ok: true });
    expect(renderCampaignBodyMock).toHaveBeenCalledWith(SAMPLE_CAMPAIGN, { name: "Ana", locale: "es" });
    expect(sendSmsMock).toHaveBeenCalledWith("7022716195", RENDERED);
  });
});
