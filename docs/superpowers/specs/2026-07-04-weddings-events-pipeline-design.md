# Weddings / Events Pipeline — design

**Status:** approved for plan
**Date:** 2026-07-04
**Owner:** Santiago Cardona
**Phase:** Phase 4 (sales tooling) — independent of the CRM/metrics increments, same admin dashboard

## Summary

A **"Pipeline" dashboard tab** that turns high-ticket wedding and event inquiries — which today only append to `pending-inquiries.json` and fire a best-effort email — into a tracked sales board. Inquiries move through five stages (**Nuevo → Contactado → Propuesta → Reservado → Completado**), with **Perdido** as a terminal off-board state. Cards move by **tap, not drag** (reliable on the shop's iPad, no DnD library). Each inquiry carries notes, a follow-up date, and an immutable change history. Staff can also add a lead manually (weddings often arrive by phone). A header shows per-stage counts and an estimated open-pipeline value from the inquiry's budget band.

**Positioning:** wedding/event leads are the shop's highest-value work and currently fall into an inbox with no follow-up structure — the exact "leads only fire an email and get lost" gap. This makes them first-class, trackable, and actionable inside the admin, with no external CRM.

## Decisions captured during brainstorm

| Decision | Choice |
| -------- | ------ |
| Card movement | **Tap to move** (open card → change stage via a control). No drag-and-drop, no DnD library — reliable on iPad. |
| Stages | **Nuevo → Contactado → Propuesta → Reservado → Completado**, five active columns; **Perdido** is a terminal status (with a reason), not a column. |
| Pipeline scope | **Wedding + event only** (high-ticket). Subscription/contact/newsletter inquiries stay out of the board and keep their current flow. |
| Storage | **Migrate to SQLite** (`inquiries` table + `inquiry_changes` history). Append-only JSON can't hold mutable stage/notes. The web intake route dual-persists wedding/event to SQLite; a one-time script migrates existing JSON wedding/event records. |
| Manual add | **Yes** — a "+ Nuevo lead" quick form (phone/walk-in weddings are common). |
| Estimated value | **Yes** — from the budget-band floor (`5-10k`→$5k, `10-25k`→$10k, `25k+`→$25k, `open`→$0). Summed over open stages (Nuevo…Reservado) for the header. |

## Goals & non-goals

### In scope
- Migration `014_inquiries.sql`: `inquiries` + `inquiry_changes` tables.
- `lib/pipeline.ts` — pure module: the ordered stage list + `Perdido`, grouping inquiries by stage, per-stage counts, budget-band→cents mapping, open-pipeline value. Unit-tested, DB-free.
- `lib/inquiry-storage-db.ts` — new SQLite storage: list (all / by stage), get-by-id, create (manual + from web), change stage (+ history), update notes/follow-up, mark lost (+ reason + history), acknowledge (mark seen). The existing `lib/inquiry-storage.ts` stays for the JSON path used by the non-pipeline types.
- `lib/notify-inquiry.ts` unchanged; `app/api/inquiry/route.ts` additionally writes wedding/event inquiries to SQLite (best-effort; a SQLite failure must not break the public form — the email + JSON still happen).
- `scripts/migrate-inquiries-json-to-sqlite.ts` — one-time importer of wedding/event records from `pending-inquiries.json` (idempotent by inquiry id).
- API (all under `requireAdmin` via middleware): `GET /api/admin/inquiries`, `GET /api/admin/inquiries/[id]`, `PATCH /api/admin/inquiries/[id]` (stage | notes | followUpDate | lost), `POST /api/admin/inquiries` (manual create), `POST /api/admin/inquiries/[id]/ack`.
- Screens: `nav_pipeline` nav entry; `/[locale]/admin/pipeline` board (5 columns, tap-to-open cards, header stats); `InquiryDrawer` (full detail + stage selector + notes + follow-up + mark-lost + call/WhatsApp/email quick links, mirroring `OrderDetailDrawer`); a "+ Nuevo lead" manual form.
- i18n `admin_pipeline` namespace (es/en identical keys), parity-gated.
- Tests: pure-module, storage (incl. one JSON-record migration), API, components, i18n parity.

### Out of scope
- Drag-and-drop and any DnD library.
- Sending proposals/emails/quotes from the pipeline (staff act via the existing call/WhatsApp/email links).
- Automatic lead→order conversion (a booked wedding is still entered as an order via intake).
- Assigning inquiries to specific people (2-person shop).
- Historical conversion analytics / win-rate reporting.
- Putting subscription/contact/newsletter inquiries on the board.
- Editing the structured inquiry fields (date/venue/guests) after creation — Phase-later; notes cover the gap.

## Architecture

### Data model — migration `014_inquiries.sql`

```sql
CREATE TABLE IF NOT EXISTS inquiries (
  id             TEXT PRIMARY KEY,           -- reuse the public iq_<...> id when migrated
  type           TEXT NOT NULL,              -- 'wedding' | 'event'
  stage          TEXT NOT NULL,              -- nuevo|contactado|propuesta|reservado|completado|perdido
  contact_name   TEXT NOT NULL,
  contact_email  TEXT NOT NULL,
  contact_phone  TEXT NOT NULL,
  budget_band    TEXT,                       -- 5-10k|10-25k|25k+|open
  event_date     TEXT,                       -- YYYY-MM-DD, optional
  venue          TEXT,
  guests         INTEGER,
  company        TEXT,                       -- event only
  frequency      TEXT,                       -- event only
  vibe           TEXT,                       -- free-text brief from the form
  notes          TEXT,                       -- staff notepad
  follow_up_date TEXT,                       -- YYYY-MM-DD, optional
  lost_reason    TEXT,                       -- set when stage='perdido'
  source_channel TEXT NOT NULL,              -- 'web' | 'manual'
  locale         TEXT,
  acknowledged_at TEXT,                      -- set when first opened; drives the "new" dot
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_inquiries_stage ON inquiries(stage);
CREATE INDEX IF NOT EXISTS idx_inquiries_created ON inquiries(created_at DESC);

CREATE TABLE IF NOT EXISTS inquiry_changes (
  id           TEXT PRIMARY KEY,
  inquiry_id   TEXT NOT NULL,
  at           TEXT NOT NULL,
  actor        TEXT NOT NULL,                -- "maky" for now
  kind         TEXT NOT NULL,                -- created | stage | note | followup | lost
  summary      TEXT NOT NULL,               -- Spanish one-liner
  FOREIGN KEY (inquiry_id) REFERENCES inquiries(id)
);
CREATE INDEX IF NOT EXISTS idx_inquiry_changes_inquiry ON inquiry_changes(inquiry_id, at);
```

Mirrors the `order_changes` audit pattern from migration 010.

### Pure module — `lib/pipeline.ts`

- `type Stage = "nuevo" | "contactado" | "propuesta" | "reservado" | "completado" | "perdido"`.
- `ACTIVE_STAGES: readonly Stage[]` = the five board columns (excludes `perdido`); `OPEN_STAGES` = `nuevo..reservado` (excludes `completado` + `perdido`) for pipeline-value.
- `budgetBandFloorCents(band)` — `5-10k`→500000, `10-25k`→1000000, `25k+`→2500000, `open`/unknown→0.
- `type PipelineInquiry` = the domain shape the board needs (id, type, stage, contactName, budgetBand, eventDate, guests, followUpDate, acknowledgedAt, createdAt, …).
- `groupByStage(inquiries)` → `Record<Stage, PipelineInquiry[]>` (each column sorted by `followUpDate` asc then `createdAt` asc; missing follow-up sorts last).
- `stageCounts(inquiries)` → `Record<Stage, number>`.
- `openPipelineValueCents(inquiries)` = Σ `budgetBandFloorCents` over `OPEN_STAGES`.
- `isValidStage(s)` guard.

Kept pure and DB-free so the grouping/value/validation logic is unit-tested in isolation, like `customer-metrics.ts` / `metrics.ts`.

### Storage — `lib/inquiry-storage-db.ts`

Reuses `getDb`/`runMigrations`. Row↔domain mapping via a `rowToInquiry`.

- `createInquiry(input, now)` — for both web (`source_channel='web'`, given id) and manual (`source_channel='manual'`, generated id). Writes a `created` history row.
- `listInquiries()` — all, newest first (board fetches once and groups client- or server-side; grouping via the pure module).
- `getInquiry(id)` → inquiry + its `changes[]`.
- `changeStage(id, stage, actor, now)` — validates the target, updates, writes a `stage` history row (summary "Etapa: Contactado → Propuesta"). Setting `completado` or `perdido` allowed from any stage.
- `updateNotes(id, notes)` / `setFollowUp(id, date)` — write `note` / `followup` history rows.
- `markLost(id, reason, actor, now)` — stage→`perdido`, store reason, `lost` history row.
- `acknowledge(id, now)` — set `acknowledged_at` if null (idempotent).
- Thresholds/labels are i18n at the UI edge; storage stores machine stages only.

### Intake integration
`app/api/inquiry/route.ts`: after the existing `saveInquiry` (JSON) + `notifyInquiry` (email), if `type` is `wedding`/`event`, also `createInquiry(...)` into SQLite in a try/catch that logs and swallows errors — the **public form must never fail because of the pipeline DB**. The email and JSON remain the source-of-truth safety net.

`scripts/migrate-inquiries-json-to-sqlite.ts`: reads `pending-inquiries.json`, filters `type ∈ {wedding, event}`, and `createInquiry`s each with its original id + `created_at` (idempotent: skip ids already present). Run once by the operator; logged.

### API
Handlers use `runtime = "nodejs"`, awaited Promise params, 404-before-400, matching prior admin routes.

- `GET /api/admin/inquiries` → `{ inquiries, stats }` where `stats = { counts: Record<Stage, number>, openValueCents }` from the pure module.
- `GET /api/admin/inquiries/[id]` → `{ inquiry, changes }` (404 if unknown).
- `PATCH /api/admin/inquiries/[id]` → body may include `stage`, `notes`, `followUpDate`, or `{ lost: { reason } }`, validated by a zod schema; applies the matching storage function(s); returns the updated `{ inquiry, changes }`.
- `POST /api/admin/inquiries` → manual create; body `{ type, contact{name,email,phone}, budgetBand?, eventDate?, venue?, guests?, company?, frequency?, notes? }` validated by `manualInquirySchema`; returns the created inquiry.
- `POST /api/admin/inquiries/[id]/ack` → acknowledge (mark seen).

`schemas/inquiry-admin.ts` exports `inquiryPatchSchema`, `manualInquirySchema`.

### Screens
- **Nav:** `nav_pipeline` ("Pipeline") in `DashboardShell` after "Métricas"; excluded from `isBandeja`.
- **Board** (`/[locale]/admin/pipeline`, `force-dynamic`): server page seeds `listInquiries()`, renders `PipelineBoard`. Header: per-stage count chips + open-pipeline value + "+ Nuevo lead" button. Five columns (horizontal scroll on narrow screens); each `InquiryCard` shows name, a type badge (boda/evento), budget band, event date, follow-up date, and a **dot when `acknowledged_at` is null** (new/unseen). Tapping a card opens the drawer and acknowledges it.
- **`InquiryDrawer`** (mirrors `OrderDetailDrawer`): full detail (contact with `tel:`/`wa.me`/`mailto:` links, budget, date, venue, guests, company/frequency, the form vibe), a **stage selector** (the 5 stages), editable **notes** and **follow-up date**, a **"Marcar perdido"** action with a reason prompt, and a change-history list. Mutations call the PATCH endpoint and refresh.
- **Manual add:** a compact form (in a modal or the drawer) — type toggle, contact, budget band, optional date/venue/guests (wedding) or company/frequency (event), notes. POSTs and lands the card in **Nuevo**.

### Dates / i18n
Reuse `lib/format-datetime.ts`. New `admin_pipeline` namespace (stage labels, budget bands, card/drawer/board strings, manual-form labels, lost-reason) in both message files, identical keys; Spanish default; parity test gates.

## Testing
- `lib/pipeline.test.ts` — stage constants/order, `budgetBandFloorCents` per band, `groupByStage` sort + all-stages present, `stageCounts`, `openPipelineValueCents` excludes completado/perdido, `isValidStage`.
- `lib/inquiry-storage-db.test.ts` — in-memory SQLite: create (web + manual), list, get + changes, changeStage writes history + updates, updateNotes/setFollowUp, markLost sets reason + stage, acknowledge idempotent; plus a test that migrating a JSON-shaped wedding record via `createInquiry` yields the expected row.
- API tests — list returns stats; patch stage/notes/followup/lost each apply + 404 on unknown; manual create validates (bad type/contact → 400); ack idempotent.
- Component tests (real `es.json`): board renders 5 columns + a card with an unseen dot; drawer renders stage selector + notes + mark-lost; manual form renders its fields.
- `i18n-parity.test.ts` gates completeness.

## Implementation approach
Same machinery as the prior phases: one plan, bite-sized TDD tasks, subagent-driven execution with two-stage review. Suggested order: (1) migration, (2) `lib/pipeline.ts` + tests, (3) `lib/inquiry-storage-db.ts` + tests, (4) schemas + list/detail/patch/create/ack routes + tests, (5) intake dual-write + JSON migration script + tests, (6) i18n, (7) `InquiryCard`/`InquiryDrawer`/manual form components + tests, (8) `PipelineBoard` + page + nav + test, (9) full verification (tsc, suite vs baseline, build, live-server pass in es/en).

## Risks

| Risk | Mitigation |
| ---- | ---------- |
| Pipeline DB write breaks the public inquiry form | The SQLite write in the intake route is wrapped in try/catch and best-effort; email + JSON remain the guaranteed path. Tested with a forced-throw. |
| Double-persistence (JSON + SQLite) drift | JSON becomes legacy/backup for pipeline types; the board reads SQLite exclusively. The one-time migration is idempotent by id. Documented that SQLite is the board's source of truth. |
| Stage label vs machine value drift | Stages are machine strings in storage; labels are i18n at the UI edge only; the pure module owns the ordered list. |
| iPad usability of a wide 5-column board | Columns scroll horizontally; cards are tap-targets (min-h-11); no drag. |
| `InquiryDrawer` duplicating order-drawer logic | New component but follows the `OrderDetailDrawer` structure; no shared order code pulled in. |
| Estimated value read as exact revenue | Labeled as an **estimate** from budget-band floors; documented and shown with a qualifier in the UI. |

## File map

New files:
- `db/migrations/014_inquiries.sql`
- `lib/pipeline.ts` · `tests/unit/pipeline.test.ts`
- `lib/inquiry-storage-db.ts` · `tests/unit/inquiry-storage-db.test.ts`
- `schemas/inquiry-admin.ts`
- `scripts/migrate-inquiries-json-to-sqlite.ts`
- `app/api/admin/inquiries/route.ts` (GET list, POST create) · test
- `app/api/admin/inquiries/[id]/route.ts` (GET, PATCH) · test
- `app/api/admin/inquiries/[id]/ack/route.ts` (POST) · test
- `app/[locale]/admin/pipeline/page.tsx`
- `components/admin/pipeline/PipelineBoard.tsx` · test
- `components/admin/pipeline/InquiryCard.tsx`
- `components/admin/pipeline/InquiryDrawer.tsx`
- `components/admin/pipeline/NewLeadForm.tsx`
- Their component tests under `tests/unit/...`

Modified files:
- `app/api/inquiry/route.ts` — best-effort SQLite dual-write for wedding/event.
- `components/admin/dashboard/DashboardShell.tsx` — "Pipeline" nav entry.
- `messages/es.json`, `messages/en.json` — `admin_pipeline` namespace + `admin_dashboard.nav_pipeline`.
