// lib/invoice.ts
// Pure data for the customer-facing order invoice (admin "Invoice" button).
// Everything comes from the stored order — totals are never recomputed — and
// staff-only fields (internal notes, taken-by, card message, designer notes)
// are deliberately never read.
import type { Order, PaymentMethod } from "@/types/order";
import type { Product } from "@/types/product";
import { PRODUCTS } from "@/data/products";
import { resolveCartLine } from "@/lib/cart-helpers";
import { formatDeliveryWindow, formatPhoneUS } from "@/lib/format";
import { SHOP_TZ } from "@/lib/tv-slots";

export type InvoiceStatus = "paid" | "refunded" | "balance_due" | "canceled";
export type InvoiceLine = { title: string; addOns: string[]; qty: number; unitCents: number | null; amountCents: number | null };
export type InvoiceRow = { label: string; cents: number; kind?: "negative" | "total" | "balance" };

export type InvoiceStrings = {
  title: string; number: string; issued: string; ordered: string;
  billTo: string; deliverTo: string; pickup: string; inStore: string;
  item: string; qty: string; unit: string; amount: string;
  subtotal: string; delivery: string; discount: string; tax: string; tip: string; total: string;
  giftCard: string; paid: string; deposit: string; balanceDue: string; credit: string;
  status: Record<InvoiceStatus, string>;
  methods: Record<PaymentMethod, string>;
  thanks: string; print: string;
};

export const INVOICE_STRINGS: Record<"en" | "es", InvoiceStrings> = {
  en: {
    title: "Invoice", number: "Invoice #", issued: "Issued", ordered: "Order date",
    billTo: "Bill to", deliverTo: "Deliver to", pickup: "Pickup", inStore: "In-store",
    item: "Item", qty: "Qty", unit: "Unit price", amount: "Amount",
    subtotal: "Subtotal", delivery: "Delivery", discount: "Discount", tax: "Sales tax (NY)", tip: "Tip", total: "Total",
    giftCard: "Gift card", paid: "Paid", deposit: "Deposit", balanceDue: "Balance due", credit: "Credit",
    status: { paid: "Paid", refunded: "Refunded", balance_due: "Balance due", canceled: "Canceled" },
    methods: { cash: "Cash", zelle: "Zelle", "card-terminal": "Card", ach: "ACH", stripe: "Card (online)", "gift-card": "Gift card" },
    thanks: "Thank you for choosing Maky The Diva Flowers.", print: "Print / Save PDF",
  },
  es: {
    title: "Factura", number: "Factura #", issued: "Emitida", ordered: "Fecha de la orden",
    billTo: "Facturar a", deliverTo: "Entregar a", pickup: "Recogida", inStore: "En tienda",
    item: "Artículo", qty: "Cant.", unit: "Precio unitario", amount: "Importe",
    subtotal: "Subtotal", delivery: "Envío", discount: "Descuento", tax: "Impuesto (NY)", tip: "Propina", total: "Total",
    giftCard: "Tarjeta de regalo", paid: "Pagado", deposit: "Depósito", balanceDue: "Saldo pendiente", credit: "Saldo a favor",
    status: { paid: "Pagada", refunded: "Reembolsada", balance_due: "Saldo pendiente", canceled: "Cancelada" },
    methods: { cash: "Efectivo", zelle: "Zelle", "card-terminal": "Tarjeta", ach: "ACH", stripe: "Tarjeta (en línea)", "gift-card": "Tarjeta de regalo" },
    thanks: "Gracias por elegir Maky The Diva Flowers.", print: "Imprimir / Guardar PDF",
  },
};

export type InvoiceModel = {
  locale: "en" | "es";
  strings: InvoiceStrings;
  number: string;
  issuedOn: string;
  orderedOn: string;
  status: InvoiceStatus;
  billTo: { name: string; email?: string; phone?: string };
  fulfillment: { heading: string; name: string; phone?: string; addressLines: string[]; when?: string };
  lines: InvoiceLine[];
  totals: InvoiceRow[];
  payments: InvoiceRow[];
};

function invoiceNumber(order: Order): string {
  return order.orderNumber != null
    ? `INV-${order.orderNumber}`
    : `INV-${order.id.slice(-6).toUpperCase()}`;
}

function phoneOrUndefined(digits: string | undefined): string | undefined {
  return digits ? formatPhoneUS(digits) : undefined;
}

// Same as formatDate in lib/format-datetime.ts, but pinned to the shop's own
// timezone (SHOP_TZ, "America/New_York") so a date printed on the invoice
// always matches the shop's calendar day, not the viewer's.
function formatDateShopTz(iso: string, locale: "en" | "es"): string {
  return new Date(iso).toLocaleDateString(locale === "es" ? "es-ES" : "en-US", {
    dateStyle: "medium",
    timeZone: SHOP_TZ,
  });
}

