import { describe, it, expect, beforeEach, vi } from "vitest";

const markSendingMock = vi.fn();
const recordSendMock = vi.fn();
const finalizeCampaignMock = vi.fn();
const getCampaignMock = vi.fn();
vi.mock("@/lib/campaign-storage", () => ({
  markSending: (...a: unknown[]) => markSendingMock(...a),
  recordSend: (...a: unknown[]) => recordSendMock(...a),
  finalizeCampaign: (...a: unknown[]) => finalizeCampaignMock(...a),
  getCampaign: (...a: unknown[]) => getCampaignMock(...a),
}));

const listMarketingRecipientsMock = vi.fn();
const getCustomerByIdMock = vi.fn();
const updateCustomerMock = vi.fn();
const removeTagMock = vi.fn();
vi.mock("@/lib/customer-storage", () => ({
  listMarketingRecipients: (...a: unknown[]) => listMarketingRecipientsMock(...a),
  getCustomerById: (...a: unknown[]) => getCustomerByIdMock(...a),
  updateCustomer: (...a: unknown[]) => updateCustomerMock(...a),
  removeTag: (...a: unknown[]) => removeTagMock(...a),
}));

const sendSmsMock = vi.fn();
vi.mock("@/lib/twilio-server", () => ({
  sendSms: (...a: unknown[]) => sendSmsMock(...a),
  e164: (p: string) => (p.startsWith("+") ? p : `+1${p}`),
}));

const twilioDryRunMock = vi.fn();
vi.mock("@/lib/twilio-config", () => ({ twilioDryRun: () => twilioDryRunMock() }));

import { renderCampaignBody, smsSegments, sendCampaign, OPT_OUT_FOOTER } from "@/lib/campaign-sender";
import type { Campaign } from "@/lib/campaign-storage";

const CAMPAIGN: Campaign = {
  id: "cmp_1", bodyEs: "¡Hola {nombre}! 20% hoy.", bodyEn: "Hi {nombre}! 20% today.",
  segment: "sms-marketing", status: "sending", recipientCount: 0, sentCount: 0, failedCount: 0,
  createdAt: "2026-08-29T00:00:00Z", sentAt: null,
};

beforeEach(() => {
  markSendingMock.mockReset().mockReturnValue(true);
  recordSendMock.mockReset();
  finalizeCampaignMock.mockReset();
  getCampaignMock.mockReset().mockReturnValue(CAMPAIGN);
  listMarketingRecipientsMock.mockReset();
  getCustomerByIdMock.mockReset();
  updateCustomerMock.mockReset();
  removeTagMock.mockReset();
  sendSmsMock.mockReset().mockResolvedValue({ sid: "SM1" });
  twilioDryRunMock.mockReset().mockReturnValue(false);
});

describe("renderCampaignBody", () => {
  it("uses EN body + first name for an English recipient", () => {
    const body = renderCampaignBody(CAMPAIGN, { name: "Bob Buyer", locale: "en" });
    expect(body).toContain("Hi Bob!");
    expect(body).toContain(OPT_OUT_FOOTER.en);
  });
  it("falls back to ES when body_en is empty", () => {
    const body = renderCampaignBody({ ...CAMPAIGN, bodyEn: "" }, { name: "Bob", locale: "en" });
    expect(body).toContain("¡Hola Bob!");
    expect(body).toContain(OPT_OUT_FOOTER.es);
  });
  it("drops the {nombre} token cleanly when there is no name", () => {
    const body = renderCampaignBody(CAMPAIGN, { name: "   ", locale: "es" });
    expect(body).not.toContain("{nombre}");
    expect(body).not.toContain("  "); // no double space left behind
  });
});

describe("smsSegments", () => {
  it("counts a short GSM-7 body as 1 segment", () => {
    expect(smsSegments("Hello there")).toBe(1);
  });
  it("treats accented Spanish as UCS-2 (70-char segments)", () => {
    expect(smsSegments("á".repeat(71))).toBe(2);
  });
  it("stays 1 segment at the GSM-7 160-char boundary, 2 just past it", () => {
    expect(smsSegments("x".repeat(160))).toBe(1);
    expect(smsSegments("x".repeat(161))).toBe(2);
  });
  it("stays 1 segment at the UCS-2 70-char boundary", () => {
    expect(smsSegments("á".repeat(70))).toBe(1);
  });
  it("counts an empty body as 1 segment", () => {
    expect(smsSegments("")).toBe(1);
  });
});

