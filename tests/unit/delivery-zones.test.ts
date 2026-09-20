import { describe, it, expect } from "vitest";
import { findDeliveryZoneByZip, findDeliveryZoneByCity, isValidZip, deliveryZoneRank } from "@/lib/delivery-zones";
import { deliveryZones } from "@/data/delivery-zones";

describe("isValidZip", () => {
  it("accepts 5-digit numeric strings", () => {
    expect(isValidZip("11010")).toBe(true);
  });

  it("rejects empty / short / non-numeric / >5 digit input", () => {
    expect(isValidZip("")).toBe(false);
    expect(isValidZip("1101")).toBe(false);
    expect(isValidZip("110100")).toBe(false);
    expect(isValidZip("1101a")).toBe(false);
    expect(isValidZip("  11010  ")).toBe(false);
  });
});

describe("findDeliveryZoneByZip", () => {
  it("returns Albertson at $10 for 11507", () => {
    const zone = findDeliveryZoneByZip("11507");
    expect(zone?.id).toBe("albertson");
    expect(zone?.priceCents).toBe(1000);
    expect(zone?.priceCentsMax).toBeUndefined();
  });

  it("returns Roslyn at $15 for 11576 and 11577", () => {
    expect(findDeliveryZoneByZip("11576")?.id).toBe("roslyn");
    expect(findDeliveryZoneByZip("11577")?.priceCents).toBe(1500);
  });

  it("returns Manhasset at $18 for 11030", () => {
    const zone = findDeliveryZoneByZip("11030");
    expect(zone?.id).toBe("manhasset");
    expect(zone?.priceCents).toBe(1800);
  });

  it("returns Great Neck at $25 for 11020 / 11021 / 11023 / 11024", () => {
    for (const zip of ["11020", "11021", "11023", "11024"]) {
      const zone = findDeliveryZoneByZip(zip);
      expect(zone?.id).toBe("great-neck");
      expect(zone?.priceCents).toBe(2500);
    }
  });

  it("returns Port Washington at $15 for 11050", () => {
    const zone = findDeliveryZoneByZip("11050");
    expect(zone?.id).toBe("port-washington");
    expect(zone?.priceCents).toBe(1500);
  });

  it("returns the further zone with $25–$30 range for non-named ZIPs in service area", () => {
    // Garden City — Nassau, not in named cities
    const garden = findDeliveryZoneByZip("11530");
    expect(garden?.id).toBe("further");
    expect(garden?.priceCents).toBe(2500);
    expect(garden?.priceCentsMax).toBe(3000);

    // Mineola — Nassau
    expect(findDeliveryZoneByZip("11501")?.id).toBe("further");

    // Forest Hills — Queens
    expect(findDeliveryZoneByZip("11375")?.id).toBe("further");

    // Brentwood — Western Suffolk
    expect(findDeliveryZoneByZip("11717")?.id).toBe("further");
  });

  it("covers the North Shore towns past the named zones at the further rate", () => {
    const northShore = [
      "11560", // Locust Valley / Lattingtown / Matinecock
      "11771", // Oyster Bay / Oyster Bay Cove / Cove Neck
      "11709", // Bayville
      "11765", // Mill Neck
      "11732", // East Norwich
      "11791", // Syosset / Muttontown / Laurel Hollow
      "11797", // Woodbury
      "11753", // Jericho
      "11724", // Cold Spring Harbor
      "11721", // Centerport
      "11768", // Northport
      "11731", // East Northport
    ];
    for (const zip of northShore) {
      const zone = findDeliveryZoneByZip(zip);
      expect(zone?.id, zip).toBe("further");
      expect(zone?.priceCents, zip).toBe(2500);
    }
  });

  it("covers the central Nassau towns at the further rate", () => {
    const centralNassau = [
      "11553", // Uniondale
      "11554", // East Meadow
      "11714", // Bethpage
      "11756", // Levittown
      "11801", // Hicksville
      "11803", // Plainview
      "11804", // Old Bethpage
    ];
    for (const zip of centralNassau) {
      const zone = findDeliveryZoneByZip(zip);
      expect(zone?.id, zip).toBe("further");
      expect(zone?.priceCents, zip).toBe(2500);
    }
  });

  it("covers Jamaica and the rest of eastern / central Queens at the further rate", () => {
    const queens = [
      "11432", "11433", "11434", "11435", "11436", // Jamaica
      "11423", // Hollis
      "11413", // Springfield Gardens
      "11426", // Bellerose
      "11004", // Glen Oaks
      "11005", // Floral Park (Queens) / North Shore Towers
      "11362", // Little Neck
      "11363", // Douglaston
      "11360", // Bayside (Bay Terrace)
      "11367", // Kew Gardens Hills
      "11415", // Kew Gardens
      "11374", // Rego Park
      "11418", // Richmond Hill
      "11419", // South Richmond Hill
      "11420", // South Ozone Park
    ];
    for (const zip of queens) {
      const zone = findDeliveryZoneByZip(zip);
      expect(zone?.id, zip).toBe("further");
      expect(zone?.priceCents, zip).toBe(2500);
    }
  });

  it("covers western Queens, the Rockaways and south-shore Nassau at the further rate", () => {
    const zips = [
      // Western Queens
      "11101", "11109", // Long Island City
      "11102", "11103", "11105", "11106", // Astoria
      "11104", // Sunnyside
      "11377", // Woodside
      "11372", // Jackson Heights
      "11369", "11370", // East Elmhurst
      "11373", // Elmhurst
      "11368", // Corona
      "11378", // Maspeth
      "11379", // Middle Village
      "11421", // Woodhaven
      "11416", "11417", // Ozone Park
      "11414", // Howard Beach
      // The Rockaways
      "11691", "11692", "11693", "11694", "11697",
      // South-shore Nassau
      "11570", // Rockville Centre
      "11563", // Lynbrook
      "11518", // East Rockaway
      "11510", // Baldwin
      "11575", // Roosevelt
      "11520", // Freeport
      "11566", // Merrick
      "11710", // Bellmore
      "11793", // Wantagh
      "11783", // Seaford
      "11758", "11762", // Massapequa / Massapequa Park
      "11735", // Farmingdale
      "11581", // Valley Stream (North Woodmere)
      "11559", "11516", "11096", // Five Towns: Lawrence, Cedarhurst, Inwood
    ];
    for (const zip of zips) {
      const zone = findDeliveryZoneByZip(zip);
      expect(zone?.id, zip).toBe("further");
      expect(zone?.priceCents, zip).toBe(2500);
    }
  });

  it("keeps every ZIP in exactly one zone", () => {
    const all = deliveryZones.flatMap((z) => z.zips);
    expect(new Set(all).size).toBe(all.length);
  });

  it("returns null for an out-of-zone ZIP", () => {
    expect(findDeliveryZoneByZip("90210")).toBeNull();
  });

  it("returns null for an invalid ZIP", () => {
    expect(findDeliveryZoneByZip("nope")).toBeNull();
  });
});

