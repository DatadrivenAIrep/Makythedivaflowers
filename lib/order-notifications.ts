// lib/order-notifications.ts
import "server-only";
import { Resend } from "resend";
import type { Order } from "@/types/order";
import { PRODUCTS } from "@/data/products";
import { resolveCartLines } from "@/lib/cart-helpers";
import { formatMoneyCents, formatPhoneUS, formatDeliveryWindow } from "@/lib/format";

let resendClient: Resend | null = null;

function getResend(): Resend | null {
  if (resendClient) return resendClient;
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  resendClient = new Resend(key);
  return resendClient;
}

function buildBody(order: Order): string {
  const lines: string[] = [];
  const m = (cents: number) => formatMoneyCents(cents, "en");

  lines.push(`ORDER ${order.id} · paid ${order.createdAt}`);
  lines.push(
    `Total: ${m(order.totals.totalCents)} (subtotal ${m(order.totals.subtotalCents)} + delivery ${m(order.totals.deliveryCents)} + tax ${m(order.totals.taxCents)})`,
  );
  lines.push("");

  lines.push("DELIVER TO");
  lines.push(`${order.delivery.recipient.name} · ${formatPhoneUS(order.delivery.recipient.phone)}`);
  const addr = order.delivery.address;
  lines.push(addr.street1 + (addr.street2 ? `, ${addr.street2}` : ""));
  lines.push(`${addr.city}, ${addr.state} ${addr.zip}`);
  lines.push(formatDeliveryWindow(order.delivery.window, "en"));
  lines.push("");

  lines.push("CARD MESSAGE");
  lines.push(order.delivery.cardMessage?.trim() ? `"${order.delivery.cardMessage.trim()}"` : "—");
  lines.push("");

  lines.push("ITEMS");
  const resolved = resolveCartLines(order.lines, PRODUCTS);
  for (const r of resolved) {
    const variantLabel = r.variant.label.en;
    const productTitle = r.product.title.en;
    lines.push(
      `${r.line.qty}× ${productTitle} — ${variantLabel} — ${m(r.lineTotalCents)}`,
    );
    if (r.addOns.length > 0) {
      const names = r.addOns.map((a) => a.label.en).join(", ");
      lines.push(`   Add-ons: ${names}`);
    }
  }
  lines.push("");

  lines.push("BUYER CONTACT");
  lines.push(`${order.contact.email} · ${formatPhoneUS(order.contact.phone)}`);

  if (order.stripePaymentIntentId) {
    lines.push("");
    lines.push(`Stripe: ${order.stripePaymentIntentId}`);
    lines.push(`https://dashboard.stripe.com/payments/${order.stripePaymentIntentId}`);
  }

  return lines.join("\n");
}

export async function notifyOrderPaid(order: Order): Promise<void> {
  const resend = getResend();
  const to = process.env.ORDER_NOTIFICATIONS_TO;
  const from = process.env.ORDER_NOTIFICATIONS_FROM;

  if (!resend || !to || !from) {
    console.warn(
      "[order-notifications] missing config (RESEND_API_KEY / ORDER_NOTIFICATIONS_TO / ORDER_NOTIFICATIONS_FROM); skipping email",
    );
    return;
  }

  const subject = `New order ${order.id} — ${formatMoneyCents(order.totals.totalCents, "en")}`;
  const text = buildBody(order);

  try {
    const result = await resend.emails.send({ from, to, subject, text });
    if (result.error) {
      console.error("[order-notifications] resend returned error", result.error);
    }
  } catch (e) {
    console.error("[order-notifications] resend.emails.send threw", e);
  }
}
