# Pickup vs. Delivery — Checkout Fulfillment Toggle

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let customers choose between **Delivery** and **Pickup at our Willis Ave shop** in checkout. Pickup waives the delivery fee, hides the recipient address, and shows the shop's address on the confirmation page and in the owner's notification email.

**Architecture:** Fulfillment is a **cart-level** decision, so the toggle lives at the top of the existing Delivery step in [components/checkout/CheckoutShell.tsx](components/checkout/CheckoutShell.tsx). The Zod schema gets a discriminated union on a new `delivery.method: "delivery" | "pickup"` field — `address` is only required when `method === "delivery"`. When `method === "pickup"`: `deliveryCents = 0`, the ZIP zone check is skipped in the API route, the address fields are hidden in the UI, and the owner email + confirmation page render the shop address (`SITE.address`) instead of a recipient address. Default value is `"delivery"` so existing flows keep working.

**Tech Stack:** Next.js (App Router), TypeScript, Zod, react-hook-form, next-intl (en/es), Tailwind, Vitest, existing `RadioChips` UI primitive, `SITE` constants from [data/site.ts](data/site.ts).

---

## File Structure

| File | Change | Responsibility |
|---|---|---|
| [schemas/checkout.ts](schemas/checkout.ts) | Modify | Discriminated union on `delivery.method`; address conditional on `method === "delivery"`. |
| [types/order.ts](types/order.ts) | Modify | Mirror the discriminated union on `Order.delivery`. |
| [app/api/checkout/intent/route.ts](app/api/checkout/intent/route.ts) | Modify | Skip ZIP zone check + force `deliveryCents = 0` when `method === "pickup"`; persist `method` on the order. |
| [components/checkout/CheckoutShell.tsx](components/checkout/CheckoutShell.tsx) | Modify | Default `delivery.method = "delivery"`; conditional `nextFrom` field list; compute totals based on method. |
| [components/checkout/DeliveryStep.tsx](components/checkout/DeliveryStep.tsx) | Modify | Render `RadioChips` toggle at top; conditionally hide address fields and show pickup info card. |
| [components/checkout/OrderSummaryPanel.tsx](components/checkout/OrderSummaryPanel.tsx) | Modify | Render "Pickup — Free" line when method is pickup. |
| [components/checkout/ConfirmationView.tsx](components/checkout/ConfirmationView.tsx) | Modify | Branch on `order.delivery.method`; render shop address card for pickup. |
| [lib/order-notifications.ts](lib/order-notifications.ts) | Modify | Branch in `buildBody`: render `PICK UP AT SHOP` block for pickup. |
| [messages/en.json](messages/en.json) | Modify | New `checkout.fulfillment_*`, `checkout.pickup_*`, `confirmation.pickup_*` keys. |
| [messages/es.json](messages/es.json) | Modify | Same keys, Spanish copy. |
| [tests/unit/checkout-schema.test.ts](tests/unit/checkout-schema.test.ts) | Modify | New cases: pickup-without-address valid; delivery-without-address invalid. |
| [tests/unit/api-checkout-intent.test.ts](tests/unit/api-checkout-intent.test.ts) | Modify | New cases: pickup skips ZIP check; pickup forces `deliveryCents = 0`. |
| [tests/unit/order-notifications.test.ts](tests/unit/order-notifications.test.ts) | Create | Snapshot the email body for both methods. |

---

## Task 1: Schema — discriminated union on `delivery.method`

**Files:**
- Modify: `schemas/checkout.ts`
- Test: `tests/unit/checkout-schema.test.ts`

- [ ] **Step 1: Add failing tests for pickup-valid-without-address and delivery-requires-address**

Append these cases inside the `describe("checkoutSchema", () => { ... })` block in `tests/unit/checkout-schema.test.ts`. The existing `valid` fixture must be updated to include `method: "delivery" as const` — do that in the same edit:

```ts
// At the top, update the existing `valid` fixture:
const valid = {
  contact: { email: "lola@example.com", phone: "5164843456" },
  delivery: {
    method: "delivery" as const,
    recipient: { name: "Lola Cardona", phone: "5165550101" },
    address: { street1: "1077 Hempstead Tpke", city: "Franklin Square", state: "NY", zip: "11010", country: "US" as const },
    window: { date: "2026-05-15", slot: "midday" as const },
    cardMessage: "Happy birthday",
  },
};

// Add these new tests at the bottom of the describe block:
it("accepts a pickup payload without address", () => {
  const pickup = {
    contact: valid.contact,
    delivery: {
      method: "pickup" as const,
      recipient: { name: "Lola Cardona", phone: "5165550101" },
      window: { date: "2026-05-15", slot: "midday" as const },
      cardMessage: "",
    },
  };
  expect(checkoutSchema.safeParse(pickup).success).toBe(true);
});

it("rejects a delivery payload missing address", () => {
  const bad = {
    contact: valid.contact,
    delivery: {
      method: "delivery" as const,
      recipient: valid.delivery.recipient,
      // address omitted
      window: valid.delivery.window,
      cardMessage: "",
    },
  };
  expect(checkoutSchema.safeParse(bad).success).toBe(false);
});

it("accepts pickup payload with extra address key (zod strips unknowns by default)", () => {
  // Defensive: even if an old client sends an address alongside method=pickup, parsing succeeds (address is stripped).
  const ambiguous = {
    contact: valid.contact,
    delivery: {
      method: "pickup" as const,
      recipient: valid.delivery.recipient,
      window: valid.delivery.window,
      cardMessage: "",
      address: { street1: "", city: "", state: "", zip: "", country: "US" },
    },
  };
  expect(checkoutSchema.safeParse(ambiguous).success).toBe(true);
});
```

