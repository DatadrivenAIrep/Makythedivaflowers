# Plan 3 — Cart, Checkout, Inquiry & Content Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the v1 loop. After this plan, a visitor can open the cart drawer from any page, manage line items, run the full 3-step checkout, and see a confirmation. They can also browse all remaining marketing routes (Weddings, Events, Story, Journal, Contact), submit inquiry/contact/newsletter forms that persist server-side, and land on stubbed Account screens that are NextAuth-shaped. After Plan 3 the site satisfies the §12 Definition of Done.

**Architecture:** Server Components by default for all routes — every page renders fully on the server with metadata, structured data, and locale-aware copy. The interactive surfaces are isolated `'use client'` leaves: the cart drawer + line controls, the checkout step machine, the inquiry forms, the journal lightbox. Cart state lives in the Zustand store from Plan 1 — Plan 3 adds a tiny `ui-store` for drawer open/close (so the cart icon and the "added to bag" toast can both flip the same boolean without prop-drilling). Forms use `react-hook-form` + `zod`, with the same zod schemas validating server-side in route handlers; submissions are persisted to a gitignored JSON file in v1 and the call site is a one-line swap for Resend/Postmark/Stripe in v2. Long-form content (Story, Journal articles) is plain TSX with editorial primitives — no MDX runtime, the content is hard-coded in EN/ES so v2 Sanity migration is a data-shape swap.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind v4, Framer Motion (existing primitives), `next-intl`, Zustand (existing cart store), `react-hook-form`, `zod`, Vitest, Playwright. New runtime deps: `react-hook-form`, `zod`, `@hookform/resolvers`. No CMS, no Stripe — both are stubbed behind seams the spec calls out.

**Spec reference:** `docs/superpowers/specs/2026-04-30-diva-flowers-design.md` — sections §3, §5.5–5.13, §6.2, §6.3, §7.1, §7.3, §7.4, §7.5, §8, §11, §12.

**Plan dependencies:**
- Plan 1 (`2026-04-30-plan-1-foundation-brand-system.md`) — completed. Reuses: brand tokens, `BloomImage`, `StaggerGroup`, `MagneticButton`, `Button`, `formatMoneyCents`, `formatPhoneUS`, `formatDeliveryWindow`, `useCartStore`, `messages/{en,es}.json` namespacing, `TopNav`/`Footer`/`CartButton`.
- Plan 2 (`2026-04-30-plan-2-catalog-pdp.md`) — must be merged before Plan 3 starts. Reuses: `data/products.ts`, `types/product.ts`, `ProductImage`, `lib/delivery.ts`, `PdpConfigurator`, `AddToBag`, `MegaMenu`, the `cart-store` lookup-by-id pattern.

**Important — Next.js 16 breaking changes:** `AGENTS.md` warns that this is not the Next.js you remember. Before writing any route, route handler, or `generateStaticParams` block, scan `node_modules/next/dist/docs/` for the relevant guide (params shape, metadata, `revalidate`, route handler signature, `cookies()`/`headers()` async API). Plans 1 and 2 use `params: Promise<{ locale: string }>` and `searchParams: Promise<...>`; Plan 3 must do the same. `cookies()` is async too — `await cookies()` everywhere.

---

## File Structure (created or modified in this plan)

```
diva-flowers/
├── app/
│   ├── [locale]/
│   │   ├── cart/
│   │   │   ├── page.tsx                              # Full-page cart
│   │   │   └── loading.tsx
│   │   ├── checkout/
│   │   │   ├── page.tsx                              # 3-step checkout shell
│   │   │   └── loading.tsx
│   │   ├── order/
│   │   │   └── [id]/
│   │   │       └── confirmation/
│   │   │           └── page.tsx                      # Frozen-summary confirmation
│   │   ├── weddings/
│   │   │   ├── page.tsx
│   │   │   └── loading.tsx
│   │   ├── events/
│   │   │   ├── page.tsx
│   │   │   └── loading.tsx
│   │   ├── story/page.tsx                            # Magazine long-form
│   │   ├── journal/
│   │   │   ├── page.tsx                              # Zig-zag index
│   │   │   └── [slug]/page.tsx                       # Article page
│   │   ├── contact/page.tsx
│   │   ├── account/
│   │   │   ├── page.tsx                              # Sign-in stub
│   │   │   ├── sign-up/page.tsx
│   │   │   └── orders/page.tsx
│   │   └── legal/
│   │       ├── privacy/page.tsx
│   │       └── terms/page.tsx
│   ├── api/
│   │   ├── inquiry/route.ts                          # Wedding+event POST handler
│   │   ├── contact/route.ts                          # Contact POST
│   │   ├── newsletter/route.ts                       # Newsletter POST
│   │   └── checkout/route.ts                         # submitOrder POST
│   ├── sitemap.ts                                    # extended: all new routes
│   └── layout.tsx                                    # mount <CartDrawerHost />
├── components/
│   ├── cart/
│   │   ├── CartDrawer.tsx                            # 'use client', global slide-in
│   │   ├── CartDrawerHost.tsx                        # 'use client', mounted in root layout
│   │   ├── CartLineItem.tsx                          # 'use client'
│   │   ├── CartLineQty.tsx                           # 'use client'
│   │   ├── CartEmpty.tsx
│   │   ├── CartSummary.tsx                           # subtotal, delivery note, CTA
│   │   ├── CartPageList.tsx                          # 'use client'
│   │   └── ToastAddedToBag.tsx                       # 'use client', auto-dismiss
│   ├── checkout/
│   │   ├── CheckoutShell.tsx                         # 'use client', accordion machine
│   │   ├── ContactStep.tsx                           # 'use client'
│   │   ├── DeliveryStep.tsx                          # 'use client'
│   │   ├── PaymentStub.tsx                           # 'use client', simulates Stripe
│   │   ├── OrderSummarySticky.tsx                    # 'use client'
│   │   └── ConfirmationView.tsx                      # Server Component
│   ├── inquiry/
│   │   ├── WeddingsForm.tsx                          # 'use client'
│   │   ├── EventsForm.tsx                            # 'use client'
│   │   ├── ContactForm.tsx                           # 'use client'
│   │   ├── NewsletterField.tsx                       # 'use client'
│   │   └── HoneypotField.tsx
│   ├── weddings/
│   │   ├── WeddingsHero.tsx
│   │   ├── ProcessStrip.tsx                          # 'use client', scroll-snap
│   │   ├── MasonryGallery.tsx                        # 'use client', lightbox
│   │   ├── PricingIntent.tsx
│   │   └── WeddingsFAQ.tsx                           # 'use client'
│   ├── events/
│   │   ├── EventsHero.tsx
│   │   └── UseCaseGrid.tsx
│   ├── story/
│   │   ├── StoryHero.tsx                             # lilac pull-quote opener
│   │   ├── ArchSection.tsx
│   │   ├── FounderPortrait.tsx
│   │   └── PressLogos.tsx
│   ├── editorial/
│   │   ├── PullQuote.tsx
│   │   ├── Figure.tsx
│   │   ├── DropCap.tsx
│   │   └── ZigZagItem.tsx
│   ├── contact/
│   │   ├── StudioInfo.tsx
│   │   ├── DeliveryZonePills.tsx
│   │   └── StudioMap.tsx
│   ├── account/
│   │   ├── AccountShell.tsx
│   │   ├── AuthForm.tsx                              # 'use client'
│   │   └── OrdersEmpty.tsx
│   └── legal/
│       └── LegalShell.tsx
├── data/
│   ├── journal.ts                                    # 3 articles in EN/ES
│   ├── press.ts                                      # logo list
│   ├── delivery-zones.ts                             # zip list + pills
│   ├── wedding-portfolio.ts                          # 12 placeholder photos
│   ├── wedding-faq.ts                                # 6 Q/A
│   └── funeral-homes.ts                              # already created in Plan 2 if sympathy used it; otherwise create here
├── lib/
│   ├── cart-helpers.ts                               # line lookup, totals
│   ├── totals.ts                                     # delivery + tax computation
│   ├── ui-store.ts                                   # drawer open/close + toast
│   ├── inquiry-storage.ts                            # write to pending-inquiries.json
│   ├── rate-limit.ts                                 # in-memory IP bucket
│   ├── submit-order.ts                               # client-side wrapper for /api/checkout
│   └── order-storage.ts                              # write/read pending orders by id
├── messages/
│   ├── en.json                                       # extended
│   └── es.json                                       # extended
├── schemas/
│   ├── inquiry.ts
│   ├── contact.ts
│   ├── newsletter.ts
│   └── checkout.ts
├── tests/
│   ├── unit/
│   │   ├── cart-helpers.test.ts
│   │   ├── totals.test.ts
│   │   ├── inquiry-schema.test.ts
│   │   ├── checkout-schema.test.ts
│   │   └── rate-limit.test.ts
│   └── e2e/
│       ├── cart-drawer.spec.ts
│       ├── checkout.spec.ts
│       ├── weddings-inquiry.spec.ts
│       ├── contact.spec.ts
│       ├── journal.spec.ts
│       └── account-stubs.spec.ts
├── types/
│   ├── address.ts
│   ├── inquiry.ts
│   └── order.ts
├── public/
│   └── og/                                           # static OG fallbacks per route family
└── .gitignore                                        # extended: pending-inquiries.json, pending-orders.json
```

---

## Conventions reused throughout this plan

- `params` and `searchParams` are always `Promise<...>` and `await`-ed — Next.js 16.
- `cookies()` and `headers()` are async — `await cookies()`.
- Server Components by default. Anything with `useState`, `useEffect`, event handlers, motion values, or `react-hook-form` is `'use client'`.
- All money is `cents: number`, formatted only at render time via `formatMoneyCents` from Plan 1.
- All copy is bilingual. UI strings → `messages/{en,es}.json`. Content (product/article/FAQ) → `{ en, es }` shape in `data/*.ts`.
- All interactive surfaces have a `prefers-reduced-motion` opt-out (`useReducedMotion` from Framer Motion).
- All forms have a honeypot, IP rate limit, and zod-validated server side.
- All long-running interactions have a `loading.tsx` sibling and an empty-state component.
- Single H1 per page; `lang="en"` or `lang="es"` set by the locale layout from Plan 1.
- Never `h-screen` — use `min-h-[100dvh]`. Never animate `top`/`left`/`width`/`height` — transform + opacity only.

---

# PART A — Cart Drawer & Cart Page

## Task 1: Address & Order types

**Files:**
- Create: `types/address.ts`
- Create: `types/order.ts`

- [ ] **Step 1: Write `types/address.ts`**

```ts
// types/address.ts
export type Address = {
  street1: string;
  street2?: string;
  city: string;
  state: string;
  zip: string;
  country: "US";
};
```

- [ ] **Step 2: Write `types/order.ts` matching spec §6.3**

```ts
// types/order.ts
import type { Address } from "@/types/address";
import type { CartLine } from "@/lib/cart-store";

export type DeliverySlot = "morning" | "midday" | "afternoon" | "evening";

export type DeliveryWindow = {
  date: string; // YYYY-MM-DD
  slot: DeliverySlot;
};

export type Recipient = {
  name: string;
  phone: string;
};

export type OrderTotals = {
  subtotalCents: number;
  deliveryCents: number;
  taxCents: number;
  totalCents: number;
};

export type OrderStatus =
  | "pending"
  | "paid"
  | "preparing"
  | "out-for-delivery"
  | "delivered"
  | "failed";

export type Order = {
  id: string;
  locale: "en" | "es";
  lines: CartLine[];
  delivery: {
    recipient: Recipient;
    address: Address;
    window: DeliveryWindow;
    cardMessage?: string;
  };
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

- [ ] **Step 3: Commit**

```bash
git add types/address.ts types/order.ts
git commit -m "feat(types): add Address and Order types for checkout"
```

---

## Task 2: Cart helpers — line lookup & subtotal (TDD)

**Files:**
- Create: `lib/cart-helpers.ts`
- Test: `tests/unit/cart-helpers.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/cart-helpers.test.ts
import { describe, it, expect } from "vitest";
import {
  resolveCartLine,
  resolveCartLines,
  cartSubtotalCents,
  cartCount,
} from "@/lib/cart-helpers";
import type { Product } from "@/types/product";
import type { CartLine } from "@/lib/cart-store";

const products: Product[] = [
  {
    id: "p1",
    slug: "rose-noir",
    title: { en: "Rose Noir", es: "Rosa Noir" },
    category: "arrangements",
    blurb: { en: "", es: "" },
    description: { en: "", es: "" },
    images: [{ src: "/x.jpg", alt: { en: "", es: "" }, aspect: "4/5" }],
    variants: [
      { id: "std", label: { en: "Standard", es: "Estándar" }, priceCents: 18700 },
      { id: "grand", label: { en: "Grand", es: "Grande" }, priceCents: 26400 },
    ],
    addOns: [
      { id: "vase", label: { en: "Vase upgrade", es: "Florero" }, priceCents: 3500 },
    ],
    tags: [],
    occasions: [],
    colorFamily: [],
    active: true,
    seo: {
      title: { en: "", es: "" },
      description: { en: "", es: "" },
    },
  },
];

describe("resolveCartLine", () => {
  it("returns null when product or variant missing", () => {
    expect(resolveCartLine({ productId: "missing", variantId: "std", addOnIds: [], qty: 1 }, products)).toBeNull();
    expect(resolveCartLine({ productId: "p1", variantId: "missing", addOnIds: [], qty: 1 }, products)).toBeNull();
  });

  it("computes line total from variant + add-ons × qty", () => {
    const line: CartLine = { productId: "p1", variantId: "grand", addOnIds: ["vase"], qty: 2 };
    const r = resolveCartLine(line, products);
    expect(r).not.toBeNull();
    expect(r!.product.id).toBe("p1");
    expect(r!.variant.id).toBe("grand");
    expect(r!.addOns).toHaveLength(1);
    expect(r!.unitPriceCents).toBe(26400 + 3500);
    expect(r!.lineTotalCents).toBe((26400 + 3500) * 2);
  });
});

describe("resolveCartLines", () => {
  it("filters out unresolvable lines", () => {
    const lines: CartLine[] = [
      { productId: "p1", variantId: "std", addOnIds: [], qty: 1 },
      { productId: "missing", variantId: "x", addOnIds: [], qty: 1 },
    ];
    const r = resolveCartLines(lines, products);
    expect(r).toHaveLength(1);
  });
});

describe("cartSubtotalCents", () => {
  it("sums line totals, ignoring missing products", () => {
    const lines: CartLine[] = [
      { productId: "p1", variantId: "std", addOnIds: [], qty: 1 },
      { productId: "p1", variantId: "grand", addOnIds: ["vase"], qty: 2 },
    ];
    expect(cartSubtotalCents(lines, products)).toBe(18700 + (26400 + 3500) * 2);
  });
});

