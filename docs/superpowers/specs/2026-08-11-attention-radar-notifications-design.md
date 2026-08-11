# Attention Radar & In-Panel Notifications — Design

**Date:** 2026-08-11
**Status:** Draft for review
**Author:** Santiago (with Claude)

## Problem

New customer requests arrive through several paths, but the people who handle
them (florists) are busy making arrangements and do not watch the admin system.
Today, awareness of a new request depends on either an open tab polling every
15–20s **and** someone actively looking at it, or a Resend email — which the
owner avoids. Concretely, from the current code:

- **New unpaid web order** → no alert anywhere; only appears in the dashboard
  pending queue if a tab is open (`lib/order-queue.ts`, `useDashboardPolling`).
- **New wedding/event lead** → owner email only; the pipeline board
  (`PipelineBoard.tsx`) does **not** auto-refresh, so it needs a manual reload.
- **New contact-form submission** → saved to `pending-inquiries.json` only, no
  DB row, no state, notifies nobody (`app/api/contact/route.ts`).
- **New paid order** → chimes, but **only on iPad** (`BandejaView.tsx`
  `isIpadLike()` gate) and **only on the dashboard** — the TV chimes only for
  paid production orders (`TvBoard.tsx` → `newPaidIds`).

## Goal

Make the **open admin surfaces "alive"** so whoever is in the workshop keeps
ambient control of what is happening, without having to go looking. Two
surfaces, everything stays in-system (no phone / no push):

1. **The TV** (`/admin/tv`, already running in the workshop) becomes the
   **radar**: an always-visible "sin atender" (unattended) counter plus an
   audible chime whenever any new request lands, that persists until someone
   attends it.
2. **The dashboard** (`/admin/dashboard`) gets **in-panel notifications** for
   all request types (not just orders), extending the existing chime + title
   flash.

## Non-Goals (YAGNI)

- **No** Web Push / PWA / service worker / manifest / `Notification` API.
- **No** WhatsApp/SMS/email escalation to the owner's phone. (Explicitly
  declined: everything stays on the TV counter + dashboard notifications.)
- **No** newsletter submissions in the radar (not time-sensitive).
- **No** real-time transport (SSE/WebSockets). Keep the existing polling model.
- **No** per-type distinct sounds for v1 — one universal chime. (Can add later.)

## What counts as "sin atender" (unattended)

The radar is a **derived view** — no new notifications table. It is recomputed
on every poll from state that already exists:

| Kind | Source | "Unattended" means | Becomes "attended" when |
|------|--------|--------------------|-------------------------|
| Order | `getPendingQueue()` (`lib/order-queue.ts`) | present in the pending queue (any `PendingReason`) | acknowledged / paid / dispatched — already handled by `order_acknowledgments` + queue rules |
| Lead (wedding/event) | `inquiries` table | `acknowledged_at IS NULL` | opened in the pipeline drawer → `POST /api/admin/inquiries/[id]/ack` (already wired) |
| Contact | `inquiries` table (new `type = "contact"`) | `acknowledged_at IS NULL` | opened from dashboard/radar → same ack endpoint |

This reuses the `acknowledged_at` column and `acknowledge()` function that
already exist in `lib/inquiry-storage-db.ts` — no migration.

## Architecture

### 1. Contact submissions enter the inquiries DB (decision: option A)

Contact submissions need a persisted state so they can be marked attended.

- Extend `InquiryType` in `lib/pipeline.ts`:
  `"wedding" | "event"` → `"wedding" | "event" | "contact"`.
  (The DB `type` column is free-text `TEXT`, so **no migration** is needed.)
- In `app/api/contact/route.ts`, in addition to the existing JSON
  `saveInquiry` (kept for audit/backwards-compat), also call
  `createInquiry({ type: "contact", contactName, contactEmail, contactPhone,
  notes: message, sourceChannel: "web", locale })` in a best-effort
  `try/catch` — mirroring the pattern already used in `app/api/inquiry/route.ts`
  (lines 38–63) so the public form never fails because of the DB.
- Contact rows start at stage `"nuevo"`, `acknowledged_at = NULL`.

### 2. Contact stays OUT of the sales kanban

The pipeline kanban must remain wedding/event only.

