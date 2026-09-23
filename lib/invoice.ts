// lib/invoice.ts
// Pure data for the customer-facing order invoice (admin "Invoice" button).
// Everything comes from the stored order — totals are never recomputed — and
// staff-only fields (internal notes, taken-by, card message, designer notes)
// are deliberately never read.
import type { Order, PaymentMethod } from "@/types/order";
import type { Product } from "@/types/product";
import { PRODUCTS } from "@/data/products";
import { resolveCartLine } from "@/lib/cart-helpers";
import { orderBalanceCents } from "@/lib/order-balance";
import { formatDate } from "@/lib/format-datetime";
import { formatDeliveryWindow, formatPhoneUS } from "@/lib/format";

export type InvoiceStatus = "paid" | "refunded" | "balance_due";
export type InvoiceLine = { title: string; addOns: string[]; qty: number; unitCents: number | null; amountCents: number | null };
export type InvoiceRow = { label: string; cents: number; kind?: "negative" | "total" | "balance" };

export type InvoiceStrings = {
  title: string; number: string; issued: string; ordered: string;
  billTo: string; deliverTo: string; pickup: string; inStore: string;
  item: string; qty: string; unit: string; amount: string;
  subtotal: string; delivery: string; discount: string; tax: string; tip: string; total: string;
  giftCard: string; paid: string; balanceDue: string; credit: string;
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
    giftCard: "Gift card", paid: "Paid", balanceDue: "Balance due", credit: "Credit",
    status: { paid: "Paid", refunded: "Refunded", balance_due: "Balance due" },
    methods: { cash: "Cash", zelle: "Zelle", "card-terminal": "Card", ach: "ACH", stripe: "Card (online)", "gift-card": "Gift card" },
    thanks: "Thank you for choosing Maky The Diva Flowers.", print: "Print / Save PDF",
  },
  es: {
    title: "Factura", number: "Factura #", issued: "Emitida", ordered: "Fecha de la orden",
    billTo: "Facturar a", deliverTo: "Entregar a", pickup: "Recogida", inStore: "En tienda",
    item: "Artículo", qty: "Cant.", unit: "Precio unitario", amount: "Importe",
    subtotal: "Subtotal", delivery: "Envío", discount: "Descuento", tax: "Impuesto (NY)", tip: "Propina", total: "Total",
    giftCard: "Tarjeta de regalo", paid: "Pagado", balanceDue: "Saldo pendiente", credit: "Saldo a favor",
    status: { paid: "Pagada", refunded: "Reembolsada", balance_due: "Saldo pendiente" },
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
  const totals: InvoiceRow[] = [
    { label: s.subtotal, cents: t.subtotalCents },
    { label: s.delivery, cents: t.deliveryCents },
  ];
  if (t.discountCents > 0) {
    totals.push({ label: order.promoCode ? `${s.discount} (${order.promoCode})` : s.discount, cents: t.discountCents, kind: "negative" });
  }
  totals.push({ label: s.tax, cents: t.taxCents });
  if (t.tipCents > 0) totals.push({ label: s.tip, cents: t.tipCents });
  totals.push({ label: s.total, cents: t.totalCents, kind: "total" });

  const payments: InvoiceRow[] = [];
  // A gift card is a payment, not a discount — same as the work sheet.
  if (order.giftCardCents && order.giftCardCents > 0) {
    payments.push({ label: s.giftCard, cents: order.giftCardCents, kind: "negative" });
  }
  const paidCents = order.amountPaidCents ?? 0;
  if (paidCents > 0) {
    const parts = [s.paid];
    if (order.paymentMethod) parts.push(s.methods[order.paymentMethod]);
    if (order.paidAt) parts.push(formatDate(order.paidAt, locale));
    payments.push({ label: parts.join(" · "), cents: paidCents });
  }
  const balance = orderBalanceCents(order);
  payments.push({ label: balance < 0 ? s.credit : s.balanceDue, cents: Math.abs(balance), kind: "balance" });

  const status: InvoiceStatus =
    order.paymentStatus === "refunded" ? "refunded"
    : order.paymentStatus === "paid" && balance <= 0 ? "paid"
    : "balance_due";

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
    issuedOn: formatDate(now.toISOString(), locale),
    orderedOn: formatDate(order.createdAt, locale),
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
