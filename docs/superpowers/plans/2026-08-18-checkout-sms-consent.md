# Checkout SMS Consent Checkbox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add an optional, unchecked SMS consent checkbox to the web checkout so customers can opt in to automated texts (order updates + offers), satisfying A2P 10DLC campaign review (which rejected the campaign for "no opt-in for checkout") and gating SMS on real consent.

**Architecture:** A new top-level `smsConsent` boolean on the checkout form persists onto the order (one new SQLite column), and the existing `onWebOrderPaid` hook translates it into the customer's `messagingChannel` (`"sms"` when consented, `"none"` when not) — the field the hook already reserved for exactly this. When `"none"`, `dispatchPaymentConfirmed` returns early, so non-consenters get no automated SMS.

**Tech Stack:** Next.js 16, TypeScript, Zod, react-hook-form, node:sqlite, next-intl, vitest.

**Context — why now:** A2P 10DLC campaign was rejected (error 30909 / CTA verification): the reviewer visited the live checkout and found no opt-in. This checkbox, deployed to production, is what they need to see at the checkout URL. Consent must be unchecked-by-default and optional (not a condition of purchase) per TCR rules 30924/30925.

---

## Before you start

1. `server-only` is aliased in tests (`vitest.config.ts`); DB tests use `vi.stubEnv("SQLITE_FILE", ":memory:")` + `closeDb()`.
2. `npm test` has ~7 pre-existing failures unrelated to this work (Chromium ENOEXEC, `checkout-schema.test.ts` stale-date). Compare against base before blaming your change. Adding an optional-with-default `smsConsent` does NOT change existing `checkout-schema.test.ts` parse results (those payloads omit it → default applies).
3. The consent model (decided): the checkbox gates ALL automated SMS. Checked → `messagingChannel: "sms"`; unchecked → `"none"`. This is intentional and changes prior behavior (order confirmations were sent to all web buyers; now opt-in). Do not "preserve" a prior consent on unchecked — most-recent action wins (compliant).

---

## Task 1: Persist `smsConsent` on the order (data layer)

**Files:**
- Create: `db/migrations/016_order_sms_consent.sql`
- Modify: `types/order.ts` (add field to `Order`)
- Modify: `lib/order-row.ts` (`OrderRow` type + `orderToRow` + `rowToOrder`)
- Modify: `lib/order-storage.ts` (`upsertSqlite` INSERT column list, VALUES, and ON CONFLICT SET)
- Test: `tests/unit/order-row.test.ts` (create if absent; else extend)

- [ ] **Step 1: Write the failing round-trip test**

Create/extend `tests/unit/order-row.test.ts`. If the file exists, append the test inside the existing describe; if not, create it:

```ts
import { describe, it, expect } from "vitest";
import { orderToRow, rowToOrder } from "@/lib/order-row";
import type { Order } from "@/types/order";

const baseOrder: Order = {
  id: "do_test",
  source: "web",
  locale: "en",
  lines: [{ kind: "catalog", productId: "p1", variantId: "v1", addOnIds: [], qty: 1 }],
  fulfillment: {
    method: "pickup",
    recipient: { name: "Ana", phone: "5165550100" },
    window: { date: "2099-07-01", slot: "midday" },
  },
  contact: { email: "a@x.com", phone: "5165550100" },
  totals: { subtotalCents: 5000, deliveryCents: 0, taxCents: 431, totalCents: 5431 },
  status: "pending",
  paymentStatus: "pending",
  createdAt: "2026-08-18T00:00:00Z",
  updatedAt: "2026-08-18T00:00:00Z",
};

describe("order-row smsConsent", () => {
  it("round-trips smsConsent true", () => {
    const row = orderToRow({ ...baseOrder, smsConsent: true });
    expect(row.sms_consent).toBe(1);
    expect(rowToOrder(row).smsConsent).toBe(true);
  });
  it("round-trips smsConsent false / absent as false", () => {
    expect(orderToRow(baseOrder).sms_consent).toBe(0);
    expect(rowToOrder(orderToRow(baseOrder)).smsConsent).toBe(false);
  });
});
```

- [ ] **Step 2: Run it — expect failure**

```bash
npm test -- tests/unit/order-row.test.ts
```
Expected: FAIL — `sms_consent` / `smsConsent` don't exist yet (type errors / undefined).

- [ ] **Step 3: Add the migration**

Create `db/migrations/016_order_sms_consent.sql`:

```sql
-- 016_order_sms_consent.sql — records whether the buyer opted in to automated
-- SMS (order updates + marketing) at web checkout. 0 = no consent (default).
ALTER TABLE orders ADD COLUMN sms_consent INTEGER NOT NULL DEFAULT 0;
```

