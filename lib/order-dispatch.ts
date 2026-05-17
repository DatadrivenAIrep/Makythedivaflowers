import "server-only";
import { sendMessage } from "@/lib/messaging";
import { getByPhone } from "@/lib/customer-storage";
import { hasRecentSuccess } from "@/lib/message-storage";
import { SITE } from "@/data/site";
import type { Order } from "@/types/order";

function windowLabel(order: Order, locale: "en" | "es"): string {
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
      recipient_name: firstName(order.fulfillment.recipient.name),
      total: totalLabel(order.totals.totalCents),
      window: windowLabel(order, locale),
      link,
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
      recipient_name: firstName(order.fulfillment.recipient.name),
      total: totalLabel(order.totals.totalCents),
      window: windowLabel(order, locale),
      shop_phone: shopPhoneFromSite(),
    },
    to: { phone: order.contact.phone, email: order.contact.email },
  });
}
