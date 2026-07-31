import type { CartLine, OrderTotals } from "@/types/order";
import type { CustomerSnapshot } from "@/components/admin/intake/CustomerBlock";
import type { FulfillmentState } from "@/components/admin/intake/FulfillmentBlock";
import type { PaymentState } from "@/components/admin/intake/PaymentBlock";

/** The exact IntakeForm client state, so resume restores editing state 1:1. */
export type DraftPayload = {
  version: 1;
  channel: "walk-in" | "phone" | "whatsapp" | "event";
  customer: CustomerSnapshot;
  fulfillment: FulfillmentState;
  lines: CartLine[];
  override: Partial<OrderTotals>;
  giftCardCode: string;
  payment: PaymentState;
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
