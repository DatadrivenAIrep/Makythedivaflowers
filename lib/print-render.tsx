// lib/print-render.tsx
import "server-only";
import React from "react";
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import type { Order } from "@/types/order";
import { PRODUCTS } from "@/data/products";
import { SITE } from "@/data/site";
import { resolveCartLines } from "@/lib/cart-helpers";
import { formatMoneyCents, formatPhoneUS, formatDeliveryWindow } from "@/lib/format";

const COLORS = { ink: "#111", muted: "#666", line: "#cccccc" };

const styles = StyleSheet.create({
  page: { paddingTop: 36, paddingHorizontal: 36, paddingBottom: 0, fontSize: 10, color: COLORS.ink },
  ticket: { paddingBottom: 12 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  headerLeft: {},
  headerRight: { textAlign: "right" },
  big: { fontSize: 16, fontWeight: "bold" },
  meta: { fontSize: 8, color: COLORS.muted },
  block: { marginTop: 8, padding: 8, borderWidth: 1, borderColor: COLORS.line, borderRadius: 4 },
  blockTitle: { fontSize: 9, fontWeight: "bold", marginBottom: 4 },
  itemRow: { flexDirection: "row", justifyContent: "space-between" },
  addons: { color: COLORS.muted, marginLeft: 12, fontSize: 9 },
  cardMsg: { marginTop: 8, fontStyle: "italic" },
});

const T = {
  en: {
    paid: "Paid",
    total: "TOTAL",
    deliverTo: "DELIVER TO",
    pickUp: "PICK UP AT SHOP",
    items: "ITEMS",
    buyer: "BUYER",
    cardMessage: "CARD MESSAGE",
    window: "Window",
  },
  es: {
    paid: "Pagada",
    total: "TOTAL",
    deliverTo: "ENTREGAR A",
    pickUp: "RECOGER EN TIENDA",
    items: "PRODUCTOS",
    buyer: "COMPRADOR",
    cardMessage: "MENSAJE DE TARJETA",
    window: "Ventana",
  },
} as const;

function OrderTicket({ order }: { order: Order }) {
  const locale = order.locale;
  const t = T[locale];
  const m = (cents: number) => formatMoneyCents(cents, locale);
  const resolved = resolveCartLines(order.lines, PRODUCTS);

  return (
    <View style={styles.ticket}>
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Text style={styles.big}>ORDEN #{order.id}</Text>
          <Text style={styles.meta}>{t.paid}: {order.createdAt}</Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.big}>{t.total}: {m(order.totals.totalCents)}</Text>
          {order.stripePaymentIntentId ? (
            <Text style={styles.meta}>Stripe: {order.stripePaymentIntentId}</Text>
          ) : null}
        </View>
      </View>

      <View style={styles.block}>
        {order.delivery.method === "delivery" ? (
          <>
            <Text style={styles.blockTitle}>{t.deliverTo}</Text>
            <Text>{order.delivery.recipient.name} · {formatPhoneUS(order.delivery.recipient.phone)}</Text>
            <Text>
              {order.delivery.address.street1}
              {order.delivery.address.street2 ? `, ${order.delivery.address.street2}` : ""}
            </Text>
            <Text>
              {order.delivery.address.city}, {order.delivery.address.state} {order.delivery.address.zip}
            </Text>
            <Text>{t.window}: {formatDeliveryWindow(order.delivery.window, locale)}</Text>
          </>
        ) : (
          <>
            <Text style={styles.blockTitle}>{t.pickUp}</Text>
            <Text>{SITE.brand} · {SITE.address.line1}, {SITE.address.locality}, {SITE.address.region} {SITE.address.postal}</Text>
            <Text>{order.delivery.recipient.name} · {formatPhoneUS(order.delivery.recipient.phone)}</Text>
            <Text>{t.window}: {formatDeliveryWindow(order.delivery.window, locale)}</Text>
          </>
        )}
        {order.delivery.cardMessage?.trim() ? (
          <Text style={styles.cardMsg}>"{order.delivery.cardMessage.trim()}"</Text>
        ) : null}
      </View>

      <View style={styles.block}>
        <Text style={styles.blockTitle}>{t.items}</Text>
        {resolved.map((r, i) => (
          <View key={i}>
            <View style={styles.itemRow}>
              <Text>{r.line.qty}× {r.product.title[locale]} — {r.variant.label[locale]}</Text>
              <Text>{m(r.lineTotalCents)}</Text>
            </View>
            {r.addOns.length > 0 ? (
              <Text style={styles.addons}>+ {r.addOns.map((a) => a.label[locale]).join(", ")}</Text>
            ) : null}
          </View>
        ))}
      </View>

      <View style={styles.block}>
        <Text style={styles.blockTitle}>{t.buyer}</Text>
        <Text>{order.contact.email} · {formatPhoneUS(order.contact.phone)}</Text>
      </View>
    </View>
  );
}

export async function renderOrderPdf(order: Order): Promise<Buffer> {
  const element = (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <OrderTicket order={order} />
      </Page>
    </Document>
  );
  return renderToBuffer(element);
}
