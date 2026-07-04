# Customer CRM Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the customer data the app already captures into a CRM surface: a searchable/segmented Customers list and a per-customer profile with LTV, segments (VIP / recurring / at-risk / new), order history, editable notes and tags.

**Architecture:** New pure-metrics module (`lib/customer-metrics.ts`) is the single source of truth for segment thresholds; `lib/customer-storage.ts` grows list/get/update/tag functions whose SQL mirrors those constants; three new admin API routes sit behind the existing middleware auth; two new admin pages reuse `DashboardShell` and `OrderDetailDrawer`. Spec: `docs/superpowers/specs/2026-07-01-customer-crm-phase-1-design.md`.

**Tech Stack:** Next.js (App Router, custom conventions — see `AGENTS.md`), node:sqlite via `lib/db.ts`, zod, next-intl, vitest + @testing-library/react, Tailwind tokens (`bone`, `ink`, `rouge`, `mute`).

---

## Project conventions the engineer MUST know

1. **Node 22 required.** The shell default (v16) breaks vitest and next. Prefix EVERY command session with:
   ```bash
   export PATH="/opt/homebrew/bin:$PATH"   # node v22
   ```
2. **Run tests** with `npm test -- <file>` (wraps `NODE_OPTIONS='--experimental-sqlite' vitest run`). The full suite has known-noisy baseline failures unrelated to this work — targeted files must pass 100%; the full suite must show no NEW failures vs `main`.
3. **DB access:** `getDb()` from `@/lib/db` + `runMigrations()` from `@/lib/db-migrate` at the top of every storage function. Migrations in `db/migrations/*.sql` auto-apply sorted by filename inside a transaction.
4. **Admin auth is middleware-level** (`proxy.ts` guards `/api/admin/*` and `/[locale]/admin/*`). Route handlers do NOT call auth functions. Unit tests invoke handlers directly, bypassing auth — that is the established pattern (see `tests/unit/api-admin-orders-detail.test.ts`).
5. **Route handler signatures:** `export const runtime = "nodejs"`, handlers take `Request`, dynamic params are `{ params }: { params: Promise<{ id: string }> }` and must be awaited.
6. **API tests** stub the DB: `vi.stubEnv("SQLITE_FILE", ":memory:")` in `beforeEach`, `closeDb(); vi.unstubAllEnvs()` in `afterEach`.
7. **Component tests** wrap in `NextIntlClientProvider` with the REAL `messages/es.json` (so missing keys fail loudly). See `tests/unit/GiftCardsView.test.tsx`.
8. **i18n:** `messages/en.json` and `messages/es.json` must have identical key paths — enforced by `tests/unit/i18n-parity.test.ts`. Spanish is the default locale.
9. **Dates:** `formatDate`/`formatDateTime` from `@/lib/format-datetime`. **Money:** local `money()` helper `$${(c / 100).toFixed(2)}` (existing pattern in `OrderDetailDrawer.tsx`).
10. **This is NOT the Next.js you know** (per `AGENTS.md`): if you touch an API you haven't seen used in this repo, read `node_modules/next/dist/docs/` first. Every pattern in this plan is copied from working code in the repo, so following the plan verbatim is safe.
11. **Commits:** end every commit message with:
    ```
    Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
    ```

**Deliberate deviations from the spec (approved rationale):**
- Pagination cursor is an **encoded offset**, not keyset. Keyset across 4 different sort orders adds real complexity; a florist's customer table is small (hundreds–low thousands). The API shape (`cursor`/`nextCursor`) is unchanged, so we can swap to keyset later without breaking clients.
- Profile response is `{ customer, metrics, tags, orders }` — `notes` rides inside `customer` (it is a `customers` column) instead of a redundant top-level field.
- Segment **filters** match the non-exclusive booleans (filtering "VIP" returns all VIPs even if also at-risk); the **primary badge** uses precedence `at_risk > vip > recurring > new`.

---

### Task 1: Migration `012_customer_crm.sql`