- [ ] **Step 2: Run the tests to verify the new ones fail**

Run: `pnpm vitest run tests/unit/checkout-schema.test.ts`
Expected: 3 of 9 cases FAIL — the new pickup case (no address), the delivery-missing-address case, and the existing happy-path case (now broken because `valid` no longer matches the schema).

- [ ] **Step 3: Replace the schema with a discriminated union**

Replace the body of `schemas/checkout.ts` with:

```ts
// schemas/checkout.ts
import { z } from "zod";

const phone = z
  .string()
  .transform((s) => s.replace(/\D/g, ""))
  .pipe(z.string().min(10, "phone_too_short").max(15));

const zip = z.string().regex(/^\d{5}(-\d{4})?$/, "zip_invalid");

const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "date_invalid")
  .refine((s) => {
    const d = new Date(s + "T00:00:00");
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return d.getTime() >= today.getTime();
  }, "date_in_past");

const recipient = z.object({
  name: z.string().min(2, "name_too_short").max(80),
  phone,
});

const address = z.object({
  street1: z.string().min(3, "street_required").max(120),
  street2: z.string().max(120).optional().or(z.literal("")),
  city: z.string().min(2, "city_required").max(80),
  state: z.string().length(2, "state_invalid"),
  zip,
  country: z.literal("US"),
});

const window = z.object({
  date,
  slot: z.enum(["morning", "midday", "afternoon", "evening"]),
});

const cardMessage = z.string().max(200, "card_too_long").optional().or(z.literal(""));

const deliveryFulfillment = z.object({
  method: z.literal("delivery"),
  recipient,
  address,
  window,
  cardMessage,
});

const pickupFulfillment = z.object({
  method: z.literal("pickup"),
  recipient,
  window,
  cardMessage,
});

export const checkoutSchema = z.object({
  contact: z.object({
    email: z.string().email("email_invalid"),
    phone,
  }),
  delivery: z.discriminatedUnion("method", [deliveryFulfillment, pickupFulfillment]),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;
```

- [ ] **Step 4: Run schema tests to verify all pass**

Run: `pnpm vitest run tests/unit/checkout-schema.test.ts`
Expected: 9 PASS.

- [ ] **Step 5: Commit**

```bash
git add schemas/checkout.ts tests/unit/checkout-schema.test.ts
git commit -m "feat(checkout): discriminate delivery vs pickup in checkout schema"
```

---

## Task 2: Mirror the union on `Order.delivery`

**Files:**
- Modify: `types/order.ts`

- [ ] **Step 1: Replace the `Order` type definition**

In `types/order.ts`, replace the existing `Order` type with:

```ts
export type DeliveryFulfillment = {
  method: "delivery";
  recipient: Recipient;
  address: Address;
  window: DeliveryWindow;
  cardMessage?: string;
};

export type PickupFulfillment = {
  method: "pickup";
  recipient: Recipient;
  window: DeliveryWindow;
  cardMessage?: string;
};

export type OrderFulfillment = DeliveryFulfillment | PickupFulfillment;

export type Order = {
  id: string;
  locale: "en" | "es";
  lines: CartLine[];
  delivery: OrderFulfillment;
  contact: {
    email: string;
    phone: string;
  };
  totals: OrderTotals;
  stripePaymentIntentId?: string;
  status: OrderStatus;
  createdAt: string; // ISO
};
```

- [ ] **Step 2: Run typecheck to surface every consumer that needs updating**

Run: `pnpm tsc --noEmit`
Expected: errors at the consumers we'll fix in later tasks (`app/api/checkout/intent/route.ts`, `lib/order-notifications.ts`, `components/checkout/ConfirmationView.tsx`, `components/checkout/CheckoutShell.tsx`, `app/api/stripe/webhook/route.ts` and similar). Note them. Do NOT commit yet — the type errors will be resolved across the next tasks.

---

## Task 3: API route — skip ZIP for pickup, persist `method`

**Files:**
- Modify: `app/api/checkout/intent/route.ts`
- Test: `tests/unit/api-checkout-intent.test.ts`

- [ ] **Step 1: Add failing tests for pickup behavior**

Append inside the `describe("POST /api/checkout/intent", ...)` block in `tests/unit/api-checkout-intent.test.ts`:

