# Stripe Checkout Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the placeholder payment step with a real Stripe Payment Element checkout, with the webhook as source of truth for order status.

**Architecture:** Embedded Stripe Payment Element. Pending order saved on intent creation; webhook transitions to `paid`/`failed`/`canceled`. Confirmation page polls a status endpoint to handle the redirect/webhook race.

**Tech Stack:** Next.js 16 (App Router), TypeScript, Stripe Node SDK (`stripe`), `@stripe/stripe-js`, `@stripe/react-stripe-js`, Vitest, Zod, react-hook-form, zustand.

**Spec:** `docs/superpowers/specs/2026-05-06-stripe-checkout-integration-design.md`

---

## Pre-flight

Before starting Task 1, confirm:

1. `stripe` CLI installed (`stripe --version` works) and `stripe login` done.
2. `.env.local` has the two test-mode variables already (no `STRIPE_WEBHOOK_SECRET` yet — that comes in Task 5):
   ```
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
   STRIPE_SECRET_KEY=sk_test_...
   ```
3. `pnpm install` is clean (`pnpm install` returns 0).
4. Tests pass on `main`: `pnpm test` (no failures).

If any of these fail, fix before starting.

---

## File Map

**Created (new files):**
- `lib/stripe-server.ts` — Stripe Node SDK singleton (server-only).
- `lib/stripe-client.ts` — `loadStripe()` cached promise (client-only).
- `app/api/checkout/intent/route.ts` — `POST` creates pending order + PaymentIntent.
- `app/api/stripe/webhook/route.ts` — `POST` updates order on Stripe events.
- `app/api/order/[id]/status/route.ts` — `GET` returns order status (polling).
- `components/checkout/StripePaymentStep.tsx` — wraps `<Elements>` + `<PaymentElement>`.
- `components/checkout/ConfirmationPolling.tsx` — client component that polls and renders by status.
- `tests/unit/order-storage.test.ts` — unit tests for new storage helpers.
- `tests/unit/api-checkout-intent.test.ts` — unit tests for `/api/checkout/intent`.
- `tests/unit/api-stripe-webhook.test.ts` — unit tests for webhook.
- `tests/unit/api-order-status.test.ts` — unit tests for status endpoint.

**Modified:**
- `types/order.ts` — add `"canceled"` to `OrderStatus`.
- `lib/order-storage.ts` — add `updateOrderStatusByPaymentIntent`, `updateOrderPaymentIntent`, `getOrderByPaymentIntent`.
- `components/checkout/CheckoutShell.tsx` — replace `PaymentStub` with `StripePaymentStep`; create/recreate intent; replace `submitOrder` with `stripe.confirmPayment`.
- `app/[locale]/order/[id]/confirmation/page.tsx` — render `ConfirmationPolling` for non-`paid` states; pass server-rendered `paid` view for `paid`.
- `messages/en.json` and `messages/es.json` — add `confirmation.processing_*`, `failed_*`, `canceled_*` keys.
- `.env.local.example` — add 3 Stripe variables.
- `README.md` — add "Pagos con Stripe" section.

**Deleted:**
- `app/api/checkout/route.ts` — replaced by `/api/checkout/intent`.
- `components/checkout/PaymentStub.tsx` — replaced by `StripePaymentStep`.
- `lib/submit-order.ts` — work splits between server `intent` and client `confirmPayment`.

---

## Task 1: Install dependencies + Stripe singletons

**Files:**
- Create: `lib/stripe-server.ts`
- Create: `lib/stripe-client.ts`
- Modify: `package.json` (via pnpm)
- Modify: `.env.local.example`

- [ ] **Step 1: Install dependencies**

```bash
pnpm add stripe @stripe/stripe-js @stripe/react-stripe-js
```

Expected: `package.json` updated with the three packages, `pnpm-lock.yaml` updated.

- [ ] **Step 2: Create `lib/stripe-server.ts`**

```ts
// lib/stripe-server.ts
import "server-only";
import Stripe from "stripe";

const secretKey = process.env.STRIPE_SECRET_KEY;
if (!secretKey) {
  throw new Error("STRIPE_SECRET_KEY is not set");
}

export const stripe = new Stripe(secretKey, {
  // The SDK pins the API version it was built against. Don't override unless we
  // want to test forward compatibility on a specific version.
  typescript: true,
});
```

- [ ] **Step 3: Create `lib/stripe-client.ts`**

```ts
// lib/stripe-client.ts
import { loadStripe, type Stripe as StripeJs } from "@stripe/stripe-js";

let stripePromise: Promise<StripeJs | null> | null = null;

export function getStripeClient(): Promise<StripeJs | null> {
  if (!stripePromise) {
    const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    if (!key) {
      // eslint-disable-next-line no-console
      console.error("[stripe] NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set");
      return Promise.resolve(null);
    }
    stripePromise = loadStripe(key);
  }
  return stripePromise;
}
```

- [ ] **Step 4: Update `.env.local.example`**

Append at the bottom of the file:

```
# Stripe (test mode)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
# In dev, this comes from `stripe listen --forward-to localhost:3000/api/stripe/webhook`.
# In prod, from Stripe Dashboard → Developers → Webhooks → endpoint signing secret.
STRIPE_WEBHOOK_SECRET=whsec_...
```

- [ ] **Step 5: Run typecheck and build**

```bash
pnpm exec tsc --noEmit
pnpm build
```

Expected: both pass with no errors. Build is needed because `lib/stripe-server.ts` will throw at module load if the env var is missing — verify that `.env.local` has `STRIPE_SECRET_KEY` before running build.

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml lib/stripe-server.ts lib/stripe-client.ts .env.local.example
git commit -m "chore(stripe): install SDKs and add server/client singletons"
```

---

## Task 2: Add `canceled` to OrderStatus

**Files:**
- Modify: `types/order.ts`

- [ ] **Step 1: Add `"canceled"` to the `OrderStatus` union**

In `types/order.ts`, change:

```ts
export type OrderStatus =
  | "pending"
  | "paid"
  | "preparing"
  | "out-for-delivery"
  | "delivered"
  | "failed";
```

To:

```ts
export type OrderStatus =
  | "pending"
  | "paid"
  | "preparing"
  | "out-for-delivery"
  | "delivered"
  | "failed"
  | "canceled";
```

(The existing `stripePaymentIntentId?: string` field on `Order` already covers what we need — no change there.)

- [ ] **Step 2: Verify typecheck still passes**

```bash
pnpm exec tsc --noEmit
```

Expected: no errors. Adding a union member is non-breaking for existing code.

- [ ] **Step 3: Commit**

```bash
git add types/order.ts
git commit -m "feat(orders): add canceled status to OrderStatus union"
```

---

## Task 3: Add storage helpers (TDD)

**Files:**
- Create: `tests/unit/order-storage.test.ts`
- Modify: `lib/order-storage.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/order-storage.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  saveOrder,
  getOrder,
  getOrderByPaymentIntent,
  updateOrderPaymentIntent,
  updateOrderStatusByPaymentIntent,
} from "@/lib/order-storage";
import type { Order } from "@/types/order";

const FILE = path.join(process.cwd(), "pending-orders.json");
let backup: string | null = null;

