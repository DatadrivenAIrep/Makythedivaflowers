// lib/totals.ts
import type { CartLine, OrderTotals } from "@/types/order";
import { findDeliveryZoneByZip, findDeliveryZoneByCity } from "@/lib/delivery-zones";
import { cartSubtotalCents } from "@/lib/cart-helpers";
import { PRODUCTS } from "@/data/products";

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

/**
 * Resolve a delivery price from a partial address. Tries the ZIP first (most
 * specific), then falls back to the typed city. Returns null when neither
 * resolves so the caller can prompt for a manual fee instead of charging $0.
 * Used by staff intake, where the ZIP is often left blank.
 */
export function computeDeliveryCentsForAddress(address: {
  zip: string;
  city: string;
}): number | null {
  const byZip = findDeliveryZoneByZip(address.zip);
  if (byZip) return byZip.priceCents;
  const byCity = findDeliveryZoneByCity(address.city);
  return byCity ? byCity.priceCents : null;
}

/**
 * Single source of truth for turning lines + fulfillment into totals, with an
 * optional manual override. Used by intake order creation and by editOrder so
 * both price identically.
 */
export function resolveOrderTotals(input: {
  lines: CartLine[];
  fulfillmentMethod: "in-store" | "delivery" | "pickup";
  address?: { zip: string; city: string };
  override?: Partial<OrderTotals>;
}): OrderTotals {
  const subtotal = cartSubtotalCents(input.lines, PRODUCTS);
  let delivery = 0;
  if (input.fulfillmentMethod === "delivery" && input.address) {
    delivery = computeDeliveryCentsForAddress(input.address) ?? 0;
  }
  const computed = computeOrderTotals(subtotal, delivery);
  const o = input.override ?? {};
  return {
    subtotalCents: o.subtotalCents ?? computed.subtotalCents,
    deliveryCents: o.deliveryCents ?? computed.deliveryCents,
    taxCents: o.taxCents ?? computed.taxCents,
    totalCents: o.totalCents ?? computed.totalCents,
  };
}
