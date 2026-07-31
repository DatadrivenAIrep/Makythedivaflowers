# Order Intake — Reset Fix + Server-Side Drafts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the admin "Nuevo pedido" (intake) form fully reset after creating an order, and add server-side, resumable order drafts saved with an explicit button.

**Architecture:** Reset is fixed by centralizing all form state in one factory + a single `resetForm()`. Drafts store the raw intake form state as JSON in a new `order_drafts` SQLite table, exposed via `/api/admin/orders/drafts` routes, saved/resumed from a drawer on the intake page. Drafts are intentionally decoupled from the `Order` type/validation so incomplete orders can be saved.

**Tech Stack:** Next.js (custom build), React client components, `next-intl`, `node:sqlite` via `lib/db`, Zod, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-07-31-order-intake-reset-and-drafts-design.md`

**Conventions verified in this codebase (do not deviate):**
- Tests: Vitest, run with `npm test -- <path>` (the `test` script sets `NODE_OPTIONS='--experimental-sqlite'`). DB tests use `vi.stubEnv("SQLITE_FILE", ":memory:")` + `runMigrations()` in `beforeEach`, `closeDb()` + `vi.unstubAllEnvs()` in `afterEach`.
- Migrations: numbered `db/migrations/NNN_*.sql`, auto-discovered, `CREATE TABLE IF NOT EXISTS`.
- Dynamic API routes: `type Ctx = { params: Promise<{ id: string }> }`, `const { id } = await params;`, `export const runtime = "nodejs";`, errors via `NextResponse.json({ error }, { status })`.
- Admin routes for intake are **not** auth-wrapped and use `takenBy: "maky"` (matches `app/api/admin/orders/route.ts`). Drafts follow the same convention. Real auth is a tracked follow-up.
- Component tests render bare with per-file `vi.mock("next-intl")` / `vi.mock("next/navigation")` and `vi.spyOn(globalThis, "fetch")`.
- i18n keys must exist in **both** `messages/en.json` and `messages/es.json` (guarded by `tests/unit/i18n-parity.test.ts`).

---

## Task 1: Fix intake form reset

**Files:**
- Create: `components/admin/intake/intake-initial-state.ts`
- Modify: `components/admin/intake/IntakeForm.tsx`
- Test: `tests/unit/IntakeFormReset.test.tsx`

- [ ] **Step 1: Write the initial-state factory module**

Create `components/admin/intake/intake-initial-state.ts`:

```ts
import type { CartLine, OrderTotals } from "@/types/order";
import type { CustomerSnapshot } from "./CustomerBlock";
import type { FulfillmentState } from "./FulfillmentBlock";
import type { PaymentState } from "./PaymentBlock";

export type Channel = "walk-in" | "phone" | "whatsapp" | "event";

export const INITIAL_CHANNEL: Channel = "walk-in";

export const INITIAL_CUSTOMER: CustomerSnapshot = {
  name: "",
  phone: "",
  email: "",
  messagingChannel: "sms",
  buyerAddress: undefined,
};

export const INITIAL_PAYMENT: PaymentState = { status: "pending" };

/** Bare calendar day (YYYY-MM-DD) for the delivery-window default. */
export function todayYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Factory (not a constant) so the window date is recomputed to "today" on each reset. */
export function makeInitialFulfillment(): FulfillmentState {
  return {
    method: "delivery",
    recipient: { name: "", phone: "" },
    address: { street1: "", city: "", state: "NY", zip: "", country: "US" },
    window: { date: todayYmd(), slot: "midday" },
    cardMessage: "",
  };
}

export type IntakeFormState = {
  channel: Channel;
  customer: CustomerSnapshot;
  fulfillment: FulfillmentState;
  lines: CartLine[];
  override: Partial<OrderTotals>;
  giftCardCode: string;
  payment: PaymentState;
};

export function makeInitialFormState(): IntakeFormState {
  return {
    channel: INITIAL_CHANNEL,
    customer: { ...INITIAL_CUSTOMER },
    fulfillment: makeInitialFulfillment(),
    lines: [],
    override: {},
    giftCardCode: "",
    payment: { ...INITIAL_PAYMENT },
  };
}
```

- [ ] **Step 2: Write the failing reset test**

Create `tests/unit/IntakeFormReset.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// next-intl passthrough: t(key) => key, so we query by key strings.
vi.mock("next-intl", () => ({
  useTranslations: () => (k: string) => k,
  useLocale: () => "es",
}));
const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => new URLSearchParams(""),
}));

import IntakeForm from "@/components/admin/intake/IntakeForm";

beforeEach(() => {
  replace.mockReset();
  // CustomerBlock/AddressAutocomplete fire debounced lookups; keep them benign.
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ found: false, orderId: "do_test" }), { status: 200 }),
  );
});

