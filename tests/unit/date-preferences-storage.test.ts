import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { addImportantDate, listDatesFor, removeImportantDate } from "@/lib/customer-dates-storage";
import { getDatePreferences, preferencesForRecipient, setDatePreferences } from "@/lib/date-preferences-storage";
import type { AvoidCode, ColorCode, FlowerCode } from "@/lib/date-preference-options";

const NOW = new Date("2026-07-04T12:00:00Z");

beforeEach(() => { vi.stubEnv("SQLITE_FILE", ":memory:"); runMigrations(); });
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

function mkDate(label: string, phone?: string, at: Date = NOW): string {
  const dates = addImportantDate("c1", { kind: "birthday", label, month: 8, day: 1, recipientPhone: phone }, at);
  return dates.find((d) => d.label === label)!.id;
}
const empty = { flowers: [], colors: [], avoid: [] };

describe("date preferences", () => {
  it("is empty when nothing was saved", () => {
    expect(getDatePreferences("nope")).toEqual(empty);
  });

  it("setDatePreferences drops unknown codes and duplicates, caps flowers/colors at 3", () => {
    const id = mkDate("Mamá");
    const out = setDatePreferences(id, {
      flowers: ["roses", "x", "roses", "tulips", "peonies", "orchids"] as unknown as FlowerCode[],
      colors: ["red", "pink", "white", "yellow", "nope"] as unknown as ColorCode[],
      avoid: ["strong_scent", "lilies", "strong_scent", "bad", "heavy_pollen"] as unknown as AvoidCode[],
    });
    expect(out.flowers).toEqual(["roses", "tulips", "peonies"]);
    expect(out.colors).toEqual(["red", "pink", "white"]);
    expect(out.avoid).toEqual(["strong_scent", "lilies", "heavy_pollen"]);
    expect(getDatePreferences(id)).toEqual(out);
  });

  it("replaces everything on each save", () => {
    const id = mkDate("Mamá");
    setDatePreferences(id, { flowers: ["roses"], colors: ["red"], avoid: ["lilies"] });
    expect(setDatePreferences(id, { flowers: ["tulips"], colors: [], avoid: [] })).toEqual({ flowers: ["tulips"], colors: [], avoid: [] });
  });

  it("deleting the date deletes its likes", () => {
    const id = mkDate("Mamá");
    setDatePreferences(id, { flowers: ["roses"], colors: [], avoid: [] });
    removeImportantDate("c1", id, NOW);
    expect(getDb().prepare("SELECT COUNT(*) AS n FROM date_preferences WHERE date_id = ?").get(id)).toEqual({ n: 0 });
    expect(listDatesFor("c1", NOW)).toHaveLength(0);
  });

  it("preferencesForRecipient finds the same person by phone or name", () => {
    const id = mkDate("Mamá", "3001234567");
    setDatePreferences(id, { flowers: ["peonies"], colors: ["pink"], avoid: [] });
    const want = { flowers: ["peonies"], colors: ["pink"], avoid: [] };
    expect(preferencesForRecipient("c1", { name: "otro", phone: "+57 300 123 4567" })).toEqual(want);
    expect(preferencesForRecipient("c1", { name: "  mamá " })).toEqual(want);
    expect(preferencesForRecipient("c1", { name: "Nadie" })).toBeNull();
    expect(preferencesForRecipient("c2", { name: "Mamá" })).toBeNull();
  });

  it("preferencesForRecipient uses the most recent date that has likes", () => {
    const old = mkDate("Ana", undefined, new Date("2026-01-01T00:00:00Z"));
    const mid = addImportantDate("c1", { kind: "anniversary", label: "ana", month: 9, day: 1 }, new Date("2026-03-01T00:00:00Z"))
      .find((d) => d.kind === "anniversary")!.id;
    const recent = addImportantDate("c1", { kind: "birthday", label: "ANA ", month: 10, day: 1 }, new Date("2026-05-01T00:00:00Z"))
      .find((d) => d.id !== old && d.id !== mid)!.id;
    setDatePreferences(old, { flowers: ["roses"], colors: [], avoid: [] });
    setDatePreferences(mid, { flowers: ["tulips"], colors: [], avoid: [] });
    expect(recent).toBeTruthy();
    expect(preferencesForRecipient("c1", { name: "Ana" })?.flowers).toEqual(["tulips"]);
  });
});
