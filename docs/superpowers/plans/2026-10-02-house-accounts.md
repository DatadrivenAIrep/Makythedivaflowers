# House Accounts (cuentas por cobrar) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Organizations get a house account with a running ledger, periodic statements frozen at close, a per-account send plan that feeds a visible queue executed by a daily cron, a public `/s/<code>` statement page with Stripe Checkout, and one-click SMS (Twilio) / email (Resend) sending from the admin.

**Architecture:** Five new SQLite tables (`house_accounts`, `house_account_contacts`, `house_account_entries`, `house_account_statements`, `house_account_sends`) plus `orders.house_account_id`. The ledger is the source of truth; a statement is an immutable snapshot of the running balance at a period close and is *settled* by every negative ledger entry recorded after that close (recomputed from the ledger, never incremented). Payments and credits allocate FIFO to open account orders, updating `orders.amount_paid_cents` so the Bandeja, ledger and metrics stay correct without changes. Pure modules (allocation, plan dates, templates) are separated from DB modules so they can be unit-tested without SQLite.

**Tech Stack:** Next.js 16 (App Router, `proxy.ts`), React 19, TypeScript, `node:sqlite` via `lib/db.ts`, zod, next-intl, Twilio (`lib/twilio-server.ts`), Resend, Stripe Checkout, Vitest 4 (jsdom + `:memory:` SQLite), Playwright.

**Spec:** `docs/superpowers/specs/2026-10-02-house-accounts-design.md`

## Global Constraints

- **This is NOT the Next.js you know.** Read `node_modules/next/dist/docs/` before writing route handlers or pages. Route params are `ctx: { params: Promise<{ id: string }> }` and must be awaited. Middleware lives in `proxy.ts`.
- **SQLite driver:** `node:sqlite` through `getDb()` in `lib/db.ts`; every lib function calls `runMigrations()` first. Queries are synchronous (`prepare(...).run/get/all`). Multi-statement atomicity is `db.exec("BEGIN IMMEDIATE")` … `COMMIT` / `ROLLBACK`.
- **Tests need** `NODE_OPTIONS='--experimental-sqlite'`; `npm test -- <path>` sets it. Run a single file with `npm test -- tests/unit/<file>.test.ts`.
- **Money is integer cents**, columns `*_cents`, fields `...Cents`. **Timestamps** are ISO-8601 strings from `new Date().toISOString()`. **Calendar dates** are `YYYY-MM-DD` in shop time (`shopDateStr(new Date())` from `lib/tv-slots.ts`, `SHOP_TZ = "America/New_York"`).
- **Ids** are `<prefix>_<Date.now().toString(36)>_<6 random base36 chars>`. Prefixes here: `ha_` (account), `hae_` (entry), `hst_` (statement), `hsd_` (send).
- **Migration** file is `db/migrations/030_house_accounts.sql` (next after `029_digital_cards.sql`). `CREATE TABLE IF NOT EXISTS`; the single `ALTER TABLE` is safe because `runMigrations` serializes under `BEGIN IMMEDIATE`.
- **Server modules** under `lib/` that touch the DB start with `import "server-only";` (stubbed in tests by the vitest alias). Pure modules do not.
- **Admin routes** live under `app/api/admin/...` (proxy-gated); money-moving handlers also call `requireAdmin(req)` from `lib/admin-auth.ts` and return 401 when it is false.
- **Public routes** (`app/s/[code]/...`) live outside the locale tree and are excluded from the proxy matcher.
- **i18n:** admin UI strings go in `messages/es.json` and `messages/en.json` under the `admin_accounts` namespace (plus the few keys named in other namespaces). Raw-HTML routes use an inline `{ en, es }` dictionary (like `lib/invoice.ts`).
- **Payment method value** for account orders is exactly `"house-account"`; order change kind is `"house_account"`.
- **Before each commit:** the task's tests pass. Before the final task: `npm test` (compare failures against the known pre-existing baseline: Chromium spawn ENOEXEC + checkout/preview specs), `npx tsc --noEmit`, and `rm data/diva.sqlite*` followed by `npm run build`.
- **Commit message trailer** (every commit): `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

---

## File Structure

**New (lib, pure):**
- `lib/short-code.ts` — `generateCode()`, `CODE_PATTERN`, `CODE_LENGTH` (moved from `digital-card-code.ts`, which re-exports).
- `lib/house-account-plan.ts` — plan defaults, issue-day arithmetic, `scheduleFromPlan`.
- `lib/house-account-allocate.ts` — `allocate(targets, amount)`.
- `lib/house-account-templates.ts` — SMS bodies, email subject, statement URL.
- `types/house-account.ts` — domain types.

**New (lib, DB):**
- `lib/house-account-storage.ts` — accounts, contacts, list/search, receivables summary.
- `lib/house-account-sends.ts` — the queue table.
- `lib/house-account-settlement.ts` — `dueCents`, `entryDate`, `recomputeSettlement`.
- `lib/house-account-ledger.ts` — entries, payments + allocation, reversals, move/remove order.
- `lib/house-account-statements.ts` — issue, void, lookups.
- `lib/house-account-detail.ts` — `getAccountDetail(id)` for the admin page/API.
- `lib/house-account-sender.ts` — sends one queue row (SMS + email).
- `lib/house-statement-html.tsx` — public statement document.
- `lib/house-statement-checkout.ts` — Stripe Checkout session for a statement.

**New (routes):** `app/s/[code]/route.ts`, `app/s/[code]/pay/route.ts`, `app/api/cron/house-accounts/route.ts`, `app/api/admin/accounts/**` (see Task 13), `app/[locale]/admin/accounts/page.tsx`, `app/[locale]/admin/accounts/[id]/page.tsx`.

**New (components):** `components/admin/accounts/{AccountsView,NewAccountModal,UpcomingSends,AccountStatusBadge,AccountDetail,PlanEditor,StatementsTable,LedgerTable,ContactsList,SendsQueue,PaymentModal,EntryModal,AccountSearch}.tsx`.

**Modified:** `db/migrations/030_house_accounts.sql` (new), `types/order.ts`, `lib/order-row.ts`, `lib/invoice.ts` (method label), `lib/digital-card-code.ts`, `proxy.ts`, `lib/order-mutations.ts`, `lib/order-edit.ts`, `lib/order-queue.ts`, `lib/conversation-storage.ts`, `lib/metrics-storage.ts`, `lib/customer-profile.ts`, `schemas/intake.ts`, `app/api/admin/orders/route.ts`, `app/api/admin/orders/[id]/route.ts`, `app/api/admin/orders/[id]/payment/route.ts`, `app/api/stripe/webhook/route.ts`, `components/admin/intake/{PaymentBlock,IntakeForm}.tsx`, `components/admin/dashboard/{OrderDetailDrawer,DashboardShell}.tsx`, `components/admin/metrics/MetricsView.tsx`, `components/admin/customers/CustomerProfile.tsx`, `messages/{es,en}.json`, `docs/ops/house-accounts.md` (new).

---

### Task 1: Schema, domain types, short-code module, order type changes

**Files:**
- Create: `db/migrations/030_house_accounts.sql`
- Create: `types/house-account.ts`
- Create: `lib/short-code.ts`
- Modify: `lib/digital-card-code.ts`
- Modify: `types/order.ts:37` (PaymentMethod), `:120-131` (Order), `:133-134` (OrderChangeKind)
- Modify: `lib/order-row.ts` (add `house_account_id`)
- Modify: `lib/invoice.ts:24,36,47` (`methods` record gains `"house-account"`)
- Test: `tests/unit/house-accounts-schema.test.ts`, `tests/unit/short-code.test.ts`

**Interfaces:**
- Produces: the five tables + `orders.house_account_id`; `types/house-account.ts` exports below; `generateCode()` / `CODE_PATTERN` from `lib/short-code.ts`; `Order.houseAccountId?: string`; `PaymentMethod` includes `"house-account"`; `OrderChangeKind` includes `"house_account"`.

- [ ] **Step 1: Write the failing schema test**

```ts
// tests/unit/house-accounts-schema.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { orderToRow, rowToOrder, type OrderRow } from "@/lib/order-row";
import { makeOrder } from "../factories/order";

beforeEach(() => { vi.stubEnv("SQLITE_FILE", ":memory:"); runMigrations(); });
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

function tables(): string[] {
  return (getDb().prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[]).map((r) => r.name);
}

describe("migration 030", () => {
  it("creates the house account tables", () => {
    const t = tables();
    for (const name of ["house_accounts", "house_account_contacts", "house_account_entries", "house_account_statements", "house_account_sends", "statement_number_seq"]) {
      expect(t).toContain(name);
    }
    const seq = getDb().prepare("SELECT last_value FROM statement_number_seq").get() as { last_value: number };
    expect(seq.last_value).toBe(1000);
  });

  it("adds orders.house_account_id and maps it both ways", () => {
    const cols = (getDb().prepare("PRAGMA table_info(orders)").all() as { name: string }[]).map((c) => c.name);
    expect(cols).toContain("house_account_id");
    const o = { ...makeOrder({ id: "o1" }), houseAccountId: "ha_x", paymentMethod: "house-account" as const };
    const row = orderToRow(o);
    expect(row.house_account_id).toBe("ha_x");
    expect(rowToOrder(row as OrderRow).houseAccountId).toBe("ha_x");
    expect(rowToOrder({ ...row, house_account_id: null } as OrderRow).houseAccountId).toBeUndefined();
  });

  it("stripe_session_id is unique on entries", () => {
    const db = getDb();
    db.prepare("INSERT INTO house_accounts (id, name, created_at, updated_at) VALUES ('ha_1','Org','2026-10-01T00:00:00Z','2026-10-01T00:00:00Z')").run();
    const ins = db.prepare("INSERT OR IGNORE INTO house_account_entries (id, account_id, kind, amount_cents, stripe_session_id, actor, created_at) VALUES (?, 'ha_1', 'payment', -100, 'cs_1', 'stripe', '2026-10-01T00:00:00Z')");
    expect(ins.run("e1").changes).toBe(1);
    expect(ins.run("e2").changes).toBe(0);
  });
});
```

```ts
// tests/unit/short-code.test.ts
import { describe, it, expect } from "vitest";
import { generateCode, CODE_PATTERN } from "@/lib/short-code";
import { generateCardCode } from "@/lib/digital-card-code";

describe("short-code", () => {
  it("makes 8-char base62 codes", () => {
    for (let i = 0; i < 50; i++) expect(generateCode()).toMatch(CODE_PATTERN);
  });
  it("digital-card-code keeps its old name as an alias", () => {
    expect(generateCardCode()).toMatch(CODE_PATTERN);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- tests/unit/house-accounts-schema.test.ts tests/unit/short-code.test.ts`
Expected: FAIL — tables missing / `Cannot find module '@/lib/short-code'`.

- [ ] **Step 3: Write the migration**

```sql
-- db/migrations/030_house_accounts.sql — house accounts (cuentas por cobrar).
--
-- An organization that orders often and pays on a schedule. The ledger
-- (house_account_entries) is the source of truth for what is owed; statements
-- are immutable snapshots of the running balance at a period close; sends are
-- the queue (and the log) of statement/reminder messages the daily cron runs.
CREATE TABLE IF NOT EXISTS house_accounts (
  id                 TEXT PRIMARY KEY,
  name               TEXT NOT NULL,
  billing_name       TEXT,
  billing_phone      TEXT,                     -- digits only, like customers.phone
  billing_email      TEXT,
  locale             TEXT NOT NULL DEFAULT 'en',
  cadence            TEXT NOT NULL DEFAULT 'monthly',   -- weekly | biweekly | monthly
  issue_day          INTEGER NOT NULL DEFAULT 1,        -- monthly 1..28; weekly/biweekly weekday 0..6
  anchor_date        TEXT,                              -- biweekly only: first issue date
  terms_days         INTEGER NOT NULL DEFAULT 15,
  reminder_plan_json TEXT NOT NULL DEFAULT '[]',        -- [{"offsetDays":-3,"channel":"sms"}, ...]
  statement_channel  TEXT NOT NULL DEFAULT 'sms',       -- sms | email | both
  status             TEXT NOT NULL DEFAULT 'active',    -- active | paused | closed
  notes              TEXT,
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL
);

-- A person allowed to charge to the account. UNIQUE(customer_id): one account per person.
CREATE TABLE IF NOT EXISTS house_account_contacts (
  account_id  TEXT NOT NULL REFERENCES house_accounts(id),
  customer_id TEXT NOT NULL UNIQUE REFERENCES customers(id),
  created_at  TEXT NOT NULL,
  PRIMARY KEY (account_id, customer_id)
);

-- The ledger. amount_cents is signed: charge / positive adjustment > 0;
-- payment / credit / reversal / negative adjustment < 0. Balance = SUM(amount_cents).
CREATE TABLE IF NOT EXISTS house_account_entries (
  id                TEXT PRIMARY KEY,
  account_id        TEXT NOT NULL REFERENCES house_accounts(id),
  kind              TEXT NOT NULL,              -- charge | payment | credit | adjustment | reversal
  amount_cents      INTEGER NOT NULL,
  order_id          TEXT,
  statement_id      TEXT,                       -- NULL = not yet on a statement
  method            TEXT,                       -- payments: cash | zelle | ach | check | card-terminal | stripe
  stripe_session_id TEXT UNIQUE,                -- Stripe payments: webhook idempotency key
  note              TEXT,
  actor             TEXT NOT NULL,
  created_at        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_hae_account_created ON house_account_entries(account_id, created_at);
CREATE INDEX IF NOT EXISTS idx_hae_order ON house_account_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_hae_account_statement ON house_account_entries(account_id, statement_id);

CREATE TABLE IF NOT EXISTS house_account_statements (
  id             TEXT PRIMARY KEY,
  account_id     TEXT NOT NULL REFERENCES house_accounts(id),
  number         TEXT NOT NULL UNIQUE,           -- ST-1001
  code           TEXT NOT NULL UNIQUE,           -- 8-char base62 for /s/<code>
  period_start   TEXT NOT NULL,                  -- YYYY-MM-DD
  period_end     TEXT NOT NULL,                  -- YYYY-MM-DD
  issued_at      TEXT NOT NULL,
  due_date       TEXT NOT NULL,                  -- YYYY-MM-DD
  opening_cents  INTEGER NOT NULL,
  charges_cents  INTEGER NOT NULL,
  credits_cents  INTEGER NOT NULL,
  payments_cents INTEGER NOT NULL,
  closing_cents  INTEGER NOT NULL,               -- running balance at period_end
  settled_cents  INTEGER NOT NULL DEFAULT 0,     -- recomputed from the ledger (lib/house-account-settlement.ts)
  status         TEXT NOT NULL,                  -- open | paid | void
  lines_json     TEXT NOT NULL,
  created_at     TEXT NOT NULL
);
-- One live statement per period; a voided one may be re-issued for the same period.
CREATE UNIQUE INDEX IF NOT EXISTS idx_hst_account_period
  ON house_account_statements(account_id, period_end) WHERE status != 'void';

CREATE TABLE IF NOT EXISTS statement_number_seq (last_value INTEGER NOT NULL);
INSERT INTO statement_number_seq (last_value) VALUES (1000);

-- Queue + log. The cron claims a row (scheduled -> sending) before sending so a
-- double run cannot send twice; the row then becomes sent / failed / skipped.
CREATE TABLE IF NOT EXISTS house_account_sends (
  id            TEXT PRIMARY KEY,
  account_id    TEXT NOT NULL REFERENCES house_accounts(id),
  statement_id  TEXT NOT NULL REFERENCES house_account_statements(id),
  kind          TEXT NOT NULL,                   -- statement | reminder | manual
  step_index    INTEGER,
  channel       TEXT NOT NULL,                   -- sms | email | both (as requested)
  scheduled_for TEXT NOT NULL,                   -- YYYY-MM-DD
  status        TEXT NOT NULL,                   -- scheduled | sending | sent | skipped | failed | canceled
  claimed_at    TEXT,
  sent_at       TEXT,
  sms_sid       TEXT,
  email_id      TEXT,
  body          TEXT,
  error         TEXT,
  created_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_has_status_date ON house_account_sends(status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_has_statement ON house_account_sends(statement_id);

ALTER TABLE orders ADD COLUMN house_account_id TEXT;
CREATE INDEX IF NOT EXISTS idx_orders_house_account ON orders(house_account_id);
```

- [ ] **Step 4: Write the domain types**

```ts
// types/house-account.ts
export type AccountCadence = "weekly" | "biweekly" | "monthly";
export type SendChannel = "sms" | "email" | "both";
export type AccountStatus = "active" | "paused" | "closed";
export type ReminderStep = { offsetDays: number; channel: SendChannel };

export type HouseAccount = {
  id: string;
  name: string;
  billingName?: string;
  billingPhone?: string; // digits only
  billingEmail?: string;
  locale: "en" | "es";
  cadence: AccountCadence;
  issueDay: number;       // monthly: 1..28; weekly/biweekly: weekday 0..6 (Sunday = 0)
  anchorDate?: string;    // biweekly only, YYYY-MM-DD
  termsDays: number;
  reminderPlan: ReminderStep[];
  statementChannel: SendChannel;
  status: AccountStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export type EntryKind = "charge" | "payment" | "credit" | "adjustment" | "reversal";
export type AccountPaymentMethod = "cash" | "zelle" | "ach" | "check" | "card-terminal" | "stripe";

export type LedgerEntry = {
  id: string;
  accountId: string;
  kind: EntryKind;
  amountCents: number; // signed
  orderId?: string;
  statementId?: string;
  method?: AccountPaymentMethod;
  stripeSessionId?: string;
  note?: string;
  actor: string;
  createdAt: string;
};

export type StatementStatus = "open" | "paid" | "void";
export type StatementLine = {
  date: string; // YYYY-MM-DD shop time
  kind: EntryKind;
  label: string;
  orderId?: string;
  orderNumber?: number;
  amountCents: number; // signed
};
export type Statement = {
  id: string;
  accountId: string;
  number: string;
  code: string;
  periodStart: string;
  periodEnd: string;
  issuedAt: string;
  dueDate: string;
  openingCents: number;
  chargesCents: number;
  creditsCents: number;
  paymentsCents: number;
  closingCents: number;
  settledCents: number;
  status: StatementStatus;
  lines: StatementLine[];
  createdAt: string;
};

export type SendKind = "statement" | "reminder" | "manual";
export type SendStatus = "scheduled" | "sending" | "sent" | "skipped" | "failed" | "canceled";
export type ScheduledSend = {
  id: string;
  accountId: string;
  statementId: string;
  kind: SendKind;
  stepIndex?: number;
  channel: SendChannel;
  scheduledFor: string;
  status: SendStatus;
  claimedAt?: string;
  sentAt?: string;
  smsSid?: string;
  emailId?: string;
  body?: string;
  error?: string;
  createdAt: string;
};
```

- [ ] **Step 5: Move the code generator to `lib/short-code.ts` and re-export from `digital-card-code.ts`**

```ts
// lib/short-code.ts
import crypto from "node:crypto";

const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
export const CODE_LENGTH = 8;
export const CODE_PATTERN = /^[0-9A-Za-z]{8}$/;

// 62^8 ≈ 2·10^14 codes. Bytes >= 248 (= 62 * 4) are skipped so every
// character is equally likely. Shared by digital cards (/c/<code>) and
// house-account statements (/s/<code>).
export function generateCode(random: (n: number) => Buffer = crypto.randomBytes): string {
  let out = "";
  while (out.length < CODE_LENGTH) {
    for (const b of random(16)) {
      if (b >= 248) continue;
      out += ALPHABET[b % 62];
      if (out.length === CODE_LENGTH) break;
    }
  }
  return out;
}
```

Replace the whole of `lib/digital-card-code.ts` with:

```ts
import { generateCode } from "@/lib/short-code";
export { CODE_LENGTH, CODE_PATTERN } from "@/lib/short-code";

// Kept under its old name so existing callers and tests do not change.
export const generateCardCode = generateCode;

export function shortUrl(code: string): string {
  // `||` (not `??`) so an empty env var still falls back to the shop domain.
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "https://makythedivaflowers.com").replace(/\/+$/, "");
  return `${base}/c/${code}`;
}
```

- [ ] **Step 6: Extend the order types and row mapping**

In `types/order.ts`:
- `export type PaymentMethod = "cash" | "zelle" | "card-terminal" | "ach" | "stripe" | "gift-card" | "house-account";`
- In `Order`, after `promoCode?: string;` add:
  ```ts
  /** Set when the order is charged to a house account (payment_method "house-account"). */
  houseAccountId?: string;
  ```
- `export type OrderChangeKind = | "created" | "edit" | "payment" | "fulfillment" | "cancel" | "note" | "reprint" | "digital_card" | "house_account";`

In `lib/order-row.ts`:
- `OrderRow` gains `house_account_id: string | null;`
- `orderToRow`: add `house_account_id: o.houseAccountId ?? null,`
- `rowToOrder`: add `...(r.house_account_id != null ? { houseAccountId: r.house_account_id } : {}),` next to the promo spreads.

In `lib/order-storage.ts`, find `upsertSqlite` (line ~46) and make sure the INSERT column list and the `ON CONFLICT ... DO UPDATE SET` list both include `house_account_id` (`house_account_id=@house_account_id`). Read the function first; it enumerates every column.

In `lib/invoice.ts`, the `methods` record in both locales gains `"house-account": "House account"` (en) and `"house-account": "A cuenta"` (es).

- [ ] **Step 7: Run the tests and the type check**

Run: `npm test -- tests/unit/house-accounts-schema.test.ts tests/unit/short-code.test.ts tests/unit/digital-card-helpers.test.ts && npx tsc --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 8: Commit**

```bash
git add db/migrations/030_house_accounts.sql types/house-account.ts lib/short-code.ts lib/digital-card-code.ts types/order.ts lib/order-row.ts lib/order-storage.ts lib/invoice.ts tests/unit/house-accounts-schema.test.ts tests/unit/short-code.test.ts
git commit -m "feat(accounts): schema, domain types and shared short-code module

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Plan arithmetic (pure)

**Files:**
- Create: `lib/house-account-plan.ts`
- Test: `tests/unit/house-account-plan.test.ts`

**Interfaces:**
- Consumes: `addDaysStr`, `dayDiff` from `lib/tv-slots.ts`; types from Task 1.
- Produces:
  ```ts
  export type PlanDefaults = { cadence: AccountCadence; issueDay: number; termsDays: number; reminderPlan: ReminderStep[]; statementChannel: SendChannel };
  export const DEFAULT_PLAN: PlanDefaults;
  export const SETTING_HOUSE_ACCOUNT_DEFAULTS = "house_account_defaults";
  export function resolveDefaults(json: string | null): PlanDefaults;
  export function parseReminderPlan(json: string | null): ReminderStep[];
  export function weekdayOf(ymd: string): number;
  export function anchorFor(issueDay: number, today: string): string;
  export function isIssueDay(a: { cadence; issueDay; anchorDate? }, today: string): boolean;
  export function nextIssueDate(a: { cadence; issueDay; anchorDate? }, from: string): string;
  export type PlannedSend = { kind: "statement" | "reminder"; stepIndex?: number; channel: SendChannel; scheduledFor: string };
  export function scheduleFromPlan(args: { today: string; dueDate: string; statementChannel: SendChannel; reminderPlan: ReminderStep[] }): PlannedSend[];
  ```

- [ ] **Step 1: Write the failing tests**

```ts
// tests/unit/house-account-plan.test.ts
import { describe, it, expect } from "vitest";
import {
  DEFAULT_PLAN, resolveDefaults, parseReminderPlan, weekdayOf, anchorFor,
  isIssueDay, nextIssueDate, scheduleFromPlan,
} from "@/lib/house-account-plan";

describe("defaults", () => {
  it("falls back to DEFAULT_PLAN on null or garbage", () => {
    expect(resolveDefaults(null)).toEqual(DEFAULT_PLAN);
    expect(resolveDefaults("{not json")).toEqual(DEFAULT_PLAN);
    expect(resolveDefaults('{"termsDays":"x","cadence":"daily"}')).toEqual(DEFAULT_PLAN);
  });
  it("merges valid overrides", () => {
    const d = resolveDefaults('{"termsDays":30,"cadence":"weekly","issueDay":1}');
    expect(d.termsDays).toBe(30);
    expect(d.cadence).toBe("weekly");
    expect(d.reminderPlan).toEqual(DEFAULT_PLAN.reminderPlan);
  });
  it("parses a reminder plan and drops invalid steps", () => {
    expect(parseReminderPlan('[{"offsetDays":-3,"channel":"sms"},{"offsetDays":"a","channel":"sms"},{"offsetDays":7,"channel":"fax"}]'))
      .toEqual([{ offsetDays: -3, channel: "sms" }]);
    expect(parseReminderPlan(null)).toEqual([]);
  });
});

describe("issue days", () => {
  it("weekdayOf: 2026-10-04 is a Sunday", () => {
    expect(weekdayOf("2026-10-04")).toBe(0);
    expect(weekdayOf("2026-10-05")).toBe(1);
  });
  it("anchorFor picks today when the weekday matches, else the next one", () => {
    expect(anchorFor(1, "2026-10-05")).toBe("2026-10-05");
    expect(anchorFor(1, "2026-10-06")).toBe("2026-10-12");
    expect(anchorFor(0, "2026-10-06")).toBe("2026-10-11");
  });
  it("monthly: issue_day of each month, including the 28th in February", () => {
    const a = { cadence: "monthly" as const, issueDay: 28 };
    expect(isIssueDay(a, "2027-02-28")).toBe(true);
    expect(isIssueDay(a, "2027-02-27")).toBe(false);
    expect(nextIssueDate({ cadence: "monthly", issueDay: 1 }, "2026-10-02")).toBe("2026-11-01");
    expect(nextIssueDate({ cadence: "monthly", issueDay: 1 }, "2026-12-02")).toBe("2027-01-01");
    expect(nextIssueDate({ cadence: "monthly", issueDay: 15 }, "2026-10-15")).toBe("2026-10-15");
  });
  it("weekly: every matching weekday", () => {
    const a = { cadence: "weekly" as const, issueDay: 1 };
    expect(isIssueDay(a, "2026-10-05")).toBe(true);
    expect(isIssueDay(a, "2026-10-06")).toBe(false);
    expect(nextIssueDate(a, "2026-10-06")).toBe("2026-10-12");
    expect(nextIssueDate(a, "2026-10-05")).toBe("2026-10-05");
  });
  it("biweekly: every 14 days from the anchor", () => {
    const a = { cadence: "biweekly" as const, issueDay: 1, anchorDate: "2026-10-05" };
    expect(isIssueDay(a, "2026-10-05")).toBe(true);
    expect(isIssueDay(a, "2026-10-12")).toBe(false);
    expect(isIssueDay(a, "2026-10-19")).toBe(true);
    expect(isIssueDay(a, "2026-09-21")).toBe(false); // before the anchor
    expect(nextIssueDate(a, "2026-10-13")).toBe("2026-10-19");
    expect(nextIssueDate(a, "2026-09-01")).toBe("2026-10-05");
  });
  it("biweekly without an anchor derives one from the weekday", () => {
    const a = { cadence: "biweekly" as const, issueDay: 1 };
    expect(nextIssueDate(a, "2026-10-06")).toBe("2026-10-12");
  });
});

describe("scheduleFromPlan", () => {
  const plan = [
    { offsetDays: -3, channel: "sms" as const },
    { offsetDays: 0, channel: "sms" as const },
    { offsetDays: 7, channel: "both" as const },
  ];
  it("one statement row today plus one reminder per future step", () => {
    const rows = scheduleFromPlan({ today: "2026-10-01", dueDate: "2026-10-16", statementChannel: "both", reminderPlan: plan });
    expect(rows).toEqual([
      { kind: "statement", channel: "both", scheduledFor: "2026-10-01" },
      { kind: "reminder", stepIndex: 0, channel: "sms", scheduledFor: "2026-10-13" },
      { kind: "reminder", stepIndex: 1, channel: "sms", scheduledFor: "2026-10-16" },
      { kind: "reminder", stepIndex: 2, channel: "both", scheduledFor: "2026-10-23" },
    ]);
  });
  it("drops steps that land on or before today", () => {
    const rows = scheduleFromPlan({ today: "2026-10-01", dueDate: "2026-10-03", statementChannel: "sms", reminderPlan: plan });
    expect(rows.map((r) => r.scheduledFor)).toEqual(["2026-10-01", "2026-10-03", "2026-10-10"]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- tests/unit/house-account-plan.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// lib/house-account-plan.ts
// Pure: cadence arithmetic and the per-account send plan. No DB, no I/O.
import { addDaysStr, dayDiff } from "@/lib/tv-slots";
import type { AccountCadence, ReminderStep, SendChannel } from "@/types/house-account";

export type PlanDefaults = {
  cadence: AccountCadence;
  issueDay: number;
  termsDays: number;
  reminderPlan: ReminderStep[];
  statementChannel: SendChannel;
};

export const SETTING_HOUSE_ACCOUNT_DEFAULTS = "house_account_defaults";

export const DEFAULT_PLAN: PlanDefaults = {
  cadence: "monthly",
  issueDay: 1,
  termsDays: 15,
  reminderPlan: [
    { offsetDays: -3, channel: "sms" },
    { offsetDays: 0, channel: "sms" },
    { offsetDays: 7, channel: "both" },
  ],
  statementChannel: "both",
};

const CADENCES = new Set<string>(["weekly", "biweekly", "monthly"]);
const CHANNELS = new Set<string>(["sms", "email", "both"]);

export function isCadence(v: unknown): v is AccountCadence { return typeof v === "string" && CADENCES.has(v); }
export function isChannel(v: unknown): v is SendChannel { return typeof v === "string" && CHANNELS.has(v); }

export function parseReminderPlan(json: string | null): ReminderStep[] {
  if (!json) return [];
  let raw: unknown;
  try { raw = JSON.parse(json); } catch { return []; }
  if (!Array.isArray(raw)) return [];
  const out: ReminderStep[] = [];
  for (const s of raw) {
    if (!s || typeof s !== "object") continue;
    const { offsetDays, channel } = s as { offsetDays?: unknown; channel?: unknown };
    if (!Number.isInteger(offsetDays) || !isChannel(channel)) continue;
    out.push({ offsetDays: offsetDays as number, channel });
  }
  return out;
}

/** Merge a `house_account_defaults` settings row over DEFAULT_PLAN, field by field. */
export function resolveDefaults(json: string | null): PlanDefaults {
  if (!json) return DEFAULT_PLAN;
  let raw: Record<string, unknown>;
  try {
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return DEFAULT_PLAN;
    raw = parsed as Record<string, unknown>;
  } catch { return DEFAULT_PLAN; }
  const out: PlanDefaults = { ...DEFAULT_PLAN, reminderPlan: [...DEFAULT_PLAN.reminderPlan] };
  if (isCadence(raw.cadence)) out.cadence = raw.cadence;
  if (Number.isInteger(raw.issueDay)) out.issueDay = raw.issueDay as number;
  if (Number.isInteger(raw.termsDays) && (raw.termsDays as number) >= 0) out.termsDays = raw.termsDays as number;
  if (isChannel(raw.statementChannel)) out.statementChannel = raw.statementChannel;
  if (Array.isArray(raw.reminderPlan)) out.reminderPlan = parseReminderPlan(JSON.stringify(raw.reminderPlan));
  return out;
}

function pad2(n: number): string { return String(n).padStart(2, "0"); }

/** 0 = Sunday … 6 = Saturday, for a bare YYYY-MM-DD (noon-anchored UTC, no DST drift). */
export function weekdayOf(ymd: string): number {
  return new Date(`${ymd}T12:00:00Z`).getUTCDay();
}

/** The next date (today included) whose weekday is `issueDay`. */
export function anchorFor(issueDay: number, today: string): string {
  const delta = (issueDay - weekdayOf(today) + 7) % 7;
  return addDaysStr(today, delta);
}

type CadenceInput = { cadence: AccountCadence; issueDay: number; anchorDate?: string };

export function isIssueDay(a: CadenceInput, today: string): boolean {
  switch (a.cadence) {
    case "monthly":
      return Number(today.slice(8, 10)) === a.issueDay;
    case "weekly":
      return weekdayOf(today) === a.issueDay;
    case "biweekly": {
      const anchor = a.anchorDate ?? anchorFor(a.issueDay, today);
      if (today < anchor) return false;
      return dayDiff(anchor, today) % 14 === 0;
    }
  }
}

/** First issue date on or after `from`. */
export function nextIssueDate(a: CadenceInput, from: string): string {
  switch (a.cadence) {
    case "monthly": {
      const y = Number(from.slice(0, 4));
      const m = Number(from.slice(5, 7));
      const d = Number(from.slice(8, 10));
      if (d <= a.issueDay) return `${y}-${pad2(m)}-${pad2(a.issueDay)}`;
      const ny = m === 12 ? y + 1 : y;
      const nm = m === 12 ? 1 : m + 1;
      return `${ny}-${pad2(nm)}-${pad2(a.issueDay)}`;
    }
    case "weekly":
      return anchorFor(a.issueDay, from);
    case "biweekly": {
      const anchor = a.anchorDate ?? anchorFor(a.issueDay, from);
      if (from <= anchor) return anchor;
      const k = Math.ceil(dayDiff(anchor, from) / 14);
      return addDaysStr(anchor, k * 14);
    }
  }
}

export type PlannedSend = {
  kind: "statement" | "reminder";
  stepIndex?: number;
  channel: SendChannel;
  scheduledFor: string;
};

/**
 * The queue rows for a freshly issued statement: the statement itself today,
 * then one reminder per plan step relative to the due date. Steps that land
 * on or before today are dropped — the statement send already covers today.
 */
export function scheduleFromPlan(args: {
  today: string;
  dueDate: string;
  statementChannel: SendChannel;
  reminderPlan: ReminderStep[];
}): PlannedSend[] {
  const rows: PlannedSend[] = [{ kind: "statement", channel: args.statementChannel, scheduledFor: args.today }];
  args.reminderPlan.forEach((step, i) => {
    const when = addDaysStr(args.dueDate, step.offsetDays);
    if (when <= args.today) return;
    rows.push({ kind: "reminder", stepIndex: i, channel: step.channel, scheduledFor: when });
  });
  return rows;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- tests/unit/house-account-plan.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/house-account-plan.ts tests/unit/house-account-plan.test.ts
git commit -m "feat(accounts): pure plan arithmetic (cadence, issue days, send schedule)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Account storage (accounts, contacts, list, search, receivables)

**Files:**
- Create: `lib/house-account-storage.ts`
- Test: `tests/unit/house-account-storage.test.ts`

**Interfaces:**
- Consumes: `getCustomerById`, `getByPhoneUS`, `normalizePhone`, `Customer` from `lib/customer-storage.ts`; `getSetting` from `lib/settings-storage.ts`; `shopDateStr` from `lib/tv-slots.ts`; Task 2 plan helpers.
- Produces:
  ```ts
  export function newId(prefix: string): string;
  export type CreateAccountInput = { name: string; billingName?: string; billingPhone?: string; billingEmail?: string; locale?: "en" | "es"; cadence?: AccountCadence; issueDay?: number; termsDays?: number; reminderPlan?: ReminderStep[]; statementChannel?: SendChannel; notes?: string };
  export function createAccount(input: CreateAccountInput, today?: string): HouseAccount;      // throws "name_required" | "issue_day_invalid"
  export type AccountPatch = Partial<CreateAccountInput> & { status?: AccountStatus };
  export function updateAccount(id: string, patch: AccountPatch, today?: string): HouseAccount | null;
  export function getAccount(id: string): HouseAccount | null;
  export function accountBalanceCents(id: string): number;
  export function linkContact(accountId: string, customerId: string): void;                     // throws "customer_not_found" | "contact_taken"
  export function unlinkContact(accountId: string, customerId: string): void;
  export function listContacts(accountId: string): Customer[];
  export function findAccountForCustomer(customerId: string): HouseAccount | null;
  export function findAccountForPhone(phone: string): HouseAccount | null;
  export function searchAccounts(q: string, limit?: number): { id: string; name: string }[];   // active only
  export type AccountFilter = "all" | "with_balance" | "overdue" | "paused";
  export type AccountListItem = HouseAccount & { balanceCents: number; oldestOpen: { id: string; number: string; dueDate: string; dueCents: number } | null; overdue: boolean; lastPaymentAt: string | null; nextIssueDate: string };
  export function listAccounts(opts?: { q?: string; filter?: AccountFilter; today?: string }): AccountListItem[];
  export function receivablesSummary(today?: string): { balanceCents: number; overdueCents: number; overdueCount: number };
  ```

- [ ] **Step 1: Write the failing tests**

```ts
// tests/unit/house-account-storage.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { setSetting } from "@/lib/settings-storage";
import {
  createAccount, getAccount, updateAccount, accountBalanceCents, linkContact, unlinkContact,
  listContacts, findAccountForCustomer, findAccountForPhone, searchAccounts, listAccounts, receivablesSummary,
} from "@/lib/house-account-storage";

beforeEach(() => { vi.stubEnv("SQLITE_FILE", ":memory:"); runMigrations(); });
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

function seedCustomer(id: string, phone: string, name = "Ana") {
  const now = "2026-09-01T00:00:00Z";
  getDb().prepare(
    `INSERT INTO customers (id, name, phone, order_count, first_seen_at, last_seen_at) VALUES (?, ?, ?, 0, ?, ?)`,
  ).run(id, name, phone, now, now);
}
function seedEntry(accountId: string, kind: string, cents: number, createdAt = "2026-09-10T12:00:00Z") {
  getDb().prepare(
    `INSERT INTO house_account_entries (id, account_id, kind, amount_cents, actor, created_at) VALUES (?, ?, ?, ?, 'test', ?)`,
  ).run(`hae_${Math.random().toString(36).slice(2)}`, accountId, kind, cents, createdAt);
}
function seedStatement(accountId: string, id: string, dueDate: string, closing: number, settled = 0, status = "open") {
  getDb().prepare(
    `INSERT INTO house_account_statements (id, account_id, number, code, period_start, period_end, issued_at, due_date,
       opening_cents, charges_cents, credits_cents, payments_cents, closing_cents, settled_cents, status, lines_json, created_at)
     VALUES (?, ?, ?, ?, '2026-09-01', '2026-09-30', '2026-10-01T13:00:00Z', ?, 0, ?, 0, 0, ?, ?, ?, '[]', '2026-10-01T13:00:00Z')`,
  ).run(id, accountId, `ST-${id}`, id.padEnd(8, "x").slice(0, 8), dueDate, closing, closing, settled, status);
}

describe("createAccount / getAccount / updateAccount", () => {
  it("creates with plan defaults and round-trips", () => {
    const a = createAccount({ name: "  Hotel Roslyn ", billingPhone: "(516) 555-0100", billingEmail: "ap@hotel.com" }, "2026-10-02");
    expect(a.id).toMatch(/^ha_/);
    expect(a.name).toBe("Hotel Roslyn");
    expect(a.billingPhone).toBe("5165550100");
    expect(a.cadence).toBe("monthly");
    expect(a.issueDay).toBe(1);
    expect(a.termsDays).toBe(15);
    expect(a.reminderPlan).toHaveLength(3);
    expect(a.statementChannel).toBe("both");
    expect(a.status).toBe("active");
    expect(getAccount(a.id)).toEqual(a);
  });
  it("reads defaults from the settings row", () => {
    setSetting("house_account_defaults", JSON.stringify({ termsDays: 30, cadence: "weekly", issueDay: 1 }));
    const a = createAccount({ name: "Iglesia" }, "2026-10-02");
    expect(a.termsDays).toBe(30);
    expect(a.cadence).toBe("weekly");
  });
  it("rejects an empty name and an out-of-range issue day", () => {
    expect(() => createAccount({ name: "  " })).toThrow("name_required");
    expect(() => createAccount({ name: "X", cadence: "monthly", issueDay: 31 })).toThrow("issue_day_invalid");
    expect(() => createAccount({ name: "X", cadence: "weekly", issueDay: 7 })).toThrow("issue_day_invalid");
  });
  it("sets the biweekly anchor from today and clears it when cadence changes", () => {
    const a = createAccount({ name: "Funeraria", cadence: "biweekly", issueDay: 1 }, "2026-10-06"); // Tuesday
    expect(a.anchorDate).toBe("2026-10-12");
    const b = updateAccount(a.id, { cadence: "monthly", issueDay: 5 }, "2026-10-06")!;
    expect(b.anchorDate).toBeUndefined();
    expect(b.issueDay).toBe(5);
    const c = updateAccount(a.id, { status: "paused", notes: "vacaciones" })!;
    expect(c.status).toBe("paused");
    expect(c.notes).toBe("vacaciones");
    expect(updateAccount("ha_nope", { notes: "x" })).toBeNull();
  });
});

describe("contacts", () => {
  it("links, lists, finds by customer and by phone, unlinks", () => {
    seedCustomer("cus_1", "5165550111", "Ana López");
    const a = createAccount({ name: "Org" });
    linkContact(a.id, "cus_1");
    expect(listContacts(a.id).map((c) => c.id)).toEqual(["cus_1"]);
    expect(findAccountForCustomer("cus_1")?.id).toBe(a.id);
    expect(findAccountForPhone("+1 (516) 555-0111")?.id).toBe(a.id);
    expect(findAccountForPhone("5165559999")).toBeNull();
    unlinkContact(a.id, "cus_1");
    expect(listContacts(a.id)).toEqual([]);
  });
  it("a customer belongs to one account only", () => {
    seedCustomer("cus_2", "5165550222");
    const a = createAccount({ name: "A" });
    const b = createAccount({ name: "B" });
    linkContact(a.id, "cus_2");
    linkContact(a.id, "cus_2"); // idempotent
    expect(() => linkContact(b.id, "cus_2")).toThrow("contact_taken");
    expect(() => linkContact(a.id, "cus_missing")).toThrow("customer_not_found");
  });
});

describe("balance, search, list, receivables", () => {
  it("balance is the signed sum of entries", () => {
    const a = createAccount({ name: "Org" });
    seedEntry(a.id, "charge", 10000);
    seedEntry(a.id, "payment", -2500);
    expect(accountBalanceCents(a.id)).toBe(7500);
    expect(accountBalanceCents("ha_nope")).toBe(0);
  });
  it("searchAccounts matches active accounts by name, case-insensitively", () => {
    createAccount({ name: "Hotel Roslyn" });
    const paused = createAccount({ name: "Hotel Garden" });
    updateAccount(paused.id, { status: "closed" });
    expect(searchAccounts("hotel").map((x) => x.name)).toEqual(["Hotel Roslyn"]);
    expect(searchAccounts("")).toEqual([]);
  });
  it("listAccounts annotates balance, oldest open statement, overdue and next issue", () => {
    const a = createAccount({ name: "Vencida", cadence: "monthly", issueDay: 1 }, "2026-10-02");
    seedEntry(a.id, "charge", 5000, "2026-09-10T12:00:00Z");
    seedStatement(a.id, "s1", "2026-09-30", 5000);
    const b = createAccount({ name: "Al día" }, "2026-10-02");
    seedEntry(b.id, "charge", 800, "2026-10-01T12:00:00Z");
    seedEntry(b.id, "payment", -800, "2026-10-01T13:00:00Z");
    const p = createAccount({ name: "Pausada" });
    updateAccount(p.id, { status: "paused" });

    const all = listAccounts({ today: "2026-10-02" });
    expect(all.map((x) => x.name)).toEqual(["Vencida", "Al día", "Pausada"]);
    const v = all[0];
    expect(v.balanceCents).toBe(5000);
    expect(v.oldestOpen).toMatchObject({ id: "s1", number: "ST-s1", dueDate: "2026-09-30", dueCents: 5000 });
    expect(v.overdue).toBe(true);
    expect(v.nextIssueDate).toBe("2026-11-01");
    expect(v.lastPaymentAt).toBeNull();
    expect(all[1].lastPaymentAt).toBe("2026-10-01T13:00:00Z");
    expect(listAccounts({ filter: "overdue", today: "2026-10-02" }).map((x) => x.name)).toEqual(["Vencida"]);
    expect(listAccounts({ filter: "with_balance", today: "2026-10-02" }).map((x) => x.name)).toEqual(["Vencida"]);
    expect(listAccounts({ filter: "paused" }).map((x) => x.name)).toEqual(["Pausada"]);
    expect(listAccounts({ q: "al d" }).map((x) => x.name)).toEqual(["Al día"]);
  });
  it("receivablesSummary totals positive balances and overdue open statements", () => {
    const a = createAccount({ name: "A" });
    seedEntry(a.id, "charge", 5000);
    seedStatement(a.id, "s1", "2026-09-30", 5000, 1000);
    const b = createAccount({ name: "B" });
    seedEntry(b.id, "credit", -300);
    seedStatement(b.id, "s2", "2026-10-20", 900);
    expect(receivablesSummary("2026-10-02")).toEqual({ balanceCents: 5000, overdueCents: 4000, overdueCount: 1 });
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- tests/unit/house-account-storage.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// lib/house-account-storage.ts
import "server-only";
import { getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { getCustomerById, getByPhoneUS, normalizePhone, type Customer } from "@/lib/customer-storage";
import { getSetting } from "@/lib/settings-storage";
import { shopDateStr } from "@/lib/tv-slots";
import {
  resolveDefaults, parseReminderPlan, anchorFor, nextIssueDate, SETTING_HOUSE_ACCOUNT_DEFAULTS,
} from "@/lib/house-account-plan";
import type {
  HouseAccount, AccountStatus, AccountCadence, SendChannel, ReminderStep,
} from "@/types/house-account";

type Row = {
  id: string; name: string; billing_name: string | null; billing_phone: string | null;
  billing_email: string | null; locale: string; cadence: string; issue_day: number;
  anchor_date: string | null; terms_days: number; reminder_plan_json: string;
  statement_channel: string; status: string; notes: string | null; created_at: string; updated_at: string;
};

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function rowToAccount(r: Row): HouseAccount {
  return {
    id: r.id,
    name: r.name,
    billingName: r.billing_name ?? undefined,
    billingPhone: r.billing_phone ?? undefined,
    billingEmail: r.billing_email ?? undefined,
    locale: r.locale === "es" ? "es" : "en",
    cadence: r.cadence as AccountCadence,
    issueDay: r.issue_day,
    anchorDate: r.anchor_date ?? undefined,
    termsDays: r.terms_days,
    reminderPlan: parseReminderPlan(r.reminder_plan_json),
    statementChannel: r.statement_channel as SendChannel,
    status: r.status as AccountStatus,
    notes: r.notes ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export type CreateAccountInput = {
  name: string;
  billingName?: string;
  billingPhone?: string;
  billingEmail?: string;
  locale?: "en" | "es";
  cadence?: AccountCadence;
  issueDay?: number;
  termsDays?: number;
  reminderPlan?: ReminderStep[];
  statementChannel?: SendChannel;
  notes?: string;
};

function assertIssueDay(cadence: AccountCadence, issueDay: number): void {
  const ok = cadence === "monthly" ? issueDay >= 1 && issueDay <= 28 : issueDay >= 0 && issueDay <= 6;
  if (!Number.isInteger(issueDay) || !ok) throw new Error("issue_day_invalid");
}

function cleanPhone(p: string | undefined): string | null {
  if (!p) return null;
  const d = normalizePhone(p);
  return d.length ? d : null;
}
function cleanText(s: string | undefined): string | null {
  const t = s?.trim();
  return t ? t : null;
}

export function createAccount(input: CreateAccountInput, today: string = shopDateStr(new Date())): HouseAccount {
  runMigrations();
  const name = input.name?.trim();
  if (!name) throw new Error("name_required");
  const defaults = resolveDefaults(getSetting(SETTING_HOUSE_ACCOUNT_DEFAULTS));
  const cadence = input.cadence ?? defaults.cadence;
  // A cadence that differs from the defaults' cadence gets a neutral issue day (1 = Monday or the 1st).
  const issueDay = input.issueDay ?? (cadence === defaults.cadence ? defaults.issueDay : 1);
  assertIssueDay(cadence, issueDay);
  const termsDays = input.termsDays ?? defaults.termsDays;
  if (!Number.isInteger(termsDays) || termsDays < 0) throw new Error("terms_invalid");
  const plan = input.reminderPlan ?? defaults.reminderPlan;
  const anchor = cadence === "biweekly" ? anchorFor(issueDay, today) : null;
  const id = newId("ha");
  const now = new Date().toISOString();
  getDb().prepare(
    `INSERT INTO house_accounts (id, name, billing_name, billing_phone, billing_email, locale, cadence, issue_day,
       anchor_date, terms_days, reminder_plan_json, statement_channel, status, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)`,
  ).run(
    id, name, cleanText(input.billingName), cleanPhone(input.billingPhone), cleanText(input.billingEmail),
    input.locale ?? "en", cadence, issueDay, anchor, termsDays, JSON.stringify(plan),
    input.statementChannel ?? defaults.statementChannel, cleanText(input.notes), now, now,
  );
  return getAccount(id)!;
}

export function getAccount(id: string): HouseAccount | null {
  runMigrations();
  const row = getDb().prepare("SELECT * FROM house_accounts WHERE id = ?").get(id) as Row | undefined;
  return row ? rowToAccount(row) : null;
}

export type AccountPatch = Partial<CreateAccountInput> & { status?: AccountStatus };

export function updateAccount(id: string, patch: AccountPatch, today: string = shopDateStr(new Date())): HouseAccount | null {
  const cur = getAccount(id);
  if (!cur) return null;
  const cadence = patch.cadence ?? cur.cadence;
  // Changing cadence without an explicit day resets it (1 = Monday or the 1st) so a weekday never leaks into a monthly plan.
  const issueDay = patch.issueDay ?? (patch.cadence && patch.cadence !== cur.cadence ? 1 : cur.issueDay);
  assertIssueDay(cadence, issueDay);
  const termsDays = patch.termsDays ?? cur.termsDays;
  if (!Number.isInteger(termsDays) || termsDays < 0) throw new Error("terms_invalid");
  const name = patch.name !== undefined ? patch.name.trim() : cur.name;
  if (!name) throw new Error("name_required");
  const cadenceOrDayChanged = cadence !== cur.cadence || issueDay !== cur.issueDay;
  const anchor = cadence === "biweekly"
    ? (cadenceOrDayChanged || !cur.anchorDate ? anchorFor(issueDay, today) : cur.anchorDate)
    : null;
  const now = new Date().toISOString();
  getDb().prepare(
    `UPDATE house_accounts SET name = ?, billing_name = ?, billing_phone = ?, billing_email = ?, locale = ?,
       cadence = ?, issue_day = ?, anchor_date = ?, terms_days = ?, reminder_plan_json = ?, statement_channel = ?,
       status = ?, notes = ?, updated_at = ? WHERE id = ?`,
  ).run(
    name,
    patch.billingName !== undefined ? cleanText(patch.billingName) : (cur.billingName ?? null),
    patch.billingPhone !== undefined ? cleanPhone(patch.billingPhone) : (cur.billingPhone ?? null),
    patch.billingEmail !== undefined ? cleanText(patch.billingEmail) : (cur.billingEmail ?? null),
    patch.locale ?? cur.locale,
    cadence, issueDay, anchor, termsDays,
    JSON.stringify(patch.reminderPlan ?? cur.reminderPlan),
    patch.statementChannel ?? cur.statementChannel,
    patch.status ?? cur.status,
    patch.notes !== undefined ? cleanText(patch.notes) : (cur.notes ?? null),
    now, id,
  );
  return getAccount(id);
}

export function accountBalanceCents(id: string): number {
  runMigrations();
  const row = getDb()
    .prepare("SELECT COALESCE(SUM(amount_cents), 0) AS b FROM house_account_entries WHERE account_id = ?")
    .get(id) as { b: number };
  return row.b;
}

// ---- contacts ----

export function linkContact(accountId: string, customerId: string): void {
  runMigrations();
  if (!getCustomerById(customerId)) throw new Error("customer_not_found");
  const db = getDb();
  const existing = db.prepare("SELECT account_id FROM house_account_contacts WHERE customer_id = ?").get(customerId) as
    | { account_id: string } | undefined;
  if (existing) {
    if (existing.account_id === accountId) return;
    throw new Error("contact_taken");
  }
  db.prepare("INSERT INTO house_account_contacts (account_id, customer_id, created_at) VALUES (?, ?, ?)")
    .run(accountId, customerId, new Date().toISOString());
}

export function unlinkContact(accountId: string, customerId: string): void {
  runMigrations();
  getDb().prepare("DELETE FROM house_account_contacts WHERE account_id = ? AND customer_id = ?").run(accountId, customerId);
}

export function listContacts(accountId: string): Customer[] {
  runMigrations();
  const ids = getDb()
    .prepare("SELECT customer_id FROM house_account_contacts WHERE account_id = ? ORDER BY created_at ASC")
    .all(accountId) as { customer_id: string }[];
  return ids.map((r) => getCustomerById(r.customer_id)).filter((c): c is Customer => c !== null);
}

export function findAccountForCustomer(customerId: string): HouseAccount | null {
  runMigrations();
  const row = getDb()
    .prepare("SELECT a.* FROM house_account_contacts c JOIN house_accounts a ON a.id = c.account_id WHERE c.customer_id = ?")
    .get(customerId) as Row | undefined;
  return row ? rowToAccount(row) : null;
}

export function findAccountForPhone(phone: string): HouseAccount | null {
  const customer = getByPhoneUS(phone);
  return customer ? findAccountForCustomer(customer.id) : null;
}

// ---- lists ----

export function searchAccounts(q: string, limit = 8): { id: string; name: string }[] {
  runMigrations();
  const needle = q.trim().toLowerCase();
  if (!needle) return [];
  return getDb()
    .prepare("SELECT id, name FROM house_accounts WHERE status = 'active' AND LOWER(name) LIKE ? ORDER BY name LIMIT ?")
    .all(`%${needle}%`, limit) as { id: string; name: string }[];
}

export type AccountFilter = "all" | "with_balance" | "overdue" | "paused";
export type AccountListItem = HouseAccount & {
  balanceCents: number;
  oldestOpen: { id: string; number: string; dueDate: string; dueCents: number } | null;
  overdue: boolean;
  lastPaymentAt: string | null;
  nextIssueDate: string;
};

export function listAccounts(opts: { q?: string; filter?: AccountFilter; today?: string } = {}): AccountListItem[] {
  runMigrations();
  const db = getDb();
  const today = opts.today ?? shopDateStr(new Date());
  const rows = db.prepare("SELECT * FROM house_accounts ORDER BY name").all() as Row[];
  const oldestStmt = db.prepare(
    `SELECT id, number, due_date, closing_cents, settled_cents FROM house_account_statements
     WHERE account_id = ? AND status = 'open' ORDER BY due_date ASC, created_at ASC LIMIT 1`,
  );
  const lastPay = db.prepare(
    "SELECT created_at FROM house_account_entries WHERE account_id = ? AND kind = 'payment' ORDER BY created_at DESC LIMIT 1",
  );
  const needle = opts.q?.trim().toLowerCase();
  const items: AccountListItem[] = [];
  for (const r of rows) {
    const a = rowToAccount(r);
    if (needle && !a.name.toLowerCase().includes(needle)) continue;
    const balanceCents = accountBalanceCents(a.id);
    const s = oldestStmt.get(a.id) as
      | { id: string; number: string; due_date: string; closing_cents: number; settled_cents: number } | undefined;
    const oldestOpen = s
      ? { id: s.id, number: s.number, dueDate: s.due_date, dueCents: Math.max(0, s.closing_cents - s.settled_cents) }
      : null;
    const overdue = !!oldestOpen && oldestOpen.dueCents > 0 && oldestOpen.dueDate < today;
    const lp = lastPay.get(a.id) as { created_at: string } | undefined;
    items.push({
      ...a, balanceCents, oldestOpen, overdue,
      lastPaymentAt: lp?.created_at ?? null,
      nextIssueDate: nextIssueDate(a, today),
    });
  }
  const filtered = items.filter((x) => {
    switch (opts.filter ?? "all") {
      case "with_balance": return x.balanceCents > 0;
      case "overdue": return x.overdue;
      case "paused": return x.status === "paused";
      default: return true;
    }
  });
  // Overdue first, then the biggest balances, then by name.
  return filtered.sort((x, y) =>
    Number(y.overdue) - Number(x.overdue) || y.balanceCents - x.balanceCents || x.name.localeCompare(y.name));
}

export function receivablesSummary(today: string = shopDateStr(new Date())): {
  balanceCents: number; overdueCents: number; overdueCount: number;
} {
  runMigrations();
  const db = getDb();
  const balances = db
    .prepare("SELECT account_id, SUM(amount_cents) AS b FROM house_account_entries GROUP BY account_id")
    .all() as { account_id: string; b: number }[];
  const balanceCents = balances.reduce((s, r) => s + Math.max(0, r.b), 0);
  const overdue = db
    .prepare(
      `SELECT closing_cents, settled_cents FROM house_account_statements WHERE status = 'open' AND due_date < ?`,
    )
    .all(today) as { closing_cents: number; settled_cents: number }[];
  let overdueCents = 0;
  let overdueCount = 0;
  for (const s of overdue) {
    const due = Math.max(0, s.closing_cents - s.settled_cents);
    if (due > 0) { overdueCents += due; overdueCount += 1; }
  }
  return { balanceCents, overdueCents, overdueCount };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- tests/unit/house-account-storage.test.ts`
Expected: PASS. (If `getByPhoneUS` for `"+1 (516) 555-0111"` misses, check `normalizePhone` strips the leading `1` the same way the seeded `5165550111` was stored; the test seeds 10 digits on purpose.)

- [ ] **Step 5: Commit**

```bash
git add lib/house-account-storage.ts tests/unit/house-account-storage.test.ts
git commit -m "feat(accounts): account + contact storage, list, search and receivables summary

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: FIFO allocation (pure)

**Files:**
- Create: `lib/house-account-allocate.ts`
- Test: `tests/unit/house-account-allocate.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type AllocationTarget = { id: string; dueCents: number };
  export type Allocation = { id: string; appliedCents: number };
  export function allocate(targets: AllocationTarget[], amountCents: number): Allocation[];
  ```

- [ ] **Step 1: Write the failing tests**

```ts
// tests/unit/house-account-allocate.test.ts
import { describe, it, expect } from "vitest";
import { allocate } from "@/lib/house-account-allocate";

const T = [{ id: "a", dueCents: 5000 }, { id: "b", dueCents: 3000 }, { id: "c", dueCents: 2000 }];

describe("allocate", () => {
  it("exact: covers everything in order", () => {
    expect(allocate(T, 10000)).toEqual([{ id: "a", appliedCents: 5000 }, { id: "b", appliedCents: 3000 }, { id: "c", appliedCents: 2000 }]);
  });
  it("partial: oldest first, the last one gets the remainder", () => {
    expect(allocate(T, 6500)).toEqual([{ id: "a", appliedCents: 5000 }, { id: "b", appliedCents: 1500 }]);
  });
  it("overpayment: applies all dues, leaves the surplus to the caller", () => {
    expect(allocate(T, 12000)).toEqual([{ id: "a", appliedCents: 5000 }, { id: "b", appliedCents: 3000 }, { id: "c", appliedCents: 2000 }]);
  });
  it("skips targets with nothing due", () => {
    expect(allocate([{ id: "a", dueCents: 0 }, { id: "b", dueCents: -5 }, { id: "c", dueCents: 700 }], 1000)).toEqual([{ id: "c", appliedCents: 700 }]);
  });
  it("zero, negative or non-integer amounts allocate nothing", () => {
    expect(allocate(T, 0)).toEqual([]);
    expect(allocate(T, -1)).toEqual([]);
    expect(allocate(T, 10.5)).toEqual([]);
    expect(allocate([], 100)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- tests/unit/house-account-allocate.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// lib/house-account-allocate.ts
// Pure: spread a payment over targets oldest-first. Used for open account
// orders (targets = orders, due = total − amount_paid). Any surplus is the
// caller's business (it stays on the account balance as credit).
export type AllocationTarget = { id: string; dueCents: number };
export type Allocation = { id: string; appliedCents: number };

export function allocate(targets: AllocationTarget[], amountCents: number): Allocation[] {
  if (!Number.isInteger(amountCents) || amountCents <= 0) return [];
  let remaining = amountCents;
  const out: Allocation[] = [];
  for (const t of targets) {
    if (remaining <= 0) break;
    const due = Math.max(0, t.dueCents);
    if (due === 0) continue;
    const applied = Math.min(due, remaining);
    out.push({ id: t.id, appliedCents: applied });
    remaining -= applied;
  }
  return out;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- tests/unit/house-account-allocate.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/house-account-allocate.ts tests/unit/house-account-allocate.test.ts
git commit -m "feat(accounts): pure FIFO allocation

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Send queue storage

**Files:**
- Create: `lib/house-account-sends.ts`
- Test: `tests/unit/house-account-sends.test.ts`

**Interfaces:**
- Consumes: `newId` from Task 3; `addDaysStr` from `lib/tv-slots.ts`.
- Produces:
  ```ts
  export type EnqueueInput = { accountId: string; statementId: string; kind: SendKind; stepIndex?: number; channel: SendChannel; scheduledFor: string };
  export function enqueue(rows: EnqueueInput[]): ScheduledSend[];
  export function getSend(id: string): ScheduledSend | null;
  export function dueSends(today: string): ScheduledSend[];          // scheduled, due, statement open, account active
  export function claim(id: string): boolean;                        // scheduled -> sending, true only for the winner
  export function markSent(id: string, r: { smsSid?: string; emailId?: string; body?: string; error?: string }): void;
  export function markFailed(id: string, error: string): void;
  export function markSkipped(id: string, reason: string): void;
  export function rescheduleSend(id: string, scheduledFor: string): ScheduledSend | null;  // only while scheduled
  export function cancelForStatement(statementId: string): number;
  export function skipStaleForAccount(accountId: string, today: string): number;
  export function failStaleSending(cutoffIso: string): number;
  export type UpcomingSend = ScheduledSend & { accountName: string; statementNumber: string; dueDate: string };
  export function upcomingSends(days: number, today: string): UpcomingSend[];
  export function listForAccount(accountId: string): ScheduledSend[];
  ```

- [ ] **Step 1: Write the failing tests**

```ts
// tests/unit/house-account-sends.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import {
  enqueue, getSend, dueSends, claim, markSent, markFailed, markSkipped, rescheduleSend,
  cancelForStatement, skipStaleForAccount, failStaleSending, upcomingSends, listForAccount,
} from "@/lib/house-account-sends";

beforeEach(() => { vi.stubEnv("SQLITE_FILE", ":memory:"); runMigrations(); });
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

function seedAccount(id: string, status = "active") {
  getDb().prepare("INSERT INTO house_accounts (id, name, status, created_at, updated_at) VALUES (?, ?, ?, '2026-09-01T00:00:00Z', '2026-09-01T00:00:00Z')")
    .run(id, `Org ${id}`, status);
}
function seedStatement(accountId: string, id: string, status = "open") {
  getDb().prepare(
    `INSERT INTO house_account_statements (id, account_id, number, code, period_start, period_end, issued_at, due_date,
       opening_cents, charges_cents, credits_cents, payments_cents, closing_cents, settled_cents, status, lines_json, created_at)
     VALUES (?, ?, ?, ?, '2026-09-01', '2026-09-30', '2026-10-01T13:00:00Z', '2026-10-16', 0, 100, 0, 0, 100, 0, ?, '[]', '2026-10-01T13:00:00Z')`,
  ).run(id, accountId, `ST-${id}`, id.padEnd(8, "x").slice(0, 8), status);
}

describe("queue", () => {
  it("enqueues and lists due rows only for open statements of active accounts", () => {
    seedAccount("ha_a"); seedStatement("ha_a", "s1");
    seedAccount("ha_p", "paused"); seedStatement("ha_p", "s2");
    seedAccount("ha_b"); seedStatement("ha_b", "s3", "paid");
    enqueue([
      { accountId: "ha_a", statementId: "s1", kind: "statement", channel: "both", scheduledFor: "2026-10-01" },
      { accountId: "ha_a", statementId: "s1", kind: "reminder", stepIndex: 0, channel: "sms", scheduledFor: "2026-10-13" },
      { accountId: "ha_p", statementId: "s2", kind: "statement", channel: "sms", scheduledFor: "2026-10-01" },
      { accountId: "ha_b", statementId: "s3", kind: "statement", channel: "sms", scheduledFor: "2026-10-01" },
    ]);
    const due = dueSends("2026-10-02");
    expect(due.map((d) => [d.statementId, d.kind])).toEqual([["s1", "statement"]]);
    expect(dueSends("2026-10-13").length).toBe(2);
  });

  it("claim wins once; mark* record outcomes", () => {
    seedAccount("ha_a"); seedStatement("ha_a", "s1");
    const [row] = enqueue([{ accountId: "ha_a", statementId: "s1", kind: "statement", channel: "sms", scheduledFor: "2026-10-01" }]);
    expect(claim(row.id)).toBe(true);
    expect(claim(row.id)).toBe(false);
    expect(getSend(row.id)?.status).toBe("sending");
    expect(getSend(row.id)?.claimedAt).toBeTruthy();
    markSent(row.id, { smsSid: "SM1", body: "hola" });
    const sent = getSend(row.id)!;
    expect(sent.status).toBe("sent");
    expect(sent.smsSid).toBe("SM1");
    expect(sent.body).toBe("hola");
    expect(sent.sentAt).toBeTruthy();
    const [r2, r3] = enqueue([
      { accountId: "ha_a", statementId: "s1", kind: "reminder", stepIndex: 0, channel: "sms", scheduledFor: "2026-10-05" },
      { accountId: "ha_a", statementId: "s1", kind: "reminder", stepIndex: 1, channel: "sms", scheduledFor: "2026-10-06" },
    ]);
    markFailed(r2.id, "boom");
    markSkipped(r3.id, "opt-out SMS");
    expect(getSend(r2.id)).toMatchObject({ status: "failed", error: "boom" });
    expect(getSend(r3.id)).toMatchObject({ status: "skipped", error: "opt-out SMS" });
  });

  it("reschedule only while scheduled; cancelForStatement cancels scheduled rows", () => {
    seedAccount("ha_a"); seedStatement("ha_a", "s1");
    const [a, b] = enqueue([
      { accountId: "ha_a", statementId: "s1", kind: "statement", channel: "sms", scheduledFor: "2026-10-01" },
      { accountId: "ha_a", statementId: "s1", kind: "reminder", stepIndex: 0, channel: "sms", scheduledFor: "2026-10-13" },
    ]);
    expect(rescheduleSend(b.id, "2026-10-20")?.scheduledFor).toBe("2026-10-20");
    claim(a.id); markSent(a.id, {});
    expect(rescheduleSend(a.id, "2026-10-20")).toBeNull();
    expect(cancelForStatement("s1")).toBe(1);
    expect(getSend(b.id)?.status).toBe("canceled");
    expect(getSend(a.id)?.status).toBe("sent");
  });

  it("skipStaleForAccount skips past-due scheduled rows and keeps future ones", () => {
    seedAccount("ha_a"); seedStatement("ha_a", "s1");
    const [past, future] = enqueue([
      { accountId: "ha_a", statementId: "s1", kind: "reminder", stepIndex: 0, channel: "sms", scheduledFor: "2026-10-01" },
      { accountId: "ha_a", statementId: "s1", kind: "reminder", stepIndex: 1, channel: "sms", scheduledFor: "2026-10-30" },
    ]);
    expect(skipStaleForAccount("ha_a", "2026-10-10")).toBe(1);
    expect(getSend(past.id)).toMatchObject({ status: "skipped", error: "pausa" });
    expect(getSend(future.id)?.status).toBe("scheduled");
  });

  it("failStaleSending turns an old 'sending' row into failed", () => {
    seedAccount("ha_a"); seedStatement("ha_a", "s1");
    const [row] = enqueue([{ accountId: "ha_a", statementId: "s1", kind: "statement", channel: "sms", scheduledFor: "2026-10-01" }]);
    claim(row.id);
    expect(failStaleSending(new Date(Date.now() - 3600_000).toISOString())).toBe(0);
    expect(failStaleSending(new Date(Date.now() + 1000).toISOString())).toBe(1);
    expect(getSend(row.id)).toMatchObject({ status: "failed", error: "interrumpido" });
  });

  it("upcomingSends joins account name and statement number within the window", () => {
    seedAccount("ha_a"); seedStatement("ha_a", "s1");
    enqueue([
      { accountId: "ha_a", statementId: "s1", kind: "reminder", stepIndex: 0, channel: "sms", scheduledFor: "2026-10-05" },
      { accountId: "ha_a", statementId: "s1", kind: "reminder", stepIndex: 1, channel: "sms", scheduledFor: "2026-10-25" },
    ]);
    const up = upcomingSends(7, "2026-10-02");
    expect(up).toHaveLength(1);
    expect(up[0]).toMatchObject({ accountName: "Org ha_a", statementNumber: "ST-s1", dueDate: "2026-10-16", scheduledFor: "2026-10-05" });
    expect(listForAccount("ha_a")).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- tests/unit/house-account-sends.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// lib/house-account-sends.ts
// The statement/reminder queue. One row per planned message; the same row is
// the log once it has gone out. The cron claims a row before sending so a
// second run (retry, manual run) can never send it twice.
import "server-only";
import { getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { addDaysStr } from "@/lib/tv-slots";
import { newId } from "@/lib/house-account-storage";
import type { ScheduledSend, SendChannel, SendKind, SendStatus } from "@/types/house-account";

type Row = {
  id: string; account_id: string; statement_id: string; kind: string; step_index: number | null;
  channel: string; scheduled_for: string; status: string; claimed_at: string | null; sent_at: string | null;
  sms_sid: string | null; email_id: string | null; body: string | null; error: string | null; created_at: string;
};

function rowToSend(r: Row): ScheduledSend {
  return {
    id: r.id,
    accountId: r.account_id,
    statementId: r.statement_id,
    kind: r.kind as SendKind,
    stepIndex: r.step_index ?? undefined,
    channel: r.channel as SendChannel,
    scheduledFor: r.scheduled_for,
    status: r.status as SendStatus,
    claimedAt: r.claimed_at ?? undefined,
    sentAt: r.sent_at ?? undefined,
    smsSid: r.sms_sid ?? undefined,
    emailId: r.email_id ?? undefined,
    body: r.body ?? undefined,
    error: r.error ?? undefined,
    createdAt: r.created_at,
  };
}

export type EnqueueInput = {
  accountId: string;
  statementId: string;
  kind: SendKind;
  stepIndex?: number;
  channel: SendChannel;
  scheduledFor: string;
};

export function enqueue(rows: EnqueueInput[]): ScheduledSend[] {
  runMigrations();
  const db = getDb();
  const insert = db.prepare(
    `INSERT INTO house_account_sends (id, account_id, statement_id, kind, step_index, channel, scheduled_for, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'scheduled', ?)`,
  );
  const out: ScheduledSend[] = [];
  for (const r of rows) {
    const id = newId("hsd");
    insert.run(id, r.accountId, r.statementId, r.kind, r.stepIndex ?? null, r.channel, r.scheduledFor, new Date().toISOString());
    out.push(getSend(id)!);
  }
  return out;
}

export function getSend(id: string): ScheduledSend | null {
  runMigrations();
  const row = getDb().prepare("SELECT * FROM house_account_sends WHERE id = ?").get(id) as Row | undefined;
  return row ? rowToSend(row) : null;
}

export function dueSends(today: string): ScheduledSend[] {
  runMigrations();
  const rows = getDb().prepare(
    `SELECT s.* FROM house_account_sends s
       JOIN house_account_statements st ON st.id = s.statement_id
       JOIN house_accounts a ON a.id = s.account_id
     WHERE s.status = 'scheduled' AND s.scheduled_for <= ? AND st.status = 'open' AND a.status = 'active'
     ORDER BY s.scheduled_for ASC, s.created_at ASC`,
  ).all(today) as Row[];
  return rows.map(rowToSend);
}

export function claim(id: string): boolean {
  runMigrations();
  const res = getDb()
    .prepare("UPDATE house_account_sends SET status = 'sending', claimed_at = ? WHERE id = ? AND status = 'scheduled'")
    .run(new Date().toISOString(), id);
  return res.changes === 1;
}

export function markSent(id: string, r: { smsSid?: string; emailId?: string; body?: string; error?: string }): void {
  runMigrations();
  getDb().prepare(
    `UPDATE house_account_sends SET status = 'sent', sent_at = ?, sms_sid = ?, email_id = ?, body = ?, error = ? WHERE id = ?`,
  ).run(new Date().toISOString(), r.smsSid ?? null, r.emailId ?? null, r.body ?? null, r.error ?? null, id);
}

export function markFailed(id: string, error: string): void {
  runMigrations();
  getDb().prepare("UPDATE house_account_sends SET status = 'failed', error = ? WHERE id = ?").run(error, id);
}

export function markSkipped(id: string, reason: string): void {
  runMigrations();
  getDb().prepare("UPDATE house_account_sends SET status = 'skipped', error = ? WHERE id = ?").run(reason, id);
}

export function rescheduleSend(id: string, scheduledFor: string): ScheduledSend | null {
  runMigrations();
  const res = getDb()
    .prepare("UPDATE house_account_sends SET scheduled_for = ? WHERE id = ? AND status = 'scheduled'")
    .run(scheduledFor, id);
  return res.changes === 1 ? getSend(id) : null;
}

export function cancelForStatement(statementId: string): number {
  runMigrations();
  return getDb()
    .prepare("UPDATE house_account_sends SET status = 'canceled' WHERE statement_id = ? AND status = 'scheduled'")
    .run(statementId).changes;
}

/** On reactivation after a pause: anything that should have gone out meanwhile is skipped, not burst. */
export function skipStaleForAccount(accountId: string, today: string): number {
  runMigrations();
  return getDb()
    .prepare("UPDATE house_account_sends SET status = 'skipped', error = 'pausa' WHERE account_id = ? AND status = 'scheduled' AND scheduled_for < ?")
    .run(accountId, today).changes;
}

/** A crash mid-send leaves a row in 'sending'; the next cron turns old ones into failures. */
export function failStaleSending(cutoffIso: string): number {
  runMigrations();
  return getDb()
    .prepare("UPDATE house_account_sends SET status = 'failed', error = 'interrumpido' WHERE status = 'sending' AND claimed_at < ?")
    .run(cutoffIso).changes;
}

export type UpcomingSend = ScheduledSend & { accountName: string; statementNumber: string; dueDate: string };

export function upcomingSends(days: number, today: string): UpcomingSend[] {
  runMigrations();
  const until = addDaysStr(today, days);
  const rows = getDb().prepare(
    `SELECT s.*, a.name AS account_name, st.number AS statement_number, st.due_date AS due_date
       FROM house_account_sends s
       JOIN house_accounts a ON a.id = s.account_id
       JOIN house_account_statements st ON st.id = s.statement_id
     WHERE s.status = 'scheduled' AND s.scheduled_for <= ?
     ORDER BY s.scheduled_for ASC, a.name ASC`,
  ).all(until) as (Row & { account_name: string; statement_number: string; due_date: string })[];
  return rows.map((r) => ({ ...rowToSend(r), accountName: r.account_name, statementNumber: r.statement_number, dueDate: r.due_date }));
}

export function listForAccount(accountId: string): ScheduledSend[] {
  runMigrations();
  const rows = getDb()
    .prepare("SELECT * FROM house_account_sends WHERE account_id = ? ORDER BY scheduled_for DESC, created_at DESC")
    .all(accountId) as Row[];
  return rows.map(rowToSend);
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- tests/unit/house-account-sends.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/house-account-sends.ts tests/unit/house-account-sends.test.ts
git commit -m "feat(accounts): send queue storage with claim-before-send

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Settlement + ledger (charges, payments with FIFO, credits, adjustments, reversals, move/remove)

**Files:**
- Create: `lib/house-account-settlement.ts`
- Create: `lib/house-account-ledger.ts`
- Test: `tests/unit/house-account-ledger.test.ts`

**Interfaces:**
- Consumes: `allocate` (Task 4), `cancelForStatement` (Task 5), `getAccount`, `newId` (Task 3), `shopDateStr` from `lib/tv-slots.ts`.
- Produces (`lib/house-account-settlement.ts`):
  ```ts
  export function dueCents(s: { closingCents: number; settledCents: number }): number;
  export function entryDate(createdAtIso: string): string;            // YYYY-MM-DD shop time
  export function recomputeSettlement(accountId: string): string[];  // ids of statements that just became paid
  ```
- Produces (`lib/house-account-ledger.ts`):
  ```ts
  export type PaymentResult = { entry: LedgerEntry | null; allocations: Allocation[] };
  export function getEntry(id: string): LedgerEntry | null;
  export function listEntries(accountId: string): LedgerEntry[];                 // chronological
  export function entriesForOrder(orderId: string): LedgerEntry[];
  export function recordCharge(i: { accountId: string; orderId: string; amountCents: number; note?: string; actor: string }): LedgerEntry;
  export function recordPayment(i: { accountId: string; amountCents: number; method: AccountPaymentMethod; note?: string; actor: string; stripeSessionId?: string }): PaymentResult;
  export function recordCredit(i: { accountId: string; amountCents: number; note: string; actor: string }): PaymentResult;
  export function recordAdjustment(i: { accountId: string; amountCents: number; orderId?: string; note: string; actor: string }): LedgerEntry;
  export function reverseOrderCharge(orderId: string, actor: string): LedgerEntry | null;
  export function syncOrderTotal(orderId: string, beforeCents: number, afterCents: number, actor: string): LedgerEntry | null;
  export function moveOrderToAccount(orderId: string, accountId: string, actor: string): LedgerEntry;
  export function removeOrderFromAccount(orderId: string, actor: string): LedgerEntry;
  export function recordStripeStatementPayment(i: { statementId: string; sessionId: string; amountCents: number }): PaymentResult | null;
  ```
  Error messages thrown (matched by routes): `invalid_amount`, `invalid_method`, `note_required`, `account_not_found`, `account_inactive`, `order not found: <id>`, `already_on_account`, `not_pending`, `nothing_due`, `not_on_account`, `already_billed`, `already_reversed`, `has_payments`.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/unit/house-account-ledger.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { createAccount, accountBalanceCents, updateAccount } from "@/lib/house-account-storage";
import {
  recordCharge, recordPayment, recordCredit, recordAdjustment, reverseOrderCharge, syncOrderTotal,
  moveOrderToAccount, removeOrderFromAccount, recordStripeStatementPayment, listEntries,
} from "@/lib/house-account-ledger";
import { recomputeSettlement, dueCents } from "@/lib/house-account-settlement";
import { enqueue, getSend } from "@/lib/house-account-sends";

beforeEach(() => { vi.stubEnv("SQLITE_FILE", ":memory:"); runMigrations(); });
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

type OrderSeed = { id: string; total: number; paid?: number; accountId?: string | null; createdAt?: string; status?: string; payment?: string };
function seedOrder(o: OrderSeed) {
  getDb().prepare(
    `INSERT INTO orders (id, locale, source, recipient_name, recipient_phone, contact_phone, fulfillment_method, window_date,
       lines_json, subtotal_cents, delivery_cents, tax_cents, total_cents, amount_paid_cents, fulfillment_status,
       payment_status, payment_method, house_account_id, order_number, created_at, updated_at)
     VALUES (?, 'es', 'phone', 'Dest', '555', '5165550100', 'delivery', '2026-10-01', '[]', ?, 0, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    o.id, o.total, o.total, o.paid ?? 0, o.status ?? "pending", o.payment ?? "pending",
    o.accountId ? "house-account" : null, o.accountId ?? null, Number(o.id.replace(/\D/g, "")) || 1000,
    o.createdAt ?? "2026-09-10T12:00:00Z", o.createdAt ?? "2026-09-10T12:00:00Z",
  );
}
function order(id: string) {
  return getDb().prepare("SELECT * FROM orders WHERE id = ?").get(id) as {
    amount_paid_cents: number; payment_status: string; paid_at: string | null; house_account_id: string | null; payment_method: string | null;
  };
}
function seedStatement(accountId: string, id: string, periodEnd: string, closing: number) {
  getDb().prepare(
    `INSERT INTO house_account_statements (id, account_id, number, code, period_start, period_end, issued_at, due_date,
       opening_cents, charges_cents, credits_cents, payments_cents, closing_cents, settled_cents, status, lines_json, created_at)
     VALUES (?, ?, ?, ?, '2026-09-01', ?, '2026-10-01T13:00:00Z', '2026-10-16', 0, ?, 0, 0, ?, 0, 'open', '[]', '2026-10-01T13:00:00Z')`,
  ).run(id, accountId, `ST-${id}`, id.padEnd(8, "x").slice(0, 8), periodEnd, closing, closing);
}
function statement(id: string) {
  return getDb().prepare("SELECT status, settled_cents AS settledCents, closing_cents AS closingCents FROM house_account_statements WHERE id = ?").get(id) as
    { status: string; settledCents: number; closingCents: number };
}

describe("charges and payments", () => {
  it("recordCharge adds a positive entry tied to the order", () => {
    const a = createAccount({ name: "Org" });
    seedOrder({ id: "o1001", total: 5000, accountId: a.id });
    const e = recordCharge({ accountId: a.id, orderId: "o1001", amountCents: 5000, actor: "maky" });
    expect(e).toMatchObject({ kind: "charge", amountCents: 5000, orderId: "o1001" });
    expect(accountBalanceCents(a.id)).toBe(5000);
    expect(() => recordCharge({ accountId: a.id, orderId: "o1001", amountCents: 0, actor: "maky" })).toThrow("invalid_amount");
    expect(() => recordCharge({ accountId: "ha_nope", orderId: "o1001", amountCents: 1, actor: "maky" })).toThrow("account_not_found");
  });

  it("recordPayment allocates FIFO to open orders and marks the covered ones paid", () => {
    const a = createAccount({ name: "Org" });
    seedOrder({ id: "o1001", total: 5000, accountId: a.id, createdAt: "2026-09-10T12:00:00Z" });
    seedOrder({ id: "o1002", total: 3000, accountId: a.id, createdAt: "2026-09-11T12:00:00Z" });
    seedOrder({ id: "o1003", total: 2000, accountId: a.id, createdAt: "2026-09-12T12:00:00Z" });
    for (const [id, c] of [["o1001", 5000], ["o1002", 3000], ["o1003", 2000]] as const) {
      recordCharge({ accountId: a.id, orderId: id, amountCents: c, actor: "maky" });
    }
    const r = recordPayment({ accountId: a.id, amountCents: 6500, method: "zelle", actor: "maky" });
    expect(r.entry).toMatchObject({ kind: "payment", amountCents: -6500, method: "zelle" });
    expect(r.allocations).toEqual([{ id: "o1001", appliedCents: 5000 }, { id: "o1002", appliedCents: 1500 }]);
    expect(order("o1001")).toMatchObject({ amount_paid_cents: 5000, payment_status: "paid", payment_method: "house-account" });
    expect(order("o1001").paid_at).toBeTruthy();
    expect(order("o1002")).toMatchObject({ amount_paid_cents: 1500, payment_status: "pending" });
    expect(order("o1003")).toMatchObject({ amount_paid_cents: 0, payment_status: "pending" });
    expect(accountBalanceCents(a.id)).toBe(3500);
    const changes = getDb().prepare("SELECT order_id, kind, summary FROM order_changes ORDER BY rowid").all() as { order_id: string; kind: string; summary: string }[];
    expect(changes.filter((c) => c.kind === "payment").map((c) => c.order_id)).toEqual(["o1001", "o1002"]);
    expect(changes[0].summary).toContain("$50.00");
  });

  it("overpayment pays every order and leaves credit on the account", () => {
    const a = createAccount({ name: "Org" });
    seedOrder({ id: "o1001", total: 1000, accountId: a.id });
    recordCharge({ accountId: a.id, orderId: "o1001", amountCents: 1000, actor: "maky" });
    const r = recordPayment({ accountId: a.id, amountCents: 1500, method: "cash", actor: "maky" });
    expect(r.allocations).toEqual([{ id: "o1001", appliedCents: 1000 }]);
    expect(accountBalanceCents(a.id)).toBe(-500);
  });

  it("validates payments", () => {
    const a = createAccount({ name: "Org" });
    expect(() => recordPayment({ accountId: a.id, amountCents: -5, method: "cash", actor: "m" })).toThrow("invalid_amount");
    expect(() => recordPayment({ accountId: a.id, amountCents: 5, method: "crypto" as never, actor: "m" })).toThrow("invalid_method");
    expect(() => recordCredit({ accountId: a.id, amountCents: 5, note: "  ", actor: "m" })).toThrow("note_required");
  });

  it("recordCredit allocates like a payment", () => {
    const a = createAccount({ name: "Org" });
    seedOrder({ id: "o1001", total: 1000, accountId: a.id });
    recordCharge({ accountId: a.id, orderId: "o1001", amountCents: 1000, actor: "maky" });
    const r = recordCredit({ accountId: a.id, amountCents: 1000, note: "cortesía", actor: "maky" });
    expect(r.entry?.kind).toBe("credit");
    expect(order("o1001").payment_status).toBe("paid");
    expect(accountBalanceCents(a.id)).toBe(0);
  });
});

describe("adjustments, reversals, edits", () => {
  it("an order-edit adjustment never pays another order, but marks its own when covered", () => {
    const a = createAccount({ name: "Org" });
    seedOrder({ id: "o1001", total: 5000, accountId: a.id, createdAt: "2026-09-10T12:00:00Z" });
    seedOrder({ id: "o1002", total: 1000, paid: 800, accountId: a.id, createdAt: "2026-09-11T12:00:00Z" });
    recordCharge({ accountId: a.id, orderId: "o1001", amountCents: 5000, actor: "maky" });
    recordCharge({ accountId: a.id, orderId: "o1002", amountCents: 200, actor: "maky" });
    // o1002's total drops from 1000 to 800: the order is now covered by its deposit.
    getDb().prepare("UPDATE orders SET total_cents = 800 WHERE id = 'o1002'").run();
    const e = syncOrderTotal("o1002", 1000, 800, "maky");
    expect(e).toMatchObject({ kind: "adjustment", amountCents: -200, orderId: "o1002" });
    expect(order("o1002").payment_status).toBe("paid");
    expect(order("o1001")).toMatchObject({ amount_paid_cents: 0, payment_status: "pending" });
    expect(syncOrderTotal("o1002", 800, 800, "maky")).toBeNull();
    expect(accountBalanceCents(a.id)).toBe(5000);
  });

  it("manual adjustment requires a note and a non-zero amount", () => {
    const a = createAccount({ name: "Org" });
    expect(() => recordAdjustment({ accountId: a.id, amountCents: 0, note: "x", actor: "m" })).toThrow("invalid_amount");
    expect(() => recordAdjustment({ accountId: a.id, amountCents: 100, note: "", actor: "m" })).toThrow("note_required");
    expect(recordAdjustment({ accountId: a.id, amountCents: 250, note: "recargo", actor: "m" }).amountCents).toBe(250);
  });

  it("reversal happens once and frees only the canceled order's paid amount", () => {
    const a = createAccount({ name: "Org" });
    seedOrder({ id: "o1001", total: 10000, accountId: a.id, createdAt: "2026-09-10T12:00:00Z" });
    seedOrder({ id: "o1002", total: 5000, accountId: a.id, createdAt: "2026-09-11T12:00:00Z" });
    recordCharge({ accountId: a.id, orderId: "o1001", amountCents: 10000, actor: "maky" });
    recordCharge({ accountId: a.id, orderId: "o1002", amountCents: 5000, actor: "maky" });
    // Nothing paid yet: the reversal must not touch o1002.
    getDb().prepare("UPDATE orders SET fulfillment_status = 'canceled' WHERE id = 'o1001'").run();
    const r1 = reverseOrderCharge("o1001", "maky");
    expect(r1).toMatchObject({ kind: "reversal", amountCents: -10000, orderId: "o1001" });
    expect(order("o1002")).toMatchObject({ amount_paid_cents: 0, payment_status: "pending" });
    expect(accountBalanceCents(a.id)).toBe(5000);
    expect(reverseOrderCharge("o1001", "maky")).toBeNull();
    expect(reverseOrderCharge("o_unknown", "maky")).toBeNull();
  });

  it("reversal of a paid order frees its money to the next open order", () => {
    const a = createAccount({ name: "Org" });
    seedOrder({ id: "o1001", total: 1000, accountId: a.id, createdAt: "2026-09-10T12:00:00Z" });
    seedOrder({ id: "o1002", total: 500, accountId: a.id, createdAt: "2026-09-11T12:00:00Z" });
    recordCharge({ accountId: a.id, orderId: "o1001", amountCents: 1000, actor: "maky" });
    recordCharge({ accountId: a.id, orderId: "o1002", amountCents: 500, actor: "maky" });
    recordPayment({ accountId: a.id, amountCents: 1000, method: "cash", actor: "maky" }); // pays o1001
    getDb().prepare("UPDATE orders SET fulfillment_status = 'canceled' WHERE id = 'o1001'").run();
    reverseOrderCharge("o1001", "maky");
    expect(order("o1002")).toMatchObject({ amount_paid_cents: 500, payment_status: "paid" });
    expect(accountBalanceCents(a.id)).toBe(-500);
  });
});

describe("move / remove", () => {
  it("moveOrderToAccount charges the remaining balance and tags the order", () => {
    const a = createAccount({ name: "Org" });
    seedOrder({ id: "o1001", total: 5000, paid: 1000 });
    const e = moveOrderToAccount("o1001", a.id, "maky");
    expect(e).toMatchObject({ kind: "charge", amountCents: 4000, orderId: "o1001" });
    expect(order("o1001")).toMatchObject({ house_account_id: a.id, payment_method: "house-account", payment_status: "pending" });
    expect(() => moveOrderToAccount("o1001", a.id, "maky")).toThrow("already_on_account");
    const kinds = (getDb().prepare("SELECT kind FROM order_changes WHERE order_id = 'o1001'").all() as { kind: string }[]).map((k) => k.kind);
    expect(kinds).toContain("house_account");
  });
  it("refuses paid, canceled, fully-paid and inactive-account moves", () => {
    const a = createAccount({ name: "Org" });
    seedOrder({ id: "o1001", total: 5000, payment: "paid", paid: 5000 });
    expect(() => moveOrderToAccount("o1001", a.id, "maky")).toThrow("not_pending");
    seedOrder({ id: "o1002", total: 5000, status: "canceled" });
    expect(() => moveOrderToAccount("o1002", a.id, "maky")).toThrow("not_pending");
    seedOrder({ id: "o1003", total: 5000, paid: 5000 });
    expect(() => moveOrderToAccount("o1003", a.id, "maky")).toThrow("nothing_due");
    updateAccount(a.id, { status: "paused" });
    seedOrder({ id: "o1004", total: 5000 });
    expect(() => moveOrderToAccount("o1004", a.id, "maky")).toThrow("account_inactive");
    expect(() => moveOrderToAccount("o1004", "ha_nope", "maky")).toThrow("account_not_found");
  });
  it("removeOrderFromAccount reverses an unbilled charge and clears the order", () => {
    const a = createAccount({ name: "Org" });
    seedOrder({ id: "o1001", total: 5000 });
    moveOrderToAccount("o1001", a.id, "maky");
    const e = removeOrderFromAccount("o1001", "maky");
    expect(e).toMatchObject({ kind: "reversal", amountCents: -5000 });
    expect(order("o1001")).toMatchObject({ house_account_id: null, payment_method: null, payment_status: "pending" });
    expect(accountBalanceCents(a.id)).toBe(0);
    expect(() => removeOrderFromAccount("o1001", "maky")).toThrow("not_on_account");
  });
  it("refuses to remove once billed or once a payment landed after the charge", () => {
    const a = createAccount({ name: "Org" });
    seedOrder({ id: "o1001", total: 5000, accountId: a.id });
    recordCharge({ accountId: a.id, orderId: "o1001", amountCents: 5000, actor: "maky" });
    recordPayment({ accountId: a.id, amountCents: 100, method: "cash", actor: "maky" });
    expect(() => removeOrderFromAccount("o1001", "maky")).toThrow("has_payments");
    seedOrder({ id: "o1002", total: 500, accountId: a.id });
    const e = recordCharge({ accountId: a.id, orderId: "o1002", amountCents: 500, actor: "maky" });
    getDb().prepare("UPDATE house_account_entries SET statement_id = 'hst_x' WHERE id = ?").run(e.id);
    expect(() => removeOrderFromAccount("o1002", "maky")).toThrow("already_billed");
  });
});

describe("settlement", () => {
  it("one payment settles two cumulative statements at once and cancels their queue", () => {
    const a = createAccount({ name: "Org" });
    seedStatement(a.id, "s1", "2026-08-31", 10000);
    seedStatement(a.id, "s2", "2026-09-30", 15000);
    const [send] = enqueue([{ accountId: a.id, statementId: "s2", kind: "reminder", stepIndex: 0, channel: "sms", scheduledFor: "2026-10-13" }]);
    recordPayment({ accountId: a.id, amountCents: 6000, method: "ach", actor: "maky" });
    expect(statement("s1")).toMatchObject({ status: "open", settledCents: 6000 });
    expect(statement("s2")).toMatchObject({ status: "open", settledCents: 6000 });
    expect(dueCents(statement("s2"))).toBe(9000);
    recordPayment({ accountId: a.id, amountCents: 9000, method: "ach", actor: "maky" });
    expect(statement("s1")).toMatchObject({ status: "paid", settledCents: 10000 });
    expect(statement("s2")).toMatchObject({ status: "paid", settledCents: 15000 });
    expect(getSend(send.id)?.status).toBe("canceled");
  });
  it("a reversal that zeroes the balance marks the open statement paid", () => {
    const a = createAccount({ name: "Org" });
    seedOrder({ id: "o1001", total: 5000, accountId: a.id, createdAt: "2026-09-10T12:00:00Z" });
    recordCharge({ accountId: a.id, orderId: "o1001", amountCents: 5000, actor: "maky" });
    seedStatement(a.id, "s1", "2026-09-30", 5000);
    getDb().prepare("UPDATE house_account_entries SET statement_id = 's1' WHERE account_id = ?").run(a.id);
    getDb().prepare("UPDATE orders SET fulfillment_status = 'canceled' WHERE id = 'o1001'").run();
    reverseOrderCharge("o1001", "maky");
    expect(statement("s1").status).toBe("paid");
  });
  it("recomputeSettlement ignores negatives dated on or before the period end", () => {
    const a = createAccount({ name: "Org" });
    seedStatement(a.id, "s1", "2026-09-30", 5000);
    getDb().prepare("INSERT INTO house_account_entries (id, account_id, kind, amount_cents, actor, created_at) VALUES ('e1', ?, 'payment', -5000, 't', '2026-09-30T12:00:00Z')").run(a.id);
    expect(recomputeSettlement(a.id)).toEqual([]);
    expect(statement("s1")).toMatchObject({ status: "open", settledCents: 0 });
  });
});

describe("stripe", () => {
  it("recordStripeStatementPayment is idempotent per session", () => {
    const a = createAccount({ name: "Org" });
    seedStatement(a.id, "s1", "2026-09-30", 5000);
    const first = recordStripeStatementPayment({ statementId: "s1", sessionId: "cs_1", amountCents: 5000 });
    expect(first?.entry).toMatchObject({ method: "stripe", stripeSessionId: "cs_1", actor: "stripe" });
    const again = recordStripeStatementPayment({ statementId: "s1", sessionId: "cs_1", amountCents: 5000 });
    expect(again?.entry).toBeNull();
    expect(accountBalanceCents(a.id)).toBe(-5000);
    expect(statement("s1").status).toBe("paid");
    expect(recordStripeStatementPayment({ statementId: "nope", sessionId: "cs_2", amountCents: 1 })).toBeNull();
    expect(listEntries(a.id)).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- tests/unit/house-account-ledger.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement the settlement module**

```ts
// lib/house-account-settlement.ts
// A statement is settled by every negative ledger entry recorded after its
// period closed. Recomputed from the ledger (never incremented) so no code
// path can drift. closing_cents is the cumulative balance, so one payment
// settles every older open statement at once.
import "server-only";
import { getDb } from "@/lib/db";
import { shopDateStr } from "@/lib/tv-slots";
import { cancelForStatement } from "@/lib/house-account-sends";

export function dueCents(s: { closingCents: number; settledCents: number }): number {
  return Math.max(0, s.closingCents - s.settledCents);
}

/** Shop-local calendar day of an ISO timestamp. */
export function entryDate(createdAtIso: string): string {
  return shopDateStr(new Date(createdAtIso));
}

/**
 * Recompute settled_cents for every open statement of the account. A statement
 * whose due amount reaches 0 becomes paid and its scheduled sends are canceled.
 * Safe to call inside a caller's transaction (it only issues UPDATEs).
 */
export function recomputeSettlement(accountId: string): string[] {
  const db = getDb();
  const negatives = db
    .prepare("SELECT amount_cents, created_at FROM house_account_entries WHERE account_id = ? AND amount_cents < 0")
    .all(accountId) as { amount_cents: number; created_at: string }[];
  const open = db
    .prepare("SELECT id, period_end, closing_cents FROM house_account_statements WHERE account_id = ? AND status = 'open'")
    .all(accountId) as { id: string; period_end: string; closing_cents: number }[];
  const update = db.prepare("UPDATE house_account_statements SET settled_cents = ?, status = ? WHERE id = ?");
  const paid: string[] = [];
  for (const s of open) {
    const sum = negatives
      .filter((n) => entryDate(n.created_at) > s.period_end)
      .reduce((acc, n) => acc + -n.amount_cents, 0);
    const settled = Math.max(0, Math.min(s.closing_cents, sum));
    const isPaid = s.closing_cents - settled <= 0;
    update.run(settled, isPaid ? "paid" : "open", s.id);
    if (isPaid) {
      cancelForStatement(s.id);
      paid.push(s.id);
    }
  }
  return paid;
}
```

- [ ] **Step 4: Implement the ledger module**

```ts
// lib/house-account-ledger.ts
// The account ledger. Every money movement is an append-only entry; payments
// and credits are spread over the account's open orders oldest-first so the
// per-order views (drawer, Bandeja, metrics) stay right without changes.
import "server-only";
import crypto from "node:crypto";
import { getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { allocate, type Allocation } from "@/lib/house-account-allocate";
import { recomputeSettlement } from "@/lib/house-account-settlement";
import { getAccount, newId } from "@/lib/house-account-storage";
import type { LedgerEntry, EntryKind, AccountPaymentMethod } from "@/types/house-account";

const PAYMENT_METHODS: AccountPaymentMethod[] = ["cash", "zelle", "ach", "check", "card-terminal", "stripe"];

type EntryRow = {
  id: string; account_id: string; kind: string; amount_cents: number; order_id: string | null;
  statement_id: string | null; method: string | null; stripe_session_id: string | null;
  note: string | null; actor: string; created_at: string;
};

function rowToEntry(r: EntryRow): LedgerEntry {
  return {
    id: r.id,
    accountId: r.account_id,
    kind: r.kind as EntryKind,
    amountCents: r.amount_cents,
    orderId: r.order_id ?? undefined,
    statementId: r.statement_id ?? undefined,
    method: (r.method as AccountPaymentMethod | null) ?? undefined,
    stripeSessionId: r.stripe_session_id ?? undefined,
    note: r.note ?? undefined,
    actor: r.actor,
    createdAt: r.created_at,
  };
}

function money(c: number): string { return `$${(c / 100).toFixed(2)}`; }

function tx<T>(fn: () => T): T {
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const out = fn();
    db.exec("COMMIT");
    return out;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

export function getEntry(id: string): LedgerEntry | null {
  runMigrations();
  const row = getDb().prepare("SELECT * FROM house_account_entries WHERE id = ?").get(id) as EntryRow | undefined;
  return row ? rowToEntry(row) : null;
}

export function listEntries(accountId: string): LedgerEntry[] {
  runMigrations();
  const rows = getDb()
    .prepare("SELECT * FROM house_account_entries WHERE account_id = ? ORDER BY created_at ASC, rowid ASC")
    .all(accountId) as EntryRow[];
  return rows.map(rowToEntry);
}

export function entriesForOrder(orderId: string): LedgerEntry[] {
  runMigrations();
  const rows = getDb()
    .prepare("SELECT * FROM house_account_entries WHERE order_id = ? ORDER BY created_at ASC, rowid ASC")
    .all(orderId) as EntryRow[];
  return rows.map(rowToEntry);
}

type InsertInput = {
  accountId: string; kind: EntryKind; amountCents: number; orderId?: string;
  method?: AccountPaymentMethod; stripeSessionId?: string; note?: string; actor: string;
};

/** Returns null only when an INSERT OR IGNORE (Stripe session) hit a duplicate. */
function insertEntry(input: InsertInput): LedgerEntry | null {
  const id = newId("hae");
  const sql = `INSERT ${input.stripeSessionId ? "OR IGNORE " : ""}INTO house_account_entries
      (id, account_id, kind, amount_cents, order_id, method, stripe_session_id, note, actor, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  const res = getDb().prepare(sql).run(
    id, input.accountId, input.kind, input.amountCents, input.orderId ?? null, input.method ?? null,
    input.stripeSessionId ?? null, input.note ?? null, input.actor, new Date().toISOString(),
  );
  return res.changes === 0 ? null : getEntry(id);
}

type OpenOrderRow = { id: string; total_cents: number; amount_paid_cents: number };

function openOrders(accountId: string, excludeOrderId?: string): OpenOrderRow[] {
  return getDb().prepare(
    `SELECT id, total_cents, amount_paid_cents FROM orders
     WHERE house_account_id = ? AND payment_status = 'pending' AND fulfillment_status != 'canceled'
       ${excludeOrderId ? "AND id != ?" : ""}
     ORDER BY created_at ASC, rowid ASC`,
  ).all(...(excludeOrderId ? [accountId, excludeOrderId] : [accountId])) as OpenOrderRow[];
}

function insertOrderChange(orderId: string, actor: string, kind: "payment" | "house_account", summary: string): void {
  getDb().prepare(
    `INSERT INTO order_changes (id, order_id, at, actor, kind, summary, changes_json) VALUES (?, ?, ?, ?, ?, ?, NULL)`,
  ).run(crypto.randomUUID(), orderId, new Date().toISOString(), actor, kind, summary);
}

/** Spread `amountCents` over the account's open orders; updates orders + order_changes. */
function applyToOrders(accountId: string, amountCents: number, entryId: string, actor: string, excludeOrderId?: string): Allocation[] {
  const rows = openOrders(accountId, excludeOrderId);
  const byId = new Map(rows.map((r) => [r.id, r]));
  const allocations = allocate(rows.map((r) => ({ id: r.id, dueCents: r.total_cents - r.amount_paid_cents })), amountCents);
  const db = getDb();
  const now = new Date().toISOString();
  for (const a of allocations) {
    const o = byId.get(a.id)!;
    const paid = o.amount_paid_cents + a.appliedCents;
    const full = paid >= o.total_cents;
    db.prepare(
      `UPDATE orders SET amount_paid_cents = ?, payment_status = ?, paid_at = CASE WHEN ? THEN COALESCE(paid_at, ?) ELSE paid_at END, updated_at = ? WHERE id = ?`,
    ).run(paid, full ? "paid" : "pending", full ? 1 : 0, now, now, a.id);
    insertOrderChange(a.id, actor, "payment",
      `Pago de cuenta ${money(a.appliedCents)}${full ? " · pagada" : ` · saldo ${money(o.total_cents - paid)}`} · ${entryId}`);
  }
  return allocations;
}

function assertAccount(accountId: string) {
  const a = getAccount(accountId);
  if (!a) throw new Error("account_not_found");
  return a;
}
function assertPositiveInt(n: number) {
  if (!Number.isInteger(n) || n <= 0) throw new Error("invalid_amount");
}
function assertNote(note: string | undefined): string {
  const t = note?.trim();
  if (!t) throw new Error("note_required");
  return t;
}

export function recordCharge(i: { accountId: string; orderId: string; amountCents: number; note?: string; actor: string }): LedgerEntry {
  runMigrations();
  assertPositiveInt(i.amountCents);
  assertAccount(i.accountId);
  return tx(() => {
    const e = insertEntry({ accountId: i.accountId, kind: "charge", amountCents: i.amountCents, orderId: i.orderId, note: i.note, actor: i.actor })!;
    recomputeSettlement(i.accountId);
    return e;
  });
}

export type PaymentResult = { entry: LedgerEntry | null; allocations: Allocation[] };

export function recordPayment(i: {
  accountId: string; amountCents: number; method: AccountPaymentMethod; note?: string; actor: string; stripeSessionId?: string;
}): PaymentResult {
  runMigrations();
  assertPositiveInt(i.amountCents);
  if (!PAYMENT_METHODS.includes(i.method)) throw new Error("invalid_method");
  assertAccount(i.accountId);
  return tx(() => {
    const entry = insertEntry({
      accountId: i.accountId, kind: "payment", amountCents: -i.amountCents, method: i.method,
      stripeSessionId: i.stripeSessionId, note: i.note, actor: i.actor,
    });
    if (!entry) return { entry: null, allocations: [] }; // duplicate Stripe session: already recorded
    const allocations = applyToOrders(i.accountId, i.amountCents, entry.id, i.actor);
    recomputeSettlement(i.accountId);
    return { entry, allocations };
  });
}

export function recordCredit(i: { accountId: string; amountCents: number; note: string; actor: string }): PaymentResult {
  runMigrations();
  assertPositiveInt(i.amountCents);
  const note = assertNote(i.note);
  assertAccount(i.accountId);
  return tx(() => {
    const entry = insertEntry({ accountId: i.accountId, kind: "credit", amountCents: -i.amountCents, note, actor: i.actor })!;
    const allocations = applyToOrders(i.accountId, i.amountCents, entry.id, i.actor);
    recomputeSettlement(i.accountId);
    return { entry, allocations };
  });
}

/** Signed. Never allocates to other orders; an order-bound adjustment only re-checks its own order. */
export function recordAdjustment(i: { accountId: string; amountCents: number; orderId?: string; note: string; actor: string }): LedgerEntry {
  runMigrations();
  if (!Number.isInteger(i.amountCents) || i.amountCents === 0) throw new Error("invalid_amount");
  const note = assertNote(i.note);
  assertAccount(i.accountId);
  return tx(() => {
    const e = insertEntry({ accountId: i.accountId, kind: "adjustment", amountCents: i.amountCents, orderId: i.orderId, note, actor: i.actor })!;
    if (i.orderId) {
      const now = new Date().toISOString();
      getDb().prepare(
        `UPDATE orders SET payment_status = 'paid', paid_at = COALESCE(paid_at, ?), updated_at = ?
         WHERE id = ? AND payment_status = 'pending' AND fulfillment_status != 'canceled' AND amount_paid_cents >= total_cents`,
      ).run(now, now, i.orderId);
    }
    recomputeSettlement(i.accountId);
    return e;
  });
}

/** Cancel hook: reverse the order's charge (+ its adjustments) once; free only money already applied to it. */
export function reverseOrderCharge(orderId: string, actor: string): LedgerEntry | null {
  runMigrations();
  const rows = entriesForOrder(orderId);
  if (rows.length === 0) return null;
  if (rows.some((r) => r.kind === "reversal")) return null;
  const sum = rows.filter((r) => r.kind === "charge" || r.kind === "adjustment").reduce((s, r) => s + r.amountCents, 0);
  if (sum === 0) return null;
  const accountId = rows[0].accountId;
  const order = getDb().prepare("SELECT amount_paid_cents FROM orders WHERE id = ?").get(orderId) as { amount_paid_cents: number } | undefined;
  if (!order) return null;
  return tx(() => {
    const e = insertEntry({ accountId, kind: "reversal", amountCents: -sum, orderId, note: "Orden cancelada", actor })!;
    if (order.amount_paid_cents > 0) applyToOrders(accountId, order.amount_paid_cents, e.id, actor, orderId);
    recomputeSettlement(accountId);
    return e;
  });
}

/** Edit hook: a changed total on an account order becomes a signed adjustment. */
export function syncOrderTotal(orderId: string, beforeCents: number, afterCents: number, actor: string): LedgerEntry | null {
  runMigrations();
  const delta = afterCents - beforeCents;
  if (delta === 0) return null;
  const row = getDb().prepare("SELECT house_account_id FROM orders WHERE id = ?").get(orderId) as { house_account_id: string | null } | undefined;
  if (!row?.house_account_id) return null;
  return recordAdjustment({
    accountId: row.house_account_id, amountCents: delta, orderId,
    note: `Edición de orden: ${money(beforeCents)} → ${money(afterCents)}`, actor,
  });
}

type OrderRowLite = {
  id: string; total_cents: number; amount_paid_cents: number; payment_status: string;
  fulfillment_status: string; house_account_id: string | null;
};
function orderRow(orderId: string): OrderRowLite {
  const row = getDb()
    .prepare("SELECT id, total_cents, amount_paid_cents, payment_status, fulfillment_status, house_account_id FROM orders WHERE id = ?")
    .get(orderId) as OrderRowLite | undefined;
  if (!row) throw new Error(`order not found: ${orderId}`);
  return row;
}

export function moveOrderToAccount(orderId: string, accountId: string, actor: string): LedgerEntry {
  runMigrations();
  const account = assertAccount(accountId);
  if (account.status !== "active") throw new Error("account_inactive");
  const o = orderRow(orderId);
  if (o.house_account_id) throw new Error("already_on_account");
  if (o.payment_status !== "pending" || o.fulfillment_status === "canceled") throw new Error("not_pending");
  const remaining = o.total_cents - o.amount_paid_cents;
  if (remaining <= 0) throw new Error("nothing_due");
  return tx(() => {
    const now = new Date().toISOString();
    getDb().prepare("UPDATE orders SET house_account_id = ?, payment_method = 'house-account', updated_at = ? WHERE id = ?")
      .run(accountId, now, orderId);
    const e = insertEntry({ accountId, kind: "charge", amountCents: remaining, orderId, note: "Pasada a cuenta", actor })!;
    insertOrderChange(orderId, actor, "house_account", `Pasada a cuenta ${account.name} · ${money(remaining)}`);
    recomputeSettlement(accountId);
    return e;
  });
}

export function removeOrderFromAccount(orderId: string, actor: string): LedgerEntry {
  runMigrations();
  const o = orderRow(orderId);
  if (!o.house_account_id) throw new Error("not_on_account");
  const accountId = o.house_account_id;
  const rows = entriesForOrder(orderId);
  if (rows.some((r) => r.statementId)) throw new Error("already_billed");
  if (rows.some((r) => r.kind === "reversal")) throw new Error("already_reversed");
  const firstCharge = rows.find((r) => r.kind === "charge");
  if (firstCharge) {
    const later = getDb().prepare(
      "SELECT 1 FROM house_account_entries WHERE account_id = ? AND kind IN ('payment','credit') AND created_at >= ? LIMIT 1",
    ).get(accountId, firstCharge.createdAt);
    if (later) throw new Error("has_payments");
  }
  const sum = rows.filter((r) => r.kind === "charge" || r.kind === "adjustment").reduce((s, r) => s + r.amountCents, 0);
  return tx(() => {
    const now = new Date().toISOString();
    const e = insertEntry({ accountId, kind: "reversal", amountCents: -sum, orderId, note: "Quitada de cuenta", actor })!;
    getDb().prepare("UPDATE orders SET house_account_id = NULL, payment_method = NULL, updated_at = ? WHERE id = ?").run(now, orderId);
    insertOrderChange(orderId, actor, "house_account", `Quitada de cuenta · ${money(sum)}`);
    recomputeSettlement(accountId);
    return e;
  });
}

/** Webhook entry point. Idempotent by Stripe session id. */
export function recordStripeStatementPayment(i: { statementId: string; sessionId: string; amountCents: number }): PaymentResult | null {
  runMigrations();
  const st = getDb()
    .prepare("SELECT account_id, number FROM house_account_statements WHERE id = ?")
    .get(i.statementId) as { account_id: string; number: string } | undefined;
  if (!st) return null;
  return recordPayment({
    accountId: st.account_id, amountCents: i.amountCents, method: "stripe",
    note: `Stripe · ${st.number}`, actor: "stripe", stripeSessionId: i.sessionId,
  });
}
```

- [ ] **Step 5: Run to verify pass**

Run: `npm test -- tests/unit/house-account-ledger.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/house-account-settlement.ts lib/house-account-ledger.ts tests/unit/house-account-ledger.test.ts
git commit -m "feat(accounts): ledger with FIFO order allocation and derived statement settlement

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: Statements (issue, void, lookups)

**Files:**
- Create: `lib/house-account-statements.ts`
- Test: `tests/unit/house-account-statements.test.ts`

**Interfaces:**
- Consumes: `getAccount`, `newId` (Task 3); `generateCode` (Task 1); `isIssueDay`, `scheduleFromPlan` (Task 2); `enqueue`, `cancelForStatement` (Task 5); `recomputeSettlement`, `entryDate`, `dueCents` (Task 6); `addDaysStr`, `shopDateStr` from `lib/tv-slots.ts`.
- Produces:
  ```ts
  export function issueStatement(accountId: string, periodEnd: string, opts?: { today?: string }): Statement | null;
  export function accountsDueToIssue(today: string): HouseAccount[];
  export function getStatement(id: string): Statement | null;
  export function getStatementByCode(code: string): Statement | null;
  export function listStatements(accountId: string): Statement[];    // newest first
  export function latestStatement(accountId: string): Statement | null; // newest non-void
  export function voidStatement(id: string): Statement;              // throws "statement_paid" | "not_latest" | "statement_not_found"
  ```

- [ ] **Step 1: Write the failing tests**

```ts
// tests/unit/house-account-statements.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { createAccount, updateAccount } from "@/lib/house-account-storage";
import { recordCharge, recordPayment, listEntries } from "@/lib/house-account-ledger";
import { issueStatement, accountsDueToIssue, getStatementByCode, listStatements, voidStatement, getStatement } from "@/lib/house-account-statements";
import { listForAccount } from "@/lib/house-account-sends";
import { recomputeSettlement } from "@/lib/house-account-settlement";
import { CODE_PATTERN } from "@/lib/short-code";

beforeEach(() => { vi.stubEnv("SQLITE_FILE", ":memory:"); runMigrations(); });
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

// Timestamps use T12:00Z so the shop-local (America/New_York) date equals the UTC date.
function seedOrder(id: string, accountId: string, total: number, createdAt: string, recipient = "Dest") {
  getDb().prepare(
    `INSERT INTO orders (id, locale, source, recipient_name, recipient_phone, contact_phone, fulfillment_method, window_date,
       lines_json, subtotal_cents, delivery_cents, tax_cents, total_cents, amount_paid_cents, fulfillment_status,
       payment_status, payment_method, house_account_id, order_number, created_at, updated_at)
     VALUES (?, 'es', 'phone', ?, '555', '5165550100', 'delivery', '2026-10-01', '[]', ?, 0, 0, ?, 0, 'pending',
       'pending', 'house-account', ?, ?, ?, ?)`,
  ).run(id, recipient, total, total, accountId, Number(id.replace(/\D/g, "")), createdAt, createdAt);
}
function backdate(entryId: string, iso: string) {
  getDb().prepare("UPDATE house_account_entries SET created_at = ? WHERE id = ?").run(iso, entryId);
}
function seedAccountWithCharges(name = "Org") {
  const a = createAccount({ name, termsDays: 15, reminderPlan: [{ offsetDays: -3, channel: "sms" }, { offsetDays: 0, channel: "sms" }, { offsetDays: 7, channel: "both" }], statementChannel: "both" }, "2026-09-01");
  getDb().prepare("UPDATE house_accounts SET created_at = '2026-09-01T12:00:00Z' WHERE id = ?").run(a.id);
  seedOrder("o1001", a.id, 5000, "2026-09-10T12:00:00Z", "Lobby");
  seedOrder("o1002", a.id, 3000, "2026-09-20T12:00:00Z", "Suite 4");
  backdate(recordCharge({ accountId: a.id, orderId: "o1001", amountCents: 5000, actor: "m" }).id, "2026-09-10T12:00:00Z");
  backdate(recordCharge({ accountId: a.id, orderId: "o1002", amountCents: 3000, actor: "m" }).id, "2026-09-20T12:00:00Z");
  backdate(recordPayment({ accountId: a.id, amountCents: 1000, method: "zelle", actor: "m" }).entry!.id, "2026-09-25T12:00:00Z");
  return a;
}

describe("issueStatement", () => {
  it("freezes the period, numbers it, stamps entries and enqueues the plan", () => {
    const a = seedAccountWithCharges();
    const s = issueStatement(a.id, "2026-09-30", { today: "2026-10-01" })!;
    expect(s.number).toBe("ST-1001");
    expect(s.code).toMatch(CODE_PATTERN);
    expect(s).toMatchObject({ periodStart: "2026-09-01", periodEnd: "2026-09-30", dueDate: "2026-10-16",
      openingCents: 0, chargesCents: 8000, creditsCents: 0, paymentsCents: 1000, closingCents: 7000, settledCents: 0, status: "open" });
    expect(s.lines.map((l) => [l.kind, l.amountCents, l.orderNumber ?? null])).toEqual([
      ["charge", 5000, 1001], ["charge", 3000, 1002], ["payment", -1000, null],
    ]);
    expect(s.lines[0].label).toContain("Lobby");
    expect(listEntries(a.id).every((e) => e.statementId === s.id)).toBe(true);
    const sends = listForAccount(a.id).sort((x, y) => x.scheduledFor.localeCompare(y.scheduledFor));
    expect(sends.map((x) => [x.kind, x.channel, x.scheduledFor])).toEqual([
      ["statement", "both", "2026-10-01"], ["reminder", "sms", "2026-10-13"], ["reminder", "sms", "2026-10-16"], ["reminder", "both", "2026-10-23"],
    ]);
    expect(getStatementByCode(s.code)?.id).toBe(s.id);
    expect(getStatementByCode("nope")).toBeNull();
  });

  it("is idempotent for the same period and carries the balance forward", () => {
    const a = seedAccountWithCharges();
    const s1 = issueStatement(a.id, "2026-09-30", { today: "2026-10-01" })!;
    expect(issueStatement(a.id, "2026-09-30", { today: "2026-10-01" })).toBeNull();
    expect(issueStatement(a.id, "2026-09-29", { today: "2026-10-01" })).toBeNull();
    // Next month: no activity, but the balance is still owed, so a statement goes out.
    const s2 = issueStatement(a.id, "2026-10-31", { today: "2026-11-01" })!;
    expect(s2).toMatchObject({ number: "ST-1002", periodStart: "2026-10-01", openingCents: 7000, chargesCents: 0, closingCents: 7000 });
    expect(listStatements(a.id).map((s) => s.id)).toEqual([s2.id, s1.id]);
  });

  it("does nothing for an account with no activity and no balance", () => {
    const a = createAccount({ name: "Quiet" }, "2026-09-01");
    getDb().prepare("UPDATE house_accounts SET created_at = '2026-09-01T12:00:00Z' WHERE id = ?").run(a.id);
    expect(issueStatement(a.id, "2026-09-30", { today: "2026-10-01" })).toBeNull();
    expect(listForAccount(a.id)).toEqual([]);
  });

  it("a payment made after the close but before the cron counts as settled", () => {
    const a = seedAccountWithCharges();
    backdate(recordPayment({ accountId: a.id, amountCents: 7000, method: "ach", actor: "m" }).entry!.id, "2026-10-01T11:00:00Z");
    const s = issueStatement(a.id, "2026-09-30", { today: "2026-10-01" })!;
    expect(s).toMatchObject({ closingCents: 7000, settledCents: 7000, status: "paid" });
    expect(listForAccount(a.id)).toEqual([]); // nothing to send for a paid statement
    expect(listEntries(a.id).filter((e) => !e.statementId)).toHaveLength(1); // the October payment stays unbilled
  });

  it("entries after the period end wait for the next statement", () => {
    const a = seedAccountWithCharges();
    seedOrder("o1003", a.id, 900, "2026-10-01T12:00:00Z");
    backdate(recordCharge({ accountId: a.id, orderId: "o1003", amountCents: 900, actor: "m" }).id, "2026-10-01T12:00:00Z");
    const s = issueStatement(a.id, "2026-09-30", { today: "2026-10-01" })!;
    expect(s.chargesCents).toBe(8000);
    expect(listEntries(a.id).filter((e) => !e.statementId).map((e) => e.amountCents)).toEqual([900]);
  });
});

describe("accountsDueToIssue", () => {
  it("picks active accounts on their issue day that have no statement for the period yet", () => {
    const a = createAccount({ name: "Monthly1", cadence: "monthly", issueDay: 1 }, "2026-09-01");
    const b = createAccount({ name: "Monthly5", cadence: "monthly", issueDay: 5 }, "2026-09-01");
    const c = createAccount({ name: "PausedMonthly1", cadence: "monthly", issueDay: 1 }, "2026-09-01");
    updateAccount(c.id, { status: "paused" });
    for (const id of [a.id, b.id, c.id]) getDb().prepare("UPDATE house_accounts SET created_at = '2026-09-01T12:00:00Z' WHERE id = ?").run(id);
    seedOrder("o1001", a.id, 100, "2026-09-10T12:00:00Z");
    backdate(recordCharge({ accountId: a.id, orderId: "o1001", amountCents: 100, actor: "m" }).id, "2026-09-10T12:00:00Z");
    expect(accountsDueToIssue("2026-10-01").map((x) => x.name)).toEqual(["Monthly1"]);
    issueStatement(a.id, "2026-09-30", { today: "2026-10-01" });
    expect(accountsDueToIssue("2026-10-01")).toEqual([]);
    expect(accountsDueToIssue("2026-10-05").map((x) => x.name)).toEqual(["Monthly5"]);
  });
});

describe("voidStatement", () => {
  it("returns entries to unbilled, cancels sends, and refuses paid or non-latest ones", () => {
    const a = seedAccountWithCharges();
    const s1 = issueStatement(a.id, "2026-09-30", { today: "2026-10-01" })!;
    const v = voidStatement(s1.id);
    expect(v.status).toBe("void");
    expect(listEntries(a.id).every((e) => !e.statementId)).toBe(true);
    expect(listForAccount(a.id).every((x) => x.status === "canceled")).toBe(true);
    // Re-issuing the same period is allowed after a void.
    const again = issueStatement(a.id, "2026-09-30", { today: "2026-10-02" })!;
    expect(again.number).toBe("ST-1002");
    const s3 = issueStatement(a.id, "2026-10-31", { today: "2026-11-01" })!;
    expect(() => voidStatement(again.id)).toThrow("not_latest");
    // Dated after s3's close so the settlement rule counts it (tests must not depend on the real clock).
    backdate(recordPayment({ accountId: a.id, amountCents: 7000, method: "cash", actor: "m" }).entry!.id, "2026-11-02T12:00:00Z");
    recomputeSettlement(a.id);
    expect(getStatement(s3.id)?.status).toBe("paid");
    expect(() => voidStatement(s3.id)).toThrow("statement_paid");
    expect(() => voidStatement("nope")).toThrow("statement_not_found");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- tests/unit/house-account-statements.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// lib/house-account-statements.ts
// A statement is an immutable snapshot of the account at a period close. It
// bills every entry not yet on a statement up to period_end; opening is the
// previous statement's closing, so closing is always the running balance.
import "server-only";
import { getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { addDaysStr, shopDateStr } from "@/lib/tv-slots";
import { generateCode } from "@/lib/short-code";
import { getAccount, newId, rowToAccount } from "@/lib/house-account-storage";
import { isIssueDay, scheduleFromPlan } from "@/lib/house-account-plan";
import { enqueue, cancelForStatement } from "@/lib/house-account-sends";
import { recomputeSettlement, entryDate } from "@/lib/house-account-settlement";
import type { HouseAccount, Statement, StatementLine, StatementStatus, EntryKind } from "@/types/house-account";

type Row = {
  id: string; account_id: string; number: string; code: string; period_start: string; period_end: string;
  issued_at: string; due_date: string; opening_cents: number; charges_cents: number; credits_cents: number;
  payments_cents: number; closing_cents: number; settled_cents: number; status: string; lines_json: string; created_at: string;
};
type EntryRow = { id: string; kind: string; amount_cents: number; order_id: string | null; method: string | null; note: string | null; created_at: string };

function rowToStatement(r: Row): Statement {
  return {
    id: r.id, accountId: r.account_id, number: r.number, code: r.code,
    periodStart: r.period_start, periodEnd: r.period_end, issuedAt: r.issued_at, dueDate: r.due_date,
    openingCents: r.opening_cents, chargesCents: r.charges_cents, creditsCents: r.credits_cents,
    paymentsCents: r.payments_cents, closingCents: r.closing_cents, settledCents: r.settled_cents,
    status: r.status as StatementStatus, lines: JSON.parse(r.lines_json) as StatementLine[], createdAt: r.created_at,
  };
}

export function getStatement(id: string): Statement | null {
  runMigrations();
  const row = getDb().prepare("SELECT * FROM house_account_statements WHERE id = ?").get(id) as Row | undefined;
  return row ? rowToStatement(row) : null;
}

export function getStatementByCode(code: string): Statement | null {
  runMigrations();
  const row = getDb().prepare("SELECT * FROM house_account_statements WHERE code = ?").get(code) as Row | undefined;
  return row ? rowToStatement(row) : null;
}

export function listStatements(accountId: string): Statement[] {
  runMigrations();
  const rows = getDb()
    .prepare("SELECT * FROM house_account_statements WHERE account_id = ? ORDER BY period_end DESC, created_at DESC")
    .all(accountId) as Row[];
  return rows.map(rowToStatement);
}

export function latestStatement(accountId: string): Statement | null {
  runMigrations();
  const row = getDb()
    .prepare("SELECT * FROM house_account_statements WHERE account_id = ? AND status != 'void' ORDER BY period_end DESC, created_at DESC LIMIT 1")
    .get(accountId) as Row | undefined;
  return row ? rowToStatement(row) : null;
}

function nextStatementNumber(): string {
  const db = getDb();
  db.prepare("UPDATE statement_number_seq SET last_value = last_value + 1").run();
  const row = db.prepare("SELECT last_value AS n FROM statement_number_seq").get() as { n: number } | undefined;
  if (!row) throw new Error("statement_number_seq row missing");
  return `ST-${row.n}`;
}

function uniqueCode(): string {
  const db = getDb();
  for (let i = 0; i < 5; i++) {
    const code = generateCode();
    if (!db.prepare("SELECT 1 FROM house_account_statements WHERE code = ?").get(code)) return code;
  }
  throw new Error("could not allocate a unique statement code");
}

const METHOD_LABEL: Record<string, string> = {
  cash: "Efectivo", zelle: "Zelle", ach: "ACH", check: "Cheque", "card-terminal": "Tarjeta", stripe: "Tarjeta (en línea)",
};

function buildLines(entries: EntryRow[]): StatementLine[] {
  const ids = entries.map((e) => e.order_id).filter((x): x is string => !!x);
  const orders = new Map<string, { order_number: number | null; recipient_name: string }>();
  if (ids.length) {
    const rows = getDb()
      .prepare(`SELECT id, order_number, recipient_name FROM orders WHERE id IN (${ids.map(() => "?").join(",")})`)
      .all(...ids) as { id: string; order_number: number | null; recipient_name: string }[];
    for (const r of rows) orders.set(r.id, r);
  }
  return entries.map((e) => {
    const o = e.order_id ? orders.get(e.order_id) : undefined;
    const num = o?.order_number != null ? `#${o.order_number}` : e.order_id ? `#${e.order_id.slice(-6)}` : "";
    let label: string;
    switch (e.kind as EntryKind) {
      case "charge": label = `Orden ${num}${o ? ` · ${o.recipient_name}` : ""}`; break;
      case "payment": label = `Pago${e.method ? ` · ${METHOD_LABEL[e.method] ?? e.method}` : ""}`; break;
      case "credit": label = `Crédito${e.note ? ` · ${e.note}` : ""}`; break;
      case "adjustment": label = `Ajuste${num ? ` ${num}` : ""}${e.note ? ` · ${e.note}` : ""}`; break;
      case "reversal": label = `Cancelación ${num}`; break;
    }
    return {
      date: entryDate(e.created_at),
      kind: e.kind as EntryKind,
      label,
      ...(e.order_id ? { orderId: e.order_id } : {}),
      ...(o?.order_number != null ? { orderNumber: o.order_number } : {}),
      amountCents: e.amount_cents,
    };
  });
}

/**
 * Close the account's period ending `periodEnd` (YYYY-MM-DD). Returns null when
 * there is nothing to bill (no unbilled entries and no balance carried) or when
 * a live statement already covers that period.
 */
export function issueStatement(accountId: string, periodEnd: string, opts: { today?: string } = {}): Statement | null {
  runMigrations();
  const account = getAccount(accountId);
  if (!account) throw new Error("account_not_found");
  const today = opts.today ?? shopDateStr(new Date());
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const prev = latestStatement(accountId);
    const periodStart = prev ? addDaysStr(prev.periodEnd, 1) : shopDateStr(new Date(account.createdAt));
    if (periodStart > periodEnd) { db.exec("COMMIT"); return null; }
    const unbilled = db.prepare(
      `SELECT id, kind, amount_cents, order_id, method, note, created_at FROM house_account_entries
       WHERE account_id = ? AND statement_id IS NULL ORDER BY created_at ASC, rowid ASC`,
    ).all(accountId) as EntryRow[];
    const entries = unbilled.filter((e) => entryDate(e.created_at) <= periodEnd);
    const opening = prev?.closingCents ?? 0;
    if (entries.length === 0 && opening <= 0) { db.exec("COMMIT"); return null; }

    let charges = 0, credits = 0, payments = 0;
    for (const e of entries) {
      if (e.amount_cents > 0) charges += e.amount_cents;
      else if (e.kind === "payment") payments += -e.amount_cents;
      else credits += -e.amount_cents;
    }
    const closing = opening + charges - credits - payments;
    const id = newId("hst");
    const now = new Date().toISOString();
    const dueDate = addDaysStr(today, account.termsDays);
    db.prepare(
      `INSERT INTO house_account_statements (id, account_id, number, code, period_start, period_end, issued_at, due_date,
         opening_cents, charges_cents, credits_cents, payments_cents, closing_cents, settled_cents, status, lines_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'open', ?, ?)`,
    ).run(id, accountId, nextStatementNumber(), uniqueCode(), periodStart, periodEnd, now, dueDate,
      opening, charges, credits, payments, closing, JSON.stringify(buildLines(entries)), now);
    if (entries.length) {
      db.prepare(`UPDATE house_account_entries SET statement_id = ? WHERE id IN (${entries.map(() => "?").join(",")})`)
        .run(id, ...entries.map((e) => e.id));
    }
    recomputeSettlement(accountId);
    const fresh = getStatement(id)!;
    if (fresh.status === "open") {
      enqueue(scheduleFromPlan({
        today, dueDate, statementChannel: account.statementChannel, reminderPlan: account.reminderPlan,
      }).map((p) => ({ accountId, statementId: id, ...p })));
    }
    db.exec("COMMIT");
    return fresh;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

/** Active accounts whose issue day is `today` and that have no live statement closing yesterday or later. */
export function accountsDueToIssue(today: string): HouseAccount[] {
  runMigrations();
  const db = getDb();
  const rows = db.prepare("SELECT * FROM house_accounts WHERE status = 'active' ORDER BY name").all() as Parameters<typeof rowToAccount>[0][];
  const yesterday = addDaysStr(today, -1);
  const has = db.prepare(
    "SELECT 1 FROM house_account_statements WHERE account_id = ? AND status != 'void' AND period_end >= ? LIMIT 1",
  );
  return rows.map(rowToAccount).filter((a) => isIssueDay(a, today) && !has.get(a.id, yesterday));
}

export function voidStatement(id: string): Statement {
  runMigrations();
  const s = getStatement(id);
  if (!s) throw new Error("statement_not_found");
  if (s.status === "void") return s;
  if (s.status === "paid") throw new Error("statement_paid");
  const latest = latestStatement(s.accountId);
  if (latest && latest.id !== s.id) throw new Error("not_latest");
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare("UPDATE house_account_entries SET statement_id = NULL WHERE statement_id = ?").run(id);
    db.prepare("UPDATE house_account_statements SET status = 'void' WHERE id = ?").run(id);
    cancelForStatement(id);
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
  return getStatement(id)!;
}
```

Note: `rowToAccount` must be exported from `lib/house-account-storage.ts` (Task 3 exports it).

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- tests/unit/house-account-statements.test.ts tests/unit/house-account-ledger.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/house-account-statements.ts tests/unit/house-account-statements.test.ts
git commit -m "feat(accounts): statement issue, void and lookups

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: Message templates (pure) and the public statement HTML

**Files:**
- Create: `lib/house-account-templates.ts`
- Create: `lib/house-statement-html.tsx`
- Modify: `types/house-account.ts` (`StatementLine` gains `recipientName?`, `method?`, `note?`)
- Modify: `lib/house-account-statements.ts` (`buildLines` fills those fields)
- Test: `tests/unit/house-account-templates.test.ts`, `tests/unit/house-statement-html.test.ts`

**Interfaces:**
- Consumes: `formatMoneyCents` (`lib/format.ts`), `formatDateOnly` (`lib/format-datetime.ts`), `SITE` (`data/site.ts`), `getLogoDataUri` (`lib/print-styles.ts`), `dueCents`, `entryDate` (Task 6).
- Produces (`lib/house-account-templates.ts`):
  ```ts
  export type StatementTemplate = "statement" | "reminder" | "overdue";
  export type TemplateVars = { number: string; amountCents: number; dueDate: string; link: string };
  export function renderSms(t: StatementTemplate, locale: "en" | "es", v: TemplateVars): string;
  export function emailSubject(locale: "en" | "es", number: string): string;
  export function statementUrl(code: string): string;                       // `${NEXT_PUBLIC_SITE_URL || shop}/s/<code>`
  export function pickTemplate(kind: SendKind, today: string, dueDate: string): StatementTemplate;
  ```
- Produces (`lib/house-statement-html.tsx`):
  ```ts
  export async function buildStatementHtml(statement: Statement, account: HouseAccount, opts: { today: string; justPaid?: boolean }): Promise<string>;
  export function notFoundPage(): string;    // small standalone HTML, Spanish
  export function voidPage(locale: "en" | "es"): string;
  ```

- [ ] **Step 1: Extend `StatementLine` and `buildLines`**

In `types/house-account.ts` replace the `StatementLine` type with:

```ts
export type StatementLine = {
  date: string; // YYYY-MM-DD shop time
  kind: EntryKind;
  label: string; // Spanish fallback built at issue time (admin tables)
  orderId?: string;
  orderNumber?: number;
  recipientName?: string;
  method?: AccountPaymentMethod;
  note?: string;
  amountCents: number; // signed
};
```

In `lib/house-account-statements.ts`, import `AccountPaymentMethod` from the types and make `buildLines` return, per entry:

```ts
    return {
      date: entryDate(e.created_at),
      kind: e.kind as EntryKind,
      label,
      ...(e.order_id ? { orderId: e.order_id } : {}),
      ...(o?.order_number != null ? { orderNumber: o.order_number } : {}),
      ...(o ? { recipientName: o.recipient_name } : {}),
      ...(e.method ? { method: e.method as AccountPaymentMethod } : {}),
      ...(e.note ? { note: e.note } : {}),
      amountCents: e.amount_cents,
    };
```

Run `npm test -- tests/unit/house-account-statements.test.ts` — still PASS (the test only checks kind/amount/orderNumber/label).

- [ ] **Step 2: Write the failing template tests**

```ts
// tests/unit/house-account-templates.test.ts
import { describe, it, expect, afterEach, vi } from "vitest";
import { renderSms, emailSubject, statementUrl, pickTemplate } from "@/lib/house-account-templates";

afterEach(() => vi.unstubAllEnvs());

const vars = { number: "ST-1001", amountCents: 7050, dueDate: "2026-10-16", link: "https://x.test/s/AbCdEfGh" };

describe("renderSms", () => {
  it("statement, both languages", () => {
    expect(renderSms("statement", "es", vars)).toBe("Diva Flowers: tu estado de cuenta ST-1001 por $70.50 vence el 16 oct 2026. Ver y pagar: https://x.test/s/AbCdEfGh");
    expect(renderSms("statement", "en", vars)).toBe("Diva Flowers: your statement ST-1001 for $70.50 is due Oct 16, 2026. View and pay: https://x.test/s/AbCdEfGh");
  });
  it("reminder and overdue", () => {
    expect(renderSms("reminder", "es", vars)).toContain("Recordatorio Diva Flowers: el estado ST-1001 por $70.50 vence el 16 oct 2026.");
    expect(renderSms("overdue", "en", vars)).toContain("statement ST-1001 for $70.50 was due Oct 16, 2026. Pay here:");
    expect(renderSms("overdue", "es", { ...vars, amountCents: 7000 })).toContain("por $70 venció el");
  });
  it("never carries an opt-out footer (transactional)", () => {
    expect(renderSms("reminder", "en", vars).toUpperCase()).not.toContain("STOP");
  });
});

describe("helpers", () => {
  it("subject", () => {
    expect(emailSubject("es", "ST-1001")).toBe("Estado de cuenta ST-1001 · Diva Flowers");
    expect(emailSubject("en", "ST-1001")).toBe("Statement ST-1001 · Diva Flowers");
  });
  it("statementUrl uses NEXT_PUBLIC_SITE_URL with a fallback", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://staging.test/");
    expect(statementUrl("AbCdEfGh")).toBe("https://staging.test/s/AbCdEfGh");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    expect(statementUrl("AbCdEfGh")).toBe("https://makythedivaflowers.com/s/AbCdEfGh");
  });
  it("pickTemplate", () => {
    expect(pickTemplate("statement", "2026-10-20", "2026-10-16")).toBe("statement");
    expect(pickTemplate("reminder", "2026-10-16", "2026-10-16")).toBe("reminder");
    expect(pickTemplate("reminder", "2026-10-17", "2026-10-16")).toBe("overdue");
    expect(pickTemplate("manual", "2026-10-01", "2026-10-16")).toBe("reminder");
    expect(pickTemplate("manual", "2026-11-01", "2026-10-16")).toBe("overdue");
  });
});
```

- [ ] **Step 3: Write the failing HTML tests**

```ts
// tests/unit/house-statement-html.test.ts
import { describe, it, expect } from "vitest";
import { buildStatementHtml, notFoundPage, voidPage } from "@/lib/house-statement-html";
import type { Statement, HouseAccount } from "@/types/house-account";

const account: HouseAccount = {
  id: "ha_1", name: "Hotel <b>Roslyn</b>", billingName: "Ana", billingPhone: "5165550100", billingEmail: "ap@hotel.com",
  locale: "es", cadence: "monthly", issueDay: 1, termsDays: 15, reminderPlan: [], statementChannel: "both",
  status: "active", createdAt: "2026-09-01T12:00:00Z", updatedAt: "2026-09-01T12:00:00Z",
};
const statement: Statement = {
  id: "hst_1", accountId: "ha_1", number: "ST-1001", code: "AbCdEfGh", periodStart: "2026-09-01", periodEnd: "2026-09-30",
  issuedAt: "2026-10-01T13:00:00Z", dueDate: "2026-10-16", openingCents: 0, chargesCents: 8000, creditsCents: 0,
  paymentsCents: 1000, closingCents: 7000, settledCents: 0, status: "open", createdAt: "2026-10-01T13:00:00Z",
  lines: [
    { date: "2026-09-10", kind: "charge", label: "Orden #1001 · Lobby", orderId: "o1", orderNumber: 1001, recipientName: "Lobby", amountCents: 5000 },
    { date: "2026-09-20", kind: "charge", label: "Orden #1002 · Suite 4", orderId: "o2", orderNumber: 1002, recipientName: "Suite 4", amountCents: 3000 },
    { date: "2026-09-25", kind: "payment", label: "Pago · Zelle", method: "zelle", amountCents: -1000 },
  ],
};

describe("buildStatementHtml", () => {
  it("renders an open statement with the pay form, escaped text and noindex", async () => {
    const html = await buildStatementHtml(statement, account, { today: "2026-10-02" });
    expect(html.toLowerCase()).toContain("<!doctype html>");
    expect(html).toContain('<meta name="robots" content="noindex">');
    expect(html).toContain("ST-1001");
    expect(html).toContain("Hotel &lt;b&gt;Roslyn&lt;/b&gt;");
    expect(html).not.toContain("<b>Roslyn</b>");
    expect(html).toContain('action="/s/AbCdEfGh/pay"');
    expect(html).toContain("Saldo pendiente");
    expect(html).toContain("Orden #1001 · Lobby");
    expect(html).toContain("Pago · Zelle");
    expect(html).toContain("$70");
    expect(html).toContain("window.print()");
  });
  it("stamps PAST DUE after the due date (English account)", async () => {
    const html = await buildStatementHtml(statement, { ...account, locale: "en" }, { today: "2026-10-20" });
    expect(html).toContain("Past due");
    expect(html).toContain("Order #1001 · Lobby");
  });
  it("paid: PAID stamp, settled line, no pay form", async () => {
    const html = await buildStatementHtml({ ...statement, status: "paid", settledCents: 7000 }, account, { today: "2026-10-05" });
    expect(html).toContain("Pagado");
    expect(html).not.toContain("/pay");
  });
  it("justPaid shows the updating note while still open", async () => {
    const html = await buildStatementHtml(statement, account, { today: "2026-10-05", justPaid: true });
    expect(html).toContain("Pago recibido");
  });
  it("standalone pages", () => {
    expect(notFoundPage()).toContain("No encontramos");
    expect(voidPage("en")).toContain("no longer valid");
  });
});
```

- [ ] **Step 4: Run both to verify failure**

Run: `npm test -- tests/unit/house-account-templates.test.ts tests/unit/house-statement-html.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 5: Implement the templates**

```ts
// lib/house-account-templates.ts
// Pure. SMS bodies and email subject for house-account statements. These are
// transactional (a bill the customer agreed to), so no opt-out footer — same
// as payment_link in lib/messaging-templates.ts.
import { formatMoneyCents } from "@/lib/format";
import { formatDateOnly } from "@/lib/format-datetime";
import type { SendKind } from "@/types/house-account";

export type StatementTemplate = "statement" | "reminder" | "overdue";
export type TemplateVars = { number: string; amountCents: number; dueDate: string; link: string };

type Locale = "en" | "es";
type Rendered = { number: string; amount: string; due: string; link: string };

const BODIES: Record<StatementTemplate, Record<Locale, (r: Rendered) => string>> = {
  statement: {
    es: (r) => `Diva Flowers: tu estado de cuenta ${r.number} por ${r.amount} vence el ${r.due}. Ver y pagar: ${r.link}`,
    en: (r) => `Diva Flowers: your statement ${r.number} for ${r.amount} is due ${r.due}. View and pay: ${r.link}`,
  },
  reminder: {
    es: (r) => `Recordatorio Diva Flowers: el estado ${r.number} por ${r.amount} vence el ${r.due}. ${r.link}`,
    en: (r) => `Reminder from Diva Flowers: statement ${r.number} for ${r.amount} is due ${r.due}. ${r.link}`,
  },
  overdue: {
    es: (r) => `Diva Flowers: el estado ${r.number} por ${r.amount} venció el ${r.due}. Paga aquí: ${r.link}`,
    en: (r) => `Diva Flowers: statement ${r.number} for ${r.amount} was due ${r.due}. Pay here: ${r.link}`,
  },
};

export function renderSms(t: StatementTemplate, locale: Locale, v: TemplateVars): string {
  return BODIES[t][locale]({
    number: v.number,
    amount: formatMoneyCents(v.amountCents, locale),
    due: formatDateOnly(v.dueDate, locale),
    link: v.link,
  });
}

export function emailSubject(locale: Locale, number: string): string {
  return locale === "es" ? `Estado de cuenta ${number} · Diva Flowers` : `Statement ${number} · Diva Flowers`;
}

export function statementUrl(code: string): string {
  // `||` (not `??`) so an empty env var still falls back to the shop domain.
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "https://makythedivaflowers.com").replace(/\/+$/, "");
  return `${base}/s/${code}`;
}

/** The statement send uses the statement text; anything else is a reminder until the due date passes. */
export function pickTemplate(kind: SendKind, today: string, dueDate: string): StatementTemplate {
  if (kind === "statement") return "statement";
  return today <= dueDate ? "reminder" : "overdue";
}
```

If `formatDateOnly("2026-10-16", "es")` does not produce exactly `16 oct 2026` on your Node ICU, adjust the two expected strings in the test to the actual output of `new Date("2026-10-16T00:00:00Z").toLocaleDateString("es-ES", { dateStyle: "medium", timeZone: "UTC" })` — the format comes from the existing helper and must not be changed here.

- [ ] **Step 6: Implement the statement HTML**

```tsx
// lib/house-statement-html.tsx
// Standalone, printable HTML for the public house-account statement (/s/<code>).
// Mirrors lib/invoice-html.tsx: Letter portrait, inline CSS, browser print = PDF.
import "server-only";
import React from "react";
import { SITE } from "@/data/site";
import { formatAddressLine, formatMoneyCents, formatPhoneUS } from "@/lib/format";
import { formatDateOnly } from "@/lib/format-datetime";
import { getLogoDataUri } from "@/lib/print-styles";
import { dueCents, entryDate } from "@/lib/house-account-settlement";
import type { HouseAccount, Statement, StatementLine, AccountPaymentMethod, EntryKind } from "@/types/house-account";

async function loadRenderToStaticMarkup() {
  const mod = await import("react-dom/server");
  return mod.renderToStaticMarkup;
}

type Locale = "en" | "es";
type Stamp = "open" | "overdue" | "paid" | "void";

type Strings = {
  title: string; number: string; period: string; issued: string; due: string; billTo: string;
  opening: string; charges: string; credits: string; payments: string; closing: string; settled: string; remaining: string;
  date: string; detail: string; amount: string; pay: string; justPaid: string; thanks: string; print: string;
  stamp: Record<Stamp, string>;
  kinds: Record<EntryKind, string>;
  methods: Record<AccountPaymentMethod, string>;
};

export const STATEMENT_STRINGS: Record<Locale, Strings> = {
  en: {
    title: "Statement", number: "Statement #", period: "Period", issued: "Issued", due: "Due date", billTo: "Bill to",
    opening: "Previous balance", charges: "Charges", credits: "Credits", payments: "Payments received", closing: "Balance",
    settled: "Paid / credited after issue", remaining: "Amount due",
    date: "Date", detail: "Detail", amount: "Amount", pay: "Pay now",
    justPaid: "Payment received — updating…", thanks: "Thank you for choosing Maky The Diva Flowers.", print: "Print / Save PDF",
    stamp: { open: "Balance due", overdue: "Past due", paid: "Paid", void: "Void" },
    kinds: { charge: "Order", payment: "Payment", credit: "Credit", adjustment: "Adjustment", reversal: "Cancellation" },
    methods: { cash: "Cash", zelle: "Zelle", ach: "ACH", check: "Check", "card-terminal": "Card", stripe: "Card (online)" },
  },
  es: {
    title: "Estado de cuenta", number: "Estado #", period: "Período", issued: "Emitido", due: "Vence", billTo: "Facturar a",
    opening: "Saldo anterior", charges: "Cargos", credits: "Créditos", payments: "Pagos recibidos", closing: "Saldo",
    settled: "Pagado / acreditado después de emitido", remaining: "Saldo a pagar",
    date: "Fecha", detail: "Detalle", amount: "Importe", pay: "Pagar ahora",
    justPaid: "Pago recibido, actualizando…", thanks: "Gracias por elegir Maky The Diva Flowers.", print: "Imprimir / Guardar PDF",
    stamp: { open: "Saldo pendiente", overdue: "Vencido", paid: "Pagado", void: "Anulado" },
    kinds: { charge: "Orden", payment: "Pago", credit: "Crédito", adjustment: "Ajuste", reversal: "Cancelación" },
    methods: { cash: "Efectivo", zelle: "Zelle", ach: "ACH", check: "Cheque", "card-terminal": "Tarjeta", stripe: "Tarjeta (en línea)" },
  },
};

const STYLES = `
*{box-sizing:border-box}
body{margin:0;background:#f4f1ec;color:#1d1a17;font:13px/1.45 -apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif}
.page{max-width:8.5in;margin:24px auto;background:#fff;padding:0.6in;box-shadow:0 1px 8px rgba(0,0,0,.08)}
.toolbar{max-width:8.5in;margin:16px auto 0;padding:0 16px;text-align:right}
.toolbar button{font:inherit;font-weight:600;padding:8px 16px;border-radius:8px;border:1px solid #1d1a17;background:#1d1a17;color:#fff;cursor:pointer}
header{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:flex-start;gap:24px;padding-bottom:20px;border-bottom:1px solid #e6e0d8}
header img{height:56px}
.shop{font-size:12px;color:#6b635b;margin-top:6px}
.meta{text-align:right;margin-left:auto}
.meta h1{margin:0 0 6px;font-size:24px;letter-spacing:.08em;text-transform:uppercase}
.meta dl{margin:0;display:grid;grid-template-columns:auto auto;gap:2px 12px;justify-content:end;font-size:12px}
.meta dt{color:#6b635b}.meta dd{margin:0;font-weight:600}
.stamp{display:inline-block;margin-top:10px;padding:4px 10px;border:2px solid;border-radius:6px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;font-size:12px}
.stamp.open{color:#a15c00}.stamp.overdue{color:#b42318}.stamp.paid{color:#1f7a4d}.stamp.void{color:#6b635b}
.parties{margin:20px 0}
.parties h2{margin:0 0 4px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#6b635b}
.parties p{margin:0}
table{width:100%;border-collapse:collapse}
.items th{text-align:left;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#6b635b;border-bottom:1px solid #e6e0d8;padding:6px 0}
.items td{padding:8px 0;border-bottom:1px solid #f0ebe4;vertical-align:top}
.items .num{text-align:right;white-space:nowrap;padding-left:12px}
.sums{width:55%;margin:16px 0 0 auto}
.sums td{padding:4px 0}.sums td:last-child{text-align:right;white-space:nowrap}
.sums .total td{border-top:1px solid #1d1a17;font-weight:700;font-size:15px;padding-top:8px}
.paybox{margin:24px 0 0;text-align:right}
.pay{font:inherit;font-weight:700;padding:12px 22px;border-radius:10px;border:0;background:#b42318;color:#fff;cursor:pointer;font-size:15px}
.note{margin:16px 0 0;padding:10px 12px;border-radius:8px;background:#eef7f0;color:#1f7a4d;font-weight:600}
footer{margin-top:36px;padding-top:16px;border-top:1px solid #e6e0d8;text-align:center;color:#6b635b;font-size:12px}
@media (max-width:640px){.page{margin:12px 0;padding:20px 16px}.sums{width:100%}}
@page{size:letter;margin:0.6in}
@media print{body{background:#fff}.toolbar,.paybox{display:none}.page{margin:0;padding:0;box-shadow:none;max-width:none}}
`;

function lineLabel(l: StatementLine, s: Strings): string {
  const num = l.orderNumber != null ? `#${l.orderNumber}` : l.orderId ? `#${l.orderId.slice(-6)}` : "";
  switch (l.kind) {
    case "charge": return [s.kinds.charge, num, l.recipientName ? `· ${l.recipientName}` : ""].filter(Boolean).join(" ");
    case "payment": return [s.kinds.payment, l.method ? `· ${s.methods[l.method]}` : ""].filter(Boolean).join(" ");
    case "credit": return [s.kinds.credit, l.note ? `· ${l.note}` : ""].filter(Boolean).join(" ");
    case "adjustment": return [s.kinds.adjustment, num, l.note ? `· ${l.note}` : ""].filter(Boolean).join(" ");
    case "reversal": return [s.kinds.reversal, num].filter(Boolean).join(" ");
  }
}

function stampFor(st: Statement, today: string): Stamp {
  if (st.status === "void") return "void";
  if (st.status === "paid") return "paid";
  return today > st.dueDate ? "overdue" : "open";
}

function Doc({ st, account, today, justPaid }: { st: Statement; account: HouseAccount; today: string; justPaid: boolean }) {
  const locale = account.locale;
  const s = STATEMENT_STRINGS[locale];
  const money = (c: number) => formatMoneyCents(c, locale);
  const site = SITE.url.replace(/^https?:\/\//, "");
  const stamp = stampFor(st, today);
  const due = dueCents(st);
  const canPay = st.status === "open" && due > 0;
  return (
    <>
      <div className="toolbar"><button type="button" data-print>{s.print}</button></div>
      <main className="page">
        <header>
          <div>
            <img src={getLogoDataUri()} alt={SITE.merchantName} />
            <div className="shop">
              <div><strong>{SITE.merchantName}</strong></div>
              <div>{formatAddressLine(SITE.address)}</div>
              <div>{SITE.phone} · {SITE.email}</div>
              <div>{site}</div>
            </div>
          </div>
          <div className="meta">
            <h1>{s.title}</h1>
            <dl>
              <dt>{s.number}</dt><dd>{st.number}</dd>
              <dt>{s.period}</dt><dd>{formatDateOnly(st.periodStart, locale)} – {formatDateOnly(st.periodEnd, locale)}</dd>
              <dt>{s.issued}</dt><dd>{formatDateOnly(entryDate(st.issuedAt), locale)}</dd>
              <dt>{s.due}</dt><dd>{formatDateOnly(st.dueDate, locale)}</dd>
            </dl>
            <div className={`stamp ${stamp}`}>{s.stamp[stamp]}</div>
          </div>
        </header>

        <section className="parties">
          <h2>{s.billTo}</h2>
          <p><strong>{account.name}</strong></p>
          {account.billingName ? <p>{account.billingName}</p> : null}
          {account.billingPhone ? <p>{formatPhoneUS(account.billingPhone)}</p> : null}
          {account.billingEmail ? <p>{account.billingEmail}</p> : null}
        </section>

        <table className="sums">
          <tbody>
            <tr><td>{s.opening}</td><td>{money(st.openingCents)}</td></tr>
            <tr><td>{s.charges}</td><td>{money(st.chargesCents)}</td></tr>
            {st.creditsCents > 0 ? <tr><td>{s.credits}</td><td>−{money(st.creditsCents)}</td></tr> : null}
            <tr><td>{s.payments}</td><td>−{money(st.paymentsCents)}</td></tr>
            <tr className="total"><td>{s.closing}</td><td>{money(st.closingCents)}</td></tr>
            {st.settledCents > 0 ? (
              <>
                <tr><td>{s.settled}</td><td>−{money(st.settledCents)}</td></tr>
                <tr className="total"><td>{s.remaining}</td><td>{money(due)}</td></tr>
              </>
            ) : null}
          </tbody>
        </table>

        {st.lines.length > 0 ? (
          <table className="items" style={{ marginTop: 24 }}>
            <thead><tr><th>{s.date}</th><th>{s.detail}</th><th className="num">{s.amount}</th></tr></thead>
            <tbody>
              {st.lines.map((l, i) => (
                <tr key={i}>
                  <td>{formatDateOnly(l.date, locale)}</td>
                  <td>{lineLabel(l, s)}</td>
                  <td className="num">{l.amountCents < 0 ? "−" : ""}{money(Math.abs(l.amountCents))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}

        {justPaid && st.status === "open" ? <p className="note">{s.justPaid}</p> : null}
        {canPay ? (
          <form className="paybox" method="post" action={`/s/${st.code}/pay`}>
            <button type="submit" className="pay">{s.pay} · {money(due)}</button>
          </form>
        ) : null}

        <footer>{s.thanks} · {site}</footer>
      </main>
    </>
  );
}

function shell(lang: string, title: string, body: string, extraHead = ""): string {
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${title}</title>
${extraHead}
</head>
<body>${body}</body>
</html>`;
}

export async function buildStatementHtml(
  statement: Statement,
  account: HouseAccount,
  opts: { today: string; justPaid?: boolean },
): Promise<string> {
  const renderToStaticMarkup = await loadRenderToStaticMarkup();
  const body = renderToStaticMarkup(<Doc st={statement} account={account} today={opts.today} justPaid={!!opts.justPaid} />);
  // statement.number is "ST-" + digits — safe to interpolate into <title>.
  return shell(
    account.locale,
    `${statement.number} · ${SITE.merchantName}`,
    `${body}
<script>document.querySelector("[data-print]").addEventListener("click", function () { window.print(); });</script>`,
    `<style>${STYLES}</style>`,
  );
}

const SIMPLE = `body{margin:0;background:#f4f1ec;color:#1d1a17;font:15px/1.5 -apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif}
main{max-width:480px;margin:15vh auto;background:#fff;padding:32px;border-radius:12px;text-align:center}h1{font-size:20px;margin:0 0 8px}p{margin:0;color:#6b635b}`;

export function notFoundPage(): string {
  return shell("es", "Diva Flowers",
    `<main><h1>No encontramos este estado de cuenta</h1><p>Revisa que el enlace esté completo o escríbenos al ${SITE.phoneDisplay}.</p></main>`,
    `<style>${SIMPLE}</style>`);
}

export function voidPage(locale: Locale): string {
  const es = locale === "es";
  return shell(locale, "Diva Flowers",
    `<main><h1>${es ? "Este estado de cuenta fue anulado" : "This statement is no longer valid"}</h1><p>${es ? "Te enviaremos uno nuevo. Dudas: " : "A new one is on its way. Questions: "}${SITE.phoneDisplay}.</p></main>`,
    `<style>${SIMPLE}</style>`);
}
```

- [ ] **Step 7: Run to verify pass**

Run: `npm test -- tests/unit/house-account-templates.test.ts tests/unit/house-statement-html.test.ts tests/unit/house-account-statements.test.ts && npx tsc --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 8: Commit**

```bash
git add lib/house-account-templates.ts lib/house-statement-html.tsx types/house-account.ts lib/house-account-statements.ts tests/unit/house-account-templates.test.ts tests/unit/house-statement-html.test.ts
git commit -m "feat(accounts): SMS/email templates and the public statement document

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9: Sender (one queue row → SMS and/or email)

**Files:**
- Create: `lib/house-account-sender.ts`
- Test: `tests/unit/house-account-sender.test.ts`

**Interfaces:**
- Consumes: `sendSms` (`lib/twilio-server.ts`), `twilioSmsEnabled`, `twilioDryRun` (`lib/twilio-config.ts`), `Resend` (package `resend`, v6: option is `replyTo`), `getByPhoneUS`, `getAccount`, `getStatement`, `claim`/`markSent`/`markFailed`/`markSkipped`/`getSend`, `dueCents`, Task 8 templates + HTML, `SITE`.
- Produces:
  ```ts
  export type SendOutcome = { status: "sent" | "skipped" | "failed"; smsSid?: string; emailId?: string; body?: string; error?: string };
  export function resolveChannels(account: HouseAccount, requested: SendChannel): { sms: boolean; email: boolean; reasons: string[] };
  export async function sendStep(row: ScheduledSend, today: string): Promise<SendOutcome>;
  export async function dispatchSend(row: ScheduledSend, today: string): Promise<ScheduledSend>;   // claim → sendStep → mark*
  ```

- [ ] **Step 1: Write the failing tests**

```ts
// tests/unit/house-account-sender.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { createAccount } from "@/lib/house-account-storage";
import { enqueue, getSend } from "@/lib/house-account-sends";

const sendSms = vi.fn();
vi.mock("@/lib/twilio-server", () => ({ sendSms: (...a: unknown[]) => sendSms(...a) }));
const twilio = { enabled: true, dry: false };
vi.mock("@/lib/twilio-config", () => ({ twilioSmsEnabled: () => twilio.enabled, twilioDryRun: () => twilio.dry }));
const emailSend = vi.fn();
vi.mock("resend", () => ({ Resend: class { emails = { send: (...a: unknown[]) => emailSend(...a) }; } }));

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("RESEND_API_KEY", "re_test");
  vi.stubEnv("ORDER_NOTIFICATIONS_FROM", "Diva <studio@divaflowers.com>");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://x.test");
  sendSms.mockReset(); sendSms.mockResolvedValue({ sid: "SM1" });
  emailSend.mockReset(); emailSend.mockResolvedValue({ data: { id: "em_1" }, error: null });
  twilio.enabled = true; twilio.dry = false;
  runMigrations();
});
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

function seedStatement(accountId: string, id = "s1", dueDate = "2026-10-16", status = "open") {
  getDb().prepare(
    `INSERT INTO house_account_statements (id, account_id, number, code, period_start, period_end, issued_at, due_date,
       opening_cents, charges_cents, credits_cents, payments_cents, closing_cents, settled_cents, status, lines_json, created_at)
     VALUES (?, ?, 'ST-1001', 'AbCdEfGh', '2026-09-01', '2026-09-30', '2026-10-01T13:00:00Z', ?, 0, 7000, 0, 0, 7000, 0, ?, '[]', '2026-10-01T13:00:00Z')`,
  ).run(id, accountId, dueDate, status);
}
function seedCustomer(phone: string, channel = "sms") {
  getDb().prepare("INSERT INTO customers (id, name, phone, order_count, first_seen_at, last_seen_at, messaging_channel) VALUES ('cus_1', 'Ana', ?, 0, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', ?)").run(phone, channel);
}
async function load() { return import("@/lib/house-account-sender"); }

describe("sendStep", () => {
  it("sends SMS and email for 'both' and records ids", async () => {
    const a = createAccount({ name: "Org", billingPhone: "5165550100", billingEmail: "ap@org.com", locale: "es" });
    seedStatement(a.id);
    const [row] = enqueue([{ accountId: a.id, statementId: "s1", kind: "statement", channel: "both", scheduledFor: "2026-10-01" }]);
    const { sendStep } = await load();
    const out = await sendStep(row, "2026-10-01");
    expect(out.status).toBe("sent");
    expect(out.smsSid).toBe("SM1");
    expect(out.emailId).toBe("em_1");
    expect(out.body).toContain("estado de cuenta ST-1001 por $70");
    expect(out.body).toContain("https://x.test/s/AbCdEfGh");
    expect(sendSms).toHaveBeenCalledWith("5165550100", out.body);
    const [emailArgs] = emailSend.mock.calls[0] as [{ to: string; subject: string; html: string; replyTo: string }];
    expect(emailArgs.to).toBe("ap@org.com");
    expect(emailArgs.subject).toBe("Estado de cuenta ST-1001 · Diva Flowers");
    expect(emailArgs.html).toContain("ST-1001");
    expect(emailArgs.replyTo).toBe("studio@divaflowers.com");
  });
  it("skips when neither channel is available, naming the reasons", async () => {
    const a = createAccount({ name: "Org" });
    seedStatement(a.id);
    const [row] = enqueue([{ accountId: a.id, statementId: "s1", kind: "statement", channel: "both", scheduledFor: "2026-10-01" }]);
    const { sendStep } = await load();
    expect(await sendStep(row, "2026-10-01")).toEqual({ status: "skipped", error: "sin teléfono, sin email" });
    expect(sendSms).not.toHaveBeenCalled();
  });
  it("respects an SMS opt-out but still emails; notes the skip", async () => {
    seedCustomer("5165550100", "none");
    const a = createAccount({ name: "Org", billingPhone: "5165550100", billingEmail: "ap@org.com" });
    seedStatement(a.id);
    const [row] = enqueue([{ accountId: a.id, statementId: "s1", kind: "reminder", stepIndex: 0, channel: "both", scheduledFor: "2026-10-13" }]);
    const { sendStep } = await load();
    const out = await sendStep(row, "2026-10-13");
    expect(out.status).toBe("sent");
    expect(out.smsSid).toBeUndefined();
    expect(out.emailId).toBe("em_1");
    expect(out.error).toBe("opt-out SMS");
    expect(sendSms).not.toHaveBeenCalled();
  });
  it("email requested but not configured → skipped", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    const a = createAccount({ name: "Org", billingEmail: "ap@org.com" });
    seedStatement(a.id);
    const [row] = enqueue([{ accountId: a.id, statementId: "s1", kind: "statement", channel: "email", scheduledFor: "2026-10-01" }]);
    const { sendStep } = await load();
    expect(await sendStep(row, "2026-10-01")).toEqual({ status: "skipped", error: "email no configurado" });
  });
  it("dry run records a fake sid and does not call Twilio", async () => {
    twilio.dry = true;
    const a = createAccount({ name: "Org", billingPhone: "5165550100" });
    seedStatement(a.id);
    const [row] = enqueue([{ accountId: a.id, statementId: "s1", kind: "statement", channel: "sms", scheduledFor: "2026-10-01" }]);
    const { sendStep } = await load();
    const out = await sendStep(row, "2026-10-01");
    expect(out).toMatchObject({ status: "sent", smsSid: "dry-run" });
    expect(sendSms).not.toHaveBeenCalled();
  });
  it("uses the overdue text after the due date and the reminder text before", async () => {
    const a = createAccount({ name: "Org", billingPhone: "5165550100", locale: "en" });
    seedStatement(a.id);
    const [before, after] = enqueue([
      { accountId: a.id, statementId: "s1", kind: "reminder", stepIndex: 0, channel: "sms", scheduledFor: "2026-10-13" },
      { accountId: a.id, statementId: "s1", kind: "reminder", stepIndex: 2, channel: "sms", scheduledFor: "2026-10-23" },
    ]);
    const { sendStep } = await load();
    expect((await sendStep(before, "2026-10-13")).body).toContain("is due");
    expect((await sendStep(after, "2026-10-23")).body).toContain("was due");
  });
  it("a Twilio failure on the only channel → failed with the message", async () => {
    sendSms.mockRejectedValueOnce(new Error("21610 blocked"));
    const a = createAccount({ name: "Org", billingPhone: "5165550100" });
    seedStatement(a.id);
    const [row] = enqueue([{ accountId: a.id, statementId: "s1", kind: "statement", channel: "sms", scheduledFor: "2026-10-01" }]);
    const { sendStep } = await load();
    expect(await sendStep(row, "2026-10-01")).toEqual({ status: "failed", error: "sms: 21610 blocked" });
  });
});

describe("dispatchSend", () => {
  it("claims, sends, marks; a second dispatch is a no-op", async () => {
    const a = createAccount({ name: "Org", billingPhone: "5165550100" });
    seedStatement(a.id);
    const [row] = enqueue([{ accountId: a.id, statementId: "s1", kind: "statement", channel: "sms", scheduledFor: "2026-10-01" }]);
    const { dispatchSend } = await load();
    const done = await dispatchSend(row, "2026-10-01");
    expect(done.status).toBe("sent");
    expect(done.smsSid).toBe("SM1");
    expect(done.body).toContain("ST-1001");
    await dispatchSend(row, "2026-10-01");
    expect(sendSms).toHaveBeenCalledTimes(1);
    expect(getSend(row.id)?.status).toBe("sent");
  });
  it("marks skipped and failed outcomes", async () => {
    const a = createAccount({ name: "Org" });
    seedStatement(a.id);
    const [row] = enqueue([{ accountId: a.id, statementId: "s1", kind: "statement", channel: "sms", scheduledFor: "2026-10-01" }]);
    const { dispatchSend } = await load();
    expect((await dispatchSend(row, "2026-10-01"))).toMatchObject({ status: "skipped", error: "sin teléfono" });
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- tests/unit/house-account-sender.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// lib/house-account-sender.ts
// Sends one queue row. Resolves which channels are actually usable (phone on
// file and not opted out; email on file and Resend configured), renders the
// right template, sends, and reports an outcome the queue can record.
import "server-only";
import { Resend } from "resend";
import { SITE } from "@/data/site";
import { sendSms } from "@/lib/twilio-server";
import { twilioSmsEnabled, twilioDryRun } from "@/lib/twilio-config";
import { getByPhoneUS } from "@/lib/customer-storage";
import { getAccount } from "@/lib/house-account-storage";
import { getStatement } from "@/lib/house-account-statements";
import { claim, getSend, markSent, markFailed, markSkipped } from "@/lib/house-account-sends";
import { dueCents } from "@/lib/house-account-settlement";
import { renderSms, emailSubject, statementUrl, pickTemplate } from "@/lib/house-account-templates";
import { buildStatementHtml } from "@/lib/house-statement-html";
import type { HouseAccount, ScheduledSend, SendChannel } from "@/types/house-account";

export type SendOutcome = {
  status: "sent" | "skipped" | "failed";
  smsSid?: string;
  emailId?: string;
  body?: string;
  error?: string;
};

function emailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY && !!process.env.ORDER_NOTIFICATIONS_FROM;
}

export function resolveChannels(account: HouseAccount, requested: SendChannel): { sms: boolean; email: boolean; reasons: string[] } {
  const reasons: string[] = [];
  let sms = false;
  let email = false;
  if (requested !== "email") {
    if (!account.billingPhone) reasons.push("sin teléfono");
    else if (getByPhoneUS(account.billingPhone)?.messagingChannel === "none") reasons.push("opt-out SMS");
    else sms = true;
  }
  if (requested !== "sms") {
    if (!account.billingEmail) reasons.push("sin email");
    else if (!emailConfigured()) reasons.push("email no configurado");
    else email = true;
  }
  return { sms, email, reasons };
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export async function sendStep(row: ScheduledSend, today: string): Promise<SendOutcome> {
  const account = getAccount(row.accountId);
  const statement = getStatement(row.statementId);
  if (!account || !statement) return { status: "failed", error: "cuenta o estado inexistente" };
  const ch = resolveChannels(account, row.channel);
  if (!ch.sms && !ch.email) return { status: "skipped", error: ch.reasons.join(", ") };

  const template = pickTemplate(row.kind, today, statement.dueDate);
  const vars = { number: statement.number, amountCents: dueCents(statement), dueDate: statement.dueDate, link: statementUrl(statement.code) };
  const problems: string[] = [...ch.reasons];
  let smsSid: string | undefined;
  let emailId: string | undefined;
  let body: string | undefined;

  if (ch.sms) {
    body = renderSms(template, account.locale, vars);
    try {
      const dry = twilioDryRun() || !twilioSmsEnabled();
      smsSid = dry ? "dry-run" : (await sendSms(account.billingPhone!, body)).sid;
    } catch (e) {
      problems.push(`sms: ${errMsg(e)}`);
    }
  }
  if (ch.email) {
    try {
      const html = await buildStatementHtml(statement, account, { today });
      const resend = new Resend(process.env.RESEND_API_KEY!);
      const result = await resend.emails.send({
        from: process.env.ORDER_NOTIFICATIONS_FROM!,
        to: account.billingEmail!,
        replyTo: SITE.email,
        subject: emailSubject(account.locale, statement.number),
        html,
      });
      if (result.error) throw new Error(result.error.message ?? String(result.error));
      emailId = result.data?.id ?? "sent";
    } catch (e) {
      problems.push(`email: ${errMsg(e)}`);
    }
  }
  if (!smsSid && !emailId) return { status: "failed", error: problems.join("; ") };
  return { status: "sent", smsSid, emailId, body, ...(problems.length ? { error: problems.join("; ") } : {}) };
}

/** Claim the row, send it, record the outcome. Returns the row as stored afterwards. */
export async function dispatchSend(row: ScheduledSend, today: string): Promise<ScheduledSend> {
  if (!claim(row.id)) return getSend(row.id) ?? row;
  let out: SendOutcome;
  try {
    out = await sendStep(row, today);
  } catch (e) {
    out = { status: "failed", error: errMsg(e) };
  }
  if (out.status === "sent") markSent(row.id, { smsSid: out.smsSid, emailId: out.emailId, body: out.body, error: out.error });
  else if (out.status === "skipped") markSkipped(row.id, out.error ?? "");
  else markFailed(row.id, out.error ?? "error");
  return getSend(row.id) ?? row;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- tests/unit/house-account-sender.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/house-account-sender.ts tests/unit/house-account-sender.test.ts
git commit -m "feat(accounts): statement sender (SMS + email) with channel resolution

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 10: Cron route `POST /api/cron/house-accounts`

**Files:**
- Create: `app/api/cron/house-accounts/route.ts`
- Test: `tests/unit/api-cron-house-accounts.test.ts`

**Interfaces:**
- Consumes: `accountsDueToIssue`, `issueStatement` (Task 7); `dueSends`, `failStaleSending` (Task 5); `dispatchSend` (Task 9); `shopDateStr`, `addDaysStr`.
- Produces: `POST` → `{ ok: true, today, issued, sent, skipped, failed }`; 503 when `CRON_SECRET` unset; 401 on a wrong bearer.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/unit/api-cron-house-accounts.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { createAccount } from "@/lib/house-account-storage";
import { recordCharge } from "@/lib/house-account-ledger";
import { listStatements } from "@/lib/house-account-statements";
import { listForAccount, enqueue, claim } from "@/lib/house-account-sends";

const sendSms = vi.fn();
vi.mock("@/lib/twilio-server", () => ({ sendSms: (...a: unknown[]) => sendSms(...a) }));
vi.mock("@/lib/twilio-config", () => ({ twilioSmsEnabled: () => true, twilioDryRun: () => false }));
vi.mock("resend", () => ({ Resend: class { emails = { send: async () => ({ data: { id: "em" }, error: null }) }; } }));

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("CRON_SECRET", "s3cret");
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-01T14:00:00Z")); // 10:00 New York, the 1st
  sendSms.mockReset(); sendSms.mockResolvedValue({ sid: "SM1" });
  runMigrations();
});
afterEach(() => { closeDb(); vi.useRealTimers(); vi.unstubAllEnvs(); });

function seedOrder(id: string, accountId: string, total: number, createdAt: string) {
  getDb().prepare(
    `INSERT INTO orders (id, locale, source, recipient_name, recipient_phone, contact_phone, fulfillment_method, window_date,
       lines_json, subtotal_cents, delivery_cents, tax_cents, total_cents, amount_paid_cents, fulfillment_status,
       payment_status, payment_method, house_account_id, order_number, created_at, updated_at)
     VALUES (?, 'es', 'phone', 'Dest', '555', '5165550100', 'delivery', '2026-10-01', '[]', ?, 0, 0, ?, 0, 'pending',
       'pending', 'house-account', ?, 1001, ?, ?)`,
  ).run(id, total, total, accountId, createdAt, createdAt);
}
function monthlyAccountWithCharge(name: string, phone = "5165550100") {
  const a = createAccount({ name, billingPhone: phone, cadence: "monthly", issueDay: 1, termsDays: 15, statementChannel: "sms" }, "2026-09-01");
  getDb().prepare("UPDATE house_accounts SET created_at = '2026-09-01T12:00:00Z' WHERE id = ?").run(a.id);
  seedOrder(`o_${name}`, a.id, 5000, "2026-09-10T12:00:00Z");
  const e = recordCharge({ accountId: a.id, orderId: `o_${name}`, amountCents: 5000, actor: "m" });
  getDb().prepare("UPDATE house_account_entries SET created_at = '2026-09-10T12:00:00Z' WHERE id = ?").run(e.id);
  return a;
}
async function post(auth?: string) {
  const { POST } = await import("@/app/api/cron/house-accounts/route");
  return POST(new Request("http://t", { method: "POST", headers: auth ? { authorization: auth } : {} }));
}

describe("POST /api/cron/house-accounts", () => {
  it("503 without CRON_SECRET, 401 with a bad bearer", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await post("Bearer x")).status).toBe(503);
    vi.stubEnv("CRON_SECRET", "s3cret");
    expect((await post()).status).toBe(401);
    expect((await post("Bearer wrong")).status).toBe(401);
  });

  it("issues statements due today and sends what is due, once", async () => {
    const a = monthlyAccountWithCharge("A");
    const res = await post("Bearer s3cret");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, today: "2026-10-01", issued: 1, sent: 1, failed: 0, skipped: 0 });
    const [st] = listStatements(a.id);
    expect(st).toMatchObject({ periodEnd: "2026-09-30", closingCents: 5000, dueDate: "2026-10-16", status: "open" });
    expect(sendSms).toHaveBeenCalledTimes(1);
    expect(sendSms.mock.calls[0][1]).toContain(st.number);
    const again = await (await post("Bearer s3cret")).json();
    expect(again).toMatchObject({ issued: 0, sent: 0 });
    expect(sendSms).toHaveBeenCalledTimes(1);
    expect(listForAccount(a.id).filter((s) => s.status === "sent")).toHaveLength(1);
  });

  it("one failing number does not stop the batch", async () => {
    monthlyAccountWithCharge("A", "5165550100");
    monthlyAccountWithCharge("B", "5165550200");
    sendSms.mockRejectedValueOnce(new Error("bad number"));
    const data = await (await post("Bearer s3cret")).json();
    expect(data).toMatchObject({ issued: 2, sent: 1, failed: 1 });
  });

  it("turns a stale 'sending' row into failed", async () => {
    const a = monthlyAccountWithCharge("A");
    await post("Bearer s3cret");
    const [st] = listStatements(a.id);
    const [stale] = enqueue([{ accountId: a.id, statementId: st.id, kind: "manual", channel: "sms", scheduledFor: "2026-10-01" }]);
    claim(stale.id);
    getDb().prepare("UPDATE house_account_sends SET claimed_at = '2026-10-01T10:00:00Z' WHERE id = ?").run(stale.id);
    await post("Bearer s3cret");
    const row = listForAccount(a.id).find((s) => s.id === stale.id)!;
    expect(row).toMatchObject({ status: "failed", error: "interrumpido" });
  });

  it("quiet day", async () => {
    expect(await (await post("Bearer s3cret")).json()).toMatchObject({ issued: 0, sent: 0, failed: 0, skipped: 0 });
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- tests/unit/api-cron-house-accounts.test.ts`
Expected: FAIL — route module not found.

- [ ] **Step 3: Implement**

```ts
// app/api/cron/house-accounts/route.ts
import { NextResponse } from "next/server";
import { shopDateStr, addDaysStr } from "@/lib/tv-slots";
import { accountsDueToIssue, issueStatement } from "@/lib/house-account-statements";
import { dueSends, failStaleSending } from "@/lib/house-account-sends";
import { dispatchSend } from "@/lib/house-account-sender";

export const runtime = "nodejs";
// Never cached: depends on today's date and on what has already gone out.
export const dynamic = "force-dynamic";

const STALE_SENDING_MS = 60 * 60 * 1000;

/**
 * Daily house-account job (see docs/ops/house-accounts.md): closes the period
 * for every account whose issue day is today, then sends every queued
 * statement / reminder that is due. Driven by an external cron, like
 * /api/cron/reminders. Safe to run more than once a day: issuing is unique
 * per period and every send row is claimed before it goes out.
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[house-accounts] CRON_SECRET is not set; refusing to run");
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }
  const provided = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (provided !== secret) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const today = shopDateStr(new Date());
  failStaleSending(new Date(Date.now() - STALE_SENDING_MS).toISOString());

  let issued = 0;
  for (const account of accountsDueToIssue(today)) {
    try {
      if (issueStatement(account.id, addDaysStr(today, -1), { today })) issued += 1;
    } catch (e) {
      console.error("[house-accounts] issue failed", account.id, e);
    }
  }

  let sent = 0, skipped = 0, failed = 0;
  for (const row of dueSends(today)) {
    const done = await dispatchSend(row, today);
    if (done.status === "sent") sent += 1;
    else if (done.status === "skipped") skipped += 1;
    else if (done.status === "failed") failed += 1;
  }

  console.log(JSON.stringify({ event: "house_accounts_run", today, issued, sent, skipped, failed }));
  return NextResponse.json({ ok: true, today, issued, sent, skipped, failed });
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- tests/unit/api-cron-house-accounts.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/cron/house-accounts/route.ts tests/unit/api-cron-house-accounts.test.ts
git commit -m "feat(accounts): daily cron route issues statements and dispatches the queue

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 11: Public statement page `GET /s/[code]` and the proxy matcher

**Files:**
- Create: `app/s/[code]/route.ts`
- Modify: `proxy.ts:58-61` (matcher excludes `s/`)
- Test: `tests/unit/api-public-statement.test.ts`

**Interfaces:**
- Consumes: `CODE_PATTERN` (Task 1), `getStatementByCode` (Task 7), `getAccount` (Task 3), `buildStatementHtml`, `notFoundPage`, `voidPage` (Task 8), `shopDateStr`.
- Produces: `GET /s/<code>` → 200 HTML (`cache-control: no-store`, `x-robots-tag: noindex`), 404 unknown, 410 void. `?paid=1` shows the "updating" note while still open.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/unit/api-public-statement.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { createAccount } from "@/lib/house-account-storage";
import { GET } from "@/app/s/[code]/route";

beforeEach(() => { vi.stubEnv("SQLITE_FILE", ":memory:"); runMigrations(); });
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

function seedStatement(accountId: string, status = "open", settled = 0) {
  getDb().prepare(
    `INSERT INTO house_account_statements (id, account_id, number, code, period_start, period_end, issued_at, due_date,
       opening_cents, charges_cents, credits_cents, payments_cents, closing_cents, settled_cents, status, lines_json, created_at)
     VALUES ('hst_1', ?, 'ST-1001', 'AbCdEfGh', '2026-09-01', '2026-09-30', '2026-10-01T13:00:00Z', '2026-10-16', 0, 7000, 0, 0, 7000, ?, ?, '[]', '2026-10-01T13:00:00Z')`,
  ).run(accountId, settled, status);
}
const get = (code: string, qs = "") => GET(new Request(`http://x/s/${code}${qs}`), { params: Promise.resolve({ code }) });

describe("GET /s/[code]", () => {
  it("404 for a bad or unknown code", async () => {
    expect((await get("nope")).status).toBe(404);
    expect((await get("AbCdEfGh")).status).toBe(404);
  });
  it("200 with the document, no-store and noindex", async () => {
    const a = createAccount({ name: "Hotel", locale: "es" });
    seedStatement(a.id);
    const res = await get("AbCdEfGh");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("x-robots-tag")).toBe("noindex");
    const html = await res.text();
    expect(html).toContain("ST-1001");
    expect(html).toContain('action="/s/AbCdEfGh/pay"');
  });
  it("paid shows no pay form; ?paid=1 on an open one shows the note", async () => {
    const a = createAccount({ name: "Hotel" });
    seedStatement(a.id, "paid", 7000);
    expect(await (await get("AbCdEfGh")).text()).not.toContain("/pay");
    closeDb(); runMigrations();
    const b = createAccount({ name: "Hotel" });
    seedStatement(b.id);
    expect(await (await get("AbCdEfGh", "?paid=1")).text()).toContain("Payment received");
  });
  it("410 for a void statement", async () => {
    const a = createAccount({ name: "Hotel", locale: "en" });
    seedStatement(a.id, "void");
    const res = await get("AbCdEfGh");
    expect(res.status).toBe(410);
    expect(await res.text()).toContain("no longer valid");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- tests/unit/api-public-statement.test.ts`
Expected: FAIL — route module not found.

- [ ] **Step 3: Implement the route**

```ts
// app/s/[code]/route.ts
// Public, unguessable-code statement page. Outside the locale tree and
// excluded from the proxy matcher, like /c/[code].
import { CODE_PATTERN } from "@/lib/short-code";
import { getStatementByCode } from "@/lib/house-account-statements";
import { getAccount } from "@/lib/house-account-storage";
import { buildStatementHtml, notFoundPage, voidPage } from "@/lib/house-statement-html";
import { shopDateStr } from "@/lib/tv-slots";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function html(body: string, status: number): Response {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-robots-tag": "noindex",
    },
  });
}

export async function GET(req: Request, ctx: { params: Promise<{ code: string }> }): Promise<Response> {
  const { code } = await ctx.params;
  const statement = CODE_PATTERN.test(code) ? getStatementByCode(code) : null;
  if (!statement) return html(notFoundPage(), 404);
  const account = getAccount(statement.accountId);
  if (!account) return html(notFoundPage(), 404);
  if (statement.status === "void") return html(voidPage(account.locale), 410);
  const justPaid = new URL(req.url).searchParams.get("paid") === "1";
  return html(await buildStatementHtml(statement, account, { today: shopDateStr(new Date()), justPaid }), 200);
}
```

- [ ] **Step 4: Exclude `s/` in the proxy matcher**

In `proxy.ts`, change the first matcher entry to:

```ts
    "/((?!api|_next|_vercel|c/|s/|.*\\..*).*)",
```

- [ ] **Step 5: Run to verify pass**

Run: `npm test -- tests/unit/api-public-statement.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add "app/s/[code]/route.ts" proxy.ts tests/unit/api-public-statement.test.ts
git commit -m "feat(accounts): public /s/<code> statement page

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 12: Stripe Checkout for a statement, `POST /s/[code]/pay`, webhook branch

**Files:**
- Create: `lib/house-statement-checkout.ts`
- Create: `app/s/[code]/pay/route.ts`
- Modify: `app/api/stripe/webhook/route.ts:55-60` (PI early return) and `:123-126` (session branch)
- Test: `tests/unit/house-statement-checkout.test.ts`, `tests/unit/webhook-house-statement.test.ts`

**Interfaces:**
- Consumes: `stripe` (`lib/stripe-server.ts`), `dueCents` (Task 6), `statementUrl` (Task 8), `recordStripeStatementPayment` (Task 6).
- Produces:
  ```ts
  export function buildStatementCheckoutParams(statement: Statement, account: HouseAccount): Stripe.Checkout.SessionCreateParams; // throws "nothing_due"
  export async function createStatementCheckout(statement: Statement, account: HouseAccount): Promise<{ id: string; url: string }>;
  ```
  `POST /s/<code>/pay` → 303 to Stripe; 404 / 410 / 409 (`nothing due`).
  Webhook: `checkout.session.completed` with `metadata.kind === "house_statement"` records the payment (idempotent) and returns; `payment_intent.succeeded` with that kind returns early.

- [ ] **Step 1: Write the failing checkout + pay-route tests**

```ts
// tests/unit/house-statement-checkout.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { createAccount } from "@/lib/house-account-storage";

const create = vi.fn();
vi.mock("@/lib/stripe-server", () => ({ stripe: { checkout: { sessions: { create: (...a: unknown[]) => create(...a) } } } }));

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_dummy");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://x.test");
  create.mockReset(); create.mockResolvedValue({ id: "cs_1", url: "https://checkout.stripe.test/cs_1", expires_at: 1 });
  runMigrations();
});
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

function seedStatement(accountId: string, status = "open", settled = 0) {
  getDb().prepare(
    `INSERT INTO house_account_statements (id, account_id, number, code, period_start, period_end, issued_at, due_date,
       opening_cents, charges_cents, credits_cents, payments_cents, closing_cents, settled_cents, status, lines_json, created_at)
     VALUES ('hst_1', ?, 'ST-1001', 'AbCdEfGh', '2026-09-01', '2026-09-30', '2026-10-01T13:00:00Z', '2026-10-16', 0, 7000, 0, 0, 7000, ?, ?, '[]', '2026-10-01T13:00:00Z')`,
  ).run(accountId, settled, status);
}

describe("buildStatementCheckoutParams", () => {
  it("charges the remaining due, tags metadata, returns to the statement", async () => {
    const { buildStatementCheckoutParams } = await import("@/lib/house-statement-checkout");
    const a = createAccount({ name: "Hotel", billingEmail: "ap@hotel.com" });
    seedStatement(a.id, "open", 2000);
    const { getStatement } = await import("@/lib/house-account-statements");
    const p = buildStatementCheckoutParams(getStatement("hst_1")!, a);
    expect(p.line_items?.[0].price_data?.unit_amount).toBe(5000);
    expect(p.metadata).toEqual({ kind: "house_statement", statementId: "hst_1", accountId: a.id });
    expect(p.payment_intent_data?.metadata).toEqual({ kind: "house_statement", statementId: "hst_1", accountId: a.id });
    expect(p.success_url).toBe("https://x.test/s/AbCdEfGh?paid=1");
    expect(p.cancel_url).toBe("https://x.test/s/AbCdEfGh");
    expect(p.customer_email).toBe("ap@hotel.com");
    expect(p.line_items?.[0].price_data?.product_data?.name).toContain("ST-1001");
  });
  it("throws when nothing is due", async () => {
    const { buildStatementCheckoutParams } = await import("@/lib/house-statement-checkout");
    const a = createAccount({ name: "Hotel" });
    seedStatement(a.id, "open", 7000);
    const { getStatement } = await import("@/lib/house-account-statements");
    expect(() => buildStatementCheckoutParams(getStatement("hst_1")!, a)).toThrow("nothing_due");
  });
});

describe("POST /s/[code]/pay", () => {
  const post = async (code: string) => {
    const { POST } = await import("@/app/s/[code]/pay/route");
    return POST(new Request(`http://x/s/${code}/pay`, { method: "POST" }), { params: Promise.resolve({ code }) });
  };
  it("303 to the Stripe session", async () => {
    const a = createAccount({ name: "Hotel" });
    seedStatement(a.id);
    const res = await post("AbCdEfGh");
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("https://checkout.stripe.test/cs_1");
    expect(create).toHaveBeenCalledTimes(1);
  });
  it("404 unknown, 409 when paid, 410 when void", async () => {
    expect((await post("AbCdEfGh")).status).toBe(404);
    const a = createAccount({ name: "Hotel" });
    seedStatement(a.id, "paid", 7000);
    expect((await post("AbCdEfGh")).status).toBe(409);
    getDb().prepare("UPDATE house_account_statements SET status = 'void' WHERE id = 'hst_1'").run();
    expect((await post("AbCdEfGh")).status).toBe(410);
    expect(create).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Write the failing webhook test**

```ts
// tests/unit/webhook-house-statement.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { createAccount, accountBalanceCents } from "@/lib/house-account-storage";
import { recordCharge } from "@/lib/house-account-ledger";

const constructEvent = vi.fn();
vi.mock("@/lib/stripe-server", () => ({ stripe: { webhooks: { constructEvent } } }));
vi.mock("@/lib/order-notifications", () => ({ notifyOrderPaid: vi.fn() }));
vi.mock("@/lib/print-queue", () => ({ enqueuePrintJob: vi.fn() }));
vi.mock("@/lib/order-dispatch", () => ({ dispatchPaymentConfirmed: vi.fn() }));
vi.mock("@/lib/on-web-order-paid", () => ({ onWebOrderPaid: vi.fn() }));
vi.mock("@/lib/analytics-server", () => ({ sendPurchaseToGA4: vi.fn() }));

const TEST_FILE = path.join(os.tmpdir(), `diva-test-orders-hs-${process.pid}.json`);

beforeEach(async () => {
  vi.stubEnv("ORDER_STORAGE_FILE", TEST_FILE);
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_dummy");
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_dummy");
  await fs.writeFile(TEST_FILE, "[]", "utf8");
  constructEvent.mockReset();
  runMigrations();
});
afterEach(async () => { try { await fs.unlink(TEST_FILE); } catch {} closeDb(); vi.unstubAllEnvs(); });

function seedOrder(id: string, accountId: string, total: number) {
  getDb().prepare(
    `INSERT INTO orders (id, locale, source, recipient_name, recipient_phone, contact_phone, fulfillment_method, window_date,
       lines_json, subtotal_cents, delivery_cents, tax_cents, total_cents, amount_paid_cents, fulfillment_status,
       payment_status, payment_method, house_account_id, order_number, created_at, updated_at)
     VALUES (?, 'es', 'phone', 'Dest', '555', '5165550100', 'delivery', '2026-10-01', '[]', ?, 0, 0, ?, 0, 'pending',
       'pending', 'house-account', ?, 1001, '2026-09-10T12:00:00Z', '2026-09-10T12:00:00Z')`,
  ).run(id, total, total, accountId);
}
function seedStatement(accountId: string) {
  getDb().prepare(
    `INSERT INTO house_account_statements (id, account_id, number, code, period_start, period_end, issued_at, due_date,
       opening_cents, charges_cents, credits_cents, payments_cents, closing_cents, settled_cents, status, lines_json, created_at)
     VALUES ('hst_1', ?, 'ST-1001', 'AbCdEfGh', '2026-09-01', '2026-09-30', '2026-10-01T13:00:00Z', '2026-10-16', 0, 7000, 0, 0, 7000, 0, 'open', '[]', '2026-10-01T13:00:00Z')`,
  ).run(accountId);
}
async function post(event: unknown) {
  constructEvent.mockReturnValue(event);
  const { POST } = await import("@/app/api/stripe/webhook/route");
  return POST(new Request("http://localhost/api/stripe/webhook", { method: "POST", headers: { "stripe-signature": "sig" }, body: "{}" }));
}

describe("webhook: house statement", () => {
  it("records the payment once, pays the order and settles the statement", async () => {
    const a = createAccount({ name: "Hotel" });
    seedOrder("o1", a.id, 7000);
    recordCharge({ accountId: a.id, orderId: "o1", amountCents: 7000, actor: "m" });
    seedStatement(a.id);
    const event = {
      type: "checkout.session.completed",
      data: { object: { id: "cs_1", amount_total: 7000, metadata: { kind: "house_statement", statementId: "hst_1", accountId: a.id } } },
    };
    expect((await post(event)).status).toBe(200);
    expect((await post(event)).status).toBe(200); // replay
    const entries = getDb().prepare("SELECT kind, amount_cents, method, stripe_session_id FROM house_account_entries WHERE kind = 'payment'").all();
    expect(entries).toEqual([{ kind: "payment", amount_cents: -7000, method: "stripe", stripe_session_id: "cs_1" }]);
    expect(accountBalanceCents(a.id)).toBe(0);
    expect((getDb().prepare("SELECT status FROM house_account_statements WHERE id = 'hst_1'").get() as { status: string }).status).toBe("paid");
    expect((getDb().prepare("SELECT payment_status FROM orders WHERE id = 'o1'").get() as { payment_status: string }).payment_status).toBe("paid");
  });
  it("ignores a payment_intent.succeeded for a statement (no order lookup, no crash)", async () => {
    const res = await post({ type: "payment_intent.succeeded", data: { object: { id: "pi_hs", metadata: { kind: "house_statement", statementId: "hst_1" } } } });
    expect(res.status).toBe(200);
    expect(getDb().prepare("SELECT COUNT(*) AS n FROM house_account_entries").get()).toEqual({ n: 0 });
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `npm test -- tests/unit/house-statement-checkout.test.ts tests/unit/webhook-house-statement.test.ts`
Expected: FAIL — module not found / entries not recorded.

- [ ] **Step 4: Implement the checkout module**

```ts
// lib/house-statement-checkout.ts
// Stripe Checkout for the remaining due on a statement. Follows
// lib/stripe-payment-link.ts without touching it: the order flow and the
// statement flow share nothing but the Stripe client.
import "server-only";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe-server";
import { dueCents } from "@/lib/house-account-settlement";
import { statementUrl } from "@/lib/house-account-templates";
import type { Statement, HouseAccount } from "@/types/house-account";

const TWENTY_FOUR_HOURS_SECONDS = 60 * 60 * 24;

export function buildStatementCheckoutParams(statement: Statement, account: HouseAccount): Stripe.Checkout.SessionCreateParams {
  const amount = dueCents(statement);
  if (amount <= 0) throw new Error("nothing_due");
  const url = statementUrl(statement.code);
  const metadata = { kind: "house_statement", statementId: statement.id, accountId: account.id };
  return {
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: amount,
          product_data: { name: `Estado de cuenta ${statement.number} · Diva Flowers`, description: account.name },
        },
        quantity: 1,
      },
    ],
    metadata,
    client_reference_id: statement.id,
    customer_email: account.billingEmail || undefined,
    expires_at: Math.floor(Date.now() / 1000) + TWENTY_FOUR_HOURS_SECONDS,
    success_url: `${url}?paid=1`,
    cancel_url: url,
    payment_intent_data: { metadata },
  };
}

export async function createStatementCheckout(statement: Statement, account: HouseAccount): Promise<{ id: string; url: string }> {
  const session = await stripe.checkout.sessions.create(buildStatementCheckoutParams(statement, account));
  if (!session.url) throw new Error("stripe_session_no_url");
  return { id: session.id, url: session.url };
}
```

- [ ] **Step 5: Implement the pay route**

```ts
// app/s/[code]/pay/route.ts
import { CODE_PATTERN } from "@/lib/short-code";
import { getStatementByCode } from "@/lib/house-account-statements";
import { getAccount } from "@/lib/house-account-storage";
import { dueCents } from "@/lib/house-account-settlement";
import { createStatementCheckout } from "@/lib/house-statement-checkout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function text(body: string, status: number): Response {
  return new Response(body, { status, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
}

export async function POST(_req: Request, ctx: { params: Promise<{ code: string }> }): Promise<Response> {
  const { code } = await ctx.params;
  const statement = CODE_PATTERN.test(code) ? getStatementByCode(code) : null;
  if (!statement) return text("not found", 404);
  const account = getAccount(statement.accountId);
  if (!account) return text("not found", 404);
  if (statement.status === "void") return text("gone", 410);
  if (statement.status !== "open" || dueCents(statement) <= 0) return text("nothing due", 409);
  const { url } = await createStatementCheckout(statement, account);
  return new Response(null, { status: 303, headers: { location: url, "cache-control": "no-store" } });
}
```

- [ ] **Step 6: Patch the webhook**

In `app/api/stripe/webhook/route.ts`:

1. Add the import:
   ```ts
   import { recordStripeStatementPayment } from "@/lib/house-account-ledger";
   ```
2. In `case "payment_intent.succeeded"`, right after `const pi = event.data.object as Stripe.PaymentIntent;` and before the gift-card block, add:
   ```ts
        // A house-account statement paid through /s/<code>/pay. The money is
        // recorded on checkout.session.completed below; there is no order here.
        if (pi.metadata?.kind === "house_statement") return NextResponse.json({ received: true });
   ```
3. In `case "checkout.session.completed"`, right after `const session = event.data.object as Stripe.Checkout.Session;` and before the `orderId` line, add:
   ```ts
        if (session.metadata?.kind === "house_statement" && session.metadata.statementId) {
          // Idempotent by session id (UNIQUE stripe_session_id + INSERT OR IGNORE).
          recordStripeStatementPayment({
            statementId: session.metadata.statementId,
            sessionId: session.id,
            amountCents: session.amount_total ?? 0,
          });
          break;
        }
   ```

- [ ] **Step 7: Run to verify pass**

Run: `npm test -- tests/unit/house-statement-checkout.test.ts tests/unit/webhook-house-statement.test.ts tests/unit/api-stripe-webhook.test.ts tests/unit/webhook-promo-checkout-session.test.ts`
Expected: PASS (the two existing webhook suites must stay green).

- [ ] **Step 8: Commit**

```bash
git add lib/house-statement-checkout.ts "app/s/[code]/pay/route.ts" app/api/stripe/webhook/route.ts tests/unit/house-statement-checkout.test.ts tests/unit/webhook-house-statement.test.ts
git commit -m "feat(accounts): pay a statement with Stripe Checkout; webhook records it idempotently

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 13: Statement SMS in the inbox thread

**Files:**
- Modify: `lib/conversation-storage.ts` (`fetchEvents` gains a fourth source)
- Test: `tests/unit/conversation-house-account.test.ts`

**Interfaces:**
- Consumes: `house_account_sends` rows with `status = 'sent'` and `sms_sid`, joined to `house_accounts.billing_phone`.
- Produces: thread events `{ direction: "out", kind: "transactional", template: "house_statement", text: body }` attributed by phone like the other sources.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/conversation-house-account.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { createAccount } from "@/lib/house-account-storage";
import { enqueue, claim, markSent } from "@/lib/house-account-sends";
import { conversationThread, listConversations } from "@/lib/conversation-storage";

beforeEach(() => { vi.stubEnv("SQLITE_FILE", ":memory:"); runMigrations(); });
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

it("a sent statement SMS shows in the billing contact's thread", () => {
  getDb().prepare("INSERT INTO customers (id, name, phone, order_count, first_seen_at, last_seen_at) VALUES ('cus_1', 'Ana', '5165550100', 0, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')").run();
  const a = createAccount({ name: "Hotel", billingPhone: "5165550100" });
  getDb().prepare(
    `INSERT INTO house_account_statements (id, account_id, number, code, period_start, period_end, issued_at, due_date,
       opening_cents, charges_cents, credits_cents, payments_cents, closing_cents, settled_cents, status, lines_json, created_at)
     VALUES ('hst_1', ?, 'ST-1001', 'AbCdEfGh', '2026-09-01', '2026-09-30', '2026-10-01T13:00:00Z', '2026-10-16', 0, 7000, 0, 0, 7000, 0, 'open', '[]', '2026-10-01T13:00:00Z')`,
  ).run(a.id);
  const [sent, skipped] = enqueue([
    { accountId: a.id, statementId: "hst_1", kind: "statement", channel: "sms", scheduledFor: "2026-10-01" },
    { accountId: a.id, statementId: "hst_1", kind: "reminder", stepIndex: 0, channel: "sms", scheduledFor: "2026-10-13" },
  ]);
  claim(sent.id); markSent(sent.id, { smsSid: "SM1", body: "Diva Flowers: tu estado de cuenta ST-1001 …" });
  claim(skipped.id);
  const { thread } = conversationThread("cus_1");
  expect(thread).toHaveLength(1);
  expect(thread[0]).toMatchObject({ direction: "out", kind: "transactional", template: "house_statement", status: "sent" });
  expect(thread[0].text).toContain("ST-1001");
  expect(listConversations()[0]).toMatchObject({ customerId: "cus_1", name: "Ana" });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- tests/unit/conversation-house-account.test.ts`
Expected: FAIL — thread is empty.

- [ ] **Step 3: Implement**

In `lib/conversation-storage.ts`, add a row type next to the others:

```ts
type HasRow = { id: string; body: string | null; sent_at: string | null; created_at: string; billing_phone: string };
```

and, inside `fetchEvents` after the inbound loop (before `return events;`):

```ts
  // House-account statement / reminder texts. They are logged in their own
  // queue table (not `messages`, whose order_id is NOT NULL), so the inbox
  // reads them from there, attributed by the account's billing phone.
  const hs = db
    .prepare(
      `SELECT s.id, s.body, s.sent_at, s.created_at, a.billing_phone
         FROM house_account_sends s JOIN house_accounts a ON a.id = s.account_id
        WHERE s.status = 'sent' AND s.sms_sid IS NOT NULL AND a.billing_phone IS NOT NULL
        ORDER BY s.sent_at DESC LIMIT ?`,
    )
    .all(limit) as HasRow[];
  for (const h of hs) {
    const who = nameFor(null, h.billing_phone, phoneCache);
    events.push({
      ...who, id: h.id, direction: "out", kind: "transactional", text: h.body ?? "",
      template: "house_statement", status: "sent", at: h.sent_at ?? h.created_at,
    });
  }
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- tests/unit/conversation-house-account.test.ts tests/unit/conversation-storage.test.ts`
Expected: PASS (if the second file does not exist, run whichever existing `conversation`/`sms-inbox` suite exists under `tests/unit`).

- [ ] **Step 5: Commit**

```bash
git add lib/conversation-storage.ts tests/unit/conversation-house-account.test.ts
git commit -m "feat(accounts): statement texts appear in the SMS inbox thread

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 14: Admin API (accounts, payments, entries, contacts, statements, sends) + detail module

**Files:**
- Create: `schemas/house-account.ts`
- Create: `lib/house-account-detail.ts`
- Create: `app/api/admin/accounts/route.ts`
- Create: `app/api/admin/accounts/search/route.ts`
- Create: `app/api/admin/accounts/for-phone/route.ts`
- Create: `app/api/admin/accounts/[id]/route.ts`
- Create: `app/api/admin/accounts/[id]/payments/route.ts`
- Create: `app/api/admin/accounts/[id]/entries/route.ts`
- Create: `app/api/admin/accounts/[id]/contacts/route.ts`
- Create: `app/api/admin/accounts/[id]/statements/route.ts`
- Create: `app/api/admin/accounts/statements/[sid]/route.ts`
- Create: `app/api/admin/accounts/statements/[sid]/send/route.ts`
- Create: `app/api/admin/accounts/sends/[id]/route.ts`
- Test: `tests/unit/api-admin-accounts.test.ts`

**Interfaces:**
- Consumes: Tasks 3, 5, 6, 7, 9; `requireAdmin`, `signSession` (`lib/admin-auth.ts`); `shopDateStr`.
- Produces (`lib/house-account-detail.ts`):
  ```ts
  export type StatementView = Statement & { dueCents: number };
  export type LedgerView = LedgerEntry & { runningCents: number };
  export type AccountDetailData = { account: HouseAccount; balanceCents: number; statements: StatementView[]; entries: LedgerView[]; contacts: Customer[]; sends: ScheduledSend[] };
  export function getAccountDetail(id: string): AccountDetailData | null;
  ```
- Produces (`schemas/house-account.ts`): `accountBody`, `accountPatch` zod schemas and their inferred types.
- Produces (routes; all JSON):

  | route | body / query | response |
  |---|---|---|
  | `GET /api/admin/accounts?q&filter` | filter ∈ all, with_balance, overdue, paused | `{ accounts: AccountListItem[], upcoming: UpcomingSend[] }` |
  | `POST /api/admin/accounts` | `accountBody` | 201 `{ account }`; 400 `{ error }` |
  | `GET /api/admin/accounts/search?q` | | `{ accounts: {id,name}[] }` |
  | `GET /api/admin/accounts/for-phone?phone` | | `{ account: {id,name} \| null }` |
  | `GET /api/admin/accounts/[id]` | | `AccountDetailData` or 404 |
  | `PATCH /api/admin/accounts/[id]` | `accountPatch` | `{ account }`; reactivating skips stale sends |
  | `POST /api/admin/accounts/[id]/payments` | `{ amountCents, method, note? }` (admin) | `{ entry, allocations, detail }` |
  | `POST /api/admin/accounts/[id]/entries` | `{ kind: "credit"\|"adjustment", amountCents, note }` (admin) | `{ entry, detail }` |
  | `POST/DELETE /api/admin/accounts/[id]/contacts` | `{ customerId }` | `{ contacts }`; 404 / 409 `contact_taken` |
  | `POST /api/admin/accounts/[id]/statements` | (admin) | 201 `{ statement }` or 200 `{ statement: null }` |
  | `PATCH /api/admin/accounts/statements/[sid]` | `{ void: true }` (admin) | `{ statement }`; 409 `statement_paid` / `not_latest` |
  | `POST /api/admin/accounts/statements/[sid]/send` | `{ channel }` (admin) | `{ send }`; 422 `{ error: "no_channel", reason }`; 502 `{ error: "send_failed", send }` |
  | `PATCH /api/admin/accounts/sends/[id]` | `{ skip: true }` \| `{ scheduledFor }` \| `{ sendNow: true }` | `{ send }`; 409 when not scheduled |

- [ ] **Step 1: Write the failing tests**

```ts
// tests/unit/api-admin-accounts.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { signSession } from "@/lib/admin-auth";
import { createAccount, updateAccount } from "@/lib/house-account-storage";
import { recordCharge } from "@/lib/house-account-ledger";
import { enqueue, getSend } from "@/lib/house-account-sends";

const sendSms = vi.fn();
vi.mock("@/lib/twilio-server", () => ({ sendSms: (...a: unknown[]) => sendSms(...a) }));
vi.mock("@/lib/twilio-config", () => ({ twilioSmsEnabled: () => true, twilioDryRun: () => false }));
vi.mock("resend", () => ({ Resend: class { emails = { send: async () => ({ data: { id: "em" }, error: null }) }; } }));

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("INTAKE_SESSION_SECRET", "test-secret-test-secret-test-secret");
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-02T14:00:00Z"));
  sendSms.mockReset(); sendSms.mockResolvedValue({ sid: "SM1" });
  runMigrations();
});
afterEach(() => { closeDb(); vi.useRealTimers(); vi.unstubAllEnvs(); });

const cookie = () => ({ cookie: `intake_session=${signSession()}` });
function req(url: string, method = "GET", body?: unknown, authed = true) {
  return new Request(`http://x${url}`, {
    method,
    headers: { "content-type": "application/json", ...(authed ? cookie() : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
const params = (p: Record<string, string>) => ({ params: Promise.resolve(p) });

function seedOrder(id: string, accountId: string, total: number) {
  getDb().prepare(
    `INSERT INTO orders (id, locale, source, recipient_name, recipient_phone, contact_phone, fulfillment_method, window_date,
       lines_json, subtotal_cents, delivery_cents, tax_cents, total_cents, amount_paid_cents, fulfillment_status,
       payment_status, payment_method, house_account_id, order_number, created_at, updated_at)
     VALUES (?, 'es', 'phone', 'Dest', '555', '5165550100', 'delivery', '2026-10-01', '[]', ?, 0, 0, ?, 0, 'pending',
       'pending', 'house-account', ?, 1001, '2026-09-10T12:00:00Z', '2026-09-10T12:00:00Z')`,
  ).run(id, total, total, accountId);
}
function seedCustomer(id: string, phone: string) {
  getDb().prepare("INSERT INTO customers (id, name, phone, order_count, first_seen_at, last_seen_at) VALUES (?, 'Ana', ?, 0, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')").run(id, phone);
}
function chargedAccount(name = "Hotel", phone = "5165550100") {
  const a = createAccount({ name, billingPhone: phone, cadence: "monthly", issueDay: 1, termsDays: 15, statementChannel: "sms" }, "2026-09-01");
  getDb().prepare("UPDATE house_accounts SET created_at = '2026-09-01T12:00:00Z' WHERE id = ?").run(a.id);
  seedOrder(`o_${a.id}`, a.id, 7000);
  const e = recordCharge({ accountId: a.id, orderId: `o_${a.id}`, amountCents: 7000, actor: "m" });
  getDb().prepare("UPDATE house_account_entries SET created_at = '2026-09-10T12:00:00Z' WHERE id = ?").run(e.id);
  return a;
}

describe("accounts collection", () => {
  it("POST creates, 400 on an empty name; GET lists with upcoming sends", async () => {
    const { POST, GET } = await import("@/app/api/admin/accounts/route");
    expect((await POST(req("/api/admin/accounts", "POST", { name: " " }))).status).toBe(400);
    const res = await POST(req("/api/admin/accounts", "POST", { name: "Hotel", billingPhone: "(516) 555-0100", billingEmail: "" }));
    expect(res.status).toBe(201);
    const { account } = await res.json();
    expect(account.billingPhone).toBe("5165550100");
    expect(account.billingEmail).toBeUndefined();
    const list = await (await GET(req("/api/admin/accounts?filter=all"))).json();
    expect(list.accounts.map((a: { name: string }) => a.name)).toEqual(["Hotel"]);
    expect(list.upcoming).toEqual([]);
  });
  it("search and for-phone", async () => {
    const a = createAccount({ name: "Iglesia San José" });
    seedCustomer("cus_1", "5165550111");
    const { linkContact } = await import("@/lib/house-account-storage");
    linkContact(a.id, "cus_1");
    const { GET: search } = await import("@/app/api/admin/accounts/search/route");
    expect(await (await search(req("/api/admin/accounts/search?q=igle"))).json()).toEqual({ accounts: [{ id: a.id, name: "Iglesia San José" }] });
    const { GET: forPhone } = await import("@/app/api/admin/accounts/for-phone/route");
    expect(await (await forPhone(req("/api/admin/accounts/for-phone?phone=516-555-0111"))).json()).toEqual({ account: { id: a.id, name: "Iglesia San José" } });
    expect(await (await forPhone(req("/api/admin/accounts/for-phone?phone=5165559999"))).json()).toEqual({ account: null });
  });
});

describe("account detail", () => {
  it("GET returns the detail with running balances; 404 unknown", async () => {
    const a = chargedAccount();
    const { GET } = await import("@/app/api/admin/accounts/[id]/route");
    expect((await GET(req("/x"), params({ id: "ha_nope" }))).status).toBe(404);
    const d = await (await GET(req("/x"), params({ id: a.id }))).json();
    expect(d.balanceCents).toBe(7000);
    expect(d.entries[0].runningCents).toBe(7000);
    expect(d.statements).toEqual([]);
    expect(d.contacts).toEqual([]);
  });
  it("PATCH edits the plan and reactivation skips stale sends", async () => {
    const a = chargedAccount();
    const { PATCH } = await import("@/app/api/admin/accounts/[id]/route");
    const r = await PATCH(req("/x", "PATCH", { termsDays: 30, reminderPlan: [{ offsetDays: 0, channel: "sms" }], status: "paused" }), params({ id: a.id }));
    expect(r.status).toBe(200);
    expect((await r.json()).account).toMatchObject({ termsDays: 30, status: "paused", reminderPlan: [{ offsetDays: 0, channel: "sms" }] });
    getDb().prepare(
      `INSERT INTO house_account_statements (id, account_id, number, code, period_start, period_end, issued_at, due_date, opening_cents, charges_cents, credits_cents, payments_cents, closing_cents, settled_cents, status, lines_json, created_at)
       VALUES ('hst_1', ?, 'ST-1001', 'AbCdEfGh', '2026-09-01', '2026-09-30', '2026-10-01T13:00:00Z', '2026-10-16', 0, 7000, 0, 0, 7000, 0, 'open', '[]', '2026-10-01T13:00:00Z')`,
    ).run(a.id);
    const [stale, future] = enqueue([
      { accountId: a.id, statementId: "hst_1", kind: "reminder", stepIndex: 0, channel: "sms", scheduledFor: "2026-09-29" },
      { accountId: a.id, statementId: "hst_1", kind: "reminder", stepIndex: 1, channel: "sms", scheduledFor: "2026-10-20" },
    ]);
    await PATCH(req("/x", "PATCH", { status: "active" }), params({ id: a.id }));
    expect(getSend(stale.id)?.status).toBe("skipped");
    expect(getSend(future.id)?.status).toBe("scheduled");
    expect((await PATCH(req("/x", "PATCH", { issueDay: 31 }), params({ id: a.id }))).status).toBe(400);
  });
});

describe("money routes need the admin session", () => {
  it("payments: 401 without session, 200 with", async () => {
    const a = chargedAccount();
    const { POST } = await import("@/app/api/admin/accounts/[id]/payments/route");
    expect((await POST(req("/x", "POST", { amountCents: 100, method: "cash" }, false), params({ id: a.id }))).status).toBe(401);
    const res = await POST(req("/x", "POST", { amountCents: 7000, method: "zelle", note: "transfer 123" }), params({ id: a.id }));
    expect(res.status).toBe(200);
    const d = await res.json();
    expect(d.entry).toMatchObject({ kind: "payment", amountCents: -7000, method: "zelle" });
    expect(d.allocations).toEqual([{ id: `o_${a.id}`, appliedCents: 7000 }]);
    expect(d.detail.balanceCents).toBe(0);
    expect((await POST(req("/x", "POST", { amountCents: 0, method: "cash" }), params({ id: a.id }))).status).toBe(400);
    expect((await POST(req("/x", "POST", { amountCents: 5, method: "cash" }), params({ id: "ha_nope" }))).status).toBe(404);
  });
  it("entries: credit allocates, adjustment is signed", async () => {
    const a = chargedAccount();
    const { POST } = await import("@/app/api/admin/accounts/[id]/entries/route");
    const c = await (await POST(req("/x", "POST", { kind: "credit", amountCents: 500, note: "cortesía" }), params({ id: a.id }))).json();
    expect(c.entry).toMatchObject({ kind: "credit", amountCents: -500 });
    const adj = await (await POST(req("/x", "POST", { kind: "adjustment", amountCents: -200, note: "descuento" }), params({ id: a.id }))).json();
    expect(adj.entry).toMatchObject({ kind: "adjustment", amountCents: -200 });
    expect(adj.detail.balanceCents).toBe(6300);
    expect((await POST(req("/x", "POST", { kind: "adjustment", amountCents: 0, note: "x" }), params({ id: a.id }))).status).toBe(400);
  });
});

describe("contacts", () => {
  it("link, conflict, unlink", async () => {
    const a = createAccount({ name: "A" });
    const b = createAccount({ name: "B" });
    seedCustomer("cus_1", "5165550111");
    const { POST, DELETE } = await import("@/app/api/admin/accounts/[id]/contacts/route");
    const ok = await POST(req("/x", "POST", { customerId: "cus_1" }), params({ id: a.id }));
    expect(ok.status).toBe(200);
    expect((await ok.json()).contacts.map((c: { id: string }) => c.id)).toEqual(["cus_1"]);
    expect((await POST(req("/x", "POST", { customerId: "cus_1" }), params({ id: b.id }))).status).toBe(409);
    expect((await POST(req("/x", "POST", { customerId: "cus_404" }), params({ id: a.id }))).status).toBe(404);
    const gone = await DELETE(req("/x", "DELETE", { customerId: "cus_1" }), params({ id: a.id }));
    expect((await gone.json()).contacts).toEqual([]);
  });
});

describe("statements and sends", () => {
  it("issue now, send now, void", async () => {
    const a = chargedAccount();
    const { POST: issue } = await import("@/app/api/admin/accounts/[id]/statements/route");
    const r = await issue(req("/x", "POST"), params({ id: a.id }));
    expect(r.status).toBe(201);
    const { statement } = await r.json();
    expect(statement).toMatchObject({ periodEnd: "2026-10-02", closingCents: 7000, status: "open" });
    expect((await (await issue(req("/x", "POST"), params({ id: a.id }))).json()).statement).toBeNull();

    const { POST: send } = await import("@/app/api/admin/accounts/statements/[sid]/send/route");
    const s = await send(req("/x", "POST", { channel: "sms" }), params({ sid: statement.id }));
    expect(s.status).toBe(200);
    expect((await s.json()).send).toMatchObject({ kind: "manual", status: "sent", smsSid: "SM1" });
    expect(sendSms).toHaveBeenCalledTimes(1);
    const noEmail = await send(req("/x", "POST", { channel: "email" }), params({ sid: statement.id }));
    expect(noEmail.status).toBe(422);
    expect(await noEmail.json()).toEqual({ error: "no_channel", reason: "sin email" });

    const { PATCH: voidRoute } = await import("@/app/api/admin/accounts/statements/[sid]/route");
    const v = await voidRoute(req("/x", "PATCH", { void: true }), params({ sid: statement.id }));
    expect((await v.json()).statement.status).toBe("void");
    expect((await voidRoute(req("/x", "PATCH", { void: true }), params({ sid: "nope" }))).status).toBe(404);
  });
  it("sends: skip, reschedule, sendNow, 409 when not scheduled", async () => {
    const a = chargedAccount();
    getDb().prepare(
      `INSERT INTO house_account_statements (id, account_id, number, code, period_start, period_end, issued_at, due_date, opening_cents, charges_cents, credits_cents, payments_cents, closing_cents, settled_cents, status, lines_json, created_at)
       VALUES ('hst_1', ?, 'ST-1001', 'AbCdEfGh', '2026-09-01', '2026-09-30', '2026-10-01T13:00:00Z', '2026-10-16', 0, 7000, 0, 0, 7000, 0, 'open', '[]', '2026-10-01T13:00:00Z')`,
    ).run(a.id);
    const [x, y, z] = enqueue([
      { accountId: a.id, statementId: "hst_1", kind: "reminder", stepIndex: 0, channel: "sms", scheduledFor: "2026-10-13" },
      { accountId: a.id, statementId: "hst_1", kind: "reminder", stepIndex: 1, channel: "sms", scheduledFor: "2026-10-16" },
      { accountId: a.id, statementId: "hst_1", kind: "reminder", stepIndex: 2, channel: "sms", scheduledFor: "2026-10-23" },
    ]);
    const { PATCH } = await import("@/app/api/admin/accounts/sends/[id]/route");
    expect((await (await PATCH(req("/x", "PATCH", { skip: true }), params({ id: x.id }))).json()).send.status).toBe("skipped");
    expect((await (await PATCH(req("/x", "PATCH", { scheduledFor: "2026-10-18" }), params({ id: y.id }))).json()).send.scheduledFor).toBe("2026-10-18");
    expect((await PATCH(req("/x", "PATCH", { scheduledFor: "2026-09-01" }), params({ id: y.id }))).status).toBe(400);
    const now = await (await PATCH(req("/x", "PATCH", { sendNow: true }), params({ id: z.id }))).json();
    expect(now.send).toMatchObject({ status: "sent", smsSid: "SM1" });
    expect((await PATCH(req("/x", "PATCH", { skip: true }), params({ id: z.id }))).status).toBe(409);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- tests/unit/api-admin-accounts.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Write the zod schemas**

```ts
// schemas/house-account.ts
import { z } from "zod";

export const reminderStep = z.object({
  offsetDays: z.number().int().min(-60).max(120),
  channel: z.enum(["sms", "email", "both"]),
});

export const accountBody = z.object({
  name: z.string().trim().min(1).max(120),
  billingName: z.string().max(120).optional(),
  billingPhone: z.string().max(25).optional(),
  billingEmail: z.string().email().optional().or(z.literal("")),
  locale: z.enum(["en", "es"]).optional(),
  cadence: z.enum(["weekly", "biweekly", "monthly"]).optional(),
  issueDay: z.number().int().min(0).max(28).optional(),
  termsDays: z.number().int().min(0).max(120).optional(),
  reminderPlan: z.array(reminderStep).max(10).optional(),
  statementChannel: z.enum(["sms", "email", "both"]).optional(),
  notes: z.string().max(1000).optional(),
});
export type AccountBody = z.infer<typeof accountBody>;

export const accountPatch = accountBody.partial().extend({
  status: z.enum(["active", "paused", "closed"]).optional(),
});
export type AccountPatchBody = z.infer<typeof accountPatch>;

export const paymentBody = z.object({
  amountCents: z.number().int().positive(),
  method: z.enum(["cash", "zelle", "ach", "check", "card-terminal"]),
  note: z.string().max(500).optional(),
});

export const entryBody = z.object({
  kind: z.enum(["credit", "adjustment"]),
  amountCents: z.number().int(),
  note: z.string().trim().min(1).max(500),
});

export const contactBody = z.object({ customerId: z.string().min(1) });
export const sendBody = z.object({ channel: z.enum(["sms", "email", "both"]) });
export const sendPatch = z.union([
  z.object({ skip: z.literal(true) }),
  z.object({ scheduledFor: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }),
  z.object({ sendNow: z.literal(true) }),
]);
```

- [ ] **Step 4: Write the detail module**

```ts
// lib/house-account-detail.ts
import "server-only";
import { getAccount, accountBalanceCents, listContacts } from "@/lib/house-account-storage";
import { listEntries } from "@/lib/house-account-ledger";
import { listStatements } from "@/lib/house-account-statements";
import { listForAccount } from "@/lib/house-account-sends";
import { dueCents } from "@/lib/house-account-settlement";
import type { Customer } from "@/lib/customer-storage";
import type { HouseAccount, LedgerEntry, Statement, ScheduledSend } from "@/types/house-account";

export type StatementView = Statement & { dueCents: number };
export type LedgerView = LedgerEntry & { runningCents: number };
export type AccountDetailData = {
  account: HouseAccount;
  balanceCents: number;
  statements: StatementView[];
  entries: LedgerView[];
  contacts: Customer[];
  sends: ScheduledSend[];
};

export function getAccountDetail(id: string): AccountDetailData | null {
  const account = getAccount(id);
  if (!account) return null;
  let running = 0;
  const entries = listEntries(id).map((e) => { running += e.amountCents; return { ...e, runningCents: running }; });
  return {
    account,
    balanceCents: accountBalanceCents(id),
    statements: listStatements(id).map((s) => ({ ...s, dueCents: dueCents(s) })),
    entries,
    contacts: listContacts(id),
    sends: listForAccount(id),
  };
}
```

- [ ] **Step 5: Write the routes**

```ts
// app/api/admin/accounts/route.ts
import { NextResponse } from "next/server";
import { listAccounts, createAccount, type AccountFilter } from "@/lib/house-account-storage";
import { upcomingSends } from "@/lib/house-account-sends";
import { shopDateStr } from "@/lib/tv-slots";
import { accountBody } from "@/schemas/house-account";

export const runtime = "nodejs";

const FILTERS = new Set<string>(["all", "with_balance", "overdue", "paused"]);

export async function GET(req: Request): Promise<Response> {
  const sp = new URL(req.url).searchParams;
  const f = sp.get("filter");
  const today = shopDateStr(new Date());
  return NextResponse.json({
    accounts: listAccounts({ q: sp.get("q") ?? undefined, filter: f && FILTERS.has(f) ? (f as AccountFilter) : "all", today }),
    upcoming: upcomingSends(7, today),
  });
}

export async function POST(req: Request): Promise<Response> {
  const parsed = accountBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body", details: parsed.error.flatten() }, { status: 400 });
  try {
    const account = createAccount({ ...parsed.data, billingEmail: parsed.data.billingEmail || undefined });
    return NextResponse.json({ account }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
```

```ts
// app/api/admin/accounts/search/route.ts
import { NextResponse } from "next/server";
import { searchAccounts } from "@/lib/house-account-storage";
export const runtime = "nodejs";
export async function GET(req: Request): Promise<Response> {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  return NextResponse.json({ accounts: searchAccounts(q) });
}
```

```ts
// app/api/admin/accounts/for-phone/route.ts
import { NextResponse } from "next/server";
import { findAccountForPhone } from "@/lib/house-account-storage";
export const runtime = "nodejs";
export async function GET(req: Request): Promise<Response> {
  const phone = new URL(req.url).searchParams.get("phone") ?? "";
  const a = phone.replace(/\D/g, "").length >= 10 ? findAccountForPhone(phone) : null;
  return NextResponse.json({ account: a ? { id: a.id, name: a.name } : null });
}
```

```ts
// app/api/admin/accounts/[id]/route.ts
import { NextResponse } from "next/server";
import { getAccount, updateAccount } from "@/lib/house-account-storage";
import { getAccountDetail } from "@/lib/house-account-detail";
import { skipStaleForAccount } from "@/lib/house-account-sends";
import { shopDateStr } from "@/lib/tv-slots";
import { accountPatch } from "@/schemas/house-account";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  const detail = getAccountDetail(id);
  if (!detail) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(detail);
}

export async function PATCH(req: Request, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  const parsed = accountPatch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body", details: parsed.error.flatten() }, { status: 400 });
  const cur = getAccount(id);
  if (!cur) return NextResponse.json({ error: "not_found" }, { status: 404 });
  try {
    const today = shopDateStr(new Date());
    const account = updateAccount(id, { ...parsed.data, billingEmail: parsed.data.billingEmail === "" ? "" : parsed.data.billingEmail }, today);
    // Coming back from a pause: anything that should have gone out meanwhile is skipped, not burst.
    if (cur.status !== "active" && account?.status === "active") skipStaleForAccount(id, today);
    return NextResponse.json({ account });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
```

Note on `billingEmail: ""`: `updateAccount` passes it through `cleanText`, which stores NULL for an empty string — that is how the UI clears the email.

```ts
// app/api/admin/accounts/[id]/payments/route.ts
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { recordPayment } from "@/lib/house-account-ledger";
import { getAccountDetail } from "@/lib/house-account-detail";
import { paymentBody } from "@/schemas/house-account";

export const runtime = "nodejs";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  if (!requireAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const parsed = paymentBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body", details: parsed.error.flatten() }, { status: 400 });
  try {
    const { entry, allocations } = recordPayment({ accountId: id, ...parsed.data, actor: "maky" });
    return NextResponse.json({ entry, allocations, detail: getAccountDetail(id) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: msg === "account_not_found" ? 404 : 400 });
  }
}
```

```ts
// app/api/admin/accounts/[id]/entries/route.ts
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { recordCredit, recordAdjustment } from "@/lib/house-account-ledger";
import { getAccountDetail } from "@/lib/house-account-detail";
import { entryBody } from "@/schemas/house-account";

export const runtime = "nodejs";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  if (!requireAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const parsed = entryBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body", details: parsed.error.flatten() }, { status: 400 });
  try {
    const { kind, amountCents, note } = parsed.data;
    const entry = kind === "credit"
      ? recordCredit({ accountId: id, amountCents, note, actor: "maky" }).entry
      : recordAdjustment({ accountId: id, amountCents, note, actor: "maky" });
    return NextResponse.json({ entry, detail: getAccountDetail(id) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: msg === "account_not_found" ? 404 : 400 });
  }
}
```

```ts
// app/api/admin/accounts/[id]/contacts/route.ts
import { NextResponse } from "next/server";
import { getAccount, linkContact, unlinkContact, listContacts } from "@/lib/house-account-storage";
import { contactBody } from "@/schemas/house-account";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

async function parse(req: Request) {
  return contactBody.safeParse(await req.json().catch(() => null));
}

export async function POST(req: Request, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  if (!getAccount(id)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const parsed = await parse(req);
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  try {
    linkContact(id, parsed.data.customerId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "customer_not_found") return NextResponse.json({ error: msg }, { status: 404 });
    if (msg === "contact_taken") return NextResponse.json({ error: msg }, { status: 409 });
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  return NextResponse.json({ contacts: listContacts(id) });
}

export async function DELETE(req: Request, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  const parsed = await parse(req);
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  unlinkContact(id, parsed.data.customerId);
  return NextResponse.json({ contacts: listContacts(id) });
}
```

```ts
// app/api/admin/accounts/[id]/statements/route.ts
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getAccount } from "@/lib/house-account-storage";
import { issueStatement } from "@/lib/house-account-statements";
import { shopDateStr } from "@/lib/tv-slots";

export const runtime = "nodejs";

/** "Emitir estado ahora": closes the period through today. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  if (!requireAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  if (!getAccount(id)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const today = shopDateStr(new Date());
  const statement = issueStatement(id, today, { today });
  return NextResponse.json({ statement }, { status: statement ? 201 : 200 });
}
```

```ts
// app/api/admin/accounts/statements/[sid]/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { voidStatement } from "@/lib/house-account-statements";

export const runtime = "nodejs";
const body = z.object({ void: z.literal(true) });

export async function PATCH(req: Request, ctx: { params: Promise<{ sid: string }> }): Promise<Response> {
  if (!requireAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { sid } = await ctx.params;
  if (!body.safeParse(await req.json().catch(() => null)).success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  try {
    return NextResponse.json({ statement: voidStatement(sid) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "statement_not_found") return NextResponse.json({ error: msg }, { status: 404 });
    if (msg === "statement_paid" || msg === "not_latest") return NextResponse.json({ error: msg }, { status: 409 });
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
```

```ts
// app/api/admin/accounts/statements/[sid]/send/route.ts
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getStatement } from "@/lib/house-account-statements";
import { getAccount } from "@/lib/house-account-storage";
import { enqueue } from "@/lib/house-account-sends";
import { resolveChannels, dispatchSend } from "@/lib/house-account-sender";
import { shopDateStr } from "@/lib/tv-slots";
import { sendBody } from "@/schemas/house-account";

export const runtime = "nodejs";

/** "Enviar ya": a manual queue row for today, dispatched in the request so the log stays complete. */
export async function POST(req: Request, ctx: { params: Promise<{ sid: string }> }): Promise<Response> {
  if (!requireAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { sid } = await ctx.params;
  const parsed = sendBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const statement = getStatement(sid);
  if (!statement) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const account = getAccount(statement.accountId);
  if (!account) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (statement.status === "void") return NextResponse.json({ error: "statement_void" }, { status: 409 });
  const ch = resolveChannels(account, parsed.data.channel);
  if (!ch.sms && !ch.email) return NextResponse.json({ error: "no_channel", reason: ch.reasons.join(", ") }, { status: 422 });
  const today = shopDateStr(new Date());
  const [row] = enqueue([{ accountId: account.id, statementId: sid, kind: "manual", channel: parsed.data.channel, scheduledFor: today }]);
  const send = await dispatchSend(row, today);
  if (send.status === "failed") return NextResponse.json({ error: "send_failed", send }, { status: 502 });
  return NextResponse.json({ send });
}
```

```ts
// app/api/admin/accounts/sends/[id]/route.ts
import { NextResponse } from "next/server";
import { getSend, markSkipped, rescheduleSend } from "@/lib/house-account-sends";
import { dispatchSend } from "@/lib/house-account-sender";
import { shopDateStr } from "@/lib/tv-slots";
import { sendPatch } from "@/schemas/house-account";

export const runtime = "nodejs";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await ctx.params;
  const parsed = sendPatch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const row = getSend(id);
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (row.status !== "scheduled") return NextResponse.json({ error: "not_scheduled" }, { status: 409 });
  const today = shopDateStr(new Date());
  const data = parsed.data;
  if ("skip" in data) {
    markSkipped(id, "manual");
    return NextResponse.json({ send: getSend(id) });
  }
  if ("scheduledFor" in data) {
    if (data.scheduledFor < today) return NextResponse.json({ error: "date_in_past" }, { status: 400 });
    return NextResponse.json({ send: rescheduleSend(id, data.scheduledFor) });
  }
  return NextResponse.json({ send: await dispatchSend(row, today) });
}
```

- [ ] **Step 6: Run to verify pass**

Run: `npm test -- tests/unit/api-admin-accounts.test.ts && npx tsc --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 7: Commit**

```bash
git add schemas/house-account.ts lib/house-account-detail.ts app/api/admin/accounts tests/unit/api-admin-accounts.test.ts
git commit -m "feat(accounts): admin API for accounts, payments, entries, contacts, statements and sends

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 15: i18n, nav entry and the accounts list page

**Files:**
- Modify: `messages/es.json`, `messages/en.json` (new `admin_accounts` namespace; `admin_dashboard.nav_accounts`)
- Modify: `components/admin/dashboard/DashboardShell.tsx`
- Create: `app/[locale]/admin/accounts/page.tsx`
- Create: `components/admin/accounts/AccountStatusBadge.tsx`
- Create: `components/admin/accounts/UpcomingSends.tsx`
- Create: `components/admin/accounts/NewAccountModal.tsx`
- Create: `components/admin/accounts/AccountsView.tsx`
- Test: `tests/unit/AccountsView.test.tsx`

**Interfaces:**
- Consumes: `listAccounts`, `AccountListItem`, `AccountFilter` (Task 3); `upcomingSends`, `UpcomingSend` (Task 5); API from Task 14; `DashboardShell`, `AdminButton`; `formatDate`, `formatDateOnly`.
- Produces: `/[locale]/admin/accounts`; components above; every `admin_accounts.*` key used by Tasks 15–16 (the full list is in Step 1, add it once).

- [ ] **Step 1: Add the i18n keys**

In `messages/es.json`, inside `"admin_dashboard"` after `"nav_customers": "Clientes",` add `"nav_accounts": "Cuentas",`. Then add this top-level namespace right before `"admin_metrics": {`:

```json
  "admin_accounts": {
    "title": "Cuentas",
    "subtitle": "Organizaciones con cuenta corriente: saldo, estados de cuenta y envíos programados.",
    "back_to_dashboard": "Volver al panel",
    "back_to_accounts": "Volver a cuentas",
    "new_account": "Nueva cuenta",
    "search_placeholder": "Buscar cuenta",
    "filter_all": "Todas",
    "filter_with_balance": "Con saldo",
    "filter_overdue": "Vencidas",
    "filter_paused": "Pausadas",
    "col_name": "Cuenta",
    "col_balance": "Saldo",
    "col_oldest": "Estado abierto",
    "col_next_issue": "Próximo cierre",
    "col_last_payment": "Último pago",
    "col_status": "Estado",
    "overdue": "Vencido",
    "empty": "Todavía no hay cuentas.",
    "status_active": "Activa",
    "status_paused": "Pausada",
    "status_closed": "Cerrada",
    "upcoming_title": "Próximos envíos (7 días)",
    "upcoming_empty": "Nada programado para los próximos 7 días.",
    "kind_statement": "Estado de cuenta",
    "kind_reminder": "Recordatorio",
    "kind_manual": "Manual",
    "channel_sms": "SMS",
    "channel_email": "Email",
    "channel_both": "SMS + email",
    "send_now": "Enviar ya",
    "skip": "Saltar",
    "reschedule": "Reprogramar",
    "reschedule_prompt": "Nueva fecha (AAAA-MM-DD)",
    "send_status_scheduled": "Programado",
    "send_status_sending": "Enviando",
    "send_status_sent": "Enviado",
    "send_status_skipped": "Saltado",
    "send_status_failed": "Falló",
    "send_status_canceled": "Cancelado",
    "form_name": "Nombre comercial",
    "form_billing_name": "Contacto de facturación",
    "form_billing_phone": "Teléfono (SMS)",
    "form_billing_email": "Email",
    "form_locale": "Idioma",
    "form_cadence": "Cadencia",
    "form_issue_day": "Día de emisión",
    "form_terms_days": "Plazo (días)",
    "form_statement_channel": "Canal del estado",
    "form_reminders": "Recordatorios",
    "form_notes": "Notas",
    "cadence_weekly": "Semanal",
    "cadence_biweekly": "Quincenal",
    "cadence_monthly": "Mensual",
    "weekday_0": "Domingo",
    "weekday_1": "Lunes",
    "weekday_2": "Martes",
    "weekday_3": "Miércoles",
    "weekday_4": "Jueves",
    "weekday_5": "Viernes",
    "weekday_6": "Sábado",
    "offset_hint": "días respecto al vencimiento (negativo = antes)",
    "add_step": "Agregar recordatorio",
    "remove": "Quitar",
    "save": "Guardar",
    "saved": "Guardado",
    "cancel": "Cancelar",
    "create": "Crear cuenta",
    "error_generic": "No se pudo completar. Revisa los datos.",
    "balance": "Saldo",
    "credit_balance": "Saldo a favor",
    "record_payment": "Registrar pago",
    "credit_or_adjustment": "Crédito / ajuste",
    "issue_now": "Emitir estado ahora",
    "nothing_to_issue": "Nada que emitir: sin movimientos ni saldo pendiente.",
    "pause": "Pausar",
    "resume": "Reactivar",
    "close_account": "Cerrar cuenta",
    "close_confirm": "¿Cerrar la cuenta? No se emitirán más estados ni se aceptarán órdenes a cuenta.",
    "section_plan": "Convenio",
    "section_statements": "Estados de cuenta",
    "section_ledger": "Movimientos",
    "section_contacts": "Contactos",
    "section_queue": "Cola de envíos",
    "st_number": "Número",
    "st_period": "Período",
    "st_due": "Vence",
    "st_closing": "Total",
    "st_due_amount": "Pendiente",
    "st_status": "Estado",
    "st_open": "Abierto",
    "st_paid": "Pagado",
    "st_void": "Anulado",
    "st_empty": "Todavía no hay estados de cuenta.",
    "view": "Ver",
    "copy_link": "Copiar link",
    "link_copied": "Copiado",
    "void": "Anular",
    "void_confirm": "¿Anular este estado? Sus cargos vuelven a 'sin facturar' y se cancelan sus envíos.",
    "void_error_paid": "No se puede anular un estado pagado.",
    "void_error_not_latest": "Solo se puede anular el estado más reciente.",
    "led_date": "Fecha",
    "led_detail": "Detalle",
    "led_amount": "Importe",
    "led_running": "Saldo",
    "led_empty": "Sin movimientos.",
    "kind_charge": "Cargo",
    "kind_payment": "Pago",
    "kind_credit": "Crédito",
    "kind_adjustment": "Ajuste",
    "kind_reversal": "Cancelación",
    "unbilled": "Sin facturar",
    "add_contact": "Agregar contacto",
    "contact_search_placeholder": "Buscar cliente por nombre o teléfono",
    "contact_no_results": "Sin resultados",
    "contact_taken": "Ese cliente ya pertenece a otra cuenta.",
    "contacts_empty": "Sin contactos vinculados. Las personas vinculadas se preseleccionan en el intake.",
    "pay_amount": "Monto",
    "pay_method": "Método",
    "pay_note": "Nota",
    "method_cash": "Efectivo",
    "method_zelle": "Zelle",
    "method_ach": "ACH",
    "method_check": "Cheque",
    "method_card_terminal": "Tarjeta",
    "method_stripe": "Stripe",
    "entry_credit": "Crédito",
    "entry_adjustment": "Ajuste",
    "entry_hint_credit": "Reduce el saldo y se aplica a las órdenes abiertas (monto positivo).",
    "entry_hint_adjustment": "Suma o resta sin tocar órdenes. Usa signo negativo para restar.",
    "send_channel_pick": "Enviar por",
    "send_error_no_channel": "Sin canal disponible: {reason}",
    "send_failed": "El envío falló: {reason}",
    "sent_ok": "Enviado.",
    "queue_when": "Cuándo",
    "queue_what": "Qué",
    "queue_channel": "Canal",
    "queue_status": "Estado",
    "queue_detail": "Detalle",
    "queue_empty": "Sin envíos."
  },
```

In `messages/en.json`, add `"nav_accounts": "Accounts",` in the same place, and the namespace:

```json
  "admin_accounts": {
    "title": "Accounts",
    "subtitle": "Organizations on account: balance, statements and scheduled sends.",
    "back_to_dashboard": "Back to dashboard",
    "back_to_accounts": "Back to accounts",
    "new_account": "New account",
    "search_placeholder": "Search accounts",
    "filter_all": "All",
    "filter_with_balance": "With balance",
    "filter_overdue": "Past due",
    "filter_paused": "Paused",
    "col_name": "Account",
    "col_balance": "Balance",
    "col_oldest": "Open statement",
    "col_next_issue": "Next close",
    "col_last_payment": "Last payment",
    "col_status": "Status",
    "overdue": "Past due",
    "empty": "No accounts yet.",
    "status_active": "Active",
    "status_paused": "Paused",
    "status_closed": "Closed",
    "upcoming_title": "Upcoming sends (7 days)",
    "upcoming_empty": "Nothing scheduled for the next 7 days.",
    "kind_statement": "Statement",
    "kind_reminder": "Reminder",
    "kind_manual": "Manual",
    "channel_sms": "SMS",
    "channel_email": "Email",
    "channel_both": "SMS + email",
    "send_now": "Send now",
    "skip": "Skip",
    "reschedule": "Reschedule",
    "reschedule_prompt": "New date (YYYY-MM-DD)",
    "send_status_scheduled": "Scheduled",
    "send_status_sending": "Sending",
    "send_status_sent": "Sent",
    "send_status_skipped": "Skipped",
    "send_status_failed": "Failed",
    "send_status_canceled": "Canceled",
    "form_name": "Business name",
    "form_billing_name": "Billing contact",
    "form_billing_phone": "Phone (SMS)",
    "form_billing_email": "Email",
    "form_locale": "Language",
    "form_cadence": "Cadence",
    "form_issue_day": "Issue day",
    "form_terms_days": "Terms (days)",
    "form_statement_channel": "Statement channel",
    "form_reminders": "Reminders",
    "form_notes": "Notes",
    "cadence_weekly": "Weekly",
    "cadence_biweekly": "Every two weeks",
    "cadence_monthly": "Monthly",
    "weekday_0": "Sunday",
    "weekday_1": "Monday",
    "weekday_2": "Tuesday",
    "weekday_3": "Wednesday",
    "weekday_4": "Thursday",
    "weekday_5": "Friday",
    "weekday_6": "Saturday",
    "offset_hint": "days relative to the due date (negative = before)",
    "add_step": "Add reminder",
    "remove": "Remove",
    "save": "Save",
    "saved": "Saved",
    "cancel": "Cancel",
    "create": "Create account",
    "error_generic": "Could not complete. Check the data.",
    "balance": "Balance",
    "credit_balance": "Credit balance",
    "record_payment": "Record payment",
    "credit_or_adjustment": "Credit / adjustment",
    "issue_now": "Issue statement now",
    "nothing_to_issue": "Nothing to issue: no activity and no balance due.",
    "pause": "Pause",
    "resume": "Resume",
    "close_account": "Close account",
    "close_confirm": "Close this account? No more statements will be issued and no orders can be charged to it.",
    "section_plan": "Terms",
    "section_statements": "Statements",
    "section_ledger": "Activity",
    "section_contacts": "Contacts",
    "section_queue": "Send queue",
    "st_number": "Number",
    "st_period": "Period",
    "st_due": "Due",
    "st_closing": "Total",
    "st_due_amount": "Outstanding",
    "st_status": "Status",
    "st_open": "Open",
    "st_paid": "Paid",
    "st_void": "Void",
    "st_empty": "No statements yet.",
    "view": "View",
    "copy_link": "Copy link",
    "link_copied": "Copied",
    "void": "Void",
    "void_confirm": "Void this statement? Its charges go back to 'unbilled' and its sends are canceled.",
    "void_error_paid": "A paid statement cannot be voided.",
    "void_error_not_latest": "Only the most recent statement can be voided.",
    "led_date": "Date",
    "led_detail": "Detail",
    "led_amount": "Amount",
    "led_running": "Balance",
    "led_empty": "No activity.",
    "kind_charge": "Charge",
    "kind_payment": "Payment",
    "kind_credit": "Credit",
    "kind_adjustment": "Adjustment",
    "kind_reversal": "Cancellation",
    "unbilled": "Unbilled",
    "add_contact": "Add contact",
    "contact_search_placeholder": "Search customers by name or phone",
    "contact_no_results": "No results",
    "contact_taken": "That customer already belongs to another account.",
    "contacts_empty": "No linked contacts. Linked people are preselected in the intake.",
    "pay_amount": "Amount",
    "pay_method": "Method",
    "pay_note": "Note",
    "method_cash": "Cash",
    "method_zelle": "Zelle",
    "method_ach": "ACH",
    "method_check": "Check",
    "method_card_terminal": "Card",
    "method_stripe": "Stripe",
    "entry_credit": "Credit",
    "entry_adjustment": "Adjustment",
    "entry_hint_credit": "Lowers the balance and is applied to open orders (positive amount).",
    "entry_hint_adjustment": "Adds or subtracts without touching orders. Use a negative sign to subtract.",
    "send_channel_pick": "Send by",
    "send_error_no_channel": "No channel available: {reason}",
    "send_failed": "Sending failed: {reason}",
    "sent_ok": "Sent.",
    "queue_when": "When",
    "queue_what": "What",
    "queue_channel": "Channel",
    "queue_status": "Status",
    "queue_detail": "Detail",
    "queue_empty": "No sends."
  },
```

Validate both files parse: `node -e "JSON.parse(require('fs').readFileSync('messages/es.json','utf8'));JSON.parse(require('fs').readFileSync('messages/en.json','utf8'))"`.

- [ ] **Step 2: Add the nav entry**

In `components/admin/dashboard/DashboardShell.tsx`:
- after `const isCustomers = ...` add `const isAccounts = pathname.includes("/admin/accounts");`
- add `&& !isAccounts` to the `isBandeja` expression
- right after the Clientes `<Link>` add:
  ```tsx
            <Link
              href={`/${locale}/admin/accounts`}
              className={`flex min-h-11 items-center rounded-lg px-3 ${isAccounts ? "bg-rouge text-bone" : "hover:bg-ink/5"}`}
            >
              {t("nav_accounts")}
            </Link>
  ```

- [ ] **Step 3: Write the failing render test**

```tsx
// tests/unit/AccountsView.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import esMessages from "@/messages/es.json";
import AccountsView from "@/components/admin/accounts/AccountsView";
import type { AccountListItem } from "@/lib/house-account-storage";
import type { UpcomingSend } from "@/lib/house-account-sends";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }) }));

const account: AccountListItem = {
  id: "ha_1", name: "Hotel Roslyn", locale: "es", cadence: "monthly", issueDay: 1, termsDays: 15, reminderPlan: [],
  statementChannel: "both", status: "active", createdAt: "2026-09-01T12:00:00Z", updatedAt: "2026-09-01T12:00:00Z",
  balanceCents: 70000, oldestOpen: { id: "hst_1", number: "ST-1001", dueDate: "2026-09-30", dueCents: 70000 },
  overdue: true, lastPaymentAt: null, nextIssueDate: "2026-11-01",
};
const upcoming: UpcomingSend = {
  id: "hsd_1", accountId: "ha_1", statementId: "hst_1", kind: "reminder", stepIndex: 0, channel: "sms",
  scheduledFor: "2026-10-05", status: "scheduled", createdAt: "2026-10-01T13:00:00Z",
  accountName: "Hotel Roslyn", statementNumber: "ST-1001", dueDate: "2026-10-16",
};

function wrap(ui: React.ReactNode) {
  return render(<NextIntlClientProvider locale="es" messages={esMessages as Record<string, unknown>}>{ui}</NextIntlClientProvider>);
}

describe("AccountsView", () => {
  it("lists accounts with balance, overdue badge and the upcoming strip", () => {
    wrap(<AccountsView locale="es" initialAccounts={[account]} initialUpcoming={[upcoming]} />);
    expect(screen.getAllByText("Hotel Roslyn").length).toBeGreaterThan(0);
    expect(screen.getByText("$700.00")).toBeDefined();
    expect(screen.getByText("Vencido")).toBeDefined();
    expect(screen.getByText("Próximos envíos (7 días)")).toBeDefined();
    expect(screen.getByText(/Recordatorio · ST-1001 · SMS/)).toBeDefined();
    expect(screen.getByRole("button", { name: "Enviar ya" })).toBeDefined();
  });
  it("shows the empty states", () => {
    wrap(<AccountsView locale="es" initialAccounts={[]} initialUpcoming={[]} />);
    expect(screen.getByText("Todavía no hay cuentas.")).toBeDefined();
    expect(screen.getByText("Nada programado para los próximos 7 días.")).toBeDefined();
  });
});
```

- [ ] **Step 4: Run to verify failure**

Run: `npm test -- tests/unit/AccountsView.test.tsx`
Expected: FAIL — component not found.

- [ ] **Step 5: Write the components and the page**

```tsx
// components/admin/accounts/AccountStatusBadge.tsx
"use client";
import { useTranslations } from "next-intl";
import type { AccountStatus } from "@/types/house-account";

const CLS: Record<AccountStatus, string> = {
  active: "bg-emerald-600/10 text-emerald-700",
  paused: "bg-amber-500/15 text-amber-700",
  closed: "bg-ink/10 text-ink/50",
};

export default function AccountStatusBadge({ status }: { status: AccountStatus }) {
  const t = useTranslations("admin_accounts");
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${CLS[status]}`}>{t(`status_${status}`)}</span>;
}
```

```tsx
// components/admin/accounts/UpcomingSends.tsx
"use client";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { formatDateOnly } from "@/lib/format-datetime";
import AdminButton from "@/components/admin/dashboard/AdminButton";
import type { UpcomingSend } from "@/lib/house-account-sends";

type Props = {
  locale: string;
  rows: UpcomingSend[];
  busy: boolean;
  onAction: (id: string, action: "sendNow" | "skip") => void;
};

export default function UpcomingSends({ locale, rows, busy, onAction }: Props) {
  const t = useTranslations("admin_accounts");
  return (
    <section className="mb-5 rounded-xl border border-ink/10 bg-bone p-3">
      <div className="mb-2 text-xs uppercase tracking-wide text-ink/50">{t("upcoming_title")}</div>
      {rows.length === 0 ? (
        <div className="text-sm text-ink/50">{t("upcoming_empty")}</div>
      ) : (
        <ul className="divide-y divide-ink/10">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
              <span className="w-28 tabular-nums text-ink/70">{formatDateOnly(r.scheduledFor, locale)}</span>
              <Link href={`/${locale}/admin/accounts/${r.accountId}`} className="font-medium underline decoration-ink/30 underline-offset-2 hover:decoration-ink">
                {r.accountName}
              </Link>
              <span className="text-ink/70">{t(`kind_${r.kind}`)} · {r.statementNumber} · {t(`channel_${r.channel}`)}</span>
              <span className="ml-auto flex gap-2">
                <AdminButton variant="primary" disabled={busy} onClick={() => onAction(r.id, "sendNow")}>{t("send_now")}</AdminButton>
                <AdminButton variant="secondary" disabled={busy} onClick={() => onAction(r.id, "skip")}>{t("skip")}</AdminButton>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
```

```tsx
// components/admin/accounts/NewAccountModal.tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import AdminButton from "@/components/admin/dashboard/AdminButton";

type Props = { locale: string; onClose: () => void };

const INPUT = "w-full rounded-lg border border-ink/20 bg-white px-3 py-2 text-sm";

export default function NewAccountModal({ locale, onClose }: Props) {
  const t = useTranslations("admin_accounts");
  const router = useRouter();
  const [name, setName] = useState("");
  const [billingName, setBillingName] = useState("");
  const [billingPhone, setBillingPhone] = useState("");
  const [billingEmail, setBillingEmail] = useState("");
  const [lang, setLang] = useState<"en" | "es">(locale === "es" ? "es" : "en");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/accounts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, billingName: billingName || undefined, billingPhone: billingPhone || undefined, billingEmail, locale: lang }),
      });
      if (!res.ok) { setError(t("error_generic")); return; }
      const { account } = (await res.json()) as { account: { id: string } };
      router.push(`/${locale}/admin/accounts/${account.id}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-ink/30 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl bg-bone p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-4 text-lg font-semibold">{t("new_account")}</h2>
        <div className="space-y-3">
          <label className="block text-sm"><span className="mb-1 block text-xs font-semibold">{t("form_name")}</span>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} className={INPUT} /></label>
          <label className="block text-sm"><span className="mb-1 block text-xs font-semibold">{t("form_billing_name")}</span>
            <input value={billingName} onChange={(e) => setBillingName(e.target.value)} className={INPUT} /></label>
          <label className="block text-sm"><span className="mb-1 block text-xs font-semibold">{t("form_billing_phone")}</span>
            <input inputMode="tel" value={billingPhone} onChange={(e) => setBillingPhone(e.target.value)} className={INPUT} /></label>
          <label className="block text-sm"><span className="mb-1 block text-xs font-semibold">{t("form_billing_email")}</span>
            <input inputMode="email" value={billingEmail} onChange={(e) => setBillingEmail(e.target.value)} className={INPUT} /></label>
          <label className="block text-sm"><span className="mb-1 block text-xs font-semibold">{t("form_locale")}</span>
            <select value={lang} onChange={(e) => setLang(e.target.value as "en" | "es")} className={INPUT}>
              <option value="es">Español</option><option value="en">English</option>
            </select></label>
        </div>
        {error && <p className="mt-3 text-sm text-error">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <AdminButton variant="secondary" disabled={busy} onClick={onClose}>{t("cancel")}</AdminButton>
          <AdminButton variant="primary" disabled={busy || name.trim().length === 0} onClick={submit}>{t("create")}</AdminButton>
        </div>
      </div>
    </div>
  );
}
```

```tsx
// components/admin/accounts/AccountsView.tsx
"use client";
import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowLeft, Plus } from "@phosphor-icons/react/dist/ssr";
import { formatDate, formatDateOnly } from "@/lib/format-datetime";
import type { AccountListItem, AccountFilter } from "@/lib/house-account-storage";
import type { UpcomingSend } from "@/lib/house-account-sends";
import AccountStatusBadge from "./AccountStatusBadge";
import UpcomingSends from "./UpcomingSends";
import NewAccountModal from "./NewAccountModal";

type Props = { locale: string; initialAccounts: AccountListItem[]; initialUpcoming: UpcomingSend[] };

function money(c: number) {
  return `${c < 0 ? "−" : ""}$${(Math.abs(c) / 100).toFixed(2)}`;
}

const FILTERS: AccountFilter[] = ["all", "with_balance", "overdue", "paused"];

export default function AccountsView({ locale, initialAccounts, initialUpcoming }: Props) {
  const t = useTranslations("admin_accounts");
  const [accounts, setAccounts] = useState(initialAccounts);
  const [upcoming, setUpcoming] = useState(initialUpcoming);
  const [filter, setFilter] = useState<AccountFilter>("all");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);

  async function refresh(f: AccountFilter = filter, query: string = q) {
    const res = await fetch(`/api/admin/accounts?filter=${f}&q=${encodeURIComponent(query)}`, { cache: "no-store" });
    if (!res.ok) return;
    const d = (await res.json()) as { accounts: AccountListItem[]; upcoming: UpcomingSend[] };
    setAccounts(d.accounts);
    setUpcoming(d.upcoming);
  }

  async function sendAction(id: string, action: "sendNow" | "skip") {
    setBusy(true);
    try {
      await fetch(`/api/admin/accounts/sends/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(action === "skip" ? { skip: true } : { sendNow: true }),
      });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <Link href={`/${locale}/admin/dashboard`} className="mb-2 inline-flex items-center gap-1.5 text-sm text-rouge hover:underline">
        <ArrowLeft size={15} weight="bold" /> {t("back_to_dashboard")}
      </Link>
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl text-ink">{t("title")}</h1>
          <p className="mt-1 text-sm text-ink/55">{t("subtitle")}</p>
        </div>
        <button type="button" onClick={() => setCreating(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-rouge px-4 py-2.5 text-sm font-bold text-bone hover:bg-rouge/90">
          <Plus size={16} weight="bold" /> {t("new_account")}
        </button>
      </div>

      <UpcomingSends locale={locale} rows={upcoming} busy={busy} onAction={sendAction} />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button key={f} type="button" onClick={() => { setFilter(f); void refresh(f); }}
            className={`flex min-h-11 items-center rounded-lg px-3 text-sm ${filter === f ? "bg-rouge text-bone" : "border border-ink/20 hover:bg-ink/5"}`}>
            {t(`filter_${f}`)}
          </button>
        ))}
        <input value={q} placeholder={t("search_placeholder")} aria-label={t("search_placeholder")}
          onChange={(e) => { setQ(e.target.value); void refresh(filter, e.target.value); }}
          className="ml-auto min-h-11 w-56 rounded-lg border border-ink/20 bg-white px-3 text-sm" />
      </div>

      {accounts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-ink/15 bg-bone p-10 text-center text-ink/55">{t("empty")}</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-ink/10 bg-bone">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-ink/50">
                <th className="px-3 py-2">{t("col_name")}</th>
                <th className="px-3 py-2 text-right">{t("col_balance")}</th>
                <th className="px-3 py-2">{t("col_oldest")}</th>
                <th className="px-3 py-2">{t("col_next_issue")}</th>
                <th className="px-3 py-2">{t("col_last_payment")}</th>
                <th className="px-3 py-2">{t("col_status")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/10">
              {accounts.map((a) => (
                <tr key={a.id}>
                  <td className="px-3 py-2">
                    <Link href={`/${locale}/admin/accounts/${a.id}`} className="font-medium underline decoration-ink/30 underline-offset-2 hover:decoration-ink">{a.name}</Link>
                  </td>
                  <td className={`px-3 py-2 text-right tabular-nums ${a.balanceCents > 0 ? "font-semibold" : "text-ink/60"}`}>{money(a.balanceCents)}</td>
                  <td className="px-3 py-2">
                    {a.oldestOpen ? (
                      <span>
                        {a.oldestOpen.number} · {formatDateOnly(a.oldestOpen.dueDate, locale)}
                        {a.overdue && <span className="ml-2 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">{t("overdue")}</span>}
                      </span>
                    ) : <span className="text-ink/40">—</span>}
                  </td>
                  <td className="px-3 py-2 tabular-nums">{a.status === "active" ? formatDateOnly(a.nextIssueDate, locale) : <span className="text-ink/40">—</span>}</td>
                  <td className="px-3 py-2 tabular-nums">{a.lastPaymentAt ? formatDate(a.lastPaymentAt, locale) : <span className="text-ink/40">—</span>}</td>
                  <td className="px-3 py-2"><AccountStatusBadge status={a.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {creating && <NewAccountModal locale={locale} onClose={() => setCreating(false)} />}
    </div>
  );
}
```

```tsx
// app/[locale]/admin/accounts/page.tsx
import DashboardShell from "@/components/admin/dashboard/DashboardShell";
import AccountsView from "@/components/admin/accounts/AccountsView";
import { listAccounts } from "@/lib/house-account-storage";
import { upcomingSends } from "@/lib/house-account-sends";
import { shopDateStr } from "@/lib/tv-slots";

export const dynamic = "force-dynamic";

export default async function AdminAccountsPage({ params }: { params: Promise<{ locale: "en" | "es" }> }) {
  const { locale } = await params;
  const today = shopDateStr(new Date());
  return (
    <DashboardShell locale={locale}>
      <AccountsView locale={locale} initialAccounts={listAccounts({ today })} initialUpcoming={upcomingSends(7, today)} />
    </DashboardShell>
  );
}
```

- [ ] **Step 6: Run the test and the type check**

Run: `npm test -- tests/unit/AccountsView.test.tsx && npx tsc --noEmit`
Expected: PASS, no type errors. (If next-intl complains about the dynamic `t(\`status_${status}\`)` keys under strict typing, the project already does `t("slot." + f.window.slot)` in the drawer — follow the same cast it uses, if any.)

- [ ] **Step 7: Look at it**

Start the dev server (`preview_start` with the project's launch config, or `npm run dev`), open `/es/admin/accounts`, create an account through the modal, confirm the nav highlights "Cuentas" and the empty states render.

- [ ] **Step 8: Commit**

```bash
git add messages/es.json messages/en.json components/admin/dashboard/DashboardShell.tsx "app/[locale]/admin/accounts/page.tsx" components/admin/accounts tests/unit/AccountsView.test.tsx
git commit -m "feat(accounts): admin accounts list with upcoming-sends strip and new-account modal

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 16: Account detail page (plan, statements, ledger, contacts, queue, payment and entry modals)

**Files:**
- Create: `app/[locale]/admin/accounts/[id]/page.tsx`
- Create: `components/admin/accounts/AccountDetail.tsx`
- Create: `components/admin/accounts/PlanEditor.tsx`
- Create: `components/admin/accounts/StatementsTable.tsx`
- Create: `components/admin/accounts/LedgerTable.tsx`
- Create: `components/admin/accounts/ContactsList.tsx`
- Create: `components/admin/accounts/SendsQueue.tsx`
- Create: `components/admin/accounts/PaymentModal.tsx`
- Create: `components/admin/accounts/EntryModal.tsx`
- Test: `tests/unit/AccountDetail.test.tsx`

**Interfaces:**
- Consumes: `getAccountDetail`, `AccountDetailData`, `StatementView`, `LedgerView` (Task 14); the Task 14 routes; `OrderDetailDrawer`; `AdminButton`; `AccountStatusBadge` (Task 15); `GET /api/admin/customers?q=` which returns `{ customers: CustomerListItem[] }` (`lib/customer-storage.ts:261`); i18n keys from Task 15.
- Produces: `/[locale]/admin/accounts/[id]`.

- [ ] **Step 1: Write the failing render test**

```tsx
// tests/unit/AccountDetail.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import esMessages from "@/messages/es.json";
import AccountDetail from "@/components/admin/accounts/AccountDetail";
import type { AccountDetailData } from "@/lib/house-account-detail";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }) }));

const data: AccountDetailData = {
  account: {
    id: "ha_1", name: "Hotel Roslyn", billingName: "Ana", billingPhone: "5165550100", billingEmail: "ap@hotel.com", locale: "es",
    cadence: "monthly", issueDay: 1, termsDays: 15, reminderPlan: [{ offsetDays: -3, channel: "sms" }], statementChannel: "both",
    status: "active", createdAt: "2026-09-01T12:00:00Z", updatedAt: "2026-09-01T12:00:00Z",
  },
  balanceCents: 7000,
  statements: [{
    id: "hst_1", accountId: "ha_1", number: "ST-1001", code: "AbCdEfGh", periodStart: "2026-09-01", periodEnd: "2026-09-30",
    issuedAt: "2026-10-01T13:00:00Z", dueDate: "2026-10-16", openingCents: 0, chargesCents: 8000, creditsCents: 0, paymentsCents: 1000,
    closingCents: 7000, settledCents: 0, status: "open", lines: [], createdAt: "2026-10-01T13:00:00Z", dueCents: 7000,
  }],
  entries: [
    { id: "e1", accountId: "ha_1", kind: "charge", amountCents: 8000, orderId: "o1", statementId: "hst_1", actor: "maky", createdAt: "2026-09-10T12:00:00Z", runningCents: 8000 },
    { id: "e2", accountId: "ha_1", kind: "payment", amountCents: -1000, method: "zelle", statementId: "hst_1", actor: "maky", createdAt: "2026-09-25T12:00:00Z", runningCents: 7000 },
  ],
  contacts: [],
  sends: [{ id: "s1", accountId: "ha_1", statementId: "hst_1", kind: "reminder", stepIndex: 0, channel: "sms", scheduledFor: "2026-10-13", status: "scheduled", createdAt: "2026-10-01T13:00:00Z" }],
};

function wrap(ui: React.ReactNode) {
  return render(<NextIntlClientProvider locale="es" messages={esMessages as Record<string, unknown>}>{ui}</NextIntlClientProvider>);
}

describe("AccountDetail", () => {
  it("renders header, sections, statement, ledger and queue rows", () => {
    wrap(<AccountDetail locale="es" initial={data} />);
    expect(screen.getByRole("heading", { name: "Hotel Roslyn" })).toBeDefined();
    expect(screen.getAllByText("$70.00").length).toBeGreaterThan(0);
    for (const title of ["Convenio", "Estados de cuenta", "Movimientos", "Contactos", "Cola de envíos"]) {
      expect(screen.getByText(title)).toBeDefined();
    }
    expect(screen.getByText("ST-1001")).toBeDefined();
    expect(screen.getByText("Pago · Zelle")).toBeDefined();
    expect(screen.getByText("Sin contactos vinculados. Las personas vinculadas se preseleccionan en el intake.")).toBeDefined();
    expect(screen.getByText("Programado")).toBeDefined();
    expect(screen.getByRole("button", { name: "Registrar pago" })).toBeDefined();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- tests/unit/AccountDetail.test.tsx`
Expected: FAIL — component not found.

- [ ] **Step 3: Write the leaf components**

```tsx
// components/admin/accounts/PlanEditor.tsx
"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import AdminButton from "@/components/admin/dashboard/AdminButton";
import type { HouseAccount, AccountCadence, SendChannel, ReminderStep } from "@/types/house-account";

export type PlanPatch = {
  name: string; billingName: string; billingPhone: string; billingEmail: string; locale: "en" | "es";
  cadence: AccountCadence; issueDay: number; termsDays: number; statementChannel: SendChannel;
  reminderPlan: ReminderStep[]; notes: string;
};
type Props = { account: HouseAccount; busy: boolean; onSave: (patch: PlanPatch) => Promise<boolean> };

const INPUT = "w-full rounded-lg border border-ink/20 bg-white px-3 py-2 text-sm";
const CADENCES: AccountCadence[] = ["weekly", "biweekly", "monthly"];
const CHANNELS: SendChannel[] = ["sms", "email", "both"];

export default function PlanEditor({ account, busy, onSave }: Props) {
  const t = useTranslations("admin_accounts");
  const [f, setF] = useState<PlanPatch>({
    name: account.name, billingName: account.billingName ?? "", billingPhone: account.billingPhone ?? "",
    billingEmail: account.billingEmail ?? "", locale: account.locale, cadence: account.cadence, issueDay: account.issueDay,
    termsDays: account.termsDays, statementChannel: account.statementChannel,
    reminderPlan: account.reminderPlan.map((s) => ({ ...s })), notes: account.notes ?? "",
  });
  const [saved, setSaved] = useState(false);

  function set<K extends keyof PlanPatch>(k: K, v: PlanPatch[K]) {
    setSaved(false);
    setF((p) => ({ ...p, [k]: v }));
  }
  function setCadence(c: AccountCadence) {
    setSaved(false);
    setF((p) => ({ ...p, cadence: c, issueDay: c === "monthly" ? Math.min(Math.max(p.issueDay, 1), 28) : Math.min(p.issueDay, 6) }));
  }
  function setStep(i: number, step: ReminderStep) {
    set("reminderPlan", f.reminderPlan.map((s, j) => (j === i ? step : s)));
  }

  const field = (label: string, el: React.ReactNode) => (
    <label className="block text-sm"><span className="mb-1 block text-xs font-semibold">{label}</span>{el}</label>
  );

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {field(t("form_name"), <input value={f.name} onChange={(e) => set("name", e.target.value)} className={INPUT} />)}
      {field(t("form_billing_name"), <input value={f.billingName} onChange={(e) => set("billingName", e.target.value)} className={INPUT} />)}
      {field(t("form_billing_phone"), <input inputMode="tel" value={f.billingPhone} onChange={(e) => set("billingPhone", e.target.value)} className={INPUT} />)}
      {field(t("form_billing_email"), <input inputMode="email" value={f.billingEmail} onChange={(e) => set("billingEmail", e.target.value)} className={INPUT} />)}
      {field(t("form_locale"),
        <select value={f.locale} onChange={(e) => set("locale", e.target.value as "en" | "es")} className={INPUT}>
          <option value="es">Español</option><option value="en">English</option>
        </select>)}
      {field(t("form_cadence"),
        <select value={f.cadence} onChange={(e) => setCadence(e.target.value as AccountCadence)} className={INPUT}>
          {CADENCES.map((c) => <option key={c} value={c}>{t(`cadence_${c}`)}</option>)}
        </select>)}
      {field(t("form_issue_day"),
        f.cadence === "monthly" ? (
          <input type="number" min={1} max={28} value={f.issueDay} onChange={(e) => set("issueDay", Number(e.target.value))} className={INPUT} />
        ) : (
          <select value={f.issueDay} onChange={(e) => set("issueDay", Number(e.target.value))} className={INPUT}>
            {[0, 1, 2, 3, 4, 5, 6].map((d) => <option key={d} value={d}>{t(`weekday_${d}`)}</option>)}
          </select>
        ))}
      {field(t("form_terms_days"), <input type="number" min={0} max={120} value={f.termsDays} onChange={(e) => set("termsDays", Number(e.target.value))} className={INPUT} />)}
      {field(t("form_statement_channel"),
        <select value={f.statementChannel} onChange={(e) => set("statementChannel", e.target.value as SendChannel)} className={INPUT}>
          {CHANNELS.map((c) => <option key={c} value={c}>{t(`channel_${c}`)}</option>)}
        </select>)}
      <div className="text-sm md:col-span-2">
        <span className="mb-1 block text-xs font-semibold">{t("form_reminders")}</span>
        <ul className="space-y-2">
          {f.reminderPlan.map((s, i) => (
            <li key={i} className="flex flex-wrap items-center gap-2">
              <input type="number" min={-60} max={120} value={s.offsetDays} aria-label={t("offset_hint")}
                onChange={(e) => setStep(i, { ...s, offsetDays: Number(e.target.value) })} className="w-20 rounded-lg border border-ink/20 bg-white px-2 py-1.5 text-sm" />
              <span className="text-xs text-ink/60">{t("offset_hint")}</span>
              <select value={s.channel} onChange={(e) => setStep(i, { ...s, channel: e.target.value as SendChannel })} className="rounded-lg border border-ink/20 bg-white px-2 py-1.5 text-sm">
                {CHANNELS.map((c) => <option key={c} value={c}>{t(`channel_${c}`)}</option>)}
              </select>
              <button type="button" onClick={() => set("reminderPlan", f.reminderPlan.filter((_, j) => j !== i))} className="text-xs text-error underline">{t("remove")}</button>
            </li>
          ))}
        </ul>
        <button type="button" onClick={() => set("reminderPlan", [...f.reminderPlan, { offsetDays: 0, channel: "sms" }])} className="mt-2 text-xs text-rouge underline">{t("add_step")}</button>
      </div>
      <div className="md:col-span-2">{field(t("form_notes"), <textarea value={f.notes} onChange={(e) => set("notes", e.target.value)} rows={2} className={INPUT} />)}</div>
      <div className="flex items-center gap-3 md:col-span-2">
        <AdminButton variant="primary" disabled={busy || f.name.trim().length === 0} onClick={async () => setSaved(await onSave(f))}>{t("save")}</AdminButton>
        {saved && <span className="text-xs text-success">{t("saved")}</span>}
      </div>
    </div>
  );
}
```

```tsx
// components/admin/accounts/StatementsTable.tsx
"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { formatDateOnly } from "@/lib/format-datetime";
import AdminButton from "@/components/admin/dashboard/AdminButton";
import type { StatementView } from "@/lib/house-account-detail";
import type { SendChannel } from "@/types/house-account";

type Props = {
  locale: string; statements: StatementView[]; defaultChannel: SendChannel; busy: boolean;
  onSend: (sid: string, channel: SendChannel) => void; onVoid: (sid: string) => void;
};
function money(c: number) { return `$${(c / 100).toFixed(2)}`; }
const STATUS_CLS: Record<string, string> = { open: "bg-amber-500/15 text-amber-700", paid: "bg-emerald-600/10 text-emerald-700", void: "bg-ink/10 text-ink/45 line-through" };

export default function StatementsTable({ locale, statements, defaultChannel, busy, onSend, onVoid }: Props) {
  const t = useTranslations("admin_accounts");
  const [channel, setChannel] = useState<Record<string, SendChannel>>({});
  const [copied, setCopied] = useState<string | null>(null);
  if (statements.length === 0) return <div className="text-sm text-ink/50">{t("st_empty")}</div>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="text-left text-xs uppercase tracking-wide text-ink/50">
          <th className="px-2 py-1">{t("st_number")}</th><th className="px-2 py-1">{t("st_period")}</th><th className="px-2 py-1">{t("st_due")}</th>
          <th className="px-2 py-1 text-right">{t("st_closing")}</th><th className="px-2 py-1 text-right">{t("st_due_amount")}</th><th className="px-2 py-1">{t("st_status")}</th><th className="px-2 py-1"></th>
        </tr></thead>
        <tbody className="divide-y divide-ink/10">
          {statements.map((s) => (
            <tr key={s.id}>
              <td className="px-2 py-2 font-medium">{s.number}</td>
              <td className="px-2 py-2 tabular-nums">{formatDateOnly(s.periodStart, locale)} – {formatDateOnly(s.periodEnd, locale)}</td>
              <td className="px-2 py-2 tabular-nums">{formatDateOnly(s.dueDate, locale)}</td>
              <td className="px-2 py-2 text-right tabular-nums">{money(s.closingCents)}</td>
              <td className="px-2 py-2 text-right tabular-nums">{money(s.dueCents)}</td>
              <td className="px-2 py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_CLS[s.status]}`}>{t(`st_${s.status}`)}</span></td>
              <td className="px-2 py-2">
                <div className="flex flex-wrap items-center gap-1">
                  <AdminButton variant="secondary" href={`/s/${s.code}`} target="_blank" rel="noreferrer">{t("view")}</AdminButton>
                  <AdminButton variant="secondary" onClick={async () => {
                    await navigator.clipboard.writeText(`${window.location.origin}/s/${s.code}`);
                    setCopied(s.id); setTimeout(() => setCopied(null), 1500);
                  }}>{copied === s.id ? t("link_copied") : t("copy_link")}</AdminButton>
                  {s.status !== "void" && (
                    <>
                      <select aria-label={t("send_channel_pick")} value={channel[s.id] ?? defaultChannel}
                        onChange={(e) => setChannel((c) => ({ ...c, [s.id]: e.target.value as SendChannel }))}
                        className="rounded-lg border border-ink/20 bg-white px-2 py-1.5 text-sm">
                        {(["sms", "email", "both"] as SendChannel[]).map((c) => <option key={c} value={c}>{t(`channel_${c}`)}</option>)}
                      </select>
                      <AdminButton variant="primary" disabled={busy} onClick={() => onSend(s.id, channel[s.id] ?? defaultChannel)}>{t("send_now")}</AdminButton>
                    </>
                  )}
                  {s.status === "open" && (
                    <AdminButton variant="danger" disabled={busy} onClick={() => { if (window.confirm(t("void_confirm"))) onVoid(s.id); }}>{t("void")}</AdminButton>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

```tsx
// components/admin/accounts/LedgerTable.tsx
"use client";
import { useTranslations } from "next-intl";
import { formatDate } from "@/lib/format-datetime";
import type { LedgerView } from "@/lib/house-account-detail";
import type { AccountPaymentMethod } from "@/types/house-account";

type Props = { locale: string; entries: LedgerView[]; onOpenOrder: (orderId: string) => void };
function money(c: number) { return `${c < 0 ? "−" : ""}$${(Math.abs(c) / 100).toFixed(2)}`; }
const METHOD_KEY: Record<AccountPaymentMethod, string> = {
  cash: "method_cash", zelle: "method_zelle", ach: "method_ach", check: "method_check", "card-terminal": "method_card_terminal", stripe: "method_stripe",
};

export default function LedgerTable({ locale, entries, onOpenOrder }: Props) {
  const t = useTranslations("admin_accounts");
  if (entries.length === 0) return <div className="text-sm text-ink/50">{t("led_empty")}</div>;
  return (
    <table className="w-full text-sm">
      <thead><tr className="text-left text-xs uppercase tracking-wide text-ink/50">
        <th className="px-2 py-1">{t("led_date")}</th><th className="px-2 py-1">{t("led_detail")}</th>
        <th className="px-2 py-1 text-right">{t("led_amount")}</th><th className="px-2 py-1 text-right">{t("led_running")}</th>
      </tr></thead>
      <tbody className="divide-y divide-ink/10">
        {entries.map((e) => (
          <tr key={e.id}>
            <td className="px-2 py-2 tabular-nums text-ink/70">{formatDate(e.createdAt, locale)}</td>
            <td className="px-2 py-2">
              <span className="font-medium">{t(`kind_${e.kind}`)}{e.method ? ` · ${t(METHOD_KEY[e.method])}` : ""}</span>
              {e.orderId && (
                <button type="button" onClick={() => onOpenOrder(e.orderId!)} className="ml-2 underline decoration-ink/30 underline-offset-2 hover:decoration-ink">
                  #{e.orderId.slice(-6)}
                </button>
              )}
              {e.note && <span className="text-ink/60"> · {e.note}</span>}
              {!e.statementId && e.kind !== "payment" && (
                <span className="ml-2 rounded-full bg-ink/5 px-2 py-0.5 text-xs text-ink/60">{t("unbilled")}</span>
              )}
            </td>
            <td className={`px-2 py-2 text-right tabular-nums ${e.amountCents < 0 ? "text-emerald-700" : ""}`}>{money(e.amountCents)}</td>
            <td className="px-2 py-2 text-right tabular-nums text-ink/70">{money(e.runningCents)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

```tsx
// components/admin/accounts/ContactsList.tsx
"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import AdminButton from "@/components/admin/dashboard/AdminButton";
import type { Customer } from "@/lib/customer-storage";

type Props = { locale: string; accountId: string; contacts: Customer[]; busy: boolean; onChanged: () => void };
type Hit = { id: string; name: string; phone: string };

export default function ContactsList({ locale, accountId, contacts, busy, onChanged }: Props) {
  const t = useTranslations("admin_accounts");
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!adding || q.trim().length < 2) { setHits([]); return; }
    let cancelled = false;
    const h = setTimeout(async () => {
      const res = await fetch(`/api/admin/customers?q=${encodeURIComponent(q.trim())}&limit=8`, { cache: "no-store" });
      if (!res.ok || cancelled) return;
      const d = (await res.json()) as { customers: Hit[] };
      if (!cancelled) setHits(d.customers.map((c) => ({ id: c.id, name: c.name, phone: c.phone })));
    }, 200);
    return () => { cancelled = true; clearTimeout(h); };
  }, [q, adding]);

  async function link(customerId: string) {
    setError(null);
    const res = await fetch(`/api/admin/accounts/${accountId}/contacts`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ customerId }),
    });
    if (res.status === 409) { setError(t("contact_taken")); return; }
    if (!res.ok) { setError(t("error_generic")); return; }
    setAdding(false); setQ(""); onChanged();
  }
  async function unlink(customerId: string) {
    await fetch(`/api/admin/accounts/${accountId}/contacts`, {
      method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ customerId }),
    });
    onChanged();
  }

  return (
    <div>
      {contacts.length === 0 ? <p className="text-sm text-ink/50">{t("contacts_empty")}</p> : (
        <ul className="divide-y divide-ink/10 text-sm">
          {contacts.map((c) => (
            <li key={c.id} className="flex items-center gap-3 py-2">
              <Link href={`/${locale}/admin/customers/${c.id}`} className="font-medium underline decoration-ink/30 underline-offset-2 hover:decoration-ink">{c.name}</Link>
              <span className="text-ink/60">{c.phone}</span>
              <button type="button" disabled={busy} onClick={() => unlink(c.id)} className="ml-auto text-xs text-error underline">{t("remove")}</button>
            </li>
          ))}
        </ul>
      )}
      {adding ? (
        <div className="mt-3">
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("contact_search_placeholder")}
            className="w-full rounded-lg border border-ink/20 bg-white px-3 py-2 text-sm" />
          {q.trim().length >= 2 && (
            <ul className="mt-1 divide-y divide-ink/10 rounded-lg border border-ink/10 bg-white text-sm">
              {hits.length === 0 && <li className="px-3 py-2 text-ink/50">{t("contact_no_results")}</li>}
              {hits.map((h) => (
                <li key={h.id}>
                  <button type="button" onClick={() => link(h.id)} className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-ink/5">
                    <span className="font-medium">{h.name}</span><span className="text-ink/60">{h.phone}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {error && <p className="mt-2 text-xs text-error">{error}</p>}
          <div className="mt-2"><AdminButton variant="secondary" onClick={() => { setAdding(false); setQ(""); setError(null); }}>{t("cancel")}</AdminButton></div>
        </div>
      ) : (
        <div className="mt-3"><AdminButton variant="secondary" disabled={busy} onClick={() => setAdding(true)}>{t("add_contact")}</AdminButton></div>
      )}
    </div>
  );
}
```

```tsx
// components/admin/accounts/SendsQueue.tsx
"use client";
import { useTranslations } from "next-intl";
import { formatDateOnly } from "@/lib/format-datetime";
import AdminButton from "@/components/admin/dashboard/AdminButton";
import type { ScheduledSend } from "@/types/house-account";

type Props = { locale: string; sends: ScheduledSend[]; numbers: Record<string, string>; busy: boolean; onAction: (id: string, action: "sendNow" | "skip" | "reschedule", date?: string) => void };
const STATUS_CLS: Record<string, string> = {
  scheduled: "bg-sky-100 text-sky-800", sending: "bg-sky-100 text-sky-800", sent: "bg-emerald-600/10 text-emerald-700",
  skipped: "bg-ink/10 text-ink/55", failed: "bg-rose-100 text-rose-700", canceled: "bg-ink/10 text-ink/45 line-through",
};

export default function SendsQueue({ locale, sends, numbers, busy, onAction }: Props) {
  const t = useTranslations("admin_accounts");
  if (sends.length === 0) return <div className="text-sm text-ink/50">{t("queue_empty")}</div>;
  return (
    <table className="w-full text-sm">
      <thead><tr className="text-left text-xs uppercase tracking-wide text-ink/50">
        <th className="px-2 py-1">{t("queue_when")}</th><th className="px-2 py-1">{t("queue_what")}</th><th className="px-2 py-1">{t("queue_channel")}</th>
        <th className="px-2 py-1">{t("queue_status")}</th><th className="px-2 py-1">{t("queue_detail")}</th><th className="px-2 py-1"></th>
      </tr></thead>
      <tbody className="divide-y divide-ink/10">
        {sends.map((s) => (
          <tr key={s.id}>
            <td className="px-2 py-2 tabular-nums">{formatDateOnly(s.scheduledFor, locale)}</td>
            <td className="px-2 py-2">{t(`kind_${s.kind}`)} · {numbers[s.statementId] ?? s.statementId}</td>
            <td className="px-2 py-2">{t(`channel_${s.channel}`)}</td>
            <td className="px-2 py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_CLS[s.status]}`}>{t(`send_status_${s.status}`)}</span></td>
            <td className="max-w-xs truncate px-2 py-2 text-xs text-ink/60" title={s.error ?? s.body ?? ""}>{s.error ?? (s.smsSid ? s.smsSid : "")}</td>
            <td className="px-2 py-2">
              {s.status === "scheduled" && (
                <div className="flex gap-1">
                  <AdminButton variant="primary" disabled={busy} onClick={() => onAction(s.id, "sendNow")}>{t("send_now")}</AdminButton>
                  <AdminButton variant="secondary" disabled={busy} onClick={() => onAction(s.id, "skip")}>{t("skip")}</AdminButton>
                  <AdminButton variant="secondary" disabled={busy} onClick={() => {
                    const d = window.prompt(t("reschedule_prompt"), s.scheduledFor);
                    if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) onAction(s.id, "reschedule", d);
                  }}>{t("reschedule")}</AdminButton>
                </div>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

```tsx
// components/admin/accounts/PaymentModal.tsx
"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import AdminButton from "@/components/admin/dashboard/AdminButton";

type Method = "cash" | "zelle" | "ach" | "check" | "card-terminal";
const METHODS: { id: Method; key: string }[] = [
  { id: "cash", key: "method_cash" }, { id: "zelle", key: "method_zelle" }, { id: "ach", key: "method_ach" },
  { id: "check", key: "method_check" }, { id: "card-terminal", key: "method_card_terminal" },
];
type Props = { accountId: string; onClose: () => void; onDone: () => void };

export default function PaymentModal({ accountId, onClose, onDone }: Props) {
  const t = useTranslations("admin_accounts");
  const [text, setText] = useState("");
  const [method, setMethod] = useState<Method>("zelle");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cents = Math.round(parseFloat(text) * 100);
  const valid = Number.isFinite(cents) && cents > 0;

  async function submit() {
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/admin/accounts/${accountId}/payments`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ amountCents: cents, method, note: note.trim() || undefined }),
      });
      if (!res.ok) { setError(t("error_generic")); return; }
      onDone();
    } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-ink/30 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl bg-bone p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-4 text-lg font-semibold">{t("record_payment")}</h2>
        <label className="block text-sm"><span className="mb-1 block text-xs font-semibold">{t("pay_amount")}</span>
          <div className="relative"><span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/50">$</span>
            <input autoFocus inputMode="decimal" value={text} placeholder="0.00" onChange={(e) => setText(e.target.value.replace(/[^0-9.]/g, ""))}
              onKeyDown={(e) => { if (e.key === "Enter" && valid) void submit(); }}
              className="w-full rounded-lg border border-ink/20 bg-white py-2 pl-6 pr-3 text-sm tabular-nums" /></div></label>
        <div className="mt-3 text-sm"><span className="mb-1 block text-xs font-semibold">{t("pay_method")}</span>
          <div className="flex flex-wrap gap-1.5">
            {METHODS.map((m) => (
              <button key={m.id} type="button" aria-pressed={method === m.id} onClick={() => setMethod(m.id)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium ${method === m.id ? "border-ink bg-ink text-bone" : "border-ink/20 bg-white text-ink/70 hover:border-ink"}`}>{t(m.key)}</button>
            ))}
          </div></div>
        <label className="mt-3 block text-sm"><span className="mb-1 block text-xs font-semibold">{t("pay_note")}</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} className="w-full rounded-lg border border-ink/20 bg-white px-3 py-2 text-sm" /></label>
        {error && <p className="mt-3 text-sm text-error">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <AdminButton variant="secondary" disabled={busy} onClick={onClose}>{t("cancel")}</AdminButton>
          <AdminButton variant="primary" disabled={busy || !valid} onClick={submit}>{t("save")}</AdminButton>
        </div>
      </div>
    </div>
  );
}
```

```tsx
// components/admin/accounts/EntryModal.tsx
"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import AdminButton from "@/components/admin/dashboard/AdminButton";

type Props = { accountId: string; onClose: () => void; onDone: () => void };

export default function EntryModal({ accountId, onClose, onDone }: Props) {
  const t = useTranslations("admin_accounts");
  const [kind, setKind] = useState<"credit" | "adjustment">("credit");
  const [text, setText] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cents = Math.round(parseFloat(text) * 100);
  const valid = Number.isFinite(cents) && (kind === "credit" ? cents > 0 : cents !== 0) && note.trim().length > 0;

  async function submit() {
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/admin/accounts/${accountId}/entries`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind, amountCents: cents, note: note.trim() }),
      });
      if (!res.ok) { setError(t("error_generic")); return; }
      onDone();
    } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-ink/30 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl bg-bone p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-4 text-lg font-semibold">{t("credit_or_adjustment")}</h2>
        <div className="mb-3 flex gap-1.5">
          {(["credit", "adjustment"] as const).map((k) => (
            <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium ${kind === k ? "border-ink bg-ink text-bone" : "border-ink/20 bg-white text-ink/70 hover:border-ink"}`}>{t(`entry_${k}`)}</button>
          ))}
        </div>
        <p className="mb-3 text-xs text-ink/60">{t(kind === "credit" ? "entry_hint_credit" : "entry_hint_adjustment")}</p>
        <label className="block text-sm"><span className="mb-1 block text-xs font-semibold">{t("pay_amount")}</span>
          <input autoFocus inputMode="decimal" value={text} placeholder="0.00" onChange={(e) => setText(e.target.value.replace(/[^0-9.\-]/g, ""))}
            className="w-full rounded-lg border border-ink/20 bg-white px-3 py-2 text-sm tabular-nums" /></label>
        <label className="mt-3 block text-sm"><span className="mb-1 block text-xs font-semibold">{t("pay_note")}</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} className="w-full rounded-lg border border-ink/20 bg-white px-3 py-2 text-sm" /></label>
        {error && <p className="mt-3 text-sm text-error">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <AdminButton variant="secondary" disabled={busy} onClick={onClose}>{t("cancel")}</AdminButton>
          <AdminButton variant="primary" disabled={busy || !valid} onClick={submit}>{t("save")}</AdminButton>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Write the container and the page**

```tsx
// components/admin/accounts/AccountDetail.tsx
"use client";
import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowLeft, HandCoins, Receipt, PauseCircle, PlayCircle, XCircle, PlusMinus } from "@phosphor-icons/react/dist/ssr";
import AdminButton from "@/components/admin/dashboard/AdminButton";
import OrderDetailDrawer from "@/components/admin/dashboard/OrderDetailDrawer";
import type { AccountDetailData } from "@/lib/house-account-detail";
import type { AccountStatus, SendChannel } from "@/types/house-account";
import AccountStatusBadge from "./AccountStatusBadge";
import PlanEditor, { type PlanPatch } from "./PlanEditor";
import StatementsTable from "./StatementsTable";
import LedgerTable from "./LedgerTable";
import ContactsList from "./ContactsList";
import SendsQueue from "./SendsQueue";
import PaymentModal from "./PaymentModal";
import EntryModal from "./EntryModal";

type Props = { locale: string; initial: AccountDetailData };
function money(c: number) { return `$${(Math.abs(c) / 100).toFixed(2)}`; }

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-4 rounded-xl border border-ink/10 bg-bone p-4">
      <h2 className="mb-3 text-xs uppercase tracking-wide text-ink/50">{title}</h2>
      {children}
    </section>
  );
}

export default function AccountDetail({ locale, initial }: Props) {
  const t = useTranslations("admin_accounts");
  const [data, setData] = useState<AccountDetailData>(initial);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [entryOpen, setEntryOpen] = useState(false);
  const [openOrderId, setOpenOrderId] = useState<string | null>(null);
  const { account } = data;
  const overdue = data.statements.some((s) => s.status === "open" && s.dueCents > 0 && s.dueDate < new Date().toISOString().slice(0, 10));

  async function refresh() {
    const res = await fetch(`/api/admin/accounts/${account.id}`, { cache: "no-store" });
    if (res.ok) setData((await res.json()) as AccountDetailData);
  }

  function errorText(json: { error?: string; reason?: string; send?: { error?: string } }): string {
    switch (json.error) {
      case "no_channel": return t("send_error_no_channel", { reason: json.reason ?? "" });
      case "send_failed": return t("send_failed", { reason: json.send?.error ?? "" });
      case "statement_paid": return t("void_error_paid");
      case "not_latest": return t("void_error_not_latest");
      default: return t("error_generic");
    }
  }

  async function call(method: string, url: string, body?: unknown): Promise<Record<string, unknown> | null> {
    setBusy(true); setFlash(null);
    try {
      const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
      const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) { setFlash({ ok: false, text: errorText(json as { error?: string }) }); return null; }
      await refresh();
      return json;
    } finally { setBusy(false); }
  }

  async function savePlan(patch: PlanPatch): Promise<boolean> {
    return (await call("PATCH", `/api/admin/accounts/${account.id}`, patch)) !== null;
  }
  async function setStatus(status: AccountStatus) {
    if (status === "closed" && !window.confirm(t("close_confirm"))) return;
    await call("PATCH", `/api/admin/accounts/${account.id}`, { status });
  }
  async function issueNow() {
    const r = await call("POST", `/api/admin/accounts/${account.id}/statements`);
    if (r && r.statement === null) setFlash({ ok: true, text: t("nothing_to_issue") });
  }
  async function sendStatement(sid: string, channel: SendChannel) {
    const r = await call("POST", `/api/admin/accounts/statements/${sid}/send`, { channel });
    if (r) setFlash({ ok: true, text: t("sent_ok") });
  }
  async function voidStatement(sid: string) {
    await call("PATCH", `/api/admin/accounts/statements/${sid}`, { void: true });
  }
  async function sendAction(id: string, action: "sendNow" | "skip" | "reschedule", date?: string) {
    const body = action === "skip" ? { skip: true } : action === "sendNow" ? { sendNow: true } : { scheduledFor: date };
    await call("PATCH", `/api/admin/accounts/sends/${id}`, body);
  }

  const numbers = Object.fromEntries(data.statements.map((s) => [s.id, s.number]));

  return (
    <div className="mx-auto max-w-5xl">
      <Link href={`/${locale}/admin/accounts`} className="mb-2 inline-flex items-center gap-1.5 text-sm text-rouge hover:underline">
        <ArrowLeft size={15} weight="bold" /> {t("back_to_accounts")}
      </Link>

      <header className="mb-4 flex flex-wrap items-start gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold">{account.name}</h1>
            <AccountStatusBadge status={account.status} />
            {overdue && <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">{t("overdue")}</span>}
          </div>
          <div className={`mt-1 text-lg tabular-nums ${data.balanceCents > 0 ? (overdue ? "text-rose-700" : "text-amber-800") : "text-ink/70"}`}>
            {data.balanceCents < 0 ? t("credit_balance") : t("balance")}: <strong>{money(data.balanceCents)}</strong>
          </div>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <AdminButton variant="primary" icon={HandCoins} disabled={busy} onClick={() => setPayOpen(true)}>{t("record_payment")}</AdminButton>
          <AdminButton variant="secondary" icon={PlusMinus} disabled={busy} onClick={() => setEntryOpen(true)}>{t("credit_or_adjustment")}</AdminButton>
          <AdminButton variant="secondary" icon={Receipt} disabled={busy || account.status !== "active"} onClick={issueNow}>{t("issue_now")}</AdminButton>
          {account.status === "active" && <AdminButton variant="secondary" icon={PauseCircle} disabled={busy} onClick={() => setStatus("paused")}>{t("pause")}</AdminButton>}
          {account.status === "paused" && <AdminButton variant="secondary" icon={PlayCircle} disabled={busy} onClick={() => setStatus("active")}>{t("resume")}</AdminButton>}
          {account.status !== "closed" && <AdminButton variant="danger" icon={XCircle} disabled={busy} onClick={() => setStatus("closed")}>{t("close_account")}</AdminButton>}
        </div>
      </header>
      {flash && <p className={`mb-3 text-sm ${flash.ok ? "text-success" : "text-error"}`}>{flash.text}</p>}

      <Section title={t("section_plan")}><PlanEditor key={account.updatedAt} account={account} busy={busy} onSave={savePlan} /></Section>
      <Section title={t("section_statements")}>
        <StatementsTable locale={locale} statements={data.statements} defaultChannel={account.statementChannel} busy={busy} onSend={sendStatement} onVoid={voidStatement} />
      </Section>
      <Section title={t("section_ledger")}><LedgerTable locale={locale} entries={data.entries} onOpenOrder={setOpenOrderId} /></Section>
      <Section title={t("section_contacts")}>
        <ContactsList locale={locale} accountId={account.id} contacts={data.contacts} busy={busy} onChanged={refresh} />
      </Section>
      <Section title={t("section_queue")}><SendsQueue locale={locale} sends={data.sends} numbers={numbers} busy={busy} onAction={sendAction} /></Section>

      {payOpen && <PaymentModal accountId={account.id} onClose={() => setPayOpen(false)} onDone={async () => { setPayOpen(false); await refresh(); }} />}
      {entryOpen && <EntryModal accountId={account.id} onClose={() => setEntryOpen(false)} onDone={async () => { setEntryOpen(false); await refresh(); }} />}
      {openOrderId && <OrderDetailDrawer orderId={openOrderId} onClose={() => setOpenOrderId(null)} onChanged={refresh} />}
    </div>
  );
}
```

If `PlusMinus` is not exported by the installed `@phosphor-icons/react`, use `Scales`.

```tsx
// app/[locale]/admin/accounts/[id]/page.tsx
import { notFound } from "next/navigation";
import DashboardShell from "@/components/admin/dashboard/DashboardShell";
import AccountDetail from "@/components/admin/accounts/AccountDetail";
import { getAccountDetail } from "@/lib/house-account-detail";

export const dynamic = "force-dynamic";

export default async function AdminAccountPage({ params }: { params: Promise<{ locale: "en" | "es"; id: string }> }) {
  const { locale, id } = await params;
  const detail = getAccountDetail(id);
  if (!detail) notFound();
  return (
    <DashboardShell locale={locale}>
      <AccountDetail locale={locale} initial={detail} />
    </DashboardShell>
  );
}
```

- [ ] **Step 5: Run the test and the type check**

Run: `npm test -- tests/unit/AccountDetail.test.tsx tests/unit/AccountsView.test.tsx && npx tsc --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 6: Walk the page**

With the dev server running: open an account, edit the plan and save, record a payment, add a credit, issue a statement now, send it (SMS in dry-run shows `dry-run` as the sid), copy the link and open `/s/<code>` in a new tab, void it, pause and resume. Check the queue section reflects each step.

- [ ] **Step 7: Commit**

```bash
git add "app/[locale]/admin/accounts/[id]/page.tsx" components/admin/accounts tests/unit/AccountDetail.test.tsx
git commit -m "feat(accounts): account detail page with plan editor, statements, ledger, contacts and queue

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 17: Intake — "A cuenta" payment option

**Files:**
- Modify: `schemas/intake.ts:64-78` (payment union)
- Create: `components/admin/accounts/AccountSearch.tsx`
- Modify: `components/admin/intake/PaymentBlock.tsx`
- Modify: `components/admin/intake/IntakeForm.tsx` (gift-card field, linked-account chip, submit guard)
- Modify: `app/api/admin/orders/route.ts`
- Modify: `messages/es.json`, `messages/en.json` (`admin_intake.payment_account`, `admin_intake.account_pick`, `admin_intake.account_chip`; `admin_accounts.account_search_placeholder`, `admin_accounts.account_no_results`)
- Test: `tests/unit/api-admin-orders-account.test.ts`

**Interfaces:**
- Consumes: `getAccount`, `linkContact` (Task 3); `recordCharge` (Task 6); `GET /api/admin/accounts/search`, `GET /api/admin/accounts/for-phone` (Task 14); `redeemPromo`.
- Produces: `PaymentState` gains `{ status: "account"; accountId: string; accountName: string }`; the intake zod `payment` union gains `{ status: "account", accountId }`; `AccountSearch` component (`{ value: { id: string; name: string } | null; onSelect: (a) => void; autoFocus?: boolean }`), reused by Task 18.

- [ ] **Step 1: Write the failing route test**

```ts
// tests/unit/api-admin-orders-account.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import path from "node:path";
import os from "node:os";
import { promises as fs } from "node:fs";

vi.mock("@/lib/stripe-server", () => ({ stripe: { checkout: { sessions: { create: vi.fn() } } } }));
vi.mock("@/lib/order-dispatch", () => ({ dispatchOrderReceived: vi.fn() }));

import { POST } from "@/app/api/admin/orders/route";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { createAccount, updateAccount, listContacts } from "@/lib/house-account-storage";
import { listEntries } from "@/lib/house-account-ledger";

const ORDER_FILE = path.join(os.tmpdir(), `diva-intake-acct-${process.pid}.json`);
const PRINT_FILE = path.join(os.tmpdir(), `diva-intake-acct-print-${process.pid}.json`);

beforeEach(async () => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("ORDER_STORAGE_FILE", ORDER_FILE);
  vi.stubEnv("PRINT_QUEUE_FILE", PRINT_FILE);
  vi.stubEnv("TWILIO_DRY_RUN", "true");
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_dummy");
  await fs.writeFile(ORDER_FILE, "[]");
  await fs.writeFile(PRINT_FILE, "[]");
  runMigrations();
});
afterEach(async () => {
  closeDb(); vi.unstubAllEnvs();
  try { await fs.unlink(ORDER_FILE); } catch {}
  try { await fs.unlink(PRINT_FILE); } catch {}
});

function body(accountId: string, extra: Record<string, unknown> = {}) {
  return {
    source: "phone",
    customer: { phone: "5165550100", name: "Ana López" },
    fulfillment: { method: "in-store" },
    lines: [{ kind: "custom", title: "Centro de mesa", priceCents: 5000, qty: 2 }],
    payment: { status: "account", accountId },
    ...extra,
  };
}
const req = (b: unknown) => new Request("http://localhost/api/admin/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) });

describe("POST /api/admin/orders · payment.status = account", () => {
  it("creates a pending house-account order with a charge and links the buyer as a contact", async () => {
    const a = createAccount({ name: "Hotel" });
    const res = await POST(req(body(a.id)));
    expect(res.status).toBe(201);
    const { orderId } = await res.json();
    const row = getDb().prepare("SELECT payment_status, payment_method, house_account_id, total_cents, amount_paid_cents, customer_id FROM orders WHERE id = ?").get(orderId) as
      { payment_status: string; payment_method: string; house_account_id: string; total_cents: number; amount_paid_cents: number; customer_id: string };
    expect(row).toMatchObject({ payment_status: "pending", payment_method: "house-account", house_account_id: a.id, amount_paid_cents: 0 });
    const [charge] = listEntries(a.id);
    expect(charge).toMatchObject({ kind: "charge", orderId, amountCents: row.total_cents });
    expect(listContacts(a.id).map((c) => c.id)).toEqual([row.customer_id]);
  });
  it("422 for a paused or unknown account, and when combined with a gift card", async () => {
    const a = createAccount({ name: "Hotel" });
    updateAccount(a.id, { status: "paused" });
    const paused = await POST(req(body(a.id)));
    expect(paused.status).toBe(422);
    expect((await paused.json()).errors.formErrors).toEqual(["account_invalid"]);
    expect((await POST(req(body("ha_nope")))).status).toBe(422);
    const b = createAccount({ name: "Iglesia" });
    const gc = await POST(req(body(b.id, { giftCardCode: "DIVA-TEST-0000" })));
    expect(gc.status).toBe(422);
    expect((await gc.json()).errors.formErrors).toEqual(["account_gift_card"]);
    expect(listEntries(b.id)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- tests/unit/api-admin-orders-account.test.ts`
Expected: FAIL — 400 from zod (unknown payment status).

- [ ] **Step 3: Extend the schema and the route**

In `schemas/intake.ts`, add a third member to the `payment` discriminated union:

```ts
  z.object({
    status: z.literal("account"),
    // Charged to a house account; the server validates the account is active.
    accountId: z.string().min(1),
  }),
```

In `app/api/admin/orders/route.ts`:

1. Imports:
   ```ts
   import { getAccount, linkContact } from "@/lib/house-account-storage";
   import { recordCharge } from "@/lib/house-account-ledger";
   ```
2. Right after `const input = parsed.data;` add:
   ```ts
     // House account: must exist and be active, and cannot be mixed with a gift card.
     const houseAccount = input.payment.status === "account" ? getAccount(input.payment.accountId) : null;
     if (input.payment.status === "account") {
       if (!houseAccount || houseAccount.status !== "active") {
         return NextResponse.json({ errors: { formErrors: ["account_invalid"] } }, { status: 422 });
       }
       if (input.giftCardCode) {
         return NextResponse.json({ errors: { formErrors: ["account_gift_card"] } }, { status: 422 });
       }
     }
   ```
3. In the `order` literal replace the three payment lines with:
   ```ts
       paymentStatus: input.payment.status === "paid" ? "paid" : "pending",
       paymentMethod: input.payment.status === "paid" ? input.payment.method : input.payment.status === "account" ? "house-account" : undefined,
       paidAt: input.payment.status === "paid" ? now : undefined,
       houseAccountId: houseAccount?.id,
   ```
4. Right after the `recordOrderChange` block that logs `created` (and the deposit change), add:
   ```ts
     if (houseAccount) {
       recordCharge({ accountId: houseAccount.id, orderId: order.id, amountCents: order.totals.totalCents, actor: order.takenBy ?? "maky" });
       // A person who orders on the account is one of its contacts from now on;
       // "contact_taken" (already on another account) is not an error here.
       try { linkContact(houseAccount.id, customer.id); } catch { /* keep the order */ }
     }
   ```
5. Promo: change the condition of the existing promo-redeem block to also burn when the order is charged to an account (the charge is committed):
   ```ts
     if (promoId && (order.paymentStatus === "paid" || houseAccount) && order.totals.discountCents > 0) {
   ```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- tests/unit/api-admin-orders-account.test.ts tests/unit/api-admin-orders.test.ts`
Expected: PASS.

- [ ] **Step 5: Add the i18n keys**

`messages/es.json` → `admin_intake`: `"payment_account": "A cuenta"`, `"account_pick": "Cuenta de la organización"`, `"account_chip": "Cuenta vinculada: {name}"`. → `admin_accounts`: `"account_search_placeholder": "Buscar cuenta por nombre"`, `"account_no_results": "Sin cuentas activas con ese nombre"`.

`messages/en.json` → `admin_intake`: `"payment_account": "On account"`, `"account_pick": "Organization account"`, `"account_chip": "Linked account: {name}"`. → `admin_accounts`: `"account_search_placeholder": "Search account by name"`, `"account_no_results": "No active accounts match"`.

- [ ] **Step 6: Write `AccountSearch`**

```tsx
// components/admin/accounts/AccountSearch.tsx
"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { X } from "@phosphor-icons/react/dist/ssr";

export type AccountHit = { id: string; name: string };
type Props = { value: AccountHit | null; onSelect: (a: AccountHit | null) => void; autoFocus?: boolean };

export default function AccountSearch({ value, onSelect, autoFocus }: Props) {
  const t = useTranslations("admin_accounts");
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<AccountHit[]>([]);

  useEffect(() => {
    if (q.trim().length < 2) { setHits([]); return; }
    let cancelled = false;
    const h = setTimeout(async () => {
      const res = await fetch(`/api/admin/accounts/search?q=${encodeURIComponent(q.trim())}`, { cache: "no-store" });
      if (!res.ok || cancelled) return;
      const d = (await res.json()) as { accounts: AccountHit[] };
      if (!cancelled) setHits(d.accounts);
    }, 200);
    return () => { cancelled = true; clearTimeout(h); };
  }, [q]);

  if (value) {
    return (
      <div className="inline-flex items-center gap-2 rounded-full border border-ink bg-ink px-3 py-1.5 text-sm text-bone">
        {value.name}
        <button type="button" aria-label={t("remove")} onClick={() => onSelect(null)} className="rounded-full hover:bg-bone/20"><X size={14} weight="bold" /></button>
      </div>
    );
  }
  return (
    <div>
      <input autoFocus={autoFocus} value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("account_search_placeholder")}
        aria-label={t("account_search_placeholder")} className="w-full rounded-lg border border-mute-200 bg-white px-3 py-2 text-sm" />
      {q.trim().length >= 2 && (
        <ul className="mt-1 divide-y divide-ink/10 rounded-lg border border-ink/10 bg-white text-sm">
          {hits.length === 0 && <li className="px-3 py-2 text-ink/50">{t("account_no_results")}</li>}
          {hits.map((h) => (
            <li key={h.id}>
              <button type="button" onClick={() => { onSelect(h); setQ(""); }} className="w-full px-3 py-2 text-left hover:bg-ink/5">{h.name}</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 7: Extend `PaymentBlock`**

In `components/admin/intake/PaymentBlock.tsx`:

1. Import: `import AccountSearch from "@/components/admin/accounts/AccountSearch";`
2. `PaymentState` becomes:
   ```ts
   export type PaymentState =
     | { status: "paid"; method: PaymentMethod }
     | { status: "pending"; deposit?: { amountCents: number; method: DepositMethod } }
     | { status: "account"; accountId: string; accountName: string };
   ```
3. `METHOD_KEYS` must not list `house-account` (it is not a "paid" method); leave it as is.
4. After the existing "pending" button inside the grid, add:
   ```tsx
           <button
             type="button"
             onClick={() => onChange({ status: "account", accountId: "", accountName: "" })}
             className={`py-3.5 rounded-xl text-sm font-medium border border-dashed transition ${
               value.status === "account" ? "bg-ink text-bone border-ink" : "bg-ink/[0.03] border-ink/40 text-ink hover:border-ink"
             }`}
           >
             {t("payment_account")}
           </button>
   ```
5. After the `{value.status === "pending" && (...)}` block, add:
   ```tsx
         {value.status === "account" && (
           <div className="mt-3 rounded-xl border border-mute-200 bg-white p-3">
             <label className="block text-[11px] uppercase tracking-widest text-mute-400 mb-2">{t("account_pick")}</label>
             <AccountSearch
               autoFocus
               value={value.accountId ? { id: value.accountId, name: value.accountName } : null}
               onSelect={(a) => onChange({ status: "account", accountId: a?.id ?? "", accountName: a?.name ?? "" })}
             />
           </div>
         )}
   ```

- [ ] **Step 8: Wire `IntakeForm`**

In `components/admin/intake/IntakeForm.tsx`:

1. Add state next to `payment`: `const [linkedAccount, setLinkedAccount] = useState<{ id: string; name: string } | null>(null);`
2. Add the effect (after the other `useEffect`s; `useEffect` is already imported):
   ```tsx
     // A phone that belongs to a house-account contact preselects "A cuenta",
     // unless staff already chose a paid method or typed a deposit.
     const phoneDigits = customer.phone.replace(/\D/g, "");
     useEffect(() => {
       if (phoneDigits.length < 10) { setLinkedAccount(null); return; }
       let cancelled = false;
       fetch(`/api/admin/accounts/for-phone?phone=${phoneDigits}`, { cache: "no-store" })
         .then((r) => (r.ok ? r.json() : { account: null }))
         .then((d: { account: { id: string; name: string } | null }) => {
           if (cancelled) return;
           setLinkedAccount(d.account);
           if (d.account) {
             setPayment((p) => (p.status === "pending" && !p.deposit ? { status: "account", accountId: d.account!.id, accountName: d.account!.name } : p));
             setPaymentKey((k) => k + 1);
           }
         })
         .catch(() => {});
       return () => { cancelled = true; };
     }, [phoneDigits]);
   ```
3. Under the `<PaymentBlock …/>` line add the chip:
   ```tsx
                 {linkedAccount && <p className="mt-2 text-xs text-mute-600">{t("account_chip", { name: linkedAccount.name })}</p>}
   ```
4. Wrap the gift-card `<label>` so it only shows when not on account:
   ```tsx
                 {payment.status !== "account" && (
                   <label className="block mt-4"> …existing gift card input… </label>
                 )}
   ```
5. In the submit button's `disabled` expression add `|| (payment.status === "account" && !payment.accountId)`.
6. In `onSubmit`, the existing deposit guard already narrows on `payment.status === "pending"`; nothing else changes — `payment` is sent as is (zod strips `accountName`).

- [ ] **Step 9: Type-check and try it**

Run: `npx tsc --noEmit && npm test -- tests/unit/api-admin-orders-account.test.ts`
Expected: no type errors (fix any `PaymentState` narrowing the compiler flags in `IntakeForm.tsx`, e.g. `payment.deposit` reads must be guarded by `payment.status === "pending"`), tests PASS.

Then in the dev server: `/es/admin/intake` → type a linked contact's phone → the "A cuenta" option is preselected with the account chip; pick another account via the search; save → the order shows "A cuenta" in the ledger and the account's balance grew.

- [ ] **Step 10: Commit**

```bash
git add schemas/intake.ts components/admin/accounts/AccountSearch.tsx components/admin/intake/PaymentBlock.tsx components/admin/intake/IntakeForm.tsx app/api/admin/orders/route.ts messages/es.json messages/en.json tests/unit/api-admin-orders-account.test.ts
git commit -m "feat(accounts): charge intake orders to a house account

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 18: Order drawer actions, payment-route actions, cancel and edit hooks

**Files:**
- Modify: `lib/order-mutations.ts` (`cancelOrder` → reversal)
- Modify: `lib/order-edit.ts` (`editOrder` → adjustment on total change)
- Modify: `app/api/admin/orders/[id]/payment/route.ts` (`moveToAccount`, `removeFromAccount`)
- Modify: `app/api/admin/orders/[id]/route.ts` (GET returns `houseAccount`)
- Modify: `components/admin/dashboard/OrderDetailDrawer.tsx`
- Modify: `messages/es.json`, `messages/en.json` (`admin_orders.*` keys below)
- Test: `tests/unit/order-mutations-account.test.ts`, `tests/unit/api-admin-order-payment-account.test.ts`

**Interfaces:**
- Consumes: `reverseOrderCharge`, `syncOrderTotal`, `moveOrderToAccount`, `removeOrderFromAccount`, `entriesForOrder` (Task 6); `getAccount` (Task 3); `AccountSearch` (Task 17).
- Produces: `PATCH /api/admin/orders/[id]/payment` accepts `{ moveToAccount: { accountId } }` and `{ removeFromAccount: true }` → `{ order }`; 404 `account_not_found`; 409 for `account_inactive`, `already_on_account`, `not_pending`, `nothing_due`, `not_on_account`, `already_billed`, `already_reversed`, `has_payments`. `GET /api/admin/orders/[id]` adds `houseAccount: { id, name, billed } | null`.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/unit/order-mutations-account.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { createAccount, accountBalanceCents } from "@/lib/house-account-storage";
import { recordCharge, listEntries } from "@/lib/house-account-ledger";
import { cancelOrder } from "@/lib/order-mutations";
import { editOrder } from "@/lib/order-edit";

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("ORDER_STORAGE_FILE", `/tmp/orders-acct-${process.pid}-${Math.random().toString(36).slice(2)}.json`);
  runMigrations();
});
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

function seed(id: string, accountId: string) {
  getDb().prepare(
    `INSERT INTO orders (id, locale, source, recipient_name, recipient_phone, contact_phone, fulfillment_method, window_date,
       lines_json, subtotal_cents, delivery_cents, tax_cents, total_cents, amount_paid_cents, fulfillment_status,
       payment_status, payment_method, house_account_id, created_at, updated_at)
     VALUES (?, 'es', 'walk-in', 'Ana', '555', '5165550100', 'in-store', NULL,
       '[{"kind":"custom","title":"Ramo","priceCents":5000,"qty":1}]', 5000, 0, 0, 5000, 0, 'pending',
       'pending', 'house-account', ?, '2026-09-10T12:00:00Z', '2026-09-10T12:00:00Z')`,
  ).run(id, accountId);
}

describe("account orders", () => {
  it("cancelOrder reverses the charge once", async () => {
    const a = createAccount({ name: "Hotel" });
    seed("o1", a.id);
    recordCharge({ accountId: a.id, orderId: "o1", amountCents: 5000, actor: "m" });
    const o = await cancelOrder("o1", { refund: false, reason: "cliente" });
    expect(o.status).toBe("canceled");
    expect(listEntries(a.id).map((e) => [e.kind, e.amountCents])).toEqual([["charge", 5000], ["reversal", -5000]]);
    expect(accountBalanceCents(a.id)).toBe(0);
    await cancelOrder("o1", { refund: false });
    expect(listEntries(a.id)).toHaveLength(2);
  });
  it("editOrder with a new total records a signed adjustment", async () => {
    const a = createAccount({ name: "Hotel" });
    seed("o2", a.id);
    recordCharge({ accountId: a.id, orderId: "o2", amountCents: 5000, actor: "m" });
    const { order } = await editOrder("o2", { totalsOverride: { subtotalCents: 9000, deliveryCents: 0, taxCents: 0, totalCents: 9000 } }, "maky");
    const delta = order.totals.totalCents - 5000;
    expect(delta).not.toBe(0);
    const adj = listEntries(a.id).find((e) => e.kind === "adjustment")!;
    expect(adj).toMatchObject({ orderId: "o2", amountCents: delta });
    expect(accountBalanceCents(a.id)).toBe(order.totals.totalCents);
    // No change in total → no new entry.
    await editOrder("o2", { contact: { name: "Ana María" } }, "maky");
    expect(listEntries(a.id)).toHaveLength(2);
  });
});
```

```ts
// tests/unit/api-admin-order-payment-account.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { signSession } from "@/lib/admin-auth";
import { createAccount } from "@/lib/house-account-storage";
import { recordCharge } from "@/lib/house-account-ledger";
import { PATCH } from "@/app/api/admin/orders/[id]/payment/route";
import { GET } from "@/app/api/admin/orders/[id]/route";

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("ORDER_STORAGE_FILE", `/tmp/orders-pay-acct-${process.pid}-${Math.random().toString(36).slice(2)}.json`);
  vi.stubEnv("INTAKE_SESSION_SECRET", "test-secret-test-secret-test-secret");
  runMigrations();
});
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

function seed(id: string, accountId: string | null = null, paid = 0) {
  getDb().prepare(
    `INSERT INTO orders (id, locale, source, recipient_name, recipient_phone, contact_phone, fulfillment_method, window_date,
       lines_json, subtotal_cents, delivery_cents, tax_cents, total_cents, amount_paid_cents, fulfillment_status,
       payment_status, payment_method, house_account_id, created_at, updated_at)
     VALUES (?, 'es', 'walk-in', 'Ana', '555', '5165550100', 'in-store', NULL, '[]', 5000, 0, 0, 5000, ?, 'pending',
       'pending', ?, ?, '2026-09-10T12:00:00Z', '2026-09-10T12:00:00Z')`,
  ).run(id, paid, accountId ? "house-account" : null, accountId);
}
const patch = (id: string, body: unknown) => PATCH(
  new Request("http://x", { method: "PATCH", headers: { "content-type": "application/json", cookie: `intake_session=${signSession()}` }, body: JSON.stringify(body) }),
  { params: Promise.resolve({ id }) },
);
const get = (id: string) => GET(new Request("http://x"), { params: Promise.resolve({ id }) });

describe("PATCH /api/admin/orders/[id]/payment · house account", () => {
  it("moveToAccount charges the remaining balance; detail shows the account", async () => {
    const a = createAccount({ name: "Hotel" });
    seed("o1", null, 1000);
    const res = await patch("o1", { moveToAccount: { accountId: a.id } });
    expect(res.status).toBe(200);
    const { order } = await res.json();
    expect(order).toMatchObject({ houseAccountId: a.id, paymentMethod: "house-account", paymentStatus: "pending" });
    const detail = await (await get("o1")).json();
    expect(detail.houseAccount).toEqual({ id: a.id, name: "Hotel", billed: false });
    expect((await patch("o1", { moveToAccount: { accountId: a.id } })).status).toBe(409);
    expect((await patch("o2", { moveToAccount: { accountId: "ha_nope" } })).status).toBe(404);
  });
  it("removeFromAccount clears the order while unbilled; 409 once billed", async () => {
    const a = createAccount({ name: "Hotel" });
    seed("o1", a.id);
    const e = recordCharge({ accountId: a.id, orderId: "o1", amountCents: 5000, actor: "m" });
    const ok = await patch("o1", { removeFromAccount: true });
    expect(ok.status).toBe(200);
    expect((await ok.json()).order.houseAccountId).toBeUndefined();
    seed("o2", a.id);
    const e2 = recordCharge({ accountId: a.id, orderId: "o2", amountCents: 5000, actor: "m" });
    getDb().prepare("UPDATE house_account_entries SET statement_id = 'hst_x' WHERE id = ?").run(e2.id);
    expect((await patch("o2", { removeFromAccount: true })).status).toBe(409);
    expect((await (await get("o2")).json()).houseAccount.billed).toBe(true);
    void e;
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- tests/unit/order-mutations-account.test.ts tests/unit/api-admin-order-payment-account.test.ts`
Expected: FAIL.

- [ ] **Step 3: Hook cancel and edit**

In `lib/order-mutations.ts`, inside `cancelOrder` after the `recordOrderChange({... kind: "cancel" ...})` call and before `return next;`:

```ts
  // An order charged to a house account: reverse its charge on the ledger
  // (once; any money already applied to it stays on the account as credit).
  if (cur.houseAccountId) {
    try {
      const { reverseOrderCharge } = await import("@/lib/house-account-ledger");
      reverseOrderCharge(orderId, "maky");
    } catch (e) {
      console.error(JSON.stringify({ event: "house_account_reverse_failed", orderId, error: String(e) }));
    }
  }
```

In `lib/order-edit.ts`, inside `editOrder` right after `await updateOrder(next);`:

```ts
  // A changed total on an account order becomes a signed ledger adjustment.
  if (next.houseAccountId && next.totals.totalCents !== cur.totals.totalCents) {
    const { syncOrderTotal } = await import("@/lib/house-account-ledger");
    syncOrderTotal(orderId, cur.totals.totalCents, next.totals.totalCents, actor);
  }
```

- [ ] **Step 4: Extend the payment route and the detail route**

`app/api/admin/orders/[id]/payment/route.ts`:

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { markPaidManual, settleBalance, recordDeposit } from "@/lib/order-mutations";
import { moveOrderToAccount, removeOrderFromAccount } from "@/lib/house-account-ledger";
import { getOrder } from "@/lib/order-storage";

export const runtime = "nodejs";

const body = z.union([
  z.object({ method: z.enum(["cash", "zelle", "card-terminal", "ach"]), note: z.string().max(500).optional() }),
  z.object({ settleBalance: z.literal(true) }),
  z.object({
    deposit: z.object({
      amountCents: z.number().int().positive(),
      method: z.enum(["cash", "zelle", "card-terminal", "ach"]),
      note: z.string().max(500).optional(),
    }),
  }),
  z.object({ moveToAccount: z.object({ accountId: z.string().min(1) }) }),
  z.object({ removeFromAccount: z.literal(true) }),
]);

const CONFLICTS = new Set(["account_inactive", "already_on_account", "not_pending", "nothing_due", "not_on_account", "already_billed", "already_reversed", "has_payments"]);

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await ctx.params;
  const json = await req.json().catch(() => null);
  const parsed = body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", details: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const data = parsed.data;
    if ("moveToAccount" in data) {
      moveOrderToAccount(id, data.moveToAccount.accountId, "maky");
      return NextResponse.json({ order: await getOrder(id) });
    }
    if ("removeFromAccount" in data) {
      removeOrderFromAccount(id, "maky");
      return NextResponse.json({ order: await getOrder(id) });
    }
    const order = "settleBalance" in data
      ? await settleBalance(id, "maky")
      : "deposit" in data
        ? await recordDeposit(id, data.deposit, "maky")
        : await markPaidManual(id, data);
    return NextResponse.json({ order });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/order not found/.test(msg)) return NextResponse.json({ error: "not_found" }, { status: 404 });
    if (msg === "account_not_found") return NextResponse.json({ error: msg }, { status: 404 });
    if (CONFLICTS.has(msg)) return NextResponse.json({ error: msg }, { status: 409 });
    if (/exceeds balance/.test(msg)) return NextResponse.json({ error: "deposit_exceeds_balance" }, { status: 400 });
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
```

`app/api/admin/orders/[id]/route.ts` GET: add imports `import { getAccount } from "@/lib/house-account-storage";` and `import { entriesForOrder } from "@/lib/house-account-ledger";`, then before the `return NextResponse.json({...})`:

```ts
  const acct = order.houseAccountId ? getAccount(order.houseAccountId) : null;
  const houseAccount = acct
    ? { id: acct.id, name: acct.name, billed: entriesForOrder(id).some((e) => e.kind === "charge" && !!e.statementId) }
    : null;
```

and add `houseAccount,` to the returned object.

- [ ] **Step 5: Run to verify pass**

Run: `npm test -- tests/unit/order-mutations-account.test.ts tests/unit/api-admin-order-payment-account.test.ts tests/unit/order-mutations-deposit.test.ts tests/unit/order-edit.test.ts`
Expected: PASS.

- [ ] **Step 6: i18n for the drawer**

`messages/es.json` → `admin_orders`: `"on_account": "A cuenta · {name}"`, `"move_to_account": "Pasar a cuenta"`, `"remove_from_account": "Quitar de cuenta"`, `"view_account": "Ver cuenta"`, `"account_pick": "Elige la cuenta"`, `"account_error": "No se pudo cambiar la cuenta de esta orden."`.
`messages/en.json` → `admin_orders`: `"on_account": "On account · {name}"`, `"move_to_account": "Move to account"`, `"remove_from_account": "Remove from account"`, `"view_account": "View account"`, `"account_pick": "Pick the account"`, `"account_error": "Could not change this order's account."`.

- [ ] **Step 7: Update the drawer**

In `components/admin/dashboard/OrderDetailDrawer.tsx`:

1. Imports: add `Buildings` to the phosphor import list and `import AccountSearch from "@/components/admin/accounts/AccountSearch";`.
2. `DetailResp` gains `houseAccount?: { id: string; name: string; billed: boolean } | null;`.
3. State: `const [accountPickOpen, setAccountPickOpen] = useState(false);` and `const [accountErr, setAccountErr] = useState<string | null>(null);`.
4. Helper next to `saveDeposit`:
   ```tsx
     async function accountCall(body: unknown): Promise<boolean> {
       setBusy(true); setAccountErr(null);
       try {
         const res = await fetch(`/api/admin/orders/${orderId}/payment`, {
           method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
         });
         if (!res.ok) { setAccountErr(t("account_error")); return false; }
         const refreshed = await fetch(`/api/admin/orders/${orderId}`, { cache: "no-store" });
         setData((await refreshed.json()) as DetailResp);
         onChanged();
         return true;
       } finally { setBusy(false); }
     }
   ```
5. After `const hasDeposit = ...` add `const onAccount = !!order.houseAccountId;`.
6. Change the deposit/credit banner condition to `{!editing && !onAccount && (order.amountPaidCents ?? 0) > 0 && (data.balanceCents ?? 0) !== 0 && (` and add, right before it, the account banner:
   ```tsx
           {!editing && onAccount && data.houseAccount && (
             <div className="mb-3 flex items-center justify-between gap-2 rounded bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-800">
               <span>{t("on_account", { name: data.houseAccount.name })}{balance > 0 && ` · ${money(balance)}`}</span>
               <Link href={`/${locale}/admin/accounts/${data.houseAccount.id}`} className="underline">{t("view_account")}</Link>
             </div>
           )}
   ```
7. In the status section's payment label chain, add a branch before `hasDeposit`:
   ```tsx
                 : onAccount && order.paymentStatus === "pending" ? t("on_account", { name: data.houseAccount?.name ?? "" })
   ```
8. In the footer:
   - `record_deposit` button: add `&& !onAccount` to its condition.
   - the `resend_link / cash / zelle` fragment: change `{order.paymentStatus !== "paid" && (` to `{order.paymentStatus !== "paid" && !onAccount && (`.
   - add, right after that fragment:
     ```tsx
                 {order.paymentStatus === "pending" && order.status !== "canceled" && !onAccount && !accountPickOpen && (
                   <AdminButton variant="secondary" icon={Buildings} disabled={busy} onClick={() => { setAccountErr(null); setAccountPickOpen(true); }}>{t("move_to_account")}</AdminButton>
                 )}
                 {onAccount && order.paymentStatus === "pending" && order.status !== "canceled" && data.houseAccount && !data.houseAccount.billed && (
                   <AdminButton variant="secondary" icon={Buildings} disabled={busy} onClick={() => accountCall({ removeFromAccount: true })}>{t("remove_from_account")}</AdminButton>
                 )}
     ```
   - after the `{depositOpen && (...)}` box add:
     ```tsx
               {accountErr && <p className="mt-2 text-xs text-error">{accountErr}</p>}
               {accountPickOpen && (
                 <div className="mt-2 rounded border border-sky-300 bg-sky-50 p-3 text-xs">
                   <div className="mb-2 font-semibold text-sky-900">{t("account_pick")} · {t("balance_due")} {money(balance)}</div>
                   <AccountSearch autoFocus value={null} onSelect={async (a) => {
                     if (!a) return;
                     if (await accountCall({ moveToAccount: { accountId: a.id } })) setAccountPickOpen(false);
                   }} />
                   <div className="mt-2"><AdminButton variant="secondary" disabled={busy} onClick={() => setAccountPickOpen(false)}>{t("back")}</AdminButton></div>
                 </div>
               )}
     ```

- [ ] **Step 8: Type-check and try it**

Run: `npx tsc --noEmit`
Expected: clean. In the dev server: open a pending order → "Pasar a cuenta" → pick an account → the banner shows "A cuenta · …" and the Liquidar / depósito / cash buttons are gone; "Quitar de cuenta" works until the charge is on a statement; cancel an account order → the account ledger shows the reversal.

- [ ] **Step 9: Commit**

```bash
git add lib/order-mutations.ts lib/order-edit.ts "app/api/admin/orders/[id]/payment/route.ts" "app/api/admin/orders/[id]/route.ts" components/admin/dashboard/OrderDetailDrawer.tsx messages/es.json messages/en.json tests/unit/order-mutations-account.test.ts tests/unit/api-admin-order-payment-account.test.ts
git commit -m "feat(accounts): move/remove orders on account from the drawer; cancel and edit hooks

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 19: Bandeja exclusions, metrics KPI, customer profile badge

**Files:**
- Modify: `lib/order-queue.ts:55-64` and `:78-97`
- Modify: `lib/metrics-storage.ts` (`MetricsKpis`, `getMetrics`)
- Modify: `components/admin/metrics/MetricsView.tsx` (new card)
- Modify: `tests/unit/MetricsView.test.tsx` (payload gains the new KPI fields)
- Modify: `lib/customer-profile.ts`, `components/admin/customers/CustomerProfile.tsx`
- Modify: `messages/es.json`, `messages/en.json` (`admin_metrics.kpi_house_accounts`, `admin_metrics.kpi_house_accounts_sub`, `admin_customers.house_account_badge`)
- Test: `tests/unit/order-queue-house-account.test.ts`, `tests/unit/metrics-house-accounts.test.ts`, `tests/unit/customer-profile-house-account.test.ts`

**Interfaces:**
- Consumes: `receivablesSummary`, `findAccountForCustomer` (Task 3); `shopDateStr`.
- Produces: `MetricsKpis` gains `houseAccountsCents`, `houseAccountsOverdueCents`, `houseAccountsOverdueCount`; `CustomerProfileData` gains `houseAccount?: { id: string; name: string }`.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/unit/order-queue-house-account.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { getPendingQueue } from "@/lib/order-queue";

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  runMigrations();
  vi.useFakeTimers().setSystemTime(new Date("2026-05-25T14:00:00Z"));
});
afterEach(() => { vi.useRealTimers(); closeDb(); vi.unstubAllEnvs(); });

function seed(id: string, method: string | null, session: string | null = "cs_x") {
  getDb().prepare(
    `INSERT INTO orders (id, locale, source, recipient_name, recipient_phone, contact_phone, fulfillment_method, window_date,
       lines_json, subtotal_cents, delivery_cents, tax_cents, total_cents, fulfillment_status, payment_status, payment_method,
       stripe_checkout_session_id, created_at, updated_at)
     VALUES (?, 'es', 'phone', 'R', '555', '555', 'delivery', '2026-05-25', '[]', 0, 0, 0, 5000, 'pending', 'pending', ?, ?,
       '2026-05-25T10:00:00Z', '2026-05-25T10:00:00Z')`,
  ).run(id, method, session);
}

it("house-account orders are never flagged as unpaid", async () => {
  seed("acct", "house-account");
  seed("plain", null);
  const q = await getPendingQueue();
  expect(q.find((i) => i.orderId === "plain")?.reason).toBe("delivery_today_unpaid");
  const acct = q.find((i) => i.orderId === "acct");
  // Still visible for dispatch today, but never for payment.
  expect(acct?.reason).toBe("delivery_today_undispatched");
});
```

```ts
// tests/unit/metrics-house-accounts.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { getMetrics } from "@/lib/metrics-storage";
import { createAccount } from "@/lib/house-account-storage";

beforeEach(() => { vi.stubEnv("SQLITE_FILE", ":memory:"); runMigrations(); });
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

it("exposes house-account receivables in the KPIs", () => {
  const a = createAccount({ name: "Hotel" });
  getDb().prepare("INSERT INTO house_account_entries (id, account_id, kind, amount_cents, actor, created_at) VALUES ('e1', ?, 'charge', 7000, 't', '2026-09-10T12:00:00Z')").run(a.id);
  getDb().prepare(
    `INSERT INTO house_account_statements (id, account_id, number, code, period_start, period_end, issued_at, due_date, opening_cents, charges_cents, credits_cents, payments_cents, closing_cents, settled_cents, status, lines_json, created_at)
     VALUES ('hst_1', ?, 'ST-1001', 'AbCdEfGh', '2026-09-01', '2026-09-30', '2026-10-01T13:00:00Z', '2026-10-16', 0, 7000, 0, 0, 7000, 2000, 'open', '[]', '2026-10-01T13:00:00Z')`,
  ).run(a.id);
  const m = getMetrics("90d", new Date("2026-11-01T12:00:00Z"), "es", { customProducts: "P", unknownZone: "Z" });
  expect(m.kpis).toMatchObject({ houseAccountsCents: 7000, houseAccountsOverdueCents: 5000, houseAccountsOverdueCount: 1 });
});
```

```ts
// tests/unit/customer-profile-house-account.test.ts
import { it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { createAccount, linkContact } from "@/lib/house-account-storage";
import { getCustomerProfile } from "@/lib/customer-profile";

beforeEach(() => { vi.stubEnv("SQLITE_FILE", ":memory:"); runMigrations(); });
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

it("profile carries the linked house account", () => {
  getDb().prepare("INSERT INTO customers (id, name, phone, order_count, first_seen_at, last_seen_at) VALUES ('cus_1', 'Ana', '5165550100', 0, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')").run();
  expect(getCustomerProfile("cus_1")?.houseAccount).toBeUndefined();
  const a = createAccount({ name: "Hotel" });
  linkContact(a.id, "cus_1");
  expect(getCustomerProfile("cus_1")?.houseAccount).toEqual({ id: a.id, name: "Hotel" });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- tests/unit/order-queue-house-account.test.ts tests/unit/metrics-house-accounts.test.ts tests/unit/customer-profile-house-account.test.ts`
Expected: FAIL.

- [ ] **Step 3: Bandeja exclusions**

In `lib/order-queue.ts`, the SQL candidate set: append `AND o.payment_method IS NOT 'house-account'` to the three `payment_status = 'pending'` clauses (`intake_unpaid_stale`, `delivery_today_unpaid`, `pickup_today_unpaid`):

```sql
      -- intake_unpaid_stale
      OR (o.source != 'web' AND o.payment_status = 'pending' AND o.payment_method IS NOT 'house-account'
          AND o.created_at <= ? AND o.stripe_checkout_session_id IS NOT NULL)
      ...
      -- delivery_today_unpaid
      OR (o.fulfillment_method = 'delivery' AND o.window_date = ? AND o.payment_status = 'pending' AND o.payment_method IS NOT 'house-account')
      -- pickup_today_unpaid
      OR (o.fulfillment_method = 'pickup' AND o.window_date = ? AND o.payment_status = 'pending' AND o.payment_method IS NOT 'house-account')
```

And in the in-memory reasons, add `order.paymentMethod !== "house-account" &&` to the `delivery_today_unpaid`, `pickup_today_unpaid` and `intake_unpaid_stale` conditions. (`IS NOT 'x'` is true for NULL in SQLite, so plain pending orders without a method keep being flagged.)

- [ ] **Step 4: Metrics KPI**

`lib/metrics-storage.ts`: import `receivablesSummary` from `@/lib/house-account-storage` and `shopDateStr` from `@/lib/tv-slots`; extend the type and the payload:

```ts
export type MetricsKpis = {
  revenueCents: number;
  outstandingCents: number;
  orderCount: number;
  paidOrderCount: number;
  aovCents: number;
  repeatRatePct: number;
  houseAccountsCents: number;
  houseAccountsOverdueCents: number;
  houseAccountsOverdueCount: number;
};
```

and inside `getMetrics`, before the `return`:

```ts
  const receivables = receivablesSummary(shopDateStr(now));
```

then in `kpis`: `houseAccountsCents: receivables.balanceCents, houseAccountsOverdueCents: receivables.overdueCents, houseAccountsOverdueCount: receivables.overdueCount,`.

`components/admin/metrics/MetricsView.tsx`: add a fifth card to the `kpis` array:

```ts
    { key: "kpi_house_accounts", value: money(k.houseAccountsCents), sub: t("kpi_house_accounts_sub", { n: k.houseAccountsOverdueCount, amount: money(k.houseAccountsOverdueCents) }) },
```

and change the grid to `grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5`.

`tests/unit/MetricsView.test.tsx`: the `payload.kpis` literal must gain `houseAccountsCents: 0, houseAccountsOverdueCents: 0, houseAccountsOverdueCount: 0` or `tsc` fails.

i18n `admin_metrics` (es): `"kpi_house_accounts": "Por cobrar en cuentas"`, `"kpi_house_accounts_sub": "{n} vencidos · {amount}"`; (en): `"kpi_house_accounts": "House accounts receivable"`, `"kpi_house_accounts_sub": "{n} past due · {amount}"`.

- [ ] **Step 5: Customer profile badge**

`lib/customer-profile.ts`: import `findAccountForCustomer` from `@/lib/house-account-storage`; add `houseAccount?: { id: string; name: string };` to `CustomerProfileData`; in `getCustomerProfile` compute `const acct = findAccountForCustomer(id);` and spread `...(acct ? { houseAccount: { id: acct.id, name: acct.name } } : {})` into the returned object.

`components/admin/customers/CustomerProfile.tsx`: next to `<SegmentBadge segment={metrics.segment} />` add:

```tsx
          {data.houseAccount && (
            <Link href={`/${locale}/admin/accounts/${data.houseAccount.id}`} className="rounded-full bg-rouge/10 px-2 py-0.5 text-xs font-semibold text-rouge hover:bg-rouge/20">
              {t("house_account_badge", { name: data.houseAccount.name })}
            </Link>
          )}
```

i18n `admin_customers`: es `"house_account_badge": "Cuenta: {name}"`, en `"house_account_badge": "Account: {name}"`.

- [ ] **Step 6: Run to verify pass**

Run: `npm test -- tests/unit/order-queue-house-account.test.ts tests/unit/order-queue.test.ts tests/unit/metrics-house-accounts.test.ts tests/unit/metrics-storage.test.ts tests/unit/MetricsView.test.tsx tests/unit/customer-profile-house-account.test.ts && npx tsc --noEmit`
Expected: PASS, clean types.

- [ ] **Step 7: Commit**

```bash
git add lib/order-queue.ts lib/metrics-storage.ts components/admin/metrics/MetricsView.tsx tests/unit/MetricsView.test.tsx lib/customer-profile.ts components/admin/customers/CustomerProfile.tsx messages/es.json messages/en.json tests/unit/order-queue-house-account.test.ts tests/unit/metrics-house-accounts.test.ts tests/unit/customer-profile-house-account.test.ts
git commit -m "feat(accounts): Bandeja ignores account orders as unpaid; receivables KPI; customer badge

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 20: End-to-end spec, ops doc, fresh-DB build and full verification

**Files:**
- Create: `tests/e2e/house-accounts.spec.ts`
- Create: `docs/ops/house-accounts.md`

- [ ] **Step 1: Write the e2e spec**

```ts
// tests/e2e/house-accounts.spec.ts
import { test, expect } from "@playwright/test";

const PASSWORD = process.env.INTAKE_PASSWORD ?? "test-pass";

test("house account: charge an order, issue, view the public statement, pay, see it settled", async ({ page }) => {
  await page.goto("/en/admin/login?next=/en/admin/accounts");
  await page.fill("input[type='password']", PASSWORD);
  await page.click("button[type='submit']");
  await page.waitForURL(/\/admin\/accounts/);

  const unique = Date.now().toString(36);
  const created = await page.request.post("/api/admin/accounts", {
    data: { name: `E2E Hotel ${unique}`, billingPhone: `516555${unique.slice(-4).padStart(4, "0")}`, locale: "en", termsDays: 15 },
  });
  expect(created.status()).toBe(201);
  const { account } = (await created.json()) as { account: { id: string } };

  const order = await page.request.post("/api/admin/orders", {
    data: {
      source: "phone",
      customer: { phone: "5165550371", name: "E2E Buyer" },
      fulfillment: { method: "in-store" },
      lines: [{ kind: "custom", title: "Lobby arrangement", priceCents: 12000, qty: 1 }],
      payment: { status: "account", accountId: account.id },
    },
  });
  expect(order.status()).toBe(201);

  const issued = await page.request.post(`/api/admin/accounts/${account.id}/statements`);
  expect(issued.status()).toBe(201);
  const { statement } = (await issued.json()) as { statement: { id: string; code: string; number: string } };

  const open = await page.request.get(`/s/${statement.code}`);
  expect(open.status()).toBe(200);
  const openHtml = await open.text();
  expect(openHtml).toContain(statement.number);
  expect(openHtml).toContain("Balance due");
  expect(openHtml).toContain(`/s/${statement.code}/pay`);

  await page.goto(`/en/admin/accounts/${account.id}`);
  await expect(page.getByRole("heading", { name: `E2E Hotel ${unique}` })).toBeVisible();
  await expect(page.getByText(statement.number)).toBeVisible();

  const detail = await (await page.request.get(`/api/admin/accounts/${account.id}`)).json() as { balanceCents: number };
  const paid = await page.request.post(`/api/admin/accounts/${account.id}/payments`, {
    data: { amountCents: detail.balanceCents, method: "zelle", note: "e2e" },
  });
  expect(paid.status()).toBe(200);

  const settled = await (await page.request.get(`/s/${statement.code}`)).text();
  expect(settled).toContain("Paid");
  expect(settled).not.toContain(`/s/${statement.code}/pay`);

  await page.reload();
  await expect(page.getByText("$0.00").first()).toBeVisible();
});
```

- [ ] **Step 2: Run the e2e spec**

Run: `npx playwright test tests/e2e/house-accounts.spec.ts`
Expected: PASS. (Playwright starts the dev server on :3333 with `data/diva.e2e.sqlite`; if the admin UI under `/en` renders different copy than expected, adjust the two visible-text assertions to the actual English strings from `messages/en.json`.)

- [ ] **Step 3: Write the ops doc**

```markdown
# House accounts (cuentas por cobrar)

Organizations with a house account order through the admin intake with the
"A cuenta" payment option. Nothing is charged at order time; the daily job
closes each account's period on its issue day, freezes a statement, and
queues the statement text and its reminders. Staff see the queue at
`/admin/accounts` and can send, skip or reschedule anything by hand.

The customer gets a short link (`https://makythedivaflowers.com/s/<code>`)
that shows the statement, prints to PDF, and pays by card through Stripe
Checkout. Zelle, cash, ACH and check payments are recorded on the account's
page ("Registrar pago"); payments are applied oldest-first to the orders on
the account so the ledger, Bandeja and metrics agree.

## Wiring the cron

Same pattern as `docs/ops/date-reminders.md`, same `CRON_SECRET`:

```bash
# 09:20 America/New_York, every day (after the date reminders at 09:15)
20 9 * * * curl -fsS -X POST https://makythedivaflowers.com/api/cron/house-accounts \
  -H "Authorization: Bearer $CRON_SECRET" >> /var/log/diva-house-accounts.log 2>&1
```

## Safety properties

- **Issue once per period.** A live statement per `(account, period_end)` is
  enforced by the database; a second run the same day issues nothing.
- **Send once.** Every queued message is claimed (`scheduled → sending`)
  before it goes out. A second run, a retry or a manual "Enviar ya" cannot
  text the same row twice. A crash mid-send is turned into a failed row an
  hour later and shows in the queue with "interrumpido".
- **Dry run still records.** With Twilio off or in dry-run the row is marked
  sent with `dry-run` as the sid, exactly like the date reminders.
- **Paused accounts freeze.** Nothing goes out while an account is paused;
  on reactivation, anything that fell due meanwhile is marked skipped, never
  sent in a burst.
- **Opt-out respected.** A billing phone that replied STOP gets no SMS; the
  email still goes if the account has one, and the queue row says why.
- **Stripe is idempotent.** The webhook records a statement payment once per
  Checkout session (`UNIQUE stripe_session_id`).

## Checking it ran

```bash
curl -fsS -X POST http://localhost:3000/api/cron/house-accounts -H "Authorization: Bearer $CRON_SECRET"
# {"ok":true,"today":"2026-10-01","issued":2,"sent":2,"skipped":0,"failed":0}
```

Server logs carry a `house_accounts_run` line with the same counts.

## Defaults

New accounts start monthly on the 1st, 15-day terms, reminders at −3, 0 and
+7 days (SMS, SMS, SMS + email), statement by SMS + email. To change the
defaults for new accounts, insert a `settings` row with key
`house_account_defaults` and a JSON value of the same shape (see
`lib/house-account-plan.ts`). Existing accounts keep their own plan.
```

- [ ] **Step 4: Full verification**

Run, in order, and compare any failures against the known pre-existing baseline (Chromium spawn ENOEXEC + checkout/preview specs):

```bash
npm test
```

```bash
npx tsc --noEmit
```

```bash
rm -f data/diva.sqlite data/diva.sqlite-wal data/diva.sqlite-shm && npm run build
```

Expected: only baseline failures in `npm test`; clean types; the build applies migration 030 from an empty database without a "duplicate column" error.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/house-accounts.spec.ts docs/ops/house-accounts.md
git commit -m "test(e2e): house account statement flow; docs(ops): house accounts cron

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

- [ ] **Step 6: Deploy notes for the owner (do not run; report)**

- Add the crontab line from the ops doc on Hostinger.
- No new environment variables.
- Purge the Hostinger CDN after deploying, as always.
