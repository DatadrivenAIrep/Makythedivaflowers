import type {
  Order, DeliverySlot, OrderSource, FulfillmentStatus, PaymentStatus,
} from "@/types/order";

export type MakeOrderOpts = {
  id?: string;
  orderNumber?: number;
  source?: OrderSource;
  method?: "delivery" | "pickup" | "in-store";
  windowDate?: string;
  slot?: DeliverySlot;
  zip?: string;
  status?: FulfillmentStatus;
  paymentStatus?: PaymentStatus;
  createdAt?: string;
  updatedAt?: string;
  cardMessage?: string;
  designerNotes?: string;
  recipientName?: string;
};

let seq = 0;

export function makeOrder(o: MakeOrderOpts = {}): Order {
  const method = o.method ?? "delivery";
  const recipient = { name: o.recipientName ?? "Test Recipient", phone: "5165551212" };
  const window = { date: o.windowDate ?? "2026-07-20", slot: (o.slot ?? "midday") as DeliverySlot };
  const fulfillment =
    method === "delivery"
      ? { method, recipient,
          address: { street1: "1 Main St", city: "Roslyn", state: "NY", zip: o.zip ?? "11576", country: "US" as const },
          window, cardMessage: o.cardMessage }
      : method === "pickup"
      ? { method, recipient, window, cardMessage: o.cardMessage }
      : { method: "in-store" as const, recipient, cardMessage: o.cardMessage };
  const lines = o.designerNotes
    ? [{ kind: "custom" as const, title: "Designer's Choice", priceCents: 8000, designerNotes: o.designerNotes, qty: 1 }]
    : [{ kind: "catalog" as const, productId: "dozen-roses", variantId: "std", addOnIds: [], qty: 1 }];
  const created = o.createdAt ?? "2026-07-20T09:00:00.000Z";
  return {
    id: o.id ?? `do_test_${seq++}`,
    orderNumber: o.orderNumber ?? 1000,
    source: o.source ?? "web",
    locale: "es",
    lines,
    fulfillment: fulfillment as Order["fulfillment"],
    contact: { phone: "5165551212" },
    totals: { subtotalCents: 8000, deliveryCents: 1500, taxCents: 0, totalCents: 9500 },
    status: o.status ?? "pending",
    paymentStatus: o.paymentStatus ?? "paid",
    amountPaidCents: 9500,
    createdAt: created,
    updatedAt: o.updatedAt ?? created,
  };
}
