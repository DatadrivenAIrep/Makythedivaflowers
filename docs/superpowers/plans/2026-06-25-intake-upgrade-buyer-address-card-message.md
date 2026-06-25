# Intake redesign (B) + buyer address + editable card message — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let staff capture a persisted, auto-filled buyer address; edit the card message anywhere `FulfillmentBlock` renders (fixing the order-edit gap); and ship a Direction-B section-card redesign of the intake form with inline-editable totals.

**Architecture:** Buyer address is a new nullable `buyer_address_json` column on `customers`, captured in `CustomerBlock` via the existing `AddressAutocomplete`, persisted by `upsertOnOrder`, auto-filled from the phone-lookup. The card-message textarea moves into `FulfillmentBlock` (single source for intake + edit drawer). `CartSummary` splits into `CartLines` + `CartTotals` (inline editable, no `window.prompt`). `IntakeForm` is reorganized into four polished section cards.

**Tech Stack:** Next.js (customized — see `AGENTS.md`), `node:sqlite` (numbered SQL migrations in `db/migrations/`), zod, React client components, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-06-25-intake-upgrade-buyer-address-card-message-design.md`

**Conventions (verified):**
- Migrations: numbered SQL file; `runMigrations()` applies new files in order. Latest committed is `010_order_history.sql` → ours is `011`.
- DB tests: `beforeEach(() => { vi.stubEnv("SQLITE_FILE", ":memory:"); runMigrations(); })`, `afterEach(() => { closeDb(); vi.unstubAllEnvs(); })`. Seed customers/orders with direct `INSERT`.
- Component tests mock next-intl: `vi.mock("next-intl", () => ({ useTranslations: () => (k: string) => k, useLocale: () => "es" }))`, render with `@testing-library/react`.
- Run one file: `npm test -- tests/unit/<file>`
- `Address` type: `{ street1: string; street2?: string; city: string; state: string; zip: string; country: "US" }` (`types/address.ts`).
- Reusable zod `address` object lives in `schemas/intake.ts` (a module-level `const address`).

**Baseline:** the same 5 pre-existing failures as the main branch (3× `checkout-schema` past date; `print-chromium`/`_preview`/`print-render` Chromium-in-sandbox). Ignore them; do not "fix" them here.

---

## File Structure

**New files**
- `db/migrations/011_buyer_address.sql` — `buyer_address_json` column on customers.
- `components/admin/intake/CartLines.tsx` — cart line list (split out of `CartSummary`).
- `components/admin/intake/CartTotals.tsx` — inline-editable totals (split out of `CartSummary`).
- Tests: `tests/unit/customer-storage-buyer-address.test.ts`, `tests/unit/components/CartTotals.test.tsx`.

**Modified files**
- `lib/customer-storage.ts` — `buyerAddress` on `Customer`/`CustomerRow`/`UpsertInput`; persist in `upsertOnOrder`.
- `schemas/intake.ts` — optional `customer.buyerAddress`.
- `app/api/admin/orders/route.ts` — pass `buyerAddress` to `upsertOnOrder`.
- `components/admin/intake/FulfillmentBlock.tsx` — render the card-message textarea (all methods).
- `components/admin/intake/CustomerBlock.tsx` — buyer-address field, pre-fill, "use as delivery"; `CustomerSnapshot += buyerAddress`.
- `components/admin/intake/IntakeForm.tsx` — remove standalone card-message textarea; wire buyer address into state + POST body; use `CartLines`/`CartTotals`; Direction-B section cards.
- `components/admin/intake/CartSummary.tsx` — deleted (replaced by `CartLines` + `CartTotals`).
- Tests updated: `tests/unit/components/CartSummary.test.tsx` (retarget), any intake test referencing the old card-message location.

---

## Task 1: Migration 011 + buyer address in customer storage

**Files:**
- Create: `db/migrations/011_buyer_address.sql`
- Modify: `lib/customer-storage.ts`
- Test: `tests/unit/customer-storage-buyer-address.test.ts`

- [ ] **Step 1: Write the migration**

`db/migrations/011_buyer_address.sql`:

```sql
-- The buyer's own address (distinct from last_address_json, which is the last
-- delivery/recipient destination). Captured at intake, reused on return.
ALTER TABLE customers ADD COLUMN buyer_address_json TEXT;
```

- [ ] **Step 2: Add `buyerAddress` to types in `lib/customer-storage.ts`**

In `Customer` (after `lastAddress?: Address;`): add `buyerAddress?: Address;`.
In `CustomerRow` (after `last_address_json: string | null;`): add `buyer_address_json: string | null;`.
In `UpsertInput` (after `address?: Address;`): add `buyerAddress?: Address;`.

- [ ] **Step 3: Map it in `rowToCustomer`**

In `rowToCustomer`, after the `lastAddress:` line add:

```ts
    buyerAddress: r.buyer_address_json ? (JSON.parse(r.buyer_address_json) as Address) : undefined,
