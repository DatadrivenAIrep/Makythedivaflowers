# Customer CRM — Phase 2 — design

**Status:** approved for plan
**Date:** 2026-07-04
**Owner:** Santiago Cardona
**Phase:** Phase 4 groundwork (CRM), increment 2 — builds on Phase 1 (shipped 2026-07-04)

## Summary

Phase 1 shipped the CRM backbone: Customers list + profile with derived metrics, segments, free-text notes, and tags. Phase 2 adds the two enrichment surfaces Phase 1 deferred — **important dates** (birthdays / anniversaries / custom, each optionally labeled with *who it's for*) and **structured preferences** (favorite flowers, favorite colors, dislikes/allergies as chip lists) — plus a read-only **"Ocasiones" dashboard tab** showing who has an occasion coming up in the next 7/30 days, with call/WhatsApp/new-order quick actions.

**No automated sending.** Outbound reminders (SMS/WhatsApp) need cron/scheduling infrastructure that doesn't exist yet and carry mis-send risk; they are a future phase. Phase 2's value is: Maky captures the dates and tastes she already learns in conversation, and the shop gets a daily-glanceable list of upcoming occasions to act on manually.

## Decisions captured during brainstorm

| Decision | Choice |
| -------- | ------ |
| Reminder scope | **Data capture + read-only "próximas ocasiones" view.** No automated sending (future phase; needs cron infra that doesn't exist). |
| Recipient modeling | **Dates carry an optional free-text "who" label** ("esposa María", "mamá"). No recipient entity table. Preferences live at the customer level. |
| Preference capture | **Chips, tag-style** (same interaction as Phase 1 tags), with datalist suggestions from already-used values. Not catalog-driven lists, not free-text fields. |
| Occasions view placement | **Own nav tab "Ocasiones"** (`/admin/occasions`), same top-level pattern as "Clientes". Not a Bandeja widget. |
| Data model approach | **Two new tables** (dates + preferences), mirroring Phase 1's `customer_tags` style. Next-occurrence math in a pure JS module, not SQL. |

## Goals & non-goals

### In scope (Phase 2)
- Migration `013_customer_crm_phase2.sql`: `customer_important_dates` + `customer_preferences` tables.
- `lib/customer-dates.ts` — pure module: `nextOccurrence`, `isValidMonthDay`, types. `now` injected, no DB.
- `lib/customer-dates-storage.ts` — new storage module (keeps `customer-storage.ts` from growing further): dates CRUD, preferences CRUD, `listPreferenceValues(kind)` for suggestions, `listUpcomingOccasions(withinDays, now)`.
- `schemas/customer-dates.ts` — zod bodies for dates and preferences.
- API:
  - Profile `GET /api/admin/customers/[id]` response **extended** (via `getCustomerProfile`) with `dates` and `preferences` — no route-file change needed.
  - `POST` / `DELETE /api/admin/customers/[id]/dates` — add/remove a date; returns the updated dates list.
  - `POST` / `DELETE /api/admin/customers/[id]/preferences` — add/remove a preference value; returns the updated preferences map.
  - `GET /api/admin/occasions?days=30` — upcoming occasions across all customers, sorted by days-until.
- Screens:
  - Profile gains two sections, each its own component: `ImportantDates` (list + add form + per-row delete) and `PreferenceChips` (three chip groups; *dislikes* styled as a rose-colored warning). Suggestions passed server-side from the page, like Phase 1's `allTags`.
  - `app/[locale]/admin/occasions/page.tsx` + `OccasionsView` — 7/30-day toggle, rows with urgency chip ("HOY" / "en N días"), customer name → profile link, kind badge, who-label, call/WhatsApp/new-order (intake `?phone=` prefill) quick actions.
  - `nav_occasions` ("Ocasiones"/"Occasions") entry in `DashboardShell`.
- i18n: extend `admin_customers` namespace; add `admin_dashboard.nav_occasions`. Parity test gates.
- Tests: pure-module unit tests, storage tests, API tests, component tests, i18n parity — same TDD discipline as Phase 1.

### Out of scope (future phases)
- Automated reminder sending (SMS/WhatsApp/email) and any cron/scheduling infrastructure.
- Editing a date in place (delete + re-add covers it; keeps CRUD minimal).
- Recipient as a first-class entity (per-recipient preferences).
- Occasion → campaign/card-message integration.
- Duplicate-customer merging or any other Phase-1-deferred item.

## Architecture

### Data model — migration `013_customer_crm_phase2.sql`

```sql
CREATE TABLE IF NOT EXISTS customer_important_dates (
  id           TEXT PRIMARY KEY,            -- cid_<base36>
  customer_id  TEXT NOT NULL,
  kind         TEXT NOT NULL,               -- 'birthday' | 'anniversary' | 'custom'
  label        TEXT,                        -- who/what it's for: "esposa María", "graduación hija"
  month        INTEGER NOT NULL,            -- 1-12
  day          INTEGER NOT NULL,            -- 1-31 (validated against month)
  year         INTEGER,                     -- optional; birth year often unknown
  created_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_important_dates_customer ON customer_important_dates(customer_id);
CREATE INDEX IF NOT EXISTS idx_important_dates_month_day ON customer_important_dates(month, day);

CREATE TABLE IF NOT EXISTS customer_preferences (
  customer_id  TEXT NOT NULL,
  kind         TEXT NOT NULL,               -- 'favorite_flower' | 'favorite_color' | 'dislike'
  value        TEXT NOT NULL,               -- normalized (trim/collapse/lowercase, max 40)
  PRIMARY KEY (customer_id, kind, value)
);
CREATE INDEX IF NOT EXISTS idx_customer_preferences_kind_value ON customer_preferences(kind, value);
CREATE INDEX IF NOT EXISTS idx_customer_preferences_customer ON customer_preferences(customer_id);
```

`month`/`day` as separate integers (not an ISO date) because the year is often unknown and annual recurrence becomes trivial. Multiple dates of the same kind per customer are allowed (two daughters → two labeled birthdays). Preference values get their own normalizer (`normalizePreference`, same rules as `normalizeTag` but max **40** chars — flower names run longer than tags).

### Pure module — `lib/customer-dates.ts`

- `type DateKind = "birthday" | "anniversary" | "custom"`, `type PreferenceKind = "favorite_flower" | "favorite_color" | "dislike"`.
- `isValidMonthDay(month, day): boolean` — rejects Apr 31, Feb 30, etc. **Feb 29 is accepted** as a stored value.
- `nextOccurrence(month, day, now: Date): { date: string; daysUntil: number }` — next annual occurrence on a **UTC calendar-day basis** (consistent with Phase 1's `customerStats` month boundary; deterministic for tests). `daysUntil === 0` means today. Year rollover handled (a Dec 30 date queried on Dec 31 returns next year's). **Feb 29 rule:** in non-leap years the occurrence maps to **Feb 28** (explicit, tested).

The tricky calendar math lives here, tested exhaustively without a DB — mirroring how Phase 1 isolated segment math in `customer-metrics.ts`.

### Storage — `lib/customer-dates-storage.ts` (new module)

Reuses `getDb`/`runMigrations`; imports `nextOccurrence` from the pure module and `normalizeTag`-style normalization locally.

- `addImportantDate(customerId, { kind, label?, month, day, year? }): ImportantDate[]` — generates `cid_` id; returns the customer's updated list.
- `removeImportantDate(customerId, dateId): ImportantDate[]`.
- `listDatesFor(customerId, now): ImportantDate[]` — each row enriched with `next: { date, daysUntil }`, sorted by `daysUntil` asc.
- `normalizePreference(raw): string | null` — trim/collapse/lowercase/max 40; null when empty.
- `addPreference(customerId, kind, value)` / `removePreference(...)` → updated `PreferencesMap` (`{ favorite_flower: string[]; favorite_color: string[]; dislike: string[] }`, each sorted).
- `listPreferencesFor(customerId): PreferencesMap`.
- `listPreferenceValues(kind): string[]` — distinct values across customers, for datalist suggestions.
- `listUpcomingOccasions(withinDays, now): UpcomingOccasion[]` — SELECTs all dates JOIN customers (id, name, phone), computes `nextOccurrence` **in JS**, filters `daysUntil <= withinDays`, sorts by `daysUntil` asc then customer name. At florist scale (hundreds of rows) an in-memory pass beats SQL date gymnastics and keeps one source of truth for the calendar math.

`ImportantDate`: `{ id, customerId, kind, label?, month, day, year?, createdAt, next: { date, daysUntil } }`.
`UpcomingOccasion`: `{ dateId, customerId, customerName, phone, kind, label?, next: { date, daysUntil } }`.

### API

All under the existing middleware auth; handler conventions identical to Phase 1 (`runtime = "nodejs"`, awaited Promise params, 404-before-400 ordering).

- **Profile GET** — `lib/customer-profile.ts`'s `getCustomerProfile` gains `dates: listDatesFor(id, now)` and `preferences: listPreferencesFor(id)`; the `[id]/route.ts` needs no change. `CustomerProfileData` type extends accordingly.
- `POST /api/admin/customers/[id]/dates` — body `{ kind, label?, month, day, year? }` validated by `importantDateSchema` (zod) **plus** `isValidMonthDay` (invalid → 400). Returns `{ dates }`.
- `DELETE /api/admin/customers/[id]/dates` — body `{ id }`. Removing a non-existent id is a no-op returning the current list (idempotent, like tag delete).
- `POST` / `DELETE /api/admin/customers/[id]/preferences` — body `{ kind, value }`; kind validated by enum; value normalized (whitespace-only → 400). Returns `{ preferences }`.
- `GET /api/admin/occasions?days=N` — `days` clamped to [1, 366], default 30. Returns `{ occasions: UpcomingOccasion[] }`.

`schemas/customer-dates.ts` exports `importantDateSchema`, `dateDeleteSchema`, `preferenceBodySchema`.

### Screens

- **Profile sections** (placed between the metrics row and the addresses section):
  - `components/admin/customers/ImportantDates.tsx` — props `{ customerId, initial: ImportantDate[] }`, own state. Rows: kind badge (i18n label: cumpleaños / aniversario / personalizada, with a phosphor icon per kind), who-label, occurrence ("15 mar") + urgency chip ("en 23 días"), delete button. Add form: kind select, month + day selects (day options adjust per month), optional year, optional label. POST/DELETE against the dates API.
  - `components/admin/customers/PreferenceChips.tsx` — props `{ customerId, initial: PreferencesMap, suggestions: Record<PreferenceKind, string[]> }`. Three labeled chip groups with add-input (datalist of suggestions) and per-chip delete; the *dislike* group renders in warning style (`bg-rose-50 text-rose-800`) because it encodes allergies/"sin lirios".
  - `app/[locale]/admin/customers/[id]/page.tsx` passes `suggestions` (from `listPreferenceValues` per kind) as a prop, mirroring how the list page passes `allTags`.
- **Ocasiones tab:**
  - `app/[locale]/admin/occasions/page.tsx` — `force-dynamic` server page: `listUpcomingOccasions(30, new Date())` → `OccasionsView` inside `DashboardShell`.
  - `components/admin/occasions/OccasionsView.tsx` — client component: 7/30-day toggle (refetches `/api/admin/occasions?days=`), empty state, rows: urgency chip (`HOY` highlighted / `en N días`), customer name linking to `/admin/customers/[id]`, kind badge, who-label, occurrence date, and quick actions (tel:, wa.me, intake `?phone=` prefill).
  - `DashboardShell`: add `isOccasions` + "Ocasiones" nav link (after "Clientes"); exclude from `isBandeja`.

### i18n

Extend `admin_customers` with: dates section labels (kinds, add-form fields, "en {days} días", "HOY"), preference group labels, occasions-view strings. Add `admin_dashboard.nav_occasions`. Identical keys in `messages/es.json` and `messages/en.json`; parity test gates.

## Testing

- `tests/unit/customer-dates.test.ts` — `nextOccurrence`: today → 0, tomorrow → 1, already-passed-this-year → next year, Dec→Jan rollover, Feb 29 on leap year, Feb 29 → Feb 28 on non-leap year; `isValidMonthDay` accept/reject matrix.
- `tests/unit/customer-dates-storage.test.ts` — in-memory SQLite: dates add/list (sorted by daysUntil)/remove, multiple same-kind dates, preferences add (normalized, deduped)/remove/list, suggestions distinct across customers, `listUpcomingOccasions` window filter + sort + customer join fields, fixed `NOW` injected.
- API tests — dates: add valid, Apr 31 → 400, unknown customer → 404, delete idempotent; preferences: add normalized, whitespace-only → 400, bad kind → 400; occasions: default 30, `days=7` narrows, clamp on `days=9999`; profile GET now includes `dates` + `preferences`.
- Component tests (real `es.json`): `ImportantDates` renders a row + add form; `PreferenceChips` renders three groups + warning styling on dislikes; `OccasionsView` renders urgency chip + profile link; profile page test extended for new sections.
- `i18n-parity.test.ts` gates key completeness.

## Implementation approach

Same machinery as Phase 1: one plan, bite-sized TDD tasks, subagent-driven execution with review. Suggested order: (1) migration, (2) pure date module, (3) storage, (4) schemas + dates/preferences routes, (5) occasions route, (6) profile composition, (7) i18n, (8) profile section components, (9) occasions page + nav, (10) full verification (tsc, suite vs baseline, build, live-server pass in es/en).

## Risks

| Risk | Mitigation |
| ---- | ---------- |
| UTC vs shop-local day boundary makes "HOY" flip a few hours early/late | Accepted for Phase 2 (documented); consistent with Phase 1's UTC month boundary. Revisit if Maky reports confusion. |
| Feb 29 / invalid month-day combos | Explicit rules (`Feb 28` fallback; `isValidMonthDay` at the API edge) with dedicated tests. |
| `CustomerProfile.tsx` grows unmanageable | New sections are separate components with their own state; profile only composes them. |
| Occasions view slow with many dates | In-memory pass over all date rows — fine to thousands; `(month, day)` index exists if SQL pre-filtering is ever needed. |
| Preference chips duplicate tag UX inconsistently | Same normalize-then-PK-dedupe pattern and chip interaction as Phase 1 tags. |

## File map

New files:
- `db/migrations/013_customer_crm_phase2.sql`
- `lib/customer-dates.ts` · `tests/unit/customer-dates.test.ts`
- `lib/customer-dates-storage.ts` · `tests/unit/customer-dates-storage.test.ts`
- `schemas/customer-dates.ts`
- `app/api/admin/customers/[id]/dates/route.ts` · `tests/unit/api-admin-customers-dates.test.ts`
- `app/api/admin/customers/[id]/preferences/route.ts` · `tests/unit/api-admin-customers-preferences.test.ts`
- `app/api/admin/occasions/route.ts` · `tests/unit/api-admin-occasions.test.ts`
- `app/[locale]/admin/occasions/page.tsx`
- `components/admin/customers/ImportantDates.tsx` · `tests/unit/ImportantDates.test.tsx`
- `components/admin/customers/PreferenceChips.tsx` · `tests/unit/PreferenceChips.test.tsx`
- `components/admin/occasions/OccasionsView.tsx` · `tests/unit/OccasionsView.test.tsx`

Modified files:
- `lib/customer-profile.ts` — compose `dates` + `preferences` into `CustomerProfileData`.
- `app/[locale]/admin/customers/[id]/page.tsx` — pass preference `suggestions` prop.
- `components/admin/customers/CustomerProfile.tsx` — render the two new sections.
- `components/admin/dashboard/DashboardShell.tsx` — "Ocasiones" nav entry.
- `messages/es.json`, `messages/en.json` — new keys (parity enforced).