export function buildInvoiceModel(
  order: Order,
  opts: { products?: readonly Product[]; now?: Date } = {},
): InvoiceModel {
  const locale = order.locale === "es" ? "es" : "en";
  const s = INVOICE_STRINGS[locale];
  const products = opts.products ?? PRODUCTS;
  const now = opts.now ?? new Date();

  const lines: InvoiceLine[] = order.lines.map((line) => {
    if (line.kind === "custom") {
      return { title: line.title, addOns: [], qty: line.qty, unitCents: line.priceCents, amountCents: line.priceCents * line.qty };
    }
    const r = resolveCartLine(line, products);
    if (!r) return { title: line.productId, addOns: [], qty: line.qty, unitCents: null, amountCents: null };
    return {
      title: `${r.product.title[locale]} — ${r.variant.label[locale]}`,
      addOns: r.addOns.map((a) => a.label[locale]),
      qty: line.qty,
      unitCents: r.unitPriceCents,
      amountCents: r.lineTotalCents,
    };
  });

  const t = order.totals;
  const totals: InvoiceRow[] = [{ label: s.subtotal, cents: t.subtotalCents }];
  if (order.fulfillment.method === "delivery" || t.deliveryCents > 0) {
    totals.push({ label: s.delivery, cents: t.deliveryCents });
  }
  if (t.discountCents > 0) {
    totals.push({ label: order.promoCode ? `${s.discount} (${order.promoCode})` : s.discount, cents: t.discountCents, kind: "negative" });
  }
  totals.push({ label: s.tax, cents: t.taxCents });
  if (t.tipCents > 0) totals.push({ label: s.tip, cents: t.tipCents });
  totals.push({ label: s.total, cents: t.totalCents, kind: "total" });

  // amountPaidCents is set to the order total (including any gift-card portion)
  // by every "mark paid" path, so a gift-card-covered order double-counts the
  // gift card unless we take the larger of the two rather than summing them.
  const gc = order.giftCardCents ?? 0;
  const paid = order.amountPaidCents ?? 0;
  const collected = Math.max(paid, gc);
  const balance = t.totalCents - collected;

  const payments: InvoiceRow[] = [];
  // A gift card is a payment, not a discount — same as the work sheet.
  if (gc > 0) {
    payments.push({ label: s.giftCard, cents: gc, kind: "negative" });
  }
  const paidCents = paid - gc;
  if (paidCents > 0 && order.paymentMethod !== "gift-card") {
    // Money in on a still-pending order is a deposit, not a settled payment.
    const parts = [order.paymentStatus === "pending" ? s.deposit : s.paid];
    if (order.paymentMethod) parts.push(s.methods[order.paymentMethod]);
    if (order.paidAt) parts.push(formatDateShopTz(order.paidAt, locale));
    payments.push({ label: parts.join(" · "), cents: paidCents });
  }

  // Precedence: refunded and canceled are terminal states shown as-is, with no
  // misleading balance row; otherwise paid-in-full beats a lingering pending
  // status, and anything else is an open balance.
  const status: InvoiceStatus =
    order.paymentStatus === "refunded" ? "refunded"
    : order.status === "canceled" ? "canceled"
    : order.paymentStatus === "paid" && balance <= 0 ? "paid"
    : "balance_due";

  if (status === "balance_due") {
    payments.push({ label: s.balanceDue, cents: balance, kind: "balance" });
  } else if (status === "paid" && balance < 0) {
    payments.push({ label: s.credit, cents: -balance, kind: "balance" });
  }

  const f = order.fulfillment;
  const fulfillment: InvoiceModel["fulfillment"] =
    f.method === "delivery"
      ? {
          heading: s.deliverTo,
          name: f.recipient.name,
          phone: phoneOrUndefined(f.recipient.phone),
          addressLines: [
            f.address.street1,
            ...(f.address.street2 ? [f.address.street2] : []),
            `${f.address.city}, ${f.address.state} ${f.address.zip}`,
          ],
          when: formatDeliveryWindow(f.window, locale),
        }
      : f.method === "pickup"
        ? { heading: s.pickup, name: f.recipient.name, phone: phoneOrUndefined(f.recipient.phone), addressLines: [], when: formatDeliveryWindow(f.window, locale) }
        : { heading: s.inStore, name: f.recipient.name, phone: phoneOrUndefined(f.recipient.phone), addressLines: [] };

  return {
    locale,
    strings: s,
    number: invoiceNumber(order),
    issuedOn: formatDateShopTz(now.toISOString(), locale),
    orderedOn: formatDateShopTz(order.createdAt, locale),
    status,
    billTo: {
      name: order.contact.name || f.recipient.name,
      ...(order.contact.email ? { email: order.contact.email } : {}),
      ...(order.contact.phone ? { phone: formatPhoneUS(order.contact.phone) } : {}),
    },
    fulfillment,
    lines,
    totals,
    payments,
  };
}