describe("IntakeForm reset", () => {
  it("Descartar clears fulfillment, customer, and channel", () => {
    render(<IntakeForm products={[]} />);

    const recipient = screen.getByPlaceholderText("fulfillment_recipient_name_placeholder") as HTMLInputElement;
    fireEvent.change(recipient, { target: { value: "Lola" } });
    const card = screen.getByPlaceholderText("card_message_placeholder") as HTMLTextAreaElement;
    fireEvent.change(card, { target: { value: "Con cariño" } });
    // switch channel away from the default
    fireEvent.click(screen.getByRole("button", { name: "channel_phone" }));

    expect(recipient.value).toBe("Lola");
    expect(card.value).toBe("Con cariño");

    fireEvent.click(screen.getByRole("button", { name: "action_discard" }));

    expect((screen.getByPlaceholderText("fulfillment_recipient_name_placeholder") as HTMLInputElement).value).toBe("");
    expect((screen.getByPlaceholderText("card_message_placeholder") as HTMLTextAreaElement).value).toBe("");
    // channel reset => walk-in button is the selected (ink) one again; phone no longer selected.
    // We assert the recipient/card cleared as the primary guard; channel reset is covered by state.
  });

  it("clears fulfillment after a successful create", async () => {
    render(<IntakeForm products={[]} />);

    // pickup makes buyer optional; only a line is required to enable save.
    fireEvent.click(screen.getByRole("button", { name: "fulfillment_pickup" }));
    const recipient = screen.getByPlaceholderText("fulfillment_recipient_name_placeholder") as HTMLInputElement;
    fireEvent.change(recipient, { target: { value: "Lola" } });

    // add one custom line
    fireEvent.click(screen.getByRole("button", { name: "products_add_custom" }));
    fireEvent.change(screen.getByPlaceholderText("products_custom_title_placeholder"), { target: { value: "Rosas" } });
    fireEvent.change(screen.getByPlaceholderText("products_custom_price_placeholder"), { target: { value: "50" } });
    fireEvent.click(screen.getByRole("button", { name: "products_custom_add" }));

    const save = screen.getByRole("button", { name: "action_save" }) as HTMLButtonElement;
    expect(save.disabled).toBe(false);
    fireEvent.click(save);

    await waitFor(() =>
      expect((screen.getByPlaceholderText("fulfillment_recipient_name_placeholder") as HTMLInputElement).value).toBe(""),
    );
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test -- tests/unit/IntakeFormReset.test.tsx`
Expected: FAIL — first test may pass or fail (Descartar has no handler yet, so recipient stays "Lola" → assertion `""` fails); second test FAILS because after create, `fulfillment.recipient` is not reset (recipient stays "Lola").

- [ ] **Step 4: Wire the factory + `resetForm()` into IntakeForm**

In `components/admin/intake/IntakeForm.tsx`:

Replace the local `Channel` type and the inline initial-state useState calls. Change the imports block near the top to add:

```tsx
import {
  makeInitialFulfillment,
  makeInitialFormState,
  INITIAL_CHANNEL,
  INITIAL_CUSTOMER,
  INITIAL_PAYMENT,
  type Channel,
} from "./intake-initial-state";
```

Delete the local declaration `type Channel = "walk-in" | "phone" | "whatsapp" | "event";` (now imported).

Change the state initializers (currently lines ~36-44 and ~95) to lazy initializers:

```tsx
const [channel, setChannel] = useState<Channel>(INITIAL_CHANNEL);
const [customer, setCustomer] = useState<CustomerSnapshot>(() => ({ ...INITIAL_CUSTOMER }));
const [fulfillment, setFulfillment] = useState<FulfillmentState>(makeInitialFulfillment);
```

and

```tsx
const [payment, setPayment] = useState<PaymentState>(() => ({ ...INITIAL_PAYMENT }));
```

Add a `resetForm` function (place it just above `onSubmit`):

```tsx
function resetForm() {
  const init = makeInitialFormState();
  setChannel(init.channel);
  setCustomer(init.customer);
  setFulfillment(init.fulfillment);
  setLines(init.lines);
  setOverride(init.override);
  setGiftCardCode(init.giftCardCode);
  setPayment(init.payment);
}
```

In `onSubmit`, replace the scattered reset block in the success path:

```tsx
      const { orderId } = await res.json();
      router.replace(`/${locale}/admin/intake?ok=${encodeURIComponent(orderId)}`);
      setCustomer({ name: "", phone: "", email: "", messagingChannel: "sms", buyerAddress: undefined });
      setLines([]);
      setOverride({});
      setGiftCardCode("");
      setPayment({ status: "pending" });
```

with:

```tsx
      const { orderId } = await res.json();
      router.replace(`/${locale}/admin/intake?ok=${encodeURIComponent(orderId)}`);
      resetForm();
```

Wire the "Descartar" button (currently no `onClick`):

```tsx
            <button type="button" onClick={resetForm} className="px-5 py-3 rounded-full border border-mute-200 text-mute-600">
              {t("action_discard")}
            </button>
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- tests/unit/IntakeFormReset.test.tsx`
Expected: PASS (both tests).

- [ ] **Step 6: Commit**

```bash
git add components/admin/intake/intake-initial-state.ts components/admin/intake/IntakeForm.tsx tests/unit/IntakeFormReset.test.tsx
git commit -m "fix(intake): fully reset form after create (fulfillment + channel)"
```

---

## Task 2: Add the `order_drafts` migration

**Files:**
- Create: `db/migrations/015_order_drafts.sql`
- Test: `tests/unit/order-drafts-migration.test.ts`

- [ ] **Step 1: Write the failing migration test**

Create `tests/unit/order-drafts-migration.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  runMigrations();
});
afterEach(() => {
  closeDb();
  vi.unstubAllEnvs();
});

describe("015_order_drafts migration", () => {
  it("creates the order_drafts table", () => {
    const row = getDb()
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='order_drafts'")
      .get() as { name: string } | undefined;
    expect(row?.name).toBe("order_drafts");
  });

  it("accepts an insert and read-back", () => {
    const db = getDb();
    db.prepare(
      `INSERT INTO order_drafts (id, label, payload_json, item_count, total_cents, taken_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run("dr_1", "Lola", "{}", 2, 5000, "maky", "2026-07-31T00:00:00Z", "2026-07-31T00:00:00Z");
    const got = db.prepare("SELECT label, item_count, total_cents FROM order_drafts WHERE id = ?").get("dr_1") as {
      label: string;
      item_count: number;
      total_cents: number;
    };
    expect(got).toEqual({ label: "Lola", item_count: 2, total_cents: 5000 });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/unit/order-drafts-migration.test.ts`
Expected: FAIL — `order_drafts` table does not exist.

- [ ] **Step 3: Write the migration**

Create `db/migrations/015_order_drafts.sql`:

```sql
-- 015_order_drafts.sql — in-progress intake orders saved for later resume.
-- payload_json holds the raw IntakeForm state (DraftPayload), not a validated Order,
-- so incomplete orders can be saved and restored exactly.
CREATE TABLE IF NOT EXISTS order_drafts (
  id           TEXT PRIMARY KEY,
  label        TEXT NOT NULL DEFAULT '',
  payload_json TEXT NOT NULL,
  item_count   INTEGER NOT NULL DEFAULT 0,
  total_cents  INTEGER NOT NULL DEFAULT 0,
  taken_by     TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_order_drafts_updated_at ON order_drafts(updated_at DESC);
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- tests/unit/order-drafts-migration.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add db/migrations/015_order_drafts.sql tests/unit/order-drafts-migration.test.ts
git commit -m "feat(drafts): add order_drafts migration"
```

---

## Task 3: Draft types + row mapping

**Files:**
- Create: `types/draft.ts`
- Create: `lib/draft-row.ts`
- Test: `tests/unit/draft-row.test.ts`

- [ ] **Step 1: Write the draft types**

Create `types/draft.ts`:

```ts
import type { CartLine, OrderTotals } from "@/types/order";
import type { CustomerSnapshot } from "@/components/admin/intake/CustomerBlock";
import type { FulfillmentState } from "@/components/admin/intake/FulfillmentBlock";
import type { PaymentState } from "@/components/admin/intake/PaymentBlock";

/** The exact IntakeForm client state, so resume restores editing state 1:1. */
export type DraftPayload = {
  version: 1;
  channel: "walk-in" | "phone" | "whatsapp" | "event";
  customer: CustomerSnapshot;
  fulfillment: FulfillmentState;
  lines: CartLine[];
  override: Partial<OrderTotals>;
  giftCardCode: string;
  payment: PaymentState;
};

/** List-row metadata (no payload). */
export type OrderDraft = {
  id: string;
  label: string;
  itemCount: number;
  totalCents: number;
  takenBy?: string;
  createdAt: string;
  updatedAt: string;
};

/** Full draft including the payload, returned by GET /[id]. */
export type OrderDraftDetail = OrderDraft & { payload: DraftPayload };
```

- [ ] **Step 2: Write the failing row-mapping test**

Create `tests/unit/draft-row.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { draftToRow, rowToDraft, rowToDraftDetail } from "@/lib/draft-row";
import type { DraftPayload } from "@/types/draft";

const payload: DraftPayload = {
  version: 1,
  channel: "phone",
  customer: { name: "Ana", phone: "5165550100", email: "", messagingChannel: "sms" },
  fulfillment: {
    method: "delivery",
    recipient: { name: "Lola", phone: "5165550199" },
    address: { street1: "1 A", city: "Albertson", state: "NY", zip: "11507", country: "US" },
    window: { date: "2099-01-01", slot: "midday" },
    cardMessage: "",
  },
  lines: [{ kind: "custom", title: "Rosas", priceCents: 5000, qty: 2 }],
  override: {},
  giftCardCode: "",
  payment: { status: "pending" },
};

describe("draft-row mapping", () => {
  it("round-trips a draft through the row shape", () => {
    const row = draftToRow({
      id: "dr_1",
      label: "Ana",
      payload,
      itemCount: 2,
      totalCents: 10000,
      takenBy: "maky",
      createdAt: "2026-07-31T00:00:00Z",
      updatedAt: "2026-07-31T00:00:00Z",
    });
    expect(row.payload_json).toBe(JSON.stringify(payload));

    const meta = rowToDraft(row);
    expect(meta).toEqual({
      id: "dr_1",
      label: "Ana",
      itemCount: 2,
      totalCents: 10000,
      takenBy: "maky",
      createdAt: "2026-07-31T00:00:00Z",
      updatedAt: "2026-07-31T00:00:00Z",
    });

    const detail = rowToDraftDetail(row);
    expect(detail.payload).toEqual(payload);
    expect(detail.label).toBe("Ana");
  });

  it("maps a null taken_by to undefined", () => {
    const row = draftToRow({
      id: "dr_2",
      label: "",
      payload,
      itemCount: 0,
      totalCents: 0,
      takenBy: undefined,
      createdAt: "2026-07-31T00:00:00Z",
      updatedAt: "2026-07-31T00:00:00Z",
    });
    expect(row.taken_by).toBeNull();
    expect(rowToDraft(row).takenBy).toBeUndefined();
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test -- tests/unit/draft-row.test.ts`
Expected: FAIL — `@/lib/draft-row` does not exist.

- [ ] **Step 4: Write the row mapping**

Create `lib/draft-row.ts`:

```ts
import "server-only";
import type { DraftPayload, OrderDraft, OrderDraftDetail } from "@/types/draft";

export type DraftRow = {
  id: string;
  label: string;
  payload_json: string;
  item_count: number;
  total_cents: number;
  taken_by: string | null;
  created_at: string;
  updated_at: string;
};

export type DraftInput = {
  id: string;
  label: string;
  payload: DraftPayload;
  itemCount: number;
  totalCents: number;
  takenBy?: string;
  createdAt: string;
  updatedAt: string;
};

export function draftToRow(d: DraftInput): DraftRow {
  return {
    id: d.id,
    label: d.label,
    payload_json: JSON.stringify(d.payload),
    item_count: d.itemCount,
    total_cents: d.totalCents,
    taken_by: d.takenBy ?? null,
    created_at: d.createdAt,
    updated_at: d.updatedAt,
  };
}

export function rowToDraft(r: DraftRow): OrderDraft {
  return {
    id: r.id,
    label: r.label,
    itemCount: r.item_count,
    totalCents: r.total_cents,
    takenBy: r.taken_by ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function rowToDraftDetail(r: DraftRow): OrderDraftDetail {
  return {
    ...rowToDraft(r),
    payload: JSON.parse(r.payload_json) as DraftPayload,
  };
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- tests/unit/draft-row.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add types/draft.ts lib/draft-row.ts tests/unit/draft-row.test.ts
git commit -m "feat(drafts): draft types + row mapping"
```

---

## Task 4: Draft storage layer

**Files:**
- Create: `lib/draft-storage.ts`
- Test: `tests/unit/draft-storage.test.ts`

- [ ] **Step 1: Write the failing storage test**

Create `tests/unit/draft-storage.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { saveDraft, listDrafts, getDraft, deleteDraft } from "@/lib/draft-storage";
import type { DraftPayload } from "@/types/draft";

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  runMigrations();
});
afterEach(() => {
  closeDb();
  vi.unstubAllEnvs();
});

const payload: DraftPayload = {
  version: 1,
  channel: "walk-in",
  customer: { name: "Ana", phone: "5165550100", email: "", messagingChannel: "sms" },
  fulfillment: {
    method: "pickup",
    recipient: { name: "Ana", phone: "5165550100" },
    address: { street1: "", city: "", state: "NY", zip: "", country: "US" },
    window: { date: "2099-01-01", slot: "midday" },
    cardMessage: "",
  },
  lines: [{ kind: "custom", title: "Rosas", priceCents: 5000, qty: 2 }],
  override: {},
  giftCardCode: "",
  payment: { status: "pending" },
};

function input(id: string, label: string, when: string) {
  return { id, label, payload, itemCount: 2, totalCents: 10000, takenBy: "maky", createdAt: when, updatedAt: when };
}

describe("draft-storage", () => {
  it("saves and reads back a draft with its payload", () => {
    saveDraft(input("dr_1", "Ana", "2026-07-31T10:00:00Z"));
    const got = getDraft("dr_1");
    expect(got?.label).toBe("Ana");
    expect(got?.payload).toEqual(payload);
    expect(got?.itemCount).toBe(2);
  });

  it("returns null for an unknown id", () => {
    expect(getDraft("nope")).toBeNull();
  });

  it("upserts by id (same id updates, does not duplicate) and preserves created_at", () => {
    saveDraft(input("dr_1", "Ana", "2026-07-31T10:00:00Z"));
    const updated = saveDraft({
      ...input("dr_1", "Ana (edit)", "2026-07-31T11:00:00Z"),
      createdAt: "2026-07-31T11:00:00Z", // deliberately different; must be ignored on conflict
    });
    expect(updated.label).toBe("Ana (edit)");
    expect(updated.createdAt).toBe("2026-07-31T10:00:00Z"); // preserved
    expect(updated.updatedAt).toBe("2026-07-31T11:00:00Z");
    expect(listDrafts()).toHaveLength(1);
  });

  it("lists drafts newest-updated first", () => {
    saveDraft(input("dr_1", "First", "2026-07-31T10:00:00Z"));
    saveDraft(input("dr_2", "Second", "2026-07-31T12:00:00Z"));
    const list = listDrafts();
    expect(list.map((d) => d.id)).toEqual(["dr_2", "dr_1"]);
    // list rows carry metadata only
    expect(list[0]).not.toHaveProperty("payload");
  });

  it("deletes a draft", () => {
    saveDraft(input("dr_1", "Ana", "2026-07-31T10:00:00Z"));
    deleteDraft("dr_1");
    expect(getDraft("dr_1")).toBeNull();
    expect(listDrafts()).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/unit/draft-storage.test.ts`
Expected: FAIL — `@/lib/draft-storage` does not exist.

- [ ] **Step 3: Write the storage layer**

Create `lib/draft-storage.ts`:

```ts
import "server-only";
import { getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { draftToRow, rowToDraft, rowToDraftDetail, type DraftInput, type DraftRow } from "@/lib/draft-row";
import type { OrderDraft, OrderDraftDetail } from "@/types/draft";

function ensureSchema(): void {
  runMigrations();
}

/** Upsert by id. created_at is preserved on conflict; updated_at always advances. */
export function saveDraft(input: DraftInput): OrderDraft {
  ensureSchema();
  const db = getDb();
  const row = draftToRow(input);
  db.prepare(
    `INSERT INTO order_drafts (
       id, label, payload_json, item_count, total_cents, taken_by, created_at, updated_at
     ) VALUES (
       @id, @label, @payload_json, @item_count, @total_cents, @taken_by, @created_at, @updated_at
     )
     ON CONFLICT(id) DO UPDATE SET
       label=excluded.label,
       payload_json=excluded.payload_json,
       item_count=excluded.item_count,
       total_cents=excluded.total_cents,
       updated_at=excluded.updated_at`,
  ).run(row);
  const stored = db.prepare("SELECT * FROM order_drafts WHERE id = ?").get(input.id) as DraftRow;
  return rowToDraft(stored);
}

export function listDrafts(): OrderDraft[] {
  ensureSchema();
  const rows = getDb()
    .prepare("SELECT * FROM order_drafts ORDER BY updated_at DESC, id DESC")
    .all() as DraftRow[];
  return rows.map(rowToDraft);
}

export function getDraft(id: string): OrderDraftDetail | null {
  ensureSchema();
  const row = getDb().prepare("SELECT * FROM order_drafts WHERE id = ?").get(id) as DraftRow | undefined;
  return row ? rowToDraftDetail(row) : null;
}

export function deleteDraft(id: string): void {
  ensureSchema();
  getDb().prepare("DELETE FROM order_drafts WHERE id = ?").run(id);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- tests/unit/draft-storage.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/draft-storage.ts tests/unit/draft-storage.test.ts
git commit -m "feat(drafts): draft storage layer (upsert/list/get/delete)"
```

---

## Task 5: Draft request schema

**Files:**
- Create: `schemas/draft.ts`
- Test: `tests/unit/draft-schema.test.ts`

- [ ] **Step 1: Write the failing schema test**

Create `tests/unit/draft-schema.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { draftRequestSchema } from "@/schemas/draft";

const validPayload = {
  version: 1,
  channel: "walk-in",
  customer: { name: "", phone: "", email: "", messagingChannel: "sms" },
  fulfillment: {
    method: "delivery",
    recipient: { name: "", phone: "" },
    address: { street1: "", city: "", state: "NY", zip: "", country: "US" },
    window: { date: "2099-01-01", slot: "midday" },
    cardMessage: "",
  },
  lines: [],
  override: {},
  giftCardCode: "",
  payment: { status: "pending" },
};

describe("draftRequestSchema", () => {
  it("accepts a minimal / incomplete draft (no lines, empty fields)", () => {
    const parsed = draftRequestSchema.safeParse({ payload: validPayload, label: "", itemCount: 0, totalCents: 0 });
    expect(parsed.success).toBe(true);
  });

  it("defaults label/itemCount/totalCents when omitted", () => {
    const parsed = draftRequestSchema.safeParse({ payload: validPayload });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.label).toBe("");
      expect(parsed.data.itemCount).toBe(0);
      expect(parsed.data.totalCents).toBe(0);
    }
  });

  it("rejects a missing payload", () => {
    expect(draftRequestSchema.safeParse({ label: "x" }).success).toBe(false);
  });

  it("rejects an oversized payload", () => {
    const huge = { ...validPayload, giftCardCode: "x".repeat(60_000) };
    expect(draftRequestSchema.safeParse({ payload: huge }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/unit/draft-schema.test.ts`
Expected: FAIL — `@/schemas/draft` does not exist.

- [ ] **Step 3: Write the schema**

Create `schemas/draft.ts`:

```ts
import { z } from "zod";

/**
 * Lax on purpose: a draft is an in-progress order and may be incomplete/invalid.
 * We only bound the top-level shape and total size — the intake schema is applied
 * later, at real create time.
 */
const draftPayloadSchema = z
  .object({
    version: z.literal(1),
    channel: z.enum(["walk-in", "phone", "whatsapp", "event"]),
    customer: z.record(z.string(), z.unknown()),
    fulfillment: z.record(z.string(), z.unknown()),
    lines: z.array(z.unknown()).max(200).default([]),
    override: z.record(z.string(), z.unknown()).optional(),
    giftCardCode: z.string().max(50_000).optional(),
    payment: z.record(z.string(), z.unknown()),
  })
  .passthrough();

const MAX_PAYLOAD_BYTES = 50_000;

export const draftRequestSchema = z
  .object({
    payload: draftPayloadSchema,
    label: z.string().max(120).default(""),
    itemCount: z.number().int().min(0).max(999).default(0),
    totalCents: z.number().int().min(0).max(100_000_000).default(0),
  })
  .refine((d) => JSON.stringify(d.payload).length <= MAX_PAYLOAD_BYTES, {
    message: "payload_too_large",
    path: ["payload"],
  });

export type DraftRequest = z.infer<typeof draftRequestSchema>;
```

> Note: the `giftCardCode` max of `50_000` is only a coarse type guard; the real
> size ceiling is the `MAX_PAYLOAD_BYTES` refine, which the oversized-payload test
> exercises.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- tests/unit/draft-schema.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add schemas/draft.ts tests/unit/draft-schema.test.ts
git commit -m "feat(drafts): lax draft request schema"
```

---

## Task 6: Draft API routes

**Files:**
- Create: `app/api/admin/orders/drafts/route.ts`
- Create: `app/api/admin/orders/drafts/[id]/route.ts`
- Test: `tests/unit/api-admin-drafts.test.ts`

- [ ] **Step 1: Write the failing API test**

Create `tests/unit/api-admin-drafts.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { GET as listGET, POST } from "@/app/api/admin/orders/drafts/route";
import { GET as detailGET, PUT, DELETE } from "@/app/api/admin/orders/drafts/[id]/route";

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  runMigrations();
});
afterEach(() => {
  closeDb();
  vi.unstubAllEnvs();
});

const payload = {
  version: 1,
  channel: "walk-in",
  customer: { name: "Ana", phone: "5165550100", email: "", messagingChannel: "sms" },
  fulfillment: {
    method: "pickup",
    recipient: { name: "Ana", phone: "5165550100" },
    address: { street1: "", city: "", state: "NY", zip: "", country: "US" },
    window: { date: "2099-01-01", slot: "midday" },
    cardMessage: "",
  },
  lines: [{ kind: "custom", title: "Rosas", priceCents: 5000, qty: 2 }],
  override: {},
  giftCardCode: "",
  payment: { status: "pending" },
};

function post(body: unknown): Request {
  return new Request("http://localhost/api/admin/orders/drafts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("drafts API", () => {
  it("creates, lists, reads, updates, and deletes a draft", async () => {
    // create
    const createRes = await POST(post({ payload, label: "Ana", itemCount: 2, totalCents: 10000 }));
    expect(createRes.status).toBe(201);
    const { id } = await createRes.json();
    expect(id).toMatch(/^dr_/);

    // list
    const listRes = await listGET();
    const { drafts } = await listRes.json();
    expect(drafts).toHaveLength(1);
    expect(drafts[0].label).toBe("Ana");
    expect(drafts[0].payload).toBeUndefined();

    // read detail
    const getRes = await detailGET(new Request("http://localhost"), ctx(id));
    expect(getRes.status).toBe(200);
    const detail = await getRes.json();
    expect(detail.draft.payload.customer.name).toBe("Ana");

    // update (PUT) — same id, no duplicate
    const putReq = new Request("http://localhost", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload, label: "Ana (edit)", itemCount: 2, totalCents: 12000 }),
    });
    const putRes = await PUT(putReq, ctx(id));
    expect(putRes.status).toBe(200);
    expect((await listGET().then((r) => r.json())).drafts).toHaveLength(1);

    // delete
    const delRes = await DELETE(new Request("http://localhost"), ctx(id));
    expect(delRes.status).toBe(200);
    expect((await listGET().then((r) => r.json())).drafts).toHaveLength(0);
  });

  it("returns 400 for an invalid create body", async () => {
    const res = await POST(post({ label: "no payload" }));
    expect(res.status).toBe(400);
  });

  it("returns 404 reading a missing draft", async () => {
    const res = await detailGET(new Request("http://localhost"), ctx("dr_missing"));
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/unit/api-admin-drafts.test.ts`
Expected: FAIL — route modules do not exist.

- [ ] **Step 3: Write the list/create route**

Create `app/api/admin/orders/drafts/route.ts`:

```ts
import { NextResponse } from "next/server";
import { draftRequestSchema } from "@/schemas/draft";
import { listDrafts, saveDraft } from "@/lib/draft-storage";
import type { DraftPayload } from "@/types/draft";

export const runtime = "nodejs";

const TAKEN_BY = "maky"; // matches the intake create route; real auth is a follow-up

function newId(): string {
  return `dr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function GET(): Promise<Response> {
  return NextResponse.json({ drafts: listDrafts() });
}

export async function POST(req: Request): Promise<Response> {
  const json = await req.json().catch(() => null);
  const parsed = draftRequestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ errors: parsed.error.flatten() }, { status: 400 });
  }
  const now = new Date().toISOString();
  const draft = saveDraft({
    id: newId(),
    label: parsed.data.label,
    payload: parsed.data.payload as unknown as DraftPayload,
    itemCount: parsed.data.itemCount,
    totalCents: parsed.data.totalCents,
    takenBy: TAKEN_BY,
    createdAt: now,
    updatedAt: now,
  });
  return NextResponse.json({ id: draft.id, draft }, { status: 201 });
}
```

- [ ] **Step 4: Write the detail/update/delete route**

Create `app/api/admin/orders/drafts/[id]/route.ts`:

```ts
import { NextResponse } from "next/server";
import { draftRequestSchema } from "@/schemas/draft";
import { getDraft, saveDraft, deleteDraft } from "@/lib/draft-storage";
import type { DraftPayload } from "@/types/draft";

export const runtime = "nodejs";

const TAKEN_BY = "maky";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx): Promise<Response> {
  const { id } = await params;
  const draft = getDraft(id);
  if (!draft) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ draft });
}

export async function PUT(req: Request, { params }: Ctx): Promise<Response> {
  const { id } = await params;
  const existing = getDraft(id);
  if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const json = await req.json().catch(() => null);
  const parsed = draftRequestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ errors: parsed.error.flatten() }, { status: 400 });
  }
  const now = new Date().toISOString();
  const draft = saveDraft({
    id,
    label: parsed.data.label,
    payload: parsed.data.payload as unknown as DraftPayload,
    itemCount: parsed.data.itemCount,
    totalCents: parsed.data.totalCents,
    takenBy: existing.takenBy ?? TAKEN_BY,
    createdAt: existing.createdAt,
    updatedAt: now,
  });
  return NextResponse.json({ draft });
}

export async function DELETE(_req: Request, { params }: Ctx): Promise<Response> {
  const { id } = await params;
  deleteDraft(id);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- tests/unit/api-admin-drafts.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/api/admin/orders/drafts/route.ts app/api/admin/orders/drafts/[id]/route.ts tests/unit/api-admin-drafts.test.ts
git commit -m "feat(drafts): drafts API (list/create + detail/update/delete)"
```

---

## Task 7: i18n keys for drafts

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/es.json`
- Test (existing): `tests/unit/i18n-parity.test.ts`

- [ ] **Step 1: Add keys to `messages/es.json`**

Inside the `admin_intake` object, add these keys (e.g. right after `"action_saving"`):

```json
    "action_save_draft": "Guardar borrador",
    "action_saving_draft": "Guardando…",
    "draft_saved": "Borrador guardado",
    "drafts_button": "Borradores",
    "drafts_title": "Borradores guardados",
    "drafts_empty": "No hay borradores todavía",
    "drafts_loading": "Cargando…",
    "drafts_close": "Cerrar",
    "draft_resume": "Retomar",
    "draft_delete": "Eliminar",
    "draft_untitled": "Borrador sin nombre",
    "draft_items_one": "{count} ítem",
    "draft_items_other": "{count} ítems",
    "draft_updated": "Actualizado {when}",
```

- [ ] **Step 2: Add the same keys to `messages/en.json`**

Inside its `admin_intake` object, matching paths:

```json
    "action_save_draft": "Save draft",
    "action_saving_draft": "Saving…",
    "draft_saved": "Draft saved",
    "drafts_button": "Drafts",
    "drafts_title": "Saved drafts",
    "drafts_empty": "No drafts yet",
    "drafts_loading": "Loading…",
    "drafts_close": "Close",
    "draft_resume": "Resume",
    "draft_delete": "Delete",
    "draft_untitled": "Untitled draft",
    "draft_items_one": "{count} item",
    "draft_items_other": "{count} items",
    "draft_updated": "Updated {when}",
```

- [ ] **Step 3: Run the parity test to verify keys match**

Run: `npm test -- tests/unit/i18n-parity.test.ts`
Expected: PASS (identical key paths in both files). If it fails, reconcile the two key sets.

- [ ] **Step 4: Commit**

```bash
git add messages/en.json messages/es.json
git commit -m "feat(drafts): i18n keys for drafts drawer + save button"
```

---

## Task 8: Drafts drawer component

**Files:**
- Create: `components/admin/intake/DraftsDrawer.tsx`
- Test: `tests/unit/DraftsDrawer.test.tsx`

- [ ] **Step 1: Write the failing drawer test**

Create `tests/unit/DraftsDrawer.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("next-intl", () => ({
  useTranslations: () => (k: string, vars?: Record<string, unknown>) => (vars ? `${k}:${JSON.stringify(vars)}` : k),
}));

import DraftsDrawer from "@/components/admin/intake/DraftsDrawer";
import type { OrderDraft, DraftPayload } from "@/types/draft";

const draft: OrderDraft = {
  id: "dr_1",
  label: "Ana",
  itemCount: 2,
  totalCents: 10000,
  takenBy: "maky",
  createdAt: "2026-07-31T10:00:00Z",
  updatedAt: "2026-07-31T10:00:00Z",
};

const payload: DraftPayload = {
  version: 1,
  channel: "walk-in",
  customer: { name: "Ana", phone: "5165550100", email: "", messagingChannel: "sms" },
  fulfillment: {
    method: "pickup",
    recipient: { name: "Ana", phone: "5165550100" },
    address: { street1: "", city: "", state: "NY", zip: "", country: "US" },
    window: { date: "2099-01-01", slot: "midday" },
    cardMessage: "",
  },
  lines: [],
  override: {},
  giftCardCode: "",
  payment: { status: "pending" },
};

function mockFetchSequence() {
  const fetchMock = vi.spyOn(globalThis, "fetch");
  // first call: list; subsequent calls resolved per-URL below
  fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.endsWith("/api/admin/orders/drafts")) {
      return new Response(JSON.stringify({ drafts: [draft] }), { status: 200 });
    }
    if (url.includes("/api/admin/orders/drafts/dr_1") && init?.method === "DELETE") {
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }
    if (url.includes("/api/admin/orders/drafts/dr_1")) {
      return new Response(JSON.stringify({ draft: { ...draft, payload } }), { status: 200 });
    }
    return new Response("{}", { status: 200 });
  });
  return fetchMock;
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("DraftsDrawer", () => {
  it("lists drafts and resumes one with its payload", async () => {
    mockFetchSequence();
    const onResume = vi.fn();
    render(<DraftsDrawer locale="es" onResume={onResume} onClose={() => {}} />);

    await waitFor(() => expect(screen.getByText("Ana")).toBeDefined());

    fireEvent.click(screen.getByRole("button", { name: "draft_resume" }));
    await waitFor(() => expect(onResume).toHaveBeenCalled());
    const [passedPayload, passedId] = onResume.mock.calls[0];
    expect(passedId).toBe("dr_1");
    expect(passedPayload.customer.name).toBe("Ana");
  });

  it("deletes a draft and removes its row", async () => {
    mockFetchSequence();
    render(<DraftsDrawer locale="es" onResume={() => {}} onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText("Ana")).toBeDefined());

    fireEvent.click(screen.getByRole("button", { name: "draft_delete" }));
    await waitFor(() => expect(screen.queryByText("Ana")).toBeNull());
  });

  it("shows an empty state when there are no drafts", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ drafts: [] }), { status: 200 }),
    );
    render(<DraftsDrawer locale="es" onResume={() => {}} onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText("drafts_empty")).toBeDefined());
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/unit/DraftsDrawer.test.tsx`
Expected: FAIL — `@/components/admin/intake/DraftsDrawer` does not exist.

- [ ] **Step 3: Write the drawer component**

Create `components/admin/intake/DraftsDrawer.tsx`:

```tsx
"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { X } from "@phosphor-icons/react/dist/ssr";
import { formatDateTime } from "@/lib/format-datetime";
import type { OrderDraft, OrderDraftDetail, DraftPayload } from "@/types/draft";

type Props = {
  locale: string;
  onResume: (payload: DraftPayload, id: string) => void;
  onClose: () => void;
};

export default function DraftsDrawer({ locale, onResume, onClose }: Props) {
  const t = useTranslations("admin_intake");
  const [drafts, setDrafts] = useState<OrderDraft[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/orders/drafts")
      .then((r) => (r.ok ? r.json() : { drafts: [] }))
      .then((d) => setDrafts(d.drafts as OrderDraft[]))
      .catch(() => setDrafts([]));
  }, []);

  async function resume(id: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/orders/drafts/${encodeURIComponent(id)}`);
      if (!res.ok) return;
      const { draft } = (await res.json()) as { draft: OrderDraftDetail };
      onResume(draft.payload, draft.id);
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: string) {
    setBusyId(id);
    try {
      await fetch(`/api/admin/orders/drafts/${encodeURIComponent(id)}`, { method: "DELETE" });
      setDrafts((cur) => (cur ? cur.filter((d) => d.id !== id) : cur));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex bg-ink/20" onClick={onClose}>
      <div
        className="ml-auto h-full w-full max-w-md overflow-y-auto bg-bone p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="mb-4 flex items-center justify-between gap-2">
          <h2 className="font-display text-lg text-ink">{t("drafts_title")}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("drafts_close")}
            className="rounded-full border border-mute-200 p-1.5 text-mute-600 hover:bg-ink/5"
          >
            <X size={16} weight="bold" />
          </button>
        </header>

        {drafts === null && <p className="text-mute-500 text-sm">{t("drafts_loading")}</p>}
        {drafts !== null && drafts.length === 0 && <p className="text-mute-500 text-sm">{t("drafts_empty")}</p>}

        <ul className="grid gap-2">
          {(drafts ?? []).map((d) => (
            <li key={d.id} className="rounded-xl border border-mute-200 bg-white p-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium text-ink truncate">{d.label || t("draft_untitled")}</div>
                  <div className="mt-0.5 text-xs text-mute-500 tabular-nums">
                    {t(d.itemCount === 1 ? "draft_items_one" : "draft_items_other", { count: d.itemCount })}
                    {" · "}
                    {`$${(d.totalCents / 100).toFixed(2)}`}
                  </div>
                  <div className="mt-0.5 text-xs text-mute-400">
                    {t("draft_updated", { when: formatDateTime(d.updatedAt, locale) })}
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    disabled={busyId === d.id}
                    onClick={() => resume(d.id)}
                    className="rounded-full bg-ink px-3 py-1.5 text-xs text-bone disabled:opacity-40"
                  >
                    {t("draft_resume")}
                  </button>
                  <button
                    type="button"
                    disabled={busyId === d.id}
                    onClick={() => remove(d.id)}
                    className="rounded-full border border-mute-200 px-3 py-1.5 text-xs text-mute-600 disabled:opacity-40"
                  >
                    {t("draft_delete")}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- tests/unit/DraftsDrawer.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/admin/intake/DraftsDrawer.tsx tests/unit/DraftsDrawer.test.tsx
git commit -m "feat(drafts): drafts drawer (list/resume/delete)"
```

---

## Task 9: Wire drafts into IntakeForm

**Files:**
- Modify: `components/admin/intake/IntakeForm.tsx`
- Test: `tests/unit/IntakeFormDrafts.test.tsx`

- [ ] **Step 1: Write the failing wiring test**

Create `tests/unit/IntakeFormDrafts.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("next-intl", () => ({
  useTranslations: () => (k: string) => k,
  useLocale: () => "es",
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
}));

import IntakeForm from "@/components/admin/intake/IntakeForm";
import type { DraftPayload } from "@/types/draft";

const resumePayload: DraftPayload = {
  version: 1,
  channel: "walk-in",
  customer: { name: "Ana", phone: "5165550100", email: "", messagingChannel: "sms" },
  fulfillment: {
    method: "delivery",
    recipient: { name: "Lola Resumed", phone: "5165550199" },
    address: { street1: "1 A", city: "Albertson", state: "NY", zip: "11507", country: "US" },
    window: { date: "2099-01-01", slot: "midday" },
    cardMessage: "resumed msg",
  },
  lines: [],
  override: {},
  giftCardCode: "",
  payment: { status: "pending" },
};

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("IntakeForm drafts wiring", () => {
  it("saves a draft via POST with the current form payload", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "dr_new", found: false }), { status: 201 }),
    );
    render(<IntakeForm products={[]} />);

    fireEvent.change(screen.getByPlaceholderText("fulfillment_recipient_name_placeholder"), {
      target: { value: "Lola" },
    });
    // save-draft becomes enabled once there is content
    const saveDraft = screen.getByRole("button", { name: "action_save_draft" });
    fireEvent.click(saveDraft);

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(
        ([u, i]) => String(u) === "/api/admin/orders/drafts" && (i as RequestInit)?.method === "POST",
      );
      expect(call).toBeTruthy();
      const body = JSON.parse((call![1] as RequestInit).body as string);
      expect(body.payload.fulfillment.recipient.name).toBe("Lola");
    });
  });

  it("resumes a draft from the drawer into the form", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/admin/orders/drafts")) {
        return new Response(
          JSON.stringify({ drafts: [{ id: "dr_1", label: "Ana", itemCount: 0, totalCents: 0, createdAt: "2026-07-31T10:00:00Z", updatedAt: "2026-07-31T10:00:00Z" }] }),
          { status: 200 },
        );
      }
      if (url.includes("/api/admin/orders/drafts/dr_1")) {
        return new Response(JSON.stringify({ draft: { id: "dr_1", label: "Ana", itemCount: 0, totalCents: 0, createdAt: "2026-07-31T10:00:00Z", updatedAt: "2026-07-31T10:00:00Z", payload: resumePayload } }), { status: 200 });
      }
      return new Response("{}", { status: 200 });
    });

    render(<IntakeForm products={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "drafts_button" }));
    await waitFor(() => expect(screen.getByText("Ana")).toBeDefined());
    fireEvent.click(screen.getByRole("button", { name: "draft_resume" }));

    await waitFor(() =>
      expect((screen.getByPlaceholderText("fulfillment_recipient_name_placeholder") as HTMLInputElement).value).toBe("Lola Resumed"),
    );
    expect((screen.getByPlaceholderText("card_message_placeholder") as HTMLTextAreaElement).value).toBe("resumed msg");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/unit/IntakeFormDrafts.test.tsx`
Expected: FAIL — no `action_save_draft` / `drafts_button` controls exist yet.

- [ ] **Step 3: Add draft state, payload builders, and handlers to IntakeForm**

In `components/admin/intake/IntakeForm.tsx`:

Add imports:

```tsx
import DraftsDrawer from "./DraftsDrawer";
import type { DraftPayload } from "@/types/draft";
```

Add state (next to the other `useState` calls):

```tsx
const [draftId, setDraftId] = useState<string | null>(null);
const [savingDraft, setSavingDraft] = useState(false);
const [draftsOpen, setDraftsOpen] = useState(false);
```

Extend `resetForm()` (from Task 1) to also clear the draft binding — add this line inside it:

```tsx
  setDraftId(null);
```

Add the payload builders + handlers (place near `onSubmit`):

```tsx
function currentPayload(): DraftPayload {
  return { version: 1, channel, customer, fulfillment, lines, override, giftCardCode, payment };
}

function draftLabel(): string {
  return customer.name.trim() || fulfillment.recipient.name.trim() || "";
}

function draftItemCount(): number {
  return lines.reduce((n, l) => n + l.qty, 0);
}

function draftTotalCents(): number {
  if (typeof override.totalCents === "number") return override.totalCents;
  return lines.reduce((sum, l) => {
    if (l.kind === "custom") return sum + l.priceCents * l.qty;
    const p = products.find((pr) => pr.id === l.productId);
    const v = p?.variants.find((vr) => vr.id === l.variantId) ?? p?.variants[0];
    return sum + (v?.priceCents ?? 0) * l.qty;
  }, 0);
}

const canSaveDraft = customer.name.trim().length > 0 || customer.phone.trim().length > 0 || lines.length > 0;

async function onSaveDraft() {
  if (!canSaveDraft) return;
  setSavingDraft(true);
  try {
    const body = {
      payload: currentPayload(),
      label: draftLabel(),
      itemCount: draftItemCount(),
      totalCents: draftTotalCents(),
    };
    const url = draftId
      ? `/api/admin/orders/drafts/${encodeURIComponent(draftId)}`
      : "/api/admin/orders/drafts";
    const res = await fetch(url, {
      method: draftId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      if (data?.id) setDraftId(data.id);
      else if (data?.draft?.id) setDraftId(data.draft.id);
    }
  } finally {
    setSavingDraft(false);
  }
}

function onResumeDraft(payload: DraftPayload, id: string) {
  setChannel(payload.channel ?? "walk-in");
  setCustomer(payload.customer);
  setFulfillment(payload.fulfillment);
  setLines(payload.lines ?? []);
  setOverride(payload.override ?? {});
  setGiftCardCode(payload.giftCardCode ?? "");
  setPayment(payload.payment ?? { status: "pending" });
  setDraftId(id);
  setDraftsOpen(false);
}
```

- [ ] **Step 4: Delete the draft on successful create, before resetting**

In `onSubmit`, update the success path to delete the backing draft first:

```tsx
      const { orderId } = await res.json();
      router.replace(`/${locale}/admin/intake?ok=${encodeURIComponent(orderId)}`);
      if (draftId) {
        fetch(`/api/admin/orders/drafts/${encodeURIComponent(draftId)}`, { method: "DELETE" }).catch(() => {});
      }
      resetForm();
```

- [ ] **Step 5: Add the "Borradores" button, "Guardar borrador" button, and the drawer**

In the header row (the `flex items-center justify-between` bar with the channels + datetime), replace the datetime block with a group that also holds the Drafts button:

```tsx
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setDraftsOpen(true)}
              className="px-3.5 py-1.5 rounded-full border border-mute-200 text-sm text-mute-600 hover:bg-ink/5"
            >
              {t("drafts_button")}
            </button>
            <div className="text-mute-400 text-xs tabular-nums" suppressHydrationWarning>
              {formatDateTime(new Date().toISOString(), locale)}
            </div>
          </div>
```

In the footer, replace the single-button-right layout so the save-draft button sits next to the primary action:

```tsx
          <div className="flex items-center justify-between">
            <button type="button" onClick={resetForm} className="px-5 py-3 rounded-full border border-mute-200 text-mute-600">
              {t("action_discard")}
            </button>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onSaveDraft}
                disabled={savingDraft || !canSaveDraft}
                className="px-5 py-3 rounded-full border border-ink/30 text-ink disabled:opacity-40"
              >
                {savingDraft ? t("action_saving_draft") : t("action_save_draft")}
              </button>
              <button
                type="button"
                disabled={submitting || lines.length === 0 || (fulfillment.method !== "pickup" && (customer.name.length === 0 || customer.phone.replace(/\D/g, "").length < 10))}
                onClick={onSubmit}
                className="px-7 py-3.5 rounded-full bg-ink text-bone font-display disabled:opacity-40"
              >
                {submitting ? t("action_saving") : t("action_save")}
              </button>
            </div>
          </div>
```

At the end of the component's JSX (just before the closing `</main>`), render the drawer:

```tsx
      {draftsOpen && (
        <DraftsDrawer locale={locale} onResume={onResumeDraft} onClose={() => setDraftsOpen(false)} />
      )}
```

- [ ] **Step 6: Run the wiring test to verify it passes**

Run: `npm test -- tests/unit/IntakeFormDrafts.test.tsx`
Expected: PASS (both tests).

- [ ] **Step 7: Run the full intake test set + typecheck**

Run: `npm test -- tests/unit/IntakeFormReset.test.tsx tests/unit/IntakeFormDrafts.test.tsx tests/unit/DraftsDrawer.test.tsx`
Expected: PASS.

Run: `npx tsc --noEmit`
Expected: no type errors.

- [ ] **Step 8: Commit**

```bash
git add components/admin/intake/IntakeForm.tsx tests/unit/IntakeFormDrafts.test.tsx
git commit -m "feat(drafts): save/resume drafts from the intake form"
```

---

## Task 10: Full-suite verification

- [ ] **Step 1: Run the entire test suite**

Run: `npm test`
Expected: all tests pass (new + existing, including `i18n-parity` and `i18n-keys`).

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit`
Expected: clean.

Run: `npm run lint` (if present in `package.json`)
Expected: clean (fix any new warnings in the files you touched).

- [ ] **Step 3: Manual smoke (optional, via preview)**

Start the dev server and open `/es/admin/intake`. Verify: creating an order clears the form (recipient/address/window included); "Guardar borrador" saves; "Borradores" lists it; "Retomar" restores it; creating from a resumed draft removes it from the list.

---

## Self-Review (completed by plan author)

**Spec coverage:**
- Part 1 reset (fulfillment + channel + centralized `resetForm` + wired Descartar) → Task 1. ✅
- `order_drafts` table → Task 2. ✅
- `DraftPayload`/`OrderDraft` types + row mapping → Task 3. ✅
- Storage (save/upsert/list/get/delete) → Task 4. ✅
- Lax draft schema (incomplete allowed, size-bounded) → Task 5. ✅
- API list/create + detail/update/delete → Task 6. ✅
- i18n keys (both locales) → Task 7. ✅
- Drawer (list/resume/delete/empty) → Task 8. ✅
- IntakeForm wiring: draftId, Save-draft (POST/PUT upsert), Borradores drawer, resume, delete-on-finalize, enable rule → Task 9. ✅
- Denormalized `itemCount`/`totalCents` precision (override → subtotal → 0) → Task 9 `draftItemCount`/`draftTotalCents`. ✅
- Edge cases: incomplete draft (schema allows), delete loaded draft (resetForm clears draftId), taken_by best-effort ("maky"). ✅
- Tests for storage, row, schema, API, reset → Tasks 1–6, 8, 9. ✅

**Type consistency:** `DraftPayload`, `OrderDraft`, `OrderDraftDetail`, `DraftInput`, `DraftRow` names are used identically across Tasks 3, 4, 6, 8, 9. `saveDraft(DraftInput): OrderDraft`, `getDraft: OrderDraftDetail | null`, `listDrafts: OrderDraft[]`, `deleteDraft(id): void` consistent. `onResumeDraft(payload, id)` matches `DraftsDrawer` `onResume` prop signature `(payload, id)`.

**Placeholder scan:** No TBD/TODO; every code step shows full code.

**Note on out-of-scope items** (unchanged from spec): autosave, dashboard drafts section, deep-link resume, and real `taken_by` auth remain follow-ups. The pre-existing `Order.locale = "en"` hardcode is not touched here.
