# Ops dashboard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a two-tab admin dashboard at `/[locale]/admin/dashboard` (Bandeja for live queue + 24h feed, Libro for searchable history) with inline actions: mark paid manual, advance fulfillment, resend messages, contact customer, internal notes.

**Architecture:** Server reads from the existing SQLite `orders` table (already populated by web checkout + intake form). New `order_acknowledgments` table drives the "web order seen" triage rule. Pure REST endpoints under `app/api/admin/orders/`. Client polls every 20s when tab is visible. UI in Spanish only, responsive across iPad and desktop.

**Tech Stack:** Next.js 16 App Router (`[locale]` group), React 19, TypeScript, `node:sqlite` (via `getDb()`), Vitest + Testing Library, Tailwind (existing tokens), next-intl is used elsewhere but dashboard copy is hardcoded Spanish.

**Spec:** [docs/superpowers/specs/2026-05-25-ops-dashboard-design.md](../specs/2026-05-25-ops-dashboard-design.md)

**Status enum mapping (UI label → DB value):** Pendiente=`pending`, Preparando=`preparing`, En camino=`out-for-delivery`, Entregada=`delivered`, Fallida=`failed`, Cancelada=`canceled`. The button "📦 Preparar" advances `pending → preparing`. "🚚 En camino" advances to `out-for-delivery`. "✓ Entregada" advances to `delivered`.

---

## Task 1: SQL migration — acknowledgments table + missing index

**Files:**
- Create: `db/migrations/003_dashboard.sql`

- [ ] **Step 1: Verify existing indexes in 001_init.sql**

Run: `grep "idx_orders" db/migrations/001_init.sql`
Expected: see `idx_orders_created_at`, `idx_orders_payment_status`, `idx_orders_window_date`, `idx_orders_customer`, `idx_orders_stripe_pi`. Confirms we only need to add `idx_orders_fulfillment_status`.

- [ ] **Step 2: Create the migration**

```sql
-- 003_dashboard.sql
CREATE TABLE IF NOT EXISTS order_acknowledgments (
  order_id          TEXT PRIMARY KEY,
  acknowledged_at   TEXT NOT NULL,
  acknowledged_by   TEXT NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id)
);

CREATE INDEX IF NOT EXISTS idx_orders_fulfillment_status ON orders(fulfillment_status);
```

- [ ] **Step 3: Verify migration applies cleanly**

Run: `rm -f data/diva.sqlite && NODE_OPTIONS='--experimental-sqlite' tsx -e "import('./lib/db-migrate.ts').then(m=>m.runMigrations())"`
Expected: three `migration_applied` log lines (001, 002, 003), no errors. The dev DB is recreated.

- [ ] **Step 4: Commit**

```bash
git add db/migrations/003_dashboard.sql
git commit -m "feat(db): add order_acknowledgments table for dashboard triage"
```

---

## Task 2: Acknowledgments storage

**Files:**
- Create: `lib/order-acknowledgments.ts`
- Test: `tests/unit/order-acknowledgments.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/unit/order-acknowledgments.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { acknowledgeOrder, isAcknowledged, listAcknowledgedIds } from "@/lib/order-acknowledgments";

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  runMigrations();
});
afterEach(() => {
  closeDb();
  vi.unstubAllEnvs();
});

function seedOrder(id: string) {
  getDb().prepare(
    `INSERT INTO orders (id, locale, source, recipient_name, recipient_phone, contact_phone,
       fulfillment_method, lines_json, subtotal_cents, delivery_cents, tax_cents, total_cents,
       fulfillment_status, payment_status, created_at, updated_at)
     VALUES (?, 'es','web','R','555','555','delivery','[]',0,0,0,0,'pending','pending',?,?)`,
  ).run(id, "2026-05-25T10:00:00Z", "2026-05-25T10:00:00Z");
}

describe("order-acknowledgments", () => {
  it("acknowledges an order and reports it as acknowledged", () => {
    seedOrder("o1");
    acknowledgeOrder("o1", "maky");
    expect(isAcknowledged("o1")).toBe(true);
  });

  it("returns false for unacknowledged orders", () => {
    seedOrder("o2");
    expect(isAcknowledged("o2")).toBe(false);
  });

  it("is idempotent — second ack does not throw", () => {
    seedOrder("o3");
    acknowledgeOrder("o3", "maky");
    expect(() => acknowledgeOrder("o3", "maky")).not.toThrow();
    expect(isAcknowledged("o3")).toBe(true);
  });

  it("lists acknowledged ids from a candidate set", () => {
    seedOrder("o4"); seedOrder("o5"); seedOrder("o6");
    acknowledgeOrder("o4", "maky");
    acknowledgeOrder("o6", "maky");
    const acked = listAcknowledgedIds(["o4", "o5", "o6"]);
    expect(acked.sort()).toEqual(["o4", "o6"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/order-acknowledgments.test.ts`
Expected: FAIL — `Cannot find module '@/lib/order-acknowledgments'`.

- [ ] **Step 3: Implement the module**

```ts
// lib/order-acknowledgments.ts
import "server-only";
import { getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";

function ensure() { runMigrations(); }

export function acknowledgeOrder(orderId: string, by: string): void {
  ensure();
  getDb().prepare(
    `INSERT INTO order_acknowledgments (order_id, acknowledged_at, acknowledged_by)
     VALUES (?, ?, ?)
     ON CONFLICT(order_id) DO NOTHING`,
  ).run(orderId, new Date().toISOString(), by);
}

export function isAcknowledged(orderId: string): boolean {
  ensure();
  const row = getDb()
    .prepare("SELECT 1 AS one FROM order_acknowledgments WHERE order_id = ?")
    .get(orderId) as { one: number } | undefined;
  return !!row;
}

export function listAcknowledgedIds(orderIds: string[]): string[] {
  if (orderIds.length === 0) return [];
  ensure();
  const placeholders = orderIds.map(() => "?").join(",");
  const rows = getDb()
    .prepare(`SELECT order_id FROM order_acknowledgments WHERE order_id IN (${placeholders})`)
    .all(...orderIds) as { order_id: string }[];
  return rows.map((r) => r.order_id);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/order-acknowledgments.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/order-acknowledgments.ts tests/unit/order-acknowledgments.test.ts
git commit -m "feat(dashboard): acknowledgments storage for web-order triage"
```

---

## Task 3: Order list query (extend order-storage)

**Files:**
- Modify: `lib/order-storage.ts`
- Test: `tests/unit/order-storage-list.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/unit/order-storage-list.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { listOrders, type ListOrdersFilters } from "@/lib/order-storage";

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("ORDER_STORAGE_FILE", "/tmp/diva-test-orders-" + process.pid + ".json");
  runMigrations();
});
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

function seed(id: string, opts: Partial<{
  source: string; paymentStatus: string; fulfillmentStatus: string;
  fulfillmentMethod: string; windowDate: string | null; createdAt: string;
  recipientName: string; recipientPhone: string; contactEmail: string;
  cardMessage: string;
}> = {}) {
  getDb().prepare(
    `INSERT INTO orders (id, locale, source, recipient_name, recipient_phone, contact_email,
       contact_phone, fulfillment_method, window_date, card_message, lines_json,
       subtotal_cents, delivery_cents, tax_cents, total_cents,
       fulfillment_status, payment_status, created_at, updated_at)
     VALUES (?, 'es', ?, ?, ?, ?, '5165550100', ?, ?, ?, '[]', 0, 0, 0, 0, ?, ?, ?, ?)`,
  ).run(
    id, opts.source ?? "web", opts.recipientName ?? "Test",
    opts.recipientPhone ?? "5165550100", opts.contactEmail ?? null,
    opts.fulfillmentMethod ?? "delivery", opts.windowDate ?? "2026-05-26",
    opts.cardMessage ?? null, opts.fulfillmentStatus ?? "pending",
    opts.paymentStatus ?? "pending", opts.createdAt ?? "2026-05-25T10:00:00Z",
    opts.createdAt ?? "2026-05-25T10:00:00Z",
  );
}

describe("listOrders", () => {
  it("returns orders sorted by created_at DESC", async () => {
    seed("a", { createdAt: "2026-05-25T08:00:00Z" });
    seed("b", { createdAt: "2026-05-25T10:00:00Z" });
    seed("c", { createdAt: "2026-05-25T09:00:00Z" });
    const r = await listOrders({});
    expect(r.orders.map(o => o.id)).toEqual(["b", "c", "a"]);
  });

  it("filters by paymentStatus", async () => {
    seed("a", { paymentStatus: "paid" });
    seed("b", { paymentStatus: "pending" });
    const r = await listOrders({ paymentStatus: ["paid"] });
    expect(r.orders.map(o => o.id)).toEqual(["a"]);
  });

  it("filters by source", async () => {
    seed("a", { source: "web" });
    seed("b", { source: "walk-in" });
    seed("c", { source: "phone" });
    const r = await listOrders({ source: ["walk-in", "phone"] });
    expect(r.orders.map(o => o.id).sort()).toEqual(["b", "c"]);
  });

  it("filters by date range", async () => {
    seed("a", { createdAt: "2026-05-20T00:00:00Z" });
    seed("b", { createdAt: "2026-05-25T00:00:00Z" });
    seed("c", { createdAt: "2026-05-30T00:00:00Z" });
    const r = await listOrders({ from: "2026-05-22T00:00:00Z", to: "2026-05-28T00:00:00Z" });
    expect(r.orders.map(o => o.id)).toEqual(["b"]);
  });

  it("free-text search hits recipient name, phone, id, card message", async () => {
    seed("ord_xyz", { recipientName: "Maria Lopez", cardMessage: "Feliz cumple" });
    seed("ord_abc", { recipientName: "John", cardMessage: null as unknown as string });
    expect((await listOrders({ q: "Lopez" })).orders.map(o => o.id)).toEqual(["ord_xyz"]);
    expect((await listOrders({ q: "cumple" })).orders.map(o => o.id)).toEqual(["ord_xyz"]);
    expect((await listOrders({ q: "ord_abc" })).orders.map(o => o.id)).toEqual(["ord_abc"]);
  });

  it("paginates with cursor", async () => {
    for (let i = 0; i < 5; i++) {
      seed(`o${i}`, { createdAt: `2026-05-25T1${i}:00:00Z` });
    }
    const first = await listOrders({ limit: 2 });
    expect(first.orders.map(o => o.id)).toEqual(["o4", "o3"]);
    expect(first.nextCursor).toBeTruthy();
    const second = await listOrders({ limit: 2, cursor: first.nextCursor ?? undefined });
    expect(second.orders.map(o => o.id)).toEqual(["o2", "o1"]);
  });

  it("returns approxTotal independent of pagination", async () => {
    for (let i = 0; i < 5; i++) seed(`o${i}`);
    const r = await listOrders({ limit: 2 });
    expect(r.approxTotal).toBe(5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/order-storage-list.test.ts`
Expected: FAIL — `listOrders` not exported.

- [ ] **Step 3: Implement listOrders in order-storage.ts**

Append to `lib/order-storage.ts`:

```ts
import { rowToOrder, type OrderRow } from "@/lib/order-row";

export type ListOrdersFilters = {
  q?: string;
  from?: string;
  to?: string;
  paymentStatus?: string[];
  fulfillmentStatus?: string[];
  source?: string[];
  fulfillmentMethod?: string[];
  limit?: number;
  cursor?: string; // base64(`${createdAt}|${id}`)
};

export type ListOrdersResult = {
  orders: import("@/types/order").Order[];
  nextCursor: string | null;
  approxTotal: number;
};

function encodeCursor(createdAt: string, id: string): string {
  return Buffer.from(`${createdAt}|${id}`, "utf8").toString("base64url");
}
function decodeCursor(c: string): { createdAt: string; id: string } | null {
  try {
    const s = Buffer.from(c, "base64url").toString("utf8");
    const i = s.indexOf("|");
    if (i < 0) return null;
    return { createdAt: s.slice(0, i), id: s.slice(i + 1) };
  } catch { return null; }
}

export async function listOrders(filters: ListOrdersFilters): Promise<ListOrdersResult> {
  ensureSchema();
  const db = getDb();
  const where: string[] = [];
  const params: unknown[] = [];

  if (filters.from) { where.push("created_at >= ?"); params.push(filters.from); }
  if (filters.to)   { where.push("created_at <= ?"); params.push(filters.to); }
  if (filters.paymentStatus?.length) {
    where.push(`payment_status IN (${filters.paymentStatus.map(() => "?").join(",")})`);
    params.push(...filters.paymentStatus);
  }
  if (filters.fulfillmentStatus?.length) {
    where.push(`fulfillment_status IN (${filters.fulfillmentStatus.map(() => "?").join(",")})`);
    params.push(...filters.fulfillmentStatus);
  }
  if (filters.source?.length) {
    where.push(`source IN (${filters.source.map(() => "?").join(",")})`);
    params.push(...filters.source);
  }
  if (filters.fulfillmentMethod?.length) {
    where.push(`fulfillment_method IN (${filters.fulfillmentMethod.map(() => "?").join(",")})`);
    params.push(...filters.fulfillmentMethod);
  }
  if (filters.q) {
    const like = `%${filters.q}%`;
    where.push(
      "(recipient_name LIKE ? OR recipient_phone LIKE ? OR contact_email LIKE ? OR id LIKE ? OR card_message LIKE ?)",
    );
    params.push(like, like, like, like, like);
  }

  const baseWhere = where.length ? `WHERE ${where.join(" AND ")}` : "";

  // total (no cursor)
  const totalRow = db.prepare(`SELECT COUNT(*) AS n FROM orders ${baseWhere}`).get(...params) as { n: number };
  const approxTotal = totalRow.n;

  // page (with cursor)
  const limit = Math.min(Math.max(filters.limit ?? 50, 1), 200);
  const pageWhere = [...where];
  const pageParams = [...params];
  if (filters.cursor) {
    const c = decodeCursor(filters.cursor);
    if (c) {
      pageWhere.push("(created_at < ? OR (created_at = ? AND id < ?))");
      pageParams.push(c.createdAt, c.createdAt, c.id);
    }
  }
  const pageWhereSql = pageWhere.length ? `WHERE ${pageWhere.join(" AND ")}` : "";

  const rows = db.prepare(
    `SELECT * FROM orders ${pageWhereSql}
     ORDER BY created_at DESC, id DESC
     LIMIT ?`,
  ).all(...pageParams, limit + 1) as OrderRow[];

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page[page.length - 1];
  const nextCursor = hasMore && last ? encodeCursor(last.created_at, last.id) : null;

  return { orders: page.map(rowToOrder), nextCursor, approxTotal };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/order-storage-list.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/order-storage.ts tests/unit/order-storage-list.test.ts
git commit -m "feat(dashboard): listOrders with filters + cursor pagination"
```

---

## Task 4: Pending queue triage (lib/order-queue.ts)

