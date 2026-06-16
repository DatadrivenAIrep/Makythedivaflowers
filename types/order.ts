import type { Address } from "@/types/address";

export type DeliverySlot = "morning" | "midday" | "afternoon" | "evening";

export type DeliveryWindow = {
  date: string; // YYYY-MM-DD
  slot: DeliverySlot;
};

export type Recipient = { name: string; phone: string };

export type OrderTotals = {
  subtotalCents: number;
  deliveryCents: number;
  taxCents: number;
  totalCents: number;
};

export type OrderSource = "web" | "walk-in" | "phone" | "whatsapp" | "event";
export type PaymentMethod = "cash" | "zelle" | "card-terminal" | "ach" | "stripe";
export type PaymentStatus = "paid" | "pending" | "refunded";

export type MessagingChannel = "sms" | "whatsapp" | "email" | "none";

// "paid" is gone — payment is tracked separately in PaymentStatus.
export type FulfillmentStatus =
  | "pending"
  | "preparing"
  | "out-for-delivery"
  | "delivered"
  | "failed"
  | "canceled";

export type CatalogCartLine = {
  kind: "catalog";
  productId: string;
  variantId: string;
  addOnIds: string[];
  qty: number;
};

export type CustomCartLine = {
  kind: "custom";
  title: string;
  priceCents: number;
  designerNotes?: string;
  qty: number;
};

export type CartLine = CatalogCartLine | CustomCartLine;

export type DeliveryFulfillment = {
  method: "delivery";
  recipient: Recipient;
  address: Address;
  window: DeliveryWindow;
  cardMessage?: string;
};

export type PickupFulfillment = {
  method: "pickup";
  recipient: Recipient;
  window: DeliveryWindow;
  cardMessage?: string;
};

export type InStoreFulfillment = {
  method: "in-store";
  recipient: Recipient;
  cardMessage?: string;
};

export type OrderFulfillment =
  | DeliveryFulfillment
  | PickupFulfillment
  | InStoreFulfillment;

// Kept for back-compat at the storage seam only — do NOT use in new code.
export type OrderStatus = FulfillmentStatus | "paid";

export type Order = {
  id: string;
  // Short human-friendly sequential number (e.g. 1001) for the work sheet,
  // confirmation page, and shop email. Assigned at creation in saveOrder.
  // Optional: orders created before this feature have no number.
  orderNumber?: number;
  source: OrderSource;
  locale: "en" | "es";
  customerId?: string;
  lines: CartLine[];
  fulfillment: OrderFulfillment; // was: delivery
  contact: { email?: string; phone: string };
  totals: OrderTotals;
  status: FulfillmentStatus;
  paymentStatus: PaymentStatus;
  paymentMethod?: PaymentMethod;
  paidAt?: string;
  stripePaymentIntentId?: string;
  stripeCheckoutSessionId?: string;
  takenBy?: string;
  internalNotes?: string;
  createdAt: string;
  updatedAt: string;
};