describe("findDeliveryZoneByCity", () => {
  it("matches a named city regardless of case and surrounding whitespace", () => {
    expect(findDeliveryZoneByCity("Great Neck")?.id).toBe("great-neck");
    expect(findDeliveryZoneByCity("great neck")?.id).toBe("great-neck");
    expect(findDeliveryZoneByCity("  GREAT NECK  ")?.id).toBe("great-neck");
  });

  it("matches each named-city zone by its label", () => {
    expect(findDeliveryZoneByCity("Albertson")?.priceCents).toBe(1000);
    expect(findDeliveryZoneByCity("Roslyn")?.priceCents).toBe(1500);
    expect(findDeliveryZoneByCity("Manhasset")?.priceCents).toBe(1800);
    expect(findDeliveryZoneByCity("Port Washington")?.priceCents).toBe(1500);
  });

  it("returns null for a city that is not a named zone", () => {
    // Garden City is only reachable by ZIP (further zone), not by city label.
    expect(findDeliveryZoneByCity("Garden City")).toBeNull();
    expect(findDeliveryZoneByCity("Los Angeles")).toBeNull();
  });

  it("returns null for empty input", () => {
    expect(findDeliveryZoneByCity("")).toBeNull();
    expect(findDeliveryZoneByCity("   ")).toBeNull();
  });
});

describe("deliveryZoneRank", () => {
  it("ranks nearer zones below farther zones (lower index = sorts first)", () => {
    // Albertson is index 0, Great Neck index 3 in the curated list
    expect(deliveryZoneRank("11507")).toBeLessThan(deliveryZoneRank("11020"));
  });

  it("returns the exact curated index for a known zip", () => {
    expect(deliveryZoneRank("11507")).toBe(0); // albertson
    expect(deliveryZoneRank("11576")).toBe(1); // roslyn
  });

  it("ranks an unmatched or invalid zip last (== deliveryZones.length)", () => {
    expect(deliveryZoneRank("90210")).toBe(deliveryZones.length); // out of area
    expect(deliveryZoneRank("nope")).toBe(deliveryZones.length);  // invalid
    // a farther zone still sorts before an unmatched zip
    expect(deliveryZoneRank("11020")).toBeLessThan(deliveryZoneRank("90210"));
  });
});
