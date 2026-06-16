import { deliveryZones, type DeliveryZone } from "@/data/delivery-zones";

const ZIP_RE = /^\d{5}$/;

export function isValidZip(input: string): boolean {
  return ZIP_RE.test(input);
}

export function findDeliveryZoneByZip(input: string): DeliveryZone | null {
  if (!isValidZip(input)) return null;
  for (const zone of deliveryZones) {
    if (zone.zips.includes(input)) return zone;
  }
  return null;
}

function normalizeCity(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, " ");
}

// Resolve a zone from a typed city name (how staff usually think about
// delivery — "Great Neck", not "11023"). Matches against the named-city
// labels in either language. The catch-all "further" zone is intentionally
// excluded: its label ("Nassau / Queens / …") isn't a city someone types,
// and a city like "Garden City" should stay unresolved here so the form can
// prompt for a fee rather than silently assume the low end of a range.
export function findDeliveryZoneByCity(input: string): DeliveryZone | null {
  const city = normalizeCity(input);
  if (!city) return null;
  for (const zone of deliveryZones) {
    if (zone.id === "further") continue;
    if (normalizeCity(zone.label.en) === city || normalizeCity(zone.label.es) === city) {
      return zone;
    }
  }
  return null;
}
