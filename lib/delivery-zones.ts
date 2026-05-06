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
