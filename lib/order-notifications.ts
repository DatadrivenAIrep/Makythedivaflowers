// lib/order-notifications.ts
import "server-only";
import { Resend } from "resend";
import type { Order } from "@/types/order";
import { PRODUCTS } from "@/data/products";
import { SITE } from "@/data/site";
import { resolveCartLines } from "@/lib/cart-helpers";
import { formatMoneyCents, formatPhoneUS, formatDeliveryWindow } from "@/lib/format";

const COLORS = {
  ink: "#0E0D0C",
  inkSoft: "rgba(14, 13, 12, 0.72)",
  inkMute: "rgba(14, 13, 12, 0.55)",
  rouge: "#B8345E",
  bone: "#FAF6F0",
  rule: "rgba(14, 13, 12, 0.10)",
};

const FONT_STACKS = {
  display: `Georgia, "Times New Roman", "Iowan Old Style", serif`,
  body: `-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif`,
  mono: `"SF Mono", Menlo, Consolas, monospace`,
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

let resendClient: Resend | null = null;

function getResend(): Resend | null {
  if (resendClient) return resendClient;
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  resendClient = new Resend(key);
  return resendClient;
}

export function __buildBody(order: Order): string {
  const lines: string[] = [];
  const m = (cents: number) => formatMoneyCents(cents, "en");

  lines.push(`ORDER ${order.id} · paid ${order.createdAt}`);
  lines.push(
    `Total: ${m(order.totals.totalCents)} (subtotal ${m(order.totals.subtotalCents)} + delivery ${m(order.totals.deliveryCents)} + tax ${m(order.totals.taxCents)})`,
  );
  lines.push("");

  if (order.delivery.method === "pickup") {
    lines.push("PICK UP AT SHOP");
    lines.push(`${SITE.brand} · ${SITE.address.line1}, ${SITE.address.locality}, ${SITE.address.region} ${SITE.address.postal}`);
    lines.push(`${order.delivery.recipient.name} · ${formatPhoneUS(order.delivery.recipient.phone)}`);
    lines.push(formatDeliveryWindow(order.delivery.window, "en"));
  } else {
    lines.push("DELIVER TO");
    lines.push(`${order.delivery.recipient.name} · ${formatPhoneUS(order.delivery.recipient.phone)}`);
    const addr = order.delivery.address;
    lines.push(addr.street1 + (addr.street2 ? `, ${addr.street2}` : ""));
    lines.push(`${addr.city}, ${addr.state} ${addr.zip}`);
    lines.push(formatDeliveryWindow(order.delivery.window, "en"));
  }
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
  const text = __buildBody(order);
  const html = __buildHtml(order);

  try {
    const result = await resend.emails.send({ from, to, subject, text, html });
    if (result.error) {
      console.error("[order-notifications] resend returned error", result.error);
    }
  } catch (e) {
    console.error("[order-notifications] resend.emails.send threw", e);
  }
}

export function __buildHtml(order: Order): string {
  const m = (cents: number) => formatMoneyCents(cents, "en");
  const totalLabel = m(order.totals.totalCents);
  const createdAt = new Date(order.createdAt).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  const fulfillment =
    order.delivery.method === "pickup"
      ? {
          label: "Pick up at shop",
          accent: "#1F6E3D",
          rows: [
            `<strong>${escapeHtml(SITE.brand)}</strong>`,
            `${escapeHtml(SITE.address.line1)}<br/>${escapeHtml(SITE.address.locality)}, ${escapeHtml(SITE.address.region)} ${escapeHtml(SITE.address.postal)}`,
            `Picked up by <strong>${escapeHtml(order.delivery.recipient.name)}</strong> · ${escapeHtml(formatPhoneUS(order.delivery.recipient.phone))}`,
            `<strong>${escapeHtml(formatDeliveryWindow(order.delivery.window, "en"))}</strong>`,
          ],
        }
      : (() => {
          const addr = order.delivery.address;
          const addrLine = addr.street1 + (addr.street2 ? `, ${addr.street2}` : "");
          return {
            label: "Deliver to",
            accent: COLORS.rouge,
            rows: [
              `<strong>${escapeHtml(order.delivery.recipient.name)}</strong> · ${escapeHtml(formatPhoneUS(order.delivery.recipient.phone))}`,
              `${escapeHtml(addrLine)}<br/>${escapeHtml(addr.city)}, ${escapeHtml(addr.state)} ${escapeHtml(addr.zip)}`,
              `<strong>${escapeHtml(formatDeliveryWindow(order.delivery.window, "en"))}</strong>`,
            ],
          };
        })();

  const resolved = resolveCartLines(order.lines, PRODUCTS);
  const itemsHtml = resolved
    .map((r) => {
      const addOnsLine =
        r.addOns.length > 0
          ? `<div style="font-size:13px;color:${COLORS.inkMute};margin-top:4px;">+ ${escapeHtml(r.addOns.map((a) => a.label.en).join(", "))}</div>`
          : "";
      return `
        <tr>
          <td style="padding:14px 0;border-bottom:1px solid ${COLORS.rule};vertical-align:top;">
            <div style="font-size:15px;color:${COLORS.ink};line-height:1.4;">
              <strong>${r.line.qty}×</strong>&nbsp;${escapeHtml(r.product.title.en)}
              <span style="color:${COLORS.inkSoft};"> — ${escapeHtml(r.variant.label.en)}</span>
            </div>
            ${addOnsLine}
          </td>
          <td style="padding:14px 0;border-bottom:1px solid ${COLORS.rule};text-align:right;vertical-align:top;font-size:15px;color:${COLORS.ink};white-space:nowrap;">
            ${m(r.lineTotalCents)}
          </td>
        </tr>`;
    })
    .join("");

  const cardMessageHtml = order.delivery.cardMessage?.trim()
    ? `<div style="padding:18px 20px;background:${COLORS.bone};border-left:3px solid ${COLORS.rouge};font-style:italic;font-size:15px;color:${COLORS.ink};line-height:1.55;">${escapeHtml(order.delivery.cardMessage.trim())}</div>`
    : `<div style="font-size:14px;color:${COLORS.inkMute};font-style:italic;">No card message</div>`;

  const stripeBtn = order.stripePaymentIntentId
    ? `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 0 0;">
        <tr>
          <td style="background:${COLORS.ink};border-radius:24px;padding:0;">
            <a href="https://dashboard.stripe.com/payments/${escapeHtml(order.stripePaymentIntentId)}"
               style="display:inline-block;padding:11px 22px;color:#fff;text-decoration:none;font-family:${FONT_STACKS.body};font-size:13px;font-weight:600;letter-spacing:0.01em;">
              View payment in Stripe →
            </a>
          </td>
        </tr>
      </table>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<title>New order — ${escapeHtml(totalLabel)}</title>
</head>
<body style="margin:0;padding:0;background:#f3efe7;font-family:${FONT_STACKS.body};color:${COLORS.ink};">
  <div style="display:none;visibility:hidden;mso-hide:all;max-height:0;max-width:0;overflow:hidden;font-size:1px;line-height:1px;color:#f3efe7;">
    New order ${escapeHtml(order.id)} · ${escapeHtml(totalLabel)} · ${escapeHtml(fulfillment.label)}
  </div>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f3efe7;">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:580px;background:#ffffff;border-radius:8px;overflow:hidden;">
        <tr><td style="padding:28px 32px 0 32px;">
          <div style="font-family:${FONT_STACKS.mono};font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${COLORS.rouge};">
            Maky · ${escapeHtml(SITE.brand)}
          </div>
        </td></tr>
        <tr><td style="padding:8px 32px 4px 32px;">
          <h1 style="margin:0;font-family:${FONT_STACKS.display};font-size:30px;line-height:1.1;color:${COLORS.ink};font-weight:600;letter-spacing:-0.01em;">
            New order · ${escapeHtml(totalLabel)}
          </h1>
        </td></tr>
        <tr><td style="padding:0 32px 24px 32px;">
          <div style="font-family:${FONT_STACKS.mono};font-size:11px;color:${COLORS.inkMute};letter-spacing:0.04em;">
            ${escapeHtml(order.id)} · paid ${escapeHtml(createdAt)}
          </div>
        </td></tr>
        <tr><td style="padding:0 32px 24px 32px;">
          <div style="font-family:${FONT_STACKS.mono};font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${fulfillment.accent};margin-bottom:10px;">
            ${escapeHtml(fulfillment.label)}
          </div>
          <div style="font-size:15px;color:${COLORS.ink};line-height:1.55;">
            ${fulfillment.rows.join('<div style="height:6px;"></div>')}
          </div>
        </td></tr>
        <tr><td style="padding:0 32px 24px 32px;">
          <div style="font-family:${FONT_STACKS.mono};font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${COLORS.inkMute};margin-bottom:10px;">
            Card message
          </div>
          ${cardMessageHtml}
        </td></tr>
        <tr><td style="padding:0 32px 8px 32px;">
          <div style="font-family:${FONT_STACKS.mono};font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${COLORS.inkMute};margin-bottom:6px;">
            Items
          </div>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            ${itemsHtml}
          </table>
        </td></tr>
        <tr><td style="padding:8px 32px 24px 32px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              <td style="padding:6px 0;font-size:14px;color:${COLORS.inkSoft};">Subtotal</td>
              <td style="padding:6px 0;font-size:14px;color:${COLORS.ink};text-align:right;">${m(order.totals.subtotalCents)}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;font-size:14px;color:${COLORS.inkSoft};">Delivery</td>
              <td style="padding:6px 0;font-size:14px;color:${COLORS.ink};text-align:right;">${m(order.totals.deliveryCents)}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;font-size:14px;color:${COLORS.inkSoft};">Tax</td>
              <td style="padding:6px 0;font-size:14px;color:${COLORS.ink};text-align:right;">${m(order.totals.taxCents)}</td>
            </tr>
            <tr>
              <td style="padding:10px 0 0 0;border-top:1px solid ${COLORS.rule};font-size:15px;color:${COLORS.ink};font-weight:600;">Total</td>
              <td style="padding:10px 0 0 0;border-top:1px solid ${COLORS.rule};font-size:15px;color:${COLORS.ink};font-weight:600;text-align:right;">${m(order.totals.totalCents)}</td>
            </tr>
          </table>
        </td></tr>
        <tr><td style="padding:0 32px 24px 32px;">
          <div style="font-family:${FONT_STACKS.mono};font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${COLORS.inkMute};margin-bottom:6px;">
            Buyer contact
          </div>
          <div style="font-size:14px;color:${COLORS.ink};line-height:1.5;">
            <a href="mailto:${escapeHtml(order.contact.email)}" style="color:${COLORS.ink};text-decoration:none;">${escapeHtml(order.contact.email)}</a>
            &nbsp;·&nbsp;
            <a href="tel:${escapeHtml(order.contact.phone)}" style="color:${COLORS.ink};text-decoration:none;">${escapeHtml(formatPhoneUS(order.contact.phone))}</a>
          </div>
        </td></tr>
        ${order.stripePaymentIntentId ? `<tr><td style="padding:0 32px 32px 32px;">${stripeBtn}</td></tr>` : ""}
      </table>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:580px;">
        <tr><td style="padding:20px 16px;text-align:center;font-family:${FONT_STACKS.mono};font-size:11px;color:${COLORS.inkMute};letter-spacing:0.04em;">
          Automated order alert · ${escapeHtml(SITE.brand)} · ${escapeHtml(SITE.address.locality)}, ${escapeHtml(SITE.address.region)}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function notifyPrintFailed(orderId: string, error: string): Promise<void> {
  const resend = getResend();
  const to = process.env.ORDER_NOTIFICATIONS_TO;
  const from = process.env.ORDER_NOTIFICATIONS_FROM;
  if (!resend || !to || !from) {
    console.warn("[print-notifications] missing config; skipping print-failure email");
    return;
  }
  const subject = `[PRINT FAILED] order ${orderId}`;
  const text = `Print job for order ${orderId} failed.\n\nError: ${error}\n\nCheck the print agent logs in the shop or hit /api/print/health for queue state.`;
  try {
    const result = await resend.emails.send({ from, to, subject, text });
    if (result.error) {
      console.error("[print-notifications] resend returned error", result.error);
    }
  } catch (e) {
    console.error("[print-notifications] resend.emails.send threw", e);
  }
}
