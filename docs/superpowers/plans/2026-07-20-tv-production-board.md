# TV Production Board — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a read-only, always-on Smart-TV "production queue" at `/[locale]/admin/tv` that shows today's paid orders to make, sorted by delivery-window start, with product photos, source channel, live countdown, page rotation, and a chime on each newly-paid order.

**Architecture:** A locale-aware admin sub-route (gated by the existing `intake_session` cookie) renders a client `TvBoard` component. All order logic lives in **pure functions** (`lib/tv-slots.ts`, `computeBoard` in `lib/tv-board.ts`) that are exhaustively unit-tested; a thin `buildTvBoard` composes them with storage + feed. A new `GET /api/admin/tv/board` endpoint (protected by `requireAdmin`) serves the shaped data, polled every 15s by a non-pausing client hook. No DB migration; reuses `firstThumb`, `getRecentFeed`, `deliveryZoneRank`.

**Tech Stack:** Next.js 16.2.4 (App Router), React 19, TypeScript, next-intl, Tailwind v4 (token utilities), `node:sqlite`, Vitest (jsdom), WebAudio (chime, no binary asset).

---

## Design references
- Spec: `docs/superpowers/specs/2026-07-20-tv-production-board-design.md`
- Approved mockup (Dirección A): `.superpowers/brainstorm/39225-1784564997/content/board-B-brand.html`

## Confirmed decisions
- **Slot starts (America/New_York):** morning 09:00, midday 12:00, afternoon 15:00, evening 18:00.
- **Urgency:** red ≤ 60 min or overdue; amber ≤ 180 min; green otherwise.
- **Todo queue:** paid + status `pending|preparing`, delivery/pickup, window = today. In-store fulfillment is **out of scope** for v1 (no window). Tomorrow shown as counts only.
- **Overflow:** paginate 6/page, rotate every 12s. **Poll:** 15s, never pauses. **New flash:** 30s.
- **Access:** reuse admin `intake_session` cookie; own full-screen layout (no admin nav).

## File structure
| File | Responsibility |
|---|---|
| `lib/tv-slots.ts` (new) | Pure slot/timezone/urgency helpers, shared by server + client. |
| `lib/tv-board.ts` (new, server-only) | `computeBoard` (pure) + `buildTvBoard` (composes storage/feed); board types. |
| `lib/order-storage.ts` (modify) | Add `listOrdersForWindowDates`. |
| `app/api/admin/tv/board/route.ts` (new) | `GET` board data, `requireAdmin` gated. |
| `app/[locale]/admin/tv/layout.tsx` (new) | Auth gate + full-screen wrapper. |
| `app/[locale]/admin/tv/page.tsx` (new) | Renders `<TvBoard/>`. |
| `components/admin/tv/tv-config.ts` (new) | UI constants. |
| `components/admin/tv/tv-detect.ts` (new) | Pure `newPaidIds` + `paginate`. |
| `components/admin/tv/useTvPolling.ts` (new) | Non-pausing poller. |
| `components/admin/tv/useTvSound.ts` (new) | WebAudio chime + unlock. |
| `components/admin/tv/TvBoard.tsx` (+ subcomponents) (new) | Presentation. |
| `tests/factories/order.ts` (new) | `makeOrder` test fixture. |

---

## Task 1: Pure slot/timezone/urgency helpers

**Files:**
- Create: `lib/tv-slots.ts`
- Test: `tests/unit/tv-slots.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/tv-slots.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  shopDateStr, shopMinutesOfDay, addDaysStr, dayDiff,
  minutesUntilSlotStart, urgencyLevel, formatCountdown,
} from "@/lib/tv-slots";

const TZ = "America/New_York";

describe("tv-slots", () => {
  it("shopDateStr uses shop timezone (UTC-4 in July)", () => {
    // 2026-07-20T02:00Z = 2026-07-19 22:00 ET
    expect(shopDateStr(new Date("2026-07-20T02:00:00Z"), TZ)).toBe("2026-07-19");
    // 2026-07-20T14:15Z = 2026-07-20 10:15 ET
    expect(shopDateStr(new Date("2026-07-20T14:15:00Z"), TZ)).toBe("2026-07-20");
  });

  it("shopMinutesOfDay returns minutes since local midnight", () => {
    // 10:15 ET
    expect(shopMinutesOfDay(new Date("2026-07-20T14:15:00Z"), TZ)).toBe(10 * 60 + 15);
  });

  it("addDaysStr / dayDiff do calendar math", () => {
    expect(addDaysStr("2026-07-20", 1)).toBe("2026-07-21");
    expect(addDaysStr("2026-07-31", 1)).toBe("2026-08-01");
    expect(dayDiff("2026-07-20", "2026-07-21")).toBe(1);
    expect(dayDiff("2026-07-20", "2026-07-20")).toBe(0);
  });

  it("minutesUntilSlotStart handles today, tomorrow, and overdue", () => {
    const now = new Date("2026-07-20T14:15:00Z"); // 10:15 ET
    expect(minutesUntilSlotStart(now, "2026-07-20", "midday", TZ)).toBe(105);   // 12:00 - 10:15
    expect(minutesUntilSlotStart(now, "2026-07-20", "morning", TZ)).toBe(-75);  // 09:00 - 10:15
    expect(minutesUntilSlotStart(now, "2026-07-21", "morning", TZ)).toBe(1365); // +1 day
  });

  it("urgencyLevel buckets on 60 / 180 boundaries", () => {
    expect(urgencyLevel(45)).toBe("red");
    expect(urgencyLevel(60)).toBe("red");
    expect(urgencyLevel(61)).toBe("amber");
    expect(urgencyLevel(180)).toBe("amber");
    expect(urgencyLevel(181)).toBe("green");
    expect(urgencyLevel(-10)).toBe("red");
  });

  it("formatCountdown prints h:mm with overdue sign", () => {
    expect(formatCountdown(105)).toBe("1:45");
    expect(formatCountdown(5)).toBe("0:05");
    expect(formatCountdown(-75)).toBe("-1:15");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/tv-slots.test.ts`
Expected: FAIL — cannot resolve `@/lib/tv-slots`.

- [ ] **Step 3: Write the implementation**

Create `lib/tv-slots.ts`:

