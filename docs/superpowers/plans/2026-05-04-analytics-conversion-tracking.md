# Analytics & Conversion Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Install Microsoft Clarity + Google Analytics 4 (via Google Tag Manager), wire conversion events across the funnel, and add a lightweight CCPA-aware consent layer. Server-side `purchase` is built but deferred (Phase 2) until Stripe is integrated.

**Architecture:** Three layers — (1) typed `lib/analytics.ts` event functions push to `window.dataLayer`, gated by `lib/consent.ts`; (2) `<GTMScript>`, `<ClarityScript>`, `<ConsentNotice>` mount in the root layout; (3) component edits at integration points (catalog, PDP, cart, checkout, confirmation, engagement CTAs). For server components (PDP, shop category, confirmation), tiny `Track*` client components fire mount-time events. `lib/analytics-server.ts` is built and unit-tested but not called anywhere — drop-in ready for the future Stripe webhook.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Vitest + @testing-library/react, Tailwind, Zustand, react-hook-form. Package manager: pnpm.

**Spec:** [docs/superpowers/specs/2026-05-04-analytics-conversion-tracking-design.md](../specs/2026-05-04-analytics-conversion-tracking-design.md)

---

## Read Before Coding

This codebase uses Next.js 16. Before writing any `next/script` or layout code, read the relevant guide in `node_modules/next/dist/docs/` (per `AGENTS.md` — Next.js 16 has breaking changes from prior versions). Specifically check:
- `next/script` Script component API and `strategy` values.
- App Router conventions for client vs server components in `app/layout.tsx`.

## File Structure

**Create (10 files):**

| Path | Responsibility |
|---|---|
| `lib/analytics-types.ts` | Shared types: `AnalyticsItem`, `AnalyticsEvent`, item-mapping helpers from cart `ResolvedCartLine` → `AnalyticsItem` |
| `lib/consent.ts` | `hasConsent()`, `setConsent()`, GPC detection, cookie I/O |
| `lib/analytics.ts` | Typed client-side event functions (`trackViewItem`, `trackAddToCart`, …). Each pushes to `window.dataLayer` and no-ops when consent is off |
| `lib/analytics-server.ts` | `sendPurchaseToGA4(order)` via Measurement Protocol. Built now, called by no one |
| `components/analytics/GTMScript.tsx` | Client component, renders `next/script` GTM snippet only when `hasConsent()` is true |
| `components/analytics/ClarityScript.tsx` | Client component, renders Clarity snippet only when `hasConsent()` is true |
| `components/analytics/ConsentNotice.tsx` | Client component, dismissible banner; sets cookie on dismiss |
| `components/analytics/TrackEvent.tsx` | Client component used inside server components — fires a single named event on mount |
| `components/analytics/TelLink.tsx` | Client component — `<a href="tel:...">` wrapper that fires `phone_click` on click |
| `components/analytics/PrivacyOptOutLink.tsx` | Client footer link "Do Not Sell or Share My Personal Information" — toggles consent off and reloads |

**Test files (3):**

| Path | Covers |
|---|---|
| `tests/unit/consent.test.ts` | GPC detection, cookie roundtrip, default states |
| `tests/unit/analytics.test.ts` | All `trackX()` functions push correct shape; no-op when consent is off |
| `tests/unit/analytics-server.test.ts` | Measurement Protocol payload shape (mock `fetch`) |

**Modify:**

| Path | Change |
|---|---|
| `.env.local.example` | Add 4 GA4/GTM/Clarity env vars |
| `app/layout.tsx` | Mount `<GTMScript />`, `<ClarityScript />`, `<ConsentNotice />` |
| `components/product/AddToBag.tsx` | Fire `add_to_cart` on click |
| `app/[locale]/product/[slug]/page.tsx` | Render `<TrackEvent name="view_item" …>` |
| `app/[locale]/shop/[category]/page.tsx` | Render `<TrackEvent name="view_item_list" …>` |
| `components/product/FilterBar.tsx` | Fire `occasion_selected` when occasion chip toggled |
| `components/cart/CartDrawer.tsx` | Fire `view_cart` on open |
| `components/cart/CartLineQty.tsx` | Fire `remove_from_cart` when qty → 0 or on remove |
| `components/checkout/CheckoutShell.tsx` | Fire `begin_checkout` on mount, `add_shipping_info`/`add_payment_info`/`recipient_info_completed` on step transitions |
| `components/checkout/DeliveryStep.tsx` | Fire `delivery_date_selected` when date picker confirms |
| `app/[locale]/order/[id]/confirmation/page.tsx` | Render `<TrackEvent name="purchase" …>` with order data |
| `components/contact/TextMakyModal.tsx` | Fire `whatsapp_click` on the WhatsApp anchor click |
| `components/inquiry/ContactForm.tsx` | Fire `contact_submit` after a successful API response |
| `components/home/NewsletterField.tsx` | Fire `newsletter_signup` on success |
| `components/inquiry/NewsletterField.tsx` | Fire `newsletter_signup` on success |
| `components/nav/Footer.tsx` | Replace `<a href={SITE.phoneHref}>` with `<TelLink>`; add `<PrivacyOptOutLink />` |
| `components/home/StudioVisit.tsx` | Replace `<a href={SITE.phoneHref}>` with `<TelLink>` (2 sites) |

---

## Conventions

- Each task ends with a commit. Commit message format follows the repo (look at recent commits: `feat(scope):`, `fix(scope):`, `chore(scope):`).
- Run tests with `pnpm test` (Vitest, single run). Use `pnpm test -- <pattern>` to filter by filename.
- TypeScript strict — no `any`. Use `unknown` and narrow.
- No comments unless the WHY is non-obvious (per project conventions).
- Client components must have `"use client"` directive.

---

## Task 1: Add environment variable scaffolding

**Files:**
- Modify: `.env.local.example`

- [ ] **Step 1: Add GA/GTM/Clarity env vars to the example file**

Open `.env.local.example`. After the existing Stripe block, add:

```
# Analytics — Google Tag Manager + GA4 (Plan: 2026-05-04 analytics-conversion-tracking)
NEXT_PUBLIC_GTM_ID=GTM-XXXXXXX
NEXT_PUBLIC_CLARITY_PROJECT_ID=

# GA4 Measurement Protocol (server-side purchase — wired in Phase 2 with Stripe)
GA4_MEASUREMENT_ID=G-XXXXXXX
GA4_API_SECRET=
```

The user already owns GA4, GTM, and Clarity properties — they will fill the real values into `.env.local` themselves.

- [ ] **Step 2: Commit**

```bash
git add .env.local.example
git commit -m "chore(analytics): add env var scaffolding for GTM, GA4, Clarity"
```

---

## Task 2: Create shared analytics types

**Files:**
- Create: `lib/analytics-types.ts`

- [ ] **Step 1: Create the types file**

```ts
import type { ResolvedCartLine } from "@/lib/cart-helpers";

export type AnalyticsItem = {
  item_id: string;
  item_name: string;
  item_category: string;
  item_variant?: string;
  price: number;
  quantity: number;
  currency: "USD";
};

export type Occasion =
  | "romance"
  | "anniversary"
  | "birthday"
  | "congrats"
  | "just-because"
  | "sympathy"
  | "wedding";

export type EngagementLocation =
  | "footer"
  | "header"
  | "pdp"
  | "contact"
  | "home"
  | "checkout"
  | "cart";

export function resolvedLineToAnalyticsItem(line: ResolvedCartLine): AnalyticsItem {
  return {
    item_id: line.product.id,
    item_name: line.product.name.en,
    item_category: line.product.category,
    item_variant: line.variant.id,
    price: line.unitPriceCents / 100,
    quantity: line.line.qty,
    currency: "USD",
  };
}

export function centsToDollars(cents: number): number {
  return Math.round(cents) / 100;
}
```

If `Product.name` is structured differently in `types/product.ts`, adjust `item_name` accordingly. Open `types/product.ts` to confirm the property path.

- [ ] **Step 2: Commit**