```

- [ ] **Step 4: Persist it in `upsertOnOrder`**

In the UPDATE statement, add a column assignment after `last_address_json = COALESCE(?, last_address_json),`:

```sql
         buyer_address_json = COALESCE(?, buyer_address_json),
```

and add the bound value in the `.run(...)` call immediately after the `input.address ? JSON.stringify(input.address) : null,` argument:

```ts
      input.buyerAddress ? JSON.stringify(input.buyerAddress) : null,
```

In the INSERT statement, add `buyer_address_json` to the column list (after `last_address_json,`) and a `?` placeholder in the VALUES list (after the `last_address_json` placeholder — i.e. one more `?`), then add the bound value in `.run(...)` immediately after the `input.address ? JSON.stringify(input.address) : null,` argument:

```ts
    input.buyerAddress ? JSON.stringify(input.buyerAddress) : null,
```

> The INSERT currently is `VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?)` for (id, name, phone, email, last_address_json, [1], first_seen, last_seen, messaging_channel, locale). After adding `buyer_address_json` right after `last_address_json`, it becomes `VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)` and the new bound value goes right after the `last_address_json` value.

- [ ] **Step 5: Write the failing test**

`tests/unit/customer-storage-buyer-address.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { upsertOnOrder, getByPhone } from "@/lib/customer-storage";
import type { Address } from "@/types/address";

beforeEach(() => { vi.stubEnv("SQLITE_FILE", ":memory:"); runMigrations(); });
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

const buyer: Address = { street1: "12 Willis Ave", city: "Albertson", state: "NY", zip: "11507", country: "US" };

describe("buyer address persistence", () => {
  it("stores buyerAddress on insert and returns it on lookup", () => {
    upsertOnOrder({ name: "Juan", phone: "5165550100", buyerAddress: buyer, orderAt: "2026-06-25T00:00:00Z" });
    const c = getByPhone("5165550100");
    expect(c?.buyerAddress?.street1).toBe("12 Willis Ave");
  });

  it("preserves buyerAddress on a later order that omits it (COALESCE)", () => {
    upsertOnOrder({ name: "Juan", phone: "5165550100", buyerAddress: buyer, orderAt: "2026-06-25T00:00:00Z" });
    upsertOnOrder({ name: "Juan", phone: "5165550100", orderAt: "2026-06-26T00:00:00Z" });
    expect(getByPhone("5165550100")?.buyerAddress?.zip).toBe("11507");
  });

  it("leaves buyerAddress undefined when never provided", () => {
    upsertOnOrder({ name: "Ana", phone: "5165550200", orderAt: "2026-06-25T00:00:00Z" });
    expect(getByPhone("5165550200")?.buyerAddress).toBeUndefined();
  });
});
```

- [ ] **Step 6: Run — expect PASS**

Run: `npm test -- tests/unit/customer-storage-buyer-address.test.ts`
Expected: 3 passing.

- [ ] **Step 7: Commit**

```bash
git add db/migrations/011_buyer_address.sql lib/customer-storage.ts tests/unit/customer-storage-buyer-address.test.ts
git commit -m "feat(customers): persist buyer_address (migration 011 + storage)"
```

---

## Task 2: Intake schema + POST persist buyer address

**Files:**
- Modify: `schemas/intake.ts`, `app/api/admin/orders/route.ts`
- Test: `tests/unit/intake-buyer-address.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/unit/intake-buyer-address.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { intakeSchema } from "@/schemas/intake";

const base = {
  source: "walk-in" as const,
  customer: { phone: "5165550100", name: "Juan" },
  fulfillment: { method: "in-store" as const, recipient: { name: "Maria", phone: "5165550100" } },
  lines: [{ kind: "custom" as const, title: "Ramo", priceCents: 5000, qty: 1 }],
  payment: { status: "pending" as const },
};

