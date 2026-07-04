# Weddings / Events Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A "Pipeline" dashboard tab turning wedding/event inquiries into a tap-to-move kanban (Nuevo→Contactado→Propuesta→Reservado→Completado, + Perdido), backed by SQLite, with notes, follow-up dates, change history, manual lead entry, and an estimated open-pipeline value.

**Architecture:** Stage/grouping/value logic lives in a pure DB-free module `lib/pipeline.ts` (unit-tested like `customer-metrics.ts`). A new `lib/inquiry-storage-db.ts` owns the `inquiries` + `inquiry_changes` tables. The public intake route best-effort dual-writes wedding/event inquiries to SQLite (email + JSON stay the safety net). Admin API + a board/drawer/manual-form render it. Spec: `docs/superpowers/specs/2026-07-04-weddings-events-pipeline-design.md`.

**Tech Stack:** Next.js App Router (custom conventions — see `AGENTS.md`), node:sqlite via `lib/db.ts`, zod, next-intl, vitest + @testing-library/react, Tailwind (`bone`, `ink`, `rouge`).

---

## Project conventions the engineer MUST know

1. **Node 22 required.** Shell default (v16) breaks vitest/next. Prefix EVERY command session with:
   ```bash
   export PATH="/opt/homebrew/bin:$PATH"   # node v22
   ```
2. **Run tests** with `npm test -- <file>`. Known-noisy baseline failures (fail identically on `main`): print-chromium, print-render, _preview (need Chrome), CartUpsellStrip + checkout-intent-gift-card (flaky under load), checkout-schema. Targeted files must pass 100%; the full suite must show no NEW failures. If in doubt whether a failure is pre-existing, `git stash && npm test -- <file> && git stash pop`.
3. **DB:** `getDb()` from `@/lib/db` + `runMigrations()` from `@/lib/db-migrate` at the top of storage functions. Migrations `db/migrations/*.sql` auto-apply sorted by filename. Latest is 013 (CRM Phase 2).
4. **Admin auth is middleware-level** (`proxy.ts`) — `/api/admin/*` and `/[locale]/admin/*` are guarded. Route handlers do NOT call auth; unit tests invoke handlers directly.
5. **Route handlers:** `export const runtime = "nodejs"`; dynamic params are `{ params }: { params: Promise<{ id: string }> }`, awaited; check 404 (unknown id) BEFORE 400 (validation).
6. **API/storage tests** stub the DB: `vi.stubEnv("SQLITE_FILE", ":memory:")` + `runMigrations()` in `beforeEach`, `closeDb(); vi.unstubAllEnvs()` in `afterEach`.
7. **Component tests** wrap in `NextIntlClientProvider` with the REAL `messages/es.json` (missing keys throw). See `tests/unit/CustomersList.test.tsx`.
8. **`import type` for server-module types in client components.** `lib/inquiry-storage-db.ts` begins with `import "server-only"`; client components import its TYPES via `import type`. `lib/pipeline.ts` is PURE (no server-only) — import its values/types normally.
9. **i18n:** `messages/en.json` and `messages/es.json` keep identical key paths — `tests/unit/i18n-parity.test.ts` gates this. Spanish is default.
10. **Branch:** create `feature/weddings-events-pipeline` off `main` before Task 1 (Step 0). Do NOT push. Commits end with:
    ```
    Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
    ```

**Verified data facts:** inquiries currently persist to `pending-inquiries.json` via `lib/inquiry-storage.ts` (`saveInquiry`) + fire `notifyInquiry` (email) in `app/api/inquiry/route.ts`. Wedding payload: `{ type:"wedding", contact:{name,email,phone}, budgetBand:"5-10k"|"10-25k"|"25k+"|"open", vibe, locale, date?, venue?, guests?, source? }`. Event payload adds `{ company, frequency }`. The `order_changes` audit table (migration 010) is the pattern mirrored by `inquiry_changes`.

---

### Task 1: Migration `014_inquiries.sql`

**Files:**
- Create: `db/migrations/014_inquiries.sql`
- Test: `tests/unit/inquiries-migration.test.ts`

- [ ] **Step 0: Create the feature branch**

```bash
cd "/Users/santiagocardonacastellanos/Desktop/Diva Flowers"
git checkout -b feature/weddings-events-pipeline
```

- [ ] **Step 1: Write the failing test** — create `tests/unit/inquiries-migration.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";

beforeEach(() => { vi.stubEnv("SQLITE_FILE", ":memory:"); runMigrations(); });
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

describe("014_inquiries migration", () => {
  it("creates inquiries with the expected columns", () => {
    const db = getDb();
    db.prepare(
      `INSERT INTO inquiries (id, type, stage, contact_name, contact_email, contact_phone,
         budget_band, event_date, venue, guests, company, frequency, vibe, notes,
         follow_up_date, lost_reason, source_channel, locale, acknowledged_at, created_at, updated_at)
       VALUES ('iq1','wedding','nuevo','Ana','ana@x.com','5551','10-25k','2027-06-01','Glen Cove',120,
         NULL,NULL,'romantic garden',NULL,NULL,NULL,'web','es',NULL,'2026-07-04T00:00:00Z','2026-07-04T00:00:00Z')`,
    ).run();
    const row = db.prepare("SELECT * FROM inquiries WHERE id = 'iq1'").get() as {
      type: string; stage: string; contact_name: string; budget_band: string; guests: number;
    };
    expect(row.type).toBe("wedding");
    expect(row.stage).toBe("nuevo");
    expect(row.contact_name).toBe("Ana");
    expect(row.budget_band).toBe("10-25k");
    expect(row.guests).toBe(120);
  });

  it("creates inquiry_changes audit table", () => {
    const db = getDb();
    db.prepare(
      `INSERT INTO inquiries (id, type, stage, contact_name, contact_email, contact_phone,
         source_channel, created_at, updated_at)
       VALUES ('iq1','event','nuevo','Bob','b@x.com','5552','manual','2026-07-04T00:00:00Z','2026-07-04T00:00:00Z')`,
    ).run();
    db.prepare(
      `INSERT INTO inquiry_changes (id, inquiry_id, at, actor, kind, summary)
       VALUES ('c1','iq1','2026-07-04T00:00:00Z','maky','created','Lead creado')`,
    ).run();
    const rows = db.prepare("SELECT summary FROM inquiry_changes WHERE inquiry_id='iq1'").all();
    expect(rows).toEqual([{ summary: "Lead creado" }]);
  });
});
```

- [ ] **Step 2: Run to verify FAIL**

```bash
export PATH="/opt/homebrew/bin:$PATH"
npm test -- tests/unit/inquiries-migration.test.ts
```
Expected: FAIL — `no such table: inquiries`.

- [ ] **Step 3: Write the migration** — create `db/migrations/014_inquiries.sql`:

```sql
-- 014_inquiries.sql — weddings/events sales pipeline.
CREATE TABLE IF NOT EXISTS inquiries (
  id              TEXT PRIMARY KEY,
  type            TEXT NOT NULL,
  stage           TEXT NOT NULL,
  contact_name    TEXT NOT NULL,
  contact_email   TEXT NOT NULL,
  contact_phone   TEXT NOT NULL,
  budget_band     TEXT,
  event_date      TEXT,
  venue           TEXT,
  guests          INTEGER,
  company         TEXT,
  frequency       TEXT,
  vibe            TEXT,
  notes           TEXT,
  follow_up_date  TEXT,
  lost_reason     TEXT,
  source_channel  TEXT NOT NULL,
  locale          TEXT,
  acknowledged_at TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_inquiries_stage ON inquiries(stage);
CREATE INDEX IF NOT EXISTS idx_inquiries_created ON inquiries(created_at DESC);

CREATE TABLE IF NOT EXISTS inquiry_changes (
  id          TEXT PRIMARY KEY,
  inquiry_id  TEXT NOT NULL,
  at          TEXT NOT NULL,
  actor       TEXT NOT NULL,
  kind        TEXT NOT NULL,
  summary     TEXT NOT NULL,
  FOREIGN KEY (inquiry_id) REFERENCES inquiries(id)
);
CREATE INDEX IF NOT EXISTS idx_inquiry_changes_inquiry ON inquiry_changes(inquiry_id, at);
```

- [ ] **Step 4: Run to verify PASS** (2 tests).

- [ ] **Step 5: Commit**

```bash
git add db/migrations/014_inquiries.sql tests/unit/inquiries-migration.test.ts
git commit -m "feat(pipeline): migration 014 — inquiries + inquiry_changes tables

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Pure module `lib/pipeline.ts`

**Files:**
- Create: `lib/pipeline.ts`
- Test: `tests/unit/pipeline.test.ts`

- [ ] **Step 1: Write the failing tests** — create `tests/unit/pipeline.test.ts`:

```ts
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
```

- [ ] **Step 2: Run to verify FAIL** — cannot resolve `@/lib/pipeline`.

- [ ] **Step 3: Write `lib/pipeline.ts`** (NO server-only import):

```ts
// Pure, DB-free pipeline logic: stage ordering, grouping, and estimated value.
// No server-only import — client components import these values/types directly.

