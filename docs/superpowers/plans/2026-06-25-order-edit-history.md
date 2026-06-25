# Order editing + change history + sheet preview + reprint — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let admin staff edit orders after creation (with an immutable change-history audit log and a paid-order balance), preview the exact work-sheet that prints, and re-print any past order — all inside the existing order detail drawer.

**Architecture:** Server-authoritative edits via a new `editOrder` that recomputes totals and writes a field-level diff to a new `order_changes` table. Existing mutations are retrofitted to log to the same table for a unified timeline. A `amount_paid_cents` column lets a paid order surface a balance (saldo pendiente / a favor). Preview and reprint reuse the existing `buildSheetHtml` / `enqueuePrintJob` server functions — no print-agent change. The drawer's edit mode reuses the intake form's existing building blocks (`FulfillmentBlock`, `ProductPicker`, `CartSummary`).

**Tech Stack:** Next.js (App Router, customized — see `AGENTS.md`), `node:sqlite` (synchronous, via `lib/db.ts` + numbered SQL migrations in `db/migrations/`), zod, React client components, Vitest.

**Spec:** `docs/superpowers/specs/2026-06-25-order-edit-history-design.md`

**Conventions to follow (verified in code):**
- Migrations: numbered SQL file in `db/migrations/`; `runMigrations()` applies new files in sorted order inside a transaction. Latest is `009_gift_cards.sql` → ours is `010`.
- DB tests: `beforeEach(() => { vi.stubEnv("SQLITE_FILE", ":memory:"); runMigrations(); })` and `afterEach(() => { closeDb(); vi.unstubAllEnvs(); })`. Seed orders with a direct `INSERT INTO orders (...)`. Call route handlers directly: `await PATCH(new Request("http://x", {...}), { params: Promise.resolve({ id }) })`.
- Run a single test file: `npm test -- tests/unit/<file>`
- Run one test by name: `npm test -- tests/unit/<file> -t "<name>"`

