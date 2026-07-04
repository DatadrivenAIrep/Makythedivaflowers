// tests/unit/notify-inquiry.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const sendMock = vi.fn();

vi.mock("resend", () => ({
  Resend: class {
    emails = { send: sendMock };
  },
}));

const ORIGINAL_ENV = { ...process.env };

async function importFresh() {
  vi.resetModules();
  return await import("@/lib/notify-inquiry");
}

const record = {
  id: "iq_test_1",
  type: "wedding" as const,
  payload: { contact: { name: "Ana", email: "ana@example.com", phone: "5551234567" } },
  createdAt: "2026-07-03T00:00:00.000Z",
  ip: "1.2.3.4",
  locale: "en" as const,
};

describe("notifyInquiry", () => {
  beforeEach(() => {
    sendMock.mockReset();
    sendMock.mockResolvedValue({ id: "email_1" });
  });
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("no-ops when RESEND_API_KEY or INQUIRY_NOTIFY_EMAIL is missing", async () => {
    delete process.env.RESEND_API_KEY;
    delete process.env.INQUIRY_NOTIFY_EMAIL;
    const { notifyInquiry } = await importFresh();
    await notifyInquiry(record);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("sends an email to the configured address when env is set", async () => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.INQUIRY_NOTIFY_EMAIL = "studio@divaflowers.com";
    const { notifyInquiry } = await importFresh();
    await notifyInquiry(record);
    expect(sendMock).toHaveBeenCalledTimes(1);
    const arg = sendMock.mock.calls[0][0];
    expect(arg.to).toBe("studio@divaflowers.com");
    expect(String(arg.subject)).toContain("wedding");
    expect(String(arg.subject)).toContain("ana@example.com");
  });

  it("never throws when Resend rejects", async () => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.INQUIRY_NOTIFY_EMAIL = "studio@divaflowers.com";
    sendMock.mockRejectedValue(new Error("resend down"));
    const { notifyInquiry } = await importFresh();
    await expect(notifyInquiry(record)).resolves.toBeUndefined();
  });
});