```ts
import type { DeliverySlot } from "@/types/order";

export const SHOP_TZ = "America/New_York";

/** Confirmed slot START times, minutes since shop-local midnight. */
export const SLOT_START_MIN: Record<DeliverySlot, number> = {
  morning: 9 * 60,    // 09:00
  midday: 12 * 60,    // 12:00
  afternoon: 15 * 60, // 15:00
  evening: 18 * 60,   // 18:00
};

export const SLOT_ORDER: DeliverySlot[] = ["morning", "midday", "afternoon", "evening"];

export const SLOT_LABEL_ES: Record<DeliverySlot, string> = {
  morning: "Mañana", midday: "Mediodía", afternoon: "Tarde", evening: "Noche",
};

export const SLOT_ICON: Record<DeliverySlot, string> = {
  morning: "🌅", midday: "☀️", afternoon: "🌇", evening: "🌙",
};

export const URGENCY_RED_MIN = 60;
export const URGENCY_AMBER_MIN = 180;
export type Urgency = "red" | "amber" | "green";

export function urgencyLevel(minutesRemaining: number): Urgency {
  if (minutesRemaining <= URGENCY_RED_MIN) return "red";
  if (minutesRemaining <= URGENCY_AMBER_MIN) return "amber";
  return "green";
}

/** Shop-local calendar date (YYYY-MM-DD) for an instant. en-CA => ISO order. */
export function shopDateStr(now: Date, tz: string = SHOP_TZ): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
}

/** Shop-local minutes since midnight. hourCycle h23 avoids the "24:00" quirk. */
export function shopMinutesOfDay(now: Date, tz: string = SHOP_TZ): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(now);
  const hh = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const mm = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return hh * 60 + mm;
}

/** Add N days to a YYYY-MM-DD string (noon-anchored UTC to dodge DST edges). */
export function addDaysStr(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Whole-day difference toDate - fromDate. */
export function dayDiff(fromDateStr: string, toDateStr: string): number {
  const a = Date.parse(fromDateStr + "T00:00:00Z");
  const b = Date.parse(toDateStr + "T00:00:00Z");
  return Math.round((b - a) / 86_400_000);
}

/** Minutes until a window's slot start, in shop time. Negative => overdue.
 *  Note: a countdown spanning a DST switch (twice/year) may be off by 60 min. */
export function minutesUntilSlotStart(
  now: Date, windowDate: string, slot: DeliverySlot, tz: string = SHOP_TZ,
): number {
  const today = shopDateStr(now, tz);
  const nowMin = shopMinutesOfDay(now, tz);
  return dayDiff(today, windowDate) * 24 * 60 + SLOT_START_MIN[slot] - nowMin;
}

/** "1:45", "0:05", "-1:15". */
export function formatCountdown(minutesRemaining: number): string {
  const sign = minutesRemaining < 0 ? "-" : "";
  const abs = Math.abs(minutesRemaining);
  return `${sign}${Math.floor(abs / 60)}:${String(abs % 60).padStart(2, "0")}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/tv-slots.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/tv-slots.ts tests/unit/tv-slots.test.ts
git commit -m "feat(tv-board): pure slot/timezone/urgency helpers"
```

---

## Task 2: Storage query for board window dates

**Files:**
- Create: `tests/factories/order.ts` (shared fixture)
- Modify: `lib/order-storage.ts` (append new function)
- Test: `tests/unit/order-storage-board.test.ts`

- [ ] **Step 1: Create the shared test fixture**

Create `tests/factories/order.ts`:

```ts
import type {
  Order, DeliverySlot, OrderSource, FulfillmentStatus, PaymentStatus,
} from "@/types/order";

export type MakeOrderOpts = {
  id?: string;
  orderNumber?: number;
  source?: OrderSource;
  method?: "delivery" | "pickup" | "in-store";
  windowDate?: string;
  slot?: DeliverySlot;
  zip?: string;
  status?: FulfillmentStatus;
  paymentStatus?: PaymentStatus;
  createdAt?: string;
  updatedAt?: string;
  cardMessage?: string;
  designerNotes?: string;
  recipientName?: string;
};

let seq = 0;

export function makeOrder(o: MakeOrderOpts = {}): Order {
  const method = o.method ?? "delivery";
  const recipient = { name: o.recipientName ?? "Test Recipient", phone: "5165551212" };
  const window = { date: o.windowDate ?? "2026-07-20", slot: (o.slot ?? "midday") as DeliverySlot };
  const fulfillment =
    method === "delivery"
      ? { method, recipient,
          address: { street1: "1 Main St", city: "Roslyn", state: "NY", zip: o.zip ?? "11576", country: "US" as const },
          window, cardMessage: o.cardMessage }
      : method === "pickup"
      ? { method, recipient, window, cardMessage: o.cardMessage }
      : { method: "in-store" as const, recipient, cardMessage: o.cardMessage };
  const lines = o.designerNotes
    ? [{ kind: "custom" as const, title: "Designer's Choice", priceCents: 8000, designerNotes: o.designerNotes, qty: 1 }]
    : [{ kind: "catalog" as const, productId: "dozen-roses", variantId: "std", addOnIds: [], qty: 1 }];
  const created = o.createdAt ?? "2026-07-20T09:00:00.000Z";
  return {
    id: o.id ?? `do_test_${seq++}`,
    orderNumber: o.orderNumber ?? 1000,
    source: o.source ?? "web",
    locale: "es",
    lines,
    fulfillment: fulfillment as Order["fulfillment"],
    contact: { phone: "5165551212" },
    totals: { subtotalCents: 8000, deliveryCents: 1500, taxCents: 0, totalCents: 9500 },
    status: o.status ?? "pending",
    paymentStatus: o.paymentStatus ?? "paid",
    amountPaidCents: 9500,
    createdAt: created,
    updatedAt: o.updatedAt ?? created,
  };
}
```

- [ ] **Step 2: Write the failing test**

Create `tests/unit/order-storage-board.test.ts`:

```ts
process.env.SQLITE_FILE = ":memory:";
process.env.ORDER_STORAGE_FILE = "/tmp/diva-board-test.json";

import { describe, it, expect, beforeEach } from "vitest";
import { runMigrations } from "@/lib/db-migrate";
import { getDb } from "@/lib/db";
import { saveOrder, listOrdersForWindowDates } from "@/lib/order-storage";
import { makeOrder } from "../factories/order";

