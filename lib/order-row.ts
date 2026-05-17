import "server-only";
import type { Order, OrderFulfillment } from "@/types/order";

export type OrderRow = {
  id: string;
  locale: string;
  source: string;
  customer_id: string | null;
  recipient_name: string;
  recipient_phone: string;
  contact_email: string | null;
  contact_phone: string;
  fulfillment_method: string;
  address_json: string | null;
  window_date: string | null;
  window_slot: string | null;
  card_message: string | null;
  lines_json: string;
  subtotal_cents: number;
  delivery_cents: number;
  tax_cents: number;
  total_cents: number;
  fulfillment_status: string;
  payment_status: string;
  payment_method: string | null;
  paid_at: string | null;
  stripe_payment_intent_id: string | null;
  taken_by: string | null;
  internal_notes: string | null;
  stripe_checkout_session_id: string | null;
  created_at: string;
  updated_at: string;
};

export function orderToRow(o: Order): OrderRow {
  const f = o.fulfillment;
  return {
    id: o.id,
    locale: o.locale,
    source: o.source,
    customer_id: o.customerId ?? null,
    recipient_name: f.recipient.name,
    recipient_phone: f.recipient.phone,
    contact_email: o.contact.email ?? null,
    contact_phone: o.contact.phone,
    fulfillment_method: f.method,
    address_json: f.method === "delivery" ? JSON.stringify(f.address) : null,
    window_date: f.method === "in-store" ? null : f.window.date,
    window_slot: f.method === "in-store" ? null : f.window.slot,
    card_message: f.cardMessage ?? null,
    lines_json: JSON.stringify(o.lines),
    subtotal_cents: o.totals.subtotalCents,
    delivery_cents: o.totals.deliveryCents,
    tax_cents: o.totals.taxCents,
    total_cents: o.totals.totalCents,
    fulfillment_status: o.status,
    payment_status: o.paymentStatus,
    payment_method: o.paymentMethod ?? null,
    paid_at: o.paidAt ?? null,
    stripe_payment_intent_id: o.stripePaymentIntentId ?? null,
    taken_by: o.takenBy ?? null,
    internal_notes: o.internalNotes ?? null,
    stripe_checkout_session_id: o.stripeCheckoutSessionId ?? null,
    created_at: o.createdAt,
    updated_at: o.updatedAt,
  };
}

export function rowToOrder(r: OrderRow): Order {
  const recipient = { name: r.recipient_name, phone: r.recipient_phone };
  const cardMessage = r.card_message ?? undefined;
  const slot = r.window_slot as "morning" | "midday" | "afternoon" | "evening";
  let fulfillment: OrderFulfillment;
  if (r.fulfillment_method === "delivery") {
    fulfillment = {
      method: "delivery",
      recipient,
      address: JSON.parse(r.address_json as string),
      window: { date: r.window_date as string, slot },
      cardMessage,
    };
  } else if (r.fulfillment_method === "pickup") {
    fulfillment = {
      method: "pickup",
      recipient,
      window: { date: r.window_date as string, slot },
      cardMessage,
    };
  } else {
    fulfillment = { method: "in-store", recipient, cardMessage };
  }
  return {
    id: r.id,
    source: r.source as Order["source"],
    locale: r.locale as "en" | "es",
    customerId: r.customer_id ?? undefined,
    lines: JSON.parse(r.lines_json),
    fulfillment,
    contact: {
      email: r.contact_email ?? undefined,
      phone: r.contact_phone,
    },
    totals: {
      subtotalCents: r.subtotal_cents,
      deliveryCents: r.delivery_cents,
      taxCents: r.tax_cents,
      totalCents: r.total_cents,
    },
    status: r.fulfillment_status as Order["status"],
    paymentStatus: r.payment_status as Order["paymentStatus"],
    paymentMethod: (r.payment_method as Order["paymentMethod"]) ?? undefined,
    paidAt: r.paid_at ?? undefined,
    stripePaymentIntentId: r.stripe_payment_intent_id ?? undefined,
    takenBy: r.taken_by ?? undefined,
    internalNotes: r.internal_notes ?? undefined,
    stripeCheckoutSessionId: r.stripe_checkout_session_id ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}
