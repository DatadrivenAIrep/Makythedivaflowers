import { describe, it, expect } from "vitest";
import { mapsDirectionsUrl } from "@/lib/maps-url";
import type { Address } from "@/types/address";

const addr: Address = {
  street1: "1077 Willis Ave",
  city: "Albertson",
  state: "NY",
  zip: "11507",
  country: "US",
};

describe("mapsDirectionsUrl", () => {
  it("targets Google Maps directions mode", () => {
    expect(mapsDirectionsUrl(addr)).toContain("https://www.google.com/maps/dir/?api=1&destination=");
  });

  it("percent-encodes the full address as the destination", () => {
    const url = mapsDirectionsUrl(addr);
    expect(url).toContain(encodeURIComponent("1077 Willis Ave, Albertson, NY 11507"));
    // spaces are encoded, not left raw
    expect(url).not.toContain("Willis Ave,");
  });
});
