import type { Order } from "@/types/order";

/** Positive = customer owes (saldo pendiente); negative = we owe (saldo a favor). */
export function orderBalanceCents(order: Order): number {
  return order.totals.totalCents - (order.amountPaidCents ?? 0);
}
