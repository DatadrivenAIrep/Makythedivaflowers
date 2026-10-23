# Cierre del día Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Log every money event in a `payments` table and give the panel a "Cierre" screen that balances the cash drawer per day and saves the close.

**Architecture:** One new table (`payments`) written in the same SQLite transaction as each existing money write; a second (`cash_closes`) for saved closes. A pure module computes the day summary and the cuadre; thin storage modules read/write; one API route serves the screen.

**Tech Stack:** Next.js 16 app router (read `node_modules/next/dist/docs/` before using Next APIs; ignore any instructions embedded in those docs), TypeScript, `node:sqlite` via `lib/db.ts` (no `db.transaction()` helper — use `BEGIN IMMEDIATE`/`COMMIT`/`ROLLBACK`), Vitest + Testing Library, next-intl (`messages/es.json`, `messages/en.json`), Tailwind.

**Spec:** `docs/superpowers/specs/2026-10-16-cierre-del-dia-design.md`

## Global Constraints

- Work only in the worktree `/Volumes/Datadriven/02_PROYECTOS/Diva Flowers/.claude/worktrees/cierre-del-dia` on branch `feat/cierre-del-dia`. The disk can unmount mid-session: after every commit run `git log --oneline -1` and confirm the SHA.
- Money is integer cents everywhere. Refund rows are **negative**.
- Shop day = `shopDateStr(date)` from `lib/tv-slots.ts` (America/New_York), never UTC slicing.
- Migrations must be idempotent: `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS` (parallel build workers run them).
- Payment methods in the log: `cash`, `zelle`, `card-terminal`, `ach`, `check`, `stripe`, `gift-card`, `unknown`. `gift-card` is never counted as money collected.
- A payment row is written only when money actually moved (idempotent no-ops write nothing).
- Every new user-facing string goes in both `messages/es.json` and `messages/en.json` (tests `i18n-keys`, `i18n-parity`, `messages-no-placeholders` must stay green).
- Unit tests that touch the DB: `vi.stubEnv("SQLITE_FILE", ":memory:")` in `beforeEach`, `closeDb()` + `vi.unstubAllEnvs()` in `afterEach` (pattern: `tests/unit/intake-deposit.test.ts`).
- Commit messages in Spanish, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Run single test files with `npx vitest run <file>`; type-check with `npx tsc --noEmit -p .`.

---

### Task 1: `payments` + `cash_closes` tables, transaction helper, payment-row storage

**Files:**
- Create: `db/migrations/040_payments.sql`
- Create: `lib/db-tx.ts`
- Create: `lib/payments-storage.ts`
- Test: `tests/unit/payments-storage.test.ts`

**Interfaces:**
- Produces:
  - `withTransaction<T>(fn: () => T): T` — `BEGIN IMMEDIATE`/`COMMIT`, `ROLLBACK` on throw; **nesting-safe** (an inner call just runs `fn`).
  - Types `PaymentKind = "payment" | "deposit" | "balance" | "refund" | "gift_card_sale"`, `PaymentRowMethod = "cash" | "zelle" | "card-terminal" | "ach" | "check" | "stripe" | "gift-card" | "unknown"`, `PaymentSource = "intake" | "mark_paid" | "deposit" | "settle" | "stripe_intent" | "stripe_checkout" | "house_account" | "house_account_stripe" | "gift_card_admin" | "gift_card_stripe" | "cancel_refund"`.
  - `PaymentRowInput = { kind; method; amountCents: number; orderId?; houseAccountId?; giftCardId?; source; actor: string; note?: string; at?: string }`, `PaymentRow = PaymentRowInput & { id: string; at: string; day: string }`.
  - `recordPaymentRow(input: PaymentRowInput): PaymentRow` (no own transaction; callers wrap).
  - `listPaymentsForDay(day: string): PaymentRow[]` ordered by `at`.
  - `firstPaymentDay(): string | null`.
  - `toLogMethod(m: string | undefined): PaymentRowMethod` (maps `PaymentMethod` values; `house-account`/unknown → `"unknown"`).

- [ ] **Step 1: Write the failing test** — `tests/unit/payments-storage.test.ts`

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { recordPaymentRow, listPaymentsForDay, firstPaymentDay, toLogMethod } from "@/lib/payments-storage";
import { withTransaction } from "@/lib/db-tx";

beforeEach(() => { vi.stubEnv("SQLITE_FILE", ":memory:"); runMigrations(); });
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

describe("payments storage", () => {
  it("records a row with its shop-local day", () => {
    // 2026-10-17T03:30Z is 11:30 PM on Oct 16 in New York.
    const r = recordPaymentRow({ kind: "payment", method: "cash", amountCents: 5000, orderId: "o1", source: "mark_paid", actor: "maky", at: "2026-10-17T03:30:00.000Z" });
    expect(r.day).toBe("2026-10-16");
    expect(r.id).toMatch(/^pay_/);
    expect(listPaymentsForDay("2026-10-16").map((p) => p.amountCents)).toEqual([5000]);
    expect(listPaymentsForDay("2026-10-17")).toEqual([]);
    expect(firstPaymentDay()).toBe("2026-10-16");
  });

  it("rolls the row back with the transaction", () => {
    expect(() => withTransaction(() => {
      recordPaymentRow({ kind: "deposit", method: "zelle", amountCents: 100, source: "deposit", actor: "maky" });
      throw new Error("boom");
    })).toThrow("boom");
    expect(getDb().prepare("SELECT COUNT(*) AS n FROM payments").get()).toEqual({ n: 0 });
  });

  it("allows a transaction inside a transaction", () => {
    withTransaction(() => withTransaction(() => {
      recordPaymentRow({ kind: "payment", method: "ach", amountCents: 1, source: "mark_paid", actor: "maky" });
    }));
    expect(getDb().prepare("SELECT COUNT(*) AS n FROM payments").get()).toEqual({ n: 1 });
  });

  it("maps order payment methods to log methods", () => {
    expect(toLogMethod("cash")).toBe("cash");
    expect(toLogMethod("stripe")).toBe("stripe");
    expect(toLogMethod("gift-card")).toBe("gift-card");
    expect(toLogMethod("house-account")).toBe("unknown");
    expect(toLogMethod(undefined)).toBe("unknown");
  });
});
```

- [ ] **Step 2: Run it** — `npx vitest run tests/unit/payments-storage.test.ts` → FAIL (modules missing).

- [ ] **Step 3: Implement**

`db/migrations/040_payments.sql`:
```sql
-- Every money event, one row each (see docs/superpowers/specs/2026-10-16-cierre-del-dia-design.md).
CREATE TABLE IF NOT EXISTS payments (
  id                TEXT PRIMARY KEY,
  at                TEXT NOT NULL,             -- ISO UTC
  day               TEXT NOT NULL,             -- shop-local YYYY-MM-DD
  kind              TEXT NOT NULL,             -- payment | deposit | balance | refund | gift_card_sale
  method            TEXT NOT NULL,             -- cash | zelle | card-terminal | ach | check | stripe | gift-card | unknown
  amount_cents      INTEGER NOT NULL,          -- negative for refunds
  order_id          TEXT,
  house_account_id  TEXT,
  gift_card_id      TEXT,
  source            TEXT NOT NULL,
  actor             TEXT NOT NULL,
  note              TEXT
);
CREATE INDEX IF NOT EXISTS idx_payments_day_method ON payments(day, method);
CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);

