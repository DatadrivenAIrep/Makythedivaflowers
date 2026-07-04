# Customer CRM Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add important dates (birthday/anniversary/custom with a "who it's for" label) and structured preferences (favorite flowers/colors, dislikes) to the customer profile, plus a read-only "Ocasiones" dashboard tab listing upcoming occasions — no automated sending.

**Architecture:** Calendar math (next annual occurrence, Feb-29 rule, month/day validation) lives in a new pure module `lib/customer-dates.ts` (mirroring how Phase 1 isolated segment math in `customer-metrics.ts`). A new storage module `lib/customer-dates-storage.ts` owns both new tables so `customer-storage.ts` stops growing. The occasions view computes next-occurrence in JS over all date rows (florist scale) rather than in SQL. Spec: `docs/superpowers/specs/2026-07-04-customer-crm-phase-2-design.md`.

**Tech Stack:** Next.js App Router (custom conventions — see `AGENTS.md`), node:sqlite via `lib/db.ts`, zod, next-intl, vitest + @testing-library/react, Tailwind tokens (`bone`, `ink`, `rouge`).

---

## Project conventions the engineer MUST know

1. **Node 22 required.** The shell default (v16) breaks vitest and next. Prefix EVERY command session with:
   ```bash
   export PATH="/opt/homebrew/bin:$PATH"   # node v22
   ```
2. **Run tests** with `npm test -- <file>`. The full suite has known-noisy baseline failures (print-chromium/print-render/_preview need Chrome; CartUpsellStrip is flaky; checkout-schema fails on main) — targeted files must pass 100%; the full suite must show no NEW failures vs `main`.
3. **DB:** `getDb()` from `@/lib/db` + `runMigrations()` from `@/lib/db-migrate` at the top of storage functions. Migrations in `db/migrations/*.sql` auto-apply sorted by filename. Phase 1 already added migration 012.
4. **Admin auth is middleware-level** (`proxy.ts`). Route handlers do NOT call auth; unit tests invoke handlers directly.
5. **Route handlers:** `export const runtime = "nodejs"`; dynamic params are `{ params }: { params: Promise<{ id: string }> }` and must be awaited; 404 (unknown customer) is checked BEFORE body validation (400).
6. **API tests** stub the DB: `vi.stubEnv("SQLITE_FILE", ":memory:")` + `runMigrations()` in `beforeEach`, `closeDb(); vi.unstubAllEnvs()` in `afterEach`.
7. **Component tests** wrap in `NextIntlClientProvider` with the REAL `messages/es.json` (missing keys throw). See `tests/unit/CustomersList.test.tsx`.
8. **i18n:** `messages/en.json` and `messages/es.json` must keep identical key paths — `tests/unit/i18n-parity.test.ts` gates this.
9. **`import type` for client components importing from server modules.** `lib/customer-dates-storage.ts` begins with `import "server-only"`; client components may import its TYPES only, and must write `import type { ... }` (type-only imports are erased at build time, so the server-only guard never fires). `lib/customer-dates.ts` has NO server-only import — client components may import its functions freely.
10. **Branch:** create `feature/customer-crm-phase-2` off `main` before Task 1. Do NOT push. Commits end with:
    ```
    Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
    ```