```ts
it("returns 200 for pickup orders without an address", async () => {
  createPI.mockResolvedValue({ id: "pi_pickup_1", client_secret: "pi_pickup_1_secret" });
  const { POST } = await import("@/app/api/checkout/intent/route");
  const res = await POST(makeReq({
    locale: "en",
    lines: validBody.lines,
    form: {
      contact: validBody.form.contact,
      delivery: {
        method: "pickup",
        recipient: validBody.form.delivery.recipient,
        window: validBody.form.delivery.window,
        cardMessage: "",
      },
    },
  }));
  expect(res.status).toBe(200);
  const json = await res.json();
  expect(json.clientSecret).toBe("pi_pickup_1_secret");
});

it("forces deliveryCents to 0 for pickup orders", async () => {
  createPI.mockResolvedValue({ id: "pi_pickup_2", client_secret: "pi_pickup_2_secret" });
  const { POST } = await import("@/app/api/checkout/intent/route");
  await POST(makeReq({
    locale: "en",
    lines: validBody.lines,
    form: {
      contact: validBody.form.contact,
      delivery: {
        method: "pickup",
        recipient: validBody.form.delivery.recipient,
        window: validBody.form.delivery.window,
        cardMessage: "",
      },
    },
  }));
  // The product is $191 (p-arr-m01 standard). Pickup => no delivery fee.
  // Tax is 8.625% of (subtotal + delivery).
  // Expected total: 19100 + 0 + round(19100 * 0.08625) = 19100 + 1648 = 20748
  const [params] = createPI.mock.calls[0];
  expect(params.amount).toBe(20748);
});

it("ignores zip_not_in_zone for pickup orders even if address-shaped data is sent", async () => {
  createPI.mockResolvedValue({ id: "pi_pickup_3", client_secret: "pi_pickup_3_secret" });
  const { POST } = await import("@/app/api/checkout/intent/route");
  const res = await POST(makeReq({
    locale: "en",
    lines: validBody.lines,
    form: {
      contact: validBody.form.contact,
      delivery: {
        method: "pickup",
        recipient: validBody.form.delivery.recipient,
        window: validBody.form.delivery.window,
        cardMessage: "",
      },
    },
  }));
  expect(res.status).toBe(200);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run tests/unit/api-checkout-intent.test.ts`
Expected: the 3 new tests FAIL with parse-related 400s.

- [ ] **Step 3: Update the route to branch on method**

Replace the relevant section of `app/api/checkout/intent/route.ts` (everything from `const { locale, lines, form } = parsed.data;` through `await saveOrder(order);`) with:

```ts
  const { locale, lines, form } = parsed.data;

  const subtotal = cartSubtotalCents(lines as CartLine[], PRODUCTS);
  if (subtotal <= 0) {
    return NextResponse.json(
      { errors: { formErrors: ["cart_empty"] } },
      { status: 400 },
    );
  }

  let deliveryCents = 0;
  if (form.delivery.method === "delivery") {
    const fee = computeDeliveryCentsForZip(form.delivery.address.zip);
    if (fee === null) {
      return NextResponse.json(
        { errors: { formErrors: ["zip_not_in_zone"] } },
        { status: 400 },
      );
    }
    deliveryCents = fee;
  }

  const totals = computeOrderTotals(subtotal, deliveryCents);
  const orderId = `do_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  const fulfillment =
    form.delivery.method === "delivery"
      ? {
          method: "delivery" as const,
          recipient: form.delivery.recipient,
          address: form.delivery.address,
          window: form.delivery.window,
          cardMessage: form.delivery.cardMessage || undefined,
        }
      : {
          method: "pickup" as const,
          recipient: form.delivery.recipient,
          window: form.delivery.window,
          cardMessage: form.delivery.cardMessage || undefined,
        };

  const order: Order = {
    id: orderId,
    locale,
    lines: lines as CartLine[],
    delivery: fulfillment,
    contact: form.contact,
    totals,
    status: "pending",
    createdAt: new Date().toISOString(),
  };

  try {
    await saveOrder(order);
  } catch (e) {
    console.error("[stripe] saveOrder failed", e);
    return NextResponse.json(
      { errors: { formErrors: ["unknown_error"] } },
      { status: 500 },
    );
  }
```

Also update the Stripe metadata so we can disambiguate in the webhook:

```ts
        metadata: { orderId, locale, fulfillmentMethod: fulfillment.method },
```

(Replace the existing `metadata: { orderId, locale },` line with the line above.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run tests/unit/api-checkout-intent.test.ts`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/checkout/intent/route.ts tests/unit/api-checkout-intent.test.ts types/order.ts
git commit -m "feat(checkout): pickup orders skip zip check and waive delivery fee"
```

---

## Task 4: CheckoutShell — defaults, totals, conditional field validation

**Files:**
- Modify: `components/checkout/CheckoutShell.tsx`

- [ ] **Step 1: Update form defaults to include `method: "delivery"`**

In `components/checkout/CheckoutShell.tsx`, in the `useForm` call, replace `delivery: { ... }` with:

```ts
      delivery: {
        method: "delivery",
        recipient: { name: "", phone: "" },
        address: { street1: "", street2: "", city: "", state: "NY", zip: "", country: "US" },
        window: { date: "", slot: "midday" },
        cardMessage: "",
      },
