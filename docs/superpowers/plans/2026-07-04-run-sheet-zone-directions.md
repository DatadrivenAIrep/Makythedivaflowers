# Run Sheet: Zone Ordering + Directions Button — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On the admin delivery Run Sheet, order deliveries by delivery zone within each time slot and add a per-card "Directions" button that opens Google Maps in navigation mode.

**Architecture:** Two pure helpers (`deliveryZoneRank` in `lib/delivery-zones.ts`; `mapsDirectionsUrl` in new `lib/maps-url.ts`) hold all the logic and are unit-tested in isolation. The Run Sheet's list rendering is extracted from `RunSheetView` into a new presentational `RunSheetList` component (mirroring how `MetricsView`/`PipelineBoard` are presentational and the page owns the shell) so it can be tested without mocking fetch or `next/navigation`. `RunSheetView` keeps date state, fetching, the shell, and the drawer.

**Tech Stack:** Next.js (App Router) + React 19, TypeScript, next-intl, Tailwind, Phosphor icons (`@phosphor-icons/react/dist/ssr`), Vitest + @testing-library/react (jsdom).

**Run tests with Node 22:** `export PATH="/opt/homebrew/bin:$PATH"` first in each shell (shell default Node 16 breaks vitest). Test command shape: `npx vitest run <file>`.

---

### Task 1: `deliveryZoneRank` pure helper

Ranks an address zip by its position in the curated zone list so the Run Sheet can sort nearest-to-farthest. Unmatched/invalid zips rank last.

**Files:**
- Modify: `lib/delivery-zones.ts` (add `deliveryZoneRank`; also import `deliveryZones` value — currently only the `DeliveryZone` type is imported)
- Test: `tests/unit/delivery-zones.test.ts` (append a new `describe` block)

- [ ] **Step 1: Write the failing tests**

Append to `tests/unit/delivery-zones.test.ts` (add `deliveryZoneRank` to the existing import from `@/lib/delivery-zones` on line 2):

```ts
import { deliveryZones } from "@/data/delivery-zones";

describe("deliveryZoneRank", () => {
  it("ranks nearer zones below farther zones (lower index = sorts first)", () => {
    // Albertson is index 0, Great Neck index 3 in the curated list
    expect(deliveryZoneRank("11507")).toBeLessThan(deliveryZoneRank("11020"));
  });

  it("returns the exact curated index for a known zip", () => {
    expect(deliveryZoneRank("11507")).toBe(0); // albertson
    expect(deliveryZoneRank("11576")).toBe(1); // roslyn
  });

  it("ranks an unmatched or invalid zip last (== deliveryZones.length)", () => {
    expect(deliveryZoneRank("90210")).toBe(deliveryZones.length); // out of area
    expect(deliveryZoneRank("nope")).toBe(deliveryZones.length);  // invalid
    // a farther zone still sorts before an unmatched zip
    expect(deliveryZoneRank("11020")).toBeLessThan(deliveryZoneRank("90210"));
  });
});
```