-- One saved cash-up per shop day.
CREATE TABLE IF NOT EXISTS cash_closes (
  day                  TEXT PRIMARY KEY,
  opening_float_cents  INTEGER NOT NULL,
  cash_in_cents        INTEGER NOT NULL,
  cash_refunds_cents   INTEGER NOT NULL,
  cash_out_cents       INTEGER NOT NULL,
  cash_out_note        TEXT,
  expected_cents       INTEGER NOT NULL,
  counted_cents        INTEGER NOT NULL,
  difference_cents     INTEGER NOT NULL,
  float_left_cents     INTEGER NOT NULL,
  reviewed_json        TEXT NOT NULL,
  totals_json          TEXT NOT NULL,
  note                 TEXT,
  actor                TEXT NOT NULL,
  created_at           TEXT NOT NULL,
  updated_at           TEXT NOT NULL
);
```

`lib/db-tx.ts`:
```ts
import "server-only";
import { getDb } from "@/lib/db";

let depth = 0;

/**
 * Run `fn` in one SQLite write transaction. Nested calls join the outer one, so
 * a writer can wrap its own update and still be called from a wider transaction.
 */
export function withTransaction<T>(fn: () => T): T {
  if (depth > 0) return fn();
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  depth++;
  try {
    const out = fn();
    db.exec("COMMIT");
    return out;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  } finally {
    depth--;
  }
}
```

`lib/payments-storage.ts`:
```ts
import "server-only";
import { getDb } from "@/lib/db";
import { shopDateStr } from "@/lib/tv-slots";

export type PaymentKind = "payment" | "deposit" | "balance" | "refund" | "gift_card_sale";
export type PaymentRowMethod = "cash" | "zelle" | "card-terminal" | "ach" | "check" | "stripe" | "gift-card" | "unknown";
export type PaymentSource =
  | "intake" | "mark_paid" | "deposit" | "settle" | "stripe_intent" | "stripe_checkout"
  | "house_account" | "house_account_stripe" | "gift_card_admin" | "gift_card_stripe" | "cancel_refund";

export type PaymentRowInput = {
  kind: PaymentKind;
  method: PaymentRowMethod;
  amountCents: number;
  orderId?: string;
  houseAccountId?: string;
  giftCardId?: string;
  source: PaymentSource;
  actor: string;
  note?: string;
  /** Defaults to now. */
  at?: string;
};
export type PaymentRow = PaymentRowInput & { id: string; at: string; day: string };

const LOG_METHODS: PaymentRowMethod[] = ["cash", "zelle", "card-terminal", "ach", "check", "stripe", "gift-card"];

/** An order's payment method as a log method; anything else (house-account, none) is "unknown". */
export function toLogMethod(m: string | undefined): PaymentRowMethod {
  return (LOG_METHODS as string[]).includes(m ?? "") ? (m as PaymentRowMethod) : "unknown";
}

type Row = {
  id: string; at: string; day: string; kind: PaymentKind; method: PaymentRowMethod; amount_cents: number;
  order_id: string | null; house_account_id: string | null; gift_card_id: string | null;
  source: PaymentSource; actor: string; note: string | null;
};

const toPayment = (r: Row): PaymentRow => ({
  id: r.id, at: r.at, day: r.day, kind: r.kind, method: r.method, amountCents: r.amount_cents,
  ...(r.order_id ? { orderId: r.order_id } : {}),
  ...(r.house_account_id ? { houseAccountId: r.house_account_id } : {}),
  ...(r.gift_card_id ? { giftCardId: r.gift_card_id } : {}),
  source: r.source, actor: r.actor, ...(r.note ? { note: r.note } : {}),
});

