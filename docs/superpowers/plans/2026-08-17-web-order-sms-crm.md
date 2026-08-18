# Web Order SMS Confirmation & Customer Base — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the existing (intake-only) Twilio rail to the web checkout so every paid web order confirms by SMS and creates a CRM customer, backfill the customers lost while it was unwired, and make the bought-once-never-returned customer findable.

**Architecture:** One new module, `lib/on-web-order-paid.ts`, is called from the two places a web order reaches paid state (the `payment_intent.succeeded` webhook branch and the gift-card full-coverage branch in `/api/checkout/intent`). It re-reads the order by id, upserts the CRM customer, links it back onto the order, then dispatches the SMS through the existing `dispatchPaymentConfirmed`. A one-off `tsx` script replays the same upsert over historical paid orders without sending anything. Segmentation gains a derived `lapsed` flag — no migration.

**Tech Stack:** Next.js 16 (App Router), TypeScript, `node:sqlite` via `lib/db.ts`, Stripe SDK, `twilio` SDK, next-intl, vitest + Testing Library, tsx for scripts.

**Spec:** `docs/superpowers/specs/2026-08-17-web-order-sms-crm-design.md`

---

## Before you start

Read the spec. Then note three things about this codebase that will bite you otherwise:

1. **`server-only` is aliased in tests.** `vitest.config.ts` maps `server-only` to `tests/stubs/server-only.ts`, so `lib/*` modules that import it are testable directly. Do not add `vi.mock("server-only")`.
2. **Every DB test uses an in-memory database.** The pattern is `vi.stubEnv("SQLITE_FILE", ":memory:")` in `beforeEach` and `closeDb()` in `afterEach`. `getDb()` caches a singleton, so skipping `closeDb()` leaks state between tests.
3. **`npm test` has ~7 pre-existing failures on `main`** (Chromium spawn ENOEXEC plus checkout/preview specs). Before you blame your change, run the suite on the base commit and diff the failure list.

Two deliberate refinements to the spec, both decided while reading the code:

- **`onWebOrderPaid` takes an `orderId: string`, not an `Order`.** The spec said `Order`. The webhook fetches the order *before* marking it paid, so passing that stale object into a function that ends up calling `updateOrder()` would write `paymentStatus: "pending"` back over a paid order. Taking an id and re-reading makes that class of bug impossible.
- **The `lapsed` filter test lives in `tests/unit/api-admin-customers-list.test.ts`**, not `customer-storage.test.ts` as the spec said. The `seedCustomer` / `seedOrder` helpers already exist there and exercise route → storage → metrics end to end.

---

## File structure

**New**

| File | Responsibility |
|---|---|
| `lib/on-web-order-paid.ts` | The single side-effect hook for a paid web order: CRM upsert → link → SMS. Nothing else. |
| `scripts/backfill-customers-from-orders.ts` | One-off, dry-run-by-default recovery of customers from historical paid orders. Sends nothing. |
| `scripts/tsconfig.json` | Runtime module resolution for tsx scripts that import `lib/*` — see Task 8, Step 3. |
| `tests/unit/on-web-order-paid.test.ts` | Behaviour and failure isolation of the hook. |
| `tests/unit/backfill-customers.test.ts` | Grouping, merging, idempotency, and the no-messaging guarantee. |

**Modified**

| File | Change |
|---|---|
| `lib/customer-metrics.ts` | `isLapsed`, `lapsed` in `Segment`, precedence |
| `components/admin/customers/SegmentBadge.tsx` | style entry for `lapsed` |
| `lib/customer-storage.ts` | `lapsed` filter predicate, `lapsedCount` stat |
| `app/api/admin/customers/route.ts` | allow `lapsed` in the segment query param |
| `components/admin/customers/CustomersList.tsx` | filter chip, stat card, 5-column grid |
| `messages/en.json`, `messages/es.json` | `badge_lapsed`, `seg_lapsed`, `stat_lapsed` |
| `lib/messaging-templates.ts` | `order_number` in `TemplateVars`, new copy, WhatsApp slot |
| `lib/order-dispatch.ts` | pass `order_number` through |
| `app/api/stripe/webhook/route.ts` | call the hook in `payment_intent.succeeded` |
| `app/api/checkout/intent/route.ts` | call the hook in the gift-card full-coverage branch |
| `package.json` | `backfill:customers` script |
| `tests/unit/customer-metrics.test.ts` | lapsed cases |
| `tests/unit/api-admin-customers-list.test.ts` | lapsed filter + stat |
| `tests/unit/CustomersList.test.tsx` | chip + stat render |
| `tests/unit/messaging-templates.test.ts` | order number present/absent |
| `tests/unit/api-stripe-webhook.test.ts` | hook is called on payment success |

No database migration. `lapsed` is derived at query time.

---

## Task 1: The `lapsed` metric

Adding `"lapsed"` to the `Segment` union breaks `Record<Segment, string>` in `SegmentBadge`, and rendering a badge whose i18n key is missing throws in next-intl. So the style entry and the badge copy ship in this same task — otherwise the repo is red between commits.

**Files:**
- Modify: `lib/customer-metrics.ts:10` (type), `:63-95` (`metricsFromAggregate`)
- Modify: `components/admin/customers/SegmentBadge.tsx:5-10`
- Modify: `messages/en.json`, `messages/es.json` (`admin_customers` section)
- Test: `tests/unit/customer-metrics.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `tests/unit/customer-metrics.test.ts`, inside the existing `describe("computeMetrics", ...)` block. The `order(daysAgo, paidCents)` helper and `NOW` already exist at the top of that file.

```ts
  it("one order older than the cutoff → lapsed", () => {
    const m = computeMetrics([order(91, 5000)], NOW);
    expect(m.isLapsed).toBe(true);
    expect(m.isAtRisk).toBe(false);
    expect(m.segment).toBe("lapsed");
  });

  it("one recent order → new, not lapsed", () => {
    const m = computeMetrics([order(10, 5000)], NOW);
    expect(m.isLapsed).toBe(false);
    expect(m.segment).toBe("new");
  });

  it("two old orders stay at_risk and are never lapsed", () => {
    const m = computeMetrics([order(91, 5000), order(120, 5000)], NOW);
    expect(m.isLapsed).toBe(false);
    expect(m.isAtRisk).toBe(true);
    expect(m.segment).toBe("at_risk");
  });

  it("one big old order is badged vip by precedence but still flagged lapsed", () => {
    const m = computeMetrics([order(91, 60000)], NOW);
    expect(m.isVip).toBe(true);
    expect(m.isLapsed).toBe(true);
    expect(m.segment).toBe("vip");
  });

  it("a customer with no orders is not lapsed", () => {
    const m = computeMetrics([], NOW);
    expect(m.isLapsed).toBe(false);
  });
