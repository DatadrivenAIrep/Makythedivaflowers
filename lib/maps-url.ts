import type { Address } from "@/types/address";

function formatAddress(a: Address): string {
  return `${a.street1}, ${a.city}, ${a.state} ${a.zip}`;
}

// Google Maps in navigation mode with the address as destination — the driver
// taps once and gets turn-by-turn directions from wherever they are.
export function mapsDirectionsUrl(a: Address): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(formatAddress(a))}`;
}