**Files:**
- Create: `lib/order-queue.ts`
- Test: `tests/unit/order-queue.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/unit/order-queue.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { acknowledgeOrder } from "@/lib/order-acknowledgments";
import { getPendingQueue } from "@/lib/order-queue";

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  runMigrations();
  // Freeze "now" to 2026-05-25 14:00 UTC for deterministic windowDate=today checks.
  vi.useFakeTimers().setSystemTime(new Date("2026-05-25T14:00:00Z"));
});
afterEach(() => { vi.useRealTimers(); closeDb(); vi.unstubAllEnvs(); });

function seed(o: {
  id: string; source: string; paymentStatus: string; fulfillmentStatus: string;
  fulfillmentMethod: string; windowDate: string | null; createdAt: string;
  checkoutSession?: string | null;
}) {
  getDb().prepare(
    `INSERT INTO orders (id, locale, source, recipient_name, recipient_phone, contact_phone,
       fulfillment_method, window_date, lines_json, subtotal_cents, delivery_cents, tax_cents,
       total_cents, fulfillment_status, payment_status, stripe_checkout_session_id,
       created_at, updated_at)
     VALUES (?, 'es', ?, 'R', '555', '555', ?, ?, '[]', 0, 0, 0, 0, ?, ?, ?, ?, ?)`,
  ).run(
    o.id, o.source, o.fulfillmentMethod, o.windowDate, o.fulfillmentStatus,
    o.paymentStatus, o.checkoutSession ?? null, o.createdAt, o.createdAt,
  );
}

describe("getPendingQueue", () => {
  it("flags unacknowledged web orders", async () => {
    seed({ id: "w1", source: "web", paymentStatus: "paid", fulfillmentStatus: "pending",
      fulfillmentMethod: "delivery", windowDate: "2026-06-01", createdAt: "2026-05-25T13:00:00Z" });
    const q = await getPendingQueue();
    expect(q.find(i => i.orderId === "w1")?.reason).toBe("web_unacknowledged");
  });

  it("skips acknowledged web orders", async () => {
    seed({ id: "w2", source: "web", paymentStatus: "paid", fulfillmentStatus: "pending",
      fulfillmentMethod: "delivery", windowDate: "2026-06-01", createdAt: "2026-05-25T13:00:00Z" });
    acknowledgeOrder("w2", "maky");
    const q = await getPendingQueue();
    expect(q.find(i => i.orderId === "w2")).toBeUndefined();
  });

  it("respects 72h cap on unacknowledged web orders", async () => {
    seed({ id: "w_old", source: "web", paymentStatus: "paid", fulfillmentStatus: "pending",
      fulfillmentMethod: "delivery", windowDate: "2026-06-01",
      createdAt: "2026-05-20T13:00:00Z" /* >72h before now */ });
    const q = await getPendingQueue();
    expect(q.find(i => i.orderId === "w_old")).toBeUndefined();
  });

  it("flags intake-unpaid > 1h with a checkout session", async () => {
    seed({ id: "i1", source: "walk-in", paymentStatus: "pending", fulfillmentStatus: "pending",
      fulfillmentMethod: "delivery", windowDate: "2026-06-01",
      createdAt: "2026-05-25T12:00:00Z" /* 2h ago */, checkoutSession: "cs_x" });
    const q = await getPendingQueue();
    expect(q.find(i => i.orderId === "i1")?.reason).toBe("intake_unpaid_stale");
  });

  it("does NOT flag intake-unpaid < 1h", async () => {
    seed({ id: "i2", source: "phone", paymentStatus: "pending", fulfillmentStatus: "pending",
      fulfillmentMethod: "delivery", windowDate: "2026-06-01",
      createdAt: "2026-05-25T13:45:00Z" /* 15min ago */, checkoutSession: "cs_y" });
    const q = await getPendingQueue();
    expect(q.find(i => i.orderId === "i2")).toBeUndefined();
  });

  it("flags delivery-today-undispatched", async () => {
    seed({ id: "d1", source: "walk-in", paymentStatus: "paid", fulfillmentStatus: "preparing",
      fulfillmentMethod: "delivery", windowDate: "2026-05-25", createdAt: "2026-05-25T08:00:00Z" });
    const q = await getPendingQueue();
    expect(q.find(i => i.orderId === "d1")?.reason).toBe("delivery_today_undispatched");
  });

  it("does NOT flag delivery-today already out-for-delivery", async () => {
    seed({ id: "d2", source: "walk-in", paymentStatus: "paid", fulfillmentStatus: "out-for-delivery",
      fulfillmentMethod: "delivery", windowDate: "2026-05-25", createdAt: "2026-05-25T08:00:00Z" });
    const q = await getPendingQueue();
    expect(q.find(i => i.orderId === "d2")).toBeUndefined();
  });

  it("flags delivery-today-unpaid with highest urgency (overrides undispatched)", async () => {
    seed({ id: "du", source: "walk-in", paymentStatus: "pending", fulfillmentStatus: "pending",
      fulfillmentMethod: "delivery", windowDate: "2026-05-25",
      createdAt: "2026-05-25T08:00:00Z", checkoutSession: "cs_z" });
    const q = await getPendingQueue();
    const item = q.find(i => i.orderId === "du");
    expect(item?.reason).toBe("delivery_today_unpaid");
  });

  it("flags pickup-today-unpaid", async () => {
    seed({ id: "p1", source: "walk-in", paymentStatus: "pending", fulfillmentStatus: "pending",
      fulfillmentMethod: "pickup", windowDate: "2026-05-25",
      createdAt: "2026-05-25T09:00:00Z", checkoutSession: "cs_p" });
    const q = await getPendingQueue();
    expect(q.find(i => i.orderId === "p1")?.reason).toBe("pickup_today_unpaid");
  });

  it("dedupes one order matching multiple rules by id", async () => {
    seed({ id: "dup", source: "walk-in", paymentStatus: "pending", fulfillmentStatus: "pending",
      fulfillmentMethod: "delivery", windowDate: "2026-05-25",
      createdAt: "2026-05-25T08:00:00Z", checkoutSession: "cs_dup" });
    const q = await getPendingQueue();
    expect(q.filter(i => i.orderId === "dup").length).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/order-queue.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the queue**

```ts
// lib/order-queue.ts
import "server-only";
import { getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { rowToOrder, type OrderRow } from "@/lib/order-row";
import type { Order } from "@/types/order";

export const INTAKE_UNPAID_STALE_HOURS = 1;
export const WEB_UNACK_CAP_HOURS = 72;

export type PendingReason =
  | "delivery_today_unpaid"
  | "pickup_today_unpaid"
  | "delivery_today_undispatched"
  | "intake_unpaid_stale"
  | "web_unacknowledged";

const URGENCY_RANK: Record<PendingReason, number> = {
  delivery_today_unpaid: 5,
  pickup_today_unpaid: 4,
  delivery_today_undispatched: 3,
  intake_unpaid_stale: 2,
  web_unacknowledged: 1,
};

export type PendingItem = {
  orderId: string;
  reason: PendingReason;
  order: Order;
};

function todayISODate(now = new Date()): string {
  // Local YYYY-MM-DD matching how intake form writes window_date
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export async function getPendingQueue(): Promise<PendingItem[]> {
  runMigrations();
  const db = getDb();
  const now = new Date();
  const today = todayISODate(now);
  const cutoffStale = new Date(now.getTime() - INTAKE_UNPAID_STALE_HOURS * 3600_000).toISOString();
  const cutoffCap = new Date(now.getTime() - WEB_UNACK_CAP_HOURS * 3600_000).toISOString();

  // Candidate set: any order matching ANY rule. Then we annotate the reason per row.
  const rows = db.prepare(`
    SELECT o.* FROM orders o
    LEFT JOIN order_acknowledgments a ON a.order_id = o.id
    WHERE (
      -- web_unacknowledged
      (o.source = 'web' AND a.order_id IS NULL AND o.created_at >= ?)
      -- intake_unpaid_stale
      OR (o.source != 'web' AND o.payment_status = 'pending'
          AND o.created_at <= ? AND o.stripe_checkout_session_id IS NOT NULL)
      -- delivery_today_undispatched
      OR (o.fulfillment_method = 'delivery' AND o.window_date = ?
          AND o.fulfillment_status NOT IN ('out-for-delivery','delivered','canceled'))
      -- delivery_today_unpaid
      OR (o.fulfillment_method = 'delivery' AND o.window_date = ? AND o.payment_status = 'pending')
      -- pickup_today_unpaid
      OR (o.fulfillment_method = 'pickup' AND o.window_date = ? AND o.payment_status = 'pending')
    )
  `).all(cutoffCap, cutoffStale, today, today, today) as OrderRow[];

  const acked = new Set<string>(
    (db.prepare("SELECT order_id FROM order_acknowledgments").all() as { order_id: string }[])
      .map((r) => r.order_id),
  );

  const items: PendingItem[] = [];
  for (const row of rows) {
    const order = rowToOrder(row);
    const reasons: PendingReason[] = [];
    if (
      order.fulfillment.method === "delivery" &&
      order.fulfillment.window.date === today &&
      order.paymentStatus === "pending"
    ) reasons.push("delivery_today_unpaid");
    if (
      order.fulfillment.method === "pickup" &&
      order.fulfillment.window.date === today &&
      order.paymentStatus === "pending"
    ) reasons.push("pickup_today_unpaid");
    if (
      order.fulfillment.method === "delivery" &&
      order.fulfillment.window.date === today &&
      !["out-for-delivery", "delivered", "canceled"].includes(order.status)
    ) reasons.push("delivery_today_undispatched");
    if (
      order.source !== "web" &&
      order.paymentStatus === "pending" &&
      order.createdAt <= cutoffStale &&
      !!order.stripeCheckoutSessionId
    ) reasons.push("intake_unpaid_stale");
    if (
      order.source === "web" &&
      !acked.has(order.id) &&
      order.createdAt >= cutoffCap
    ) reasons.push("web_unacknowledged");

    if (reasons.length === 0) continue;
    reasons.sort((a, b) => URGENCY_RANK[b] - URGENCY_RANK[a]);
    items.push({ orderId: order.id, reason: reasons[0], order });
  }

  items.sort((a, b) => URGENCY_RANK[b.reason] - URGENCY_RANK[a.reason]);
  return items;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/order-queue.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/order-queue.ts tests/unit/order-queue.test.ts
git commit -m "feat(dashboard): pending queue triage with 5 rules"
```

---

## Task 5: Recent feed (lib/order-feed.ts)

**Files:**
- Create: `lib/order-feed.ts`
- Test: `tests/unit/order-feed.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/unit/order-feed.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { getRecentFeed } from "@/lib/order-feed";

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  runMigrations();
  vi.useFakeTimers().setSystemTime(new Date("2026-05-25T14:00:00Z"));
});
afterEach(() => { vi.useRealTimers(); closeDb(); vi.unstubAllEnvs(); });

function seed(o: {
  id: string; createdAt: string; paidAt?: string | null; updatedAt?: string;
  status?: string; paymentStatus?: string; source?: string;
}) {
  getDb().prepare(
    `INSERT INTO orders (id, locale, source, recipient_name, recipient_phone, contact_phone,
       fulfillment_method, window_date, lines_json, subtotal_cents, delivery_cents,
       tax_cents, total_cents, fulfillment_status, payment_status, paid_at,
       created_at, updated_at)
     VALUES (?, 'es', ?, 'R', '555', '555', 'delivery', '2026-06-01', '[]', 0,0,0,15000,
       ?, ?, ?, ?, ?)`,
  ).run(
    o.id, o.source ?? "web", o.status ?? "pending", o.paymentStatus ?? "pending",
    o.paidAt ?? null, o.createdAt, o.updatedAt ?? o.createdAt,
  );
}

describe("getRecentFeed", () => {
  it("emits a 'created' event per order in the window, newest first", async () => {
    seed({ id: "a", createdAt: "2026-05-25T13:00:00Z" });
    seed({ id: "b", createdAt: "2026-05-25T13:30:00Z" });
    const r = await getRecentFeed(24);
    const created = r.events.filter(e => e.kind === "created");
    expect(created.map(e => e.orderId)).toEqual(["b", "a"]);
  });

  it("emits a 'paid' event when paid_at is within the window", async () => {
    seed({ id: "p1", createdAt: "2026-05-24T13:00:00Z",
      paidAt: "2026-05-25T13:00:00Z", paymentStatus: "paid" });
    const r = await getRecentFeed(24);
    expect(r.events.some(e => e.kind === "paid" && e.orderId === "p1")).toBe(true);
  });

  it("respects the sinceHours window", async () => {
    seed({ id: "old", createdAt: "2026-05-20T13:00:00Z" });
    seed({ id: "new", createdAt: "2026-05-25T13:00:00Z" });
    const r = await getRecentFeed(24);
    expect(r.events.some(e => e.orderId === "old")).toBe(false);
    expect(r.events.some(e => e.orderId === "new")).toBe(true);
  });

  it("sorts events by timestamp DESC across kinds", async () => {
    seed({ id: "a", createdAt: "2026-05-25T13:00:00Z",
      paidAt: "2026-05-25T13:30:00Z", paymentStatus: "paid" });
    const r = await getRecentFeed(24);
    const times = r.events.map(e => e.at);
    const sorted = [...times].sort((x, y) => y.localeCompare(x));
    expect(times).toEqual(sorted);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/order-feed.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement the feed**

```ts
// lib/order-feed.ts
import "server-only";
import { getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";

export type FeedEvent = {
  kind: "created" | "paid" | "status_changed";
  orderId: string;
  at: string; // ISO timestamp
  label: string;
  source: string;
  totalCents: number;
  recipientName: string;
};

function fmtMoney(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

const STATUS_LABEL_ES: Record<string, string> = {
  pending: "Pendiente",
  preparing: "Preparando",
  "out-for-delivery": "En camino",
  delivered: "Entregada",
  failed: "Fallida",
  canceled: "Cancelada",
};

export async function getRecentFeed(sinceHours = 24): Promise<{ events: FeedEvent[] }> {
  runMigrations();
  const since = new Date(Date.now() - sinceHours * 3600_000).toISOString();
  const rows = getDb().prepare(`
    SELECT id, source, recipient_name, total_cents, fulfillment_status, payment_status,
           created_at, paid_at, updated_at
      FROM orders
     WHERE created_at >= ? OR paid_at >= ? OR updated_at >= ?
  `).all(since, since, since) as {
    id: string; source: string; recipient_name: string; total_cents: number;
    fulfillment_status: string; payment_status: string;
    created_at: string; paid_at: string | null; updated_at: string;
  }[];

  const events: FeedEvent[] = [];
  for (const r of rows) {
    if (r.created_at >= since) {
      events.push({
        kind: "created", orderId: r.id, at: r.created_at,
        label: `Orden ${r.source}: ${r.recipient_name} · ${fmtMoney(r.total_cents)}`,
        source: r.source, totalCents: r.total_cents, recipientName: r.recipient_name,
      });
    }
    if (r.paid_at && r.paid_at >= since) {
      events.push({
        kind: "paid", orderId: r.id, at: r.paid_at,
        label: `Pago confirmado: ${r.recipient_name} · ${fmtMoney(r.total_cents)}`,
        source: r.source, totalCents: r.total_cents, recipientName: r.recipient_name,
      });
    }
    if (
      r.updated_at >= since &&
      r.updated_at !== r.created_at &&
      r.updated_at !== r.paid_at &&
      r.fulfillment_status !== "pending"
    ) {
      events.push({
        kind: "status_changed", orderId: r.id, at: r.updated_at,
        label: `${STATUS_LABEL_ES[r.fulfillment_status] ?? r.fulfillment_status}: ${r.recipient_name}`,
        source: r.source, totalCents: r.total_cents, recipientName: r.recipient_name,
      });
    }
  }

  events.sort((a, b) => b.at.localeCompare(a.at));
  return { events };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/order-feed.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/order-feed.ts tests/unit/order-feed.test.ts
git commit -m "feat(dashboard): 24h chronological feed of order events"
```

---

## Task 6: Mutations — markPaidManual

**Files:**
- Create: `lib/order-mutations.ts`
- Test: `tests/unit/order-mutations-payment.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/unit/order-mutations-payment.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { markPaidManual } from "@/lib/order-mutations";

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("ORDER_STORAGE_FILE", "/tmp/diva-mut-" + process.pid + ".json");
  runMigrations();
});
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

function seed(id: string, payment: "pending" | "paid" = "pending") {
  getDb().prepare(
    `INSERT INTO orders (id, locale, source, recipient_name, recipient_phone, contact_phone,
       fulfillment_method, window_date, lines_json, subtotal_cents, delivery_cents, tax_cents,
       total_cents, fulfillment_status, payment_status, created_at, updated_at)
     VALUES (?, 'es', 'walk-in', 'R', '555', '555', 'delivery', '2026-06-01', '[]',
       1000, 0, 88, 1088, 'pending', ?, ?, ?)`,
  ).run(id, payment, "2026-05-25T08:00:00Z", "2026-05-25T08:00:00Z");
}

describe("markPaidManual", () => {
  it("marks a pending order as paid with method + note appended", async () => {
    seed("o1", "pending");
    const order = await markPaidManual("o1", { method: "zelle", note: "Maria pagó por phone" });
    expect(order.paymentStatus).toBe("paid");
    expect(order.paymentMethod).toBe("zelle");
    expect(order.paidAt).toBeTruthy();
    expect(order.internalNotes ?? "").toContain("[paid manually as zelle]");
    expect(order.internalNotes ?? "").toContain("Maria pagó por phone");
  });

  it("is idempotent — second call returns the already-paid order untouched", async () => {
    seed("o2", "pending");
    const a = await markPaidManual("o2", { method: "cash" });
    const b = await markPaidManual("o2", { method: "venmo" });
    expect(b.paymentMethod).toBe("cash");
    expect(b.paidAt).toBe(a.paidAt);
  });

  it("throws if order does not exist", async () => {
    await expect(markPaidManual("missing", { method: "cash" })).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/order-mutations-payment.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement markPaidManual**

```ts
// lib/order-mutations.ts
import "server-only";
import { getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { rowToOrder, orderToRow, type OrderRow } from "@/lib/order-row";
import type { Order, PaymentMethod, FulfillmentStatus } from "@/types/order";

const MANUAL_PAYMENT_METHODS: PaymentMethod[] = ["cash", "zelle", "card-terminal", "ach"];

export async function markPaidManual(
  orderId: string,
  args: { method: PaymentMethod; note?: string },
): Promise<Order> {
  runMigrations();
  if (!MANUAL_PAYMENT_METHODS.includes(args.method)) {
    throw new Error(`unsupported manual method: ${args.method}`);
  }
  const db = getDb();
  const row = db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId) as OrderRow | undefined;
  if (!row) throw new Error(`order not found: ${orderId}`);
  const cur = rowToOrder(row);
  if (cur.paymentStatus === "paid") return cur;

  const now = new Date().toISOString();
  const noteLine = `[${now} · paid manually as ${args.method}]${args.note ? " " + args.note : ""}`;
  const internalNotes = cur.internalNotes ? `${cur.internalNotes}\n${noteLine}` : noteLine;

  const next: Order = {
    ...cur,
    paymentStatus: "paid",
    paymentMethod: args.method,
    paidAt: now,
    internalNotes,
    updatedAt: now,
  };
  upsert(next);
  return next;
}

function upsert(order: Order): void {
  const db = getDb();
  const row = orderToRow(order);
  db.prepare(
    `UPDATE orders SET payment_status=@payment_status, payment_method=@payment_method,
       paid_at=@paid_at, fulfillment_status=@fulfillment_status, internal_notes=@internal_notes,
       updated_at=@updated_at WHERE id=@id`,
  ).run(row);
}

// Exported so later tasks can reuse the same upsert path.
export const __testing_upsert = upsert;

const STATUS_ORDER: FulfillmentStatus[] = ["pending", "preparing", "out-for-delivery", "delivered"];

export async function changeFulfillmentStatus(
  orderId: string,
  status: FulfillmentStatus,
): Promise<Order> {
  runMigrations();
  if (!STATUS_ORDER.includes(status)) {
    throw new Error(`unsupported status: ${status}`);
  }
  const db = getDb();
  const row = db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId) as OrderRow | undefined;
  if (!row) throw new Error(`order not found: ${orderId}`);
  const cur = rowToOrder(row);
  if (cur.status === status) return cur;
  const fromIdx = STATUS_ORDER.indexOf(cur.status as FulfillmentStatus);
  const toIdx = STATUS_ORDER.indexOf(status);
  if (fromIdx === -1) throw new Error(`cannot advance from ${cur.status}`);
  if (toIdx <= fromIdx) throw new Error(`invalid transition ${cur.status} → ${status}`);
  const now = new Date().toISOString();
  const next: Order = { ...cur, status, updatedAt: now };
  upsert(next);
  return next;
}

export async function appendInternalNote(
  orderId: string,
  text: string,
  author: string,
): Promise<Order> {
  runMigrations();
  const trimmed = text.trim();
  if (!trimmed) throw new Error("note text required");
  const db = getDb();
  const row = db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId) as OrderRow | undefined;
  if (!row) throw new Error(`order not found: ${orderId}`);
  const cur = rowToOrder(row);
  const now = new Date().toISOString();
  const noteLine = `[${now} · ${author}] ${trimmed}`;
  const internalNotes = cur.internalNotes ? `${cur.internalNotes}\n${noteLine}` : noteLine;
  const next: Order = { ...cur, internalNotes, updatedAt: now };
  upsert(next);
  return next;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/order-mutations-payment.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/order-mutations.ts tests/unit/order-mutations-payment.test.ts
git commit -m "feat(dashboard): markPaidManual + skeletons for status & notes"
```

---

## Task 7: Mutations — changeFulfillmentStatus + appendInternalNote tests

**Files:**
- Test: `tests/unit/order-mutations-fulfillment.test.ts`
- Test: `tests/unit/order-mutations-notes.test.ts`

- [ ] **Step 1: Write fulfillment tests**

```ts
// tests/unit/order-mutations-fulfillment.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { changeFulfillmentStatus } from "@/lib/order-mutations";

beforeEach(() => { vi.stubEnv("SQLITE_FILE", ":memory:"); runMigrations(); });
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

function seed(id: string, status: string) {
  getDb().prepare(
    `INSERT INTO orders (id, locale, source, recipient_name, recipient_phone, contact_phone,
       fulfillment_method, window_date, lines_json, subtotal_cents, delivery_cents, tax_cents,
       total_cents, fulfillment_status, payment_status, created_at, updated_at)
     VALUES (?, 'es', 'walk-in', 'R', '555', '555', 'delivery', '2026-06-01', '[]',
       0,0,0,0, ?, 'paid', '2026-05-25T08:00:00Z', '2026-05-25T08:00:00Z')`,
  ).run(id, status);
}

describe("changeFulfillmentStatus", () => {
  it("advances pending → preparing", async () => {
    seed("o1", "pending");
    const r = await changeFulfillmentStatus("o1", "preparing");
    expect(r.status).toBe("preparing");
  });

  it("allows skipping forward pending → out-for-delivery", async () => {
    seed("o2", "pending");
    const r = await changeFulfillmentStatus("o2", "out-for-delivery");
    expect(r.status).toBe("out-for-delivery");
  });

  it("rejects backward transitions", async () => {
    seed("o3", "out-for-delivery");
    await expect(changeFulfillmentStatus("o3", "preparing")).rejects.toThrow(/invalid transition/);
  });

  it("is no-op when status is unchanged", async () => {
    seed("o4", "preparing");
    const r = await changeFulfillmentStatus("o4", "preparing");
    expect(r.status).toBe("preparing");
  });

  it("rejects unsupported statuses (failed, canceled) from this endpoint", async () => {
    seed("o5", "pending");
    // @ts-expect-error testing invalid input
    await expect(changeFulfillmentStatus("o5", "canceled")).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Write notes tests**

```ts
// tests/unit/order-mutations-notes.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { appendInternalNote } from "@/lib/order-mutations";

beforeEach(() => { vi.stubEnv("SQLITE_FILE", ":memory:"); runMigrations(); });
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

function seed(id: string, notes: string | null = null) {
  getDb().prepare(
    `INSERT INTO orders (id, locale, source, recipient_name, recipient_phone, contact_phone,
       fulfillment_method, window_date, lines_json, subtotal_cents, delivery_cents, tax_cents,
       total_cents, fulfillment_status, payment_status, internal_notes, created_at, updated_at)
     VALUES (?, 'es', 'walk-in', 'R', '555', '555', 'delivery', '2026-06-01', '[]',
       0,0,0,0, 'pending', 'pending', ?, '2026-05-25T08:00:00Z', '2026-05-25T08:00:00Z')`,
  ).run(id, notes);
}

describe("appendInternalNote", () => {
  it("creates first note with author + timestamp prefix", async () => {
    seed("o1");
    const r = await appendInternalNote("o1", "ring twice", "maky");
    expect(r.internalNotes).toMatch(/^\[.+ · maky\] ring twice$/);
  });

  it("appends second note on a new line", async () => {
    seed("o2");
    await appendInternalNote("o2", "first", "maky");
    const r = await appendInternalNote("o2", "second", "maky");
    expect(r.internalNotes?.split("\n").length).toBe(2);
    expect(r.internalNotes?.endsWith("second")).toBe(true);
  });

  it("rejects empty/whitespace text", async () => {
    seed("o3");
    await expect(appendInternalNote("o3", "   ", "maky")).rejects.toThrow();
  });
});
```

- [ ] **Step 3: Run tests to verify they pass**

Run: `pnpm test tests/unit/order-mutations-fulfillment.test.ts tests/unit/order-mutations-notes.test.ts`
Expected: 5 + 3 = 8 tests pass. The implementation was added in Task 6.

- [ ] **Step 4: Commit**

```bash
git add tests/unit/order-mutations-fulfillment.test.ts tests/unit/order-mutations-notes.test.ts
git commit -m "test(dashboard): coverage for fulfillment + notes mutations"
```

---

## Task 8: GET /api/admin/orders — list with filters

**Files:**
- Modify: `app/api/admin/orders/route.ts`
- Test: `tests/unit/api-admin-orders-list.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/unit/api-admin-orders-list.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { GET } from "@/app/api/admin/orders/route";

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("ORDER_STORAGE_FILE", "/tmp/diva-api-list-" + process.pid + ".json");
  runMigrations();
});
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

function seed(id: string, source = "web", paymentStatus = "pending", createdAt = "2026-05-25T10:00:00Z") {
  getDb().prepare(
    `INSERT INTO orders (id, locale, source, recipient_name, recipient_phone, contact_phone,
       fulfillment_method, window_date, lines_json, subtotal_cents, delivery_cents, tax_cents,
       total_cents, fulfillment_status, payment_status, created_at, updated_at)
     VALUES (?, 'es', ?, 'R', '555', '555', 'delivery', '2026-06-01', '[]',
       0,0,0,0, 'pending', ?, ?, ?)`,
  ).run(id, source, paymentStatus, createdAt, createdAt);
}

describe("GET /api/admin/orders", () => {
  it("returns all orders by default", async () => {
    seed("a"); seed("b"); seed("c");
    const res = await GET(new Request("http://x/api/admin/orders"));
    const body = await res.json();
    expect(body.orders.length).toBe(3);
    expect(body.approxTotal).toBe(3);
  });

  it("applies paymentStatus[] filter", async () => {
    seed("a", "web", "paid");
    seed("b", "web", "pending");
    const res = await GET(new Request("http://x/api/admin/orders?paymentStatus=paid"));
    const body = await res.json();
    expect(body.orders.map((o: { id: string }) => o.id)).toEqual(["a"]);
  });

  it("applies free-text q", async () => {
    seed("ord_alpha");
    seed("ord_beta");
    const res = await GET(new Request("http://x/api/admin/orders?q=beta"));
    const body = await res.json();
    expect(body.orders.map((o: { id: string }) => o.id)).toEqual(["ord_beta"]);
  });

  it("paginates with limit + cursor", async () => {
    for (let i = 0; i < 5; i++) seed(`o${i}`, "web", "pending", `2026-05-25T1${i}:00:00Z`);
    const r1 = await GET(new Request("http://x/api/admin/orders?limit=2"));
    const b1 = await r1.json();
    expect(b1.orders.length).toBe(2);
    expect(b1.nextCursor).toBeTruthy();
    const r2 = await GET(new Request(`http://x/api/admin/orders?limit=2&cursor=${encodeURIComponent(b1.nextCursor)}`));
    const b2 = await r2.json();
    expect(b2.orders.length).toBe(2);
    expect(b2.orders[0].id).not.toBe(b1.orders[0].id);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/api-admin-orders-list.test.ts`
Expected: FAIL — `GET` not exported from route.

- [ ] **Step 3: Add GET handler to existing route**

Edit `app/api/admin/orders/route.ts` — add at the top of the file (after existing imports):

```ts
import { listOrders, type ListOrdersFilters } from "@/lib/order-storage";
```

Append at the end of the file:

```ts
function parseList(sp: URLSearchParams, key: string): string[] | undefined {
  const values = sp.getAll(key);
  if (values.length === 0) return undefined;
  // Support both ?key=a&key=b and ?key=a,b
  return values.flatMap((v) => v.split(",")).map((s) => s.trim()).filter(Boolean);
}

export async function GET(req: Request): Promise<Response> {
  const sp = new URL(req.url).searchParams;
  const filters: ListOrdersFilters = {
    q: sp.get("q") ?? undefined,
    from: sp.get("from") ?? undefined,
    to: sp.get("to") ?? undefined,
    paymentStatus: parseList(sp, "paymentStatus"),
    fulfillmentStatus: parseList(sp, "fulfillmentStatus"),
    source: parseList(sp, "source"),
    fulfillmentMethod: parseList(sp, "fulfillmentMethod"),
    limit: sp.get("limit") ? Number(sp.get("limit")) : undefined,
    cursor: sp.get("cursor") ?? undefined,
  };
  const result = await listOrders(filters);
  return NextResponse.json(result);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/api-admin-orders-list.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/orders/route.ts tests/unit/api-admin-orders-list.test.ts
git commit -m "feat(dashboard): GET /api/admin/orders with filters + pagination"
```

---

## Task 9: GET /api/admin/orders/queue

**Files:**
- Create: `app/api/admin/orders/queue/route.ts`
- Test: `tests/unit/api-admin-orders-queue.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/api-admin-orders-queue.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { GET } from "@/app/api/admin/orders/queue/route";

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  runMigrations();
  vi.useFakeTimers().setSystemTime(new Date("2026-05-25T14:00:00Z"));
});
afterEach(() => { vi.useRealTimers(); closeDb(); vi.unstubAllEnvs(); });

it("returns the queue payload shape", async () => {
  // seed one delivery-today-undispatched order
  getDb().prepare(
    `INSERT INTO orders (id, locale, source, recipient_name, recipient_phone, contact_phone,
       fulfillment_method, window_date, lines_json, subtotal_cents, delivery_cents, tax_cents,
       total_cents, fulfillment_status, payment_status, created_at, updated_at)
     VALUES ('q1', 'es', 'walk-in', 'Maria', '555', '555', 'delivery', '2026-05-25', '[]',
       0,0,0,0, 'pending', 'paid', '2026-05-25T08:00:00Z', '2026-05-25T08:00:00Z')`,
  ).run();
  const res = await GET();
  const body = await res.json();
  expect(body.generatedAt).toBeTruthy();
  expect(Array.isArray(body.items)).toBe(true);
  expect(body.items[0].orderId).toBe("q1");
  expect(body.items[0].reason).toBe("delivery_today_undispatched");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/api-admin-orders-queue.test.ts`
Expected: FAIL — route not found.

- [ ] **Step 3: Implement the route**

```ts
// app/api/admin/orders/queue/route.ts
import { NextResponse } from "next/server";
import { getPendingQueue } from "@/lib/order-queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const items = await getPendingQueue();
  return NextResponse.json({
    items: items.map((i) => ({ orderId: i.orderId, reason: i.reason, order: i.order })),
    generatedAt: new Date().toISOString(),
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/api-admin-orders-queue.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/orders/queue/route.ts tests/unit/api-admin-orders-queue.test.ts
git commit -m "feat(dashboard): GET /api/admin/orders/queue endpoint"
```

---

## Task 10: GET /api/admin/orders/feed

**Files:**
- Create: `app/api/admin/orders/feed/route.ts`
- Test: `tests/unit/api-admin-orders-feed.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/api-admin-orders-feed.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { GET } from "@/app/api/admin/orders/feed/route";

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  runMigrations();
  vi.useFakeTimers().setSystemTime(new Date("2026-05-25T14:00:00Z"));
});
afterEach(() => { vi.useRealTimers(); closeDb(); vi.unstubAllEnvs(); });

it("returns events for orders in the window", async () => {
  getDb().prepare(
    `INSERT INTO orders (id, locale, source, recipient_name, recipient_phone, contact_phone,
       fulfillment_method, window_date, lines_json, subtotal_cents, delivery_cents, tax_cents,
       total_cents, fulfillment_status, payment_status, created_at, updated_at)
     VALUES ('f1', 'es', 'web', 'X', '555', '555', 'delivery', '2026-06-01', '[]',
       0,0,0,15000, 'pending', 'pending', '2026-05-25T13:00:00Z', '2026-05-25T13:00:00Z')`,
  ).run();
  const res = await GET(new Request("http://x/api/admin/orders/feed"));
  const body = await res.json();
  expect(body.events.some((e: { orderId: string }) => e.orderId === "f1")).toBe(true);
});

it("respects sinceHours query param", async () => {
  getDb().prepare(
    `INSERT INTO orders (id, locale, source, recipient_name, recipient_phone, contact_phone,
       fulfillment_method, window_date, lines_json, subtotal_cents, delivery_cents, tax_cents,
       total_cents, fulfillment_status, payment_status, created_at, updated_at)
     VALUES ('f_old', 'es', 'web', 'X', '555', '555', 'delivery', '2026-06-01', '[]',
       0,0,0,15000, 'pending', 'pending', '2026-05-25T10:00:00Z', '2026-05-25T10:00:00Z')`,
  ).run();
  const res = await GET(new Request("http://x/api/admin/orders/feed?sinceHours=1"));
  const body = await res.json();
  expect(body.events.some((e: { orderId: string }) => e.orderId === "f_old")).toBe(false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/api-admin-orders-feed.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement the route**

```ts
// app/api/admin/orders/feed/route.ts
import { NextResponse } from "next/server";
import { getRecentFeed } from "@/lib/order-feed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  const sp = new URL(req.url).searchParams;
  const sinceHours = Math.max(1, Math.min(168, Number(sp.get("sinceHours") ?? "24")));
  const data = await getRecentFeed(sinceHours);
  return NextResponse.json(data);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/api-admin-orders-feed.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/orders/feed/route.ts tests/unit/api-admin-orders-feed.test.ts
git commit -m "feat(dashboard): GET /api/admin/orders/feed endpoint"
```

---

## Task 11: GET /api/admin/orders/[id] — detail

**Files:**
- Create: `app/api/admin/orders/[id]/route.ts`
- Test: `tests/unit/api-admin-orders-detail.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/api-admin-orders-detail.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { GET } from "@/app/api/admin/orders/[id]/route";

beforeEach(() => { vi.stubEnv("SQLITE_FILE", ":memory:"); runMigrations(); });
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

function seed(id: string) {
  getDb().prepare(
    `INSERT INTO orders (id, locale, source, customer_id, recipient_name, recipient_phone,
       contact_phone, fulfillment_method, window_date, lines_json, subtotal_cents,
       delivery_cents, tax_cents, total_cents, fulfillment_status, payment_status,
       created_at, updated_at)
     VALUES (?, 'es', 'walk-in', 'c1', 'Maria', '555', '555', 'delivery', '2026-06-01', '[]',
       0,0,0,0, 'pending', 'paid', '2026-05-25T08:00:00Z', '2026-05-25T08:00:00Z')`,
  ).run(id);
  getDb().prepare(
    `INSERT INTO customers (id, name, phone, first_seen_at, last_seen_at)
     VALUES ('c1', 'Maria', '555', '2026-01-01', '2026-05-25')`,
  ).run();
}

it("returns order + customer + messages array", async () => {
  seed("d1");
  const res = await GET(new Request("http://x"), { params: Promise.resolve({ id: "d1" }) });
  const body = await res.json();
  expect(body.order.id).toBe("d1");
  expect(body.customer?.name).toBe("Maria");
  expect(Array.isArray(body.messages)).toBe(true);
});

it("returns 404 for unknown id", async () => {
  const res = await GET(new Request("http://x"), { params: Promise.resolve({ id: "nope" }) });
  expect(res.status).toBe(404);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/api-admin-orders-detail.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement the route**

```ts
// app/api/admin/orders/[id]/route.ts
import { NextResponse } from "next/server";
import { getOrder } from "@/lib/order-storage";
import { getDb } from "@/lib/db";
import { listMessagesByOrder } from "@/lib/message-storage";

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
  const messages = await listMessagesByOrder(id, 50).catch(() => []);
  return NextResponse.json({ order, customer, messages });
}
```

Verify `listMessagesByOrder` exists with that signature:

Run: `grep -n "export.*listMessagesByOrder\|^export.*function" lib/message-storage.ts`
If the export name differs, adjust the import accordingly (use whatever exposes `SELECT * FROM messages WHERE order_id = ? ORDER BY created_at DESC LIMIT ?`).

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/api-admin-orders-detail.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/orders/[id]/route.ts tests/unit/api-admin-orders-detail.test.ts
git commit -m "feat(dashboard): GET /api/admin/orders/[id] detail endpoint"
```

---

## Task 12: POST /api/admin/orders/[id]/ack

**Files:**
- Create: `app/api/admin/orders/[id]/ack/route.ts`
- Test: `tests/unit/api-admin-orders-ack.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/api-admin-orders-ack.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { POST } from "@/app/api/admin/orders/[id]/ack/route";
import { isAcknowledged } from "@/lib/order-acknowledgments";

beforeEach(() => { vi.stubEnv("SQLITE_FILE", ":memory:"); runMigrations(); });
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

it("acknowledges an order and persists the row", async () => {
  getDb().prepare(
    `INSERT INTO orders (id, locale, source, recipient_name, recipient_phone, contact_phone,
       fulfillment_method, window_date, lines_json, subtotal_cents, delivery_cents,
       tax_cents, total_cents, fulfillment_status, payment_status, created_at, updated_at)
     VALUES ('a1', 'es', 'web', 'R', '555', '555', 'delivery', '2026-06-01', '[]',
       0,0,0,0, 'pending', 'pending', '2026-05-25T08:00:00Z', '2026-05-25T08:00:00Z')`,
  ).run();
  const res = await POST(new Request("http://x", { method: "POST" }), { params: Promise.resolve({ id: "a1" }) });
  expect(res.status).toBe(200);
  expect(isAcknowledged("a1")).toBe(true);
});

it("returns 404 for unknown order", async () => {
  const res = await POST(new Request("http://x", { method: "POST" }), { params: Promise.resolve({ id: "nope" }) });
  expect(res.status).toBe(404);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/api-admin-orders-ack.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement the route**

```ts
// app/api/admin/orders/[id]/ack/route.ts
import { NextResponse } from "next/server";
import { getOrder } from "@/lib/order-storage";
import { acknowledgeOrder } from "@/lib/order-acknowledgments";

export const runtime = "nodejs";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await ctx.params;
  const order = await getOrder(id);
  if (!order) return NextResponse.json({ error: "not_found" }, { status: 404 });
  acknowledgeOrder(id, "maky"); // single-user admin for now
  return NextResponse.json({ acknowledgedAt: new Date().toISOString() });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/api-admin-orders-ack.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/orders/[id]/ack/route.ts tests/unit/api-admin-orders-ack.test.ts
git commit -m "feat(dashboard): POST /api/admin/orders/[id]/ack endpoint"
```

---

## Task 13: PATCH /api/admin/orders/[id]/payment

**Files:**
- Create: `app/api/admin/orders/[id]/payment/route.ts`
- Test: `tests/unit/api-admin-orders-payment.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/api-admin-orders-payment.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { PATCH } from "@/app/api/admin/orders/[id]/payment/route";

beforeEach(() => { vi.stubEnv("SQLITE_FILE", ":memory:"); runMigrations(); });
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

function seed(id: string, payment = "pending") {
  getDb().prepare(
    `INSERT INTO orders (id, locale, source, recipient_name, recipient_phone, contact_phone,
       fulfillment_method, window_date, lines_json, subtotal_cents, delivery_cents,
       tax_cents, total_cents, fulfillment_status, payment_status, created_at, updated_at)
     VALUES (?, 'es', 'walk-in', 'R', '555', '555', 'delivery', '2026-06-01', '[]',
       0,0,0,0, 'pending', ?, '2026-05-25T08:00:00Z', '2026-05-25T08:00:00Z')`,
  ).run(id, payment);
}

it("marks order paid", async () => {
  seed("p1");
  const res = await PATCH(
    new Request("http://x", { method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ method: "zelle", note: "via Maria" }) }),
    { params: Promise.resolve({ id: "p1" }) },
  );
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.order.paymentStatus).toBe("paid");
});

it("returns 400 on invalid method", async () => {
  seed("p2");
  const res = await PATCH(
    new Request("http://x", { method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ method: "bitcoin" }) }),
    { params: Promise.resolve({ id: "p2" }) },
  );
  expect(res.status).toBe(400);
});

it("returns 404 on unknown order", async () => {
  const res = await PATCH(
    new Request("http://x", { method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ method: "cash" }) }),
    { params: Promise.resolve({ id: "nope" }) },
  );
  expect(res.status).toBe(404);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/api-admin-orders-payment.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement the route**

```ts
// app/api/admin/orders/[id]/payment/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { markPaidManual } from "@/lib/order-mutations";

export const runtime = "nodejs";

const body = z.object({
  method: z.enum(["cash", "zelle", "card-terminal", "ach"]),
  note: z.string().max(500).optional(),
});

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
    const order = await markPaidManual(id, parsed.data);
    return NextResponse.json({ order });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/order not found/.test(msg)) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/api-admin-orders-payment.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/orders/[id]/payment/route.ts tests/unit/api-admin-orders-payment.test.ts
git commit -m "feat(dashboard): PATCH /api/admin/orders/[id]/payment endpoint"
```

---

## Task 14: PATCH /api/admin/orders/[id]/fulfillment

**Files:**
- Create: `app/api/admin/orders/[id]/fulfillment/route.ts`
- Test: `tests/unit/api-admin-orders-fulfillment.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/api-admin-orders-fulfillment.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { PATCH } from "@/app/api/admin/orders/[id]/fulfillment/route";

beforeEach(() => { vi.stubEnv("SQLITE_FILE", ":memory:"); runMigrations(); });
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

function seed(id: string, status = "pending") {
  getDb().prepare(
    `INSERT INTO orders (id, locale, source, recipient_name, recipient_phone, contact_phone,
       fulfillment_method, window_date, lines_json, subtotal_cents, delivery_cents,
       tax_cents, total_cents, fulfillment_status, payment_status, created_at, updated_at)
     VALUES (?, 'es', 'walk-in', 'R', '555', '555', 'delivery', '2026-06-01', '[]',
       0,0,0,0, ?, 'paid', '2026-05-25T08:00:00Z', '2026-05-25T08:00:00Z')`,
  ).run(id, status);
}

it("advances pending → preparing", async () => {
  seed("o1");
  const res = await PATCH(
    new Request("http://x", { method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "preparing" }) }),
    { params: Promise.resolve({ id: "o1" }) },
  );
  expect(res.status).toBe(200);
});

it("returns 400 on backward transition", async () => {
  seed("o2", "out-for-delivery");
  const res = await PATCH(
    new Request("http://x", { method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "preparing" }) }),
    { params: Promise.resolve({ id: "o2" }) },
  );
  expect(res.status).toBe(400);
});

it("returns 404 for unknown order", async () => {
  const res = await PATCH(
    new Request("http://x", { method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "preparing" }) }),
    { params: Promise.resolve({ id: "nope" }) },
  );
  expect(res.status).toBe(404);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/api-admin-orders-fulfillment.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement the route**

```ts
// app/api/admin/orders/[id]/fulfillment/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { changeFulfillmentStatus } from "@/lib/order-mutations";

export const runtime = "nodejs";

const body = z.object({
  status: z.enum(["preparing", "out-for-delivery", "delivered"]),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await ctx.params;
  const json = await req.json().catch(() => null);
  const parsed = body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  try {
    const order = await changeFulfillmentStatus(id, parsed.data.status);
    return NextResponse.json({ order });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/order not found/.test(msg)) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/api-admin-orders-fulfillment.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/orders/[id]/fulfillment/route.ts tests/unit/api-admin-orders-fulfillment.test.ts
git commit -m "feat(dashboard): PATCH /api/admin/orders/[id]/fulfillment endpoint"
```

---

## Task 15: POST /api/admin/orders/[id]/notes

**Files:**
- Create: `app/api/admin/orders/[id]/notes/route.ts`
- Test: `tests/unit/api-admin-orders-notes.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/api-admin-orders-notes.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { POST } from "@/app/api/admin/orders/[id]/notes/route";

beforeEach(() => { vi.stubEnv("SQLITE_FILE", ":memory:"); runMigrations(); });
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

function seed(id: string) {
  getDb().prepare(
    `INSERT INTO orders (id, locale, source, recipient_name, recipient_phone, contact_phone,
       fulfillment_method, window_date, lines_json, subtotal_cents, delivery_cents,
       tax_cents, total_cents, fulfillment_status, payment_status, created_at, updated_at)
     VALUES (?, 'es', 'walk-in', 'R', '555', '555', 'delivery', '2026-06-01', '[]',
       0,0,0,0, 'pending', 'pending', '2026-05-25T08:00:00Z', '2026-05-25T08:00:00Z')`,
  ).run(id);
}

it("appends a note", async () => {
  seed("n1");
  const res = await POST(
    new Request("http://x", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "ring twice" }) }),
    { params: Promise.resolve({ id: "n1" }) },
  );
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.order.internalNotes).toContain("ring twice");
});

it("rejects empty notes", async () => {
  seed("n2");
  const res = await POST(
    new Request("http://x", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "   " }) }),
    { params: Promise.resolve({ id: "n2" }) },
  );
  expect(res.status).toBe(400);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/api-admin-orders-notes.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement the route**

```ts
// app/api/admin/orders/[id]/notes/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { appendInternalNote } from "@/lib/order-mutations";

export const runtime = "nodejs";

const body = z.object({ text: z.string().max(2000) });

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await ctx.params;
  const json = await req.json().catch(() => null);
  const parsed = body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  try {
    const order = await appendInternalNote(id, parsed.data.text, "maky");
    return NextResponse.json({ order });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/order not found/.test(msg)) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/api-admin-orders-notes.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/orders/[id]/notes/route.ts tests/unit/api-admin-orders-notes.test.ts
git commit -m "feat(dashboard): POST /api/admin/orders/[id]/notes endpoint"
```

---

## Task 16: POST /api/admin/orders/[id]/resend

**Files:**
- Create: `app/api/admin/orders/[id]/resend/route.ts`
- Test: `tests/unit/api-admin-orders-resend.test.ts`

The existing `/api/admin/orders/[id]/payment-link/route.ts` already handles `payment_link` regeneration + re-dispatch. The new `/resend` endpoint generalizes that, supporting `confirmation` too.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/api-admin-orders-resend.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";

const dispatchOrderReceived = vi.fn().mockResolvedValue(undefined);
const dispatchPaymentConfirmed = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/order-dispatch", () => ({ dispatchOrderReceived, dispatchPaymentConfirmed }));
vi.mock("@/lib/stripe-payment-link", () => ({
  createCheckoutSession: vi.fn().mockResolvedValue({
    id: "cs_test", url: "https://buy.stripe.com/test", expiresAt: 9999999999,
  }),
}));

import { POST } from "@/app/api/admin/orders/[id]/resend/route";

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  runMigrations();
  dispatchOrderReceived.mockClear();
  dispatchPaymentConfirmed.mockClear();
});
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

function seed(id: string, payment = "pending") {
  getDb().prepare(
    `INSERT INTO orders (id, locale, source, recipient_name, recipient_phone, contact_phone,
       fulfillment_method, window_date, lines_json, subtotal_cents, delivery_cents,
       tax_cents, total_cents, fulfillment_status, payment_status, created_at, updated_at)
     VALUES (?, 'es', 'walk-in', 'R', '555', '555', 'delivery', '2026-06-01', '[]',
       0,0,0,0, 'pending', ?, '2026-05-25T08:00:00Z', '2026-05-25T08:00:00Z')`,
  ).run(id, payment);
}

it("resends payment_link by regenerating the checkout session and dispatching", async () => {
  seed("r1", "pending");
  const res = await POST(
    new Request("http://x", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind: "payment_link" }) }),
    { params: Promise.resolve({ id: "r1" }) },
  );
  expect(res.status).toBe(200);
  expect(dispatchOrderReceived).toHaveBeenCalled();
});