```

The fourth test is the one that matters: the badge and the flag are allowed to disagree, and Task 2 relies on that.

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npm test -- tests/unit/customer-metrics.test.ts
```

Expected: FAIL — `isLapsed` is `undefined`, so `expect(undefined).toBe(true)` fails and `segment` is `"new"` where `"lapsed"` is expected.

- [ ] **Step 3: Add the flag and the segment**

In `lib/customer-metrics.ts`, widen the union on line 10:

```ts
export type Segment = "new" | "recurring" | "vip" | "at_risk" | "lapsed";
```

Add the field to `CustomerMetrics` (after `isRecurring`):

```ts
  isRecurring: boolean;
  isLapsed: boolean;
```

Replace the `isAtRisk` / `segment` block inside `metricsFromAggregate` with this. The cutoff is hoisted to a local because both flags now need it:

```ts
  const cutoff = atRiskCutoffIso(now);
  // At-risk compares lastOrderAt against the same ISO cutoff the SQL filter and
  // header stat use, so the badge, the "At risk" filter, and the at-risk count
  // always agree — including the sub-day (90, 91) window that a floored day-count
  // comparison (daysSinceLastOrder > AT_RISK_DAYS) would split.
  const isAtRisk = isRecurring && lastOrderAt !== null && lastOrderAt < cutoff;
  // Lapsed is the other half of that story: bought exactly once, long ago, never
  // came back. Kept separate from at_risk because it is a different audience and
  // deserves a different message.
  const isLapsed = agg.orderCount === 1 && lastOrderAt !== null && lastOrderAt < cutoff;
  const segment: Segment = isAtRisk
    ? "at_risk"
    : isVip
      ? "vip"
      : isRecurring
        ? "recurring"
        : isLapsed
          ? "lapsed"
          : "new";
```

And add `isLapsed` to the returned object, next to `isRecurring`:

```ts
    isRecurring,
    isLapsed,
```

- [ ] **Step 4: Add the badge style**

In `components/admin/customers/SegmentBadge.tsx`, add the entry to `STYLES`:

```ts
const STYLES: Record<Segment, string> = {
  new: "bg-sky-50 text-sky-800",
  recurring: "bg-emerald-50 text-emerald-800",
  vip: "bg-amber-50 text-amber-800",
  at_risk: "bg-rose-50 text-rose-800",
  lapsed: "bg-stone-100 text-stone-700",
};
```

- [ ] **Step 5: Add the badge copy**

In `messages/en.json`, inside `admin_customers`, after `"badge_at_risk"`:

```json
    "badge_lapsed": "Lapsed",
```

In `messages/es.json`, same place:

```json
    "badge_lapsed": "Sin volver",
```

- [ ] **Step 6: Run the tests to verify they pass**

```bash
npm test -- tests/unit/customer-metrics.test.ts
```

Expected: PASS, all tests in the file.

- [ ] **Step 7: Typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors. If `SegmentBadge` still errors, the `STYLES` entry from Step 4 is missing.

- [ ] **Step 8: Commit**

```bash
git add lib/customer-metrics.ts components/admin/customers/SegmentBadge.tsx messages/en.json messages/es.json tests/unit/customer-metrics.test.ts
git commit -m "feat(crm): add lapsed segment for one-and-done customers"
```

---

## Task 2: The `lapsed` filter and stat

**Files:**
- Modify: `lib/customer-storage.ts` (`CustomerSegmentFilter`, `CustomerListStats`, `listCustomers` switch, `customerStats`)
- Modify: `app/api/admin/customers/route.ts:11`
- Test: `tests/unit/api-admin-customers-list.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `tests/unit/api-admin-customers-list.test.ts`. The `seedCustomer`, `seedOrder`, and `seed` helpers already exist at the top of that file — `seed()` creates Ana (5 recent orders, VIP) and Bob (2 orders at 100 and 150 days, at-risk), neither of whom is lapsed.

```ts
it("segment=lapsed returns only single-order customers past the cutoff", async () => {
  seed();
  seedCustomer("cleo", "Cleo", "5550003");
  seedOrder("c1", "cleo", 120, 9000); // one order, 120 days ago → lapsed
  seedCustomer("dan", "Dan", "5550004");
  seedOrder("d1", "dan", 5, 9000); // one order, 5 days ago → new

  const res = await GET(new Request("http://x/api/admin/customers?segment=lapsed"));
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.customers.map((c: { id: string }) => c.id)).toEqual(["cleo"]);
});

it("counts lapsed customers in the header stats", async () => {
  seedCustomer("cleo", "Cleo", "5550003");
  seedOrder("c1", "cleo", 120, 9000);
  seedCustomer("dan", "Dan", "5550004");
  seedOrder("d1", "dan", 5, 9000);

  const res = await GET(new Request("http://x/api/admin/customers"));
  const body = await res.json();
  expect(body.stats.lapsedCount).toBe(1);
});