describe("intake schema buyerAddress", () => {
  it("accepts a customer with a buyer address", () => {
    const r = intakeSchema.safeParse({
      ...base,
      customer: { ...base.customer, buyerAddress: { street1: "12 Willis Ave", city: "Albertson", state: "NY", zip: "11507", country: "US" } },
    });
    expect(r.success).toBe(true);
  });
  it("accepts a customer without a buyer address (optional)", () => {
    expect(intakeSchema.safeParse(base).success).toBe(true);
  });
  it("rejects a malformed buyer address", () => {
    const r = intakeSchema.safeParse({
      ...base,
      customer: { ...base.customer, buyerAddress: { street1: "x", city: "A", state: "NEW YORK", zip: "bad", country: "US" } },
    });
    expect(r.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (buyerAddress not in schema, so the malformed-rejection test fails because extra keys are stripped and it passes)

Run: `npm test -- tests/unit/intake-buyer-address.test.ts`

- [ ] **Step 3: Add `buyerAddress` to the intake schema**

In `schemas/intake.ts`, inside the `customer: z.object({ ... })`, add after the `locale:` line:

```ts
    buyerAddress: address.optional(),
```

(`address` is the existing module-level zod object — reused as-is.)

- [ ] **Step 4: Run — expect PASS**

Run: `npm test -- tests/unit/intake-buyer-address.test.ts`
Expected: 3 passing.

- [ ] **Step 5: Pass it through in the POST handler**

In `app/api/admin/orders/route.ts`, the `upsertOnOrder({...})` call currently passes `name, phone, email, address, orderAt, messagingChannel, locale`. Add one line inside that object literal:

```ts
    buyerAddress: input.customer.buyerAddress,
```

- [ ] **Step 6: Verify intake POST still works**

Run: `npm test -- tests/unit/api-admin-orders.test.ts`
Expected: still passing.

- [ ] **Step 7: Commit**

```bash
git add schemas/intake.ts app/api/admin/orders/route.ts tests/unit/intake-buyer-address.test.ts
git commit -m "feat(intake): accept + persist customer.buyerAddress"
```

---

## Task 3: Card message into `FulfillmentBlock` (fixes edit gap + B grouping)

**Files:**
- Modify: `components/admin/intake/FulfillmentBlock.tsx`, `components/admin/intake/IntakeForm.tsx`
- Test: `tests/unit/components/FulfillmentBlock.test.tsx`

- [ ] **Step 1: Write the failing test**

`tests/unit/components/FulfillmentBlock.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import FulfillmentBlock, { type FulfillmentState } from "@/components/admin/intake/FulfillmentBlock";

vi.mock("next-intl", () => ({ useTranslations: () => (k: string) => k }));

function state(method: FulfillmentState["method"]): FulfillmentState {
  return {
    method,
    recipient: { name: "Maria", phone: "555" },
    address: { street1: "", city: "", state: "NY", zip: "", country: "US" },
    window: { date: "2026-07-04", slot: "midday" },
    cardMessage: "",
  };
}

describe("FulfillmentBlock card message", () => {
  it("renders an editable card-message field for delivery", () => {
    const onChange = vi.fn();
    render(<FulfillmentBlock value={state("delivery")} onChange={onChange} />);
    const ta = screen.getByPlaceholderText("card_message_placeholder");
    fireEvent.change(ta, { target: { value: "Feliz cumple" } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ cardMessage: "Feliz cumple" }));
  });

  it("renders the card-message field even for in-store", () => {
    render(<FulfillmentBlock value={state("in-store")} onChange={() => {}} />);
    expect(screen.getByPlaceholderText("card_message_placeholder")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (no card-message field in FulfillmentBlock yet)

Run: `npm test -- tests/unit/components/FulfillmentBlock.test.tsx`

- [ ] **Step 3: Render the card-message textarea in `FulfillmentBlock`**

In `FulfillmentBlock.tsx`, the component returns a `<div className="mb-5">…</div>` whose contents are the label, the segmented control, and a `{value.method !== "in-store" && (…)}` block. Add the card-message textarea **after** that conditional block and **before** the closing `</div>` of the component root, so it renders for all methods:

```tsx
      <div className="mt-4">
        <label className="block text-[11px] uppercase tracking-widest text-mute-400 mb-2">{t("card_message_label")}</label>
        <textarea
          value={value.cardMessage}
          onChange={(e) => onChange({ ...value, cardMessage: e.target.value })}
          placeholder={t("card_message_placeholder")}
          rows={3}
          className="w-full p-3.5 rounded-xl bg-bone border border-mute-200 outline-none focus:border-ink focus:bg-white resize-none"
        />
      </div>
```

- [ ] **Step 4: Run — expect PASS**

Run: `npm test -- tests/unit/components/FulfillmentBlock.test.tsx`
Expected: 2 passing.

- [ ] **Step 5: Remove the now-duplicate textarea from `IntakeForm`**

In `IntakeForm.tsx`, delete the standalone card-message block (the `<div className="mb-5">` containing the `card_message_label` label + the `<textarea>` bound to `fulfillment.cardMessage`) that sits between `<FulfillmentBlock .../>` and the closing of the left `<section>`. `FulfillmentBlock` now owns it.

- [ ] **Step 6: Verify the order-edit drawer now exposes card message**

The edit drawer's `OrderEditForm` already renders `FulfillmentBlock` and passes `cardMessage` into the patch — with the textarea present, staff can now edit it. Run the drawer test to confirm no regression:

Run: `npm test -- tests/unit/components/OrderDetailDrawer.test.tsx`
Expected: passing.

- [ ] **Step 7: Commit**

```bash
git add components/admin/intake/FulfillmentBlock.tsx components/admin/intake/IntakeForm.tsx tests/unit/components/FulfillmentBlock.test.tsx
git commit -m "feat(intake): move card-message into FulfillmentBlock (fixes edit-drawer gap)"
```

---

## Task 4: Buyer address in `CustomerBlock` (capture + pre-fill + use-as-delivery)

**Files:**
- Modify: `components/admin/intake/CustomerBlock.tsx`, `components/admin/intake/IntakeForm.tsx`
- Test: `tests/unit/components/CustomerBlock.test.tsx`

- [ ] **Step 1: Extend `CustomerSnapshot` and props in `CustomerBlock.tsx`**

`CustomerSnapshot` gains `buyerAddress?: Address;` (import `Address` from `@/types/address`). The component already receives `onApplyAddress` — reuse it for "use as delivery".

Add the buyer-address UI after the `<ChannelPicker .../>` and before the recurring-customer hint. It uses `AddressAutocomplete` for street1 plus city/state/zip inputs:

```tsx
      <div className="mt-3">
        <label className="block text-[11px] uppercase tracking-widest text-mute-400 mb-2">{t("buyer_address_label")}</label>
        <AddressAutocomplete
          value={value.buyerAddress?.street1 ?? ""}
          onChange={(v) => onChange({ ...value, buyerAddress: { ...(value.buyerAddress ?? { city: "", state: "NY", zip: "", country: "US" }), street1: v } as Address })}
          onSelect={(addr) => onChange({ ...value, buyerAddress: addr })}
          placeholder={t("buyer_address_placeholder")}
          className="w-full p-3.5 rounded-xl bg-bone border border-mute-200 outline-none focus:border-ink focus:bg-white"
        />
        <div className="mt-2 grid grid-cols-[1.4fr_0.6fr_0.7fr] gap-2">
          <input value={value.buyerAddress?.city ?? ""} onChange={(e) => onChange({ ...value, buyerAddress: { ...(value.buyerAddress ?? { street1: "", state: "NY", zip: "", country: "US" }), city: e.target.value } as Address })} placeholder={t("fulfillment_city_placeholder")} className="p-3.5 rounded-xl bg-bone border border-mute-200 outline-none focus:border-ink focus:bg-white" />
          <input value={value.buyerAddress?.state ?? "NY"} onChange={(e) => onChange({ ...value, buyerAddress: { ...(value.buyerAddress ?? { street1: "", city: "", zip: "", country: "US" }), state: e.target.value.toUpperCase().slice(0, 2) } as Address })} maxLength={2} className="p-3.5 rounded-xl bg-bone border border-mute-200 outline-none focus:border-ink focus:bg-white uppercase tracking-wider text-center" />
          <input value={value.buyerAddress?.zip ?? ""} onChange={(e) => onChange({ ...value, buyerAddress: { ...(value.buyerAddress ?? { street1: "", city: "", state: "NY", country: "US" }), zip: e.target.value.replace(/\D/g, "").slice(0, 5) } as Address })} inputMode="numeric" placeholder={t("fulfillment_zip_placeholder")} className="p-3.5 rounded-xl bg-bone border border-mute-200 outline-none focus:border-ink focus:bg-white tabular-nums text-center" />
        </div>
        {value.buyerAddress?.street1 && (
          <button type="button" onClick={() => value.buyerAddress && onApplyAddress(value.buyerAddress)} className="mt-2 text-rouge underline text-[12.5px]">
            {t("buyer_use_as_delivery")}
          </button>
        )}
      </div>
```

Add the import at the top: `import AddressAutocomplete from "./AddressAutocomplete";`

- [ ] **Step 2: Pre-fill buyer address from the phone lookup**

In `CustomerBlock.tsx`, the lookup effect already calls `onChange({...value, name, email, messagingChannel})` when a customer is found. Add `buyerAddress` to that merge so it pre-fills only when the field is still empty (don't clobber typed input):

```ts
        onChange({
          ...value,
          name: value.name || c.name,
          email: value.email || c.email || "",
          buyerAddress: value.buyerAddress ?? c.buyerAddress,
          messagingChannel:
            value.messagingChannel === "sms" && c.messagingChannel
              ? c.messagingChannel
              : value.messagingChannel,
        });
```

(The lookup endpoint already returns the full `Customer`, so `c.buyerAddress` is present after Task 1.)

- [ ] **Step 3: Add the i18n keys**

Add to the `admin_intake` namespace in the locale message files (find the existing `card_message_label` key and add alongside it, in both `en` and `es`):

```json
"buyer_address_label": { "en": "Buyer address", "es": "Dirección del comprador" },
"buyer_address_placeholder": { "en": "Buyer's own address (optional)", "es": "Dirección del comprador (opcional)" },
"buyer_use_as_delivery": { "en": "↳ use as delivery address", "es": "↳ usar como dirección de entrega" }
```

(Locate the messages file used by `useTranslations("admin_intake")` — search for `"card_message_label"` to find it; match the file's existing structure for adding keys.)

- [ ] **Step 4: Wire buyer address into `IntakeForm` state + POST body**

`IntakeForm.tsx` already holds `customer` state of type `CustomerSnapshot` and renders `<CustomerBlock value={customer} onChange={setCustomer} onApplyAddress={(addr) => setFulfillment((f) => ({ ...f, address: addr, method: "delivery" }))} />`. No prop change needed (buyerAddress travels inside `customer`; `onApplyAddress` already copies an address into the delivery fulfillment).

In `onSubmit`, add `buyerAddress` to the POSTed `customer` object:

```ts
        customer: {
          phone: customer.phone,
          name: customer.name,
          email: customer.email || undefined,
          messagingChannel: customer.messagingChannel,
          locale,
          buyerAddress: customer.buyerAddress,
        },
```

Also include `buyerAddress` in the `setCustomer(...)` reset after a successful submit:

```ts
      setCustomer({ name: "", phone: "", email: "", messagingChannel: "sms", buyerAddress: undefined });
```

- [ ] **Step 5: Write the failing component test**

`tests/unit/components/CustomerBlock.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import CustomerBlock, { type CustomerSnapshot } from "@/components/admin/intake/CustomerBlock";

vi.mock("next-intl", () => ({ useTranslations: () => (k: string) => k }));
afterEach(() => vi.restoreAllMocks());

const snap: CustomerSnapshot = { name: "", phone: "", email: "", messagingChannel: "sms" };

it("pre-fills buyer address from a phone lookup", async () => {
  vi.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({
    found: true,
    customer: { name: "Juan", email: "j@e.com", buyerAddress: { street1: "12 Willis Ave", city: "Albertson", state: "NY", zip: "11507", country: "US" } },
  }), { status: 200 }));
  const onChange = vi.fn();
  render(<CustomerBlock value={{ ...snap, phone: "5165550100" }} onChange={onChange} onApplyAddress={() => {}} />);
  await waitFor(() => expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
    buyerAddress: expect.objectContaining({ street1: "12 Willis Ave" }),
  })));
});

