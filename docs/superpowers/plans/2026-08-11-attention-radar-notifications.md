# Attention Radar & In-Panel Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the open admin surfaces (the workshop TV and the dashboard) ambiently aware of every new customer request — orders, event/wedding leads, and contact-form submissions — via a persistent "sin atender" counter, an audible chime, and an in-panel notifications list, all derived from existing state with no new tables and no push infrastructure.

**Architecture:** A single server-only aggregator `getAttention()` derives the "unattended" set from three existing sources — the order pending queue, unacknowledged pipeline inquiries, and (new) contact-form rows in the same inquiries table. Both surfaces consume it by polling (the TV via its existing `buildTvBoard` response; the dashboard via a new `/api/admin/attention` endpoint). "Attended" reuses the existing `order_acknowledgments` mechanism for orders and the existing `acknowledged_at` column + ack endpoint for inquiries/contacts. No SSE/WebSockets — the codebase's polling model is preserved.

**Tech Stack:** Next.js (App Router, `runtime = "nodejs"`), `node:sqlite` via `lib/db` + `db/migrations/*.sql`, React client components, `next-intl`, Vitest + `@testing-library/react`, Web Audio (`useTvSound`) + `<audio>` chime.

**Spec:** `docs/superpowers/specs/2026-08-11-attention-radar-notifications-design.md`

---

## Setup (before Task 1)

We are on `main`. Create an isolated branch/worktree before any commit (the harness must not commit to `main` directly).

- [ ] **Create a feature branch**

```bash
cd "/Volumes/Datadriven/02_PROYECTOS/Diva Flowers"
git checkout -b feat/attention-radar
```

