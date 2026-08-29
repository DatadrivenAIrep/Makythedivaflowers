import { describe, it, expect, beforeEach, vi } from "vitest";

const validateRequestMock = vi.fn();
vi.mock("twilio", () => ({
  default: { validateRequest: (...a: unknown[]) => validateRequestMock(...a) },
}));

vi.mock("@/lib/twilio-config", () => ({ twilioAuthToken: () => "test_token" }));

const getByPhoneUSMock = vi.fn();
const updateCustomerMock = vi.fn();
const removeTagMock = vi.fn();
vi.mock("@/lib/customer-storage", () => ({
  getByPhoneUS: (...a: unknown[]) => getByPhoneUSMock(...a),
  updateCustomer: (...a: unknown[]) => updateCustomerMock(...a),
  removeTag: (...a: unknown[]) => removeTagMock(...a),
}));

import { POST } from "@/app/api/twilio/inbound/route";

function makeReq(params: Record<string, string>, signature = "sig") {
  const body = new URLSearchParams(params).toString();
  return new Request("https://makythedivaflowers.com/api/twilio/inbound", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "x-twilio-signature": signature,
      host: "makythedivaflowers.com",
      "x-forwarded-proto": "https",
    },
    body,
  });
}

beforeEach(() => {
  validateRequestMock.mockReset().mockReturnValue(true);
  getByPhoneUSMock.mockReset().mockReturnValue({ id: "cus_1", messagingChannel: "sms" });
  updateCustomerMock.mockReset();
  removeTagMock.mockReset();
});

describe("POST /api/twilio/inbound", () => {
  it("STOP opts the customer out and drops the marketing tag", async () => {
    const res = await POST(makeReq({ From: "+15168512815", Body: "STOP" }));
    expect(res.status).toBe(200);
    expect(updateCustomerMock).toHaveBeenCalledWith("cus_1", { messagingChannel: "none" });
    expect(removeTagMock).toHaveBeenCalledWith("cus_1", "sms-marketing");
    expect(await res.text()).toContain("<Response>");
  });

  it("START re-enables the channel for an opted-out customer, no marketing re-tag", async () => {
    getByPhoneUSMock.mockReturnValue({ id: "cus_1", messagingChannel: "none" });
    await POST(makeReq({ From: "+15168512815", Body: "start" }));
    expect(updateCustomerMock).toHaveBeenCalledWith("cus_1", { messagingChannel: "sms" });
    expect(removeTagMock).not.toHaveBeenCalled();
  });

  it("an unrelated reply changes nothing", async () => {
    await POST(makeReq({ From: "+15168512815", Body: "thank you!" }));
    expect(updateCustomerMock).not.toHaveBeenCalled();
    expect(removeTagMock).not.toHaveBeenCalled();
  });

  it("rejects a bad signature with 403 and no state change", async () => {
    validateRequestMock.mockReturnValue(false);
    const res = await POST(makeReq({ From: "+15168512815", Body: "STOP" }));
    expect(res.status).toBe(403);
    expect(updateCustomerMock).not.toHaveBeenCalled();
  });

  it("an unknown From (no customer) still returns 200 and does not throw", async () => {
    getByPhoneUSMock.mockReturnValue(null);
    const res = await POST(makeReq({ From: "+19995550000", Body: "STOP" }));
    expect(res.status).toBe(200);
    expect(updateCustomerMock).not.toHaveBeenCalled();
  });
});