it("resends confirmation when order is already paid", async () => {
  seed("r2", "paid");
  const res = await POST(
    new Request("http://x", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind: "confirmation" }) }),
    { params: Promise.resolve({ id: "r2" }) },
  );
  expect(res.status).toBe(200);
  expect(dispatchPaymentConfirmed).toHaveBeenCalled();
});

it("returns 409 when asking to resend payment_link for a paid order", async () => {
  seed("r3", "paid");
  const res = await POST(
    new Request("http://x", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind: "payment_link" }) }),
    { params: Promise.resolve({ id: "r3" }) },
  );
  expect(res.status).toBe(409);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/api-admin-orders-resend.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement the route**

```ts
// app/api/admin/orders/[id]/resend/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { getOrder } from "@/lib/order-storage";
import { createCheckoutSession } from "@/lib/stripe-payment-link";
import { dispatchOrderReceived, dispatchPaymentConfirmed } from "@/lib/order-dispatch";

export const runtime = "nodejs";

const body = z.object({ kind: z.enum(["payment_link", "confirmation"]) });

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await ctx.params;
  const json = await req.json().catch(() => null);
  const parsed = body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const order = await getOrder(id);
  if (!order) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (parsed.data.kind === "payment_link") {
    if (order.paymentStatus === "paid") {
      return NextResponse.json({ error: "already_paid" }, { status: 409 });
    }
    const session = await createCheckoutSession(order, order.locale);
    await dispatchOrderReceived(
      { ...order, stripeCheckoutSessionId: session.id },
      session.url,
    );
    return NextResponse.json({ url: session.url });
  }

  // confirmation
  if (order.paymentStatus !== "paid") {
    return NextResponse.json({ error: "not_paid" }, { status: 409 });
  }
  await dispatchPaymentConfirmed(order);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/api-admin-orders-resend.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/orders/[id]/resend/route.ts tests/unit/api-admin-orders-resend.test.ts
git commit -m "feat(dashboard): POST /api/admin/orders/[id]/resend endpoint"
```