async function readFileOrEmpty(): Promise<string | null> {
  try {
    return await fs.readFile(FILE, "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}

beforeEach(async () => {
  backup = await readFileOrEmpty();
  await fs.writeFile(FILE, "[]", "utf8");
});
afterEach(async () => {
  if (backup === null) {
    try { await fs.unlink(FILE); } catch {}
  } else {
    await fs.writeFile(FILE, backup, "utf8");
  }
});

function makeOrder(id: string, paymentIntentId?: string): Order {
  return {
    id,
    locale: "en",
    lines: [],
    delivery: {
      recipient: { name: "Test", phone: "5555555555" },
      address: {
        street1: "1 Main",
        city: "Albertson",
        state: "NY",
        zip: "11507",
        country: "US",
      },
      window: { date: "2099-01-01", slot: "midday" },
    },
    contact: { email: "test@example.com", phone: "5555555555" },
    totals: { subtotalCents: 1000, deliveryCents: 1000, taxCents: 173, totalCents: 2173 },
    stripePaymentIntentId: paymentIntentId,
    status: "pending",
    createdAt: "2026-05-06T00:00:00.000Z",
  };
}

describe("order-storage", () => {
  it("getOrderByPaymentIntent returns the matching order", async () => {
    await saveOrder(makeOrder("o1", "pi_111"));
    await saveOrder(makeOrder("o2", "pi_222"));
    const found = await getOrderByPaymentIntent("pi_222");
    expect(found?.id).toBe("o2");
  });

  it("getOrderByPaymentIntent returns null when no match", async () => {
    await saveOrder(makeOrder("o1", "pi_111"));
    const found = await getOrderByPaymentIntent("pi_does_not_exist");
    expect(found).toBeNull();
  });

  it("updateOrderPaymentIntent attaches the PI id", async () => {
    await saveOrder(makeOrder("o1"));
    await updateOrderPaymentIntent("o1", "pi_999");
    const o = await getOrder("o1");
    expect(o?.stripePaymentIntentId).toBe("pi_999");
  });

  it("updateOrderStatusByPaymentIntent flips pending → paid", async () => {
    await saveOrder(makeOrder("o1", "pi_111"));
    await updateOrderStatusByPaymentIntent("pi_111", "paid");
    const o = await getOrder("o1");
    expect(o?.status).toBe("paid");
  });

  it("updateOrderStatusByPaymentIntent is a no-op when order already in target status", async () => {
    const order = makeOrder("o1", "pi_111");
    order.status = "paid";
    await saveOrder(order);
    await updateOrderStatusByPaymentIntent("pi_111", "paid");
    const o = await getOrder("o1");
    expect(o?.status).toBe("paid");
  });

  it("updateOrderStatusByPaymentIntent does NOT downgrade paid → failed", async () => {
    const order = makeOrder("o1", "pi_111");
    order.status = "paid";
    await saveOrder(order);
    await updateOrderStatusByPaymentIntent("pi_111", "failed");
    const o = await getOrder("o1");
    // Webhook events can arrive out of order; once paid, stay paid.
    expect(o?.status).toBe("paid");
  });

  it("updateOrderStatusByPaymentIntent silently ignores unknown PI", async () => {
    await expect(
      updateOrderStatusByPaymentIntent("pi_does_not_exist", "paid"),
    ).resolves.not.toThrow();
  });
});
```

- [ ] **Step 2: Run tests — they should fail**

```bash
pnpm test tests/unit/order-storage.test.ts
```

Expected: `getOrderByPaymentIntent`, `updateOrderPaymentIntent`, `updateOrderStatusByPaymentIntent` don't exist → import error / TypeError.

- [ ] **Step 3: Implement the helpers**

Replace `lib/order-storage.ts` entirely:

```ts
// lib/order-storage.ts
import { promises as fs } from "node:fs";
import path from "node:path";
import type { Order, OrderStatus } from "@/types/order";

const FILE = path.join(process.cwd(), "pending-orders.json");

async function readAll(): Promise<Order[]> {
  try {
    const raw = await fs.readFile(FILE, "utf8");
    return JSON.parse(raw) as Order[];
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw e;
  }
}

async function writeAll(all: Order[]): Promise<void> {
  await fs.writeFile(FILE, JSON.stringify(all, null, 2), "utf8");
}

export async function saveOrder(order: Order): Promise<void> {
  const all = await readAll();
  all.push(order);
  await writeAll(all);
}

export async function getOrder(id: string): Promise<Order | null> {
  const all = await readAll();
  return all.find((o) => o.id === id) ?? null;
}

export async function getOrderByPaymentIntent(piId: string): Promise<Order | null> {
  const all = await readAll();
  return all.find((o) => o.stripePaymentIntentId === piId) ?? null;
}

export async function updateOrderPaymentIntent(
  orderId: string,
  paymentIntentId: string,
): Promise<void> {
  const all = await readAll();
  const idx = all.findIndex((o) => o.id === orderId);
  if (idx < 0) return;
  all[idx] = { ...all[idx], stripePaymentIntentId: paymentIntentId };
  await writeAll(all);
}

// `paid` is terminal; never downgrade. Other transitions overwrite.
const TERMINAL: OrderStatus[] = ["paid", "delivered"];

export async function updateOrderStatusByPaymentIntent(
  paymentIntentId: string,
  status: OrderStatus,
): Promise<void> {
  const all = await readAll();
  const idx = all.findIndex((o) => o.stripePaymentIntentId === paymentIntentId);
  if (idx < 0) return;
  const current = all[idx].status;
  if (TERMINAL.includes(current) && current !== status) return;
  if (current === status) return;
  all[idx] = { ...all[idx], status };
  await writeAll(all);
}
```

- [ ] **Step 4: Run tests — they should pass**

```bash
pnpm test tests/unit/order-storage.test.ts
```

Expected: all 7 cases pass.

- [ ] **Step 5: Run full test suite to confirm nothing else broke**

```bash
pnpm test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add tests/unit/order-storage.test.ts lib/order-storage.ts
git commit -m "feat(orders): storage helpers for PaymentIntent lookup and status updates"
```

---

## Task 4: `POST /api/checkout/intent` (TDD)

**Files:**
- Create: `tests/unit/api-checkout-intent.test.ts`
- Create: `app/api/checkout/intent/route.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/api-checkout-intent.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";

const createPI = vi.fn();
vi.mock("@/lib/stripe-server", () => ({
  stripe: {
    paymentIntents: { create: createPI },
  },
}));

const FILE = path.join(process.cwd(), "pending-orders.json");
let backup: string | null = null;

beforeEach(async () => {
  try {
    backup = await fs.readFile(FILE, "utf8");
  } catch {
    backup = null;
  }
  await fs.writeFile(FILE, "[]", "utf8");
  createPI.mockReset();
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_dummy");
});
afterEach(async () => {
  if (backup === null) {
    try { await fs.unlink(FILE); } catch {}
  } else {
    await fs.writeFile(FILE, backup, "utf8");
  }
  vi.unstubAllEnvs();
});

function makeReq(body: unknown) {
  return new Request("http://localhost/api/checkout/intent", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validBody = {
  locale: "en",
  // Use a real product/variant from data/products.ts (engineer: pick one with priceCents > 0).
  // For the test we only need the cart to resolve to a positive subtotal.
  lines: [
    { productId: "TIMELESS_ROMANCE_ID", variantId: "TIMELESS_ROMANCE_VARIANT_ID", addOnIds: [], qty: 1 },
  ],
  form: {
    contact: { email: "buyer@example.com", phone: "5165551234" },
    delivery: {
      recipient: { name: "Recipient Name", phone: "5165551234" },
      address: {
        street1: "1 Main St",
        street2: "",
        city: "Albertson",
        state: "NY",
        zip: "11507",
        country: "US",
      },
      window: { date: "2099-01-01", slot: "midday" },
      cardMessage: "",
    },
  },
};

describe("POST /api/checkout/intent", () => {
  it("returns 400 on invalid body", async () => {
    const { POST } = await import("@/app/api/checkout/intent/route");
    const res = await POST(makeReq({ bogus: 1 }));
    expect(res.status).toBe(400);
  });

  it("returns 400 with cart_empty when cart resolves to 0 subtotal", async () => {
    const { POST } = await import("@/app/api/checkout/intent/route");
    const res = await POST(makeReq({
      ...validBody,
      lines: [{ productId: "DOES_NOT_EXIST", variantId: "X", addOnIds: [], qty: 1 }],
    }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.errors.formErrors).toContain("cart_empty");
  });

  it("returns 400 with zip_not_in_zone when ZIP not covered", async () => {
    const { POST } = await import("@/app/api/checkout/intent/route");
    const res = await POST(makeReq({
      ...validBody,
      form: {
        ...validBody.form,
        delivery: {
          ...validBody.form.delivery,
          address: { ...validBody.form.delivery.address, zip: "90001" },
        },
      },
    }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.errors.formErrors).toContain("zip_not_in_zone");
  });

  it("returns 200 with clientSecret + orderId on happy path", async () => {
    createPI.mockResolvedValue({
      id: "pi_test_123",
      client_secret: "pi_test_123_secret_abc",
    });
    const { POST } = await import("@/app/api/checkout/intent/route");
    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.clientSecret).toBe("pi_test_123_secret_abc");
    expect(json.orderId).toMatch(/^do_/);
  });

  it("passes idempotencyKey = orderId to PaymentIntents.create", async () => {
    createPI.mockResolvedValue({ id: "pi_test_123", client_secret: "secret" });
    const { POST } = await import("@/app/api/checkout/intent/route");
    await POST(makeReq(validBody));
    expect(createPI).toHaveBeenCalledTimes(1);
    const [_params, options] = createPI.mock.calls[0];
    expect(options).toMatchObject({ idempotencyKey: expect.stringMatching(/^do_/) });
  });

  it("returns 502 with payment_init_failed if Stripe throws", async () => {
    createPI.mockRejectedValue(new Error("stripe down"));
    const { POST } = await import("@/app/api/checkout/intent/route");
    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(502);
    const json = await res.json();
    expect(json.errors.formErrors).toContain("payment_init_failed");
  });
});
```

> **Note for the engineer:** in the `validBody` constant, replace `TIMELESS_ROMANCE_ID` and `TIMELESS_ROMANCE_VARIANT_ID` with a real `product.id` and `variants[0].id` from `data/products.ts` so the cart resolver returns a positive subtotal. Pick any in-stock product with a non-empty variants array.

- [ ] **Step 2: Run tests — they should fail**

```bash
pnpm test tests/unit/api-checkout-intent.test.ts
```

Expected: `Cannot find module '@/app/api/checkout/intent/route'`.

- [ ] **Step 3: Create the route handler**

Create `app/api/checkout/intent/route.ts`:

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { checkoutSchema } from "@/schemas/checkout";
import { computeOrderTotals, computeDeliveryCentsForZip } from "@/lib/totals";
import { cartSubtotalCents } from "@/lib/cart-helpers";
import { PRODUCTS } from "@/data/products";
import { saveOrder, updateOrderPaymentIntent } from "@/lib/order-storage";
import { stripe } from "@/lib/stripe-server";
import type { Order } from "@/types/order";
import type { CartLine } from "@/lib/cart-store";

export const runtime = "nodejs";

const cartLineSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().min(1),
  addOnIds: z.array(z.string()),
  qty: z.number().int().min(1).max(99),
});

const requestSchema = z.object({
  locale: z.enum(["en", "es"]),
  lines: z.array(cartLineSchema).min(1, "cart_empty"),
  form: checkoutSchema,
});

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = requestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ errors: parsed.error.flatten() }, { status: 400 });
  }
  const { locale, lines, form } = parsed.data;

  const subtotal = cartSubtotalCents(lines as CartLine[], PRODUCTS);
  if (subtotal <= 0) {
    return NextResponse.json(
      { errors: { formErrors: ["cart_empty"] } },
      { status: 400 },
    );
  }

  const deliveryCents = computeDeliveryCentsForZip(form.delivery.address.zip);
  if (deliveryCents === null) {
    return NextResponse.json(
      { errors: { formErrors: ["zip_not_in_zone"] } },
      { status: 400 },
    );
  }

  const totals = computeOrderTotals(subtotal, deliveryCents);
  const orderId = `do_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  const order: Order = {
    id: orderId,
    locale,
    lines: lines as CartLine[],
    delivery: {
      recipient: form.delivery.recipient,
      address: form.delivery.address,
      window: form.delivery.window,
      cardMessage: form.delivery.cardMessage || undefined,
    },
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

  try {
    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: totals.totalCents,
        currency: "usd",
        automatic_payment_methods: { enabled: true },
        metadata: { orderId, locale },
        receipt_email: form.contact.email,
      },
      { idempotencyKey: orderId },
    );
    await updateOrderPaymentIntent(orderId, paymentIntent.id);
    return NextResponse.json(
      { clientSecret: paymentIntent.client_secret, orderId },
      { status: 200 },
    );
  } catch (e) {
    console.error("[stripe] paymentIntents.create failed", e);
    return NextResponse.json(
      { errors: { formErrors: ["payment_init_failed"] } },
      { status: 502 },
    );
  }
}
```

- [ ] **Step 4: Run tests — they should pass**

```bash
pnpm test tests/unit/api-checkout-intent.test.ts
```

Expected: all 6 cases pass.

- [ ] **Step 5: Commit**

```bash
git add tests/unit/api-checkout-intent.test.ts app/api/checkout/intent/route.ts
git commit -m "feat(checkout): POST /api/checkout/intent creates pending order + PaymentIntent"
```

---

## Task 5: `POST /api/stripe/webhook` (TDD)

**Files:**
- Create: `tests/unit/api-stripe-webhook.test.ts`
- Create: `app/api/stripe/webhook/route.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/api-stripe-webhook.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { saveOrder, getOrder } from "@/lib/order-storage";
import type { Order } from "@/types/order";

const constructEvent = vi.fn();
vi.mock("@/lib/stripe-server", () => ({
  stripe: {
    webhooks: { constructEvent },
  },
}));

const FILE = path.join(process.cwd(), "pending-orders.json");
let backup: string | null = null;

beforeEach(async () => {
  try {
    backup = await fs.readFile(FILE, "utf8");
  } catch {
    backup = null;
  }
  await fs.writeFile(FILE, "[]", "utf8");
  constructEvent.mockReset();
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_dummy");
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_dummy");
});
afterEach(async () => {
  if (backup === null) {
    try { await fs.unlink(FILE); } catch {}
  } else {
    await fs.writeFile(FILE, backup, "utf8");
  }
  vi.unstubAllEnvs();
});

function makeReq(body: string, sig: string | null = "test_sig") {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (sig !== null) headers["stripe-signature"] = sig;
  return new Request("http://localhost/api/stripe/webhook", {
    method: "POST",
    headers,
    body,
  });
}

function makeOrder(id: string, piId: string, status: Order["status"] = "pending"): Order {
  return {
    id,
    locale: "en",
    lines: [],
    delivery: {
      recipient: { name: "T", phone: "5555555555" },
      address: { street1: "1", city: "Albertson", state: "NY", zip: "11507", country: "US" },
      window: { date: "2099-01-01", slot: "midday" },
    },
    contact: { email: "t@example.com", phone: "5555555555" },
    totals: { subtotalCents: 1000, deliveryCents: 1000, taxCents: 173, totalCents: 2173 },
    stripePaymentIntentId: piId,
    status,
    createdAt: "2026-05-06T00:00:00.000Z",
  };
}

describe("POST /api/stripe/webhook", () => {
  it("returns 400 when stripe-signature header is missing", async () => {
    const { POST } = await import("@/app/api/stripe/webhook/route");
    const res = await POST(makeReq("{}", null));
    expect(res.status).toBe(400);
  });

  it("returns 400 when signature verification throws", async () => {
    constructEvent.mockImplementation(() => { throw new Error("bad sig"); });
    const { POST } = await import("@/app/api/stripe/webhook/route");
    const res = await POST(makeReq("{}"));
    expect(res.status).toBe(400);
  });

  it("returns 200 and updates order to paid on payment_intent.succeeded", async () => {
    await saveOrder(makeOrder("o1", "pi_111"));
    constructEvent.mockReturnValue({
      type: "payment_intent.succeeded",
      data: { object: { id: "pi_111" } },
    });
    const { POST } = await import("@/app/api/stripe/webhook/route");
    const res = await POST(makeReq("{}"));
    expect(res.status).toBe(200);
    const o = await getOrder("o1");
    expect(o?.status).toBe("paid");
  });

  it("returns 200 and updates order to failed on payment_intent.payment_failed", async () => {
    await saveOrder(makeOrder("o1", "pi_111"));
    constructEvent.mockReturnValue({
      type: "payment_intent.payment_failed",
      data: { object: { id: "pi_111" } },
    });
    const { POST } = await import("@/app/api/stripe/webhook/route");
    await POST(makeReq("{}"));
    const o = await getOrder("o1");
    expect(o?.status).toBe("failed");
  });

  it("returns 200 and updates order to canceled on payment_intent.canceled", async () => {
    await saveOrder(makeOrder("o1", "pi_111"));
    constructEvent.mockReturnValue({
      type: "payment_intent.canceled",
      data: { object: { id: "pi_111" } },
    });
    const { POST } = await import("@/app/api/stripe/webhook/route");
    await POST(makeReq("{}"));
    const o = await getOrder("o1");
    expect(o?.status).toBe("canceled");
  });

  it("returns 200 silently on unknown event types", async () => {
    constructEvent.mockReturnValue({
      type: "customer.created",
      data: { object: {} },
    });
    const { POST } = await import("@/app/api/stripe/webhook/route");
    const res = await POST(makeReq("{}"));
    expect(res.status).toBe(200);
  });

  it("is idempotent: same event applied twice is a no-op", async () => {
    await saveOrder(makeOrder("o1", "pi_111", "paid"));
    constructEvent.mockReturnValue({
      type: "payment_intent.succeeded",
      data: { object: { id: "pi_111" } },
    });
    const { POST } = await import("@/app/api/stripe/webhook/route");
    await POST(makeReq("{}"));
    await POST(makeReq("{}"));
    const o = await getOrder("o1");
    expect(o?.status).toBe("paid");
  });

  it("returns 200 silently when PI id has no matching order", async () => {
    constructEvent.mockReturnValue({
      type: "payment_intent.succeeded",
      data: { object: { id: "pi_does_not_exist" } },
    });
    const { POST } = await import("@/app/api/stripe/webhook/route");
    const res = await POST(makeReq("{}"));
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 2: Run tests — they should fail**

```bash
pnpm test tests/unit/api-stripe-webhook.test.ts
```

Expected: `Cannot find module '@/app/api/stripe/webhook/route'`.

- [ ] **Step 3: Create the webhook handler**

Create `app/api/stripe/webhook/route.ts`:

```ts
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe-server";
import { updateOrderStatusByPaymentIntent } from "@/lib/order-storage";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new NextResponse("missing signature", { status: 400 });
  }

  const body = await req.text();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[stripe] STRIPE_WEBHOOK_SECRET not set");
    return new NextResponse("server misconfigured", { status: 500 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, secret);
  } catch (e) {
    console.error("[stripe] invalid webhook signature", e);
    return new NextResponse("invalid signature", { status: 400 });
  }

  try {
    switch (event.type) {
      case "payment_intent.succeeded": {
        const pi = event.data.object as Stripe.PaymentIntent;
        await updateOrderStatusByPaymentIntent(pi.id, "paid");
        break;
      }
      case "payment_intent.payment_failed": {
        const pi = event.data.object as Stripe.PaymentIntent;
        await updateOrderStatusByPaymentIntent(pi.id, "failed");
        break;
      }
      case "payment_intent.canceled": {
        const pi = event.data.object as Stripe.PaymentIntent;
        await updateOrderStatusByPaymentIntent(pi.id, "canceled");
        break;
      }
      default:
        // Ignore other events; do not 5xx (Stripe would retry).
        break;
    }
    return NextResponse.json({ received: true });
  } catch (e) {
    console.error("[stripe] webhook handler failed", e);
    return new NextResponse("handler failed", { status: 500 });
  }
}
```

- [ ] **Step 4: Run tests — they should pass**

```bash
pnpm test tests/unit/api-stripe-webhook.test.ts
```

Expected: all 8 cases pass.

- [ ] **Step 5: Commit**

```bash
git add tests/unit/api-stripe-webhook.test.ts app/api/stripe/webhook/route.ts
git commit -m "feat(stripe): webhook handler for payment_intent events"
```

---

## Task 6: `GET /api/order/[id]/status` (TDD)

**Files:**
- Create: `tests/unit/api-order-status.test.ts`
- Create: `app/api/order/[id]/status/route.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/api-order-status.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { saveOrder } from "@/lib/order-storage";
import type { Order } from "@/types/order";

const FILE = path.join(process.cwd(), "pending-orders.json");
let backup: string | null = null;

beforeEach(async () => {
  try { backup = await fs.readFile(FILE, "utf8"); } catch { backup = null; }
  await fs.writeFile(FILE, "[]", "utf8");
});
afterEach(async () => {
  if (backup === null) {
    try { await fs.unlink(FILE); } catch {}
  } else {
    await fs.writeFile(FILE, backup, "utf8");
  }
});

function makeOrder(id: string, status: Order["status"]): Order {
  return {
    id,
    locale: "en",
    lines: [],
    delivery: {
      recipient: { name: "T", phone: "5555555555" },
      address: { street1: "1", city: "Albertson", state: "NY", zip: "11507", country: "US" },
      window: { date: "2099-01-01", slot: "midday" },
    },
    contact: { email: "t@example.com", phone: "5555555555" },
    totals: { subtotalCents: 1000, deliveryCents: 1000, taxCents: 173, totalCents: 2173 },
    status,
    createdAt: "2026-05-06T00:00:00.000Z",
  };
}

describe("GET /api/order/[id]/status", () => {
  it("returns 200 with the status", async () => {
    await saveOrder(makeOrder("o1", "pending"));
    const { GET } = await import("@/app/api/order/[id]/status/route");
    const res = await GET(
      new Request("http://localhost/api/order/o1/status"),
      { params: Promise.resolve({ id: "o1" }) },
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe("pending");
  });

  it("returns 404 when order does not exist", async () => {
    const { GET } = await import("@/app/api/order/[id]/status/route");
    const res = await GET(
      new Request("http://localhost/api/order/nope/status"),
      { params: Promise.resolve({ id: "nope" }) },
    );
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run tests — they should fail**

```bash
pnpm test tests/unit/api-order-status.test.ts
```

Expected: module not found.

- [ ] **Step 3: Create the route**

Create `app/api/order/[id]/status/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getOrder } from "@/lib/order-storage";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const order = await getOrder(id);
  if (!order) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ status: order.status });
}
```

- [ ] **Step 4: Run tests — they should pass**

```bash
pnpm test tests/unit/api-order-status.test.ts
```

Expected: 2/2 pass.

- [ ] **Step 5: Commit**

```bash
git add tests/unit/api-order-status.test.ts app/api/order/\[id\]/status/route.ts
git commit -m "feat(orders): GET /api/order/[id]/status for confirmation polling"
```

---

## Task 7: `StripePaymentStep` component

**Files:**
- Create: `components/checkout/StripePaymentStep.tsx`

(No unit test: this component is a thin wrapper around Stripe iframes; behavior is covered by manual smoke test and CheckoutShell integration.)

- [ ] **Step 1: Create the component**

Create `components/checkout/StripePaymentStep.tsx`:

```tsx
"use client";
import { useEffect } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import type { Stripe as StripeJs, StripeElements } from "@stripe/stripe-js";
import { CreditCard } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";
import { getStripeClient } from "@/lib/stripe-client";

const stripePromise = getStripeClient();

type Props = {
  clientSecret: string;
  onReady: (stripe: StripeJs, elements: StripeElements) => void;
  errorMessage?: string | null;
};

function ElementsBridge({
  onReady,
  errorMessage,
}: {
  onReady: Props["onReady"];
  errorMessage?: string | null;
}) {
  const t = useTranslations("checkout");
  const stripe = useStripe();
  const elements = useElements();

  useEffect(() => {
    if (stripe && elements) onReady(stripe, elements);
  }, [stripe, elements, onReady]);

  return (
    <div className="rounded-2xl border border-ink/10 bg-bone/60 p-5 space-y-4">
      <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-ink/60">
        <CreditCard size={14} />
        {t("payment_label")}
      </div>
      <PaymentElement options={{ layout: "tabs" }} />
      {errorMessage && (
        <p className="font-mono text-[11px] text-error">{errorMessage}</p>
      )}
    </div>
  );
}

export function StripePaymentStep({ clientSecret, onReady, errorMessage }: Props) {
  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance: {
          theme: "stripe",
          variables: {
            fontFamily: "system-ui, sans-serif",
            colorPrimary: "#1a1a1a",
          },
        },
      }}
    >
      <ElementsBridge onReady={onReady} errorMessage={errorMessage} />
    </Elements>
  );
}
```

- [ ] **Step 2: Add the i18n key for `payment_label`**

In `messages/en.json`, find the `"checkout"` namespace and add inside it:

```json
"payment_label": "Card details"
```

In `messages/es.json`, find the `"checkout"` namespace and add inside it:

```json
"payment_label": "Datos de tarjeta"
```

(Place them next to the other `payment_*` keys that already exist for `PaymentStub`. Don't delete those yet — Task 8 deletes `PaymentStub` and we'll clean up the unused keys then.)

- [ ] **Step 3: Run typecheck**

```bash
pnpm exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/checkout/StripePaymentStep.tsx messages/en.json messages/es.json
git commit -m "feat(checkout): StripePaymentStep component wrapping Elements + PaymentElement"
```

---

## Task 8: Wire `CheckoutShell` to `/intent` + `confirmPayment`

This is the cut-over task. After this commit, the site uses Stripe end-to-end (modulo confirmation page polling, added in Task 9).

**Files:**
- Modify: `components/checkout/CheckoutShell.tsx`
- Delete: `components/checkout/PaymentStub.tsx`
- Delete: `lib/submit-order.ts`
- Delete: `app/api/checkout/route.ts`

- [ ] **Step 1: Replace `CheckoutShell.tsx`**

Replace the entire file with:

```tsx
// components/checkout/CheckoutShell.tsx
"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { CaretDown } from "@phosphor-icons/react/dist/ssr";
import type { Stripe as StripeJs, StripeElements } from "@stripe/stripe-js";
import { Button } from "@/components/ui/Button";
import { ContactStep } from "@/components/checkout/ContactStep";
import { DeliveryStep } from "@/components/checkout/DeliveryStep";
import { StripePaymentStep } from "@/components/checkout/StripePaymentStep";
import { FormShell } from "@/components/ui/form/shell/FormShell";
import { OrderSummaryPanel } from "@/components/checkout/OrderSummaryPanel";
import { FormSubmit } from "@/components/ui/form/FormSubmit";
import { useCartStore } from "@/lib/cart-store";
import { useUIStore } from "@/lib/ui-store";
import { checkoutSchema, type CheckoutInput } from "@/schemas/checkout";
import { resolveCartLines, cartSubtotalCents } from "@/lib/cart-helpers";
import { computeOrderTotals, computeDeliveryCentsForZip } from "@/lib/totals";
import { PRODUCTS } from "@/data/products";
import type { Locale } from "@/types/locale";
import { springs } from "@/lib/motion-config";
import {
  trackBeginCheckout,
  trackAddShippingInfo,
  trackAddPaymentInfo,
  trackRecipientInfoCompleted,
} from "@/lib/analytics";
import { resolvedLineToAnalyticsItem } from "@/lib/analytics-types";

type StepKey = "contact" | "delivery" | "payment";

type IntentState =
  | { status: "idle" }
  | { status: "creating" }
  | { status: "ready"; clientSecret: string; orderId: string; amountCents: number }
  | { status: "error"; message: string };

async function createIntent(payload: {
  locale: Locale;
  lines: ReturnType<typeof useCartStore.getState>["lines"];
  form: CheckoutInput;
}): Promise<{ clientSecret: string; orderId: string } | { error: string }> {
  const res = await fetch("/api/checkout/intent", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const code = data?.errors?.formErrors?.[0] ?? "unknown_error";
    return { error: code };
  }
  return { clientSecret: data.clientSecret, orderId: data.orderId };
}

export function CheckoutShell({ locale }: { locale: Locale }) {
  const t = useTranslations("checkout");
  const router = useRouter();
  const reduce = useReducedMotion();
  const lines = useCartStore((s) => s.lines);
  const clear = useCartStore((s) => s.clear);
  const closeDrawer = useUIStore((s) => s.closeDrawer);

  const resolved = useMemo(() => resolveCartLines(lines, PRODUCTS), [lines]);
  const subtotal = useMemo(() => cartSubtotalCents(lines, PRODUCTS), [lines]);

  useEffect(() => {
    if (resolved.length === 0) return;
    trackBeginCheckout(resolved.map(resolvedLineToAnalyticsItem));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const form = useForm<CheckoutInput>({
    resolver: zodResolver(checkoutSchema),
    mode: "onBlur",
    defaultValues: {
      contact: { email: "", phone: "" },
      delivery: {
        recipient: { name: "", phone: "" },
        address: { street1: "", street2: "", city: "", state: "NY", zip: "", country: "US" },
        window: { date: "", slot: "midday" },
        cardMessage: "",
      },
    },
  });

  const [open, setOpen] = useState<StepKey>("contact");
  const [submitting, setSubmitting] = useState(false);
  const [topError, setTopError] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [intent, setIntent] = useState<IntentState>({ status: "idle" });
  const stripeRef = useRef<{ stripe: StripeJs; elements: StripeElements } | null>(null);

  const zipValue = form.watch("delivery.address.zip");
  const deliveryCents = computeDeliveryCentsForZip(zipValue ?? "");
  const deliveryPending = deliveryCents === null;
  const totals = useMemo(
    () => computeOrderTotals(subtotal, deliveryCents ?? 0),
    [subtotal, deliveryCents],
  );

  // Recreate the PaymentIntent if the amount changes after we already have one.
  useEffect(() => {
    if (intent.status !== "ready") return;
    if (totals.totalCents === intent.amountCents) return;
    if (totals.totalCents <= 0) return;
    let cancelled = false;
    (async () => {
      const r = await createIntent({ locale, lines, form: form.getValues() });
      if (cancelled) return;
      if ("error" in r) {
        setIntent({ status: "error", message: r.error });
      } else {
        setIntent({
          status: "ready",
          clientSecret: r.clientSecret,
          orderId: r.orderId,
          amountCents: totals.totalCents,
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [totals.totalCents, intent, locale, lines, form]);

  async function nextFrom(step: StepKey) {
    const fields: Record<StepKey, string[]> = {
      contact: ["contact.email", "contact.phone"],
      delivery: [
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
      payment: [],
    };
    const valid = await form.trigger(fields[step] as never);
    if (!valid) return;

    if (step === "delivery") {
      const items = resolved.map(resolvedLineToAnalyticsItem);
      trackAddShippingInfo("standard", items);
      const cardMessage = form.getValues("delivery.cardMessage") ?? "";
      trackRecipientInfoCompleted(cardMessage.trim().length > 0);
      trackAddPaymentInfo("card", items);

      // Create the PaymentIntent before showing step 3.
      setIntent({ status: "creating" });
      const r = await createIntent({ locale, lines, form: form.getValues() });
      if ("error" in r) {
        setIntent({ status: "error", message: r.error });
        setTopError(t(`errors.${r.error}`, { default: t("errors.unknown_error") }));
        return;
      }
      setIntent({
        status: "ready",
        clientSecret: r.clientSecret,
        orderId: r.orderId,
        amountCents: totals.totalCents,
      });
    }
    setOpen(step === "contact" ? "delivery" : "payment");
  }

  async function onSubmit() {
    setTopError(null);
    setPaymentError(null);
    if (lines.length === 0) {
      setTopError(t("errors.cart_empty"));
      return;
    }
    if (intent.status !== "ready") {
      setTopError(t("errors.unknown_error"));
      return;
    }
    if (!stripeRef.current) {
      setTopError(t("errors.unknown_error"));
      return;
    }

    setSubmitting(true);
    const { stripe, elements } = stripeRef.current;
    const result = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/${locale}/order/${intent.orderId}/confirmation`,
      },
      redirect: "if_required",
    });

    if (result.error) {
      setSubmitting(false);
      setPaymentError(result.error.message ?? t("errors.unknown_error"));
      return;
    }

    // Success without redirect: navigate manually.
    clear();
    closeDrawer();
    router.push(`/${locale}/order/${intent.orderId}/confirmation`);
  }

  const leftPanel = (
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
      locale={locale}
      eyebrow={t("summary")}
    />
  );

  return (
    <FormShell left={leftPanel}>
      <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }} className="space-y-3">
        <Section
          title={`1. ${t("step_contact")}`}
          isOpen={open === "contact"}
          onHeaderClick={() => setOpen("contact")}
          reduce={!!reduce}
        >
          <ContactStep form={form} />
          <div className="pt-4">
            <Button type="button" variant="primary" size="md" onClick={() => nextFrom("contact")}>
              {t("continue")}
            </Button>
          </div>
        </Section>

        <Section
          title={`2. ${t("step_delivery")}`}
          isOpen={open === "delivery"}
          onHeaderClick={() => setOpen("delivery")}
          reduce={!!reduce}
        >
          <DeliveryStep form={form} />
          <div className="pt-4 flex gap-3">
            <Button type="button" variant="ghost" size="md" onClick={() => setOpen("contact")}>
              {t("back")}
            </Button>
            <Button
              type="button"
              variant="primary"
              size="md"
              loading={intent.status === "creating"}
              onClick={() => nextFrom("delivery")}
            >
              {t("continue")}
            </Button>
          </div>
        </Section>

        <Section
          title={`3. ${t("step_payment")}`}
          isOpen={open === "payment"}
          onHeaderClick={() => setOpen("payment")}
          reduce={!!reduce}
        >
          {intent.status === "ready" && (
            <StripePaymentStep
              clientSecret={intent.clientSecret}
              onReady={(stripe, elements) => {
                stripeRef.current = { stripe, elements };
              }}
              errorMessage={paymentError}
            />
          )}
          {intent.status === "creating" && (
            <p className="font-mono text-[11px] text-ink/60">{t("payment_loading")}</p>
          )}
          {intent.status === "error" && (
            <p className="font-mono text-[11px] text-error">
              {t(`errors.${intent.message}`, { default: t("errors.unknown_error") })}
            </p>
          )}
          {topError && <p className="font-mono text-[11px] text-error">{topError}</p>}
          <div className="pt-4 flex gap-3">
            <Button type="button" variant="ghost" size="md" onClick={() => setOpen("delivery")}>
              {t("back")}
            </Button>
            <FormSubmit loading={submitting} fullWidth={false}>
              {t("place_order")}
            </FormSubmit>
          </div>
        </Section>
      </form>
    </FormShell>
  );
}

function Section({
  title,
  isOpen,
  onHeaderClick,
  reduce,
  children,
}: {
  title: string;
  isOpen: boolean;
  onHeaderClick: () => void;
  reduce: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-ink/10 bg-bone/40 overflow-hidden">
      <button
        type="button"
        onClick={onHeaderClick}
        aria-expanded={isOpen}
        className="w-full flex items-center justify-between px-5 py-4 text-left"
      >
        <span className="font-display text-xl text-ink">{title}</span>
        <CaretDown size={16} className={`transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="body"
            initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={reduce ? { opacity: 1 } : { height: "auto", opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={reduce ? { duration: 0 } : springs.soft}
            className="overflow-hidden"
          >
            <div className="px-5 pb-6 space-y-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
```

- [ ] **Step 2: Add the new i18n keys**

In `messages/en.json`, inside the `"checkout"` namespace, ensure these keys exist (add `payment_loading` if missing; the others should already exist for `PaymentStub`):

```json
"payment_loading": "Loading payment form…",
"errors": {
  "cart_empty": "Your cart is empty.",
  "zip_not_in_zone": "We don't deliver to that ZIP yet.",
  "payment_init_failed": "We couldn't start the payment. Please try again.",
  "unknown_error": "Something went wrong. Please try again."
}
```

(If `errors` already exists with some of these, merge — don't replace. The existing `cart_empty` and `unknown_error` keys can stay as-is.)

In `messages/es.json`, the same with Spanish translations:

```json
"payment_loading": "Cargando formulario de pago…",
"errors": {
  "cart_empty": "Tu carrito está vacío.",
  "zip_not_in_zone": "Aún no entregamos en ese código postal.",
  "payment_init_failed": "No pudimos iniciar el pago. Intenta de nuevo.",
  "unknown_error": "Algo salió mal. Intenta de nuevo."
}
```

- [ ] **Step 3: Delete the obsolete files**

```bash
rm components/checkout/PaymentStub.tsx
rm lib/submit-order.ts
rm app/api/checkout/route.ts
```

If `messages/{en,es}.json` had `payment_stub_label`, `payment_stub_body`, `payment_stub_processing` keys that are now unused, delete those entries too.

- [ ] **Step 4: Run typecheck and tests**

```bash
pnpm exec tsc --noEmit
pnpm test
```

Expected: typecheck clean, all tests pass. (The old `submit-order` had no test, so deletion is safe.)

- [ ] **Step 5: Manual smoke (in dev)**

Open two terminals:

```bash
# Terminal 1
pnpm dev
```

```bash
# Terminal 2
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Copy the `whsec_...` printed by `stripe listen` into `.env.local` as `STRIPE_WEBHOOK_SECRET=whsec_...`, then restart Terminal 1.

Browser:
1. Add a product to the cart.
2. Go to `/es/checkout`.
3. Fill contact + delivery (use ZIP `11507` for Albertson).
4. Click "Continuar" on step 2 — Payment Element should load on step 3.
5. Card: `4242 4242 4242 4242`, `12/34`, CVC `123`, ZIP `10001`.
6. Click "Place order".
7. Verify redirect to `/es/order/<orderId>/confirmation` (page may show "pending" briefly — that's expected; Task 9 fixes the polling UI).
8. Verify in Terminal 2 that `payment_intent.succeeded` was forwarded.
9. Verify `pending-orders.json` shows `status: "paid"` for the new order.

If any step fails, fix before committing.

- [ ] **Step 6: Commit**

```bash
git add components/checkout/CheckoutShell.tsx messages/en.json messages/es.json
git rm components/checkout/PaymentStub.tsx lib/submit-order.ts app/api/checkout/route.ts
git commit -m "feat(checkout): replace stub with Stripe PaymentElement + confirmPayment flow"
```

---

## Task 9: Confirmation page — handle pending/failed/canceled with polling

**Files:**
- Create: `components/checkout/ConfirmationPolling.tsx`
- Modify: `app/[locale]/order/[id]/confirmation/page.tsx`
- Modify: `messages/en.json`, `messages/es.json`

- [ ] **Step 1: Add the new i18n keys**

In `messages/en.json` inside the `"confirmation"` namespace, add:

```json
"processing_label": "Processing your payment",
"processing_body": "We're confirming with your bank. This usually takes a few seconds.",
"verifying_timeout": "We're still verifying your payment. You'll receive a confirmation email when it's complete.",
"failed_label": "Payment not completed",
"failed_body": "There was a problem with your payment. You can try again.",
"failed_cta": "Back to checkout",
"canceled_label": "Payment canceled",
"canceled_body": "You canceled the payment. Your cart is still available."
```

In `messages/es.json` inside the `"confirmation"` namespace, add:

```json
"processing_label": "Procesando tu pago",
"processing_body": "Estamos confirmando con tu banco. Esto suele tardar unos segundos.",
"verifying_timeout": "Aún estamos verificando tu pago. Recibirás un email de confirmación cuando se complete.",
"failed_label": "Pago no completado",
"failed_body": "Hubo un problema con tu pago. Puedes intentar de nuevo.",
"failed_cta": "Volver al checkout",
"canceled_label": "Pago cancelado",
"canceled_body": "Cancelaste el pago. Tu carrito sigue disponible."
```

- [ ] **Step 2: Create `ConfirmationPolling.tsx`**

Create `components/checkout/ConfirmationPolling.tsx`:

```tsx
"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useCartStore } from "@/lib/cart-store";
import { Button } from "@/components/ui/Button";
import type { Locale } from "@/types/locale";
import type { OrderStatus } from "@/types/order";

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 15000;

type Props = {
  orderId: string;
  initialStatus: OrderStatus;
  locale: Locale;
};

type DisplayState =
  | { kind: "processing" }
  | { kind: "timeout" }
  | { kind: "paid" }
  | { kind: "failed" }
  | { kind: "canceled" };

function statusToDisplay(s: OrderStatus): DisplayState {
  if (s === "paid" || s === "preparing" || s === "out-for-delivery" || s === "delivered") {
    return { kind: "paid" };
  }
  if (s === "failed") return { kind: "failed" };
  if (s === "canceled") return { kind: "canceled" };
  return { kind: "processing" };
}

export function ConfirmationPolling({ orderId, initialStatus, locale }: Props) {
  const t = useTranslations("confirmation");
  const clearCart = useCartStore((s) => s.clear);
  const [display, setDisplay] = useState<DisplayState>(statusToDisplay(initialStatus));

  // Clear local cart whenever we land on a paid order (covers tab-close-after-pay edge case).
  useEffect(() => {
    if (display.kind === "paid") clearCart();
  }, [display.kind, clearCart]);

  useEffect(() => {
    if (display.kind !== "processing") return;
    let cancelled = false;
    const start = Date.now();
    let timer: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      if (cancelled) return;
      try {
        const res = await fetch(`/api/order/${orderId}/status`, { cache: "no-store" });
        if (res.ok) {
          const data = (await res.json()) as { status: OrderStatus };
          const next = statusToDisplay(data.status);
          if (next.kind !== "processing") {
            setDisplay(next);
            return;
          }
        }
      } catch {
        // network blip; keep polling
      }
      if (Date.now() - start >= POLL_TIMEOUT_MS) {
        setDisplay({ kind: "timeout" });
        return;
      }
      timer = setTimeout(poll, POLL_INTERVAL_MS);
    };

    timer = setTimeout(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [display.kind, orderId]);

  if (display.kind === "paid") {
    // Caller (page.tsx) renders the full ConfirmationView for paid orders. This
    // branch should not normally be hit; if it is (rare race), we render a tiny
    // success notice and let the user reload to see the full page.
    return (
      <div className="space-y-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-success">
          {t("paid_label")}
        </p>
        <p className="text-base text-ink/75">{t("body")}</p>
      </div>
    );
  }

  if (display.kind === "processing") {
    return (
      <div className="space-y-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink/55 animate-pulse">
          {t("processing_label")}
        </p>
        <p className="text-base text-ink/75 max-w-[58ch]">{t("processing_body")}</p>
      </div>
    );
  }

  if (display.kind === "timeout") {
    return (
      <div className="space-y-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink/55">
          {t("processing_label")}
        </p>
        <p className="text-base text-ink/75 max-w-[58ch]">{t("verifying_timeout")}</p>
      </div>
    );
  }

  if (display.kind === "failed") {
    return (
      <div className="space-y-4">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-error">
          {t("failed_label")}
        </p>
        <p className="text-base text-ink/75 max-w-[58ch]">{t("failed_body")}</p>
        <Button asChild variant="primary" size="md">
          <Link href={`/${locale}/checkout`}>{t("failed_cta")}</Link>
        </Button>
      </div>
    );
  }

  // canceled
  return (
    <div className="space-y-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink/55">
        {t("canceled_label")}
      </p>
      <p className="text-base text-ink/75 max-w-[58ch]">{t("canceled_body")}</p>
      <Button asChild variant="primary" size="md">
        <Link href={`/${locale}/checkout`}>{t("failed_cta")}</Link>
      </Button>
    </div>
  );
}
```

> **Note:** if `Button` doesn't support `asChild`, wrap with `<Link>` directly and style with `Button` className. Engineer should check `components/ui/Button.tsx` and adapt the rendering pattern to match what's used elsewhere in the codebase.

- [ ] **Step 3: Update the confirmation page**

Replace `app/[locale]/order/[id]/confirmation/page.tsx` with:

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ConfirmationView } from "@/components/checkout/ConfirmationView";
import { ConfirmationPolling } from "@/components/checkout/ConfirmationPolling";
import { getOrder } from "@/lib/order-storage";
import type { Locale } from "@/types/locale";
import { TrackEvent } from "@/components/analytics/TrackEvent";
import { resolveCartLines } from "@/lib/cart-helpers";
import { resolvedLineToAnalyticsItem, centsToDollars } from "@/lib/analytics-types";
import { PRODUCTS } from "@/data/products";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: { params: Promise<{ locale: Locale; id: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "confirmation" });
  return {
    title: t("page_title"),
    description: t("page_description"),
    robots: { index: false, follow: false },
  };
}

const PAID_STATUSES = new Set(["paid", "preparing", "out-for-delivery", "delivered"]);

export default async function ConfirmationPage({
  params,
}: { params: Promise<{ locale: Locale; id: string }> }) {
  const { locale, id } = await params;
  const order = await getOrder(id);
  if (!order) notFound();

  const isPaid = PAID_STATUSES.has(order.status);

  if (isPaid) {
    const resolved = resolveCartLines(order.lines, PRODUCTS);
    return (
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-32 pb-24">
        <TrackEvent
          kind="purchase"
          payload={{
            transaction_id: order.id,
            value: centsToDollars(order.totals.totalCents),
            tax: centsToDollars(order.totals.taxCents),
            shipping: centsToDollars(order.totals.deliveryCents),
            items: resolved.map(resolvedLineToAnalyticsItem),
          }}
        />
        <ConfirmationView order={order} locale={locale} />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-32 pb-24">
      <ConfirmationPolling
        orderId={order.id}
        initialStatus={order.status}
        locale={locale}
      />
    </main>
  );
}
```

- [ ] **Step 4: Run typecheck and tests**

```bash
pnpm exec tsc --noEmit
pnpm test
```

Expected: clean.

- [ ] **Step 5: Manual smoke — pending state**

With `pnpm dev` running but `stripe listen` **NOT** running:

1. Place an order with card `4242 4242 4242 4242`.
2. Land on `/order/<id>/confirmation`.
3. Verify "Procesando tu pago…" / "Processing your payment" UI appears.
4. After 15s, verify the timeout copy ("verifying_timeout") appears.
5. Now start `stripe listen --forward-to localhost:3000/api/stripe/webhook` in another terminal.
6. Wait — Stripe replays missed events from the last few minutes (the CLI does this automatically on connect).
7. Refresh the page → should now show the full paid confirmation.

(If Stripe doesn't replay, manually trigger via Dashboard → Developers → Events → find the PI event → "Resend".)

- [ ] **Step 6: Manual smoke — declined card**

Restart `stripe listen`, place an order with card `4000 0000 0000 9995`:
1. After "Place order", the Payment Element shows the decline message in step 3.
2. No redirect occurs.
3. Cart is intact.

(Note: this card may either decline at confirm time — staying on the checkout page — or confirm with a `payment_intent.payment_failed` webhook. The current spec accepts both; the failed-card UI in step 3 covers the first; the confirmation page `failed` state covers the second if the user is somehow redirected.)

- [ ] **Step 7: Commit**

```bash
git add components/checkout/ConfirmationPolling.tsx app/\[locale\]/order/\[id\]/confirmation/page.tsx messages/en.json messages/es.json
git commit -m "feat(order): poll status on confirmation page; handle pending/failed/canceled"
```

---

## Task 10: README documentation

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add a new "Pagos con Stripe" section to `README.md`**

Append at the end of the file (or wherever other "developer setup" notes live; check existing structure):

````markdown
## Pagos con Stripe

The checkout uses the embedded Stripe Payment Element. Payment state is driven
by webhooks; the local `pending-orders.json` is updated by
`POST /api/stripe/webhook`, never client-side.

### Required env vars (`.env.local`)

```
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

`whsec_...` comes from `stripe listen` in dev (next section), or from the
Dashboard webhook endpoint config in production.

### Dev workflow

Two terminals:

```bash
# Terminal 1
pnpm dev
```

```bash
# Terminal 2 — forwards Stripe events to your local webhook
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

The first time you run `stripe listen`, copy the `whsec_...` it prints into
`.env.local` as `STRIPE_WEBHOOK_SECRET=...` and restart Terminal 1. The secret
rotates per CLI session unless you reuse one — `stripe listen --print-secret`
prints the current secret without starting the listener.

### Test cards

- `4242 4242 4242 4242` — succeeds, no 3DS
- `4000 0025 0000 3155` — requires 3DS authentication
- `4000 0000 0000 9995` — insufficient funds (declined)
- `4000 0000 0000 0002` — generic decline

Use any future expiry (e.g. `12/34`), any CVC, any ZIP (e.g. `10001`).

### Common issues

- **Order stays `pending` forever in dev** → `stripe listen` is not running, or
  the `whsec_` in `.env.local` doesn't match the one currently active.
- **`STRIPE_SECRET_KEY is not set` at boot** → missing or misnamed in
  `.env.local`. Restart `pnpm dev` after editing the file.
- **Payment Element renders blank** → check the browser console for
  `loadStripe` errors; usually the publishable key is missing or has
  the wrong prefix (live key in test build, etc.).

### Going to production

Deploy is documented in
`docs/superpowers/specs/2026-05-06-stripe-checkout-integration-design.md`
section 10.
````

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs(stripe): document setup, dev workflow, and test cards"
```

---

## Verification checklist (run before declaring done)

- [ ] `pnpm test` — all unit tests pass.
- [ ] `pnpm exec tsc --noEmit` — no type errors.
- [ ] `pnpm build` — production build succeeds.
- [ ] Manual smoke (Task 8 step 5) succeeded end-to-end.
- [ ] Manual smoke (Task 9 step 5 — pending state) succeeded.
- [ ] `pending-orders.json` not committed (it's in `.gitignore`? Verify).
- [ ] `.env.local` not committed.
- [ ] No `console.log` debug statements left in code.

If anything is unchecked, do not declare done.

## Deferred (intentional gaps vs spec)

These are mentioned in the spec but intentionally deferred from this plan to keep the blast radius small. They can be added as follow-up commits.

- **E2E Playwright tests for Stripe** (spec §8.2). The spec acknowledges these as "smoke coverage" and that "unit tests are the primary safety net". Given Stripe-iframe flakiness in CI, defer to a follow-up. When picked up, create `tests/e2e/checkout-stripe-{success,3ds,decline}.spec.ts` per spec §8.2.
- **Active redirect to `/cart` when cart goes empty mid-checkout** (spec §7.4 edge case 7). The existing submit-time guard (preserved in `CheckoutShell.onSubmit`) blocks the broken state. The "redirect with a notice" is a UX polish on top of that — add later if user reports stuck-on-step-3 sessions.
