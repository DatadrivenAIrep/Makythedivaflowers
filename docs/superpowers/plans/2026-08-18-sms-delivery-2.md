# SMS Delivery 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send customers an SMS when a delivery order goes out-for-delivery and when it's delivered, and text the owner (Maky) when a new web order is paid or a new lead/contact arrives.

**Architecture:** Two new customer templates (`out_for_delivery`, `delivered`) render through the existing `sendMessage` pipeline via two new dispatch functions in `order-dispatch.ts`, triggered from `changeFulfillmentStatus`. Internal owner alerts go through a new `lib/notify-owner.ts` (SMS to `SITE.mobile.e164`, consent-free, dry-run-aware, never throws) hooked from the paid-order and lead routes.

**Tech Stack:** Next.js 16, TypeScript, `node:sqlite`, `twilio` SDK, next-intl, vitest.

**Spec:** `docs/superpowers/specs/2026-08-18-sms-delivery-2-design.md`

## Global Constraints

- Customer delivery messages: **delivery orders only** (`fulfillment.method === "delivery"`), to the **buyer** (`order.contact.phone`), only if opted in (`messagingChannel !== "none"`), deduped within 24h. No pickup, no recipient, no photo.
- Owner alerts: to `SITE.mobile.e164` only; never throw; respect `twilioSmsEnabled()` + `twilioDryRun()`; Spanish inline strings (not templates/i18n).
- No database migration (`messages.template` is free-text TEXT).
- `npm test` has ~7 pre-existing failures (Chromium spawn ENOEXEC + date-sensitive checkout-schema specs) — compare against base, don't attribute them here.

---

## Task 1: The two customer templates

**Files:**
- Modify: `lib/message-storage.ts` (the `MessageTemplate` union)
- Modify: `lib/messaging-templates.ts` (`BODIES` en+es, `whatsappContentVars`)
- Test: `tests/unit/messaging-templates.test.ts`

**Interfaces:**
- Produces: `MessageTemplate` now includes `"out_for_delivery" | "delivered"`; `renderSmsBody(template, locale, vars)` renders them from `TemplateVars` (`recipient_name`, `window`, `shop_phone`).

- [ ] **Step 1: Write the failing tests**

Append to `tests/unit/messaging-templates.test.ts` inside the existing `describe("renderSmsBody", …)` block (the `vars` fixture with `recipient_name: "Lola"`, `window`, `shop_phone` already exists at the top of the file):

```ts
  it("renders out_for_delivery in both locales", () => {
    expect(renderSmsBody("out_for_delivery", "en", vars)).toContain("on the way");
    expect(renderSmsBody("out_for_delivery", "es", vars)).toContain("va en camino");
  });

  it("renders delivered in both locales", () => {
    expect(renderSmsBody("delivered", "en", vars)).toContain("Delivered");
    expect(renderSmsBody("delivered", "es", vars)).toContain("Entregado");
    expect(renderSmsBody("delivered", "es", vars)).toContain(vars.shop_phone);
  });
```

- [ ] **Step 2: Run it — expect failure**

```bash
npm test -- tests/unit/messaging-templates.test.ts
```
Expected: FAIL — `out_for_delivery`/`delivered` aren't valid `MessageTemplate` values, and `BODIES` has no entry.

- [ ] **Step 3: Extend the `MessageTemplate` type**

In `lib/message-storage.ts`, line 6, replace the `MessageTemplate` type with:

```ts
export type MessageTemplate =
  | "order_received"
  | "payment_link"
  | "payment_confirmed"
  | "out_for_delivery"
  | "delivered";
```

- [ ] **Step 4: Add the template bodies**

In `lib/messaging-templates.ts`, inside `BODIES.en` (after `payment_confirmed`), add:

```ts
    out_for_delivery: (v) =>
      `Hi ${v.recipient_name}! Your Diva Flowers order is on the way, arriving ${v.window ?? ""}. — Maky`,
    delivered: (v) =>
      `Delivered! Your Diva Flowers order has arrived. Thank you! — Maky · ${v.shop_phone}`,
```

Inside `BODIES.es` (after `payment_confirmed`), add:

```ts
    out_for_delivery: (v) =>
      `¡Hola ${v.recipient_name}! Tu pedido de Diva Flowers va en camino, llega ${v.window ?? ""}. — Maky`,
    delivered: (v) =>
      `¡Entregado! Tu pedido de Diva Flowers ya llegó. ¡Gracias por tu compra! — Maky · ${v.shop_phone}`,
```

