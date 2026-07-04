import type { Order } from "@/types/order";

// Fulfillment statuses that imply the order has already been paid for.
// "paid" is a legacy alias that used to be stored in the fulfillment status
// before payment tracking moved to Order.paymentStatus.
const PAID_FULFILLMENT_STATUSES = new Set([
  "paid",
  "preparing",
  "out-for-delivery",
  "delivered",
]);

/**
 * Whether an order should be treated as paid for the customer-facing
 * confirmation flow. The source of truth is `paymentStatus`; the
 * fulfillment-status set is kept for back-compat with orders that were
 * advanced under the old "paid"-in-status model.
 *
 * Imports only a type, so it is safe to use from client components.
 */
export function isOrderPaid(order: Pick<Order, "status" | "paymentStatus">): boolean {
  return (
    order.paymentStatus === "paid" ||
    PAID_FULFILLMENT_STATUSES.has(order.status as string)
  );
}