**Baseline note:** 5 pre-existing test failures exist on this branch and are NOT caused by this work (3× `checkout-schema` use a hardcoded past date; 2× `print-chromium`/`_preview`/`print-render` need Chromium which can't launch in this sandbox). Ignore them. Do not "fix" them here.

---

## File Structure

**New files:**
- `db/migrations/010_order_history.sql` — `order_changes` table + `amount_paid_cents` column + backfill.
- `lib/order-history.ts` — `recordOrderChange`, `listOrderHistory`.
- `lib/order-balance.ts` — `orderBalanceCents`.
- `lib/order-edit.ts` — `editOrder`, `OrderEditPatch`, `diffOrders`.
- `app/api/admin/orders/[id]/reprint/route.ts` — re-enqueue a print job.
- `app/api/admin/orders/[id]/sheet/route.ts` — work-sheet HTML for preview.
- `components/admin/dashboard/OrderEditForm.tsx` — the inline edit form (composes intake blocks).
- `components/admin/dashboard/OrderHistoryList.tsx` — the history timeline.
- Test files (one per lib/route/component below).

**Modified files:**
- `types/order.ts` — add `amountPaidCents?`, `OrderChangeKind`, `FieldDiff`, `OrderChange`.
- `lib/order-row.ts` — map `amount_paid_cents` ↔ `amountPaidCents`.
- `lib/totals.ts` — add `resolveOrderTotals` shared helper.
- `lib/order-storage.ts` — `amount_paid_cents` in upsert SQL; new `updateOrder`; set `amount_paid_cents` on the two Stripe paid paths.
- `lib/order-mutations.ts` — set `amount_paid_cents` on `markPaidManual`; log history in all four mutations; add `settleBalance`.
- `lib/admin-auth.ts` — add `requireAdmin(req)`.
- `app/api/admin/orders/route.ts` (intake POST) — set `amountPaidCents` when paid; log `created`; use `resolveOrderTotals`.
- `app/api/admin/orders/[id]/route.ts` — add `PATCH`; extend `GET` with `history` + `balanceCents`.
- `app/api/admin/orders/[id]/payment/route.ts` — accept `{ settleBalance: true }`.
- `components/admin/dashboard/OrderDetailDrawer.tsx` — edit mode, balance banner, history, preview/reprint/edit buttons.

> **Spec correction:** the spec listed extracting `ProductPicker` — it already exists at `components/admin/intake/ProductPicker.tsx`. No extraction needed.

---

## Task 1: Data layer — migration 010, `amountPaidCents` plumbing, history types

**Files:**
- Create: `db/migrations/010_order_history.sql`
- Modify: `types/order.ts`, `lib/order-row.ts`, `lib/order-storage.ts`
- Test: `tests/unit/order-history-schema.test.ts`

- [ ] **Step 1: Write the migration**

Create `db/migrations/010_order_history.sql`:

```sql
-- Immutable audit log of every change an order goes through.
CREATE TABLE IF NOT EXISTS order_changes (
  id           TEXT PRIMARY KEY,
  order_id     TEXT NOT NULL,
  at           TEXT NOT NULL,            -- ISO timestamp
  actor        TEXT NOT NULL,            -- admin session user; "maky" for now
  kind         TEXT NOT NULL,            -- created | edit | payment | fulfillment | cancel | note | reprint
  summary      TEXT NOT NULL,            -- human-readable one-liner (Spanish)
  changes_json TEXT                      -- JSON array of field diffs for kind='edit'; NULL otherwise
);
CREATE INDEX IF NOT EXISTS idx_order_changes_order ON order_changes(order_id, at);

-- How much has actually been collected, for balance (saldo) computation.
ALTER TABLE orders ADD COLUMN amount_paid_cents INTEGER NOT NULL DEFAULT 0;

-- Backfill: existing fully-paid orders are considered paid in full.
UPDATE orders SET amount_paid_cents = total_cents WHERE payment_status = 'paid';
```

- [ ] **Step 2: Add types to `types/order.ts`**

Add `amountPaidCents?: number;` to the `Order` type (place it right after `paidAt?: string;`). Append these new types at the end of the file:

```ts
export type OrderChangeKind =
  | "created" | "edit" | "payment" | "fulfillment" | "cancel" | "note" | "reprint";

export type FieldDiff = {
  field: string; // machine key, e.g. "fulfillment.address.street1"
  label: string; // Spanish UI label, e.g. "Dirección"
  before: string | null;
  after: string | null;
};

export type OrderChange = {
  id: string;
  orderId: string;
  at: string; // ISO
  actor: string;
  kind: OrderChangeKind;
  summary: string;
  changes?: FieldDiff[]; // present for kind="edit"
};
```

- [ ] **Step 3: Map the column in `lib/order-row.ts`**

In `OrderRow`, add after `updated_at: string;` line… actually add alongside the other numeric columns, right after `total_cents: number;`:

```ts
  amount_paid_cents: number;
```

In `orderToRow`, add right after `total_cents: o.totals.totalCents,`:

```ts
    amount_paid_cents: o.amountPaidCents ?? 0,
```

In `rowToOrder`, add right after `paidAt: r.paid_at ?? undefined,`:

```ts
    amountPaidCents: r.amount_paid_cents ?? 0,
```

- [ ] **Step 4: Persist the column in `lib/order-storage.ts` `upsertSqlite`**

In the `INSERT INTO orders (...)` column list, add `amount_paid_cents` right after `total_cents,`. In the `VALUES (...)` list add `@amount_paid_cents` right after `@total_cents,`. In the `ON CONFLICT(id) DO UPDATE SET` list add this line right after `total_cents=excluded.total_cents,`:

```sql
       amount_paid_cents=excluded.amount_paid_cents,
```

- [ ] **Step 5: Write the failing test**

Create `tests/unit/order-history-schema.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { orderToRow, rowToOrder, type OrderRow } from "@/lib/order-row";
import { saveOrder, getOrder } from "@/lib/order-storage";
import type { Order } from "@/types/order";

beforeEach(() => { vi.stubEnv("SQLITE_FILE", ":memory:"); runMigrations(); });
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

function baseOrder(id: string): Order {
  return {
    id, source: "walk-in", locale: "es",
    lines: [], fulfillment: { method: "in-store", recipient: { name: "R", phone: "555" } },
    contact: { phone: "555" },
    totals: { subtotalCents: 5000, deliveryCents: 0, taxCents: 0, totalCents: 5000 },
    status: "pending", paymentStatus: "pending",
    createdAt: "2026-06-01T00:00:00Z", updatedAt: "2026-06-01T00:00:00Z",
  };
}

describe("migration 010", () => {
  it("creates the order_changes table", () => {
    const row = getDb()
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='order_changes'")
      .get();
    expect(row).toBeTruthy();
  });

  it("round-trips amountPaidCents through orderToRow/rowToOrder", () => {
    const o = { ...baseOrder("rt1"), amountPaidCents: 1234 };
    const back = rowToOrder(orderToRow(o) as OrderRow);
    expect(back.amountPaidCents).toBe(1234);
  });

  it("defaults amountPaidCents to 0 when unset", () => {
    const back = rowToOrder(orderToRow(baseOrder("rt2")) as OrderRow);
    expect(back.amountPaidCents).toBe(0);
  });

  it("persists amount_paid_cents via saveOrder", async () => {
    await saveOrder({ ...baseOrder("sv1"), amountPaidCents: 777 });
    const got = await getOrder("sv1");
    expect(got?.amountPaidCents).toBe(777);
  });
});
```

- [ ] **Step 6: Run the test — expect PASS**

Run: `npm test -- tests/unit/order-history-schema.test.ts`
Expected: 4 passing.

- [ ] **Step 7: Commit**

```bash
git add db/migrations/010_order_history.sql types/order.ts lib/order-row.ts lib/order-storage.ts tests/unit/order-history-schema.test.ts
git commit -m "feat(orders): migration 010 — order_changes table + amount_paid_cents"
```

---

## Task 2: `lib/order-history.ts` — record + list change entries

**Files:**
- Create: `lib/order-history.ts`
- Test: `tests/unit/order-history.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/order-history.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { recordOrderChange, listOrderHistory } from "@/lib/order-history";

beforeEach(() => { vi.stubEnv("SQLITE_FILE", ":memory:"); runMigrations(); });
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

describe("order-history", () => {
  it("records and lists a change", async () => {
    await recordOrderChange({ orderId: "o1", actor: "maky", kind: "note", summary: "Nota agregada" });
    const list = await listOrderHistory("o1");
    expect(list).toHaveLength(1);
    expect(list[0].kind).toBe("note");
    expect(list[0].summary).toBe("Nota agregada");
    expect(list[0].id).toBeTruthy();
    expect(list[0].at).toBeTruthy();
  });

  it("round-trips a field diff via changes_json", async () => {
    await recordOrderChange({
      orderId: "o2", actor: "maky", kind: "edit", summary: "Editó: Total",
      changes: [{ field: "totals.totalCents", label: "Total", before: "$50.00", after: "$60.00" }],
    });
    const list = await listOrderHistory("o2");
    expect(list[0].changes?.[0].label).toBe("Total");
    expect(list[0].changes?.[0].after).toBe("$60.00");
  });

  it("lists in chronological (ascending) order, scoped to the order", async () => {
    await recordOrderChange({ orderId: "o3", actor: "maky", kind: "created", summary: "a" });
    await recordOrderChange({ orderId: "o3", actor: "maky", kind: "payment", summary: "b" });
    await recordOrderChange({ orderId: "other", actor: "maky", kind: "created", summary: "x" });
    const list = await listOrderHistory("o3");
    expect(list.map((c) => c.summary)).toEqual(["a", "b"]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/unit/order-history.test.ts`
Expected: FAIL — cannot find module `@/lib/order-history`.

- [ ] **Step 3: Implement `lib/order-history.ts`**

```ts
import "server-only";
import crypto from "node:crypto";
import { getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import type { FieldDiff, OrderChange, OrderChangeKind } from "@/types/order";

type ChangeRow = {
  id: string; order_id: string; at: string; actor: string;
  kind: string; summary: string; changes_json: string | null;
};

export async function recordOrderChange(input: {
  orderId: string;
  actor: string;
  kind: OrderChangeKind;
  summary: string;
  changes?: FieldDiff[];
}): Promise<OrderChange> {
  runMigrations();
  const entry: OrderChange = {
    id: crypto.randomUUID(),
    orderId: input.orderId,
    at: new Date().toISOString(),
    actor: input.actor,
    kind: input.kind,
    summary: input.summary,
    ...(input.changes ? { changes: input.changes } : {}),
  };
  getDb().prepare(
    `INSERT INTO order_changes (id, order_id, at, actor, kind, summary, changes_json)
     VALUES (@id, @order_id, @at, @actor, @kind, @summary, @changes_json)`,
  ).run({
    id: entry.id, order_id: entry.orderId, at: entry.at, actor: entry.actor,
    kind: entry.kind, summary: entry.summary,
    changes_json: input.changes ? JSON.stringify(input.changes) : null,
  });
  return entry;
}

export async function listOrderHistory(orderId: string): Promise<OrderChange[]> {
  runMigrations();
  const rows = getDb()
    .prepare("SELECT * FROM order_changes WHERE order_id = ? ORDER BY at ASC, id ASC")
    .all(orderId) as ChangeRow[];
  return rows.map((r) => ({
    id: r.id, orderId: r.order_id, at: r.at, actor: r.actor,
    kind: r.kind as OrderChangeKind, summary: r.summary,
    ...(r.changes_json ? { changes: JSON.parse(r.changes_json) as FieldDiff[] } : {}),
  }));
}
```

- [ ] **Step 4: Run the test — expect PASS**

Run: `npm test -- tests/unit/order-history.test.ts`
Expected: 3 passing.

- [ ] **Step 5: Commit**

```bash
git add lib/order-history.ts tests/unit/order-history.test.ts
git commit -m "feat(orders): order_changes record + list helpers"
```

---

## Task 3: `lib/order-balance.ts` — derived balance

**Files:**
- Create: `lib/order-balance.ts`
- Test: `tests/unit/order-balance.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/order-balance.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { orderBalanceCents } from "@/lib/order-balance";
import type { Order } from "@/types/order";

function order(totalCents: number, amountPaidCents: number | undefined): Order {
  return {
    id: "x", source: "walk-in", locale: "es", lines: [],
    fulfillment: { method: "in-store", recipient: { name: "R", phone: "5" } },
    contact: { phone: "5" },
    totals: { subtotalCents: totalCents, deliveryCents: 0, taxCents: 0, totalCents },
    status: "pending", paymentStatus: "pending",
    amountPaidCents,
    createdAt: "", updatedAt: "",
  };
}

describe("orderBalanceCents", () => {
  it("is positive when the total exceeds what was paid (saldo pendiente)", () => {
    expect(orderBalanceCents(order(6000, 5000))).toBe(1000);
  });
  it("is negative when more was paid than the total (saldo a favor)", () => {
    expect(orderBalanceCents(order(4000, 5000))).toBe(-1000);
  });
  it("is zero when settled", () => {
    expect(orderBalanceCents(order(5000, 5000))).toBe(0);
  });
  it("treats a missing amountPaidCents as 0", () => {
    expect(orderBalanceCents(order(5000, undefined))).toBe(5000);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/unit/order-balance.test.ts`
Expected: FAIL — cannot find module `@/lib/order-balance`.

- [ ] **Step 3: Implement `lib/order-balance.ts`**

```ts
import type { Order } from "@/types/order";

/** Positive = customer owes (saldo pendiente); negative = we owe (saldo a favor). */
export function orderBalanceCents(order: Order): number {
  return order.totals.totalCents - (order.amountPaidCents ?? 0);
}
```

- [ ] **Step 4: Run the test — expect PASS**

Run: `npm test -- tests/unit/order-balance.test.ts`
Expected: 4 passing.

- [ ] **Step 5: Commit**

```bash
git add lib/order-balance.ts tests/unit/order-balance.test.ts
git commit -m "feat(orders): derived order balance helper"
```

---

## Task 4: Shared totals helper + `updateOrder` storage helper

**Files:**
- Modify: `lib/totals.ts`, `lib/order-storage.ts`, `app/api/admin/orders/route.ts`
- Test: `tests/unit/order-totals-resolve.test.ts`, `tests/unit/order-update.test.ts`

- [ ] **Step 1: Write the failing test for `resolveOrderTotals`**

Create `tests/unit/order-totals-resolve.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { resolveOrderTotals } from "@/lib/totals";
import type { CartLine } from "@/types/order";

const customLine = (priceCents: number, qty: number): CartLine => ({
  kind: "custom", title: "Custom", priceCents, qty,
});

describe("resolveOrderTotals", () => {
  it("computes subtotal from lines and tax on top (in-store, no delivery)", () => {
    const t = resolveOrderTotals({ lines: [customLine(5000, 2)], fulfillmentMethod: "in-store" });
    expect(t.subtotalCents).toBe(10000);
    expect(t.deliveryCents).toBe(0);
    expect(t.totalCents).toBe(t.subtotalCents + t.taxCents);
  });

  it("prices delivery from the address ZIP", () => {
    const t = resolveOrderTotals({
      lines: [customLine(5000, 1)],
      fulfillmentMethod: "delivery",
      address: { zip: "11507", city: "Albertson" },
    });
    expect(t.deliveryCents).toBeGreaterThan(0);
  });

  it("applies an override over the computed values", () => {
    const t = resolveOrderTotals({
      lines: [customLine(5000, 1)],
      fulfillmentMethod: "in-store",
      override: { totalCents: 9999 },
    });
    expect(t.totalCents).toBe(9999);
  });
});
```

- [ ] **Step 2: Run it — expect FAIL** (`resolveOrderTotals` not exported)

Run: `npm test -- tests/unit/order-totals-resolve.test.ts`

- [ ] **Step 3: Add `resolveOrderTotals` to `lib/totals.ts`**

Append to `lib/totals.ts`:

```ts
import { cartSubtotalCents } from "@/lib/cart-helpers";
import { PRODUCTS } from "@/data/products";
import type { CartLine, OrderTotals } from "@/types/order";

/**
 * Single source of truth for turning lines + fulfillment into totals, with an
 * optional manual override. Used by intake order creation and by editOrder so
 * both price identically.
 */
export function resolveOrderTotals(input: {
  lines: CartLine[];
  fulfillmentMethod: "in-store" | "delivery" | "pickup";
  address?: { zip: string; city: string };
  override?: Partial<OrderTotals>;
}): OrderTotals {
  const subtotal = cartSubtotalCents(input.lines, PRODUCTS);
  let delivery = 0;
  if (input.fulfillmentMethod === "delivery" && input.address) {
    delivery = computeDeliveryCentsForAddress(input.address) ?? 0;
  }
  const computed = computeOrderTotals(subtotal, delivery);
  const o = input.override ?? {};
  return {
    subtotalCents: o.subtotalCents ?? computed.subtotalCents,
    deliveryCents: o.deliveryCents ?? computed.deliveryCents,
    taxCents: o.taxCents ?? computed.taxCents,
    totalCents: o.totalCents ?? computed.totalCents,
  };
}
```

> Note: `lib/totals.ts` already imports `OrderTotals` and the delivery-zone helpers. Add only the imports it does not already have (`cartSubtotalCents`, `PRODUCTS`, `CartLine`). Keep the existing imports.

- [ ] **Step 4: Run it — expect PASS**

Run: `npm test -- tests/unit/order-totals-resolve.test.ts`

- [ ] **Step 5: Refactor the intake POST to use it (DRY, behavior identical)**

In `app/api/admin/orders/route.ts`, replace the local `computeTotals(input)` function body with a call to the shared helper, and import it. Replace the function:

```ts
function computeTotals(input: IntakeInput): Order["totals"] {
  return resolveOrderTotals({
    lines: input.lines as CartLine[],
    fulfillmentMethod: input.fulfillment.method,
    address: input.fulfillment.method === "delivery" ? input.fulfillment.address : undefined,
    override: input.totalsOverride,
  });
}
```

Update the import line `import { computeOrderTotals, computeDeliveryCentsForAddress } from "@/lib/totals";` to `import { resolveOrderTotals } from "@/lib/totals";` (the other two are no longer used directly here — verify with the linter). Leave `cartSubtotalCents`/`PRODUCTS` imports only if still referenced elsewhere in the file; if not, remove them.

- [ ] **Step 6: Verify the intake path still works**

Run: `npm test -- tests/unit/api-admin-orders.test.ts`
Expected: still passing (no behavior change).

- [ ] **Step 7: Write the failing test for `updateOrder`**

Create `tests/unit/order-update.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { saveOrder, getOrder, updateOrder } from "@/lib/order-storage";
import type { Order } from "@/types/order";

beforeEach(() => { vi.stubEnv("SQLITE_FILE", ":memory:"); vi.stubEnv("ORDER_STORAGE_FILE", `/tmp/orders-${Math.random().toString(36).slice(2)}.json`); runMigrations(); });
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

function baseOrder(id: string): Order {
  return {
    id, source: "walk-in", locale: "es", lines: [],
    fulfillment: { method: "in-store", recipient: { name: "R", phone: "555" } },
    contact: { phone: "555" },
    totals: { subtotalCents: 5000, deliveryCents: 0, taxCents: 0, totalCents: 5000 },
    status: "pending", paymentStatus: "pending",
    createdAt: "2026-06-01T00:00:00Z", updatedAt: "2026-06-01T00:00:00Z",
  };
}

describe("updateOrder", () => {
  it("updates fields in place without creating a duplicate", async () => {
    await saveOrder(baseOrder("u1"));
    await updateOrder({ ...baseOrder("u1"), contact: { phone: "999" } });
    const got = await getOrder("u1");
    expect(got?.contact.phone).toBe("999");
  });
});
```

- [ ] **Step 8: Run it — expect FAIL** (`updateOrder` not exported)

Run: `npm test -- tests/unit/order-update.test.ts`

- [ ] **Step 9: Implement `updateOrder` in `lib/order-storage.ts`**

Add this exported function (mirrors `updateOrderPaymentIntent`'s mirror-replace pattern, but writes the whole order). Place it right after `saveOrder`:

```ts
// Full update of an existing order: upsert the SQLite row and REPLACE the JSON
// mirror entry (never append — that is saveOrder's create-only behavior).
export async function updateOrder(order: Order): Promise<void> {
  ensureSchema();
  upsertSqlite(order);
  const all = await readAll();
  const idx = all.findIndex((o) => o.id === order.id);
  if (idx >= 0) all[idx] = order;
  else all.push(order);
  await writeAll(all);
}
```

- [ ] **Step 10: Run it — expect PASS**

Run: `npm test -- tests/unit/order-update.test.ts`

- [ ] **Step 11: Commit**

```bash
git add lib/totals.ts lib/order-storage.ts app/api/admin/orders/route.ts tests/unit/order-totals-resolve.test.ts tests/unit/order-update.test.ts
git commit -m "feat(orders): shared resolveOrderTotals + updateOrder (mirror-replace)"
```

---

## Task 5: `lib/order-edit.ts` — editOrder + diff

**Files:**
- Create: `lib/order-edit.ts`
- Test: `tests/unit/order-edit.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/order-edit.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { saveOrder } from "@/lib/order-storage";
import { listOrderHistory } from "@/lib/order-history";
import { editOrder } from "@/lib/order-edit";
import type { Order } from "@/types/order";

beforeEach(() => { vi.stubEnv("SQLITE_FILE", ":memory:"); vi.stubEnv("ORDER_STORAGE_FILE", `/tmp/orders-${Math.random().toString(36).slice(2)}.json`); runMigrations(); });
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

function baseOrder(id: string, over: Partial<Order> = {}): Order {
  return {
    id, source: "walk-in", locale: "es",
    lines: [{ kind: "custom", title: "Ramo", priceCents: 5000, qty: 1 }],
    fulfillment: { method: "delivery", recipient: { name: "Ana", phone: "555" },
      address: { street1: "1 Main", city: "Albertson", state: "NY", zip: "11507", country: "US" },
      window: { date: "2026-07-01", slot: "midday" } },
    contact: { phone: "555" },
    totals: { subtotalCents: 5000, deliveryCents: 1000, taxCents: 518, totalCents: 6518 },
    status: "pending", paymentStatus: "pending",
    createdAt: "2026-06-01T00:00:00Z", updatedAt: "2026-06-01T00:00:00Z",
    ...over,
  };
}

describe("editOrder", () => {
  it("updates a contact field and records a diff in history", async () => {
    await saveOrder(baseOrder("e1"));
    const { order, change } = await editOrder("e1", { contact: { phone: "999" } }, "maky");
    expect(order.contact.phone).toBe("999");
    expect(change).not.toBeNull();
    const hist = await listOrderHistory("e1");
    expect(hist).toHaveLength(1);
    expect(hist[0].kind).toBe("edit");
    const diff = hist[0].changes?.find((c) => c.field === "contact.phone");
    expect(diff?.before).toBe("555");
    expect(diff?.after).toBe("999");
  });

  it("recomputes totals when lines change", async () => {
    await saveOrder(baseOrder("e2"));
    const { order } = await editOrder("e2", {
      lines: [{ kind: "custom", title: "Ramo", priceCents: 5000, qty: 2 }],
    }, "maky");
    expect(order.totals.subtotalCents).toBe(10000);
    expect(order.totals.totalCents).toBeGreaterThan(10000); // + delivery + tax
  });

  it("is a no-op when nothing changes (no history row)", async () => {
    await saveOrder(baseOrder("e3"));
    const { change } = await editOrder("e3", { contact: { phone: "555" } }, "maky");
    expect(change).toBeNull();
    expect(await listOrderHistory("e3")).toHaveLength(0);
  });

  it("rejects an edit that leaves zero lines", async () => {
    await saveOrder(baseOrder("e4"));
    await expect(editOrder("e4", { lines: [] }, "maky")).rejects.toThrow(/at least one item/);
  });

  it("throws on unknown order", async () => {
    await expect(editOrder("nope", { contact: { phone: "1" } }, "maky")).rejects.toThrow(/order not found/);
  });
});
```

- [ ] **Step 2: Run it — expect FAIL** (`@/lib/order-edit` missing)

Run: `npm test -- tests/unit/order-edit.test.ts`

- [ ] **Step 3: Implement `lib/order-edit.ts`**

```ts
import "server-only";
import { getOrder, updateOrder } from "@/lib/order-storage";
import { recordOrderChange } from "@/lib/order-history";
import { resolveOrderTotals } from "@/lib/totals";
import { PRODUCTS } from "@/data/products";
import type {
  Order, OrderFulfillment, CartLine, FieldDiff, OrderTotals,
  Recipient, DeliveryWindow,
} from "@/types/order";
import type { Address } from "@/types/address";

export type OrderEditPatch = {
  contact?: { name?: string; email?: string; phone?: string };
  recipient?: Partial<Recipient>;
  fulfillmentMethod?: "in-store" | "delivery" | "pickup";
  address?: Address;
  window?: DeliveryWindow;
  cardMessage?: string;
  lines?: CartLine[];
  totalsOverride?: Partial<OrderTotals>;
};

function money(c: number): string { return `$${(c / 100).toFixed(2)}`; }

function linesSummary(lines: CartLine[]): string {
  if (lines.length === 0) return "(vacío)";
  return lines.map((l) => {
    if (l.kind === "custom") return `${l.qty}× ${l.title}`;
    const p = PRODUCTS.find((x) => x.id === l.productId);
    return `${l.qty}× ${p ? p.title.es : l.productId}`;
  }).join(", ");
}

// Apply the patch onto a copy of the order, recomputing fulfillment + totals.
function applyPatch(cur: Order, patch: OrderEditPatch): Order {
  const method = patch.fulfillmentMethod ?? cur.fulfillment.method;
  const curF = cur.fulfillment;
  const recipient: Recipient = { ...curF.recipient, ...patch.recipient };
  const cardMessage = patch.cardMessage ?? curF.cardMessage;
  const address: Address | undefined =
    patch.address ?? (curF.method === "delivery" ? curF.address : undefined);
  const window: DeliveryWindow | undefined =
    patch.window ?? (curF.method !== "in-store" ? curF.window : undefined);

  let fulfillment: OrderFulfillment;
  if (method === "in-store") {
    fulfillment = { method: "in-store", recipient, ...(cardMessage ? { cardMessage } : {}) };
  } else if (method === "pickup") {
    if (!window) throw new Error("window required for pickup");
    fulfillment = { method: "pickup", recipient, window, ...(cardMessage ? { cardMessage } : {}) };
  } else {
    if (!address) throw new Error("address required for delivery");
    if (!window) throw new Error("window required for delivery");
    fulfillment = { method: "delivery", recipient, address, window, ...(cardMessage ? { cardMessage } : {}) };
  }

  const lines = patch.lines ?? cur.lines;
  if (lines.length === 0) throw new Error("order must have at least one item");

  const totals = resolveOrderTotals({
    lines,
    fulfillmentMethod: method,
    address: method === "delivery" ? { zip: (address as Address).zip, city: (address as Address).city } : undefined,
    override: patch.totalsOverride,
  });

  return {
    ...cur,
    contact: { ...cur.contact, ...patch.contact },
    fulfillment,
    lines,
    totals,
  };
}

export function diffOrders(before: Order, after: Order): FieldDiff[] {
  const diffs: FieldDiff[] = [];
  const push = (field: string, label: string, b: string | null, a: string | null) => {
    if (b !== a) diffs.push({ field, label, before: b, after: a });
  };
  push("contact.name", "Nombre comprador", before.contact.name ?? null, after.contact.name ?? null);
  push("contact.phone", "Teléfono comprador", before.contact.phone, after.contact.phone);
  push("contact.email", "Email comprador", before.contact.email ?? null, after.contact.email ?? null);
  push("recipient.name", "Destinatario", before.fulfillment.recipient.name, after.fulfillment.recipient.name);
  push("recipient.phone", "Tel. destinatario", before.fulfillment.recipient.phone, after.fulfillment.recipient.phone);
  push("fulfillment.method", "Método", before.fulfillment.method, after.fulfillment.method);

  const bAddr = before.fulfillment.method === "delivery" ? before.fulfillment.address : null;
  const aAddr = after.fulfillment.method === "delivery" ? after.fulfillment.address : null;
  const fmtAddr = (x: Address | null) => x ? `${x.street1}, ${x.city}, ${x.state} ${x.zip}` : null;
  push("fulfillment.address", "Dirección", fmtAddr(bAddr), fmtAddr(aAddr));

  const bWin = before.fulfillment.method !== "in-store" ? before.fulfillment.window : null;
  const aWin = after.fulfillment.method !== "in-store" ? after.fulfillment.window : null;
  const fmtWin = (w: DeliveryWindow | null) => w ? `${w.date} · ${w.slot}` : null;
  push("fulfillment.window", "Entrega", fmtWin(bWin), fmtWin(aWin));

  push("cardMessage", "Mensaje de tarjeta", before.fulfillment.cardMessage ?? null, after.fulfillment.cardMessage ?? null);

  if (JSON.stringify(before.lines) !== JSON.stringify(after.lines)) {
    diffs.push({ field: "lines", label: "Artículos", before: linesSummary(before.lines), after: linesSummary(after.lines) });
  }
  push("totals.totalCents", "Total", money(before.totals.totalCents), money(after.totals.totalCents));
  return diffs;
}

export async function editOrder(
  orderId: string,
  patch: OrderEditPatch,
  actor: string,
): Promise<{ order: Order; change: import("@/types/order").OrderChange | null }> {
  const cur = await getOrder(orderId);
  if (!cur) throw new Error(`order not found: ${orderId}`);
  const next = applyPatch(cur, patch);
  const changes = diffOrders(cur, next);
  if (changes.length === 0) return { order: cur, change: null };

  next.updatedAt = new Date().toISOString();
  await updateOrder(next);

  const labels = changes.map((c) => c.label).join(", ");
  const change = await recordOrderChange({
    orderId, actor, kind: "edit", summary: `Editó: ${labels}`, changes,
  });
  return { order: next, change };
}
```

- [ ] **Step 4: Run it — expect PASS**

Run: `npm test -- tests/unit/order-edit.test.ts`
Expected: 5 passing.

- [ ] **Step 5: Commit**

```bash
git add lib/order-edit.ts tests/unit/order-edit.test.ts
git commit -m "feat(orders): editOrder with field-level diff + totals recompute"
```

---

## Task 6: Retrofit mutations + paid write-sites (history + amount_paid) + settleBalance

**Files:**
- Modify: `lib/order-mutations.ts`, `lib/order-storage.ts`, `app/api/admin/orders/route.ts`
- Test: `tests/unit/order-mutations-history.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/order-mutations-history.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { markPaidManual, changeFulfillmentStatus, cancelOrder, appendInternalNote, settleBalance } from "@/lib/order-mutations";
import { listOrderHistory } from "@/lib/order-history";

beforeEach(() => { vi.stubEnv("SQLITE_FILE", ":memory:"); runMigrations(); });
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

function seed(id: string, opts: { total?: number; payment?: string } = {}) {
  getDb().prepare(
    `INSERT INTO orders (id, locale, source, recipient_name, recipient_phone, contact_phone,
       fulfillment_method, window_date, lines_json, subtotal_cents, delivery_cents, tax_cents,
       total_cents, fulfillment_status, payment_status, created_at, updated_at)
     VALUES (?, 'es', 'walk-in', 'R', '555', '555', 'delivery', '2026-07-01', '[]',
       ?,0,0,?, 'pending', ?, '2026-06-01T08:00:00Z', '2026-06-01T08:00:00Z')`,
  ).run(id, opts.total ?? 5000, opts.total ?? 5000, opts.payment ?? "pending");
}

describe("mutations write history", () => {
  it("markPaidManual logs payment and sets amount_paid_cents = total", async () => {
    seed("m1", { total: 5000 });
    await markPaidManual("m1", { method: "cash" });
    const hist = await listOrderHistory("m1");
    expect(hist.some((c) => c.kind === "payment")).toBe(true);
    const row = getDb().prepare("SELECT amount_paid_cents FROM orders WHERE id='m1'").get() as { amount_paid_cents: number };
    expect(row.amount_paid_cents).toBe(5000);
  });

  it("changeFulfillmentStatus logs fulfillment", async () => {
    seed("m2");
    await changeFulfillmentStatus("m2", "preparing");
    expect((await listOrderHistory("m2")).some((c) => c.kind === "fulfillment")).toBe(true);
  });

  it("cancelOrder logs cancel", async () => {
    seed("m3");
    await cancelOrder("m3", { refund: false, reason: "duplicada" });
    expect((await listOrderHistory("m3")).some((c) => c.kind === "cancel")).toBe(true);
  });

  it("appendInternalNote logs note", async () => {
    seed("m4");
    await appendInternalNote("m4", "ring twice", "maky");
    expect((await listOrderHistory("m4")).some((c) => c.kind === "note")).toBe(true);
  });

  it("settleBalance sets amount_paid = total and logs payment", async () => {
    seed("m5", { total: 6000, payment: "paid" });
    getDb().prepare("UPDATE orders SET amount_paid_cents = 5000 WHERE id='m5'").run();
    const o = await settleBalance("m5", "maky");
    expect(o.amountPaidCents).toBe(6000);
    expect((await listOrderHistory("m5")).some((c) => c.kind === "payment")).toBe(true);
  });
});
```

- [ ] **Step 2: Run it — expect FAIL** (`settleBalance` missing; no history rows)

Run: `npm test -- tests/unit/order-mutations-history.test.ts`

- [ ] **Step 3: Update `lib/order-mutations.ts`**

3a. Extend the private `upsert(order)` SQL to also persist `amount_paid_cents`. Add `amount_paid_cents=@amount_paid_cents,` to the `UPDATE orders SET ...` and add `amount_paid_cents: row.amount_paid_cents,` to the `.run({...})` object.

3b. Add the history import at the top:

```ts
import { recordOrderChange } from "@/lib/order-history";
```

3c. In `markPaidManual`, set the paid amount and log. Change the `next` construction to include `amountPaidCents: cur.totals.totalCents,` and after `upsert(next);` add:

```ts
  await recordOrderChange({
    orderId, actor: "maky", kind: "payment",
    summary: `Pagado en ${args.method} · ${money(cur.totals.totalCents)}`,
  });
```

Add this `money` helper near the top of the file (after imports):

```ts
function money(c: number): string { return `$${(c / 100).toFixed(2)}`; }
```

3d. In `changeFulfillmentStatus`, after `upsert(next);` add:

```ts
  await recordOrderChange({
    orderId, actor: "maky", kind: "fulfillment",
    summary: `Estado: ${cur.status} → ${status}`,
  });
```

3e. In `cancelOrder`, after `upsert(next);` add:

```ts
  await recordOrderChange({
    orderId, actor: "maky", kind: "cancel",
    summary: `Cancelada${args.refund ? " + reembolso" : ""}${args.reason ? ` · ${args.reason}` : ""}`,
  });
```

3f. In `appendInternalNote`, after `upsert(next);` add:

```ts
  await recordOrderChange({ orderId, actor: author, kind: "note", summary: "Nota agregada" });
```

3g. Add the new `settleBalance` export at the end of the file:

```ts
// Records that the in-person difference was settled: sets amount_paid to the
// current total so the balance reads zero. Does NOT move money in Stripe.
export async function settleBalance(orderId: string, actor: string): Promise<Order> {
  runMigrations();
  const db = getDb();
  const row = db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId) as OrderRow | undefined;
  if (!row) throw new Error(`order not found: ${orderId}`);
  const cur = rowToOrder(row);
  const now = new Date().toISOString();
  const next: Order = { ...cur, amountPaidCents: cur.totals.totalCents, updatedAt: now };
  upsert(next);
  await recordOrderChange({
    orderId, actor, kind: "payment", summary: `Saldo saldado · ${money(cur.totals.totalCents)}`,
  });
  return next;
}
```

- [ ] **Step 4: Update the Stripe paid write-sites in `lib/order-storage.ts`**

In `updateOrderStatusByPaymentIntent`, the `status === "paid"` branch currently does `next = { ...next, paymentStatus: "paid", paidAt: now };`. Change it to also set the paid amount:

```ts
    next = { ...next, paymentStatus: "paid", paidAt: now, amountPaidCents: cur.totals.totalCents };
```

In `updateOrderPaidByCheckoutSession`, add `amount_paid_cents = total_cents` to the `UPDATE`:

```ts
  db.prepare(
    `UPDATE orders SET payment_status = 'paid', paid_at = COALESCE(paid_at, ?), amount_paid_cents = total_cents, updated_at = ? WHERE stripe_checkout_session_id = ? AND payment_status != 'paid'`,
  ).run(now, now, sessionId);
```

- [ ] **Step 5: Update the intake POST in `app/api/admin/orders/route.ts`**

5a. When the order is created already-paid, set the paid amount. After the `order` object is built and after the gift-card block sets `paymentStatus = "paid"`, set the amount right before `await saveOrder(order);`:

```ts
  if (order.paymentStatus === "paid") {
    order.amountPaidCents = order.totals.totalCents;
  }
```

5b. After `await saveOrder(order);` record the creation event:

```ts
  {
    const { recordOrderChange } = await import("@/lib/order-history");
    await recordOrderChange({
      orderId: order.id, actor: order.takenBy ?? "maky", kind: "created",
      summary: `Orden creada · ${order.source}`,
    });
  }
```

- [ ] **Step 6: Run the test — expect PASS**

Run: `npm test -- tests/unit/order-mutations-history.test.ts`
Expected: 5 passing.

- [ ] **Step 7: Verify existing mutation/intake tests still pass**

Run: `npm test -- tests/unit/order-mutations-notes.test.ts tests/unit/api-admin-orders.test.ts tests/unit/api-admin-orders-cancel.test.ts tests/unit/api-admin-orders-fulfillment.test.ts`
Expected: all passing.

- [ ] **Step 8: Commit**

```bash
git add lib/order-mutations.ts lib/order-storage.ts app/api/admin/orders/route.ts tests/unit/order-mutations-history.test.ts
git commit -m "feat(orders): unified history logging + amount_paid on paid + settleBalance"
```

---

## Task 7: API routes — requireAdmin, PATCH edit, GET extend, reprint, sheet, settleBalance

**Files:**
- Modify: `lib/admin-auth.ts`, `app/api/admin/orders/[id]/route.ts`, `app/api/admin/orders/[id]/payment/route.ts`
- Create: `app/api/admin/orders/[id]/reprint/route.ts`, `app/api/admin/orders/[id]/sheet/route.ts`
- Test: `tests/unit/api-admin-order-edit.test.ts`, `tests/unit/api-admin-order-reprint.test.ts`, `tests/unit/api-admin-order-sheet.test.ts`

- [ ] **Step 1: Add `requireAdmin` to `lib/admin-auth.ts`**

Append:

```ts
/** Reads the intake_session cookie from the raw request header (works in route
 * handlers AND in unit tests that call handlers directly). */
export function getSessionTokenFromRequest(req: Request): string {
  const cookie = req.headers.get("cookie") ?? "";
  const m = cookie.match(/(?:^|;\s*)intake_session=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : "";
}

export function requireAdmin(req: Request): boolean {
  return verifySession(getSessionTokenFromRequest(req));
}
```

- [ ] **Step 2: Write the failing test for PATCH edit + GET extension**

Create `tests/unit/api-admin-order-edit.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { signSession } from "@/lib/admin-auth";
import { PATCH, GET } from "@/app/api/admin/orders/[id]/route";

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("INTAKE_SESSION_SECRET", "test-secret-test-secret-test-secret");
  runMigrations();
});
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

function authedReq(body: unknown) {
  return new Request("http://x", {
    method: "PATCH",
    headers: { "content-type": "application/json", cookie: `intake_session=${signSession()}` },
    body: JSON.stringify(body),
  });
}

function seed(id: string) {
  getDb().prepare(
    `INSERT INTO orders (id, locale, source, recipient_name, recipient_phone, contact_phone,
       fulfillment_method, window_date, window_slot, lines_json, subtotal_cents, delivery_cents,
       tax_cents, total_cents, fulfillment_status, payment_status, created_at, updated_at)
     VALUES (?, 'es', 'walk-in', 'Ana', '555', '555', 'delivery', '2026-07-01', 'midday',
       '[{"kind":"custom","title":"Ramo","priceCents":5000,"qty":1}]', 5000,0,0,5000,
       'pending', 'pending', '2026-06-01T08:00:00Z', '2026-06-01T08:00:00Z')`,
  ).run(id);
}

describe("PATCH /api/admin/orders/[id]", () => {
  it("edits and returns the updated order", async () => {
    seed("p1");
    const res = await PATCH(authedReq({ contact: { phone: "999" } }), { params: Promise.resolve({ id: "p1" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.order.contact.phone).toBe("999");
    expect(body.change).not.toBeNull();
  });

  it("401 without a session cookie", async () => {
    seed("p2");
    const res = await PATCH(
      new Request("http://x", { method: "PATCH", headers: { "content-type": "application/json" }, body: "{}" }),
      { params: Promise.resolve({ id: "p2" }) },
    );
    expect(res.status).toBe(401);
  });

  it("400 on invalid body", async () => {
    seed("p3");
    const res = await PATCH(authedReq({ lines: "nope" }), { params: Promise.resolve({ id: "p3" }) });
    expect(res.status).toBe(400);
  });

  it("404 on unknown order", async () => {
    const res = await PATCH(authedReq({ contact: { phone: "1" } }), { params: Promise.resolve({ id: "nope" }) });
    expect(res.status).toBe(404);
  });

  it("GET returns history and balanceCents", async () => {
    seed("p4");
    await PATCH(authedReq({ contact: { phone: "777" } }), { params: Promise.resolve({ id: "p4" }) });
    const res = await GET(new Request("http://x"), { params: Promise.resolve({ id: "p4" }) });
    const body = await res.json();
    expect(Array.isArray(body.history)).toBe(true);
    expect(body.history.length).toBeGreaterThanOrEqual(1);
    expect(typeof body.balanceCents).toBe("number");
  });
});
```

- [ ] **Step 3: Run it — expect FAIL**

Run: `npm test -- tests/unit/api-admin-order-edit.test.ts`

- [ ] **Step 4: Rewrite `app/api/admin/orders/[id]/route.ts`**

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { getOrder } from "@/lib/order-storage";
import { getDb } from "@/lib/db";
import { recentMessagesForOrder } from "@/lib/message-storage";
import { listOrderHistory } from "@/lib/order-history";
import { orderBalanceCents } from "@/lib/order-balance";
import { editOrder, type OrderEditPatch } from "@/lib/order-edit";
import { requireAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await ctx.params;
  const order = await getOrder(id);
  if (!order) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const customer = order.customerId
    ? getDb().prepare("SELECT * FROM customers WHERE id = ?").get(order.customerId)
    : null;
  const messages = recentMessagesForOrder(id, 50);
  const history = await listOrderHistory(id);
  return NextResponse.json({ order, customer, messages, history, balanceCents: orderBalanceCents(order) });
}

const addressSchema = z.object({
  street1: z.string(), street2: z.string().optional(),
  city: z.string(), state: z.string(), zip: z.string(), country: z.literal("US"),
});
const recipientSchema = z.object({ name: z.string().optional(), phone: z.string().optional() });
const windowSchema = z.object({ date: z.string(), slot: z.enum(["morning", "midday", "afternoon", "evening"]) });
const lineSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("catalog"), productId: z.string(), variantId: z.string(), addOnIds: z.array(z.string()), qty: z.number().int().positive() }),
  z.object({ kind: z.literal("custom"), title: z.string(), priceCents: z.number().int().nonnegative(), designerNotes: z.string().optional(), qty: z.number().int().positive() }),
]);
const totalsOverrideSchema = z.object({
  subtotalCents: z.number().int().nonnegative().optional(),
  deliveryCents: z.number().int().nonnegative().optional(),
  taxCents: z.number().int().nonnegative().optional(),
  totalCents: z.number().int().nonnegative().optional(),
});
const patchSchema = z.object({
  contact: z.object({ name: z.string().optional(), email: z.string().optional(), phone: z.string().optional() }).optional(),
  recipient: recipientSchema.optional(),
  fulfillmentMethod: z.enum(["in-store", "delivery", "pickup"]).optional(),
  address: addressSchema.optional(),
  window: windowSchema.optional(),
  cardMessage: z.string().optional(),
  lines: z.array(lineSchema).optional(),
  totalsOverride: totalsOverrideSchema.optional(),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  if (!requireAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const json = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", details: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const { order, change } = await editOrder(id, parsed.data as OrderEditPatch, "maky");
    return NextResponse.json({ order, change });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/order not found/.test(msg)) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
```

- [ ] **Step 5: Run it — expect PASS**

Run: `npm test -- tests/unit/api-admin-order-edit.test.ts`
Expected: 5 passing.

- [ ] **Step 6: Verify the existing detail test still passes** (GET shape extended, not broken)

Run: `npm test -- tests/unit/api-admin-orders-detail.test.ts`
Expected: passing. If it asserts an exact object shape, it will still pass because we only ADDED keys. If it fails, update it to allow the new keys.

- [ ] **Step 7: Write the failing test for reprint**

Create `tests/unit/api-admin-order-reprint.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { signSession } from "@/lib/admin-auth";
import { POST } from "@/app/api/admin/orders/[id]/reprint/route";
import { listOrderHistory } from "@/lib/order-history";

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("PRINT_QUEUE_FILE", `/tmp/pq-${Math.random().toString(36).slice(2)}.json`);
  vi.stubEnv("INTAKE_SESSION_SECRET", "test-secret-test-secret-test-secret");
  runMigrations();
});
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

