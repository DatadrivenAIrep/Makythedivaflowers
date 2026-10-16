// Bulk actions in the Libro de órdenes: which selected orders each action can
// touch, the request it sends for one order, and the CSV export. Pure.
//
// Every action reuses the single-order endpoint the order drawer already calls,
// so the rules, the history entry and the customer SMS are exactly the same as
// doing it one order at a time.
import type { CartLine, FulfillmentStatus, Order } from "@/types/order";

export type BulkStatus = "preparing" | "out-for-delivery" | "delivered";
export type BulkPayMethod = "cash" | "zelle" | "card-terminal" | "ach";

export type BulkAction =
  | { kind: "status"; status: BulkStatus }
  | { kind: "paid"; method: BulkPayMethod }
  | { kind: "print" };

export type SkipReason = "canceled" | "already_there" | "cannot_advance" | "already_paid" | "refunded" | "on_account";

export type BulkPlan = { run: Order[]; skipped: { order: Order; reason: SkipReason }[] };

// Statuses only move forward, in this order (mirrors changeFulfillmentStatus).
const STATUS_ORDER: FulfillmentStatus[] = ["pending", "preparing", "out-for-delivery", "delivered"];

function skipReason(o: Order, action: BulkAction): SkipReason | null {
  if (action.kind === "print") return null;
  if (o.status === "canceled") return "canceled";
  if (action.kind === "status") {
    const from = STATUS_ORDER.indexOf(o.status);
    if (from === -1) return "cannot_advance";
    return from >= STATUS_ORDER.indexOf(action.status) ? "already_there" : null;
  }
  if (o.paymentStatus === "paid") return "already_paid";
  if (o.paymentStatus === "refunded") return "refunded";
  // An account order is paid on the account's statement, never one by one.
  if (o.houseAccountId) return "on_account";
  return null;
}

export function planBulk(orders: readonly Order[], action: BulkAction): BulkPlan {
  const plan: BulkPlan = { run: [], skipped: [] };
  for (const o of orders) {
    const reason = skipReason(o, action);
    if (reason) plan.skipped.push({ order: o, reason });
    else plan.run.push(o);
  }
  return plan;
}

export function bulkRequest(action: BulkAction, orderId: string): { url: string; init: RequestInit } {
  const base = `/api/admin/orders/${encodeURIComponent(orderId)}`;
  const json = (body: unknown): RequestInit => ({
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (action.kind === "status") return { url: `${base}/fulfillment`, init: json({ status: action.status }) };
  if (action.kind === "paid") return { url: `${base}/payment`, init: json({ method: action.method }) };
  return { url: `${base}/reprint`, init: { method: "POST" } };
}

// --- CSV ---------------------------------------------------------------------

const HEADERS = {
  es: ["Orden", "Creada", "Entrega", "Franja", "Canal", "Tipo", "Cliente", "Teléfono", "Correo", "Destinatario",
    "Tel. destinatario", "Dirección", "Ciudad", "ZIP", "Arreglos", "Subtotal", "Envío", "Descuento", "Propina",
    "Impuesto", "Total", "Pagado", "Estado de pago", "Método de pago", "Estado"],
  en: ["Order", "Created", "Delivery", "Slot", "Channel", "Type", "Customer", "Phone", "Email", "Recipient",
    "Recipient phone", "Address", "City", "ZIP", "Items", "Subtotal", "Delivery fee", "Discount", "Tip",
    "Tax", "Total", "Paid", "Payment status", "Payment method", "Status"],
} as const;

const dollars = (cents: number | undefined) => ((cents ?? 0) / 100).toFixed(2);

function cell(value: string | number | undefined): string {
  let s = value === undefined ? "" : String(value);
  // A cell starting with = + - @ runs as a formula in Excel/Sheets: defuse it.
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * One row per order, header in the staff's language. `lineName` names a catalog
 * line the way the panel shows it; custom lines use their own title.
 */
export function ordersCsv(
  orders: readonly Order[],
  locale: "en" | "es",
  lineName: (line: Extract<CartLine, { kind: "catalog" }>) => string,
): string {
  const rows = orders.map((o) => {
    const f = o.fulfillment;
    const address = f.method === "delivery" ? f.address : undefined;
    const window = f.method === "in-store" ? undefined : f.window;
    const items = o.lines
      .map((l) => `${l.qty}× ${l.kind === "custom" ? l.title : lineName(l)}`)
      .join("; ");
    return [
      o.orderNumber ?? o.id,
      o.createdAt.slice(0, 10),
      window?.date,
      window ? window.time ?? window.slot : undefined,
      o.source,
      f.method,
      o.contact.name,
      o.contact.phone,
      o.contact.email,
      f.recipient.name,
      f.recipient.phone,
      address ? [address.street1, address.street2].filter(Boolean).join(", ") : undefined,
      address?.city,
      address?.zip,
      items,
      dollars(o.totals.subtotalCents),
      dollars(o.totals.deliveryCents),
      dollars(o.totals.discountCents),
      dollars(o.totals.tipCents),
      dollars(o.totals.taxCents),
      dollars(o.totals.totalCents),
      dollars(o.amountPaidCents),
      o.paymentStatus,
      o.paymentMethod,
      o.status,
    ].map(cell).join(",");
  });
  // The BOM tells Excel the file is UTF-8, so "Pérez" doesn't arrive as "PÃ©rez".
  return "﻿" + [HEADERS[locale].join(","), ...rows].join("\r\n") + "\r\n";
}
