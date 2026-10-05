import "server-only";
import { Resend } from "resend";
import type { GiftCard } from "@/types/gift-card";
import { GIFT_CARD_PARTNERS } from "@/data/gift-card-partners";
import { getProductBySlug } from "@/data/products";

const COLORS = {
  ink: "#2A2320",
  inkSoft: "#8a7a6a",
  white: "#FFFFFF",
  rouge: "#B8345E",
  gold: "#B0894B",
  // Gift card email redesign: page/paper tones, the wine card face and its foil.
  sand: "#EFE7DB",
  paper: "#F8F3EC",
  strip: "#F1E6D6",
  inkMid: "#6E5F52",
  wine: "#8E2147",
  wineDeep: "#5E1530",
  cream: "#FBF4EA",
  goldLight: "#E8CB96",
};
// Single quotes only: these stacks go inside style="..." attributes, where a
// double quote would end the attribute and drop every declaration after it.
const FONT_DISPLAY = `Georgia, 'Times New Roman', serif`;
const FONT_MONO = `'SF Mono', Menlo, Consolas, monospace`;

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
  const partner = card.partner ? GIFT_CARD_PARTNERS[card.partner] : undefined;
  const lines = [
    ...(card.headline ? [card.headline, ""] : []),
    ...(partner
      ? [locale === "es" ? `En alianza con ${partner.name}` : `In partnership with ${partner.name}`, ""]
      : []),
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

// Arrangements suggested under "A few ideas to start". Same 3:4 photos so the
// row lines up; a slug later removed from the catalog just drops out.
const IDEA_SLUGS = ["ballet-slipper", "cotton-candy", "peaches-and-cream"] as const;

// Email clients ignore web fonts unevenly; Didot/Bodoni render on Apple Mail and
// everything else falls back to Georgia.
const FONT_LUXE = `Didot, 'Bodoni 72', Georgia, 'Times New Roman', serif`;
const SANS = `-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif`;

function validThru(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getFullYear()).slice(2)}`;
}

export function __buildGiftCardHtml(card: GiftCard, locale: "en" | "es"): string {
  const es = locale === "es";
  // Raw here: the <h1> escapes the headline once, whichever branch built it.
  const name = card.recipientName ?? "";
  const t = {
    preheader: es
      ? `Tienes una gift card de Diva Flowers por ${amountFace(card.initialCents)}. Elige tus flores, nosotros hacemos el resto.`
      : `A ${amountFace(card.initialCents)} Diva Flowers gift card is waiting for you. Choose your flowers, we'll do the rest.`,
    eyebrow: es ? "Un regalo para ti" : "A gift for you",
    headline: card.headline
      ? card.headline
      : es
        ? name
          ? `${name}, te regalaron flores`
          : "Te regalaron flores"
        : name
          ? `${name}, someone sent you flowers`
          : "Someone sent you flowers",
    sub: es
      ? "Escogidas, armadas a mano y entregadas en todo Long Island, cuando tú quieras."
      : "Hand-picked, hand-tied and delivered across Long Island, whenever you're ready.",
    gcLabel: es ? "Tarjeta de regalo" : "Gift card",
    uses: es ? "Flores &middot; Plantas &middot; Eventos" : "Flowers &middot; Plants &middot; Events",
    codeLabel: es ? "Código" : "Code",
    thruLabel: es ? "Vence" : "Valid thru",
    noteLabel: es ? "Una nota para ti" : "A note for you",
    cta: es ? "Elegir mis flores &rarr;" : "Choose my flowers &rarr;",
    howto: es
      ? "Escribe tu código al pagar: en la web, por teléfono o en la tienda."
      : "Enter your code at checkout: online, by phone or in our shop.",
    howTitle: es ? "Cómo usarla" : "How to use it",
    steps: es
      ? [
          ["Elige", "Ramos, orquídeas, plantas o algo hecho a tu medida."],
          ["Usa tu código", "Al pagar. El saldo que sobre queda en la tarjeta."],
          ["Disfruta", "Entrega el mismo día en Long Island, o recoge en tienda."],
        ]
      : [
          ["Choose", "Bouquets, orchids, plants or something custom."],
          ["Enter your code", "At checkout. Any balance stays on the card."],
          ["Enjoy", "Same-day delivery on Long Island, or pick up."],
        ],
    ideasTitle: es ? "Algunas ideas para empezar" : "A few ideas to start",
    ideasSub: es ? "Favoritos de nuestro estudio en Albertson" : "Favorites from our studio in Albertson",
    strip: es
      ? `<strong style="color:${COLORS.ink};">Pide antes de las 2 pm</strong> para entrega el mismo día &nbsp;&middot;&nbsp; ¿Preguntas? Llama al`
      : `<strong style="color:${COLORS.ink};">Order before 2 pm</strong> for same-day delivery &nbsp;&middot;&nbsp; Questions? Call`,
    validUntil: card.expiresAt
      ? (es ? "Válida hasta " : "Valid until ") + formatExpiry(card.expiresAt, locale)
      : "",
  };
  const home = `${BASE_URL}/${locale}`;
  const thru = validThru(card.expiresAt);

  const partner = card.partner ? GIFT_CARD_PARTNERS[card.partner] : undefined;
  const partnerBlock = partner
    ? `<tr><td align="center" style="padding:26px 44px 0;">
      <div style="font:600 10px ${SANS};letter-spacing:0.24em;text-transform:uppercase;color:${COLORS.inkSoft};">${es ? "En alianza con" : "In partnership with"}</div>
      <img src="${BASE_URL}${partner.logo}" alt="${escapeHtml(partner.name)}" width="${partner.width}" height="${partner.height}" style="display:block;margin:10px auto 0;width:${partner.width}px;max-width:70%;height:auto;border:0;" />
    </td></tr>`
    : "";

  const note = card.personalMessage
    ? `<tr><td class="px" style="padding:26px 44px 4px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLORS.white};border-radius:14px;border-top:3px solid ${COLORS.gold};box-shadow:0 4px 16px rgba(42,35,32,0.06);">
      <tr><td style="padding:22px 26px;">
        <div style="font:600 9.5px ${SANS};letter-spacing:0.3em;text-transform:uppercase;color:${COLORS.gold};">${t.noteLabel}</div>
        <p style="margin:12px 0 0;font-family:${FONT_DISPLAY};font-style:italic;font-size:19px;line-height:1.5;color:${COLORS.ink};">&ldquo;${escapeHtml(card.personalMessage)}&rdquo;</p>${
          card.fromLabel
            ? `\n        <div style="margin-top:10px;font:13px ${SANS};color:${COLORS.inkSoft};">— ${escapeHtml(card.fromLabel)}</div>`
            : ""
        }
      </td></tr>
    </table>
  </td></tr>`
    : card.fromLabel
      ? `<tr><td align="center" style="padding:22px 44px 0;font:13px ${SANS};color:${COLORS.inkSoft};">${es ? "De parte de" : "From"} ${escapeHtml(card.fromLabel)}</td></tr>`
      : "";

  const steps = t.steps
    .map(
      ([title, text], i) => `<td class="stack" width="33%" align="center" valign="top" style="padding:0 8px;">
        <div style="width:38px;height:38px;line-height:38px;border-radius:19px;border:1px solid ${COLORS.gold};margin:0 auto;font-family:${FONT_DISPLAY};font-size:17px;color:${COLORS.gold};">${i + 1}</div>
        <div style="margin-top:10px;font:700 13px ${SANS};color:${COLORS.ink};">${title}</div>
        <div style="margin-top:4px;font:12.5px/1.5 ${SANS};color:${COLORS.inkSoft};">${text}</div>
      </td>`,
    )
    .join("\n      ");

  const ideas = IDEA_SLUGS.map((slug) => getProductBySlug(slug))
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
    .map((p) => {
      const title = escapeHtml(p.title[locale]);
      return `<td width="33%" valign="top" style="padding:0 5px;">
        <a href="${home}/product/${p.slug}" style="text-decoration:none;">
          <img src="${BASE_URL}/products/${p.slug}.jpg" width="160" alt="${title}" style="display:block;width:100%;height:auto;border:0;border-radius:12px;" />
          <div style="margin-top:9px;text-align:center;font-family:${FONT_DISPLAY};font-size:14px;color:${COLORS.ink};">${title}</div>
        </a>
      </td>`;
    })
    .join("\n      ");
  const ideasBlock = ideas
    ? `<tr><td class="px" style="padding:34px 44px 4px;">
    <div style="text-align:center;font-family:${FONT_LUXE};font-size:22px;color:${COLORS.ink};">${t.ideasTitle}</div>
    <div style="text-align:center;margin:6px 0 20px;font:12.5px ${SANS};color:${COLORS.inkSoft};">${t.ideasSub}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      ${ideas}
    </tr></table>
  </td></tr>`
    : "";

  return `<!DOCTYPE html>
<html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light">
<style>
  @media (max-width: 520px) {
    .px { padding-left: 20px !important; padding-right: 20px !important; }
    .wrap { padding: 16px 6px 32px !important; }
    .amount { font-size: 54px !important; }
    .h1 { font-size: 26px !important; }
    .code { font-size: 16px !important; letter-spacing: 0.1em !important; }
    .cp { padding-left: 16px !important; padding-right: 16px !important; }
    .hide-sm { display: none !important; }
    .stack { display: block !important; width: 100% !important; padding: 0 0 18px !important; }
  }
</style></head>
<body style="margin:0;padding:0;background:${COLORS.sand};font-family:${SANS};color:${COLORS.ink};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${t.preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLORS.sand};">
<tr><td class="wrap" align="center" style="padding:24px 12px 40px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:${COLORS.paper};border-radius:20px;overflow:hidden;box-shadow:0 10px 40px rgba(42,35,32,0.10);">

  <!-- Branded header banner (logo + bouquet on cream) -->
  <tr><td style="padding:0;">
    <img src="${HEADER_SRC}" width="600" alt="Maky the Diva — Flowers &amp; Events" style="display:block;width:100%;max-width:600px;height:auto;border:0;" />
  </td></tr>

  ${partnerBlock}

  <!-- Greeting -->
  <tr><td class="px" align="center" style="padding:34px 44px 6px;">
    <div style="font:600 10.5px ${SANS};letter-spacing:0.32em;text-transform:uppercase;color:${COLORS.gold};">&#10022;&nbsp;&nbsp;${t.eyebrow}&nbsp;&nbsp;&#10022;</div>
    <h1 class="h1" style="margin:14px 0 10px;font-family:${FONT_LUXE};font-weight:normal;font-size:32px;line-height:1.15;color:${COLORS.ink};">${escapeHtml(t.headline)}</h1>
    <p style="margin:0;font:15px/1.6 ${FONT_DISPLAY};color:${COLORS.inkMid};">${t.sub}</p>
  </td></tr>

  <!-- The card -->
  <tr><td class="px" style="padding:30px 44px 8px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${COLORS.wine}" style="background:${COLORS.wine};background-image:linear-gradient(135deg,${COLORS.rouge} 0%,${COLORS.wine} 55%,${COLORS.wineDeep} 100%);border-radius:18px;box-shadow:0 14px 30px rgba(94,21,48,0.35);">
      <tr><td style="padding:10px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid rgba(232,203,150,0.55);border-radius:12px;">
          <tr>
            <td class="cp" style="padding:20px 22px 0;font-family:${FONT_LUXE};font-style:italic;font-size:19px;color:${COLORS.cream};">Maky the Diva</td>
            <td class="cp" align="right" style="padding:20px 22px 0;font:600 9.5px ${SANS};letter-spacing:0.3em;text-transform:uppercase;color:${COLORS.goldLight};">${t.gcLabel}</td>
          </tr>
          <tr><td colspan="2" align="center" style="padding:26px 22px 4px;">
            <div style="font-size:13px;letter-spacing:0.5em;color:${COLORS.goldLight};">&#10047; &#10022; &#10047;</div>
            <div class="amount" style="font-family:${FONT_LUXE};font-size:72px;line-height:1;color:${COLORS.cream};margin:10px 0 6px;">${amountFace(card.initialCents)}</div>
            <div style="font:600 9.5px ${SANS};letter-spacing:0.28em;text-transform:uppercase;color:${COLORS.goldLight};">${t.uses}</div>
          </td></tr>
          <tr>
            <td class="cp" style="padding:30px 22px 20px;vertical-align:bottom;">
              <div style="font:600 8.5px ${SANS};letter-spacing:0.28em;text-transform:uppercase;color:rgba(251,244,234,0.6);">${t.codeLabel}</div>
              <div class="code" style="font-family:${FONT_MONO};font-size:19px;font-weight:700;letter-spacing:0.16em;color:${COLORS.cream};margin-top:4px;">${card.code}</div>
            </td>${
              thru
                ? `
            <td class="hide-sm" align="right" style="padding:30px 22px 20px;vertical-align:bottom;">
              <div style="font:600 8.5px ${SANS};letter-spacing:0.28em;text-transform:uppercase;color:rgba(251,244,234,0.6);">${t.thruLabel}</div>
              <div style="font-family:${FONT_MONO};font-size:14px;font-weight:700;letter-spacing:0.1em;color:${COLORS.cream};margin-top:4px;">${thru}</div>
            </td>`
                : `<td></td>`
            }
          </tr>
        </table>
      </td></tr>
    </table>
  </td></tr>

  ${note}

  <!-- CTA -->
  <tr><td align="center" style="padding:30px 44px 6px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
      <td align="center" bgcolor="${COLORS.rouge}" style="border-radius:40px;">
        <a href="${home}/shop" style="display:inline-block;padding:16px 40px;font:700 14px ${SANS};letter-spacing:0.04em;color:${COLORS.cream};text-decoration:none;border-radius:40px;">${t.cta}</a>
      </td>
    </tr></table>
    <div style="margin-top:12px;font:12.5px ${SANS};color:${COLORS.inkSoft};">${t.howto}</div>
  </td></tr>

  <!-- Divider -->
  <tr><td align="center" style="padding:30px 44px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td style="border-top:1px solid rgba(176,137,75,0.35);font-size:0;line-height:0;">&nbsp;</td>
      <td width="70" align="center" style="font-size:13px;color:${COLORS.gold};white-space:nowrap;">&#10022; &#10047; &#10022;</td>
      <td style="border-top:1px solid rgba(176,137,75,0.35);font-size:0;line-height:0;">&nbsp;</td>
    </tr></table>
  </td></tr>

  <!-- How to use it -->
  <tr><td class="px" style="padding:26px 44px 4px;">
    <div style="text-align:center;font-family:${FONT_LUXE};font-size:22px;color:${COLORS.ink};margin-bottom:20px;">${t.howTitle}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      ${steps}
    </tr></table>
  </td></tr>

  ${ideasBlock}

  <!-- Info strip -->
  <tr><td class="px" style="padding:34px 44px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLORS.strip};border-radius:14px;"><tr>
      <td align="center" style="padding:16px 18px;font:12.5px/1.6 ${SANS};color:${COLORS.inkMid};">
        ${t.strip} <a href="tel:+15164843456" style="color:${COLORS.rouge};text-decoration:none;font-weight:700;white-space:nowrap;">(516) 484-3456</a>
      </td>
    </tr></table>
  </td></tr>

  <!-- Footer -->
  <tr><td align="center" style="padding:30px 44px 34px;">
    <div style="font-family:${FONT_LUXE};font-style:italic;font-size:20px;color:${COLORS.ink};">Maky the Diva</div>
    <div style="margin-top:2px;font:600 9px ${SANS};letter-spacing:0.32em;text-transform:uppercase;color:${COLORS.gold};">Flowers &amp; Events</div>
    <div style="margin-top:14px;font:11.5px/1.8 ${SANS};color:${COLORS.inkSoft};">
      1077 Willis Ave, Albertson, NY 11507<br>
      <a href="${home}" style="color:${COLORS.gold};text-decoration:none;">makythedivaflowers.com</a> &nbsp;&middot;&nbsp; @makythediva${
        t.validUntil ? `<br>\n      ${t.validUntil}` : ""
      }
    </div>
  </td></tr>

</table>
</td></tr>
</table>
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
