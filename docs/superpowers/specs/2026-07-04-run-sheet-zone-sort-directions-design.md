# Run Sheet: Zone Ordering + Directions Button — Design

**Date:** 2026-07-04
**Status:** Approved
**Scope:** Admin delivery Run Sheet only (`components/admin/dashboard/RunSheetView.tsx`). No data-model change, no migration.

## Problem

The delivery Run Sheet groups orders by time slot (morning / midday / afternoon /
evening), but within a slot the orders appear in creation order — no help for
planning the driver's route. And while the address is a Google Maps link, it only
drops a pin; a driver wants turn-by-turn directions, and it isn't an obvious button.

Orders carry only a 4-value delivery **slot**, not a clock time — so "sort by
delivery time" is satisfied by keeping the slots and adding a meaningful secondary
order **by delivery zone** (geographic, route-friendly), not by inventing an hour.

## Feature 1 — Order by zone within each slot

- The four slots remain the primary grouping, in the existing `SLOT_ORDER`
  (morning → midday → afternoon → evening).
- Within each slot, delivery orders are **sorted by delivery zone**, resolving the
  address `zip` through the existing zone table.
- Zone order follows the curated order already in `data/delivery-zones.ts`
  (albertson → roslyn → manhasset → great-neck → port-washington → further), which
  runs roughly nearest-to-farthest from the shop. Addresses whose zip matches no
  zone sort **last**.
- Ties within the same zone keep the current relative order (creation order).
  `Array.prototype.sort` is stable in Node, so no explicit tiebreak key is needed.
- Each card shows a small **zone chip** (e.g. `Albertson`) using the zone label in
  the active locale, so the driver sees the grouping at a glance. Cards with no
  matching zone show no chip.

### Pure helper

Add to `lib/delivery-zones.ts`:

```ts
export function deliveryZoneRank(zip: string): number {
  const zone = findDeliveryZoneByZip(zip);
  return zone ? deliveryZones.indexOf(zone) : deliveryZones.length;
}
```

- Known zip → its index in `deliveryZones` (0-based; lower = nearer, sorts first).
- Invalid or unmatched zip → `deliveryZones.length` (sorts last).
- Reuses `findDeliveryZoneByZip` (5-digit validation lives there); no new normalization.

`RunSheetView` computes the zone-sorted list inside each slot group:

```ts
const inSlot = orders
  .filter((o) => o.fulfillment.method === "delivery" && o.fulfillment.window.slot === slot)
  .sort((a, b) =>
    deliveryZoneRank(zipOf(a)) - deliveryZoneRank(zipOf(b))
  );
```

where `zipOf(o)` reads `o.fulfillment.address.zip` (guarded by the existing
`method === "delivery"` narrowing already present in the render loop).

## Feature 2 — "Directions" button

- Add a **"Directions"** ("Cómo llegar") button to each card's action row, beside
  Phone / On-the-way / Delivered, using a navigation icon (`NavigationArrow` from
  `@phosphor-icons/react/dist/ssr`).
- It opens Google Maps in directions mode in a new tab:
  `https://www.google.com/maps/dir/?api=1&destination=<encoded address>`.
- The address line above becomes **plain text** (no longer a link) so there aren't
  two overlapping click behaviors on one card; the button is the single, obvious way
  to open Maps.

### Pure helper

Add `lib/maps-url.ts`:

```ts
import type { Address } from "@/types/order";

function formatAddress(a: Address): string {
  return `${a.street1}, ${a.city}, ${a.state} ${a.zip}`;
}

export function mapsDirectionsUrl(a: Address): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(formatAddress(a))}`;
}
```

Single source of truth for the directions URL; encoding is unit-tested.

## i18n

Add to the `admin_dashboard` namespace in **both** `messages/es.json` and
`messages/en.json`, keeping key sets identical (gated by `i18n-parity.test.ts`):

- `action_directions` — "Cómo llegar" / "Directions"

Zone chip labels come from `data/delivery-zones.ts` (`label.es` / `label.en`), so no
new i18n keys are needed for zone names.

## Testing

- **`deliveryZoneRank`** (unit): a known zip from an early zone ranks below a known
  zip from a later zone; an unmatched/invalid zip returns `deliveryZones.length`
  (sorts last).
- **`mapsDirectionsUrl`** (unit): produces the `maps/dir/?api=1&destination=` shape
  with the address percent-encoded (spaces and commas escaped).
- **`RunSheetView`** (component): given two delivery orders in the same slot whose
  zips resolve to a nearer and a farther zone, the nearer one renders first; the
  "Directions" button is present and its `href` points at the directions URL.

## Out of scope

- No specific clock-time field on orders (explicitly declined — slots are enough).
- No zone sub-headers; a per-card chip conveys the grouping.
- No changes to the intake form, checkout, storage, or API.
- Existing `?q=` pin links elsewhere (OrderDetailDrawer, CustomerProfile) are left
  as-is; only the Run Sheet card changes.