describe("cartCount", () => {
  it("sums qty across lines", () => {
    expect(cartCount([
      { productId: "p1", variantId: "std", addOnIds: [], qty: 2 },
      { productId: "p1", variantId: "grand", addOnIds: [], qty: 3 },
    ])).toBe(5);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run tests/unit/cart-helpers.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the helpers**

```ts
// lib/cart-helpers.ts
import type { Product, ProductAddOn, ProductVariant } from "@/types/product";
import type { CartLine } from "@/lib/cart-store";

export type ResolvedCartLine = {
  line: CartLine;
  product: Product;
  variant: ProductVariant;
  addOns: ProductAddOn[];
  unitPriceCents: number;
  lineTotalCents: number;
};

export function resolveCartLine(
  line: CartLine,
  products: readonly Product[],
): ResolvedCartLine | null {
  const product = products.find((p) => p.id === line.productId);
  if (!product) return null;
  const variant = product.variants.find((v) => v.id === line.variantId);
  if (!variant) return null;
  const addOns = (product.addOns ?? []).filter((a) => line.addOnIds.includes(a.id));
  const addOnTotal = addOns.reduce((s, a) => s + a.priceCents, 0);
  const unitPriceCents = variant.priceCents + addOnTotal;
  return {
    line,
    product,
    variant,
    addOns,
    unitPriceCents,
    lineTotalCents: unitPriceCents * line.qty,
  };
}

export function resolveCartLines(
  lines: readonly CartLine[],
  products: readonly Product[],
): ResolvedCartLine[] {
  return lines
    .map((l) => resolveCartLine(l, products))
    .filter((r): r is ResolvedCartLine => r !== null);
}

export function cartSubtotalCents(
  lines: readonly CartLine[],
  products: readonly Product[],
): number {
  return resolveCartLines(lines, products).reduce((s, r) => s + r.lineTotalCents, 0);
}

export function cartCount(lines: readonly CartLine[]): number {
  return lines.reduce((s, l) => s + l.qty, 0);
}
```

- [ ] **Step 4: Verify the test passes**

Run: `pnpm vitest run tests/unit/cart-helpers.test.ts`
Expected: PASS — 5 tests green.

- [ ] **Step 5: Commit**

```bash
git add lib/cart-helpers.ts tests/unit/cart-helpers.test.ts
git commit -m "feat(cart): add cart-helpers with line resolution and subtotal"
```

---

## Task 3: UI store — drawer open/close + toast (no persist)

**Files:**
- Create: `lib/ui-store.ts`

- [ ] **Step 1: Write the store**

This intentionally does **not** use `persist` — drawer open state must reset on every page load. It is separate from the `useCartStore` so the drawer can also be opened by toasts or by `AddToBag` without forcing the cart store to know about UI.

```ts
// lib/ui-store.ts
"use client";
import { create } from "zustand";

type ToastKind = "added-to-bag" | "inquiry-sent" | "newsletter-sent";

type UIState = {
  drawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  toast: { kind: ToastKind; productId?: string } | null;
  showToast: (t: { kind: ToastKind; productId?: string }) => void;
  clearToast: () => void;
};

export const useUIStore = create<UIState>((set) => ({
  drawerOpen: false,
  openDrawer: () => set({ drawerOpen: true }),
  closeDrawer: () => set({ drawerOpen: false }),
  toast: null,
  showToast: (t) => set({ toast: t }),
  clearToast: () => set({ toast: null }),
}));
```

- [ ] **Step 2: Commit**

```bash
git add lib/ui-store.ts
git commit -m "feat(ui): add ui-store for drawer + toast state"
```

---

## Task 4: CartLineQty stepper

**Files:**
- Create: `components/cart/CartLineQty.tsx`

- [ ] **Step 1: Write the component**

```tsx
// components/cart/CartLineQty.tsx
"use client";
import { Minus, Plus } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";

type Props = {
  qty: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
};

export function CartLineQty({ qty, onChange, min = 0, max = 99 }: Props) {
  const t = useTranslations("cart");
  const dec = () => onChange(Math.max(min, qty - 1));
  const inc = () => onChange(Math.min(max, qty + 1));
  return (
    <div
      role="group"
      aria-label={t("qty_label")}
      className="inline-flex items-center gap-1 rounded-full border border-ink/10 px-1 py-0.5"
    >
      <button
        type="button"
        onClick={dec}
        aria-label={t("qty_decrease")}
        className="inline-flex h-6 w-6 items-center justify-center rounded-full text-ink/70 hover:text-ink hover:bg-ink/5 disabled:opacity-30"
        disabled={qty <= min}
      >
        <Minus size={12} />
      </button>
      <span className="font-mono text-[12px] tabular-nums w-5 text-center">{qty}</span>
      <button
        type="button"
        onClick={inc}
        aria-label={t("qty_increase")}
        className="inline-flex h-6 w-6 items-center justify-center rounded-full text-ink/70 hover:text-ink hover:bg-ink/5 disabled:opacity-30"
        disabled={qty >= max}
      >
        <Plus size={12} />
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/cart/CartLineQty.tsx
git commit -m "feat(cart): add qty stepper"
```

---

## Task 5: CartLineItem (drawer line)

**Files:**
- Create: `components/cart/CartLineItem.tsx`

- [ ] **Step 1: Write the component**

```tsx
// components/cart/CartLineItem.tsx
"use client";
import { X } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";
import { ProductImage } from "@/components/product/ProductImage";
import { CartLineQty } from "@/components/cart/CartLineQty";
import { formatMoneyCents } from "@/lib/format";
import type { Locale } from "@/types/locale";
import type { ResolvedCartLine } from "@/lib/cart-helpers";

type Props = {
  resolved: ResolvedCartLine;
  locale: Locale;
  onQtyChange: (next: number) => void;
  onRemove: () => void;
  variant?: "drawer" | "page";
};

export function CartLineItem({ resolved, locale, onQtyChange, onRemove, variant = "drawer" }: Props) {
  const t = useTranslations("cart");
  const { product, variant: v, addOns, lineTotalCents } = resolved;
  const image = product.images[0];
  const isPage = variant === "page";
  return (
    <li
      className={`grid gap-3 ${
        isPage ? "grid-cols-[100px_1fr_auto] py-6 border-b border-ink/10 last:border-0" : "grid-cols-[64px_1fr_auto] py-3"
      }`}
    >
      <div className={`overflow-hidden rounded-xl bg-bone ${isPage ? "aspect-[4/5]" : "aspect-square h-16"}`}>
        <ProductImage
          src={image.src}
          alt={image.alt[locale]}
          aspect={isPage ? "4/5" : "1/1"}
          sizes={isPage ? "100px" : "64px"}
        />
      </div>
      <div className="flex flex-col justify-between min-w-0">
        <div className="min-w-0">
          <p className={`font-display ${isPage ? "text-lg" : "text-sm"} text-ink truncate leading-tight`}>
            {product.title[locale]}
          </p>
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink/60 mt-0.5">
            {v.label[locale]}
            {addOns.length > 0 && <> · {addOns.map((a) => a.label[locale]).join(" · ")}</>}
          </p>
        </div>
        <div className="flex items-center gap-3 mt-2">
          <CartLineQty qty={resolved.line.qty} onChange={onQtyChange} />
          <button
            type="button"
            onClick={onRemove}
            className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.16em] text-ink/60 hover:text-rouge"
          >
            <X size={12} />
            {t("remove")}
          </button>
        </div>
      </div>
      <div className="text-right">
        <p className="font-mono text-sm tabular-nums text-ink">
          {formatMoneyCents(lineTotalCents, locale)}
        </p>
      </div>
    </li>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/cart/CartLineItem.tsx
git commit -m "feat(cart): add cart line item with qty + remove"
```

---

## Task 6: CartEmpty + CartSummary

**Files:**
- Create: `components/cart/CartEmpty.tsx`
- Create: `components/cart/CartSummary.tsx`

- [ ] **Step 1: Write `CartEmpty.tsx`**

```tsx
// components/cart/CartEmpty.tsx
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/types/locale";

export function CartEmpty({ locale, onClose }: { locale: Locale; onClose?: () => void }) {
  const t = useTranslations("cart");
  return (
    <div className="flex flex-col items-center justify-center text-center px-6 py-16 gap-6">
      <p className="font-display text-2xl text-ink leading-tight">{t("empty_title")}</p>
      <p className="text-sm text-ink/70 max-w-[36ch]">{t("empty_body")}</p>
      <Button asChild variant="primary">
        <Link href={`/${locale}/shop`} onClick={onClose}>
          {t("empty_cta")}
        </Link>
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Write `CartSummary.tsx`**

The drawer summary is intentionally minimal — delivery + tax are computed in checkout, not here.

```tsx
// components/cart/CartSummary.tsx
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { formatMoneyCents } from "@/lib/format";
import type { Locale } from "@/types/locale";

type Props = {
  subtotalCents: number;
  locale: Locale;
  onCheckout?: () => void;
};

export function CartSummary({ subtotalCents, locale, onCheckout }: Props) {
  const t = useTranslations("cart");
  return (
    <div className="border-t border-ink/10 px-5 py-5 flex flex-col gap-4 bg-bone/80 backdrop-blur-md">
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink/60">
          {t("subtotal")}
        </span>
        <span className="font-mono text-base tabular-nums text-ink">
          {formatMoneyCents(subtotalCents, locale)}
        </span>
      </div>
      <p className="text-[11px] text-ink/55 leading-snug">{t("calculated_at_checkout")}</p>
      <Button asChild variant="primary" className="w-full">
        <Link href={`/${locale}/checkout`} onClick={onCheckout}>
          {t("checkout_cta")}
        </Link>
      </Button>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add components/cart/CartEmpty.tsx components/cart/CartSummary.tsx
git commit -m "feat(cart): add empty state and summary block"
```

---

## Task 7: CartDrawer + CartDrawerHost

**Files:**
- Create: `components/cart/CartDrawer.tsx`
- Create: `components/cart/CartDrawerHost.tsx`
- Modify: `app/[locale]/layout.tsx` (mount the host)

- [ ] **Step 1: Write `CartDrawer.tsx`**

The drawer is a controlled, animated `<aside>` over a backdrop. Hydration-safe: the cart store is read via the existing `useStore`-style pattern (it already runs `'use client'`). ESC closes, focus is trapped while open, body scroll is locked. Liquid-glass surface (§4.6, §5.5).

```tsx
// components/cart/CartDrawer.tsx
"use client";
import { useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { X } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";
import { useCartStore } from "@/lib/cart-store";
import { useUIStore } from "@/lib/ui-store";
import { resolveCartLines, cartSubtotalCents } from "@/lib/cart-helpers";
import { CartLineItem } from "@/components/cart/CartLineItem";
import { CartEmpty } from "@/components/cart/CartEmpty";
import { CartSummary } from "@/components/cart/CartSummary";
import { products } from "@/data/products";
import type { Locale } from "@/types/locale";
import { springs } from "@/lib/motion-config";

export function CartDrawer({ locale }: { locale: Locale }) {
  const t = useTranslations("cart");
  const lines = useCartStore((s) => s.lines);
  const setQty = useCartStore((s) => s.setQty);
  const remove = useCartStore((s) => s.remove);
  const open = useUIStore((s) => s.drawerOpen);
  const close = useUIStore((s) => s.closeDrawer);
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement | null>(null);

  const resolved = useMemo(() => resolveCartLines(lines, products), [lines]);
  const subtotal = useMemo(() => cartSubtotalCents(lines, products), [lines]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, close]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            type="button"
            aria-label={t("close")}
            onClick={close}
            className="fixed inset-0 z-50 bg-ink/30 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={reduce ? { duration: 0 } : { duration: 0.18 }}
          />
          <motion.aside
            ref={ref}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={t("title")}
            className="fixed right-0 top-0 z-50 h-[100dvh] w-full max-w-[440px] bg-bone/85 backdrop-blur-xl border-l border-ink/10 shadow-[0_8px_60px_-16px_rgba(184,52,94,0.18)] flex flex-col outline-none"
            initial={reduce ? { opacity: 0 } : { x: "100%" }}
            animate={reduce ? { opacity: 1 } : { x: 0 }}
            exit={reduce ? { opacity: 0 } : { x: "100%" }}
            transition={reduce ? { duration: 0 } : springs.snappy}
          >
            <header className="flex items-center justify-between px-5 py-4 border-b border-ink/10">
              <p className="font-display text-xl text-ink">{t("title")}</p>
              <button
                type="button"
                onClick={close}
                aria-label={t("close")}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink/70 hover:text-ink hover:bg-ink/5"
              >
                <X size={16} />
              </button>
            </header>
            {resolved.length === 0 ? (
              <CartEmpty locale={locale} onClose={close} />
            ) : (
              <>
                <ul className="flex-1 overflow-y-auto px-5 divide-y divide-ink/5">
                  {resolved.map((r) => (
                    <CartLineItem
                      key={`${r.line.productId}-${r.line.variantId}`}
                      resolved={r}
                      locale={locale}
                      onQtyChange={(n) => setQty(r.line.productId, r.line.variantId, n)}
                      onRemove={() => remove(r.line.productId, r.line.variantId)}
                    />
                  ))}
                </ul>
                <CartSummary subtotalCents={subtotal} locale={locale} onCheckout={close} />
              </>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
```

- [ ] **Step 2: Write `CartDrawerHost.tsx`**

A thin client wrapper so the root layout (Server Component) can mount it without becoming client.

```tsx
// components/cart/CartDrawerHost.tsx
"use client";
import { CartDrawer } from "@/components/cart/CartDrawer";
import type { Locale } from "@/types/locale";

export function CartDrawerHost({ locale }: { locale: Locale }) {
  return <CartDrawer locale={locale} />;
}
```

- [ ] **Step 3: Mount in `app/[locale]/layout.tsx`**

Inside the existing layout, after `<Footer />`:

```tsx
import { CartDrawerHost } from "@/components/cart/CartDrawerHost";
// ...
<CartDrawerHost locale={locale} />
```

- [ ] **Step 4: Boot dev and verify**

Run: `pnpm dev`
Open: `http://localhost:3000/en/shop`
Expected: page loads with no errors. Drawer is not visible (closed by default).

- [ ] **Step 5: Commit**

```bash
git add components/cart/CartDrawer.tsx components/cart/CartDrawerHost.tsx app/[locale]/layout.tsx
git commit -m "feat(cart): add global cart drawer with backdrop, ESC, scroll lock"
```

---

## Task 8: Wire CartButton + AddToBag to drawer

**Files:**
- Modify: `components/nav/CartButton.tsx`
- Modify: `components/product/AddToBag.tsx` (from Plan 2)
- Create: `components/cart/ToastAddedToBag.tsx`

- [ ] **Step 1: Replace `CartButton` with reactive count + drawer toggle**

```tsx
// components/nav/CartButton.tsx
"use client";
import { Bag } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";
import { useCartStore } from "@/lib/cart-store";
import { useUIStore } from "@/lib/ui-store";
import { cartCount } from "@/lib/cart-helpers";

export function CartButton({ locale }: { locale: "en" | "es" }) {
  const t = useTranslations("nav");
  const lines = useCartStore((s) => s.lines);
  const open = useUIStore((s) => s.openDrawer);
  const count = cartCount(lines);
  return (
    <button
      type="button"
      onClick={open}
      aria-label={`${t("cart")} (${count})`}
      className="relative inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-ink/80 hover:text-ink transition-colors"
    >
      <Bag size={18} weight="regular" />
      <span className="font-mono text-[11px] uppercase tracking-[0.18em]">{t("cart")}</span>
      {count > 0 && (
        <span className="ml-0.5 inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full bg-rouge text-bone text-[10px] font-mono">
          {count}
        </span>
      )}
    </button>
  );
}
```

> Locale prop is no longer used by the button itself but is preserved for API stability with `TopNav`.

- [ ] **Step 2: Hydration guard**

Because the count comes from `localStorage` and Next renders the button on the server first, the badge can flash. Add a mount flag:

```tsx
import { useEffect, useState } from "react";
// ...
const [mounted, setMounted] = useState(false);
useEffect(() => setMounted(true), []);
const visibleCount = mounted ? count : 0;
```

…and use `visibleCount` for both `aria-label` and the badge.

- [ ] **Step 3: Wire `AddToBag` from Plan 2 to flip the drawer + show toast**

Locate the `add(...)` call in `components/product/AddToBag.tsx` (Plan 2 Task 18). Right after, add:

```tsx
import { useUIStore } from "@/lib/ui-store";
// ...
const showToast = useUIStore((s) => s.showToast);
const openDrawer = useUIStore((s) => s.openDrawer);
// ...
add({ productId, variantId, addOnIds, qty });
showToast({ kind: "added-to-bag", productId });
openDrawer();
```

- [ ] **Step 4: Write `ToastAddedToBag.tsx`**

Mounted in the root layout near the drawer host. Auto-dismisses after 3.5s. Reduced motion just shows/hides.

```tsx
// components/cart/ToastAddedToBag.tsx
"use client";
import { useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Check } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";
import { useUIStore } from "@/lib/ui-store";
import { springs } from "@/lib/motion-config";

export function ToastAddedToBag() {
  const t = useTranslations("cart");
  const toast = useUIStore((s) => s.toast);
  const clear = useUIStore((s) => s.clearToast);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(clear, 3500);
    return () => clearTimeout(id);
  }, [toast, clear]);

  return (
    <AnimatePresence>
      {toast?.kind === "added-to-bag" && (
        <motion.div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] inline-flex items-center gap-2 px-4 py-2 rounded-full bg-ink text-bone shadow-lg"
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16 }}
          animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: 16 }}
          transition={reduce ? { duration: 0 } : springs.soft}
        >
          <Check size={14} />
          <span className="font-mono text-[11px] uppercase tracking-[0.18em]">{t("toast_added")}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

Mount in `app/[locale]/layout.tsx` next to `<CartDrawerHost />`.

- [ ] **Step 5: Boot dev and verify**

Run: `pnpm dev`
Open a PDP, click "Add to bag." Expected: drawer slides in, toast shows briefly, count badge updates.

- [ ] **Step 6: Commit**

```bash
git add components/nav/CartButton.tsx components/product/AddToBag.tsx components/cart/ToastAddedToBag.tsx app/[locale]/layout.tsx
git commit -m "feat(cart): wire add-to-bag → drawer + toast + reactive count"
```

---

## Task 9: Cart full-page route

**Files:**
- Create: `app/[locale]/cart/page.tsx`
- Create: `app/[locale]/cart/loading.tsx`
- Create: `components/cart/CartPageList.tsx`

- [ ] **Step 1: Write `CartPageList.tsx`**

Reuses `CartLineItem` with `variant="page"`. Shows summary in a sticky sidebar on `lg:`.

```tsx
// components/cart/CartPageList.tsx
"use client";
import Link from "next/link";
import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { useCartStore } from "@/lib/cart-store";
import { resolveCartLines, cartSubtotalCents } from "@/lib/cart-helpers";
import { CartLineItem } from "@/components/cart/CartLineItem";
import { CartEmpty } from "@/components/cart/CartEmpty";
import { Button } from "@/components/ui/button";
import { formatMoneyCents } from "@/lib/format";
import { products } from "@/data/products";
import type { Locale } from "@/types/locale";

export function CartPageList({ locale }: { locale: Locale }) {
  const t = useTranslations("cart");
  const lines = useCartStore((s) => s.lines);
  const setQty = useCartStore((s) => s.setQty);
  const remove = useCartStore((s) => s.remove);
  const resolved = useMemo(() => resolveCartLines(lines, products), [lines]);
  const subtotal = useMemo(() => cartSubtotalCents(lines, products), [lines]);

  if (resolved.length === 0) {
    return <CartEmpty locale={locale} />;
  }

  return (
    <div className="grid gap-12 lg:grid-cols-[1fr_360px] lg:gap-16">
      <ul className="divide-y divide-ink/10">
        {resolved.map((r) => (
          <CartLineItem
            key={`${r.line.productId}-${r.line.variantId}`}
            resolved={r}
            locale={locale}
            variant="page"
            onQtyChange={(n) => setQty(r.line.productId, r.line.variantId, n)}
            onRemove={() => remove(r.line.productId, r.line.variantId)}
          />
        ))}
      </ul>
      <aside className="lg:sticky lg:top-24 self-start space-y-5 rounded-2xl border border-ink/10 p-6">
        <p className="font-display text-xl text-ink">{t("summary_title")}</p>
        <div className="flex items-baseline justify-between border-t border-ink/10 pt-4">
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink/60">{t("subtotal")}</span>
          <span className="font-mono text-base tabular-nums text-ink">{formatMoneyCents(subtotal, locale)}</span>
        </div>
        <p className="text-[11px] text-ink/55 leading-snug">{t("calculated_at_checkout")}</p>
        <Button asChild variant="primary" className="w-full">
          <Link href={`/${locale}/checkout`}>{t("checkout_cta")}</Link>
        </Button>
      </aside>
    </div>
  );
}
```

- [ ] **Step 2: Write the page**

```tsx
// app/[locale]/cart/page.tsx
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { CartPageList } from "@/components/cart/CartPageList";
import type { Locale } from "@/types/locale";

export async function generateMetadata({
  params,
}: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "cart" });
  return {
    title: t("page_title"),
    description: t("page_description"),
    alternates: {
      languages: { en: "/en/cart", es: "/es/cart" },
    },
  };
}

export default async function CartPage({
  params,
}: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "cart" });
  return (
    <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-32 pb-24">
      <header className="mb-10 max-w-2xl">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink/60">{t("page_eyebrow")}</p>
        <h1 className="mt-3 font-display text-5xl sm:text-6xl text-ink leading-[0.95] tracking-tighter">
          {t("page_title")}
        </h1>
      </header>
      <CartPageList locale={locale} />
    </main>
  );
}
```

- [ ] **Step 3: Write `loading.tsx`**

```tsx
// app/[locale]/cart/loading.tsx
export default function Loading() {
  return (
    <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-32 pb-24">
      <div className="h-12 w-64 bg-ink/5 rounded-md animate-pulse" />
      <div className="mt-10 grid gap-12 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-32 bg-ink/5 rounded-2xl animate-pulse" />
          ))}
        </div>
        <div className="h-64 bg-ink/5 rounded-2xl animate-pulse" />
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Update `CartButton` so it goes to `/cart` on small screens, opens drawer on lg+**

Replace the `<button>` with a smarter element: open drawer on `lg:`, navigate to `/cart` on smaller screens. Simpler: keep button-only and add a small "View full cart" link inside the drawer header for both. Verify the drawer's CartSummary `Link` already points to `/checkout` and that's the canonical CTA.

(Decision: drawer is the primary surface; `/cart` is reachable via direct URL and from the drawer header's "View full cart" link.)

Add to drawer header:

```tsx
<Link href={`/${locale}/cart`} onClick={close} className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink/60 hover:text-ink">
  {t("view_full")}
</Link>
```

- [ ] **Step 5: Commit**

```bash
git add app/[locale]/cart components/cart/CartPageList.tsx components/cart/CartDrawer.tsx
git commit -m "feat(cart): add /cart full-page route + drawer link to it"
```

---

# PART B — Checkout & Confirmation

## Task 10: Install form deps

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install**

Run:
```bash
pnpm add react-hook-form zod @hookform/resolvers
```

Expected: `package.json` gains `react-hook-form`, `zod`, `@hookform/resolvers`. `pnpm-lock.yaml` updated.

- [ ] **Step 2: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add react-hook-form + zod for forms"
```

---

## Task 11: Totals helper (TDD)

**Files:**
- Create: `lib/totals.ts`
- Test: `tests/unit/totals.test.ts`

Spec §5.6 requires real totals on the order summary. Delivery is a flat fee in v1; tax is a flat 8.625% (NY combined ballpark — the spec doesn't pin a number, this is a believable v1 placeholder). Both are isolated here so a v2 rules engine is a one-file swap.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/totals.test.ts
import { describe, it, expect } from "vitest";
import { computeOrderTotals, DELIVERY_FLAT_CENTS, TAX_RATE } from "@/lib/totals";

describe("computeOrderTotals", () => {
  it("adds delivery + tax to subtotal, rounded to nearest cent", () => {
    const totals = computeOrderTotals(20000); // $200
    expect(totals.subtotalCents).toBe(20000);
    expect(totals.deliveryCents).toBe(DELIVERY_FLAT_CENTS);
    expect(totals.taxCents).toBe(Math.round((20000 + DELIVERY_FLAT_CENTS) * TAX_RATE));
    expect(totals.totalCents).toBe(20000 + DELIVERY_FLAT_CENTS + totals.taxCents);
  });

  it("treats zero subtotal as zero everything", () => {
    const totals = computeOrderTotals(0);
    expect(totals).toEqual({ subtotalCents: 0, deliveryCents: 0, taxCents: 0, totalCents: 0 });
  });
});
```

- [ ] **Step 2: Run, expect FAIL** — `pnpm vitest run tests/unit/totals.test.ts`

- [ ] **Step 3: Write `lib/totals.ts`**

```ts
// lib/totals.ts
import type { OrderTotals } from "@/types/order";

export const DELIVERY_FLAT_CENTS = 1500; // $15 flat, Long Island & Queens
export const TAX_RATE = 0.08625; // NY combined ballpark (Nassau)

export function computeOrderTotals(subtotalCents: number): OrderTotals {
  if (subtotalCents <= 0) {
    return { subtotalCents: 0, deliveryCents: 0, taxCents: 0, totalCents: 0 };
  }
  const deliveryCents = DELIVERY_FLAT_CENTS;
  const taxCents = Math.round((subtotalCents + deliveryCents) * TAX_RATE);
  return {
    subtotalCents,
    deliveryCents,
    taxCents,
    totalCents: subtotalCents + deliveryCents + taxCents,
  };
}
```

- [ ] **Step 4: Run, expect PASS** — `pnpm vitest run tests/unit/totals.test.ts`

- [ ] **Step 5: Commit**

```bash
git add lib/totals.ts tests/unit/totals.test.ts
git commit -m "feat(checkout): add order totals helper with delivery + tax"
```

---

## Task 12: Checkout zod schema (TDD)

**Files:**
- Create: `schemas/checkout.ts`
- Test: `tests/unit/checkout-schema.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/checkout-schema.test.ts
import { describe, it, expect } from "vitest";
import { checkoutSchema } from "@/schemas/checkout";

const valid = {
  contact: { email: "lola@example.com", phone: "5164843456" },
  delivery: {
    recipient: { name: "Lola Cardona", phone: "5165550101" },
    address: { street1: "1077 Hempstead Tpke", city: "Franklin Square", state: "NY", zip: "11010", country: "US" as const },
    window: { date: "2026-05-15", slot: "midday" as const },
    cardMessage: "Happy birthday",
  },
};

describe("checkoutSchema", () => {
  it("accepts a valid payload", () => {
    expect(checkoutSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects bad email", () => {
    const bad = { ...valid, contact: { ...valid.contact, email: "nope" } };
    expect(checkoutSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects phone shorter than 10 digits", () => {
    const bad = { ...valid, contact: { ...valid.contact, phone: "123" } };
    expect(checkoutSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects 5-digit zip with letters", () => {
    const bad = {
      ...valid,
      delivery: { ...valid.delivery, address: { ...valid.delivery.address, zip: "ABCDE" } },
    };
    expect(checkoutSchema.safeParse(bad).success).toBe(false);
  });

  it("caps cardMessage at 200 chars", () => {
    const bad = {
      ...valid,
      delivery: { ...valid.delivery, cardMessage: "x".repeat(201) },
    };
    expect(checkoutSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects past delivery dates", () => {
    const bad = {
      ...valid,
      delivery: { ...valid.delivery, window: { date: "2020-01-01", slot: "midday" as const } },
    };
    expect(checkoutSchema.safeParse(bad).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

- [ ] **Step 3: Write `schemas/checkout.ts`**

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

export const checkoutSchema = z.object({
  contact: z.object({
    email: z.string().email("email_invalid"),
    phone,
  }),
  delivery: z.object({
    recipient: z.object({
      name: z.string().min(2, "name_too_short").max(80),
      phone,
    }),
    address: z.object({
      street1: z.string().min(3, "street_required").max(120),
      street2: z.string().max(120).optional().or(z.literal("")),
      city: z.string().min(2, "city_required").max(80),
      state: z.string().length(2, "state_invalid"),
      zip,
      country: z.literal("US"),
    }),
    window: z.object({
      date,
      slot: z.enum(["morning", "midday", "afternoon", "evening"]),
    }),
    cardMessage: z.string().max(200, "card_too_long").optional().or(z.literal("")),
  }),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;
```

- [ ] **Step 4: Run, expect PASS**

- [ ] **Step 5: Commit**

```bash
git add schemas/checkout.ts tests/unit/checkout-schema.test.ts
git commit -m "feat(checkout): add zod schema for checkout form"
```

---

## Task 13: Order storage stub

**Files:**
- Create: `lib/order-storage.ts`
- Modify: `.gitignore`

The v1 stub writes to `pending-orders.json` so the confirmation page can read the order back. Path is gitignored.

- [ ] **Step 1: Update `.gitignore`**

Add lines:
```
pending-orders.json
pending-inquiries.json
```

- [ ] **Step 2: Write `lib/order-storage.ts`**

```ts
// lib/order-storage.ts
import { promises as fs } from "node:fs";
import path from "node:path";
import type { Order } from "@/types/order";

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

export async function saveOrder(order: Order): Promise<void> {
  const all = await readAll();
  all.push(order);
  await fs.writeFile(FILE, JSON.stringify(all, null, 2), "utf8");
}

export async function getOrder(id: string): Promise<Order | null> {
  const all = await readAll();
  return all.find((o) => o.id === id) ?? null;
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/order-storage.ts .gitignore
git commit -m "feat(checkout): add file-backed order storage stub"
```

---

## Task 14: `/api/checkout` route handler

**Files:**
- Create: `app/api/checkout/route.ts`

- [ ] **Step 1: Write the route**

It re-validates the payload with the same `checkoutSchema`, recomputes totals from the cart payload (never trust client totals), simulates an 800ms Stripe call, and persists. Returns `{ id }` so the client can `router.push` to the confirmation page.

```ts
// app/api/checkout/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { checkoutSchema } from "@/schemas/checkout";
import { computeOrderTotals } from "@/lib/totals";
import { cartSubtotalCents } from "@/lib/cart-helpers";
import { products } from "@/data/products";
import { saveOrder } from "@/lib/order-storage";
import type { Order } from "@/types/order";
import type { CartLine } from "@/lib/cart-store";

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
    return NextResponse.json({ ok: false, errors: parsed.error.flatten() }, { status: 400 });
  }
  const { locale, lines, form } = parsed.data;
  const subtotal = cartSubtotalCents(lines as CartLine[], products);
  if (subtotal <= 0) {
    return NextResponse.json({ ok: false, errors: { formErrors: ["cart_empty"] } }, { status: 400 });
  }
  const totals = computeOrderTotals(subtotal);

  // Simulated Stripe latency
  await new Promise((r) => setTimeout(r, 800));

  const id = `do_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const order: Order = {
    id,
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
    status: "paid", // stub: assume successful payment
    createdAt: new Date().toISOString(),
  };
  await saveOrder(order);

  return NextResponse.json({ ok: true, id }, { status: 200 });
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/checkout/route.ts
git commit -m "feat(checkout): add /api/checkout stub with server-side validation"
```

---

## Task 15: Client wrapper `submitOrder()`

**Files:**
- Create: `lib/submit-order.ts`

- [ ] **Step 1: Write the wrapper**

Tiny isomorphic-friendly POST wrapper. Returns `{ ok, id?, errors? }`.

```ts
// lib/submit-order.ts
import type { CheckoutInput } from "@/schemas/checkout";
import type { CartLine } from "@/lib/cart-store";
import type { Locale } from "@/types/locale";

export type SubmitOrderResult =
  | { ok: true; id: string }
  | { ok: false; errors: { fieldErrors?: Record<string, string[]>; formErrors?: string[] } };

export async function submitOrder(input: {
  locale: Locale;
  lines: CartLine[];
  form: CheckoutInput;
}): Promise<SubmitOrderResult> {
  const res = await fetch("/api/checkout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.ok) {
    return { ok: false, errors: data?.errors ?? { formErrors: ["unknown_error"] } };
  }
  return { ok: true, id: data.id as string };
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/submit-order.ts
git commit -m "feat(checkout): add client submitOrder() wrapper"
```

---

## Task 16: ContactStep + DeliveryStep + PaymentStub fields

**Files:**
- Create: `components/checkout/ContactStep.tsx`
- Create: `components/checkout/DeliveryStep.tsx`
- Create: `components/checkout/PaymentStub.tsx`

Each step receives `register`, `formState`, `getValues` from a parent `useForm` instance. They render fields only — the parent owns navigation and submit.

- [ ] **Step 1: Write `ContactStep.tsx`**

```tsx
// components/checkout/ContactStep.tsx
"use client";
import type { UseFormReturn } from "react-hook-form";
import { useTranslations } from "next-intl";
import type { CheckoutInput } from "@/schemas/checkout";

type Props = { form: UseFormReturn<CheckoutInput> };

export function ContactStep({ form }: Props) {
  const t = useTranslations("checkout");
  const { register, formState } = form;
  const errors = formState.errors.contact;
  return (
    <div className="space-y-5">
      <Field
        label={t("email")}
        error={errors?.email && t(`errors.${errors.email.message ?? "email_invalid"}`)}
        type="email"
        autoComplete="email"
        required
        {...register("contact.email")}
      />
      <Field
        label={t("phone")}
        error={errors?.phone && t(`errors.${errors.phone.message ?? "phone_too_short"}`)}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        required
        {...register("contact.phone")}
      />
    </div>
  );
}

// shared field — co-locate to avoid component-soup
type FieldProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
};
function Field({ label, error, id, ...rest }: FieldProps) {
  const fid = id ?? `f-${label.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <label htmlFor={fid} className="block">
      <span className="block font-mono text-[11px] uppercase tracking-[0.18em] text-ink/60 mb-1.5">{label}</span>
      <input
        id={fid}
        {...rest}
        className="block w-full rounded-xl border border-ink/15 bg-bone px-4 py-3 text-base text-ink focus:outline-none focus:ring-2 focus:ring-rouge/40 focus:border-rouge"
      />
      {error && <span className="mt-1 block font-mono text-[11px] text-error">{error}</span>}
    </label>
  );
}
// React 19 accepts `ref` as a regular prop, so register("…")'s ref is applied via {...rest} — no forwardRef needed.
```

> Practical note: `register("contact.email")` returns `{ name, onChange, onBlur, ref }`. Spread into `<input>` it works without `forwardRef`. Keep it simple.

- [ ] **Step 2: Write `DeliveryStep.tsx`**

Includes radio-card slot picker + a static `<input type="date">` filtered by `lib/delivery.ts` cutoff (Plan 2). For v1 keep a simple `min` attribute and rely on schema for the past-date check.

```tsx
// components/checkout/DeliveryStep.tsx
"use client";
import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { UseFormReturn } from "react-hook-form";
import type { CheckoutInput } from "@/schemas/checkout";
import { earliestAvailableDate } from "@/lib/delivery";

const SLOTS = ["morning", "midday", "afternoon", "evening"] as const;

export function DeliveryStep({ form }: { form: UseFormReturn<CheckoutInput> }) {
  const t = useTranslations("checkout");
  const { register, formState, watch } = form;
  const min = useMemo(() => earliestAvailableDate(new Date()), []);
  const errors = formState.errors.delivery;
  const selectedSlot = watch("delivery.window.slot");

  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label={t("recipient_name")} required {...register("delivery.recipient.name")}
          error={errors?.recipient?.name && t("errors.name_too_short")} />
        <Field label={t("recipient_phone")} type="tel" inputMode="tel" required {...register("delivery.recipient.phone")}
          error={errors?.recipient?.phone && t("errors.phone_too_short")} />
      </div>
      <Field label={t("address_street1")} required autoComplete="address-line1" {...register("delivery.address.street1")}
        error={errors?.address?.street1 && t("errors.street_required")} />
      <Field label={t("address_street2")} autoComplete="address-line2" {...register("delivery.address.street2")} />
      <div className="grid sm:grid-cols-3 gap-4">
        <Field label={t("address_city")} required autoComplete="address-level2" {...register("delivery.address.city")}
          error={errors?.address?.city && t("errors.city_required")} />
        <Field label={t("address_state")} required maxLength={2} autoComplete="address-level1" {...register("delivery.address.state")}
          error={errors?.address?.state && t("errors.state_invalid")} />
        <Field label={t("address_zip")} required inputMode="numeric" autoComplete="postal-code" {...register("delivery.address.zip")}
          error={errors?.address?.zip && t("errors.zip_invalid")} />
      </div>
      <input type="hidden" value="US" {...register("delivery.address.country")} />
      <div>
        <p className="block font-mono text-[11px] uppercase tracking-[0.18em] text-ink/60 mb-2">{t("delivery_date")}</p>
        <input
          type="date"
          min={min}
          {...register("delivery.window.date")}
          className="rounded-xl border border-ink/15 bg-bone px-4 py-3 font-mono text-sm text-ink focus:outline-none focus:ring-2 focus:ring-rouge/40 focus:border-rouge"
        />
        {errors?.window?.date && (
          <span className="mt-1 block font-mono text-[11px] text-error">{t("errors.date_invalid")}</span>
        )}
      </div>
      <fieldset>
        <legend className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink/60 mb-2">
          {t("delivery_window")}
        </legend>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {SLOTS.map((slot) => {
            const isActive = selectedSlot === slot;
            return (
              <label
                key={slot}
                className={`cursor-pointer rounded-xl border px-3 py-3 text-center transition-colors ${
                  isActive ? "border-rouge bg-rouge/5 text-ink" : "border-ink/15 text-ink/70 hover:border-ink/30"
                }`}
              >
                <input
                  type="radio"
                  value={slot}
                  className="sr-only"
                  {...register("delivery.window.slot")}
                />
                <span className="font-mono text-[11px] uppercase tracking-[0.18em]">{t(`slot_${slot}`)}</span>
              </label>
            );
          })}
        </div>
      </fieldset>
      <div>
        <Field
          label={t("card_message")}
          maxLength={200}
          {...register("delivery.cardMessage")}
        />
        <p className="mt-1 font-mono text-[10px] text-ink/50">{t("card_message_hint")}</p>
      </div>
    </div>
  );
}

// Same Field as ContactStep — copied to keep components independent (DRY < boundary clarity for one form).
type FieldProps = React.InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string };
function Field({ label, error, id, ...rest }: FieldProps) {
  const fid = id ?? `f-${label.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <label htmlFor={fid} className="block">
      <span className="block font-mono text-[11px] uppercase tracking-[0.18em] text-ink/60 mb-1.5">{label}</span>
      <input
        id={fid}
        {...rest}
        className="block w-full rounded-xl border border-ink/15 bg-bone px-4 py-3 text-base text-ink focus:outline-none focus:ring-2 focus:ring-rouge/40 focus:border-rouge"
      />
      {error && <span className="mt-1 block font-mono text-[11px] text-error">{error}</span>}
    </label>
  );
}
```

- [ ] **Step 3: Write `PaymentStub.tsx`**

```tsx
// components/checkout/PaymentStub.tsx
"use client";
import { CreditCard } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";

export function PaymentStub({ submitting }: { submitting: boolean }) {
  const t = useTranslations("checkout");
  return (
    <div className="rounded-2xl border border-dashed border-ink/20 bg-bone/60 p-6 space-y-3">
      <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-ink/60">
        <CreditCard size={14} />
        {t("payment_stub_label")}
      </div>
      <p className="text-sm text-ink/75 max-w-[48ch]">
        {t("payment_stub_body")}
      </p>
      {submitting && (
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-rouge animate-pulse">
          {t("payment_stub_processing")}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add components/checkout
git commit -m "feat(checkout): add Contact + Delivery + Payment field components"
```

---

## Task 17: OrderSummarySticky

**Files:**
- Create: `components/checkout/OrderSummarySticky.tsx`

- [ ] **Step 1: Write the component**

```tsx
// components/checkout/OrderSummarySticky.tsx
"use client";
import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { useCartStore } from "@/lib/cart-store";
import { resolveCartLines, cartSubtotalCents } from "@/lib/cart-helpers";
import { computeOrderTotals } from "@/lib/totals";
import { formatMoneyCents } from "@/lib/format";
import { ProductImage } from "@/components/product/ProductImage";
import { products } from "@/data/products";
import type { Locale } from "@/types/locale";

export function OrderSummarySticky({ locale }: { locale: Locale }) {
  const t = useTranslations("checkout");
  const lines = useCartStore((s) => s.lines);
  const resolved = useMemo(() => resolveCartLines(lines, products), [lines]);
  const subtotal = useMemo(() => cartSubtotalCents(lines, products), [lines]);
  const totals = useMemo(() => computeOrderTotals(subtotal), [subtotal]);

  return (
    <aside className="lg:sticky lg:top-24 self-start space-y-6 rounded-2xl border border-ink/10 p-6 bg-bone/60">
      <p className="font-display text-xl text-ink">{t("summary")}</p>
      <ul className="space-y-4 max-h-[280px] overflow-y-auto pr-1">
        {resolved.map((r) => (
          <li key={`${r.line.productId}-${r.line.variantId}`} className="grid grid-cols-[48px_1fr_auto] gap-3 items-center">
            <div className="aspect-square h-12 overflow-hidden rounded-lg bg-bone">
              <ProductImage src={r.product.images[0].src} alt={r.product.images[0].alt[locale]} aspect="1/1" sizes="48px" />
            </div>
            <div className="min-w-0">
              <p className="text-sm text-ink truncate">{r.product.title[locale]}</p>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink/55">
                {r.variant.label[locale]} · ×{r.line.qty}
              </p>
            </div>
            <span className="font-mono text-sm tabular-nums text-ink">{formatMoneyCents(r.lineTotalCents, locale)}</span>
          </li>
        ))}
      </ul>
      <dl className="space-y-2 border-t border-ink/10 pt-4 font-mono text-[12px]">
        <Row label={t("subtotal")} value={formatMoneyCents(totals.subtotalCents, locale)} />
        <Row label={t("delivery")} value={formatMoneyCents(totals.deliveryCents, locale)} />
        <Row label={t("tax")} value={formatMoneyCents(totals.taxCents, locale)} />
        <div className="h-px bg-ink/10" />
        <Row label={t("total")} value={formatMoneyCents(totals.totalCents, locale)} bold />
      </dl>
    </aside>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className="uppercase tracking-[0.18em] text-ink/60">{label}</dt>
      <dd className={`tabular-nums ${bold ? "text-ink text-base" : "text-ink/80"}`}>{value}</dd>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/checkout/OrderSummarySticky.tsx
git commit -m "feat(checkout): add sticky order summary"
```

---

## Task 18: CheckoutShell — accordion + RHF orchestration

**Files:**
- Create: `components/checkout/CheckoutShell.tsx`

- [ ] **Step 1: Write the shell**

The shell uses a 3-step accordion where exactly one step is open. Step transitions are guarded by per-section validation (`form.trigger`). Submit fires `submitOrder()` and on success: clears the cart store and `router.push`es to confirmation.

```tsx
// components/checkout/CheckoutShell.tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { CaretDown } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/button";
import { ContactStep } from "@/components/checkout/ContactStep";
import { DeliveryStep } from "@/components/checkout/DeliveryStep";
import { PaymentStub } from "@/components/checkout/PaymentStub";
import { OrderSummarySticky } from "@/components/checkout/OrderSummarySticky";
import { useCartStore } from "@/lib/cart-store";
import { useUIStore } from "@/lib/ui-store";
import { submitOrder } from "@/lib/submit-order";
import { checkoutSchema, type CheckoutInput } from "@/schemas/checkout";
import type { Locale } from "@/types/locale";
import { springs } from "@/lib/motion-config";

type StepKey = "contact" | "delivery" | "payment";

export function CheckoutShell({ locale }: { locale: Locale }) {
  const t = useTranslations("checkout");
  const router = useRouter();
  const reduce = useReducedMotion();
  const lines = useCartStore((s) => s.lines);
  const clear = useCartStore((s) => s.clear);
  const closeDrawer = useUIStore((s) => s.closeDrawer);

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

  async function nextFrom(step: StepKey) {
    const fields: Record<StepKey, (keyof CheckoutInput | string)[]> = {
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
    setOpen(step === "contact" ? "delivery" : "payment");
  }

  async function onSubmit(values: CheckoutInput) {
    setTopError(null);
    if (lines.length === 0) {
      setTopError(t("errors.cart_empty"));
      return;
    }
    setSubmitting(true);
    const r = await submitOrder({ locale, lines, form: values });
    setSubmitting(false);
    if (!r.ok) {
      setTopError(t("errors.unknown_error"));
      return;
    }
    clear();
    closeDrawer();
    router.push(`/${locale}/order/${r.id}/confirmation`);
  }

  return (
    <div className="grid gap-12 lg:grid-cols-[1fr_360px]">
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
        <Section
          title={`1. ${t("step_contact")}`}
          isOpen={open === "contact"}
          onHeaderClick={() => setOpen("contact")}
          reduce={!!reduce}
        >
          <ContactStep form={form} />
          <div className="pt-4">
            <Button type="button" onClick={() => nextFrom("contact")}>{t("continue")}</Button>
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
            <Button type="button" variant="ghost" onClick={() => setOpen("contact")}>{t("back")}</Button>
            <Button type="button" onClick={() => nextFrom("delivery")}>{t("continue")}</Button>
          </div>
        </Section>
        <Section
          title={`3. ${t("step_payment")}`}
          isOpen={open === "payment"}
          onHeaderClick={() => setOpen("payment")}
          reduce={!!reduce}
        >
          <PaymentStub submitting={submitting} />
          {topError && <p className="font-mono text-[11px] text-error">{topError}</p>}
          <div className="pt-4 flex gap-3">
            <Button type="button" variant="ghost" onClick={() => setOpen("delivery")}>{t("back")}</Button>
            <Button type="submit" disabled={submitting}>{submitting ? t("placing") : t("place_order")}</Button>
          </div>
        </Section>
      </form>
      <OrderSummarySticky locale={locale} />
    </div>
  );

  function Section({
    title, isOpen, onHeaderClick, reduce, children,
  }: { title: string; isOpen: boolean; onHeaderClick: () => void; reduce: boolean; children: React.ReactNode }) {
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
}
```

> Tradeoff acknowledged: animating `height` violates the taste-skill rule against `width`/`height` animations. The accordion is the one well-known exception where layout animation is needed; reduced-motion users get the opacity-only path. This is the same exception PdpAccordion uses in Plan 2 — match its implementation exactly if Plan 2 chose differently.

- [ ] **Step 2: Commit**

```bash
git add components/checkout/CheckoutShell.tsx
git commit -m "feat(checkout): add 3-step shell with RHF + zod validation"
```

---

## Task 19: `/checkout` page

**Files:**
- Create: `app/[locale]/checkout/page.tsx`
- Create: `app/[locale]/checkout/loading.tsx`

- [ ] **Step 1: Write the page**

```tsx
// app/[locale]/checkout/page.tsx
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { CheckoutShell } from "@/components/checkout/CheckoutShell";
import type { Locale } from "@/types/locale";

export async function generateMetadata({
  params,
}: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "checkout" });
  return {
    title: t("page_title"),
    description: t("page_description"),
    robots: { index: false, follow: false },
  };
}

export default async function CheckoutPage({
  params,
}: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "checkout" });
  return (
    <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-32 pb-24">
      <header className="mb-10 max-w-2xl">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink/60">{t("eyebrow")}</p>
        <h1 className="mt-3 font-display text-5xl sm:text-6xl text-ink leading-[0.95] tracking-tighter">
          {t("page_title")}
        </h1>
      </header>
      <CheckoutShell locale={locale} />
    </main>
  );
}
```

- [ ] **Step 2: Write `loading.tsx`** (same skeleton shape as cart loading)

```tsx
// app/[locale]/checkout/loading.tsx
export default function Loading() {
  return (
    <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-32 pb-24">
      <div className="h-12 w-72 bg-ink/5 rounded-md animate-pulse" />
      <div className="mt-10 grid gap-12 lg:grid-cols-[1fr_360px]">
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 bg-ink/5 rounded-2xl animate-pulse" />
          ))}
        </div>
        <div className="h-96 bg-ink/5 rounded-2xl animate-pulse" />
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/[locale]/checkout
git commit -m "feat(checkout): add /checkout page with metadata"
```

---

## Task 20: Confirmation page

**Files:**
- Create: `app/[locale]/order/[id]/confirmation/page.tsx`
- Create: `components/checkout/ConfirmationView.tsx`

The page is a Server Component that reads the order from the file storage; the order is frozen there so refresh works. If the order isn't found (e.g., file cleared), shows a friendly fallback with a link back to shop.

- [ ] **Step 1: Write `ConfirmationView.tsx`** (Server Component)

```tsx
// components/checkout/ConfirmationView.tsx
import Link from "next/link";
import { CheckCircle } from "@phosphor-icons/react/dist/ssr";
import { getTranslations } from "next-intl/server";
import { products } from "@/data/products";
import { resolveCartLines } from "@/lib/cart-helpers";
import { ProductImage } from "@/components/product/ProductImage";
import { formatMoneyCents, formatPhoneUS, formatDeliveryWindow } from "@/lib/format";
import { Button } from "@/components/ui/button";
import type { Order } from "@/types/order";
import type { Locale } from "@/types/locale";

export async function ConfirmationView({ order, locale }: { order: Order; locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "confirmation" });
  const resolved = resolveCartLines(order.lines, products);
  const hasSubscription = resolved.some((r) => r.product.category === "subscriptions");
  return (
    <div className="space-y-12">
      <header className="flex flex-col items-start gap-4 max-w-2xl">
        <span className="inline-flex items-center gap-2 rounded-full bg-success/10 text-success px-3 py-1 font-mono text-[11px] uppercase tracking-[0.18em]">
          <CheckCircle size={14} weight="fill" />
          {t("paid_label")}
        </span>
        <h1 className="font-display text-5xl sm:text-6xl text-ink leading-[0.95] tracking-tighter">
          {t("title", { name: order.delivery.recipient.name })}
        </h1>
        <p className="text-base text-ink/75 max-w-[58ch]">
          {hasSubscription ? t("body_subscription", {
            date: order.delivery.window.date,
          }) : t("body")}
        </p>
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink/55">
          {t("order_id")}: <span className="text-ink">{order.id}</span>
        </p>
      </header>
      <section className="grid gap-12 lg:grid-cols-[1fr_360px]">
        <div className="space-y-8">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink/55 mb-3">{t("delivery_to")}</p>
            <p className="font-display text-2xl text-ink">{order.delivery.recipient.name}</p>
            <p className="text-sm text-ink/75">
              {order.delivery.address.street1}{order.delivery.address.street2 && `, ${order.delivery.address.street2}`}
              <br />
              {order.delivery.address.city}, {order.delivery.address.state} {order.delivery.address.zip}
            </p>
            <p className="font-mono text-sm text-ink mt-2">{formatPhoneUS(order.delivery.recipient.phone)}</p>
            <p className="font-mono text-sm text-ink mt-2">{formatDeliveryWindow(order.delivery.window, locale)}</p>
            {order.delivery.cardMessage && (
              <blockquote className="mt-4 border-l-2 border-rouge pl-4 text-ink/80 italic">
                "{order.delivery.cardMessage}"
              </blockquote>
            )}
          </div>
          <ul className="divide-y divide-ink/10">
            {resolved.map((r) => (
              <li key={`${r.line.productId}-${r.line.variantId}`} className="grid grid-cols-[80px_1fr_auto] gap-4 py-4 items-center">
                <div className="aspect-[4/5] overflow-hidden rounded-xl bg-bone">
                  <ProductImage src={r.product.images[0].src} alt={r.product.images[0].alt[locale]} aspect="4/5" sizes="80px" />
                </div>
                <div>
                  <p className="font-display text-lg text-ink">{r.product.title[locale]}</p>
                  <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink/55 mt-0.5">
                    {r.variant.label[locale]} · ×{r.line.qty}
                  </p>
                </div>
                <span className="font-mono text-sm tabular-nums text-ink">{formatMoneyCents(r.lineTotalCents, locale)}</span>
              </li>
            ))}
          </ul>
        </div>
        <aside className="lg:sticky lg:top-24 self-start space-y-3 rounded-2xl border border-ink/10 p-6 font-mono text-[12px]">
          <p className="font-display text-xl text-ink mb-3">{t("totals")}</p>
          <Row label={t("subtotal")} value={formatMoneyCents(order.totals.subtotalCents, locale)} />
          <Row label={t("delivery")} value={formatMoneyCents(order.totals.deliveryCents, locale)} />
          <Row label={t("tax")} value={formatMoneyCents(order.totals.taxCents, locale)} />
          <div className="h-px bg-ink/10" />
          <Row label={t("total")} value={formatMoneyCents(order.totals.totalCents, locale)} bold />
        </aside>
      </section>
      <footer className="pt-8">
        <Button asChild variant="primary">
          <Link href={`/${locale}/shop`}>{t("back_to_shop")}</Link>
        </Button>
      </footer>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className="uppercase tracking-[0.18em] text-ink/60">{label}</dt>
      <dd className={`tabular-nums ${bold ? "text-ink text-base" : "text-ink/80"}`}>{value}</dd>
    </div>
  );
}
```

- [ ] **Step 2: Write the route**

```tsx
// app/[locale]/order/[id]/confirmation/page.tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ConfirmationView } from "@/components/checkout/ConfirmationView";
import { getOrder } from "@/lib/order-storage";
import type { Locale } from "@/types/locale";

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

export default async function ConfirmationPage({
  params,
}: { params: Promise<{ locale: Locale; id: string }> }) {
  const { locale, id } = await params;
  const order = await getOrder(id);
  if (!order) notFound();
  return (
    <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-32 pb-24">
      <ConfirmationView order={order} locale={locale} />
    </main>
  );
}
```

- [ ] **Step 3: Boot dev and run a checkout end-to-end**

Run: `pnpm dev`
Steps:
1. Add a product to bag from a PDP.
2. Drawer opens. Click "Checkout."
3. Fill out Contact → Delivery → Payment. Submit.
4. Expect redirect to `/{locale}/order/<id>/confirmation` with all fields rendered.
5. Refresh confirmation. Expect: still loads (file-backed).
6. Verify cart is empty after submit.

- [ ] **Step 4: Commit**

```bash
git add app/[locale]/order components/checkout/ConfirmationView.tsx
git commit -m "feat(checkout): add confirmation page with frozen order summary"
```

---

# PART C — Inquiry Infrastructure (shared)

## Task 21: Rate limit helper (TDD)

**Files:**
- Create: `lib/rate-limit.ts`
- Test: `tests/unit/rate-limit.test.ts`

A naive in-memory IP bucket is enough for v1: a Map of `{ ip → { count, resetAt } }`. It is reset by process restart, which is acceptable for a stub. v2 swap is `@upstash/ratelimit` or similar.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/rate-limit.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { rateLimit, __resetRateLimitForTests } from "@/lib/rate-limit";

beforeEach(() => {
  __resetRateLimitForTests();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-05-01T12:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("rateLimit", () => {
  it("allows up to N requests per window, then blocks", () => {
    for (let i = 0; i < 5; i++) {
      expect(rateLimit("1.2.3.4", { max: 5, windowMs: 60_000 }).ok).toBe(true);
    }
    expect(rateLimit("1.2.3.4", { max: 5, windowMs: 60_000 }).ok).toBe(false);
  });

  it("resets after the window passes", () => {
    for (let i = 0; i < 5; i++) rateLimit("1.2.3.4", { max: 5, windowMs: 60_000 });
    vi.advanceTimersByTime(61_000);
    expect(rateLimit("1.2.3.4", { max: 5, windowMs: 60_000 }).ok).toBe(true);
  });

  it("buckets per-IP", () => {
    for (let i = 0; i < 5; i++) rateLimit("1.1.1.1", { max: 5, windowMs: 60_000 });
    expect(rateLimit("1.1.1.1", { max: 5, windowMs: 60_000 }).ok).toBe(false);
    expect(rateLimit("2.2.2.2", { max: 5, windowMs: 60_000 }).ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

- [ ] **Step 3: Write `lib/rate-limit.ts`**

```ts
// lib/rate-limit.ts
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function rateLimit(
  key: string,
  opts: { max: number; windowMs: number },
): { ok: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    const resetAt = now + opts.windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { ok: true, remaining: opts.max - 1, resetAt };
  }
  if (existing.count >= opts.max) {
    return { ok: false, remaining: 0, resetAt: existing.resetAt };
  }
  existing.count += 1;
  return { ok: true, remaining: opts.max - existing.count, resetAt: existing.resetAt };
}

export function ipFromRequest(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

export function __resetRateLimitForTests() {
  buckets.clear();
}
```

- [ ] **Step 4: Run, expect PASS**

- [ ] **Step 5: Commit**

```bash
git add lib/rate-limit.ts tests/unit/rate-limit.test.ts
git commit -m "feat(api): add in-memory IP rate limit helper"
```

---

## Task 22: Inquiry storage stub

**Files:**
- Create: `lib/inquiry-storage.ts`

- [ ] **Step 1: Write it**

```ts
// lib/inquiry-storage.ts
import { promises as fs } from "node:fs";
import path from "node:path";

const FILE = path.join(process.cwd(), "pending-inquiries.json");

export type InquiryRecord = {
  id: string;
  type: "wedding" | "event" | "contact" | "newsletter";
  payload: unknown;
  createdAt: string;
  ip: string;
  locale: "en" | "es";
};

async function readAll(): Promise<InquiryRecord[]> {
  try {
    const raw = await fs.readFile(FILE, "utf8");
    return JSON.parse(raw) as InquiryRecord[];
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw e;
  }
}

export async function saveInquiry(record: InquiryRecord): Promise<void> {
  const all = await readAll();
  all.push(record);
  await fs.writeFile(FILE, JSON.stringify(all, null, 2), "utf8");
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/inquiry-storage.ts
git commit -m "feat(api): add inquiry storage stub"
```

---

## Task 23: Inquiry zod schemas (TDD)

**Files:**
- Create: `schemas/inquiry.ts`
- Create: `schemas/contact.ts`
- Create: `schemas/newsletter.ts`
- Test: `tests/unit/inquiry-schema.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/inquiry-schema.test.ts
import { describe, it, expect } from "vitest";
import { weddingInquirySchema, eventInquirySchema } from "@/schemas/inquiry";
import { contactSchema } from "@/schemas/contact";
import { newsletterSchema } from "@/schemas/newsletter";

const baseWedding = {
  type: "wedding" as const,
  contact: { name: "Lola Cardona", email: "lola@example.com", phone: "5165550101" },
  date: "2026-09-12",
  venue: "Glen Cove Mansion",
  guests: 120,
  budgetBand: "10-25k" as const,
  vibe: "Romantic, white + soft pink, candles everywhere.",
  source: "instagram",
  locale: "en" as const,
  honeypot: "",
};

const baseEvent = {
  type: "event" as const,
  contact: { name: "Acme Co", email: "ops@acme.com", phone: "2125550100" },
  company: "Acme Co",
  frequency: "monthly" as const,
  guests: 30,
  budgetBand: "5-10k" as const,
  vibe: "Reception desk + monthly office refresh.",
  locale: "en" as const,
  honeypot: "",
};

describe("weddingInquirySchema", () => {
  it("accepts valid", () => {
    expect(weddingInquirySchema.safeParse(baseWedding).success).toBe(true);
  });
  it("rejects bot-filled honeypot", () => {
    expect(weddingInquirySchema.safeParse({ ...baseWedding, honeypot: "spam" }).success).toBe(false);
  });
  it("rejects vibe shorter than 10 chars", () => {
    expect(weddingInquirySchema.safeParse({ ...baseWedding, vibe: "ok" }).success).toBe(false);
  });
});

describe("eventInquirySchema", () => {
  it("accepts valid", () => {
    expect(eventInquirySchema.safeParse(baseEvent).success).toBe(true);
  });
});

describe("contactSchema", () => {
  it("accepts valid", () => {
    expect(contactSchema.safeParse({
      name: "Lola", email: "lola@x.com", subject: "Hello", body: "I'd love to chat about a wedding installation.", locale: "en", honeypot: "",
    }).success).toBe(true);
  });
});

describe("newsletterSchema", () => {
  it("accepts valid", () => {
    expect(newsletterSchema.safeParse({ email: "x@y.com", locale: "en", honeypot: "" }).success).toBe(true);
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

- [ ] **Step 3: Write `schemas/inquiry.ts`**

```ts
// schemas/inquiry.ts
import { z } from "zod";

const baseContact = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email(),
  phone: z.string().transform((s) => s.replace(/\D/g, "")).pipe(z.string().min(10).max(15)),
});

const honeypot = z.string().max(0); // must be empty

const budgetBand = z.enum(["5-10k", "10-25k", "25k+", "open"]);

const baseShared = {
  contact: baseContact,
  budgetBand,
  vibe: z.string().min(10).max(2000),
  locale: z.enum(["en", "es"]),
  honeypot,
};

export const weddingInquirySchema = z.object({
  type: z.literal("wedding"),
  ...baseShared,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  venue: z.string().max(120).optional().or(z.literal("")),
  guests: z.coerce.number().int().min(1).max(2000).optional(),
  source: z.string().max(60).optional().or(z.literal("")),
});

export const eventInquirySchema = z.object({
  type: z.literal("event"),
  ...baseShared,
  company: z.string().min(2).max(120),
  frequency: z.enum(["one-time", "weekly", "biweekly", "monthly", "quarterly"]),
  guests: z.coerce.number().int().min(1).max(2000).optional(),
});

export type WeddingInquiry = z.infer<typeof weddingInquirySchema>;
export type EventInquiry = z.infer<typeof eventInquirySchema>;
```

- [ ] **Step 4: Write `schemas/contact.ts`**

```ts
// schemas/contact.ts
import { z } from "zod";

export const contactSchema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email(),
  subject: z.string().min(2).max(120),
  body: z.string().min(10).max(2000),
  locale: z.enum(["en", "es"]),
  honeypot: z.string().max(0),
});

export type ContactInput = z.infer<typeof contactSchema>;
```

- [ ] **Step 5: Write `schemas/newsletter.ts`**

```ts
// schemas/newsletter.ts
import { z } from "zod";

export const newsletterSchema = z.object({
  email: z.string().email(),
  locale: z.enum(["en", "es"]),
  honeypot: z.string().max(0),
});

export type NewsletterInput = z.infer<typeof newsletterSchema>;
```

- [ ] **Step 6: Run, expect PASS**

- [ ] **Step 7: Commit**

```bash
git add schemas/inquiry.ts schemas/contact.ts schemas/newsletter.ts tests/unit/inquiry-schema.test.ts
git commit -m "feat(api): add zod schemas for inquiries, contact, newsletter"
```

---

## Task 24: API routes — `/api/inquiry`, `/api/contact`, `/api/newsletter`

**Files:**
- Create: `app/api/inquiry/route.ts`
- Create: `app/api/contact/route.ts`
- Create: `app/api/newsletter/route.ts`

Each: rate-limit (max 5 per minute per IP), parse with the right schema, save to file, log, return JSON.

- [ ] **Step 1: Write `app/api/inquiry/route.ts`**

```ts
// app/api/inquiry/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { weddingInquirySchema, eventInquirySchema } from "@/schemas/inquiry";
import { saveInquiry } from "@/lib/inquiry-storage";
import { rateLimit, ipFromRequest } from "@/lib/rate-limit";

const requestSchema = z.discriminatedUnion("type", [
  weddingInquirySchema,
  eventInquirySchema,
]);

export async function POST(req: Request) {
  const ip = ipFromRequest(req);
  const rl = rateLimit(`inquiry:${ip}`, { max: 5, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json({ ok: false, errors: { formErrors: ["rate_limited"] } }, { status: 429 });
  }
  const json = await req.json().catch(() => null);
  const parsed = requestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, errors: parsed.error.flatten() }, { status: 400 });
  }
  const id = `iq_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  await saveInquiry({
    id,
    type: parsed.data.type,
    payload: parsed.data,
    createdAt: new Date().toISOString(),
    ip,
    locale: parsed.data.locale,
  });
  console.log(`[inquiry] ${parsed.data.type} from ${parsed.data.contact.email}`);
  return NextResponse.json({ ok: true, id }, { status: 200 });
}
```

- [ ] **Step 2: Write `app/api/contact/route.ts`**

```ts
// app/api/contact/route.ts
import { NextResponse } from "next/server";
import { contactSchema } from "@/schemas/contact";
import { saveInquiry } from "@/lib/inquiry-storage";
import { rateLimit, ipFromRequest } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const ip = ipFromRequest(req);
  const rl = rateLimit(`contact:${ip}`, { max: 5, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json({ ok: false, errors: { formErrors: ["rate_limited"] } }, { status: 429 });
  }
  const json = await req.json().catch(() => null);
  const parsed = contactSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, errors: parsed.error.flatten() }, { status: 400 });
  }
  const id = `ct_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  await saveInquiry({
    id,
    type: "contact",
    payload: parsed.data,
    createdAt: new Date().toISOString(),
    ip,
    locale: parsed.data.locale,
  });
  console.log(`[contact] from ${parsed.data.email}`);
  return NextResponse.json({ ok: true, id }, { status: 200 });
}
```

- [ ] **Step 3: Write `app/api/newsletter/route.ts`**

```ts
// app/api/newsletter/route.ts
import { NextResponse } from "next/server";
import { newsletterSchema } from "@/schemas/newsletter";
import { saveInquiry } from "@/lib/inquiry-storage";
import { rateLimit, ipFromRequest } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const ip = ipFromRequest(req);
  const rl = rateLimit(`newsletter:${ip}`, { max: 10, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json({ ok: false, errors: { formErrors: ["rate_limited"] } }, { status: 429 });
  }
  const json = await req.json().catch(() => null);
  const parsed = newsletterSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, errors: parsed.error.flatten() }, { status: 400 });
  }
  const id = `nl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  await saveInquiry({
    id,
    type: "newsletter",
    payload: parsed.data,
    createdAt: new Date().toISOString(),
    ip,
    locale: parsed.data.locale,
  });
  console.log(`[newsletter] ${parsed.data.email}`);
  return NextResponse.json({ ok: true, id }, { status: 200 });
}
```

- [ ] **Step 4: Commit**

```bash
git add app/api/inquiry app/api/contact app/api/newsletter
git commit -m "feat(api): add inquiry, contact, newsletter route handlers"
```

---

## Task 25: HoneypotField + shared form primitives

**Files:**
- Create: `components/inquiry/HoneypotField.tsx`

- [ ] **Step 1: Write it**

```tsx
// components/inquiry/HoneypotField.tsx
import type { UseFormRegisterReturn } from "react-hook-form";

export function HoneypotField({ register }: { register: UseFormRegisterReturn }) {
  return (
    <div aria-hidden="true" className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden">
      <label>
        Leave this field empty
        <input type="text" tabIndex={-1} autoComplete="off" {...register} />
      </label>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/inquiry/HoneypotField.tsx
git commit -m "feat(inquiry): add accessible honeypot field"
```

---

# PART D — Weddings, Events, Contact

## Task 26: Wedding portfolio + FAQ data

**Files:**
- Create: `data/wedding-portfolio.ts`
- Create: `data/wedding-faq.ts`
- Create: `data/delivery-zones.ts`

- [ ] **Step 1: Write `data/wedding-portfolio.ts`** — 12 placeholder photos with varied aspects.

```ts
// data/wedding-portfolio.ts
export type PortfolioPhoto = {
  id: string;
  src: string;
  alt: { en: string; es: string };
  aspect: "4/5" | "1/1" | "16/9" | "3/4";
};

export const weddingPortfolio: PortfolioPhoto[] = [
  { id: "w1",  src: "https://picsum.photos/seed/diva-w-1/1600/2000",  aspect: "4/5",  alt: { en: "Cascading arch installation, Glen Cove",        es: "Arco de instalación en cascada, Glen Cove" } },
  { id: "w2",  src: "https://picsum.photos/seed/diva-w-2/1600/1600",  aspect: "1/1",  alt: { en: "Bridal bouquet, garden roses + ranunculus",   es: "Ramo de novia, rosas de jardín y ranúnculos" } },
  { id: "w3",  src: "https://picsum.photos/seed/diva-w-3/2400/1350",  aspect: "16/9", alt: { en: "Reception tablescape, low-and-lush centerpieces", es: "Mesa de recepción, centros bajos y abundantes" } },
  { id: "w4",  src: "https://picsum.photos/seed/diva-w-4/1500/2000",  aspect: "3/4",  alt: { en: "Ceremony aisle markers in candlelight",       es: "Marcadores del pasillo a la luz de las velas" } },
  { id: "w5",  src: "https://picsum.photos/seed/diva-w-5/1600/2000",  aspect: "4/5",  alt: { en: "Floral arch with hanging amaranthus",         es: "Arco floral con amaranto colgante" } },
  { id: "w6",  src: "https://picsum.photos/seed/diva-w-6/1600/1600",  aspect: "1/1",  alt: { en: "Boutonnières, soft pinks and ivory",          es: "Boutonnières, rosas suaves y marfil" } },
  { id: "w7",  src: "https://picsum.photos/seed/diva-w-7/2400/1350",  aspect: "16/9", alt: { en: "Cocktail hour florals on bar",                es: "Florales en el bar durante el cóctel" } },
  { id: "w8",  src: "https://picsum.photos/seed/diva-w-8/1500/2000",  aspect: "3/4",  alt: { en: "Hanging floral chandelier over dance floor",  es: "Candelabro floral colgante sobre la pista" } },
  { id: "w9",  src: "https://picsum.photos/seed/diva-w-9/1600/2000",  aspect: "4/5",  alt: { en: "Ceremony backdrop, asymmetric installation",  es: "Fondo de ceremonia, instalación asimétrica" } },
  { id: "w10", src: "https://picsum.photos/seed/diva-w-10/1600/1600", aspect: "1/1",  alt: { en: "Bridesmaid bouquet, mixed greens",            es: "Ramo de dama, verdes mixtos" } },
  { id: "w11", src: "https://picsum.photos/seed/diva-w-11/2400/1350", aspect: "16/9", alt: { en: "Sweetheart table, full-bloom statement",      es: "Mesa de novios, declaración en plena flor" } },
  { id: "w12", src: "https://picsum.photos/seed/diva-w-12/1500/2000", aspect: "3/4",  alt: { en: "Pew arrangement, white peonies",              es: "Arreglo de banco, peonías blancas" } },
];
```

- [ ] **Step 2: Write `data/wedding-faq.ts`**

```ts
// data/wedding-faq.ts
export type FAQ = {
  id: string;
  q: { en: string; es: string };
  a: { en: string; es: string };
};

export const weddingFAQ: FAQ[] = [
  {
    id: "lead-time",
    q: { en: "How far in advance should we book?", es: "¿Con cuánta anticipación debemos reservar?" },
    a: {
      en: "We typically book installations 8–12 months in advance for peak season (May–October). Off-season weddings can sometimes be accommodated on shorter notice — start with an inquiry and we'll let you know.",
      es: "Normalmente reservamos instalaciones con 8 a 12 meses de antelación en temporada alta (mayo a octubre). Las bodas fuera de temporada a veces pueden agendarse con menos tiempo — comienza con una consulta y te avisamos.",
    },
  },
  {
    id: "minimum",
    q: { en: "Is there a minimum spend?", es: "¿Hay un mínimo de inversión?" },
    a: {
      en: "Full-service wedding installations start at $5,000. Bouquets and personal florals only (no installations) start at $1,500.",
      es: "Las instalaciones completas comienzan en $5,000. Ramos y florales personales (sin instalación) comienzan en $1,500.",
    },
  },
  {
    id: "site-visit",
    q: { en: "Do you do site visits?", es: "¿Hacen visitas al lugar?" },
    a: {
      en: "Yes — once we've aligned on direction, we'll visit the venue together (or virtually if it's far) to plan installs against the actual room.",
      es: "Sí — una vez alineados en la dirección, visitamos juntos el lugar (o de forma virtual si está lejos) para planificar las instalaciones según el espacio real.",
    },
  },
  {
    id: "delivery-area",
    q: { en: "Where do you deliver?", es: "¿A dónde entregan?" },
    a: {
      en: "We install across Long Island and the New York metro area. Outside that, we travel by request — there's a travel + lodging line on the proposal.",
      es: "Instalamos en Long Island y el área metropolitana de Nueva York. Fuera de esa zona, viajamos bajo pedido — la propuesta incluye una línea de viaje y alojamiento.",
    },
  },
  {
    id: "rentals",
    q: { en: "Do you provide vases and rentals?", es: "¿Proveen jarrones y rentas?" },
    a: {
      en: "We work with a curated set of vessels and rental partners; everything is itemized on your proposal so you know what's purchased vs. rented.",
      es: "Trabajamos con jarrones curados y socios de renta; todo se desglosa en tu propuesta para que sepas qué se compra y qué se renta.",
    },
  },
  {
    id: "changes",
    q: { en: "What if our vision changes?", es: "¿Qué pasa si nuestra visión cambia?" },
    a: {
      en: "We expect it. The proposal is iterative — we lock the final scope ~30 days before the date and adjust as needed within budget.",
      es: "Lo esperamos. La propuesta es iterativa — fijamos el alcance final ~30 días antes de la fecha y ajustamos según sea necesario dentro del presupuesto.",
    },
  },
];
```

- [ ] **Step 3: Write `data/delivery-zones.ts`**

```ts
// data/delivery-zones.ts
export type DeliveryZone = {
  id: string;
  label: { en: string; es: string };
  zips: string[];
};

export const deliveryZones: DeliveryZone[] = [
  { id: "nassau-south", label: { en: "South Nassau", es: "Sur de Nassau" },
    zips: ["11010", "11020", "11030", "11040", "11050", "11507", "11530", "11542", "11550", "11552", "11557", "11558", "11561", "11565", "11572", "11580", "11598"] },
  { id: "nassau-north", label: { en: "North Nassau", es: "Norte de Nassau" },
    zips: ["11021", "11023", "11024", "11030", "11050", "11576", "11577"] },
  { id: "queens", label: { en: "Queens", es: "Queens" },
    zips: ["11354", "11355", "11356", "11357", "11358", "11361", "11364", "11365", "11366", "11375", "11385", "11411", "11412", "11422", "11427", "11428", "11429"] },
  { id: "suffolk-west", label: { en: "Western Suffolk", es: "Suffolk occidental" },
    zips: ["11704", "11717", "11722", "11729", "11738", "11740", "11743", "11746", "11747", "11754"] },
];
```

- [ ] **Step 4: Commit**

```bash
git add data/wedding-portfolio.ts data/wedding-faq.ts data/delivery-zones.ts
git commit -m "feat(data): seed wedding portfolio, FAQ, and delivery zones"
```

---

## Task 27: WeddingsHero + ProcessStrip + PricingIntent

**Files:**
- Create: `components/weddings/WeddingsHero.tsx`
- Create: `components/weddings/ProcessStrip.tsx`
- Create: `components/weddings/PricingIntent.tsx`

- [ ] **Step 1: Write `WeddingsHero.tsx`** (Server Component)

```tsx
// components/weddings/WeddingsHero.tsx
import Link from "next/link";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/types/locale";

export async function WeddingsHero({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "weddings" });
  return (
    <section className="relative min-h-[100dvh] flex items-end overflow-hidden">
      <Image
        src="https://picsum.photos/seed/diva-weddings-hero/2400/3000"
        alt={t("hero_alt")}
        fill
        priority
        sizes="100vw"
        className="object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-ink/20 to-transparent" />
      <div className="relative z-10 mx-auto max-w-7xl w-full px-4 sm:px-6 lg:px-8 pb-20 pt-32 grid lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 space-y-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-bone/80">{t("eyebrow")}</p>
          <h1 className="font-display text-bone text-6xl sm:text-7xl lg:text-8xl leading-[0.92] tracking-tighter">
            {t("hero_title")}
          </h1>
          <p className="text-bone/85 text-lg max-w-[52ch]">{t("hero_sub")}</p>
          <Button asChild variant="primary" arched>
            <Link href={`/${locale}/weddings#inquire`}>{t("hero_cta")}</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Write `ProcessStrip.tsx`** (4-step horizontal scroll-snap on `lg:`, vertical column on mobile)

```tsx
// components/weddings/ProcessStrip.tsx
"use client";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";

const STEPS = ["discover", "design", "install", "memory"] as const;

export function ProcessStrip() {
  const t = useTranslations("weddings.process");
  const reduce = useReducedMotion();
  return (
    <section className="bg-petal/40 py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <header className="max-w-2xl mb-12">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink/60">{t("eyebrow")}</p>
          <h2 className="mt-3 font-display text-5xl text-ink leading-[0.95] tracking-tighter">{t("title")}</h2>
        </header>
        <ol className="grid gap-6 lg:grid-cols-4 lg:snap-x lg:overflow-x-auto">
          {STEPS.map((step, i) => (
            <motion.li
              key={step}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-10%" }}
              transition={reduce ? { duration: 0 } : { duration: 0.5, delay: i * 0.08 }}
              className="snap-start min-w-[280px] rounded-2xl border border-ink/10 bg-bone/80 p-8 backdrop-blur-sm"
            >
              <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-rouge">0{i + 1}</span>
              <h3 className="mt-3 font-display text-2xl text-ink">{t(`${step}.title`)}</h3>
              <p className="mt-3 text-sm text-ink/75 leading-relaxed">{t(`${step}.body`)}</p>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Write `PricingIntent.tsx`** (Server Component)

```tsx
// components/weddings/PricingIntent.tsx
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/types/locale";

export async function PricingIntent({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "weddings.pricing" });
  return (
    <section className="py-24">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink/60">{t("eyebrow")}</p>
        <p className="mt-6 font-display text-3xl sm:text-4xl text-ink leading-tight">
          {t("statement_full")}
        </p>
        <p className="mt-6 text-sm text-ink/65 max-w-[58ch] mx-auto">{t("statement_personal")}</p>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add components/weddings/WeddingsHero.tsx components/weddings/ProcessStrip.tsx components/weddings/PricingIntent.tsx
git commit -m "feat(weddings): add hero, process strip, pricing intent"
```

---

## Task 28: MasonryGallery (lightbox)

**Files:**
- Create: `components/weddings/MasonryGallery.tsx`

- [ ] **Step 1: Write the component**

CSS columns for masonry — no JS layout. Lightbox is a controlled modal with previous/next + ESC.

```tsx
// components/weddings/MasonryGallery.tsx
"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { X, CaretLeft, CaretRight } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";
import { weddingPortfolio, type PortfolioPhoto } from "@/data/wedding-portfolio";
import type { Locale } from "@/types/locale";

export function MasonryGallery({ locale }: { locale: Locale }) {
  const t = useTranslations("weddings.gallery");
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (activeIdx === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActiveIdx(null);
      if (e.key === "ArrowRight") setActiveIdx((i) => (i === null ? null : (i + 1) % weddingPortfolio.length));
      if (e.key === "ArrowLeft") setActiveIdx((i) => (i === null ? null : (i - 1 + weddingPortfolio.length) % weddingPortfolio.length));
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [activeIdx]);

  const active: PortfolioPhoto | null = activeIdx === null ? null : weddingPortfolio[activeIdx];

  return (
    <section className="py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <header className="mb-10 max-w-2xl">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink/60">{t("eyebrow")}</p>
          <h2 className="mt-3 font-display text-5xl text-ink leading-[0.95] tracking-tighter">{t("title")}</h2>
        </header>
        <div className="columns-2 md:columns-3 gap-4 [&>*]:mb-4 [&>*]:break-inside-avoid">
          {weddingPortfolio.map((photo, i) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => setActiveIdx(i)}
              aria-label={photo.alt[locale]}
              className="group block w-full overflow-hidden rounded-2xl bg-bone"
              style={{ aspectRatio: photo.aspect.replace("/", " / ") }}
            >
              <Image
                src={photo.src}
                alt={photo.alt[locale]}
                width={1200}
                height={1500}
                sizes="(max-width: 768px) 50vw, 33vw"
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
              />
            </button>
          ))}
        </div>
      </div>
      <AnimatePresence>
        {active && (
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={active.alt[locale]}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/85 backdrop-blur-md p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={reduce ? { duration: 0 } : { duration: 0.2 }}
          >
            <button
              type="button"
              onClick={() => setActiveIdx(null)}
              aria-label={t("close")}
              className="absolute top-6 right-6 inline-flex h-10 w-10 items-center justify-center rounded-full bg-bone/10 text-bone hover:bg-bone/20"
            >
              <X size={18} />
            </button>
            <button
              type="button"
              onClick={() => setActiveIdx((i) => (i === null ? null : (i - 1 + weddingPortfolio.length) % weddingPortfolio.length))}
              aria-label={t("prev")}
              className="absolute left-6 top-1/2 -translate-y-1/2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-bone/10 text-bone hover:bg-bone/20"
            >
              <CaretLeft size={18} />
            </button>
            <button
              type="button"
              onClick={() => setActiveIdx((i) => (i === null ? null : (i + 1) % weddingPortfolio.length))}
              aria-label={t("next")}
              className="absolute right-6 top-1/2 -translate-y-1/2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-bone/10 text-bone hover:bg-bone/20"
            >
              <CaretRight size={18} />
            </button>
            <div className="relative max-h-[90vh] max-w-[90vw] aspect-[4/5]">
              <Image
                src={active.src}
                alt={active.alt[locale]}
                fill
                sizes="90vw"
                className="object-contain"
                priority
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/weddings/MasonryGallery.tsx
git commit -m "feat(weddings): add masonry gallery with keyboard-navigable lightbox"
```

---

## Task 29: WeddingsFAQ

**Files:**
- Create: `components/weddings/WeddingsFAQ.tsx`

- [ ] **Step 1: Write the component**

Hairline-border accordion. One open at a time.

```tsx
// components/weddings/WeddingsFAQ.tsx
"use client";
import { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Plus } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";
import { weddingFAQ } from "@/data/wedding-faq";
import type { Locale } from "@/types/locale";
import { springs } from "@/lib/motion-config";

export function WeddingsFAQ({ locale }: { locale: Locale }) {
  const t = useTranslations("weddings.faq");
  const [openId, setOpenId] = useState<string | null>(null);
  const reduce = useReducedMotion();
  return (
    <section className="py-24 bg-bone">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <header className="mb-10">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink/60">{t("eyebrow")}</p>
          <h2 className="mt-3 font-display text-5xl text-ink leading-[0.95] tracking-tighter">{t("title")}</h2>
        </header>
        <ul className="border-t border-ink/10">
          {weddingFAQ.map((item) => {
            const isOpen = openId === item.id;
            return (
              <li key={item.id} className="border-b border-ink/10">
                <button
                  type="button"
                  onClick={() => setOpenId(isOpen ? null : item.id)}
                  aria-expanded={isOpen}
                  className="w-full flex items-start gap-6 py-6 text-left"
                >
                  <span className="flex-1 font-display text-2xl text-ink leading-tight">{item.q[locale]}</span>
                  <Plus size={18} className={`mt-1 transition-transform ${isOpen ? "rotate-45" : ""}`} />
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
                      <p className="pb-6 pr-12 text-base text-ink/75 leading-relaxed">{item.a[locale]}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/weddings/WeddingsFAQ.tsx
git commit -m "feat(weddings): add FAQ accordion"
```

---

## Task 30: WeddingsForm

**Files:**
- Create: `components/inquiry/WeddingsForm.tsx`

- [ ] **Step 1: Write the form**

```tsx
// components/inquiry/WeddingsForm.tsx
"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { HoneypotField } from "@/components/inquiry/HoneypotField";
import { weddingInquirySchema, type WeddingInquiry } from "@/schemas/inquiry";
import type { Locale } from "@/types/locale";

const BUDGETS = ["5-10k", "10-25k", "25k+", "open"] as const;

export function WeddingsForm({ locale }: { locale: Locale }) {
  const t = useTranslations("weddings.form");
  const [state, setState] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const form = useForm<WeddingInquiry>({
    resolver: zodResolver(weddingInquirySchema),
    mode: "onBlur",
    defaultValues: {
      type: "wedding",
      contact: { name: "", email: "", phone: "" },
      date: "",
      venue: "",
      guests: undefined,
      budgetBand: "open",
      vibe: "",
      source: "",
      locale,
      honeypot: "",
    },
  });

  async function onSubmit(values: WeddingInquiry) {
    setState("submitting");
    const res = await fetch("/api/inquiry", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErrorMsg(data?.errors?.formErrors?.[0] ?? "unknown_error");
      setState("error");
      return;
    }
    setState("success");
    form.reset();
  }

  if (state === "success") {
    return (
      <div className="rounded-2xl border border-ink/10 bg-petal/30 p-10 text-center max-w-2xl mx-auto">
        <p className="font-display text-4xl text-ink leading-tight">{t("success_title")}</p>
        <p className="mt-4 text-ink/75">{t("success_body")}</p>
      </div>
    );
  }

  const errors = form.formState.errors;
  const watchedBudget = form.watch("budgetBand");

  return (
    <form
      id="inquire"
      onSubmit={form.handleSubmit(onSubmit)}
      className="grid gap-6 max-w-3xl mx-auto"
      noValidate
    >
      <HoneypotField register={form.register("honeypot")} />
      <input type="hidden" {...form.register("type")} />
      <input type="hidden" {...form.register("locale")} />
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label={t("name")} required {...form.register("contact.name")} error={errors.contact?.name && t("errors.name")} />
        <Field label={t("email")} type="email" required {...form.register("contact.email")} error={errors.contact?.email && t("errors.email")} />
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label={t("phone")} type="tel" inputMode="tel" required {...form.register("contact.phone")} error={errors.contact?.phone && t("errors.phone")} />
        <Field label={t("date")} type="date" {...form.register("date")} />
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label={t("venue")} {...form.register("venue")} />
        <Field label={t("guests")} type="number" inputMode="numeric" min={1} {...form.register("guests")} />
      </div>
      <fieldset>
        <legend className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink/60 mb-2">{t("budget")}</legend>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {BUDGETS.map((b) => (
            <label key={b} className={`cursor-pointer rounded-xl border px-3 py-3 text-center font-mono text-[11px] uppercase tracking-[0.18em] ${
              watchedBudget === b ? "border-rouge bg-rouge/5 text-ink" : "border-ink/15 text-ink/70 hover:border-ink/30"
            }`}>
              <input type="radio" value={b} className="sr-only" {...form.register("budgetBand")} />
              {t(`budget_${b}`)}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="block">
        <span className="block font-mono text-[11px] uppercase tracking-[0.18em] text-ink/60 mb-1.5">{t("vibe")}</span>
        <textarea
          rows={5}
          required
          {...form.register("vibe")}
          className="block w-full rounded-xl border border-ink/15 bg-bone px-4 py-3 text-base text-ink focus:outline-none focus:ring-2 focus:ring-rouge/40 focus:border-rouge"
        />
        {errors.vibe && <span className="mt-1 block font-mono text-[11px] text-error">{t("errors.vibe")}</span>}
      </label>
      <Field label={t("source")} {...form.register("source")} />
      {errorMsg && <p className="font-mono text-[11px] text-error">{t(`errors.${errorMsg}`)}</p>}
      <div>
        <Button type="submit" disabled={state === "submitting"}>
          {state === "submitting" ? t("submitting") : t("submit")}
        </Button>
      </div>
    </form>
  );
}

type FieldProps = React.InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string };
function Field({ label, error, id, ...rest }: FieldProps) {
  const fid = id ?? `f-${label.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <label htmlFor={fid} className="block">
      <span className="block font-mono text-[11px] uppercase tracking-[0.18em] text-ink/60 mb-1.5">{label}</span>
      <input
        id={fid}
        {...rest}
        className="block w-full rounded-xl border border-ink/15 bg-bone px-4 py-3 text-base text-ink focus:outline-none focus:ring-2 focus:ring-rouge/40 focus:border-rouge"
      />
      {error && <span className="mt-1 block font-mono text-[11px] text-error">{error}</span>}
    </label>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/inquiry/WeddingsForm.tsx
git commit -m "feat(inquiry): add wedding inquiry form with RHF + zod"
```

---

## Task 31: `/weddings` page

**Files:**
- Create: `app/[locale]/weddings/page.tsx`
- Create: `app/[locale]/weddings/loading.tsx`

- [ ] **Step 1: Write the page**

```tsx
// app/[locale]/weddings/page.tsx
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { WeddingsHero } from "@/components/weddings/WeddingsHero";
import { ProcessStrip } from "@/components/weddings/ProcessStrip";
import { MasonryGallery } from "@/components/weddings/MasonryGallery";
import { PricingIntent } from "@/components/weddings/PricingIntent";
import { WeddingsFAQ } from "@/components/weddings/WeddingsFAQ";
import { WeddingsForm } from "@/components/inquiry/WeddingsForm";
import type { Locale } from "@/types/locale";

export async function generateMetadata({
  params,
}: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "weddings" });
  return {
    title: t("page_title"),
    description: t("page_description"),
    alternates: {
      languages: { en: "/en/weddings", es: "/es/weddings" },
    },
  };
}

export default async function WeddingsPage({
  params,
}: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "weddings" });
  return (
    <main>
      <WeddingsHero locale={locale} />
      <ProcessStrip />
      <MasonryGallery locale={locale} />
      <PricingIntent locale={locale} />
      <WeddingsFAQ locale={locale} />
      <section id="inquire" className="py-24 bg-petal/20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <header className="mb-10 max-w-2xl">
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink/60">{t("form.eyebrow")}</p>
            <h2 className="mt-3 font-display text-5xl text-ink leading-[0.95] tracking-tighter">{t("form.title")}</h2>
            <p className="mt-4 text-ink/70 max-w-[58ch]">{t("form.body")}</p>
          </header>
          <WeddingsForm locale={locale} />
        </div>
      </section>
    </main>
  );
}
```

- [ ] **Step 2: Write `loading.tsx`** (simple skeleton)

```tsx
// app/[locale]/weddings/loading.tsx
export default function Loading() {
  return (
    <main>
      <div className="min-h-[100dvh] bg-ink/5 animate-pulse" />
    </main>
  );
}
```

- [ ] **Step 3: Boot dev and verify**

Run: `pnpm dev`
Open: `http://localhost:3000/en/weddings` and `/es/weddings`.
Expected: hero, process, gallery (lightbox keyboard-navigable), FAQ, form. Submit a test inquiry — confirm `pending-inquiries.json` is created at the project root with the entry.

- [ ] **Step 4: Commit**

```bash
git add app/[locale]/weddings
git commit -m "feat(weddings): add /weddings page with full layout + inquiry form"
```

---

## Task 32: Events — UseCaseGrid + EventsForm + page

**Files:**
- Create: `components/events/EventsHero.tsx`
- Create: `components/events/UseCaseGrid.tsx`
- Create: `components/inquiry/EventsForm.tsx`
- Create: `app/[locale]/events/page.tsx`
- Create: `app/[locale]/events/loading.tsx`

The Events page reuses `ProcessStrip` (with different `messages/...events.process` keys) and `MasonryGallery` (with the same portfolio data — Diva's installation work spans both).

- [ ] **Step 1: Write `EventsHero.tsx`**

Same structure as `WeddingsHero` but reading from `messages.events.*`:

```tsx
// components/events/EventsHero.tsx
import Link from "next/link";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/types/locale";

export async function EventsHero({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "events" });
  return (
    <section className="relative min-h-[100dvh] flex items-end overflow-hidden">
      <Image
        src="https://picsum.photos/seed/diva-events-hero/2400/3000"
        alt={t("hero_alt")}
        fill priority sizes="100vw" className="object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-ink/20 to-transparent" />
      <div className="relative z-10 mx-auto max-w-7xl w-full px-4 sm:px-6 lg:px-8 pb-20 pt-32 grid lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 space-y-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-bone/80">{t("eyebrow")}</p>
          <h1 className="font-display text-bone text-6xl sm:text-7xl lg:text-8xl leading-[0.92] tracking-tighter">
            {t("hero_title")}
          </h1>
          <p className="text-bone/85 text-lg max-w-[52ch]">{t("hero_sub")}</p>
          <Button asChild variant="primary" arched>
            <Link href={`/${locale}/events#inquire`}>{t("hero_cta")}</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Write `UseCaseGrid.tsx`**

```tsx
// components/events/UseCaseGrid.tsx
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/types/locale";

const CASES = ["restaurants", "offices", "galleries", "private", "press", "hotels"] as const;

export async function UseCaseGrid({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "events.cases" });
  return (
    <section className="py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <header className="mb-12 max-w-2xl">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink/60">{t("eyebrow")}</p>
          <h2 className="mt-3 font-display text-5xl text-ink leading-[0.95] tracking-tighter">{t("title")}</h2>
        </header>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CASES.map((c, i) => (
            <li key={c} className="rounded-2xl border border-ink/10 bg-bone p-6 hover:border-rouge/40 transition-colors">
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-rouge">0{i + 1}</p>
              <h3 className="mt-3 font-display text-2xl text-ink">{t(`${c}.title`)}</h3>
              <p className="mt-2 text-sm text-ink/70 leading-relaxed">{t(`${c}.body`)}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Write `EventsForm.tsx`**

Mirror `WeddingsForm` structure with `eventInquirySchema` and the corporate fields (company, frequency).

```tsx
// components/inquiry/EventsForm.tsx
"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { HoneypotField } from "@/components/inquiry/HoneypotField";
import { eventInquirySchema, type EventInquiry } from "@/schemas/inquiry";
import type { Locale } from "@/types/locale";

const BUDGETS = ["5-10k", "10-25k", "25k+", "open"] as const;
const FREQS = ["one-time", "weekly", "biweekly", "monthly", "quarterly"] as const;

export function EventsForm({ locale }: { locale: Locale }) {
  const t = useTranslations("events.form");
  const [state, setState] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const form = useForm<EventInquiry>({
    resolver: zodResolver(eventInquirySchema),
    mode: "onBlur",
    defaultValues: {
      type: "event",
      contact: { name: "", email: "", phone: "" },
      company: "",
      frequency: "one-time",
      guests: undefined,
      budgetBand: "open",
      vibe: "",
      locale,
      honeypot: "",
    },
  });

  async function onSubmit(values: EventInquiry) {
    setState("submitting");
    const res = await fetch("/api/inquiry", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErrorMsg(data?.errors?.formErrors?.[0] ?? "unknown_error");
      setState("error");
      return;
    }
    setState("success");
    form.reset();
  }

  if (state === "success") {
    return (
      <div className="rounded-2xl border border-ink/10 bg-petal/30 p-10 text-center max-w-2xl mx-auto">
        <p className="font-display text-4xl text-ink leading-tight">{t("success_title")}</p>
        <p className="mt-4 text-ink/75">{t("success_body")}</p>
      </div>
    );
  }

  const errors = form.formState.errors;
  const watchedBudget = form.watch("budgetBand");
  const watchedFreq = form.watch("frequency");

  return (
    <form id="inquire" onSubmit={form.handleSubmit(onSubmit)} className="grid gap-6 max-w-3xl mx-auto" noValidate>
      <HoneypotField register={form.register("honeypot")} />
      <input type="hidden" {...form.register("type")} />
      <input type="hidden" {...form.register("locale")} />
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label={t("name")} required {...form.register("contact.name")} error={errors.contact?.name && t("errors.name")} />
        <Field label={t("company")} required {...form.register("company")} error={errors.company && t("errors.company")} />
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label={t("email")} type="email" required {...form.register("contact.email")} error={errors.contact?.email && t("errors.email")} />
        <Field label={t("phone")} type="tel" inputMode="tel" required {...form.register("contact.phone")} error={errors.contact?.phone && t("errors.phone")} />
      </div>
      <fieldset>
        <legend className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink/60 mb-2">{t("frequency")}</legend>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {FREQS.map((f) => (
            <label key={f} className={`cursor-pointer rounded-xl border px-3 py-3 text-center font-mono text-[11px] uppercase tracking-[0.18em] ${
              watchedFreq === f ? "border-rouge bg-rouge/5 text-ink" : "border-ink/15 text-ink/70 hover:border-ink/30"
            }`}>
              <input type="radio" value={f} className="sr-only" {...form.register("frequency")} />
              {t(`freq_${f}`)}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink/60 mb-2">{t("budget")}</legend>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {BUDGETS.map((b) => (
            <label key={b} className={`cursor-pointer rounded-xl border px-3 py-3 text-center font-mono text-[11px] uppercase tracking-[0.18em] ${
              watchedBudget === b ? "border-rouge bg-rouge/5 text-ink" : "border-ink/15 text-ink/70 hover:border-ink/30"
            }`}>
              <input type="radio" value={b} className="sr-only" {...form.register("budgetBand")} />
              {t(`budget_${b}`)}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="block">
        <span className="block font-mono text-[11px] uppercase tracking-[0.18em] text-ink/60 mb-1.5">{t("brief")}</span>
        <textarea rows={5} required {...form.register("vibe")} className="block w-full rounded-xl border border-ink/15 bg-bone px-4 py-3 text-base text-ink focus:outline-none focus:ring-2 focus:ring-rouge/40 focus:border-rouge" />
        {errors.vibe && <span className="mt-1 block font-mono text-[11px] text-error">{t("errors.vibe")}</span>}
      </label>
      {errorMsg && <p className="font-mono text-[11px] text-error">{t(`errors.${errorMsg}`)}</p>}
      <div>
        <Button type="submit" disabled={state === "submitting"}>
          {state === "submitting" ? t("submitting") : t("submit")}
        </Button>
      </div>
    </form>
  );
}

type FieldProps = React.InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string };
function Field({ label, error, id, ...rest }: FieldProps) {
  const fid = id ?? `f-${label.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <label htmlFor={fid} className="block">
      <span className="block font-mono text-[11px] uppercase tracking-[0.18em] text-ink/60 mb-1.5">{label}</span>
      <input id={fid} {...rest} className="block w-full rounded-xl border border-ink/15 bg-bone px-4 py-3 text-base text-ink focus:outline-none focus:ring-2 focus:ring-rouge/40 focus:border-rouge" />
      {error && <span className="mt-1 block font-mono text-[11px] text-error">{error}</span>}
    </label>
  );
}
```

- [ ] **Step 4: Write `app/[locale]/events/page.tsx`**

```tsx
// app/[locale]/events/page.tsx
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { EventsHero } from "@/components/events/EventsHero";
import { UseCaseGrid } from "@/components/events/UseCaseGrid";
import { ProcessStrip } from "@/components/weddings/ProcessStrip";
import { EventsForm } from "@/components/inquiry/EventsForm";
import type { Locale } from "@/types/locale";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "events" });
  return {
    title: t("page_title"),
    description: t("page_description"),
    alternates: { languages: { en: "/en/events", es: "/es/events" } },
  };
}

export default async function EventsPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "events" });
  return (
    <main>
      <EventsHero locale={locale} />
      <UseCaseGrid locale={locale} />
      <ProcessStrip />
      <section id="inquire" className="py-24 bg-petal/20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <header className="mb-10 max-w-2xl">
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink/60">{t("form.eyebrow")}</p>
            <h2 className="mt-3 font-display text-5xl text-ink leading-[0.95] tracking-tighter">{t("form.title")}</h2>
            <p className="mt-4 text-ink/70 max-w-[58ch]">{t("form.body")}</p>
          </header>
          <EventsForm locale={locale} />
        </div>
      </section>
    </main>
  );
}
```

> Note: ProcessStrip currently uses the `weddings.process` namespace. Add a `useNamespace` prop to make it reusable, OR copy the logic into `events/ProcessStrip.tsx`. The simpler option is the prop:
>
> ```tsx
> // ProcessStrip signature update
> export function ProcessStrip({ namespace = "weddings.process" }: { namespace?: string }) {
>   const t = useTranslations(namespace);
>   ...
> }
> ```
> Then in events: `<ProcessStrip namespace="events.process" />`. Apply this small refactor in this same task.

- [ ] **Step 5: Write `app/[locale]/events/loading.tsx`** (mirror weddings loading)

```tsx
// app/[locale]/events/loading.tsx
export default function Loading() {
  return <main><div className="min-h-[100dvh] bg-ink/5 animate-pulse" /></main>;
}
```

- [ ] **Step 6: Commit**

```bash
git add components/events components/inquiry/EventsForm.tsx components/weddings/ProcessStrip.tsx app/[locale]/events
git commit -m "feat(events): add /events page, use-case grid, events form"
```

---

## Task 33: Contact page + form

**Files:**
- Create: `components/contact/StudioInfo.tsx`
- Create: `components/contact/DeliveryZonePills.tsx`
- Create: `components/contact/StudioMap.tsx`
- Create: `components/inquiry/ContactForm.tsx`
- Create: `app/[locale]/contact/page.tsx`

- [ ] **Step 1: Write `StudioInfo.tsx`** (Server Component)

```tsx
// components/contact/StudioInfo.tsx
import { getTranslations } from "next-intl/server";
import { formatPhoneUS } from "@/lib/format";
import type { Locale } from "@/types/locale";

export async function StudioInfo({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "contact.studio" });
  const items: { label: string; value: string }[] = [
    { label: t("address_label"), value: t("address_value") },
    { label: t("hours_label"), value: t("hours_value") },
    { label: t("phone_label"), value: formatPhoneUS("5164843456") },
    { label: t("email_label"), value: "hello@divaflowers.com" },
  ];
  return (
    <dl className="space-y-6">
      {items.map((i) => (
        <div key={i.label}>
          <dt className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink/55">{i.label}</dt>
          <dd className="mt-1 font-display text-2xl text-ink leading-snug">{i.value}</dd>
        </div>
      ))}
    </dl>
  );
}
```

- [ ] **Step 2: Write `DeliveryZonePills.tsx`**

```tsx
// components/contact/DeliveryZonePills.tsx
import { getTranslations } from "next-intl/server";
import { deliveryZones } from "@/data/delivery-zones";
import type { Locale } from "@/types/locale";

export async function DeliveryZonePills({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "contact.zones" });
  return (
    <section className="py-16 bg-bone">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink/60">{t("eyebrow")}</p>
        <h2 className="mt-3 font-display text-4xl text-ink leading-[0.95] tracking-tighter mb-6">{t("title")}</h2>
        <ul className="flex flex-wrap gap-2">
          {deliveryZones.map((zone) => (
            <li key={zone.id} className="rounded-full border border-ink/15 px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-ink/75">
              {zone.label[locale]}
            </li>
          ))}
        </ul>
        <p className="mt-6 font-mono text-[11px] text-ink/55 max-w-[60ch]">{t("note")}</p>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Write `StudioMap.tsx`** (static map link image)

```tsx
// components/contact/StudioMap.tsx
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/types/locale";

export async function StudioMap({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "contact.map" });
  return (
    <a
      href="https://maps.google.com/?q=1077+Hempstead+Tpke,+Franklin+Square,+NY"
      target="_blank"
      rel="noreferrer"
      className="block aspect-[4/5] sm:aspect-square overflow-hidden rounded-2xl bg-bone group"
    >
      <Image
        src="https://picsum.photos/seed/diva-map/1200/1200"
        alt={t("alt")}
        width={1200}
        height={1200}
        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
      />
    </a>
  );
}
```

- [ ] **Step 4: Write `ContactForm.tsx`**

```tsx
// components/inquiry/ContactForm.tsx
"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { HoneypotField } from "@/components/inquiry/HoneypotField";
import { contactSchema, type ContactInput } from "@/schemas/contact";
import type { Locale } from "@/types/locale";

export function ContactForm({ locale }: { locale: Locale }) {
  const t = useTranslations("contact.form");
  const [state, setState] = useState<"idle" | "submitting" | "success" | "error">("idle");

  const form = useForm<ContactInput>({
    resolver: zodResolver(contactSchema),
    mode: "onBlur",
    defaultValues: { name: "", email: "", subject: "", body: "", locale, honeypot: "" },
  });

  async function onSubmit(values: ContactInput) {
    setState("submitting");
    const res = await fetch("/api/contact", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(values),
    });
    setState(res.ok ? "success" : "error");
    if (res.ok) form.reset();
  }

  if (state === "success") {
    return (
      <div className="rounded-2xl border border-ink/10 bg-petal/30 p-8 text-center">
        <p className="font-display text-3xl text-ink leading-tight">{t("success_title")}</p>
        <p className="mt-3 text-ink/75 text-sm">{t("success_body")}</p>
      </div>
    );
  }

  const errors = form.formState.errors;
  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4" noValidate>
      <HoneypotField register={form.register("honeypot")} />
      <input type="hidden" {...form.register("locale")} />
      <Field label={t("name")} required {...form.register("name")} error={errors.name && t("errors.name")} />
      <Field label={t("email")} type="email" required {...form.register("email")} error={errors.email && t("errors.email")} />
      <Field label={t("subject")} required {...form.register("subject")} error={errors.subject && t("errors.subject")} />
      <label className="block">
        <span className="block font-mono text-[11px] uppercase tracking-[0.18em] text-ink/60 mb-1.5">{t("body")}</span>
        <textarea rows={5} required {...form.register("body")} className="block w-full rounded-xl border border-ink/15 bg-bone px-4 py-3 text-base text-ink focus:outline-none focus:ring-2 focus:ring-rouge/40 focus:border-rouge" />
        {errors.body && <span className="mt-1 block font-mono text-[11px] text-error">{t("errors.body")}</span>}
      </label>
      {state === "error" && <p className="font-mono text-[11px] text-error">{t("errors.unknown_error")}</p>}
      <div>
        <Button type="submit" disabled={state === "submitting"}>{state === "submitting" ? t("submitting") : t("submit")}</Button>
      </div>
    </form>
  );
}

type FieldProps = React.InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string };
function Field({ label, error, id, ...rest }: FieldProps) {
  const fid = id ?? `f-${label.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <label htmlFor={fid} className="block">
      <span className="block font-mono text-[11px] uppercase tracking-[0.18em] text-ink/60 mb-1.5">{label}</span>
      <input id={fid} {...rest} className="block w-full rounded-xl border border-ink/15 bg-bone px-4 py-3 text-base text-ink focus:outline-none focus:ring-2 focus:ring-rouge/40 focus:border-rouge" />
      {error && <span className="mt-1 block font-mono text-[11px] text-error">{error}</span>}
    </label>
  );
}
```

- [ ] **Step 5: Write `app/[locale]/contact/page.tsx`**

```tsx
// app/[locale]/contact/page.tsx
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { StudioInfo } from "@/components/contact/StudioInfo";
import { DeliveryZonePills } from "@/components/contact/DeliveryZonePills";
import { StudioMap } from "@/components/contact/StudioMap";
import { ContactForm } from "@/components/inquiry/ContactForm";
import type { Locale } from "@/types/locale";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "contact" });
  return {
    title: t("page_title"),
    description: t("page_description"),
    alternates: { languages: { en: "/en/contact", es: "/es/contact" } },
  };
}

export default async function ContactPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "contact" });
  return (
    <main>
      <section className="pt-32 pb-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 grid lg:grid-cols-12 gap-12">
          <div className="lg:col-span-5 space-y-10">
            <header>
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink/60">{t("eyebrow")}</p>
              <h1 className="mt-3 font-display text-6xl sm:text-7xl text-ink leading-[0.92] tracking-tighter">{t("title")}</h1>
            </header>
            <StudioInfo locale={locale} />
            <StudioMap locale={locale} />
          </div>
          <div className="lg:col-span-7 lg:pl-12 lg:border-l lg:border-ink/10">
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink/60">{t("form.eyebrow")}</p>
            <h2 className="mt-3 mb-8 font-display text-4xl text-ink leading-[0.95] tracking-tighter">{t("form.title")}</h2>
            <ContactForm locale={locale} />
          </div>
        </div>
      </section>
      <DeliveryZonePills locale={locale} />
    </main>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add components/contact components/inquiry/ContactForm.tsx app/[locale]/contact
git commit -m "feat(contact): add /contact with studio info, map, zones, form"
```

---

## Task 34: NewsletterField (footer)

**Files:**
- Create: `components/inquiry/NewsletterField.tsx`
- Modify: `components/nav/Footer.tsx`

- [ ] **Step 1: Write the field**

```tsx
// components/inquiry/NewsletterField.tsx
"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { HoneypotField } from "@/components/inquiry/HoneypotField";
import { newsletterSchema, type NewsletterInput } from "@/schemas/newsletter";
import type { Locale } from "@/types/locale";

export function NewsletterField({ locale }: { locale: Locale }) {
  const t = useTranslations("home.newsletter");
  const [state, setState] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const form = useForm<NewsletterInput>({
    resolver: zodResolver(newsletterSchema),
    defaultValues: { email: "", locale, honeypot: "" },
  });

  async function onSubmit(values: NewsletterInput) {
    setState("submitting");
    const res = await fetch("/api/newsletter", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(values),
    });
    setState(res.ok ? "success" : "error");
    if (res.ok) form.reset();
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-3" noValidate>
      <HoneypotField register={form.register("honeypot")} />
      <input type="hidden" {...form.register("locale")} />
      <div className="relative">
        <input
          type="email"
          placeholder={t("placeholder")}
          aria-label={t("placeholder")}
          {...form.register("email")}
          className="w-full rounded-full border border-ink/15 bg-transparent pl-4 pr-12 py-3 text-base text-ink placeholder:text-ink/40 focus:outline-none focus:ring-2 focus:ring-rouge/40 focus:border-rouge"
        />
        <button
          type="submit"
          aria-label={t("cta")}
          disabled={state === "submitting"}
          className="absolute right-1 top-1/2 -translate-y-1/2 inline-flex h-9 w-9 items-center justify-center rounded-full bg-rouge text-bone hover:bg-rouge/90 disabled:opacity-60"
        >
          <ArrowRight size={14} />
        </button>
      </div>
      {state === "success" && <p className="font-mono text-[11px] text-success">{t("success")}</p>}
      {state === "error" && <p className="font-mono text-[11px] text-error">{t("error")}</p>}
    </form>
  );
}
```

- [ ] **Step 2: Wire into `Footer.tsx`**

In the appropriate footer column, replace the static placeholder with `<NewsletterField locale={locale} />`.

- [ ] **Step 3: Commit**

```bash
git add components/inquiry/NewsletterField.tsx components/nav/Footer.tsx
git commit -m "feat(newsletter): wire footer newsletter field to /api/newsletter"
```

---

# PART E — Editorial: Story & Journal

## Task 35: Editorial primitives — PullQuote, Figure, DropCap, ZigZagItem

**Files:**
- Create: `components/editorial/PullQuote.tsx`
- Create: `components/editorial/Figure.tsx`
- Create: `components/editorial/DropCap.tsx`
- Create: `components/editorial/ZigZagItem.tsx`

- [ ] **Step 1: Write `PullQuote.tsx`** — uses `lilac` (one of two site-wide uses, per §4.1)

```tsx
// components/editorial/PullQuote.tsx
type Props = {
  children: React.ReactNode;
  cite?: string;
};

export function PullQuote({ children, cite }: Props) {
  return (
    <figure className="my-12 max-w-4xl mx-auto rounded-[2rem] bg-lilac/30 px-8 py-12 sm:px-16 sm:py-20">
      <blockquote className="font-display text-3xl sm:text-5xl text-ink leading-[1.05] tracking-tighter">
        "{children}"
      </blockquote>
      {cite && (
        <figcaption className="mt-6 font-mono text-[11px] uppercase tracking-[0.22em] text-ink/60">
          — {cite}
        </figcaption>
      )}
    </figure>
  );
}
```

- [ ] **Step 2: Write `Figure.tsx`**

```tsx
// components/editorial/Figure.tsx
import Image from "next/image";

type Props = {
  src: string;
  alt: string;
  caption?: string;
  aspect?: "4/5" | "1/1" | "16/9" | "3/2";
  align?: "left" | "right" | "full";
};

export function Figure({ src, alt, caption, aspect = "4/5", align = "full" }: Props) {
  const widthClass =
    align === "full" ? "max-w-3xl mx-auto"
      : align === "left" ? "sm:float-left sm:mr-8 sm:mb-4 max-w-md"
      : "sm:float-right sm:ml-8 sm:mb-4 max-w-md";
  return (
    <figure className={`my-10 ${widthClass}`}>
      <div className="overflow-hidden rounded-2xl bg-bone" style={{ aspectRatio: aspect.replace("/", " / ") }}>
        <Image src={src} alt={alt} width={1200} height={1500} className="h-full w-full object-cover" sizes="(max-width: 768px) 100vw, 768px" />
      </div>
      {caption && <figcaption className="mt-3 font-mono text-[11px] uppercase tracking-[0.18em] text-ink/55">{caption}</figcaption>}
    </figure>
  );
}
```

- [ ] **Step 3: Write `DropCap.tsx`**

```tsx
// components/editorial/DropCap.tsx
export function DropCap({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-base sm:text-lg text-ink/85 leading-relaxed max-w-[68ch] [&::first-letter]:font-display [&::first-letter]:text-7xl [&::first-letter]:leading-[0.85] [&::first-letter]:float-left [&::first-letter]:mr-3 [&::first-letter]:mt-1 [&::first-letter]:text-rouge">
      {children}
    </p>
  );
}
```

- [ ] **Step 4: Write `ZigZagItem.tsx`** for journal index

```tsx
// components/editorial/ZigZagItem.tsx
import Link from "next/link";
import Image from "next/image";

type Props = {
  href: string;
  title: string;
  excerpt: string;
  date: string;
  cover: { src: string; alt: string };
  reverse?: boolean;
  featured?: boolean;
};

export function ZigZagItem({ href, title, excerpt, date, cover, reverse, featured }: Props) {
  return (
    <Link
      href={href}
      className={`group grid items-center gap-8 ${
        featured ? "lg:grid-cols-1" : "lg:grid-cols-2"
      } ${reverse && !featured ? "lg:[&>*:first-child]:order-2" : ""}`}
    >
      <div className={`overflow-hidden rounded-2xl bg-bone ${featured ? "aspect-[16/9]" : "aspect-[4/5]"}`}>
        <Image
          src={cover.src}
          alt={cover.alt}
          width={1600}
          height={featured ? 900 : 1200}
          sizes={featured ? "100vw" : "(max-width: 1024px) 100vw, 50vw"}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
        />
      </div>
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink/55">{date}</p>
        <h3 className={`mt-3 font-display text-ink leading-[0.95] tracking-tighter ${featured ? "text-6xl sm:text-7xl" : "text-3xl sm:text-4xl"}`}>{title}</h3>
        <p className="mt-4 text-ink/75 max-w-[58ch]">{excerpt}</p>
      </div>
    </Link>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add components/editorial
git commit -m "feat(editorial): add PullQuote, Figure, DropCap, ZigZagItem primitives"
```

---

## Task 36: Story page

**Files:**
- Create: `components/story/StoryHero.tsx`
- Create: `components/story/ArchSection.tsx`
- Create: `components/story/FounderPortrait.tsx`
- Create: `data/press.ts`
- Create: `components/story/PressLogos.tsx`
- Create: `app/[locale]/story/page.tsx`

- [ ] **Step 1: Write `data/press.ts`**

```ts
// data/press.ts
export const pressMentions = [
  { id: "p1", name: "Vogue", url: "#" },
  { id: "p2", name: "The New York Times", url: "#" },
  { id: "p3", name: "Newsday", url: "#" },
  { id: "p4", name: "Brides", url: "#" },
  { id: "p5", name: "Martha Stewart Weddings", url: "#" },
  { id: "p6", name: "Edible Long Island", url: "#" },
];
```

- [ ] **Step 2: Write `StoryHero.tsx`** with the lilac pull-quote opener (§4.1 — second site-wide use of `lilac`)

```tsx
// components/story/StoryHero.tsx
import { getTranslations } from "next-intl/server";
import { PullQuote } from "@/components/editorial/PullQuote";
import type { Locale } from "@/types/locale";

export async function StoryHero({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "story.hero" });
  return (
    <section className="pt-32 pb-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink/60">{t("eyebrow")}</p>
        <h1 className="mt-4 font-display text-6xl sm:text-7xl lg:text-8xl text-ink leading-[0.92] tracking-tighter max-w-5xl">
          {t("title")}
        </h1>
        <PullQuote cite={t("cite")}>{t("quote")}</PullQuote>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Write `ArchSection.tsx`**

```tsx
// components/story/ArchSection.tsx
import { getTranslations } from "next-intl/server";
import { Figure } from "@/components/editorial/Figure";
import type { Locale } from "@/types/locale";

export async function ArchSection({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "story.arch" });
  return (
    <section className="py-20">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink/60">{t("eyebrow")}</p>
        <h2 className="mt-3 font-display text-5xl text-ink leading-[0.95] tracking-tighter">{t("title")}</h2>
        <Figure
          src="https://picsum.photos/seed/diva-arch-archive/1600/2000"
          alt={t("figure_alt")}
          aspect="4/5"
        />
        <div className="prose prose-base text-ink/85 leading-relaxed space-y-5 max-w-[68ch]">
          <p>{t("p1")}</p>
          <p>{t("p2")}</p>
          <p>{t("p3")}</p>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Write `FounderPortrait.tsx`**

```tsx
// components/story/FounderPortrait.tsx
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/types/locale";

export async function FounderPortrait({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "story.founder" });
  return (
    <section className="py-20 bg-petal/30">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 grid lg:grid-cols-12 gap-10 items-center">
        <div className="lg:col-span-5">
          <div className="aspect-[4/5] overflow-hidden rounded-2xl bg-bone">
            <Image src="https://picsum.photos/seed/diva-founder/1200/1500" alt={t("portrait_alt")} width={1200} height={1500} className="h-full w-full object-cover" sizes="(max-width: 1024px) 100vw, 41vw" />
          </div>
        </div>
        <div className="lg:col-span-7 lg:pl-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink/60">{t("eyebrow")}</p>
          <h2 className="mt-3 font-display text-5xl text-ink leading-[0.95] tracking-tighter">{t("title")}</h2>
          <p className="mt-6 text-ink/85 leading-relaxed max-w-[58ch]">{t("body")}</p>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 5: Write `PressLogos.tsx`**

```tsx
// components/story/PressLogos.tsx
import { getTranslations } from "next-intl/server";
import { pressMentions } from "@/data/press";
import type { Locale } from "@/types/locale";

export async function PressLogos({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "story.press" });
  return (
    <section className="py-20 border-t border-ink/10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink/60">{t("eyebrow")}</p>
        <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-12 gap-y-6">
          {pressMentions.map((p) => (
            <li key={p.id} className="font-display text-2xl sm:text-3xl text-ink/40 hover:text-ink/80 transition-colors">
              {p.name}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
```

- [ ] **Step 6: Write `app/[locale]/story/page.tsx`**

```tsx
// app/[locale]/story/page.tsx
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { StoryHero } from "@/components/story/StoryHero";
import { ArchSection } from "@/components/story/ArchSection";
import { FounderPortrait } from "@/components/story/FounderPortrait";
import { PressLogos } from "@/components/story/PressLogos";
import type { Locale } from "@/types/locale";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "story" });
  return {
    title: t("page_title"),
    description: t("page_description"),
    alternates: { languages: { en: "/en/story", es: "/es/story" } },
  };
}

export default async function StoryPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  return (
    <main>
      <StoryHero locale={locale} />
      <ArchSection locale={locale} />
      <FounderPortrait locale={locale} />
      <PressLogos locale={locale} />
    </main>
  );
}
```

- [ ] **Step 7: Commit**

```bash
git add components/story data/press.ts app/[locale]/story
git commit -m "feat(story): add /story magazine layout with arch + founder + press"
```

---

## Task 37: Journal data + index

**Files:**
- Create: `data/journal.ts`
- Create: `app/[locale]/journal/page.tsx`

The journal seed has 3 articles. Article bodies are typed as a JSX-rendering function so we can drop in `<PullQuote>`, `<Figure>`, `<DropCap>` without an MDX runtime.

- [ ] **Step 1: Write `data/journal.ts`**

Each article body returns a React element. Localized at the function-call site by passing `locale`.

```tsx
// data/journal.ts
import type { ReactNode } from "react";
import { Figure } from "@/components/editorial/Figure";
import { PullQuote } from "@/components/editorial/PullQuote";
import { DropCap } from "@/components/editorial/DropCap";
import type { Locale } from "@/types/locale";

export type JournalArticle = {
  slug: string;
  title: { en: string; es: string };
  excerpt: { en: string; es: string };
  date: string; // YYYY-MM-DD
  readingMinutes: number;
  cover: { src: string; alt: { en: string; es: string } };
  body: (locale: Locale) => ReactNode;
  seo: {
    title: { en: string; es: string };
    description: { en: string; es: string };
  };
};

export const journalArticles: JournalArticle[] = [
  {
    slug: "color-of-the-season-rouge",
    title: {
      en: "The color of the season is rouge.",
      es: "El color de la temporada es rouge.",
    },
    excerpt: {
      en: "On why we keep returning to deep, single-saturation pinks — and how we use them sparingly.",
      es: "Por qué seguimos volviendo al rosa profundo de saturación única — y cómo lo usamos con moderación.",
    },
    date: "2026-04-12",
    readingMinutes: 6,
    cover: {
      src: "https://picsum.photos/seed/diva-journal-rouge/2400/1350",
      alt: {
        en: "Close-up of garden roses in deep rouge",
        es: "Primer plano de rosas de jardín en rouge profundo",
      },
    },
    body: (locale) => {
      const en = locale === "en";
      return (
        <>
          <DropCap>
            {en
              ? "There is a particular pink we keep coming back to — somewhere between dahlia, ranunculus, and the awning we hang every spring. Saturated but not loud. Old-world but not dusty. We call it rouge."
              : "Hay un rosa particular al que seguimos volviendo — entre la dalia, el ranúnculo y el toldo que colgamos cada primavera. Saturado pero no ruidoso. Clásico pero no polvoriento. Le llamamos rouge."}
          </DropCap>
          <p>
            {en
              ? "When you spend a decade designing under the same color, you start to notice the negative space. Rouge only sings when it's surrounded by quiet — bone, ivory, mute slate. Splash too much of it and the room becomes Valentine's Day. Use it as one stem in twenty and the eye finds it like a candle in a window."
              : "Cuando pasas una década diseñando con el mismo color, empiezas a notar el espacio negativo. El rouge solo canta rodeado de silencio — bone, marfil, gris apagado. Pones demasiado y el espacio se vuelve día de San Valentín. Úsalo como un tallo entre veinte, y el ojo lo encuentra como una vela en una ventana."}
          </p>
          <Figure
            src="https://picsum.photos/seed/diva-journal-rouge-2/1600/2000"
            alt={en ? "A single rouge ranunculus on a bone tablecloth" : "Un solo ranúnculo rouge sobre mantel bone"}
            aspect="4/5"
            align="right"
          />
          <p>
            {en
              ? "Rouge is also stubborn under photography. Phones cool it down to magenta; warm light pushes it toward brick. We've stopped fighting and started photographing rouge only at golden hour or under the warm fixtures we keep above the studio bench. It's the difference between a flower that registers as expensive and one that registers as cheap."
              : "El rouge también es testarudo ante la cámara. Los teléfonos lo enfrían a magenta; la luz cálida lo empuja hacia el ladrillo. Hemos dejado de pelear y empezamos a fotografiar el rouge solo en la hora dorada o bajo los focos cálidos sobre la mesa del estudio. Es la diferencia entre una flor que se ve cara y una que se ve barata."}
          </p>
          <PullQuote cite={en ? "From the studio" : "Desde el estudio"}>
            {en
              ? "Rouge only sings when it's surrounded by quiet."
              : "El rouge solo canta cuando está rodeado de silencio."}
          </PullQuote>
          <p>
            {en
              ? "If you're working on a wedding or an installation with us this season, expect us to ask twice before we add a second rouge. The first one earns its place. The second has to earn it harder."
              : "Si estás trabajando en una boda o instalación con nosotros esta temporada, espera que preguntemos dos veces antes de añadir un segundo rouge. El primero se gana su lugar. El segundo tiene que ganárselo aún más."}
          </p>
        </>
      );
    },
    seo: {
      title: {
        en: "The color of the season is rouge — Diva Flowers Journal",
        es: "El color de la temporada es rouge — Diario de Diva Flowers",
      },
      description: {
        en: "Notes on rouge: how we use deep pinks sparingly, and why a single stem reads more expensive than a whole arrangement.",
        es: "Notas sobre el rouge: cómo usamos los rosas profundos con moderación, y por qué un solo tallo se ve más caro que un arreglo entero.",
      },
    },
  },
  {
    slug: "under-the-arch",
    title: {
      en: "Under the arch.",
      es: "Bajo el arco.",
    },
    excerpt: {
      en: "How we built the storefront arch on Hempstead Turnpike, and why we rebuild it every spring.",
      es: "Cómo construimos el arco de la entrada en Hempstead Turnpike, y por qué lo reconstruimos cada primavera.",
    },
    date: "2026-03-18",
    readingMinutes: 5,
    cover: {
      src: "https://picsum.photos/seed/diva-journal-arch/2400/1350",
      alt: {
        en: "Diva Flowers storefront arch in full bloom",
        es: "Arco de la entrada de Diva Flowers en plena floración",
      },
    },
    body: (locale) => {
      const en = locale === "en";
      return (
        <>
          <DropCap>
            {en
              ? "We did not plan to be the place with the arch. The first year, we built a small awning out of dahlia stems and chicken wire because the storefront felt too plain. By the second year, neighbors were stopping their cars."
              : "No planeábamos ser el lugar del arco. El primer año, hicimos un pequeño toldo con tallos de dalia y malla de gallinero porque el frente nos parecía demasiado simple. Al segundo año, los vecinos detenían sus autos."}
          </DropCap>
          <Figure
            src="https://picsum.photos/seed/diva-journal-arch-build/1600/2000"
            alt={en ? "Building the arch frame in early spring" : "Construyendo el marco del arco a principios de primavera"}
            aspect="4/5"
            align="left"
          />
          <p>
            {en
              ? "The frame is welded steel — the same one we've reused for nine years. What changes is the flowers, the time of year, and what the season is asking for. In April it's hydrangea and ranunculus. In June it's peony and rose. In autumn it's amaranthus and dahlia in shades that match the leaves."
              : "El marco es de acero soldado — el mismo que hemos reutilizado durante nueve años. Lo que cambia son las flores, la época del año, y lo que la temporada está pidiendo. En abril son hortensias y ranúnculos. En junio, peonías y rosas. En otoño, amaranto y dalias en tonos que combinan con las hojas."}
          </p>
          <p>
            {en
              ? "Every year someone asks if we'd consider making it permanent — silk, dried, preserved. We always say no. The point of the arch is that it's alive. It wilts by Sunday. It comes down by mid-summer. It is the loudest love letter we know how to write to the neighborhood, and you can only write that letter if you mean it for one season at a time."
              : "Cada año alguien nos pregunta si lo haríamos permanente — seda, secas, preservadas. Siempre decimos que no. El punto del arco es que está vivo. Se marchita para el domingo. Se desmonta a mitad de verano. Es la carta de amor más fuerte que sabemos escribirle al barrio, y solo puedes escribirla si lo dices en serio una temporada a la vez."}
          </p>
        </>
      );
    },
    seo: {
      title: {
        en: "Under the arch — Diva Flowers Journal",
        es: "Bajo el arco — Diario de Diva Flowers",
      },
      description: {
        en: "Inside the storefront arch on Hempstead Turnpike: the steel frame, the seasonal blooms, and why we rebuild it every spring.",
        es: "Por dentro del arco en Hempstead Turnpike: el marco de acero, las flores de temporada, y por qué lo reconstruimos cada primavera.",
      },
    },
  },
  {
    slug: "what-the-arrangement-is-saying",
    title: {
      en: "What the arrangement is saying.",
      es: "Lo que dice el arreglo.",
    },
    excerpt: {
      en: "On reading the room: the difference between an apology arrangement and a celebration arrangement.",
      es: "Sobre leer la habitación: la diferencia entre un arreglo de disculpa y uno de celebración.",
    },
    date: "2026-02-22",
    readingMinutes: 4,
    cover: {
      src: "https://picsum.photos/seed/diva-journal-meaning/2400/1350",
      alt: {
        en: "Two arrangements side by side, contrasting tones",
        es: "Dos arreglos lado a lado, tonos contrastantes",
      },
    },
    body: (locale) => {
      const en = locale === "en";
      return (
        <>
          <DropCap>
            {en
              ? "When someone calls and tells us they need an arrangement for a recipient they have hurt, we do not ask why. We ask about the recipient. The flowers are not for the sender."
              : "Cuando alguien llama y dice que necesita un arreglo para alguien a quien ha lastimado, no preguntamos por qué. Preguntamos por la persona que lo recibe. Las flores no son para quien las envía."}
          </DropCap>
          <p>
            {en
              ? "An apology bouquet is quieter than a celebration bouquet. There is no peony. There is no orchid. There is white, and ivory, and a single stem of something the recipient once mentioned in passing. The card message is short, and the writing is plain. Anything more and it becomes a performance."
              : "Un ramo de disculpa es más silencioso que uno de celebración. No hay peonía. No hay orquídea. Hay blanco, marfil, y un solo tallo de algo que la persona alguna vez mencionó al pasar. El mensaje en la tarjeta es breve, y la letra simple. Cualquier cosa más y se convierte en una actuación."}
          </p>
          <PullQuote>
            {en
              ? "The flowers are not for the sender."
              : "Las flores no son para quien las envía."}
          </PullQuote>
          <p>
            {en
              ? "A celebration bouquet, by contrast, can be loud. It can have peonies the size of a fist. It can have rouge. It can break the rules we usually keep. The recipient is somewhere already happy and the flowers are joining them, not arguing with them."
              : "Un ramo de celebración, en cambio, puede ser ruidoso. Puede tener peonías del tamaño de un puño. Puede tener rouge. Puede romper las reglas que normalmente seguimos. La persona ya está en algún lugar feliz y las flores se les unen, no discuten con ellas."}
          </p>
          <p>
            {en
              ? "The hardest call we get is somewhere in between — someone who is gone, but the recipient is in a complicated grief. For those, we make something that has not made up its mind: white, with one warm thread running through it. We have made hundreds of those. They are the arrangements we are most careful with."
              : "La llamada más difícil está en algún punto intermedio — alguien que se ha ido, pero el dolor de quien recibe es complicado. Para esos casos, hacemos algo que aún no se ha decidido: blanco, con un hilo cálido atravesándolo. Hemos hecho cientos. Son los arreglos con los que tenemos más cuidado."}
          </p>
        </>
      );
    },
    seo: {
      title: {
        en: "What the arrangement is saying — Diva Flowers Journal",
        es: "Lo que dice el arreglo — Diario de Diva Flowers",
      },
      description: {
        en: "Reading the room: the difference between an apology arrangement and a celebration arrangement, and why white-with-one-warm-thread is the hardest one we make.",
        es: "Leer la habitación: la diferencia entre un arreglo de disculpa y uno de celebración, y por qué el blanco con un hilo cálido es el más difícil de hacer.",
      },
    },
  },
];

export function getArticleBySlug(slug: string): JournalArticle | undefined {
  return journalArticles.find((a) => a.slug === slug);
}
```

- [ ] **Step 2: Write `app/[locale]/journal/page.tsx`** (zig-zag index)

```tsx
// app/[locale]/journal/page.tsx
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ZigZagItem } from "@/components/editorial/ZigZagItem";
import { journalArticles } from "@/data/journal";
import type { Locale } from "@/types/locale";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "journal" });
  return {
    title: t("page_title"),
    description: t("page_description"),
    alternates: { languages: { en: "/en/journal", es: "/es/journal" } },
  };
}

export default async function JournalIndex({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "journal" });
  const sorted = [...journalArticles].sort((a, b) => b.date.localeCompare(a.date));
  const [featured, ...rest] = sorted;
  return (
    <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-32 pb-24">
      <header className="mb-16 max-w-2xl">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink/60">{t("eyebrow")}</p>
        <h1 className="mt-3 font-display text-6xl sm:text-7xl text-ink leading-[0.92] tracking-tighter">{t("title")}</h1>
      </header>
      <div className="space-y-20">
        <ZigZagItem
          href={`/${locale}/journal/${featured.slug}`}
          title={featured.title[locale]}
          excerpt={featured.excerpt[locale]}
          date={featured.date}
          cover={{ src: featured.cover.src, alt: featured.cover.alt[locale] }}
          featured
        />
        {rest.map((a, i) => (
          <ZigZagItem
            key={a.slug}
            href={`/${locale}/journal/${a.slug}`}
            title={a.title[locale]}
            excerpt={a.excerpt[locale]}
            date={a.date}
            cover={{ src: a.cover.src, alt: a.cover.alt[locale] }}
            reverse={i % 2 === 1}
          />
        ))}
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add data/journal.ts app/[locale]/journal/page.tsx
git commit -m "feat(journal): add 3-article seed + zig-zag index"
```

---

## Task 38: Journal article page

**Files:**
- Create: `app/[locale]/journal/[slug]/page.tsx`

- [ ] **Step 1: Write the route**

```tsx
// app/[locale]/journal/[slug]/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { journalArticles, getArticleBySlug } from "@/data/journal";
import type { Locale } from "@/types/locale";

export async function generateStaticParams() {
  return journalArticles.flatMap((a) =>
    (["en", "es"] as const).map((locale) => ({ locale, slug: a.slug })),
  );
}

export async function generateMetadata({
  params,
}: { params: Promise<{ locale: Locale; slug: string }> }): Promise<Metadata> {
  const { locale, slug } = await params;
  const article = getArticleBySlug(slug);
  if (!article) return {};
  return {
    title: article.seo.title[locale],
    description: article.seo.description[locale],
    alternates: {
      languages: {
        en: `/en/journal/${slug}`,
        es: `/es/journal/${slug}`,
      },
    },
    openGraph: {
      title: article.title[locale],
      description: article.excerpt[locale],
      images: [{ url: article.cover.src }],
    },
  };
}

export default async function JournalArticlePage({
  params,
}: { params: Promise<{ locale: Locale; slug: string }> }) {
  const { locale, slug } = await params;
  const article = getArticleBySlug(slug);
  if (!article) notFound();
  const t = await getTranslations({ locale, namespace: "journal.article" });
  return (
    <main className="pt-32 pb-24">
      <article>
        <header className="mx-auto max-w-3xl px-4 sm:px-6 mb-10">
          <Link
            href={`/${locale}/journal`}
            className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.22em] text-ink/60 hover:text-ink"
          >
            <ArrowLeft size={12} />
            {t("back")}
          </Link>
          <p className="mt-8 font-mono text-[11px] uppercase tracking-[0.22em] text-ink/60">
            {article.date} · {t("reading", { minutes: article.readingMinutes })}
          </p>
          <h1 className="mt-4 font-display text-5xl sm:text-7xl text-ink leading-[0.92] tracking-tighter">
            {article.title[locale]}
          </h1>
          <p className="mt-6 text-lg text-ink/75 max-w-[58ch]">{article.excerpt[locale]}</p>
        </header>
        <div className="mx-auto max-w-5xl px-4 sm:px-6 mb-12">
          <div className="aspect-[16/9] overflow-hidden rounded-2xl bg-bone">
            <Image
              src={article.cover.src}
              alt={article.cover.alt[locale]}
              width={2400}
              height={1350}
              priority
              sizes="(max-width: 1024px) 100vw, 1024px"
              className="h-full w-full object-cover"
            />
          </div>
        </div>
        <div className="mx-auto max-w-3xl px-4 sm:px-6 prose-slot text-base sm:text-lg text-ink/85 max-w-[68ch]">
          {article.body(locale)}
        </div>
      </article>
    </main>
  );
}
```

- [ ] **Step 2: Boot dev and verify**

Run: `pnpm dev`
Open: `http://localhost:3000/en/journal` and click into each article. Verify:
- Drop cap renders.
- Pull quote uses lilac.
- Figures render with captions.
- ES locale renders the Spanish body.

- [ ] **Step 3: Commit**

```bash
git add app/[locale]/journal/[slug]
git commit -m "feat(journal): add article page with generateStaticParams + metadata"
```

---

# PART F — Account Stubs & Legal

## Task 39: AccountShell + AuthForm + Account routes

**Files:**
- Create: `components/account/AccountShell.tsx`
- Create: `components/account/AuthForm.tsx`
- Create: `components/account/OrdersEmpty.tsx`
- Create: `app/[locale]/account/page.tsx`
- Create: `app/[locale]/account/sign-up/page.tsx`
- Create: `app/[locale]/account/orders/page.tsx`

These are explicitly **stubbed** — the forms render and validate, but submitting just shows a success-ish notice. Wiring NextAuth/Clerk later is purely additive.

- [ ] **Step 1: Write `AccountShell.tsx`**

```tsx
// components/account/AccountShell.tsx
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/types/locale";

const TABS = [
  { id: "sign-in", href: "" },
  { id: "sign-up", href: "/sign-up" },
  { id: "orders", href: "/orders" },
] as const;

export async function AccountShell({
  locale, active, children,
}: { locale: Locale; active: typeof TABS[number]["id"]; children: React.ReactNode }) {
  const t = await getTranslations({ locale, namespace: "account" });
  return (
    <main className="mx-auto max-w-5xl px-4 sm:px-6 pt-32 pb-24">
      <header className="mb-10 max-w-2xl">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink/60">{t("eyebrow")}</p>
        <h1 className="mt-3 font-display text-5xl text-ink leading-[0.95] tracking-tighter">{t("title")}</h1>
      </header>
      <nav className="flex gap-2 mb-10 border-b border-ink/10">
        {TABS.map((tab) => (
          <Link
            key={tab.id}
            href={`/${locale}/account${tab.href}`}
            aria-current={active === tab.id ? "page" : undefined}
            className={`-mb-px px-4 py-3 font-mono text-[11px] uppercase tracking-[0.22em] border-b-2 ${
              active === tab.id ? "border-rouge text-ink" : "border-transparent text-ink/55 hover:text-ink/80"
            }`}
          >
            {t(`tabs.${tab.id}`)}
          </Link>
        ))}
      </nav>
      <div>{children}</div>
    </main>
  );
}
```

- [ ] **Step 2: Write `AuthForm.tsx`** (stubbed; the submit handler just shows a banner)

```tsx
// components/account/AuthForm.tsx
"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

type Mode = "sign-in" | "sign-up";

export function AuthForm({ mode }: { mode: Mode }) {
  const t = useTranslations(`account.${mode}`);
  const [submitted, setSubmitted] = useState(false);

  if (submitted) {
    return (
      <div className="rounded-2xl border border-ink/10 bg-petal/30 p-8 text-center max-w-md">
        <p className="font-display text-2xl text-ink leading-tight">{t("stub_title")}</p>
        <p className="mt-3 text-sm text-ink/75">{t("stub_body")}</p>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setSubmitted(true);
      }}
      className="grid gap-4 max-w-md"
    >
      {mode === "sign-up" && (
        <Field label={t("name")} name="name" required />
      )}
      <Field label={t("email")} name="email" type="email" required />
      <Field label={t("password")} name="password" type="password" required minLength={8} />
      <div className="pt-2">
        <Button type="submit">{t("submit")}</Button>
      </div>
      <p className="font-mono text-[11px] text-ink/55">{t("stub_notice")}</p>
    </form>
  );
}

function Field({ label, ...rest }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const id = `f-${rest.name}`;
  return (
    <label htmlFor={id} className="block">
      <span className="block font-mono text-[11px] uppercase tracking-[0.18em] text-ink/60 mb-1.5">{label}</span>
      <input id={id} {...rest} className="block w-full rounded-xl border border-ink/15 bg-bone px-4 py-3 text-base text-ink focus:outline-none focus:ring-2 focus:ring-rouge/40 focus:border-rouge" />
    </label>
  );
}
```

- [ ] **Step 3: Write `OrdersEmpty.tsx`**

```tsx
// components/account/OrdersEmpty.tsx
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/types/locale";

export async function OrdersEmpty({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "account.orders" });
  return (
    <div className="rounded-2xl border border-ink/10 p-10 text-center max-w-2xl">
      <p className="font-display text-3xl text-ink leading-tight">{t("empty_title")}</p>
      <p className="mt-3 text-ink/75">{t("empty_body")}</p>
      <p className="mt-6 font-mono text-[11px] text-ink/55">{t("stub_notice")}</p>
      <div className="mt-6">
        <Button asChild>
          <Link href={`/${locale}/shop`}>{t("empty_cta")}</Link>
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Write the three account pages**

```tsx
// app/[locale]/account/page.tsx
import type { Metadata } from "next";
import { AccountShell } from "@/components/account/AccountShell";
import { AuthForm } from "@/components/account/AuthForm";
import type { Locale } from "@/types/locale";

export const metadata: Metadata = { title: "Sign in", robots: { index: false, follow: false } };

export default async function SignInPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  return (
    <AccountShell locale={locale} active="sign-in">
      <AuthForm mode="sign-in" />
    </AccountShell>
  );
}
```

```tsx
// app/[locale]/account/sign-up/page.tsx
import type { Metadata } from "next";
import { AccountShell } from "@/components/account/AccountShell";
import { AuthForm } from "@/components/account/AuthForm";
import type { Locale } from "@/types/locale";

export const metadata: Metadata = { title: "Create an account", robots: { index: false, follow: false } };

export default async function SignUpPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  return (
    <AccountShell locale={locale} active="sign-up">
      <AuthForm mode="sign-up" />
    </AccountShell>
  );
}
```

```tsx
// app/[locale]/account/orders/page.tsx
import type { Metadata } from "next";
import { AccountShell } from "@/components/account/AccountShell";
import { OrdersEmpty } from "@/components/account/OrdersEmpty";
import type { Locale } from "@/types/locale";

export const metadata: Metadata = { title: "Orders", robots: { index: false, follow: false } };

export default async function OrdersPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  return (
    <AccountShell locale={locale} active="orders">
      <OrdersEmpty locale={locale} />
    </AccountShell>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add components/account app/[locale]/account
git commit -m "feat(account): add stubbed account routes (sign-in, sign-up, orders)"
```

---

## Task 40: Legal pages

**Files:**
- Create: `components/legal/LegalShell.tsx`
- Create: `app/[locale]/legal/privacy/page.tsx`
- Create: `app/[locale]/legal/terms/page.tsx`

- [ ] **Step 1: Write `LegalShell.tsx`** (long-form layout)

```tsx
// components/legal/LegalShell.tsx
import type { Locale } from "@/types/locale";

type Section = { heading: string; body: string[] };

export function LegalShell({
  title, updated, sections,
}: {
  title: string;
  updated: string;
  sections: Section[];
}) {
  return (
    <main className="mx-auto max-w-3xl px-4 sm:px-6 pt-32 pb-24">
      <header className="mb-12">
        <h1 className="font-display text-5xl text-ink leading-[0.95] tracking-tighter">{title}</h1>
        <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.22em] text-ink/55">{updated}</p>
      </header>
      <div className="space-y-10 text-ink/85 leading-relaxed">
        {sections.map((s, i) => (
          <section key={i}>
            <h2 className="font-display text-2xl text-ink mb-3">{s.heading}</h2>
            {s.body.map((p, j) => (
              <p key={j} className="mt-3 max-w-[68ch]">{p}</p>
            ))}
          </section>
        ))}
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Write privacy + terms pages**

These are realistic-but-generic placeholder copy — explicitly marked as drafts; v1 launch will require legal review.

```tsx
// app/[locale]/legal/privacy/page.tsx
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LegalShell } from "@/components/legal/LegalShell";
import type { Locale } from "@/types/locale";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "legal.privacy" });
  return { title: t("page_title"), description: t("page_description") };
}

export default async function PrivacyPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "legal.privacy" });
  const sections = ["data_collected", "how_we_use", "sharing", "cookies", "rights", "contact"].map((id) => ({
    heading: t(`${id}.heading`),
    body: [t(`${id}.p1`), t(`${id}.p2`)],
  }));
  return <LegalShell title={t("title")} updated={t("updated")} sections={sections} />;
}
```

```tsx
// app/[locale]/legal/terms/page.tsx
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LegalShell } from "@/components/legal/LegalShell";
import type { Locale } from "@/types/locale";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "legal.terms" });
  return { title: t("page_title"), description: t("page_description") };
}

export default async function TermsPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "legal.terms" });
  const sections = ["acceptance", "orders", "delivery", "returns", "subscriptions", "limitation", "contact"].map((id) => ({
    heading: t(`${id}.heading`),
    body: [t(`${id}.p1`), t(`${id}.p2`)],
  }));
  return <LegalShell title={t("title")} updated={t("updated")} sections={sections} />;
}
```

- [ ] **Step 3: Commit**

```bash
git add components/legal app/[locale]/legal
git commit -m "feat(legal): add privacy and terms pages with shared shell"
```

---

# PART G — i18n, Sitemap, OG, e2e, Final Polish

## Task 41: Extend `messages/en.json` and `messages/es.json`

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/es.json`

This task adds the keys referenced by every component in this plan. Both locales must be updated in lockstep — every English key gets a Spanish counterpart.

- [ ] **Step 1: Add to `messages/en.json` under existing namespaces (merge — do not overwrite)**

The full set of new keys, structured by namespace:

```json
{
  "cart": {
    "title": "Your bag",
    "close": "Close",
    "subtotal": "Subtotal",
    "calculated_at_checkout": "Delivery + tax calculated at checkout.",
    "checkout_cta": "Continue to checkout",
    "view_full": "View full bag",
    "remove": "Remove",
    "qty_label": "Quantity",
    "qty_increase": "Increase quantity",
    "qty_decrease": "Decrease quantity",
    "empty_title": "Your bag is empty.",
    "empty_body": "Browse the shop and find an arrangement that's the right shape of joy.",
    "empty_cta": "Browse the shop",
    "summary_title": "Order summary",
    "page_eyebrow": "Bag",
    "page_title": "Your bag",
    "page_description": "Review the items in your bag and continue to checkout.",
    "toast_added": "Added to bag"
  },
  "checkout": {
    "eyebrow": "Checkout",
    "page_title": "Checkout",
    "page_description": "Complete your order — Diva Flowers, Long Island.",
    "step_contact": "Contact",
    "step_delivery": "Delivery",
    "step_payment": "Payment",
    "continue": "Continue",
    "back": "Back",
    "place_order": "Place order",
    "placing": "Placing order…",
    "summary": "Order summary",
    "subtotal": "Subtotal",
    "delivery": "Delivery",
    "tax": "Tax",
    "total": "Total",
    "email": "Email",
    "phone": "Phone",
    "recipient_name": "Recipient name",
    "recipient_phone": "Recipient phone",
    "address_street1": "Street address",
    "address_street2": "Apt, suite (optional)",
    "address_city": "City",
    "address_state": "State",
    "address_zip": "ZIP",
    "delivery_date": "Delivery date",
    "delivery_window": "Delivery window",
    "slot_morning": "Morning",
    "slot_midday": "Midday",
    "slot_afternoon": "Afternoon",
    "slot_evening": "Evening",
    "card_message": "Card message (optional)",
    "card_message_hint": "Up to 200 characters. We hand-write every card.",
    "payment_stub_label": "Payment",
    "payment_stub_body": "Payment processing is in development. Place the order and we'll confirm by phone — or check back soon for live checkout.",
    "payment_stub_processing": "Processing payment…",
    "errors": {
      "email_invalid": "Enter a valid email.",
      "phone_too_short": "Enter a 10-digit phone.",
      "name_too_short": "Enter the recipient's name.",
      "street_required": "Enter a street address.",
      "city_required": "Enter a city.",
      "state_invalid": "Use a 2-letter state.",
      "zip_invalid": "Enter a valid ZIP.",
      "date_invalid": "Choose a valid date.",
      "date_in_past": "Choose a date today or later.",
      "card_too_long": "Card message must be 200 characters or fewer.",
      "cart_empty": "Your bag is empty.",
      "unknown_error": "Something went wrong. Try again."
    }
  },
  "confirmation": {
    "page_title": "Order confirmed",
    "page_description": "Thank you for ordering with Diva Flowers.",
    "paid_label": "Payment received",
    "title": "Thank you, {name}.",
    "body": "We've received your order and are preparing it now. You'll get a delivery confirmation by phone the morning of your selected window.",
    "body_subscription": "Your first delivery is on {date}. Future deliveries continue on the cadence you selected.",
    "order_id": "Order",
    "delivery_to": "Delivering to",
    "totals": "Totals",
    "subtotal": "Subtotal",
    "delivery": "Delivery",
    "tax": "Tax",
    "total": "Total",
    "back_to_shop": "Back to the shop"
  },
  "weddings": {
    "page_title": "Weddings — Diva Flowers",
    "page_description": "Full-service wedding floral installations on Long Island and the New York metro area.",
    "eyebrow": "Weddings",
    "hero_alt": "Floral arch installation at a Long Island wedding ceremony",
    "hero_title": "Installations, by Diva.",
    "hero_sub": "Full-service florals for weddings on Long Island and the New York metro area — from arches and aisles to reception tablescapes.",
    "hero_cta": "Inquire",
    "process": {
      "eyebrow": "Process",
      "title": "Discover. Design. Install. Memory.",
      "discover": { "title": "Discover", "body": "We start with a 30-minute call about you, your venue, and what feeling you want the room to carry." },
      "design":   { "title": "Design",   "body": "We send mood boards, a color story, and a line-itemized proposal. We iterate until it's right." },
      "install":  { "title": "Install",  "body": "Our team installs on-site, dawn to ceremony. We stay through cocktail hour to adjust anything that shifts." },
      "memory":   { "title": "Memory",   "body": "We deliver pressed and framed pieces from your bouquet within four weeks of the date." }
    },
    "gallery": {
      "eyebrow": "Recent work",
      "title": "A small selection.",
      "close": "Close",
      "prev": "Previous photo",
      "next": "Next photo"
    },
    "pricing": {
      "eyebrow": "Investment",
      "statement_full": "Full-service installations from $5,000. Bouquets and personal florals from $1,500.",
      "statement_personal": "Each proposal is built around your venue, guest count, and the feeling you want to leave behind. We'll send a detailed line-itemized estimate after our first call."
    },
    "faq": { "eyebrow": "Common questions", "title": "Things people ask." },
    "form": {
      "eyebrow": "Inquire",
      "title": "Tell us about your day.",
      "body": "We answer every inquiry within two business days. The more you can share, the better we can design something that's actually you.",
      "name": "Your name",
      "email": "Email",
      "phone": "Phone",
      "date": "Wedding date (optional)",
      "venue": "Venue (optional)",
      "guests": "Guest count (optional)",
      "budget": "Budget range",
      "budget_5-10k": "$5–10k",
      "budget_10-25k": "$10–25k",
      "budget_25k+": "$25k+",
      "budget_open": "Open",
      "vibe": "Vibe — palette, references, anything you love",
      "source": "How did you hear about us? (optional)",
      "submit": "Send inquiry",
      "submitting": "Sending…",
      "success_title": "Thank you. We'll be in touch soon.",
      "success_body": "We respond to every inquiry within two business days. Until then — keep dreaming.",
      "errors": {
        "name": "Enter your name.",
        "email": "Enter a valid email.",
        "phone": "Enter a 10-digit phone.",
        "vibe": "Tell us a little more — at least a sentence or two.",
        "rate_limited": "Too many inquiries from this network. Try again in a minute.",
        "unknown_error": "Something went wrong. Try again."
      }
    }
  },
  "events": {
    "page_title": "Events — Diva Flowers",
    "page_description": "Corporate events, recurring office florals, restaurants, hotels, galleries, press.",
    "eyebrow": "Events",
    "hero_alt": "Florals installed at a corporate event reception",
    "hero_title": "Florals, on retainer or by occasion.",
    "hero_sub": "Restaurants, offices, galleries, hotels, press events, private clients. One-time installations or recurring contracts.",
    "hero_cta": "Inquire",
    "cases": {
      "eyebrow": "What we cover",
      "title": "Where Diva florals show up.",
      "restaurants": { "title": "Restaurants", "body": "Weekly bar and host-stand florals; opening-night dressing." },
      "offices":     { "title": "Offices",     "body": "Recurring reception desks, executive suites, town-hall events." },
      "galleries":   { "title": "Galleries",   "body": "Opening receptions, press previews, donor dinners." },
      "private":     { "title": "Private",     "body": "Birthdays, anniversaries, dinner parties, residences." },
      "press":       { "title": "Press",       "body": "Editorial shoots, brand activations, launch events." },
      "hotels":      { "title": "Hotels",      "body": "Lobby installations, suite turn-downs, holiday programs." }
    },
    "process": {
      "eyebrow": "Process",
      "title": "Brief. Propose. Install. Maintain.",
      "discover": { "title": "Brief",    "body": "We talk through the room, the use case, and the cadence." },
      "design":   { "title": "Propose",  "body": "Itemized proposal with palette, scale, and recurring schedule." },
      "install":  { "title": "Install",  "body": "On-site, white-glove, scheduled around your operations." },
      "memory":   { "title": "Maintain", "body": "Recurring refresh on the schedule we agreed — same designer each time." }
    },
    "form": {
      "eyebrow": "Inquire",
      "title": "Tell us about the room.",
      "body": "We respond within two business days with availability and an indicative range. Recurring contracts get priority scheduling.",
      "name": "Your name",
      "company": "Company",
      "email": "Email",
      "phone": "Phone",
      "frequency": "Frequency",
      "freq_one-time": "One-time",
      "freq_weekly": "Weekly",
      "freq_biweekly": "Biweekly",
      "freq_monthly": "Monthly",
      "freq_quarterly": "Quarterly",
      "budget": "Budget per event",
      "budget_5-10k": "$5–10k",
      "budget_10-25k": "$10–25k",
      "budget_25k+": "$25k+",
      "budget_open": "Open",
      "brief": "Brief — what's the use case, what's the feeling, any references",
      "submit": "Send inquiry",
      "submitting": "Sending…",
      "success_title": "Thank you. We'll be in touch.",
      "success_body": "We respond to every inquiry within two business days.",
      "errors": {
        "name": "Enter your name.",
        "company": "Enter your company name.",
        "email": "Enter a valid email.",
        "phone": "Enter a 10-digit phone.",
        "vibe": "Tell us a little more about the brief.",
        "rate_limited": "Too many inquiries from this network. Try again in a minute.",
        "unknown_error": "Something went wrong. Try again."
      }
    }
  },
  "story": {
    "page_title": "Story — Diva Flowers",
    "page_description": "How Diva Flowers came to be the place with the arch on Hempstead Turnpike.",
    "hero": {
      "eyebrow": "Story",
      "title": "We've been arranging flowers under the same pink awning since 2014.",
      "quote": "We did not plan to be the place with the arch.",
      "cite": "Diva Flowers"
    },
    "arch": {
      "eyebrow": "Our arch",
      "title": "Built around an arch.",
      "figure_alt": "Storefront arch in early spring, partially planted",
      "p1": "The first year, we built a small awning out of dahlia stems and chicken wire because the storefront felt too plain. By the second year, neighbors were stopping their cars.",
      "p2": "The frame is welded steel — the same one we've reused for nine years. What changes is the flowers, the time of year, and what the season is asking for.",
      "p3": "Every year someone asks if we'd consider making it permanent. We always say no. The point of the arch is that it's alive."
    },
    "founder": {
      "eyebrow": "Founder",
      "title": "Hi — I'm the florist.",
      "portrait_alt": "Portrait of the Diva Flowers founder in the studio",
      "body": "I've been arranging flowers since I was twelve, in my mother's kitchen. I opened Diva on Hempstead Turnpike in 2014, with one cooler and one assistant. We are bigger now, but the work has not changed: every arrangement leaves the studio because someone here decided it was good enough."
    },
    "press": { "eyebrow": "As seen in" }
  },
  "journal": {
    "page_title": "Journal — Diva Flowers",
    "page_description": "Notes from the studio: color, process, and the arch we keep rebuilding.",
    "eyebrow": "Journal",
    "title": "Notes from the studio.",
    "article": {
      "back": "All articles",
      "reading": "{minutes} min read"
    }
  },
  "contact": {
    "page_title": "Contact — Diva Flowers",
    "page_description": "Visit the studio, call us, or send a note. Long Island and Queens delivery.",
    "eyebrow": "Contact",
    "title": "Visit the studio.",
    "studio": {
      "address_label": "Address",
      "address_value": "1077 Hempstead Tpke, Franklin Square, NY 11010",
      "hours_label": "Hours",
      "hours_value": "Mon–Sat · 9 AM – 7 PM",
      "phone_label": "Phone",
      "email_label": "Email"
    },
    "zones": {
      "eyebrow": "Delivery",
      "title": "Where we deliver.",
      "note": "Same-day delivery available within Nassau and Queens for orders placed before 1 PM. Suffolk and outside zones available with advance notice."
    },
    "map": { "alt": "Map of the Diva Flowers studio in Franklin Square" },
    "form": {
      "eyebrow": "Send us a note",
      "title": "Or just say hello.",
      "name": "Your name",
      "email": "Email",
      "subject": "Subject",
      "body": "Message",
      "submit": "Send",
      "submitting": "Sending…",
      "success_title": "Got it — thank you.",
      "success_body": "We'll respond within one business day.",
      "errors": {
        "name": "Enter your name.",
        "email": "Enter a valid email.",
        "subject": "Add a subject line.",
        "body": "Tell us a little more.",
        "rate_limited": "Too many messages from this network. Try again in a minute.",
        "unknown_error": "Something went wrong. Try again."
      }
    }
  },
  "account": {
    "eyebrow": "Account",
    "title": "Your account.",
    "tabs": { "sign-in": "Sign in", "sign-up": "Create account", "orders": "Orders" },
    "sign-in": {
      "email": "Email",
      "password": "Password",
      "submit": "Sign in",
      "stub_notice": "Account login is coming soon. For now, your orders are confirmed by phone.",
      "stub_title": "Sign-in is coming soon.",
      "stub_body": "We're wiring up accounts. In the meantime, your order confirmation lives in the email we send."
    },
    "sign-up": {
      "name": "Name",
      "email": "Email",
      "password": "Password",
      "submit": "Create account",
      "stub_notice": "Account creation is coming soon.",
      "stub_title": "Account creation is coming soon.",
      "stub_body": "We're saving your spot — check back in the next few weeks."
    },
    "orders": {
      "empty_title": "No orders yet.",
      "empty_body": "When you place an order, you'll be able to track and reorder it from here.",
      "stub_notice": "Order history is coming soon.",
      "empty_cta": "Browse the shop"
    }
  },
  "legal": {
    "privacy": {
      "page_title": "Privacy — Diva Flowers",
      "page_description": "How Diva Flowers handles your data.",
      "title": "Privacy",
      "updated": "Last updated April 2026",
      "data_collected": { "heading": "Data we collect", "p1": "We collect the information you give us when you place an order or send an inquiry: name, email, phone, delivery address, and payment details processed by our payment provider.", "p2": "We also collect basic web analytics: which pages you visit and how you got to us, with no personal identifiers." },
      "how_we_use":     { "heading": "How we use it",  "p1": "We use your contact information to fulfill orders, deliver flowers, and respond to inquiries.", "p2": "We do not sell your data, and we do not share it except with the partners required to ship and process your order." },
      "sharing":        { "heading": "Sharing",        "p1": "We share order information with our payment processor (Stripe), our shipping/delivery partners, and our email service provider.", "p2": "Each of these partners has its own privacy policy, which we encourage you to read." },
      "cookies":        { "heading": "Cookies",        "p1": "We use a small number of essential cookies to remember your locale and your bag.", "p2": "We do not use third-party advertising or tracking cookies." },
      "rights":         { "heading": "Your rights",    "p1": "You can request a copy of your data, ask us to delete it, or correct anything that's wrong.", "p2": "Contact us at hello@divaflowers.com for any privacy-related request." },
      "contact":        { "heading": "Contact",        "p1": "Diva Flowers, 1077 Hempstead Tpke, Franklin Square, NY 11010.", "p2": "hello@divaflowers.com · (516) 484-3456." }
    },
    "terms": {
      "page_title": "Terms — Diva Flowers",
      "page_description": "Terms of service for orders placed with Diva Flowers.",
      "title": "Terms",
      "updated": "Last updated April 2026",
      "acceptance":   { "heading": "Acceptance",   "p1": "By placing an order with Diva Flowers, you agree to these terms.", "p2": "We may update these terms; the latest version is always at this URL." },
      "orders":       { "heading": "Orders",       "p1": "All orders are subject to availability and confirmation.", "p2": "We reserve the right to substitute flowers of equal or greater value when supply varies." },
      "delivery":     { "heading": "Delivery",     "p1": "We deliver across Nassau, Queens, and parts of Suffolk County. Same-day cutoff is 1 PM local time.", "p2": "Delivery windows are best-effort; recipient absence may require redelivery." },
      "returns":      { "heading": "Returns",      "p1": "Flowers are perishable and not returnable. If something is wrong, contact us within 24 hours and we'll make it right.", "p2": "We replace, refund, or credit at our discretion based on the circumstance." },
      "subscriptions": { "heading": "Subscriptions", "p1": "Subscriptions can be paused or canceled at any time before the next billing cycle.", "p2": "Recurring billing is currently in development; v1 subscriptions are billed manually." },
      "limitation":   { "heading": "Limitation",   "p1": "Our liability is limited to the value of the order in question.", "p2": "We are not liable for indirect or consequential damages." },
      "contact":      { "heading": "Contact",      "p1": "Diva Flowers, 1077 Hempstead Tpke, Franklin Square, NY 11010.", "p2": "hello@divaflowers.com · (516) 484-3456." }
    }
  }
}
```

- [ ] **Step 2: Mirror everything in `messages/es.json`**

Translate every key. The translator must:
- Keep `{name}`, `{date}`, `{minutes}` interpolation tokens unchanged.
- Mirror tone — warm, editorial, confident — not literal.
- Use `usted` for the inquiry forms and `tú` for editorial copy (matches Plan 1's tone established in `home.*`).

(Provide the full Spanish JSON in the same shape — every key present in EN must be present in ES. Use the source content already in this plan's component tasks for direct strings that already had EN/ES — wedding FAQ, journal articles, story arch — those live in `data/` not in messages.)

- [ ] **Step 3: Verify both locales render**

Run: `pnpm dev`
Open every new page in `/en/...` and `/es/...`. Watch the console for "Missing message" warnings from next-intl — fix any.

- [ ] **Step 4: Commit**

```bash
git add messages/en.json messages/es.json
git commit -m "feat(i18n): add cart, checkout, weddings, events, story, journal, contact, account, legal keys (EN+ES)"
```

---

## Task 42: Sitemap extension

**Files:**
- Modify: `app/sitemap.ts`

- [ ] **Step 1: Read current `app/sitemap.ts`**

The Plan 2 version covers home, shop hub, category pages, products. Plan 3 adds: cart, checkout (excluded — `noindex`), weddings, events, story, journal index, journal articles, contact, legal pages. Confirmation pages and account routes are excluded.

- [ ] **Step 2: Update**

```ts
// app/sitemap.ts
import type { MetadataRoute } from "next";
import { products } from "@/data/products";
import { journalArticles } from "@/data/journal";
import { locales } from "@/types/locale";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://divaflowers.com";

const STATIC_PATHS = [
  "",
  "shop",
  "shop/arrangements",
  "shop/bouquets",
  "shop/plants",
  "shop/gifts",
  "shop/sympathy",
  "shop/subscriptions",
  "weddings",
  "events",
  "story",
  "journal",
  "contact",
  "legal/privacy",
  "legal/terms",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [];
  for (const locale of locales) {
    for (const p of STATIC_PATHS) {
      const path = p ? `/${locale}/${p}` : `/${locale}`;
      entries.push({
        url: `${SITE}${path}`,
        lastModified: now,
        alternates: {
          languages: Object.fromEntries(
            locales.map((l) => [l, `${SITE}${p ? `/${l}/${p}` : `/${l}`}`]),
          ),
        },
      });
    }
    for (const product of products) {
      entries.push({
        url: `${SITE}/${locale}/product/${product.slug}`,
        lastModified: now,
        alternates: {
          languages: Object.fromEntries(
            locales.map((l) => [l, `${SITE}/${l}/product/${product.slug}`]),
          ),
        },
      });
    }
    for (const article of journalArticles) {
      entries.push({
        url: `${SITE}/${locale}/journal/${article.slug}`,
        lastModified: new Date(article.date + "T00:00:00"),
        alternates: {
          languages: Object.fromEntries(
            locales.map((l) => [l, `${SITE}/${l}/journal/${article.slug}`]),
          ),
        },
      });
    }
  }
  return entries;
}
```

- [ ] **Step 3: Verify**

Run: `pnpm dev`
Open: `http://localhost:3000/sitemap.xml`
Expected: every locale × every static path + every product slug + every journal slug. No `cart`, `checkout`, `account`, `order/*` entries.

- [ ] **Step 4: Commit**

```bash
git add app/sitemap.ts
git commit -m "feat(seo): extend sitemap with weddings, events, story, journal, contact, legal"
```

---

## Task 43: TopNav links + footer legal links

**Files:**
- Modify: `components/nav/NavLinks.tsx`
- Modify: `components/nav/Footer.tsx`

- [ ] **Step 1: Verify nav links present**

Spec §3 nav: Wordmark · Shop · Subscriptions · Weddings · Events · Story · | locale · search · cart. Open `NavLinks.tsx` and ensure each new route is reachable from the desktop nav. Add any missing entries (Weddings, Events, Story, Journal? Spec says Journal lives in the footer / story sub-nav, not the top nav). Confirm by re-reading §3.

> Decision: top nav = Shop, Subscriptions, Weddings, Events, Story. Journal is footer-only. Contact is footer-only.

- [ ] **Step 2: Footer legal links**

In `Footer.tsx`, add a small legal row at the bottom:

```tsx
<div className="flex flex-wrap gap-6 font-mono text-[11px] uppercase tracking-[0.18em] text-ink/55">
  <Link href={`/${locale}/journal`} className="hover:text-ink">{t("nav.journal")}</Link>
  <Link href={`/${locale}/contact`} className="hover:text-ink">{t("nav.contact")}</Link>
  <Link href={`/${locale}/legal/privacy`} className="hover:text-ink">{t("legal.privacy")}</Link>
  <Link href={`/${locale}/legal/terms`} className="hover:text-ink">{t("legal.terms")}</Link>
</div>
```

- [ ] **Step 3: Commit**

```bash
git add components/nav/NavLinks.tsx components/nav/Footer.tsx
git commit -m "feat(nav): add weddings/events/story to top nav, journal+legal to footer"
```

---

## Task 44: Playwright e2e — cart drawer

**Files:**
- Create: `tests/e2e/cart-drawer.spec.ts`

- [ ] **Step 1: Write the spec**

```ts
// tests/e2e/cart-drawer.spec.ts
import { test, expect } from "@playwright/test";

test.describe("cart drawer", () => {
  test("add to bag opens drawer with correct line", async ({ page }) => {
    await page.goto("/en/shop/arrangements");
    const firstCard = page.locator("[data-testid='product-card']").first();
    const productTitle = await firstCard.locator("h3").textContent();
    await firstCard.click();
    await page.getByRole("button", { name: /add to bag/i }).click();
    const drawer = page.getByRole("dialog", { name: /your bag/i });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByText(productTitle ?? "")).toBeVisible();
  });

  test("ESC closes drawer", async ({ page }) => {
    await page.goto("/en/shop/bouquets");
    await page.locator("[data-testid='product-card']").first().click();
    await page.getByRole("button", { name: /add to bag/i }).click();
    const drawer = page.getByRole("dialog", { name: /your bag/i });
    await expect(drawer).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(drawer).not.toBeVisible();
  });

  test("qty stepper updates subtotal", async ({ page }) => {
    await page.goto("/en/shop/arrangements");
    await page.locator("[data-testid='product-card']").first().click();
    await page.getByRole("button", { name: /add to bag/i }).click();
    const drawer = page.getByRole("dialog", { name: /your bag/i });
    const initialSubtotal = await drawer.locator("[data-testid='cart-subtotal']").textContent();
    await drawer.getByRole("button", { name: /increase quantity/i }).click();
    await expect(drawer.locator("[data-testid='cart-subtotal']")).not.toHaveText(initialSubtotal ?? "");
  });

  test("count badge in nav updates", async ({ page }) => {
    await page.goto("/en/shop/arrangements");
    await page.locator("[data-testid='product-card']").first().click();
    await page.getByRole("button", { name: /add to bag/i }).click();
    const cartButton = page.getByRole("button", { name: /bag \(\d+\)/i });
    await expect(cartButton).toBeVisible();
  });
});
```

> Note: this assumes `data-testid='product-card'` and `data-testid='cart-subtotal'` are added to `ProductCard` (Plan 2 Task 7) and `CartSummary` (Task 6 of this plan). Add them now if missing.

- [ ] **Step 2: Run** — `pnpm playwright test tests/e2e/cart-drawer.spec.ts`

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/cart-drawer.spec.ts components/product/ProductCard.tsx components/cart/CartSummary.tsx
git commit -m "test(e2e): add cart drawer flow"
```

---

## Task 45: Playwright e2e — checkout

**Files:**
- Create: `tests/e2e/checkout.spec.ts`

- [ ] **Step 1: Write the spec**

```ts
// tests/e2e/checkout.spec.ts
import { test, expect } from "@playwright/test";

test.describe("checkout", () => {
  test("end-to-end: PDP → drawer → checkout → confirmation", async ({ page }) => {
    // 1. Add to bag
    await page.goto("/en/shop/arrangements");
    await page.locator("[data-testid='product-card']").first().click();
    await page.getByRole("button", { name: /add to bag/i }).click();
    // 2. Drawer → checkout
    const drawer = page.getByRole("dialog", { name: /your bag/i });
    await expect(drawer).toBeVisible();
    await drawer.getByRole("link", { name: /continue to checkout/i }).click();
    // 3. Contact step
    await expect(page.getByRole("heading", { name: /checkout/i })).toBeVisible();
    await page.getByLabel(/email/i).fill("test@example.com");
    await page.getByLabel(/phone/i).first().fill("5165550100");
    await page.getByRole("button", { name: /continue/i }).first().click();
    // 4. Delivery step
    const future = new Date();
    future.setDate(future.getDate() + 7);
    const futureStr = future.toISOString().slice(0, 10);
    await page.getByLabel(/recipient name/i).fill("Lola Cardona");
    await page.getByLabel(/recipient phone/i).fill("5165550101");
    await page.getByLabel(/^street address$/i).fill("1077 Hempstead Tpke");
    await page.getByLabel(/^city$/i).fill("Franklin Square");
    await page.getByLabel(/^state$/i).fill("NY");
    await page.getByLabel(/^zip$/i).fill("11010");
    await page.getByLabel(/delivery date/i).fill(futureStr);
    await page.getByLabel(/midday/i).check();
    await page.getByRole("button", { name: /continue/i }).nth(1).click();
    // 5. Payment + place order
    await page.getByRole("button", { name: /place order/i }).click();
    // 6. Confirmation
    await expect(page).toHaveURL(/\/en\/order\/.+\/confirmation/);
    await expect(page.getByRole("heading", { name: /thank you, lola cardona/i })).toBeVisible();
    await expect(page.getByText(/payment received/i)).toBeVisible();
  });

  test("validation blocks step transitions", async ({ page }) => {
    await page.goto("/en/checkout");
    await page.getByRole("button", { name: /continue/i }).first().click();
    await expect(page.getByText(/enter a valid email/i)).toBeVisible();
  });
});
```

- [ ] **Step 2: Run** — `pnpm playwright test tests/e2e/checkout.spec.ts`

> Note: the test depends on `pending-orders.json` being writable in the dev process. The Playwright config should ensure the dev server runs from the project root. If the test passes locally, commit; if it fails because the directory isn't writable in CI, gate behind `process.env.CI` later. v1 acceptance is local green.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/checkout.spec.ts
git commit -m "test(e2e): add full checkout → confirmation flow"
```

---

## Task 46: Playwright e2e — wedding inquiry, contact, journal, account

**Files:**
- Create: `tests/e2e/weddings-inquiry.spec.ts`
- Create: `tests/e2e/contact.spec.ts`
- Create: `tests/e2e/journal.spec.ts`
- Create: `tests/e2e/account-stubs.spec.ts`

- [ ] **Step 1: Write `weddings-inquiry.spec.ts`**

```ts
// tests/e2e/weddings-inquiry.spec.ts
import { test, expect } from "@playwright/test";

test("wedding inquiry submits and shows success", async ({ page }) => {
  await page.goto("/en/weddings#inquire");
  await page.getByLabel(/your name/i).fill("Lola Cardona");
  await page.getByLabel(/^email$/i).fill("lola@example.com");
  await page.getByLabel(/^phone$/i).fill("5165550100");
  await page.getByLabel(/vibe/i).fill("Romantic, white and soft pink, candlelight, late September.");
  await page.getByLabel(/\$10–25k/i).check();
  await page.getByRole("button", { name: /send inquiry/i }).click();
  await expect(page.getByText(/thank you\. we'll be in touch soon/i)).toBeVisible();
});
```

- [ ] **Step 2: Write `contact.spec.ts`**

```ts
// tests/e2e/contact.spec.ts
import { test, expect } from "@playwright/test";

test("contact form submits", async ({ page }) => {
  await page.goto("/en/contact");
  await page.getByLabel(/your name/i).fill("Lola");
  await page.getByLabel(/email/i).fill("lola@example.com");
  await page.getByLabel(/subject/i).fill("Hello");
  await page.getByLabel(/message/i).fill("I'd love to chat about a small dinner.");
  await page.getByRole("button", { name: /send/i }).click();
  await expect(page.getByText(/got it — thank you/i)).toBeVisible();
});

test("delivery zone pills render", async ({ page }) => {
  await page.goto("/en/contact");
  await expect(page.getByText(/queens/i)).toBeVisible();
  await expect(page.getByText(/south nassau/i)).toBeVisible();
});
```

- [ ] **Step 3: Write `journal.spec.ts`**

```ts
// tests/e2e/journal.spec.ts
import { test, expect } from "@playwright/test";

test("journal index links to articles", async ({ page }) => {
  await page.goto("/en/journal");
  await expect(page.getByRole("heading", { name: /notes from the studio/i })).toBeVisible();
  await page.getByRole("link", { name: /the color of the season is rouge/i }).click();
  await expect(page).toHaveURL(/\/en\/journal\/color-of-the-season-rouge/);
  await expect(page.getByRole("heading", { name: /the color of the season is rouge/i })).toBeVisible();
});

test("journal article renders pull-quote", async ({ page }) => {
  await page.goto("/en/journal/color-of-the-season-rouge");
  await expect(page.getByText(/rouge only sings when it's surrounded by quiet/i)).toBeVisible();
});

test("ES locale renders Spanish article", async ({ page }) => {
  await page.goto("/es/journal/color-of-the-season-rouge");
  await expect(page.getByText(/rouge solo canta/i)).toBeVisible();
});
```

- [ ] **Step 4: Write `account-stubs.spec.ts`**

```ts
// tests/e2e/account-stubs.spec.ts
import { test, expect } from "@playwright/test";

test("account routes render with tabs", async ({ page }) => {
  await page.goto("/en/account");
  await expect(page.getByRole("link", { name: /sign in/i, exact: false })).toBeVisible();
  await expect(page.getByRole("link", { name: /create account/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /orders/i })).toBeVisible();
});

test("orders empty state", async ({ page }) => {
  await page.goto("/en/account/orders");
  await expect(page.getByText(/no orders yet/i)).toBeVisible();
});

test("auth form submit shows stub notice", async ({ page }) => {
  await page.goto("/en/account");
  await page.getByLabel(/email/i).fill("lola@example.com");
  await page.getByLabel(/password/i).fill("supersecret");
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page.getByText(/sign-in is coming soon/i)).toBeVisible();
});
```

- [ ] **Step 5: Run all e2e**

Run: `pnpm playwright test`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add tests/e2e/weddings-inquiry.spec.ts tests/e2e/contact.spec.ts tests/e2e/journal.spec.ts tests/e2e/account-stubs.spec.ts
git commit -m "test(e2e): inquiry, contact, journal, account flows"
```

---

## Task 47: Pre-flight checklist + README + final commit

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Run the §12 Definition-of-Done checklist**

For each item, manually verify:

- [ ] All routes render in `/en/...` and `/es/...` with no console errors. Walk through every new route.
- [ ] `min-h-[100dvh]` is used everywhere a full-height section is needed (Hero on weddings/events). No `h-screen`.
- [ ] No `top`/`left`/`width`/`height` animations except the documented exceptions (`PdpAccordion`, `CheckoutShell` Section, `WeddingsFAQ`).
- [ ] Single H1 per page on every new route. (Cart, Checkout, Confirmation, Weddings, Events, Story, Journal index/article, Contact, Account, Privacy, Terms.)
- [ ] All new images have EN+ES alt text.
- [ ] All new forms have a honeypot, IP rate limit, and zod-validated server side.
- [ ] All new forms have visible `rouge` focus rings.
- [ ] All new perpetual / scroll-snap / lightbox motion has a `prefers-reduced-motion` opt-out.
- [ ] `useEffect` cleanups present in: `CartDrawer` (keydown + body scroll), `MasonryGallery` (keydown), `ToastAddedToBag` (timeout).
- [ ] Empty / loading / error states present everywhere data is loaded (cart, checkout, confirmation, journal article 404, all forms).
- [ ] `pending-inquiries.json` and `pending-orders.json` are gitignored.
- [ ] `npm run lint` clean.
- [ ] `pnpm tsc --noEmit` clean.
- [ ] Lighthouse on `/en` home, `/en/shop/arrangements`, a PDP, `/en/weddings`, `/en/journal/color-of-the-season-rouge`: ≥ 95 perf, ≥ 100 a11y. Document any drops with a follow-up issue.
- [ ] Walk through the §12 happy path: browse → add to cart → checkout (stub) → confirmation. Then submit a wedding inquiry. Then submit a contact form. All persist to `pending-*.json`.

- [ ] **Step 2: Update README**

Add to README under a "v1 Status" or equivalent section:

```md
## v1 status (post-Plan 3)

The site is fully shoppable end-to-end against stubbed payment and email:
- Browse, filter, sort, PDP, add to bag, drawer, /cart, /checkout, /order/[id]/confirmation.
- Inquiry pages: /weddings, /events, /contact (all submit and persist to `pending-inquiries.json`).
- Editorial: /story, /journal, /journal/[slug] (3 articles).
- Stubbed: /account, /account/sign-up, /account/orders.
- Legal: /legal/privacy, /legal/terms.

### v2 swap points
- `<PaymentStub />` → `@stripe/react-stripe-js` `<PaymentElement />` (~1 day).
- `lib/inquiry-storage.ts` and `lib/order-storage.ts` → Resend / Postmark + a real DB.
- `data/journal.ts` → Sanity / Payload, same shape.
- `components/account/AuthForm.tsx` → NextAuth / Clerk, same field set.
```

- [ ] **Step 3: Final commit**

```bash
git add README.md
git commit -m "docs: update README for v1 status post-Plan 3"
```

- [ ] **Step 4: Open a PR (or merge to main)**

```bash
git push -u origin feat/plan-3-cart-checkout-content
gh pr create --title "Plan 3 — Cart, Checkout, Inquiry & Content" --body "$(cat <<'EOF'
## Summary
- Cart drawer, /cart, /checkout (3-step accordion), /order/[id]/confirmation
- /weddings, /events with inquiry forms; /contact with form + delivery zones
- /story (magazine layout); /journal index + 3 article pages with editorial primitives
- /account stubs (sign-in, sign-up, orders); /legal/privacy, /legal/terms
- Sitemap extended; EN+ES messages updated; e2e suites green

Closes the v1 loop. Stripe and email are stubbed but the seams are explicit (PaymentStub, inquiry-storage).

## Test plan
- [ ] Browse → add to cart → checkout stub → confirmation
- [ ] Wedding inquiry → /pending-inquiries.json
- [ ] Contact form → /pending-inquiries.json
- [ ] Newsletter footer → /pending-inquiries.json
- [ ] EN and ES locales for every new route
- [ ] Reduced-motion: drawer, toast, gallery, FAQ, accordion all opt out cleanly
- [ ] Lighthouse ≥ 95 / 100 on home, catalog, PDP, weddings, journal article
EOF
)"
```

---

## Spec coverage check

| Spec section | Covered by |
|---|---|
| §3 (routing): /cart, /checkout, /order/[id]/confirmation | Tasks 9, 19, 20 |
| §3 (routing): /weddings, /events, /story, /journal, /journal/[slug], /contact | Tasks 31, 32, 36, 37, 38, 33 |
| §3 (routing): /account/*, /legal/* | Tasks 39, 40 |
| §5.5 (cart drawer) | Tasks 4–7 |
| §5.6 (checkout) | Tasks 16–19 |
| §5.7 (weddings) | Tasks 27–31 |
| §5.8 (events) | Task 32 |
| §5.10 (story) | Task 36 |
| §5.11 (journal) | Tasks 37, 38 |
| §5.12 (contact) | Task 33 |
| §5.13 (account stubs) | Task 39 |
| §6.2 (Inquiry shape) | Task 23 |
| §6.3 (Order shape) | Tasks 1, 14, 20 |
| §7.1 (cart state, hydration-safe) | Task 8 (mounted flag) |
| §7.3 (forms: zod, honeypot, rate limit, file stub) | Tasks 21, 22, 23, 25, 30, 32, 33, 34 |
| §7.4 (PaymentStub, submitOrder, confirmation) | Tasks 14, 15, 16, 18, 20 |
| §7.5 (subscription tiers in checkout, confirmation copy) | Task 20 (`body_subscription`) |
| §8 (a11y, single H1, focus rings, reduced motion, OG, sitemap) | Conventions + Task 42 |
| §11 (v1 implemented list) | All tasks |
| §12 (Definition of Done) | Task 47 |

---

## Notes for the implementer

- **Start in a fresh worktree** off `main` after Plan 2 has been merged. Worktree branch: `feat/plan-3-cart-checkout-content`.
- **Plan 2 must be merged first** — Plan 3 imports `data/products.ts`, `lib/delivery.ts`, `ProductImage`, `MegaMenu`, `AddToBag`, and the cart-store integration in `PdpConfigurator`. None of these exist on `main` until Plan 2 lands.
- **Spanish translations:** Task 41 step 2 lists 200+ keys in EN. Translate them deliberately — don't run them through a single bulk pass without reading. The brand voice is editorial; literal translations sound flat.
- **Lighthouse:** the 95+ perf bar can be tight on the wedding page hero (large image, `priority`). Use `next/image` `priority` only on the hero; use `sizes` aggressively to keep the network bill down on small screens.
- **Tax + delivery:** `TAX_RATE` and `DELIVERY_FLAT_CENTS` in `lib/totals.ts` are placeholder constants — confirm with the studio before launch. The architecture supports a per-zone fee table later.
- **Account stubs:** explicitly bait NextAuth/Clerk by mirroring their default field shapes. Keep the `<form>` as plain HTML so a v2 swap is just wiring `signIn()` into `onSubmit`.
- **Worktree commit after every task** — Plans 1 and 2 use this cadence; subagent-driven-development relies on it for review checkpoints.