function seed(id: string) {
  getDb().prepare(
    `INSERT INTO orders (id, locale, source, recipient_name, recipient_phone, contact_phone,
       fulfillment_method, window_date, window_slot, lines_json, subtotal_cents, delivery_cents,
       tax_cents, total_cents, fulfillment_status, payment_status, created_at, updated_at)
     VALUES (?, 'es', 'walk-in', 'Ana', '555', '555', 'in-store', NULL, NULL, '[]', 0,0,0,0,
       'pending', 'pending', '2026-06-01T08:00:00Z', '2026-06-01T08:00:00Z')`,
  ).run(id);
}
function authed() {
  return new Request("http://x", { method: "POST", headers: { cookie: `intake_session=${signSession()}` } });
}

describe("POST /api/admin/orders/[id]/reprint", () => {
  it("enqueues a job and logs reprint", async () => {
    seed("r1");
    const res = await POST(authed(), { params: Promise.resolve({ id: "r1" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.jobId).toBeTruthy();
    expect((await listOrderHistory("r1")).some((c) => c.kind === "reprint")).toBe(true);
  });

  it("401 without session", async () => {
    seed("r2");
    const res = await POST(new Request("http://x", { method: "POST" }), { params: Promise.resolve({ id: "r2" }) });
    expect(res.status).toBe(401);
  });

  it("404 unknown order", async () => {
    const res = await POST(authed(), { params: Promise.resolve({ id: "nope" }) });
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 8: Run it — expect FAIL** (route missing)

Run: `npm test -- tests/unit/api-admin-order-reprint.test.ts`

- [ ] **Step 9: Create `app/api/admin/orders/[id]/reprint/route.ts`**

```ts
import { NextResponse } from "next/server";
import { getOrder } from "@/lib/order-storage";
import { enqueuePrintJob } from "@/lib/print-queue";
import { recordOrderChange } from "@/lib/order-history";
import { requireAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  if (!requireAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const order = await getOrder(id);
  if (!order) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const job = await enqueuePrintJob(order);
  await recordOrderChange({ orderId: id, actor: "maky", kind: "reprint", summary: "Reimpresa" });
  return NextResponse.json({ jobId: job.id });
}
```

- [ ] **Step 10: Run it — expect PASS**

Run: `npm test -- tests/unit/api-admin-order-reprint.test.ts`

- [ ] **Step 11: Write the failing test for the sheet preview**

Create `tests/unit/api-admin-order-sheet.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { signSession } from "@/lib/admin-auth";
import { GET } from "@/app/api/admin/orders/[id]/sheet/route";

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("INTAKE_SESSION_SECRET", "test-secret-test-secret-test-secret");
  runMigrations();
});
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

function seed(id: string) {
  getDb().prepare(
    `INSERT INTO orders (id, locale, source, recipient_name, recipient_phone, contact_phone,
       fulfillment_method, window_date, window_slot, lines_json, subtotal_cents, delivery_cents,
       tax_cents, total_cents, fulfillment_status, payment_status, order_number, created_at, updated_at)
     VALUES (?, 'es', 'walk-in', 'Ana', '555', '555', 'in-store', NULL, NULL, '[]', 0,0,0,0,
       'pending', 'pending', 1001, '2026-06-01T08:00:00Z', '2026-06-01T08:00:00Z')`,
  ).run(id);
}
function authed() {
  return new Request("http://x", { headers: { cookie: `intake_session=${signSession()}` } });
}

describe("GET /api/admin/orders/[id]/sheet", () => {
  it("returns work-sheet HTML", async () => {
    seed("s1");
    const res = await GET(authed(), { params: Promise.resolve({ id: "s1" }) });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    const text = await res.text();
    expect(text.toLowerCase()).toContain("<!doctype html>");
  });

  it("401 without session", async () => {
    seed("s2");
    const res = await GET(new Request("http://x"), { params: Promise.resolve({ id: "s2" }) });
    expect(res.status).toBe(401);
  });

  it("404 unknown order", async () => {
    const res = await GET(authed(), { params: Promise.resolve({ id: "nope" }) });
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 12: Run it — expect FAIL** (route missing)

Run: `npm test -- tests/unit/api-admin-order-sheet.test.ts`

- [ ] **Step 13: Create `app/api/admin/orders/[id]/sheet/route.ts`**

```ts
import { NextResponse } from "next/server";
import { getOrder } from "@/lib/order-storage";
import { buildSheetHtml } from "@/lib/print-render-html";
import { requireAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  if (!requireAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const order = await getOrder(id);
  if (!order) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const html = await buildSheetHtml(order);
  return new NextResponse(html, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });
}
```

- [ ] **Step 14: Run it — expect PASS**

Run: `npm test -- tests/unit/api-admin-order-sheet.test.ts`

> If `buildSheetHtml` fails in the sandbox the way `print-chromium` does, check the error: `buildSheetHtml` only renders React→HTML (no Chromium), so it should work. If it imports product images via `getProductImageDataUri` and that fails for `[]` lines, the seed uses empty lines to avoid image lookups.

- [ ] **Step 15: Add `settleBalance` to the payment route**

In `app/api/admin/orders/[id]/payment/route.ts`, support either marking paid OR settling the balance. Replace the schema + handler body:

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { markPaidManual, settleBalance } from "@/lib/order-mutations";

export const runtime = "nodejs";

const body = z.union([
  z.object({ method: z.enum(["cash", "zelle", "card-terminal", "ach"]), note: z.string().max(500).optional() }),
  z.object({ settleBalance: z.literal(true) }),
]);

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await ctx.params;
  const json = await req.json().catch(() => null);
  const parsed = body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", details: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const order = "settleBalance" in parsed.data
      ? await settleBalance(id, "maky")
      : await markPaidManual(id, parsed.data);
    return NextResponse.json({ order });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/order not found/.test(msg)) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
```

- [ ] **Step 16: Verify payment route tests still pass**

Run: `npm test -- tests/unit/api-admin-orders-payment.test.ts`
Expected: passing (the `{ method }` branch is unchanged).

- [ ] **Step 17: Commit**

```bash
git add lib/admin-auth.ts app/api/admin/orders/[id]/route.ts app/api/admin/orders/[id]/payment/route.ts app/api/admin/orders/[id]/reprint/route.ts app/api/admin/orders/[id]/sheet/route.ts tests/unit/api-admin-order-edit.test.ts tests/unit/api-admin-order-reprint.test.ts tests/unit/api-admin-order-sheet.test.ts
git commit -m "feat(orders): admin edit/reprint/sheet routes + requireAdmin + settleBalance"
```

---

## Task 8: UI — drawer edit mode, balance banner, history, preview/reprint buttons

**Files:**
- Create: `components/admin/dashboard/OrderEditForm.tsx`, `components/admin/dashboard/OrderHistoryList.tsx`
- Modify: `components/admin/dashboard/OrderDetailDrawer.tsx`
- Test: `tests/unit/components/OrderHistoryList.test.tsx`

Context: `OrderDetailDrawer` already fetches `/api/admin/orders/[id]` (which now returns `history` + `balanceCents`) and has a `call(method, url, body)` helper that re-fetches after a mutation. The edit form reuses the intake building blocks: `FulfillmentBlock` (+ `toOrderFulfillment`), `ProductPicker`, `CartSummary`. These live in `components/admin/intake/`.

- [ ] **Step 1: Update the drawer's `DetailResp` type and load data**

In `OrderDetailDrawer.tsx`, extend the `DetailResp` type to carry the new fields:

```ts
import type { Order, OrderChange } from "@/types/order";

type DetailResp = {
  order: Order;
  customer: { id: string; name: string; phone: string; email?: string | null } | null;
  messages: Message[];
  history: OrderChange[];
  balanceCents: number;
};
```

- [ ] **Step 2: Create `OrderHistoryList.tsx` and its test (TDD)**

Write the failing test `tests/unit/components/OrderHistoryList.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import OrderHistoryList from "@/components/admin/dashboard/OrderHistoryList";
import type { OrderChange } from "@/types/order";

const history: OrderChange[] = [
  { id: "1", orderId: "o", at: "2026-06-01T10:00:00Z", actor: "maky", kind: "created", summary: "Orden creada · walk-in" },
  { id: "2", orderId: "o", at: "2026-06-01T11:00:00Z", actor: "maky", kind: "edit", summary: "Editó: Total",
    changes: [{ field: "totals.totalCents", label: "Total", before: "$50.00", after: "$60.00" }] },
];

describe("OrderHistoryList", () => {
  it("renders entries newest-first with edit diffs", () => {
    render(<OrderHistoryList history={history} />);
    const items = screen.getAllByRole("listitem");
    expect(items[0].textContent).toContain("Editó: Total");
    expect(screen.getByText(/\$50\.00/)).toBeInTheDocument();
    expect(screen.getByText(/\$60\.00/)).toBeInTheDocument();
  });

  it("renders an empty state", () => {
    render(<OrderHistoryList history={[]} />);
    expect(screen.getByText(/Sin cambios/)).toBeInTheDocument();
  });
});
```

Run: `npm test -- tests/unit/components/OrderHistoryList.test.tsx` → FAIL (module missing).

Implement `components/admin/dashboard/OrderHistoryList.tsx`:

```tsx
"use client";
import type { OrderChange } from "@/types/order";

function fmtTs(ts: string) { return new Date(ts).toLocaleString("es-US"); }

export default function OrderHistoryList({ history }: { history: OrderChange[] }) {
  if (history.length === 0) {
    return <div className="text-ink/50">Sin cambios todavía.</div>;
  }
  const ordered = [...history].reverse(); // newest first
  return (
    <ul className="space-y-2">
      {ordered.map((c) => (
        <li key={c.id} className="text-xs">
          <div>
            <span className="text-ink/60">{fmtTs(c.at)}</span>{" · "}
            <span className="font-semibold">{c.actor}</span>{" · "}
            <span>{c.summary}</span>
          </div>
          {c.changes && c.changes.length > 0 && (
            <ul className="mt-1 ml-3 space-y-0.5 text-ink/70">
              {c.changes.map((d, i) => (
                <li key={i}>
                  {d.label}: <span className="line-through">{d.before ?? "—"}</span> → <span className="font-medium">{d.after ?? "—"}</span>
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}
```

Run: `npm test -- tests/unit/components/OrderHistoryList.test.tsx` → PASS.

- [ ] **Step 3: Create `OrderEditForm.tsx`**

This composes the intake blocks, pre-filled from the order, and calls back with an `OrderEditPatch` on save. Create `components/admin/dashboard/OrderEditForm.tsx`:

```tsx
"use client";
import { useState } from "react";
import type { Order, CartLine, OrderTotals } from "@/types/order";
import FulfillmentBlock, { type FulfillmentState, toOrderFulfillment } from "@/components/admin/intake/FulfillmentBlock";
import ProductPicker from "@/components/admin/intake/ProductPicker";
import CartSummary from "@/components/admin/intake/CartSummary";
import { PRODUCTS } from "@/data/products";
import type { OrderEditPatch } from "@/lib/order-edit";

function orderToFulfillmentState(o: Order): FulfillmentState {
  const f = o.fulfillment;
  return {
    method: f.method,
    recipient: { ...f.recipient },
    address: f.method === "delivery" ? { ...f.address }
      : { street1: "", city: "", state: "NY", zip: "", country: "US" },
    window: f.method !== "in-store" ? { ...f.window }
      : { date: new Date().toISOString().slice(0, 10), slot: "midday" },
    cardMessage: f.cardMessage ?? "",
  };
}

export default function OrderEditForm({
  order, busy, onCancel, onSave,
}: {
  order: Order;
  busy: boolean;
  onCancel: () => void;
  onSave: (patch: OrderEditPatch) => void;
}) {
  const [contact, setContact] = useState({
    name: order.contact.name ?? "", email: order.contact.email ?? "", phone: order.contact.phone,
  });
  const [fulfillment, setFulfillment] = useState<FulfillmentState>(orderToFulfillmentState(order));
  const [lines, setLines] = useState<CartLine[]>(order.lines);
  const [override, setOverride] = useState<Partial<OrderTotals>>({});

  function addLine(line: CartLine) {
    setLines((prev) => {
      if (line.kind === "catalog") {
        const idx = prev.findIndex((l) => l.kind === "catalog" && l.productId === line.productId && l.variantId === line.variantId);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = { ...next[idx], qty: (next[idx] as CartLine).qty + 1 } as CartLine;
          return next;
        }
      }
      return [...prev, line];
    });
  }

  function submit() {
    const f = toOrderFulfillment(fulfillment);
    const patch: OrderEditPatch = {
      contact: { name: contact.name || undefined, email: contact.email || undefined, phone: contact.phone },
      fulfillmentMethod: f.method,
      recipient: f.recipient,
      cardMessage: f.cardMessage ?? "",
      lines,
      ...(f.method === "delivery" ? { address: f.address } : {}),
      ...(f.method !== "in-store" ? { window: f.window } : {}),
      ...(Object.keys(override).length ? { totalsOverride: override } : {}),
    };
    onSave(patch);
  }

  return (
    <div className="space-y-4">
      <section className="rounded border border-ink/10 p-3 text-sm">
        <div className="mb-2 text-xs uppercase tracking-wide text-ink/50">Contacto</div>
        <div className="grid grid-cols-2 gap-2">
          <input value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} placeholder="Teléfono" className="rounded border border-ink/15 px-2 py-1" />
          <input value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} placeholder="Nombre" className="rounded border border-ink/15 px-2 py-1" />
        </div>
        <input value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} placeholder="Email" className="mt-2 w-full rounded border border-ink/15 px-2 py-1" />
      </section>

      <FulfillmentBlock value={fulfillment} onChange={setFulfillment} />

      <ProductPicker products={PRODUCTS} onAdd={addLine} />
      <CartSummary
        lines={lines}
        onChangeLines={setLines}
        fulfillmentMethod={fulfillment.method}
        deliveryZip={fulfillment.address.zip}
        deliveryCity={fulfillment.address.city}
        override={override}
        onOverride={setOverride}
      />

      <div className="flex gap-2">
        <button type="button" disabled={busy || lines.length === 0} onClick={submit}
          className="rounded-full bg-ink px-5 py-2 text-bone disabled:opacity-40">
          {busy ? "Guardando…" : "Guardar cambios"}
        </button>
        <button type="button" disabled={busy} onClick={onCancel}
          className="rounded-full border border-ink/20 px-4 py-2">Cancelar</button>
      </div>
    </div>
  );
}
```

> `ProductPicker` takes `products: Product[]`; `PRODUCTS` from `@/data/products` is the catalog (same as the intake page passes in). `FulfillmentBlock`/`CartSummary` use `next-intl` translations under the `admin_intake` namespace — the drawer is already inside the admin locale layout, so the provider is present.

- [ ] **Step 4: Wire edit mode + balance banner + history + buttons into `OrderDetailDrawer.tsx`**

4a. Add imports and state near the top of the component:

```tsx
import OrderEditForm from "./OrderEditForm";
import OrderHistoryList from "./OrderHistoryList";
import type { OrderEditPatch } from "@/lib/order-edit";
import { Pencil, Eye, Printer } from "@phosphor-icons/react/dist/ssr";
// inside component:
const [editing, setEditing] = useState(false);
```

4b. Add a `saveEdit` handler (uses the existing `call`-style refresh) after the `call` function:

```tsx
async function saveEdit(patch: OrderEditPatch) {
  setBusy(true);
  try {
    const res = await fetch(`/api/admin/orders/${order.id}`, {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      const refreshed = await fetch(`/api/admin/orders/${orderId}`, { cache: "no-store" });
      setData((await refreshed.json()) as DetailResp);
      onChanged();
      setEditing(false);
    }
  } finally { setBusy(false); }
}

async function reprint() {
  if (!window.confirm("¿Re-imprimir esta orden?")) return;
  await call("POST", `/api/admin/orders/${order.id}/reprint`);
}
```

4c. In the header (next to "Cerrar"), add the action buttons (view mode only):

```tsx
{!editing && (
  <div className="flex gap-2">
    <AdminButton variant="secondary" icon={Pencil} onClick={() => setEditing(true)}>Editar</AdminButton>
    <AdminButton variant="secondary" icon={Eye} href={`/api/admin/orders/${order.id}/sheet`} target="_blank" rel="noreferrer">Vista previa</AdminButton>
    <AdminButton variant="secondary" icon={Printer} disabled={busy} onClick={reprint}>Re-imprimir</AdminButton>
  </div>
)}
```

4d. Add the balance banner right under the header (view mode), using `data.balanceCents`:

```tsx
{!editing && data.balanceCents !== 0 && (
  <div className={`mb-3 flex items-center justify-between rounded px-3 py-2 text-sm font-semibold ${
    data.balanceCents > 0 ? "bg-amber-50 text-amber-800" : "bg-sky-50 text-sky-800"
  }`}>
    <span>{data.balanceCents > 0 ? "Saldo pendiente" : "Saldo a favor"}: {money(Math.abs(data.balanceCents))}</span>
    <AdminButton variant="secondary" disabled={busy}
      onClick={() => call("PATCH", `/api/admin/orders/${order.id}/payment`, { settleBalance: true })}>
      Marcar saldado
    </AdminButton>
  </div>
)}
```

4e. Render the edit form in place of the read-only sections when `editing` is true. Wrap the existing Customer/Entrega/Items/Totales sections so they only render when `!editing`, and add:

```tsx
{editing && (
  <OrderEditForm order={order} busy={busy} onCancel={() => setEditing(false)} onSave={saveEdit} />
)}
```

4f. Add a History section (view mode), after the Mensajes section:

```tsx
{!editing && (
  <section className="mb-3 rounded border border-ink/10 bg-bone p-3 text-sm">
    <div className="mb-2 text-xs uppercase tracking-wide text-ink/50">Historial</div>
    <OrderHistoryList history={data.history} />
  </section>
)}
```

- [ ] **Step 5: Typecheck + run the component test + full intended suite**

Run: `npm test -- tests/unit/components/OrderHistoryList.test.tsx`
Expected: PASS.

Run a typecheck via the build's type step if available, else rely on the test run importing the modules. (If the project has `tsc --noEmit`, run it: `npx tsc --noEmit`.)

- [ ] **Step 6: Manually verify in the dev server**

Start the dev server and open the dashboard; open an order; confirm: Editar toggles the form; saving updates the order and adds a history entry; Vista previa opens the work-sheet in a new tab; Re-imprimir prompts and logs; the balance banner appears after editing a paid order's total. (Use the preview tooling per the harness verification workflow.)

- [ ] **Step 7: Commit**

```bash
git add components/admin/dashboard/OrderEditForm.tsx components/admin/dashboard/OrderHistoryList.tsx components/admin/dashboard/OrderDetailDrawer.tsx tests/unit/components/OrderHistoryList.test.tsx
git commit -m "feat(dashboard): inline order edit, balance banner, history timeline, preview + reprint"
```

---

## Final verification

- [ ] **Run the full suite** (the 5 pre-existing baseline failures should be the ONLY failures):

Run: `npm test`
Expected: all NEW tests pass; the only failures are the 5 documented pre-existing ones (`checkout-schema` ×3, `print-chromium`/`_preview`/`print-render`). If any OTHER test fails, fix it before finishing.

- [ ] **Self-check the build** (optional but recommended): `npx tsc --noEmit` clean of new errors.

- [ ] Hand back to the finishing-a-development-branch skill to open the PR.

---

## Notes for the implementer

- **AGENTS.md**: this Next.js is customized — when in doubt about a framework API (route handler signatures, `cookies()`, etc.), prefer the patterns already used in the repo (shown in the code blocks above) over training-data assumptions, and consult `node_modules/next/dist/docs/`.
- **Spanish copy**: this dashboard is Spanish-only. All user-facing strings in new UI are Spanish.
- **`actor` is `maky`**: there is one shared admin login, so history rows record `maky`. The schema is per-user-ready for Phase 4.
- **No print-agent change**: reprint enqueues a job; the shop PC's agent prints it on its next poll. Preview renders the same `buildSheetHtml` HTML the agent receives. Neither requires touching `tools/print-agent`.
- **Editing a paid order never moves money in Stripe.** The balance is informational; "Marcar saldado" only records that the in-person difference was handled.
