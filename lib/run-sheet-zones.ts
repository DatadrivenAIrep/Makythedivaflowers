// lib/run-sheet-zones.ts
//
// Pure grouping logic for the "Por zona" view of the Run Sheet ("Entregas
// hoy"): the driver plans a route town by town, so deliveries are bucketed by
// delivery zone instead of by time slot.
//
//   1. Zone from the address ZIP (first 5 digits, so "11576-1234" still works).
//   2. Else the address city matched against a named zone label ("Roslyn").
//   3. Else "Sin zona" (key NO_ZONE_KEY, zone null) — always the last group.
//
// Groups follow the curated order of `deliveryZones` (nearest/cheapest first,
// starting at Albertson). Inside a group, orders run by window: the exact
// requested time when set, else the slot's start time (morning → midday →
// afternoon → evening). Pickup / in-store orders are not deliveries; they are
// returned separately so the caller decides how (or whether) to show them.
import { deliveryZones, type DeliveryZone } from "@/data/delivery-zones";
import { findDeliveryZoneByCity, findDeliveryZoneByZip } from "@/lib/delivery-zones";
import { SLOT_ORDER, SLOT_START_MIN, parseHhmm } from "@/lib/tv-slots";
import type { DeliveryFulfillment, DeliveryWindow, Order } from "@/types/order";

export const NO_ZONE_KEY = "none";

export type RunSheetZoneGroup = {
  /** Zone id, or NO_ZONE_KEY for orders that resolved to no zone. */
  key: string;
  zone: DeliveryZone | null;
  orders: Order[];
};

export type RunSheetZoneGrouping = {
  groups: RunSheetZoneGroup[];
  /** Non-delivery orders (pickup / in-store), in their original order. */
  pickups: Order[];
};

/** Resolve the delivery zone of an order: ZIP first, then city, else null. */
export function resolveRunSheetZone(order: Order): DeliveryZone | null {
  if (order.fulfillment.method !== "delivery") return null;
  const { zip, city } = order.fulfillment.address;
  const zip5 = (zip ?? "").trim().slice(0, 5);
  return findDeliveryZoneByZip(zip5) ?? findDeliveryZoneByCity(city ?? "");
}

/** Sort key in minutes since midnight: exact time if valid, else slot start. */
function windowMinutes(w: DeliveryWindow): number {
  return parseHhmm(w.time) ?? SLOT_START_MIN[w.slot] ?? Number.MAX_SAFE_INTEGER;
}

/** Compare two delivery windows chronologically (slot order breaks ties). */
export function compareRunSheetWindows(a: DeliveryWindow, b: DeliveryWindow): number {
  const byMinutes = windowMinutes(a) - windowMinutes(b);
  if (byMinutes !== 0) return byMinutes;
  return SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot);
}

export function groupRunSheetByZone(orders: Order[]): RunSheetZoneGrouping {
  const buckets = new Map<string, Order[]>();
  const pickups: Order[] = [];

  for (const o of orders) {
    if (o.fulfillment.method !== "delivery") {
      pickups.push(o);
      continue;
    }
    const key = resolveRunSheetZone(o)?.id ?? NO_ZONE_KEY;
    const list = buckets.get(key);
    if (list) list.push(o);
    else buckets.set(key, [o]);
  }

  // Buckets only hold delivery orders, which always carry a window.
  const windowOf = (o: Order): DeliveryWindow =>
    (o.fulfillment as DeliveryFulfillment).window;
  // Array.prototype.sort is stable, so same-window orders keep input order.
  const sortByWindow = (list: Order[]) =>
    list.sort((a, b) => compareRunSheetWindows(windowOf(a), windowOf(b)));

  const groups: RunSheetZoneGroup[] = [];
  for (const zone of deliveryZones) {
    const list = buckets.get(zone.id);
    if (list) groups.push({ key: zone.id, zone, orders: sortByWindow(list) });
  }
  const none = buckets.get(NO_ZONE_KEY);
  if (none) groups.push({ key: NO_ZONE_KEY, zone: null, orders: sortByWindow(none) });

  return { groups, pickups };
}
