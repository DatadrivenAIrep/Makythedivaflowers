// lib/print-render-html.tsx
import "server-only";
import React from "react";

// Loaded dynamically to bypass Turbopack's "static `react-dom/server`
// import inside an App Router bundle" check. At runtime this resolves to
// the same module — the import just isn't visible to the build-time analyzer.
async function loadRenderToStaticMarkup() {
  const mod = await import("react-dom/server");
  return mod.renderToStaticMarkup;
}
import type { Order } from "@/types/order";
import { PRODUCTS } from "@/data/products";
import { SITE } from "@/data/site";
import { resolveCartLine } from "@/lib/cart-helpers";
import { formatMoneyCents, formatPhoneUS, formatDeliveryWindow } from "@/lib/format";
import { formatDateTime } from "@/lib/format-datetime";
import { orderBalanceCents } from "@/lib/order-balance";
import { getPrintStyles, getCardBgDataUri, getLogoDataUri, getProductImageDataUri, getQrWebsiteDataUri } from "@/lib/print-styles";

type Locale = "en" | "es";

const T = {
  en: {
    eyebrow: "Maky · The Diva Flowers",
    order: "Order",
    paid: "Paid",
    deliveryWindow: "Delivery window",
    deliveryTime: "Delivery time",
    total: "Total",
    deliverTo: "Deliver to",
    pickUp: "Pick up at shop",
    items: "Items",
    buyer: "Buyer",
    cardMessage: "Card message",
    internalNotes: "Internal notes",
    subtotal: "Subtotal",
    discount: "Discount",
    delivery: "Delivery",
    tax: "Tax",
    tip: "Tip",
    giftCard: "Gift card",
    paidAmount: "Paid",
    balanceDue: "Balance due",
    credit: "Credit",
    payment: "Payment",
    methods: {
      cash: "Cash", zelle: "Zelle", "card-terminal": "Card terminal",
      ach: "ACH", stripe: "Stripe", "gift-card": "Gift card",
    },
  },
  es: {
    eyebrow: "Maky · The Diva Flowers",
    order: "Orden",
    paid: "Pagada",
    deliveryWindow: "Ventana de entrega",
    deliveryTime: "Hora de entrega",
    total: "Total",
    deliverTo: "Entrega",
    pickUp: "Recoger en tienda",
    items: "Productos",
    buyer: "Comprador",
    cardMessage: "Mensaje de tarjeta",
    internalNotes: "Notas internas",
    subtotal: "Subtotal",
    discount: "Descuento",
    delivery: "Envío",
    tax: "Tax",
    tip: "Propina",
    giftCard: "Gift card",
    paidAmount: "Pagado",
    balanceDue: "Saldo pendiente",
    credit: "Saldo a favor",
    payment: "Pago",
    methods: {
      cash: "Efectivo", zelle: "Zelle", "card-terminal": "Terminal",
      ach: "ACH", stripe: "Stripe", "gift-card": "Gift card",
    },
  },
} as const;

/** The sheet is a fixed 11×8.5in with no room to spill, so a long order trades
 *  photo size — and past four lines, the photos themselves — for the money block
 *  and the buyer block staying on the page. Dropping the photo also keeps the
 *  inlined base64 out of the document rather than merely hiding it. */
type Density = "roomy" | "dense" | "no-photos";
function itemsDensity(lineCount: number): Density {
  if (lineCount >= 4) return "no-photos";
  if (lineCount >= 2) return "dense";
  return "roomy";
}

