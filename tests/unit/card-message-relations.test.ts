import { describe, it, expect } from "vitest";
import { getRelations } from "@/lib/card-message-relations";

describe("getRelations", () => {
  it("returns 6 chips in default mode (en)", () => {
    const r = getRelations("default", "en");
    expect(r).toHaveLength(6);
    expect(r.map((x) => x.key)).toEqual([
      "partner",
      "mother",
      "father",
      "friend",
      "family",
      "other",
    ]);
    expect(r[0]).toEqual({ key: "partner", label: "Partner" });
  });

  it("returns 6 chips in default mode (es) with localized labels", () => {
    const r = getRelations("default", "es");
    expect(r).toHaveLength(6);
    expect(r.find((x) => x.key === "partner")?.label).toBe("Pareja");
    expect(r.find((x) => x.key === "mother")?.label).toBe("Mamá");
    expect(r.find((x) => x.key === "friend")?.label).toBe("Amigx");
  });

  it("returns 4 chips in sympathy mode", () => {
    const r = getRelations("sympathy", "en");
    expect(r).toHaveLength(4);
    expect(r.map((x) => x.key)).toEqual(["family", "close-friend", "coworker", "other"]);
  });

  it("localizes sympathy mode in es", () => {
    const r = getRelations("sympathy", "es");
    expect(r.find((x) => x.key === "close-friend")?.label).toBe("Amistad cercana");
    expect(r.find((x) => x.key === "coworker")?.label).toBe("Compañerx de trabajo");
  });
});