export type InquiryType = "wedding" | "event";
export type Stage =
  | "nuevo" | "contactado" | "propuesta" | "reservado" | "completado" | "perdido";
export type BudgetBand = "5-10k" | "10-25k" | "25k+" | "open";

export const ACTIVE_STAGES: readonly Stage[] = [
  "nuevo", "contactado", "propuesta", "reservado", "completado",
];
export const OPEN_STAGES: readonly Stage[] = ["nuevo", "contactado", "propuesta", "reservado"];
export const ALL_STAGES: readonly Stage[] = [...ACTIVE_STAGES, "perdido"];

export function isValidStage(s: string): s is Stage {
  return (ALL_STAGES as readonly string[]).includes(s);
}

export function budgetBandFloorCents(band: string | null | undefined): number {
  switch (band) {
    case "5-10k": return 500_000;
    case "10-25k": return 1_000_000;
    case "25k+": return 2_500_000;
    default: return 0; // open / unknown
  }
}

export type PipelineInquiry = {
  id: string;
  type: InquiryType;
  stage: Stage;
  contactName: string;
  budgetBand?: BudgetBand;
  eventDate?: string;
  guests?: number;
  followUpDate?: string;
  acknowledgedAt?: string;
  createdAt: string;
};

export function groupByStage<T extends PipelineInquiry>(inquiries: T[]): Record<Stage, T[]> {
  const groups = Object.fromEntries(ALL_STAGES.map((s) => [s, [] as T[]])) as Record<Stage, T[]>;
  for (const i of inquiries) {
    if (groups[i.stage]) groups[i.stage].push(i);
  }
  const rank = (i: T) => i.followUpDate ?? "9999-99-99";
  for (const s of ALL_STAGES) {
    groups[s].sort((a, b) => rank(a).localeCompare(rank(b)) || a.createdAt.localeCompare(b.createdAt));
  }
  return groups;
}

export function stageCounts(inquiries: PipelineInquiry[]): Record<Stage, number> {
  const counts = Object.fromEntries(ALL_STAGES.map((s) => [s, 0])) as Record<Stage, number>;
  for (const i of inquiries) {
    if (counts[i.stage] !== undefined) counts[i.stage] += 1;
  }
  return counts;
}

export function openPipelineValueCents(inquiries: PipelineInquiry[]): number {
  return inquiries
    .filter((i) => (OPEN_STAGES as readonly string[]).includes(i.stage))
    .reduce((sum, i) => sum + budgetBandFloorCents(i.budgetBand), 0);
}
```

- [ ] **Step 4: Run to verify PASS.** Also `npx tsc --noEmit` clean.

- [ ] **Step 5: Commit**

```bash
git add lib/pipeline.ts tests/unit/pipeline.test.ts
git commit -m "feat(pipeline): pure stage/grouping/value module

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Storage `lib/inquiry-storage-db.ts`

**Files:**
- Create: `lib/inquiry-storage-db.ts`
- Test: `tests/unit/inquiry-storage-db.test.ts`

