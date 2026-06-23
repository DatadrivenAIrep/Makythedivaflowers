import "server-only";
import { Resend } from "resend";
import type { GiftCard } from "@/types/gift-card";

const COLORS = {
  ink: "#0E0D0C",
  bone: "#FAF6F0",
  rouge: "#B8345E",
  rougeDark: "#7d1f3d",
  rougeLight: "#d4677f",
};
const FONT_DISPLAY = `Georgia, "Times New Roman", serif`;
const FONT_BODY = `-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif`;
const FONT_MONO = `"SF Mono", Menlo, Consolas, monospace`;

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://makythedivaflowers.com";

let resendClient: Resend | null = null;
function getResend(): Resend | null {
  if (resendClient) return resendClient;
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  resendClient = new Resend(key);
  return resendClient;
}

function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatExpiry(iso: string | undefined, locale: "en" | "es"): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(locale === "es" ? "es-ES" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function __buildGiftCardBody(card: GiftCard, locale: "en" | "es"): string {
  const hi = card.recipientName
    ? locale === "es"
      ? `Hola ${card.recipientName},`
      : `Hi ${card.recipientName},`
    : locale === "es"
      ? "Hola,"
      : "Hi,";
  const lines = [
    hi,
    "",
    locale === "es"
      ? `Tienes una gift card de Diva Flowers por ${money(card.initialCents)}.`
      : `You have a Diva Flowers gift card for ${money(card.initialCents)}.`,
    "",
    card.personalMessage ? `"${card.personalMessage}"` : "",
    card.fromLabel ? `— ${card.fromLabel}` : "",
    "",
    locale === "es" ? `Tu código: ${card.code}` : `Your code: ${card.code}`,
    locale === "es"
      ? "Escríbelo en el checkout, en la web o en la tienda."
      : "Enter it at checkout, online or in store.",
    card.expiresAt
      ? locale === "es"
        ? `Válida hasta ${formatExpiry(card.expiresAt, locale)}.`
        : `Valid until ${formatExpiry(card.expiresAt, locale)}.`
      : "",
    "",
    `${BASE_URL}/${locale}`,
  ];
  return lines.filter((l) => l !== undefined).join("\n");
}

export function __buildGiftCardHtml(card: GiftCard, locale: "en" | "es"): string {
  const name = card.recipientName ? escapeHtml(card.recipientName) : "";
  const greeting =
    locale === "es"
      ? name
        ? `${name}, alguien pensó en ti`
        : "Alguien pensó en ti"
      : name
        ? `${name}, someone thought of you`
        : "Someone thought of you";
  const sub =
    locale === "es" ? "Tienes una gift card" : "You have a gift card";
  const codeLabel = locale === "es" ? "Tu código" : "Your code";
  const cta = locale === "es" ? "Canjear mi tarjeta →" : "Redeem my card →";
  const howto =
    locale === "es"
      ? "Escribe el código en el checkout, en la web o en la tienda."
      : "Enter the code at checkout, online or in store.";
  const validUntil = card.expiresAt
    ? (locale === "es" ? "Válida hasta " : "Valid until ") + formatExpiry(card.expiresAt, locale)
    : "";
  const message = card.personalMessage
    ? `<p style="font-style:italic;font-size:15px;color:${COLORS.ink};opacity:.82;margin:0 4px 16px;">"${escapeHtml(card.personalMessage)}"${card.fromLabel ? `<br><span style="opacity:.6;font-size:12px;">— ${escapeHtml(card.fromLabel)}</span>` : ""}</p>`
    : "";

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:${COLORS.bone};font-family:${FONT_BODY};">
  <div style="max-width:420px;margin:0 auto;background:${COLORS.bone};border-radius:13px;overflow:hidden;">
    <div style="background:linear-gradient(135deg,${COLORS.rougeDark} 0%,${COLORS.rouge} 60%,${COLORS.rougeLight} 100%);padding:30px 28px 26px;text-align:center;color:${COLORS.bone};font-family:${FONT_DISPLAY};">
      <div style="font-size:12px;letter-spacing:0.32em;text-transform:uppercase;opacity:.9;">maky · diva flowers</div>
      <div style="font-family:${FONT_BODY};font-size:11px;letter-spacing:0.16em;text-transform:uppercase;margin-top:18px;opacity:.85;">${escapeHtml(greeting)}</div>
      <div style="font-size:27px;line-height:1.15;margin:6px 0;">${sub}</div>
      <div style="font-size:52px;margin:6px 0 2px;">${money(card.initialCents)}</div>
      <div style="font-size:20px;margin-top:4px;">🌸</div>
    </div>
    <div style="padding:22px 28px 26px;text-align:center;">
      ${message}
      <div style="background:${COLORS.ink};border-radius:10px;padding:14px;">
        <div style="font-family:${FONT_BODY};font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:${COLORS.rougeLight};">${codeLabel}</div>
        <div style="font-family:${FONT_MONO};font-size:21px;font-weight:700;letter-spacing:0.1em;color:${COLORS.bone};margin-top:5px;">${card.code}</div>
      </div>
      <a href="${BASE_URL}/${locale}" style="display:inline-block;background:${COLORS.ink};color:${COLORS.bone};padding:13px 26px;border-radius:8px;font-family:${FONT_BODY};font-size:13px;font-weight:700;margin-top:16px;text-decoration:none;">${cta}</a>
      <div style="font-family:${FONT_BODY};font-size:11px;opacity:.55;margin-top:16px;line-height:1.5;">${howto}<br>${validUntil}</div>
    </div>
  </div>
</body></html>`;
}

export async function notifyGiftCardIssued(
  card: GiftCard,
  locale: "en" | "es" = "es",
): Promise<{ sent: boolean; error?: string }> {
  const resend = getResend();
  const from = process.env.ORDER_NOTIFICATIONS_FROM;
  if (!resend || !from) {
    console.warn(
      "[gift-card-notifications] missing config (RESEND_API_KEY / ORDER_NOTIFICATIONS_FROM); skipping email",
    );
    return { sent: false, error: "email_not_configured" };
  }
  const subject =
    locale === "es"
      ? `Tienes una gift card de Diva Flowers 💐`
      : `You have a Diva Flowers gift card 💐`;
  try {
    const result = await resend.emails.send({
      from,
      to: card.recipientEmail,
      subject,
      text: __buildGiftCardBody(card, locale),
      html: __buildGiftCardHtml(card, locale),
    });
    if (result.error) {
      console.error("[gift-card-notifications] resend error", result.error);
      return { sent: false, error: "send_failed" };
    }
    return { sent: true };
  } catch (e) {
    console.error("[gift-card-notifications] send threw", e);
    return { sent: false, error: "send_failed" };
  }
}
