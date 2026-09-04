import type { Address } from "@/types/address";

export type DeliverySlot = "morning" | "midday" | "afternoon" | "evening";

export type DeliveryWindow = {
  date: string; // YYYY-MM-DD
  slot: DeliverySlot;
  /**
   * Optional exact requested time, "HH:MM" in 24h shop-local wall time. When the
   * intake captures a precise time (e.g. "14:30"), `slot` is derived from it so the
   * run sheet and TV board keep bucketing; when absent the order is a flexible slot.
   */
  time?: string;
};

export type Recipient = { name: string; phone: string };

export type OrderTotals = {
  subtotalCents: number;
  deliveryCents: number;
  /**
   * Promotional discount applied to this order, in cents. Subtotal and delivery
   * stay at their pre-discount values so the receipt can show what was taken
   * off; the discount reduces the taxable base and the total.
   */
  discountCents: number;
  /**
   * Optional tip for the studio and the driver, in cents. Collected on behalf of
   * the team, so it sits outside the taxable base and is added after tax.
   */
  tipCents: number;
  taxCents: number;
  totalCents: number;
};

export type OrderSource = "web" | "walk-in" | "phone" | "whatsapp" | "event";
export type PaymentMethod = "cash" | "zelle" | "card-terminal" | "ach" | "stripe" | "gift-card";
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
  contact: { name?: string; email?: string; phone: string };
  totals: OrderTotals;
  status: FulfillmentStatus;
  paymentStatus: PaymentStatus;
  paymentMethod?: PaymentMethod;
  paidAt?: string;
  amountPaidCents?: number; // how much has actually been collected; balance = totalCents - this
  stripePaymentIntentId?: string;
  stripeCheckoutSessionId?: string;
  giftCardId?: string;
  giftCardCents?: number; // amount the gift card covered on this order
  /** Promo code applied at checkout. The discount itself lives in totals.discountCents. */
  promoId?: string;
  promoCode?: string;
  takenBy?: string;
  internalNotes?: string;
  /** Buyer opted in to transactional SMS (order + delivery updates) at checkout. */
  smsConsent?: boolean;
  /** Buyer opted in to marketing/promotional SMS — captured separately from smsConsent. */
  smsMarketingConsent?: boolean;
  createdAt: string;
  updatedAt: string;
};

export type OrderChangeKind =
  | "created" | "edit" | "payment" | "fulfillment" | "cancel" | "note" | "reprint";

export type FieldDiff = {
  field: string; // machine key, e.g. "fulfillment.address.street1"
  label: string; // Spanish UI label, e.g. "Dirección"
  before: string | null;
  after: string | null;
};

export type OrderChange = {
  id: string;
  orderId: string;
  at: string; // ISO
  actor: string;
  kind: OrderChangeKind;
  summary: string;
  changes?: FieldDiff[]; // present for kind="edit"
};