- [ ] **Step 4: Add the field to the Order type**

In `types/order.ts`, add to the `Order` type (near `internalNotes`):

```ts
  /** Buyer opted in to automated SMS (order + marketing) at web checkout. */
  smsConsent?: boolean;
```

- [ ] **Step 5: Map it in order-row.ts**

In `lib/order-row.ts`:
- Add to `OrderRow` type: `sms_consent: number;` (place it near `internal_notes`).
- In `orderToRow`, add: `sms_consent: o.smsConsent ? 1 : 0,`
- In `rowToOrder`, add to the returned object: `smsConsent: r.sms_consent === 1,`

- [ ] **Step 6: Include the column in order-storage upsert**

In `lib/order-storage.ts`, in `upsertSqlite`'s SQL:
- Add `sms_consent` to the INSERT column list (next to `internal_notes`).
- Add `@sms_consent` to the VALUES list in the SAME position.
- Add `sms_consent=excluded.sms_consent,` to the `ON CONFLICT(id) DO UPDATE SET` list.

(The bound object comes from `orderToRow`, which now has `sms_consent` — no other change needed there.)

- [ ] **Step 7: Run it — expect pass + typecheck**

```bash
npm test -- tests/unit/order-row.test.ts
npx tsc --noEmit
```
Expected: PASS, clean.

- [ ] **Step 8: Commit**

```bash
git add db/migrations/016_order_sms_consent.sql types/order.ts lib/order-row.ts lib/order-storage.ts tests/unit/order-row.test.ts
git commit -m "feat(checkout): persist sms consent on the order"
```

---

## Task 2: Capture consent in the form + wire it to the messaging channel

**Files:**
- Modify: `schemas/checkout.ts` (add top-level `smsConsent`)
- Modify: `app/api/checkout/intent/route.ts` (set `order.smsConsent`)
- Modify: `lib/on-web-order-paid.ts` (set `messagingChannel` from `order.smsConsent`)
- Test: extend `tests/unit/checkout-schema.test.ts` and `tests/unit/on-web-order-paid.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `tests/unit/checkout-schema.test.ts` (inside the existing describe):

```ts
  it("defaults smsConsent to false when omitted", () => {
    const base = {
      contact: { email: "a@x.com", phone: "5165550100" },
      delivery: {
        method: "pickup",
        recipient: { name: "Ana", phone: "5165550100" },
        window: { date: "2099-07-01", slot: "midday" },
      },
    };
    const parsed = checkoutSchema.parse(base);
    expect(parsed.smsConsent).toBe(false);
  });

  it("accepts smsConsent true", () => {
    const base = {
      smsConsent: true,
      contact: { email: "a@x.com", phone: "5165550100" },
      delivery: {
        method: "pickup",
        recipient: { name: "Ana", phone: "5165550100" },
        window: { date: "2099-07-01", slot: "midday" },
      },
    };
    expect(checkoutSchema.parse(base).smsConsent).toBe(true);
  });
```

(If `checkoutSchema` isn't imported at the top of that test file, add `import { checkoutSchema } from "@/schemas/checkout";`.)

Append to `tests/unit/on-web-order-paid.test.ts` (it already mocks `@/lib/customer-storage`, `@/lib/order-storage`, `@/lib/order-dispatch`; `getOrderMock`/`upsertOnOrderMock` exist):

```ts
  it("opts the customer into SMS when the order has consent", async () => {
    getOrderMock.mockResolvedValue({ ...ORDER, smsConsent: true });
    await onWebOrderPaid("do_1");
    expect(upsertOnOrderMock).toHaveBeenCalledWith(
      expect.objectContaining({ messagingChannel: "sms" }),
    );
  });

  it("sets channel to none when the order has no consent", async () => {
    getOrderMock.mockResolvedValue({ ...ORDER, smsConsent: false });
    await onWebOrderPaid("do_1");
    expect(upsertOnOrderMock).toHaveBeenCalledWith(
      expect.objectContaining({ messagingChannel: "none" }),
    );
  });