function Worksheet({ order }: { order: Order }) {
  const locale: Locale = order.locale;
  const t = T[locale];
  const m = (cents: number) => formatMoneyCents(cents, locale);
  const notes = order.internalNotes?.trim();
  const balanceCents = orderBalanceCents(order);
  const density = itemsDensity(order.lines.length);

  return (
    <section className="worksheet">
      {/* Col 1 — meta + delivery info + window */}
      <div className="ws-col meta">
        <div>
          <div className="ws-brand">{t.eyebrow}</div>
          <h1 className="ws-title">{t.order} #{order.orderNumber ?? order.id}</h1>
          <div className="ws-paid">
            <strong>{t.paid}:</strong> {formatDateTime(order.createdAt, locale)}<br />
            {order.stripePaymentIntentId ? <span style={{ opacity: 0.7 }}>Stripe {order.stripePaymentIntentId}</span> : null}
          </div>
        </div>
        {order.fulfillment.method === "delivery" ? (
          <div className="ws-section accent">
            <span className="pill">{t.deliverTo}</span>
            <p><strong>{order.fulfillment.recipient.name}</strong></p>
            <p>{formatPhoneUS(order.fulfillment.recipient.phone)}</p>
            <p>
              {order.fulfillment.address.street1}
              {order.fulfillment.address.street2 ? `, ${order.fulfillment.address.street2}` : ""}
            </p>
            <p>{order.fulfillment.address.city}, {order.fulfillment.address.state} {order.fulfillment.address.zip}</p>
          </div>
        ) : order.fulfillment.method === "pickup" ? (
          <div className="ws-section accent">
            <span className="pill">{t.pickUp}</span>
            <p><strong>{SITE.brand}</strong></p>
            <p>{SITE.address.line1}</p>
            <p>{SITE.address.locality}, {SITE.address.region} {SITE.address.postal}</p>
            <p>{order.fulfillment.recipient.name} · {formatPhoneUS(order.fulfillment.recipient.phone)}</p>
          </div>
        ) : (
          <div className="ws-section accent">
            <p><strong>{order.fulfillment.recipient.name}</strong></p>
            <p>{formatPhoneUS(order.fulfillment.recipient.phone)}</p>
          </div>
        )}
        {order.fulfillment.method !== "in-store" ? (
          <div className="ws-window">
            {/* An exact requested time is a commitment, a slot is a range —
                label them differently so the driver can tell them apart. */}
            <div className="lbl">{order.fulfillment.window.time ? t.deliveryTime : t.deliveryWindow}</div>
            <div className="val-time">{formatDeliveryWindow(order.fulfillment.window, locale)}</div>
          </div>
        ) : null}
      </div>

      {/* Col 2 — internal notes + card message */}
      <div className="ws-col">
        {notes ? (
          <div className="ws-section notes">
            <div className="ws-section-label">{t.internalNotes}</div>
            <p className="ws-notes-body">{notes}</p>
          </div>
        ) : null}
        {order.fulfillment.cardMessage?.trim() ? (
          <div className="ws-section">
            <div className="ws-section-label">{t.cardMessage}</div>
            <p className="ws-msg-quote">"{order.fulfillment.cardMessage.trim()}"</p>
          </div>
        ) : null}
      </div>

      {/* Col 3 — items + buyer */}
      <div className="ws-col">
        <div className="ws-section-label">{t.items}</div>
        <div className={`ws-items ${density}`}>
          <table>
            <tbody>
              {order.lines.map((line, i) => {
                // Custom (off-catalog) arrangements carry the designer's build
                // notes. resolveCartLine only handles catalog lines, so render
                // custom lines directly — otherwise they'd vanish from the sheet.
                if (line.kind === "custom") {
                  const note = line.designerNotes?.trim();
                  return (
                    <tr key={`custom-${i}`}>
                      <td className="qty">{line.qty}×</td>
                      <td>
                        {line.title}
                        {note ? <div className="ws-designer-note">✎ {note}</div> : null}
                      </td>
                      <td className="price">{m(line.priceCents * line.qty)}</td>
                    </tr>
                  );
                }
                const r = resolveCartLine(line, PRODUCTS);
                if (!r) return null;
                const thumb = density === "no-photos" ? null : getProductImageDataUri(r.product.images[0]?.src);
                return (
                  <tr key={`${line.productId}-${line.variantId}-${i}`}>
                    <td className="qty">{r.line.qty}×</td>
                    <td>
                      {thumb ? <img className="item-thumb" src={thumb} alt="" /> : null}
                      {r.product.title[locale]} <span style={{ color: "var(--mute-600)" }}>— {r.variant.label[locale]}</span>
                      {r.addOns.length > 0 ? (
                        <div className="addon">+ {r.addOns.map((a) => a.label[locale]).join(", ")}</div>
                      ) : null}
                    </td>
                    <td className="price">{m(r.lineTotalCents)}</td>
                  </tr>
                );
              })}
              <tr className="totline first">
                <td></td>
                <td>{t.subtotal}</td>
                <td className="price">{m(order.totals.subtotalCents)}</td>
              </tr>
              {order.totals.discountCents > 0 ? (
                <tr className="totline neg">
                  <td></td>
                  <td>{t.discount}{order.promoCode ? ` · ${order.promoCode}` : ""}</td>
                  <td className="price">−{m(order.totals.discountCents)}</td>
                </tr>
              ) : null}
              {order.fulfillment.method === "delivery" ? (
                <tr className="totline">
                  <td></td>
                  <td>{t.delivery}</td>
                  <td className="price">{m(order.totals.deliveryCents)}</td>
                </tr>
              ) : null}
              <tr className="totline">
                <td></td>
                <td>{t.tax}</td>
                <td className="price">{m(order.totals.taxCents)}</td>
              </tr>
              {order.totals.tipCents > 0 ? (
                <tr className="totline">
                  <td></td>
                  <td>{t.tip}</td>
                  <td className="price">{m(order.totals.tipCents)}</td>
                </tr>
              ) : null}
              <tr className="grand-total">
                <td></td>
                <td>{t.total}</td>
                <td className="price">{m(order.totals.totalCents)}</td>
              </tr>
              {/* Below the total: how the money actually came in. A gift card
                  is a payment, not a discount — the total never subtracts it. */}
              {order.giftCardCents && order.giftCardCents > 0 ? (
                <tr className="totline neg">
                  <td></td>
                  <td>{t.giftCard}</td>
                  <td className="price">−{m(order.giftCardCents)}</td>
                </tr>
              ) : null}
              {balanceCents !== 0 ? (
                <>
                  <tr className="totline">
                    <td></td>
                    <td>{t.paidAmount}</td>
                    <td className="price">{m(order.amountPaidCents ?? 0)}</td>
                  </tr>
                  <tr className="totline balance">
                    <td></td>
                    <td>{balanceCents > 0 ? t.balanceDue : t.credit}</td>
                    <td className="price">{m(Math.abs(balanceCents))}</td>
                  </tr>
                </>
              ) : null}
              {order.paymentMethod ? (
                <tr className="totline method">
                  <td></td>
                  <td>{t.payment}</td>
                  <td className="price">{t.methods[order.paymentMethod]}</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className="ws-buyer">
          <strong>{t.buyer}</strong><br />
          {order.contact.name ? <>{order.contact.name}<br /></> : null}
          {order.contact.email ? <>{order.contact.email}<br /></> : null}
          {formatPhoneUS(order.contact.phone)}
        </div>
      </div>
    </section>
  );
}


function CoverRecipient({ order }: { order: Order }) {
  const f = order.fulfillment;
  const phone = formatPhoneUS(f.recipient.phone);
  // The card is cut off the sheet and travels with the flowers, so it carries
  // the order number too — a stack of cards is otherwise unidentifiable.
  const head = (
    <div className="cr-head">
      <div className="cr-name">{f.recipient.name}</div>
      <div className="cr-order">#{order.orderNumber ?? order.id}</div>
    </div>
  );
  if (f.method === "delivery") {
    const a = f.address;
    return (
      <div className="cover-recipient">
        {head}
        <div className="cr-line">
          {a.street1}{a.street2 ? `, ${a.street2}` : ""}
        </div>
        <div className="cr-line">{a.city}, {a.state} {a.zip}</div>
        <div className="cr-line">{phone}</div>
      </div>
    );
  }
  // pickup / in-store: no delivery address — recipient name + phone only.
  return (
    <div className="cover-recipient">
      {head}
      <div className="cr-line">{phone}</div>
    </div>
  );
}

function BrandCoverPanel({ order, qrUri }: { order: Order; qrUri: string }) {
  return (
    <div className="card-panel brand-cover">
      <div className="qr-chip">
        <img className="qr-img" src={qrUri} alt="Escanea para visitar makythedivaflowers.com" />
      </div>
      <div className="card-brand">
        <div className="name">maky</div>
        <div className="tag">the diva flowers</div>
      </div>
      <CoverRecipient order={order} />
    </div>
  );
}

function classifyMessageLength(msg: string | undefined): "short" | "med" | "long" {
  const len = (msg ?? "").trim().length;
  if (len === 0) return "short"; // unused; empty branch handled by parent
  if (len <= 120) return "short";
  if (len <= 220) return "med";
  return "long";
}

function InsideMessagePanel({ message }: { message: string | undefined }) {
  const trimmed = message?.trim();
  if (!trimmed) {
    return (
      <div className="card-panel inside-msg">
        <div className="orn-top">❀</div>
        <div className="orn-bot">❀</div>
      </div>
    );
  }
  const cls = classifyMessageLength(trimmed);
  return (
    <div className="card-panel inside-msg">
      <div className="orn-top">❀</div>
      <div className={`text ${cls}`}>"{trimmed}"</div>
      <div className="orn-bot">❀</div>
    </div>
  );
}

function LogoPanel({ logoUri }: { logoUri: string }) {
  return (
    <div className="card-panel logo-panel">
      <div className="logo-frame">
        <img className="logo-img" src={logoUri} alt="Maky the Diva Flowers" />
      </div>
      <div className="socials">
        <div className="handle">@Makythediva</div>
        <div className="icons">
          <svg className="ic" viewBox="0 0 24 24" aria-label="Instagram">
            <rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="17.5" cy="6.5" r="1" fill="currentColor" />
          </svg>
          <svg className="ic" viewBox="0 0 24 24" aria-label="TikTok">
            <path
              d="M16.5 3h-2.6v12.4a2.5 2.5 0 1 1-2.5-2.5c.3 0 .5 0 .8.1V10.3a5.6 5.6 0 0 0-.8-.1 5.2 5.2 0 1 0 5.2 5.2V8.6a6.6 6.6 0 0 0 4 1.4V7.4a3.9 3.9 0 0 1-2.4-.9A3.9 3.9 0 0 1 16.5 3z"
              fill="currentColor"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}

function CardRow({ order, logoUri, qrUri }: { order: Order; logoUri: string; qrUri: string }) {
  // Card 1: brand cover + recipient + QR · Card 2: logo · Card 3: message.
  return (
    <section className="card-row">
      <BrandCoverPanel order={order} qrUri={qrUri} />
      <LogoPanel logoUri={logoUri} />
      <InsideMessagePanel message={order.fulfillment.cardMessage} />
    </section>
  );
}

function Sheet({ order, logoUri, qrUri }: { order: Order; logoUri: string; qrUri: string }) {
  return (
    <div className="sheet">
      <Worksheet order={order} />
      <CardRow order={order} logoUri={logoUri} qrUri={qrUri} />
    </div>
  );
}

function htmlDocument(body: string, locale: Locale): string {
  return `<!doctype html>
<html lang="${locale}">
<head>
<meta charset="utf-8">
<style>${getPrintStyles()}
:root { --card-bg: url(${getCardBgDataUri()}); }
@page { size: 11in 8.5in; margin: 0; }
</style>
</head>
<body>${body}</body>
</html>`;
}

export async function buildSheetHtml(order: Order): Promise<string> {
  const renderToStaticMarkup = await loadRenderToStaticMarkup();
  const logoUri = getLogoDataUri();
  const qrUri = getQrWebsiteDataUri();
  return htmlDocument(renderToStaticMarkup(<Sheet order={order} logoUri={logoUri} qrUri={qrUri} />), order.locale);
}