- Add a filtered read for the kanban. Preferred: give `listInquiries` an
  options arg, e.g. `listInquiries({ types?: InquiryType[] })`, or add
  `listPipelineInquiries()` that excludes `type = "contact"`. The GET handler
  in `app/api/admin/inquiries/route.ts` uses the filtered set for both the list
  **and** the stats (`stageCounts`, `openPipelineValueCents`) so contacts never
  inflate pipeline value or column counts.

### 3. Shared attention aggregator — `lib/attention.ts` (new)

A single server-only function both surfaces consume:

```ts
export type AttentionKind = "order" | "inquiry" | "contact";

export type AttentionItem = {
  kind: AttentionKind;
  id: string;          // orderId or inquiry id
  createdAt: string;   // ISO
  label: string;       // "Orden web · María" / "Boda · Ana" / "Contacto · Luis"
  reason?: string;     // order PendingReason, when kind === "order"
};

export type AttentionSnapshot = {
  items: AttentionItem[];                                   // newest first
  counts: { orders: number; inquiries: number; contacts: number; total: number };
  generatedAt: string;
};

export async function getAttention(): Promise<AttentionSnapshot>;
```

- **orders**: map `getPendingQueue()` → `AttentionItem[]` (`kind: "order"`,
  carry the `reason`).
- **inquiries**: wedding/event with `acknowledged_at IS NULL` (a small new
  query in `inquiry-storage-db.ts`, e.g. `listUnacknowledged(types)`).
- **contacts**: `type = "contact"` with `acknowledged_at IS NULL`.

Exposed at **`GET /api/admin/attention`** (`requireAdmin`, `no-store`,
`runtime = "nodejs"`, `dynamic = "force-dynamic"`) returning the snapshot.

### 4. TV surface — the radar

`lib/tv-board.ts` (`buildTvBoard` / `TvBoardResponse`): embed the snapshot so
the TV's single existing poll carries it —
`attention: AttentionSnapshot` added to the response. (Reuses `getAttention()`.)

`components/admin/tv/TvBoard.tsx`:
- **Header counter**: add a `<Counter n={data.attention.counts.total}
  label="Sin atender" color="var(--color-warn)" />` next to the existing
  Por hacer / En ruta / Entregadas counters. Always visible, glanceable from
  across the workshop. Persists until items are attended (derived, so it just
  reflects current state).
- **Chime on any new unattended item**: extend `useTvPolling` to also detect
  newly-appeared `attention.items` ids (today it only detects `paidEvents` via
  `newPaidIds`). Reuse `useTvSound().chime()` — the sound gate + WebAudio synth
  already exist; no new asset. The existing "Toca para activar el sonido"
  overlay stays.
- **Transient toast** (optional, keep production view clean): when a new item
  arrives, briefly name it ("Nueva solicitud · Contacto") for a few seconds.
  The production `todo` list is unchanged — unpaid orders / leads / contacts are
  intake awareness, not production cards.

### 5. Dashboard surface — in-panel notifications

`components/admin/dashboard/useDashboardPolling.ts`:
- Add a third fetch to `/api/admin/attention` (alongside queue + feed), and
  compute new ids across the **union** (orders + inquiries + contacts) to drive
  the chime. Expose `attention` in the returned state.

`components/admin/dashboard/BandejaView.tsx`:
- **New "Nuevas solicitudes" section** listing unattended **inquiries +
  contacts** (orders already render in the "Pendientes" section). Each row is
  clickable and opens the relevant detail, which acks it.
- **Chime for all types**: `onNewOrder` becomes `onNewItem(ids)` fired for any
  new attention id.