- [ ] **Step 5: Keep `whatsappContentVars` exhaustive**

In `lib/messaging-templates.ts`, in the `whatsappContentVars` switch, add two cases (after `case "payment_confirmed"`):

```ts
    case "out_for_delivery":
      return { "1": vars.recipient_name, "2": vars.window ?? "" };
    case "delivered":
      return { "1": vars.recipient_name, "2": vars.shop_phone };
```

- [ ] **Step 6: Run it — expect pass + typecheck**

```bash
npm test -- tests/unit/messaging-templates.test.ts
npx tsc --noEmit
```
Expected: PASS; tsc clean.

- [ ] **Step 7: Commit**

```bash
git add lib/message-storage.ts lib/messaging-templates.ts tests/unit/messaging-templates.test.ts
git commit -m "feat(messaging): add out_for_delivery and delivered SMS templates"
```

---

## Task 2: Dispatch functions

**Files:**
- Modify: `lib/order-dispatch.ts`
- Test: `tests/unit/order-dispatch.test.ts` (new)

**Interfaces:**
- Consumes: `renderSmsBody`/`sendMessage` (via existing `sendMessage`), `MessageTemplate` from Task 1.
- Produces: `dispatchOutForDelivery(order: Order): Promise<void>`, `dispatchDelivered(order: Order): Promise<void>`.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/order-dispatch.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";

const sendMessageMock = vi.fn();
vi.mock("@/lib/messaging", () => ({ sendMessage: (...a: unknown[]) => sendMessageMock(...a) }));
const getByPhoneMock = vi.fn();
vi.mock("@/lib/customer-storage", () => ({ getByPhone: (...a: unknown[]) => getByPhoneMock(...a) }));
const hasRecentSuccessMock = vi.fn();
vi.mock("@/lib/message-storage", () => ({ hasRecentSuccess: (...a: unknown[]) => hasRecentSuccessMock(...a) }));

import { dispatchOutForDelivery, dispatchDelivered } from "@/lib/order-dispatch";
import type { Order } from "@/types/order";

function order(method: "delivery" | "pickup"): Order {
  const fulfillment =
    method === "delivery"
      ? {
          method: "delivery" as const,
          recipient: { name: "Ana Ruiz", phone: "5165550100" },
          address: { street1: "1 A", city: "Albertson", state: "NY", zip: "11507", country: "US" as const },
          window: { date: "2099-07-01", slot: "morning" as const },
        }
      : {
          method: "pickup" as const,
          recipient: { name: "Ana Ruiz", phone: "5165550100" },
          window: { date: "2099-07-01", slot: "morning" as const },
        };
  return {
    id: "do_1",
    source: "web",
    locale: "es",
    lines: [{ kind: "catalog", productId: "p1", variantId: "v1", addOnIds: [], qty: 1 }],
    fulfillment,
    contact: { email: "a@x.com", phone: "5165550100" },
    totals: { subtotalCents: 5000, deliveryCents: 0, taxCents: 431, totalCents: 5431 },
    status: "out-for-delivery",
    paymentStatus: "paid",
    createdAt: "2026-08-18T00:00:00Z",
    updatedAt: "2026-08-18T00:00:00Z",
  };
}

beforeEach(() => {
  sendMessageMock.mockReset().mockResolvedValue({ id: "m1", status: "sent" });
  getByPhoneMock.mockReset().mockReturnValue({ id: "cus_1", messagingChannel: "sms" });
  hasRecentSuccessMock.mockReset().mockReturnValue(false);
});

describe("dispatchOutForDelivery", () => {
  it("sends out_for_delivery for a consented delivery order", async () => {
    await dispatchOutForDelivery(order("delivery"));
    expect(sendMessageMock).toHaveBeenCalledWith(expect.objectContaining({ template: "out_for_delivery" }));
  });
  it("skips a pickup order", async () => {
    await dispatchOutForDelivery(order("pickup"));
    expect(sendMessageMock).not.toHaveBeenCalled();
  });
  it("skips when the buyer opted out (channel none)", async () => {
    getByPhoneMock.mockReturnValue({ id: "cus_1", messagingChannel: "none" });
    await dispatchOutForDelivery(order("delivery"));
    expect(sendMessageMock).not.toHaveBeenCalled();
  });
  it("dedupes within 24h", async () => {
    hasRecentSuccessMock.mockReturnValue(true);
    await dispatchOutForDelivery(order("delivery"));
    expect(sendMessageMock).not.toHaveBeenCalled();
  });
});