The existing import line 2 becomes:
```ts
import { findDeliveryZoneByZip, findDeliveryZoneByCity, isValidZip, deliveryZoneRank } from "@/lib/delivery-zones";
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `export PATH="/opt/homebrew/bin:$PATH" && npx vitest run tests/unit/delivery-zones.test.ts`
Expected: FAIL — `deliveryZoneRank is not a function` (or a TS/import error).

- [ ] **Step 3: Implement `deliveryZoneRank`**

In `lib/delivery-zones.ts`, change the top import to also bring in the `deliveryZones` value, and add the function at the end of the file:

```ts
import { deliveryZones, type DeliveryZone } from "@/data/delivery-zones";
```

```ts
// Rank an address zip by its position in the curated `deliveryZones` list
// (roughly nearest-to-farthest from the shop). Used to order the Run Sheet
// within a time slot. Unmatched or invalid zips rank last.
export function deliveryZoneRank(zip: string): number {
  const zone = findDeliveryZoneByZip(zip);
  return zone ? deliveryZones.indexOf(zone) : deliveryZones.length;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `export PATH="/opt/homebrew/bin:$PATH" && npx vitest run tests/unit/delivery-zones.test.ts`
Expected: PASS (all existing + new tests).

- [ ] **Step 5: Commit**

```bash
git add lib/delivery-zones.ts tests/unit/delivery-zones.test.ts
git commit -m "feat(run-sheet): deliveryZoneRank helper for zone ordering"
```

---

### Task 2: `mapsDirectionsUrl` pure helper

Builds a Google Maps directions-mode URL from a structured `Address`. Single source of truth for the directions link; encoding is tested.

**Files:**
- Create: `lib/maps-url.ts`
- Test: `tests/unit/maps-url.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/maps-url.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { mapsDirectionsUrl } from "@/lib/maps-url";
import type { Address } from "@/types/address";

const addr: Address = {
  street1: "1077 Willis Ave",
  city: "Albertson",
  state: "NY",
  zip: "11507",
  country: "US",
};

describe("mapsDirectionsUrl", () => {
  it("targets Google Maps directions mode", () => {
    expect(mapsDirectionsUrl(addr)).toContain("https://www.google.com/maps/dir/?api=1&destination=");
  });

  it("percent-encodes the full address as the destination", () => {
    const url = mapsDirectionsUrl(addr);
    expect(url).toContain(encodeURIComponent("1077 Willis Ave, Albertson, NY 11507"));
    // spaces are encoded, not left raw
    expect(url).not.toContain("Willis Ave,");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `export PATH="/opt/homebrew/bin:$PATH" && npx vitest run tests/unit/maps-url.test.ts`
Expected: FAIL — cannot find module `@/lib/maps-url`.

- [ ] **Step 3: Implement the helper**

Create `lib/maps-url.ts`:

```ts
import type { Address } from "@/types/address";

function formatAddress(a: Address): string {
  return `${a.street1}, ${a.city}, ${a.state} ${a.zip}`;
}

// Google Maps in navigation mode with the address as destination — the driver
// taps once and gets turn-by-turn directions from wherever they are.
export function mapsDirectionsUrl(a: Address): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(formatAddress(a))}`;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `export PATH="/opt/homebrew/bin:$PATH" && npx vitest run tests/unit/maps-url.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/maps-url.ts tests/unit/maps-url.test.ts
git commit -m "feat(run-sheet): mapsDirectionsUrl helper"
```

---

### Task 3: i18n key `action_directions` (es/en)

Adds the button label to the `admin_dashboard` namespace in both locales, keeping key sets identical.

**Files:**
- Modify: `messages/es.json` (`admin_dashboard` object)
- Modify: `messages/en.json` (`admin_dashboard` object)
- Test: `tests/unit/i18n-parity.test.ts` (existing — must stay green)

- [ ] **Step 1: Add the key in Spanish**

In `messages/es.json`, inside the `admin_dashboard` object, add after the `"action_delivered"` entry:

```json
    "action_directions": "Cómo llegar",
```

- [ ] **Step 2: Add the key in English**

In `messages/en.json`, inside the `admin_dashboard` object, add after the `"action_delivered"` entry:

```json
    "action_directions": "Directions",
```

- [ ] **Step 3: Verify JSON validity and es/en parity**

Run: `export PATH="/opt/homebrew/bin:$PATH" && node -e "require('./messages/es.json'); require('./messages/en.json'); console.log('json ok')" && npx vitest run tests/unit/i18n-parity.test.ts`
Expected: `json ok` then PASS (identical key paths in en/es).

- [ ] **Step 4: Commit**

```bash
git add messages/es.json messages/en.json
git commit -m "i18n(run-sheet): action_directions label (es/en)"
```

---

### Task 4: Extract `RunSheetList` + zone ordering, zone chip, Directions button

Move the Run Sheet's grouped list rendering into a presentational `RunSheetList` component. Within each slot, sort by `deliveryZoneRank`. Add a zone chip per card, a "Directions" button (opens `mapsDirectionsUrl` in a new tab), and make the address plain text (no longer a pin link). `RunSheetView` shrinks to date/fetch/shell/drawer and renders `<RunSheetList>`.

**Files:**
- Create: `components/admin/dashboard/RunSheetList.tsx`
- Modify: `components/admin/dashboard/RunSheetView.tsx` (remove moved rendering; render `RunSheetList`)
- Test: `tests/unit/RunSheetList.test.tsx`

- [ ] **Step 1: Write the failing component test**

Create `tests/unit/RunSheetList.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import esMessages from "@/messages/es.json";
import RunSheetList from "@/components/admin/dashboard/RunSheetList";
import type { Order } from "@/types/order";

