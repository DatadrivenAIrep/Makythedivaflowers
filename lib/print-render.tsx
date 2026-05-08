// lib/print-render.tsx
import "server-only";
import React from "react";
import { Document, Page, Text, View, StyleSheet, Image, renderToBuffer } from "@react-pdf/renderer";
import path from "node:path";
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
  headerRight: { textAlign: "right" },
  big: { fontSize: 16, fontWeight: "bold" },
  meta: { fontSize: 8, color: COLORS.muted },
  block: { marginTop: 8, padding: 8, borderWidth: 1, borderColor: COLORS.line, borderRadius: 4 },
  blockTitle: { fontSize: 9, fontWeight: "bold", marginBottom: 4 },
  itemRow: { flexDirection: "row", justifyContent: "space-between" },
  addons: { color: COLORS.muted, marginLeft: 12, fontSize: 9 },
  cardMsg: { marginTop: 8, fontStyle: "italic" },
});

const cardStyles = StyleSheet.create({
  cutLine: {
    marginTop: 10,
    marginBottom: 10,
    borderTopWidth: 1,
    borderTopStyle: "dashed",
    borderTopColor: COLORS.line,
  },
  cutLabel: { textAlign: "center", fontSize: 8, color: COLORS.muted, marginTop: -6, marginBottom: 6 },
  card: {
    height: 360, // ~5" of the bottom half on Letter at 72dpi
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 36,
  },
  cardBg: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, width: "100%", height: "100%" },
  cardLogo: { position: "absolute", top: 16, alignSelf: "center", height: 28 },
  cardMessage: { fontSize: 22, textAlign: "center", color: COLORS.ink },
  cardSig: { position: "absolute", bottom: 12, alignSelf: "center", fontSize: 9, color: COLORS.muted, fontStyle: "italic" },
});

const T = {
  en: {
    order: "ORDER",
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
    order: "ORDEN",
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
        <View>
          <Text style={styles.big}>{t.order} #{order.id}</Text>
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
          <>
            <Text style={styles.blockTitle}>{t.cardMessage}</Text>
            <Text style={styles.cardMsg}>"{order.delivery.cardMessage.trim()}"</Text>
          </>
        ) : null}
      </View>

      <View style={styles.block}>
        <Text style={styles.blockTitle}>{t.items}</Text>
        {resolved.map((r) => (
          <View key={`${r.line.productId}-${r.line.variantId}`}>
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

function DecorativeCard({ message }: { message: string | undefined }) {
  const trimmed = message?.trim();
  return (
    <>
      <View style={cardStyles.cutLine} />
      <Text style={cardStyles.cutLabel}>✂  recortar / cut here  ✂</Text>
      <View style={cardStyles.card}>
        <Image src={path.join(process.cwd(), "public/print/card-bg-default.png")} style={cardStyles.cardBg} />
        {trimmed ? <Text style={cardStyles.cardMessage}>{trimmed}</Text> : null}
        <Text style={cardStyles.cardSig}>— maky the diva flowers</Text>
      </View>
    </>
  );
}

export async function renderOrderPdf(order: Order): Promise<Buffer> {
  const element = (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <OrderTicket order={order} />
        <DecorativeCard message={order.delivery.cardMessage} />
      </Page>
    </Document>
  );
  return renderToBuffer(element);
}