it("fires onApplyAddress with the buyer address when 'use as delivery' is clicked", () => {
  const onApply = vi.fn();
  const buyer = { street1: "12 Willis Ave", city: "Albertson", state: "NY", zip: "11507", country: "US" as const };
  render(<CustomerBlock value={{ ...snap, buyerAddress: buyer }} onChange={() => {}} onApplyAddress={onApply} />);
  fireEvent.click(screen.getByText("buyer_use_as_delivery"));
  expect(onApply).toHaveBeenCalledWith(buyer);
});
```

- [ ] **Step 6: Run — expect PASS**

Run: `npm test -- tests/unit/components/CustomerBlock.test.tsx`
Expected: 2 passing. (If the lookup `useEffect` debounce delays the call, `waitFor` covers it.)

- [ ] **Step 7: Commit**

```bash
git add components/admin/intake/CustomerBlock.tsx components/admin/intake/IntakeForm.tsx tests/unit/components/CustomerBlock.test.tsx
git commit -m "feat(intake): buyer-address capture, pre-fill, and use-as-delivery"
```

> Also commit the i18n message-file change with this task (`git add` the messages file you edited in Step 3).

---

## Task 5: Split `CartSummary` → `CartLines` + `CartTotals` (inline editable totals)

**Files:**
- Create: `components/admin/intake/CartLines.tsx`, `components/admin/intake/CartTotals.tsx`
- Delete: `components/admin/intake/CartSummary.tsx`
- Modify: `components/admin/intake/IntakeForm.tsx`
- Test: `tests/unit/components/CartTotals.test.tsx`; retarget `tests/unit/components/CartSummary.test.tsx`

- [ ] **Step 1: Create `CartLines.tsx`** (the line list, lifted from `CartSummary`)

```tsx
"use client";
import { useLocale } from "next-intl";
import { PRODUCTS } from "@/data/products";
import type { CartLine } from "@/types/order";