---

## Task 17: Dashboard shell + tab routing

**Files:**
- Create: `app/[locale]/admin/dashboard/layout.tsx`
- Create: `app/[locale]/admin/dashboard/page.tsx` (Bandeja default)
- Create: `app/[locale]/admin/dashboard/ledger/page.tsx` (Libro)
- Create: `components/admin/dashboard/DashboardShell.tsx`
- Modify: `app/[locale]/admin/page.tsx` (redirect to dashboard)

- [ ] **Step 1: Read existing admin layout to match conventions**

Run: `cat app/[locale]/admin/layout.tsx`
Note: it returns `<div className="min-h-screen bg-bone text-ink">{children}</div>` — keep that wrapper, add dashboard shell as a sublayout.

- [ ] **Step 2: Create the shell component**

```tsx
// components/admin/dashboard/DashboardShell.tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Props = {
  locale: string;
  children: React.ReactNode;
  lastUpdated?: string;
  onRefresh?: () => void;
};

export default function DashboardShell({ locale, children, lastUpdated, onRefresh }: Props) {
  const pathname = usePathname();
  const isLedger = pathname.endsWith("/ledger");
  const base = `/${locale}/admin/dashboard`;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b border-ink/10 bg-bone/95 backdrop-blur">
        <div className="flex items-center gap-4 px-4 py-3">
          <span className="text-sm font-semibold tracking-wide">Diva · Admin</span>
          <nav className="ml-2 flex gap-1 text-sm">
            <Link
              href={base}
              className={`rounded px-3 py-1 ${!isLedger ? "bg-ink text-bone" : "hover:bg-ink/5"}`}
            >Bandeja</Link>
            <Link
              href={`${base}/ledger`}
              className={`rounded px-3 py-1 ${isLedger ? "bg-ink text-bone" : "hover:bg-ink/5"}`}
            >Libro de órdenes</Link>
            <Link
              href={`/${locale}/admin/intake`}
              className="rounded px-3 py-1 hover:bg-ink/5"
            >+ Nueva orden</Link>
          </nav>
          <div className="ml-auto flex items-center gap-3 text-xs text-ink/60">
            {lastUpdated && <span>Actualizado: {lastUpdated}</span>}
            {onRefresh && (
              <button onClick={onRefresh} className="rounded border border-ink/20 px-2 py-1 hover:bg-ink/5">
                ↻ Actualizar
              </button>
            )}
          </div>
        </div>
      </header>
      <main className="flex-1 px-4 py-4">{children}</main>
    </div>
  );
}
```