function wrap(ui: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="es" messages={esMessages as Record<string, unknown>}>
      {ui}
    </NextIntlClientProvider>,
  );
}

// city is deliberately NOT a zone label so the zone chip text stays unique
function deliveryOrder(id: string, name: string, zip: string): Order {
  return {
    id, source: "web", locale: "es", lines: [],
    fulfillment: {
      method: "delivery",
      recipient: { name, phone: "5551234567" },
      address: { street1: "1 Main St", city: "Elsewhere", state: "NY", zip, country: "US" },
      window: { date: "2026-07-04", slot: "midday" },
    },
    contact: { phone: "5551234567" },
    totals: { subtotalCents: 5000, deliveryCents: 1000, taxCents: 0, totalCents: 6000 },
    status: "pending", paymentStatus: "paid",
    createdAt: "2026-07-04T00:00:00Z", updatedAt: "2026-07-04T00:00:00Z",
  };
}

describe("RunSheetList", () => {
  it("orders deliveries within a slot by zone (nearer first), even if given farther-first", () => {
    const orders = [
      deliveryOrder("u", "Reci Uno", "11020"), // Great Neck, index 3 (farther)
      deliveryOrder("d", "Reci Dos", "11507"), // Albertson, index 0 (nearer)
    ];
    const { container } = wrap(
      <RunSheetList orders={orders} locale="es" onOpen={() => {}} onAdvance={() => {}} />,
    );
    const text = container.textContent ?? "";
    expect(text.indexOf("Reci Dos")).toBeGreaterThanOrEqual(0);
    expect(text.indexOf("Reci Dos")).toBeLessThan(text.indexOf("Reci Uno"));
    // zone chips render, one per card
    expect(screen.getByText("Albertson")).toBeDefined();
    expect(screen.getByText("Great Neck")).toBeDefined();
  });

  it("renders a Directions button linking to Google Maps directions mode", () => {
    wrap(
      <RunSheetList
        orders={[deliveryOrder("d", "Reci Dos", "11507")]}
        locale="es"
        onOpen={() => {}}
        onAdvance={() => {}}
      />,
    );
    const link = screen.getByRole("link", { name: /Cómo llegar/i });
    const href = link.getAttribute("href") ?? "";
    expect(href).toContain("https://www.google.com/maps/dir/?api=1&destination=");
    expect(href).toContain(encodeURIComponent("1 Main St, Elsewhere, NY 11507"));
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `export PATH="/opt/homebrew/bin:$PATH" && npx vitest run tests/unit/RunSheetList.test.tsx`
Expected: FAIL — cannot find module `@/components/admin/dashboard/RunSheetList`.

- [ ] **Step 3: Create `RunSheetList.tsx`**

Create `components/admin/dashboard/RunSheetList.tsx` with the full content below:

```tsx
"use client";
import { Truck, CheckCircle, Phone, NoteBlank, NavigationArrow } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";
import AdminButton from "./AdminButton";
import { resolveLine } from "./product-lookup";
import { deliveryZoneRank, findDeliveryZoneByZip } from "@/lib/delivery-zones";
import { mapsDirectionsUrl } from "@/lib/maps-url";
import type { Order } from "@/types/order";

const SLOT_ORDER = ["morning", "midday", "afternoon", "evening"] as const;

function money(c: number) { return `$${(c / 100).toFixed(2)}`; }

function itemsLine(o: Order): string {
  if (o.lines.length === 0) return "—";
  return o.lines.map((l) => {
    const r = resolveLine(l);
    const v = r.variantLabel ? ` (${r.variantLabel})` : "";
    return `${r.name}${v} ×${r.qty}`;
  }).join(", ");
}

function addonsLine(o: Order): string[] {
  return o.lines.flatMap((l) => resolveLine(l).addOnLabels);
}

// Zip of a delivery order, or "" for non-delivery (which never reaches here).
function deliveryZip(o: Order): string {
  return o.fulfillment.method === "delivery" ? o.fulfillment.address.zip : "";
}

type Props = {
  orders: Order[];
  locale: string;
  onOpen: (orderId: string) => void;
  onAdvance: (orderId: string, status: "out-for-delivery" | "delivered") => void;
};

export default function RunSheetList({ orders, locale, onOpen, onAdvance }: Props) {
  const t = useTranslations("admin_dashboard");
  const to = useTranslations("admin_orders");
  const lang = locale === "en" ? "en" : "es";

  const grouped = SLOT_ORDER.map((slot) => ({
    slot,
    orders: orders
      .filter((o) => o.fulfillment.method === "delivery" && o.fulfillment.window.slot === slot)
      .sort((a, b) => deliveryZoneRank(deliveryZip(a)) - deliveryZoneRank(deliveryZip(b))),
  })).filter((g) => g.orders.length > 0);

  return (
    <>
      {grouped.map((group) => (
        <section key={group.slot} className="mb-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink/60">
            {to("slot." + group.slot)} · {group.orders.length}
          </h2>
          <ul className="space-y-2">
            {group.orders.map((o) => {
              if (o.fulfillment.method !== "delivery") return null;
              const f = o.fulfillment;
              const zone = findDeliveryZoneByZip(f.address.zip);
              const addons = addonsLine(o);
              const done = o.status === "delivered";
              return (
                <li key={o.id} className={`rounded-lg border border-ink/10 bg-bone p-3 text-sm shadow-sm ${done ? "opacity-60" : ""}`}>
                  <div className="flex items-start gap-2">
                    <div className="flex-1 cursor-pointer" onClick={() => onOpen(o.id)}>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{f.recipient.name}</span>
                        <span className="text-xs text-ink/40">#{o.id.slice(-6)}</span>
                        {zone && (
                          <span className="rounded bg-ink/10 px-1.5 py-0.5 text-[10px] text-ink/70">{zone.label[lang]}</span>
                        )}
                        <span className={`rounded px-1.5 py-0.5 text-[10px] ${o.paymentStatus === "paid" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                          {o.paymentStatus === "paid" ? to("payment_status.paid") : t("collect")}
                        </span>
                        <span className="ml-auto text-xs text-ink/60">{to("fulfillment_status." + o.status)} · {money(o.totals.totalCents)}</span>
                      </div>
                      <div className="mt-1 text-ink/80">
                        {f.address.street1}, {f.address.city} {f.address.zip}
                      </div>
                      <div className="mt-0.5 text-xs text-ink/60">{itemsLine(o)}</div>
                      {addons.length > 0 && <div className="text-xs text-emerald-700">+ {addons.join(", ")}</div>}
                      {f.cardMessage && (
                        <div className="mt-1 flex items-start gap-1.5 rounded bg-ink/5 p-1.5 text-xs italic">
                          <NoteBlank size={14} weight="bold" className="mt-0.5 flex-shrink-0" />
                          <span>&quot;{f.cardMessage}&quot;</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 border-t border-ink/5 pt-2">
                    <AdminButton variant="secondary" icon={NavigationArrow} href={mapsDirectionsUrl(f.address)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>{t("action_directions")}</AdminButton>
                    <AdminButton variant="secondary" icon={Phone} href={`tel:${f.recipient.phone}`} onClick={(e) => e.stopPropagation()}>{f.recipient.phone}</AdminButton>
                    {o.status !== "delivered" && o.status !== "out-for-delivery" && (
                      <AdminButton variant="secondary" icon={Truck} onClick={() => onAdvance(o.id, "out-for-delivery")}>{t("action_en_route")}</AdminButton>
                    )}
                    {o.status !== "delivered" && (
                      <AdminButton variant="primary" icon={CheckCircle} onClick={() => onAdvance(o.id, "delivered")}>{t("action_delivered")}</AdminButton>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </>
  );
}
```

- [ ] **Step 4: Run the component test to verify it passes**

Run: `export PATH="/opt/homebrew/bin:$PATH" && npx vitest run tests/unit/RunSheetList.test.tsx`
Expected: PASS (both tests).

- [ ] **Step 5: Rewrite `RunSheetView.tsx` to use `RunSheetList`**

Replace the entire contents of `components/admin/dashboard/RunSheetView.tsx` with:

```tsx
"use client";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import DashboardShell from "./DashboardShell";
import OrderDetailDrawer from "./OrderDetailDrawer";
import AdminButton from "./AdminButton";
import RunSheetList from "./RunSheetList";
import type { Order } from "@/types/order";

type RunSheetResp = { date: string; orders: Order[] };

function todayISO(): string { return new Date().toISOString().slice(0, 10); }

export default function RunSheetView({ locale }: { locale: string }) {
  const t = useTranslations("admin_dashboard");
  const [date, setDate] = useState(todayISO());
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [drawerOrderId, setDrawerOrderId] = useState<string | null>(null);

  const fetchSheet = useCallback(async (d: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/orders/run-sheet?date=${d}`, { cache: "no-store" });
      const body = (await res.json()) as RunSheetResp;
      setOrders(body.orders);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void fetchSheet(date); }, [date, fetchSheet]);

  async function advance(orderId: string, status: "out-for-delivery" | "delivered") {
    await fetch(`/api/admin/orders/${orderId}/fulfillment`, {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await fetchSheet(date);
  }

  const delivered = orders.filter((o) => o.status === "delivered").length;

  return (
    <DashboardShell locale={locale}>
      <div className="mb-4 flex items-center gap-3">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded border border-ink/15 bg-bone px-2 py-1 text-sm"
        />
        <AdminButton variant="secondary" onClick={() => setDate(todayISO())}>{t("today_button")}</AdminButton>
        <span className="ml-auto text-sm text-ink/60">
          {orders.length} {t("deliveries_count")} · {delivered} {t("completed_count")}
        </span>
      </div>

      {loading && orders.length === 0 && <p className="text-sm text-ink/50">{t("loading")}</p>}
      {!loading && orders.length === 0 && (
        <p className="rounded border border-ink/10 bg-bone p-4 text-sm text-ink/60">{t("no_deliveries")}</p>
      )}

      <RunSheetList orders={orders} locale={locale} onOpen={setDrawerOrderId} onAdvance={advance} />

      {drawerOrderId && (
        <OrderDetailDrawer
          orderId={drawerOrderId}
          onClose={() => setDrawerOrderId(null)}
          onChanged={() => { void fetchSheet(date); }}
        />
      )}
    </DashboardShell>
  );
}
```

- [ ] **Step 6: Typecheck and run the Run Sheet tests + full-file sanity**

Run: `export PATH="/opt/homebrew/bin:$PATH" && npx tsc --noEmit && npx vitest run tests/unit/RunSheetList.test.tsx tests/unit/delivery-zones.test.ts tests/unit/maps-url.test.ts tests/unit/i18n-parity.test.ts`
Expected: tsc clean; all listed test files PASS.

- [ ] **Step 7: Commit**

```bash
git add components/admin/dashboard/RunSheetList.tsx components/admin/dashboard/RunSheetView.tsx tests/unit/RunSheetList.test.tsx
git commit -m "feat(run-sheet): zone ordering, zone chip, and Directions button"
```

---

## Self-Review

**1. Spec coverage**
- Zone ordering within slot → Task 1 (`deliveryZoneRank`) + Task 4 (sort in `RunSheetList`). ✓
- Zone chip per card → Task 4 (chip via `findDeliveryZoneByZip` + `zone.label[lang]`). ✓
- "Directions" button, directions mode, new tab → Task 2 (`mapsDirectionsUrl`) + Task 4 (`AdminButton` anchor with `target="_blank"`). ✓
- Address becomes plain text → Task 4 (address `<div>` no longer an anchor). ✓
- i18n `action_directions` es/en, parity gated → Task 3. ✓
- Tests: `deliveryZoneRank`, `mapsDirectionsUrl`, component order + button → Tasks 1, 2, 4. ✓
- No data-model/migration/API change → confirmed; only `lib/`, `messages/`, and two dashboard components touched. ✓

**2. Placeholder scan:** No TBD/TODO; every code step shows full code. ✓

**3. Type consistency:** `deliveryZoneRank(zip: string): number`, `mapsDirectionsUrl(a: Address): string`, `RunSheetList` props `{ orders, locale, onOpen, onAdvance }`, and `onAdvance(id, "out-for-delivery" | "delivered")` are used identically across Task 4's `RunSheetList` and `RunSheetView`. `Address` imported from `@/types/address` (matches `types/order.ts`). Zone label indexed with `lang: "en" | "es"`. ✓