**Files:**
- Create: `db/migrations/012_customer_crm.sql`
- Test: `tests/unit/customer-crm-migration.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/customer-crm-migration.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";

beforeEach(() => { vi.stubEnv("SQLITE_FILE", ":memory:"); runMigrations(); });
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

describe("012_customer_crm migration", () => {
  it("adds customers.notes and creates customer_tags", () => {
    const db = getDb();
    db.prepare(
      `INSERT INTO customers (id, name, phone, order_count, first_seen_at, last_seen_at, notes)
       VALUES ('c1', 'Ana', '5551', 0, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', 'prefiere tulipanes')`,
    ).run();
    const row = db.prepare("SELECT notes FROM customers WHERE id = 'c1'").get() as { notes: string };
    expect(row.notes).toBe("prefiere tulipanes");

    db.prepare("INSERT INTO customer_tags (customer_id, tag) VALUES ('c1', 'boda')").run();
    const tags = db.prepare("SELECT tag FROM customer_tags WHERE customer_id = 'c1'").all();
    expect(tags).toEqual([{ tag: "boda" }]);
  });

  it("customer_tags PK dedupes (INSERT OR IGNORE is a no-op on duplicates)", () => {
    const db = getDb();
    db.prepare("INSERT OR IGNORE INTO customer_tags (customer_id, tag) VALUES ('c9', 'vip')").run();
    db.prepare("INSERT OR IGNORE INTO customer_tags (customer_id, tag) VALUES ('c9', 'vip')").run();
    const n = db.prepare("SELECT COUNT(*) AS n FROM customer_tags WHERE customer_id = 'c9'").get() as { n: number };
    expect(n.n).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
export PATH="/opt/homebrew/bin:$PATH"
npm test -- tests/unit/customer-crm-migration.test.ts
```
Expected: FAIL — `table customers has no column named notes` (and/or `no such table: customer_tags`).

- [ ] **Step 3: Write the migration**

Create `db/migrations/012_customer_crm.sql`:

```sql
-- 012_customer_crm.sql — CRM Phase 1: free-text notes + tags on customers.
ALTER TABLE customers ADD COLUMN notes TEXT;

CREATE TABLE IF NOT EXISTS customer_tags (
  customer_id TEXT NOT NULL,
  tag         TEXT NOT NULL,
  PRIMARY KEY (customer_id, tag)
);

CREATE INDEX IF NOT EXISTS idx_customer_tags_tag ON customer_tags(tag);
CREATE INDEX IF NOT EXISTS idx_customer_tags_customer ON customer_tags(customer_id);
```

(`orders` already has `idx_orders_customer` from `001_init.sql` — nothing to add there.)

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- tests/unit/customer-crm-migration.test.ts
```
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add db/migrations/012_customer_crm.sql tests/unit/customer-crm-migration.test.ts
git commit -m "feat(crm): migration 012 — customers.notes + customer_tags table

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: `lib/customer-metrics.ts` — pure metrics + segmentation

**Files:**
- Create: `lib/customer-metrics.ts`
- Test: `tests/unit/customer-metrics.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/customer-metrics.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  computeMetrics, atRiskCutoffIso,
  AT_RISK_DAYS,
  type MetricsOrder,
} from "@/lib/customer-metrics";

const NOW = new Date("2026-07-04T12:00:00Z");
const DAY = 86_400_000;

function order(daysAgo: number, paidCents: number): MetricsOrder {
  return {
    totalCents: paidCents > 0 ? paidCents : 5000,
    amountPaidCents: paidCents,
    createdAt: new Date(NOW.getTime() - daysAgo * DAY).toISOString(),
  };
}

describe("computeMetrics", () => {
  it("no orders, no fallback → new segment with null dates", () => {
    const m = computeMetrics([], NOW);
    expect(m).toMatchObject({
      ltvCents: 0, orderCount: 0, paidOrderCount: 0, aovCents: 0,
      firstOrderAt: null, lastOrderAt: null, daysSinceLastOrder: null,
      segment: "new", isVip: false, isAtRisk: false, isRecurring: false,
    });
  });

  it("no orders + seen fallback → dates fall back to first/last seen", () => {
    const m = computeMetrics([], NOW, {
      firstSeenAt: "2026-01-01T00:00:00Z",
      lastSeenAt: "2026-06-01T00:00:00Z",
    });
    expect(m.firstOrderAt).toBe("2026-01-01T00:00:00Z");
    expect(m.lastOrderAt).toBe("2026-06-01T00:00:00Z");
    expect(m.segment).toBe("new");
  });

  it("1 order → new; LTV and AOV from collected cents", () => {
    const m = computeMetrics([order(3, 7500)], NOW);
    expect(m.segment).toBe("new");
    expect(m.ltvCents).toBe(7500);
    expect(m.aovCents).toBe(7500);
    expect(m.daysSinceLastOrder).toBe(3);
  });

  it("2 recent orders → recurring; AOV averages paid orders only", () => {
    const m = computeMetrics([order(10, 6000), order(5, 9000), order(2, 0)], NOW);
    expect(m.segment).toBe("recurring");
    expect(m.orderCount).toBe(3);
    expect(m.paidOrderCount).toBe(2);
    expect(m.ltvCents).toBe(15000);
    expect(m.aovCents).toBe(7500);
    expect(m.firstOrderAt).toBe(order(10, 6000).createdAt);
    expect(m.lastOrderAt).toBe(order(2, 0).createdAt);
  });

  it("VIP by order count (5 orders)", () => {
    const m = computeMetrics([1, 2, 3, 4, 5].map((d) => order(d, 4000)), NOW);
    expect(m.segment).toBe("vip");
    expect(m.isVip).toBe(true);
  });

  it("VIP by LTV boundary (exactly $500 collected)", () => {
    const m = computeMetrics([order(5, 25000), order(3, 25000)], NOW);
    expect(m.ltvCents).toBe(50000);
    expect(m.segment).toBe("vip");
  });

  it("4 orders / $499.99 → not VIP", () => {
    const m = computeMetrics([1, 2, 3, 4].map((d) => order(d, 12499)), NOW);
    expect(m.ltvCents).toBe(49996);
    expect(m.isVip).toBe(false);
    expect(m.segment).toBe("recurring");
  });

  it("at-risk: recurring + last order 91 days ago; primary badge wins over vip", () => {
    const m = computeMetrics([91, 120, 200, 300, 400].map((d) => order(d, 20000)), NOW);
    expect(m.isVip).toBe(true);
    expect(m.isAtRisk).toBe(true);
    expect(m.segment).toBe("at_risk");
  });

  it("boundary: exactly 90 days since last order is NOT at risk", () => {
    const m = computeMetrics([order(AT_RISK_DAYS, 5000), order(120, 5000)], NOW);
    expect(m.daysSinceLastOrder).toBe(90);
    expect(m.isAtRisk).toBe(false);
    expect(m.segment).toBe("recurring");
  });

  it("single old order is NOT at risk (needs recurring)", () => {
    const m = computeMetrics([order(200, 5000)], NOW);
    expect(m.isAtRisk).toBe(false);
    expect(m.segment).toBe("new");
  });
});

describe("atRiskCutoffIso", () => {
  it("is exactly AT_RISK_DAYS before now", () => {
    expect(atRiskCutoffIso(NOW)).toBe(new Date(NOW.getTime() - AT_RISK_DAYS * DAY).toISOString());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/unit/customer-metrics.test.ts
```
Expected: FAIL — cannot resolve `@/lib/customer-metrics`.

- [ ] **Step 3: Write the implementation**

Create `lib/customer-metrics.ts`:

```ts
// Pure, DB-free customer metrics + segmentation. The threshold constants here
// are the single source of truth — the SQL predicates in customer-storage.ts
// are built from these same exports.

export const VIP_MIN_ORDERS = 5;
export const VIP_MIN_LTV_CENTS = 50_000; // $500 actually collected
export const AT_RISK_DAYS = 90;
export const RECURRING_MIN_ORDERS = 2;

export type Segment = "new" | "recurring" | "vip" | "at_risk";

export type MetricsOrder = {
  totalCents: number;
  amountPaidCents: number;
  createdAt: string; // ISO
};

export type OrderAggregate = {
  orderCount: number;
  ltvCents: number;
  paidOrderCount: number;
  firstOrderAt: string | null;
  lastOrderAt: string | null;
};

export type SeenFallback = { firstSeenAt: string; lastSeenAt: string };

export type CustomerMetrics = {
  ltvCents: number;
  orderCount: number;
  paidOrderCount: number;
  aovCents: number;
  firstOrderAt: string | null;
  lastOrderAt: string | null;
  daysSinceLastOrder: number | null;
  segment: Segment; // primary badge (precedence: at_risk > vip > recurring > new)
  isVip: boolean;
  isAtRisk: boolean;
  isRecurring: boolean;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** ISO cutoff for SQL at-risk predicates: last_order_at < cutoff ⇔ daysSince > AT_RISK_DAYS. */
export function atRiskCutoffIso(now: Date): string {
  return new Date(now.getTime() - AT_RISK_DAYS * DAY_MS).toISOString();
}

export function aggregateOrders(orders: MetricsOrder[]): OrderAggregate {
  let ltvCents = 0;
  let paidOrderCount = 0;
  let firstOrderAt: string | null = null;
  let lastOrderAt: string | null = null;
  for (const o of orders) {
    ltvCents += o.amountPaidCents;
    if (o.amountPaidCents > 0) paidOrderCount += 1;
    if (!firstOrderAt || o.createdAt < firstOrderAt) firstOrderAt = o.createdAt;
    if (!lastOrderAt || o.createdAt > lastOrderAt) lastOrderAt = o.createdAt;
  }
  return { orderCount: orders.length, ltvCents, paidOrderCount, firstOrderAt, lastOrderAt };
}

export function metricsFromAggregate(
  agg: OrderAggregate,
  now: Date,
  fallback?: SeenFallback,
): CustomerMetrics {
  const firstOrderAt = agg.firstOrderAt ?? fallback?.firstSeenAt ?? null;
  const lastOrderAt = agg.lastOrderAt ?? fallback?.lastSeenAt ?? null;
  const daysSinceLastOrder = lastOrderAt
    ? Math.floor((now.getTime() - new Date(lastOrderAt).getTime()) / DAY_MS)
    : null;
  const isVip = agg.orderCount >= VIP_MIN_ORDERS || agg.ltvCents >= VIP_MIN_LTV_CENTS;
  const isRecurring = agg.orderCount >= RECURRING_MIN_ORDERS;
  const isAtRisk =
    isRecurring && daysSinceLastOrder !== null && daysSinceLastOrder > AT_RISK_DAYS;
  const segment: Segment = isAtRisk ? "at_risk" : isVip ? "vip" : isRecurring ? "recurring" : "new";
  return {
    ltvCents: agg.ltvCents,
    orderCount: agg.orderCount,
    paidOrderCount: agg.paidOrderCount,
    aovCents: agg.paidOrderCount > 0 ? Math.round(agg.ltvCents / agg.paidOrderCount) : 0,
    firstOrderAt,
    lastOrderAt,
    daysSinceLastOrder,
    segment,
    isVip,
    isAtRisk,
    isRecurring,
  };
}

export function computeMetrics(
  orders: MetricsOrder[],
  now: Date,
  fallback?: SeenFallback,
): CustomerMetrics {
  return metricsFromAggregate(aggregateOrders(orders), now, fallback);
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- tests/unit/customer-metrics.test.ts
```
Expected: PASS (11 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/customer-metrics.ts tests/unit/customer-metrics.test.ts
git commit -m "feat(crm): pure customer metrics + segment classification

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: `listOrdersByCustomer` in `lib/order-storage.ts`

**Files:**
- Modify: `lib/order-storage.ts` (append at end of file)
- Test: `tests/unit/customer-storage-crm.test.ts` (new — this file grows in Tasks 4–5)

- [ ] **Step 1: Write the failing test**

Create `tests/unit/customer-storage-crm.test.ts` with the shared seed helpers and the first describe block:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { listOrdersByCustomer } from "@/lib/order-storage";

// Fixed "now" for deterministic segment math. All storage functions accept
// `now` as a parameter; seeds are placed relative to this instant.
export const NOW = new Date("2026-07-04T12:00:00Z");
const DAY = 86_400_000;

beforeEach(() => { vi.stubEnv("SQLITE_FILE", ":memory:"); runMigrations(); });
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

export function seedCustomer(
  id: string, name: string, phone: string,
  opts: { firstSeen?: string; email?: string } = {},
) {
  const seen = opts.firstSeen ?? "2026-01-01T00:00:00Z";
  getDb().prepare(
    `INSERT INTO customers (id, name, phone, email, order_count, first_seen_at, last_seen_at)
     VALUES (?, ?, ?, ?, 0, ?, ?)`,
  ).run(id, name, phone, opts.email ?? null, seen, seen);
}

export function seedOrder(id: string, customerId: string, daysAgo: number, paidCents: number) {
  const at = new Date(NOW.getTime() - daysAgo * DAY).toISOString();
  getDb().prepare(
    `INSERT INTO orders (id, locale, source, customer_id, recipient_name, recipient_phone,
       contact_phone, fulfillment_method, lines_json, subtotal_cents, delivery_cents,
       tax_cents, total_cents, amount_paid_cents, fulfillment_status, payment_status,
       created_at, updated_at)
     VALUES (?, 'es', 'walk-in', ?, 'R', '1', '1', 'pickup', '[]', 0, 0, 0, ?, ?,
       'pending', ?, ?, ?)`,
  ).run(id, customerId, paidCents > 0 ? paidCents : 5000, paidCents,
        paidCents > 0 ? "paid" : "pending", at, at);
}

describe("listOrdersByCustomer", () => {
  it("returns only that customer's orders, newest first", () => {
    seedCustomer("c1", "Ana", "5551");
    seedCustomer("c2", "Bea", "5552");
    seedOrder("o1", "c1", 10, 6000);
    seedOrder("o2", "c1", 2, 9000);
    seedOrder("o3", "c2", 1, 4000);
    const orders = listOrdersByCustomer("c1");
    expect(orders.map((o) => o.id)).toEqual(["o2", "o1"]);
  });

  it("returns empty array for a customer with no orders", () => {
    seedCustomer("c1", "Ana", "5551");
    expect(listOrdersByCustomer("c1")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/unit/customer-storage-crm.test.ts
```
Expected: FAIL — `listOrdersByCustomer` is not exported from `@/lib/order-storage`.

- [ ] **Step 3: Write the implementation**

Append to the end of `lib/order-storage.ts` (it already imports `getDb`, `rowToOrder`, `OrderRow`, and defines `ensureSchema` — reuse them):

```ts
export function listOrdersByCustomer(customerId: string): Order[] {
  ensureSchema();
  const rows = getDb()
    .prepare(
      "SELECT * FROM orders WHERE customer_id = ? ORDER BY created_at DESC, id DESC",
    )
    .all(customerId) as OrderRow[];
  return rows.map(rowToOrder);
}
```

(`ensureSchema` is the same private helper `listOrders` calls at the top of its body — verified present in this file.)

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- tests/unit/customer-storage-crm.test.ts
```
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/order-storage.ts tests/unit/customer-storage-crm.test.ts
git commit -m "feat(crm): listOrdersByCustomer in order storage

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Customer storage — notes field, get-by-id, update, tags

**Files:**
- Modify: `lib/customer-storage.ts`
- Test: `tests/unit/customer-storage-crm.test.ts` (append)

- [ ] **Step 1: Write the failing tests**

Append to `tests/unit/customer-storage-crm.test.ts`. Extend the import from `@/lib/customer-storage`:

```ts
import {
  getCustomerById, updateCustomer, normalizeTag,
  addTag, removeTag, listTagsFor, listAllTags,
} from "@/lib/customer-storage";
```

Then append these describes:

```ts
describe("getCustomerById / updateCustomer", () => {
  it("returns null for unknown id", () => {
    expect(getCustomerById("nope")).toBeNull();
  });

  it("gets a customer with notes mapped onto the object", () => {
    seedCustomer("c1", "Ana", "5551");
    getDb().prepare("UPDATE customers SET notes = 'sin lilies' WHERE id = 'c1'").run();
    const c = getCustomerById("c1");
    expect(c?.name).toBe("Ana");
    expect(c?.notes).toBe("sin lilies");
  });

  it("updates notes and contact fields; empty email clears it", () => {
    seedCustomer("c1", "Ana", "5551", { email: "ana@x.com" });
    const updated = updateCustomer("c1", {
      notes: "prefiere tonos pastel",
      name: "Ana María",
      email: "",
      messagingChannel: "whatsapp",
      locale: "en",
    });
    expect(updated).toMatchObject({
      name: "Ana María",
      notes: "prefiere tonos pastel",
      messagingChannel: "whatsapp",
      locale: "en",
    });
    expect(updated?.email).toBeUndefined();
  });

  it("update on unknown id returns null", () => {
    expect(updateCustomer("nope", { notes: "x" })).toBeNull();
  });
});

describe("tags", () => {
  it("normalizeTag trims, collapses spaces, lowercases, caps at 24 chars", () => {
    expect(normalizeTag("  Boda   Junio ")).toBe("boda junio");
    expect(normalizeTag("A".repeat(40))).toBe("a".repeat(24));
    expect(normalizeTag("   ")).toBeNull();
  });

  it("addTag is idempotent and returns the sorted tag list", () => {
    seedCustomer("c1", "Ana", "5551");
    expect(addTag("c1", "vip")).toEqual(["vip"]);
    expect(addTag("c1", "vip")).toEqual(["vip"]);
    expect(addTag("c1", "boda")).toEqual(["boda", "vip"]);
  });

  it("removeTag removes and listAllTags de-duplicates across customers", () => {
    seedCustomer("c1", "Ana", "5551");
    seedCustomer("c2", "Bea", "5552");
    addTag("c1", "boda");
    addTag("c2", "boda");
    addTag("c2", "funeral");
    expect(listAllTags()).toEqual(["boda", "funeral"]);
    expect(removeTag("c2", "funeral")).toEqual(["boda"]);
    expect(listTagsFor("c2")).toEqual(["boda"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/unit/customer-storage-crm.test.ts
```
Expected: FAIL — the new functions are not exported.

- [ ] **Step 3: Write the implementation**

In `lib/customer-storage.ts`:

**(a)** Add `notes` to the row type and domain type, and map it. In `Customer` add:

```ts
  notes?: string;
```

In `CustomerRow` add:

```ts
  notes: string | null;
```

In `rowToCustomer`, add to the returned object:

```ts
    notes: r.notes ?? undefined,
```

**(b)** Append at the end of the file:

```ts
export function getCustomerById(id: string): Customer | null {
  runMigrations();
  const row = getDb().prepare("SELECT * FROM customers WHERE id = ?").get(id) as
    | CustomerRow
    | undefined;
  return row ? rowToCustomer(row) : null;
}

export type CustomerPatch = {
  notes?: string;
  name?: string;
  email?: string; // "" clears the stored email
  messagingChannel?: MessagingChannel;
  locale?: "en" | "es";
};

export function updateCustomer(id: string, patch: CustomerPatch): Customer | null {
  runMigrations();
  const db = getDb();
  const sets: string[] = [];
  const params: unknown[] = [];
  if (patch.notes !== undefined) { sets.push("notes = ?"); params.push(patch.notes || null); }
  if (patch.name !== undefined) { sets.push("name = ?"); params.push(patch.name); }
  if (patch.email !== undefined) { sets.push("email = ?"); params.push(patch.email || null); }
  if (patch.messagingChannel !== undefined) {
    sets.push("messaging_channel = ?");
    params.push(patch.messagingChannel);
  }
  if (patch.locale !== undefined) { sets.push("locale = ?"); params.push(patch.locale); }
  if (sets.length) {
    db.prepare(`UPDATE customers SET ${sets.join(", ")} WHERE id = ?`).run(...params, id);
  }
  return getCustomerById(id);
}

export const TAG_MAX_LENGTH = 24;

/** trim + collapse inner whitespace + lowercase + cap length; null when empty. */
export function normalizeTag(raw: string): string | null {
  const t = raw.trim().replace(/\s+/g, " ").toLowerCase().slice(0, TAG_MAX_LENGTH).trim();
  return t.length ? t : null;
}

export function listTagsFor(customerId: string): string[] {
  runMigrations();
  const rows = getDb()
    .prepare("SELECT tag FROM customer_tags WHERE customer_id = ? ORDER BY tag")
    .all(customerId) as Array<{ tag: string }>;
  return rows.map((r) => r.tag);
}

export function addTag(customerId: string, tag: string): string[] {
  runMigrations();
  getDb()
    .prepare("INSERT OR IGNORE INTO customer_tags (customer_id, tag) VALUES (?, ?)")
    .run(customerId, tag);
  return listTagsFor(customerId);
}

export function removeTag(customerId: string, tag: string): string[] {
  runMigrations();
  getDb()
    .prepare("DELETE FROM customer_tags WHERE customer_id = ? AND tag = ?")
    .run(customerId, tag);
  return listTagsFor(customerId);
}

export function listAllTags(): string[] {
  runMigrations();
  const rows = getDb()
    .prepare("SELECT DISTINCT tag FROM customer_tags ORDER BY tag")
    .all() as Array<{ tag: string }>;
  return rows.map((r) => r.tag);
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- tests/unit/customer-storage-crm.test.ts tests/unit/api-admin-customers-lookup.test.ts
```
Expected: PASS — including the pre-existing lookup test (proves `rowToCustomer` change didn't break it).

- [ ] **Step 5: Commit**

```bash
git add lib/customer-storage.ts tests/unit/customer-storage-crm.test.ts
git commit -m "feat(crm): customer notes, get-by-id, update, tag CRUD in storage

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Customer storage — `listCustomers` + `customerStats`

**Files:**
- Modify: `lib/customer-storage.ts` (append)
- Test: `tests/unit/customer-storage-crm.test.ts` (append)

- [ ] **Step 1: Write the failing tests**

Append to `tests/unit/customer-storage-crm.test.ts`. Extend the `@/lib/customer-storage` import with `listCustomers, customerStats`. Then append:

```ts
// Shared scenario:
//  ana   → 6 recent paid orders of $60  → VIP (order count), ltv 36000
//  bob   → 2 orders, last one 100 days ago → at-risk (and recurring)
//  carla → 1 recent order → new
//  dora  → no orders, first seen this month → new
function seedScenario() {
  seedCustomer("ana", "Ana", "5550001");
  seedCustomer("bob", "Bob", "5550002", { email: "bob@x.com" });
  seedCustomer("carla", "Carla", "5550003");
  seedCustomer("dora", "Dora", "5550004", { firstSeen: "2026-07-02T00:00:00Z" });
  [1, 2, 3, 4, 5, 6].forEach((d) => seedOrder(`a${d}`, "ana", d, 6000));
  seedOrder("b1", "bob", 100, 8000);
  seedOrder("b2", "bob", 150, 8000);
  seedOrder("k1", "carla", 3, 4500);
}

describe("listCustomers", () => {
  it("default sort is last_order desc; customers with no orders sort last", () => {
    seedScenario();
    const { customers } = listCustomers({}, NOW);
    expect(customers.map((c) => c.id)).toEqual(["ana", "carla", "bob", "dora"]);
  });

  it("attaches metrics and tags to each row", () => {
    seedScenario();
    addTag("ana", "vip");
    const { customers } = listCustomers({}, NOW);
    const ana = customers.find((c) => c.id === "ana")!;
    expect(ana.metrics.segment).toBe("vip");
    expect(ana.metrics.ltvCents).toBe(36000);
    expect(ana.metrics.orderCount).toBe(6);
    expect(ana.tags).toEqual(["vip"]);
    const dora = customers.find((c) => c.id === "dora")!;
    expect(dora.metrics.segment).toBe("new");
    expect(dora.metrics.ltvCents).toBe(0);
  });

  it("q matches name, phone, and email", () => {
    seedScenario();
    expect(listCustomers({ q: "car" }, NOW).customers.map((c) => c.id)).toEqual(["carla"]);
    expect(listCustomers({ q: "5550002" }, NOW).customers.map((c) => c.id)).toEqual(["bob"]);
    expect(listCustomers({ q: "bob@x" }, NOW).customers.map((c) => c.id)).toEqual(["bob"]);
  });

  it("segment filters mirror the boolean semantics", () => {
    seedScenario();
    const ids = (f: Parameters<typeof listCustomers>[0]) =>
      listCustomers(f, NOW).customers.map((c) => c.id).sort();
    expect(ids({ segment: "new" })).toEqual(["carla", "dora"]);
    expect(ids({ segment: "recurring" })).toEqual(["ana", "bob"]);
    expect(ids({ segment: "vip" })).toEqual(["ana"]);
    expect(ids({ segment: "at_risk" })).toEqual(["bob"]);
  });

  it("tag filter matches exact tag", () => {
    seedScenario();
    addTag("bob", "boda");
    expect(listCustomers({ tag: "boda" }, NOW).customers.map((c) => c.id)).toEqual(["bob"]);
    expect(listCustomers({ tag: "nope" }, NOW).customers).toEqual([]);
  });

  it("sorts: ltv, orders, name", () => {
    seedScenario();
    expect(listCustomers({ sort: "ltv" }, NOW).customers[0].id).toBe("ana");
    expect(listCustomers({ sort: "orders" }, NOW).customers[0].id).toBe("ana");
    expect(listCustomers({ sort: "name" }, NOW).customers.map((c) => c.id)).toEqual([
      "ana", "bob", "carla", "dora",
    ]);
  });

  it("paginates with an opaque cursor", () => {
    seedScenario();
    const p1 = listCustomers({ sort: "name", limit: 3 }, NOW);
    expect(p1.customers.map((c) => c.id)).toEqual(["ana", "bob", "carla"]);
    expect(p1.nextCursor).toBeTruthy();
    const p2 = listCustomers({ sort: "name", limit: 3, cursor: p1.nextCursor! }, NOW);
    expect(p2.customers.map((c) => c.id)).toEqual(["dora"]);
    expect(p2.nextCursor).toBeNull();
  });
});

describe("customerStats", () => {
  it("computes total, newThisMonth, repeatRatePct, atRiskCount", () => {
    seedScenario();
    const stats = customerStats(NOW);
    expect(stats.total).toBe(4);
    expect(stats.newThisMonth).toBe(1); // dora, first seen 2026-07-02
    expect(stats.repeatRatePct).toBe(50); // ana + bob out of 4
    expect(stats.atRiskCount).toBe(1); // bob
  });

  it("handles an empty database", () => {
    const stats = customerStats(NOW);
    expect(stats).toEqual({ total: 0, newThisMonth: 0, repeatRatePct: 0, atRiskCount: 0 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/unit/customer-storage-crm.test.ts
```
Expected: FAIL — `listCustomers` / `customerStats` not exported.

- [ ] **Step 3: Write the implementation**

In `lib/customer-storage.ts`, add to the imports at the top:

```ts
import {
  atRiskCutoffIso,
  metricsFromAggregate,
  RECURRING_MIN_ORDERS,
  VIP_MIN_LTV_CENTS,
  VIP_MIN_ORDERS,
  type CustomerMetrics,
} from "@/lib/customer-metrics";
```

Append at the end of the file:

```ts
export type CustomerSort = "last_order" | "ltv" | "orders" | "name";
export type CustomerSegmentFilter = "new" | "recurring" | "vip" | "at_risk";

export type CustomerListFilters = {
  q?: string;
  segment?: CustomerSegmentFilter;
  tag?: string;
  sort?: CustomerSort;
  cursor?: string; // opaque; currently base64url-encoded offset
  limit?: number;
};

export type CustomerListItem = Customer & { metrics: CustomerMetrics; tags: string[] };

export type CustomerListStats = {
  total: number;
  newThisMonth: number;
  repeatRatePct: number;
  atRiskCount: number;
};

export type CustomerListResult = {
  customers: CustomerListItem[];
  stats: CustomerListStats;
  nextCursor: string | null;
};

type AggRow = CustomerRow & {
  o_count: number;
  ltv_cents: number;
  paid_count: number;
  first_order_at: string | null;
  last_order_at: string | null;
};

// LEFT JOIN so customers without any linked order still appear (o_count 0).
const AGG_JOIN = `
  FROM customers c
  LEFT JOIN (
    SELECT customer_id,
           COUNT(*)                                               AS o_count,
           SUM(amount_paid_cents)                                 AS ltv_cents,
           SUM(CASE WHEN amount_paid_cents > 0 THEN 1 ELSE 0 END) AS paid_count,
           MIN(created_at)                                        AS first_order_at,
           MAX(created_at)                                        AS last_order_at
    FROM orders
    GROUP BY customer_id
  ) a ON a.customer_id = c.id`;

function encodeOffset(n: number): string {
  return Buffer.from(String(n), "utf8").toString("base64url");
}

function decodeOffset(cursor: string): number {
  const n = Number(Buffer.from(cursor, "base64url").toString("utf8"));
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

export function listCustomers(
  filters: CustomerListFilters,
  now: Date = new Date(),
): CustomerListResult {
  runMigrations();
  const db = getDb();
  const where: string[] = [];
  const params: unknown[] = [];

  if (filters.q?.trim()) {
    const like = `%${filters.q.trim()}%`;
    where.push("(c.name LIKE ? OR c.phone LIKE ? OR c.email LIKE ?)");
    params.push(like, like, like);
  }
  if (filters.tag) {
    where.push("EXISTS (SELECT 1 FROM customer_tags t WHERE t.customer_id = c.id AND t.tag = ?)");
    params.push(filters.tag);
  }
  // Segment predicates mirror the constants in customer-metrics.ts (numbers are
  // interpolated from those exports — never from user input).
  switch (filters.segment) {
    case "new":
      where.push(`COALESCE(a.o_count, 0) < ${RECURRING_MIN_ORDERS}`);
      break;
    case "recurring":
      where.push(`COALESCE(a.o_count, 0) >= ${RECURRING_MIN_ORDERS}`);
      break;
    case "vip":
      where.push(
        `(COALESCE(a.o_count, 0) >= ${VIP_MIN_ORDERS} OR COALESCE(a.ltv_cents, 0) >= ${VIP_MIN_LTV_CENTS})`,
      );
      break;
    case "at_risk":
      where.push(`(COALESCE(a.o_count, 0) >= ${RECURRING_MIN_ORDERS} AND a.last_order_at < ?)`);
      params.push(atRiskCutoffIso(now));
      break;
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const ORDER_BY: Record<CustomerSort, string> = {
    last_order: "a.last_order_at IS NULL, a.last_order_at DESC, c.id DESC",
    ltv: "COALESCE(a.ltv_cents, 0) DESC, c.id DESC",
    orders: "COALESCE(a.o_count, 0) DESC, c.id DESC",
    name: "c.name COLLATE NOCASE ASC, c.id ASC",
  };
  const orderBy = ORDER_BY[filters.sort ?? "last_order"];

  const limit = Math.min(Math.max(filters.limit ?? 50, 1), 200);
  const offset = filters.cursor ? decodeOffset(filters.cursor) : 0;

  const rows = db
    .prepare(
      `SELECT c.*,
              COALESCE(a.o_count, 0)    AS o_count,
              COALESCE(a.ltv_cents, 0)  AS ltv_cents,
              COALESCE(a.paid_count, 0) AS paid_count,
              a.first_order_at, a.last_order_at
       ${AGG_JOIN}
       ${whereSql}
       ORDER BY ${orderBy}
       LIMIT ? OFFSET ?`,
    )
    .all(...params, limit + 1, offset) as AggRow[];

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? encodeOffset(offset + limit) : null;

  const tagsByCustomer = new Map<string, string[]>();
  const ids = page.map((r) => r.id);
  if (ids.length) {
    const tagRows = db
      .prepare(
        `SELECT customer_id, tag FROM customer_tags
         WHERE customer_id IN (${ids.map(() => "?").join(",")})
         ORDER BY tag`,
      )
      .all(...ids) as Array<{ customer_id: string; tag: string }>;
    for (const tr of tagRows) {
      const list = tagsByCustomer.get(tr.customer_id) ?? [];
      list.push(tr.tag);
      tagsByCustomer.set(tr.customer_id, list);
    }
  }

  const customers: CustomerListItem[] = page.map((r) => ({
    ...rowToCustomer(r),
    metrics: metricsFromAggregate(
      {
        orderCount: r.o_count,
        ltvCents: r.ltv_cents,
        paidOrderCount: r.paid_count,
        firstOrderAt: r.first_order_at,
        lastOrderAt: r.last_order_at,
      },
      now,
      { firstSeenAt: r.first_seen_at, lastSeenAt: r.last_seen_at },
    ),
    tags: tagsByCustomer.get(r.id) ?? [],
  }));

  return { customers, stats: customerStats(now), nextCursor };
}

export function customerStats(now: Date = new Date()): CustomerListStats {
  runMigrations();
  const db = getDb();
  const total = (db.prepare("SELECT COUNT(*) AS n FROM customers").get() as { n: number }).n;
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const newThisMonth = (
    db.prepare("SELECT COUNT(*) AS n FROM customers WHERE first_seen_at >= ?").get(monthStart) as {
      n: number;
    }
  ).n;
  const row = db
    .prepare(
      `SELECT SUM(CASE WHEN o_count >= ${RECURRING_MIN_ORDERS} THEN 1 ELSE 0 END) AS repeat_n,
              SUM(CASE WHEN o_count >= ${RECURRING_MIN_ORDERS} AND last_order_at < ? THEN 1 ELSE 0 END) AS at_risk_n
       FROM (SELECT COALESCE(a.o_count, 0) AS o_count, a.last_order_at ${AGG_JOIN})`,
    )
    .get(atRiskCutoffIso(now)) as { repeat_n: number | null; at_risk_n: number | null };
  return {
    total,
    newThisMonth,
    repeatRatePct: total > 0 ? Math.round(((row.repeat_n ?? 0) / total) * 100) : 0,
    atRiskCount: row.at_risk_n ?? 0,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- tests/unit/customer-storage-crm.test.ts
```
Expected: PASS (all describes in the file).

- [ ] **Step 5: Commit**

```bash
git add lib/customer-storage.ts tests/unit/customer-storage-crm.test.ts
git commit -m "feat(crm): customer list query with segments, sorts, tags + header stats

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: API — `GET /api/admin/customers` (list)

**Files:**
- Create: `app/api/admin/customers/route.ts`
- Test: `tests/unit/api-admin-customers-list.test.ts`

Note: `app/api/admin/customers/` already contains `lookup/` and `search/` subfolders. Adding `route.ts` at the folder root is additive and does not affect them.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/api-admin-customers-list.test.ts`.

IMPORTANT: the route uses real `new Date()` internally, so seeds here are relative to runtime now (NOT the fixed NOW used in storage tests).

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { addTag } from "@/lib/customer-storage";
import { GET } from "@/app/api/admin/customers/route";

const DAY = 86_400_000;

beforeEach(() => { vi.stubEnv("SQLITE_FILE", ":memory:"); runMigrations(); });
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

function seedCustomer(id: string, name: string, phone: string) {
  const seen = new Date(Date.now() - 200 * DAY).toISOString();
  getDb().prepare(
    `INSERT INTO customers (id, name, phone, order_count, first_seen_at, last_seen_at)
     VALUES (?, ?, ?, 0, ?, ?)`,
  ).run(id, name, phone, seen, seen);
}

function seedOrder(id: string, customerId: string, daysAgo: number, paidCents: number) {
  const at = new Date(Date.now() - daysAgo * DAY).toISOString();
  getDb().prepare(
    `INSERT INTO orders (id, locale, source, customer_id, recipient_name, recipient_phone,
       contact_phone, fulfillment_method, lines_json, subtotal_cents, delivery_cents,
       tax_cents, total_cents, amount_paid_cents, fulfillment_status, payment_status,
       created_at, updated_at)
     VALUES (?, 'es', 'walk-in', ?, 'R', '1', '1', 'pickup', '[]', 0, 0, 0, ?, ?,
       'pending', 'paid', ?, ?)`,
  ).run(id, customerId, paidCents, paidCents, at, at);
}

function seed() {
  seedCustomer("ana", "Ana", "5550001");
  seedCustomer("bob", "Bob", "5550002");
  [1, 2, 3, 4, 5].forEach((d) => seedOrder(`a${d}`, "ana", d, 12000)); // VIP
  seedOrder("b1", "bob", 100, 8000);
  seedOrder("b2", "bob", 150, 8000); // at-risk
}

it("returns customers with metrics, tags, stats, nextCursor", async () => {
  seed();
  addTag("ana", "boda");
  const res = await GET(new Request("http://x/api/admin/customers"));
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.customers).toHaveLength(2);
  const ana = body.customers.find((c: { id: string }) => c.id === "ana");
  expect(ana.metrics.segment).toBe("vip");
  expect(ana.metrics.ltvCents).toBe(60000);
  expect(ana.tags).toEqual(["boda"]);
  expect(body.stats.total).toBe(2);
  expect(body.nextCursor).toBeNull();
});

it("applies q, segment, sort, and limit params", async () => {
  seed();
  const filtered = await (await GET(new Request("http://x/api/admin/customers?q=ana"))).json();
  expect(filtered.customers.map((c: { id: string }) => c.id)).toEqual(["ana"]);

  const atRisk = await (await GET(new Request("http://x/api/admin/customers?segment=at_risk"))).json();
  expect(atRisk.customers.map((c: { id: string }) => c.id)).toEqual(["bob"]);

  const paged = await (await GET(new Request("http://x/api/admin/customers?sort=name&limit=1"))).json();
  expect(paged.customers.map((c: { id: string }) => c.id)).toEqual(["ana"]);
  expect(paged.nextCursor).toBeTruthy();
});

it("ignores invalid segment/sort values instead of erroring", async () => {
  seed();
  const res = await GET(new Request("http://x/api/admin/customers?segment=bogus&sort=bogus"));
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.customers).toHaveLength(2);
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/unit/api-admin-customers-list.test.ts
```
Expected: FAIL — cannot resolve `@/app/api/admin/customers/route`.

- [ ] **Step 3: Write the route**

Create `app/api/admin/customers/route.ts`:

```ts
import { NextResponse } from "next/server";
import {
  listCustomers,
  type CustomerListFilters,
  type CustomerSegmentFilter,
  type CustomerSort,
} from "@/lib/customer-storage";

export const runtime = "nodejs";

const SEGMENTS = new Set<string>(["new", "recurring", "vip", "at_risk"]);
const SORTS = new Set<string>(["last_order", "ltv", "orders", "name"]);

export async function GET(req: Request): Promise<Response> {
  const sp = new URL(req.url).searchParams;
  const segment = sp.get("segment");
  const sort = sp.get("sort");
  const filters: CustomerListFilters = {
    q: sp.get("q") ?? undefined,
    segment: segment && SEGMENTS.has(segment) ? (segment as CustomerSegmentFilter) : undefined,
    tag: sp.get("tag") ?? undefined,
    sort: sort && SORTS.has(sort) ? (sort as CustomerSort) : undefined,
    cursor: sp.get("cursor") ?? undefined,
    limit: sp.get("limit") ? Number(sp.get("limit")) : undefined,
  };
  return NextResponse.json(listCustomers(filters));
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- tests/unit/api-admin-customers-list.test.ts
```
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/customers/route.ts tests/unit/api-admin-customers-list.test.ts
git commit -m "feat(crm): GET /api/admin/customers list endpoint

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: Profile composition + `GET`/`PATCH /api/admin/customers/[id]`

**Files:**
- Create: `lib/customer-profile.ts`
- Create: `schemas/customer-patch.ts`
- Create: `app/api/admin/customers/[id]/route.ts`
- Test: `tests/unit/api-admin-customers-detail.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/api-admin-customers-detail.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { addTag } from "@/lib/customer-storage";
import { GET, PATCH } from "@/app/api/admin/customers/[id]/route";

const DAY = 86_400_000;

beforeEach(() => { vi.stubEnv("SQLITE_FILE", ":memory:"); runMigrations(); });
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

function seed() {
  const seen = new Date(Date.now() - 60 * DAY).toISOString();
  getDb().prepare(
    `INSERT INTO customers (id, name, phone, email, order_count, first_seen_at, last_seen_at, notes)
     VALUES ('c1', 'Ana', '5551', 'ana@x.com', 2, ?, ?, 'sin lilies')`,
  ).run(seen, seen);
  for (const [id, daysAgo, cents] of [["o1", 30, 6000], ["o2", 5, 9000]] as const) {
    const at = new Date(Date.now() - daysAgo * DAY).toISOString();
    getDb().prepare(
      `INSERT INTO orders (id, locale, source, customer_id, recipient_name, recipient_phone,
         contact_phone, fulfillment_method, lines_json, subtotal_cents, delivery_cents,
         tax_cents, total_cents, amount_paid_cents, fulfillment_status, payment_status,
         created_at, updated_at)
       VALUES (?, 'es', 'walk-in', 'c1', 'R', '1', '1', 'pickup', '[]', 0, 0, 0, ?, ?,
         'delivered', 'paid', ?, ?)`,
    ).run(id, cents, cents, at, at);
  }
}

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

describe("GET /api/admin/customers/[id]", () => {
  it("returns customer (with notes), metrics, tags, and order history newest-first", async () => {
    seed();
    addTag("c1", "boda");
    const res = await GET(new Request("http://x"), ctx("c1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.customer.name).toBe("Ana");
    expect(body.customer.notes).toBe("sin lilies");
    expect(body.metrics.segment).toBe("recurring");
    expect(body.metrics.ltvCents).toBe(15000);
    expect(body.tags).toEqual(["boda"]);
    expect(body.orders.map((o: { id: string }) => o.id)).toEqual(["o2", "o1"]);
  });

  it("404s on unknown id", async () => {
    const res = await GET(new Request("http://x"), ctx("nope"));
    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/admin/customers/[id]", () => {
  it("updates notes and contact fields", async () => {
    seed();
    const res = await PATCH(
      new Request("http://x", {
        method: "PATCH",
        body: JSON.stringify({ notes: "tulipanes", name: "Ana María", email: "" }),
      }),
      ctx("c1"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.customer.notes).toBe("tulipanes");
    expect(body.customer.name).toBe("Ana María");
    expect(body.customer.email).toBeUndefined();
  });

  it("400s on invalid body and on empty patch", async () => {
    seed();
    const bad = await PATCH(
      new Request("http://x", { method: "PATCH", body: JSON.stringify({ notes: 123 }) }),
      ctx("c1"),
    );
    expect(bad.status).toBe(400);
    const empty = await PATCH(
      new Request("http://x", { method: "PATCH", body: JSON.stringify({}) }),
      ctx("c1"),
    );
    expect(empty.status).toBe(400);
  });

  it("404s on unknown id", async () => {
    const res = await PATCH(
      new Request("http://x", { method: "PATCH", body: JSON.stringify({ notes: "x" }) }),
      ctx("nope"),
    );
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/unit/api-admin-customers-detail.test.ts
```
Expected: FAIL — cannot resolve the route module.

- [ ] **Step 3: Write the three files**

Create `lib/customer-profile.ts` (separate module so customer-storage never imports order-storage — avoids any import-cycle risk):

```ts
import "server-only";
import { getCustomerById, listTagsFor, type Customer } from "@/lib/customer-storage";
import { listOrdersByCustomer } from "@/lib/order-storage";
import { computeMetrics, type CustomerMetrics } from "@/lib/customer-metrics";
import type { Order } from "@/types/order";

export type CustomerProfileData = {
  customer: Customer;
  metrics: CustomerMetrics;
  tags: string[];
  orders: Order[];
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
  return { customer, metrics, tags: listTagsFor(id), orders };
}
```

Create `schemas/customer-patch.ts`:

```ts
import { z } from "zod";

export const customerPatchSchema = z
  .object({
    notes: z.string().max(4000).optional(),
    name: z.string().trim().min(1).max(120).optional(),
    email: z.string().trim().email().or(z.literal("")).optional(),
    messagingChannel: z.enum(["sms", "whatsapp", "email", "none"]).optional(),
    locale: z.enum(["en", "es"]).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "empty_patch" });

export type CustomerPatchInput = z.infer<typeof customerPatchSchema>;

export const tagBodySchema = z.object({ tag: z.string().min(1).max(64) });
```

Create `app/api/admin/customers/[id]/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getCustomerProfile } from "@/lib/customer-profile";
import { getCustomerById, updateCustomer } from "@/lib/customer-storage";
import { customerPatchSchema } from "@/schemas/customer-patch";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx): Promise<Response> {
  const { id } = await params;
  const profile = getCustomerProfile(id);
  if (!profile) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(profile);
}

export async function PATCH(req: Request, { params }: Ctx): Promise<Response> {
  const { id } = await params;
  if (!getCustomerById(id)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const json = await req.json().catch(() => null);
  const parsed = customerPatchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ errors: parsed.error.flatten() }, { status: 400 });
  }
  const customer = updateCustomer(id, parsed.data);
  return NextResponse.json({ customer });
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- tests/unit/api-admin-customers-detail.test.ts
```
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/customer-profile.ts schemas/customer-patch.ts "app/api/admin/customers/[id]/route.ts" tests/unit/api-admin-customers-detail.test.ts
git commit -m "feat(crm): customer profile endpoint (GET) + editable fields (PATCH)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: API — `POST`/`DELETE /api/admin/customers/[id]/tags`

**Files:**
- Create: `app/api/admin/customers/[id]/tags/route.ts`
- Test: `tests/unit/api-admin-customers-tags.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/api-admin-customers-tags.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { POST, DELETE } from "@/app/api/admin/customers/[id]/tags/route";

beforeEach(() => { vi.stubEnv("SQLITE_FILE", ":memory:"); runMigrations(); });
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

function seed() {
  getDb().prepare(
    `INSERT INTO customers (id, name, phone, order_count, first_seen_at, last_seen_at)
     VALUES ('c1', 'Ana', '5551', 0, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')`,
  ).run();
}

const ctx = { params: Promise.resolve({ id: "c1" }) };
const req = (tag: unknown) =>
  new Request("http://x", { method: "POST", body: JSON.stringify({ tag }) });

describe("POST /tags", () => {
  it("adds a normalized tag idempotently", async () => {
    seed();
    const r1 = await POST(req("  Boda  Junio "), ctx);
    expect(r1.status).toBe(200);
    expect((await r1.json()).tags).toEqual(["boda junio"]);
    const r2 = await POST(req("boda junio"), ctx);
    expect((await r2.json()).tags).toEqual(["boda junio"]);
  });

  it("400s on empty/invalid tag", async () => {
    seed();
    expect((await POST(req("   "), ctx)).status).toBe(400);
    expect((await POST(req(42), ctx)).status).toBe(400);
  });

  it("404s on unknown customer", async () => {
    const res = await POST(req("boda"), { params: Promise.resolve({ id: "nope" }) });
    expect(res.status).toBe(404);
  });
});

describe("DELETE /tags", () => {
  it("removes a tag and returns the remaining list", async () => {
    seed();
    await POST(req("boda"), ctx);
    await POST(req("vip"), ctx);
    const res = await DELETE(req("boda"), ctx);
    expect(res.status).toBe(200);
    expect((await res.json()).tags).toEqual(["vip"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/unit/api-admin-customers-tags.test.ts
```
Expected: FAIL — cannot resolve the route module.

- [ ] **Step 3: Write the route**

Create `app/api/admin/customers/[id]/tags/route.ts`:

```ts
import { NextResponse } from "next/server";
import { addTag, getCustomerById, normalizeTag, removeTag } from "@/lib/customer-storage";
import { tagBodySchema } from "@/schemas/customer-patch";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

async function parseTag(req: Request): Promise<string | null> {
  const json = await req.json().catch(() => null);
  const parsed = tagBodySchema.safeParse(json);
  if (!parsed.success) return null;
  return normalizeTag(parsed.data.tag);
}

export async function POST(req: Request, { params }: Ctx): Promise<Response> {
  const { id } = await params;
  if (!getCustomerById(id)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const tag = await parseTag(req);
  if (!tag) return NextResponse.json({ error: "invalid_tag" }, { status: 400 });
  return NextResponse.json({ tags: addTag(id, tag) });
}

export async function DELETE(req: Request, { params }: Ctx): Promise<Response> {
  const { id } = await params;
  if (!getCustomerById(id)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const tag = await parseTag(req);
  if (!tag) return NextResponse.json({ error: "invalid_tag" }, { status: 400 });
  return NextResponse.json({ tags: removeTag(id, tag) });
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- tests/unit/api-admin-customers-tags.test.ts
```
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add "app/api/admin/customers/[id]/tags/route.ts" tests/unit/api-admin-customers-tags.test.ts
git commit -m "feat(crm): tag add/remove endpoints

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 9: i18n — `admin_customers` namespace + nav key

**Files:**
- Modify: `messages/es.json`
- Modify: `messages/en.json`

- [ ] **Step 1: Run the parity test to confirm the current baseline passes**

```bash
npm test -- tests/unit/i18n-parity.test.ts
```
Expected: PASS. (If it fails BEFORE your change, stop and report — do not proceed on a broken baseline.)

- [ ] **Step 2: Add the Spanish keys**

In `messages/es.json`:

**(a)** Inside the existing `"admin_dashboard"` object, next to the other `nav_*` keys, add:

```json
"nav_customers": "Clientes",
```

**(b)** As a new top-level namespace after `"admin_dashboard"` (order of top-level keys doesn't matter, but keep it adjacent to the other `admin_*` namespaces):

```json
"admin_customers": {
  "title": "Clientes",
  "back_to_dashboard": "Volver al panel",
  "search_placeholder": "Buscar por nombre, teléfono o email…",
  "stat_total": "Clientes",
  "stat_new_month": "Nuevos este mes",
  "stat_repeat_rate": "Repiten",
  "stat_at_risk": "En riesgo",
  "seg_all": "Todos",
  "seg_new": "Nuevos",
  "seg_recurring": "Recurrentes",
  "seg_vip": "VIP",
  "seg_at_risk": "En riesgo",
  "tag_filter_all": "Todas las etiquetas",
  "sort_label": "Ordenar por",
  "sort_last_order": "Última compra",
  "sort_ltv": "Total gastado",
  "sort_orders": "Nº de órdenes",
  "sort_name": "Nombre",
  "col_customer": "Cliente",
  "col_phone": "Teléfono",
  "col_orders": "Órdenes",
  "col_ltv": "Total gastado",
  "col_last_order": "Última compra",
  "badge_new": "Nuevo",
  "badge_recurring": "Recurrente",
  "badge_vip": "VIP",
  "badge_at_risk": "En riesgo",
  "empty": "No hay clientes que coincidan.",
  "load_more": "Cargar más",
  "never": "Nunca",
  "days_ago": "hace {days} días",
  "profile_contact": "Contacto",
  "call": "Llamar",
  "whatsapp": "WhatsApp",
  "channel_label": "Canal",
  "locale_label": "Idioma",
  "metric_ltv": "Total gastado",
  "metric_aov": "Ticket promedio",
  "metric_orders": "Órdenes",
  "metric_first_order": "Primera compra",
  "metric_last_order": "Última compra",
  "addresses": "Direcciones",
  "buyer_address": "Dirección del comprador",
  "delivery_address": "Última dirección de entrega",
  "no_address": "Sin dirección guardada",
  "notes": "Notas",
  "notes_placeholder": "Preferencias, avisos, contexto del cliente…",
  "save_notes": "Guardar notas",
  "notes_saved": "Guardado",
  "tags": "Etiquetas",
  "add_tag": "Añadir",
  "tag_placeholder": "nueva etiqueta",
  "order_history": "Historial de órdenes",
  "no_orders": "Aún no hay órdenes.",
  "items_count": "{count} artículos",
  "pay_paid": "Pagada",
  "pay_pending": "Pago pendiente",
  "pay_refunded": "Reembolsada",
  "new_order_cta": "Nueva orden para este cliente",
  "error_load": "No se pudo cargar. Intenta de nuevo.",
  "not_found": "Cliente no encontrado"
}
```

- [ ] **Step 3: Add the English keys**

In `messages/en.json`:

**(a)** Inside `"admin_dashboard"`, add:

```json
"nav_customers": "Customers",
```

**(b)** New namespace (same key set, English values):

```json
"admin_customers": {
  "title": "Customers",
  "back_to_dashboard": "Back to dashboard",
  "search_placeholder": "Search by name, phone, or email…",
  "stat_total": "Customers",
  "stat_new_month": "New this month",
  "stat_repeat_rate": "Repeat rate",
  "stat_at_risk": "At risk",
  "seg_all": "All",
  "seg_new": "New",
  "seg_recurring": "Returning",
  "seg_vip": "VIP",
  "seg_at_risk": "At risk",
  "tag_filter_all": "All tags",
  "sort_label": "Sort by",
  "sort_last_order": "Last order",
  "sort_ltv": "Total spent",
  "sort_orders": "Order count",
  "sort_name": "Name",
  "col_customer": "Customer",
  "col_phone": "Phone",
  "col_orders": "Orders",
  "col_ltv": "Total spent",
  "col_last_order": "Last order",
  "badge_new": "New",
  "badge_recurring": "Returning",
  "badge_vip": "VIP",
  "badge_at_risk": "At risk",
  "empty": "No customers match.",
  "load_more": "Load more",
  "never": "Never",
  "days_ago": "{days} days ago",
  "profile_contact": "Contact",
  "call": "Call",
  "whatsapp": "WhatsApp",
  "channel_label": "Channel",
  "locale_label": "Language",
  "metric_ltv": "Total spent",
  "metric_aov": "Average order",
  "metric_orders": "Orders",
  "metric_first_order": "First order",
  "metric_last_order": "Last order",
  "addresses": "Addresses",
  "buyer_address": "Buyer address",
  "delivery_address": "Last delivery address",
  "no_address": "No address on file",
  "notes": "Notes",
  "notes_placeholder": "Preferences, warnings, customer context…",
  "save_notes": "Save notes",
  "notes_saved": "Saved",
  "tags": "Tags",
  "add_tag": "Add",
  "tag_placeholder": "new tag",
  "order_history": "Order history",
  "no_orders": "No orders yet.",
  "items_count": "{count} items",
  "pay_paid": "Paid",
  "pay_pending": "Payment pending",
  "pay_refunded": "Refunded",
  "new_order_cta": "New order for this customer",
  "error_load": "Could not load. Try again.",
  "not_found": "Customer not found"
}
```

- [ ] **Step 4: Run the parity test**

```bash
npm test -- tests/unit/i18n-parity.test.ts
```
Expected: PASS — `missingInEs: [], missingInEn: []`.

- [ ] **Step 5: Commit**

```bash
git add messages/es.json messages/en.json
git commit -m "feat(crm): admin_customers i18n namespace (es/en) + nav key

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 10: Customers list page + nav entry

**Files:**
- Modify: `components/admin/dashboard/DashboardShell.tsx`
- Create: `components/admin/customers/SegmentBadge.tsx`
- Create: `components/admin/customers/CustomersList.tsx`
- Create: `app/[locale]/admin/customers/page.tsx`
- Test: `tests/unit/CustomersList.test.tsx`

- [ ] **Step 1: Write the failing component test**

Create `tests/unit/CustomersList.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import esMessages from "@/messages/es.json";
import CustomersList from "@/components/admin/customers/CustomersList";
import type { CustomerListResult } from "@/lib/customer-storage";

function wrap(ui: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="es" messages={esMessages as Record<string, unknown>}>
      {ui}
    </NextIntlClientProvider>,
  );
}

const initial: CustomerListResult = {
  customers: [
    {
      id: "ana", name: "Ana Flores", phone: "5165550001",
      orderCount: 6, firstSeenAt: "2026-01-01T00:00:00Z", lastSeenAt: "2026-07-01T00:00:00Z",
      tags: ["boda"],
      metrics: {
        ltvCents: 36000, orderCount: 6, paidOrderCount: 6, aovCents: 6000,
        firstOrderAt: "2026-01-01T00:00:00Z", lastOrderAt: "2026-07-01T00:00:00Z",
        daysSinceLastOrder: 3, segment: "vip", isVip: true, isAtRisk: false, isRecurring: true,
      },
    },
    {
      id: "bob", name: "Bob Marchetti", phone: "5165550002",
      orderCount: 2, firstSeenAt: "2026-01-01T00:00:00Z", lastSeenAt: "2026-03-01T00:00:00Z",
      tags: [],
      metrics: {
        ltvCents: 16000, orderCount: 2, paidOrderCount: 2, aovCents: 8000,
        firstOrderAt: "2026-01-01T00:00:00Z", lastOrderAt: "2026-03-01T00:00:00Z",
        daysSinceLastOrder: 125, segment: "at_risk", isVip: false, isAtRisk: true, isRecurring: true,
      },
    },
  ],
  stats: { total: 2, newThisMonth: 1, repeatRatePct: 100, atRiskCount: 1 },
  nextCursor: null,
};

describe("CustomersList", () => {
  it("renders stats, segment chips, and customer rows with metrics", () => {
    wrap(<CustomersList locale="es" initial={initial} allTags={["boda"]} />);
    expect(screen.getByText("Ana Flores")).toBeDefined();
    expect(screen.getByText("Bob Marchetti")).toBeDefined();
    expect(screen.getByText("$360.00")).toBeDefined();          // ana LTV
    expect(screen.getByText("Nuevos este mes")).toBeDefined();  // stats strip
    expect(screen.getByText("Todos")).toBeDefined();            // segment chip
    // "VIP" and "En riesgo" appear both as filter chips and as row badges/stat
    // labels, so assert on counts, not uniqueness:
    expect(screen.getAllByText("VIP").length).toBeGreaterThanOrEqual(2);       // chip + ana badge
    expect(screen.getAllByText("En riesgo").length).toBeGreaterThanOrEqual(2); // chip + bob badge + stat label
  });

  it("links each row to the customer profile", () => {
    wrap(<CustomersList locale="es" initial={initial} allTags={[]} />);
    const link = screen.getByRole("link", { name: /Ana Flores/ });
    expect(link.getAttribute("href")).toBe("/es/admin/customers/ana");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/unit/CustomersList.test.tsx
```
Expected: FAIL — cannot resolve `@/components/admin/customers/CustomersList`.

- [ ] **Step 3: Write `SegmentBadge`**

Create `components/admin/customers/SegmentBadge.tsx`:

```tsx
"use client";
import { useTranslations } from "next-intl";
import type { Segment } from "@/lib/customer-metrics";

const STYLES: Record<Segment, string> = {
  new: "bg-sky-50 text-sky-800",
  recurring: "bg-emerald-50 text-emerald-800",
  vip: "bg-amber-50 text-amber-800",
  at_risk: "bg-rose-50 text-rose-800",
};

export default function SegmentBadge({ segment }: { segment: Segment }) {
  const t = useTranslations("admin_customers");
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${STYLES[segment]}`}
    >
      {t(`badge_${segment}`)}
    </span>
  );
}
```

- [ ] **Step 4: Write `CustomersList`**

Create `components/admin/customers/CustomersList.tsx`:

```tsx
"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { formatDate } from "@/lib/format-datetime";
import type {
  CustomerListResult,
  CustomerSegmentFilter,
  CustomerSort,
} from "@/lib/customer-storage";
import SegmentBadge from "./SegmentBadge";

type Props = { locale: string; initial: CustomerListResult; allTags: string[] };

function money(c: number) { return `$${(c / 100).toFixed(2)}`; }

const SEGMENTS: Array<{ id: CustomerSegmentFilter | "all"; key: string }> = [
  { id: "all", key: "seg_all" },
  { id: "new", key: "seg_new" },
  { id: "recurring", key: "seg_recurring" },
  { id: "vip", key: "seg_vip" },
  { id: "at_risk", key: "seg_at_risk" },
];

const SORTS: Array<{ id: CustomerSort; key: string }> = [
  { id: "last_order", key: "sort_last_order" },
  { id: "ltv", key: "sort_ltv" },
  { id: "orders", key: "sort_orders" },
  { id: "name", key: "sort_name" },
];

export default function CustomersList({ locale, initial, allTags }: Props) {
  const t = useTranslations("admin_customers");
  const [q, setQ] = useState("");
  const [segment, setSegment] = useState<CustomerSegmentFilter | "all">("all");
  const [tag, setTag] = useState("");
  const [sort, setSort] = useState<CustomerSort>("last_order");
  const [data, setData] = useState<CustomerListResult>(initial);
  const [error, setError] = useState(false);
  const firstRender = useRef(true);

  function query(cursor?: string | null): string {
    const sp = new URLSearchParams();
    if (q.trim()) sp.set("q", q.trim());
    if (segment !== "all") sp.set("segment", segment);
    if (tag) sp.set("tag", tag);
    if (sort !== "last_order") sp.set("sort", sort);
    if (cursor) sp.set("cursor", cursor);
    return sp.toString();
  }

  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    const handle = setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch(`/api/admin/customers?${query()}`, { cache: "no-store" });
          if (!res.ok) throw new Error(String(res.status));
          setData((await res.json()) as CustomerListResult);
          setError(false);
        } catch {
          setError(true);
        }
      })();
    }, 250);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, segment, tag, sort]);

  async function loadMore() {
    if (!data.nextCursor) return;
    try {
      const res = await fetch(`/api/admin/customers?${query(data.nextCursor)}`, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const next = (await res.json()) as CustomerListResult;
      setData({ ...next, customers: [...data.customers, ...next.customers] });
    } catch {
      setError(true);
    }
  }

  const s = data.stats;
  const stats: Array<{ key: string; value: string }> = [
    { key: "stat_total", value: String(s.total) },
    { key: "stat_new_month", value: String(s.newThisMonth) },
    { key: "stat_repeat_rate", value: `${s.repeatRatePct}%` },
    { key: "stat_at_risk", value: String(s.atRiskCount) },
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h1 className="text-lg font-semibold">{t("title")}</h1>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {stats.map((st) => (
          <div key={st.key} className="rounded border border-ink/10 bg-bone p-3">
            <div className="text-xs uppercase tracking-wide text-ink/50">{t(st.key)}</div>
            <div className="text-xl font-semibold">{st.value}</div>
          </div>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("search_placeholder")}
          className="min-h-11 w-full max-w-xs rounded-lg border border-ink/20 bg-bone px-3 text-sm"
        />
        <div className="flex gap-1">
          {SEGMENTS.map((sg) => (
            <button
              key={sg.id}
              type="button"
              onClick={() => setSegment(sg.id)}
              className={`flex min-h-11 items-center rounded-lg px-3 text-sm ${
                segment === sg.id ? "bg-rouge text-bone" : "border border-ink/20 hover:bg-ink/5"
              }`}
            >
              {t(sg.key)}
            </button>
          ))}
        </div>
        {allTags.length > 0 && (
          <select
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            className="min-h-11 rounded-lg border border-ink/20 bg-bone px-2 text-sm"
          >
            <option value="">{t("tag_filter_all")}</option>
            {allTags.map((tg) => (
              <option key={tg} value={tg}>{tg}</option>
            ))}
          </select>
        )}
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as CustomerSort)}
          aria-label={t("sort_label")}
          className="ml-auto min-h-11 rounded-lg border border-ink/20 bg-bone px-2 text-sm"
        >
          {SORTS.map((so) => (
            <option key={so.id} value={so.id}>{t(so.key)}</option>
          ))}
        </select>
      </div>

      {error && <div className="mb-3 rounded bg-rose-50 p-3 text-sm text-rose-800">{t("error_load")}</div>}

      {data.customers.length === 0 ? (
        <div className="rounded border border-ink/10 bg-bone p-6 text-center text-sm text-ink/50">
          {t("empty")}
        </div>
      ) : (
        <div className="overflow-x-auto rounded border border-ink/10 bg-bone">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink/10 text-left text-xs uppercase tracking-wide text-ink/50">
                <th className="px-3 py-2">{t("col_customer")}</th>
                <th className="px-3 py-2">{t("col_phone")}</th>
                <th className="px-3 py-2 text-right">{t("col_orders")}</th>
                <th className="px-3 py-2 text-right">{t("col_ltv")}</th>
                <th className="px-3 py-2">{t("col_last_order")}</th>
              </tr>
            </thead>
            <tbody>
              {data.customers.map((c) => (
                <tr key={c.id} className="border-b border-ink/5 last:border-0 hover:bg-ink/5">
                  <td className="px-3 py-2">
                    <Link
                      href={`/${locale}/admin/customers/${c.id}`}
                      className="flex flex-wrap items-center gap-2 font-semibold"
                    >
                      {c.name}
                      <SegmentBadge segment={c.metrics.segment} />
                      {c.tags.map((tg) => (
                        <span key={tg} className="rounded-full bg-ink/5 px-2 py-0.5 text-xs text-ink/60">
                          {tg}
                        </span>
                      ))}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-ink/70">{c.phone}</td>
                  <td className="px-3 py-2 text-right">{c.metrics.orderCount}</td>
                  <td className="px-3 py-2 text-right font-semibold">{money(c.metrics.ltvCents)}</td>
                  <td className="px-3 py-2 text-ink/70">
                    {c.metrics.lastOrderAt ? formatDate(c.metrics.lastOrderAt, locale) : t("never")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data.nextCursor && (
        <div className="mt-3 text-center">
          <button
            type="button"
            onClick={loadMore}
            className="min-h-11 rounded-lg border border-ink/20 px-4 text-sm hover:bg-ink/5"
          >
            {t("load_more")}
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Write the page and nav entry**

Create `app/[locale]/admin/customers/page.tsx`:

```tsx
import DashboardShell from "@/components/admin/dashboard/DashboardShell";
import CustomersList from "@/components/admin/customers/CustomersList";
import { listAllTags, listCustomers } from "@/lib/customer-storage";

export const dynamic = "force-dynamic";

export default async function AdminCustomersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const initial = listCustomers({});
  const allTags = listAllTags();
  return (
    <DashboardShell locale={locale}>
      <CustomersList locale={locale} initial={initial} allTags={allTags} />
    </DashboardShell>
  );
}
```

Modify `components/admin/dashboard/DashboardShell.tsx`:

Replace:

```tsx
  const isGiftCards = pathname.includes("/admin/gift-cards");
  const isBandeja = !isLedger && !isRunSheet && !isSettings && !isGiftCards;
```

with:

```tsx
  const isGiftCards = pathname.includes("/admin/gift-cards");
  const isCustomers = pathname.includes("/admin/customers");
  const isBandeja = !isLedger && !isRunSheet && !isSettings && !isGiftCards && !isCustomers;
```

And after the Gift Cards `<Link>` (before the "Nueva orden" link), add:

```tsx
            <Link
              href={`/${locale}/admin/customers`}
              className={`flex min-h-11 items-center rounded-lg px-3 ${isCustomers ? "bg-rouge text-bone" : "hover:bg-ink/5"}`}
            >
              {t("nav_customers")}
            </Link>
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
npm test -- tests/unit/CustomersList.test.tsx tests/unit/i18n-parity.test.ts
```
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add "app/[locale]/admin/customers/page.tsx" components/admin/customers/ components/admin/dashboard/DashboardShell.tsx tests/unit/CustomersList.test.tsx
git commit -m "feat(crm): customers list screen + dashboard nav entry

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 11: Customer profile page, drawer cross-link, intake prefill

**Files:**
- Create: `components/admin/customers/CustomerProfile.tsx`
- Create: `app/[locale]/admin/customers/[id]/page.tsx`
- Modify: `components/admin/dashboard/OrderDetailDrawer.tsx` (contact name → profile link)
- Modify: `components/admin/intake/IntakeForm.tsx` (accept `?phone=` prefill)
- Test: `tests/unit/CustomerProfile.test.tsx`

- [ ] **Step 1: Write the failing component test**

Create `tests/unit/CustomerProfile.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import esMessages from "@/messages/es.json";
import CustomerProfile from "@/components/admin/customers/CustomerProfile";
import type { CustomerProfileData } from "@/lib/customer-profile";
import type { Order } from "@/types/order";

function wrap(ui: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="es" messages={esMessages as Record<string, unknown>}>
      {ui}
    </NextIntlClientProvider>,
  );
}

const order: Order = {
  id: "do_abc123", orderNumber: 1001, source: "walk-in", locale: "es", customerId: "c1",
  lines: [{ kind: "custom", title: "Ramo grande", priceCents: 6000, qty: 1 }],
  fulfillment: { method: "in-store", recipient: { name: "Ana", phone: "5551" } },
  contact: { name: "Ana", phone: "5551" },
  totals: { subtotalCents: 6000, deliveryCents: 0, taxCents: 0, totalCents: 6000 },
  status: "delivered", paymentStatus: "paid", amountPaidCents: 6000,
  createdAt: "2026-06-30T10:00:00Z", updatedAt: "2026-06-30T10:00:00Z",
};

const profile: CustomerProfileData = {
  customer: {
    id: "c1", name: "Ana Flores", phone: "5165550001", email: "ana@x.com",
    orderCount: 2, firstSeenAt: "2026-01-01T00:00:00Z", lastSeenAt: "2026-06-30T10:00:00Z",
    notes: "Prefiere tulipanes",
    lastAddress: { street1: "1 Main St", city: "Albertson", state: "NY", zip: "11507", country: "US" },
  },
  metrics: {
    ltvCents: 12000, orderCount: 2, paidOrderCount: 2, aovCents: 6000,
    firstOrderAt: "2026-05-01T10:00:00Z", lastOrderAt: "2026-06-30T10:00:00Z",
    daysSinceLastOrder: 4, segment: "recurring", isVip: false, isAtRisk: false, isRecurring: true,
  },
  tags: ["boda"],
  orders: [order],
};

describe("CustomerProfile", () => {
  it("renders header, metrics, notes, tags, and order history", () => {
    wrap(<CustomerProfile locale="es" initial={profile} />);
    expect(screen.getByText("Ana Flores")).toBeDefined();
    expect(screen.getByText("Recurrente")).toBeDefined();          // primary badge
    expect(screen.getByText("Ticket promedio")).toBeDefined();      // metrics row label
    expect(screen.getByText("$120.00")).toBeDefined();              // LTV
    expect(screen.getByDisplayValue("Prefiere tulipanes")).toBeDefined(); // notes textarea
    expect(screen.getByText("boda")).toBeDefined();                 // tag chip
    expect(screen.getByText("#1001")).toBeDefined();                // order row
    expect(screen.getByText("Historial de órdenes")).toBeDefined();
  });

  it("quick action links to intake with the phone prefilled", () => {
    wrap(<CustomerProfile locale="es" initial={profile} />);
    const link = screen.getByRole("link", { name: "Nueva orden para este cliente" });
    expect(link.getAttribute("href")).toBe("/es/admin/intake?phone=5165550001");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/unit/CustomerProfile.test.tsx
```
Expected: FAIL — cannot resolve `@/components/admin/customers/CustomerProfile`.

- [ ] **Step 3: Write `CustomerProfile`**

Create `components/admin/customers/CustomerProfile.tsx`:

```tsx
"use client";
import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, WhatsappLogo, Phone, X } from "@phosphor-icons/react/dist/ssr";
import { formatDate } from "@/lib/format-datetime";
import type { CustomerProfileData } from "@/lib/customer-profile";
import type { Address } from "@/types/address";
import type { Order } from "@/types/order";
import OrderDetailDrawer from "@/components/admin/dashboard/OrderDetailDrawer";
import SegmentBadge from "./SegmentBadge";

type Props = { locale: string; initial: CustomerProfileData };

function money(c: number) { return `$${(c / 100).toFixed(2)}`; }
function addressText(a: Address): string {
  return `${a.street1}${a.street2 ? `, ${a.street2}` : ""}, ${a.city}, ${a.state} ${a.zip}`;
}
function itemCount(o: Order): number {
  return o.lines.reduce((n, l) => n + l.qty, 0);
}

export default function CustomerProfile({ locale, initial }: Props) {
  const t = useTranslations("admin_customers");
  const [data, setData] = useState<CustomerProfileData>(initial);
  const [notesDraft, setNotesDraft] = useState(initial.customer.notes ?? "");
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);
  const [tagDraft, setTagDraft] = useState("");
  const [openOrderId, setOpenOrderId] = useState<string | null>(null);
  const [error, setError] = useState(false);

  const { customer, metrics, tags, orders } = data;
  const digits = customer.phone.replace(/\D/g, "");

  async function refresh() {
    try {
      const res = await fetch(`/api/admin/customers/${customer.id}`, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const next = (await res.json()) as CustomerProfileData;
      setData(next);
      setError(false);
    } catch {
      setError(true);
    }
  }

  async function saveNotes() {
    setSavingNotes(true);
    setNotesSaved(false);
    try {
      const res = await fetch(`/api/admin/customers/${customer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: notesDraft }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const body = (await res.json()) as { customer: CustomerProfileData["customer"] };
      setData((d) => ({ ...d, customer: body.customer }));
      setNotesSaved(true);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setSavingNotes(false);
    }
  }

  async function mutateTag(method: "POST" | "DELETE", tag: string) {
    try {
      const res = await fetch(`/api/admin/customers/${customer.id}/tags`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tag }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const body = (await res.json()) as { tags: string[] };
      setData((d) => ({ ...d, tags: body.tags }));
      setError(false);
    } catch {
      setError(true);
    }
  }

  const metricCards: Array<{ key: string; value: string }> = [
    { key: "metric_ltv", value: money(metrics.ltvCents) },
    { key: "metric_aov", value: money(metrics.aovCents) },
    { key: "metric_orders", value: String(metrics.orderCount) },
    {
      key: "metric_first_order",
      value: metrics.firstOrderAt ? formatDate(metrics.firstOrderAt, locale) : t("never"),
    },
    {
      key: "metric_last_order",
      value: metrics.lastOrderAt
        ? metrics.daysSinceLastOrder !== null
          ? `${formatDate(metrics.lastOrderAt, locale)} · ${t("days_ago", { days: metrics.daysSinceLastOrder })}`
          : formatDate(metrics.lastOrderAt, locale)
        : t("never"),
    },
  ];

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-3">
        <Link href={`/${locale}/admin/customers`} className="text-sm text-ink/60 underline">
          ← {t("title")}
        </Link>
      </div>

      {error && (
        <div className="mb-3 rounded bg-rose-50 p-3 text-sm text-rose-800">{t("error_load")}</div>
      )}

      <header className="mb-3 rounded border border-ink/10 bg-bone p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold">{customer.name}</h1>
          <SegmentBadge segment={metrics.segment} />
          {metrics.isVip && metrics.segment !== "vip" && <SegmentBadge segment="vip" />}
        </div>
        <div className="mt-2 text-sm text-ink/70">
          <span className="mr-2 text-xs uppercase tracking-wide text-ink/50">{t("profile_contact")}</span>
          <a href={`tel:${customer.phone}`} className="underline">{customer.phone}</a>
          {customer.email && (
            <> · <a href={`mailto:${customer.email}`} className="underline">{customer.email}</a></>
          )}
          {customer.messagingChannel && <> · {t("channel_label")}: {customer.messagingChannel}</>}
          {customer.locale && <> · {t("locale_label")}: {customer.locale.toUpperCase()}</>}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-wide text-ink/50">{t("tags")}</span>
          {tags.map((tg) => (
            <span
              key={tg}
              className="inline-flex items-center gap-1 rounded-full bg-ink/5 px-2 py-0.5 text-xs text-ink/70"
            >
              {tg}
              <button
                type="button"
                aria-label={`${t("tags")}: ${tg} ×`}
                onClick={() => void mutateTag("DELETE", tg)}
                className="text-ink/40 hover:text-ink"
              >
                <X size={12} weight="bold" />
              </button>
            </span>
          ))}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (tagDraft.trim()) {
                void mutateTag("POST", tagDraft);
                setTagDraft("");
              }
            }}
            className="flex items-center gap-1"
          >
            <input
              value={tagDraft}
              onChange={(e) => setTagDraft(e.target.value)}
              placeholder={t("tag_placeholder")}
              className="h-8 rounded border border-ink/20 bg-bone px-2 text-xs"
            />
            <button
              type="submit"
              className="flex h-8 items-center gap-1 rounded border border-ink/20 px-2 text-xs hover:bg-ink/5"
            >
              <Plus size={12} weight="bold" /> {t("add_tag")}
            </button>
          </form>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href={`/${locale}/admin/intake?phone=${encodeURIComponent(customer.phone)}`}
            className="flex min-h-11 items-center gap-1 rounded-lg bg-rouge px-3 text-sm text-bone"
          >
            <Plus size={16} weight="bold" /> {t("new_order_cta")}
          </Link>
          <a
            href={`https://wa.me/${digits}`}
            target="_blank"
            rel="noreferrer"
            className="flex min-h-11 items-center gap-1 rounded-lg border border-ink/20 px-3 text-sm hover:bg-ink/5"
          >
            <WhatsappLogo size={16} weight="bold" /> {t("whatsapp")}
          </a>
          <a
            href={`tel:${customer.phone}`}
            className="flex min-h-11 items-center gap-1 rounded-lg border border-ink/20 px-3 text-sm hover:bg-ink/5"
          >
            <Phone size={16} weight="bold" /> {t("call")}
          </a>
        </div>
      </header>

      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {metricCards.map((mc) => (
          <div key={mc.key} className="rounded border border-ink/10 bg-bone p-3">
            <div className="text-xs uppercase tracking-wide text-ink/50">{t(mc.key)}</div>
            <div className="text-sm font-semibold">{mc.value}</div>
          </div>
        ))}
      </div>

      <section className="mb-3 rounded border border-ink/10 bg-bone p-3 text-sm">
        <div className="mb-1 text-xs uppercase tracking-wide text-ink/50">{t("addresses")}</div>
        <div>
          <span className="text-ink/50">{t("buyer_address")}: </span>
          {customer.buyerAddress ? addressText(customer.buyerAddress) : t("no_address")}
        </div>
        <div>
          <span className="text-ink/50">{t("delivery_address")}: </span>
          {customer.lastAddress ? (
            <a
              href={`https://maps.google.com/?q=${encodeURIComponent(addressText(customer.lastAddress))}`}
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              {addressText(customer.lastAddress)}
            </a>
          ) : (
            t("no_address")
          )}
        </div>
      </section>

      <section className="mb-3 rounded border border-ink/10 bg-bone p-3">
        <label htmlFor="crm-notes" className="mb-1 block text-xs uppercase tracking-wide text-ink/50">
          {t("notes")}
        </label>
        <textarea
          id="crm-notes"
          value={notesDraft}
          onChange={(e) => { setNotesDraft(e.target.value); setNotesSaved(false); }}
          placeholder={t("notes_placeholder")}
          rows={4}
          className="w-full rounded border border-ink/20 bg-bone p-2 text-sm"
        />
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            disabled={savingNotes}
            onClick={() => void saveNotes()}
            className="min-h-11 rounded-lg bg-rouge px-4 text-sm text-bone disabled:opacity-50"
          >
            {t("save_notes")}
          </button>
          {notesSaved && <span className="text-xs text-emerald-700">{t("notes_saved")}</span>}
        </div>
      </section>

      <section className="mb-3 rounded border border-ink/10 bg-bone p-3">
        <div className="mb-2 text-xs uppercase tracking-wide text-ink/50">{t("order_history")}</div>
        {orders.length === 0 ? (
          <div className="text-sm text-ink/50">{t("no_orders")}</div>
        ) : (
          <div className="flex flex-col gap-1">
            {orders.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => setOpenOrderId(o.id)}
                className="flex w-full flex-wrap items-center justify-between gap-2 rounded border border-ink/10 px-3 py-2 text-left text-sm hover:bg-ink/5"
              >
                <span className="font-semibold">#{o.orderNumber ?? o.id.slice(-6)}</span>
                <span className="text-ink/60">{formatDate(o.createdAt, locale)}</span>
                <span className="text-ink/60">{t("items_count", { count: itemCount(o) })}</span>
                <span
                  className={
                    o.paymentStatus === "paid"
                      ? "text-emerald-700"
                      : o.paymentStatus === "refunded"
                        ? "text-ink/50"
                        : "text-amber-700"
                  }
                >
                  {t(`pay_${o.paymentStatus}`)}
                </span>
                <span className="font-semibold">{money(o.totals.totalCents)}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      {openOrderId && (
        <OrderDetailDrawer
          orderId={openOrderId}
          onClose={() => setOpenOrderId(null)}
          onChanged={() => void refresh()}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Write the profile page**

Create `app/[locale]/admin/customers/[id]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import DashboardShell from "@/components/admin/dashboard/DashboardShell";
import CustomerProfile from "@/components/admin/customers/CustomerProfile";
import { getCustomerProfile } from "@/lib/customer-profile";

export const dynamic = "force-dynamic";

export default async function AdminCustomerProfilePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const profile = getCustomerProfile(id);
  if (!profile) notFound();
  return (
    <DashboardShell locale={locale}>
      <CustomerProfile locale={locale} initial={profile} />
    </DashboardShell>
  );
}
```

- [ ] **Step 5: Cross-link the drawer contact name**

In `components/admin/dashboard/OrderDetailDrawer.tsx`:

**(a)** Add to the imports at the top:

```tsx
import Link from "next/link";
```

**(b)** Replace (around line 154):

```tsx
          <div className="font-semibold">{customer?.name ?? f.recipient.name}</div>
```

with:

```tsx
          <div className="font-semibold">
            {customer ? (
              <Link
                href={`/${locale}/admin/customers/${customer.id}`}
                className="underline decoration-ink/30 underline-offset-2 hover:decoration-ink"
              >
                {customer.name}
              </Link>
            ) : (
              f.recipient.name
            )}
          </div>
```

(`locale` already exists in the component via `useLocale()`.)

- [ ] **Step 6: Intake `?phone=` prefill**

In `components/admin/intake/IntakeForm.tsx`, directly after the existing line

```tsx
  const okOrderId = searchParams.get("ok");
```

add:

```tsx
  const prefillPhone = searchParams.get("phone");
```

Then, next to the component's other `useEffect` hooks, add (runs once on mount; the existing `CustomerBlock` lookup effect autofills name/email once the phone is set):

```tsx
  useEffect(() => {
    if (prefillPhone) {
      setCustomer((c) => (c.phone ? c : { ...c, phone: prefillPhone }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
```

- [ ] **Step 7: Run tests to verify they pass**

```bash
npm test -- tests/unit/CustomerProfile.test.tsx tests/unit/CustomersList.test.tsx
```
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add "app/[locale]/admin/customers/[id]/page.tsx" components/admin/customers/CustomerProfile.tsx components/admin/dashboard/OrderDetailDrawer.tsx components/admin/intake/IntakeForm.tsx tests/unit/CustomerProfile.test.tsx
git commit -m "feat(crm): customer profile screen, drawer cross-link, intake phone prefill

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 12: Full verification — types, suite, build, preview

**Files:** none (verification only)

- [ ] **Step 1: Typecheck**

```bash
export PATH="/opt/homebrew/bin:$PATH"
npx tsc --noEmit
```
Expected: no errors. Fix any type errors introduced by this work before proceeding.

- [ ] **Step 2: Full test suite**

```bash
npm test 2>&1 | tail -30
```
Expected: every `customer*`/`api-admin-customers*`/`CustomersList`/`CustomerProfile`/`i18n-parity` test passes. The suite has known-noisy baseline failures unrelated to this work — if unsure whether a failure is pre-existing, check with `git stash && npm test -- <file> && git stash pop`. **No NEW failures allowed.**

- [ ] **Step 3: Build**

```bash
npm run build
```
Expected: build completes without errors.

- [ ] **Step 4: Preview verification (both locales)**

Start the dev server (use the preview tooling if available, else `npm run dev`) and verify with an admin session (login at `/es/admin/login`, password from `INTAKE_PASSWORD` in `.env.local`):

1. `/es/admin/dashboard` — nav shows **Clientes**; Bandeja tab still highlights correctly.
2. `/es/admin/customers` — stats strip, search, segment chips, sort work against the dev DB.
3. Click a customer → profile renders: badges, metrics, addresses, notes, tags, order history.
4. Edit notes → Guardar → reload page → notes persisted.
5. Add tag `prueba`, remove it.
6. Click an order row → `OrderDetailDrawer` opens; the contact name inside links back to the profile.
7. "Nueva orden para este cliente" → intake opens with the phone filled and autofill kicks in.
8. Switch to `/en/admin/customers` — all strings render in English (no raw keys anywhere).

- [ ] **Step 5: Final commit (only if the preview pass required fixes)**

```bash
git add -A && git commit -m "fix(crm): post-preview polish

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

**Reminder for the operator:** production runs on a separate Hostinger Node host that is NOT auto-deployed from GitHub — pushing/merging does not update the live dashboard. Deploy there separately (migration 012 auto-applies on first boot).