function money(cents: number): string { return `$${(cents / 100).toFixed(2)}`; }

export default function CartLines({ lines, onChangeLines }: { lines: CartLine[]; onChangeLines: (l: CartLine[]) => void }) {
  const locale = useLocale() as "en" | "es";
  function removeLine(i: number) { onChangeLines(lines.filter((_, idx) => idx !== i)); }
  return (
    <div className="bg-white border border-mute-100 rounded-2xl px-3.5">
      {lines.length === 0 && <div className="py-4 text-mute-400 text-sm">Sin productos todavía.</div>}
      {lines.map((l, i) => {
        const label = l.kind === "catalog" ? PRODUCTS.find((p) => p.id === l.productId)?.title[locale] ?? l.productId : null;
        const unit = l.kind === "catalog"
          ? PRODUCTS.find((p) => p.id === l.productId)?.variants.find((v) => v.id === l.variantId)?.priceCents ?? 0
          : l.priceCents;
        return (
          <div key={i} className="flex justify-between items-center py-2.5 text-sm border-b border-dashed border-mute-100 last:border-0">
            <span><span className="text-mute-400">{l.qty} ×</span>{" "}
              {l.kind === "catalog" ? label : <em className="not-italic font-display text-rouge italic">{l.title}</em>}
            </span>
            <span className="flex items-center gap-3">
              <span className="tabular-nums">{money(unit * l.qty)}</span>
              <button type="button" onClick={() => removeLine(i)} className="text-mute-400 hover:text-rouge">✕</button>
            </span>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Create `CartTotals.tsx`** (inline-editable totals, no `window.prompt`)

```tsx
"use client";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { PRODUCTS } from "@/data/products";
import { cartSubtotalCents } from "@/lib/cart-helpers";
import { computeOrderTotals, computeDeliveryCentsForAddress } from "@/lib/totals";
import type { CartLine, OrderTotals } from "@/types/order";

type Props = {
  lines: CartLine[];
  fulfillmentMethod: "in-store" | "delivery" | "pickup";
  deliveryZip: string;
  deliveryCity: string;
  override: Partial<OrderTotals>;
  onOverride: (next: Partial<OrderTotals>) => void;
};

function EditableAmount({ cents, computed, onSet, onClear }: { cents: number; computed: number; onSet: (v: number) => void; onClear: () => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const overridden = cents !== computed;
  if (editing) {
    return (
      <input
        autoFocus
        inputMode="decimal"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => { commit(); }}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
        className="w-20 rounded border border-ink/30 px-2 py-0.5 text-right tabular-nums text-sm"
      />
    );
    function commit() {
      const v = Math.round(parseFloat(draft) * 100);
      if (!Number.isNaN(v) && v >= 0) onSet(v);
      setEditing(false);
    }
  }
  return (
    <span className="flex items-center gap-2">
      <button type="button" onClick={() => { setDraft((cents / 100).toFixed(2)); setEditing(true); }} className={`tabular-nums ${overridden ? "text-rouge font-medium" : ""}`}>
        ${(cents / 100).toFixed(2)} <span className="text-mute-400">✎</span>
      </button>
      {overridden && <button type="button" onClick={onClear} className="text-[11px] text-mute-400 hover:text-rouge">↺</button>}
    </span>
  );
}

export default function CartTotals({ lines, fulfillmentMethod, deliveryZip, deliveryCity, override, onOverride }: Props) {
  const t = useTranslations("admin_intake");
  const resolvedDelivery = useMemo(
    () => (fulfillmentMethod === "delivery" ? computeDeliveryCentsForAddress({ zip: deliveryZip, city: deliveryCity }) : 0),
    [fulfillmentMethod, deliveryZip, deliveryCity],
  );
  const computed = useMemo(
    () => computeOrderTotals(cartSubtotalCents(lines, PRODUCTS), resolvedDelivery ?? 0),
    [lines, resolvedDelivery],
  );
  const totals: OrderTotals = {
    subtotalCents: override.subtotalCents ?? computed.subtotalCents,
    deliveryCents: override.deliveryCents ?? computed.deliveryCents,
    taxCents: override.taxCents ?? computed.taxCents,
    totalCents: override.totalCents ?? computed.totalCents,
  };
  const set = (k: keyof OrderTotals) => (v: number) => onOverride({ ...override, [k]: v });
  const clear = (k: keyof OrderTotals) => () => { const n = { ...override }; delete n[k]; onOverride(n); };

  const row = (label: string, k: keyof OrderTotals) => (
    <div className="flex justify-between items-center text-mute-600 py-1">
      <span>{label}</span>
      <EditableAmount cents={totals[k]} computed={computed[k]} onSet={set(k)} onClear={clear(k)} />
    </div>
  );

  return (
    <div className="border-t border-mute-100 pt-3.5 text-sm">
      {row(t("totals_subtotal"), "subtotalCents")}
      {fulfillmentMethod === "delivery" && resolvedDelivery === null && override.deliveryCents === undefined ? (
        <div className="flex justify-between items-center py-1 text-rouge">
          <span>{t("totals_delivery")}</span>
          <EditableAmount cents={0} computed={-1} onSet={set("deliveryCents")} onClear={clear("deliveryCents")} />
        </div>
      ) : row(t("totals_delivery"), "deliveryCents")}
      {row(t("totals_tax"), "taxCents")}
      <div className="flex justify-between items-center border-t border-mute-100 mt-2 pt-2.5 font-display text-base">
        <span>{t("totals_total")}</span>
        <EditableAmount cents={totals.totalCents} computed={computed.totalCents} onSet={set("totalCents")} onClear={clear("totalCents")} />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Write the failing test**

`tests/unit/components/CartTotals.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import CartTotals from "@/components/admin/intake/CartTotals";
import type { CartLine } from "@/types/order";

vi.mock("next-intl", () => ({ useTranslations: () => (k: string) => k, useLocale: () => "es" }));

const lines: CartLine[] = [{ kind: "custom", title: "Ramo", priceCents: 5000, qty: 1 }];

it("edits a total inline (no window.prompt) and clears the override", () => {
  let override = {};
  const onOverride = vi.fn((n) => { override = n; });
  const { rerender } = render(
    <CartTotals lines={lines} fulfillmentMethod="in-store" deliveryZip="" deliveryCity="" override={override} onOverride={onOverride} />,
  );
  // open the subtotal editor, type, commit with Enter
  fireEvent.click(screen.getByText(/\$50\.00/));
  const input = screen.getByDisplayValue("50.00");
  fireEvent.change(input, { target: { value: "60.00" } });
  fireEvent.keyDown(input, { key: "Enter" });
  expect(onOverride).toHaveBeenCalledWith({ subtotalCents: 6000 });

  // with an override applied, a reset control appears
  rerender(<CartTotals lines={lines} fulfillmentMethod="in-store" deliveryZip="" deliveryCity="" override={{ subtotalCents: 6000 }} onOverride={onOverride} />);
  expect(screen.getByText("↺")).toBeInTheDocument();
});
```

- [ ] **Step 4: Run — expect PASS**

Run: `npm test -- tests/unit/components/CartTotals.test.tsx`
Expected: passing.

- [ ] **Step 5: Swap `CartSummary` for the two components in `IntakeForm`**

In `IntakeForm.tsx`, replace the import `import CartSummary from "./CartSummary";` with:

```tsx
import CartLines from "./CartLines";
import CartTotals from "./CartTotals";
```

Replace the single `<CartSummary .../>` usage with `<CartLines lines={lines} onChangeLines={setLines} />` placed in the Productos area and `<CartTotals lines={lines} fulfillmentMethod={fulfillment.method} deliveryZip={fulfillment.address.zip} deliveryCity={fulfillment.address.city} override={override} onOverride={setOverride} />` placed in the Pago area. (Exact card placement is finalized in Task 6; for now place `CartLines` then `CartTotals` where `CartSummary` was.)

- [ ] **Step 6: Delete `CartSummary.tsx` and retarget its test**

```bash
git rm components/admin/intake/CartSummary.tsx
```

Update `tests/unit/components/CartSummary.test.tsx`: rename to `tests/unit/components/CartLines.test.tsx` and point it at `CartLines` (it tests line rendering + removal — keep those assertions, drop any that targeted the prompt-based override Rows, which are now covered by `CartTotals.test.tsx`). If the file only tested line rendering/removal, retarget the import to `@/components/admin/intake/CartLines` and the props `{ lines, onChangeLines }`.

- [ ] **Step 7: Run the cart tests**

Run: `npm test -- tests/unit/components/CartTotals.test.tsx tests/unit/components/CartLines.test.tsx`
Expected: passing.

- [ ] **Step 8: Commit**

```bash
git add components/admin/intake/CartLines.tsx components/admin/intake/CartTotals.tsx components/admin/intake/IntakeForm.tsx tests/unit/components/CartTotals.test.tsx tests/unit/components/CartLines.test.tsx
git rm components/admin/intake/CartSummary.tsx
git commit -m "feat(intake): split cart into CartLines + CartTotals with inline-editable totals"
```

---

## Task 6: `IntakeForm` Direction-B section-card layout

**Files:**
- Modify: `components/admin/intake/IntakeForm.tsx`
- Verify: dev server preview at desktop + iPad width

This task is presentation only — it rearranges the already-wired blocks (`CustomerBlock`, `FulfillmentBlock`, `ProductPicker`, `CartLines`, `CartTotals`, `PaymentBlock`, gift-card input) into four section cards. No data/logic changes.

- [ ] **Step 1: Add a `SectionCard` helper and replace the two-column body**

At the top of `IntakeForm.tsx` (after imports), add a small presentational helper:

```tsx
function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-mute-200 bg-white p-5 mb-4">
      <h2 className="font-display text-lg text-ink mb-4">{title}</h2>
      {children}
    </section>
  );
}
```

Replace the existing `<div className="grid grid-cols-[1.05fr_0.95fr]"> … </div>` (the two `<section>` columns) with a responsive 2-column grid of section cards:

```tsx
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-5 bg-bone">
          <div>
            <SectionCard title={t("section_customer")}>
              <CustomerBlock
                value={customer}
                onChange={setCustomer}
                onApplyAddress={(addr) => setFulfillment((f) => ({ ...f, address: addr, method: "delivery" }))}
              />
            </SectionCard>
            <SectionCard title={t("section_fulfillment")}>
              <FulfillmentBlock value={fulfillment} onChange={setFulfillment} />
            </SectionCard>
          </div>
          <div>
            <SectionCard title={t("section_products")}>
              <ProductPicker products={products} onAdd={addLine} />
              <div className="mt-4"><CartLines lines={lines} onChangeLines={setLines} /></div>
            </SectionCard>
            <SectionCard title={t("section_payment")}>
              <CartTotals
                lines={lines}
                fulfillmentMethod={fulfillment.method}
                deliveryZip={fulfillment.address.zip}
                deliveryCity={fulfillment.address.city}
                override={override}
                onOverride={setOverride}
              />
              <div className="mt-4"><PaymentBlock value={payment} onChange={setPayment} /></div>
              <label className="block mt-4">
                <span className="mb-1 block text-xs font-semibold">{t("gift_card_label")}</span>
                <input value={giftCardCode} onChange={(e) => setGiftCardCode(e.target.value)} placeholder="DIVA-XXXX-XXXX" className="w-full rounded-lg border border-ink/20 px-3 py-2 font-mono" />
              </label>
            </SectionCard>
          </div>
        </div>
```

(Keep the existing header channel-tabs row, the success banner, and the footer Discard/Save row exactly as they are — only the middle two-column body is replaced.)

- [ ] **Step 2: Add the section-title i18n keys**

In the same `admin_intake` messages file, add:

```json
"section_customer": { "en": "Customer", "es": "Cliente" },
"section_fulfillment": { "en": "Recipient & delivery", "es": "Destinatario y entrega" },
"section_products": { "en": "Products", "es": "Productos" },
"section_payment": { "en": "Payment & total", "es": "Pago y total" },
"gift_card_label": { "en": "Gift card", "es": "Gift card" }
```

- [ ] **Step 3: Verify in the dev server (preview)**

Run the worktree dev server and open `/es/admin/intake`. Confirm: four section cards (Cliente with buyer address, Destinatario y entrega with card message, Productos with picker + lines, Pago y total with inline-editable totals + payment + gift card); the buyer-address "usar como dirección de entrega" copies into the delivery address; totals edit inline with no pop-up. Resize to iPad/tablet width and confirm the cards stack (single column) cleanly. Use the preview tooling per the harness verification workflow; if the preview server resolves to the main repo, run the worktree dev server manually (`NODE_OPTIONS='--experimental-sqlite' npx next dev -p 3100` from the worktree) and drive it via curl/screenshot.

- [ ] **Step 4: Run the full intake-related test set**

Run: `npm test -- tests/unit/components/FulfillmentBlock.test.tsx tests/unit/components/CustomerBlock.test.tsx tests/unit/components/CartTotals.test.tsx tests/unit/components/CartLines.test.tsx`
Expected: all passing. Also run any existing `IntakeForm`/intake page test and fix references to the old layout if present.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add components/admin/intake/IntakeForm.tsx
git commit -m "feat(intake): Direction-B section-card layout (responsive, polished)"
```

> Also commit the messages-file change if not already committed.

---

## Final verification

- [ ] **Full suite** — only the 5 documented pre-existing baseline failures may remain:

Run: `npm test`
Expected: all NEW tests pass; the only failures are the 5 known baseline ones. Fix any OTHER failure (likely an intake test referencing the old card-message location or `CartSummary`) before finishing.

- [ ] **Typecheck clean:** `npx tsc --noEmit` → exit 0.

- [ ] Hand to the finishing-a-development-branch skill to open the PR.

---

## Notes for the implementer

- **AGENTS.md**: customized Next.js — prefer in-repo patterns (shown above) over training-data assumptions; consult `node_modules/next/dist/docs/` when unsure.
- **i18n**: every new user-facing string is added to the `admin_intake` namespace in both `en` and `es`. Search for `card_message_label` to find the messages file and match its structure.
- **Buyer address never drives delivery pricing** — only `fulfillment.address` does (via `CartTotals`/`resolveOrderTotals`). The buyer address is for records + reuse + the optional "use as delivery" copy.
- **One source for card message**: after Task 3 it lives only in `FulfillmentBlock`; the intake form and the edit drawer both get it from there.
