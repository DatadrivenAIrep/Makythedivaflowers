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
import { resolveCartLines } from "@/lib/cart-helpers";
import { formatMoneyCents, formatPhoneUS, formatDeliveryWindow } from "@/lib/format";
import { getPrintStyles, getCardBgDataUri, getLogoDataUri } from "@/lib/print-styles";

type Locale = "en" | "es";

const T = {
  en: {
    eyebrow: "Maky · The Diva Flowers",
    order: "Order",
    paid: "Paid",
    deliveryWindow: "Delivery window",
    total: "Total",
    deliverTo: "Deliver to",
    pickUp: "Pick up at shop",
    items: "Items",
    buyer: "Buyer",
    cardMessage: "Card message",
    subtotalRow: "Subt · Ship · Tax",
  },
  es: {
    eyebrow: "Maky · The Diva Flowers",
    order: "Orden",
    paid: "Pagada",
    deliveryWindow: "Ventana de entrega",
    total: "Total",
    deliverTo: "Entrega",
    pickUp: "Recoger en tienda",
    items: "Productos",
    buyer: "Comprador",
    cardMessage: "Mensaje de tarjeta",
    subtotalRow: "Subt · Env · Tax",
  },
} as const;

function Worksheet({ order }: { order: Order }) {
  const locale: Locale = order.locale;
  const t = T[locale];
  const m = (cents: number) => formatMoneyCents(cents, locale);
  const resolved = resolveCartLines(order.lines, PRODUCTS);

  return (
    <section className="worksheet">
      {/* Col 1 — meta + window */}
      <div className="ws-col meta">
        <div>
          <div className="ws-brand">{t.eyebrow}</div>
          <h1 className="ws-title">{t.order} #{order.id}</h1>
          <div className="ws-paid">
            <strong>{t.paid}:</strong> {order.createdAt}<br />
            {order.stripePaymentIntentId ? <span style={{ opacity: 0.7 }}>Stripe {order.stripePaymentIntentId}</span> : null}
          </div>
        </div>
        <div className="ws-window">
          <div className="lbl">{t.deliveryWindow}</div>
          <div className="val-time">{formatDeliveryWindow(order.delivery.window, locale)}</div>
          <div className="total-row">
            <span className="lbl">{t.total}</span>
            <span className="val">{m(order.totals.totalCents)}</span>
          </div>
        </div>
      </div>

      {/* Col 2 — recipient + message */}
      <div className="ws-col">
        {order.delivery.method === "delivery" ? (
          <div className="ws-section accent">
            <span className="pill">{t.deliverTo}</span>
            <p><strong>{order.delivery.recipient.name}</strong></p>
            <p>{formatPhoneUS(order.delivery.recipient.phone)}</p>
            <p>
              {order.delivery.address.street1}
              {order.delivery.address.street2 ? `, ${order.delivery.address.street2}` : ""}
            </p>
            <p>{order.delivery.address.city}, {order.delivery.address.state} {order.delivery.address.zip}</p>
          </div>
        ) : (
          <div className="ws-section accent">
            <span className="pill">{t.pickUp}</span>
            <p><strong>{SITE.brand}</strong></p>
            <p>{SITE.address.line1}</p>
            <p>{SITE.address.locality}, {SITE.address.region} {SITE.address.postal}</p>
            <p>{order.delivery.recipient.name} · {formatPhoneUS(order.delivery.recipient.phone)}</p>
          </div>
        )}
        {order.delivery.cardMessage?.trim() ? (
          <div className="ws-section">
            <div className="ws-section-label">{t.cardMessage}</div>
            <p className="ws-msg-quote">"{order.delivery.cardMessage.trim()}"</p>
          </div>
        ) : null}
      </div>

      {/* Col 3 — items + buyer */}
      <div className="ws-col">
        <div className="ws-section-label">{t.items}</div>
        <div className="ws-items">
          <table>
            <tbody>
              {resolved.map((r) => (
                <tr key={`${r.line.productId}-${r.line.variantId}`}>
                  <td className="qty">{r.line.qty}×</td>
                  <td>
                    {r.product.title[locale]} <span style={{ color: "var(--mute-600)" }}>— {r.variant.label[locale]}</span>
                    {r.addOns.length > 0 ? (
                      <div className="addon">+ {r.addOns.map((a) => a.label[locale]).join(", ")}</div>
                    ) : null}
                  </td>
                  <td className="price">{m(r.lineTotalCents)}</td>
                </tr>
              ))}
              <tr className="subtotal">
                <td></td>
                <td>{t.subtotalRow}</td>
                <td className="price">
                  {m(order.totals.subtotalCents)} · {m(order.totals.deliveryCents)} · {m(order.totals.taxCents)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="ws-buyer">
          <strong>{t.buyer}</strong><br />
          {order.contact.email}<br />
          {formatPhoneUS(order.contact.phone)}
        </div>
      </div>
    </section>
  );
}


function BrandCoverPanel() {
  return (
    <div className="card-panel brand-cover">
      <div className="card-brand">
        <div className="name">maky</div>
        <div className="tag">the diva flowers</div>
      </div>
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

function CardRow({ message, logoUri }: { message: string | undefined; logoUri: string }) {
  return (
    <section className="card-row">
      <div className="fold-v f1" />
      <div className="fold-v f2" />
      <BrandCoverPanel />
      <InsideMessagePanel message={message} />
      <LogoPanel logoUri={logoUri} />
    </section>
  );
}

function Sheet({ order, logoUri }: { order: Order; logoUri: string }) {
  return (
    <div className="sheet">
      <div className="cut-h" />
      <Worksheet order={order} />
      <CardRow message={order.delivery.cardMessage} logoUri={logoUri} />
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
  return htmlDocument(renderToStaticMarkup(<Sheet order={order} logoUri={logoUri} />), order.locale);
}
