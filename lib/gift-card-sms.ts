import "server-only";
import { SITE } from "@/data/site";
import { sendMessage, type SendMessageResult } from "@/lib/messaging";
import { getByPhoneUS } from "@/lib/customer-storage";
import type { GiftCard } from "@/types/gift-card";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://makythedivaflowers.com";

function amount(cents: number): string {
  return cents % 100 === 0 ? `$${cents / 100}` : `$${(cents / 100).toFixed(2)}`;
}

/**
 * Text the gift card to its recipient, alongside the email.
 *
 * Goes through sendMessage so the SMS lands in the messages log (and the
 * /admin/messages inbox) like every other text; the card id stands in for the
 * order id since a gift card has no order. A recipient who already replied STOP
 * to the shop is skipped here — Twilio would refuse the send anyway.
 */
export async function notifyGiftCardSms(
  card: GiftCard,
  locale: "en" | "es" = "en",
): Promise<SendMessageResult | { status: "skipped"; error: string }> {
  if (!card.recipientPhone) return { status: "skipped", error: "no_phone" };
  // Callers run this right after the card is issued; an exception here must not
  // turn a successfully issued card into a 500, so failures come back as data.
  try {
    const known = getByPhoneUS(card.recipientPhone);
    if (known?.messagingChannel === "none") return { status: "skipped", error: "opted_out" };
    return await sendGiftSms(card, locale, known?.id);
  } catch (e) {
    console.error("[gift-card-sms] send failed", card.id, e);
    return { status: "skipped", error: "send_threw" };
  }
}

function sendGiftSms(card: GiftCard, locale: "en" | "es", customerId?: string): Promise<SendMessageResult> {
  return sendMessage({
    orderId: card.id,
    customerId,
    channel: "sms",
    locale,
    template: "gift_card_issued",
    vars: {
      buyer_name: "",
      recipient_name: card.recipientName ?? "",
      total: amount(card.initialCents),
      code: card.code,
      from_label: card.fromLabel,
      link: `${BASE_URL.replace(/^https?:\/\//, "")}/${locale}/shop`,
      shop_phone: SITE.phone.replace(/^\+1\s*/, ""),
    },
    to: { phone: card.recipientPhone! },
  });
}
