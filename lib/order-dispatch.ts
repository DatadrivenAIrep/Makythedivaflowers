import "server-only";
import { sendMessage } from "@/lib/messaging";
import { getByPhone } from "@/lib/customer-storage";
import { hasRecentSuccess } from "@/lib/message-storage";
import { getSetting, SETTING_GOOGLE_REVIEW_URL } from "@/lib/settings-storage";
import { SITE } from "@/data/site";
import type { Order } from "@/types/order";

export function windowLabel(order: Order, locale: "en" | "es"): string {
  if (order.fulfillment.method === "in-store") {
    return locale === "es" ? "se lo lleva" : "in-store";
  }
  const w = order.fulfillment.window;
  const dt = new Date(`${w.date}T00:00:00`);
  const date = dt.toLocaleDateString(locale === "es" ? "es-MX" : "en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const slotEN: Record<string, string> = {
    morning: "morning (9–12)",
    midday: "midday (12–2)",
    afternoon: "afternoon (12–4)",
    evening: "evening (4–7)",
  };
  const slotES: Record<string, string> = {
    morning: "mañana (9–12)",
    midday: "mediodía (12–2)",
    afternoon: "tarde (12–4)",
    evening: "noche (4–7)",
  };
  const slot = (locale === "es" ? slotES : slotEN)[w.slot] ?? w.slot;
  return `${date} · ${slot}`;
}