```bash
git add lib/analytics-types.ts
git commit -m "feat(analytics): add shared analytics types and item-mapping helpers"
```

---

## Task 3: Build `lib/consent.ts` with TDD

**Files:**
- Create: `lib/consent.ts`
- Test: `tests/unit/consent.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/consent.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { hasConsent, setConsent, COOKIE_NAME } from "@/lib/consent";

function clearCookies() {
  document.cookie.split(";").forEach((c) => {
    const eq = c.indexOf("=");
    const name = (eq > -1 ? c.substring(0, eq) : c).trim();
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  });
}

describe("consent", () => {
  beforeEach(() => {
    clearCookies();
    vi.unstubAllGlobals();
  });

  it("defaults to true when no cookie set and no GPC signal", () => {
    expect(hasConsent()).toBe(true);
  });

  it("returns false when GPC signal is true (regardless of cookie)", () => {
    vi.stubGlobal("navigator", { ...navigator, globalPrivacyControl: true });
    expect(hasConsent()).toBe(false);
  });

  it("setConsent(false) writes the cookie and is then read as false", () => {
    setConsent(false);
    expect(document.cookie).toContain(`${COOKIE_NAME}=denied`);
    expect(hasConsent()).toBe(false);
  });

  it("setConsent(true) writes 'granted' and is then read as true", () => {
    setConsent(true);
    expect(document.cookie).toContain(`${COOKIE_NAME}=granted`);
    expect(hasConsent()).toBe(true);
  });

  it("returns false on the server (no document)", () => {
    const originalDoc = globalThis.document;
    // @ts-expect-error simulate SSR
    delete globalThis.document;
    try {
      expect(hasConsent()).toBe(false);
    } finally {
      globalThis.document = originalDoc;
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test -- consent
```
Expected: FAIL with "Cannot find module '@/lib/consent'".

- [ ] **Step 3: Implement `lib/consent.ts`**

```ts
export const COOKIE_NAME = "dvf_consent";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split("=")[1]) : null;
}

function gpcSignal(): boolean {
  if (typeof navigator === "undefined") return false;
  return (navigator as unknown as { globalPrivacyControl?: boolean })
    .globalPrivacyControl === true;
}

export function hasConsent(): boolean {
  if (typeof document === "undefined") return false;
  if (gpcSignal()) return false;
  const value = readCookie(COOKIE_NAME);
  if (value === "denied") return false;
  return true;
}

export function setConsent(granted: boolean): void {
  if (typeof document === "undefined") return;
  const value = granted ? "granted" : "denied";
  document.cookie = `${COOKIE_NAME}=${value}; max-age=${ONE_YEAR_SECONDS}; path=/; samesite=lax`;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm test -- consent
```
Expected: PASS, all 5 tests green.

- [ ] **Step 5: Commit**

```bash
git add lib/consent.ts tests/unit/consent.test.ts
git commit -m "feat(analytics): add consent module with GPC detection and cookie I/O"
```

---

## Task 4: Build `lib/analytics.ts` core (dataLayer + gating) with TDD

**Files:**
- Create: `lib/analytics.ts`
- Test: `tests/unit/analytics.test.ts`

- [ ] **Step 1: Write the failing test for `pushDataLayer` gating behavior**

Create `tests/unit/analytics.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import * as consent from "@/lib/consent";
import { pushDataLayer } from "@/lib/analytics";

declare global {
  interface Window {
    dataLayer: unknown[];
  }
}

describe("pushDataLayer", () => {
  beforeEach(() => {
    window.dataLayer = [];
    vi.restoreAllMocks();
  });

  it("pushes the event when consent is granted", () => {
    vi.spyOn(consent, "hasConsent").mockReturnValue(true);
    pushDataLayer({ event: "test_event", foo: "bar" });
    expect(window.dataLayer).toHaveLength(1);
    expect(window.dataLayer[0]).toEqual({ event: "test_event", foo: "bar" });
  });

  it("does NOT push when consent is denied", () => {
    vi.spyOn(consent, "hasConsent").mockReturnValue(false);
    pushDataLayer({ event: "test_event" });
    expect(window.dataLayer).toHaveLength(0);
  });

  it("creates window.dataLayer if it does not exist", () => {
    vi.spyOn(consent, "hasConsent").mockReturnValue(true);
    // @ts-expect-error reset to undefined
    delete window.dataLayer;
    pushDataLayer({ event: "test_event" });
    expect(Array.isArray(window.dataLayer)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test -- analytics
```
Expected: FAIL with "Cannot find module '@/lib/analytics'".

- [ ] **Step 3: Implement core `pushDataLayer`**

Create `lib/analytics.ts`:

```ts
import { hasConsent } from "@/lib/consent";

export type DataLayerEvent = { event: string } & Record<string, unknown>;

export function pushDataLayer(payload: DataLayerEvent): void {
  if (typeof window === "undefined") return;
  if (!hasConsent()) return;
  if (!Array.isArray((window as unknown as { dataLayer?: unknown[] }).dataLayer)) {
    (window as unknown as { dataLayer: unknown[] }).dataLayer = [];
  }
  (window as unknown as { dataLayer: unknown[] }).dataLayer.push(payload);
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm test -- analytics
```
Expected: PASS, all 3 tests green.

- [ ] **Step 5: Commit**

```bash
git add lib/analytics.ts tests/unit/analytics.test.ts
git commit -m "feat(analytics): add pushDataLayer core with consent gating"
```

---

## Task 5: Add ecommerce funnel event functions to `lib/analytics.ts`

**Files:**
- Modify: `lib/analytics.ts`
- Modify: `tests/unit/analytics.test.ts`

- [ ] **Step 1: Write failing tests for each ecommerce event**

Append to `tests/unit/analytics.test.ts`:

```ts
import {
  trackViewItemList,
  trackViewItem,
  trackAddToCart,
  trackRemoveFromCart,
  trackViewCart,
  trackBeginCheckout,
  trackAddShippingInfo,
  trackAddPaymentInfo,
  trackPurchase,
} from "@/lib/analytics";
import type { AnalyticsItem } from "@/lib/analytics-types";

const ITEM: AnalyticsItem = {
  item_id: "p1",
  item_name: "Lush Bouquet",
  item_category: "bouquets",
  item_variant: "lush",
  price: 80,
  quantity: 1,
  currency: "USD",
};

describe("ecommerce events", () => {
  beforeEach(() => {
    window.dataLayer = [];
    vi.spyOn(consent, "hasConsent").mockReturnValue(true);
  });

  it("trackViewItemList pushes view_item_list with item_list_name + items", () => {
    trackViewItemList("bouquets", [ITEM]);
    expect(window.dataLayer[0]).toEqual({
      event: "view_item_list",
      item_list_name: "bouquets",
      items: [ITEM],
    });
  });

  it("trackViewItem pushes view_item with currency, value, items", () => {
    trackViewItem(ITEM);
    expect(window.dataLayer[0]).toEqual({
      event: "view_item",
      currency: "USD",
      value: 80,
      items: [ITEM],
    });
  });

  it("trackAddToCart pushes add_to_cart with currency, value, items", () => {
    trackAddToCart(ITEM);
    expect(window.dataLayer[0]).toMatchObject({
      event: "add_to_cart",
      currency: "USD",
      value: 80,
      items: [ITEM],
    });
  });

  it("trackRemoveFromCart pushes remove_from_cart", () => {
    trackRemoveFromCart(ITEM);
    expect(window.dataLayer[0]).toMatchObject({
      event: "remove_from_cart",
      items: [ITEM],
    });
  });

  it("trackViewCart pushes view_cart with summed value", () => {
    trackViewCart([ITEM, { ...ITEM, item_id: "p2", price: 50 }]);
    expect(window.dataLayer[0]).toMatchObject({
      event: "view_cart",
      currency: "USD",
      value: 130,
    });
  });

  it("trackBeginCheckout pushes begin_checkout with summed value", () => {
    trackBeginCheckout([ITEM]);
    expect(window.dataLayer[0]).toMatchObject({
      event: "begin_checkout",
      currency: "USD",
      value: 80,
    });
  });

  it("trackAddShippingInfo pushes add_shipping_info with shipping_tier", () => {
    trackAddShippingInfo("standard", [ITEM]);
    expect(window.dataLayer[0]).toMatchObject({
      event: "add_shipping_info",
      shipping_tier: "standard",
    });
  });

  it("trackAddPaymentInfo pushes add_payment_info with payment_type", () => {
    trackAddPaymentInfo("card", [ITEM]);
    expect(window.dataLayer[0]).toMatchObject({
      event: "add_payment_info",
      payment_type: "card",
    });
  });

  it("trackPurchase pushes purchase with transaction_id, value, tax, shipping", () => {
    trackPurchase({
      transaction_id: "ord_abc",
      value: 100,
      tax: 8.88,
      shipping: 12,
      items: [ITEM],
    });
    expect(window.dataLayer[0]).toEqual({
      event: "purchase",
      transaction_id: "ord_abc",
      value: 100,
      currency: "USD",
      tax: 8.88,
      shipping: 12,
      items: [ITEM],
    });
  });

  it("ecommerce events no-op when consent is denied", () => {
    vi.spyOn(consent, "hasConsent").mockReturnValue(false);
    trackAddToCart(ITEM);
    expect(window.dataLayer).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test -- analytics
```
Expected: FAIL — `trackViewItemList`, `trackViewItem`, etc. are not exported.