- [ ] **Step 1: Write the failing tests** — create `tests/unit/inquiry-storage-db.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import {
  createInquiry, listInquiries, getInquiry, changeStage,
  updateNotes, setFollowUp, markLost, acknowledge,
} from "@/lib/inquiry-storage-db";

const NOW = new Date("2026-07-04T12:00:00Z");

beforeEach(() => { vi.stubEnv("SQLITE_FILE", ":memory:"); runMigrations(); });
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

function base(id: string, over: Record<string, unknown> = {}) {
  return {
    id, type: "wedding" as const, contactName: "Ana", contactEmail: "ana@x.com",
    contactPhone: "5551", budgetBand: "10-25k" as const, sourceChannel: "web" as const,
    ...over,
  };
}

describe("createInquiry + listInquiries + getInquiry", () => {
  it("creates web + manual inquiries at stage nuevo with a created history row", () => {
    createInquiry(base("iq1", { eventDate: "2027-06-01", venue: "Glen Cove", guests: 120, vibe: "garden" }), NOW);
    createInquiry({ id: "iq2", type: "event", contactName: "Bob", contactEmail: "b@x.com",
      contactPhone: "5552", company: "Acme", frequency: "monthly", sourceChannel: "manual" }, NOW);

    const all = listInquiries();
    expect(all.map((i) => i.id).sort()).toEqual(["iq1", "iq2"]);
    const iq1 = all.find((i) => i.id === "iq1")!;
    expect(iq1.stage).toBe("nuevo");
    expect(iq1.guests).toBe(120);
    expect(iq1.sourceChannel).toBe("web");

    const detail = getInquiry("iq2");
    expect(detail?.inquiry.company).toBe("Acme");
    expect(detail?.changes.map((c) => c.kind)).toEqual(["created"]);
  });

  it("generates an id when none is given (manual add)", () => {
    const created = createInquiry({ type: "wedding", contactName: "C", contactEmail: "c@x.com",
      contactPhone: "5553", sourceChannel: "manual" }, NOW);
    expect(created.id).toMatch(/^iq_/);
    expect(listInquiries()).toHaveLength(1);
  });
});

describe("mutations write history", () => {
  it("changeStage updates stage and logs a stage change", () => {
    createInquiry(base("iq1"), NOW);
    const updated = changeStage("iq1", "propuesta", "maky", NOW);
    expect(updated?.inquiry.stage).toBe("propuesta");
    const kinds = updated!.changes.map((c) => c.kind);
    expect(kinds).toContain("stage");
  });

  it("changeStage rejects an invalid target stage (returns null, no write)", () => {
    createInquiry(base("iq1"), NOW);
    expect(changeStage("iq1", "bogus", "maky", NOW)).toBeNull();
    expect(getInquiry("iq1")?.inquiry.stage).toBe("nuevo");
  });

  it("updateNotes and setFollowUp persist and log", () => {
    createInquiry(base("iq1"), NOW);
    expect(updateNotes("iq1", "llamar el viernes", "maky", NOW)?.inquiry.notes).toBe("llamar el viernes");
    expect(setFollowUp("iq1", "2026-08-01", "maky", NOW)?.inquiry.followUpDate).toBe("2026-08-01");
    const kinds = getInquiry("iq1")!.changes.map((c) => c.kind);
    expect(kinds).toEqual(["created", "note", "followup"]);
  });

  it("markLost sets stage=perdido + reason and logs", () => {
    createInquiry(base("iq1"), NOW);
    const lost = markLost("iq1", "presupuesto", "maky", NOW);
    expect(lost?.inquiry.stage).toBe("perdido");
    expect(lost?.inquiry.lostReason).toBe("presupuesto");
    expect(lost?.changes.some((c) => c.kind === "lost")).toBe(true);
  });

  it("acknowledge sets acknowledged_at once (idempotent, no duplicate)", () => {
    createInquiry(base("iq1"), NOW);
    const first = acknowledge("iq1", NOW)?.inquiry.acknowledgedAt;
    expect(first).toBe(NOW.toISOString());
    const later = new Date("2026-07-05T00:00:00Z");
    expect(acknowledge("iq1", later)?.inquiry.acknowledgedAt).toBe(first); // unchanged
  });

  it("mutations on an unknown id return null", () => {
    expect(changeStage("nope", "contactado", "maky", NOW)).toBeNull();
    expect(getInquiry("nope")).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify FAIL** — cannot resolve `@/lib/inquiry-storage-db`.

- [ ] **Step 3: Write `lib/inquiry-storage-db.ts`:**

```ts
import "server-only";
import { getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import {
  isValidStage,
  type BudgetBand,
  type InquiryType,
  type Stage,
} from "@/lib/pipeline";

export type Inquiry = {
  id: string;
  type: InquiryType;
  stage: Stage;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  budgetBand?: BudgetBand;
  eventDate?: string;
  venue?: string;
  guests?: number;
  company?: string;
  frequency?: string;
  vibe?: string;
  notes?: string;
  followUpDate?: string;
  lostReason?: string;
  sourceChannel: "web" | "manual";
  locale?: string;
  acknowledgedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type InquiryChange = {
  id: string;
  inquiryId: string;
  at: string;
  actor: string;
  kind: string;
  summary: string;
};

export type CreateInquiryInput = {
  id?: string;
  type: InquiryType;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  budgetBand?: BudgetBand;
  eventDate?: string;
  venue?: string;
  guests?: number;
  company?: string;
  frequency?: string;
  vibe?: string;
  notes?: string;
  sourceChannel: "web" | "manual";
  locale?: string;
  createdAt?: string;
};

const STAGE_LABELS_ES: Record<Stage, string> = {
  nuevo: "Nuevo",
  contactado: "Contactado",
  propuesta: "Propuesta",
  reservado: "Reservado",
  completado: "Completado",
  perdido: "Perdido",
};

type Row = {
  id: string; type: string; stage: string; contact_name: string; contact_email: string;
  contact_phone: string; budget_band: string | null; event_date: string | null; venue: string | null;
  guests: number | null; company: string | null; frequency: string | null; vibe: string | null;
  notes: string | null; follow_up_date: string | null; lost_reason: string | null;
  source_channel: string; locale: string | null; acknowledged_at: string | null;
  created_at: string; updated_at: string;
};

function rowToInquiry(r: Row): Inquiry {
  return {
    id: r.id,
    type: r.type as InquiryType,
    stage: r.stage as Stage,
    contactName: r.contact_name,
    contactEmail: r.contact_email,
    contactPhone: r.contact_phone,
    budgetBand: (r.budget_band as BudgetBand | null) ?? undefined,
    eventDate: r.event_date ?? undefined,
    venue: r.venue ?? undefined,
    guests: r.guests ?? undefined,
    company: r.company ?? undefined,
    frequency: r.frequency ?? undefined,
    vibe: r.vibe ?? undefined,
    notes: r.notes ?? undefined,
    followUpDate: r.follow_up_date ?? undefined,
    lostReason: r.lost_reason ?? undefined,
    sourceChannel: r.source_channel as "web" | "manual",
    locale: r.locale ?? undefined,
    acknowledgedAt: r.acknowledged_at ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function newInquiryId(): string {
  return `iq_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
function newChangeId(): string {
  return `ic_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function recordChange(inquiryId: string, actor: string, kind: string, summary: string, now: Date): void {
  getDb()
    .prepare("INSERT INTO inquiry_changes (id, inquiry_id, at, actor, kind, summary) VALUES (?, ?, ?, ?, ?, ?)")
    .run(newChangeId(), inquiryId, now.toISOString(), actor, kind, summary);
}

function getRow(id: string): Row | undefined {
  return getDb().prepare("SELECT * FROM inquiries WHERE id = ?").get(id) as Row | undefined;
}

export function createInquiry(input: CreateInquiryInput, now: Date = new Date(), actor = "maky"): Inquiry {
  runMigrations();
  const db = getDb();
  const id = input.id ?? newInquiryId();
  const at = input.createdAt ?? now.toISOString();
  db.prepare(
    `INSERT INTO inquiries (id, type, stage, contact_name, contact_email, contact_phone,
       budget_band, event_date, venue, guests, company, frequency, vibe, notes,
       follow_up_date, lost_reason, source_channel, locale, acknowledged_at, created_at, updated_at)
     VALUES (?, ?, 'nuevo', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, NULL, ?, ?)`,
  ).run(
    id, input.type, input.contactName, input.contactEmail, input.contactPhone,
    input.budgetBand ?? null, input.eventDate ?? null, input.venue ?? null, input.guests ?? null,
    input.company ?? null, input.frequency ?? null, input.vibe ?? null, input.notes ?? null,
    input.sourceChannel, input.locale ?? null, at, at,
  );
  recordChange(id, actor, "created", `Lead creado · ${input.sourceChannel === "web" ? "web" : "manual"}`, now);
  return rowToInquiry(getRow(id)!);
}

export function listInquiries(): Inquiry[] {
  runMigrations();
  const rows = getDb().prepare("SELECT * FROM inquiries ORDER BY created_at DESC").all() as Row[];
  return rows.map(rowToInquiry);
}

export type InquiryDetail = { inquiry: Inquiry; changes: InquiryChange[] };

export function getInquiry(id: string): InquiryDetail | null {
  runMigrations();
  const row = getRow(id);
  if (!row) return null;
  const changes = getDb()
    .prepare("SELECT * FROM inquiry_changes WHERE inquiry_id = ? ORDER BY at ASC")
    .all(id)
    .map((c) => {
      const r = c as { id: string; inquiry_id: string; at: string; actor: string; kind: string; summary: string };
      return { id: r.id, inquiryId: r.inquiry_id, at: r.at, actor: r.actor, kind: r.kind, summary: r.summary };
    });
  return { inquiry: rowToInquiry(row), changes };
}

function touch(id: string, now: Date): void {
  getDb().prepare("UPDATE inquiries SET updated_at = ? WHERE id = ?").run(now.toISOString(), id);
}

export function changeStage(id: string, stage: string, actor: string, now: Date = new Date()): InquiryDetail | null {
  runMigrations();
  const row = getRow(id);
  if (!row) return null;
  if (!isValidStage(stage)) return null;
  getDb().prepare("UPDATE inquiries SET stage = ? WHERE id = ?").run(stage, id);
  touch(id, now);
  recordChange(id, actor, "stage",
    `Etapa: ${STAGE_LABELS_ES[row.stage as Stage]} → ${STAGE_LABELS_ES[stage as Stage]}`, now);
  return getInquiry(id);
}

export function updateNotes(id: string, notes: string, actor: string, now: Date = new Date()): InquiryDetail | null {
  runMigrations();
  if (!getRow(id)) return null;
  getDb().prepare("UPDATE inquiries SET notes = ? WHERE id = ?").run(notes || null, id);
  touch(id, now);
  recordChange(id, actor, "note", "Notas actualizadas", now);
  return getInquiry(id);
}

export function setFollowUp(id: string, date: string, actor: string, now: Date = new Date()): InquiryDetail | null {
  runMigrations();
  if (!getRow(id)) return null;
  getDb().prepare("UPDATE inquiries SET follow_up_date = ? WHERE id = ?").run(date || null, id);
  touch(id, now);
  recordChange(id, actor, "followup", date ? `Seguimiento: ${date}` : "Seguimiento quitado", now);
  return getInquiry(id);
}

export function markLost(id: string, reason: string, actor: string, now: Date = new Date()): InquiryDetail | null {
  runMigrations();
  if (!getRow(id)) return null;
  getDb().prepare("UPDATE inquiries SET stage = 'perdido', lost_reason = ? WHERE id = ?").run(reason || null, id);
  touch(id, now);
  recordChange(id, actor, "lost", reason ? `Perdido · ${reason}` : "Perdido", now);
  return getInquiry(id);
}

export function acknowledge(id: string, now: Date = new Date()): InquiryDetail | null {
  runMigrations();
  const row = getRow(id);
  if (!row) return null;
  if (!row.acknowledged_at) {
    getDb().prepare("UPDATE inquiries SET acknowledged_at = ? WHERE id = ?").run(now.toISOString(), id);
  }
  return getInquiry(id);
}
```

- [ ] **Step 4: Run to verify PASS.** Also `npx tsc --noEmit` clean.

- [ ] **Step 5: Commit**

```bash
git add lib/inquiry-storage-db.ts tests/unit/inquiry-storage-db.test.ts
git commit -m "feat(pipeline): SQLite inquiry storage with change history

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Schemas + list/create routes (`GET`/`POST /api/admin/inquiries`)

**Files:**
- Create: `schemas/inquiry-admin.ts`
- Create: `app/api/admin/inquiries/route.ts`
- Test: `tests/unit/api-admin-inquiries-list.test.ts`

- [ ] **Step 1: Write the failing test** — create `tests/unit/api-admin-inquiries-list.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { createInquiry, changeStage } from "@/lib/inquiry-storage-db";
import { GET, POST } from "@/app/api/admin/inquiries/route";

beforeEach(() => { vi.stubEnv("SQLITE_FILE", ":memory:"); runMigrations(); });
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

it("GET returns inquiries + stats (counts + open value)", async () => {
  createInquiry({ id: "iq1", type: "wedding", contactName: "Ana", contactEmail: "a@x.com",
    contactPhone: "5551", budgetBand: "10-25k", sourceChannel: "web" });
  createInquiry({ id: "iq2", type: "event", contactName: "Bob", contactEmail: "b@x.com",
    contactPhone: "5552", budgetBand: "25k+", sourceChannel: "manual" });
  changeStage("iq2", "reservado", "maky");

  const res = await GET(new Request("http://x/api/admin/inquiries"));
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.inquiries).toHaveLength(2);
  expect(body.stats.counts.nuevo).toBe(1);
  expect(body.stats.counts.reservado).toBe(1);
  expect(body.stats.openValueCents).toBe(3500000); // 1,000,000 + 2,500,000
});

it("POST creates a manual lead at stage nuevo", async () => {
  const res = await POST(new Request("http://x", {
    method: "POST",
    body: JSON.stringify({ type: "wedding", contact: { name: "Cara", email: "c@x.com", phone: "5165551234" },
      budgetBand: "5-10k", eventDate: "2027-05-01", guests: 80 }),
  }));
  expect(res.status).toBe(201);
  const body = await res.json();
  expect(body.inquiry.stage).toBe("nuevo");
  expect(body.inquiry.sourceChannel).toBe("manual");
  expect(body.inquiry.contactName).toBe("Cara");
});

it("POST 400s on an invalid body", async () => {
  const bad = await POST(new Request("http://x", { method: "POST",
    body: JSON.stringify({ type: "bogus", contact: { name: "X", email: "no", phone: "1" } }) }));
  expect(bad.status).toBe(400);
});
```

- [ ] **Step 2: Run to verify FAIL** — cannot resolve the route module.

- [ ] **Step 3: Write schemas and route.**

Create `schemas/inquiry-admin.ts`:

```ts
import { z } from "zod";

const contact = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email(),
  phone: z.string().transform((s) => s.replace(/\D/g, "")).pipe(z.string().min(10).max(15)),
});
const budgetBand = z.enum(["5-10k", "10-25k", "25k+", "open"]);

export const manualInquirySchema = z.object({
  type: z.enum(["wedding", "event"]),
  contact,
  budgetBand: budgetBand.optional(),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  venue: z.string().max(120).optional(),
  guests: z.coerce.number().int().min(1).max(2000).optional(),
  company: z.string().max(120).optional(),
  frequency: z.enum(["one-time", "weekly", "biweekly", "monthly", "quarterly"]).optional(),
  notes: z.string().max(4000).optional(),
});
export type ManualInquiryInput = z.infer<typeof manualInquirySchema>;

export const inquiryPatchSchema = z
  .object({
    stage: z.enum(["nuevo", "contactado", "propuesta", "reservado", "completado", "perdido"]).optional(),
    notes: z.string().max(4000).optional(),
    followUpDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")).optional(),
    lost: z.object({ reason: z.string().max(200) }).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "empty_patch" });
```

Create `app/api/admin/inquiries/route.ts`:

```ts
import { NextResponse } from "next/server";
import { createInquiry, listInquiries } from "@/lib/inquiry-storage-db";
import { stageCounts, openPipelineValueCents } from "@/lib/pipeline";
import { manualInquirySchema } from "@/schemas/inquiry-admin";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  const inquiries = listInquiries();
  return NextResponse.json({
    inquiries,
    stats: { counts: stageCounts(inquiries), openValueCents: openPipelineValueCents(inquiries) },
  });
}

export async function POST(req: Request): Promise<Response> {
  const json = await req.json().catch(() => null);
  const parsed = manualInquirySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ errors: parsed.error.flatten() }, { status: 400 });
  }
  const d = parsed.data;
  const inquiry = createInquiry({
    type: d.type,
    contactName: d.contact.name,
    contactEmail: d.contact.email,
    contactPhone: d.contact.phone,
    budgetBand: d.budgetBand,
    eventDate: d.eventDate || undefined,
    venue: d.venue,
    guests: d.guests,
    company: d.company,
    frequency: d.frequency,
    notes: d.notes,
    sourceChannel: "manual",
  });
  return NextResponse.json({ inquiry }, { status: 201 });
}
```

(`createInquiry` from Task 3 already persists `input.notes`, so the manual note lands on create with no extra call. Task 3's tests don't pass notes on create, so they stay green.)

- [ ] **Step 4: Run to verify PASS**

```bash
npm test -- tests/unit/api-admin-inquiries-list.test.ts tests/unit/inquiry-storage-db.test.ts
npx tsc --noEmit
```
Expected: PASS (both files); tsc clean.

- [ ] **Step 5: Commit**

```bash
git add schemas/inquiry-admin.ts app/api/admin/inquiries/route.ts lib/inquiry-storage-db.ts tests/unit/api-admin-inquiries-list.test.ts
git commit -m "feat(pipeline): list + manual-create inquiries endpoint

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Detail routes — `GET`/`PATCH /[id]` + `POST /[id]/ack`

**Files:**
- Create: `app/api/admin/inquiries/[id]/route.ts`
- Create: `app/api/admin/inquiries/[id]/ack/route.ts`
- Test: `tests/unit/api-admin-inquiries-detail.test.ts`

- [ ] **Step 1: Write the failing test** — create `tests/unit/api-admin-inquiries-detail.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { createInquiry } from "@/lib/inquiry-storage-db";
import { GET, PATCH } from "@/app/api/admin/inquiries/[id]/route";
import { POST as ACK } from "@/app/api/admin/inquiries/[id]/ack/route";

beforeEach(() => { vi.stubEnv("SQLITE_FILE", ":memory:"); runMigrations(); });
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
function seed() {
  createInquiry({ id: "iq1", type: "wedding", contactName: "Ana", contactEmail: "a@x.com",
    contactPhone: "5551", budgetBand: "10-25k", sourceChannel: "web" });
}
const patch = (b: unknown) => new Request("http://x", { method: "PATCH", body: JSON.stringify(b) });

describe("GET /[id]", () => {
  it("returns inquiry + changes; 404 unknown", async () => {
    seed();
    const res = await GET(new Request("http://x"), ctx("iq1"));
    expect(res.status).toBe(200);
    expect((await res.json()).inquiry.contactName).toBe("Ana");
    expect((await GET(new Request("http://x"), ctx("nope"))).status).toBe(404);
  });
});

describe("PATCH /[id]", () => {
  it("changes stage", async () => {
    seed();
    const res = await PATCH(patch({ stage: "contactado" }), ctx("iq1"));
    expect(res.status).toBe(200);
    expect((await res.json()).inquiry.stage).toBe("contactado");
  });
  it("updates notes and follow-up", async () => {
    seed();
    expect((await (await PATCH(patch({ notes: "x" }), ctx("iq1"))).json()).inquiry.notes).toBe("x");
    expect((await (await PATCH(patch({ followUpDate: "2026-08-01" }), ctx("iq1"))).json()).inquiry.followUpDate).toBe("2026-08-01");
  });
  it("marks lost with a reason", async () => {
    seed();
    const res = await PATCH(patch({ lost: { reason: "presupuesto" } }), ctx("iq1"));
    const body = await res.json();
    expect(body.inquiry.stage).toBe("perdido");
    expect(body.inquiry.lostReason).toBe("presupuesto");
  });
  it("400 empty patch, 400 bad stage, 404 unknown", async () => {
    seed();
    expect((await PATCH(patch({}), ctx("iq1"))).status).toBe(400);
    expect((await PATCH(patch({ stage: "bogus" }), ctx("iq1"))).status).toBe(400);
    expect((await PATCH(patch({ stage: "contactado" }), ctx("nope"))).status).toBe(404);
  });
});

describe("POST /[id]/ack", () => {
  it("acknowledges (idempotent)", async () => {
    seed();
    const res = await ACK(new Request("http://x", { method: "POST" }), ctx("iq1"));
    expect(res.status).toBe(200);
    expect((await res.json()).inquiry.acknowledgedAt).toBeTruthy();
    expect((await ACK(new Request("http://x", { method: "POST" }), ctx("nope"))).status).toBe(404);
  });
});
```

- [ ] **Step 2: Run to verify FAIL** — cannot resolve the route modules.

- [ ] **Step 3: Write the routes.**

Create `app/api/admin/inquiries/[id]/route.ts`:

```ts
import { NextResponse } from "next/server";
import {
  changeStage, getInquiry, markLost, setFollowUp, updateNotes,
} from "@/lib/inquiry-storage-db";
import { inquiryPatchSchema } from "@/schemas/inquiry-admin";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };
const ACTOR = "maky";

export async function GET(_req: Request, { params }: Ctx): Promise<Response> {
  const { id } = await params;
  const detail = getInquiry(id);
  if (!detail) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(detail);
}

export async function PATCH(req: Request, { params }: Ctx): Promise<Response> {
  const { id } = await params;
  if (!getInquiry(id)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const json = await req.json().catch(() => null);
  const parsed = inquiryPatchSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ errors: parsed.error.flatten() }, { status: 400 });
  const p = parsed.data;

  let result = getInquiry(id);
  if (p.lost) result = markLost(id, p.lost.reason, ACTOR);
  if (p.stage) result = changeStage(id, p.stage, ACTOR);
  if (p.notes !== undefined) result = updateNotes(id, p.notes, ACTOR);
  if (p.followUpDate !== undefined) result = setFollowUp(id, p.followUpDate, ACTOR);

  return NextResponse.json(result);
}
```

Create `app/api/admin/inquiries/[id]/ack/route.ts`:

```ts
import { NextResponse } from "next/server";
import { acknowledge } from "@/lib/inquiry-storage-db";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Ctx): Promise<Response> {
  const { id } = await params;
  const detail = acknowledge(id);
  if (!detail) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(detail);
}
```

- [ ] **Step 4: Run to verify PASS.** Also `npx tsc --noEmit` clean.

- [ ] **Step 5: Commit**

```bash
git add "app/api/admin/inquiries/[id]/route.ts" "app/api/admin/inquiries/[id]/ack/route.ts" tests/unit/api-admin-inquiries-detail.test.ts
git commit -m "feat(pipeline): inquiry detail (GET/PATCH) + ack endpoints

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Intake dual-write + JSON migration script

**Files:**
- Modify: `app/api/inquiry/route.ts`
- Create: `scripts/migrate-inquiries-json-to-sqlite.ts`
- Test: `tests/unit/inquiry-intake-dualwrite.test.ts`

- [ ] **Step 1: Write the failing test** — create `tests/unit/inquiry-intake-dualwrite.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { listInquiries } from "@/lib/inquiry-storage-db";

// Isolate side effects: JSON storage + email are stubbed so the test only
// checks the SQLite dual-write branch.
vi.mock("@/lib/inquiry-storage", () => ({ saveInquiry: vi.fn(async () => {}) }));
vi.mock("@/lib/notify-inquiry", () => ({ notifyInquiry: vi.fn(async () => {}) }));

beforeEach(() => { vi.stubEnv("SQLITE_FILE", ":memory:"); runMigrations(); });
afterEach(() => { closeDb(); vi.unstubAllEnvs(); vi.clearAllMocks(); });

async function post(body: unknown) {
  const { POST } = await import("@/app/api/inquiry/route");
  return POST(new Request("http://x/api/inquiry", { method: "POST", body: JSON.stringify(body) }));
}

const wedding = {
  type: "wedding", contact: { name: "Ana", email: "ana@x.com", phone: "5165551234" },
  budgetBand: "10-25k", vibe: "romantic garden party with lots of white", locale: "es", honeypot: "",
  date: "2027-06-01", venue: "Glen Cove", guests: 120,
};

it("wedding inquiry lands in SQLite at stage nuevo", async () => {
  const res = await post(wedding);
  expect(res.status).toBe(200);
  const all = listInquiries();
  expect(all).toHaveLength(1);
  expect(all[0].type).toBe("wedding");
  expect(all[0].stage).toBe("nuevo");
  expect(all[0].sourceChannel).toBe("web");
  expect(all[0].contactName).toBe("Ana");
});

it("contact/subscription inquiries do NOT create a pipeline row", async () => {
  await post({ type: "subscription", contact: { name: "Z", email: "z@x.com", phone: "5165550000" },
    budgetBand: "open", vibe: "weekly lobby flowers for our office", locale: "en", honeypot: "",
    company: "Acme", frequency: "weekly" });
  // subscription is a valid inquiry type but not a pipeline type
  expect(listInquiries()).toHaveLength(0);
});
```

- [ ] **Step 2: Run to verify FAIL** — the wedding test fails (0 rows) because the route doesn't dual-write yet.

- [ ] **Step 3: Modify `app/api/inquiry/route.ts`.**

Read the file. After the existing `await saveInquiry(record);` and `await notifyInquiry(record);` lines and BEFORE the final `return NextResponse.json(...)`, add a best-effort SQLite write for wedding/event:

```ts
  if (parsed.data.type === "wedding" || parsed.data.type === "event") {
    try {
      const { createInquiry } = await import("@/lib/inquiry-storage-db");
      const c = parsed.data.contact;
      createInquiry({
        id: record.id,
        type: parsed.data.type,
        contactName: c.name,
        contactEmail: c.email,
        contactPhone: c.phone,
        budgetBand: parsed.data.budgetBand,
        eventDate: "date" in parsed.data ? parsed.data.date || undefined : undefined,
        venue: "venue" in parsed.data ? parsed.data.venue || undefined : undefined,
        guests: "guests" in parsed.data ? parsed.data.guests : undefined,
        company: "company" in parsed.data ? parsed.data.company : undefined,
        frequency: "frequency" in parsed.data ? parsed.data.frequency : undefined,
        vibe: parsed.data.vibe,
        sourceChannel: "web",
        locale: parsed.data.locale,
        createdAt: record.createdAt,
      });
    } catch (e) {
      // Best-effort: the public form must never fail because of the pipeline DB.
      console.error(JSON.stringify({ event: "inquiry_sqlite_failed", id: record.id, error: String(e) }));
    }
  }
```

(`record` is the existing `InquiryRecord` with `id` and `createdAt`. `parsed.data` is the discriminated-union payload; the `"x" in parsed.data` guards keep TypeScript happy across wedding vs event shapes.)

- [ ] **Step 4: Write the migration script** — create `scripts/migrate-inquiries-json-to-sqlite.ts`:

```ts
// One-time importer: pending-inquiries.json wedding/event records → SQLite.
// Idempotent by id. Run: NODE_OPTIONS='--experimental-sqlite' tsx scripts/migrate-inquiries-json-to-sqlite.ts
import { promises as fs } from "node:fs";
import path from "node:path";
import { createInquiry, getInquiry } from "@/lib/inquiry-storage-db";

type Rec = { id: string; type: string; payload: Record<string, unknown>; createdAt: string; locale?: string };

async function main() {
  const file = path.join(process.cwd(), "pending-inquiries.json");
  let raw: string;
  try {
    raw = await fs.readFile(file, "utf8");
  } catch {
    console.log("no pending-inquiries.json — nothing to migrate");
    return;
  }
  const records = JSON.parse(raw) as Rec[];
  let imported = 0;
  for (const r of records) {
    if (r.type !== "wedding" && r.type !== "event") continue;
    if (getInquiry(r.id)) continue; // idempotent
    const p = r.payload as {
      contact: { name: string; email: string; phone: string };
      budgetBand?: string; vibe?: string; date?: string; venue?: string; guests?: number;
      company?: string; frequency?: string;
    };
    createInquiry({
      id: r.id,
      type: r.type,
      contactName: p.contact.name,
      contactEmail: p.contact.email,
      contactPhone: p.contact.phone,
      budgetBand: p.budgetBand as never,
      eventDate: p.date || undefined,
      venue: p.venue || undefined,
      guests: p.guests,
      company: p.company,
      frequency: p.frequency,
      vibe: p.vibe,
      sourceChannel: "web",
      locale: r.locale,
      createdAt: r.createdAt,
    });
    imported += 1;
  }
  console.log(`migrated ${imported} wedding/event inquiries`);
}

main();
```

- [ ] **Step 5: Run to verify PASS**

```bash
npm test -- tests/unit/inquiry-intake-dualwrite.test.ts
npx tsc --noEmit
```
Expected: PASS (2 tests); tsc clean. (The migration script is not unit-tested — it's a thin one-time importer over `createInquiry`, which IS tested; verify it typechecks.)

- [ ] **Step 6: Commit**

```bash
git add app/api/inquiry/route.ts scripts/migrate-inquiries-json-to-sqlite.ts tests/unit/inquiry-intake-dualwrite.test.ts
git commit -m "feat(pipeline): best-effort SQLite dual-write from intake + JSON migration script

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: i18n — `admin_pipeline` namespace + nav key

**Files:**
- Modify: `messages/es.json`
- Modify: `messages/en.json`

- [ ] **Step 1: Confirm parity baseline passes**

```bash
npm test -- tests/unit/i18n-parity.test.ts
```
Expected: PASS.

- [ ] **Step 2: Add the Spanish keys**

In `messages/es.json`:

**(a)** Inside `"admin_dashboard"`, after `"nav_metrics": "Métricas",` add:

```json
"nav_pipeline": "Pipeline",
```

**(b)** New top-level namespace `"admin_pipeline"`:

```json
"admin_pipeline": {
  "title": "Pipeline",
  "stage_nuevo": "Nuevo",
  "stage_contactado": "Contactado",
  "stage_propuesta": "Propuesta",
  "stage_reservado": "Reservado",
  "stage_completado": "Completado",
  "stage_perdido": "Perdido",
  "type_wedding": "Boda",
  "type_event": "Evento",
  "band_5-10k": "$5–10k",
  "band_10-25k": "$10–25k",
  "band_25k+": "$25k+",
  "band_open": "Abierto",
  "open_value": "Valor del pipeline",
  "new_lead": "Nuevo lead",
  "empty_stage": "Sin leads",
  "event_date": "Fecha del evento",
  "venue": "Lugar",
  "guests": "Invitados",
  "company": "Empresa",
  "frequency": "Frecuencia",
  "vibe": "Brief",
  "notes": "Notas",
  "notes_placeholder": "Seguimiento, detalles, contexto…",
  "save": "Guardar",
  "saved": "Guardado",
  "follow_up": "Seguimiento",
  "stage_label": "Etapa",
  "mark_lost": "Marcar perdido",
  "lost_reason_prompt": "Motivo (opcional)",
  "lost_reason": "Motivo",
  "history": "Historial",
  "call": "Llamar",
  "whatsapp": "WhatsApp",
  "email": "Email",
  "new_order": "Crear orden",
  "form_name": "Nombre",
  "form_email": "Email",
  "form_phone": "Teléfono",
  "form_budget": "Presupuesto",
  "form_type": "Tipo",
  "create": "Crear lead",
  "cancel": "Cancelar",
  "error_load": "No se pudo cargar. Intenta de nuevo.",
  "not_found": "Lead no encontrado"
}
```

- [ ] **Step 3: Add the English keys**

In `messages/en.json`:

**(a)** Inside `"admin_dashboard"`, after `"nav_metrics": "Metrics",` add:

```json
"nav_pipeline": "Pipeline",
```

**(b)** `"admin_pipeline"` namespace (same keys, English values):

```json
"admin_pipeline": {
  "title": "Pipeline",
  "stage_nuevo": "New",
  "stage_contactado": "Contacted",
  "stage_propuesta": "Proposal",
  "stage_reservado": "Booked",
  "stage_completado": "Completed",
  "stage_perdido": "Lost",
  "type_wedding": "Wedding",
  "type_event": "Event",
  "band_5-10k": "$5–10k",
  "band_10-25k": "$10–25k",
  "band_25k+": "$25k+",
  "band_open": "Open",
  "open_value": "Pipeline value",
  "new_lead": "New lead",
  "empty_stage": "No leads",
  "event_date": "Event date",
  "venue": "Venue",
  "guests": "Guests",
  "company": "Company",
  "frequency": "Frequency",
  "vibe": "Brief",
  "notes": "Notes",
  "notes_placeholder": "Follow-up, details, context…",
  "save": "Save",
  "saved": "Saved",
  "follow_up": "Follow-up",
  "stage_label": "Stage",
  "mark_lost": "Mark lost",
  "lost_reason_prompt": "Reason (optional)",
  "lost_reason": "Reason",
  "history": "History",
  "call": "Call",
  "whatsapp": "WhatsApp",
  "email": "Email",
  "new_order": "Create order",
  "form_name": "Name",
  "form_email": "Email",
  "form_phone": "Phone",
  "form_budget": "Budget",
  "form_type": "Type",
  "create": "Create lead",
  "cancel": "Cancel",
  "error_load": "Could not load. Try again.",
  "not_found": "Lead not found"
}
```

- [ ] **Step 4: Validate JSON + parity**

```bash
node -e "JSON.parse(require('fs').readFileSync('messages/es.json','utf8')); JSON.parse(require('fs').readFileSync('messages/en.json','utf8')); console.log('JSON OK')"
npm test -- tests/unit/i18n-parity.test.ts
```
Expected: `JSON OK` and parity PASS.

- [ ] **Step 5: Commit**

```bash
git add messages/es.json messages/en.json
git commit -m "feat(pipeline): admin_pipeline i18n namespace (es/en) + nav key

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: Components — `InquiryCard`, `InquiryDrawer`, `NewLeadForm`

**Files:**
- Create: `components/admin/pipeline/InquiryCard.tsx`
- Create: `components/admin/pipeline/InquiryDrawer.tsx`
- Create: `components/admin/pipeline/NewLeadForm.tsx`
- Test: `tests/unit/InquiryCard.test.tsx`, `tests/unit/InquiryDrawer.test.tsx`

- [ ] **Step 1: Write the failing tests.**

Create `tests/unit/InquiryCard.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import esMessages from "@/messages/es.json";
import InquiryCard from "@/components/admin/pipeline/InquiryCard";
import type { Inquiry } from "@/lib/inquiry-storage-db";

function wrap(ui: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="es" messages={esMessages as Record<string, unknown>}>
      {ui}
    </NextIntlClientProvider>,
  );
}

const inquiry: Inquiry = {
  id: "iq1", type: "wedding", stage: "nuevo", contactName: "Ana Flores",
  contactEmail: "ana@x.com", contactPhone: "5165551234", budgetBand: "10-25k",
  eventDate: "2027-06-01", sourceChannel: "web",
  createdAt: "2026-07-01T00:00:00Z", updatedAt: "2026-07-01T00:00:00Z",
};

describe("InquiryCard", () => {
  it("renders name, type, budget, and a new dot when unacknowledged", () => {
    const { container } = wrap(<InquiryCard inquiry={inquiry} locale="es" onOpen={() => {}} />);
    expect(screen.getByText("Ana Flores")).toBeDefined();
    expect(screen.getByText("Boda")).toBeDefined();
    expect(screen.getByText("$10–25k")).toBeDefined();
    expect(container.querySelector('[data-testid="unseen-dot"]')).not.toBeNull();
  });

  it("hides the dot once acknowledged", () => {
    const { container } = wrap(
      <InquiryCard inquiry={{ ...inquiry, acknowledgedAt: "2026-07-02T00:00:00Z" }} locale="es" onOpen={() => {}} />,
    );
    expect(container.querySelector('[data-testid="unseen-dot"]')).toBeNull();
  });
});
```

Create `tests/unit/InquiryDrawer.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import esMessages from "@/messages/es.json";
import InquiryDrawer from "@/components/admin/pipeline/InquiryDrawer";
import type { InquiryDetail } from "@/lib/inquiry-storage-db";

function wrap(ui: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="es" messages={esMessages as Record<string, unknown>}>
      {ui}
    </NextIntlClientProvider>,
  );
}

const detail: InquiryDetail = {
  inquiry: {
    id: "iq1", type: "wedding", stage: "contactado", contactName: "Ana Flores",
    contactEmail: "ana@x.com", contactPhone: "5165551234", budgetBand: "10-25k",
    eventDate: "2027-06-01", venue: "Glen Cove", guests: 120, vibe: "garden",
    notes: "llamar el viernes", sourceChannel: "web",
    createdAt: "2026-07-01T00:00:00Z", updatedAt: "2026-07-01T00:00:00Z",
  },
  changes: [{ id: "c1", inquiryId: "iq1", at: "2026-07-01T00:00:00Z", actor: "maky", kind: "created", summary: "Lead creado · web" }],
};

describe("InquiryDrawer", () => {
  it("renders contact, stage selector, notes, history, and mark-lost", () => {
    wrap(<InquiryDrawer detail={detail} locale="es" onClose={() => {}} onChanged={() => {}} />);
    expect(screen.getByText("Ana Flores")).toBeDefined();
    expect(screen.getByDisplayValue("llamar el viernes")).toBeDefined();
    expect(screen.getByText("Glen Cove")).toBeDefined();
    expect(screen.getByText("Marcar perdido")).toBeDefined();
    expect(screen.getByText("Lead creado · web")).toBeDefined();
    // stage <select> present with the current stage selected
    const select = screen.getByLabelText("Etapa") as HTMLSelectElement;
    expect(select.value).toBe("contactado");
  });
});
```

- [ ] **Step 2: Run to verify they fail** — cannot resolve the component modules.

- [ ] **Step 3: Write `InquiryCard`:**

Create `components/admin/pipeline/InquiryCard.tsx`:

```tsx
"use client";
import { useTranslations } from "next-intl";
import { formatDate } from "@/lib/format-datetime";
import type { Inquiry } from "@/lib/inquiry-storage-db";

type Props = { inquiry: Inquiry; locale: string; onOpen: (id: string) => void };

export default function InquiryCard({ inquiry, locale, onOpen }: Props) {
  const t = useTranslations("admin_pipeline");
  return (
    <button
      type="button"
      onClick={() => onOpen(inquiry.id)}
      className="w-full rounded border border-ink/10 bg-bone p-3 text-left text-sm hover:bg-ink/5"
    >
      <div className="flex items-center gap-2">
        {!inquiry.acknowledgedAt && (
          <span data-testid="unseen-dot" className="h-2 w-2 shrink-0 rounded-full bg-rouge" aria-hidden />
        )}
        <span className="font-semibold">{inquiry.contactName}</span>
        <span className="ml-auto rounded-full bg-ink/5 px-2 py-0.5 text-xs text-ink/60">
          {t(`type_${inquiry.type}`)}
        </span>
      </div>
      <div className="mt-1 flex flex-wrap gap-2 text-xs text-ink/60">
        {inquiry.budgetBand && <span>{t(`band_${inquiry.budgetBand}`)}</span>}
        {inquiry.eventDate && <span>· {formatDate(inquiry.eventDate, locale)}</span>}
        {inquiry.followUpDate && <span>· {t("follow_up")}: {formatDate(inquiry.followUpDate, locale)}</span>}
      </div>
    </button>
  );
}
```

- [ ] **Step 4: Write `InquiryDrawer`:**

Create `components/admin/pipeline/InquiryDrawer.tsx`:

```tsx
"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Phone, WhatsappLogo, EnvelopeSimple, X } from "@phosphor-icons/react/dist/ssr";
import { formatDate, formatDateTime } from "@/lib/format-datetime";
import { ACTIVE_STAGES, type Stage } from "@/lib/pipeline";
import type { InquiryDetail } from "@/lib/inquiry-storage-db";

type Props = {
  detail: InquiryDetail;
  locale: string;
  onClose: () => void;
  onChanged: (next: InquiryDetail) => void;
};

export default function InquiryDrawer({ detail, locale, onClose, onChanged }: Props) {
  const t = useTranslations("admin_pipeline");
  const { inquiry, changes } = detail;
  const [notes, setNotes] = useState(inquiry.notes ?? "");
  const [followUp, setFollowUp] = useState(inquiry.followUpDate ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const digits = inquiry.contactPhone.replace(/\D/g, "");

  async function patch(body: unknown) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/inquiries/${inquiry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(String(res.status));
      onChanged((await res.json()) as InquiryDetail);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-20 flex" onClick={onClose}>
      <div className="ml-auto h-full w-full max-w-xl overflow-y-auto bg-bone p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <header className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold">{inquiry.contactName} · {t(`type_${inquiry.type}`)}</h2>
          <button type="button" onClick={onClose} aria-label={t("cancel")} className="rounded border border-ink/20 px-2 py-1 text-sm hover:bg-ink/5">
            <X size={16} weight="bold" />
          </button>
        </header>

        {error && <div className="mb-3 rounded bg-rose-50 p-2 text-sm text-rose-800">{t("error_load")}</div>}

        <section className="mb-3 rounded border border-ink/10 p-3 text-sm">
          <div className="flex flex-wrap gap-2">
            <a href={`tel:${inquiry.contactPhone}`} className="flex items-center gap-1 underline"><Phone size={14} /> {t("call")}</a>
            <a href={`https://wa.me/${digits}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 underline"><WhatsappLogo size={14} /> {t("whatsapp")}</a>
            <a href={`mailto:${inquiry.contactEmail}`} className="flex items-center gap-1 underline"><EnvelopeSimple size={14} /> {t("email")}</a>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-1 text-ink/70">
            {inquiry.budgetBand && <div>{t("form_budget")}: {t(`band_${inquiry.budgetBand}`)}</div>}
            {inquiry.eventDate && <div>{t("event_date")}: {formatDate(inquiry.eventDate, locale)}</div>}
            {inquiry.venue && <div>{t("venue")}: {inquiry.venue}</div>}
            {inquiry.guests != null && <div>{t("guests")}: {inquiry.guests}</div>}
            {inquiry.company && <div>{t("company")}: {inquiry.company}</div>}
            {inquiry.frequency && <div>{t("frequency")}: {inquiry.frequency}</div>}
          </div>
          {inquiry.vibe && <div className="mt-2 text-ink/70"><span className="text-ink/50">{t("vibe")}: </span>{inquiry.vibe}</div>}
        </section>

        <section className="mb-3 flex flex-wrap items-center gap-2 text-sm">
          <label htmlFor="stage-sel" className="text-xs uppercase tracking-wide text-ink/50">{t("stage_label")}</label>
          <select
            id="stage-sel"
            aria-label={t("stage_label")}
            value={inquiry.stage === "perdido" ? "perdido" : inquiry.stage}
            disabled={busy}
            onChange={(e) => void patch({ stage: e.target.value })}
            className="min-h-11 rounded-lg border border-ink/20 bg-bone px-2"
          >
            {ACTIVE_STAGES.map((s: Stage) => (
              <option key={s} value={s}>{t(`stage_${s}`)}</option>
            ))}
            {inquiry.stage === "perdido" && <option value="perdido">{t("stage_perdido")}</option>}
          </select>
          <button type="button" disabled={busy} onClick={() => void patch({ lost: { reason: window.prompt(t("lost_reason_prompt")) ?? "" } })}
            className="min-h-11 rounded-lg border border-ink/20 px-3 hover:bg-ink/5">{t("mark_lost")}</button>
        </section>

        <section className="mb-3">
          <label htmlFor="notes" className="mb-1 block text-xs uppercase tracking-wide text-ink/50">{t("notes")}</label>
          <textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
            placeholder={t("notes_placeholder")} className="w-full rounded border border-ink/20 bg-bone p-2 text-sm" />
          <div className="mt-1 flex items-center gap-2">
            <input type="date" value={followUp} onChange={(e) => setFollowUp(e.target.value)}
              aria-label={t("follow_up")} className="min-h-11 rounded border border-ink/20 bg-bone px-2 text-sm" />
            <button type="button" disabled={busy}
              onClick={() => void patch({ notes, followUpDate: followUp })}
              className="min-h-11 rounded-lg bg-rouge px-4 text-sm text-bone disabled:opacity-50">{t("save")}</button>
          </div>
        </section>

        <section className="text-sm">
          <div className="mb-1 text-xs uppercase tracking-wide text-ink/50">{t("history")}</div>
          <ul className="flex flex-col gap-1">
            {changes.map((c) => (
              <li key={c.id} className="text-ink/70">
                <span className="text-ink/40">{formatDateTime(c.at, locale)} · </span>{c.summary}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Write `NewLeadForm`:**

Create `components/admin/pipeline/NewLeadForm.tsx`:

```tsx
"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { X } from "@phosphor-icons/react/dist/ssr";
import type { InquiryType } from "@/lib/pipeline";
import type { Inquiry } from "@/lib/inquiry-storage-db";

type Props = { onClose: () => void; onCreated: (inquiry: Inquiry) => void };

export default function NewLeadForm({ onClose, onCreated }: Props) {
  const t = useTranslations("admin_pipeline");
  const [type, setType] = useState<InquiryType>("wedding");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [budgetBand, setBudgetBand] = useState("open");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch("/api/admin/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, contact: { name, email, phone }, budgetBand }),
      });
      if (!res.ok) throw new Error(String(res.status));
      onCreated(((await res.json()) as { inquiry: Inquiry }).inquiry);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-ink/30 p-4" onClick={onClose}>
      <form onSubmit={(e) => void submit(e)} onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-lg bg-bone p-4 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">{t("new_lead")}</h2>
          <button type="button" onClick={onClose} aria-label={t("cancel")} className="rounded border border-ink/20 px-2 py-1"><X size={16} weight="bold" /></button>
        </div>
        {error && <div className="mb-2 rounded bg-rose-50 p-2 text-sm text-rose-800">{t("error_load")}</div>}
        <div className="flex flex-col gap-2 text-sm">
          <select value={type} onChange={(e) => setType(e.target.value as InquiryType)} aria-label={t("form_type")}
            className="min-h-11 rounded border border-ink/20 bg-bone px-2">
            <option value="wedding">{t("type_wedding")}</option>
            <option value="event">{t("type_event")}</option>
          </select>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("form_name")} required
            className="min-h-11 rounded border border-ink/20 bg-bone px-2" />
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder={t("form_email")} required
            className="min-h-11 rounded border border-ink/20 bg-bone px-2" />
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t("form_phone")} required
            className="min-h-11 rounded border border-ink/20 bg-bone px-2" />
          <select value={budgetBand} onChange={(e) => setBudgetBand(e.target.value)} aria-label={t("form_budget")}
            className="min-h-11 rounded border border-ink/20 bg-bone px-2">
            <option value="open">{t("band_open")}</option>
            <option value="5-10k">{t("band_5-10k")}</option>
            <option value="10-25k">{t("band_10-25k")}</option>
            <option value="25k+">{t("band_25k+")}</option>
          </select>
          <button type="submit" disabled={busy || !name || !email || !phone}
            className="min-h-11 rounded-lg bg-rouge px-4 text-bone disabled:opacity-50">{t("create")}</button>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
npm test -- tests/unit/InquiryCard.test.tsx tests/unit/InquiryDrawer.test.tsx tests/unit/i18n-parity.test.ts
npx tsc --noEmit
```
Expected: PASS; tsc clean.

- [ ] **Step 7: Commit**

```bash
git add components/admin/pipeline/InquiryCard.tsx components/admin/pipeline/InquiryDrawer.tsx components/admin/pipeline/NewLeadForm.tsx tests/unit/InquiryCard.test.tsx tests/unit/InquiryDrawer.test.tsx
git commit -m "feat(pipeline): inquiry card, drawer, and new-lead form

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 9: `PipelineBoard` + page + nav

**Files:**
- Create: `components/admin/pipeline/PipelineBoard.tsx`
- Create: `app/[locale]/admin/pipeline/page.tsx`
- Modify: `components/admin/dashboard/DashboardShell.tsx`
- Test: `tests/unit/PipelineBoard.test.tsx`

- [ ] **Step 1: Write the failing test** — create `tests/unit/PipelineBoard.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import esMessages from "@/messages/es.json";
import PipelineBoard from "@/components/admin/pipeline/PipelineBoard";
import type { Inquiry } from "@/lib/inquiry-storage-db";

function wrap(ui: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="es" messages={esMessages as Record<string, unknown>}>
      {ui}
    </NextIntlClientProvider>,
  );
}

function inq(id: string, stage: string): Inquiry {
  return {
    id, type: "wedding", stage: stage as Inquiry["stage"], contactName: `Lead ${id}`,
    contactEmail: `${id}@x.com`, contactPhone: "5551", budgetBand: "10-25k", sourceChannel: "web",
    createdAt: "2026-07-01T00:00:00Z", updatedAt: "2026-07-01T00:00:00Z",
  };
}

const initial = {
  inquiries: [inq("a", "nuevo"), inq("b", "reservado")],
  stats: { counts: { nuevo: 1, contactado: 0, propuesta: 0, reservado: 1, completado: 0, perdido: 0 }, openValueCents: 2000000 },
};

describe("PipelineBoard", () => {
  it("renders the 5 stage columns, cards, and the open value", () => {
    wrap(<PipelineBoard locale="es" initial={initial} />);
    expect(screen.getByText("Nuevo")).toBeDefined();
    expect(screen.getByText("Contactado")).toBeDefined();
    expect(screen.getByText("Reservado")).toBeDefined();
    expect(screen.getByText("Lead a")).toBeDefined();
    expect(screen.getByText("Lead b")).toBeDefined();
    expect(screen.getByText("Nuevo lead")).toBeDefined(); // add button
    expect(screen.getByText("$20,000.00")).toBeDefined(); // open value
  });
});
```

- [ ] **Step 2: Run to verify FAIL** — cannot resolve `@/components/admin/pipeline/PipelineBoard`.

- [ ] **Step 3: Write `PipelineBoard`:**

Create `components/admin/pipeline/PipelineBoard.tsx`:

```tsx
"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "@phosphor-icons/react/dist/ssr";
import { ACTIVE_STAGES, groupByStage, type Stage } from "@/lib/pipeline";
import type { Inquiry, InquiryDetail } from "@/lib/inquiry-storage-db";
import InquiryCard from "./InquiryCard";
import InquiryDrawer from "./InquiryDrawer";
import NewLeadForm from "./NewLeadForm";

type Payload = {
  inquiries: Inquiry[];
  stats: { counts: Record<Stage, number>; openValueCents: number };
};
type Props = { locale: string; initial: Payload };

function money(c: number) {
  return `$${(c / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function PipelineBoard({ locale, initial }: Props) {
  const t = useTranslations("admin_pipeline");
  const [data, setData] = useState<Payload>(initial);
  const [openDetail, setOpenDetail] = useState<InquiryDetail | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState(false);

  async function refresh() {
    try {
      const res = await fetch("/api/admin/inquiries", { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      setData((await res.json()) as Payload);
      setError(false);
    } catch {
      setError(true);
    }
  }

  async function open(id: string) {
    try {
      await fetch(`/api/admin/inquiries/${id}/ack`, { method: "POST" });
      const res = await fetch(`/api/admin/inquiries/${id}`, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      setOpenDetail((await res.json()) as InquiryDetail);
      setError(false);
    } catch {
      setError(true);
    }
  }

  const groups = groupByStage(data.inquiries);

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h1 className="text-lg font-semibold">{t("title")}</h1>
        <span className="text-sm text-ink/60">{t("open_value")}: {money(data.stats.openValueCents)}</span>
        <button type="button" onClick={() => setAdding(true)}
          className="ml-auto flex min-h-11 items-center gap-1 rounded-lg bg-rouge px-3 text-sm text-bone">
          <Plus size={16} weight="bold" /> {t("new_lead")}
        </button>
      </div>

      {error && <div className="mb-3 rounded bg-rose-50 p-3 text-sm text-rose-800">{t("error_load")}</div>}

      <div className="flex gap-3 overflow-x-auto pb-2">
        {ACTIVE_STAGES.map((stage) => (
          <div key={stage} className="w-64 shrink-0">
            <div className="mb-2 flex items-center justify-between text-sm font-semibold">
              <span>{t(`stage_${stage}`)}</span>
              <span className="rounded-full bg-ink/5 px-2 text-xs text-ink/60">{data.stats.counts[stage]}</span>
            </div>
            <div className="flex flex-col gap-2">
              {groups[stage].length === 0 ? (
                <div className="rounded border border-dashed border-ink/15 p-3 text-center text-xs text-ink/40">{t("empty_stage")}</div>
              ) : (
                groups[stage].map((i) => (
                  <InquiryCard key={i.id} inquiry={i} locale={locale} onOpen={() => void open(i.id)} />
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      {openDetail && (
        <InquiryDrawer
          detail={openDetail}
          locale={locale}
          onClose={() => { setOpenDetail(null); void refresh(); }}
          onChanged={(next) => { setOpenDetail(next); void refresh(); }}
        />
      )}
      {adding && (
        <NewLeadForm onClose={() => setAdding(false)} onCreated={() => { setAdding(false); void refresh(); }} />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Write the page:**

Create `app/[locale]/admin/pipeline/page.tsx`:

```tsx
import DashboardShell from "@/components/admin/dashboard/DashboardShell";
import PipelineBoard from "@/components/admin/pipeline/PipelineBoard";
import { listInquiries } from "@/lib/inquiry-storage-db";
import { stageCounts, openPipelineValueCents } from "@/lib/pipeline";

export const dynamic = "force-dynamic";

export default async function AdminPipelinePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const inquiries = listInquiries();
  const initial = {
    inquiries,
    stats: { counts: stageCounts(inquiries), openValueCents: openPipelineValueCents(inquiries) },
  };
  return (
    <DashboardShell locale={locale}>
      <PipelineBoard locale={locale} initial={initial} />
    </DashboardShell>
  );
}
```

- [ ] **Step 5: Add the nav entry** — modify `components/admin/dashboard/DashboardShell.tsx`:

**(a)** Replace:
```tsx
  const isMetrics = pathname.includes("/admin/metrics");
  const isBandeja =
    !isLedger && !isRunSheet && !isSettings && !isGiftCards && !isCustomers && !isOccasions && !isMetrics;
```
with:
```tsx
  const isMetrics = pathname.includes("/admin/metrics");
  const isPipeline = pathname.includes("/admin/pipeline");
  const isBandeja =
    !isLedger && !isRunSheet && !isSettings && !isGiftCards && !isCustomers && !isOccasions && !isMetrics && !isPipeline;
```

**(b)** After the Métricas `<Link>` (containing `{t("nav_metrics")}`) and BEFORE the "Nueva orden" intake link, insert:
```tsx
            <Link
              href={`/${locale}/admin/pipeline`}
              className={`flex min-h-11 items-center rounded-lg px-3 ${isPipeline ? "bg-rouge text-bone" : "hover:bg-ink/5"}`}
            >
              {t("nav_pipeline")}
            </Link>
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
npm test -- tests/unit/PipelineBoard.test.tsx tests/unit/i18n-parity.test.ts
npx tsc --noEmit
```
Expected: PASS; tsc clean.

- [ ] **Step 7: Commit**

```bash
git add components/admin/pipeline/PipelineBoard.tsx "app/[locale]/admin/pipeline/page.tsx" components/admin/dashboard/DashboardShell.tsx tests/unit/PipelineBoard.test.tsx
git commit -m "feat(pipeline): kanban board, page, and dashboard nav entry

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 10: Full verification — types, suite, build, live server

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
Expected: all pipeline test files pass. Known baseline failures (identical on `main`, and the flaky set varies run-to-run under load): print-chromium / print-render / _preview, CartUpsellStrip, checkout-intent-gift-card, checkout-schema. **No NEW failures.** If the failed-file count looks higher than baseline, re-run once — under heavy load the flaky timeout tests vary; the stable baseline is ~5 files / 7 tests.

- [ ] **Step 3: Build**

```bash
npm run build
```
Expected: exit 0.

- [ ] **Step 4: Live-server verification (both locales)**

Start the dev server with Node 22 (`npm run dev`, background, log to a file). Authenticate: POST `/api/admin/session` with the password from `INTAKE_PASSWORD` in `.env.local`; extract the `intake_session` token from the response Set-Cookie and pass it inline as `-b "intake_session=$TOK"` (the cookie-jar `#HttpOnly_` prefix breaks `-b <file>`).

1. POST a wedding inquiry to the PUBLIC `/api/inquiry` (no auth) → confirm it appears via `GET /api/admin/inquiries` at stage `nuevo`, `sourceChannel: web`.
2. `POST /api/admin/inquiries` (manual lead) → appears at `nuevo`, `sourceChannel: manual`.
3. `PATCH /api/admin/inquiries/<id>` `{stage:"propuesta"}` → moves; `{lost:{reason:"x"}}` → `perdido`.
4. `/es/admin/pipeline` and `/en/admin/pipeline` SSR 200: 5 columns with localized stage headers, cards render, open-value shows; no raw `admin_pipeline.` keys in the HTML.
5. Nav shows "Pipeline"; Bandeja still highlights on `/es/admin/dashboard`.
6. Dev log shows no runtime errors.

**Clean up the seeded test rows afterwards** (`DELETE FROM inquiries WHERE id IN (...)` and their `inquiry_changes`) and stop the dev server.

- [ ] **Step 5: Final commit (only if the live pass required fixes)**

```bash
git add -A && git commit -m "fix(pipeline): post-verification polish

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

**Reminder for the operator:** production runs on a separate Hostinger Node host NOT auto-deployed from GitHub. After updating that host, run `NODE_OPTIONS='--experimental-sqlite' tsx scripts/migrate-inquiries-json-to-sqlite.ts` once there to import existing wedding/event inquiries from `pending-inquiries.json`. Migration 014 auto-applies on boot.