it("a lapsed customer badged vip by precedence still matches the lapsed filter", async () => {
  seedCustomer("eve", "Eve", "5550005");
  seedOrder("e1", "eve", 120, 60000); // one order, 120 days, $600 → vip badge, lapsed flag

  const res = await GET(new Request("http://x/api/admin/customers?segment=lapsed"));
  const body = await res.json();
  expect(body.customers.map((c: { id: string }) => c.id)).toEqual(["eve"]);
  expect(body.customers[0].metrics.segment).toBe("vip");
  expect(body.customers[0].metrics.isLapsed).toBe(true);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npm test -- tests/unit/api-admin-customers-list.test.ts
```

Expected: FAIL — the route drops the unknown `segment=lapsed` value, so the first and third tests return every customer instead of one; `stats.lapsedCount` is `undefined`.

- [ ] **Step 3: Widen the filter type and add the predicate**

In `lib/customer-storage.ts`, widen the filter union:

```ts
export type CustomerSegmentFilter = "new" | "recurring" | "vip" | "at_risk" | "lapsed";
```

Add a `lapsedCount` to `CustomerListStats`:

```ts
export type CustomerListStats = {
  total: number;
  newThisMonth: number;
  repeatRatePct: number;
  atRiskCount: number;
  lapsedCount: number;
};
```

Add the arm to the `switch (filters.segment)` inside `listCustomers`, right after the `at_risk` case. It matches the `isLapsed` flag from Task 1, not the primary badge — that is why the VIP test above passes:

```ts
    case "lapsed":
      where.push(`(COALESCE(a.o_count, 0) = 1 AND a.last_order_at < ?)`);
      params.push(atRiskCutoffIso(now));
      break;
```

- [ ] **Step 4: Add the stat**

In `customerStats`, the aggregate query currently takes a single `?`. It now takes two, in SQL order. Replace the `db.prepare(...).get(...)` block with:

```ts
  const cutoff = atRiskCutoffIso(now);
  const row = db
    .prepare(
      `SELECT SUM(CASE WHEN o_count >= ${RECURRING_MIN_ORDERS} THEN 1 ELSE 0 END) AS repeat_n,
              SUM(CASE WHEN o_count >= ${RECURRING_MIN_ORDERS} AND last_order_at < ? THEN 1 ELSE 0 END) AS at_risk_n,
              SUM(CASE WHEN o_count = 1 AND last_order_at < ? THEN 1 ELSE 0 END) AS lapsed_n
       FROM (SELECT COALESCE(a.o_count, 0) AS o_count, a.last_order_at ${AGG_JOIN})`,
    )
    .get(cutoff, cutoff) as {
      repeat_n: number | null;
      at_risk_n: number | null;
      lapsed_n: number | null;
    };
```

and add the field to the returned object:

```ts
    atRiskCount: row.at_risk_n ?? 0,
    lapsedCount: row.lapsed_n ?? 0,
```

- [ ] **Step 5: Allow the value through the route**

In `app/api/admin/customers/route.ts`, line 11:

```ts
const SEGMENTS = new Set<string>(["new", "recurring", "vip", "at_risk", "lapsed"]);
```

- [ ] **Step 6: Run the tests to verify they pass**

```bash
npm test -- tests/unit/api-admin-customers-list.test.ts
```

Expected: PASS, all tests in the file including the pre-existing ones.

- [ ] **Step 7: Commit**

```bash
git add lib/customer-storage.ts app/api/admin/customers/route.ts tests/unit/api-admin-customers-list.test.ts
git commit -m "feat(crm): filter and count the lapsed segment"
```

---

## Task 3: Surface it in the customers dashboard

**Files:**
- Modify: `components/admin/customers/CustomersList.tsx:17-23` (chips), `:84-89` (stats), `:97` (grid)
- Modify: `messages/en.json`, `messages/es.json`
- Test: `tests/unit/CustomersList.test.tsx`

- [ ] **Step 1: Write the failing test**

`tests/unit/CustomersList.test.tsx` builds an `initial: CustomerListResult` fixture at the top. Two edits to it, then a new test.

First, the fixture's `stats` object needs the new field, and both `metrics` objects need `isLapsed` — TypeScript will not compile the file otherwise:

```ts
  stats: { total: 2, newThisMonth: 1, repeatRatePct: 100, atRiskCount: 1, lapsedCount: 3 },
```

Add `isLapsed: false` to Ana's metrics object and to Bob's metrics object, next to `isRecurring: true`.

Then append this test inside `describe("CustomersList", ...)`:

```ts
  it("renders the lapsed chip and the lapsed stat", () => {
    wrap(<CustomersList locale="es" initial={initial} allTags={["boda"]} />);
    // Chip and stat card share the Spanish label, so both nodes must be present.
    expect(screen.getAllByText("Sin volver").length).toBe(2);
    expect(screen.getByText("3")).toBeDefined(); // lapsedCount
  });
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test -- tests/unit/CustomersList.test.tsx
```

Expected: FAIL — `getAllByText("Sin volver")` finds 0 nodes and throws "Unable to find an element with the text".

- [ ] **Step 3: Add the chip, the stat, and a fifth column**

In `components/admin/customers/CustomersList.tsx`, extend `SEGMENTS`:

```ts
const SEGMENTS: Array<{ id: CustomerSegmentFilter | "all"; key: string }> = [
  { id: "all", key: "seg_all" },
  { id: "new", key: "seg_new" },
  { id: "recurring", key: "seg_recurring" },
  { id: "vip", key: "seg_vip" },
  { id: "at_risk", key: "seg_at_risk" },
  { id: "lapsed", key: "seg_lapsed" },
];
```

Extend the `stats` array inside the component:

```ts
  const stats: Array<{ key: string; value: string }> = [
    { key: "stat_total", value: String(s.total) },
    { key: "stat_new_month", value: String(s.newThisMonth) },
    { key: "stat_repeat_rate", value: `${s.repeatRatePct}%` },
    { key: "stat_at_risk", value: String(s.atRiskCount) },
    { key: "stat_lapsed", value: String(s.lapsedCount) },
  ];
```

The stats grid is hard-coded to four columns and would wrap the fifth card onto its own row. Widen it:

```tsx
      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
```

- [ ] **Step 4: Add the copy**

`messages/en.json`, in `admin_customers`, next to the sibling keys:

```json
    "stat_lapsed": "Lapsed",
    "seg_lapsed": "Lapsed",
```

`messages/es.json`:

```json
    "stat_lapsed": "Sin volver",
    "seg_lapsed": "Sin volver",
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
npm test -- tests/unit/CustomersList.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors. A complaint about a missing `lapsedCount` means some other `CustomerListStats` fixture in the test suite needs the field too — add it there.

- [ ] **Step 7: Commit**

```bash
git add components/admin/customers/CustomersList.tsx messages/en.json messages/es.json tests/unit/CustomersList.test.tsx
git commit -m "feat(crm): show the lapsed chip and stat in the customers dashboard"
```

---

## Task 4: Put the order number in the confirmation SMS

There is an existing assertion in `tests/unit/messaging-templates.test.ts` that the Spanish `payment_confirmed` body contains `"Recibimos tu pago"`. The new copy says `"Diva Flowers recibió tu pago"`. **That assertion has to be updated in this task** — it is a deliberate copy change, not a regression.

**Files:**
- Modify: `lib/messaging-templates.ts`
- Modify: `lib/order-dispatch.ts:60-74`, `:84-97`
- Test: `tests/unit/messaging-templates.test.ts`

- [ ] **Step 1: Write the failing tests**

In `tests/unit/messaging-templates.test.ts`, update the existing Spanish assertion:

```ts
  it("renders payment_confirmed in Spanish", () => {
    const body = renderSmsBody("payment_confirmed", "es", vars);
    expect(body).toContain("¡Gracias Lola");
    expect(body).toContain("recibió tu pago");
  });
```

Then append these to the same `describe("renderSmsBody", ...)` block. The shared `vars` fixture stays without `order_number` so the existing tests keep covering the absent case:

```ts
  it("payment_confirmed includes the order number when there is one", () => {
    const es = renderSmsBody("payment_confirmed", "es", { ...vars, order_number: "1042" });
    expect(es).toContain("Orden #1042, total $205.51.");
    const en = renderSmsBody("payment_confirmed", "en", { ...vars, order_number: "1042" });
    expect(en).toContain("Order #1042, total $205.51.");
  });

  it("payment_confirmed falls back to a clean sentence without an order number", () => {
    const es = renderSmsBody("payment_confirmed", "es", vars);
    expect(es).not.toContain("#");
    expect(es).toContain("Total $205.51.");
    const en = renderSmsBody("payment_confirmed", "en", vars);
    expect(en).not.toContain("#");
    expect(en).toContain("Total $205.51.");
  });

  it("keeps the English payment_confirmed under 160 chars with an order number", () => {
    const body = renderSmsBody("payment_confirmed", "en", { ...vars, order_number: "1042" });
    expect(body.length).toBeLessThanOrEqual(160);
  });
```

And extend the WhatsApp slot test:

```ts
  it("returns numbered slots for payment_confirmed", () => {
    const slots = whatsappContentVars("payment_confirmed", { ...vars, order_number: "1042" });
    expect(slots["1"]).toBe("Lola");
    expect(slots["2"]).toBe("Sat May 17 · afternoon (12–4 pm)");
    expect(slots["3"]).toBe("1042");
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npm test -- tests/unit/messaging-templates.test.ts
```

Expected: FAIL — `order_number` is not a property of `TemplateVars` (type error), and the rendered body contains neither `"Orden #1042"` nor `"Total $205.51."`.

- [ ] **Step 3: Rewrite the template**

In `lib/messaging-templates.ts`, add the optional field to `TemplateVars`:

```ts
export type TemplateVars = {
  recipient_name: string;
  total: string;
  window?: string;
  link?: string;
  shop_phone: string;
  order_number?: string;
};
```

Add this helper above the `BODIES` constant. It keeps the sentence grammatical whether or not the order has a number — orders created before the order-number feature have none:

```ts
/** "Orden #1042, total $89.50." — or just "Total $89.50." when the order predates
 *  sequential numbering. Capitalisation differs between the two, so this cannot
 *  be a simple optional suffix. */
function totalSentence(v: TemplateVars, locale: "en" | "es"): string {
  const label = locale === "es" ? "Orden" : "Order";
  return v.order_number
    ? `${label} #${v.order_number}, total ${v.total}.`
    : `Total ${v.total}.`;
}
```

Replace both `payment_confirmed` bodies:

```ts
    payment_confirmed: (v) =>
      `Thanks ${v.recipient_name}! Diva Flowers received your payment. ${totalSentence(v, "en")} Delivery ${v.window ?? ""}. — Maky`,
```

```ts
    payment_confirmed: (v) =>
      `¡Gracias ${v.recipient_name}! Diva Flowers recibió tu pago. ${totalSentence(v, "es")} Entrega ${v.window ?? ""}. — Maky`,
```

Add the WhatsApp slot so both renderers describe the same message:

```ts
    case "payment_confirmed":
      return { "1": vars.recipient_name, "2": vars.window ?? "", "3": vars.order_number ?? "" };
```

- [ ] **Step 4: Feed the number in from the dispatcher**

In `lib/order-dispatch.ts`, add one line to the `vars` object in **both** `dispatchOrderReceived` and `dispatchPaymentConfirmed`:

```ts
      order_number: order.orderNumber != null ? String(order.orderNumber) : undefined,
```

`dispatchOrderReceived` renders `order_received` / `payment_link`, which ignore the field — passing it anyway keeps the two call sites identical and means the copy can use it later without touching the dispatcher.

- [ ] **Step 5: Run the tests to verify they pass**

```bash
npm test -- tests/unit/messaging-templates.test.ts
```

Expected: PASS, all tests in the file.

- [ ] **Step 6: Commit**

```bash
git add lib/messaging-templates.ts lib/order-dispatch.ts tests/unit/messaging-templates.test.ts
git commit -m "feat(messaging): include the order number in the confirmation SMS"
```

---

## Task 5: The paid-web-order hook

**Files:**
- Create: `lib/on-web-order-paid.ts`
- Test: `tests/unit/on-web-order-paid.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/on-web-order-paid.test.ts`. The mock-const-then-`vi.mock` shape below is the one already used in `tests/unit/api-stripe-webhook.test.ts`; vitest hoists the `vi.mock` call but runs the factory lazily at import time, so the consts are initialised by then.

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Order } from "@/types/order";

const upsertOnOrderMock = vi.fn();
vi.mock("@/lib/customer-storage", () => ({
  upsertOnOrder: (...args: unknown[]) => upsertOnOrderMock(...args),
}));

const getOrderMock = vi.fn();
const updateOrderMock = vi.fn();
vi.mock("@/lib/order-storage", () => ({
  getOrder: (...args: unknown[]) => getOrderMock(...args),
  updateOrder: (...args: unknown[]) => updateOrderMock(...args),
}));

const dispatchPaymentConfirmedMock = vi.fn();
vi.mock("@/lib/order-dispatch", () => ({
  dispatchPaymentConfirmed: (...args: unknown[]) => dispatchPaymentConfirmedMock(...args),
}));

import { onWebOrderPaid } from "@/lib/on-web-order-paid";

const ORDER: Order = {
  id: "do_1",
  orderNumber: 1042,
  source: "web",
  locale: "en",
  lines: [],
  fulfillment: {
    method: "delivery",
    recipient: { name: "Ana Recipient", phone: "5165550111" },
    address: { street1: "1 Main", city: "Albertson", state: "NY", zip: "11507", country: "US" },
    window: { date: "2026-08-21", slot: "morning" },
  },
  contact: { name: "Bob Buyer", email: "bob@example.com", phone: "5165550100" },
  totals: { subtotalCents: 8000, deliveryCents: 0, taxCents: 690, totalCents: 8690 },
  status: "pending",
  paymentStatus: "paid",
  paidAt: "2026-08-17T15:00:00Z",
  createdAt: "2026-08-17T14:00:00Z",
  updatedAt: "2026-08-17T15:00:00Z",
};

beforeEach(() => {
  upsertOnOrderMock.mockReset().mockReturnValue({ id: "cus_1" });
  getOrderMock.mockReset().mockResolvedValue(ORDER);
  updateOrderMock.mockReset().mockResolvedValue(undefined);
  dispatchPaymentConfirmedMock.mockReset().mockResolvedValue(undefined);
});

describe("onWebOrderPaid", () => {
  it("creates the customer and links it before dispatching the SMS", async () => {
    const calls: string[] = [];
    upsertOnOrderMock.mockImplementation(() => { calls.push("upsert"); return { id: "cus_1" }; });
    updateOrderMock.mockImplementation(async () => { calls.push("update"); });
    dispatchPaymentConfirmedMock.mockImplementation(async () => { calls.push("dispatch"); });

    await onWebOrderPaid("do_1");

    // Order is load-bearing: dispatchPaymentConfirmed looks the customer up by
    // phone to honour their channel and locale, so the upsert must land first.
    expect(calls).toEqual(["upsert", "update", "dispatch"]);
  });

  it("maps the buyer, not the recipient, onto the customer record", async () => {
    await onWebOrderPaid("do_1");
    expect(upsertOnOrderMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Bob Buyer",
        phone: "5165550100",
        email: "bob@example.com",
        locale: "en",
        orderAt: "2026-08-17T15:00:00Z",
      }),
    );
  });

  it("falls back to the recipient name when the buyer left theirs blank", async () => {
    getOrderMock.mockResolvedValue({ ...ORDER, contact: { ...ORDER.contact, name: "  " } });
    await onWebOrderPaid("do_1");
    expect(upsertOnOrderMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Ana Recipient" }),
    );
  });

  it("writes the customer id back onto the order", async () => {
    await onWebOrderPaid("do_1");
    expect(updateOrderMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: "do_1", customerId: "cus_1" }),
    );
  });

  it("does nothing when the order already has a customer", async () => {
    getOrderMock.mockResolvedValue({ ...ORDER, customerId: "cus_existing" });
    await onWebOrderPaid("do_1");
    expect(upsertOnOrderMock).not.toHaveBeenCalled();
    expect(dispatchPaymentConfirmedMock).not.toHaveBeenCalled();
  });

  it("does nothing when the order is gone", async () => {
    getOrderMock.mockResolvedValue(null);
    await expect(onWebOrderPaid("missing")).resolves.toBeUndefined();
    expect(upsertOnOrderMock).not.toHaveBeenCalled();
  });

  it("swallows a messaging failure so the webhook still returns 200", async () => {
    dispatchPaymentConfirmedMock.mockRejectedValue(new Error("twilio exploded"));
    await expect(onWebOrderPaid("do_1")).resolves.toBeUndefined();
  });

  it("swallows a CRM failure too", async () => {
    upsertOnOrderMock.mockImplementation(() => { throw new Error("db locked"); });
    await expect(onWebOrderPaid("do_1")).resolves.toBeUndefined();
    expect(dispatchPaymentConfirmedMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test -- tests/unit/on-web-order-paid.test.ts
```

Expected: FAIL — `Failed to resolve import "@/lib/on-web-order-paid"`.

- [ ] **Step 3: Write the module**

Create `lib/on-web-order-paid.ts`:

```ts
import "server-only";
import { upsertOnOrder } from "@/lib/customer-storage";
import { getOrder, updateOrder } from "@/lib/order-storage";
import { dispatchPaymentConfirmed } from "@/lib/order-dispatch";
import type { Order } from "@/types/order";

/** The buyer names the customer record. Web checkout lets the buyer leave their
 *  own name blank, in which case the recipient is the only name we have. */
function buyerName(order: Order): string {
  const fromContact = order.contact.name?.trim();
  if (fromContact) return fromContact;
  return order.fulfillment.recipient.name.trim();
}

/**
 * Side effects owed to the customer once a web order is actually paid: put them
 * in the CRM, link the order to them, then confirm by SMS.
 *
 * Takes an id rather than an Order on purpose. Callers hold order snapshots read
 * *before* the payment was recorded, and this function writes the order back —
 * passing a stale object would stamp `paymentStatus: "pending"` over a paid row.
 *
 * Never throws. Both call sites are payment paths: the Stripe webhook must return
 * 200 or Stripe retries it, re-running the shop email and the print job.
 */
export async function onWebOrderPaid(orderId: string): Promise<void> {
  try {
    const order = await getOrder(orderId);
    if (!order) return;
    // Idempotency: Stripe retries webhooks, and upsertOnOrder increments
    // order_count on every call. The link is the guard.
    if (order.customerId) return;

    const customer = upsertOnOrder({
      name: buyerName(order),
      phone: order.contact.phone,
      email: order.contact.email || undefined,
      address: order.fulfillment.method === "delivery" ? order.fulfillment.address : undefined,
      orderAt: order.paidAt ?? order.createdAt,
      locale: order.locale,
      // messagingChannel is deliberately unset — dispatch defaults to SMS, and
      // this is the field the checkout consent box will write in Delivery 3.
    });

    const linked: Order = { ...order, customerId: customer.id };
    await updateOrder(linked);
    await dispatchPaymentConfirmed(linked);
  } catch (e) {
    console.error(
      JSON.stringify({
        event: "web_order_paid_hook_failed",
        orderId,
        error: e instanceof Error ? e.message : String(e),
      }),
    );
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm test -- tests/unit/on-web-order-paid.test.ts
```

Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/on-web-order-paid.ts tests/unit/on-web-order-paid.test.ts
git commit -m "feat(messaging): add the paid-web-order hook (CRM upsert + SMS)"
```

---

## Task 6: Call the hook from the Stripe webhook

**Files:**
- Modify: `app/api/stripe/webhook/route.ts` (`payment_intent.succeeded` branch)
- Test: `tests/unit/api-stripe-webhook.test.ts`

- [ ] **Step 1: Write the failing test**

In `tests/unit/api-stripe-webhook.test.ts`, register a mock for the new module alongside the existing ones (near the `vi.mock("@/lib/order-dispatch", ...)` block):

```ts
const onWebOrderPaidMock = vi.fn();
vi.mock("@/lib/on-web-order-paid", () => ({
  onWebOrderPaid: onWebOrderPaidMock,
}));
```

Add `onWebOrderPaidMock.mockReset();` to the existing `beforeEach`.

Then append these two tests inside the existing `describe("POST /api/stripe/webhook", ...)` block. They use the file's own `makeOrder(id, piId, paymentStatus?)` and `makeReq(body, sig?)` helpers, and the dynamic `await import` of the route that every test in this file uses:

```ts
  it("runs the paid-web-order hook once on payment_intent.succeeded", async () => {
    await saveOrder(makeOrder("o_hook", "pi_hook"));
    constructEvent.mockReturnValue({
      type: "payment_intent.succeeded",
      data: { object: { id: "pi_hook" } },
    });
    const { POST } = await import("@/app/api/stripe/webhook/route");
    const res = await POST(makeReq("{}"));
    expect(res.status).toBe(200);
    expect(onWebOrderPaidMock).toHaveBeenCalledTimes(1);
    expect(onWebOrderPaidMock).toHaveBeenCalledWith("o_hook");
  });

  it("does not run the hook again for an order that was already paid", async () => {
    await saveOrder(makeOrder("o_twice", "pi_twice", "paid"));
    constructEvent.mockReturnValue({
      type: "payment_intent.succeeded",
      data: { object: { id: "pi_twice" } },
    });
    const { POST } = await import("@/app/api/stripe/webhook/route");
    await POST(makeReq("{}"));
    expect(onWebOrderPaidMock).not.toHaveBeenCalled();
  });
```

The second test leans on the route's existing `wasAlreadyPaid` guard — `makeOrder(..., "paid")` sets `paymentStatus: "paid"`, so the whole side-effect block is skipped.

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test -- tests/unit/api-stripe-webhook.test.ts
```

Expected: FAIL — `onWebOrderPaidMock` has 0 calls.

- [ ] **Step 3: Wire it in**

In `app/api/stripe/webhook/route.ts`, add the import:

```ts
import { onWebOrderPaid } from "@/lib/on-web-order-paid";
```

Inside the `payment_intent.succeeded` case, in the `if (order && !wasAlreadyPaid) { ... }` block, add the call as the **last** statement — after the `enqueuePrintJob` try/catch:

```ts
          // CRM + customer SMS. Reads the order back itself, so it sees the paid
          // row written by updateOrderStatusByPaymentIntent above. Never throws.
          await onWebOrderPaid(order.id);
```

The `!wasAlreadyPaid` guard already makes this once-per-order; the hook's own `customerId` check is the second line of defence.

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm test -- tests/unit/api-stripe-webhook.test.ts
```

Expected: PASS, all tests in the file.

- [ ] **Step 5: Commit**

```bash
git add app/api/stripe/webhook/route.ts tests/unit/api-stripe-webhook.test.ts
git commit -m "feat(checkout): confirm paid web orders by SMS and add them to the CRM"
```

---

## Task 7: Call the hook from the gift-card path

An order fully covered by a gift card never reaches Stripe, so the webhook never fires and that buyer would silently get nothing.

**Files:**
- Modify: `app/api/checkout/intent/route.ts` (gift-card full-coverage branch)
- Test: `tests/unit/checkout-intent-gift-card.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/unit/checkout-intent-gift-card.test.ts` already covers the full-coverage branch. Add the mock next to the existing ones in that file:

```ts
const onWebOrderPaidMock = vi.fn();
vi.mock("@/lib/on-web-order-paid", () => ({
  onWebOrderPaid: onWebOrderPaidMock,
}));
```

No reset is needed — this file's `afterEach` already calls `vi.clearAllMocks()`.

Append these two tests inside `describe("intent route with gift card", ...)`. They use the file's own `body(code)` and `callIntent(b)` helpers and the already-imported `issueGiftCard`:

```ts
  it("runs the paid-web-order hook when a gift card covers the whole total", async () => {
    const card = issueGiftCard({ initialCents: 100000, recipientEmail: "a@b.com" });
    const res = await callIntent(body(card.code));
    const data = await res.json();
    expect(data.paid).toBe(true);
    expect(onWebOrderPaidMock).toHaveBeenCalledTimes(1);
    expect(onWebOrderPaidMock).toHaveBeenCalledWith(data.orderId);
  });

  it("leaves the hook to the webhook when Stripe still has to charge the remainder", async () => {
    const card = issueGiftCard({ initialCents: 500, recipientEmail: "a@b.com" });
    await callIntent(body(card.code));
    expect(onWebOrderPaidMock).not.toHaveBeenCalled();
  });
```

The second test matters as much as the first: a partially covered order is still charged through Stripe, so firing the hook here as well would double-run it.

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test -- tests/unit/checkout-intent-gift-card.test.ts
```

Expected: FAIL — `onWebOrderPaidMock` has 0 calls.

- [ ] **Step 3: Wire it in**

In `app/api/checkout/intent/route.ts`, add the import:

```ts
import { onWebOrderPaid } from "@/lib/on-web-order-paid";
```

In the `if (giftCardId && amountToCharge <= 0) { ... }` branch, add the call after the `enqueuePrintJob` try/catch and before the `return`:

```ts
    await onWebOrderPaid(order.id);
    return NextResponse.json({ paid: true, orderId }, { status: 200 });
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm test -- tests/unit/checkout-intent-gift-card.test.ts
```

Expected: PASS, all tests in the file.

- [ ] **Step 5: Commit**

```bash
git add app/api/checkout/intent/route.ts tests/unit/checkout-intent-gift-card.test.ts
git commit -m "feat(checkout): run the paid-order hook for gift-card-covered orders"
```

---

## Task 8: The backfill script

Recovers the customers lost while the web path was unwired. **It must never send a message** — replaying confirmations for months-old orders would be a real incident, so that is an asserted behaviour, not a convention.

**Files:**
- Create: `scripts/backfill-customers-from-orders.ts`
- Create: `scripts/tsconfig.json`
- Modify: `package.json` (scripts)
- Test: `tests/unit/backfill-customers.test.ts`

> **Read this before writing the script.** `lib/customer-storage.ts` and `lib/db.ts` both start with `import "server-only"`. That specifier is supplied by the Next compiler and **does not resolve under plain `tsx`** — `server-only` is not a real package in `node_modules`, so the script dies with `MODULE_NOT_FOUND` before it runs a single line. That is why `scripts/migrate-orders-json-to-sqlite.ts` reaches for `node:sqlite` directly instead of reusing `lib/db.ts`.
>
> Copying that workaround here is not an option: the spec requires this script to call the *same* `upsertOnOrder` as the live path so the semantics cannot drift. Step 3 solves it properly with a scripts-local tsconfig that maps `server-only` onto the no-op stub the test suite already uses. This was verified end to end — tsx honours tsconfig `paths` for bare specifiers, and `runMigrations()` + `upsertOnOrder()` run correctly under it.

- [ ] **Step 1: Write the failing test**

The script's logic lives in an exported `backfillCustomers()` so it is testable; the CLI wrapper at the bottom only parses flags and prints. Create `tests/unit/backfill-customers.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { backfillCustomers } from "@/scripts/backfill-customers-from-orders";

const DAY = 86_400_000;

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  runMigrations();
});
afterEach(() => {
  closeDb();
  vi.unstubAllEnvs();
});