function totalLabel(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function resolveLocale(customerLocale: "en" | "es" | undefined, orderLocale: "en" | "es"): "en" | "es" {
  return customerLocale ?? orderLocale;
}

function firstName(full: string): string {
  return full.trim().split(/\s+/)[0] || full;
}

/** The buyer (order.contact) is who paid and who every customer SMS is sent to.
 *  Web checkout lets the buyer leave their name blank, so fall back to the
 *  recipient's name — the only name we have — rather than greeting no one. */
function buyerFirstName(order: Order): string {
  const buyer = order.contact.name?.trim();
  return firstName(buyer && buyer.length ? buyer : order.fulfillment.recipient.name);
}

function shopPhoneFromSite(): string {
  // SITE structure depends on the data file; fall back to a literal if missing.
  const site = SITE as unknown as { phone?: string; contact?: { phone?: string } };
  return site.contact?.phone ?? site.phone ?? "(516) 484-3456";
}

export async function dispatchOrderReceived(order: Order, link?: string): Promise<void> {
  const customer = await getByPhone(order.contact.phone);
  const channel = customer?.messagingChannel ?? "sms";
  if (channel === "none") return;
  const locale = resolveLocale(customer?.locale, order.locale);
  const template = order.paymentStatus === "pending" && link ? "payment_link" : "order_received";

  await sendMessage({
    orderId: order.id,
    customerId: customer?.id,
    channel,
    locale,
    template,
    vars: {
      buyer_name: buyerFirstName(order),
      recipient_name: firstName(order.fulfillment.recipient.name),
      total: totalLabel(order.totals.totalCents),
      window: windowLabel(order, locale),
      link,
      shop_phone: shopPhoneFromSite(),
      order_number: order.orderNumber != null ? String(order.orderNumber) : undefined,
    },
    to: { phone: order.contact.phone, email: order.contact.email },
  });
}

/**
 * Fired when a shop advances an order to "out-for-delivery". Delivery orders get
 * the "on the way" SMS; PICKUP orders get "ready for pickup" (same trigger, since
 * there is no separate pickup-ready status); in-store orders get nothing. Always
 * to the BUYER (order.contact), greeting the buyer — not the flower recipient.
 */
export async function dispatchOutForDelivery(order: Order): Promise<void> {
  if (order.fulfillment.method === "in-store") return;
  const template = order.fulfillment.method === "pickup" ? "ready_for_pickup" : "out_for_delivery";
  if (hasRecentSuccess(order.id, template, 24)) return;
  const customer = await getByPhone(order.contact.phone);
  const channel = customer?.messagingChannel ?? "sms";
  if (channel === "none") return;
  const locale = resolveLocale(customer?.locale, order.locale);

  await sendMessage({
    orderId: order.id,
    customerId: customer?.id,
    channel,
    locale,
    template,
    vars: {
      buyer_name: buyerFirstName(order),
      recipient_name: firstName(order.fulfillment.recipient.name),
      total: totalLabel(order.totals.totalCents),
      window: windowLabel(order, locale),
      shop_phone: shopPhoneFromSite(),
    },
    to: { phone: order.contact.phone, email: order.contact.email },
  });
}

export async function dispatchDelivered(order: Order): Promise<void> {
  if (order.fulfillment.method !== "delivery") return;
  if (hasRecentSuccess(order.id, "delivered", 24)) return;
  const customer = await getByPhone(order.contact.phone);
  const channel = customer?.messagingChannel ?? "sms";
  if (channel === "none") return;
  const locale = resolveLocale(customer?.locale, order.locale);

  await sendMessage({
    orderId: order.id,
    customerId: customer?.id,
    channel,
    locale,
    template: "delivered",
    vars: {
      buyer_name: buyerFirstName(order),
      recipient_name: firstName(order.fulfillment.recipient.name),
      total: totalLabel(order.totals.totalCents),
      window: windowLabel(order, locale),
      shop_phone: shopPhoneFromSite(),
    },
    to: { phone: order.contact.phone, email: order.contact.email },
  });
}

export async function dispatchPaymentConfirmed(order: Order): Promise<void> {
  if (hasRecentSuccess(order.id, "payment_confirmed", 24)) return;
  const customer = await getByPhone(order.contact.phone);
  const channel = customer?.messagingChannel ?? "sms";
  if (channel === "none") return;
  const locale = resolveLocale(customer?.locale, order.locale);

  await sendMessage({
    orderId: order.id,
    customerId: customer?.id,
    channel,
    locale,
    template: "payment_confirmed",
    vars: {
      buyer_name: buyerFirstName(order),
      recipient_name: firstName(order.fulfillment.recipient.name),
      total: totalLabel(order.totals.totalCents),
      window: windowLabel(order, locale),
      shop_phone: shopPhoneFromSite(),
      order_number: order.orderNumber != null ? String(order.orderNumber) : undefined,
    },
    to: { phone: order.contact.phone, email: order.contact.email },
  });
}

export type ReviewRequestResult = { ok: boolean; reason?: string };

/**
 * Manually-triggered Google-review-request SMS (the shop picks which delivered/
 * picked-up orders to ask). Sends to the BUYER, needs the google_review_url setting
 * configured, honours consent, and dedupes so a double-click doesn't double-send.
 * Never throws — returns a reason the admin UI surfaces.
 */
export async function dispatchReviewRequest(order: Order): Promise<ReviewRequestResult> {
  // Server-side guard: only a completed (delivered / picked-up) order may be asked
  // for a review — the UI gates on this too, but a direct POST must not ask a
  // customer whose order hasn't arrived (or was canceled).
  if (order.status !== "delivered") return { ok: false, reason: "not_delivered" };
  const reviewUrl = getSetting(SETTING_GOOGLE_REVIEW_URL);
  if (!reviewUrl) return { ok: false, reason: "no_review_url" };
  if (hasRecentSuccess(order.id, "review_request", 24)) return { ok: false, reason: "already_sent" };
  const customer = await getByPhone(order.contact.phone);
  const channel = customer?.messagingChannel ?? "sms";
  if (channel === "none") return { ok: false, reason: "opted_out" };
  const locale = resolveLocale(customer?.locale, order.locale);

  const res = await sendMessage({
    orderId: order.id,
    customerId: customer?.id,
    channel,
    locale,
    template: "review_request",
    vars: {
      buyer_name: buyerFirstName(order),
      recipient_name: firstName(order.fulfillment.recipient.name),
      total: totalLabel(order.totals.totalCents),
      link: reviewUrl,
      shop_phone: shopPhoneFromSite(),
    },
    to: { phone: order.contact.phone, email: order.contact.email },
  });
  if (res.status === "sent") return { ok: true };
  return { ok: false, reason: res.error ?? res.status };
}