beforeEach(() => {
  runMigrations();
  getDb().prepare("DELETE FROM orders").run();
});

describe("listOrdersForWindowDates", () => {
  it("returns delivery/pickup orders for the given window dates, excluding canceled and in-store", async () => {
    await saveOrder(makeOrder({ id: "a", windowDate: "2026-07-20", method: "delivery" }));
    await saveOrder(makeOrder({ id: "b", windowDate: "2026-07-20", method: "pickup" }));
    await saveOrder(makeOrder({ id: "c", windowDate: "2026-07-21", method: "delivery" }));
    await saveOrder(makeOrder({ id: "d", windowDate: "2026-07-19", method: "delivery" })); // other day
    await saveOrder(makeOrder({ id: "e", windowDate: "2026-07-20", method: "delivery", status: "canceled" }));
    await saveOrder(makeOrder({ id: "f", method: "in-store" })); // no window

    const rows = await listOrdersForWindowDates(["2026-07-20", "2026-07-21"]);
    const ids = rows.map((o) => o.id).sort();
    expect(ids).toEqual(["a", "b", "c"]);
  });

  it("returns [] for empty date list", async () => {
    expect(await listOrdersForWindowDates([])).toEqual([]);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- tests/unit/order-storage-board.test.ts`
Expected: FAIL — `listOrdersForWindowDates` is not exported.

- [ ] **Step 4: Implement — append to `lib/order-storage.ts`**

Add at the end of `lib/order-storage.ts` (after `listOrdersByCustomer`):

```ts
// Delivery/pickup orders whose scheduled window falls on one of the given dates
// (in-store has no window and is excluded). Excludes canceled. For the TV board.
export async function listOrdersForWindowDates(dates: string[]): Promise<Order[]> {
  ensureSchema();
  if (dates.length === 0) return [];
  const placeholders = dates.map(() => "?").join(",");
  const rows = getDb().prepare(
    `SELECT * FROM orders
     WHERE window_date IN (${placeholders})
       AND fulfillment_method IN ('delivery','pickup')
       AND fulfillment_status != 'canceled'
     ORDER BY window_date ASC, created_at ASC`,
  ).all(...dates) as OrderRow[];
  return rows.map(rowToOrder);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- tests/unit/order-storage-board.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add tests/factories/order.ts tests/unit/order-storage-board.test.ts lib/order-storage.ts
git commit -m "feat(tv-board): listOrdersForWindowDates storage query"
```

---

## Task 3: `computeBoard` (pure board logic)

**Files:**
- Create: `lib/tv-board.ts` (types + `computeBoard`; `buildTvBoard` added in Task 4)
- Test: `tests/unit/tv-board-compute.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/tv-board-compute.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { computeBoard } from "@/lib/tv-board";
import { makeOrder } from "../factories/order";

const NOW = new Date("2026-07-20T14:15:00Z"); // 10:15 ET
const deps = { now: NOW, resolveThumb: () => "/x.jpg", resolveLabel: () => "Ramo" };

describe("computeBoard", () => {
  it("includes only paid pending/preparing orders scheduled today in `todo`", () => {
    const orders = [
      makeOrder({ id: "paidPending", windowDate: "2026-07-20", paymentStatus: "paid", status: "pending" }),
      makeOrder({ id: "unpaid", windowDate: "2026-07-20", paymentStatus: "pending", status: "pending" }),
      makeOrder({ id: "delivered", windowDate: "2026-07-20", paymentStatus: "paid", status: "delivered" }),
      makeOrder({ id: "otherDay", windowDate: "2026-07-21", paymentStatus: "paid", status: "pending" }),
    ];
    const board = computeBoard(orders, deps);
    expect(board.todo.map((c) => c.orderId)).toEqual(["paidPending"]);
  });

  it("sorts todo by slot start then delivery zone rank", () => {
    const orders = [
      makeOrder({ id: "evening", windowDate: "2026-07-20", slot: "evening", zip: "11576" }),
      makeOrder({ id: "morningFar", windowDate: "2026-07-20", slot: "morning", zip: "11030" }),
      makeOrder({ id: "morningNear", windowDate: "2026-07-20", slot: "morning", zip: "11507" }),
    ];
    const ids = computeBoard(orders, deps).todo.map((c) => c.orderId);
    // both morning first; within morning, nearer zone (lower rank) first
    expect(ids[0]).toBe(ids.includes("morningNear") ? "morningNear" : ids[0]);
    expect(ids[2]).toBe("evening");
    expect(ids.slice(0, 2).sort()).toEqual(["morningFar", "morningNear"]);
  });

  it("computes countdown + urgency per card", () => {
    const orders = [makeOrder({ id: "m", windowDate: "2026-07-20", slot: "midday" })];
    const card = computeBoard(orders, deps).todo[0];
    expect(card.minutesUntil).toBe(105);
    expect(card.urgency).toBe("amber");
  });

  it("surfaces card message, designer notes, source, thumb and label", () => {
    const orders = [
      makeOrder({ id: "n", windowDate: "2026-07-20", source: "whatsapp", cardMessage: "Feliz día", designerNotes: "pasteles" , method: "delivery"}),
    ];
    const card = computeBoard(orders, { now: NOW, resolveThumb: () => null, resolveLabel: () => "Designer's Choice" }).todo[0];
    expect(card.source).toBe("whatsapp");
    expect(card.hasCardMessage).toBe(true);
    expect(card.hasDesignerNotes).toBe(true);
    expect(card.thumb).toBeNull();
    expect(card.productLabel).toBe("Designer's Choice");
  });

  it("builds enRuta, deliveredToday and tomorrow counts", () => {
    const orders = [
      makeOrder({ id: "r1", windowDate: "2026-07-20", status: "out-for-delivery", updatedAt: "2026-07-20T13:00:00Z" }),
      makeOrder({ id: "d1", windowDate: "2026-07-20", status: "delivered" }),
      makeOrder({ id: "d2", windowDate: "2026-07-20", status: "delivered" }),
      makeOrder({ id: "t1", windowDate: "2026-07-21", slot: "morning" }),
      makeOrder({ id: "t2", windowDate: "2026-07-21", slot: "morning" }),
      makeOrder({ id: "t3", windowDate: "2026-07-21", slot: "evening" }),
    ];
    const board = computeBoard(orders, deps);
    expect(board.enRuta.map((r) => r.orderId)).toEqual(["r1"]);
    expect(board.deliveredToday).toBe(2);
    expect(board.tomorrow.total).toBe(3);
    expect(board.tomorrow.bySlot.morning).toBe(2);
    expect(board.tomorrow.bySlot.evening).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/tv-board-compute.test.ts`
Expected: FAIL — cannot resolve `@/lib/tv-board`.

- [ ] **Step 3: Implement `lib/tv-board.ts` (types + computeBoard)**

Create `lib/tv-board.ts`:

```ts
import "server-only";
import type { DeliverySlot, Order, OrderSource } from "@/types/order";
import {
  SHOP_TZ, SLOT_ORDER, addDaysStr, minutesUntilSlotStart, shopDateStr, urgencyLevel, type Urgency,
} from "@/lib/tv-slots";
import { firstThumb, lineSummaryName } from "@/components/admin/dashboard/product-lookup";
import { deliveryZoneRank, findDeliveryZoneByZip } from "@/lib/delivery-zones";

export type TvCard = {
  orderId: string;
  orderNumber: number | null;
  recipientName: string;
  productLabel: string;
  thumb: string | null;
  source: OrderSource;
  fulfillmentStatus: "pending" | "preparing";
  method: "delivery" | "pickup";
  zoneLabel: string | null;
  slot: DeliverySlot;
  windowDate: string;
  hasCardMessage: boolean;
  hasDesignerNotes: boolean;
  minutesUntil: number;
  urgency: Urgency;
};

export type TvEnRuta = {
  orderId: string; orderNumber: number | null; zoneLabel: string | null; since: string;
};

export type TvBoardData = {
  todo: TvCard[];
  enRuta: TvEnRuta[];
  deliveredToday: number;
  tomorrow: { bySlot: Record<DeliverySlot, number>; total: number };
};

export type ComputeDeps = {
  now: Date;
  tz?: string;
  resolveThumb?: (o: Order) => string | null;
  resolveLabel?: (o: Order) => string;
};

type WindowOrder = Order & {
  fulfillment: { method: "delivery" | "pickup"; window: { date: string; slot: DeliverySlot } };
};

function isWindowOrder(o: Order): o is WindowOrder {
  return o.fulfillment.method === "delivery" || o.fulfillment.method === "pickup";
}
function zipOf(o: Order): string | null {
  return o.fulfillment.method === "delivery" ? o.fulfillment.address.zip : null;
}
function rankOf(o: Order): number {
  const zip = zipOf(o);
  return zip == null ? Number.MAX_SAFE_INTEGER : deliveryZoneRank(zip);
}
function zoneLabelOf(o: Order): string | null {
  const zip = zipOf(o);
  return zip ? (findDeliveryZoneByZip(zip)?.label.es ?? null) : null;
}
function hasDesignerNotes(o: Order): boolean {
  return o.lines.some((l) => l.kind === "custom" && !!l.designerNotes);
}

export function computeBoard(orders: Order[], deps: ComputeDeps): TvBoardData {
  const tz = deps.tz ?? SHOP_TZ;
  const now = deps.now;
  const today = shopDateStr(now, tz);
  const tomorrow = addDaysStr(today, 1);
  const resolveThumb = deps.resolveThumb ?? firstThumb;
  const resolveLabel = deps.resolveLabel ?? lineSummaryName;

  const windowOrders = orders.filter(isWindowOrder);
  const todayOrders = windowOrders.filter((o) => o.fulfillment.window.date === today);

  const todoOrders = todayOrders
    .filter((o) => o.paymentStatus === "paid" && (o.status === "pending" || o.status === "preparing"))
    .sort((a, b) => {
      const sa = SLOT_ORDER.indexOf(a.fulfillment.window.slot);
      const sb = SLOT_ORDER.indexOf(b.fulfillment.window.slot);
      if (sa !== sb) return sa - sb;
      const ra = rankOf(a), rb = rankOf(b);
      if (ra !== rb) return ra - rb;
      return a.createdAt.localeCompare(b.createdAt);
    });

  const todo: TvCard[] = todoOrders.map((o) => {
    const slot = o.fulfillment.window.slot;
    const minutesUntil = minutesUntilSlotStart(now, o.fulfillment.window.date, slot, tz);
    return {
      orderId: o.id,
      orderNumber: o.orderNumber ?? null,
      recipientName: o.fulfillment.recipient.name,
      productLabel: resolveLabel(o),
      thumb: resolveThumb(o),
      source: o.source,
      fulfillmentStatus: o.status as "pending" | "preparing",
      method: o.fulfillment.method,
      zoneLabel: zoneLabelOf(o),
      slot,
      windowDate: o.fulfillment.window.date,
      hasCardMessage: !!o.fulfillment.cardMessage,
      hasDesignerNotes: hasDesignerNotes(o),
      minutesUntil,
      urgency: urgencyLevel(minutesUntil),
    };
  });

  const enRuta: TvEnRuta[] = todayOrders
    .filter((o) => o.status === "out-for-delivery")
    .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
    .map((o) => ({
      orderId: o.id, orderNumber: o.orderNumber ?? null, zoneLabel: zoneLabelOf(o), since: o.updatedAt,
    }));

  const deliveredToday = todayOrders.filter((o) => o.status === "delivered").length;

  const bySlot: Record<DeliverySlot, number> = { morning: 0, midday: 0, afternoon: 0, evening: 0 };
  const tomorrowOrders = windowOrders.filter((o) => o.fulfillment.window.date === tomorrow);
  for (const o of tomorrowOrders) bySlot[o.fulfillment.window.slot] += 1;

  return { todo, enRuta, deliveredToday, tomorrow: { bySlot, total: tomorrowOrders.length } };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/tv-board-compute.test.ts`
Expected: PASS (5 tests). If the zone-rank assertion is ambiguous, confirm `11507` (Albertson) ranks before `11030` in `data/delivery-zones.ts`; adjust the test zips to two zones with a known order if needed.

- [ ] **Step 5: Commit**

```bash
git add lib/tv-board.ts tests/unit/tv-board-compute.test.ts
git commit -m "feat(tv-board): computeBoard pure board logic"
```

---

## Task 4: `buildTvBoard` (compose storage + feed)

**Files:**
- Modify: `lib/tv-board.ts` (add `buildTvBoard` + response type)
- Test: `tests/unit/tv-board-build.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/tv-board-build.test.ts`:

```ts
process.env.SQLITE_FILE = ":memory:";
process.env.ORDER_STORAGE_FILE = "/tmp/diva-board-build-test.json";

import { describe, it, expect, beforeEach } from "vitest";
import { runMigrations } from "@/lib/db-migrate";
import { getDb } from "@/lib/db";
import { saveOrder } from "@/lib/order-storage";
import { buildTvBoard } from "@/lib/tv-board";
import { makeOrder } from "../factories/order";

beforeEach(() => {
  runMigrations();
  getDb().prepare("DELETE FROM orders").run();
});

describe("buildTvBoard", () => {
  it("returns a fully shaped response on an empty DB", async () => {
    const now = new Date("2026-07-20T14:15:00Z");
    const board = await buildTvBoard(now);
    expect(board.shopDate).toBe("2026-07-20");
    expect(board.todo).toEqual([]);
    expect(board.enRuta).toEqual([]);
    expect(board.deliveredToday).toBe(0);
    expect(board.tomorrow.total).toBe(0);
    expect(Array.isArray(board.paidEvents)).toBe(true);
    expect(typeof board.generatedAt).toBe("string");
  });

  it("includes a seeded paid order in todo", async () => {
    await saveOrder(makeOrder({ id: "seed", windowDate: "2026-07-20", slot: "midday", paymentStatus: "paid", status: "pending" }));
    const board = await buildTvBoard(new Date("2026-07-20T14:15:00Z"));
    expect(board.todo.map((c) => c.orderId)).toContain("seed");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/tv-board-build.test.ts`
Expected: FAIL — `buildTvBoard` is not exported.

- [ ] **Step 3: Implement — add to `lib/tv-board.ts`**

Add imports at the top of `lib/tv-board.ts` (next to existing imports):

```ts
import { listOrdersForWindowDates } from "@/lib/order-storage";
import { getRecentFeed } from "@/lib/order-feed";
```

Append to `lib/tv-board.ts`:

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

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/tv-board-build.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/tv-board.ts tests/unit/tv-board-build.test.ts
git commit -m "feat(tv-board): buildTvBoard composes storage + feed"
```

---

## Task 5: Board API endpoint (auth-gated)

**Files:**
- Create: `app/api/admin/tv/board/route.ts`
- Test: `tests/unit/tv-board-route.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/tv-board-route.test.ts`:

```ts
process.env.SQLITE_FILE = ":memory:";
process.env.ORDER_STORAGE_FILE = "/tmp/diva-board-route-test.json";
process.env.INTAKE_SESSION_SECRET = "test-secret-test-secret-test-secret";

import { describe, it, expect, beforeEach } from "vitest";
import { runMigrations } from "@/lib/db-migrate";
import { getDb } from "@/lib/db";
import { signSession } from "@/lib/admin-auth";
import { GET } from "@/app/api/admin/tv/board/route";

beforeEach(() => {
  runMigrations();
  getDb().prepare("DELETE FROM orders").run();
});

describe("GET /api/admin/tv/board", () => {
  it("401s without a valid session cookie", async () => {
    const res = await GET(new Request("http://x/api/admin/tv/board"));
    expect(res.status).toBe(401);
  });

  it("200s with a valid session cookie and returns board shape", async () => {
    const token = signSession();
    const res = await GET(new Request("http://x/api/admin/tv/board", {
      headers: { cookie: `intake_session=${token}` },
    }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("todo");
    expect(body).toHaveProperty("enRuta");
    expect(body).toHaveProperty("tomorrow");
    expect(body).toHaveProperty("paidEvents");
    expect(body).toHaveProperty("shopDate");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/tv-board-route.test.ts`
Expected: FAIL — cannot resolve the route module.

- [ ] **Step 3: Implement the route**

Create `app/api/admin/tv/board/route.ts`:

```ts
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { buildTvBoard } from "@/lib/tv-board";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request): Promise<Response> {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const board = await buildTvBoard();
  return NextResponse.json(board, { headers: { "Cache-Control": "no-store" } });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/tv-board-route.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/tv/board/route.ts tests/unit/tv-board-route.test.ts
git commit -m "feat(tv-board): GET /api/admin/tv/board (auth-gated)"
```

---

## Task 6: Client pure helpers + UI constants

**Files:**
- Create: `components/admin/tv/tv-config.ts`
- Create: `components/admin/tv/tv-detect.ts`
- Test: `tests/unit/tv-detect.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/tv-detect.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { newPaidIds, paginate } from "@/components/admin/tv/tv-detect";

describe("tv-detect", () => {
  it("newPaidIds returns ids not already seen", () => {
    const events = [
      { orderId: "a", at: "t", recipientName: "A" },
      { orderId: "b", at: "t", recipientName: "B" },
    ];
    expect(newPaidIds(events, new Set(["a"]))).toEqual(["b"]);
    expect(newPaidIds(events, new Set(["a", "b"]))).toEqual([]);
  });

  it("paginate splits into fixed-size pages", () => {
    expect(paginate([1, 2, 3, 4, 5, 6, 7], 6)).toEqual([[1, 2, 3, 4, 5, 6], [7]]);
    expect(paginate([], 6)).toEqual([[]]);
    expect(paginate([1, 2], 6)).toEqual([[1, 2]]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/tv-detect.test.ts`
Expected: FAIL — cannot resolve `tv-detect`.

- [ ] **Step 3: Implement helpers + config**

Create `components/admin/tv/tv-config.ts`:

```ts
export const POLL_INTERVAL_MS = 15_000;
export const PAGE_SIZE = 6;
export const PAGE_ROTATE_MS = 12_000;
export const NEW_FLASH_MS = 30_000;
export const CLOCK_TICK_MS = 30_000; // countdown refresh cadence
```

Create `components/admin/tv/tv-detect.ts`:

```ts
export type PaidEvent = { orderId: string; at: string; recipientName: string };

/** Paid orderIds not present in `seen`. Pure. */
export function newPaidIds(events: PaidEvent[], seen: Set<string>): string[] {
  const out: string[] = [];
  for (const e of events) if (!seen.has(e.orderId)) out.push(e.orderId);
  return out;
}

/** Split items into fixed-size pages; always returns at least one (possibly empty) page. */
export function paginate<T>(items: T[], pageSize: number): T[][] {
  if (pageSize <= 0) return [items];
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += pageSize) pages.push(items.slice(i, i + pageSize));
  return pages.length ? pages : [[]];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/tv-detect.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add components/admin/tv/tv-config.ts components/admin/tv/tv-detect.ts tests/unit/tv-detect.test.ts
git commit -m "feat(tv-board): client pure helpers + config"
```

---

## Task 7: Polling + sound hooks

**Files:**
- Create: `components/admin/tv/useTvPolling.ts`
- Create: `components/admin/tv/useTvSound.ts`

> No unit tests: `useTvPolling` needs network + timers and `useTvSound` needs WebAudio; both are verified in Task 10 via the live preview. Keep logic thin (the testable parts live in `tv-detect.ts`).

- [ ] **Step 1: Implement `useTvPolling.ts`**

Create `components/admin/tv/useTvPolling.ts`:

```ts
"use client";
import { useEffect, useRef, useState } from "react";
import type { TvBoardResponse } from "@/lib/tv-board";
import { newPaidIds } from "./tv-detect";

export function useTvPolling(intervalMs: number, onNewPaid?: (ids: string[]) => void) {
  const [data, setData] = useState<TvBoardResponse | null>(null);
  const [error, setError] = useState(false);
  const seenRef = useRef<Set<string>>(new Set());
  const primedRef = useRef(false);
  const onNewPaidRef = useRef(onNewPaid);
  onNewPaidRef.current = onNewPaid;

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
        setData(board);
        setError(false);
        if (fresh.length && onNewPaidRef.current) onNewPaidRef.current(fresh);
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

- [ ] **Step 2: Implement `useTvSound.ts`**

Create `components/admin/tv/useTvSound.ts`:

```ts
"use client";
import { useCallback, useRef, useState } from "react";

type WindowWithWebkit = Window & { webkitAudioContext?: typeof AudioContext };

export function useTvSound() {
  const ctxRef = useRef<AudioContext | null>(null);
  const [enabled, setEnabled] = useState(false);

  const enable = useCallback(() => {
    try {
      const w = window as WindowWithWebkit;
      const Ctx = w.AudioContext ?? w.webkitAudioContext;
      if (!Ctx) return;
      if (!ctxRef.current) ctxRef.current = new Ctx();
      void ctxRef.current.resume();
      setEnabled(true);
    } catch {
      /* audio unavailable — board still works silently */
    }
  }, []);

  const chime = useCallback(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [880, 1108.73]; // A5, C#6 — gentle two-tone bell
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const t = now + i * 0.18;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.55);
    });
  }, []);

  return { enabled, enable, chime };
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors from these files.

- [ ] **Step 4: Commit**

```bash
git add components/admin/tv/useTvPolling.ts components/admin/tv/useTvSound.ts
git commit -m "feat(tv-board): polling + WebAudio chime hooks"
```

---

## Task 8: Presentation — `TvBoard` and subcomponents

**Files:**
- Create: `components/admin/tv/TvBoard.tsx`

> Presentational; verified in Task 10 via the live preview (screenshot + console). Colors use Tailwind token utilities (`bg-bone`, `text-ink`, `text-rouge`, `text-petal`, `text-lilac`, `text-mute-*`) and CSS-var arbitrary values for semantic urgency (`text-[var(--color-error)]`, etc.). Structure mirrors the approved mockup `board-B-brand.html` (Dirección A).

- [ ] **Step 1: Implement `TvBoard.tsx`**

Create `components/admin/tv/TvBoard.tsx`:

```tsx
"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { TvCard } from "@/lib/tv-board";
import {
  SLOT_LABEL_ES, SLOT_ICON, minutesUntilSlotStart, urgencyLevel, formatCountdown,
} from "@/lib/tv-slots";
import { useTvPolling } from "./useTvPolling";
import { useTvSound } from "./useTvSound";
import { paginate } from "./tv-detect";
import {
  POLL_INTERVAL_MS, PAGE_SIZE, PAGE_ROTATE_MS, NEW_FLASH_MS, CLOCK_TICK_MS,
} from "./tv-config";

const SOURCE: Record<string, { icon: string; label: string; color: string }> = {
  web: { icon: "🌐", label: "Web", color: "#C33E67" },
  phone: { icon: "📞", label: "Teléfono", color: "#3E77B0" },
  whatsapp: { icon: "💬", label: "WhatsApp", color: "#1FA855" },
  "walk-in": { icon: "🏬", label: "En tienda", color: "#9A7638" },
  event: { icon: "🎀", label: "Evento", color: "#9A63B8" },
};
const URGENCY_VAR: Record<string, string> = {
  red: "var(--color-error)", amber: "var(--color-warn)", green: "var(--color-success)",
};

function useNow(tickMs: number): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), tickMs);
    return () => clearInterval(t);
  }, [tickMs]);
  return now;
}

export default function TvBoard() {
  const now = useNow(CLOCK_TICK_MS);
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

  const todo = data?.todo ?? [];
  const pages = useMemo(() => paginate(todo, PAGE_SIZE), [todo]);

  // Jump to the page holding a newly-paid order.
  useEffect(() => {
    const id = pageJumpRef.current;
    if (!id) return;
    const idx = todo.findIndex((c) => c.orderId === id);
    if (idx >= 0) setPage(Math.floor(idx / PAGE_SIZE));
    pageJumpRef.current = null;
  }, [todo]);

  // Auto-rotate pages.
  useEffect(() => {
    if (pages.length <= 1) return;
    const t = setInterval(() => setPage((p) => (p + 1) % pages.length), PAGE_ROTATE_MS);
    return () => clearInterval(t);
  }, [pages.length]);

  const current = pages[Math.min(page, pages.length - 1)] ?? [];
  const clock = new Intl.DateTimeFormat("es-US", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/New_York" }).format(now);
  const dateStr = new Intl.DateTimeFormat("es-US", { weekday: "short", day: "numeric", month: "short", timeZone: "America/New_York" }).format(now);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-bone text-ink flex flex-col font-sans">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-4 border-b border-ink/10">
        <div>
          <h1 className="font-display text-4xl leading-none">
            Diva <span className="text-rouge">the Flowers</span>
          </h1>
          <p className="text-xs tracking-[0.25em] uppercase text-mute-400 mt-1">Producción de hoy</p>
        </div>
        <div className="flex items-center gap-8">
          <Counter n={todo.length} label="Por hacer" color="var(--color-rouge)" />
          <Counter n={data?.enRuta.length ?? 0} label="En ruta" color="var(--color-rouge-glow)" />
          <Counter n={data?.deliveredToday ?? 0} label="Entregadas" color="var(--color-success)" />
          <div className="text-right">
            <div className="text-3xl font-bold tabular-nums">{clock}</div>
            <div className="text-xs text-mute-400 capitalize">{dateStr}</div>
          </div>
          {error && <span className="text-xs text-mute-400">reconectando…</span>}
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 grid grid-cols-[1fr_320px] min-h-0">
        {/* Queue */}
        <section className="p-6 flex flex-col gap-3 min-h-0 overflow-hidden">
          <div className="flex items-center justify-between">
            <h2 className="text-sm tracking-widest uppercase text-mute-500">Por hacer · ordenadas por entrega</h2>
            <span className="text-sm text-mute-400">
              {todo.length} órdenes{pages.length > 1 ? ` · pág. ${(page % pages.length) + 1}/${pages.length}` : ""}
            </span>
          </div>
          {current.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-mute-400 text-2xl font-display">
              Sin órdenes por producir 🌿
            </div>
          ) : (
            current.map((c) => (
              <CardRow key={c.orderId} card={c} now={now} isNew={flash.has(c.orderId)} />
            ))
          )}
        </section>

        {/* Rail */}
        <aside className="border-l border-ink/10 bg-ink/[0.02] p-5 flex flex-col gap-5 min-h-0">
          <div>
            <h3 className="text-xs uppercase tracking-widest text-mute-400 mb-2 flex justify-between">
              En ruta <span className="text-rouge font-bold">{data?.enRuta.length ?? 0}</span>
            </h3>
            {(data?.enRuta ?? []).map((r) => (
              <div key={r.orderId} className="flex items-center gap-2 text-sm text-mute-600 py-1 border-b border-ink/5">
                <span className="h-2 w-2 rounded-full bg-rouge" />
                <span className="font-mono text-mute-400">#{r.orderNumber ?? "—"}</span>
                {r.zoneLabel ?? "Entrega"}
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-[color:var(--color-success)]/25 bg-[color:var(--color-success)]/[0.06] p-5 text-center">
            <div className="text-5xl font-extrabold text-[color:var(--color-success)] leading-none">{data?.deliveredToday ?? 0}</div>
            <div className="text-xs uppercase tracking-widest text-mute-400 mt-1">Entregadas hoy ✓</div>
          </div>
        </aside>
      </div>

      {/* Tomorrow strip */}
      <footer className="border-t border-ink/10 bg-ink/[0.02] px-8 py-2 flex items-center gap-4">
        <span className="text-xs uppercase tracking-widest text-mute-400">
          <b className="text-lilac">Mañana</b> · {data?.tomorrow.total ?? 0} órdenes
        </span>
        {(["morning", "midday", "afternoon", "evening"] as const).map((s) => (
          <span key={s} className="text-xs rounded-full bg-ink/5 px-3 py-1 text-mute-500">
            {SLOT_ICON[s]} {SLOT_LABEL_ES[s]} · {data?.tomorrow.bySlot[s] ?? 0}
          </span>
        ))}
      </footer>

      {/* Sound gate */}
      {!enabled && (
        <button
          onClick={enable}
          className="absolute inset-0 z-50 bg-ink/70 text-bone flex flex-col items-center justify-center gap-3"
        >
          <span className="text-5xl">🔔</span>
          <span className="font-display text-2xl">Toca para activar el sonido</span>
          <span className="text-sm text-bone/70">Necesario una vez al arrancar la pantalla</span>
        </button>
      )}
    </div>
  );
}

function Counter({ n, label, color }: { n: number; label: string; color: string }) {
  return (
    <div className="text-center min-w-16">
      <div className="text-4xl font-extrabold leading-none" style={{ color }}>{n}</div>
      <div className="text-[0.65rem] uppercase tracking-widest text-mute-400 mt-1">{label}</div>
    </div>
  );
}

function CardRow({ card, now, isNew }: { card: TvCard; now: Date; isNew: boolean }) {
  const mins = minutesUntilSlotStart(now, card.windowDate, card.slot);
  const urg = urgencyLevel(mins);
  const urgVar = URGENCY_VAR[urg];
  const src = SOURCE[card.source] ?? { icon: "•", label: card.source, color: "#6F685B" };
  return (
    <div
      className="grid grid-cols-[72px_1fr_auto] gap-4 items-center rounded-2xl border border-ink/5 bg-white px-4 py-2 shadow-[0_10px_30px_-18px_rgba(14,13,12,0.25)]"
      style={{ borderLeft: `6px solid ${urgVar}`, boxShadow: isNew ? `0 0 0 2px var(--color-rouge), 0 0 26px rgba(184,52,94,0.35)` : undefined }}
    >
      {card.thumb ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={card.thumb} alt="" className="h-[72px] w-[72px] rounded-xl object-cover" />
      ) : (
        <div className="h-[72px] w-[72px] rounded-xl border border-dashed border-rouge/40 text-rouge font-display flex flex-col items-center justify-center text-lg">
          DC<span className="text-[0.55rem] text-mute-400">sin foto</span>
        </div>
      )}
      <div className="min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-sm text-mute-400">#{card.orderNumber ?? "—"}</span>
          <span className="text-xl font-bold truncate">{card.productLabel}</span>
        </div>
        <div className="text-base text-mute-600">Para <b className="text-rouge">{card.recipientName}</b></div>
        <div className="flex flex-wrap gap-1.5 mt-1.5 text-xs">
          <span className="rounded-full px-2 py-0.5 border" style={{ color: src.color, borderColor: `${src.color}66`, background: `${src.color}22` }}>
            {src.icon} {src.label}
          </span>
          <span className="rounded-full px-2 py-0.5 bg-ink/5 text-mute-600">
            {card.fulfillmentStatus === "preparing" ? "● En preparación" : "Por empezar"}
          </span>
          <span className="rounded-full px-2 py-0.5 bg-ink/5 text-mute-600">
            {card.method === "pickup" ? "🛍 Recoge en tienda" : `🚚 ${card.zoneLabel ?? "Entrega"}`}
          </span>
          {card.hasCardMessage && <span className="rounded-full px-2 py-0.5 bg-ink/5 text-mute-600">💌 Con tarjeta</span>}
          {card.hasDesignerNotes && <span className="rounded-full px-2 py-0.5 bg-ink/5 text-mute-600">📝 Notas</span>}
        </div>
      </div>
      <div className="text-right min-w-24">
        <div className="text-4xl font-extrabold tabular-nums" style={{ color: urgVar }}>
          {mins < 0 ? "Vencida" : formatCountdown(mins)}
        </div>
        <div className="text-xs text-mute-400 mt-1 capitalize">hoy · {SLOT_LABEL_ES[card.slot]}</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add components/admin/tv/TvBoard.tsx
git commit -m "feat(tv-board): TvBoard presentation (Dirección A)"
```

---

## Task 9: Route wiring (kiosk layout + page)

**Files:**
- Create: `app/[locale]/admin/tv/layout.tsx`
- Create: `app/[locale]/admin/tv/page.tsx`

- [ ] **Step 1: Implement the auth-gated layout**

Create `app/[locale]/admin/tv/layout.tsx`:

```tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySession, SESSION_COOKIE } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export default async function TvLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const token = (await cookies()).get(SESSION_COOKIE)?.value ?? "";
  if (!verifySession(token)) {
    redirect(`/${locale}/admin/login?next=/${locale}/admin/tv`);
  }
  return <div className="min-h-screen overflow-hidden bg-bone text-ink">{children}</div>;
}
```

- [ ] **Step 2: Implement the page**

Create `app/[locale]/admin/tv/page.tsx`:

```tsx
import TvBoard from "@/components/admin/tv/TvBoard";

export const dynamic = "force-dynamic";

// The board UI is Spanish-only (internal kiosk); locale is consumed by the
// layout's auth redirect. If i18n is ever needed here, add setRequestLocale +
// next-intl per node_modules/next docs (see AGENTS.md — Next 16 differs).
export default async function TvPage({ params }: { params: Promise<{ locale: string }> }) {
  await params;
  return <TvBoard />;
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add app/[locale]/admin/tv/layout.tsx app/[locale]/admin/tv/page.tsx
git commit -m "feat(tv-board): kiosk route (auth-gated layout + page)"
```

---

## Task 10: Full-run verification (live preview)

**Files:** none (verification only)

- [ ] **Step 1: Full test + typecheck**

Run: `npm test`
Expected: all suites PASS (including the new tv-* suites).
Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 2: Ensure required env for the dev server**

Confirm `.env` (or the dev environment) defines `INTAKE_SESSION_SECRET` (≥32 chars) and `INTAKE_PASSWORD`. Without the secret, `verifySession` throws and the board route 500s. (Do not print secret values.)

- [ ] **Step 3: Start the dev server and log in**

Start the dev server (via the preview tool / `.claude/launch.json`, not raw Bash). Navigate to `/es/admin/login`, log in with the intake password, then open `/es/admin/tv`.

- [ ] **Step 4: Verify in the browser preview**

- The board renders in the bone/rouge Dirección A style, full-screen.
- The "Toca para activar el sonido" overlay shows; clicking it dismisses it.
- Cards show product photo (or the "sin foto" placeholder), source chip, countdown with the right color, and "hoy · <franja>".
- Check `read_console_messages` — no errors.
- Check `read_network_requests` — `/api/admin/tv/board` returns 200 every ~15s.
- Seed / mark an order paid (via admin or DB) and confirm within ~15s: chime plays, the card flashes NUEVA, and the queue jumps to its page.
- Resize to 1920×1080 to confirm legibility at TV proportions.

- [ ] **Step 5: Screenshot proof + commit any fixes**

Capture a screenshot for the record. If fixes were needed, commit them:

```bash
git add -A
git commit -m "fix(tv-board): preview verification adjustments"
```

---

## Self-review

**Spec coverage** (against `2026-07-20-tv-production-board-design.md`):
- §4 tarjeta (foto, canal, estado, método/zona, avisos, countdown) → Task 8 `CardRow`. ✅
- §4 canales de origen (5) → Task 8 `SOURCE`. ✅
- §4/§10 urgencia (60/180, vencida) → Task 1 `urgencyLevel` + Task 8. ✅
- §5 franjas (9/12/15/18, America/New_York) → Task 1 `SLOT_START_MIN`, `SHOP_TZ`. ✅
- §6.1 ruta kiosco + gate → Task 9. ✅
- §6.2 endpoint + shape → Tasks 4–5. ✅
- §6.3 polling sin pausa → Task 7 `useTvPolling`. ✅
- §7 sonido + desbloqueo → Task 7 `useTvSound` + Task 8 gate. ✅
- §8 rotación de páginas → Task 8. ✅
- §9 mapeo de estados → Task 3 `computeBoard`. ✅
- §11 errores (último dato bueno, estado vacío, sin foto, tz) → Tasks 3/7/8. ✅
- §13 pruebas → Tasks 1–6 unit tests + Task 10. ✅

**Deliberately deferred (documented in spec §2/§12):** per-designer lanes; auto-advancing statuses; in-store fulfillment in the queue; consolidating the slot-time inconsistency; the admin-wide auth gap (separate task).

**Placeholder scan:** none — every code step contains full code.

**Type consistency:** `TvCard`/`TvBoardData`/`TvBoardResponse` defined in Task 3–4 are imported unchanged in Tasks 5/7/8; `newPaidIds`/`paginate` signatures match between Task 6 and Tasks 7–8; `computeBoard(orders, deps)` and `buildTvBoard(now?)` signatures match tests and callers; `listOrdersForWindowDates(dates)` matches Task 2 test and Task 4 caller.

---

## Execution handoff

Two execution options:

1. **Subagent-Driven (recommended)** — a fresh subagent per task, with review between tasks.
2. **Inline Execution** — execute tasks in this session with checkpoints.
