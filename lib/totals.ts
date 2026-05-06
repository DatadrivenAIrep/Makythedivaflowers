// lib/totals.ts
import type { OrderTotals } from "@/types/order";
import { findDeliveryZoneByZip } from "@/lib/delivery-zones";

// Used when the customer hasn't entered a ZIP yet. Display layer should pass
// `deliveryPending` to render "—" instead of this number, but if it leaks
// through, the lowest real zone price (Albertson $10) is the safest anchor.
export const DELIVERY_FALLBACK_CENTS = 1000;
export const TAX_RATE = 0.08625; // NY combined ballpark (Nassau)

export function computeOrderTotals(
  subtotalCents: number,
  deliveryCents: number = 0,
): OrderTotals {
  if (subtotalCents <= 0) {
    return { subtotalCents: 0, deliveryCents: 0, taxCents: 0, totalCents: 0 };
  }
  const taxCents = Math.round((subtotalCents + deliveryCents) * TAX_RATE);
  return {
    subtotalCents,
    deliveryCents,
    taxCents,
    totalCents: subtotalCents + deliveryCents + taxCents,
  };
}

/** Returns the delivery price in cents for a given ZIP, or null if out of zone. */
export function computeDeliveryCentsForZip(zip: string): number | null {
  const zone = findDeliveryZoneByZip(zip);
  return zone ? zone.priceCents : null;
}
