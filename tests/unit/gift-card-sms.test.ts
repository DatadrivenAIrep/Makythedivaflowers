import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { recentMessagesForOrder } from "@/lib/message-storage";
import { renderSmsBody } from "@/lib/messaging-templates";
import { notifyGiftCardSms } from "@/lib/gift-card-sms";
import { issueGiftCard, getGiftCardById } from "@/lib/gift-card-storage";
import { upsertOnOrder, updateCustomer } from "@/lib/customer-storage";
import { issueGiftCardSchema } from "@/schemas/gift-card";
import { giftCardPurchaseSchema } from "@/schemas/gift-card-purchase";

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("TWILIO_DRY_RUN", "true");
  vi.stubEnv("TWILIO_SMS_ENABLED", "true");
  runMigrations();
});
afterEach(() => {
  closeDb();
  vi.unstubAllEnvs();
});

const vars = {
  buyer_name: "",
  recipient_name: "Joey",
  total: "$100",
  code: "DIVA-7K2M-9XQ4",
  from_label: "Ana",
  link: "makythedivaflowers.com/en/shop",
  shop_phone: "(516) 484-3456",
};

describe("gift_card_issued SMS template", () => {
  it("greets the recipient, names the sender and carries the code", () => {
    const body = renderSmsBody("gift_card_issued", "en", vars);
    expect(body).toBe(
      "Hi Joey! Ana sent you a $100 Diva Flowers gift card. Code: DIVA-7K2M-9XQ4. Use it at makythedivaflowers.com/en/shop or call (516) 484-3456. Reply STOP to opt out.",
    );
  });

  it("reads naturally without a sender or a name", () => {
    const body = renderSmsBody("gift_card_issued", "en", { ...vars, recipient_name: "", from_label: undefined });
    expect(body.startsWith("Hi! You received a $100 Diva Flowers gift card.")).toBe(true);
  });

  it("has a Spanish version with the STOP notice", () => {
    const body = renderSmsBody("gift_card_issued", "es", vars);
    expect(body).toContain("¡Hola Joey! Ana te regaló una gift card de Diva Flowers por $100.");
    expect(body).toContain("Código: DIVA-7K2M-9XQ4");
    expect(body).toContain("Responde STOP");
  });
});

describe("notifyGiftCardSms", () => {
  it("skips a card without a phone", async () => {
    const card = issueGiftCard({ initialCents: 10000, recipientEmail: "a@b.com" });
    expect(await notifyGiftCardSms(card)).toEqual({ status: "skipped", error: "no_phone" });
    expect(recentMessagesForOrder(card.id, 5)).toHaveLength(0);
  });

  it("texts the card and logs it under the card id", async () => {
    const card = issueGiftCard({
      initialCents: 10000,
      recipientEmail: "a@b.com",
      recipientName: "Joey",
      recipientPhone: "3475550123",
      fromLabel: "Ana",
    });
    expect(getGiftCardById(card.id)?.recipientPhone).toBe("3475550123");
    const res = await notifyGiftCardSms(card, "en");
    expect(res.status).toBe("sent");
    const [row] = recentMessagesForOrder(card.id, 5);
    expect(row.template).toBe("gift_card_issued");
    expect(row.toPhone).toBe("3475550123");
    expect(row.body).toContain(card.code);
    expect(row.body).toContain("$100");
  });

  it("does not text a number that replied STOP", async () => {
    const c = upsertOnOrder({ name: "Joey", phone: "3475550123", orderAt: new Date().toISOString() });
    updateCustomer(c.id, { messagingChannel: "none" });
    const card = issueGiftCard({ initialCents: 10000, recipientEmail: "a@b.com", recipientPhone: "3475550123" });
    expect(await notifyGiftCardSms(card)).toEqual({ status: "skipped", error: "opted_out" });
  });
});

describe("recipient phone validation", () => {
  const admin = { amountCents: 10000, recipientEmail: "a@b.com" };
  const shop = { ...admin, locale: "en", purchaserEmail: "p@b.com" };

  it("normalizes a formatted US number to 10 digits", () => {
    const r = issueGiftCardSchema.parse({ ...admin, recipientPhone: "+1 (347) 555-0199" });
    expect(r.recipientPhone).toBe("3475550199");
  });

  it("treats a blank phone as no phone", () => {
    expect(issueGiftCardSchema.parse({ ...admin, recipientPhone: "" }).recipientPhone).toBeUndefined();
    expect(giftCardPurchaseSchema.parse(shop).recipientPhone).toBeUndefined();
  });

  it("rejects a short number in both forms", () => {
    expect(issueGiftCardSchema.safeParse({ ...admin, recipientPhone: "555-0123" }).success).toBe(false);
    expect(giftCardPurchaseSchema.safeParse({ ...shop, recipientPhone: "555-0123" }).success).toBe(false);
  });
});
