import type { MetricOrder } from "@/lib/metrics/orders";

let n = 0;
/** A paid, delivered $100 phone order on `day`; override any field. */
export function mo(p: Partial<MetricOrder> & { day: string }): MetricOrder {
  n += 1;
  return {
    id: `o${n}`, customerId: null, contactPhone: "5165550100", contactName: "Ana", source: "phone",
    totalCents: 10000, amountPaidCents: 10000, paymentStatus: "paid", fulfillmentStatus: "delivered",
    createdAt: `${p.day}T15:00:00.000Z`, linesJson: "[]", addressZip: null,
    windowDate: null, windowSlot: null, windowTime: null, funeral: false,
    discountCents: 0, promoCode: null, giftCardCents: 0, houseAccount: false,
    ...p,
  };
}
