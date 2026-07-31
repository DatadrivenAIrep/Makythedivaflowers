import type { CartLine, OrderTotals } from "@/types/order";
import type { CustomerSnapshot } from "./CustomerBlock";
import type { FulfillmentState } from "./FulfillmentBlock";
import type { PaymentState } from "./PaymentBlock";

export type Channel = "walk-in" | "phone" | "whatsapp" | "event";

export const INITIAL_CHANNEL: Channel = "walk-in";

export const INITIAL_CUSTOMER: CustomerSnapshot = {
  name: "",
  phone: "",
  email: "",
  messagingChannel: "sms",
  buyerAddress: undefined,
};

export const INITIAL_PAYMENT: PaymentState = { status: "pending" };

/** Bare calendar day (YYYY-MM-DD) for the delivery-window default. */
export function todayYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Factory (not a constant) so the window date is recomputed to "today" on each reset. */
export function makeInitialFulfillment(): FulfillmentState {
  return {
    method: "delivery",
    recipient: { name: "", phone: "" },
    address: { street1: "", city: "", state: "NY", zip: "", country: "US" },
    window: { date: todayYmd(), slot: "midday" },
    cardMessage: "",
  };
}

export type IntakeFormState = {
  channel: Channel;
  customer: CustomerSnapshot;
  fulfillment: FulfillmentState;
  lines: CartLine[];
  override: Partial<OrderTotals>;
  giftCardCode: string;
  payment: PaymentState;
};

export function makeInitialFormState(): IntakeFormState {
  return {
    channel: INITIAL_CHANNEL,
    customer: { ...INITIAL_CUSTOMER },
    fulfillment: makeInitialFulfillment(),
    lines: [],
    override: {},
    giftCardCode: "",
    payment: { ...INITIAL_PAYMENT },
  };
}