- [ ] **Step 3: Create the dashboard sublayout (just passes through — shell lives in pages so it can own polling state)**

```tsx
// app/[locale]/admin/dashboard/layout.tsx
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
```

- [ ] **Step 4: Stub Bandeja and Libro pages with shell + placeholder content**

```tsx
// app/[locale]/admin/dashboard/page.tsx
import BandejaView from "@/components/admin/dashboard/BandejaView";

export const dynamic = "force-dynamic";

export default async function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return <BandejaView locale={locale} />;
}
```

```tsx
// app/[locale]/admin/dashboard/ledger/page.tsx
import LedgerView from "@/components/admin/dashboard/LedgerView";

export const dynamic = "force-dynamic";

export default async function LedgerPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return <LedgerView locale={locale} />;
}
```

- [ ] **Step 5: Stub Bandeja and Libro view components (so the build compiles before Tasks 19/22)**

```tsx
// components/admin/dashboard/BandejaView.tsx
"use client";
import DashboardShell from "./DashboardShell";

export default function BandejaView({ locale }: { locale: string }) {
  return (
    <DashboardShell locale={locale}>
      <p className="text-sm text-ink/60">Bandeja — implementando…</p>
    </DashboardShell>
  );
}
```

```tsx
// components/admin/dashboard/LedgerView.tsx
"use client";
import DashboardShell from "./DashboardShell";

export default function LedgerView({ locale }: { locale: string }) {
  return (
    <DashboardShell locale={locale}>
      <p className="text-sm text-ink/60">Libro de órdenes — implementando…</p>
    </DashboardShell>
  );
}
```

- [ ] **Step 6: Redirect /admin → /admin/dashboard**

Create `app/[locale]/admin/page.tsx`:

```tsx
import { redirect } from "next/navigation";

export default async function AdminHome({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect(`/${locale}/admin/dashboard`);
}
```

- [ ] **Step 7: Verify build**

Run: `pnpm build 2>&1 | tail -30`
Expected: build succeeds. New routes show in the route summary.

- [ ] **Step 8: Commit**

```bash
git add app/[locale]/admin/page.tsx app/[locale]/admin/dashboard components/admin/dashboard
git commit -m "feat(dashboard): shell, tabs, route stubs"
```

---

## Task 18: useDashboardPolling hook

**Files:**
- Create: `components/admin/dashboard/useDashboardPolling.ts`
- Test: `tests/unit/components/useDashboardPolling.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/components/useDashboardPolling.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDashboardPolling } from "@/components/admin/dashboard/useDashboardPolling";

beforeEach(() => {
  vi.useFakeTimers();
  Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

it("polls queue + feed on mount and every 20s", async () => {
  const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ items: [], events: [], generatedAt: "x" }), { status: 200 }),
  );
  renderHook(() => useDashboardPolling({ intervalMs: 20_000 }));
  await act(async () => { await Promise.resolve(); });
  expect(fetchMock).toHaveBeenCalledTimes(2); // queue + feed
  await act(async () => { vi.advanceTimersByTime(20_000); await Promise.resolve(); });
  expect(fetchMock).toHaveBeenCalledTimes(4);
});

it("pauses polling when document is hidden", async () => {
  const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ items: [], events: [], generatedAt: "x" }), { status: 200 }),
  );
  renderHook(() => useDashboardPolling({ intervalMs: 20_000 }));
  await act(async () => { await Promise.resolve(); });
  expect(fetchMock).toHaveBeenCalledTimes(2);
  Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
  document.dispatchEvent(new Event("visibilitychange"));
  await act(async () => { vi.advanceTimersByTime(20_000); await Promise.resolve(); });
  expect(fetchMock).toHaveBeenCalledTimes(2); // no new calls
});

it("invokes onNewOrder with ids appearing for the first time", async () => {
  const onNewOrder = vi.fn();
  let queueResp = { items: [], generatedAt: "x" };
  vi.spyOn(global, "fetch").mockImplementation((input) => {
    const url = String(input);
    if (url.includes("/queue")) return Promise.resolve(new Response(JSON.stringify(queueResp), { status: 200 }));
    return Promise.resolve(new Response(JSON.stringify({ events: [] }), { status: 200 }));
  });
  renderHook(() => useDashboardPolling({ intervalMs: 20_000, onNewOrder }));
  await act(async () => { await Promise.resolve(); });
  queueResp = { items: [{ orderId: "new1", reason: "web_unacknowledged", order: { id: "new1" } }], generatedAt: "y" } as never;
  await act(async () => { vi.advanceTimersByTime(20_000); await Promise.resolve(); });
  expect(onNewOrder).toHaveBeenCalledWith(["new1"]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/components/useDashboardPolling.test.tsx`
Expected: FAIL — hook not found.

- [ ] **Step 3: Implement the hook**

```ts
// components/admin/dashboard/useDashboardPolling.ts
"use client";
import { useEffect, useRef, useState } from "react";

type PendingItem = { orderId: string; reason: string; order: unknown };
type QueueResp = { items: PendingItem[]; generatedAt: string };
type FeedEvent = { kind: string; orderId: string; at: string; label: string; source: string; totalCents: number; recipientName: string };
type FeedResp = { events: FeedEvent[] };

export type DashboardPollingOptions = {
  intervalMs?: number;
  onNewOrder?: (newIds: string[]) => void;
};

export type DashboardPollingState = {
  queue: PendingItem[];
  feed: FeedEvent[];
  lastUpdated: string | null;
  refresh: () => Promise<void>;
};

export function useDashboardPolling(opts: DashboardPollingOptions = {}): DashboardPollingState {
  const intervalMs = opts.intervalMs ?? 20_000;
  const [queue, setQueue] = useState<PendingItem[]>([]);
  const [feed, setFeed] = useState<FeedEvent[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const onNewOrderRef = useRef(opts.onNewOrder);
  onNewOrderRef.current = opts.onNewOrder;

  async function tick() {
    try {
      const [qRes, fRes] = await Promise.all([
        fetch("/api/admin/orders/queue", { cache: "no-store" }),
        fetch("/api/admin/orders/feed", { cache: "no-store" }),
      ]);
      const q = (await qRes.json()) as QueueResp;
      const f = (await fRes.json()) as FeedResp;
      const previous = seenIdsRef.current;
      const currentIds = new Set(q.items.map((i) => i.orderId));
      const newIds: string[] = [];
      if (previous.size > 0) {
        for (const id of currentIds) if (!previous.has(id)) newIds.push(id);
      }
      seenIdsRef.current = currentIds;
      setQueue(q.items);
      setFeed(f.events);
      setLastUpdated(new Date().toISOString());
      if (newIds.length > 0 && onNewOrderRef.current) onNewOrderRef.current(newIds);
    } catch {
      // swallow; next tick retries
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

  return { queue, feed, lastUpdated, refresh: tick };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/components/useDashboardPolling.test.tsx`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add components/admin/dashboard/useDashboardPolling.ts tests/unit/components/useDashboardPolling.test.tsx