```

- [ ] **Step 2: Compute totals based on method**

Replace the block that defines `zipValue`, `deliveryCents`, `deliveryPending`, and `totals` with:

```ts
  const method = form.watch("delivery.method");
  const zipValue = form.watch("delivery.address.zip");
  const isPickup = method === "pickup";
  const zipFee = isPickup ? 0 : computeDeliveryCentsForZip(zipValue ?? "");
  const deliveryCents = isPickup ? 0 : zipFee;
  const deliveryPending = !isPickup && zipFee === null;
  const totals = useMemo(
    () => computeOrderTotals(subtotal, isPickup ? 0 : (zipFee ?? 0)),
    [subtotal, zipFee, isPickup],
  );
```

(The `useEffect` that recreates the PaymentIntent when `totals.totalCents` changes already depends on `totals.totalCents`, so toggling pickup will recreate the intent automatically.)

- [ ] **Step 3: Conditional field list in `nextFrom("delivery")`**

Replace the `delivery: [ ... ]` entry inside `const fields` with:

```ts
      delivery: isPickup
        ? [
            "delivery.method",
            "delivery.recipient.name",
            "delivery.recipient.phone",
            "delivery.window.date",
            "delivery.window.slot",
            "delivery.cardMessage",
          ]
        : [
            "delivery.method",
            "delivery.recipient.name",
            "delivery.recipient.phone",
            "delivery.address.street1",
            "delivery.address.city",
            "delivery.address.state",
            "delivery.address.zip",
            "delivery.window.date",
            "delivery.window.slot",
            "delivery.cardMessage",
          ],
```

- [ ] **Step 4: Pass `isPickup` to `OrderSummaryPanel`**

Replace the `OrderSummaryPanel` JSX with:

```tsx
    <OrderSummaryPanel
      items={resolved.map((r) => ({
        id: `${r.line.productId}-${r.line.variantId}`,
        name: r.product.title[locale],
        image: r.product.images[0].src,
        price: r.variant.priceCents,
        qty: r.line.qty,
      }))}
      subtotal={totals.subtotalCents}
      delivery={totals.deliveryCents}
      total={totals.totalCents}
      deliveryPending={deliveryPending}
      isPickup={isPickup}
      locale={locale}
      eyebrow={t("summary")}
    />
```

- [ ] **Step 5: Verify the file typechecks**

Run: `pnpm tsc --noEmit components/checkout/CheckoutShell.tsx`
(If the project setup doesn't allow per-file tsc, run `pnpm tsc --noEmit` and confirm no new errors in `CheckoutShell.tsx`.)
Expected: no new errors in this file. (Errors in `OrderSummaryPanel.tsx`, `DeliveryStep.tsx`, etc. are expected — fixed in later tasks.)

---

## Task 5: DeliveryStep — toggle + conditional fields + pickup info card

**Files:**
- Modify: `components/checkout/DeliveryStep.tsx`

- [ ] **Step 1: Replace the component body**

Replace the entire contents of `components/checkout/DeliveryStep.tsx` with:

```tsx
// components/checkout/DeliveryStep.tsx
"use client";
import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { UseFormReturn } from "react-hook-form";
import { FormField } from "@/components/ui/form/FormField";
import { TextInput } from "@/components/ui/form/TextInput";
import { DateInput } from "@/components/ui/form/DateInput";
import { RadioChips } from "@/components/ui/form/RadioChips";
import type { CheckoutInput } from "@/schemas/checkout";
import { trackDeliveryDateSelected } from "@/lib/analytics";
import { SITE } from "@/data/site";

const SLOTS = ["morning", "midday", "afternoon", "evening"] as const;

