import type { CartLine, OrderTotals } from "@/types/order";
import type { CustomerSnapshot } from "@/components/admin/intake/CustomerBlock";
import type { FulfillmentState } from "@/components/admin/intake/FulfillmentBlock";
import type { PaymentState } from "@/components/admin/intake/PaymentBlock";
import type { TaxExemptRequest } from "@/types/tax-exempt";

/** The exact IntakeForm client state, so resume restores editing state 1:1. */
export type DraftPayload = {
  version: 1;
  channel: "walk-in" | "phone" | "whatsapp" | "event";
  customer: CustomerSnapshot;
  fulfillment: FulfillmentState;
  lines: CartLine[];
  override: Partial<OrderTotals>;
  giftCardCode: string;
  /** Applied promo code, if any. The discount amount rides in `override.discountCents`. */
  promoCode?: string;
  payment: PaymentState;
  /** Staff's explicit exemption choice; absent = follow the customer/account default. */
  taxExempt?: TaxExemptRequest;
};

/** List-row metadata (no payload). */
export type OrderDraft = {
  id: string;
  label: string;
  itemCount: number;
  totalCents: number;
  takenBy?: string;
  createdAt: string;
  updatedAt: string;
};

/** Full draft including the payload, returned by GET /[id]. */
export type OrderDraftDetail = OrderDraft & { payload: DraftPayload };