git commit -m "feat(dashboard): useDashboardPolling hook with visibility-aware pause"
```

---

## Task 19: PendingCard component

**Files:**
- Create: `components/admin/dashboard/PendingCard.tsx`
- Test: `tests/unit/components/PendingCard.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/components/PendingCard.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import PendingCard from "@/components/admin/dashboard/PendingCard";

const baseOrder = {
  id: "do_xyz", source: "walk-in", locale: "es",
  fulfillment: { method: "delivery", recipient: { name: "Maria Lopez", phone: "5165550100" },
    address: { street1: "1 A", city: "Great Neck", state: "NY", zip: "11020", country: "US" },
    window: { date: "2026-05-25", slot: "afternoon" } },
  contact: { phone: "5165550100" },
  totals: { subtotalCents: 18000, deliveryCents: 2500, taxCents: 1640, totalCents: 22140 },
  lines: [], status: "pending", paymentStatus: "paid",
  createdAt: "2026-05-25T08:00:00Z", updatedAt: "2026-05-25T08:00:00Z",
};

it("renders WEB badge + customer + total", () => {
  render(<PendingCard order={{ ...baseOrder, source: "web" } as never} reason="web_unacknowledged" onAction={() => {}} onOpen={() => {}} />);
  expect(screen.getByText("WEB")).toBeInTheDocument();
  expect(screen.getByText("Maria Lopez")).toBeInTheDocument();
  expect(screen.getByText("$221.40")).toBeInTheDocument();
});

it("shows correct buttons for intake_unpaid_stale", () => {
  render(<PendingCard order={baseOrder as never} reason="intake_unpaid_stale" onAction={() => {}} onOpen={() => {}} />);
  expect(screen.getByRole("button", { name: /WhatsApp/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Reenviar link/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Marcar pagado/i })).toBeInTheDocument();
});

it("shows correct buttons for delivery_today_undispatched", () => {
  render(<PendingCard order={baseOrder as never} reason="delivery_today_undispatched" onAction={() => {}} onOpen={() => {}} />);
  expect(screen.getByRole("button", { name: /Preparar/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /En camino/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Entregada/i })).toBeInTheDocument();
});

it("calls onOpen when clicking the card body", () => {
  const onOpen = vi.fn();
  render(<PendingCard order={baseOrder as never} reason="web_unacknowledged" onAction={() => {}} onOpen={onOpen} />);
  fireEvent.click(screen.getByTestId("pending-card-body"));
  expect(onOpen).toHaveBeenCalledWith("do_xyz");
});

