// lib/totals.ts
import type { OrderTotals } from "@/types/order";

export const DELIVERY_FLAT_CENTS = 1500; // $15 flat, Long Island & Queens
export const TAX_RATE = 0.08625; // NY combined ballpark (Nassau)

export function computeOrderTotals(subtotalCents: number): OrderTotals {
  if (subtotalCents <= 0) {
    return { subtotalCents: 0, deliveryCents: 0, taxCents: 0, totalCents: 0 };
  }
  const deliveryCents = DELIVERY_FLAT_CENTS;
  const taxCents = Math.round((subtotalCents + deliveryCents) * TAX_RATE);
  return {
    subtotalCents,
    deliveryCents,
    taxCents,
    totalCents: subtotalCents + deliveryCents + taxCents,
  };
}