```

- [ ] **Step 2: Run them — expect failure**

```bash
npm test -- tests/unit/checkout-schema.test.ts tests/unit/on-web-order-paid.test.ts
```
Expected: the new tests FAIL (schema has no `smsConsent`; hook passes no `messagingChannel`). Note `checkout-schema.test.ts` also has ~3 pre-existing stale-date failures — ignore those, only your 2 new ones matter here.

- [ ] **Step 3: Add `smsConsent` to the checkout schema**

In `schemas/checkout.ts`, add a third top-level key to `checkoutSchema` (a TOP-LEVEL field, not inside `contact` — keeps `order.contact` clean):

```ts
export const checkoutSchema = z.object({
  contact: z.object({
    email: z.string().email("email_invalid"),
    phone,
  }),
  delivery: z.discriminatedUnion("method", [deliveryFulfillment, pickupFulfillment]),
  smsConsent: z.boolean().optional().default(false),
});
```

- [ ] **Step 4: Set `order.smsConsent` in the intent route**

In `app/api/checkout/intent/route.ts`, in the `const order: Order = { ... }` literal (the one with `contact: form.contact`), add:

```ts
    smsConsent: form.smsConsent,
```

`form` is `parsed.data.form` (already destructured as `form` in that route). It's `boolean` after zod's default.

- [ ] **Step 5: Wire consent → channel in the hook**

In `lib/on-web-order-paid.ts`, in the `upsertOnOrder({ ... })` call, replace the `// messagingChannel is deliberately unset ...` comment with:

```ts
      // Consent decides the channel: opted in → SMS (confirmation + marketing
      // eligible); not opted in → none, so dispatchPaymentConfirmed sends nothing.
      messagingChannel: order.smsConsent ? "sms" : "none",
```

- [ ] **Step 6: Run tests + typecheck**

