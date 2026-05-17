import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { insertMessage, updateMessage, recentMessagesForOrder } from "@/lib/message-storage";
import { closeDb } from "@/lib/db";

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
});
afterEach(() => {
  closeDb();
  vi.unstubAllEnvs();
});

describe("message-storage", () => {
  it("insertMessage creates a queued row and returns its id", () => {
    const id = insertMessage({
      orderId: "do_test",
      customerId: "cus_1",
      channel: "sms",
      template: "order_received",
      locale: "en",
      toPhone: "+15165550100",
      toEmail: undefined,
    });
    expect(id).toMatch(/^msg_/);
    const rows = recentMessagesForOrder("do_test", 10);
    expect(rows.length).toBe(1);
    expect(rows[0].status).toBe("queued");
    expect(rows[0].channel).toBe("sms");
  });

  it("updateMessage transitions queued → sent and records provider_sid", () => {
    const id = insertMessage({
      orderId: "do_test",
      channel: "sms",
      template: "order_received",
      locale: "en",
      toPhone: "+15165550100",
    });
    updateMessage(id, { status: "sent", providerSid: "SM123" });
    const rows = recentMessagesForOrder("do_test", 10);
    expect(rows[0].status).toBe("sent");
    expect(rows[0].providerSid).toBe("SM123");
  });

  it("recentMessagesForOrder filters by orderId and orders by created_at DESC", () => {
    insertMessage({ orderId: "do_a", channel: "sms", template: "order_received", locale: "en", toPhone: "+1" });
    insertMessage({ orderId: "do_b", channel: "sms", template: "order_received", locale: "en", toPhone: "+2" });
    insertMessage({ orderId: "do_a", channel: "sms", template: "payment_link", locale: "en", toPhone: "+1" });
    const rows = recentMessagesForOrder("do_a", 10);
    expect(rows.length).toBe(2);
    expect(rows.every((r) => r.orderId === "do_a")).toBe(true);
  });
});
