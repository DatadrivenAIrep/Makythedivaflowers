# Diva Flowers — Website Design Spec

**Date:** 2026-04-30
**Author:** Brainstorming session, Santiago Cardona
**Status:** Approved, ready for implementation planning
**Design framework:** [taste-skill](https://github.com/Leonxlnx/taste-skill) (DESIGN_VARIANCE: 8 · MOTION_INTENSITY: 6 · VISUAL_DENSITY: 4)

---

## 1. Project Overview

A bilingual (EN/ES) e-commerce website for **Diva Flowers**, an existing florist on Long Island, NY (area code 516, phone `516 484 3456`). The brand's strongest physical signature is its hot-pink storefront with a massive floral arch over the door — the digital identity translates this directly: abundant, romantic, joyful, unmistakably "Diva."

The site sells signature arrangements, hand-tied bouquets, plants, gifts, sympathy florals, and weekly subscriptions. Weddings and corporate events are inquiry-driven (not direct purchase). Target price point for signature arrangements: **$150–$400** (premium tier).

**v1 ships as a polished, production-grade Next.js site with stubbed payments and CMS-shaped content.** Stripe and a headless CMS (Sanity or Payload) are explicit v2 swaps the architecture supports without restructuring.

## 2. Tech Stack

- **Next.js (App Router)** with Server Components by default; interactive leaves marked `'use client'` and isolated.
- **Tailwind CSS v4** with `@tailwindcss/postcss`. Tokens defined in `styles/tokens.css`.
- **Framer Motion** for spring physics, layout transitions, magnetic interactions, stagger reveals.
- **shadcn/ui**, customized — never default. Radii, shadows, colors all overridden to match the brand.
- **next-intl** for bilingual routing, messages, and metadata.
- **Zustand** (with `localStorage` persistence) for cart state.
- **react-hook-form + zod** for forms; same zod schemas validate server-side.
- **@phosphor-icons/react** at `weight="regular"` (1.5 stroke).
- **Playwright** for e2e; **Vitest** for unit.

Strict adherence to taste-skill rules: no Inter, no `h-screen` (use `min-h-[100dvh]`), no `top`/`left`/`width`/`height` animations (transform + opacity only), no AI-purple aesthetics, no emojis, no generic 3-column card rows on the home page.

## 3. Information Architecture & Routing

```
/[locale]                       Home (editorial landing)
/[locale]/shop                  Catalog hub
/[locale]/shop/arrangements     Signature arrangements (vased, statement)
/[locale]/shop/bouquets         Hand-tied bouquets
/[locale]/shop/plants           Plants & orchids
/[locale]/shop/gifts            Flowers + champagne / chocolates / candles
/[locale]/shop/sympathy         Sympathy (muted brand variant)
/[locale]/shop/subscriptions    Weekly / biweekly subscriptions
/[locale]/product/[slug]        Product detail page
/[locale]/cart                  Full-page cart (drawer is global)
/[locale]/checkout              Checkout (Stripe-stubbed)
/[locale]/order/[id]/confirmation
/[locale]/weddings              Inquiry-driven brand page
/[locale]/events                Corporate / events (inquiry)
/[locale]/story                 Brand story / about
/[locale]/journal               Editorial journal (CMS-shaped)
/[locale]/journal/[slug]
/[locale]/contact
/[locale]/account               Stubbed (NextAuth/Clerk-ready)
/[locale]/account/orders        Stubbed
/[locale]/legal/privacy
/[locale]/legal/terms
```

**Locales:** `en` (default) and `es`. Locale persisted via cookie. `hreflang` and `alternate` URLs set per page.

**Top nav:** Wordmark · Shop (mega-menu with 6 category thumbs) · Subscriptions · Weddings · Events · Story · | locale toggle · search · cart. Condenses with hairline + backdrop blur on scroll past hero.

## 4. Brand System

### 4.1 Color tokens

| Token | Hex | Use |
|---|---|---|
| `petal` | `#F2C2D0` | Storefront pink, refined for screen. Hero washes, section bgs. |
| `rouge` | `#B8345E` | **Single accent** — CTAs, links, focus. ~70% saturation. |
| `ink` | `#0E0D0C` | Text, dark surfaces. Never pure black. |
| `bone` | `#FAF6F0` | Default light background. |
| `mute-100`–`mute-700` | warm slate ramp | Borders, secondary text. |
| `lilac` | `#C9B6D6` | **Editorial accent only** — used in exactly two places site-wide: the pull-quote opener on Story (`/story`) and the "From our journal" tile background on the PDP. Never a system color, never a CTA. |
| Functional | `success #1F6E3D`, `warn #A75A1F`, `error #8B1F1F` | desaturated. |

**Sympathy variant**: drops `petal` and `rouge`; palette becomes `bone`, `ink`, `mute-700`.

### 4.2 Typography

- **Display:** PP Editorial New (alt: Migra) — high-contrast serif, *Vogue*-grade. Wordmark, hero, section titles. `tracking-tighter leading-none`.
- **Body:** Cabinet Grotesk — UI, paragraphs, navigation. `text-base leading-relaxed max-w-[65ch]`.
- **Mono:** JetBrains Mono — prices, SKUs, delivery windows, phone, address.
- All loaded locally from `public/fonts/`.
- Serif allowed only for display (taste-skill exception for editorial contexts); body always grotesque.

### 4.3 Motion baseline

- Spring physics: `{ type: "spring", stiffness: 100, damping: 20 }`.
- Stagger reveals on grid mounts (90ms cascade).
- Magnetic cursor pull on primary CTAs (`useMotionValue` + `useTransform`, isolated client component).
- Kinetic horizontal marquee in hero.
- Bloom hover on product images (`scale: 1.02, rotate: -0.5deg`, spring).
- `prefers-reduced-motion` opts out of perpetual animations, magnetic, and bloom.
- Sympathy pages override → MOTION_INTENSITY: 2 (no kinetic, no bloom, fade-only stagger).

### 4.4 Materiality

- Surfaces: `rounded-[2rem]` Bento tiles, `rounded-2xl` products, **arched-top** primary CTA (`rounded-t-[10rem]`), `rounded-full` chips.
- Borders: 1px `border-ink/10` (light) / `border-bone/10` (dark).
- Shadows: a single tinted "diffusion shadow" on the floating cart drawer.
- Grain: 4% opacity fixed-position pseudo-element on hero + sympathy + journal only; `pointer-events-none`.

### 4.5 The arch as visual signature

The literal storefront arch is reused digitally:
- Subtle arched SVG section breaks.
- Primary CTA buttons have an arched top (`rounded-t-[10rem]`).
- One Bento tile on the home page uses an arched frame for the featured arrangement.

### 4.6 Iconography

`@phosphor-icons/react` at `weight="regular"` (1.5px) globally. Custom SVG wordmark in PP Editorial.

### 4.7 Photography (v1 placeholders, swap-ready)

- v1 placeholders: `https://picsum.photos/seed/{slug}/1200/1500`, mediated by a `<ProductImage>` component.
- Aspect-ratio mix: `4/5` for products, `16/9` editorial, `1/1` mosaic accents.
- Real-photo direction note for the client: natural light; single-stem hero shots on bone or hot-petal-pink seamless; alternating dense bunch context shots; **avoid** flat-lay-with-eucalyptus, oversaturated pastels, and moody dark-academia.

## 5. Page Layouts

### 5.1 Home (`/[locale]`)

Asymmetric editorial. Above-the-fold:
- Left 55%: PP Editorial hero — *"Romance, by the stem."* / *"Romance, tallo a tallo."* Two CTAs: arched primary "Shop arrangements" (rouge), ghost secondary "Plan a wedding".
- Right 45%: arched-frame full-bleed photo of the signature arrangement.
- `min-h-[100dvh]`. 4% grain pseudo-element.

Below hero, scrolling:
1. Kinetic marquee — content is intentionally bilingual in a single loop (no per-locale variant): `DIVA FLOWERS · ROMANCE BY THE STEM · LONG ISLAND · DESDE 2014 · ENVÍOS HOY · SAME-DAY DELIVERY`. The mixed-language band is a brand statement (NYC-area bilingual identity), not a string to translate. Year + tagline confirmed by client.
2. Bento grid (`2fr 1fr` / `1fr 1fr 1fr` asymmetric): featured arrangement (arched), Subscriptions pitch, live "Delivering today" status with breathing dot, press marquee.
3. Category strip — 6 horizontally-scrolling category cards.
4. Editorial split — text on storefront left, storefront-arch photo right.
5. Weddings/Events teaser — full-bleed photo + ghost CTA.
6. Newsletter capture + footer.

### 5.2 Shop hub (`/[locale]/shop`)

Editorial header → 6 category mosaic tiles (varied sizes) → "Newest arrivals" 12-product grid with sticky filter bar.

### 5.3 Category page (`/[locale]/shop/[category]`)

Compact header → **sticky filter bar** with chips (occasion, color, size, price, same-day) + sort dropdown — same component as on the shop hub, becomes sticky once the grid enters the viewport → `1 / 2 / 3` column grid (allowed for browsing — taste-skill bans 3-column only on the homepage feature row). Bloom hover. Empty filter state designed.

### 5.4 PDP (`/[locale]/product/[slug]`)

Asymmetric split:
- Left 60%: sticky image stack (primary, alts, contextual).
- Right 40%: eyebrow (mono category), name (PP Editorial), price (mono), 2-sentence blurb, size chips (Standard / Grand / Diva — affects price), vase upgrade toggle, delivery date picker (with cutoff), card message textarea (200 chars), arched primary "Add to bag", accordion (Stems & care / Substitution / Delivery zones).
- Below: "Pairs well with" 4-product strip + "From our journal" tile.
- All states: loading skeleton matching layout, sold-out variant, delivery-zone-error.

### 5.5 Cart drawer (global)

Slide-in from right. Backdrop blur with 1px inner border + inner shadow (taste-skill liquid glass). Lines (thumb, name, size, price, qty stepper, remove), subtotal, "Calculated at checkout" note, CTA. Empty state designed in EN/ES.

### 5.6 Checkout (`/[locale]/checkout`)

3-step accordion (one open at a time): Contact → Delivery → Payment.
- Contact: email + phone.
- Delivery: address (plain inputs in v1; Google Places-ready), delivery date + time-window radio cards, recipient info, gift card message confirm.
- Payment: `<PaymentStub />` placeholder for `<PaymentElement />`. `submitOrder()` returns mock order ID after 800ms.
- Sticky order summary on `lg:`.

### 5.7 Weddings (`/[locale]/weddings`)

- Full-bleed `min-h-[100dvh]` hero with arch-install photo. Overlay PP Editorial display, single arched CTA "Inquire."
- Scroll-snapping process strip (Discover · Design · Install · Memory) — desktop horizontal hijack, mobile single-column.
- Masonry portfolio (12 photos, varied aspects, lightbox).
- Pricing intent — no fixed prices: *"Full-service installations from $X. Bouquets from $Y."*
- Inquiry form: couple names, date picker, venue, guest count, budget radio cards (`5–10k / 10–25k / 25k+ / Open`), vibe textarea, source.
- FAQ accordion with hairline borders.

### 5.8 Events (`/[locale]/events`)

Same template as Weddings, recolored/recopy: corporate hero, process (Brief · Propose · Install · Maintain), use-case grid (Restaurants · Offices · Galleries · Private · Press · Hotels), recurring-contracts pitch, inquiry form variant (company, frequency, budget, brief).

### 5.9 Sympathy (`/[locale]/shop/sympathy`)

Tone-shifted variant of category page with MOTION_INTENSITY: 2.
- Quiet hero: *"When words are not enough."* / *"Cuando las palabras no bastan."*
- Palette restricted to `bone`, `ink`, `mute-700`. No `rouge` or `petal`.
- Product grid uses the same component with `motion: false` on hover and stagger reduced to fade-only.
- Service note block listing major Long Island and Queens funeral homes (data-driven).
- Prominent direct-call CTA: *"Or call us at 516 484 3456"* (mono, larger than usual).
- Discreet care card: staff handles delivery personally.

### 5.10 Story (`/[locale]/story`)

Magazine-style long-form. Pull-quote opener, mixed paragraphs + photos with asymmetric column shifts. Founder portrait. "Our arch" section telling the storefront-arch story with archival-feel photos. Press logos at bottom.

### 5.11 Journal (`/[locale]/journal` + `[slug]`)

Index: zig-zag editorial, large featured top, alternating left/right alignment. Article: long-form, drop cap, `max-w-[68ch]`, pull-quotes, mono captions. MDX in v1, Sanity-shaped for v2.

### 5.12 Contact (`/[locale]/contact`)

Asymmetric. Left: PP Editorial "Visit the studio." + studio info (mono) + static map image with link. Right: short form. Bottom: delivery zone pills + schematic map.

### 5.13 Account (stubbed)

Routes exist (sign-in, sign-up, orders) with forms and empty states wired so swapping in NextAuth/Clerk + Stripe customer is purely additive.

## 6. Data Model

### 6.1 Product

```ts
type Product = {
  id: string
  slug: string
  title: { en: string; es: string }
  category: 'arrangements' | 'bouquets' | 'plants' | 'gifts' | 'sympathy' | 'subscriptions'
  blurb: { en: string; es: string }
  description: { en: string; es: string }
  images: { src: string; alt: { en: string; es: string }; aspect: '4/5' | '1/1' | '16/9' }[]
  variants: { id: string; label: { en: string; es: string }; priceCents: number }[]
  addOns?: { id: string; label: { en: string; es: string }; priceCents: number }[]
  tags: ('new' | 'same-day' | 'staff-pick' | 'seasonal')[]
  occasions: ('birthday' | 'anniversary' | 'sympathy' | 'romance' | 'congrats' | 'just-because')[]
  colorFamily: ('pink' | 'red' | 'white' | 'mixed' | 'green' | 'pastel')[]
  active: boolean
  seo: { title: { en: string; es: string }; description: { en: string; es: string } }
}
```

### 6.2 Inquiry

```ts
type Inquiry = {
  type: 'wedding' | 'event'
  contact: { name: string; email: string; phone: string }
  date?: string; venue?: string; guests?: number
  budgetBand: '5-10k' | '10-25k' | '25k+' | 'open'
  vibe: string
  source?: string
  locale: 'en' | 'es'
  createdAt: string
}
```

### 6.3 Order (Stripe-shaped, stubbed)

```ts
type CartLine = { productId: string; variantId: string; addOnIds: string[]; qty: number }
type DeliveryWindow = { date: string; slot: 'morning' | 'midday' | 'afternoon' | 'evening' }
type Order = {
  id: string
  lines: CartLine[]
  delivery: { recipient: { name: string; phone: string }; address: Address; window: DeliveryWindow; cardMessage?: string }
  contact: { email: string; phone: string }
  totals: { subtotalCents: number; deliveryCents: number; taxCents: number; totalCents: number }
  stripePaymentIntentId?: string
  status: 'pending' | 'paid' | 'preparing' | 'out-for-delivery' | 'delivered' | 'failed'
}
```

## 7. State, i18n, Forms, Stripe

### 7.1 State

| Concern | Where it lives |
|---|---|
| Cart | Zustand + `localStorage` persistence; hydration-safe wrapper. |
| Locale | URL segment (next-intl) + cookie. |
| UI state | Local `useState`. |
| Form state | `react-hook-form` + `zod`. |
| Server fetches | Server Components by default. Magnetic, drawer, filters → isolated `'use client'` leaves. |

### 7.2 i18n

- `next-intl`. `messages/en.json`, `messages/es.json` — flat dot-keys.
- Product copy uses `{ en, es }` shape inside the data layer (not in message bundles).
- `<LocaleSwitcher />` pill toggle, updates URL + cookie.
- `hreflang` + `alternate` URLs in metadata.
- USD currency in both locales; format via `Intl.NumberFormat`.

### 7.3 Forms

- Inquiry, Contact, Newsletter post to `/api/inquiry` (or `/api/newsletter`).
- Server-side `zod` validation (same schema as client).
- Honeypot field + simple in-memory IP rate limit.
- v1 stub: write to `pending-inquiries.json` (gitignored) + console log.
- v2 swap: one-line replacement to call Resend / Postmark with templated email.

### 7.4 Checkout / Stripe

- v1: `<PaymentStub />` placeholder, `submitOrder()` returns fake order ID after 800ms, redirects to confirmation page with frozen cart summary.
- All surrounding flow (validation, error states, success states, confirmation page) is real and final.
- v2 swap: `@stripe/stripe-js` + `@stripe/react-stripe-js`, server-side `paymentIntents.create`, replace `<PaymentStub />` with `<PaymentElement />`. Estimated ~1 day.

### 7.5 Subscriptions (v1 behavior)

Subscription tiers are modeled as `Product` entries with `category: 'subscriptions'` and a `subscription` tag. In v1 they flow through the same cart and checkout as one-off products — the confirmation page simply states *"First delivery on {date}. Future deliveries every {cadence}."* No recurring billing is set up. The PDP for a subscription product shows a cadence selector (Weekly / Biweekly) and a "First delivery date" picker; everything else mirrors a regular PDP. Recurring billing is a v2 swap (Stripe Subscriptions / Billing) that fits inside the existing `<PaymentStub />` boundary without further restructuring.

## 8. Accessibility & SEO

- Keyboard reachable, visible `rouge` focus rings.
- EN+ES alt text on every image.
- Single H1 per page; strict heading hierarchy.
- `prefers-reduced-motion` opts out of all perpetual / magnetic / bloom motion.
- Per-page metadata, OG images, structured data: `Product`, `LocalBusiness`, `BreadcrumbList`.
- `sitemap.xml` and `robots.txt` generated by Next.

## 9. Folder Structure

```
diva-flowers/
├── app/
│   ├── [locale]/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── shop/
│   │   │   ├── page.tsx
│   │   │   └── [category]/page.tsx
│   │   ├── product/[slug]/page.tsx
│   │   ├── cart/page.tsx
│   │   ├── checkout/page.tsx
│   │   ├── order/[id]/confirmation/page.tsx
│   │   ├── weddings/page.tsx
│   │   ├── events/page.tsx
│   │   ├── story/page.tsx
│   │   ├── journal/page.tsx
│   │   ├── journal/[slug]/page.tsx
│   │   ├── contact/page.tsx
│   │   ├── account/(routes)/...
│   │   └── legal/(privacy|terms)/page.tsx
│   ├── api/
│   │   ├── inquiry/route.ts
│   │   ├── newsletter/route.ts
│   │   └── checkout/route.ts
│   ├── layout.tsx
│   ├── globals.css
│   ├── sitemap.ts
│   ├── robots.ts
│   └── opengraph-image.tsx
├── components/
│   ├── brand/         (Wordmark, Arch, Marquee, Grain)
│   ├── nav/           (TopNav, MegaMenu, LocaleSwitcher, CartButton)
│   ├── product/       (Card, Grid, Filters, Sort, ImageStack, AddToBag)
│   ├── home/          (Hero, BentoGrid, CategoryStrip, EditorialSplit)
│   ├── cart/          (Drawer, Line, Empty, Summary)
│   ├── checkout/      (ContactStep, DeliveryStep, PaymentStub, OrderSummary)
│   ├── inquiry/       (WeddingsForm, EventsForm, ContactForm, NewsletterField)
│   ├── motion/        (MagneticButton, BloomImage, StaggerGroup)
│   ├── ui/            (shadcn primitives, customized)
│   └── editorial/     (PullQuote, Figure, ProcessStrip, MasonryGallery)
├── lib/
│   ├── cart-store.ts
│   ├── format.ts
│   ├── analytics.ts
│   ├── stripe.ts
│   └── motion-config.ts
├── data/
│   ├── products.ts
│   ├── journal.ts
│   └── site.ts
├── messages/{en,es}.json
├── types/
├── public/
│   ├── fonts/
│   ├── grain.png
│   └── og/
├── styles/tokens.css
├── docs/superpowers/specs/
├── tests/{e2e,unit}
├── i18n.ts
├── middleware.ts
├── next.config.mjs
├── tailwind.config.ts
├── postcss.config.mjs
├── tsconfig.json
└── package.json
```

## 10. Seed Data (v1)

- 24 products across categories (4 each in arrangements / bouquets / plants / gifts / sympathy + 4 subscription tiers).
- 3 journal articles.
- All copy translated EN/ES.
- Real-feeling product names; no "Acme Bouquet" or generic placeholders (taste-skill rule).
- Believable, organic numbers (e.g., `$187`, not `$199.99`).

## 11. v1 Scope

### Implemented

- All routes from §3 with real layouts and components.
- Bilingual EN/ES across nav, all UI copy, all 24 products, all 3 articles.
- Real cart logic — add/remove/qty, persistence, drawer + full page.
- Real filtering, sorting, search.
- Real form validation + dev-file submission.
- Checkout flow end-to-end with stubbed payment.
- Mobile-responsive; asymmetric layouts collapse cleanly under `md:`.
- Reduced-motion handling, keyboard nav, focus states, alt text.
- SEO metadata, OG images, sitemap, structured data.
- Playwright e2e for critical flows; Vitest for cart/format/zod logic.

### Stubbed (clearly marked, swap-ready)

- Stripe payment (`<PaymentStub />` with TODO).
- CMS (Sanity / Payload) — typed TS data files, future-shape.
- Auth / accounts (NextAuth / Clerk-ready).
- Email send (Resend / Postmark — one function call away).
- Analytics (Plausible / PostHog — drop-in snippet).
- Address autocomplete (Google Places-ready).
- Real product photography (`<ProductImage>` centralizes the swap).

### Out of scope (explicit non-goals for v1)

- Real payment processing, refunds, jurisdictional taxes.
- Customer accounts, order history, saved addresses.
- Inventory / stock tracking.
- Multi-currency.
- Loyalty / referrals.
- Live chat / WhatsApp widget.
- A/B testing infrastructure.

## 12. Definition of Done

- All routes render in EN and ES with no console errors.
- A user can browse → add to cart → "checkout" (stub) → see confirmation.
- A wedding / event / contact inquiry submits successfully and persists to the dev file.
- Lighthouse: ≥ 95 performance / ≥ 100 accessibility on home, catalog, PDP.
- All taste-skill pre-flight checklist items satisfied:
  - Global state used appropriately.
  - Mobile layout collapses guaranteed for asymmetric layouts (`w-full px-4`, `max-w-7xl mx-auto`).
  - `min-h-[100dvh]` everywhere a full-height section is needed (no `h-screen`).
  - All `useEffect` animations have cleanup.
  - Empty / loading / error states present everywhere data is loaded.
  - Cards omitted in favor of negative-space grouping where possible.
  - Perpetual animations isolated in their own memoized client components.
- Playwright e2e green.

## 13. Confirmed Open Items (to resolve before / during implementation)

- **Studio street address** (only `1077` is visible from the photo; need the full street).
- **Founding year** for the marquee (`DESDE 2014` is a placeholder).
- **Tagline copy** for hero (`"Romance, by the stem."` / `"Romance, tallo a tallo."` is a placeholder; client may have an existing brand line).
- **Delivery cutoff time** for same-day (using `2:00 PM` as placeholder).
- **Real product photography** — when available, swap via `<ProductImage>`.

## 14. Next Step

Spec → implementation plan via `superpowers:writing-plans`.