export function DeliveryStep({ form }: { form: UseFormReturn<CheckoutInput> }) {
  const t = useTranslations("checkout");
  const { register, formState, watch, setValue } = form;
  const min = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today.toISOString().slice(0, 10);
  }, []);
  const method = watch("delivery.method");
  const isPickup = method === "pickup";
  const errors = formState.errors.delivery;
  const addressErrors = !isPickup ? (errors as { address?: Record<string, { message?: string }> } | undefined)?.address : undefined;
  const recipientErrors = (errors as { recipient?: { name?: { message?: string }; phone?: { message?: string } } } | undefined)?.recipient;
  const windowErrors = (errors as { window?: { date?: { message?: string }; slot?: { message?: string } } } | undefined)?.window;
  const selectedSlot = watch("delivery.window.slot");
  const slotItems = SLOTS.map((s) => ({ value: s, label: t(`slot_${s}`) }));

  return (
    <div className="space-y-6 max-w-md">
      <input type="hidden" {...register("delivery.method")} />
      <FormField label={t("fulfillment_label")} htmlFor="ck-fulfillment">
        <RadioChips
          name="delivery.method"
          items={[
            { value: "delivery", label: t("fulfillment_delivery") },
            { value: "pickup", label: t("fulfillment_pickup") },
          ]}
          value={method ?? "delivery"}
          onChange={(v) => setValue("delivery.method", v as "delivery" | "pickup", { shouldValidate: true })}
          cols={2}
        />
      </FormField>

      <div className="grid sm:grid-cols-2 gap-5">
        <FormField label={t("recipient_name")} htmlFor="ck-rname" required
          error={recipientErrors?.name ? t("errors.name_too_short") : undefined}>
          <TextInput id="ck-rname" aria-invalid={!!recipientErrors?.name || undefined} {...register("delivery.recipient.name")} />
        </FormField>
        <FormField label={t("recipient_phone")} htmlFor="ck-rphone" required
          error={recipientErrors?.phone ? t("errors.phone_too_short") : undefined}>
          <TextInput id="ck-rphone" type="tel" inputMode="tel"
            aria-invalid={!!recipientErrors?.phone || undefined} {...register("delivery.recipient.phone")} />
        </FormField>
      </div>

      {isPickup ? (
        <div className="rounded-2xl border border-ink/10 bg-bone/60 p-5 space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
            {t("pickup_at")}
          </p>
          <p className="font-display text-lg text-ink">
            {SITE.brand}
          </p>
          <p className="text-sm text-ink/80">
            {SITE.address.line1}<br />
            {SITE.address.locality}, {SITE.address.region} {SITE.address.postal}
          </p>
          <ul className="font-mono text-[11px] text-ink/65 mt-2 space-y-0.5">
            {SITE.hours.map((h) => (
              <li key={h.day}>{h.day} · {h.value}</li>
            ))}
          </ul>
        </div>
      ) : (
        <>
          <FormField label={t("address_street1")} htmlFor="ck-street1" required
            error={addressErrors?.street1 ? t("errors.street_required") : undefined}>
            <TextInput id="ck-street1" autoComplete="address-line1"
              aria-invalid={!!addressErrors?.street1 || undefined} {...register("delivery.address.street1")} />
          </FormField>
          <FormField label={t("address_street2")} htmlFor="ck-street2">
            <TextInput id="ck-street2" autoComplete="address-line2" {...register("delivery.address.street2")} />
          </FormField>
          <div className="grid sm:grid-cols-3 gap-5">
            <FormField label={t("address_city")} htmlFor="ck-city" required
              error={addressErrors?.city ? t("errors.city_required") : undefined}>
              <TextInput id="ck-city" autoComplete="address-level2"
                aria-invalid={!!addressErrors?.city || undefined} {...register("delivery.address.city")} />
            </FormField>
            <FormField label={t("address_state")} htmlFor="ck-state" required
              error={addressErrors?.state ? t("errors.state_invalid") : undefined}>
              <TextInput id="ck-state" maxLength={2} autoComplete="address-level1"
                aria-invalid={!!addressErrors?.state || undefined} {...register("delivery.address.state")} />
            </FormField>
            <FormField label={t("address_zip")} htmlFor="ck-zip" required
              error={addressErrors?.zip ? t("errors.zip_invalid") : undefined}>
              <TextInput id="ck-zip" inputMode="numeric" autoComplete="postal-code"
                aria-invalid={!!addressErrors?.zip || undefined} {...register("delivery.address.zip")} />
            </FormField>
          </div>
          <input type="hidden" value="US" {...register("delivery.address.country")} />
        </>
      )}

      <FormField label={isPickup ? t("pickup_date") : t("delivery_date")} htmlFor="ck-date"
        error={windowErrors?.date ? t("errors.date_invalid") : undefined}>
        {(() => {
          const dateReg = register("delivery.window.date");
          return (
            <DateInput
              id="ck-date"
              min={min}
              aria-invalid={!!windowErrors?.date || undefined}
              {...dateReg}
              onBlur={(e) => {
                dateReg.onBlur(e);
                const value = e.target.value;
                if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
                  trackDeliveryDateSelected(value);
                }
              }}
            />
          );
        })()}
      </FormField>
      <FormField label={isPickup ? t("pickup_window") : t("delivery_window")} htmlFor="ck-window">
        <RadioChips
          aria-labelledby="ck-window-label"
          name="delivery.window.slot"
          items={slotItems}
          value={selectedSlot ?? ""}
          onChange={(v) => setValue("delivery.window.slot", v as typeof SLOTS[number])}
          cols={4}
        />
      </FormField>
      <FormField label={t("card_message")} htmlFor="ck-card" help={t("card_message_hint")}>
        <TextInput id="ck-card" maxLength={200} {...register("delivery.cardMessage")} />
      </FormField>
    </div>
  );
}
```

- [ ] **Step 2: Manually verify in the browser**

Run: `pnpm dev`
- Navigate to `/en/checkout` with at least one item in the cart.
- Confirm the toggle appears at the top of step 2.
- Toggle to **Pickup** — address fields should disappear, the shop info card should appear, and the date label should become "Pickup date."
- Toggle back to **Delivery** — address fields reappear.
- The summary panel's delivery line should read "Pickup — Free" when pickup is selected (this is implemented in Task 6).

---

## Task 6: OrderSummaryPanel — render "Pickup — Free"

**Files:**
- Modify: `components/checkout/OrderSummaryPanel.tsx`

- [ ] **Step 1: Add `isPickup` prop and branch the delivery row**

In `components/checkout/OrderSummaryPanel.tsx`, update the `Props` type to add `isPickup?: boolean;`:

```ts
type Props = {
  items: ReadonlyArray<OrderLine>;
  subtotal: number; // cents
  delivery: number; // cents
  total: number;    // cents
  deliveryPending?: boolean;
  isPickup?: boolean;
  locale: Locale;
  eyebrow?: string;
};
```

Update the function signature to destructure `isPickup = false`:

```ts
export function OrderSummaryPanel({ items, subtotal, delivery, total, deliveryPending = false, isPickup = false, locale, eyebrow = "Your order" }: Props) {
```

Replace the existing "Delivery" row with:

```tsx
          <div className="flex items-center justify-between">
            <dt className="font-mono text-[11px] uppercase tracking-[0.22em] text-bone/60">
              {isPickup ? "Pickup" : "Delivery"}
            </dt>
            <dd className="font-mono text-sm text-bone/85">
              {isPickup ? "Free" : (deliveryPending ? "—" : formatMoneyCents(delivery, locale))}
            </dd>
          </div>
```

(Strings are inline because this component already hardcodes "Subtotal"/"Total"/"Delivery" — keep the existing pattern. If we later move this component to `next-intl`, the pickup string will follow the same migration.)

Update the total cell so pickup never shows the deliveryPending dash:

```tsx
          <div className="flex items-baseline justify-between pt-3 border-t border-bone/10">
            <dt className="font-mono text-[11px] uppercase tracking-[0.22em] text-bone/70">Total</dt>
            <dd className="font-display text-2xl tracking-tighter">
              {!isPickup && deliveryPending ? "—" : formatMoneyCents(total, locale)}
            </dd>
          </div>
```

- [ ] **Step 2: Commit Tasks 4–6**

```bash
git add components/checkout/CheckoutShell.tsx components/checkout/DeliveryStep.tsx components/checkout/OrderSummaryPanel.tsx
git commit -m "feat(checkout): pickup/delivery toggle in checkout UI"
```

---

## Task 7: i18n strings (en + es)

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/es.json`

- [ ] **Step 1: Add `checkout.fulfillment_*` and `checkout.pickup_*` keys to en**

In `messages/en.json`, inside the `"checkout": { ... }` object, add these keys (place them just before `"errors":`):

```json
    "fulfillment_label": "How would you like to receive it?",
    "fulfillment_delivery": "Delivery",
    "fulfillment_pickup": "Free pickup at our shop",
    "pickup_at": "Pick up at",
    "pickup_date": "Pickup date",
    "pickup_window": "Pickup time",
```

- [ ] **Step 2: Add `confirmation.pickup_*` keys to en**

In `messages/en.json`, inside the `"confirmation": { ... }` object, add these keys (place them just after `"delivery_to":`):

```json
    "pickup_at_label": "Pick up at our Willis Ave shop",
    "pickup_address_label": "Address",
```

- [ ] **Step 3: Add the same keys to es**

In `messages/es.json`, mirror the keys with Spanish copy:

```json
// inside "checkout"
    "fulfillment_label": "¿Cómo deseas recibirlo?",
    "fulfillment_delivery": "Entrega a domicilio",
    "fulfillment_pickup": "Recoger en la tienda · Gratis",
    "pickup_at": "Recoger en",
    "pickup_date": "Fecha de recogida",
    "pickup_window": "Hora de recogida",
```

```json
// inside "confirmation"
    "pickup_at_label": "Recoger en nuestra tienda de Willis Ave",
    "pickup_address_label": "Dirección",
```

- [ ] **Step 4: Verify i18n keys test still passes**

Run: `pnpm vitest run tests/unit/i18n-keys.test.ts`
Expected: PASS (this test verifies en/es have the same key shape).

- [ ] **Step 5: Commit**

```bash
git add messages/en.json messages/es.json
git commit -m "i18n(checkout): add fulfillment/pickup strings (en, es)"
```

---

## Task 8: ConfirmationView — pickup branch

**Files:**
- Modify: `components/checkout/ConfirmationView.tsx`

- [ ] **Step 1: Branch on `order.delivery.method`**

In `components/checkout/ConfirmationView.tsx`, replace the entire `<div>` inside `<section>` whose first child is `<p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink/55 mb-3">{t("delivery_to")}</p>` with this:

```tsx
          {order.delivery.method === "pickup" ? (
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink/55 mb-3">{t("pickup_at_label")}</p>
              <p className="font-display text-2xl text-ink">{order.delivery.recipient.name}</p>
              <p className="text-sm text-ink/75">
                {SITE.address.line1}<br />
                {SITE.address.locality}, {SITE.address.region} {SITE.address.postal}
              </p>
              <p className="font-mono text-sm text-ink mt-2">{formatPhoneUS(order.delivery.recipient.phone)}</p>
              <p className="font-mono text-sm text-ink mt-2">{windowLabel}</p>
              {order.delivery.cardMessage && (
                <blockquote className="mt-4 border-l-2 border-rouge pl-4 text-ink/80 italic">
                  &ldquo;{order.delivery.cardMessage}&rdquo;
                </blockquote>
              )}
            </div>
          ) : (
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink/55 mb-3">{t("delivery_to")}</p>
              <p className="font-display text-2xl text-ink">{order.delivery.recipient.name}</p>
              <p className="text-sm text-ink/75">
                {order.delivery.address.street1}{order.delivery.address.street2 && `, ${order.delivery.address.street2}`}
                <br />
                {order.delivery.address.city}, {order.delivery.address.state} {order.delivery.address.zip}
              </p>
              <p className="font-mono text-sm text-ink mt-2">{formatPhoneUS(order.delivery.recipient.phone)}</p>
              <p className="font-mono text-sm text-ink mt-2">{windowLabel}</p>
              {order.delivery.cardMessage && (
                <blockquote className="mt-4 border-l-2 border-rouge pl-4 text-ink/80 italic">
                  &ldquo;{order.delivery.cardMessage}&rdquo;
                </blockquote>
              )}
            </div>
          )}
```

Add the import for `SITE`:

```ts
import { SITE } from "@/data/site";
```

- [ ] **Step 2: Verify typecheck passes**

Run: `pnpm tsc --noEmit`
Expected: no errors in `ConfirmationView.tsx`.

- [ ] **Step 3: Commit**

```bash
git add components/checkout/ConfirmationView.tsx
git commit -m "feat(confirmation): show shop address card for pickup orders"
```

---

## Task 9: Owner notification email — pickup branch

**Files:**
- Modify: `lib/order-notifications.ts`
- Test: `tests/unit/order-notifications.test.ts` (create)

- [ ] **Step 1: Create the failing test**

Create `tests/unit/order-notifications.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import type { Order } from "@/types/order";
// We'll test the body builder directly. To do that, export it from the module.
import { __buildBody as buildBody } from "@/lib/order-notifications";

const baseOrder: Order = {
  id: "do_test",
  locale: "en",
  lines: [{ productId: "p-arr-m01", variantId: "standard", addOnIds: [], qty: 1 }],
  contact: { email: "buyer@example.com", phone: "5165551234" },
  totals: { subtotalCents: 19100, deliveryCents: 0, taxCents: 1648, totalCents: 20748 },
  status: "paid",
  createdAt: "2026-05-07T15:30:00.000Z",
  delivery: {
    method: "pickup",
    recipient: { name: "Lola Cardona", phone: "5165550101" },
    window: { date: "2026-05-15", slot: "midday" },
    cardMessage: "Happy birthday",
  },
};

describe("order-notifications buildBody", () => {
  it("renders PICK UP AT SHOP section for pickup orders", () => {
    const body = buildBody(baseOrder);
    expect(body).toContain("PICK UP AT SHOP");
    expect(body).toContain("1077 Willis Ave");
    expect(body).not.toContain("DELIVER TO");
  });

  it("renders DELIVER TO section for delivery orders", () => {
    const order: Order = {
      ...baseOrder,
      delivery: {
        method: "delivery",
        recipient: { name: "Lola Cardona", phone: "5165550101" },
        address: {
          street1: "1 Test St",
          city: "Albertson",
          state: "NY",
          zip: "11507",
          country: "US",
        },
        window: { date: "2026-05-15", slot: "midday" },
        cardMessage: "Happy birthday",
      },
    };
    const body = buildBody(order);
    expect(body).toContain("DELIVER TO");
    expect(body).toContain("1 Test St");
    expect(body).not.toContain("PICK UP AT SHOP");
  });
});
```

- [ ] **Step 2: Run the test — it should fail (no `__buildBody` export yet, and `Order` type forces compile errors in current module)**

Run: `pnpm vitest run tests/unit/order-notifications.test.ts`
Expected: FAIL.

- [ ] **Step 3: Update the notification module**

Replace the body-building section of `lib/order-notifications.ts`. Specifically, replace the entire `function buildBody(order: Order): string { ... }` with:

```ts
import { SITE } from "@/data/site";

export function __buildBody(order: Order): string {
  const lines: string[] = [];
  const m = (cents: number) => formatMoneyCents(cents, "en");

  lines.push(`ORDER ${order.id} · paid ${order.createdAt}`);
  lines.push(
    `Total: ${m(order.totals.totalCents)} (subtotal ${m(order.totals.subtotalCents)} + delivery ${m(order.totals.deliveryCents)} + tax ${m(order.totals.taxCents)})`,
  );
  lines.push("");

  if (order.delivery.method === "pickup") {
    lines.push("PICK UP AT SHOP");
    lines.push(`${SITE.brand} · ${SITE.address.line1}, ${SITE.address.locality}, ${SITE.address.region} ${SITE.address.postal}`);
    lines.push(`${order.delivery.recipient.name} · ${formatPhoneUS(order.delivery.recipient.phone)}`);
    lines.push(formatDeliveryWindow(order.delivery.window, "en"));
  } else {
    lines.push("DELIVER TO");
    lines.push(`${order.delivery.recipient.name} · ${formatPhoneUS(order.delivery.recipient.phone)}`);
    const addr = order.delivery.address;
    lines.push(addr.street1 + (addr.street2 ? `, ${addr.street2}` : ""));
    lines.push(`${addr.city}, ${addr.state} ${addr.zip}`);
    lines.push(formatDeliveryWindow(order.delivery.window, "en"));
  }
  lines.push("");

  lines.push("CARD MESSAGE");
  lines.push(order.delivery.cardMessage?.trim() ? `"${order.delivery.cardMessage.trim()}"` : "—");
  lines.push("");

  lines.push("ITEMS");
  const resolved = resolveCartLines(order.lines, PRODUCTS);
  for (const r of resolved) {
    const variantLabel = r.variant.label.en;
    const productTitle = r.product.title.en;
    lines.push(
      `${r.line.qty}× ${productTitle} — ${variantLabel} — ${m(r.lineTotalCents)}`,
    );
    if (r.addOns.length > 0) {
      const names = r.addOns.map((a) => a.label.en).join(", ");
      lines.push(`   Add-ons: ${names}`);
    }
  }
  lines.push("");

  lines.push("BUYER CONTACT");
  lines.push(`${order.contact.email} · ${formatPhoneUS(order.contact.phone)}`);

  if (order.stripePaymentIntentId) {
    lines.push("");
    lines.push(`Stripe: ${order.stripePaymentIntentId}`);
    lines.push(`https://dashboard.stripe.com/payments/${order.stripePaymentIntentId}`);
  }

  return lines.join("\n");
}
```

Then update `notifyOrderPaid` to call `__buildBody`:

```ts
  const text = __buildBody(order);
