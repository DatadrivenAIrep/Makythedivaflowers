// lib/print-render-html.tsx
import "server-only";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Order } from "@/types/order";
import { PRODUCTS } from "@/data/products";
import { SITE } from "@/data/site";
import { resolveCartLines } from "@/lib/cart-helpers";
import { formatMoneyCents, formatPhoneUS, formatDeliveryWindow } from "@/lib/format";
import { getPrintStyles, getCardBgDataUri } from "@/lib/print-styles";

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

// Exported for unit tests / sanity checks during build-up. Full Side A/B
// builders come in T9 — this temporary export is removed there.
export function __renderWorksheetHtml(order: Order): string {
  return renderToStaticMarkup(<Worksheet order={order} />);
}

function BackCoverPanel() {
  return (
    <div className="card-half back-cover">
      <div className="ornament">❀</div>
      <div className="small-mark">maky · diva flowers</div>
      <div className="small-mark" style={{ opacity: 0.7 }}>@makydivaflowers</div>
    </div>
  );
}

function FrontCoverPanel() {
  return (
    <div className="card-half front-cover">
      <div className="card-brand">
        <div className="name">maky</div>
        <div className="tag">the diva flowers</div>
      </div>
    </div>
  );
}

function CardRowSideA() {
  return (
    <section className="card-row">
      <div className="fold-marker top">↓ doblar ↓</div>
      <div className="fold-marker bottom">↑ doblar ↑</div>
      <div className="fold-v" />
      <BackCoverPanel />
      <FrontCoverPanel />
    </section>
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
    // Empty message: show only ornaments, no text block.
    return (
      <div className="card-half inside-msg">
        <div className="orn-top">❀</div>
        <div className="orn-bot">❀</div>
      </div>
    );
  }
  const cls = classifyMessageLength(trimmed);
  return (
    <div className="card-half inside-msg">
      <div className="orn-top">❀</div>
      <div className={`text ${cls}`}>"{trimmed}"</div>
      <div className="orn-bot">❀</div>
    </div>
  );
}

function InsideBlankPanel() {
  return <div className="card-half inside-blank" />;
}

function CardRowSideB({ message }: { message: string | undefined }) {
  return (
    <section className="card-row">
      <div className="fold-v" />
      <InsideMessagePanel message={message} />
      <InsideBlankPanel />
    </section>
  );
}