(If using `superpowers:using-git-worktrees`, create the worktree instead; the plan's relative paths are unchanged.)

## Known constraint — deliberate, not a bug to fix here

The dashboard's sibling endpoints `/api/admin/orders/queue` and `/api/admin/orders/feed` are **not** guarded by `requireAdmin` (there is no `middleware.ts`; only `tv/board` calls `requireAdmin`). This is the pre-existing "admin auth gap." The new `/api/admin/attention` endpoint **mirrors its siblings (unguarded)** for consistency and test simplicity. Do **not** add auth to it in this plan — hardening the whole `/api/admin/*` surface is a separate follow-up. It is called out so the choice is explicit.

## File Structure

| File | New/Modify | Responsibility |
|------|-----------|----------------|
| `lib/pipeline.ts` | Modify | Add `"contact"` to `InquiryType` |
| `lib/inquiry-storage-db.ts` | Modify | `listInquiries({ types })` filter + `listUnacknowledged(types)` |
| `app/api/admin/inquiries/route.ts` | Modify | Pipeline GET uses wedding/event only (list + stats) |
| `app/api/contact/route.ts` | Modify | Also persist a `type:"contact"` inquiry (best-effort) |
| `lib/attention.ts` | **New** | `getAttention()` aggregator + `AttentionSnapshot`/`AttentionItem` types |
| `app/api/admin/attention/route.ts` | **New** | GET snapshot (unguarded, mirrors queue/feed) |
| `lib/tv-board.ts` | Modify | Embed `attention` in `TvBoardResponse` |
| `components/admin/tv/tv-detect.ts` | Modify | Pure `newIds(ids, seen)` helper |
| `components/admin/tv/useTvPolling.ts` | Modify | `onNewAttention(items)` detection |
| `components/admin/tv/TvBoard.tsx` | Modify | "Sin atender" header counter + chime + toast on new item |
| `components/admin/dashboard/useDashboardPolling.ts` | Modify | Fetch `/attention`, union new-id detection, expose `attention` |
| `components/admin/dashboard/AttentionDrawer.tsx` | **New** | Read-only lead/contact view that acks on open |
| `components/admin/dashboard/BandejaView.tsx` | Modify | "Nuevas solicitudes" section, chime all types, mute toggle |
| `components/admin/pipeline/PipelineBoard.tsx` | Modify | Auto-refresh polling |
| `messages/en.json`, `messages/es.json` | Modify | Dashboard strings for the new section + mute |
| `tests/unit/inquiry-storage-db.test.ts` | **New** | Storage query tests |
| `tests/unit/api-contact.test.ts` | **New** | Contact→DB test |
| `tests/unit/attention.test.ts` | **New** | Aggregator test |
| `tests/unit/api-admin-attention.test.ts` | **New** | Endpoint test |
| `tests/unit/tv-board-attention.test.ts` | **New** | Board embedding test |
| `tests/unit/tv-detect.test.ts` | Modify | `newIds` test |
| `tests/unit/api-admin-inquiries-list.test.ts` | Modify | Contact-exclusion test |
| `tests/unit/AttentionDrawer.test.tsx` | **New** | Ack-on-open test |
| `tests/unit/PipelineBoard.test.tsx` | Modify | Auto-refresh test |

**Test command (all tasks):** `NODE_OPTIONS='--experimental-sqlite' npx vitest run <file>` — the `npm test` script sets that `NODE_OPTIONS` flag; when invoking `vitest` directly you must pass it too or `node:sqlite` throws.

---

### Task 1: Inquiry storage — `contact` type + filtered/unacked queries

**Files:**
- Modify: `lib/pipeline.ts:4`
- Modify: `lib/inquiry-storage-db.ts:144-148` (add filter arg) and add a new export
- Test: `tests/unit/inquiry-storage-db.test.ts` (new)

- [ ] **Step 1: Write the failing test**

Create `tests/unit/inquiry-storage-db.test.ts`:

```ts
import { it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { createInquiry, acknowledge, listInquiries, listUnacknowledged } from "@/lib/inquiry-storage-db";

beforeEach(() => { vi.stubEnv("SQLITE_FILE", ":memory:"); runMigrations(); });
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

it("listInquiries filters by type", () => {
  createInquiry({ id: "w1", type: "wedding", contactName: "Ana", contactEmail: "a@x.com", contactPhone: "1", sourceChannel: "web" });
  createInquiry({ id: "c1", type: "contact", contactName: "Luis", contactEmail: "l@x.com", contactPhone: "", sourceChannel: "web" });
  expect(listInquiries({ types: ["wedding", "event"] }).map((i) => i.id)).toEqual(["w1"]);
  expect(listInquiries().map((i) => i.id).sort()).toEqual(["c1", "w1"]);
});

it("listUnacknowledged returns only unacked rows of the given types", () => {
  createInquiry({ id: "w1", type: "wedding", contactName: "Ana", contactEmail: "a@x.com", contactPhone: "1", sourceChannel: "web" });
  createInquiry({ id: "w2", type: "wedding", contactName: "Bea", contactEmail: "b@x.com", contactPhone: "1", sourceChannel: "web" });
  createInquiry({ id: "c1", type: "contact", contactName: "Luis", contactEmail: "l@x.com", contactPhone: "", sourceChannel: "web" });
  acknowledge("w2");
  expect(listUnacknowledged(["wedding", "event"]).map((i) => i.id)).toEqual(["w1"]);
  expect(listUnacknowledged(["contact"]).map((i) => i.id)).toEqual(["c1"]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_OPTIONS='--experimental-sqlite' npx vitest run tests/unit/inquiry-storage-db.test.ts`
Expected: FAIL — `type "contact"` not assignable, and `listUnacknowledged` / `listInquiries({types})` not exported.

- [ ] **Step 3: Extend `InquiryType`**

In `lib/pipeline.ts`, line 4, replace:

```ts
export type InquiryType = "wedding" | "event";
```

with:

```ts
export type InquiryType = "wedding" | "event" | "contact";
```

- [ ] **Step 4: Add the filtered list + unacked query**

In `lib/inquiry-storage-db.ts`, replace the existing `listInquiries` (lines 144-148):

```ts
export function listInquiries(): Inquiry[] {
  runMigrations();
  const rows = getDb().prepare("SELECT * FROM inquiries ORDER BY created_at DESC").all() as Row[];
  return rows.map(rowToInquiry);
}
```

with:

```ts
export function listInquiries(opts: { types?: InquiryType[] } = {}): Inquiry[] {
  runMigrations();
  const db = getDb();
  if (opts.types && opts.types.length > 0) {
    const placeholders = opts.types.map(() => "?").join(", ");
    const rows = db
      .prepare(`SELECT * FROM inquiries WHERE type IN (${placeholders}) ORDER BY created_at DESC`)
      .all(...opts.types) as Row[];
    return rows.map(rowToInquiry);
  }
  const rows = db.prepare("SELECT * FROM inquiries ORDER BY created_at DESC").all() as Row[];
  return rows.map(rowToInquiry);
}

export function listUnacknowledged(types: InquiryType[]): Inquiry[] {
  runMigrations();
  if (types.length === 0) return [];
  const placeholders = types.map(() => "?").join(", ");
  const rows = getDb()
    .prepare(
      `SELECT * FROM inquiries
         WHERE acknowledged_at IS NULL
           AND type IN (${placeholders})
           AND stage NOT IN ('perdido', 'completado')
         ORDER BY created_at DESC`,
    )
    .all(...types) as Row[];
  return rows.map(rowToInquiry);
}
```

`InquiryType` is already imported at the top of this file (line 4-9). No migration is needed — `db/migrations/014_inquiries.sql` declares `type TEXT NOT NULL` with no CHECK constraint, so `"contact"` is a valid value.

- [ ] **Step 5: Run test to verify it passes**

Run: `NODE_OPTIONS='--experimental-sqlite' npx vitest run tests/unit/inquiry-storage-db.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add lib/pipeline.ts lib/inquiry-storage-db.ts tests/unit/inquiry-storage-db.test.ts
git commit -m "feat(inquiries): contact type + filtered/unacknowledged queries"
```

---

### Task 2: Pipeline list route excludes contacts

**Files:**
- Modify: `app/api/admin/inquiries/route.ts:9`
- Test: `tests/unit/api-admin-inquiries-list.test.ts` (add one case)

- [ ] **Step 1: Write the failing test**

In `tests/unit/api-admin-inquiries-list.test.ts`, add after the existing first test (the file already imports `createInquiry` and `{ GET, POST }`):

```ts
it("GET excludes contact-type inquiries from the pipeline", async () => {
  createInquiry({ id: "iqc", type: "contact", contactName: "Zoe", contactEmail: "z@x.com", contactPhone: "", sourceChannel: "web" });
  createInquiry({ id: "iqw", type: "wedding", contactName: "Ana", contactEmail: "a@x.com", contactPhone: "1", budgetBand: "10-25k", sourceChannel: "web" });
  const res = await GET(new Request("http://x/api/admin/inquiries"));
  const body = await res.json();
  expect(body.inquiries.map((i: { id: string }) => i.id)).toEqual(["iqw"]);
  expect(body.stats.counts.nuevo).toBe(1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_OPTIONS='--experimental-sqlite' npx vitest run tests/unit/api-admin-inquiries-list.test.ts`
Expected: FAIL — the contact row is returned (`["iqc","iqw"]`) and `counts.nuevo` is 2.

- [ ] **Step 3: Filter the pipeline list**

In `app/api/admin/inquiries/route.ts`, line 9, replace:

```ts
  const inquiries = listInquiries();
```

with:

```ts
  const inquiries = listInquiries({ types: ["wedding", "event"] });
```

- [ ] **Step 4: Run test to verify it passes**

Run: `NODE_OPTIONS='--experimental-sqlite' npx vitest run tests/unit/api-admin-inquiries-list.test.ts`
Expected: PASS (all cases, including the two pre-existing ones).

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/inquiries/route.ts tests/unit/api-admin-inquiries-list.test.ts
git commit -m "feat(pipeline): keep contact inquiries out of the sales kanban"
```

---

### Task 3: Contact form also creates a pipeline DB row

**Files:**
- Modify: `app/api/contact/route.ts`
- Test: `tests/unit/api-contact.test.ts` (new)

- [ ] **Step 1: Write the failing test**

Create `tests/unit/api-contact.test.ts`:

```ts
import { it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { listUnacknowledged } from "@/lib/inquiry-storage-db";

// Isolate the JSON mirror so the test never writes pending-inquiries.json.
vi.mock("@/lib/inquiry-storage", () => ({ saveInquiry: vi.fn().mockResolvedValue(undefined) }));

import { POST } from "@/app/api/contact/route";

beforeEach(() => { vi.stubEnv("SQLITE_FILE", ":memory:"); runMigrations(); });
afterEach(() => { closeDb(); vi.unstubAllEnvs(); vi.clearAllMocks(); });

it("saves a contact submission as an unacknowledged contact inquiry", async () => {
  const res = await POST(new Request("http://x/api/contact", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: "Luis", email: "luis@x.com", subject: "Hola",
      body: "Quiero un ramo grande por favor", locale: "es", honeypot: "",
    }),
  }));
  expect(res.status).toBe(200);
  const contacts = listUnacknowledged(["contact"]);
  expect(contacts).toHaveLength(1);
  expect(contacts[0].contactName).toBe("Luis");
  expect(contacts[0].acknowledgedAt).toBeUndefined();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_OPTIONS='--experimental-sqlite' npx vitest run tests/unit/api-contact.test.ts`
Expected: FAIL — `listUnacknowledged(["contact"])` is empty (route does not touch the DB yet).

- [ ] **Step 3: Persist the contact inquiry (best-effort)**

In `app/api/contact/route.ts`, add a `nodejs` runtime marker after the imports (below line 5), then insert the DB write before the final `return`. Replace the tail of the handler (lines 18-28):

```ts
  const id = `ct_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  await saveInquiry({
    id,
    type: "contact",
    payload: parsed.data,
    createdAt: new Date().toISOString(),
    ip,
    locale: parsed.data.locale,
  });
  console.log(`[contact] from ${parsed.data.email}`);
  return NextResponse.json({ ok: true, id }, { status: 200 });
```

with:

```ts
  const id = `ct_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  await saveInquiry({
    id,
    type: "contact",
    payload: parsed.data,
    createdAt: new Date().toISOString(),
    ip,
    locale: parsed.data.locale,
  });
  // Also enter the pipeline DB so it can be tracked/acknowledged in the radar.
  // Best-effort: the public form must never fail because of the pipeline DB.
  try {
    const { createInquiry } = await import("@/lib/inquiry-storage-db");
    createInquiry({
      id,
      type: "contact",
      contactName: parsed.data.name,
      contactEmail: parsed.data.email,
      contactPhone: "", // the contact form has no phone field
      notes: `${parsed.data.subject}\n\n${parsed.data.body}`,
      sourceChannel: "web",
      locale: parsed.data.locale,
      createdAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error(JSON.stringify({ event: "contact_sqlite_failed", id, error: String(e) }));
  }
  console.log(`[contact] from ${parsed.data.email}`);
  return NextResponse.json({ ok: true, id }, { status: 200 });
```

Then add, directly after the import block (after line 5):

```ts
export const runtime = "nodejs";
```

`contact_phone` is `NOT NULL` in the schema, so the empty string is required (not `null`). The `notes` column exists; `subject` has no column, so it is prepended into `notes`.

- [ ] **Step 4: Run test to verify it passes**

Run: `NODE_OPTIONS='--experimental-sqlite' npx vitest run tests/unit/api-contact.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/contact/route.ts tests/unit/api-contact.test.ts
git commit -m "feat(contact): mirror contact submissions into the pipeline DB"
```

---

### Task 4: Attention aggregator

**Files:**
- Create: `lib/attention.ts`
- Test: `tests/unit/attention.test.ts` (new)

- [ ] **Step 1: Write the failing test**

Create `tests/unit/attention.test.ts`:

```ts
import { it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { createInquiry, acknowledge } from "@/lib/inquiry-storage-db";
import { getAttention } from "@/lib/attention";

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  runMigrations();
  vi.useFakeTimers().setSystemTime(new Date("2026-05-25T14:00:00Z"));
});
afterEach(() => { vi.useRealTimers(); closeDb(); vi.unstubAllEnvs(); });

function seedWebOrder(id: string) {
  getDb().prepare(
    `INSERT INTO orders (id, locale, source, recipient_name, recipient_phone, contact_phone,
       fulfillment_method, window_date, lines_json, subtotal_cents, delivery_cents, tax_cents,
       total_cents, fulfillment_status, payment_status, created_at, updated_at)
     VALUES (?, 'es', 'web', 'Maria', '555', '555', 'delivery', '2026-05-26', '[]',
       0,0,0,0, 'pending', 'paid', '2026-05-25T13:00:00Z', '2026-05-25T13:00:00Z')`,
  ).run(id);
}

it("aggregates pending orders + unacked leads + unacked contacts with counts", async () => {
  seedWebOrder("o1"); // qualifies as web_unacknowledged
  createInquiry({ id: "w1", type: "wedding", contactName: "Ana", contactEmail: "a@x.com", contactPhone: "1", sourceChannel: "web" });
  createInquiry({ id: "c1", type: "contact", contactName: "Luis", contactEmail: "l@x.com", contactPhone: "", sourceChannel: "web" });
  createInquiry({ id: "w2", type: "wedding", contactName: "Bea", contactEmail: "b@x.com", contactPhone: "1", sourceChannel: "web" });
  acknowledge("w2"); // excluded

  const snap = await getAttention();
  expect(snap.counts).toEqual({ orders: 1, inquiries: 1, contacts: 1, total: 3 });
  expect(snap.items.find((i) => i.id === "o1")?.kind).toBe("order");
  expect(snap.items.find((i) => i.id === "c1")?.label).toBe("Contacto · Luis");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_OPTIONS='--experimental-sqlite' npx vitest run tests/unit/attention.test.ts`
Expected: FAIL — `@/lib/attention` does not exist.

- [ ] **Step 3: Write the aggregator**

Create `lib/attention.ts`:

```ts
import "server-only";
import { getPendingQueue } from "@/lib/order-queue";
import { listUnacknowledged, type Inquiry } from "@/lib/inquiry-storage-db";
import type { Order } from "@/types/order";

export type AttentionKind = "order" | "inquiry" | "contact";

export type AttentionItem = {
  kind: AttentionKind;
  id: string;
  createdAt: string;
  label: string;
  reason?: string; // order PendingReason, when kind === "order"
};

export type AttentionSnapshot = {
  items: AttentionItem[]; // newest first
  counts: { orders: number; inquiries: number; contacts: number; total: number };
  generatedAt: string;
};

const SOURCE_LABEL_ES: Record<string, string> = {
  web: "Orden web",
  phone: "Orden teléfono",
  whatsapp: "Orden WhatsApp",
  "walk-in": "Orden en tienda",
  event: "Orden evento",
};

function orderLabel(o: Order): string {
  const src = SOURCE_LABEL_ES[o.source] ?? "Orden";
  return `${src} · ${o.fulfillment.recipient.name}`;
}

function inquiryLabel(i: Inquiry): string {
  const prefix = i.type === "wedding" ? "Boda" : i.type === "event" ? "Evento" : "Contacto";
  return `${prefix} · ${i.contactName}`;
}

export async function getAttention(): Promise<AttentionSnapshot> {
  const queue = await getPendingQueue();
  const inquiries = listUnacknowledged(["wedding", "event"]);
  const contacts = listUnacknowledged(["contact"]);

  const orderItems: AttentionItem[] = queue.map((q) => ({
    kind: "order",
    id: q.orderId,
    createdAt: q.order.createdAt,
    label: orderLabel(q.order),
    reason: q.reason,
  }));
  const inquiryItems: AttentionItem[] = inquiries.map((i) => ({
    kind: "inquiry",
    id: i.id,
    createdAt: i.createdAt,
    label: inquiryLabel(i),
  }));
  const contactItems: AttentionItem[] = contacts.map((c) => ({
    kind: "contact",
    id: c.id,
    createdAt: c.createdAt,
    label: inquiryLabel(c),
  }));

  const items = [...orderItems, ...inquiryItems, ...contactItems].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );

  return {
    items,
    counts: {
      orders: orderItems.length,
      inquiries: inquiryItems.length,
      contacts: contactItems.length,
      total: items.length,
    },
    generatedAt: new Date().toISOString(),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `NODE_OPTIONS='--experimental-sqlite' npx vitest run tests/unit/attention.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/attention.ts tests/unit/attention.test.ts
git commit -m "feat(attention): unified unattended-requests aggregator"
```

---

### Task 5: `/api/admin/attention` endpoint

**Files:**
- Create: `app/api/admin/attention/route.ts`
- Test: `tests/unit/api-admin-attention.test.ts` (new)

- [ ] **Step 1: Write the failing test**

Create `tests/unit/api-admin-attention.test.ts`:

```ts
import { it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { createInquiry } from "@/lib/inquiry-storage-db";
import { GET } from "@/app/api/admin/attention/route";

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  runMigrations();
  vi.useFakeTimers().setSystemTime(new Date("2026-05-25T14:00:00Z"));
});
afterEach(() => { vi.useRealTimers(); closeDb(); vi.unstubAllEnvs(); });

it("returns the attention snapshot shape", async () => {
  createInquiry({ id: "c1", type: "contact", contactName: "Luis", contactEmail: "l@x.com", contactPhone: "", sourceChannel: "web" });
  const res = await GET();
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.generatedAt).toBeTruthy();
  expect(body.counts.contacts).toBe(1);
  expect(body.counts.total).toBe(1);
  expect(body.items[0].kind).toBe("contact");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_OPTIONS='--experimental-sqlite' npx vitest run tests/unit/api-admin-attention.test.ts`
Expected: FAIL — route module does not exist.

- [ ] **Step 3: Write the route**

Create `app/api/admin/attention/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getAttention } from "@/lib/attention";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// NOTE: intentionally unguarded to mirror its sibling dashboard endpoints
// (/api/admin/orders/queue, /api/admin/orders/feed). See the plan's
// "Known constraint" note — do not add requireAdmin here in isolation.
export async function GET(): Promise<Response> {
  const snapshot = await getAttention();
  return NextResponse.json(snapshot, { headers: { "Cache-Control": "no-store" } });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `NODE_OPTIONS='--experimental-sqlite' npx vitest run tests/unit/api-admin-attention.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/attention/route.ts tests/unit/api-admin-attention.test.ts
git commit -m "feat(attention): GET /api/admin/attention endpoint"
```

---

### Task 6: Embed the snapshot in the TV board response

**Files:**
- Modify: `lib/tv-board.ts:129-146`
- Test: `tests/unit/tv-board-attention.test.ts` (new)

- [ ] **Step 1: Write the failing test**

Create `tests/unit/tv-board-attention.test.ts`:

```ts
import { it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { createInquiry } from "@/lib/inquiry-storage-db";
import { buildTvBoard } from "@/lib/tv-board";

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  runMigrations();
  vi.useFakeTimers().setSystemTime(new Date("2026-05-25T14:00:00Z"));
});
afterEach(() => { vi.useRealTimers(); closeDb(); vi.unstubAllEnvs(); });

it("embeds the attention snapshot in the board response", async () => {
  createInquiry({ id: "c1", type: "contact", contactName: "Luis", contactEmail: "l@x.com", contactPhone: "", sourceChannel: "web" });
  const board = await buildTvBoard(new Date("2026-05-25T14:00:00Z"));
  expect(board.attention.counts.contacts).toBe(1);
  expect(board.attention.counts.total).toBe(1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_OPTIONS='--experimental-sqlite' npx vitest run tests/unit/tv-board-attention.test.ts`
Expected: FAIL — `board.attention` is `undefined`.

- [ ] **Step 3: Embed attention**

In `lib/tv-board.ts`, add the import near the top (after line 9):

```ts
import { getAttention, type AttentionSnapshot } from "@/lib/attention";
```

Replace the `TvBoardResponse` type + `buildTvBoard` (lines 129-146):

```ts
export type TvBoardResponse = TvBoardData & {
  generatedAt: string;
  shopDate: string;
  paidEvents: { orderId: string; at: string; recipientName: string }[];
};

export async function buildTvBoard(now: Date = new Date()): Promise<TvBoardResponse> {
  const tz = SHOP_TZ;
  const today = shopDateStr(now, tz);
  const tomorrow = addDaysStr(today, 1);
  const orders = await listOrdersForWindowDates([today, tomorrow]);
  const data = computeBoard(orders, { now, tz });
  const { events } = await getRecentFeed(1); // last hour of feed events
  const paidEvents = events
    .filter((e) => e.kind === "paid")
    .map((e) => ({ orderId: e.orderId, at: e.at, recipientName: e.recipientName }));
  return { ...data, generatedAt: now.toISOString(), shopDate: today, paidEvents };
}
```

with:

```ts
export type TvBoardResponse = TvBoardData & {
  generatedAt: string;
  shopDate: string;
  paidEvents: { orderId: string; at: string; recipientName: string }[];
  attention: AttentionSnapshot;
};

export async function buildTvBoard(now: Date = new Date()): Promise<TvBoardResponse> {
  const tz = SHOP_TZ;
  const today = shopDateStr(now, tz);
  const tomorrow = addDaysStr(today, 1);
  const orders = await listOrdersForWindowDates([today, tomorrow]);
  const data = computeBoard(orders, { now, tz });
  const { events } = await getRecentFeed(1); // last hour of feed events
  const paidEvents = events
    .filter((e) => e.kind === "paid")
    .map((e) => ({ orderId: e.orderId, at: e.at, recipientName: e.recipientName }));
  const attention = await getAttention();
  return { ...data, generatedAt: now.toISOString(), shopDate: today, paidEvents, attention };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `NODE_OPTIONS='--experimental-sqlite' npx vitest run tests/unit/tv-board-attention.test.ts tests/unit/tv-board-build.test.ts tests/unit/tv-board-route.test.ts`
Expected: PASS (and the two pre-existing tv-board tests still pass — `attention` is additive).

- [ ] **Step 5: Commit**

```bash
git add lib/tv-board.ts tests/unit/tv-board-attention.test.ts
git commit -m "feat(tv): embed attention snapshot in the board response"
```

---

### Task 7: Pure `newIds` helper for the TV

**Files:**
- Modify: `components/admin/tv/tv-detect.ts`
- Test: `tests/unit/tv-detect.test.ts` (add one case)

- [ ] **Step 1: Write the failing test**

In `tests/unit/tv-detect.test.ts`, change the import line (line 2) to add `newIds`:

```ts
import { newPaidIds, paginate, newIds } from "@/components/admin/tv/tv-detect";
```

and add inside the `describe("tv-detect", ...)` block:

```ts
  it("newIds returns ids not already seen", () => {
    expect(newIds(["a", "b", "c"], new Set(["a"]))).toEqual(["b", "c"]);
    expect(newIds(["a"], new Set(["a"]))).toEqual([]);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_OPTIONS='--experimental-sqlite' npx vitest run tests/unit/tv-detect.test.ts`
Expected: FAIL — `newIds` is not exported.

- [ ] **Step 3: Add the helper**

In `components/admin/tv/tv-detect.ts`, add after the `newPaidIds` function (after line 8):

```ts
/** Ids not present in `seen`. Pure. */
export function newIds(ids: string[], seen: Set<string>): string[] {
  const out: string[] = [];
  for (const id of ids) if (!seen.has(id)) out.push(id);
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `NODE_OPTIONS='--experimental-sqlite' npx vitest run tests/unit/tv-detect.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/admin/tv/tv-detect.ts tests/unit/tv-detect.test.ts
git commit -m "feat(tv): pure newIds helper for attention detection"
```

---

### Task 8: `useTvPolling` detects new attention items

**Files:**
- Modify: `components/admin/tv/useTvPolling.ts`

This wires the polling hook to a second callback. It is covered by browser verification (Task 14) plus the pure `newIds` test (Task 7); no separate hook unit test.

- [ ] **Step 1: Replace the hook body**

Replace the entire contents of `components/admin/tv/useTvPolling.ts` with:

```ts
"use client";
import { useEffect, useRef, useState } from "react";
import type { TvBoardResponse } from "@/lib/tv-board";
import type { AttentionItem } from "@/lib/attention";
import { newPaidIds, newIds } from "./tv-detect";

export function useTvPolling(
  intervalMs: number,
  onNewPaid?: (ids: string[]) => void,
  onNewAttention?: (items: AttentionItem[]) => void,
) {
  const [data, setData] = useState<TvBoardResponse | null>(null);
  const [error, setError] = useState(false);
  const seenRef = useRef<Set<string>>(new Set());
  const primedRef = useRef(false);
  const seenAttnRef = useRef<Set<string>>(new Set());
  const primedAttnRef = useRef(false);
  const onNewPaidRef = useRef(onNewPaid);
  onNewPaidRef.current = onNewPaid;
  const onNewAttentionRef = useRef(onNewAttention);
  onNewAttentionRef.current = onNewAttention;

  useEffect(() => {
    let cancelled = false;
    async function tick() {
      try {
        const res = await fetch("/api/admin/tv/board", { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const board = (await res.json()) as TvBoardResponse;
        if (cancelled) return;

        const events = board.paidEvents ?? [];
        const fresh = primedRef.current ? newPaidIds(events, seenRef.current) : [];
        for (const e of events) seenRef.current.add(e.orderId);
        primedRef.current = true;

        const attnItems = board.attention?.items ?? [];
        const freshAttnIds = primedAttnRef.current
          ? newIds(attnItems.map((i) => i.id), seenAttnRef.current)
          : [];
        for (const i of attnItems) seenAttnRef.current.add(i.id);
        primedAttnRef.current = true;

        setData(board);
        setError(false);
        if (fresh.length && onNewPaidRef.current) onNewPaidRef.current(fresh);
        if (freshAttnIds.length && onNewAttentionRef.current) {
          const freshSet = new Set(freshAttnIds);
          onNewAttentionRef.current(attnItems.filter((i) => freshSet.has(i.id)));
        }
      } catch {
        if (!cancelled) setError(true); // keep last-good data on screen
      }
    }
    void tick();
    const timer = setInterval(() => void tick(), intervalMs); // never pauses on hidden tab
    return () => { cancelled = true; clearInterval(timer); };
  }, [intervalMs]);

  return { data, error };
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors from this file. (Callers updated in Task 9.)

- [ ] **Step 3: Commit**

```bash
git add components/admin/tv/useTvPolling.ts
git commit -m "feat(tv): useTvPolling detects new attention items"
```

---

### Task 9: TV board — "Sin atender" counter, chime, and toast

**Files:**
- Modify: `components/admin/tv/TvBoard.tsx`

Browser-verified (Task 14).

- [ ] **Step 1: Add toast state + wire the second callback**

In `components/admin/tv/TvBoard.tsx`, replace the `useTvPolling` call and the lines just above it (lines 36-52) — currently:

```tsx
  const { enabled, enable, chime } = useTvSound();
  const [flash, setFlash] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const pageJumpRef = useRef<string | null>(null);

  const { data, error } = useTvPolling(POLL_INTERVAL_MS, (ids) => {
    if (enabled) chime();
    setFlash((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
    ids.forEach((id) => setTimeout(() => {
      setFlash((prev) => { const n = new Set(prev); n.delete(id); return n; });
    }, NEW_FLASH_MS));
    pageJumpRef.current = ids[0] ?? null;
  });
```

with:

```tsx
  const { enabled, enable, chime } = useTvSound();
  const [flash, setFlash] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const pageJumpRef = useRef<string | null>(null);

  const { data, error } = useTvPolling(
    POLL_INTERVAL_MS,
    (ids) => {
      if (enabled) chime();
      setFlash((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.add(id));
        return next;
      });
      ids.forEach((id) => setTimeout(() => {
        setFlash((prev) => { const n = new Set(prev); n.delete(id); return n; });
      }, NEW_FLASH_MS));
      pageJumpRef.current = ids[0] ?? null;
    },
    (items) => {
      if (enabled) chime();
      setToast(`Nueva solicitud · ${items[0]?.label ?? ""}`);
      window.setTimeout(() => setToast(null), 6000);
    },
  );
```

- [ ] **Step 2: Add the "Sin atender" header counter**

In the header (currently lines 87-96), add one `<Counter />` after the "Entregadas" counter. Replace:

```tsx
          <Counter n={todo.length} label="Por hacer" color="var(--color-rouge)" />
          <Counter n={data?.enRuta.length ?? 0} label="En ruta" color="var(--color-rouge-glow)" />
          <Counter n={data?.deliveredToday ?? 0} label="Entregadas" color="var(--color-success)" />
```

with:

```tsx
          <Counter n={todo.length} label="Por hacer" color="var(--color-rouge)" />
          <Counter n={data?.enRuta.length ?? 0} label="En ruta" color="var(--color-rouge-glow)" />
          <Counter n={data?.deliveredToday ?? 0} label="Entregadas" color="var(--color-success)" />
          <Counter n={data?.attention.counts.total ?? 0} label="Sin atender" color="var(--color-warn)" />
```

- [ ] **Step 3: Render the toast**

Add, immediately before the "Sound gate" block (before line 153 `{!enabled && (`):

```tsx
      {/* New-request toast */}
      {toast && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-40 rounded-full bg-ink px-6 py-3 text-lg font-semibold text-bone shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)]">
          🔔 {toast}
        </div>
      )}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add components/admin/tv/TvBoard.tsx
git commit -m "feat(tv): sin-atender counter, chime, and toast for new requests"
```

---

### Task 10: `useDashboardPolling` fetches attention + union detection

**Files:**
- Modify: `components/admin/dashboard/useDashboardPolling.ts`

- [ ] **Step 1: Replace the hook**

Replace the entire contents of `components/admin/dashboard/useDashboardPolling.ts` with:

```ts
"use client";
import { useEffect, useRef, useState } from "react";
import type { AttentionSnapshot } from "@/lib/attention";

type PendingItem = { orderId: string; reason: string; order: unknown };
type QueueResp = { items: PendingItem[]; generatedAt: string };
type FeedEvent = { kind: string; orderId: string; at: string; label: string; source: string; totalCents: number; recipientName: string };
type FeedResp = { events: FeedEvent[] };

export type DashboardPollingOptions = {
  intervalMs?: number;
  onNewItem?: (newIds: string[]) => void;
};

export type DashboardPollingState = {
  queue: PendingItem[];
  feed: FeedEvent[];
  attention: AttentionSnapshot | null;
  lastUpdated: string | null;
  error: boolean;
  refresh: () => Promise<void>;
};

export function useDashboardPolling(opts: DashboardPollingOptions = {}): DashboardPollingState {
  const intervalMs = opts.intervalMs ?? 20_000;
  const [queue, setQueue] = useState<PendingItem[]>([]);
  const [feed, setFeed] = useState<FeedEvent[]>([]);
  const [attention, setAttention] = useState<AttentionSnapshot | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const primedRef = useRef(false);
  const onNewItemRef = useRef(opts.onNewItem);
  onNewItemRef.current = opts.onNewItem;

  async function tick() {
    try {
      const [qRes, fRes, aRes] = await Promise.all([
        fetch("/api/admin/orders/queue", { cache: "no-store" }),
        fetch("/api/admin/orders/feed", { cache: "no-store" }),
        fetch("/api/admin/attention", { cache: "no-store" }),
      ]);
      if (!qRes.ok || !fRes.ok || !aRes.ok) {
        throw new Error(`poll failed: queue ${qRes.status}, feed ${fRes.status}, attention ${aRes.status}`);
      }
      const q = (await qRes.json()) as QueueResp;
      const f = (await fRes.json()) as FeedResp;
      const a = (await aRes.json()) as AttentionSnapshot;
      const previous = seenIdsRef.current;
      const currentIds = new Set(a.items.map((i) => i.id));
      const newIds: string[] = [];
      if (primedRef.current) {
        for (const id of currentIds) if (!previous.has(id)) newIds.push(id);
      }
      primedRef.current = true;
      seenIdsRef.current = currentIds;
      setQueue(q.items);
      setFeed(f.events);
      setAttention(a);
      setLastUpdated(new Date().toISOString());
      setError(false);
      if (newIds.length > 0 && onNewItemRef.current) onNewItemRef.current(newIds);
    } catch {
      setError(true); // surface to UI; keeps last good data on screen
    }
  }

  useEffect(() => {
    void tick();
    let timer: ReturnType<typeof setInterval> | null = null;
    function start() {
      if (timer) return;
      timer = setInterval(() => { void tick(); }, intervalMs);
    }
    function stop() {
      if (timer) { clearInterval(timer); timer = null; }
    }
    function onVisibility() {
      if (document.visibilityState === "visible") { void tick(); start(); }
      else stop();
    }
    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => { stop(); document.removeEventListener("visibilitychange", onVisibility); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs]);

  return { queue, feed, attention, lastUpdated, error, refresh: tick };
}
```

- [ ] **Step 2: Typecheck (will surface the BandejaView break)**

Run: `npx tsc --noEmit`
Expected: an error in `BandejaView.tsx` about `onNewOrder` — fixed in Task 12. (Proceed; do not commit a broken typecheck alone — commit Tasks 10+12 conceptually together, but keep them as separate commits since 11 sits between. To keep each commit green, commit this hook in the same step as Task 12. Skip the commit here.)

> **Note:** Because Task 12 depends on this hook's new shape, do the commit for this file at the end of Task 12.

---

### Task 11: `AttentionDrawer` — read-only lead/contact view that acks on open

**Files:**
- Create: `components/admin/dashboard/AttentionDrawer.tsx`
- Test: `tests/unit/AttentionDrawer.test.tsx` (new)

- [ ] **Step 1: Write the failing test**

Create `tests/unit/AttentionDrawer.test.tsx`:

```tsx
import { it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import AttentionDrawer from "@/components/admin/dashboard/AttentionDrawer";

const detail = {
  inquiry: {
    id: "c1", type: "contact", stage: "nuevo", contactName: "Luis",
    contactEmail: "l@x.com", contactPhone: "", notes: "Quiero un ramo",
    sourceChannel: "web", createdAt: "2026-05-25T13:00:00Z", updatedAt: "2026-05-25T13:00:00Z",
  },
  changes: [],
};

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn((url: string) =>
    String(url).endsWith("/ack")
      ? Promise.resolve(new Response(null, { status: 200 }))
      : Promise.resolve(new Response(JSON.stringify(detail), { status: 200 })),
  ));
});
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

it("acks on open and renders the contact", async () => {
  render(<AttentionDrawer id="c1" onClose={() => {}} />);
  await waitFor(() => expect(screen.getByText("Luis")).toBeDefined());
  const calls = (fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls.map((c) => String(c[0]));
  expect(calls.some((u) => u.endsWith("/api/admin/inquiries/c1/ack"))).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_OPTIONS='--experimental-sqlite' npx vitest run tests/unit/AttentionDrawer.test.tsx`
Expected: FAIL — component does not exist.

- [ ] **Step 3: Write the component**

Create `components/admin/dashboard/AttentionDrawer.tsx`:

```tsx
"use client";
import { useEffect, useState } from "react";
import type { InquiryDetail } from "@/lib/inquiry-storage-db";

const TYPE_LABEL: Record<string, string> = { contact: "Contacto", wedding: "Boda", event: "Evento" };

export default function AttentionDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const [detail, setDetail] = useState<InquiryDetail | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await fetch(`/api/admin/inquiries/${id}/ack`, { method: "POST" });
      const res = await fetch(`/api/admin/inquiries/${id}`, { cache: "no-store" });
      if (!cancelled && res.ok) setDetail((await res.json()) as InquiryDetail);
    })();
    return () => { cancelled = true; };
  }, [id]);

  const i = detail?.inquiry;
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/40" onClick={onClose}>
      <div
        className="h-full w-full max-w-md overflow-y-auto bg-bone p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="mb-4 text-sm text-ink/60">✕ Cerrar</button>
        {!i ? (
          <p className="text-ink/60">Cargando…</p>
        ) : (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">{i.contactName}</h2>
            <p className="text-sm text-ink/70">{TYPE_LABEL[i.type] ?? i.type}</p>
            {i.contactPhone && <a href={`tel:${i.contactPhone}`} className="block text-sm text-rouge">{i.contactPhone}</a>}
            <a href={`mailto:${i.contactEmail}`} className="block text-sm text-rouge">{i.contactEmail}</a>
            {i.notes && (
              <p className="whitespace-pre-wrap rounded border border-ink/10 bg-white p-3 text-sm">{i.notes}</p>
            )}
            <p className="text-xs text-ink/50">{new Date(i.createdAt).toLocaleString("es-US")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `NODE_OPTIONS='--experimental-sqlite' npx vitest run tests/unit/AttentionDrawer.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/admin/dashboard/AttentionDrawer.tsx tests/unit/AttentionDrawer.test.tsx
git commit -m "feat(dashboard): AttentionDrawer read-only view that acks on open"
```

---

### Task 12: BandejaView — notifications section, chime for all types, mute toggle

**Files:**
- Modify: `components/admin/dashboard/BandejaView.tsx`
- Modify: `messages/en.json`, `messages/es.json` (add `admin_dashboard` keys)
- (Also commit `useDashboardPolling.ts` from Task 10 here)

- [ ] **Step 1: Add i18n keys**

In `messages/en.json`, inside the `"admin_dashboard"` object, add these keys (next to `"pending"`):

```json
    "new_requests": "New requests",
    "no_new_requests": "No new requests",
    "mute": "Mute",
    "unmute": "Unmute",
```

In `messages/es.json`, inside the `"admin_dashboard"` object, add:

```json
    "new_requests": "Nuevas solicitudes",
    "no_new_requests": "Sin solicitudes nuevas",
    "mute": "Silenciar",
    "unmute": "Activar sonido",
```

- [ ] **Step 2: Rework BandejaView**

In `components/admin/dashboard/BandejaView.tsx`:

**(a)** Update the imports (lines 1-10). Replace line 2 and add the drawer import:

```tsx
import { useCallback, useEffect, useRef, useState } from "react";
```

and add after line 8 (`import AdminButton ...`):

```tsx
import AttentionDrawer from "./AttentionDrawer";
```

**(b)** Delete the `isIpadLike` helper (lines 12-16) entirely — it is no longer used.

**(c)** Replace the chime/flash/callback block + the polling call (lines 25-53) — currently:

```tsx
  const t = useTranslations("admin_dashboard");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUnlockedRef = useRef(false);
  const [drawerOrderId, setDrawerOrderId] = useState<string | null>(null);

  function playChime() {
    if (!isIpadLike()) return; // sound only on iPad
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = 0;
    a.play().catch(() => {});
  }

  function flashTitle(count: number) {
    const original = document.title;
    let on = true;
    let ticks = 0;
    const interval = setInterval(() => {
      document.title = on ? `(${count}) Diva · Bandeja` : original;
      on = !on;
      if (++ticks >= 10) { clearInterval(interval); document.title = original; }
    }, 500);
  }

  const onNewOrder = useCallback((ids: string[]) => {
    playChime();
    flashTitle(ids.length);
  }, []);

  const { queue, feed, lastUpdated, error, refresh } = useDashboardPolling({ onNewOrder });
```

with:

```tsx
  const t = useTranslations("admin_dashboard");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUnlockedRef = useRef(false);
  const [drawerOrderId, setDrawerOrderId] = useState<string | null>(null);
  const [attnId, setAttnId] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(false);
  mutedRef.current = muted;

  useEffect(() => { setMuted(localStorage.getItem("diva_dashboard_muted") === "1"); }, []);

  function toggleMute() {
    setMuted((m) => {
      const next = !m;
      localStorage.setItem("diva_dashboard_muted", next ? "1" : "0");
      return next;
    });
  }

  function playChime() {
    if (mutedRef.current) return;
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = 0;
    a.play().catch(() => {});
  }

  function flashTitle(count: number) {
    const original = document.title;
    let on = true;
    let ticks = 0;
    const interval = setInterval(() => {
      document.title = on ? `(${count}) Diva · Bandeja` : original;
      on = !on;
      if (++ticks >= 10) { clearInterval(interval); document.title = original; }
    }, 500);
  }

  const onNewItem = useCallback((ids: string[]) => {
    playChime();
    flashTitle(ids.length);
  }, []);

  const { queue, feed, attention, lastUpdated, error, refresh } = useDashboardPolling({ onNewItem });
  const newRequests = (attention?.items ?? []).filter((item) => item.kind !== "order");
```

**(d)** Add the "Nuevas solicitudes" section. Immediately after the opening `<DashboardShell ...>` error block and before the existing `<section className="mb-6">` (i.e., before line 117), insert:

```tsx
        <section className="mb-6">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-ink/60">
            {t("new_requests")} · {newRequests.length}
            <button
              type="button"
              onClick={toggleMute}
              title={muted ? t("unmute") : t("mute")}
              className="ml-auto text-base"
            >
              {muted ? "🔇" : "🔔"}
            </button>
          </h2>
          {newRequests.length === 0 ? (
            <p className="rounded-lg border border-ink/10 bg-bone p-4 text-sm text-ink/60">
              {t("no_new_requests")}
            </p>
          ) : (
            <ul className="space-y-2">
              {newRequests.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setAttnId(item.id)}
                    className="w-full rounded-lg border border-ink/10 bg-white p-3 text-left text-sm hover:bg-ink/5"
                  >
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
```

**(e)** Render the drawer. After the existing `{drawerOrderId && ( ... )}` block (after line 165), add:

```tsx
        {attnId && (
          <AttentionDrawer id={attnId} onClose={() => { setAttnId(null); void refresh(); }} />
        )}
```

- [ ] **Step 3: Typecheck + run dashboard-adjacent tests**

Run: `npx tsc --noEmit`
Expected: no errors (the Task 10 hook change is now consumed correctly).

Run: `NODE_OPTIONS='--experimental-sqlite' npx vitest run tests/unit/AttentionDrawer.test.tsx`
Expected: PASS (sanity — unchanged).

- [ ] **Step 4: Commit (includes the Task 10 hook)**

```bash
git add components/admin/dashboard/useDashboardPolling.ts components/admin/dashboard/BandejaView.tsx messages/en.json messages/es.json
git commit -m "feat(dashboard): new-requests notifications, all-type chime, mute toggle"
```

---

### Task 13: Pipeline board auto-refresh

**Files:**
- Modify: `components/admin/pipeline/PipelineBoard.tsx`
- Test: `tests/unit/PipelineBoard.test.tsx` (add one case)

- [ ] **Step 1: Write the failing test**

In `tests/unit/PipelineBoard.test.tsx`, replace the import line (line 1):

```tsx
import { describe, it, expect } from "vitest";
```

with:

```tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { act } from "@testing-library/react";
```

and add inside the `describe("PipelineBoard", ...)` block, after the existing test:

```tsx
  afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

  it("auto-refreshes inquiries after the polling interval", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(initial), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    wrap(<PipelineBoard locale="es" initial={initial} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(20_000); });
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/inquiries", { cache: "no-store" });
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_OPTIONS='--experimental-sqlite' npx vitest run tests/unit/PipelineBoard.test.tsx`
Expected: FAIL — no interval fetch fires (`fetchMock` not called).

- [ ] **Step 3: Add the polling effect**

In `components/admin/pipeline/PipelineBoard.tsx`, replace the import (line 2):

```tsx
import { useState } from "react";
```

with:

```tsx
import { useEffect, useRef, useState } from "react";
```

Then add the polling effect just after the `refresh` function definition (after line 37, before `async function open`):

```tsx
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => { if (!timer) timer = setInterval(() => void refreshRef.current(), 20_000); };
    const stop = () => { if (timer) { clearInterval(timer); timer = null; } };
    const onVis = () => {
      if (document.visibilityState === "visible") { void refreshRef.current(); start(); }
      else stop();
    };
    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVis);
    return () => { stop(); document.removeEventListener("visibilitychange", onVis); };
  }, []);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `NODE_OPTIONS='--experimental-sqlite' npx vitest run tests/unit/PipelineBoard.test.tsx`
Expected: PASS (both cases).

- [ ] **Step 5: Commit**

```bash
git add components/admin/pipeline/PipelineBoard.tsx tests/unit/PipelineBoard.test.tsx
git commit -m "feat(pipeline): auto-refresh so new leads appear without a manual reload"
```

---

### Task 14: Full verification (tests, types, browser)

**Files:** none (verification only)

- [ ] **Step 1: Typecheck the whole project**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 2: Run the full test suite and compare to base**

Run: `npm test`
Expected: all NEW tests pass. A handful of PRE-EXISTING failures (~7: Chromium spawn `ENOEXEC` + some checkout/preview tests) also fail on base `main`. If a failure looks new, confirm against base before attributing it to this work:

```bash
git stash && npm test 2>&1 | tail -40 ; git stash pop
```

- [ ] **Step 3: Browser verification — dashboard**

Create/confirm `.claude/launch.json` has a dev server entry (e.g. `npm run dev`, port from the project), then start the preview and open the admin dashboard. Verify:
  - The **"Nuevas solicitudes"** section renders (empty state text when nothing is pending).
  - Submitting the public contact form (`/en/contact` or `/es/contact`) makes a new item appear within ~20s, and a chime plays after a first click on the page (audio unlock).
  - The 🔔/🔇 toggle persists across reload (localStorage `diva_dashboard_muted`).
  - Clicking an item opens `AttentionDrawer`; closing it removes the item from the list (it was acked).

- [ ] **Step 4: Browser verification — TV**

Open `/admin/tv`. Verify:
  - The header shows a **"Sin atender"** counter.
  - After the "Toca para activar el sonido" gate is tapped, a new request (place a test contact/lead) triggers a chime + the bottom **toast** naming it, and the counter increments.
  - Attending the item elsewhere (open it in the dashboard) drops the TV counter on the next poll (~15s).

- [ ] **Step 5: Final commit (if `.claude/launch.json` was added)**

```bash
git add .claude/launch.json
git commit -m "chore: dev server launch config for preview"
```

---

## Self-Review (completed during authoring)

- **Spec coverage:** radar aggregator (Task 4), TV counter+chime+toast (Tasks 6-9), dashboard notifications+chime+mute (Tasks 10-12), contact→DB kept out of kanban (Tasks 1-3), pipeline auto-refresh (Task 13), no-migration/no-new-table (Tasks 1,4), out-of-scope items untouched. ✅
- **Placeholder scan:** every code step contains full code; no TBD/"handle errors"/"similar to". ✅
- **Type consistency:** `AttentionItem`/`AttentionSnapshot` fields (`kind,id,createdAt,label,reason` / `counts.{orders,inquiries,contacts,total}`) identical across Tasks 4,6,8,9,10; `useTvPolling(intervalMs,onNewPaid,onNewAttention:(items)=>void)` matches its Task 9 caller; `useDashboardPolling` `onNewItem` + `attention` match the Task 12 caller; `AttentionDrawer({id,onClose})` matches its Task 12 usage; `listInquiries({types})`/`listUnacknowledged(types)` consistent across Tasks 1,2,4. ✅
- **Commit-green ordering:** Task 10's hook change is committed together with its Task 12 consumer so no commit leaves `tsc` red. ✅