**Timezone decision (from spec):** all "days until" math is on a **UTC calendar-day basis** (consistent with Phase 1's `customerStats` month boundary). `daysUntil === 0` means today (UTC).

**Feb 29 rule (from spec):** stored Feb 29 occurs on **Feb 28** in non-leap years.

---

### Task 1: Migration `013_customer_crm_phase2.sql`

**Files:**
- Create: `db/migrations/013_customer_crm_phase2.sql`
- Test: `tests/unit/customer-crm-phase2-migration.test.ts`

- [ ] **Step 0: Create the feature branch**

```bash
cd "/Users/santiagocardonacastellanos/Desktop/Diva Flowers"
git checkout -b feature/customer-crm-phase-2
```

- [ ] **Step 1: Write the failing test**

Create `tests/unit/customer-crm-phase2-migration.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";

beforeEach(() => { vi.stubEnv("SQLITE_FILE", ":memory:"); runMigrations(); });
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

describe("013_customer_crm_phase2 migration", () => {
  it("creates customer_important_dates with all columns", () => {
    const db = getDb();
    db.prepare(
      `INSERT INTO customer_important_dates (id, customer_id, kind, label, month, day, year, created_at)
       VALUES ('cid_1', 'c1', 'birthday', 'esposa María', 3, 15, 1985, '2026-07-04T00:00:00Z')`,
    ).run();
    const row = db.prepare("SELECT * FROM customer_important_dates WHERE id = 'cid_1'").get() as {
      kind: string; label: string; month: number; day: number; year: number;
    };
    expect(row.kind).toBe("birthday");
    expect(row.label).toBe("esposa María");
    expect(row.month).toBe(3);
    expect(row.day).toBe(15);
    expect(row.year).toBe(1985);
  });

  it("creates customer_preferences with composite PK deduping", () => {
    const db = getDb();
    db.prepare("INSERT OR IGNORE INTO customer_preferences (customer_id, kind, value) VALUES ('c1', 'dislike', 'lirios')").run();
    db.prepare("INSERT OR IGNORE INTO customer_preferences (customer_id, kind, value) VALUES ('c1', 'dislike', 'lirios')").run();
    const n = db.prepare("SELECT COUNT(*) AS n FROM customer_preferences").get() as { n: number };
    expect(n.n).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
export PATH="/opt/homebrew/bin:$PATH"
npm test -- tests/unit/customer-crm-phase2-migration.test.ts
```
Expected: FAIL — `no such table: customer_important_dates`.

- [ ] **Step 3: Write the migration**

Create `db/migrations/013_customer_crm_phase2.sql`:

```sql
-- 013_customer_crm_phase2.sql — CRM Phase 2: important dates + structured preferences.
CREATE TABLE IF NOT EXISTS customer_important_dates (
  id           TEXT PRIMARY KEY,
  customer_id  TEXT NOT NULL,
  kind         TEXT NOT NULL,
  label        TEXT,
  month        INTEGER NOT NULL,
  day          INTEGER NOT NULL,
  year         INTEGER,
  created_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_important_dates_customer ON customer_important_dates(customer_id);
CREATE INDEX IF NOT EXISTS idx_important_dates_month_day ON customer_important_dates(month, day);

CREATE TABLE IF NOT EXISTS customer_preferences (
  customer_id  TEXT NOT NULL,
  kind         TEXT NOT NULL,
  value        TEXT NOT NULL,
  PRIMARY KEY (customer_id, kind, value)
);
CREATE INDEX IF NOT EXISTS idx_customer_preferences_kind_value ON customer_preferences(kind, value);
CREATE INDEX IF NOT EXISTS idx_customer_preferences_customer ON customer_preferences(customer_id);
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- tests/unit/customer-crm-phase2-migration.test.ts
```
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add db/migrations/013_customer_crm_phase2.sql tests/unit/customer-crm-phase2-migration.test.ts
git commit -m "feat(crm): migration 013 — important dates + preferences tables

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Pure module `lib/customer-dates.ts`

**Files:**
- Create: `lib/customer-dates.ts`
- Test: `tests/unit/customer-dates.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/customer-dates.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { nextOccurrence, isValidMonthDay, formatMonthDay } from "@/lib/customer-dates";

// 2026 and 2027 are non-leap; 2028 is leap.
const NOW = new Date("2026-07-04T12:00:00Z");

describe("nextOccurrence", () => {
  it("today → daysUntil 0 with today's date", () => {
    expect(nextOccurrence(7, 4, NOW)).toEqual({ date: "2026-07-04", daysUntil: 0 });
  });

  it("tomorrow → 1", () => {
    expect(nextOccurrence(7, 5, NOW)).toEqual({ date: "2026-07-05", daysUntil: 1 });
  });

  it("already passed this year → next year", () => {
    expect(nextOccurrence(7, 3, NOW)).toEqual({ date: "2027-07-03", daysUntil: 364 });
  });

  it("Dec→Jan year rollover", () => {
    const dec31 = new Date("2026-12-31T23:00:00Z");
    expect(nextOccurrence(1, 1, dec31)).toEqual({ date: "2027-01-01", daysUntil: 1 });
  });

  it("Feb 29 in a leap year occurs on Feb 29", () => {
    const now = new Date("2028-02-01T00:00:00Z");
    expect(nextOccurrence(2, 29, now)).toEqual({ date: "2028-02-29", daysUntil: 28 });
  });

  it("Feb 29 in a non-leap year maps to Feb 28", () => {
    const now = new Date("2027-02-01T00:00:00Z");
    expect(nextOccurrence(2, 29, now)).toEqual({ date: "2027-02-28", daysUntil: 27 });
  });

  it("Feb 29 already passed in a non-leap year → next leap year's Feb 29", () => {
    const now = new Date("2027-03-01T00:00:00Z");
    expect(nextOccurrence(2, 29, now).date).toBe("2028-02-29");
  });
});

describe("isValidMonthDay", () => {
  it("accepts real month/day combos including Feb 29", () => {
    expect(isValidMonthDay(6, 15)).toBe(true);
    expect(isValidMonthDay(2, 29)).toBe(true);
    expect(isValidMonthDay(12, 31)).toBe(true);
  });

  it("rejects impossible combos and non-integers", () => {
    expect(isValidMonthDay(2, 30)).toBe(false);
    expect(isValidMonthDay(4, 31)).toBe(false);
    expect(isValidMonthDay(13, 1)).toBe(false);
    expect(isValidMonthDay(0, 5)).toBe(false);
    expect(isValidMonthDay(1.5, 3)).toBe(false);
    expect(isValidMonthDay(6, 0)).toBe(false);
  });
});

describe("formatMonthDay", () => {
  it("formats month/day in the requested locale without timezone drift", () => {
    expect(formatMonthDay(3, 15, "es")).toContain("15");
    expect(formatMonthDay(3, 15, "es").toLowerCase()).toContain("mar");
    expect(formatMonthDay(3, 15, "en")).toContain("15");
    expect(formatMonthDay(3, 15, "en")).toContain("Mar");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/unit/customer-dates.test.ts
```
Expected: FAIL — cannot resolve `@/lib/customer-dates`.

- [ ] **Step 3: Write the implementation**

Create `lib/customer-dates.ts` (NO `server-only` import — client components use these helpers):

```ts
// Pure calendar math for CRM important dates. No DB, no server-only — client
// components import these helpers directly. All day math is on a UTC
// calendar-day basis (consistent with customerStats' month boundary).

export type DateKind = "birthday" | "anniversary" | "custom";
export type PreferenceKind = "favorite_flower" | "favorite_color" | "dislike";

export const DATE_KINDS: readonly DateKind[] = ["birthday", "anniversary", "custom"];
export const PREFERENCE_KINDS: readonly PreferenceKind[] = [
  "favorite_flower",
  "favorite_color",
  "dislike",
];

// Max day per month; February allows 29 (leap handling happens at occurrence time).
export const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

const DAY_MS = 24 * 60 * 60 * 1000;

export function isValidMonthDay(month: number, day: number): boolean {
  if (!Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (month < 1 || month > 12) return false;
  return day >= 1 && day <= DAYS_IN_MONTH[month - 1];
}

function isLeapYear(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

export type NextOccurrence = { date: string; daysUntil: number };

/**
 * Next annual occurrence of month/day on a UTC calendar-day basis.
 * daysUntil === 0 means today. Feb 29 occurs on Feb 28 in non-leap years.
 */
export function nextOccurrence(month: number, day: number, now: Date): NextOccurrence {
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const startYear = now.getUTCFullYear();
  for (let year = startYear; year <= startYear + 1; year++) {
    const effDay = month === 2 && day === 29 && !isLeapYear(year) ? 28 : day;
    const candidate = Date.UTC(year, month - 1, effDay);
    if (candidate >= todayUtc) {
      return {
        date: new Date(candidate).toISOString().slice(0, 10),
        daysUntil: Math.round((candidate - todayUtc) / DAY_MS),
      };
    }
  }
  /* istanbul ignore next -- next year's occurrence is always >= today */
  throw new Error("nextOccurrence: unreachable");
}

/** "15 mar" / "Mar 15" — formats from integers with timeZone:"UTC" so the
 * rendered day never drifts across the viewer's local midnight. */
export function formatMonthDay(month: number, day: number, locale: string): string {
  return new Date(Date.UTC(2000, month - 1, day)).toLocaleDateString(
    locale === "es" ? "es-ES" : "en-US",
    { month: "short", day: "numeric", timeZone: "UTC" },
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- tests/unit/customer-dates.test.ts
```
Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/customer-dates.ts tests/unit/customer-dates.test.ts
git commit -m "feat(crm): pure calendar module — next occurrence, month/day validation

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Storage module `lib/customer-dates-storage.ts`

**Files:**
- Create: `lib/customer-dates-storage.ts`
- Test: `tests/unit/customer-dates-storage.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/customer-dates-storage.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/unit/customer-dates-storage.test.ts
```
Expected: FAIL — cannot resolve `@/lib/customer-dates-storage`.

- [ ] **Step 3: Write the implementation**

Create `lib/customer-dates-storage.ts`:

```ts
import "server-only";
import { getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import {
  nextOccurrence,
  PREFERENCE_KINDS,
  type DateKind,
  type NextOccurrence,
  type PreferenceKind,
} from "@/lib/customer-dates";

export type ImportantDate = {
  id: string;
  customerId: string;
  kind: DateKind;
  label?: string;
  month: number;
  day: number;
  year?: number;
  createdAt: string;
  next: NextOccurrence;
};

export type PreferencesMap = Record<PreferenceKind, string[]>;

export type UpcomingOccasion = {
  dateId: string;
  customerId: string;
  customerName: string;
  phone: string;
  kind: DateKind;
  label?: string;
  next: NextOccurrence;
};

type DateRow = {
  id: string;
  customer_id: string;
  kind: string;
  label: string | null;
  month: number;
  day: number;
  year: number | null;
  created_at: string;
};

function newId(): string {
  return `cid_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function rowToDate(r: DateRow, now: Date): ImportantDate {
  return {
    id: r.id,
    customerId: r.customer_id,
    kind: r.kind as DateKind,
    label: r.label ?? undefined,
    month: r.month,
    day: r.day,
    year: r.year ?? undefined,
    createdAt: r.created_at,
    next: nextOccurrence(r.month, r.day, now),
  };
}

export type ImportantDateInput = {
  kind: DateKind;
  label?: string;
  month: number;
  day: number;
  year?: number;
};

export function addImportantDate(
  customerId: string,
  input: ImportantDateInput,
  now: Date = new Date(),
): ImportantDate[] {
  runMigrations();
  getDb()
    .prepare(
      `INSERT INTO customer_important_dates (id, customer_id, kind, label, month, day, year, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      newId(),
      customerId,
      input.kind,
      input.label?.trim() || null,
      input.month,
      input.day,
      input.year ?? null,
      now.toISOString(),
    );
  return listDatesFor(customerId, now);
}

export function removeImportantDate(
  customerId: string,
  dateId: string,
  now: Date = new Date(),
): ImportantDate[] {
  runMigrations();
  getDb()
    .prepare("DELETE FROM customer_important_dates WHERE customer_id = ? AND id = ?")
    .run(customerId, dateId);
  return listDatesFor(customerId, now);
}

export function listDatesFor(customerId: string, now: Date = new Date()): ImportantDate[] {
  runMigrations();
  const rows = getDb()
    .prepare("SELECT * FROM customer_important_dates WHERE customer_id = ?")
    .all(customerId) as DateRow[];
  return rows
    .map((r) => rowToDate(r, now))
    .sort((a, b) => a.next.daysUntil - b.next.daysUntil || a.id.localeCompare(b.id));
}

export const PREFERENCE_MAX_LENGTH = 40;

/** trim + collapse inner whitespace + lowercase + cap length; null when empty. */
export function normalizePreference(raw: string): string | null {
  const v = raw.trim().replace(/\s+/g, " ").toLowerCase().slice(0, PREFERENCE_MAX_LENGTH).trim();
  return v.length ? v : null;
}

function emptyPreferences(): PreferencesMap {
  return { favorite_flower: [], favorite_color: [], dislike: [] };
}

export function listPreferencesFor(customerId: string): PreferencesMap {
  runMigrations();
  const rows = getDb()
    .prepare("SELECT kind, value FROM customer_preferences WHERE customer_id = ? ORDER BY value")
    .all(customerId) as Array<{ kind: string; value: string }>;
  const map = emptyPreferences();
  for (const r of rows) {
    if ((PREFERENCE_KINDS as readonly string[]).includes(r.kind)) {
      map[r.kind as PreferenceKind].push(r.value);
    }
  }
  return map;
}

export function addPreference(
  customerId: string,
  kind: PreferenceKind,
  value: string,
): PreferencesMap {
  runMigrations();
  getDb()
    .prepare("INSERT OR IGNORE INTO customer_preferences (customer_id, kind, value) VALUES (?, ?, ?)")
    .run(customerId, kind, value);
  return listPreferencesFor(customerId);
}

export function removePreference(
  customerId: string,
  kind: PreferenceKind,
  value: string,
): PreferencesMap {
  runMigrations();
  getDb()
    .prepare("DELETE FROM customer_preferences WHERE customer_id = ? AND kind = ? AND value = ?")
    .run(customerId, kind, value);
  return listPreferencesFor(customerId);
}

export function listPreferenceValues(kind: PreferenceKind): string[] {
  runMigrations();
  const rows = getDb()
    .prepare("SELECT DISTINCT value FROM customer_preferences WHERE kind = ? ORDER BY value")
    .all(kind) as Array<{ value: string }>;
  return rows.map((r) => r.value);
}

export function listUpcomingOccasions(
  withinDays: number,
  now: Date = new Date(),
): UpcomingOccasion[] {
  runMigrations();
  const rows = getDb()
    .prepare(
      `SELECT d.id AS date_id, d.customer_id, d.kind, d.label, d.month, d.day,
              c.name AS customer_name, c.phone
       FROM customer_important_dates d
       JOIN customers c ON c.id = d.customer_id`,
    )
    .all() as Array<{
    date_id: string;
    customer_id: string;
    kind: string;
    label: string | null;
    month: number;
    day: number;
    customer_name: string;
    phone: string;
  }>;
  return rows
    .map((r) => ({
      dateId: r.date_id,
      customerId: r.customer_id,
      customerName: r.customer_name,
      phone: r.phone,
      kind: r.kind as DateKind,
      label: r.label ?? undefined,
      next: nextOccurrence(r.month, r.day, now),
    }))
    .filter((o) => o.next.daysUntil <= withinDays)
    .sort(
      (a, b) =>
        a.next.daysUntil - b.next.daysUntil || a.customerName.localeCompare(b.customerName),
    );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- tests/unit/customer-dates-storage.test.ts
```
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/customer-dates-storage.ts tests/unit/customer-dates-storage.test.ts
git commit -m "feat(crm): dates + preferences storage and upcoming-occasions query

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Schemas + dates API route

**Files:**
- Create: `schemas/customer-dates.ts`
- Create: `app/api/admin/customers/[id]/dates/route.ts`
- Test: `tests/unit/api-admin-customers-dates.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/api-admin-customers-dates.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { POST, DELETE } from "@/app/api/admin/customers/[id]/dates/route";

beforeEach(() => { vi.stubEnv("SQLITE_FILE", ":memory:"); runMigrations(); });
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

function seed() {
  getDb().prepare(
    `INSERT INTO customers (id, name, phone, order_count, first_seen_at, last_seen_at)
     VALUES ('c1', 'Ana', '5551', 0, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')`,
  ).run();
}

const ctx = { params: Promise.resolve({ id: "c1" }) };
const post = (body: unknown) =>
  new Request("http://x", { method: "POST", body: JSON.stringify(body) });

describe("POST /dates", () => {
  it("adds a date and returns the updated list", async () => {
    seed();
    const res = await POST(post({ kind: "birthday", label: "esposa María", month: 3, day: 15 }), ctx);
    expect(res.status).toBe(200);
    const { dates } = await res.json();
    expect(dates).toHaveLength(1);
    expect(dates[0].kind).toBe("birthday");
    expect(dates[0].label).toBe("esposa María");
    expect(typeof dates[0].next.daysUntil).toBe("number");
  });

  it("400s on impossible month/day (Apr 31) and on zod-invalid bodies", async () => {
    seed();
    expect((await POST(post({ kind: "birthday", month: 4, day: 31 }), ctx)).status).toBe(400);
    expect((await POST(post({ kind: "birthday", month: 13, day: 1 }), ctx)).status).toBe(400);
    expect((await POST(post({ kind: "bogus", month: 3, day: 15 }), ctx)).status).toBe(400);
  });

  it("404s on unknown customer", async () => {
    const res = await POST(post({ kind: "birthday", month: 3, day: 15 }), {
      params: Promise.resolve({ id: "nope" }),
    });
    expect(res.status).toBe(404);
  });
});

describe("DELETE /dates", () => {
  it("removes by id; unknown id is an idempotent no-op", async () => {
    seed();
    const created = await (await POST(post({ kind: "custom", month: 6, day: 1 }), ctx)).json();
    const id = created.dates[0].id;

    const miss = await DELETE(post({ id: "nope" }), ctx);
    expect(miss.status).toBe(200);
    expect((await miss.json()).dates).toHaveLength(1);

    const hit = await DELETE(post({ id }), ctx);
    expect((await hit.json()).dates).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/unit/api-admin-customers-dates.test.ts
```
Expected: FAIL — cannot resolve the route module.

- [ ] **Step 3: Write schemas and route**

Create `schemas/customer-dates.ts`:

```ts
import { z } from "zod";

export const importantDateSchema = z.object({
  kind: z.enum(["birthday", "anniversary", "custom"]),
  label: z.string().trim().max(60).optional(),
  month: z.number().int().min(1).max(12),
  day: z.number().int().min(1).max(31),
  year: z.number().int().min(1900).max(2100).optional(),
});
export type ImportantDateBody = z.infer<typeof importantDateSchema>;

export const dateDeleteSchema = z.object({ id: z.string().min(1) });

export const preferenceBodySchema = z.object({
  kind: z.enum(["favorite_flower", "favorite_color", "dislike"]),
  value: z.string().min(1).max(64),
});
```

Create `app/api/admin/customers/[id]/dates/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getCustomerById } from "@/lib/customer-storage";
import { addImportantDate, removeImportantDate } from "@/lib/customer-dates-storage";
import { isValidMonthDay } from "@/lib/customer-dates";
import { dateDeleteSchema, importantDateSchema } from "@/schemas/customer-dates";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx): Promise<Response> {
  const { id } = await params;
  if (!getCustomerById(id)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const json = await req.json().catch(() => null);
  const parsed = importantDateSchema.safeParse(json);
  if (!parsed.success || !isValidMonthDay(parsed.data.month, parsed.data.day)) {
    return NextResponse.json({ error: "invalid_date" }, { status: 400 });
  }
  return NextResponse.json({ dates: addImportantDate(id, parsed.data) });
}

export async function DELETE(req: Request, { params }: Ctx): Promise<Response> {
  const { id } = await params;
  if (!getCustomerById(id)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const json = await req.json().catch(() => null);
  const parsed = dateDeleteSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  return NextResponse.json({ dates: removeImportantDate(id, parsed.data.id) });
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- tests/unit/api-admin-customers-dates.test.ts
```
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add schemas/customer-dates.ts "app/api/admin/customers/[id]/dates/route.ts" tests/unit/api-admin-customers-dates.test.ts
git commit -m "feat(crm): important-dates endpoints + zod schemas

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Preferences API route

**Files:**
- Create: `app/api/admin/customers/[id]/preferences/route.ts`
- Test: `tests/unit/api-admin-customers-preferences.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/api-admin-customers-preferences.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { POST, DELETE } from "@/app/api/admin/customers/[id]/preferences/route";

beforeEach(() => { vi.stubEnv("SQLITE_FILE", ":memory:"); runMigrations(); });
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

function seed() {
  getDb().prepare(
    `INSERT INTO customers (id, name, phone, order_count, first_seen_at, last_seen_at)
     VALUES ('c1', 'Ana', '5551', 0, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')`,
  ).run();
}

const ctx = { params: Promise.resolve({ id: "c1" }) };
const req = (body: unknown) =>
  new Request("http://x", { method: "POST", body: JSON.stringify(body) });

describe("POST /preferences", () => {
  it("adds a normalized value and returns the map", async () => {
    seed();
    const res = await POST(req({ kind: "dislike", value: "  Lirios " }), ctx);
    expect(res.status).toBe(200);
    expect((await res.json()).preferences.dislike).toEqual(["lirios"]);
  });

  it("400s on whitespace-only value and invalid kind", async () => {
    seed();
    expect((await POST(req({ kind: "dislike", value: "   " }), ctx)).status).toBe(400);
    expect((await POST(req({ kind: "bogus", value: "rosas" }), ctx)).status).toBe(400);
  });

  it("404s on unknown customer", async () => {
    const res = await POST(req({ kind: "dislike", value: "lirios" }), {
      params: Promise.resolve({ id: "nope" }),
    });
    expect(res.status).toBe(404);
  });
});

describe("DELETE /preferences", () => {
  it("removes a value and returns the remaining map", async () => {
    seed();
    await POST(req({ kind: "favorite_flower", value: "peonías" }), ctx);
    await POST(req({ kind: "favorite_flower", value: "rosas" }), ctx);
    const res = await DELETE(req({ kind: "favorite_flower", value: "peonías" }), ctx);
    expect(res.status).toBe(200);
    expect((await res.json()).preferences.favorite_flower).toEqual(["rosas"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/unit/api-admin-customers-preferences.test.ts
```
Expected: FAIL — cannot resolve the route module.

- [ ] **Step 3: Write the route**

Create `app/api/admin/customers/[id]/preferences/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getCustomerById } from "@/lib/customer-storage";
import {
  addPreference,
  normalizePreference,
  removePreference,
} from "@/lib/customer-dates-storage";
import type { PreferenceKind } from "@/lib/customer-dates";
import { preferenceBodySchema } from "@/schemas/customer-dates";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

async function parseBody(req: Request): Promise<{ kind: PreferenceKind; value: string } | null> {
  const json = await req.json().catch(() => null);
  const parsed = preferenceBodySchema.safeParse(json);
  if (!parsed.success) return null;
  const value = normalizePreference(parsed.data.value);
  if (!value) return null;
  return { kind: parsed.data.kind, value };
}

export async function POST(req: Request, { params }: Ctx): Promise<Response> {
  const { id } = await params;
  if (!getCustomerById(id)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const body = await parseBody(req);
  if (!body) return NextResponse.json({ error: "invalid_preference" }, { status: 400 });
  return NextResponse.json({ preferences: addPreference(id, body.kind, body.value) });
}

export async function DELETE(req: Request, { params }: Ctx): Promise<Response> {
  const { id } = await params;
  if (!getCustomerById(id)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const body = await parseBody(req);
  if (!body) return NextResponse.json({ error: "invalid_preference" }, { status: 400 });
  return NextResponse.json({ preferences: removePreference(id, body.kind, body.value) });
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- tests/unit/api-admin-customers-preferences.test.ts
```
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add "app/api/admin/customers/[id]/preferences/route.ts" tests/unit/api-admin-customers-preferences.test.ts
git commit -m "feat(crm): preference add/remove endpoints

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Occasions API route

**Files:**
- Create: `app/api/admin/occasions/route.ts`
- Test: `tests/unit/api-admin-occasions.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/api-admin-occasions.test.ts`. The route uses real `new Date()`, so seeds are placed relative to runtime now:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { addImportantDate } from "@/lib/customer-dates-storage";
import { GET } from "@/app/api/admin/occasions/route";

const DAY = 86_400_000;

beforeEach(() => { vi.stubEnv("SQLITE_FILE", ":memory:"); runMigrations(); });
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

function seedCustomer(id: string, name: string, phone: string) {
  getDb().prepare(
    `INSERT INTO customers (id, name, phone, order_count, first_seen_at, last_seen_at)
     VALUES (?, ?, ?, 0, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')`,
  ).run(id, name, phone);
}

function monthDayIn(daysAhead: number): { month: number; day: number } {
  const d = new Date(Date.now() + daysAhead * DAY);
  return { month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

function seed() {
  seedCustomer("c1", "Ana", "5551");
  seedCustomer("c2", "Bea", "5552");
  addImportantDate("c1", { kind: "birthday", ...monthDayIn(2) });
  addImportantDate("c2", { kind: "anniversary", ...monthDayIn(20) });
}

it("defaults to a 30-day window sorted by daysUntil", async () => {
  seed();
  const res = await GET(new Request("http://x/api/admin/occasions"));
  expect(res.status).toBe(200);
  const { occasions } = await res.json();
  expect(occasions.map((o: { customerName: string }) => o.customerName)).toEqual(["Ana", "Bea"]);
});

it("days=7 narrows the window", async () => {
  seed();
  const { occasions } = await (await GET(new Request("http://x/api/admin/occasions?days=7"))).json();
  expect(occasions.map((o: { customerName: string }) => o.customerName)).toEqual(["Ana"]);
});

it("clamps out-of-range days values instead of erroring", async () => {
  seed();
  const big = await (await GET(new Request("http://x/api/admin/occasions?days=9999"))).json();
  expect(big.occasions).toHaveLength(2); // clamped to 366, both still inside

  const zero = await (await GET(new Request("http://x/api/admin/occasions?days=0"))).json();
  expect(zero.occasions.length).toBeLessThanOrEqual(1); // clamped to 1

  const junk = await GET(new Request("http://x/api/admin/occasions?days=abc"));
  expect(junk.status).toBe(200); // falls back to default
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/unit/api-admin-occasions.test.ts
```
Expected: FAIL — cannot resolve the route module.

- [ ] **Step 3: Write the route**

Create `app/api/admin/occasions/route.ts`:

```ts
import { NextResponse } from "next/server";
import { listUpcomingOccasions } from "@/lib/customer-dates-storage";

export const runtime = "nodejs";

export async function GET(req: Request): Promise<Response> {
  const raw = Number(new URL(req.url).searchParams.get("days") ?? 30);
  const days = Number.isFinite(raw) ? Math.min(Math.max(Math.floor(raw), 1), 366) : 30;
  return NextResponse.json({ occasions: listUpcomingOccasions(days) });
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- tests/unit/api-admin-occasions.test.ts
```
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/occasions/route.ts tests/unit/api-admin-occasions.test.ts
git commit -m "feat(crm): upcoming-occasions endpoint

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: Profile composition includes dates + preferences

**Files:**
- Modify: `lib/customer-profile.ts`
- Test: `tests/unit/api-admin-customers-detail.test.ts` (extend existing file)

- [ ] **Step 1: Extend the existing test**

In `tests/unit/api-admin-customers-detail.test.ts`, add these imports at the top (next to the existing `addTag` import):

```ts
import { addImportantDate, addPreference } from "@/lib/customer-dates-storage";
```

Then APPEND this test inside the existing `describe("GET /api/admin/customers/[id]", ...)` block:

```ts
  it("includes dates and preferences in the profile", async () => {
    seed();
    addImportantDate("c1", { kind: "birthday", label: "esposa", month: 3, day: 15 });
    addPreference("c1", "dislike", "lirios");
    const res = await GET(new Request("http://x"), ctx("c1"));
    const body = await res.json();
    expect(body.dates).toHaveLength(1);
    expect(body.dates[0].kind).toBe("birthday");
    expect(body.preferences.dislike).toEqual(["lirios"]);
    expect(body.preferences.favorite_flower).toEqual([]);
  });
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm test -- tests/unit/api-admin-customers-detail.test.ts
```
Expected: the new test FAILS (`body.dates` undefined); the 5 pre-existing tests still pass.

- [ ] **Step 3: Modify `lib/customer-profile.ts`**

Replace the whole file with:

```ts
import "server-only";
import { getCustomerById, listTagsFor, type Customer } from "@/lib/customer-storage";
import { listOrdersByCustomer } from "@/lib/order-storage";
import { computeMetrics, type CustomerMetrics } from "@/lib/customer-metrics";
import {
  listDatesFor,
  listPreferencesFor,
  type ImportantDate,
  type PreferencesMap,
} from "@/lib/customer-dates-storage";
import type { Order } from "@/types/order";

export type CustomerProfileData = {
  customer: Customer;
  metrics: CustomerMetrics;
  tags: string[];
  orders: Order[];
  dates: ImportantDate[];
  preferences: PreferencesMap;
};

export function getCustomerProfile(id: string, now: Date = new Date()): CustomerProfileData | null {
  const customer = getCustomerById(id);
  if (!customer) return null;
  const orders = listOrdersByCustomer(id);
  const metrics = computeMetrics(
    orders.map((o) => ({
      totalCents: o.totals.totalCents,
      amountPaidCents: o.amountPaidCents ?? 0,
      createdAt: o.createdAt,
    })),
    now,
    { firstSeenAt: customer.firstSeenAt, lastSeenAt: customer.lastSeenAt },
  );
  return {
    customer,
    metrics,
    tags: listTagsFor(id),
    orders,
    dates: listDatesFor(id, now),
    preferences: listPreferencesFor(id),
  };
}
```

- [ ] **Step 4: Keep the existing profile-component fixture type-correct**

`CustomerProfileData` just gained two required fields, so the fixture in `tests/unit/CustomerProfile.test.tsx` no longer typechecks. Fix it NOW (the component itself doesn't change until Task 9). In that file's `profile` fixture, after the line `tags: ["boda"],` and before `orders: [order],` add:

```tsx
  dates: [],
  preferences: { favorite_flower: [], favorite_color: [], dislike: [] },
```

- [ ] **Step 5: Run to verify everything passes**

```bash
npm test -- tests/unit/api-admin-customers-detail.test.ts tests/unit/CustomerProfile.test.tsx
npx tsc --noEmit
```
Expected: PASS (6 API tests + 2 component tests); tsc clean.

- [ ] **Step 6: Commit**

```bash
git add lib/customer-profile.ts tests/unit/api-admin-customers-detail.test.ts tests/unit/CustomerProfile.test.tsx
git commit -m "feat(crm): profile composition returns dates + preferences

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: i18n — Phase 2 keys (es/en)

**Files:**
- Modify: `messages/es.json`
- Modify: `messages/en.json`

- [ ] **Step 1: Add Spanish keys**

In `messages/es.json`:

**(a)** Inside `"admin_dashboard"`, immediately after the line `"nav_customers": "Clientes",` add:

```json
"nav_occasions": "Ocasiones",
```

**(b)** Inside the `"admin_customers"` namespace, immediately after the line `"not_found": "Cliente no encontrado"` — i.e. replace that line with `"not_found": "Cliente no encontrado",` (note the trailing comma) followed by:

```json
"dates_section": "Fechas importantes",
"date_kind_birthday": "Cumpleaños",
"date_kind_anniversary": "Aniversario",
"date_kind_custom": "Personalizada",
"date_label_placeholder": "para quién (ej. esposa María)",
"date_month": "Mes",
"date_day": "Día",
"date_year": "Año (opcional)",
"date_add": "Añadir fecha",
"date_today": "HOY",
"date_in_days": "en {days} días",
"date_remove": "Quitar",
"no_dates": "Sin fechas guardadas.",
"prefs_section": "Preferencias",
"pref_favorite_flower": "Flores favoritas",
"pref_favorite_color": "Colores favoritos",
"pref_dislike": "No le gusta / alergias",
"pref_placeholder": "añadir…",
"pref_add": "Añadir",
"occasions_title": "Ocasiones",
"occasions_next_7": "Próximos 7 días",
"occasions_next_30": "Próximos 30 días",
"no_occasions": "No hay ocasiones en este rango."
```

- [ ] **Step 2: Add English keys**

In `messages/en.json`:

**(a)** Inside `"admin_dashboard"`, immediately after `"nav_customers": "Customers",` add:

```json
"nav_occasions": "Occasions",
```

**(b)** Inside `"admin_customers"`, after `"not_found": "Customer not found"` (adding the trailing comma to it):

```json
"dates_section": "Important dates",
"date_kind_birthday": "Birthday",
"date_kind_anniversary": "Anniversary",
"date_kind_custom": "Custom",
"date_label_placeholder": "who it's for (e.g. wife María)",
"date_month": "Month",
"date_day": "Day",
"date_year": "Year (optional)",
"date_add": "Add date",
"date_today": "TODAY",
"date_in_days": "in {days} days",
"date_remove": "Remove",
"no_dates": "No dates saved.",
"prefs_section": "Preferences",
"pref_favorite_flower": "Favorite flowers",
"pref_favorite_color": "Favorite colors",
"pref_dislike": "Dislikes / allergies",
"pref_placeholder": "add…",
"pref_add": "Add",
"occasions_title": "Occasions",
"occasions_next_7": "Next 7 days",
"occasions_next_30": "Next 30 days",
"no_occasions": "No occasions in this range."
```

- [ ] **Step 3: Validate JSON + parity**

```bash
node -e "JSON.parse(require('fs').readFileSync('messages/es.json','utf8')); JSON.parse(require('fs').readFileSync('messages/en.json','utf8')); console.log('JSON OK')"
npm test -- tests/unit/i18n-parity.test.ts
```
Expected: `JSON OK` and parity PASS.

- [ ] **Step 4: Commit**

```bash
git add messages/es.json messages/en.json
git commit -m "feat(crm): i18n keys for dates, preferences, occasions (es/en)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 9: Profile sections — `ImportantDates` + `PreferenceChips` + wiring

**Files:**
- Create: `components/admin/customers/ImportantDates.tsx`
- Create: `components/admin/customers/PreferenceChips.tsx`
- Modify: `components/admin/customers/CustomerProfile.tsx`
- Modify: `app/[locale]/admin/customers/[id]/page.tsx`
- Test: `tests/unit/ImportantDates.test.tsx`, `tests/unit/PreferenceChips.test.tsx`
- Modify test: `tests/unit/CustomerProfile.test.tsx` (fixture + new assertions)

- [ ] **Step 1: Write the failing component tests**

Create `tests/unit/ImportantDates.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import esMessages from "@/messages/es.json";
import ImportantDates from "@/components/admin/customers/ImportantDates";
import type { ImportantDate } from "@/lib/customer-dates-storage";

function wrap(ui: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="es" messages={esMessages as Record<string, unknown>}>
      {ui}
    </NextIntlClientProvider>,
  );
}

const dates: ImportantDate[] = [
  {
    id: "d1", customerId: "c1", kind: "birthday", label: "esposa María",
    month: 3, day: 15, createdAt: "2026-07-01T00:00:00Z",
    next: { date: "2027-03-15", daysUntil: 23 },
  },
  {
    id: "d2", customerId: "c1", kind: "anniversary",
    month: 7, day: 4, year: 2010, createdAt: "2026-07-01T00:00:00Z",
    next: { date: "2026-07-04", daysUntil: 0 },
  },
];

describe("ImportantDates", () => {
  it("renders rows with kind, label, urgency chip, and the add form", () => {
    wrap(<ImportantDates customerId="c1" initial={dates} locale="es" />);
    expect(screen.getByText("Fechas importantes")).toBeDefined();
    expect(screen.getByText("Cumpleaños")).toBeDefined();
    expect(screen.getByText(/esposa María/)).toBeDefined();
    expect(screen.getByText("en 23 días")).toBeDefined();
    expect(screen.getByText("HOY")).toBeDefined();
    expect(screen.getByText("Añadir fecha")).toBeDefined();
  });

  it("shows the empty state when there are no dates", () => {
    wrap(<ImportantDates customerId="c1" initial={[]} locale="es" />);
    expect(screen.getByText("Sin fechas guardadas.")).toBeDefined();
  });
});
```

Create `tests/unit/PreferenceChips.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import esMessages from "@/messages/es.json";
import PreferenceChips from "@/components/admin/customers/PreferenceChips";
import type { PreferencesMap } from "@/lib/customer-dates-storage";

function wrap(ui: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="es" messages={esMessages as Record<string, unknown>}>
      {ui}
    </NextIntlClientProvider>,
  );
}

const prefs: PreferencesMap = {
  favorite_flower: ["peonías"],
  favorite_color: [],
  dislike: ["lirios"],
};
const empty: PreferencesMap = { favorite_flower: [], favorite_color: [], dislike: [] };

describe("PreferenceChips", () => {
  it("renders the three groups with their chips", () => {
    wrap(<PreferenceChips customerId="c1" initial={prefs} suggestions={empty} />);
    expect(screen.getByText("Flores favoritas")).toBeDefined();
    expect(screen.getByText("Colores favoritos")).toBeDefined();
    expect(screen.getByText("No le gusta / alergias")).toBeDefined();
    expect(screen.getByText("peonías")).toBeDefined();
    expect(screen.getByText("lirios")).toBeDefined();
  });

  it("styles the dislike chip as a warning", () => {
    wrap(<PreferenceChips customerId="c1" initial={prefs} suggestions={empty} />);
    const chip = screen.getByText("lirios").closest("span");
    expect(chip?.className).toContain("rose");
  });
});
```

- [ ] **Step 2: Run to verify they fail**

```bash
npm test -- tests/unit/ImportantDates.test.tsx tests/unit/PreferenceChips.test.tsx
```
Expected: FAIL — cannot resolve the component modules.

- [ ] **Step 3: Write `ImportantDates`**

Create `components/admin/customers/ImportantDates.tsx` (note the `import type` for storage types — rule 9):

```tsx
"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Cake, Heart, Plus, Star, X } from "@phosphor-icons/react/dist/ssr";
import {
  DAYS_IN_MONTH,
  formatMonthDay,
  isValidMonthDay,
  type DateKind,
} from "@/lib/customer-dates";
import type { ImportantDate } from "@/lib/customer-dates-storage";

type Props = { customerId: string; initial: ImportantDate[]; locale: string };

const KIND_ICONS: Record<DateKind, typeof Cake> = {
  birthday: Cake,
  anniversary: Heart,
  custom: Star,
};
const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export default function ImportantDates({ customerId, initial, locale }: Props) {
  const t = useTranslations("admin_customers");
  const [dates, setDates] = useState<ImportantDate[]>(initial);
  const [kind, setKind] = useState<DateKind>("birthday");
  const [month, setMonth] = useState(1);
  const [day, setDay] = useState(1);
  const [year, setYear] = useState("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  function monthName(m: number): string {
    return new Date(Date.UTC(2000, m - 1, 1)).toLocaleDateString(
      locale === "es" ? "es-ES" : "en-US",
      { month: "long", timeZone: "UTC" },
    );
  }

  function onMonthChange(m: number) {
    setMonth(m);
    const max = DAYS_IN_MONTH[m - 1];
    if (day > max) setDay(max);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidMonthDay(month, day)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/customers/${customerId}/dates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          month,
          day,
          year: year ? Number(year) : undefined,
          label: label.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setDates(((await res.json()) as { dates: ImportantDate[] }).dates);
      setLabel("");
      setYear("");
      setError(false);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    try {
      const res = await fetch(`/api/admin/customers/${customerId}/dates`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setDates(((await res.json()) as { dates: ImportantDate[] }).dates);
      setError(false);
    } catch {
      setError(true);
    }
  }

  return (
    <section className="mb-3 rounded border border-ink/10 bg-bone p-3">
      <div className="mb-2 text-xs uppercase tracking-wide text-ink/50">{t("dates_section")}</div>
      {error && (
        <div className="mb-2 rounded bg-rose-50 p-2 text-xs text-rose-800">{t("error_load")}</div>
      )}
      {dates.length === 0 ? (
        <div className="mb-2 text-sm text-ink/50">{t("no_dates")}</div>
      ) : (
        <div className="mb-2 flex flex-col gap-1">
          {dates.map((d) => {
            const Icon = KIND_ICONS[d.kind];
            return (
              <div
                key={d.id}
                className="flex flex-wrap items-center gap-2 rounded border border-ink/10 px-3 py-2 text-sm"
              >
                <Icon size={16} weight="bold" className="text-rouge" />
                <span className="font-semibold">{t(`date_kind_${d.kind}`)}</span>
                {d.label && <span className="text-ink/70">· {d.label}</span>}
                <span className="text-ink/70">
                  · {formatMonthDay(d.month, d.day, locale)}
                  {d.year ? ` · ${d.year}` : ""}
                </span>
                <span
                  className={`ml-auto rounded-full px-2 py-0.5 text-xs font-semibold ${
                    d.next.daysUntil === 0 ? "bg-rouge text-bone" : "bg-ink/5 text-ink/70"
                  }`}
                >
                  {d.next.daysUntil === 0 ? t("date_today") : t("date_in_days", { days: d.next.daysUntil })}
                </span>
                <button
                  type="button"
                  aria-label={t("date_remove")}
                  onClick={() => void remove(d.id)}
                  className="text-ink/40 hover:text-ink"
                >
                  <X size={14} weight="bold" />
                </button>
              </div>
            );
          })}
        </div>
      )}
      <form onSubmit={(e) => void submit(e)} className="flex flex-wrap items-center gap-2 text-sm">
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as DateKind)}
          className="min-h-11 rounded-lg border border-ink/20 bg-bone px-2"
        >
          <option value="birthday">{t("date_kind_birthday")}</option>
          <option value="anniversary">{t("date_kind_anniversary")}</option>
          <option value="custom">{t("date_kind_custom")}</option>
        </select>
        <select
          value={month}
          aria-label={t("date_month")}
          onChange={(e) => onMonthChange(Number(e.target.value))}
          className="min-h-11 rounded-lg border border-ink/20 bg-bone px-2"
        >
          {MONTHS.map((m) => (
            <option key={m} value={m}>{monthName(m)}</option>
          ))}
        </select>
        <select
          value={day}
          aria-label={t("date_day")}
          onChange={(e) => setDay(Number(e.target.value))}
          className="min-h-11 rounded-lg border border-ink/20 bg-bone px-2"
        >
          {Array.from({ length: DAYS_IN_MONTH[month - 1] }, (_, i) => i + 1).map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        <input
          value={year}
          onChange={(e) => setYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
          placeholder={t("date_year")}
          inputMode="numeric"
          className="min-h-11 w-28 rounded-lg border border-ink/20 bg-bone px-2"
        />
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={t("date_label_placeholder")}
          className="min-h-11 min-w-40 flex-1 rounded-lg border border-ink/20 bg-bone px-2"
        />
        <button
          type="submit"
          disabled={busy}
          className="flex min-h-11 items-center gap-1 rounded-lg border border-ink/20 px-3 hover:bg-ink/5 disabled:opacity-50"
        >
          <Plus size={14} weight="bold" /> {t("date_add")}
        </button>
      </form>
    </section>
  );
}
```

- [ ] **Step 4: Write `PreferenceChips`**

Create `components/admin/customers/PreferenceChips.tsx`:

```tsx
"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, X } from "@phosphor-icons/react/dist/ssr";
import type { PreferenceKind } from "@/lib/customer-dates";
import type { PreferencesMap } from "@/lib/customer-dates-storage";

type Props = { customerId: string; initial: PreferencesMap; suggestions: PreferencesMap };

const GROUPS: Array<{ kind: PreferenceKind; labelKey: string; chipClass: string }> = [
  { kind: "favorite_flower", labelKey: "pref_favorite_flower", chipClass: "bg-ink/5 text-ink/70" },
  { kind: "favorite_color", labelKey: "pref_favorite_color", chipClass: "bg-ink/5 text-ink/70" },
  { kind: "dislike", labelKey: "pref_dislike", chipClass: "bg-rose-50 text-rose-800" },
];

export default function PreferenceChips({ customerId, initial, suggestions }: Props) {
  const t = useTranslations("admin_customers");
  const [prefs, setPrefs] = useState<PreferencesMap>(initial);
  const [drafts, setDrafts] = useState<Record<PreferenceKind, string>>({
    favorite_flower: "",
    favorite_color: "",
    dislike: "",
  });
  const [error, setError] = useState(false);

  async function mutate(method: "POST" | "DELETE", kind: PreferenceKind, value: string) {
    try {
      const res = await fetch(`/api/admin/customers/${customerId}/preferences`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, value }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setPrefs(((await res.json()) as { preferences: PreferencesMap }).preferences);
      setError(false);
    } catch {
      setError(true);
    }
  }

  return (
    <section className="mb-3 rounded border border-ink/10 bg-bone p-3">
      <div className="mb-2 text-xs uppercase tracking-wide text-ink/50">{t("prefs_section")}</div>
      {error && (
        <div className="mb-2 rounded bg-rose-50 p-2 text-xs text-rose-800">{t("error_load")}</div>
      )}
      <div className="flex flex-col gap-2">
        {GROUPS.map((g) => (
          <div key={g.kind} className="flex flex-wrap items-center gap-2 text-sm">
            <span className="w-40 text-xs uppercase tracking-wide text-ink/50">{t(g.labelKey)}</span>
            {prefs[g.kind].map((v) => (
              <span
                key={v}
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${g.chipClass}`}
              >
                {v}
                <button
                  type="button"
                  aria-label={`${t(g.labelKey)}: ${v} ×`}
                  onClick={() => void mutate("DELETE", g.kind, v)}
                  className="opacity-60 hover:opacity-100"
                >
                  <X size={12} weight="bold" />
                </button>
              </span>
            ))}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const v = drafts[g.kind].trim();
                if (v) {
                  void mutate("POST", g.kind, v);
                  setDrafts((d) => ({ ...d, [g.kind]: "" }));
                }
              }}
              className="flex items-center gap-1"
            >
              <input
                value={drafts[g.kind]}
                onChange={(e) => setDrafts((d) => ({ ...d, [g.kind]: e.target.value }))}
                placeholder={t("pref_placeholder")}
                list={`pref-suggest-${g.kind}`}
                className="h-8 rounded border border-ink/20 bg-bone px-2 text-xs"
              />
              <datalist id={`pref-suggest-${g.kind}`}>
                {suggestions[g.kind].map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
              <button
                type="submit"
                className="flex h-8 items-center gap-1 rounded border border-ink/20 px-2 text-xs hover:bg-ink/5"
              >
                <Plus size={12} weight="bold" /> {t("pref_add")}
              </button>
            </form>
          </div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 5: Wire into `CustomerProfile` and the page**

In `components/admin/customers/CustomerProfile.tsx`:

**(a)** Add imports (next to the `SegmentBadge` import):

```tsx
import ImportantDates from "./ImportantDates";
import PreferenceChips from "./PreferenceChips";
import type { PreferencesMap } from "@/lib/customer-dates-storage";
```

**(b)** Change the Props type from:

```tsx
type Props = { locale: string; initial: CustomerProfileData };
```
to:
```tsx
type Props = { locale: string; initial: CustomerProfileData; suggestions: PreferencesMap };
```
and the component signature from `({ locale, initial }: Props)` to `({ locale, initial, suggestions }: Props)`.

**(c)** Insert the two sections BEFORE the addresses section. Find:

```tsx
      <section className="mb-3 rounded border border-ink/10 bg-bone p-3 text-sm">
        <div className="mb-1 text-xs uppercase tracking-wide text-ink/50">{t("addresses")}</div>
```
and insert immediately BEFORE that `<section>`:

```tsx
      <ImportantDates customerId={customer.id} initial={data.dates} locale={locale} />
      <PreferenceChips customerId={customer.id} initial={data.preferences} suggestions={suggestions} />
```

(The two child components own their state after mount; the profile-level `refresh()` does not re-seed them, which is fine — their own mutations keep them current.)

In `app/[locale]/admin/customers/[id]/page.tsx`, replace the whole file with:

```tsx
import { notFound } from "next/navigation";
import DashboardShell from "@/components/admin/dashboard/DashboardShell";
import CustomerProfile from "@/components/admin/customers/CustomerProfile";
import { getCustomerProfile } from "@/lib/customer-profile";
import { listPreferenceValues } from "@/lib/customer-dates-storage";

export const dynamic = "force-dynamic";

export default async function AdminCustomerProfilePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const profile = getCustomerProfile(id);
  if (!profile) notFound();
  const suggestions = {
    favorite_flower: listPreferenceValues("favorite_flower"),
    favorite_color: listPreferenceValues("favorite_color"),
    dislike: listPreferenceValues("dislike"),
  };
  return (
    <DashboardShell locale={locale}>
      <CustomerProfile locale={locale} initial={profile} suggestions={suggestions} />
    </DashboardShell>
  );
}
```

- [ ] **Step 6: Update the existing `CustomerProfile` test**

In `tests/unit/CustomerProfile.test.tsx` (the fixture already gained `dates`/`preferences` in Task 7):

**(a)** Both `wrap(<CustomerProfile ... />)` calls must pass the new prop. Add above the describe block:

```tsx
const emptyPrefs = { favorite_flower: [], favorite_color: [], dislike: [] };
```
and change both renders to:

```tsx
    wrap(<CustomerProfile locale="es" initial={profile} suggestions={emptyPrefs} />);
```

**(b)** Append these assertions to the first test (after the `Historial de órdenes` assertion):

```tsx
    expect(screen.getByText("Fechas importantes")).toBeDefined();
    expect(screen.getByText("Sin fechas guardadas.")).toBeDefined();
    expect(screen.getByText("Preferencias")).toBeDefined();
```

- [ ] **Step 7: Run tests to verify they pass**

```bash
npm test -- tests/unit/ImportantDates.test.tsx tests/unit/PreferenceChips.test.tsx tests/unit/CustomerProfile.test.tsx tests/unit/i18n-parity.test.ts
npx tsc --noEmit
```
Expected: all PASS; tsc clean (the Task 7 fixture error is now resolved).

- [ ] **Step 8: Commit**

```bash
git add components/admin/customers/ImportantDates.tsx components/admin/customers/PreferenceChips.tsx components/admin/customers/CustomerProfile.tsx "app/[locale]/admin/customers/[id]/page.tsx" tests/unit/ImportantDates.test.tsx tests/unit/PreferenceChips.test.tsx tests/unit/CustomerProfile.test.tsx
git commit -m "feat(crm): profile sections for important dates + preference chips

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 10: "Ocasiones" tab — page, view, nav

**Files:**
- Create: `components/admin/occasions/OccasionsView.tsx`
- Create: `app/[locale]/admin/occasions/page.tsx`
- Modify: `components/admin/dashboard/DashboardShell.tsx`
- Test: `tests/unit/OccasionsView.test.tsx`

- [ ] **Step 1: Write the failing component test**

Create `tests/unit/OccasionsView.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import esMessages from "@/messages/es.json";
import OccasionsView from "@/components/admin/occasions/OccasionsView";
import type { UpcomingOccasion } from "@/lib/customer-dates-storage";

function wrap(ui: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="es" messages={esMessages as Record<string, unknown>}>
      {ui}
    </NextIntlClientProvider>,
  );
}

const occasions: UpcomingOccasion[] = [
  {
    dateId: "d1", customerId: "c1", customerName: "Ana Flores", phone: "5165550001",
    kind: "birthday", label: "esposa María", next: { date: "2026-07-04", daysUntil: 0 },
  },
  {
    dateId: "d2", customerId: "c2", customerName: "Bob Marchetti", phone: "5165550002",
    kind: "anniversary", next: { date: "2026-07-07", daysUntil: 3 },
  },
];

describe("OccasionsView", () => {
  it("renders urgency chips, kinds, labels, and profile links", () => {
    wrap(<OccasionsView locale="es" initial={occasions} />);
    expect(screen.getByText("HOY")).toBeDefined();
    expect(screen.getByText("en 3 días")).toBeDefined();
    expect(screen.getByText(/esposa María/)).toBeDefined();
    expect(screen.getByText("Próximos 7 días")).toBeDefined();
    const link = screen.getByRole("link", { name: "Ana Flores" });
    expect(link.getAttribute("href")).toBe("/es/admin/customers/c1");
  });

  it("shows the empty state", () => {
    wrap(<OccasionsView locale="es" initial={[]} />);
    expect(screen.getByText("No hay ocasiones en este rango.")).toBeDefined();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm test -- tests/unit/OccasionsView.test.tsx
```
Expected: FAIL — cannot resolve `@/components/admin/occasions/OccasionsView`.

- [ ] **Step 3: Write `OccasionsView`**

Create `components/admin/occasions/OccasionsView.tsx`:

```tsx
"use client";
import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Cake, Heart, Phone, Plus, Star, WhatsappLogo } from "@phosphor-icons/react/dist/ssr";
import { formatMonthDay, type DateKind } from "@/lib/customer-dates";
import type { UpcomingOccasion } from "@/lib/customer-dates-storage";

type Props = { locale: string; initial: UpcomingOccasion[] };

const KIND_ICONS: Record<DateKind, typeof Cake> = {
  birthday: Cake,
  anniversary: Heart,
  custom: Star,
};

export default function OccasionsView({ locale, initial }: Props) {
  const t = useTranslations("admin_customers");
  const [days, setDays] = useState<7 | 30>(30);
  const [occasions, setOccasions] = useState<UpcomingOccasion[]>(initial);
  const [error, setError] = useState(false);

  async function setWindow(d: 7 | 30) {
    setDays(d);
    try {
      const res = await fetch(`/api/admin/occasions?days=${d}`, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      setOccasions(((await res.json()) as { occasions: UpcomingOccasion[] }).occasions);
      setError(false);
    } catch {
      setError(true);
    }
  }

  function monthDay(o: UpcomingOccasion): string {
    const [, m, d] = o.next.date.split("-").map(Number);
    return formatMonthDay(m, d, locale);
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-3 flex items-center gap-2">
        <h1 className="text-lg font-semibold">{t("occasions_title")}</h1>
        <div className="ml-auto flex gap-1">
          <button
            type="button"
            onClick={() => void setWindow(7)}
            className={`flex min-h-11 items-center rounded-lg px-3 text-sm ${
              days === 7 ? "bg-rouge text-bone" : "border border-ink/20 hover:bg-ink/5"
            }`}
          >
            {t("occasions_next_7")}
          </button>
          <button
            type="button"
            onClick={() => void setWindow(30)}
            className={`flex min-h-11 items-center rounded-lg px-3 text-sm ${
              days === 30 ? "bg-rouge text-bone" : "border border-ink/20 hover:bg-ink/5"
            }`}
          >
            {t("occasions_next_30")}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-3 rounded bg-rose-50 p-3 text-sm text-rose-800">{t("error_load")}</div>
      )}

      {occasions.length === 0 ? (
        <div className="rounded border border-ink/10 bg-bone p-6 text-center text-sm text-ink/50">
          {t("no_occasions")}
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {occasions.map((o) => {
            const Icon = KIND_ICONS[o.kind];
            return (
              <div
                key={o.dateId}
                className="flex flex-wrap items-center gap-2 rounded border border-ink/10 bg-bone px-3 py-2 text-sm"
              >
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    o.next.daysUntil === 0 ? "bg-rouge text-bone" : "bg-ink/5 text-ink/70"
                  }`}
                >
                  {o.next.daysUntil === 0 ? t("date_today") : t("date_in_days", { days: o.next.daysUntil })}
                </span>
                <Icon size={16} weight="bold" className="text-rouge" />
                <Link
                  href={`/${locale}/admin/customers/${o.customerId}`}
                  className="font-semibold underline decoration-ink/30 underline-offset-2 hover:decoration-ink"
                >
                  {o.customerName}
                </Link>
                <span className="text-ink/70">
                  {t(`date_kind_${o.kind}`)}
                  {o.label ? ` · ${o.label}` : ""}
                </span>
                <span className="text-ink/50">· {monthDay(o)}</span>
                <span className="ml-auto flex gap-1">
                  <a
                    href={`tel:${o.phone}`}
                    aria-label={t("call")}
                    className="flex min-h-11 items-center rounded-lg border border-ink/20 px-2 hover:bg-ink/5"
                  >
                    <Phone size={14} weight="bold" />
                  </a>
                  <a
                    href={`https://wa.me/${o.phone.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={t("whatsapp")}
                    className="flex min-h-11 items-center rounded-lg border border-ink/20 px-2 hover:bg-ink/5"
                  >
                    <WhatsappLogo size={14} weight="bold" />
                  </a>
                  <Link
                    href={`/${locale}/admin/intake?phone=${encodeURIComponent(o.phone)}`}
                    aria-label={t("new_order_cta")}
                    className="flex min-h-11 items-center rounded-lg bg-rouge px-2 text-bone"
                  >
                    <Plus size={14} weight="bold" />
                  </Link>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Write the page and nav entry**

Create `app/[locale]/admin/occasions/page.tsx`:

```tsx
import DashboardShell from "@/components/admin/dashboard/DashboardShell";
import OccasionsView from "@/components/admin/occasions/OccasionsView";
import { listUpcomingOccasions } from "@/lib/customer-dates-storage";

export const dynamic = "force-dynamic";

export default async function AdminOccasionsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const initial = listUpcomingOccasions(30);
  return (
    <DashboardShell locale={locale}>
      <OccasionsView locale={locale} initial={initial} />
    </DashboardShell>
  );
}
```

Modify `components/admin/dashboard/DashboardShell.tsx`:

**(a)** Replace:

```tsx
  const isCustomers = pathname.includes("/admin/customers");
  const isBandeja = !isLedger && !isRunSheet && !isSettings && !isGiftCards && !isCustomers;
```
with:
```tsx
  const isCustomers = pathname.includes("/admin/customers");
  const isOccasions = pathname.includes("/admin/occasions");
  const isBandeja =
    !isLedger && !isRunSheet && !isSettings && !isGiftCards && !isCustomers && !isOccasions;
```

**(b)** After the Customers `<Link>` (the one containing `{t("nav_customers")}`) and BEFORE the "Nueva orden" intake link, insert:

```tsx
            <Link
              href={`/${locale}/admin/occasions`}
              className={`flex min-h-11 items-center rounded-lg px-3 ${isOccasions ? "bg-rouge text-bone" : "hover:bg-ink/5"}`}
            >
              {t("nav_occasions")}
            </Link>
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm test -- tests/unit/OccasionsView.test.tsx tests/unit/i18n-parity.test.ts
npx tsc --noEmit
```
Expected: PASS; tsc clean.

- [ ] **Step 6: Commit**

```bash
git add components/admin/occasions/ "app/[locale]/admin/occasions/page.tsx" components/admin/dashboard/DashboardShell.tsx tests/unit/OccasionsView.test.tsx
git commit -m "feat(crm): Ocasiones tab — upcoming occasions view + nav entry

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 11: Full verification — types, suite, build, live server

**Files:** none (verification only)

- [ ] **Step 1: Typecheck**

```bash
export PATH="/opt/homebrew/bin:$PATH"
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 2: Full test suite**

```bash
npm test 2>&1 | tail -8
```
Expected: all Phase 2 test files pass. Known baseline failures (identical on `main`): print-chromium / print-render / _preview (need Chrome), CartUpsellStrip (flaky), checkout-schema. **No NEW failures.**

- [ ] **Step 3: Build**

```bash
npm run build
```
Expected: exit 0.

- [ ] **Step 4: Live-server verification (both locales)**

Start the dev server with Node 22 (`npm run dev`, background, log to a file). Authenticate: POST `/api/admin/session` with the password from `INTAKE_PASSWORD` in `.env.local`, then send the `intake_session` cookie as `-b "intake_session=$TOK"` (extract the token from the response Set-Cookie; note curl's cookie-jar `#HttpOnly_` prefix breaks `-b file` — pass the cookie inline).

Seed 2-3 test customers with dates via the API, then verify:
1. `POST /api/admin/customers/<id>/dates` with a date ~3 days out → appears in `GET /api/admin/occasions?days=7`.
2. `/es/admin/occasions` and `/en/admin/occasions` SSR 200 with correct strings, no raw `admin_customers.` keys in the HTML.
3. `/es/admin/customers/<id>` shows "Fechas importantes" + "Preferencias" sections.
4. `POST`/`DELETE` preferences round-trip; value normalization visible ("  Lirios " → "lirios").
5. Apr 31 date POST → 400.
6. Nav shows "Ocasiones"; Bandeja tab still highlights correctly on `/es/admin/dashboard`.
7. Check the dev log for runtime errors (none expected).

**Clean up the seeded test data afterwards** (delete the test customers' dates/preferences and the customers themselves from `data/diva.sqlite`), and stop the dev server.

- [ ] **Step 5: Final commit (only if the live pass required fixes)**

```bash
git add -A && git commit -m "fix(crm): post-verification polish

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

**Reminder for the operator:** production runs on a separate Hostinger Node host NOT auto-deployed from GitHub; migration 013 auto-applies on that host's next boot after it is updated.