describe("sendCampaign", () => {
  it("sends to opted-in recipients and finalizes with counts", async () => {
    listMarketingRecipientsMock.mockReturnValue([
      { id: "cus_1", name: "Ana", phone: "5168512815", locale: "es", messagingChannel: "sms" },
    ]);
    getCustomerByIdMock.mockReturnValue({ id: "cus_1", messagingChannel: "sms" });
    const res = await sendCampaign("cmp_1");
    expect(sendSmsMock).toHaveBeenCalledTimes(1);
    expect(recordSendMock).toHaveBeenCalledWith(expect.objectContaining({ status: "sent", providerSid: "SM1" }));
    expect(finalizeCampaignMock).toHaveBeenCalledWith("cmp_1", { sent: 1, failed: 0 });
    expect(res).toEqual({ sent: 1, failed: 0, skipped: 0 });
  });

  it("is a no-op when the guard rejects (already sending/sent)", async () => {
    markSendingMock.mockReturnValue(false);
    const res = await sendCampaign("cmp_1");
    expect(sendSmsMock).not.toHaveBeenCalled();
    expect(res).toEqual({ sent: 0, failed: 0, skipped: 0 });
  });

  it("dry-run records dry_run and never calls Twilio", async () => {
    twilioDryRunMock.mockReturnValue(true);
    listMarketingRecipientsMock.mockReturnValue([
      { id: "cus_1", name: "Ana", phone: "5168512815", locale: "es", messagingChannel: "sms" },
    ]);
    getCustomerByIdMock.mockReturnValue({ id: "cus_1", messagingChannel: "sms" });
    const res = await sendCampaign("cmp_1");
    expect(sendSmsMock).not.toHaveBeenCalled();
    expect(recordSendMock).toHaveBeenCalledWith(expect.objectContaining({ status: "dry_run" }));
    // Dry sends must still count toward "sent" in the tally the owner sees.
    expect(res).toEqual({ sent: 1, failed: 0, skipped: 0 });
    expect(finalizeCampaignMock).toHaveBeenCalledWith("cmp_1", { sent: 1, failed: 0 });
  });

  it("skips a recipient who opted out between list-build and send", async () => {
    listMarketingRecipientsMock.mockReturnValue([
      { id: "cus_1", name: "Ana", phone: "5168512815", locale: "es", messagingChannel: "sms" },
    ]);
    getCustomerByIdMock.mockReturnValue({ id: "cus_1", messagingChannel: "none" });
    const res = await sendCampaign("cmp_1");
    expect(sendSmsMock).not.toHaveBeenCalled();
    expect(res.skipped).toBe(1);
  });

  it("treats Twilio 21610 as a skip and syncs the opt-out back", async () => {
    listMarketingRecipientsMock.mockReturnValue([
      { id: "cus_1", name: "Ana", phone: "5168512815", locale: "es", messagingChannel: "sms" },
    ]);
    getCustomerByIdMock.mockReturnValue({ id: "cus_1", messagingChannel: "sms" });
    sendSmsMock.mockRejectedValue(Object.assign(new Error("unsubscribed"), { code: 21610 }));
    const res = await sendCampaign("cmp_1");
    expect(res.skipped).toBe(1);
    expect(updateCustomerMock).toHaveBeenCalledWith("cus_1", { messagingChannel: "none" });
    expect(removeTagMock).toHaveBeenCalledWith("cus_1", "sms-marketing");
  });

  it("records a non-21610 error as failed without aborting the batch", async () => {
    listMarketingRecipientsMock.mockReturnValue([
      { id: "cus_1", name: "Ana", phone: "5168512815", locale: "es", messagingChannel: "sms" },
      { id: "cus_2", name: "Bob", phone: "5168512816", locale: "es", messagingChannel: "sms" },
    ]);
    getCustomerByIdMock.mockImplementation((id: string) => ({ id, messagingChannel: "sms" }));
    sendSmsMock
      .mockRejectedValueOnce(new Error("network_error"))
      .mockResolvedValueOnce({ sid: "SM2" });
    const res = await sendCampaign("cmp_1");
    expect(sendSmsMock).toHaveBeenCalledTimes(2); // second recipient still attempted
    expect(recordSendMock).toHaveBeenCalledWith(
      expect.objectContaining({ customerId: "cus_1", status: "failed", error: "network_error" }),
    );
    expect(recordSendMock).toHaveBeenCalledWith(
      expect.objectContaining({ customerId: "cus_2", status: "sent", providerSid: "SM2" }),
    );
    expect(updateCustomerMock).not.toHaveBeenCalled();
    expect(removeTagMock).not.toHaveBeenCalled();
    expect(finalizeCampaignMock).toHaveBeenCalledWith("cmp_1", { sent: 1, failed: 1 });
    expect(res).toEqual({ sent: 1, failed: 1, skipped: 0 });
  });
});
