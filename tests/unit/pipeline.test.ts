import { describe, it, expect } from "vitest";
import {
  ACTIVE_STAGES, OPEN_STAGES, ALL_STAGES,
  isValidStage, budgetBandFloorCents,
  groupByStage, stageCounts, openPipelineValueCents,
  type PipelineInquiry,
} from "@/lib/pipeline";

function inq(p: Partial<PipelineInquiry>): PipelineInquiry {
  return {
    id: "i", type: "wedding", stage: "nuevo", contactName: "X",
    createdAt: "2026-07-01T00:00:00Z", ...p,
  };
}

describe("stage constants", () => {
  it("active is the 5 board columns; open excludes completado/perdido", () => {
    expect(ACTIVE_STAGES).toEqual(["nuevo", "contactado", "propuesta", "reservado", "completado"]);
    expect(OPEN_STAGES).toEqual(["nuevo", "contactado", "propuesta", "reservado"]);
    expect(ALL_STAGES).toEqual([...ACTIVE_STAGES, "perdido"]);
  });

  it("isValidStage guards the machine strings", () => {
    expect(isValidStage("reservado")).toBe(true);
    expect(isValidStage("perdido")).toBe(true);
    expect(isValidStage("bogus")).toBe(false);
  });
});

describe("budgetBandFloorCents", () => {
  it("maps each band to its floor; open/unknown → 0", () => {
    expect(budgetBandFloorCents("5-10k")).toBe(500000);
    expect(budgetBandFloorCents("10-25k")).toBe(1000000);
    expect(budgetBandFloorCents("25k+")).toBe(2500000);
    expect(budgetBandFloorCents("open")).toBe(0);
    expect(budgetBandFloorCents(undefined)).toBe(0);
  });
});

describe("groupByStage", () => {
  it("groups into all stages, sorted by follow-up then created; empty follow-up sorts last", () => {
    const groups = groupByStage([
      inq({ id: "a", stage: "nuevo", followUpDate: "2026-08-10" }),
      inq({ id: "b", stage: "nuevo" }), // no follow-up → last
      inq({ id: "c", stage: "nuevo", followUpDate: "2026-08-01" }),
      inq({ id: "d", stage: "reservado" }),
    ]);
    expect(groups.nuevo.map((i) => i.id)).toEqual(["c", "a", "b"]);
    expect(groups.reservado.map((i) => i.id)).toEqual(["d"]);
    expect(groups.perdido).toEqual([]);
    expect(Object.keys(groups).sort()).toEqual([...ALL_STAGES].sort());
  });
});

describe("stageCounts + openPipelineValueCents", () => {
  it("counts per stage and sums open value by band floor", () => {
    const list = [
      inq({ stage: "nuevo", budgetBand: "10-25k" }),      // 1,000,000
      inq({ stage: "reservado", budgetBand: "25k+" }),    // 2,500,000
      inq({ stage: "completado", budgetBand: "25k+" }),   // excluded (not open)
      inq({ stage: "perdido", budgetBand: "10-25k" }),    // excluded
    ];
    expect(stageCounts(list)).toEqual({
      nuevo: 1, contactado: 0, propuesta: 0, reservado: 1, completado: 1, perdido: 1,
    });
    expect(openPipelineValueCents(list)).toBe(3500000);
  });
});
