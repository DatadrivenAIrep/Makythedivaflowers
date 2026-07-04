// tests/unit/inquiry-route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const saveInquiryMock = vi.fn().mockResolvedValue(undefined);
const notifyInquiryMock = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/inquiry-storage", () => ({ saveInquiry: saveInquiryMock }));
vi.mock("@/lib/notify-inquiry", () => ({ notifyInquiry: notifyInquiryMock }));
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: () => ({ ok: true }),
  ipFromRequest: () => "1.2.3.4",
}));

const { POST } = await import("@/app/api/inquiry/route");

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/inquiry", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

const validWedding = {
  type: "wedding",
  contact: { name: "Ana Ruiz", email: "ana@example.com", phone: "5551234567" },
  budgetBand: "open",
  vibe: "Garden-style ceremony arch with soft pastels.",
  locale: "en",
  honeypot: "",
};

describe("POST /api/inquiry", () => {
  beforeEach(() => {
    saveInquiryMock.mockClear();
    notifyInquiryMock.mockClear();
  });

  it("saves then notifies on a valid inquiry and returns ok", async () => {
    const res = await post(validWedding);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(saveInquiryMock).toHaveBeenCalledTimes(1);
    expect(notifyInquiryMock).toHaveBeenCalledTimes(1);
    const savedId = saveInquiryMock.mock.calls[0][0].id;
    const notifiedId = notifyInquiryMock.mock.calls[0][0].id;
    expect(notifiedId).toBe(savedId);
  });

  it("does not notify on an invalid inquiry", async () => {
    const res = await post({ type: "wedding", locale: "en" });
    expect(res.status).toBe(400);
    expect(notifyInquiryMock).not.toHaveBeenCalled();
  });
});