```

(The `__` prefix signals "internal export, exposed for testing only" — we'll keep the public API as `notifyOrderPaid`.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run tests/unit/order-notifications.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the full test suite to catch regressions**

Run: `pnpm vitest run`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/order-notifications.ts tests/unit/order-notifications.test.ts
git commit -m "feat(notifications): owner email shows pickup details for pickup orders"
```

---

## Task 10: Verify the rest of the codebase compiles

**Files:** none (verification step).

- [ ] **Step 1: Full typecheck**

Run: `pnpm tsc --noEmit`
Expected: no errors. Verified during planning: no other module reads `order.delivery.address` / `order.delivery.recipient` / `order.delivery.window` outside the files this plan already modifies. (`app/api/stripe/webhook/route.ts` only reads `order.totals.deliveryCents`.) If `tsc` does surface a new error, fix it with the same `if (order.delivery.method === "delivery") { ... }` guard pattern — but don't pre-emptively change anything not flagged by the compiler.

- [ ] **Step 2: Full vitest**

Run: `pnpm vitest run`
Expected: all PASS.

- [ ] **Step 3: Manual end-to-end smoke**

Run: `pnpm dev`. With a Stripe test card (`4242 4242 4242 4242`):
- Add an item, go to checkout, choose **Pickup** — verify address fields hide, summary shows "Pickup — Free", payment intent succeeds, confirmation page shows shop address, owner email body (check `console.log` output if Resend isn't configured) shows `PICK UP AT SHOP`.
- Repeat with **Delivery** — verify existing delivery flow still works exactly as before, ZIP fee applies, confirmation shows recipient address.

- [ ] **Step 4: Commit any cleanup from Step 1**

```bash
git add -p
git commit -m "fix: handle pickup orders in remaining order.delivery consumers"
```

(Skip this commit if Step 1 had no errors.)

---

## Out of scope (intentional)

- **PDP "or pick up free at our Willis Ave shop" hint.** We discussed putting a small informational line on the product page. It's nice-to-have, not blocking, and easy to add later as a one-line `<p>` in `PdpConfigurator`. Leaving out to keep this plan focused on the actual fulfillment toggle.
- **Per-zone pickup hours / blackout dates.** The pickup window reuses the existing slot picker; the shop's published hours appear in the info card so customers self-select. If we hit complaints, we'll revisit.
- **Owner email design rewrite.** Plain text body matches the existing format; HTML email is a separate effort.