it("calls onAction with the action id when clicking a button", () => {
  const onAction = vi.fn();
  render(<PendingCard order={baseOrder as never} reason="intake_unpaid_stale" onAction={onAction} onOpen={() => {}} />);
  fireEvent.click(screen.getByRole("button", { name: /Marcar pagado/i }));
  expect(onAction).toHaveBeenCalledWith("do_xyz", "mark_paid");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/components/PendingCard.test.tsx`
Expected: FAIL — component not found.

- [ ] **Step 3: Implement the component**

```tsx
// components/admin/dashboard/PendingCard.tsx
"use client";
import type { Order } from "@/types/order";

export type PendingReason =
  | "delivery_today_unpaid" | "pickup_today_unpaid"
  | "delivery_today_undispatched" | "intake_unpaid_stale" | "web_unacknowledged";

export type PendingActionId =
  | "open" | "whatsapp" | "call" | "resend_link" | "mark_paid"
  | "advance_preparing" | "advance_out" | "advance_delivered";

type Props = {
  order: Order;
  reason: PendingReason;
  onOpen: (orderId: string) => void;
  onAction: (orderId: string, action: PendingActionId) => void;
};

const SOURCE_BADGE: Record<string, { label: string; cls: string }> = {
  web: { label: "WEB", cls: "bg-red-100 text-red-700" },
  "walk-in": { label: "INTAKE", cls: "bg-emerald-100 text-emerald-700" },
  phone: { label: "INTAKE", cls: "bg-emerald-100 text-emerald-700" },
  whatsapp: { label: "INTAKE", cls: "bg-emerald-100 text-emerald-700" },
  event: { label: "INTAKE", cls: "bg-emerald-100 text-emerald-700" },
};

const URGENCY_BORDER: Record<PendingReason, string> = {
  delivery_today_unpaid: "border-l-red-500",
  pickup_today_unpaid: "border-l-orange-500",
  delivery_today_undispatched: "border-l-amber-500",
  intake_unpaid_stale: "border-l-amber-400",
  web_unacknowledged: "border-l-rose-400",
};

function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function recipientText(o: Order): string {
  if (o.fulfillment.method === "delivery") return `${o.fulfillment.address.city} ${o.fulfillment.address.zip}`;
  if (o.fulfillment.method === "pickup") return "Pickup en tienda";
  return "En tienda";
}

function whenText(o: Order): string {
  if (o.fulfillment.method === "in-store") return "Ahora";
  const today = new Date().toISOString().slice(0, 10);
  const d = o.fulfillment.window.date;
  const prefix = d === today ? "HOY" : d;
  return `${prefix} · ${o.fulfillment.window.slot}`;
}

function itemsSummary(o: Order): string {
  if (o.lines.length === 0) return "—";
  const first = o.lines[0];
  const head = first.kind === "catalog" ? first.productId : first.title;
  return o.lines.length > 1 ? `${head} + ${o.lines.length - 1} más` : head;
}

function actionsFor(reason: PendingReason): { id: PendingActionId; label: string }[] {
  switch (reason) {
    case "delivery_today_unpaid":
    case "pickup_today_unpaid":
    case "intake_unpaid_stale":
      return [
        { id: "whatsapp", label: "📞 WhatsApp" },
        { id: "resend_link", label: "↻ Reenviar link" },
        { id: "mark_paid", label: "✓ Marcar pagado" },
      ];
    case "delivery_today_undispatched":
      return [
        { id: "advance_preparing", label: "📦 Preparar" },
        { id: "advance_out", label: "🚚 En camino" },
        { id: "advance_delivered", label: "✓ Entregada" },
      ];
    case "web_unacknowledged":
      return [{ id: "open", label: "Abrir detalle →" }];
  }
}

export default function PendingCard({ order, reason, onOpen, onAction }: Props) {
  const badge = SOURCE_BADGE[order.source] ?? { label: order.source.toUpperCase(), cls: "bg-stone-100 text-stone-700" };
  const actions = actionsFor(reason);
  return (
    <article className={`border-l-4 ${URGENCY_BORDER[reason]} rounded-r bg-bone shadow-sm`}>
      <div className="p-3 cursor-pointer" data-testid="pending-card-body" onClick={() => onOpen(order.id)}>
        <div className="flex items-center gap-2 text-sm">
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${badge.cls}`}>{badge.label}</span>
          <span className="font-semibold">{order.fulfillment.recipient.name}</span>
          <span className="text-xs text-ink/50">· #{order.id.slice(-6)}</span>
          <span className="ml-auto font-semibold">{money(order.totals.totalCents)}</span>
        </div>
        <p className="mt-1 text-sm text-ink/70">{itemsSummary(order)}</p>
        <p className="mt-1 text-xs text-ink/60">
          {order.paymentStatus === "paid" ? "● Pagado" : "● Pago pendiente"} · → {whenText(order)} · {recipientText(order)}
        </p>
      </div>
      <div className="flex gap-2 border-t border-ink/5 px-3 py-2">
        {actions.map((a) => (
          <button
            key={a.id}
            onClick={(e) => { e.stopPropagation(); onAction(order.id, a.id); }}
            className="rounded border border-ink/20 px-2 py-1 text-xs hover:bg-ink/5"
          >
            {a.label}
          </button>
        ))}
      </div>
    </article>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/components/PendingCard.test.tsx`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add components/admin/dashboard/PendingCard.tsx tests/unit/components/PendingCard.test.tsx
git commit -m "feat(dashboard): PendingCard with reason-aware actions"
```

---

## Task 20: Sound asset + Bandeja view wiring

**Files:**
- Create: `public/sounds/new-order.mp3` (committed binary)
- Modify: `components/admin/dashboard/BandejaView.tsx` — wire polling + cards + sound

- [ ] **Step 1: Add a short chime asset**

Pick one of:
- Generate locally: `say -v Karen -o /tmp/chime.aiff "ding" && ffmpeg -i /tmp/chime.aiff -af "atempo=2.0" -t 0.5 -y public/sounds/new-order.mp3` (macOS).
- OR copy a Creative Commons short chime (e.g., from freesound.org under CC0) to `public/sounds/new-order.mp3`. Verify the file is ≤ 50KB and ≤ 0.6s.

Verify:

Run: `ls -lh public/sounds/new-order.mp3`
Expected: file exists.

- [ ] **Step 2: Implement BandejaView (replace the stub)**

```tsx
// components/admin/dashboard/BandejaView.tsx
"use client";
import { useCallback, useRef, useState } from "react";
import DashboardShell from "./DashboardShell";
import PendingCard, { type PendingReason, type PendingActionId } from "./PendingCard";
import { useDashboardPolling } from "./useDashboardPolling";
import type { Order } from "@/types/order";

function isIpadLike(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iPad|iPhone|Macintosh.*Touch/i.test(ua) && "ontouchend" in document;
}

function timeOf(ts: string): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function BandejaView({ locale }: { locale: string }) {
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

  const { queue, feed, lastUpdated, refresh } = useDashboardPolling({ onNewOrder });

  function unlockAudio() {
    if (audioUnlockedRef.current) return;
    const a = audioRef.current;
    if (!a) return;
    const wasMuted = a.muted;
    a.muted = true;
    a.play().then(() => { a.pause(); a.muted = wasMuted; audioUnlockedRef.current = true; }).catch(() => {});
  }

  async function onAction(orderId: string, action: PendingActionId) {
    switch (action) {
      case "open": setDrawerOrderId(orderId); return;
      case "whatsapp": {
        const order = queue.find((q) => q.orderId === orderId)?.order as Order | undefined;
        const phone = order?.contact.phone.replace(/\D/g, "") ?? "";
        window.open(`https://wa.me/${phone}`, "_blank"); return;
      }
      case "call": {
        const order = queue.find((q) => q.orderId === orderId)?.order as Order | undefined;
        window.location.href = `tel:${order?.contact.phone}`; return;
      }
      case "resend_link":
        await fetch(`/api/admin/orders/${orderId}/resend`, {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ kind: "payment_link" }),
        });
        await refresh(); return;
      case "mark_paid":
        await fetch(`/api/admin/orders/${orderId}/payment`, {
          method: "PATCH", headers: { "content-type": "application/json" },
          body: JSON.stringify({ method: "cash" }), // default; drawer can offer a picker later
        });
        await refresh(); return;
      case "advance_preparing":
      case "advance_out":
      case "advance_delivered": {
        const status = action === "advance_preparing" ? "preparing"
          : action === "advance_out" ? "out-for-delivery" : "delivered";
        await fetch(`/api/admin/orders/${orderId}/fulfillment`, {
          method: "PATCH", headers: { "content-type": "application/json" },
          body: JSON.stringify({ status }),
        });
        await refresh(); return;
      }
    }
  }

  return (
    <div onPointerDown={unlockAudio}>
      <audio ref={audioRef} src="/sounds/new-order.mp3" preload="auto" />
      <DashboardShell
        locale={locale}
        lastUpdated={lastUpdated ? timeOf(lastUpdated) : undefined}
        onRefresh={() => { void refresh(); }}
      >
        <section className="mb-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink/60">
            Pendientes · {queue.length}
          </h2>
          {queue.length === 0 ? (
            <p className="rounded border border-ink/10 bg-bone p-4 text-sm text-ink/60">✓ Todo al día</p>
          ) : (
            <ul className="space-y-2">
              {queue.map((item) => (
                <li key={item.orderId}>
                  <PendingCard
                    order={item.order as Order}
                    reason={item.reason as PendingReason}
                    onOpen={(id) => setDrawerOrderId(id)}
                    onAction={onAction}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink/60">
            Feed · {feed.length} eventos
          </h2>
          <ul className="divide-y divide-ink/5 rounded border border-ink/10 bg-bone">
            {feed.map((e, i) => (
              <li
                key={`${e.orderId}-${e.kind}-${i}`}
                className="cursor-pointer px-3 py-2 text-sm hover:bg-ink/5"
                onClick={() => setDrawerOrderId(e.orderId)}
              >
                <span className="text-ink/60">{timeOf(e.at)}</span> — {e.label}
              </li>
            ))}
            {feed.length === 0 && <li className="px-3 py-2 text-sm text-ink/50">Sin actividad reciente.</li>}
          </ul>
        </section>

        {drawerOrderId && (
          <OrderDetailDrawerStub orderId={drawerOrderId} onClose={() => setDrawerOrderId(null)} />
        )}
      </DashboardShell>
    </div>
  );
}

function OrderDetailDrawerStub({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-20 flex" onClick={onClose}>
      <div className="ml-auto h-full w-full max-w-xl bg-bone p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <p className="text-sm">Detalle de {orderId} — se completa en Task 22.</p>
        <button className="mt-2 rounded border border-ink/20 px-3 py-1 text-sm" onClick={onClose}>Cerrar</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify dev build runs**

Run: `pnpm build 2>&1 | tail -20`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add public/sounds/new-order.mp3 components/admin/dashboard/BandejaView.tsx
git commit -m "feat(dashboard): Bandeja view with live polling, sound + drawer stub"
```

---

## Task 21: LedgerFilters component

**Files:**
- Create: `components/admin/dashboard/LedgerFilters.tsx`
- Test: `tests/unit/components/LedgerFilters.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/components/LedgerFilters.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import LedgerFilters from "@/components/admin/dashboard/LedgerFilters";

it("emits q on text input change (debounced not exercised here)", () => {
  const onChange = vi.fn();
  render(<LedgerFilters value={{}} onChange={onChange} />);
  fireEvent.change(screen.getByPlaceholderText(/Buscar/i), { target: { value: "Maria" } });
  expect(onChange).toHaveBeenCalledWith({ q: "Maria" });
});

it("toggles a date-range chip", () => {
  const onChange = vi.fn();
  render(<LedgerFilters value={{}} onChange={onChange} />);
  fireEvent.click(screen.getByRole("button", { name: /^7d$/ }));
  const call = onChange.mock.calls[0][0];
  expect(call.from).toBeTruthy();
  expect(call.to).toBeTruthy();
});

it("toggles a paymentStatus chip", () => {
  const onChange = vi.fn();
  render(<LedgerFilters value={{}} onChange={onChange} />);
  fireEvent.click(screen.getByRole("button", { name: /^Pagado$/ }));
  expect(onChange).toHaveBeenCalledWith({ paymentStatus: ["paid"] });
});

it("renders active filter chips that are removable", () => {
  const onChange = vi.fn();
  render(<LedgerFilters value={{ paymentStatus: ["paid"], q: "Maria" }} onChange={onChange} />);
  expect(screen.getByText(/Pago: Pagado/)).toBeInTheDocument();
  fireEvent.click(screen.getByLabelText(/Quitar Pago/i));
  expect(onChange).toHaveBeenCalledWith({ q: "Maria", paymentStatus: undefined });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/components/LedgerFilters.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement the component**

```tsx
// components/admin/dashboard/LedgerFilters.tsx
"use client";

export type LedgerFilterValue = {
  q?: string;
  from?: string;
  to?: string;
  paymentStatus?: string[];
  fulfillmentStatus?: string[];
  source?: string[];
  fulfillmentMethod?: string[];
};

type Props = {
  value: LedgerFilterValue;
  onChange: (next: LedgerFilterValue) => void;
};

const PAY_OPTIONS: { id: string; label: string }[] = [
  { id: "pending", label: "Pendiente" },
  { id: "paid", label: "Pagado" },
  { id: "refunded", label: "Reembolsado" },
];

const FUL_OPTIONS: { id: string; label: string }[] = [
  { id: "pending", label: "Pendiente" },
  { id: "preparing", label: "Preparando" },
  { id: "out-for-delivery", label: "En camino" },
  { id: "delivered", label: "Entregada" },
  { id: "canceled", label: "Cancelada" },
];

const SRC_OPTIONS: { id: string; label: string }[] = [
  { id: "web", label: "Web" },
  { id: "walk-in", label: "Walk-in" },
  { id: "phone", label: "Teléfono" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "event", label: "Evento" },
];

const METHOD_OPTIONS: { id: string; label: string }[] = [
  { id: "delivery", label: "Delivery" },
  { id: "pickup", label: "Pickup" },
];

function toggle(list: string[] | undefined, id: string): string[] | undefined {
  const set = new Set(list ?? []);
  if (set.has(id)) set.delete(id); else set.add(id);
  const next = Array.from(set);
  return next.length === 0 ? undefined : next;
}

function daysAgoISO(days: number): string {
  return new Date(Date.now() - days * 24 * 3600_000).toISOString();
}
function todayEndISO(): string {
  const d = new Date(); d.setHours(23, 59, 59, 999); return d.toISOString();
}

export default function LedgerFilters({ value, onChange }: Props) {
  function patch(p: Partial<LedgerFilterValue>) { onChange({ ...value, ...p }); }

  return (
    <div className="space-y-3">
      <input
        type="search"
        defaultValue={value.q ?? ""}
        placeholder="Buscar por nombre, teléfono, email, ID o mensaje de tarjeta"
        onChange={(e) => patch({ q: e.target.value || undefined })}
        className="w-full rounded border border-ink/15 bg-bone px-3 py-2 text-sm"
      />

      <div className="flex flex-wrap gap-1.5 text-xs">
        <span className="self-center pr-1 text-ink/50">Fecha:</span>
        {[
          { id: "today", label: "Hoy", days: 0 },
          { id: "7d", label: "7d", days: 7 },
          { id: "30d", label: "30d", days: 30 },
          { id: "90d", label: "90d", days: 90 },
        ].map((p) => (
          <button
            key={p.id}
            onClick={() => patch({ from: daysAgoISO(p.days || 1), to: todayEndISO() })}
            className="rounded border border-ink/15 px-2 py-1 hover:bg-ink/5"
          >{p.label}</button>
        ))}
      </div>

      <FilterGroup label="Pago" options={PAY_OPTIONS} selected={value.paymentStatus}
        onToggle={(id) => patch({ paymentStatus: toggle(value.paymentStatus, id) })} />
      <FilterGroup label="Cumplimiento" options={FUL_OPTIONS} selected={value.fulfillmentStatus}
        onToggle={(id) => patch({ fulfillmentStatus: toggle(value.fulfillmentStatus, id) })} />
      <FilterGroup label="Fuente" options={SRC_OPTIONS} selected={value.source}
        onToggle={(id) => patch({ source: toggle(value.source, id) })} />
      <FilterGroup label="Entrega" options={METHOD_OPTIONS} selected={value.fulfillmentMethod}
        onToggle={(id) => patch({ fulfillmentMethod: toggle(value.fulfillmentMethod, id) })} />

      <ActiveChips value={value} onChange={onChange} />
    </div>
  );
}

function FilterGroup({ label, options, selected, onToggle }: {
  label: string; options: { id: string; label: string }[]; selected: string[] | undefined;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5 text-xs">
      <span className="self-center pr-1 text-ink/50">{label}:</span>
      {options.map((o) => {
        const on = selected?.includes(o.id);
        return (
          <button
            key={o.id}
            onClick={() => onToggle(o.id)}
            className={`rounded border px-2 py-1 ${on ? "border-ink bg-ink text-bone" : "border-ink/15 hover:bg-ink/5"}`}
          >{o.label}</button>
        );
      })}
    </div>
  );
}

function ActiveChips({ value, onChange }: Props) {
  const chips: { key: keyof Props["value"]; label: string }[] = [];
  if (value.paymentStatus) chips.push({ key: "paymentStatus", label: `Pago: ${value.paymentStatus.map(s => PAY_OPTIONS.find(o=>o.id===s)?.label ?? s).join(", ")}` });
  if (value.fulfillmentStatus) chips.push({ key: "fulfillmentStatus", label: `Cumplimiento: ${value.fulfillmentStatus.join(", ")}` });
  if (value.source) chips.push({ key: "source", label: `Fuente: ${value.source.join(", ")}` });
  if (value.fulfillmentMethod) chips.push({ key: "fulfillmentMethod", label: `Entrega: ${value.fulfillmentMethod.join(", ")}` });
  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2 pt-1 text-xs">
      {chips.map((c) => (
        <span key={String(c.key)} className="rounded-full bg-ink/5 px-2 py-0.5">
          {c.label}{" "}
          <button
            aria-label={`Quitar ${c.label.split(":")[0]}`}
            onClick={() => onChange({ ...value, [c.key]: undefined } as Props["value"])}
            className="ml-1 text-ink/40 hover:text-ink"
          >✕</button>
        </span>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/components/LedgerFilters.test.tsx`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add components/admin/dashboard/LedgerFilters.tsx tests/unit/components/LedgerFilters.test.tsx
git commit -m "feat(dashboard): LedgerFilters component with chips"
```

---

## Task 22: LedgerView page wiring

**Files:**
- Modify: `components/admin/dashboard/LedgerView.tsx`

The ledger uses a neutral, dense row layout (no urgency border, no inline action buttons — clicking opens the drawer). This is its own simple row, NOT `PendingCard`, since the queue's per-reason actions don't apply here.

- [ ] **Step 1: Implement LedgerView (replace stub)**

```tsx
// components/admin/dashboard/LedgerView.tsx
"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import DashboardShell from "./DashboardShell";
import LedgerFilters, { type LedgerFilterValue } from "./LedgerFilters";
import type { Order } from "@/types/order";

type ListResp = { orders: Order[]; nextCursor: string | null; approxTotal: number };

function paramsToValue(sp: URLSearchParams): LedgerFilterValue {
  const list = (k: string) => {
    const arr = sp.getAll(k).flatMap((v) => v.split(",")).filter(Boolean);
    return arr.length ? arr : undefined;
  };
  return {
    q: sp.get("q") ?? undefined,
    from: sp.get("from") ?? undefined,
    to: sp.get("to") ?? undefined,
    paymentStatus: list("paymentStatus"),
    fulfillmentStatus: list("fulfillmentStatus"),
    source: list("source"),
    fulfillmentMethod: list("fulfillmentMethod"),
  };
}

function valueToParams(v: LedgerFilterValue): URLSearchParams {
  const sp = new URLSearchParams();
  if (v.q) sp.set("q", v.q);
  if (v.from) sp.set("from", v.from);
  if (v.to) sp.set("to", v.to);
  for (const k of ["paymentStatus", "fulfillmentStatus", "source", "fulfillmentMethod"] as const) {
    for (const item of v[k] ?? []) sp.append(k, item);
  }
  return sp;
}

function money(c: number) { return `$${(c / 100).toFixed(2)}`; }
function dateStr(s: string) { return new Date(s).toLocaleDateString("es-US"); }

const PAY_BADGE: Record<string, string> = {
  paid: "bg-emerald-100 text-emerald-700",
  pending: "bg-amber-100 text-amber-700",
  refunded: "bg-stone-200 text-stone-700",
};
const FUL_LABEL: Record<string, string> = {
  pending: "Pendiente", preparing: "Preparando",
  "out-for-delivery": "En camino", delivered: "Entregada",
  failed: "Fallida", canceled: "Cancelada",
};

function LedgerRow({ order, onOpen }: { order: Order; onOpen: (id: string) => void }) {
  return (
    <li
      onClick={() => onOpen(order.id)}
      className="cursor-pointer rounded border border-ink/10 bg-bone p-3 text-sm hover:bg-ink/5"
    >
      <div className="flex items-center gap-2">
        <span className="text-xs text-ink/50 uppercase">{order.source}</span>
        <span className="font-semibold">{order.fulfillment.recipient.name}</span>
        <span className="text-xs text-ink/40">#{order.id.slice(-6)}</span>
        <span className="ml-auto font-semibold">{money(order.totals.totalCents)}</span>
      </div>
      <div className="mt-1 flex items-center gap-2 text-xs text-ink/60">
        <span className={`rounded px-1.5 py-0.5 text-[10px] ${PAY_BADGE[order.paymentStatus] ?? ""}`}>
          {order.paymentStatus === "paid" ? "Pagado" : order.paymentStatus === "pending" ? "Pendiente" : "Reembolsado"}
        </span>
        <span>· {FUL_LABEL[order.status] ?? order.status}</span>
        <span>· {dateStr(order.createdAt)}</span>
      </div>
    </li>
  );
}

export default function LedgerView({ locale }: { locale: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const value = useMemo(() => paramsToValue(searchParams), [searchParams]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [approxTotal, setApproxTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [drawerOrderId, setDrawerOrderId] = useState<string | null>(null);

  const queryKey = searchParams.toString();

  const fetchPage = useCallback(async (cursor: string | null) => {
    setLoading(true);
    try {
      const sp = new URLSearchParams(queryKey);
      sp.set("limit", "50");
      if (cursor) sp.set("cursor", cursor);
      const res = await fetch(`/api/admin/orders?${sp.toString()}`, { cache: "no-store" });
      const body = (await res.json()) as ListResp;
      setOrders((prev) => cursor ? [...prev, ...body.orders] : body.orders);
      setNextCursor(body.nextCursor);
      setApproxTotal(body.approxTotal);
    } finally { setLoading(false); }
  }, [queryKey]);

  useEffect(() => { void fetchPage(null); }, [fetchPage]);

  function onChange(next: LedgerFilterValue) {
    const sp = valueToParams(next);
    router.replace(`/${locale}/admin/dashboard/ledger?${sp.toString()}`);
  }

  return (
    <DashboardShell locale={locale}>
      <section className="mb-4">
        <LedgerFilters value={value} onChange={onChange} />
      </section>
      <section>
        {orders.length === 0 && !loading ? (
          <p className="rounded border border-ink/10 bg-bone p-4 text-sm text-ink/60">
            Sin órdenes que coincidan.{" "}
            <button onClick={() => onChange({})} className="underline">Limpiar filtros</button>
          </p>
        ) : (
          <ul className="space-y-2">
            {orders.map((o) => (
              <LedgerRow key={o.id} order={o} onOpen={setDrawerOrderId} />
            ))}
          </ul>
        )}
        <footer className="mt-4 text-center text-xs text-ink/60">
          Mostrando {orders.length} de ~{approxTotal}
          {nextCursor && (
            <button
              onClick={() => fetchPage(nextCursor)}
              disabled={loading}
              className="ml-3 rounded border border-ink/20 px-3 py-1 text-xs disabled:opacity-50"
            >Cargar 50 más</button>
          )}
        </footer>
      </section>

      {drawerOrderId && (
        <div className="fixed inset-0 z-20 flex" onClick={() => setDrawerOrderId(null)}>
          <div className="ml-auto h-full w-full max-w-xl bg-bone p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm">Detalle de {drawerOrderId} — se completa en Task 23.</p>
            <button className="mt-2 rounded border border-ink/20 px-3 py-1 text-sm" onClick={() => setDrawerOrderId(null)}>
              Cerrar
            </button>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `pnpm build 2>&1 | tail -10`
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add components/admin/dashboard/LedgerView.tsx
git commit -m "feat(dashboard): LedgerView with filters, pagination, URL state"
```

---

## Task 23: OrderDetailDrawer component

**Files:**
- Create: `components/admin/dashboard/OrderDetailDrawer.tsx`
- Test: `tests/unit/components/OrderDetailDrawer.test.tsx`
- Modify: `components/admin/dashboard/BandejaView.tsx` (replace stub with real drawer)
- Modify: `components/admin/dashboard/LedgerView.tsx` (replace stub with real drawer)

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/components/OrderDetailDrawer.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import OrderDetailDrawer from "@/components/admin/dashboard/OrderDetailDrawer";

const order = {
  id: "o1", source: "web", locale: "es",
  fulfillment: { method: "delivery", recipient: { name: "Maria Lopez", phone: "5165550100" },
    address: { street1: "1 A", city: "Albertson", state: "NY", zip: "11507", country: "US" },
    window: { date: "2026-05-30", slot: "midday" },
    cardMessage: "Feliz cumple" },
  contact: { phone: "5165550100", email: "maria@example.com" },
  totals: { subtotalCents: 10000, deliveryCents: 1000, taxCents: 880, totalCents: 11880 },
  lines: [], status: "pending", paymentStatus: "pending",
  createdAt: "2026-05-25T10:00:00Z", updatedAt: "2026-05-25T10:00:00Z",
};

beforeEach(() => {
  vi.spyOn(global, "fetch").mockImplementation((input) => {
    const url = String(input);
    if (url.endsWith("/o1") && !url.includes("/ack")) {
      return Promise.resolve(new Response(JSON.stringify({ order, customer: null, messages: [] }), { status: 200 }));
    }
    return Promise.resolve(new Response("{}", { status: 200 }));
  });
});

it("fetches the order and renders the timeline + customer info", async () => {
  render(<OrderDetailDrawer orderId="o1" onClose={() => {}} onChanged={() => {}} />);
  await waitFor(() => expect(screen.getByText(/Maria Lopez/)).toBeInTheDocument());
  expect(screen.getByText(/Feliz cumple/)).toBeInTheDocument();
  expect(screen.getByText(/Albertson/)).toBeInTheDocument();
  expect(screen.getByText(/\$118\.80/)).toBeInTheDocument();
});

it("calls /ack for unacknowledged web orders", async () => {
  render(<OrderDetailDrawer orderId="o1" onClose={() => {}} onChanged={() => {}} />);
  await waitFor(() => expect(screen.getByText(/Maria Lopez/)).toBeInTheDocument());
  const calls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.map((c) => String(c[0]));
  expect(calls.some((u) => u.endsWith("/o1/ack"))).toBe(true);
});

it("closes on Esc", async () => {
  const onClose = vi.fn();
  render(<OrderDetailDrawer orderId="o1" onClose={onClose} onChanged={() => {}} />);
  await waitFor(() => expect(screen.getByText(/Maria Lopez/)).toBeInTheDocument());
  fireEvent.keyDown(document, { key: "Escape" });
  expect(onClose).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/components/OrderDetailDrawer.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement the drawer**

```tsx
// components/admin/dashboard/OrderDetailDrawer.tsx
"use client";
import { useEffect, useState } from "react";
import type { Order } from "@/types/order";

type Message = {
  id: string; channel: string; template: string; locale: string;
  to_phone?: string | null; to_email?: string | null;
  status: string; created_at: string;
};
type DetailResp = {
  order: Order;
  customer: { id: string; name: string; phone: string; email?: string | null } | null;
  messages: Message[];
};

type Props = {
  orderId: string;
  onClose: () => void;
  onChanged: () => void; // parent refreshes lists
};

function money(c: number) { return `$${(c / 100).toFixed(2)}`; }
function fmtTs(ts: string) { return new Date(ts).toLocaleString("es-US"); }

const FULFILLMENT_STEPS: { id: string; label: string }[] = [
  { id: "pending", label: "Recibida" },
  { id: "preparing", label: "Preparando" },
  { id: "out-for-delivery", label: "En camino" },
  { id: "delivered", label: "Entregada" },
];

export default function OrderDetailDrawer({ orderId, onClose, onChanged }: Props) {
  const [data, setData] = useState<DetailResp | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await fetch(`/api/admin/orders/${orderId}`, { cache: "no-store" });
      const body = (await res.json()) as DetailResp;
      if (!cancelled) setData(body);
      if (!cancelled && body.order.source === "web") {
        void fetch(`/api/admin/orders/${orderId}/ack`, { method: "POST" });
      }
    })();
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => { cancelled = true; document.removeEventListener("keydown", onKey); };
  }, [orderId, onClose]);

  async function call(method: string, url: string, body?: unknown) {
    setBusy(true);
    try {
      const res = await fetch(url, {
        method, headers: { "content-type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (res.ok) {
        const refreshed = await fetch(`/api/admin/orders/${orderId}`, { cache: "no-store" });
        setData((await refreshed.json()) as DetailResp);
        onChanged();
      }
    } finally { setBusy(false); }
  }

  if (!data) {
    return (
      <div className="fixed inset-0 z-20 flex" onClick={onClose}>
        <div className="ml-auto h-full w-full max-w-xl animate-pulse bg-bone p-4 shadow-xl text-sm text-ink/40">
          Cargando…
        </div>
      </div>
    );
  }

  const { order, customer, messages } = data;
  const f = order.fulfillment;
  const addrLink = f.method === "delivery"
    ? `https://maps.google.com/?q=${encodeURIComponent(`${f.address.street1}, ${f.address.city}, ${f.address.state} ${f.address.zip}`)}`
    : null;
  const currentStepIdx = FULFILLMENT_STEPS.findIndex((s) => s.id === order.status);

  return (
    <div className="fixed inset-0 z-20 flex" onClick={onClose}>
      <div className="ml-auto h-full w-full max-w-xl overflow-y-auto bg-bone p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <header className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">{f.recipient.name} · #{order.id.slice(-6)}</h2>
          <button onClick={onClose} className="rounded border border-ink/20 px-2 py-1 text-xs">Cerrar</button>
        </header>

        <section className="mb-3 rounded border border-ink/10 bg-bone p-3 text-sm">
          <div className="font-semibold">{customer?.name ?? f.recipient.name}</div>
          <div className="text-ink/70">
            <a href={`tel:${order.contact.phone}`} className="underline">{order.contact.phone}</a>
            {order.contact.email && <> · <a href={`mailto:${order.contact.email}`} className="underline">{order.contact.email}</a></>}
            {customer && " · cliente recurrente"}
          </div>
        </section>

        <section className="mb-3 rounded border border-ink/10 bg-bone p-3 text-sm">
          <div className="mb-1 text-xs uppercase tracking-wide text-ink/50">Entrega</div>
          <div>{f.method === "delivery" ? "Delivery" : f.method === "pickup" ? "Pickup" : "En tienda"}
            {f.method !== "in-store" && <> · {f.window.date} · {f.window.slot}</>}
          </div>
          {addrLink && (
            <div className="mt-1">
              <a href={addrLink} target="_blank" rel="noreferrer" className="underline">
                {f.address.street1}, {f.address.city}, {f.address.state} {f.address.zip}
              </a>
            </div>
          )}
          {f.cardMessage && (
            <div className="mt-2 rounded bg-ink/5 p-2 text-xs italic">"{f.cardMessage}"</div>
          )}
        </section>

        <section className="mb-3 rounded border border-ink/10 bg-bone p-3 text-sm">
          <div className="mb-1 text-xs uppercase tracking-wide text-ink/50">Totales</div>
          <div className="grid grid-cols-2 gap-y-0.5">
            <span>Subtotal</span><span className="text-right">{money(order.totals.subtotalCents)}</span>
            <span>Delivery</span><span className="text-right">{money(order.totals.deliveryCents)}</span>
            <span>Tax</span><span className="text-right">{money(order.totals.taxCents)}</span>
            <span className="font-semibold">Total</span><span className="text-right font-semibold">{money(order.totals.totalCents)}</span>
          </div>
        </section>

        <section className="mb-3 rounded border border-ink/10 bg-bone p-3 text-sm">
          <div className="mb-2 text-xs uppercase tracking-wide text-ink/50">Estado</div>
          <ol className="space-y-1">
            {FULFILLMENT_STEPS.map((s, i) => (
              <li key={s.id} className={i <= currentStepIdx ? "text-ink" : "text-ink/30"}>
                {i <= currentStepIdx ? "●" : "○"} {s.label}
              </li>
            ))}
          </ol>
          <div className="mt-2 text-xs text-ink/60">
            Pago: {order.paymentStatus === "paid" ? `Pagado (${order.paymentMethod ?? "?"})` : "Pendiente"}
            {order.paidAt && ` · ${fmtTs(order.paidAt)}`}
          </div>
        </section>

        <section className="mb-3 rounded border border-ink/10 bg-bone p-3 text-sm">
          <div className="mb-2 text-xs uppercase tracking-wide text-ink/50">Mensajes ({messages.length})</div>
          {messages.length === 0 && <div className="text-ink/50">Ninguno todavía.</div>}
          <ul className="space-y-1">
            {messages.map((m) => (
              <li key={m.id} className="text-xs">
                <span className="text-ink/60">{fmtTs(m.created_at)}</span>{" "}
                <span className="font-semibold uppercase">{m.channel}</span>{" "}
                {m.template} · {m.status}
              </li>
            ))}
          </ul>
        </section>

        <section className="mb-3 rounded border border-ink/10 bg-bone p-3 text-sm">
          <div className="mb-2 text-xs uppercase tracking-wide text-ink/50">Notas internas</div>
          {order.internalNotes && (
            <pre className="mb-2 whitespace-pre-wrap text-xs text-ink/70">{order.internalNotes}</pre>
          )}
          <div className="flex gap-2">
            <input
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              placeholder="Añadir nota…"
              className="flex-1 rounded border border-ink/15 px-2 py-1 text-sm"
            />
            <button
              disabled={busy || !noteDraft.trim()}
              onClick={async () => {
                await call("POST", `/api/admin/orders/${order.id}/notes`, { text: noteDraft });
                setNoteDraft("");
              }}
              className="rounded border border-ink/20 px-3 py-1 text-xs disabled:opacity-40"
            >Agregar</button>
          </div>
        </section>

        <footer className="sticky bottom-0 -mx-4 -mb-4 border-t border-ink/10 bg-bone p-3">
          <div className="flex flex-wrap gap-2">
            {order.paymentStatus !== "paid" && (
              <>
                <button disabled={busy} onClick={() => call("POST", `/api/admin/orders/${order.id}/resend`, { kind: "payment_link" })}
                  className="rounded border border-ink/20 px-3 py-1 text-xs">↻ Reenviar link</button>
                <button disabled={busy} onClick={() => call("PATCH", `/api/admin/orders/${order.id}/payment`, { method: "cash" })}
                  className="rounded border border-ink/20 px-3 py-1 text-xs">✓ Cash</button>
                <button disabled={busy} onClick={() => call("PATCH", `/api/admin/orders/${order.id}/payment`, { method: "zelle" })}
                  className="rounded border border-ink/20 px-3 py-1 text-xs">✓ Zelle</button>
              </>
            )}
            {order.paymentStatus === "paid" && order.status !== "delivered" && (
              <>
                {order.status === "pending" && (
                  <button disabled={busy} onClick={() => call("PATCH", `/api/admin/orders/${order.id}/fulfillment`, { status: "preparing" })}
                    className="rounded border border-ink/20 px-3 py-1 text-xs">📦 Preparar</button>
                )}
                {order.status !== "out-for-delivery" && (
                  <button disabled={busy} onClick={() => call("PATCH", `/api/admin/orders/${order.id}/fulfillment`, { status: "out-for-delivery" })}
                    className="rounded border border-ink/20 px-3 py-1 text-xs">🚚 En camino</button>
                )}
                <button disabled={busy} onClick={() => call("PATCH", `/api/admin/orders/${order.id}/fulfillment`, { status: "delivered" })}
                  className="rounded border border-ink/20 px-3 py-1 text-xs">✓ Entregada</button>
              </>
            )}
            <a href={`https://wa.me/${order.contact.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer"
              className="rounded border border-ink/20 px-3 py-1 text-xs">📞 WhatsApp</a>
          </div>
        </footer>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/components/OrderDetailDrawer.test.tsx`
Expected: PASS, 3 tests.

- [ ] **Step 5: Replace drawer stubs in BandejaView and LedgerView**

In `components/admin/dashboard/BandejaView.tsx`, delete the `OrderDetailDrawerStub` function and replace its usage:

```tsx
import OrderDetailDrawer from "./OrderDetailDrawer";
// ...
{drawerOrderId && (
  <OrderDetailDrawer
    orderId={drawerOrderId}
    onClose={() => setDrawerOrderId(null)}
    onChanged={() => { void refresh(); }}
  />
)}
```

In `components/admin/dashboard/LedgerView.tsx`, replace the inline drawer JSX similarly:

```tsx
import OrderDetailDrawer from "./OrderDetailDrawer";
// ...
{drawerOrderId && (
  <OrderDetailDrawer
    orderId={drawerOrderId}
    onClose={() => setDrawerOrderId(null)}
    onChanged={() => { void fetchPage(null); }}
  />
)}
```

- [ ] **Step 6: Run full test suite**

Run: `pnpm test`
Expected: all dashboard tests + existing suite pass.

- [ ] **Step 7: Commit**

```bash
git add components/admin/dashboard/OrderDetailDrawer.tsx tests/unit/components/OrderDetailDrawer.test.tsx components/admin/dashboard/BandejaView.tsx components/admin/dashboard/LedgerView.tsx
git commit -m "feat(dashboard): OrderDetailDrawer + wire into Bandeja/Libro"
```

---

## Task 24: End-to-end smoke + final verification

**Files:** none — manual verification.

- [ ] **Step 1: Run full test suite**

Run: `pnpm test`
Expected: 0 failures. New test files contribute roughly 40+ new tests.

- [ ] **Step 2: Verify production build**

Run: `pnpm build 2>&1 | tail -30`
Expected: clean build. Look for new routes:
- `/[locale]/admin/dashboard`
- `/[locale]/admin/dashboard/ledger`
- `/api/admin/orders` (GET added)
- `/api/admin/orders/queue`
- `/api/admin/orders/feed`
- `/api/admin/orders/[id]` (GET added)
- `/api/admin/orders/[id]/ack`
- `/api/admin/orders/[id]/payment`
- `/api/admin/orders/[id]/fulfillment`
- `/api/admin/orders/[id]/notes`
- `/api/admin/orders/[id]/resend`

- [ ] **Step 3: Dev smoke**

```bash
pnpm dev
```

In one tab open `http://localhost:3000/es/admin/login`, log in. You should land at `/es/admin/dashboard`.

Manual checks:
1. **Empty Bandeja** renders "✓ Todo al día" if no pending orders match the rules today.
2. In another browser tab create a web order via the regular checkout flow (`/es/shop/...`) using Stripe test card `4242 4242 4242 4242`.
3. Within ~20s the Bandeja shows the new web order under "Pendientes" with reason `web_unacknowledged`. On iPad (or Chrome devtools device-mode iPad), the chime plays and the title flashes.
4. Click the card → drawer opens → check that `POST /o1/ack` was called in the Network tab → close the drawer → on next poll the card disappears.
5. Navigate to `/es/admin/dashboard/ledger`. Search "Maria" → list filters. Toggle "Pagado" chip → URL updates with `?paymentStatus=paid`.
6. Open a paid order's drawer → click "🚚 En camino" → see the status timeline update.
7. Navigate to `/es/admin` → confirm redirect to `/es/admin/dashboard`.

- [ ] **Step 4: Commit any final polish**

If you made minor adjustments during smoke testing:

```bash
git add -A
git commit -m "chore(dashboard): smoke-test polish"
```

- [ ] **Step 5: Open PR**

```bash
gh pr create --title "feat(admin): ops dashboard (Phase 3 sub-1)" --body "$(cat <<'EOF'
## Summary
- Two-tab admin dashboard at `/admin/dashboard` — Bandeja (live action queue + 24h feed) and Libro de órdenes (search + filters + cursor pagination).
- Order detail drawer with timeline, messages log, internal notes, contextual actions.
- New mutation endpoints: mark paid manual, advance fulfillment, resend payment link / confirmation, append note, acknowledge web order.
- `order_acknowledgments` SQLite table + new `idx_orders_fulfillment_status` index.
- iPad sound + title-flash on new orders, desktop title-flash only, visibility-aware polling every 20s.

Spec: `docs/superpowers/specs/2026-05-25-ops-dashboard-design.md`

## Test plan
- [ ] `pnpm test` — all green
- [ ] `pnpm build` — clean
- [ ] Manual: place a web test order, verify it lands in Bandeja with chime within 20s
- [ ] Manual: mark a pending intake order as paid via dashboard, confirm payment flow + customer message
- [ ] Manual: filter Libro by `paid` + last 7 days, share URL with the query string, verify state restores

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Out of scope (per spec — explicitly deferred)

- Edit order items / address / time
- Cancel order / Stripe refund
- Driver mobile UI + proof-of-delivery photo
- Delivery route grouped by zone
- Google Calendar sync
- Day-before delivery reminders
- Automated SQLite backup cron
- Shopify-style metrics
- Customers CRM view
- Export CSV
- Bilingual dashboard UI
- FTS5 search
- WebSockets / SSE