- [ ] **Step 3: Implement the ecommerce event functions**

Append to `lib/analytics.ts`:

```ts
import type { AnalyticsItem } from "@/lib/analytics-types";

function sumValue(items: AnalyticsItem[]): number {
  return items.reduce((s, i) => s + i.price * i.quantity, 0);
}

export function trackViewItemList(itemListName: string, items: AnalyticsItem[]): void {
  pushDataLayer({ event: "view_item_list", item_list_name: itemListName, items });
}

export function trackViewItem(item: AnalyticsItem): void {
  pushDataLayer({
    event: "view_item",
    currency: item.currency,
    value: item.price * item.quantity,
    items: [item],
  });
}

export function trackAddToCart(item: AnalyticsItem): void {
  pushDataLayer({
    event: "add_to_cart",
    currency: item.currency,
    value: item.price * item.quantity,
    items: [item],
  });
}

export function trackRemoveFromCart(item: AnalyticsItem): void {
  pushDataLayer({
    event: "remove_from_cart",
    currency: item.currency,
    value: item.price * item.quantity,
    items: [item],
  });
}

export function trackViewCart(items: AnalyticsItem[]): void {
  pushDataLayer({
    event: "view_cart",
    currency: "USD",
    value: sumValue(items),
    items,
  });
}

export function trackBeginCheckout(items: AnalyticsItem[], coupon?: string): void {
  pushDataLayer({
    event: "begin_checkout",
    currency: "USD",
    value: sumValue(items),
    items,
    ...(coupon ? { coupon } : {}),
  });
}

export function trackAddShippingInfo(shippingTier: string, items: AnalyticsItem[]): void {
  pushDataLayer({
    event: "add_shipping_info",
    shipping_tier: shippingTier,
    items,
  });
}

export function trackAddPaymentInfo(paymentType: string, items: AnalyticsItem[]): void {
  pushDataLayer({
    event: "add_payment_info",
    payment_type: paymentType,
    items,
  });
}

export type PurchasePayload = {
  transaction_id: string;
  value: number;
  tax: number;
  shipping: number;
  items: AnalyticsItem[];
};

export function trackPurchase(p: PurchasePayload): void {
  pushDataLayer({
    event: "purchase",
    transaction_id: p.transaction_id,
    value: p.value,
    currency: "USD",
    tax: p.tax,
    shipping: p.shipping,
    items: p.items,
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test -- analytics
```
Expected: PASS, all ecommerce tests green.

- [ ] **Step 5: Commit**

```bash
git add lib/analytics.ts tests/unit/analytics.test.ts
git commit -m "feat(analytics): add typed GA4 ecommerce event helpers"
```

---

## Task 6: Add engagement + Diva-specific event functions

**Files:**
- Modify: `lib/analytics.ts`
- Modify: `tests/unit/analytics.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `tests/unit/analytics.test.ts`:

```ts
import {
  trackNewsletterSignup,
  trackWhatsappClick,
  trackPhoneClick,
  trackContactSubmit,
  trackOccasionSelected,
  trackDeliveryDateSelected,
  trackRecipientInfoCompleted,
} from "@/lib/analytics";

