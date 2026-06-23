import "server-only";
import { Resend } from "resend";
import type { GiftCard } from "@/types/gift-card";

const COLORS = {
  ink: "#2A2320",
  inkSoft: "#8a7a6a",
  ivory: "#F4EEE4",
  white: "#FFFFFF",
  rouge: "#B8345E",
  gold: "#B0894B",
};
const FONT_DISPLAY = `Georgia, "Times New Roman", serif`;
const FONT_BODY = `-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif`;
const FONT_MONO = `"SF Mono", Menlo, Consolas, monospace`;

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://makythedivaflowers.com";
// Brand "email marketing header" asset (logo + bouquet on cream) — full-width banner.
const HEADER_SRC = `${BASE_URL}/gift-card-email-header.jpg`;

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

// Whole-dollar amounts render without cents on the card face ("$150"); otherwise "$150.50".
function amountFace(cents: number): string {
  return cents % 100 === 0 ? `$${cents / 100}` : money(cents);
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
  const t = {
    eyebrow: locale === "es" ? "Un regalo para ti" : "A gift for you",
    headline:
      locale === "es"
        ? name
          ? `${name}, te regalaron flores`
          : "Te regalaron flores"
        : name
          ? `${name}, someone sent you flowers`
          : "Someone sent you flowers",
    gcLabel: locale === "es" ? "Tarjeta de regalo" : "Gift card",
    spendAt: locale === "es" ? "para gastar en Diva Flowers" : "to spend at Diva Flowers",
    codeLabel: locale === "es" ? "Tu código" : "Your code",
    cta: locale === "es" ? "Canjear mi tarjeta →" : "Redeem my card →",
    howto:
      locale === "es"
        ? "Escribe el código en el checkout, en la web o en la tienda."
        : "Enter the code at checkout — online or in store.",
    validUntil: card.expiresAt
      ? (locale === "es" ? "Válida hasta " : "Valid until ") + formatExpiry(card.expiresAt, locale)
      : "",
  };

  const message = card.personalMessage
    ? `<p style="font-family:${FONT_DISPLAY};font-style:italic;font-size:16px;line-height:1.55;color:${COLORS.ink};margin:0 26px 4px;">&ldquo;${escapeHtml(card.personalMessage)}&rdquo;${
        card.fromLabel
          ? `<br><span style="font-family:${FONT_BODY};font-style:normal;font-size:11px;letter-spacing:0.04em;color:${COLORS.inkSoft};">— ${escapeHtml(card.fromLabel)}</span>`
          : ""
      }</p>`
    : "";

  return `<!DOCTYPE html>
<html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"></head>
<body style="margin:0;padding:0;background:${COLORS.ivory};font-family:${FONT_BODY};color:${COLORS.ink};">
  <div style="max-width:600px;margin:0 auto;background:${COLORS.ivory};">

    <!-- Branded header banner (logo + bouquet, integrated cream background) -->
    <img src="${HEADER_SRC}" alt="Maky the Diva — Flowers &amp; Events" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;" />

    <!-- Intro + denomination -->
    <div style="padding:28px 30px 6px;text-align:center;">
      <div style="font-size:11px;letter-spacing:0.24em;text-transform:uppercase;color:${COLORS.gold};">${t.eyebrow}</div>
      <h1 style="font-family:${FONT_DISPLAY};font-weight:normal;font-size:27px;line-height:1.18;margin:10px 0 4px;color:${COLORS.ink};">${escapeHtml(t.headline)}</h1>

      <div style="display:inline-block;border:1px solid rgba(176,137,75,0.5);border-radius:13px;padding:15px 34px;margin:16px 0 2px;">
        <div style="font-size:10px;letter-spacing:0.24em;text-transform:uppercase;color:${COLORS.gold};">${t.gcLabel}</div>
        <div style="font-family:${FONT_DISPLAY};font-size:52px;line-height:1;color:${COLORS.rouge};margin:6px 0 4px;">${amountFace(card.initialCents)}</div>
        <div style="font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:${COLORS.inkSoft};">${t.spendAt}</div>
      </div>
    </div>

    <!-- Botanical divider -->
    <div style="text-align:center;margin:18px 0 6px;color:${COLORS.gold};font-size:13px;letter-spacing:0.34em;">&#10022;&nbsp;&#10047;&nbsp;&#10022;</div>

    ${message}

    <!-- Code voucher -->
    <div style="border:1px dashed rgba(176,137,75,0.6);border-radius:12px;background:${COLORS.white};padding:15px;margin:18px 30px;text-align:center;">
      <div style="font-size:10px;letter-spacing:0.16em;text-transform:uppercase;color:${COLORS.gold};">${t.codeLabel}</div>
      <div style="font-family:${FONT_MONO};font-size:23px;font-weight:700;letter-spacing:0.14em;color:${COLORS.ink};margin-top:7px;">${card.code}</div>
    </div>

    <!-- CTA -->
    <div style="text-align:center;margin:4px 0 2px;">
      <a href="${BASE_URL}/${locale}" style="display:inline-block;background:${COLORS.rouge};color:#FBF7F1;text-decoration:none;padding:14px 34px;border-radius:32px;font-family:${FONT_BODY};font-size:13px;font-weight:700;letter-spacing:0.03em;">${t.cta}</a>
    </div>
    <div style="text-align:center;font-size:11.5px;color:${COLORS.inkSoft};margin:14px 30px 0;line-height:1.5;">${t.howto}</div>

    <!-- Footer -->
    <div style="border-top:1px solid rgba(42,35,32,0.12);margin:22px 30px 0;padding:16px 0 28px;text-align:center;font-size:10.5px;line-height:1.7;color:${COLORS.inkSoft};">
      ${t.validUntil ? `${t.validUntil}<br>` : ""}
      1077 Willis Ave, Albertson NY 11507 &middot; (516) 484-3456<br>
      <a href="${BASE_URL}/${locale}" style="color:${COLORS.gold};text-decoration:none;">makythedivaflowers.com</a> &middot; @makythediva
    </div>

  </div>
</body></html>`;
}

export async function notifyGiftCardIssued(
  card: GiftCard,
  locale: "en" | "es" = "en",
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
      : `You've received a Diva Flowers gift card 💐`;
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