describe("dispatchDelivered", () => {
  it("sends delivered for a consented delivery order", async () => {
    await dispatchDelivered(order("delivery"));
    expect(sendMessageMock).toHaveBeenCalledWith(expect.objectContaining({ template: "delivered" }));
  });
  it("skips a pickup order", async () => {
    await dispatchDelivered(order("pickup"));
    expect(sendMessageMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it — expect failure**

```bash
npm test -- tests/unit/order-dispatch.test.ts
```
Expected: FAIL — `dispatchOutForDelivery`/`dispatchDelivered` aren't exported.

- [ ] **Step 3: Add the dispatch functions**

In `lib/order-dispatch.ts`, append at the end of the file (they reuse the file's existing `windowLabel`, `totalLabel`, `resolveLocale`, `firstName`, `shopPhoneFromSite` helpers and the imported `sendMessage`/`getByPhone`/`hasRecentSuccess`):

```ts
export async function dispatchOutForDelivery(order: Order): Promise<void> {
  if (order.fulfillment.method !== "delivery") return;
  if (hasRecentSuccess(order.id, "out_for_delivery", 24)) return;
  const customer = await getByPhone(order.contact.phone);
  const channel = customer?.messagingChannel ?? "sms";
  if (channel === "none") return;
  const locale = resolveLocale(customer?.locale, order.locale);

  await sendMessage({
    orderId: order.id,
    customerId: customer?.id,
    channel,
    locale,
    template: "out_for_delivery",
    vars: {
      recipient_name: firstName(order.fulfillment.recipient.name),
      total: totalLabel(order.totals.totalCents),
      window: windowLabel(order, locale),
      shop_phone: shopPhoneFromSite(),
    },
    to: { phone: order.contact.phone, email: order.contact.email },
  });
}

export async function dispatchDelivered(order: Order): Promise<void> {
  if (order.fulfillment.method !== "delivery") return;
  if (hasRecentSuccess(order.id, "delivered", 24)) return;
  const customer = await getByPhone(order.contact.phone);
  const channel = customer?.messagingChannel ?? "sms";
  if (channel === "none") return;
  const locale = resolveLocale(customer?.locale, order.locale);

  await sendMessage({
    orderId: order.id,
    customerId: customer?.id,
    channel,
    locale,
    template: "delivered",
    vars: {
      recipient_name: firstName(order.fulfillment.recipient.name),
      total: totalLabel(order.totals.totalCents),
      window: windowLabel(order, locale),
      shop_phone: shopPhoneFromSite(),
    },
    to: { phone: order.contact.phone, email: order.contact.email },
  });
}
```

- [ ] **Step 4: Run it — expect pass + typecheck**

```bash
npm test -- tests/unit/order-dispatch.test.ts
npx tsc --noEmit
```
Expected: PASS (6 tests); tsc clean.

- [ ] **Step 5: Commit**

```bash
git add lib/order-dispatch.ts tests/unit/order-dispatch.test.ts
git commit -m "feat(messaging): dispatch out-for-delivery and delivered SMS to the buyer"
```

---

## Task 3: Trigger the dispatches on status change

**Files:**
- Modify: `lib/order-mutations.ts` (`changeFulfillmentStatus`)
- Test: `tests/unit/order-mutations-fulfillment.test.ts` (extend)

**Interfaces:**
- Consumes: `dispatchOutForDelivery`, `dispatchDelivered` (Task 2).

- [ ] **Step 1: Add the failing tests + mock**

At the TOP of `tests/unit/order-mutations-fulfillment.test.ts`, after the imports, add the mock (the file dynamically imports `@/lib/order-dispatch` via `changeFulfillmentStatus`, and `vi.mock` intercepts dynamic imports):

```ts
const dispatchOutForDeliveryMock = vi.fn();
const dispatchDeliveredMock = vi.fn();
vi.mock("@/lib/order-dispatch", () => ({
  dispatchOutForDelivery: (...a: unknown[]) => dispatchOutForDeliveryMock(...a),
  dispatchDelivered: (...a: unknown[]) => dispatchDeliveredMock(...a),
}));
```

Add `dispatchOutForDeliveryMock.mockReset(); dispatchDeliveredMock.mockReset();` to the existing `beforeEach` body.

Append these tests inside the `describe("changeFulfillmentStatus", …)` block:

```ts
  it("dispatches out_for_delivery on that transition", async () => {
    seed("o_ofd", "preparing");
    await changeFulfillmentStatus("o_ofd", "out-for-delivery");
    expect(dispatchOutForDeliveryMock).toHaveBeenCalledTimes(1);
    expect(dispatchDeliveredMock).not.toHaveBeenCalled();
  });

  it("dispatches delivered on that transition", async () => {
    seed("o_del", "out-for-delivery");
    await changeFulfillmentStatus("o_del", "delivered");
    expect(dispatchDeliveredMock).toHaveBeenCalledTimes(1);
  });

  it("does not dispatch on other transitions", async () => {
    seed("o_prep", "pending");
    await changeFulfillmentStatus("o_prep", "preparing");
    expect(dispatchOutForDeliveryMock).not.toHaveBeenCalled();
    expect(dispatchDeliveredMock).not.toHaveBeenCalled();
  });

  it("a dispatch failure does not break the status change", async () => {
    dispatchOutForDeliveryMock.mockRejectedValueOnce(new Error("boom"));
    seed("o_fail", "preparing");
    const r = await changeFulfillmentStatus("o_fail", "out-for-delivery");
    expect(r.status).toBe("out-for-delivery");
  });
```

- [ ] **Step 2: Run it — expect failure**

```bash
npm test -- tests/unit/order-mutations-fulfillment.test.ts
```
Expected: FAIL — the dispatch mocks are never called (no trigger yet).

- [ ] **Step 3: Trigger the dispatches**

In `lib/order-mutations.ts`, inside `changeFulfillmentStatus`, after `await recordOrderChange({...})` and BEFORE `return next;`, add:

```ts
  if (status === "out-for-delivery") {
    try {
      const { dispatchOutForDelivery } = await import("@/lib/order-dispatch");
      await dispatchOutForDelivery(next);
    } catch (e) {
      console.error(JSON.stringify({ event: "dispatch_out_for_delivery_failed", orderId, error: String(e) }));
    }
  } else if (status === "delivered") {
    try {
      const { dispatchDelivered } = await import("@/lib/order-dispatch");
      await dispatchDelivered(next);
    } catch (e) {
      console.error(JSON.stringify({ event: "dispatch_delivered_failed", orderId, error: String(e) }));
    }
  }
```

- [ ] **Step 4: Run it — expect pass + typecheck**

```bash
npm test -- tests/unit/order-mutations-fulfillment.test.ts
npx tsc --noEmit
```
Expected: PASS (all existing + 4 new); tsc clean.

- [ ] **Step 5: Commit**

```bash
git add lib/order-mutations.ts tests/unit/order-mutations-fulfillment.test.ts
git commit -m "feat(orders): send delivery SMS when the fulfillment status advances"
```

---

## Task 4: The owner-alert module

**Files:**
- Create: `lib/notify-owner.ts`
- Test: `tests/unit/notify-owner.test.ts` (new)

**Interfaces:**
- Produces: `notifyOwner(message: string): Promise<void>` — sends to `SITE.mobile.e164`, respects sms-enabled + dry-run, never throws.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/notify-owner.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";

const sendSmsMock = vi.fn();
vi.mock("@/lib/twilio-server", () => ({ sendSms: (...a: unknown[]) => sendSmsMock(...a) }));
const twilioSmsEnabledMock = vi.fn();
const twilioDryRunMock = vi.fn();
vi.mock("@/lib/twilio-config", () => ({
  twilioSmsEnabled: () => twilioSmsEnabledMock(),
  twilioDryRun: () => twilioDryRunMock(),
}));

import { notifyOwner } from "@/lib/notify-owner";
import { SITE } from "@/data/site";

beforeEach(() => {
  sendSmsMock.mockReset().mockResolvedValue({ sid: "SM1" });
  twilioSmsEnabledMock.mockReset().mockReturnValue(true);
  twilioDryRunMock.mockReset().mockReturnValue(false);
});

describe("notifyOwner", () => {
  it("sends to the owner mobile when enabled and not dry-run", async () => {
    await notifyOwner("hola");
    expect(sendSmsMock).toHaveBeenCalledWith(SITE.mobile.e164, "hola");
  });
  it("skips when SMS is disabled", async () => {
    twilioSmsEnabledMock.mockReturnValue(false);
    await notifyOwner("hola");
    expect(sendSmsMock).not.toHaveBeenCalled();
  });
  it("skips (logs) in dry-run", async () => {
    twilioDryRunMock.mockReturnValue(true);
    await notifyOwner("hola");
    expect(sendSmsMock).not.toHaveBeenCalled();
  });
  it("never throws when sendSms rejects", async () => {
    sendSmsMock.mockRejectedValue(new Error("boom"));
    await expect(notifyOwner("hola")).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run it — expect failure**

```bash
npm test -- tests/unit/notify-owner.test.ts
```
Expected: FAIL — `@/lib/notify-owner` doesn't resolve.

- [ ] **Step 3: Write the module**

Create `lib/notify-owner.ts`:

```ts
import "server-only";
import { SITE } from "@/data/site";
import { twilioSmsEnabled, twilioDryRun } from "@/lib/twilio-config";
import { sendSms } from "@/lib/twilio-server";

/**
 * Sends an operational SMS to the shop owner's mobile. No customer consent — it
 * is the owner's own phone, not an A2P/marketing message. Respects the
 * sms-enabled and dry-run flags, and NEVER throws: a failed alert must not break
 * the order or lead flow that triggered it.
 */
export async function notifyOwner(message: string): Promise<void> {
  try {
    if (!twilioSmsEnabled()) {
      console.log(JSON.stringify({ event: "notify_owner_skipped", reason: "sms_disabled" }));
      return;
    }
    if (twilioDryRun()) {
      console.log(JSON.stringify({ event: "notify_owner_dry_run", message }));
      return;
    }
    await sendSms(SITE.mobile.e164, message);
  } catch (e) {
    console.error(
      JSON.stringify({ event: "notify_owner_failed", error: e instanceof Error ? e.message : String(e) }),
    );
  }
}
```

- [ ] **Step 4: Run it — expect pass + typecheck**

```bash
npm test -- tests/unit/notify-owner.test.ts
npx tsc --noEmit
```
Expected: PASS (4 tests); tsc clean.

- [ ] **Step 5: Commit**

```bash
git add lib/notify-owner.ts tests/unit/notify-owner.test.ts
git commit -m "feat(messaging): notify-owner module for internal SMS alerts"
```

---

## Task 5: Wire the owner alerts

**Files:**
- Modify: `lib/on-web-order-paid.ts` (new-order alert)
- Modify: `app/api/inquiry/route.ts` (wedding/event lead alert)
- Modify: `app/api/contact/route.ts` (contact alert)
- Test: `tests/unit/on-web-order-paid.test.ts` (extend), `tests/unit/api-contact.test.ts` (extend), `tests/unit/api-inquiry.test.ts` (new)

**Interfaces:**
- Consumes: `notifyOwner` (Task 4).

- [ ] **Step 1: Write the failing tests**

In `tests/unit/on-web-order-paid.test.ts`, add the notify-owner mock at the top (next to the other `vi.mock`s):

```ts
const notifyOwnerMock = vi.fn();
vi.mock("@/lib/notify-owner", () => ({ notifyOwner: (...a: unknown[]) => notifyOwnerMock(...a) }));
```

Add `notifyOwnerMock.mockReset();` to its `beforeEach`. Append a test (inside the existing describe):

```ts
  it("texts the owner once when a web order is paid", async () => {
    await onWebOrderPaid("do_1");
    expect(notifyOwnerMock).toHaveBeenCalledTimes(1);
  });
```

In `tests/unit/api-contact.test.ts`, add the notify-owner mock near the top (below the existing `vi.mock("@/lib/inquiry-storage", …)`):

```ts
const notifyOwnerMock = vi.fn();
vi.mock("@/lib/notify-owner", () => ({ notifyOwner: (...a: unknown[]) => notifyOwnerMock(...a) }));
```

Append a test:

```ts
it("texts the owner about a new contact inquiry", async () => {
  await POST(new Request("http://x/api/contact", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: "Luis", email: "luis@x.com", subject: "Hola",
      body: "Quiero un ramo grande por favor", locale: "es", honeypot: "",
    }),
  }));
  expect(notifyOwnerMock).toHaveBeenCalledWith(expect.stringContaining("Luis"));
});
```

Create `tests/unit/api-inquiry.test.ts`:

```ts
import { it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";

vi.mock("@/lib/inquiry-storage", () => ({ saveInquiry: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/notify-inquiry", () => ({ notifyInquiry: vi.fn().mockResolvedValue(undefined) }));
const notifyOwnerMock = vi.fn();
vi.mock("@/lib/notify-owner", () => ({ notifyOwner: (...a: unknown[]) => notifyOwnerMock(...a) }));

import { POST } from "@/app/api/inquiry/route";

beforeEach(() => { vi.stubEnv("SQLITE_FILE", ":memory:"); runMigrations(); notifyOwnerMock.mockReset(); });
afterEach(() => { closeDb(); vi.unstubAllEnvs(); vi.clearAllMocks(); });

it("texts the owner about a new wedding lead", async () => {
  const res = await POST(new Request("http://x/api/inquiry", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      type: "wedding",
      contact: { name: "Ana", email: "ana@x.com", phone: "5165551234" },
      budgetBand: "10-25k",
      vibe: "Romantic garden wedding with white roses",
      locale: "es",
      honeypot: "",
    }),
  }));
  expect(res.status).toBe(200);
  expect(notifyOwnerMock).toHaveBeenCalledWith(expect.stringContaining("Ana"));
});
```

- [ ] **Step 2: Run them — expect failure**

```bash
npm test -- tests/unit/on-web-order-paid.test.ts tests/unit/api-contact.test.ts tests/unit/api-inquiry.test.ts
```
Expected: the three new tests FAIL — `notifyOwner` isn't called from any route yet.

- [ ] **Step 3: Wire onWebOrderPaid**

In `lib/on-web-order-paid.ts`, add the import at the top:

```ts
import { notifyOwner } from "@/lib/notify-owner";
```

Inside `onWebOrderPaid`, after `await dispatchPaymentConfirmed(linked);`, add:

```ts
    const total = `$${(order.totals.totalCents / 100).toFixed(2)}`;
    const num = order.orderNumber != null ? `#${order.orderNumber}` : order.id;
    await notifyOwner(`Nueva orden web ${num} · ${total}. — Diva Flowers`);
```

(`notifyOwner` never throws; it sits inside the existing try/catch either way.)

- [ ] **Step 4: Wire the inquiry route**

In `app/api/inquiry/route.ts`, inside the `if (parsed.data.type === "wedding" || parsed.data.type === "event")` block, at the very START of the block (before the existing `try { const { createInquiry } … }`), add these lines. Do NOT declare a `c` variable here — the existing `try` block already declares `const c = parsed.data.contact;`, so use `parsed.data.contact` inline to avoid a redeclaration:

```ts
    const kind = parsed.data.type === "wedding" ? "boda" : "evento";
    const { notifyOwner } = await import("@/lib/notify-owner");
    await notifyOwner(
      `Nuevo lead de ${kind}: ${parsed.data.contact.name} · ${parsed.data.contact.phone}. Revisa el pipeline.`,
    );
```

- [ ] **Step 5: Wire the contact route**

In `app/api/contact/route.ts`, after `await saveInquiry({...})` and before the `try { const { createInquiry } … }` block, add:

```ts
  const { notifyOwner } = await import("@/lib/notify-owner");
  await notifyOwner(`Nueva consulta: ${parsed.data.name} · ${parsed.data.email} — "${parsed.data.subject}".`);
```

- [ ] **Step 6: Run them — expect pass + typecheck**

```bash
npm test -- tests/unit/on-web-order-paid.test.ts tests/unit/api-contact.test.ts tests/unit/api-inquiry.test.ts
npx tsc --noEmit
```
Expected: PASS; tsc clean.

- [ ] **Step 7: Commit**

```bash
git add lib/on-web-order-paid.ts app/api/inquiry/route.ts app/api/contact/route.ts tests/unit/on-web-order-paid.test.ts tests/unit/api-contact.test.ts tests/unit/api-inquiry.test.ts
git commit -m "feat(messaging): text Maky on new paid order, lead, and contact"
```

---

## Task 6: Preview the new templates from the test panel

**Files:**
- Modify: `app/api/admin/settings/twilio-test/route.ts` (allow the 2 new templates)
- Modify: `components/admin/settings/TwilioSettings.tsx` (2 dropdown options)
- Modify: `messages/en.json`, `messages/es.json` (2 labels)
- Test: `tests/unit/api-admin-settings-twilio-test.test.ts` (extend)

- [ ] **Step 1: Add the failing test**

Append to `tests/unit/api-admin-settings-twilio-test.test.ts` (inside the describe):

```ts
  it("renders and sends the delivered template", async () => {
    const body = await (
      await POST(makeReq({ to: "7022716195", template: "delivered", locale: "es" }))
    ).json();
    expect(body).toEqual({ ok: true });
    expect(sendSmsMock).toHaveBeenCalledWith("7022716195", expect.stringContaining("Entregado"));
  });
```

- [ ] **Step 2: Run it — expect failure**

```bash
npm test -- tests/unit/api-admin-settings-twilio-test.test.ts
```
Expected: FAIL — `delivered` isn't in `KNOWN_TEMPLATES`, so the config-check message is sent instead ("Entregado" not present).

- [ ] **Step 3: Allow the new templates in the endpoint**

In `app/api/admin/settings/twilio-test/route.ts`, extend the allow-list:

```ts
const KNOWN_TEMPLATES: MessageTemplate[] = [
  "order_received",
  "payment_link",
  "payment_confirmed",
  "out_for_delivery",
  "delivered",
];
```

- [ ] **Step 4: Add the dropdown options**

In `components/admin/settings/TwilioSettings.tsx`, in the message-type `<select>`, add two `<option>`s after `payment_confirmed`:

```tsx
              <option value="out_for_delivery">{t("twilio_test_msg_out_for_delivery")}</option>
              <option value="delivered">{t("twilio_test_msg_delivered")}</option>
```

- [ ] **Step 5: Add the i18n labels**

In `messages/en.json`, under `admin_settings`, after `twilio_test_msg_payment_confirmed`:

```json
    "twilio_test_msg_out_for_delivery": "Out for delivery",
    "twilio_test_msg_delivered": "Delivered",
```

In `messages/es.json`, same place:

```json
    "twilio_test_msg_out_for_delivery": "En camino",
    "twilio_test_msg_delivered": "Entregado",
```

Verify both parse: `node -e "require('./messages/en.json'); require('./messages/es.json'); console.log('json ok')"`

- [ ] **Step 6: Run it — expect pass + typecheck**

```bash
npm test -- tests/unit/api-admin-settings-twilio-test.test.ts
npx tsc --noEmit
```
Expected: PASS; tsc clean.

- [ ] **Step 7: Commit**

```bash
git add app/api/admin/settings/twilio-test/route.ts components/admin/settings/TwilioSettings.tsx messages/en.json messages/es.json tests/unit/api-admin-settings-twilio-test.test.ts
git commit -m "feat(settings): preview delivery templates from the test panel"
```

---

## Task 7: Full verification

- [ ] **Step 1: Typecheck** — `npx tsc --noEmit` (clean).
- [ ] **Step 2: Feature tests** — all green:
```bash
npm test -- tests/unit/messaging-templates.test.ts tests/unit/order-dispatch.test.ts tests/unit/order-mutations-fulfillment.test.ts tests/unit/notify-owner.test.ts tests/unit/on-web-order-paid.test.ts tests/unit/api-contact.test.ts tests/unit/api-inquiry.test.ts tests/unit/api-admin-settings-twilio-test.test.ts
```
- [ ] **Step 3: No new failures vs baseline** — `npm test 2>&1 | tail -40`; confirm the only failing files are the known baseline (print-chromium / print-render / _preview / checkout-schema) and none is a file this feature touched.
- [ ] **Step 4: Build** — `npm run build` succeeds.
- [ ] **Step 5: Tree clean** — `git status` clean apart from pre-existing untracked dirs.

---

## Deployment note

Deploy = push to `origin/main` (auto-builds, ~1–2 min). After deploy: preview the two customer templates via `/admin/settings` → Twilio test panel (pick "En camino" / "Entregado", send to a test number). Owner alerts fire on real paid web orders and real leads; verify with a live test order when convenient.