describe("engagement + diva events", () => {
  beforeEach(() => {
    window.dataLayer = [];
    vi.spyOn(consent, "hasConsent").mockReturnValue(true);
  });

  it("trackNewsletterSignup includes location", () => {
    trackNewsletterSignup("footer");
    expect(window.dataLayer[0]).toEqual({ event: "newsletter_signup", location: "footer" });
  });

  it("trackWhatsappClick includes location and context", () => {
    trackWhatsappClick("pdp", "card-message-help");
    expect(window.dataLayer[0]).toEqual({
      event: "whatsapp_click",
      location: "pdp",
      context: "card-message-help",
    });
  });

  it("trackPhoneClick includes location", () => {
    trackPhoneClick("footer");
    expect(window.dataLayer[0]).toEqual({ event: "phone_click", location: "footer" });
  });

  it("trackContactSubmit includes subject + inquiry_type", () => {
    trackContactSubmit("wedding inquiry", "wedding");
    expect(window.dataLayer[0]).toEqual({
      event: "contact_submit",
      subject: "wedding inquiry",
      inquiry_type: "wedding",
    });
  });

  it("trackOccasionSelected includes occasion slug", () => {
    trackOccasionSelected("anniversary");
    expect(window.dataLayer[0]).toEqual({
      event: "occasion_selected",
      occasion: "anniversary",
    });
  });

  it("trackDeliveryDateSelected computes days_ahead and is_same_day", () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayIso = today.toISOString().slice(0, 10);
    trackDeliveryDateSelected(todayIso);
    expect(window.dataLayer[0]).toMatchObject({
      event: "delivery_date_selected",
      days_ahead: 0,
      is_same_day: true,
    });
  });

  it("trackRecipientInfoCompleted includes has_card_message bool", () => {
    trackRecipientInfoCompleted(true);
    expect(window.dataLayer[0]).toEqual({
      event: "recipient_info_completed",
      has_card_message: true,
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test -- analytics
```
Expected: FAIL — engagement/diva events not exported.

- [ ] **Step 3: Implement engagement + diva-specific functions**

Append to `lib/analytics.ts`:

```ts
import type { EngagementLocation } from "@/lib/analytics-types";

export function trackNewsletterSignup(location: EngagementLocation): void {
  pushDataLayer({ event: "newsletter_signup", location });
}

export function trackWhatsappClick(location: EngagementLocation, context: string): void {
  pushDataLayer({ event: "whatsapp_click", location, context });
}

export function trackPhoneClick(location: EngagementLocation): void {
  pushDataLayer({ event: "phone_click", location });
}

export function trackContactSubmit(subject: string, inquiryType: string): void {
  pushDataLayer({ event: "contact_submit", subject, inquiry_type: inquiryType });
}

export function trackOccasionSelected(occasion: string): void {
  pushDataLayer({ event: "occasion_selected", occasion });
}

export function trackDeliveryDateSelected(dateIso: string): void {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${dateIso}T00:00:00`);
  const daysAhead = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  pushDataLayer({
    event: "delivery_date_selected",
    days_ahead: daysAhead,
    is_same_day: daysAhead === 0,
  });
}

export function trackRecipientInfoCompleted(hasCardMessage: boolean): void {
  pushDataLayer({ event: "recipient_info_completed", has_card_message: hasCardMessage });
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test -- analytics
```
Expected: PASS, all engagement+diva tests green.

- [ ] **Step 5: Commit**

```bash
git add lib/analytics.ts tests/unit/analytics.test.ts
git commit -m "feat(analytics): add engagement and diva-specific event helpers"
```

---

## Task 7: Build `lib/analytics-server.ts` with TDD

**Files:**
- Create: `lib/analytics-server.ts`
- Test: `tests/unit/analytics-server.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/analytics-server.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { sendPurchaseToGA4 } from "@/lib/analytics-server";
import type { AnalyticsItem } from "@/lib/analytics-types";

const ITEM: AnalyticsItem = {
  item_id: "p1",
  item_name: "Lush Bouquet",
  item_category: "bouquets",
  item_variant: "lush",
  price: 80,
  quantity: 1,
  currency: "USD",
};

describe("sendPurchaseToGA4", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    process.env.GA4_MEASUREMENT_ID = "G-TEST123";
    process.env.GA4_API_SECRET = "secret-abc";
  });

  it("posts the correct Measurement Protocol payload", async () => {
    await sendPurchaseToGA4({
      clientId: "1234.5678",
      transaction_id: "ord_abc",
      value: 100,
      tax: 8.88,
      shipping: 12,
      items: [ITEM],
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/^https:\/\/www\.google-analytics\.com\/mp\/collect\?/);
    expect(url).toContain("measurement_id=G-TEST123");
    expect(url).toContain("api_secret=secret-abc");
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({
      client_id: "1234.5678",
      events: [
        {
          name: "purchase",
          params: {
            transaction_id: "ord_abc",
            value: 100,
            currency: "USD",
            tax: 8.88,
            shipping: 12,
            items: [ITEM],
          },
        },
      ],
    });
  });

  it("returns silently when GA4 env vars are missing", async () => {
    delete process.env.GA4_MEASUREMENT_ID;
    await sendPurchaseToGA4({
      clientId: "1234.5678",
      transaction_id: "ord_abc",
      value: 100,
      tax: 8.88,
      shipping: 12,
      items: [ITEM],
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not throw if fetch fails (fire-and-forget)", async () => {
    fetchMock.mockRejectedValueOnce(new Error("network down"));
    await expect(
      sendPurchaseToGA4({
        clientId: "1234.5678",
        transaction_id: "ord_abc",
        value: 100,
        tax: 8.88,
        shipping: 12,
        items: [ITEM],
      }),
    ).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test -- analytics-server
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/analytics-server.ts`**

```ts
import type { AnalyticsItem } from "@/lib/analytics-types";

/**
 * CALL ME FROM THE STRIPE WEBHOOK.
 *
 * Server-side `purchase` event via GA4 Measurement Protocol. This module is
 * intentionally not wired anywhere in Phase 1 — the current checkout API
 * route does not represent a real payment, and firing purchase events from
 * there would pollute GA4 with non-revenue data.
 *
 * When Stripe is integrated, call this from the `checkout.session.completed`
 * (or `payment_intent.succeeded`) webhook handler. Reuse the order's
 * persisted `transaction_id` so client + server events deduplicate in GA4.
 */
export type ServerPurchaseInput = {
  clientId: string;
  transaction_id: string;
  value: number;
  tax: number;
  shipping: number;
  items: AnalyticsItem[];
};

export async function sendPurchaseToGA4(input: ServerPurchaseInput): Promise<void> {
  const measurementId = process.env.GA4_MEASUREMENT_ID;
  const apiSecret = process.env.GA4_API_SECRET;
  if (!measurementId || !apiSecret) return;

  const url =
    `https://www.google-analytics.com/mp/collect` +
    `?measurement_id=${encodeURIComponent(measurementId)}` +
    `&api_secret=${encodeURIComponent(apiSecret)}`;

  const body = {
    client_id: input.clientId,
    events: [
      {
        name: "purchase",
        params: {
          transaction_id: input.transaction_id,
          value: input.value,
          currency: "USD",
          tax: input.tax,
          shipping: input.shipping,
          items: input.items,
        },
      },
    ],
  };

  try {
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    // fire-and-forget — never block on analytics
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm test -- analytics-server
```
Expected: PASS, all 3 tests green.

- [ ] **Step 5: Commit**

```bash
git add lib/analytics-server.ts tests/unit/analytics-server.test.ts
git commit -m "feat(analytics): add server-side purchase via Measurement Protocol (Phase 2 wiring deferred)"
```

---

## Task 8: Create `<GTMScript />` and `<ClarityScript />` components

**Files:**
- Create: `components/analytics/GTMScript.tsx`
- Create: `components/analytics/ClarityScript.tsx`

- [ ] **Step 1: Read the Next.js 16 `next/script` doc**

```bash
ls node_modules/next/dist/docs/ | grep -i script
```
Read whichever file documents `next/script` strategy values for Next.js 16. Confirm `"afterInteractive"` is supported (or use the current equivalent).

- [ ] **Step 2: Create `components/analytics/GTMScript.tsx`**

```tsx
"use client";
import Script from "next/script";
import { useEffect, useState } from "react";
import { hasConsent } from "@/lib/consent";

export function GTMScript() {
  const id = process.env.NEXT_PUBLIC_GTM_ID;
  const [allow, setAllow] = useState(false);

  useEffect(() => {
    setAllow(hasConsent());
  }, []);

  if (!id || !allow) return null;

  return (
    <Script
      id="gtm-init"
      strategy="afterInteractive"
      dangerouslySetInnerHTML={{
        __html: `
(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${id}');
`,
      }}
    />
  );
}
```

- [ ] **Step 3: Create `components/analytics/ClarityScript.tsx`**

```tsx
"use client";
import Script from "next/script";
import { useEffect, useState } from "react";
import { hasConsent } from "@/lib/consent";

export function ClarityScript() {
  const id = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID;
  const [allow, setAllow] = useState(false);

  useEffect(() => {
    setAllow(hasConsent());
  }, []);

  if (!id || !allow) return null;

  return (
    <Script
      id="clarity-init"
      strategy="afterInteractive"
      dangerouslySetInnerHTML={{
        __html: `
(function(c,l,a,r,i,t,y){
  c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
  t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
  y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
})(window, document, "clarity", "script", "${id}");
`,
      }}
    />
  );
}
```

- [ ] **Step 4: Verify the build still passes**

```bash
pnpm build
```
Expected: build succeeds. (Even though scripts won't render with empty env, the components must compile.)

- [ ] **Step 5: Commit**

```bash
git add components/analytics/GTMScript.tsx components/analytics/ClarityScript.tsx
git commit -m "feat(analytics): add GTM and Microsoft Clarity script components"
```

---

## Task 9: Create `<ConsentNotice />` and `<PrivacyOptOutLink />`

**Files:**
- Create: `components/analytics/ConsentNotice.tsx`
- Create: `components/analytics/PrivacyOptOutLink.tsx`

- [ ] **Step 1: Create `components/analytics/ConsentNotice.tsx`**

A small dismissible bottom-of-page notice. It only appears the first time a user visits (when no consent cookie is set). Follow the project's Tailwind conventions (look at recent banner-like components for style cues; likely uses the petal/bone palette and `font-mono` for small caps).

```tsx
"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { setConsent, COOKIE_NAME } from "@/lib/consent";

export function ConsentNotice() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const hasCookie = document.cookie.split("; ").some((r) => r.startsWith(`${COOKIE_NAME}=`));
    if (!hasCookie) setVisible(true);
  }, []);

  if (!visible) return null;

  function dismiss() {
    setConsent(true);
    setVisible(false);
  }

  return (
    <div
      role="dialog"
      aria-label="Cookie notice"
      className="fixed bottom-4 left-4 right-4 sm:left-6 sm:right-auto sm:max-w-md z-[60] bg-bone text-ink rounded-lg shadow-lg border border-ink/10 p-4 flex items-start gap-3"
    >
      <p className="text-[13px] leading-snug flex-1">
        We use cookies for analytics.{" "}
        <Link href="/legal/privacy" className="underline">
          Privacy Policy
        </Link>
        .
      </p>
      <button
        type="button"
        onClick={dismiss}
        className="text-[12px] font-mono uppercase tracking-[0.18em] underline shrink-0"
      >
        Got it
      </button>
    </div>
  );
}
```

If `/legal/privacy` does not exist yet, leave the link — it can be a 404 until the privacy page lands. Confirm by listing `app/[locale]/legal/`. Adjust the path if the privacy page lives elsewhere.

- [ ] **Step 2: Create `components/analytics/PrivacyOptOutLink.tsx`**

```tsx
"use client";
import { setConsent } from "@/lib/consent";

export function PrivacyOptOutLink({ className }: { className?: string }) {
  function optOut(e: React.MouseEvent) {
    e.preventDefault();
    setConsent(false);
    window.location.reload();
  }

  return (
    <a
      href="#"
      onClick={optOut}
      className={className ?? "text-[12px] font-mono uppercase tracking-[0.18em] underline"}
    >
      Do Not Sell or Share My Personal Information
    </a>
  );
}
```

- [ ] **Step 3: Verify build**

```bash
pnpm build
```
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add components/analytics/ConsentNotice.tsx components/analytics/PrivacyOptOutLink.tsx
git commit -m "feat(analytics): add consent notice and privacy opt-out link components"
```

---

## Task 10: Create reusable `<TrackEvent />` and `<TelLink />` components

**Files:**
- Create: `components/analytics/TrackEvent.tsx`
- Create: `components/analytics/TelLink.tsx`

- [ ] **Step 1: Create `components/analytics/TrackEvent.tsx`**

Used inside server components to fire a single mount-time event. It accepts a serialized payload and pushes it via the analytics helper.

```tsx
"use client";
import { useEffect } from "react";
import * as analytics from "@/lib/analytics";
import type { AnalyticsItem } from "@/lib/analytics-types";

type ViewItemListProps = {
  kind: "view_item_list";
  itemListName: string;
  items: AnalyticsItem[];
};

type ViewItemProps = {
  kind: "view_item";
  item: AnalyticsItem;
};

type PurchaseProps = {
  kind: "purchase";
  payload: analytics.PurchasePayload;
};

type Props = ViewItemListProps | ViewItemProps | PurchaseProps;

export function TrackEvent(props: Props) {
  useEffect(() => {
    if (props.kind === "view_item_list") {
      analytics.trackViewItemList(props.itemListName, props.items);
    } else if (props.kind === "view_item") {
      analytics.trackViewItem(props.item);
    } else if (props.kind === "purchase") {
      analytics.trackPurchase(props.payload);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
```

- [ ] **Step 2: Create `components/analytics/TelLink.tsx`**

```tsx
"use client";
import type { ReactNode } from "react";
import { trackPhoneClick } from "@/lib/analytics";
import type { EngagementLocation } from "@/lib/analytics-types";

type Props = {
  href: string;
  location: EngagementLocation;
  className?: string;
  children: ReactNode;
};

export function TelLink({ href, location, className, children }: Props) {
  return (
    <a
      href={href}
      className={className}
      onClick={() => trackPhoneClick(location)}
    >
      {children}
    </a>
  );
}
```

- [ ] **Step 3: Verify build**

```bash
pnpm build
```
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add components/analytics/TrackEvent.tsx components/analytics/TelLink.tsx
git commit -m "feat(analytics): add TrackEvent and TelLink helper components"
```

---

## Task 11: Mount analytics in root layout

**Files:**
- Modify: `app/layout.tsx`

- [ ] **Step 1: Add the three components to the root layout**

Open `app/layout.tsx`. After the existing imports, add:

```tsx
import { GTMScript } from "@/components/analytics/GTMScript";
import { ClarityScript } from "@/components/analytics/ClarityScript";
import { ConsentNotice } from "@/components/analytics/ConsentNotice";
```

Inside the `<body>`, wrap the existing children:

```tsx
<body>
  <GTMScript />
  <ClarityScript />
  {children}
  <ConsentNotice />
</body>
```

- [ ] **Step 2: Run dev server and confirm no hydration warnings**

```bash
pnpm dev
```
Open `http://localhost:3000`. Open browser devtools → Console. Confirm no hydration mismatch warnings. The consent notice should appear at bottom-left for a fresh session. Click "Got it" — it dismisses, and the cookie `dvf_consent=granted` is now set.

Stop the dev server (Ctrl+C).

- [ ] **Step 3: Verify build**

```bash
pnpm build
```
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add app/layout.tsx
git commit -m "feat(analytics): mount GTM, Clarity, and consent notice in root layout"
```

---

## Task 12: Wire `view_item_list` on shop category pages

**Files:**
- Modify: `app/[locale]/shop/[category]/page.tsx`

- [ ] **Step 1: Add `<TrackEvent kind="view_item_list">` to the page**

Open `app/[locale]/shop/[category]/page.tsx`. Find where the page renders the product grid (after filtering and sorting). Map the displayed products to `AnalyticsItem`s and render `<TrackEvent>`:

Add imports near the top:
```tsx
import { TrackEvent } from "@/components/analytics/TrackEvent";
import type { AnalyticsItem } from "@/lib/analytics-types";
```

In the JSX returned by `ShopCategoryPage` (or whatever it's called), just before/after the `<ProductGrid>`:
```tsx
<TrackEvent
  kind="view_item_list"
  itemListName={category}
  items={visibleProducts.map<AnalyticsItem>((p) => ({
    item_id: p.id,
    item_name: p.name.en,
    item_category: p.category,
    price: p.variants[0]?.priceCents / 100 ?? 0,
    quantity: 1,
    currency: "USD",
  }))}
/>
```

Where `visibleProducts` is the variable holding the filtered+sorted list. Re-read the page to identify the actual variable name (look for the result of `filterProducts(...)` / `sortProducts(...)`).

- [ ] **Step 2: Verify build**

```bash
pnpm build
```
Expected: build succeeds.

- [ ] **Step 3: Manually verify in dev**

```bash
pnpm dev
```
Open `http://localhost:3000/en/shop/bouquets`. Open browser devtools → Console:
```js
window.dataLayer
```
Expected: array contains an entry with `event: "view_item_list"`, `item_list_name: "bouquets"`, and `items` populated.

Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add app/[locale]/shop/[category]/page.tsx
git commit -m "feat(analytics): fire view_item_list on shop category pages"
```

---

## Task 13: Wire `view_item` on PDP

**Files:**
- Modify: `app/[locale]/product/[slug]/page.tsx`

- [ ] **Step 1: Add `<TrackEvent kind="view_item">` to the PDP**

Open `app/[locale]/product/[slug]/page.tsx`. Add imports:
```tsx
import { TrackEvent } from "@/components/analytics/TrackEvent";
import type { AnalyticsItem } from "@/lib/analytics-types";
```

Inside the rendered JSX (after the product is loaded, before the closing wrapper), build the analytics item from the default-selected variant (use the first variant or whatever the configurator defaults to — read `PdpConfigurator.tsx`'s default; currently `lush` if present, else first):

```tsx
{(() => {
  const defaultVariant = product.variants.find((v) => v.id === "lush") ?? product.variants[0];
  const item: AnalyticsItem = {
    item_id: product.id,
    item_name: product.name.en,
    item_category: product.category,
    item_variant: defaultVariant?.id,
    price: (defaultVariant?.priceCents ?? 0) / 100,
    quantity: 1,
    currency: "USD",
  };
  return <TrackEvent kind="view_item" item={item} />;
})()}
```

- [ ] **Step 2: Manually verify**

```bash
pnpm dev
```
Open a PDP, e.g. `http://localhost:3000/en/product/<some-slug>`. In console:
```js
window.dataLayer.find((e) => e.event === "view_item")
```
Expected: object with `currency: "USD"`, `value: <price>`, `items: [...]`.

Stop the dev server.

- [ ] **Step 3: Commit**

```bash
git add app/[locale]/product/[slug]/page.tsx
git commit -m "feat(analytics): fire view_item on PDP mount"
```

---

## Task 14: Wire `add_to_cart` in `AddToBag.tsx`

**Files:**
- Modify: `components/product/AddToBag.tsx`

- [ ] **Step 1: Fire `add_to_cart` inside the existing `onClick`**

Open `components/product/AddToBag.tsx`. The `onClick` handler currently does:
```tsx
add({ productId, variantId, addOnIds, qty: 1 });
showToast({ kind: "added-to-bag", productId });
openDrawer();
```

Add tracking. First, the component receives `productId`, `variantId`, `addOnIds`, `totalCents`. We need product details (name, category) — get them via `PRODUCTS` lookup using the helper from `cart-helpers`. Add:

```tsx
import { trackAddToCart } from "@/lib/analytics";
import { resolvedLineToAnalyticsItem } from "@/lib/analytics-types";
import { resolveCartLine } from "@/lib/cart-helpers";
import { PRODUCTS } from "@/data/products";
```

Inside `onClick`, after the existing `add(...)`:
```tsx
const resolved = resolveCartLine({ productId, variantId, addOnIds, qty: 1 }, PRODUCTS);
if (resolved) {
  trackAddToCart(resolvedLineToAnalyticsItem(resolved));
}
```

- [ ] **Step 2: Manually verify**

```bash
pnpm dev
```
Open a PDP, click "Add to bag", check `window.dataLayer`:
```js
window.dataLayer.find((e) => e.event === "add_to_cart")
```
Expected: object with `currency`, `value`, `items: [{ item_id, item_name, ... }]`.

Stop the dev server.

- [ ] **Step 3: Commit**

```bash
git add components/product/AddToBag.tsx
git commit -m "feat(analytics): fire add_to_cart from AddToBag"
```

---

## Task 15: Wire `view_cart` and `remove_from_cart` in cart drawer

**Files:**
- Modify: `components/cart/CartDrawer.tsx`
- Modify: `components/cart/CartLineQty.tsx`

- [ ] **Step 1: Fire `view_cart` when the drawer opens**

In `CartDrawer.tsx`, find the `useEffect` that runs when `open` becomes true. Add a tracking call inside that effect:

```tsx
import { trackViewCart } from "@/lib/analytics";
import { resolvedLineToAnalyticsItem } from "@/lib/analytics-types";
```

Inside the `useEffect(() => { if (!open) return; ... }, [open, close])` block:
```tsx
trackViewCart(resolved.map(resolvedLineToAnalyticsItem));
```

(`resolved` is already available in the component as the resolved cart lines.)

- [ ] **Step 2: Fire `remove_from_cart` in `CartLineQty.tsx`**

Open `components/cart/CartLineQty.tsx`. Read the file to understand its API (it presumably exposes a "remove" or "decrement to zero" action). Wire `trackRemoveFromCart` at the same call site that calls `remove()` or `setQty(... 0)`:

```tsx
import { trackRemoveFromCart } from "@/lib/analytics";
import { resolvedLineToAnalyticsItem } from "@/lib/analytics-types";
import { resolveCartLine } from "@/lib/cart-helpers";
import { PRODUCTS } from "@/data/products";
```

When the user removes a line:
```tsx
const resolved = resolveCartLine({ productId, variantId, addOnIds, qty }, PRODUCTS);
if (resolved) {
  trackRemoveFromCart(resolvedLineToAnalyticsItem(resolved));
}
```

If the file doesn't have direct access to `productId`/`variantId`/`addOnIds`/`qty`, pass them as props from `CartLineItem.tsx` or wire it in `CartLineItem.tsx` instead.

- [ ] **Step 3: Manually verify**

```bash
pnpm dev
```
Add an item to cart, open the drawer (or click the cart icon). Check `window.dataLayer` for `view_cart`. Click the remove/decrement button. Check for `remove_from_cart`.

Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add components/cart/CartDrawer.tsx components/cart/CartLineQty.tsx
git commit -m "feat(analytics): fire view_cart on drawer open and remove_from_cart on line removal"
```

---

## Task 16: Wire `begin_checkout` in `CheckoutShell.tsx`

**Files:**
- Modify: `components/checkout/CheckoutShell.tsx`

- [ ] **Step 1: Fire `begin_checkout` on mount**

Open `components/checkout/CheckoutShell.tsx`. Add imports:
```tsx
import { useEffect } from "react";
import { trackBeginCheckout } from "@/lib/analytics";
import { resolvedLineToAnalyticsItem } from "@/lib/analytics-types";
```

Inside the component body, after `resolved` is declared:
```tsx
useEffect(() => {
  if (resolved.length === 0) return;
  trackBeginCheckout(resolved.map(resolvedLineToAnalyticsItem));
  // fire-once on first mount with non-empty cart
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
```

- [ ] **Step 2: Manually verify**

```bash
pnpm dev
```
Add to cart, navigate to `/en/checkout`. Check console:
```js
window.dataLayer.find((e) => e.event === "begin_checkout")
```
Expected: object with `currency: "USD"`, `value`, `items`.

Stop the dev server.

- [ ] **Step 3: Commit**

```bash
git add components/checkout/CheckoutShell.tsx
git commit -m "feat(analytics): fire begin_checkout on checkout mount"
```

---

## Task 17: Wire `add_shipping_info`, `add_payment_info`, `recipient_info_completed` in checkout

**Files:**
- Modify: `components/checkout/CheckoutShell.tsx`

- [ ] **Step 1: Fire step-transition events**

In `CheckoutShell.tsx`, the `nextFrom(step)` function advances steps. Add tracking inside the success path, after `if (!valid) return;`. Read the file to find `nextFrom` (around the form/button handlers).

Add imports:
```tsx
import {
  trackAddShippingInfo,
  trackAddPaymentInfo,
  trackRecipientInfoCompleted,
} from "@/lib/analytics";
```

After `const valid = await form.trigger(...);` and `if (!valid) return;`, before `setOpen(...)`:

```tsx
if (step === "delivery") {
  const items = resolved.map(resolvedLineToAnalyticsItem);
  trackAddShippingInfo("standard", items);
  // delivery step also captures recipient info
  const cardMessage = form.getValues("delivery.cardMessage") ?? "";
  trackRecipientInfoCompleted(cardMessage.trim().length > 0);
} else if (step === "payment") {
  trackAddPaymentInfo("card", resolved.map(resolvedLineToAnalyticsItem));
}
```

Note: only fire when we actually leave the step (after validation passes), not on every keystroke. The current "shipping_tier" is hardcoded to `"standard"` because the project has only one shipping option — adjust if shipping tiers exist in the schema.

- [ ] **Step 2: Manually verify**

```bash
pnpm dev
```
Walk through checkout: complete contact step → confirm `add_shipping_info` does NOT fire yet (it fires when leaving delivery). Complete delivery step → confirm `add_shipping_info` AND `recipient_info_completed` fire. Complete payment step would fire `add_payment_info` — but the actual fire happens at `nextFrom("payment")` which only happens if there's a step after payment. Inspect the flow: if `payment` is the last step, fire `trackAddPaymentInfo` inside `onSubmit` instead, before `submitOrder` is called.

Adjust based on what you find — `add_payment_info` should fire when the user *commits to* payment info, not when they leave the payment step. The cleanest place is at the start of `onSubmit` (after validation, before submit).

- [ ] **Step 3: Move `trackAddPaymentInfo` to `onSubmit` if needed**

If payment is the last step, remove the `step === "payment"` branch from `nextFrom` and add to the start of `onSubmit`:

```tsx
async function onSubmit(values: CheckoutInput) {
  trackAddPaymentInfo("card", resolved.map(resolvedLineToAnalyticsItem));
  // ... existing logic
}
```

- [ ] **Step 4: Manually verify the corrected flow**

```bash
pnpm dev
```
Complete the full checkout. Confirm all three events fire in order: `add_shipping_info` + `recipient_info_completed` (after delivery), then `add_payment_info` (on submit).

Stop the dev server.

- [ ] **Step 5: Commit**

```bash
git add components/checkout/CheckoutShell.tsx
git commit -m "feat(analytics): fire add_shipping_info, recipient_info_completed, add_payment_info during checkout"
```

---

## Task 18: Wire `delivery_date_selected` in `DeliveryStep.tsx`

**Files:**
- Modify: `components/checkout/DeliveryStep.tsx`

- [ ] **Step 1: Fire `delivery_date_selected` when the date input changes**

Open `components/checkout/DeliveryStep.tsx`. Find the date picker input (likely a `<DateInput>` or `<input type="date">` wired through react-hook-form). Add tracking on the change/blur handler that fires when a complete date string is entered.

```tsx
import { trackDeliveryDateSelected } from "@/lib/analytics";
```

If the existing input uses `react-hook-form`'s `register` with `onBlur` or a custom controller, add:

```tsx
onBlur={(e) => {
  const v = e.currentTarget.value;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) trackDeliveryDateSelected(v);
}}
```

(Read the file first — the picker may be a custom component. If it exposes an `onChange(date: string)` callback, hook in there instead. The event should fire once when the user picks/confirms a date, not on every keystroke.)

- [ ] **Step 2: Manually verify**

```bash
pnpm dev
```
Walk to delivery step, pick a date. Console:
```js
window.dataLayer.find((e) => e.event === "delivery_date_selected")
```
Expected: object with `days_ahead` (number) and `is_same_day` (bool).

Stop dev server.

- [ ] **Step 3: Commit**

```bash
git add components/checkout/DeliveryStep.tsx
git commit -m "feat(analytics): fire delivery_date_selected when delivery date is chosen"
```

---

## Task 19: Wire client-side `purchase` on the confirmation page

**Files:**
- Modify: `app/[locale]/order/[id]/confirmation/page.tsx`

- [ ] **Step 1: Render `<TrackEvent kind="purchase" …>` from the server component**

The confirmation page is a server component that already loads `order` via `getOrder(id)`. Build the analytics payload from the order and pass it to `<TrackEvent>`.

Add imports:
```tsx
import { TrackEvent } from "@/components/analytics/TrackEvent";
import { resolveCartLines } from "@/lib/cart-helpers";
import { resolvedLineToAnalyticsItem } from "@/lib/analytics-types";
import { PRODUCTS } from "@/data/products";
import { centsToDollars } from "@/lib/analytics-types";
```

In the JSX, before the `<ConfirmationView>`:
```tsx
{(() => {
  const resolved = resolveCartLines(order.lines, PRODUCTS);
  return (
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
  );
})()}
```

- [ ] **Step 2: Manually verify**

```bash
pnpm dev
```
Complete a checkout end-to-end. On the confirmation page, console:
```js
window.dataLayer.find((e) => e.event === "purchase")
```
Expected: object with `transaction_id` matching the order id, `value`, `tax`, `shipping`, `items`.

Stop the dev server.

- [ ] **Step 3: Commit**

```bash
git add app/[locale]/order/[id]/confirmation/page.tsx
git commit -m "feat(analytics): fire client-side purchase on order confirmation page"
```

---

## Task 20: Wire `occasion_selected` in `FilterBar.tsx`

**Files:**
- Modify: `components/product/FilterBar.tsx`

- [ ] **Step 1: Fire `occasion_selected` when an occasion chip is toggled**

Open `components/product/FilterBar.tsx`. Find the occasion chip rendering (around line 118 — the `{show.includes("occasion") && ...}` block, where each chip calls `toggle("occasion", o)`).

Add imports:
```tsx
import { trackOccasionSelected } from "@/lib/analytics";
```

Wrap the existing `onToggle`:
```tsx
onToggle={() => {
  toggle("occasion", o);
  trackOccasionSelected(o);
}}
```

(Only fire on selection — if `toggle` also turns it off, that still emits the event. That's fine: GA can show toggling activity. If only "selecting" should fire, check the current state of `filter.occasion` first and only fire when transitioning to selected.)

Use the simpler version (fire on every toggle) — refinement isn't worth the complexity for first cut.

- [ ] **Step 2: Manually verify**

```bash
pnpm dev
```
Open `/en/shop/bouquets`. Click an occasion chip. Console:
```js
window.dataLayer.find((e) => e.event === "occasion_selected")
```
Expected: object with `occasion: "<slug>"`.

Stop the dev server.

- [ ] **Step 3: Commit**

```bash
git add components/product/FilterBar.tsx
git commit -m "feat(analytics): fire occasion_selected when occasion filter is toggled"
```

---

## Task 21: Wire `whatsapp_click` in `TextMakyModal.tsx`

**Files:**
- Modify: `components/contact/TextMakyModal.tsx`

- [ ] **Step 1: Fire `whatsapp_click` on the WhatsApp anchor**

Open `components/contact/TextMakyModal.tsx`. Find the anchor with `href={whatsappHref}` (around line 103).

Add import:
```tsx
import { trackWhatsappClick } from "@/lib/analytics";
```

Add `onClick`:
```tsx
onClick={() => trackWhatsappClick("contact", "text-maky-modal")}
```

The `location` value depends on where this modal is opened from. For first cut, hardcode to `"contact"` and use `"text-maky-modal"` as the context — this is good enough to identify the funnel in GA. If the modal is opened from PDP, the location can be passed as a prop later (YAGNI — improve only if needed).

- [ ] **Step 2: Manually verify**

```bash
pnpm dev
```
Open the Text Maky modal. Click the WhatsApp button (or just inspect the anchor's onClick — clicking would navigate away). Console after click:
```js
window.dataLayer.find((e) => e.event === "whatsapp_click")
```
Expected: object with `location: "contact"`, `context: "text-maky-modal"`.

Stop the dev server.

- [ ] **Step 3: Commit**

```bash
git add components/contact/TextMakyModal.tsx
git commit -m "feat(analytics): fire whatsapp_click on Text Maky WhatsApp link"
```

---

## Task 22: Wire `phone_click` via `<TelLink>` replacements

**Files:**
- Modify: `components/nav/Footer.tsx`
- Modify: `components/home/StudioVisit.tsx`

- [ ] **Step 1: Replace the `<a href={SITE.phoneHref}>` in Footer**

Open `components/nav/Footer.tsx`. Find the `<a href={SITE.phoneHref} className="...">` (around line 50).

Add import:
```tsx
import { TelLink } from "@/components/analytics/TelLink";
```

Replace the anchor:
```tsx
<TelLink
  href={SITE.phoneHref}
  location="footer"
  className="font-mono text-[13px] hover:text-petal transition-colors"
>
  {SITE.phoneDisplay}
</TelLink>
```

- [ ] **Step 2: Replace the two phone links in `StudioVisit.tsx`**

Open `components/home/StudioVisit.tsx`. Find both `<a href={SITE.phoneHref}>` (around lines 64 and 81). Replace each with `<TelLink href={SITE.phoneHref} location="home">`. Preserve children and className.

Add import:
```tsx
import { TelLink } from "@/components/analytics/TelLink";
```

- [ ] **Step 3: Manually verify**

```bash
pnpm dev
```
Click the footer phone number (right-click → inspect element to confirm it's a TelLink). Console:
```js
window.dataLayer.find((e) => e.event === "phone_click")
```
Expected: object with `location: "footer"` (or `"home"` for StudioVisit).

Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add components/nav/Footer.tsx components/home/StudioVisit.tsx
git commit -m "feat(analytics): fire phone_click via TelLink in footer and studio visit"
```

---

## Task 23: Wire `newsletter_signup` events

**Files:**
- Modify: `components/home/NewsletterField.tsx`
- Modify: `components/inquiry/NewsletterField.tsx`

- [ ] **Step 1: Fire `newsletter_signup` in `components/home/NewsletterField.tsx`**

Open `components/home/NewsletterField.tsx`. The `onSubmit` sets `setState("success")` after a successful response (currently a stub). Fire the event right before `setState("success")`:

```tsx
import { trackNewsletterSignup } from "@/lib/analytics";
```

Inside `onSubmit`, in the success branch:
```tsx
trackNewsletterSignup("home");
setState("success");
```

- [ ] **Step 2: Same for `components/inquiry/NewsletterField.tsx`**

Read `components/inquiry/NewsletterField.tsx`. Identify the success branch — it may be in a similar `onSubmit` or in a parent form. Fire `trackNewsletterSignup("footer")` (or whichever location matches where this variant is rendered — confirm by grep'ing where the inquiry NewsletterField is mounted).

If unsure of the location, the safest default is `"footer"` (most newsletter signups in the layout are footer signups).

- [ ] **Step 3: Manually verify**

```bash
pnpm dev
```
Submit the home newsletter form with a valid email. Console:
```js
window.dataLayer.find((e) => e.event === "newsletter_signup")
```
Expected: object with `location: "home"`. Test the second variant too.

Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add components/home/NewsletterField.tsx components/inquiry/NewsletterField.tsx
git commit -m "feat(analytics): fire newsletter_signup on successful subscription"
```

---

## Task 24: Wire `contact_submit` in `ContactForm.tsx`

**Files:**
- Modify: `components/inquiry/ContactForm.tsx`

- [ ] **Step 1: Fire `contact_submit` after successful API response**

Open `components/inquiry/ContactForm.tsx`. In `onSubmit`, after `if (!res.ok)` branch returns and right before `setState("success")`, fire the event:

```tsx
import { trackContactSubmit } from "@/lib/analytics";
```

```tsx
trackContactSubmit(values.subject, values.subject || "general");
setState("success");
form.reset();
```

The `inquiry_type` here mirrors `subject` for now — if the codebase has a richer subject taxonomy in `lib/contact-subject.ts`, use a derived inquiry type instead. Read `lib/contact-subject.ts` and refine if a better classifier is available.

- [ ] **Step 2: Manually verify**

```bash
pnpm dev
```
Open `/en/contact`, fill the form, submit. Console:
```js
window.dataLayer.find((e) => e.event === "contact_submit")
```
Expected: object with `subject` and `inquiry_type` populated.

Stop the dev server.

- [ ] **Step 3: Commit**

```bash
git add components/inquiry/ContactForm.tsx
git commit -m "feat(analytics): fire contact_submit on successful contact form submission"
```

---

## Task 25: Add `<PrivacyOptOutLink />` to the footer

**Files:**
- Modify: `components/nav/Footer.tsx`

- [ ] **Step 1: Add the opt-out link to Footer**

Open `components/nav/Footer.tsx`. Find the legal/links area (likely a small row at the bottom with privacy/terms links). Add the opt-out link there.

Add import:
```tsx
import { PrivacyOptOutLink } from "@/components/analytics/PrivacyOptOutLink";
```

Add `<PrivacyOptOutLink />` near the existing privacy/terms links. If the footer doesn't already have a small-text-bottom-row, add it as a sibling to the existing copyright element.

- [ ] **Step 2: Manually verify**

```bash
pnpm dev
```
Open any page. Scroll to footer. Confirm the link reads "Do Not Sell or Share My Personal Information" and is styled like other small footer links. Click it. Page should reload, and the consent cookie should now be `denied`. Subsequent navigation: GTM and Clarity scripts should not load (inspect Network tab for `gtm.js` and `clarity.ms` — they should be absent).

Stop the dev server.

- [ ] **Step 3: Commit**

```bash
git add components/nav/Footer.tsx
git commit -m "feat(analytics): add Do Not Sell/Share opt-out link to footer"
```

---

## Task 26: Run the full test suite + production build

**Files:**
- (Verification only)

- [ ] **Step 1: Run unit tests**

```bash
pnpm test
```
Expected: all tests pass, including the three new test files.

- [ ] **Step 2: Run production build**

```bash
pnpm build
```
Expected: build succeeds with no type errors.

- [ ] **Step 3: Commit nothing (this is verification only)**

If a regression appears, fix it inline as a small follow-up commit.

---

## Task 27: Manual end-to-end verification

**Files:**
- (Verification only — no code)

- [ ] **Step 1: Set real env vars locally**

In `.env.local` (NOT `.env.local.example`), set the four vars to the real values from the GA4/GTM/Clarity properties the user already created:
```
NEXT_PUBLIC_GTM_ID=GTM-XXXXXXX
NEXT_PUBLIC_CLARITY_PROJECT_ID=<real-id>
GA4_MEASUREMENT_ID=G-XXXXXXX
GA4_API_SECRET=<real-secret>
```

- [ ] **Step 2: Use GTM Preview mode**

In the GTM admin console, click "Preview" → enter `http://localhost:3000`. Walk through the funnel: home → category → PDP → add to cart → checkout → confirmation. In the Tag Assistant pane, confirm each `dataLayer` event is captured (`view_item_list`, `view_item`, `add_to_cart`, `view_cart`, `begin_checkout`, `add_shipping_info`, `recipient_info_completed`, `add_payment_info`, `purchase`, `occasion_selected`, `delivery_date_selected`).

- [ ] **Step 3: Use GA4 DebugView**

In GA4 admin → Reports → DebugView (requires `?dl_dbg=1` or a Tag Assistant Companion install — easiest path is through GTM Preview which auto-enables debug mode). Confirm events arrive with all required parameters.

- [ ] **Step 4: Verify Clarity sessions**

Open Clarity dashboard. Confirm a recording appears for the localhost session. Confirm rage clicks / scroll heatmap data accumulate.

- [ ] **Step 5: Test consent opt-out**

Click "Do Not Sell or Share My Personal Information" in the footer. Confirm:
- Cookie `dvf_consent=denied` set.
- Reload — `gtm.js` and `clarity.ms` no longer appear in Network tab.
- `window.dataLayer` push calls are no-ops (events do not appear in GTM Preview).

- [ ] **Step 6: Test GPC opt-out**

Enable Global Privacy Control in browser settings (e.g., Brave: Settings → Shields → Global Privacy Control; or use a Firefox extension). Reload the site without a consent cookie. Confirm GTM/Clarity scripts do not load.

- [ ] **Step 7: Final commit (if nothing changed, skip)**

If the manual verification revealed any bugs, fix them in small follow-up commits. Otherwise, no commit needed.

---

## Phase 2 Reminder (when Stripe lands)

When the future Stripe spec is implemented, that plan must include a task to call `sendPurchaseToGA4` from the Stripe webhook handler:

```ts
// Inside checkout.session.completed (or payment_intent.succeeded) handler:
await sendPurchaseToGA4({
  clientId: order.gaClientId, // capture from `_ga` cookie at checkout-create time
  transaction_id: order.id,
  value: order.totals.totalCents / 100,
  tax: order.totals.taxCents / 100,
  shipping: order.totals.deliveryCents / 100,
  items: resolveCartLines(order.lines, PRODUCTS).map(resolvedLineToAnalyticsItem),
});
```

The `clientId` is GA4's anonymous client ID — read it from the `_ga` cookie when the checkout session is created and persist it on the order. Without `clientId`, the server-side event won't deduplicate against the client-side event and won't link to the same user session. This is a Stripe-spec concern, not an analytics-spec concern — flagged here so the future implementer doesn't miss it.

---

## Self-Review (completed during writing)

- **Spec coverage:** Every spec section has a task. Architecture (Tasks 2-11), event catalog (Tasks 4-6, 12-24), privacy/consent (Tasks 3, 9, 25), hybrid purchase Phase 1 (Task 19), Phase 2 readiness (Task 7 + reminder), testing (Tasks 3-7 unit + Task 27 manual).
- **Placeholder scan:** No "TBD"/"TODO"/"add error handling" — all code blocks are concrete. The one "if unsure of location, default to footer" in Task 23 is a documented fallback, not a placeholder.
- **Type consistency:** `AnalyticsItem`, `EngagementLocation`, `PurchasePayload`, `ServerPurchaseInput` are all defined in their respective tasks and used consistently downstream. `resolvedLineToAnalyticsItem` is the single mapping helper used in 5 tasks.
