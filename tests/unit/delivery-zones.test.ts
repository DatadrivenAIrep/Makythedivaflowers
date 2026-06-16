import { describe, it, expect } from "vitest";
import { findDeliveryZoneByZip, findDeliveryZoneByCity, isValidZip } from "@/lib/delivery-zones";

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