- **Sound gate**: relax the `isIpadLike()` restriction — play once audio is
  unlocked (the existing `unlockAudio` pointer-down handler already covers the
  browser autoplay requirement), on any device, plus a **persisted mute
  toggle** so a desktop viewer can silence it. (Decision baked in; see Open
  Questions if you'd rather keep iPad-only.)

### 6. Contact detail + ack

Opening a contact from the dashboard/radar must ack it. Contacts have no sales
stage workflow, so reuse a **minimal read-only contact view** (name, phone,
email, message, time) that calls `POST /api/admin/inquiries/[id]/ack` on open —
rather than the full `InquiryDrawer` (which assumes event fields). The ack
endpoint already exists and is type-agnostic.

### 7. Pipeline auto-refresh

`components/admin/pipeline/PipelineBoard.tsx`: add a polling interval
(~20s) that calls the existing `refresh()`, paused on a hidden tab (mirror the
`visibilitychange` pattern in `useDashboardPolling`). No chime here — the leads
already alert on the TV and dashboard; the board just needs to stop requiring a
manual reload. New leads appear on their own.

## Data flow

```
Public forms                     Admin surfaces (poll)
────────────                     ─────────────────────
/api/inquiry  ─┐                 TV  ── /api/admin/tv/board ──┐
/api/contact ──┤ createInquiry   Dash ─ /api/admin/attention ─┤
/api/checkout ─┘  saveOrder      Pipe ─ /api/admin/inquiries ─┘
        │            │                         │
        ▼            ▼                          ▼
   inquiries    orders/            getAttention()  ← derives counts + items
   (+contact)   order_acks         (getPendingQueue + unacked inquiries + contacts)
                                          │
                                   chime + counter (persist until attended)
```

No new tables. No new background jobs. Polling only, same as today.

## Error handling

- `getAttention()` and the new endpoint follow the existing best-effort model:
  a DB error surfaces as an `error` flag and keeps last-good data on screen
  (as `useDashboardPolling` / `useTvPolling` already do).
- Contact DB insert is best-effort (`try/catch`); the public contact form must
  never 500 because of the pipeline DB — matches the existing inquiry path.
- Audio is optional everywhere: if WebAudio/`<audio>` is unavailable the board
  still works silently (already true in `useTvSound`).

## Testing

- **`lib/attention.ts`** — unit tests with DB fixtures: pending orders +
  unacked inquiries + unacked contacts produce correct `counts` and `items`;
  acked/paid items drop off; contacts excluded from pipeline stats.
- **`lib/inquiry-storage-db.ts`** — `createInquiry({ type: "contact" })`
  persists; `listInquiries({ types })` filtering excludes contact for the
  kanban; `acknowledge()` clears a contact from the radar.
- **`useDashboardPolling`** — new-id detection across the orders+inquiries+
  contacts union (priming behavior: no chime on first load).
- **Regression note:** a full `npm test` currently has ~7 pre-existing failures
  on base `main` (Chromium spawn ENOEXEC + checkout/preview). Verify any new
  failure against base before attributing it to this work.

## Files touched (summary)

| File | Change |
|------|--------|
| `lib/pipeline.ts` | add `"contact"` to `InquiryType` |
| `lib/inquiry-storage-db.ts` | `listInquiries({ types })` filter + `listUnacknowledged(types)` |
| `lib/attention.ts` | **new** — `getAttention()` aggregator |
| `app/api/admin/attention/route.ts` | **new** — GET snapshot |
| `app/api/contact/route.ts` | also `createInquiry({ type: "contact" })` (best-effort) |
| `app/api/admin/inquiries/route.ts` | GET uses wedding/event-only set for list + stats |
| `lib/tv-board.ts` | embed `attention` in `TvBoardResponse` |
| `components/admin/tv/useTvPolling.ts` | detect new attention ids |
| `components/admin/tv/TvBoard.tsx` | "Sin atender" counter + chime on new item + toast |
| `components/admin/dashboard/useDashboardPolling.ts` | fetch `/attention`, union new-id detection |
| `components/admin/dashboard/BandejaView.tsx` | "Nuevas solicitudes" section, chime all types, relax sound gate + mute toggle |
| `components/admin/pipeline/PipelineBoard.tsx` | polling auto-refresh |
| contact detail view + ack wiring | minimal read-only view that acks on open |

## Open questions (defaults chosen; flag if you disagree)

1. **Dashboard sound scope** — default: sound on any device once audio is
   unlocked, with a mute toggle. Alternative: keep it iPad-only.
2. **TV toast** — default: show a brief toast naming each new item. Alternative:
   counter + chime only, no toast.
3. **Contact view** — default: minimal read-only card. Alternative: promote
   contact into the full inquiry drawer.
