import { describe, it, expect } from "vitest";
import { findDeliveryZoneByZip, isValidZip } from "@/lib/delivery-zones";

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
  it("returns the matching zone for a known ZIP", () => {
    const zone = findDeliveryZoneByZip("11010");
    expect(zone?.id).toBe("nassau-south");
  });

  it("returns the matching zone for a Queens ZIP", () => {
    const zone = findDeliveryZoneByZip("11354");
    expect(zone?.id).toBe("queens");
  });

  it("returns null for an out-of-zone ZIP", () => {
    expect(findDeliveryZoneByZip("90210")).toBeNull();
  });

  it("returns null for an invalid ZIP", () => {
    expect(findDeliveryZoneByZip("nope")).toBeNull();
  });
});