function seedOrder(
  id: string,
  phone: string,
  daysAgo: number,
  paidCents: number,
  paymentStatus: "paid" | "pending" = "paid",
  customerId: string | null = null,
) {
  const at = new Date(Date.now() - daysAgo * DAY).toISOString();
  getDb()
    .prepare(
      `INSERT INTO orders (id, locale, source, customer_id, recipient_name, recipient_phone,
         contact_name, contact_email, contact_phone, fulfillment_method, lines_json,
         subtotal_cents, delivery_cents, tax_cents, total_cents, amount_paid_cents,
         fulfillment_status, payment_status, created_at, updated_at)
       VALUES (?, 'en', 'web', ?, 'R', ?, 'Buyer Name', 'b@x.com', ?, 'pickup', '[]',
         ?, 0, 0, ?, ?, 'pending', ?, ?, ?)`,
    )
    .run(id, customerId, phone, phone, paidCents, paidCents, paidCents, paymentStatus, at, at);
}

describe("backfillCustomers", () => {
  it("groups orders sharing a phone into one customer with the right first/last seen", () => {
    seedOrder("o1", "5165550100", 200, 5000);
    seedOrder("o2", "5165550100", 10, 7000);

    const report = backfillCustomers({ commit: true });

    expect(report.ordersScanned).toBe(2);
    expect(report.customersCreated).toBe(1);
    const rows = getDb().prepare("SELECT * FROM customers").all() as Array<{
      phone: string; order_count: number; first_seen_at: string; last_seen_at: string;
    }>;
    expect(rows.length).toBe(1);
    expect(rows[0].order_count).toBe(2);
    expect(new Date(rows[0].first_seen_at).getTime())
      .toBeLessThan(new Date(rows[0].last_seen_at).getTime());
  });

  it("merges into an existing customer instead of duplicating", () => {
    getDb()
      .prepare(
        `INSERT INTO customers (id, name, phone, order_count, first_seen_at, last_seen_at)
         VALUES ('cus_old', 'Counter Bob', '5165550100', 3, ?, ?)`,
      )
      .run(new Date(Date.now() - 300 * DAY).toISOString(), new Date().toISOString());
    seedOrder("o1", "(516) 555-0100", 10, 5000);

    const report = backfillCustomers({ commit: true });

    expect(report.customersCreated).toBe(0);
    expect(report.ordersMerged).toBe(1);
    const rows = getDb().prepare("SELECT * FROM customers").all();
    expect(rows.length).toBe(1);
    const order = getDb().prepare("SELECT customer_id FROM orders WHERE id = 'o1'").get() as
      { customer_id: string };
    expect(order.customer_id).toBe("cus_old");
  });

  it("skips unpaid orders and orders that already have a customer", () => {
    seedOrder("o1", "5165550100", 10, 0, "pending");
    seedOrder("o2", "5165550200", 10, 5000, "paid", "cus_already");

    const report = backfillCustomers({ commit: true });

    expect(report.ordersScanned).toBe(0);
    expect(getDb().prepare("SELECT COUNT(*) n FROM customers").get()).toEqual({ n: 0 });
  });

  it("is a no-op on a second run", () => {
    seedOrder("o1", "5165550100", 10, 5000);
    backfillCustomers({ commit: true });
    const second = backfillCustomers({ commit: true });
    expect(second.ordersScanned).toBe(0);
    expect(second.customersCreated).toBe(0);
  });

  it("writes nothing in dry-run mode but still reports what it would do", () => {
    seedOrder("o1", "5165550100", 10, 5000);

    const report = backfillCustomers({ commit: false });

    expect(report.ordersScanned).toBe(1);
    expect(report.customersCreated).toBe(1);
    expect(getDb().prepare("SELECT COUNT(*) n FROM customers").get()).toEqual({ n: 0 });
    const order = getDb().prepare("SELECT customer_id FROM orders WHERE id = 'o1'").get() as
      { customer_id: string | null };
    expect(order.customer_id).toBeNull();
  });

  it("never sends a message", async () => {
    seedOrder("o1", "5165550100", 10, 5000);
    const messaging = await import("@/lib/messaging");
    const spy = vi.spyOn(messaging, "sendMessage");

    backfillCustomers({ commit: true });

    expect(spy).not.toHaveBeenCalled();
    expect(getDb().prepare("SELECT COUNT(*) n FROM messages").get()).toEqual({ n: 0 });
    spy.mockRestore();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test -- tests/unit/backfill-customers.test.ts
```

Expected: FAIL — `Failed to resolve import "@/scripts/backfill-customers-from-orders"`.

- [ ] **Step 3: Give tsx a way to resolve `server-only`**

Create `scripts/tsconfig.json`. The `paths` values are relative to this file's own directory, which is why `@/*` becomes `../*`:

```json
{
  "extends": "../tsconfig.json",
  "compilerOptions": {
    "paths": {
      "@/*": ["../*"],
      "server-only": ["../tests/stubs/server-only.ts"]
    }
  }
}
```

This affects tsx only. The root `tsconfig.json` still typechecks `scripts/**/*.ts` — a nested config does not exclude files from the parent — so `npx tsc --noEmit` keeps covering the script exactly as it covers `lib/`.

- [ ] **Step 4: Write the script**

Create `scripts/backfill-customers-from-orders.ts`:

```ts
#!/usr/bin/env tsx
/**
 * Recovers CRM customers from historical paid orders — the ones lost while the
 * web checkout was never calling upsertOnOrder.
 *
 * Reuses upsertOnOrder so a backfilled customer is indistinguishable from an
 * organically created one, and matches on normalised phone so a web buyer who is
 * already a counter customer is merged rather than duplicated.
 *
 * This script SENDS NOTHING. It never touches lib/messaging or lib/order-dispatch.
 * Replaying confirmations for months-old orders would be an incident, not a
 * feature. Keep it that way.
 *
 *   npm run backfill:customers            # dry run, prints the report
 *   npm run backfill:customers -- --commit
 */
import { getDb } from "../lib/db";
import { runMigrations } from "../lib/db-migrate";
import { upsertOnOrder } from "../lib/customer-storage";

type PendingRow = {
  id: string;
  contact_name: string | null;
  recipient_name: string;
  contact_phone: string;
  contact_email: string | null;
  locale: string;
  paid_at: string | null;
  created_at: string;
};

export type BackfillReport = {
  ordersScanned: number;
  customersCreated: number;
  ordersMerged: number;
  failures: Array<{ orderId: string; error: string }>;
};

export function backfillCustomers(opts: { commit: boolean }): BackfillReport {
  runMigrations();
  const db = getDb();

  // Oldest first, so first_seen_at / last_seen_at land in the right order as
  // upsertOnOrder walks each customer's history forward.
  const rows = db
    .prepare(
      `SELECT id, contact_name, recipient_name, contact_phone, contact_email,
              locale, paid_at, created_at
         FROM orders
        WHERE payment_status = 'paid'
          AND customer_id IS NULL
          AND contact_phone <> ''
        ORDER BY created_at ASC`,
    )
    .all() as PendingRow[];

  const report: BackfillReport = {
    ordersScanned: rows.length,
    customersCreated: 0,
    ordersMerged: 0,
    failures: [],
  };

  const knownPhones = new Set(
    (db.prepare("SELECT phone FROM customers").all() as Array<{ phone: string }>).map((r) => r.phone),
  );
  const seenThisRun = new Set<string>();

  for (const row of rows) {
    const normalized = row.contact_phone.replace(/\D/g, "");
    const isNew = !knownPhones.has(normalized) && !seenThisRun.has(normalized);
    if (isNew) report.customersCreated += 1;
    else report.ordersMerged += 1;
    seenThisRun.add(normalized);

    if (!opts.commit) continue;

    try {
      const customer = upsertOnOrder({
        name: (row.contact_name?.trim() || row.recipient_name.trim()),
        phone: row.contact_phone,
        email: row.contact_email || undefined,
        orderAt: row.paid_at ?? row.created_at,
        locale: row.locale === "es" ? "es" : "en",
      });
      db.prepare("UPDATE orders SET customer_id = ? WHERE id = ?").run(customer.id, row.id);
    } catch (e) {
      // One malformed row must not strand the run halfway.
      report.failures.push({
        orderId: row.id,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return report;
}

// CLI wrapper. Guarded so importing this module in tests does not execute it.
if (process.argv[1] && process.argv[1].includes("backfill-customers-from-orders")) {
  const commit = process.argv.includes("--commit");
  const report = backfillCustomers({ commit });
  console.log(JSON.stringify({ mode: commit ? "COMMIT" : "DRY RUN", ...report }, null, 2));
  if (!commit) {
    console.log("\nDry run — nothing was written. Re-run with --commit to apply.");
  }
}
```

Note the address is deliberately not backfilled: `orders.address_json` holds the *recipient's* delivery address, and on a web order the buyer is often not the recipient. Guessing wrong would put a stranger's address on the customer record.

- [ ] **Step 5: Add the npm script**

In `package.json`, add to `scripts`. The `--tsconfig` flag is what makes Step 3 take effect:

```json
    "backfill:customers": "NODE_OPTIONS='--experimental-sqlite' tsx --tsconfig scripts/tsconfig.json scripts/backfill-customers-from-orders.ts",
```

- [ ] **Step 6: Run the test to verify it passes**

```bash
npm test -- tests/unit/backfill-customers.test.ts
```

Expected: PASS, 6 tests.

- [ ] **Step 7: Verify the CLI runs against the dev database**

```bash
npm run backfill:customers
```

Expected: migration log lines, then a JSON report, then "Dry run — nothing was written." Do **not** pass `--commit` here; the local `data/diva.sqlite` is dev data with only two distinct phone numbers.

If this step dies with `Cannot find module 'server-only'`, the `--tsconfig` flag is missing from the npm script or `scripts/tsconfig.json` was not created.

- [ ] **Step 8: Commit**

```bash
git add scripts/backfill-customers-from-orders.ts scripts/tsconfig.json package.json tests/unit/backfill-customers.test.ts
git commit -m "feat(crm): backfill customers from historical paid web orders"
```

---

## Task 9: Full verification

- [ ] **Step 1: Typecheck the whole project**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 2: Capture the baseline failures on the base commit**

```bash
git stash list && git log --oneline -1 && npm test 2>&1 | tail -40
```

Compare the failing specs against the ~7 known-broken ones recorded in the project notes (Chromium spawn ENOEXEC, checkout/preview). Anything else is yours.

- [ ] **Step 3: Build**

```bash
npm run build
```

Expected: build succeeds. `lib/on-web-order-paid.ts` imports `server-only`, so if it ever leaks into a client component the build fails here — that is the point.

- [ ] **Step 4: Manual smoke test of the SMS path**

Set `TWILIO_DRY_RUN=true` in `.env.local` first so nothing real is sent, then run the dev server and place a test order through the web checkout with a Stripe test card. Confirm in the server log:

- a `messaging_dry_run` line with the rendered `payment_confirmed` body including `Order #`
- a row in `customers` for the buyer's phone
- `customer_id` populated on the order row

**Restore `TWILIO_DRY_RUN=false` when done.** Leaving it `true` in production silently stops every confirmation.

- [ ] **Step 5: Commit anything outstanding**

```bash
git status
```

Expected: clean tree. All work was committed per task.

---

## Deployment notes (owner-run, not part of the code work)

1. **Confirm A2P 10DLC registration** in the Twilio console before judging deliverability. Unregistered long-code traffic gets filtered by US carriers.
2. **Back up the production database** before the backfill.
3. **Run the backfill dry first** on production, read the counts, and only then `-- --commit`.
4. **Purge the Hostinger CDN after deploying** — per the project's deploy notes, stale HTML lingers otherwise.

## Observation, out of scope

The gift-card full-coverage branch in `/api/checkout/intent` marks the order paid but never sets `amountPaidCents`, so those orders contribute `$0` to customer LTV and to the VIP threshold. Pre-existing, unrelated to this work, and worth a separate ticket — it compounds the `$0.00 total gastado` question already flagged in the spec.
