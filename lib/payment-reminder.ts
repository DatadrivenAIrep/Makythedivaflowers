// lib/payment-reminder.ts
// "Recordar pago": text the buyer the remaining balance with a fresh Stripe
// link. Staff-triggered from "Por cobrar"; at most once per order per 24h,
// which is also how long each Stripe link lives.
import "server-only";
import { SITE } from "@/data/site";
import { sendMessage } from "@/lib/messaging";
import { getByPhoneUS } from "@/lib/customer-storage";
import { hasRecentSuccess } from "@/lib/message-storage";
import { createCheckoutSession } from "@/lib/stripe-payment-link";
import { orderBalanceCents } from "@/lib/order-balance";
import type { Order } from "@/types/order";

export type ReminderResult = { ok: true } | { ok: false; reason: string };

const REMIND_EVERY_HOURS = 24;

function no(reason: string): ReminderResult {
  return { ok: false, reason };
}

function firstName(full: string | undefined): string {
  return full?.trim().split(/\s+/)[0] ?? "";
}

export async function sendPaymentReminder(order: Order): Promise<ReminderResult> {
  if (order.houseAccountId) return no("on_account");
  const balance = orderBalanceCents(order);
  if (balance <= 0) return no("nothing_due");
  // The webhook only settles a checkout on an order that is not yet paid; a
  // link for an order already marked paid would collect money it never records.
  if (order.paymentStatus === "paid") return no("not_pending");
  const known = getByPhoneUS(order.contact.phone);
  if (known?.messagingChannel === "none") return no("opted_out");
  if (hasRecentSuccess(order.id, "payment_reminder", REMIND_EVERY_HOURS)) return no("already_sent");

  const locale = order.locale === "es" ? "es" : "en";
  let link: string;
  try {
    link = (await createCheckoutSession(order, locale)).url;
  } catch (e) {
    console.error(JSON.stringify({ event: "payment_reminder_link_failed", orderId: order.id, error: String(e) }));
    return no("link_failed");
  }

  const res = await sendMessage({
    orderId: order.id,
    customerId: known?.id,
    channel: "sms",
    locale,
    template: "payment_reminder",
    vars: {
      buyer_name: firstName(order.contact.name),
      recipient_name: firstName(order.fulfillment.recipient.name),
      total: `$${(balance / 100).toFixed(2)}`,
      ...(order.orderNumber != null ? { order_number: String(order.orderNumber) } : {}),
      link,
      shop_phone: SITE.phoneDisplay,
    },
    to: { phone: order.contact.phone },
  });
  return res.status === "sent" ? { ok: true } : no(res.error ?? res.status);
}