```bash
npm test -- tests/unit/checkout-schema.test.ts tests/unit/on-web-order-paid.test.ts
npx tsc --noEmit
```
Expected: your new tests PASS (checkout-schema's pre-existing stale-date failures remain, unrelated); tsc clean.

- [ ] **Step 7: Check the intent route tests didn't regress**

```bash
npm test -- tests/unit/api-checkout-intent.test.ts tests/unit/checkout-intent-gift-card.test.ts
```
If any test does full-object equality on the saved order and now fails because of the new `smsConsent` field, add `smsConsent: false` (or the expected value) to that expected object. If they pass, do nothing.

- [ ] **Step 8: Commit**

```bash
git add schemas/checkout.ts app/api/checkout/intent/route.ts lib/on-web-order-paid.ts tests/unit/checkout-schema.test.ts tests/unit/on-web-order-paid.test.ts
git commit -m "feat(checkout): capture sms consent and gate the messaging channel on it"
```

---

## Task 3: The consent checkbox UI

**Files:**
- Modify: `components/checkout/ContactStep.tsx` (render the checkbox)
- Modify: `components/checkout/CheckoutShell.tsx` (add `smsConsent: false` to form defaultValues)
- Modify: `messages/en.json`, `messages/es.json` (`checkout` section)
- Test: `tests/unit/ContactStep.test.tsx` (create)

- [ ] **Step 1: Add the i18n keys**

In `messages/en.json`, under `checkout`, add:

```json
    "consent_label": "Text me about my order & offers",
    "consent_fine": "Optional. By checking this, you agree to receive recurring automated order and marketing text messages from Diva Flowers at this number. Consent is not a condition of purchase. Msg & data rates may apply. Message frequency varies. Reply STOP to cancel, HELP for help.",
    "consent_terms": "Terms",
    "consent_privacy": "Privacy Policy"
```

In `messages/es.json`, under `checkout`:

```json
    "consent_label": "Envíenme textos sobre mi pedido y ofertas",
    "consent_fine": "Opcional. Al marcar, aceptas recibir mensajes de texto automatizados y recurrentes sobre tu pedido y de marketing de Diva Flowers a este número. El consentimiento no es condición de compra. Pueden aplicar tarifas de mensajes y datos. La frecuencia varía. Responde STOP para cancelar, HELP para ayuda.",
    "consent_terms": "Términos",
    "consent_privacy": "Política de Privacidad"
```

After editing, verify both parse: `node -e "require('./messages/en.json'); require('./messages/es.json'); console.log('json ok')"`.

- [ ] **Step 2: Write the failing component test**

Create `tests/unit/ContactStep.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { NextIntlClientProvider } from "next-intl";
import esMessages from "@/messages/es.json";
import { ContactStep } from "@/components/checkout/ContactStep";
import type { CheckoutInput } from "@/schemas/checkout";

function Harness() {
  const form = useForm<CheckoutInput>({
    defaultValues: {
      contact: { email: "", phone: "" },
      smsConsent: false,
    } as CheckoutInput,
  });
  return <ContactStep form={form} />;
}

describe("ContactStep consent", () => {
  it("renders an unchecked, optional sms consent checkbox with disclosure", () => {
    render(
      <NextIntlClientProvider locale="es" messages={esMessages as Record<string, unknown>}>
        <Harness />
      </NextIntlClientProvider>,
    );
    const box = screen.getByRole("checkbox");
    expect((box as HTMLInputElement).checked).toBe(false);
    expect(screen.getByText(/Envíenme textos/)).toBeDefined();
    expect(screen.getByText(/Responde STOP/)).toBeDefined();
  });
});
```

- [ ] **Step 3: Run it — expect failure**

```bash
npm test -- tests/unit/ContactStep.test.tsx
```
Expected: FAIL — no checkbox rendered yet.

- [ ] **Step 4: Render the checkbox in ContactStep**

In `components/checkout/ContactStep.tsx`:
- Add `useLocale` to the next-intl import: `import { useTranslations, useLocale } from "next-intl";`
- Inside the component, add `const locale = useLocale();`
- After the phone `FormField` (still inside the `.space-y-5` wrapper `<div>`), add:

```tsx
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          className="mt-1 h-5 w-5 shrink-0 accent-rouge"
          {...register("smsConsent")}
        />
        <span className="text-sm text-ink">
          <span className="font-medium">{t("consent_label")}</span>
          <span className="mt-1 block text-xs text-ink/60">{t("consent_fine")}</span>
          <span className="mt-1 block text-xs">
            <a href={`/${locale}/legal/terms`} target="_blank" rel="noopener noreferrer" className="underline">
              {t("consent_terms")}
            </a>
            {" · "}
            <a href={`/${locale}/legal/privacy`} target="_blank" rel="noopener noreferrer" className="underline">
              {t("consent_privacy")}
            </a>
          </span>
        </span>
      </label>
```

- [ ] **Step 5: Add the form default**

In `components/checkout/CheckoutShell.tsx`, in the `useForm({ ... defaultValues: { ... } })` block, add `smsConsent: false,` alongside `contact` (top level of defaultValues). This keeps the checkbox controlled from first render.

- [ ] **Step 6: Run the test + typecheck**

```bash
npm test -- tests/unit/ContactStep.test.tsx
npx tsc --noEmit
```
Expected: PASS, clean.

- [ ] **Step 7: Commit**

```bash
git add components/checkout/ContactStep.tsx components/checkout/CheckoutShell.tsx messages/en.json messages/es.json tests/unit/ContactStep.test.tsx
git commit -m "feat(checkout): sms consent checkbox in the contact step"
```

---

## Task 4: Full verification

- [ ] **Step 1: Typecheck** — `npx tsc --noEmit` (clean).
- [ ] **Step 2: Feature tests** — run all touched test files together; all green:
```bash
npm test -- tests/unit/order-row.test.ts tests/unit/checkout-schema.test.ts tests/unit/on-web-order-paid.test.ts tests/unit/ContactStep.test.tsx tests/unit/api-checkout-intent.test.ts tests/unit/checkout-intent-gift-card.test.ts
```
(Note: `checkout-schema.test.ts` carries pre-existing stale-date failures; confirm ONLY those known ones fail and your new `smsConsent` tests pass.)
- [ ] **Step 3: No new failures vs baseline** — `npm test 2>&1 | tail -40`; list failing files; confirm each is a known baseline failure (print-chromium / print-render / _preview / checkout-schema) and none is a file this feature touched other than checkout-schema's pre-existing date failures.
- [ ] **Step 4: Build** — `npm run build` succeeds.
- [ ] **Step 5: Browser smoke** — start dev server, open `/es/checkout` (or the checkout route), confirm the unchecked consent checkbox renders below the phone field with the disclosure and Terms/Privacy links, and that the box is NOT checked by default. Confirm you can proceed past the contact step without checking it.
- [ ] **Step 6: Tree clean** — `git status` clean apart from pre-existing untracked dirs.

---

## Deploy (owner-run, after merge)

This MUST reach production (makythedivaflowers.com) for the A2P reviewer to see it. After merge + push: deploy to Hostinger and purge the CDN. Then resubmit the campaign, giving the reviewer the exact checkout URL where the checkbox appears.

## Notes / out of scope

- Marketing SENDING (broadcasts, birthday campaigns) is still future work — this only CAPTURES consent (`messagingChannel: "sms"`) so the audience starts accumulating now.
- The privacy policy SMS clause (a separate reviewer check, error 30908) is not in this plan — worth adding before resubmit; the checkout links to `/legal/privacy` and `/legal/terms`, which already exist.
- Behavioral change: web order confirmations are now opt-in (only consenters get them). Intake (in-store) orders are unaffected — they set `messagingChannel` from the intake form.