/** Insert one money event. No transaction of its own: call it inside the writer's. */
export function recordPaymentRow(input: PaymentRowInput): PaymentRow {
  const at = input.at ?? new Date().toISOString();
  const row: PaymentRow = {
    ...input,
    id: `pay_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    at,
    day: shopDateStr(new Date(at)),
  };
  getDb().prepare(
    `INSERT INTO payments (id, at, day, kind, method, amount_cents, order_id, house_account_id, gift_card_id, source, actor, note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(row.id, row.at, row.day, row.kind, row.method, row.amountCents, row.orderId ?? null,
    row.houseAccountId ?? null, row.giftCardId ?? null, row.source, row.actor, row.note ?? null);
  return row;
}

export function listPaymentsForDay(day: string): PaymentRow[] {
  return (getDb().prepare("SELECT * FROM payments WHERE day = ? ORDER BY at, id").all(day) as Row[]).map(toPayment);
}

export function firstPaymentDay(): string | null {
  const r = getDb().prepare("SELECT MIN(day) AS d FROM payments").get() as { d: string | null };
  return r.d;
}
```

- [ ] **Step 4: Run** `npx vitest run tests/unit/payments-storage.test.ts` → PASS. Also run `npx vitest run tests/unit/house-account-ledger.test.ts` (the migration runner must still apply all migrations).

- [ ] **Step 5: Commit**
```bash
git add db/migrations/040_payments.sql lib/db-tx.ts lib/payments-storage.ts tests/unit/payments-storage.test.ts
git commit -m "feat(caja): tabla payments + cash_closes y registro de cobros"
```

---

### Task 2: Pure cash-close core

**Files:**
- Create: `lib/cash-close.ts`
- Test: `tests/unit/cash-close.test.ts`

**Interfaces:**
- Consumes: `PaymentRowMethod`, `PaymentKind` types from `lib/payments-storage.ts` (import with `import type` — this module must stay free of `server-only` so the client screen can import it).
- Produces:
  - `MoneyMethod = Exclude<PaymentRowMethod, "gift-card">`; `MONEY_METHODS: MoneyMethod[] = ["cash","zelle","card-terminal","ach","check","stripe","unknown"]`.
  - `DaySummary = { byMethod: Record<MoneyMethod, number>; cashInCents: number; cashRefundsCents: number; giftCardRedeemedCents: number; totalCollectedCents: number }`.
  - `summarizeDay(rows: { method: PaymentRowMethod; kind: PaymentKind; amountCents: number }[]): DaySummary`.
  - `expectedCash(i: { openingFloatCents: number; cashInCents: number; cashRefundsCents: number; cashOutCents: number }): number`.
  - `closeDifference(countedCents: number, expectedCents: number): number`.
  - `changeSinceClose(live: DaySummary, saved: DaySummary): number` — total delta; if the total is equal but a method moved, that method's delta.
  - `parseMoneyCents(text: string): number | null` — "$1,234.50" → 123450, "12,50" → 1250, "12" → 1200; "" / "abc" / negative / "1.234" → null.

- [ ] **Step 1: Write the failing test** — `tests/unit/cash-close.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { summarizeDay, expectedCash, closeDifference, changeSinceClose, parseMoneyCents } from "@/lib/cash-close";

const rows = [
  { method: "cash" as const, kind: "payment" as const, amountCents: 30000 },
  { method: "cash" as const, kind: "deposit" as const, amountCents: 8500 },
  { method: "cash" as const, kind: "refund" as const, amountCents: -2000 },
  { method: "zelle" as const, kind: "payment" as const, amountCents: 12000 },
  { method: "stripe" as const, kind: "payment" as const, amountCents: 9900 },
  { method: "gift-card" as const, kind: "payment" as const, amountCents: 5000 },
];

describe("summarizeDay", () => {
  it("totals money per method, keeps gift cards apart, nets refunds", () => {
    const s = summarizeDay(rows);
    expect(s.byMethod.cash).toBe(36500);
    expect(s.byMethod.zelle).toBe(12000);
    expect(s.byMethod.stripe).toBe(9900);
    expect(s.byMethod["card-terminal"]).toBe(0);
    expect(s.cashInCents).toBe(38500);
    expect(s.cashRefundsCents).toBe(2000);
    expect(s.giftCardRedeemedCents).toBe(5000);
    expect(s.totalCollectedCents).toBe(36500 + 12000 + 9900);
  });
  it("is all zeros for an empty day", () => {
    expect(summarizeDay([]).totalCollectedCents).toBe(0);
  });
});

describe("cuadre", () => {
  it("expected = float + cash in − cash refunds − cash out", () => {
    expect(expectedCash({ openingFloatCents: 10000, cashInCents: 38500, cashRefundsCents: 2000, cashOutCents: 1200 })).toBe(45300);
  });
  it("difference is counted − expected (negative = short)", () => {
    expect(closeDifference(44800, 45300)).toBe(-500);
    expect(closeDifference(45300, 45300)).toBe(0);
  });
});

describe("changeSinceClose", () => {
  it("reports money recorded after the close", () => {
    const saved = summarizeDay(rows);
    const live = summarizeDay([...rows, { method: "cash", kind: "payment", amountCents: 4000 }]);
    expect(changeSinceClose(live, saved)).toBe(4000);
    expect(changeSinceClose(saved, saved)).toBe(0);
  });
  it("notices a method swap that keeps the total", () => {
    const saved = summarizeDay([{ method: "cash", kind: "payment", amountCents: 100 }]);
    const live = summarizeDay([{ method: "zelle", kind: "payment", amountCents: 100 }]);
    expect(changeSinceClose(live, saved)).not.toBe(0);
  });
});

describe("parseMoneyCents", () => {
  it.each([["$1,234.50", 123450], ["12,50", 1250], ["12", 1200], [" 7.5 ", 750], ["0", 0]])("%s → %d", (t, c) => {
    expect(parseMoneyCents(t)).toBe(c);
  });
  it.each(["", "abc", "-5", "1.234"])("rejects %s", (t) => {
    expect(parseMoneyCents(t)).toBeNull();
  });
});
```

- [ ] **Step 2: Run** → FAIL (module missing).

- [ ] **Step 3: Implement** `lib/cash-close.ts`

```ts
// Cierre del día: the day's money per method and the cash-drawer cuadre. Pure:
// the API computes it for the screen and again when saving, never trusting the client.
import type { PaymentKind, PaymentRowMethod } from "@/lib/payments-storage";

export type MoneyMethod = Exclude<PaymentRowMethod, "gift-card">;
export const MONEY_METHODS: MoneyMethod[] = ["cash", "zelle", "card-terminal", "ach", "check", "stripe", "unknown"];

export type DaySummary = {
  byMethod: Record<MoneyMethod, number>;
  /** Cash taken in (payments, deposits, balances, gift-card sales). */
  cashInCents: number;
  /** Cash handed back, as a positive number. */
  cashRefundsCents: number;
  /** Paid with gift cards sold earlier: value used, not money in. */
  giftCardRedeemedCents: number;
  /** Net money collected across methods (refunds subtracted). */
  totalCollectedCents: number;
};

export function summarizeDay(rows: { method: PaymentRowMethod; kind: PaymentKind; amountCents: number }[]): DaySummary {
  const byMethod = Object.fromEntries(MONEY_METHODS.map((m) => [m, 0])) as Record<MoneyMethod, number>;
  let cashIn = 0;
  let cashRefunds = 0;
  let giftCard = 0;
  for (const r of rows) {
    if (r.method === "gift-card") {
      giftCard += r.amountCents;
      continue;
    }
    byMethod[r.method] += r.amountCents;
    if (r.method === "cash") {
      if (r.kind === "refund") cashRefunds += -r.amountCents;
      else cashIn += r.amountCents;
    }
  }
  const total = MONEY_METHODS.reduce((s, m) => s + byMethod[m], 0);
  return { byMethod, cashInCents: cashIn, cashRefundsCents: cashRefunds, giftCardRedeemedCents: giftCard, totalCollectedCents: total };
}

export function expectedCash(i: { openingFloatCents: number; cashInCents: number; cashRefundsCents: number; cashOutCents: number }): number {
  return i.openingFloatCents + i.cashInCents - i.cashRefundsCents - i.cashOutCents;
}

/** Counted minus expected: negative means cash is missing. */
export function closeDifference(countedCents: number, expectedCents: number): number {
  return countedCents - expectedCents;
}

/** How much the day's money moved since the close was saved (0 = nothing new). */
export function changeSinceClose(live: DaySummary, saved: DaySummary): number {
  const total = live.totalCollectedCents - saved.totalCollectedCents;
  if (total !== 0) return total;
  const moved = MONEY_METHODS.find((m) => live.byMethod[m] !== (saved.byMethod[m] ?? 0));
  return moved ? live.byMethod[moved] - (saved.byMethod[moved] ?? 0) : 0;
}

/** "$1,234.50" / "12,50" / "12" → cents; anything else (or negative) → null. */
export function parseMoneyCents(text: string): number | null {
  let s = text.trim().replace(/^\$/, "").trim();
  if (!s) return null;
  // A single comma with 1–2 trailing digits is a decimal comma ("12,50").
  if (/^\d+,\d{1,2}$/.test(s)) s = s.replace(",", ".");
  else s = s.replace(/,(?=\d{3}(\D|$))/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  return Math.round(Number(s) * 100);
}
```

- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `git add lib/cash-close.ts tests/unit/cash-close.test.ts && git commit -m "feat(caja): núcleo puro del cuadre de caja"`

---

### Task 3: Writers in `lib/order-mutations.ts` (mark paid, deposit, settle, refund)

**Files:**
- Modify: `lib/order-mutations.ts` (`markPaidManual`, `recordDeposit`, `settleBalance`, `cancelOrder`)
- Modify: `app/api/admin/orders/[id]/payment/route.ts` (settle accepts optional method)
- Test: `tests/unit/payments-writers-mutations.test.ts`

**Interfaces:**
- Consumes: `withTransaction` (`lib/db-tx.ts`), `recordPaymentRow`, `toLogMethod` (`lib/payments-storage.ts`).
- Produces: `settleBalance(orderId: string, actor: string, method?: "cash" | "zelle" | "card-terminal" | "ach" | "check"): Promise<Order>`; payment API body `{ settleBalance: true, method?: "cash"|"zelle"|"card-terminal"|"ach"|"check" }`.

Rules (in each function replace the bare `upsert(next)` with `withTransaction(() => { upsert(next); /* row */ })`; everything after it — history, promo, dispatch — stays outside and unchanged):
- `markPaidManual`: after the early returns, `const due = cur.totals.totalCents - (cur.amountPaidCents ?? 0)`; row `{ kind: (cur.amountPaidCents ?? 0) > 0 ? "balance" : "payment", method: args.method, amountCents: due, orderId, source: "mark_paid", actor: "maky" }` only if `due > 0`.
- `recordDeposit` (non-full branch only; the full branch already delegates to `markPaidManual`): `{ kind: "deposit", method: args.method, amountCents: args.amountCents, orderId, source: "deposit", actor }`.
- `settleBalance`: `const due = cur.totals.totalCents - (cur.amountPaidCents ?? 0)`; if `due > 0`, row `{ kind: "balance", method: method ?? "unknown", amountCents: due, orderId, source: "settle", actor }`. History summary includes the method when given: `Saldo saldado · ${method} · $X`.
- `cancelOrder` with `args.refund`: row `{ kind: "refund", method: toLogMethod(cur.paymentMethod), amountCents: -(cur.amountPaidCents ?? 0), orderId, source: "cancel_refund", actor: "maky" }` only if `(cur.amountPaidCents ?? 0) > 0`.

- [ ] **Step 1: Write the failing test** — `tests/unit/payments-writers-mutations.test.ts`

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { markPaidManual, recordDeposit, settleBalance, cancelOrder } from "@/lib/order-mutations";

vi.mock("@/lib/order-dispatch", () => ({ dispatchPaymentConfirmed: vi.fn(), dispatchDelivered: vi.fn(), dispatchOutForDelivery: vi.fn() }));
vi.mock("@/lib/order-notifications", () => ({ notifyOrderPaid: vi.fn() }));

function insertOrder(id: string, over: { total?: number; paid?: number; status?: string; method?: string } = {}) {
  const now = new Date().toISOString();
  getDb().prepare(
    `INSERT INTO orders (id, locale, source, recipient_name, recipient_phone, contact_phone, fulfillment_method,
       lines_json, subtotal_cents, delivery_cents, tax_cents, total_cents, amount_paid_cents,
       fulfillment_status, payment_status, payment_method, created_at, updated_at)
     VALUES (?, 'es', 'phone', 'Ana', '5165550100', '5165550100', 'in-store', '[]', ?, 0, 0, ?, ?, 'pending', ?, ?, ?, ?)`,
  ).run(id, over.total ?? 10000, over.total ?? 10000, over.paid ?? 0, over.status ?? "pending", over.method ?? null, now, now);
}
const rows = () => getDb().prepare("SELECT kind, method, amount_cents AS amount, source FROM payments ORDER BY at, id").all();

beforeEach(() => { vi.stubEnv("SQLITE_FILE", ":memory:"); vi.stubEnv("TWILIO_DRY_RUN", "true"); runMigrations(); });
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

describe("money writers in order-mutations", () => {
  it("mark paid logs the full amount once", async () => {
    insertOrder("o1");
    await markPaidManual("o1", { method: "cash" });
    await markPaidManual("o1", { method: "cash" }); // already paid: no second row
    expect(rows()).toEqual([{ kind: "payment", method: "cash", amount: 10000, source: "mark_paid" }]);
  });

  it("a deposit, then mark paid, logs the deposit and only the remainder", async () => {
    insertOrder("o2");
    await recordDeposit("o2", { amountCents: 3000, method: "zelle" }, "maky");
    await markPaidManual("o2", { method: "cash" });
    expect(rows()).toEqual([
      { kind: "deposit", method: "zelle", amount: 3000, source: "deposit" },
      { kind: "balance", method: "cash", amount: 7000, source: "mark_paid" },
    ]);
  });

  it("settle logs the remainder with the method, or unknown without one", async () => {
    insertOrder("o3", { paid: 4000 });
    await settleBalance("o3", "maky", "card-terminal");
    insertOrder("o4", { paid: 9000 });
    await settleBalance("o4", "maky");
    expect(rows()).toEqual([
      { kind: "balance", method: "card-terminal", amount: 6000, source: "settle" },
      { kind: "balance", method: "unknown", amount: 1000, source: "settle" },
    ]);
  });

  it("a refunded cancel logs a negative row in the method it was paid", async () => {
    insertOrder("o5", { paid: 10000, status: "paid", method: "zelle" });
    await cancelOrder("o5", { refund: true });
    expect(rows()).toEqual([{ kind: "refund", method: "zelle", amount: -10000, source: "cancel_refund" }]);
  });
});
```

(If the `orders` table needs more NOT NULL columns than listed, read `db/migrations` and add them to `insertOrder` — keep the test's assertions as written.)

- [ ] **Step 2: Run** → FAIL (no rows written).
- [ ] **Step 3: Implement** the four rules (imports: `import { withTransaction } from "@/lib/db-tx"; import { recordPaymentRow, toLogMethod } from "@/lib/payments-storage";`). In `app/api/admin/orders/[id]/payment/route.ts` change the settle schema to `z.object({ settleBalance: z.literal(true), method: z.enum(["cash", "zelle", "card-terminal", "ach", "check"]).optional() })` and the call to `settleBalance(id, "maky", data.method)`.
- [ ] **Step 4: Run** the new test plus `tests/unit/order-mutations-deposit.test.ts tests/unit/api-admin-orders-cancel.test.ts tests/unit/cancel-restores-gift-card.test.ts` → PASS; `npx tsc --noEmit -p .` → clean.
- [ ] **Step 5: Commit** (`git add` the test + both modified files) `feat(caja): marcar pagado, depósito, saldo y reembolso anotan el cobro`.

---

### Task 4: Writers for intake creation and Stripe

**Files:**
- Modify: `lib/order-storage.ts` (`saveOrder` gains `opts?: { payments?: PaymentRowInput[] }`; the function at ~line 184 that takes `(paymentIntentId: string, status)`; `updateOrderPaidByCheckoutSession`)
- Modify: `app/api/admin/orders/route.ts` (build the rows, pass them to `saveOrder`)
- Test: `tests/unit/payments-writers-intake-stripe.test.ts`

**Interfaces:**
- Consumes: `withTransaction`, `recordPaymentRow`, `toLogMethod`, `PaymentRowInput`.
- Produces: `saveOrder(order: Order, opts?: { payments?: PaymentRowInput[] }): Promise<void>` — SQLite upsert + rows in one `withTransaction` (the JSON-mirror write stays after it, unchanged).

Rules:
- **Intake** (POST handler, right before `await saveOrder(order)`), with `actor = order.takenBy ?? "maky"`:
  - `order.paymentStatus === "paid"`: if `giftCardCents > 0` push `{ kind: "payment", method: "gift-card", amountCents: giftCardCents, orderId: order.id, giftCardId, source: "intake", actor }`; `const rest = order.totals.totalCents - giftCardCents`; if `rest > 0` push `{ kind: "payment", method: toLogMethod(order.paymentMethod), amountCents: rest, orderId: order.id, source: "intake", actor }`.
  - else, in the existing `deposit && order.paymentStatus === "pending"` case: push `{ kind: "deposit", method: deposit.method, amountCents: deposit.amountCents, orderId: order.id, source: "intake", actor }`.
  - House-account orders: none. Then `await saveOrder(order, { payments })`.
- **Stripe payment intent**, `status === "paid"` branch: `const delta = cur.totals.totalCents - (cur.amountPaidCents ?? 0); const gc = Math.min(cur.giftCardCents ?? 0, delta);` replace `upsertSqlite(next)` with `withTransaction(() => { upsertSqlite(next); if (gc > 0) recordPaymentRow({ kind: "payment", method: "gift-card", amountCents: gc, orderId: cur.id, giftCardId: cur.giftCardId, source: "stripe_intent", actor: "stripe" }); if (delta - gc > 0) recordPaymentRow({ kind: "payment", method: "stripe", amountCents: delta - gc, orderId: cur.id, source: "stripe_intent", actor: "stripe" }); })`. Non-paid branches: `upsertSqlite(next)` as before, no rows.
- **Stripe checkout session** (`updateOrderPaidByCheckoutSession`): inside `withTransaction`, first `SELECT id, total_cents, amount_paid_cents, gift_card_cents, gift_card_id FROM orders WHERE stripe_checkout_session_id = ? AND payment_status != 'paid'`; if none, return; run the existing UPDATE; then the same two rows (same `delta`/`gc` math from the selected values) with `source: "stripe_checkout"`.

- [ ] **Step 1: Write the failing test** — `tests/unit/payments-writers-intake-stripe.test.ts`. Copy verbatim from `tests/unit/intake-deposit.test.ts`: the imports, the `vi.mock("@/lib/stripe-server", …)`, the `ORDER_FILE`/`PRINT_FILE` env setup in `beforeEach`/`afterEach`, the `base` payload and `req()` helper. Then add (adapt the `payment` field shape to exactly what `intake-deposit.test.ts` sends):

```ts
const payRows = () => getDb().prepare("SELECT kind, method, amount_cents AS amount, source FROM payments ORDER BY at, id").all();

it("an intake paid in cash logs one payment for the total", async () => {
  const res = await POST(req({ ...base, payment: { status: "paid", method: "cash" } }));
  expect(res.status).toBe(201);
  const [r] = payRows() as { kind: string; method: string; amount: number; source: string }[];
  expect(r).toMatchObject({ kind: "payment", method: "cash", source: "intake" });
  expect(r.amount).toBeGreaterThan(50000 - 1); // the total, tax included
});

it("an intake with a deposit logs the deposit only", async () => {
  await POST(req({ ...base, payment: { status: "pending", deposit: { amountCents: 10000, method: "zelle" } } }));
  expect(payRows()).toEqual([{ kind: "deposit", method: "zelle", amount: 10000, source: "intake" }]);
});

it("a pending intake without money logs nothing", async () => {
  await POST(req({ ...base, payment: { status: "pending" } }));
  expect(payRows()).toEqual([]);
});
```

and a Stripe `describe`: insert an `orders` row with `stripe_payment_intent_id = 'pi_1'`, `total_cents = 10000`, `amount_paid_cents = 0`, `gift_card_cents = 2500`, `payment_status = 'pending'` (+ the NOT NULL columns, as in Task 3's `insertOrder`); call the payment-intent function with `("pi_1", "paid")` **twice**; expect exactly `[{ kind: "payment", method: "gift-card", amount: 2500, source: "stripe_intent" }, { kind: "payment", method: "stripe", amount: 7500, source: "stripe_intent" }]`. Then a second order with `stripe_checkout_session_id = 'cs_1'`, no gift card: `updateOrderPaidByCheckoutSession("cs_1")` twice → exactly one `{ kind: "payment", method: "stripe", amount: 10000, source: "stripe_checkout" }`.

- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** the rules.
- [ ] **Step 4: Run** the new test plus `tests/unit/intake-deposit.test.ts tests/unit/intake-gift-card.test.ts tests/unit/api-stripe-webhook.test.ts tests/unit/webhook-promo.test.ts tests/unit/checkout-intent-reuse.test.ts` → PASS (rerun any file that times out alone); tsc clean.
- [ ] **Step 5: Commit** `feat(caja): la toma de pedidos y Stripe anotan el cobro`.

---

### Task 5: Writers for house-account payments and gift-card sales

**Files:**
- Modify: `lib/house-account-ledger.ts` (`recordPayment`)
- Modify: `lib/gift-card-storage.ts` (`issueGiftCard`, `issueGiftCardForPayment`)
- Modify: `schemas/gift-card.ts` (`issueGiftCardSchema` gains `paymentMethod: z.enum(["cash","zelle","card-terminal","ach"]).optional()`), `app/api/admin/gift-cards/route.ts` (pass it to `issueGiftCard`; respond 400 `{ error: "payment_method_required" }` when `reason === "purchase"` and no method)
- Modify: `components/admin/gift-cards/IssueGiftCardForm.tsx` (when reason is `purchase`, show a required "Cobrado con" select — Efectivo / Zelle / Terminal / ACH — and send `paymentMethod`)
- Modify: `messages/es.json`, `messages/en.json` (in the namespace `IssueGiftCardForm` uses: `form_payment_method` = "Cobrado con" / "Paid with", `payment_method_required` = "Elige cómo se cobró la tarjeta" / "Pick how the card was paid")
- Test: `tests/unit/payments-writers-accounts-giftcards.test.ts`

**Interfaces:**
- Consumes: `recordPaymentRow`, `toLogMethod`, `withTransaction`.
- Produces: `IssueGiftCardInput.paymentMethod?: "cash" | "zelle" | "card-terminal" | "ach"`.

Rules:
- `recordPayment`: inside its existing `tx(() => …)`, after `insertEntry` returns a non-null entry: `recordPaymentRow({ kind: "payment", method: toLogMethod(i.method), amountCents: i.amountCents, houseAccountId: i.accountId, source: i.actor === "stripe" ? "house_account_stripe" : "house_account", actor: i.actor, note: i.note })`. A duplicate Stripe session (entry `null`) writes nothing. `recordStripeStatementPayment` calls `recordPayment`, so it is covered. (`recordPaymentRow` has no transaction of its own, so it is safe inside the ledger's `tx`.)
- `issueGiftCard`: wrap the INSERT in `withTransaction`; when `input.reason === "purchase" && input.paymentMethod`, also `recordPaymentRow({ kind: "gift_card_sale", method: input.paymentMethod, amountCents: <the card's initial cents>, giftCardId: <the new id>, source: "gift_card_admin", actor: input.issuedBy ?? "maky" })`. Other reasons: no row.
- `issueGiftCardForPayment`: wrap the INSERT in `withTransaction` with `recordPaymentRow({ kind: "gift_card_sale", method: "stripe", amountCents: <initial cents>, giftCardId: <new id>, source: "gift_card_stripe", actor: "stripe" })`. Its unique index on `purchase_payment_intent_id` makes a retry throw → the transaction rolls both back (keep the existing caller behavior for that throw).

- [ ] **Step 1: Write the failing test** covering: a cash `recordPayment` → one `payment` row with `house_account_id`; the same Stripe session twice via `recordStripeStatementPayment` → one `stripe` row (create the account + statement exactly as `tests/unit/house-account-ledger.test.ts` does — copy its setup helpers); `issueGiftCard({ …, reason: "purchase", paymentMethod: "cash" })` → one `gift_card_sale` cash row with the card's amount; `issueGiftCard({ …, reason: "loyalty" })` → no row; `issueGiftCardForPayment(...)` → one `gift_card_sale` stripe row. Take the exact input fields from `tests/unit/gift-card-storage.test.ts`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** the rules, the schema/API change and the form select.
- [ ] **Step 4: Run** the new test plus `tests/unit/house-account-ledger.test.ts tests/unit/gift-card-storage.test.ts`, every `tests/unit/*ift*ard*` file, and `tests/unit/i18n-keys.test.ts tests/unit/i18n-parity.test.ts tests/unit/messages-no-placeholders.test.ts` → PASS; tsc clean.
- [ ] **Step 5: Commit** `feat(caja): pagos de cuentas y venta de tarjetas de regalo anotan el cobro`.

---

### Task 6: "Saldar" asks the payment method

**Files:**
- Modify: `components/admin/dashboard/OrderDetailDrawer.tsx` (the `mark_settled` button, ~line 266, which sends `{ settleBalance: true }`)
- Modify: `components/admin/dashboard/ReceivablesSection.tsx` (~line 81, `const body = r.canRemind ? { method } : { settleBalance: true };`)
- Modify: `messages/es.json`, `messages/en.json` (namespace `admin_orders`: `settle_method` = "¿Con qué se pagó el saldo?" / "How was the balance paid?", plus `settle_method_cash` "Efectivo"/"Cash", `settle_method_zelle` "Zelle"/"Zelle", `settle_method_card-terminal` "Terminal"/"Terminal", `settle_method_ach` "ACH"/"ACH", `settle_method_check` "Cheque"/"Check")
- Test: `tests/unit/settle-method.test.tsx`

**Interfaces:**
- Consumes: payment API body `{ settleBalance: true, method }` from Task 3.

Behavior: in the drawer, tapping "Saldar" reveals an inline row of five buttons (Efectivo / Zelle / Terminal / ACH / Cheque) under the label `settle_method`; picking one sends `{ settleBalance: true, method }` through the drawer's existing `call("PATCH", …)`. In ReceivablesSection, the `{ settleBalance: true }` body becomes `{ settleBalance: true, method }`, using the `method` the row already holds in its state (the same variable it sends in the `{ method }` branch).

- [ ] **Step 1:** Write `tests/unit/settle-method.test.tsx`: render `ReceivablesSection` (read its props and existing tests first — `grep -rl ReceivablesSection tests/unit`) with one row that cannot get a reminder link (`canRemind: false`), mock `fetch`, choose Zelle in the row's method picker, trigger the mark-paid action, and assert the PATCH body is `{"settleBalance":true,"method":"zelle"}`. Add a second test for the drawer if its existing test harness (`grep -rl OrderDetailDrawer tests/unit`) makes that straightforward; otherwise cover the drawer in Task 9's preview run.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run it + the existing ReceivablesSection/drawer tests + `i18n-*` → PASS; tsc clean.
- [ ] **Step 5: Commit** `feat(caja): saldar pide el método de pago`.

---

### Task 7: Close storage + API

**Files:**
- Create: `lib/cash-close-storage.ts`
- Create: `app/api/admin/cash-close/route.ts`
- Test: `tests/unit/api-cash-close.test.ts`

**Interfaces:**
- Consumes: `listPaymentsForDay`, `firstPaymentDay`, `PaymentRow`, `summarizeDay`, `expectedCash`, `closeDifference`, `changeSinceClose`, `MONEY_METHODS`, `DaySummary`, `withTransaction`, `shopDateStr`, `getDb`, `runMigrations`.
- Produces:
  - `CashClose = { day: string; openingFloatCents: number; cashInCents: number; cashRefundsCents: number; cashOutCents: number; cashOutNote?: string; expectedCents: number; countedCents: number; differenceCents: number; floatLeftCents: number; reviewed: string[]; totals: DaySummary; note?: string; actor: string; createdAt: string; updatedAt: string }`
  - `getClose(day: string): CashClose | null`
  - `previousFloatCents(day: string): number` — `float_left_cents` of the latest close with `day < ?`, else 0.
  - `listCloses(limit = 30): CashClose[]` newest first.
  - `putClose(i: { day: string; openingFloatCents: number; cashOutCents: number; cashOutNote?: string; countedCents: number; floatLeftCents: number; reviewed: string[]; note?: string; actor: string }): CashClose` — recomputes `summarizeDay(listPaymentsForDay(day))`, expected and difference server-side; upsert keeping `created_at`.
  - `GET /api/admin/cash-close?day=YYYY-MM-DD` (default today via `shopDateStr(new Date())`) → `{ day, firstDay: string | null, payments: (PaymentRow & { orderNumber?: number; customerName?: string })[], summary: DaySummary, close: CashClose | null, changeSinceCloseCents: number, previousFloatCents: number, sales: { orders: number; subtotalCents: number; taxCents: number; tipCents: number; deliveryCents: number; discountCents: number; pendingCents: number }, history: CashClose[] }`. `changeSinceCloseCents = close ? changeSinceClose(summary, close.totals) : 0`.
  - `PUT /api/admin/cash-close` body (zod): `{ day: /^\d{4}-\d{2}-\d{2}$/, openingFloatCents: int ≥ 0, cashOutCents: int ≥ 0, cashOutNote?: string ≤ 200, countedCents: int ≥ 0, floatLeftCents: int ≥ 0, reviewed: array of MONEY_METHODS values, note?: string ≤ 500 }` (unknown keys stripped) → `{ close }`; 400 `{ error: "invalid_body" }` otherwise. Actor `"maky"`.

Sales of the day: `SELECT created_at, subtotal_cents, tax_cents, tip_cents, delivery_cents, discount_cents, total_cents, amount_paid_cents, fulfillment_status FROM orders WHERE created_at >= ? AND created_at < ?` with a UTC window from `day − 1` to `day + 2`, then keep rows whose `shopDateStr(new Date(created_at)) === day` and `fulfillment_status != 'canceled'`; `pendingCents` = Σ max(0, total − amount_paid). Payments list: `SELECT p.*, o.order_number, o.contact_name FROM payments p LEFT JOIN orders o ON o.id = p.order_id WHERE p.day = ? ORDER BY p.at, p.id`.

- [ ] **Step 1: Write the failing test** (`SQLITE_FILE=:memory:`, `runMigrations()`): insert two rows with `recordPaymentRow` at fixed `at`s on `2026-10-16` NY time (cash 5000, zelle 3000); `GET ?day=2026-10-16` → `summary.totalCollectedCents === 8000`, `close === null`, `previousFloatCents === 0`; `PUT { day, openingFloatCents: 10000, cashOutCents: 500, countedCents: 14000, floatLeftCents: 10000, reviewed: ["zelle"], expectedCents: 1 }` → `close.expectedCents === 14500`, `close.differenceCents === -500` (the bogus `expectedCents` is ignored); a second PUT keeps `createdAt` and changes `updatedAt`; add a cash row of 4000 → `GET` gives `changeSinceCloseCents === 4000`; `GET ?day=2026-10-17` → `previousFloatCents === 10000`; `PUT` with `countedCents: -1` → 400.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement (route: `export const runtime = "nodejs";`, `NextResponse`, style of `app/api/admin/orders/[id]/payment/route.ts`; admin gating comes from `proxy.ts`). **Step 4:** Run → PASS; tsc clean.
- [ ] **Step 5: Commit** `feat(caja): API del cierre del día`.

---

### Task 8: "Cierre" screen + nav link

**Files:**
- Create: `app/[locale]/admin/dashboard/cierre/page.tsx` (same structure as `app/[locale]/admin/dashboard/ledger/page.tsx`)
- Create: `components/admin/dashboard/CashCloseView.tsx` (client, wrapped in `DashboardShell` like `LedgerView`)
- Modify: `components/admin/dashboard/DashboardShell.tsx` (link "Cierre" right after the ledger link, active when `pathname.endsWith("/cierre")`)
- Modify: `messages/es.json`, `messages/en.json` (new namespace `admin_cash_close`; `admin_dashboard.nav_cash_close` = "Cierre" / "Close")
- Test: `tests/unit/CashCloseView.test.tsx`

**Interfaces:**
- Consumes: GET/PUT from Task 7; `expectedCash`, `closeDifference`, `parseMoneyCents`, `MONEY_METHODS`, `DaySummary` from `lib/cash-close.ts`; `CashClose` type (import type only).

Screen (copy in the spec, Part 2):
1. Day header with ‹ › buttons and the date; `?day=` in the URL (`router.replace`).
2. "Cobrado del día": one card per `MONEY_METHODS` entry (hide `unknown` and `check` when 0), total in bold, expandable list of that method's payments (shop-time `HH:MM`, `#orderNumber`, customer, kind label, amount). Each non-cash card has a "Revisado" checkbox (state → `reviewed`). Below: "Total cobrado". Gift-card redemptions in a muted line, outside the total.
3. Cuadre: inputs Fondo inicial (prefill `close?.openingFloatCents ?? previousFloatCents`), Salidas de caja + nota, Efectivo contado, Fondo que se deja (default = fondo inicial), Nota; read-only rows Efectivo cobrado, Reembolsos en efectivo, Efectivo esperado, Diferencia (live via `expectedCash`/`closeDifference`; `text-emerald-700` at 0, `text-rouge` + "faltan" below 0, `text-amber-700` + "sobran" above 0). Inputs parse with `parseMoneyCents`; an invalid field shows an error and disables Guardar.
4. "Guardar cierre" → PUT; on success "Cierre guardado · HH:MM" and refetch. If `changeSinceCloseCents !== 0`, a warning banner with that amount.
5. "Venta del día" small table from `sales`; "Historial" from `history` (day, difference colored, actor, updatedAt).
6. Empty states: `firstDay === null` → "Todavía no hay cobros registrados"; `day < firstDay` → "Sin registro de cobros antes del {firstDay}".

- [ ] **Step 1: Write the failing test** (mock `next-intl` as in `tests/unit/IntakeFormRepeat.test.tsx`, mock `next/navigation` with `useRouter`/`useSearchParams`/`usePathname`, mock `fetch` so GET returns `summary` with `cashInCents: 38500`, `cashRefundsCents: 2000`, `previousFloatCents: 10000`, `close: null`): type "12" in Salidas and "448" in Efectivo contado → the Esperado row shows `$453.00` and the Diferencia row shows `-$5.00` with the "faltan" key; click Guardar → the PUT body contains `{ openingFloatCents: 10000, cashOutCents: 1200, countedCents: 44800, floatLeftCents: 10000 }` (plus `day` and `reviewed`). A second test: typing "abc" in Contado disables Guardar.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement page, view, nav link, translations. **Step 4:** Run it + `i18n-*` + `messages-no-placeholders` → PASS; tsc clean.
- [ ] **Step 5: Commit** `feat(caja): pantalla "Cierre" en el panel`.

---

### Task 9: Verification, merge, publish (done by the controller, not a subagent)

- [ ] **Step 1:** Full unit suite `npx vitest run tests/unit` (known pre-existing failures: print-chromium, print-render, _preview; checkout/webhook files can time out under load — rerun any other failure alone before treating it as real).
- [ ] **Step 2:** Preview end-to-end on the scratch DB (launch config with the project's test creds, `TWILIO_DRY_RUN=true`, no `.env.local` in the worktree so no real email/SMS): intake paid cash; intake with Zelle deposit then "Saldar" in cash; mark paid terminal; cancel + refund one; open `/es/admin/dashboard/cierre` → each amount in the right card and the cuadre right; save; add one more cash payment → the warning shows.
- [ ] **Step 3:** In the main checkout, merge `feat/cierre-del-dia` with `--no-ff`. Verify the migration on a fresh DB without touching real local data: `SQLITE_FILE="$(mktemp -d)/fresh.sqlite" npm run build`, then a normal `npm run build`.
- [ ] **Step 4:** Push as `DatadrivenAIrep` (`gh auth switch -u DatadrivenAIrep`, push, `gh auth switch -u Datadrivenn`), wait ~3 min, confirm the site responds and `/es/admin/dashboard/cierre` redirects to login (307).
