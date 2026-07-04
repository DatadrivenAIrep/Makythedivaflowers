import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import {
  addImportantDate, removeImportantDate, listDatesFor,
  normalizePreference, addPreference, removePreference,
  listPreferencesFor, listPreferenceValues, listUpcomingOccasions,
} from "@/lib/customer-dates-storage";

const NOW = new Date("2026-07-04T12:00:00Z");
const DAY = 86_400_000;

beforeEach(() => { vi.stubEnv("SQLITE_FILE", ":memory:"); runMigrations(); });
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

function seedCustomer(id: string, name: string, phone: string) {
  getDb().prepare(
    `INSERT INTO customers (id, name, phone, order_count, first_seen_at, last_seen_at)
     VALUES (?, ?, ?, 0, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')`,
  ).run(id, name, phone);
}

/** month/day that lands exactly `daysAhead` days after NOW (UTC). */
function monthDayIn(daysAhead: number): { month: number; day: number } {
  const d = new Date(NOW.getTime() + daysAhead * DAY);
  return { month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

describe("important dates CRUD", () => {
  it("adds and lists sorted by daysUntil; label/year optional", () => {
    seedCustomer("c1", "Ana", "5551");
    const far = monthDayIn(40);
    const near = monthDayIn(5);
    addImportantDate("c1", { kind: "anniversary", ...far, year: 2010 }, NOW);
    const dates = addImportantDate("c1", { kind: "birthday", label: "esposa María", ...near }, NOW);
    expect(dates).toHaveLength(2);
    expect(dates[0].kind).toBe("birthday");
    expect(dates[0].label).toBe("esposa María");
    expect(dates[0].next.daysUntil).toBe(5);
    expect(dates[1].year).toBe(2010);
    expect(dates[1].label).toBeUndefined();
    expect(dates[1].next.daysUntil).toBe(40);
  });

  it("allows multiple dates of the same kind", () => {
    seedCustomer("c1", "Ana", "5551");
    addImportantDate("c1", { kind: "birthday", label: "hija Eva", ...monthDayIn(3) }, NOW);
    const dates = addImportantDate("c1", { kind: "birthday", label: "hija Ana", ...monthDayIn(8) }, NOW);
    expect(dates.map((d) => d.label)).toEqual(["hija Eva", "hija Ana"]);
  });

  it("removes by id; removing an unknown id is a no-op", () => {
    seedCustomer("c1", "Ana", "5551");
    const [d] = addImportantDate("c1", { kind: "custom", label: "graduación", ...monthDayIn(10) }, NOW);
    expect(removeImportantDate("c1", "nope", NOW)).toHaveLength(1);
    expect(removeImportantDate("c1", d.id, NOW)).toEqual([]);
    expect(listDatesFor("c1", NOW)).toEqual([]);
  });
});

describe("preferences", () => {
  it("normalizePreference trims, collapses, lowercases, caps at 40", () => {
    expect(normalizePreference("  Rosas   Rojas ")).toBe("rosas rojas");
    expect(normalizePreference("A".repeat(60))).toBe("a".repeat(40));
    expect(normalizePreference("   ")).toBeNull();
  });

  it("add is idempotent per (kind, value); returns the sorted map", () => {
    seedCustomer("c1", "Ana", "5551");
    addPreference("c1", "favorite_flower", "peonías");
    addPreference("c1", "favorite_flower", "peonías");
    const map = addPreference("c1", "dislike", "lirios");
    expect(map.favorite_flower).toEqual(["peonías"]);
    expect(map.dislike).toEqual(["lirios"]);
    expect(map.favorite_color).toEqual([]);
  });

  it("removes a value; suggestions are distinct across customers per kind", () => {
    seedCustomer("c1", "Ana", "5551");
    seedCustomer("c2", "Bea", "5552");
    addPreference("c1", "favorite_color", "blanco");
    addPreference("c2", "favorite_color", "blanco");
    addPreference("c2", "favorite_color", "rosa");
    expect(listPreferenceValues("favorite_color")).toEqual(["blanco", "rosa"]);
    const map = removePreference("c2", "favorite_color", "rosa");
    expect(map.favorite_color).toEqual(["blanco"]);
    expect(listPreferencesFor("c2").favorite_color).toEqual(["blanco"]);
  });
});

describe("listUpcomingOccasions", () => {
  it("filters by window, sorts by daysUntil then name, joins customer fields", () => {
    seedCustomer("c1", "Ana", "5551");
    seedCustomer("c2", "Bea", "5552");
    seedCustomer("c3", "Carlos", "5553");
    addImportantDate("c2", { kind: "birthday", ...monthDayIn(10) }, NOW);
    addImportantDate("c1", { kind: "anniversary", label: "boda", ...monthDayIn(2) }, NOW);
    addImportantDate("c3", { kind: "custom", ...monthDayIn(40) }, NOW);

    const week = listUpcomingOccasions(7, NOW);
    expect(week.map((o) => o.customerName)).toEqual(["Ana"]);
    expect(week[0].phone).toBe("5551");
    expect(week[0].label).toBe("boda");
    expect(week[0].next.daysUntil).toBe(2);

    const month = listUpcomingOccasions(30, NOW);
    expect(month.map((o) => o.customerName)).toEqual(["Ana", "Bea"]);
  });

  it("same-day occasions tie-break by customer name", () => {
    seedCustomer("c1", "Zoe", "5551");
    seedCustomer("c2", "Ana", "5552");
    addImportantDate("c1", { kind: "birthday", ...monthDayIn(3) }, NOW);
    addImportantDate("c2", { kind: "birthday", ...monthDayIn(3) }, NOW);
    expect(listUpcomingOccasions(7, NOW).map((o) => o.customerName)).toEqual(["Ana", "Zoe"]);
  });
});
