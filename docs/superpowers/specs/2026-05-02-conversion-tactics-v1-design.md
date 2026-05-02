# Conversion tactics v1 — Diva Flowers

**Date:** 2026-05-02
**Status:** approved structure, content for review
**Owner:** Santiago
**Phase:** 2 of 2 (implementation spec, follows the audit at `2026-05-02-conversion-neuromarketing-audit.md` §8)

---

## §1 Summary and scope

Implements the six tactics shortlisted in the audit, deliverable as a single coordinated PR sequence. All six respect the "refined-but-persuasive" tone agreed in brainstorming: real data, no manufactured scarcity, no countdown theatrics in editorial surfaces.

### In scope

1. **Same-day cutoff system** — a single time-aware helper layer (`lib/conversion/cutoff.ts`) plus three surface components (`CutoffCountdown`, `CutoffPill`, `CutoffReminderRow`). Mounted on the PDP configurator, the cart drawer, the `/cart` page, and the `OrderSummarySticky` in checkout. Server-rendered placeholder hydrates to live ticking.
2. **PDP social-proof block** — a new server component `PdpReviewsBlock` rendered above `PdpConfigurator`. Surfaces `REVIEWS_AGGREGATE`, occasion-matched count, and two best-fitting review quotes. Falls back to global aggregate when no occasion match.
3. **Anchor-pricing variants on top 12 products** — extends `data/products.ts` for the 12 highest-priority products with a Standard / Lush / Opulent triad. Default selection in `PdpConfigurator` becomes the middle variant (`lush`). `ProductCard` "From" pricing auto-reflects via existing `startingPriceCents`.
4. **Cart drawer "Complete the gift" upsell strip** — new `CartUpsellStrip` component placed between cart line items and `CartSummary`. Reads from a new curated set of *gift-extras* products (premium card, vase upgrade, mini chocolates, ribbon) added to `data/products.ts` with category `gifts` and a new `giftExtra: true` flag, addable as standalone cart lines.
5. **Gift-confidence assurance bar** — single component `GiftAssuranceBar` with three icons (hand-built today · free re-do · photo on delivery), rendered in three places (PDP below configurator, cart drawer above CTA, checkout sticky bottom). Size variant per placement.
6. **Confirmation reciprocity card** — new client component `ReciprocityCard` on `ConfirmationView`. Two slots: referral incentive (deterministic `DIVA-XXXXXX` code derived from order ID, copy-to-clipboard) + subscription nudge (shown only when the order contains zero subscription items). Both are stubbed at the storage layer for v2.

### Out of scope (with justification)

- **Email-based referral / abandoned-cart flows** — depends on Resend/Postmark integration. Flagged for v2; the `ReciprocityCard` referral code is locally generated and copy-paste only in v1.
- **Real referral redemption ledger** — needs a DB. The code is presentational in v1; redemption logic is v2.
- **Analytics events / A/B bucketing** — depends on Plausible/PostHog. The audit listed events to fire in §9.3 of the audit; we add `data-conv-event` attributes throughout so the wiring is mechanical when analytics ship.
- **"Same-day eligible" filter chip pinned by default** — recommended #7 in the audit. Out of this v1 to keep PR coordination low; planned as a fast-follow.
- **Sticky mobile Add-to-bag bar** — strong candidate, deferred to v1.1.
- **Photo-on-delivery as a real flow** — the *promise* is in the assurance bar; the mechanism (camera, MMS, S3) is v2.
- **Subscription nudge that pre-fills cart with a real subscription product** — in v1 the nudge links to the subscriptions page; deep-link with pre-selection is v2.
- **Anchor pricing beyond the top 12 products** — Maky picks the 12 (see §7 rollout). Remaining catalog stays single-variant until proven out.
- **Sympathy-mode tonal re-anchoring of the cutoff** — covered as a small variant of `CutoffCountdown` (gentler copy when `motionMode === "sympathy"`), not a separate tactic.

### v2 hooks (annotated throughout)

Wherever a v1 placeholder will swap for a v2 integration, the spec marks it `// V2-HOOK:` and the relevant `lib/conversion/*.ts` exports a typed boundary so the swap is one-file. List collected in §8.

---

## §2 Architecture and files

```
lib/conversion/
  cutoff.ts                  — new: pure time math + status type (server-safe)
  use-cutoff.ts              — new: client hook ticking every 60s, hydration-safe
  reviews-match.ts           — new: pure matcher mapping Review.occasion → Occasion type
  upsell-catalog.ts          — new: curated gift-extras id list + getter helpers
  referral-code.ts           — new: deterministic code derivation from order id
  types.ts                   — new: CutoffStatus, ReviewMatch, UpsellSuggestion, ReciprocityCard*
  events.ts                  — new: data-conv-event attribute names (the v2 analytics surface)

components/conversion/
  CutoffCountdown.tsx        — new: full banner variant (PDP)
  CutoffPill.tsx             — new: compact pill variant (cart drawer header, TopNav-ready)
  CutoffReminderRow.tsx      — new: inline row variant (OrderSummarySticky, /cart)
  GiftAssuranceBar.tsx       — new: three-icon strip with size="sm" | "md" | "lg"
  PdpReviewsBlock.tsx        — new: server component, occasion-matched aggregate + 2 quotes
  CartUpsellStrip.tsx        — new: client, reads cart-store, suggests gift-extras
  ReciprocityCard.tsx        — new: client, referral + subscription-nudge composite

components/product/
  PdpConfigurator.tsx        — edited: default variant = "lush" when present; data-conv-event hooks
  VariantChips.tsx           — edited: render anchor labels with priceCents below each chip
  ProductCard.tsx            — edited: zero changes to logic; verified compatibility with new variants

components/cart/
  CartDrawer.tsx             — edited: insert CutoffPill in header, CartUpsellStrip above summary,
                              GiftAssuranceBar size="sm" above checkout CTA
  CartPageList.tsx           — edited: insert CutoffReminderRow + CartUpsellStrip
  CartSummary.tsx            — unchanged

components/checkout/
  OrderSummarySticky.tsx     — edited: CutoffReminderRow at top, GiftAssuranceBar size="sm" at bottom,
                              "Hand-built today by Maky" line under totals
  CheckoutShell.tsx          — unchanged
  ConfirmationView.tsx       — edited: ReciprocityCard mounted below totals aside

app/[locale]/product/[slug]/page.tsx
                             — edited: render PdpReviewsBlock above PdpConfigurator,
                              GiftAssuranceBar size="md" below configurator

data/
  products.ts                — edited: anchor variants on 12 selected products,
                              new gift-extra products (gift-vase, gift-card-premium,
                              gift-ribbon, gift-chocolates)
  gift-extras.ts             — new: hand-curated suggestion logic (occasion → recommended extras)

messages/
  en.json, es.json           — edited: new namespace conversion.* with all microcopy

types/product.ts             — edited: optional giftExtra?: boolean on Product
```

### Boundaries

- `lib/conversion/cutoff.ts` is **pure and isomorphic**: only `Date` math, no DOM, no `Intl` formatting (formatting lives in components for locale awareness). Server can pre-render with the request's `now`; client re-renders with a hydration-safe placeholder.
- `lib/conversion/use-cutoff.ts` is **client-only**, returns `null` on first render, hydrates to live status, then ticks at 60s intervals via `setInterval`. Honors `useReducedMotion` (no animated digit roll on reduce; the value still updates, but plainly).
- `lib/conversion/reviews-match.ts` is pure; takes the `REVIEWS` array and an `Occasion`, returns `{ aggregate, matchingReviews }`.
- `components/conversion/*` are leaf components owning their own visual state; data flows in via props.
- `CartUpsellStrip` reads `useCartStore` directly (it's the only component that needs to know about the cart for upsell logic) and writes via the existing `add` action. Does not introduce a new store.
- `ReciprocityCard` reads from `Order` (passed as prop, not from a hook) so it remains testable in isolation.

### New dependencies

None. The existing stack (next-intl, framer-motion, zustand, react-hook-form, zod, @phosphor-icons/react) covers all six tactics.

### Naming

The directory is `lib/conversion/` and the i18n namespace is `conversion.*` to keep these tactics legible as a unit (vs scattering helpers in `lib/`). If/when more tactics ship, they live there.

---

## §3 Per-tactic specifications

### 3.1 Same-day cutoff system

**Principle applied.** Honest scarcity (real cutoff, real consequence) + loss aversion (framing the cutoff as something *about to be lost*).

**Behavior.** A single time-aware helper computes one of three statuses:

- `before` — current time is before today's cutoff. Shows "Order in the next *Xh Ym* for delivery this afternoon."
- `closing-soon` — within the last 30 minutes before cutoff. Same copy + a subtle pulse (no countdown digits flashing red — we don't do that). Switches to `motion: pulse` only outside of reduce-motion.
- `after` — past today's cutoff. Shows "Same-day delivery has closed for today. Order anytime — next available: *tomorrow afternoon.*" No alarm tone, no count.

**Why a 60-second tick (not 1-second).** Second-precision countdowns read as pressure tactics and conflict with brand. Minute-precision is honest, calm, and saves re-renders.

**Surfaces and variants.**

| Surface | Component | Visual |
|---------|-----------|--------|
| PDP, above configurator | `<CutoffCountdown />` | Full row, eyebrow + line, takes the space of one input |
| Cart drawer header | `<CutoffPill />` | Compact pill on the right of the header |
| `/cart` page | `<CutoffReminderRow />` | Inline row above the cart list |
| Checkout `OrderSummarySticky` | `<CutoffReminderRow />` | Inline row at the top of the aside |

**Sympathy variant.** When the host page passes `tone="sympathy"`, copy softens:
- `before` → "We can deliver as early as this afternoon if you order in the next *Xh Ym*."
- `after` → "Earliest delivery is tomorrow afternoon."

**Copy (EN / ES) — `messages/*.json` keys under `conversion.cutoff.*`:**

```json
{
  "before_label": "Same-day delivery",
  "before_body": "Order in the next {time} for delivery this afternoon.",
  "before_label_sym": "Earliest delivery",
  "before_body_sym": "We can deliver as early as this afternoon if you order in the next {time}.",
  "after_label": "Same-day closed",
  "after_body": "Next available: tomorrow afternoon. Order anytime.",
  "after_body_sym": "Earliest delivery is tomorrow afternoon.",
  "time_hours_minutes": "{h}h {m}m",
  "time_minutes": "{m}m"
}
```

**ES:**

```json
{
  "before_label": "Entrega hoy",
  "before_body": "Pídelo en los próximos {time} y entra por su puerta esta tarde.",
  "before_label_sym": "Entrega más temprana",
  "before_body_sym": "Podemos entregar esta tarde si lo pides en los próximos {time}.",
  "after_label": "Same-day cerrado",
  "after_body": "Siguiente entrega: mañana por la tarde. Puedes ordenar a cualquier hora.",
  "after_body_sym": "La entrega más temprana es mañana por la tarde.",
  "time_hours_minutes": "{h}h {m}m",
  "time_minutes": "{m}m"
}
```

**States.**
- **SSR / first paint** — render `before_label` + a non-ticking dash for the time value. Avoids layout shift; explicit placeholder (`—`) is calmer than skeleton shimmer.
- **Hydrated, before cutoff** — live `Xh Ym` ticking at 60s.
- **Hydrated, last 30min** — same copy, optional pulse on the eyebrow dot (only if `!useReducedMotion`).
- **Hydrated, after cutoff** — `after_*` copy.
- **Cutoff crossed during session** — the next tick swaps the state. No transition animation; the copy quietly changes. We do *not* fire a toast — that would be theatrical.

**Data.** `cutoff` is already present in the PDP via `app/[locale]/product/[slug]/page.tsx` reading `SITE.cutoff` (verify at implementation; if not in `SITE`, add `SITE.cutoff = "14:00"`). Cart drawer and checkout read the same constant directly.

**Accessibility.**
- The countdown is wrapped in `<p aria-live="polite">` so screen-reader users hear the state when it changes (NOT every minute — we use `aria-live="polite"` and only `aria-atomic` when the *status* changes, not when the time updates).
- Color contrast: eyebrow is `text-mute-500`, body is `text-ink/85`, both pass WCAG AA over `bg-bone`.
- `useReducedMotion` disables the pulse animation in `closing-soon`.

**Mobile vs desktop.** Same component, same copy. On mobile the `CutoffCountdown` PDP variant collapses the eyebrow + body into a single line if the viewport is narrow.

**Success metric (v2 with analytics).** Conversion rate uplift on PDP with cutoff visible vs control. Event `cutoff_status` (status, minutesRemaining_bucket).

---

### 3.2 PDP social-proof block

**Principle applied.** Social proof + authority. Occasion-matching makes the proof situation-relevant ("did this work for someone like me, sending for the same reason?").

**Behavior.** Above the `PdpConfigurator`, render a block:

```
★ ★ ★ ★ ★   4.9 / 127 reviews
"The most beautiful flowers I have ever received…"  — Charlotte S.
"Maky was amazing! She made my wedding day look so beautiful."  — Samantha B.
                              [ Read all 127 reviews on Google → ]
```

When the product has at least one occasion, prefer reviews matching that occasion. Otherwise fall back to global highest-rated.

**Matching logic (`lib/conversion/reviews-match.ts`).** Reviews use Spanish occasion strings (`"Boda"`, `"Cumpleaños"`); the `Occasion` type uses English keys. Map both ways:

```ts
// Note: review.occasion strings are loose Spanish labels. The map below is approximate;
// "Boda" (wedding) maps to retail "anniversary" because Diva does not sell standalone wedding
// products in the catalog (weddings are inquiry-only) — anniversary is the closest celebratory
// retail category and the proof signal still applies. Maky reviews and adjusts.
const OCCASION_MAP: Record<string, Occasion> = {
  Boda: "anniversary",
  Cumpleaños: "birthday",
  // ... extensible: add new values as new review.occasion strings appear
};

export function matchReviews(reviews: Review[], occasions: Occasion[]):
  { matched: Review[]; aggregateMatchedCount: number; usedFallback: boolean }
```

Fallback rule: if `matched.length < 2`, return the global top-rated reviews and `usedFallback: true`. The block displays "from 47 anniversary buyers" only when `usedFallback === false`.

**Component contract.**

```ts
type Props = {
  product: Product;
  locale: Locale;
};

// Server component; reads REVIEWS, REVIEWS_AGGREGATE; emits structured-data <script> only
// when not already emitted by PdpStructuredData (avoid duplicate JSON-LD).
```

**Copy (`conversion.reviews.*`):**

```json
{
  "rating_aggregate": "{rating} / {total} reviews",
  "rating_aggregate_matched": "{rating} from {count} {occasion} buyers",
  "read_all_cta": "Read all {count} reviews on Google",
  "anniversary": "anniversary",
  "birthday": "birthday",
  "sympathy": "sympathy",
  "romance": "romance",
  "congrats": "congratulations",
  "just_because": "just-because"
}
```

**ES:**

```json
{
  "rating_aggregate": "{rating} / {total} reseñas",
  "rating_aggregate_matched": "{rating} de {count} compradores para {occasion}",
  "read_all_cta": "Lee las {count} reseñas en Google",
  "anniversary": "aniversario",
  "birthday": "cumpleaños",
  "sympathy": "condolencias",
  "romance": "romance",
  "congrats": "felicitaciones",
  "just_because": "porque sí"
}
```

**States.**
- Always-on. There is no loading state — `REVIEWS` is static at build time.
- When `matched.length === 0` and global aggregate has zero reviews → component returns `null`. Defensive only; never expected.

**Accessibility.**
- Stars rendered as text glyphs with `aria-label="Rated 4.9 out of 5 stars"` on the wrapper.
- Quotes in `<blockquote>` with `<cite>` for the author.
- Link to Google reviews is `<a target="_blank" rel="noreferrer">` with descriptive text.

**Mobile.** Stack vertically. Two quotes stay; if viewport is below `sm`, show one quote + "+1 more" toggle.

**Success metric (v2).** PDP-to-add-to-bag rate, PDP scroll depth past the reviews block.

---

### 3.3 Anchor-pricing variants

**Principle applied.** Anchoring + center-stage effect. A single price triggers evaluation; three prices trigger comparison, and the middle option becomes the default choice ~60% of the time.

**Behavior.** Top 12 products (see §7 for selection process) gain three variants:

- `standard` — ~75% of current price
- `lush` — current price (becomes the new default)
- `opulent` — ~135% of current price

`PdpConfigurator` defaults to `lush` when it exists. `ProductCard` "From" price auto-reflects the lowest variant via the existing `startingPriceCents` helper — no logic change required.

**Variant labeling (`messages/*.json` under `conversion.variants.*`):**

```json
{
  "standard": "Standard",
  "lush": "Lush",
  "opulent": "Opulent",
  "most_popular": "Most popular",
  "delta_more_stems": "+{percent}% more stems",
  "delta_smaller": "Lower stem count, same care"
}
```

**ES:**

```json
{
  "standard": "Clásico",
  "lush": "Generoso",
  "opulent": "Opulento",
  "most_popular": "Más popular",
  "delta_more_stems": "+{percent}% más tallos",
  "delta_smaller": "Menos tallos, mismo cuidado"
}
```

**Visual on the variant chip.** `VariantChips` extends to optionally show:
- Variant label
- Price (already shown for some chips? verify in component) — added if not present
- A small "Most popular" eyebrow above the middle (`lush`) chip
- A delta line below the chip on hover/focus (e.g. "+30% more stems"): only if the product carries a `deltaCopy` in its variant metadata. We don't auto-generate this — Maky writes it.

**Data shape change.** The existing type `ProductVariant` already supports `id`, `label`, `priceCents`. We extend with optional `subtitle?: Localized` for the delta copy, keeping back-compat:

```ts
export type ProductVariant = {
  id: string;
  label: Localized;
  priceCents: number;
  subtitle?: Localized;   // new, optional
};
```

For the 12 chosen products, `data/products.ts` updates from:

```ts
variants: [{ id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 25500 }],
```

To:

```ts
variants: [
  { id: "standard", label: { en: "Standard", es: "Clásico" }, priceCents: 19500,
    subtitle: { en: "Lower stem count, same care", es: "Menos tallos, mismo cuidado" } },
  { id: "lush", label: { en: "Lush", es: "Generoso" }, priceCents: 25500 },
  { id: "opulent", label: { en: "Opulent", es: "Opulento" }, priceCents: 34500,
    subtitle: { en: "+35% more stems, larger vase", es: "+35% más tallos, jarrón más grande" } },
],
```

**Default selection.** `PdpConfigurator` line 21 currently does `useState(product.variants[0]?.id ?? "")`. Replace with:

```ts
const defaultVariantId = useMemo(() => {
  const middle = product.variants.find((v) => v.id === "lush");
  return middle?.id ?? product.variants[0]?.id ?? "";
}, [product]);
const [variantId, setVariantId] = useState(defaultVariantId);
```

**States.**
- Single-variant product (any not in the top 12) — no behavior change. `VariantChips` shows the single chip as today.
- Three-variant product — middle is selected by default and visually marked "Most popular".
- Variant chip for `lush` is visually distinguished (eyebrow above + slightly larger weight); cannot mark as "default" via text alone — the visual treatment carries it.

**Accessibility.**
- Chips remain `<button>` with `aria-pressed`.
- "Most popular" eyebrow is a `<span>` with `aria-hidden` (the `aria-pressed` already conveys selection state).
- Subtitle is rendered as `<small>` below the chip.

**Mobile.** Three chips wrap on small viewports. The "Most popular" eyebrow becomes a corner badge to save vertical space.

**Success metric (v2).** Average Order Value, % of orders selecting middle vs other variants, abandonment rate.

---

### 3.4 Cart drawer "Complete the gift" upsell strip

**Principle applied.** Reciprocity (small additions feel like care, not extraction) + the lowest-friction upsell moment in the funnel (intent is high, decision was just made, friction to add is one click).

**Behavior.** Between the cart line items list and `CartSummary`, render a horizontal strip:

```
Complete the gift
[ ★ Premium card · +$5  ]  [ Glass vase upgrade · +$15 ]  [ Mini chocolates · +$8 ]
```

Each chip is `<button>` that on click adds the gift-extra as a new cart line. After add, the chip becomes "Added ✓" for 2 seconds, then disappears from the strip. If all three are added, the strip hides itself.

**Why standalone products, not addOns on existing items.** Three reasons:
1. The add-on system on `Product.addOns` is per-arrangement (vase, ribbon, card *for this arrangement*). Drawer-level upsells need to be order-level.
2. Standalone products keep the cart accounting clean (each line has one product, one variant, one price).
3. They become tracked, sellable, and can appear standalone (e.g., "send a vase later") without architecture changes.

**New gift-extra products in `data/products.ts`.** Four hand-curated, all with `category: "gifts"` and a new optional flag `giftExtra: true` so they're filterable and excluded from `/shop` browsing (they're not buy-alone-worthy):

```ts
{
  id: "x-card-premium",
  slug: "premium-card",
  giftExtra: true,
  title: { en: "Premium handwritten card", es: "Tarjeta escrita a mano premium" },
  // single variant, single price (~$5)
  // small image, copy emphasizes Maky's actual handwriting
}
{
  id: "x-vase-upgrade",
  slug: "glass-vase-upgrade",
  giftExtra: true,
  title: { en: "Glass vase upgrade", es: "Mejora a jarrón de vidrio" },
  // ~$15
}
{
  id: "x-ribbon-silk",
  slug: "silk-ribbon",
  giftExtra: true,
  title: { en: "Silk ribbon", es: "Listón de seda" },
  // ~$6
}
{
  id: "x-chocolates-mini",
  slug: "mini-chocolates",
  giftExtra: true,
  title: { en: "Mini chocolates (4 pieces)", es: "Mini chocolates (4 piezas)" },
  // ~$8
}
```

**Type change in `types/product.ts`:**

```ts
export type Product = {
  // ...existing fields
  giftExtra?: boolean;   // new, optional
};
```

**Required catalog-filter edits** (gift-extras must not appear in the regular catalog):
- `app/[locale]/shop/page.tsx` — exclude `p.giftExtra === true`
- Any category page rendering `PRODUCTS.filter(...)` — add the same exclusion
- `data/product-helpers.ts` if it exposes a public list — add a typed accessor `getShoppableProducts()` that filters them out, callers migrate to it
- `getPairsWith(product)` — exclude gift-extras from cross-sell results

Implementation should grep for `PRODUCTS.filter` and `PRODUCTS.map` across `app/`, `components/`, `data/` and audit each call site.

**Suggestion logic (`data/gift-extras.ts`).**

```ts
import type { Occasion } from "@/types/product";

export const GIFT_EXTRA_IDS = ["x-card-premium", "x-vase-upgrade", "x-ribbon-silk", "x-chocolates-mini"];

const PRIORITY_BY_OCCASION: Record<Occasion, string[]> = {
  romance:      ["x-card-premium", "x-chocolates-mini", "x-vase-upgrade"],
  anniversary:  ["x-card-premium", "x-chocolates-mini", "x-vase-upgrade"],
  birthday:     ["x-chocolates-mini", "x-card-premium", "x-vase-upgrade"],
  sympathy:     ["x-card-premium", "x-vase-upgrade"],         // no chocolates, no ribbon
  congrats:     ["x-card-premium", "x-chocolates-mini", "x-ribbon-silk"],
  "just-because": ["x-card-premium", "x-vase-upgrade", "x-chocolates-mini"],
};

export function suggestExtrasForCart(cartLines: CartLine[]): string[] {
  // 1. Collect occasions across cart products
  // 2. Take union of priority lists (preserve order)
  // 3. Filter out extras already in cart
  // 4. Cap at 3
}
```

This is the single source of truth — never inline the priority list.

**Copy (`conversion.upsell.*`):**

```json
{
  "title": "Complete the gift",
  "added_label": "Added",
  "add_aria": "Add {item} for {price}"
}
```

**ES:**

```json
{
  "title": "Completa el regalo",
  "added_label": "Agregado",
  "add_aria": "Agrega {item} por {price}"
}
```

**States.**
- **Default** — strip with up to 3 chips.
- **One added** — chip shows `Added ✓` for 2s, then removes itself, strip continues with remaining.
- **All added or all already in cart** — the entire strip is `null`.
- **Cart empty** — cart drawer shows `CartEmpty`; strip never renders.
- **Sympathy-only cart** — strip uses sympathy-priority list (no chocolates/ribbon), max 2 chips.

**Accessibility.**
- Each chip is `<button>` with descriptive `aria-label="Add Premium card for $5"`.
- After add, an `aria-live="polite"` region announces "Added Premium card to bag."
- Focus stays on the chip (which becomes "Added") for the 2s before unmount; on unmount, focus moves to the next chip or the next focusable in the drawer.

**Mobile.** Horizontal scroll, scroll-snap, with a fade gradient on the right edge to signal scrollability. No left-edge gradient (would imply hidden left content).

**Motion.** Chip add → existing cart line uses the standard line-enter animation (already present in `CartDrawer`). Chip "Added" state crossfades the label only, not the whole chip. Honors `useReducedMotion`.

**Success metric (v2).** AOV uplift in sessions where the strip rendered, per-extra add rate.

---

### 3.5 Gift-confidence assurance bar

**Principle applied.** Gift anxiety reduction. Three icons addressing the three biggest fears in one row: "is it real?", "what if she doesn't like it?", "how do I know it arrived?".

**Behavior.** A horizontal three-icon strip:

```
🌿  Hand-built today        ↺  Free re-do if it's our miss        📍  Long Island florist since 2014
```

(Icons via `@phosphor-icons/react`: `Leaf`, `ArrowsCounterClockwise`, `MapPin`. Already in stack.)

**Note on the third icon.** The original audit proposed "Photo on delivery" as the third assurance. After confirming with Maky, photo-on-delivery is not part of the current operation, so we substitute the authority signal "Long Island florist since 2014" — already a strong trust marker present in the home hero, now repeated at decision points. If photo-on-delivery becomes operationally feasible later, swap the third icon back to `Camera` with the photo copy.

**Note on re-do framing.** Re-do is conditional ("if it's our miss" — i.e., the problem is on our end, not buyer's remorse). Copy is honest about the condition without listing the legalese; the underlying promise is "we'll make it right when we got it wrong."

**Three placements via `size` prop:**

| Surface | Size | Visual |
|---------|------|--------|
| PDP, below configurator | `md` | Three columns with icon above text, generous spacing |
| Cart drawer, above checkout CTA | `sm` | Three inline rows, compact, single-color icons |
| Checkout `OrderSummarySticky`, below totals | `sm` | Same as cart drawer, slightly tighter |

**Component contract.**

```ts
type Props = {
  size?: "sm" | "md" | "lg";
  surface: "pdp" | "cart" | "checkout";  // for analytics + minor copy variants
  locale: Locale;
};
```

**Copy (`conversion.assurance.*`):**

```json
{
  "hand_built_title": "Hand-built today",
  "hand_built_body": "Cut this morning, arranged by Maky.",
  "redo_title": "Free re-do if it's our miss",
  "redo_body": "Anything not right on our end, we make it again.",
  "local_title": "Long Island florist since 2014",
  "local_body": "Real shop on Willis Ave. We deliver what we make."
}
```

**ES:**

```json
{
  "hand_built_title": "Hecho hoy a mano",
  "hand_built_body": "Cortado esta mañana, armado por Maky.",
  "redo_title": "Lo rehacemos gratis si fue error nuestro",
  "redo_body": "Si algo salió mal de nuestro lado, lo hacemos de nuevo.",
  "local_title": "Florista de Long Island desde 2014",
  "local_body": "Tienda real en Willis Ave. Entregamos lo que hacemos."
}
```

**States.**
- Always-on, no loading, no variants per state.
- `size="sm"` shows only the title (drops the body for compact placement).
- `size="md"` shows both title and body.

**Accessibility.**
- Icons are `aria-hidden`; text carries semantics.
- The strip is `<ul role="list">` with three `<li>` children for screen-reader navigation.
- Color contrast: icons in `text-rouge` over `bg-bone` pass AA.

**Mobile.** `md` collapses to vertical stack of three rows; `sm` stays horizontal but icons shrink.

**Brand fit.** Icons use the existing brand color (`text-rouge`), not generic green. No emoji. Title in display font, body in sans, matching component conventions.

**Success metric (v2).** PDP-to-add-to-bag rate, checkout abandonment rate at the payment step.

---

### 3.6 Confirmation reciprocity card

**Principle applied.** Reciprocity (offer something to the buyer at the highest-trust moment) + LTV anchoring (subscription nudge converts one-off buyers).

**Behavior.** On `ConfirmationView`, below the totals aside, render a card with two stacked sections:

**Section A — Referral.** Always shown.

```
Send a friend $20.
Get $20 toward your next arrangement.

   [ DIVA-A4F2C9 ]   Copy code
```

The code is **deterministically derived** from `order.id` via `lib/conversion/referral-code.ts`:

```ts
export function deriveReferralCode(orderId: string): string {
  // Take last 6 alphanumeric chars of orderId, uppercase, prefix DIVA-
  const tail = orderId.replace(/[^a-zA-Z0-9]/g, "").slice(-6).toUpperCase();
  return `DIVA-${tail}`;
}
```

Pure function, no DB. v2 connects this to a real ledger (`// V2-HOOK: replace with deriveReferralCode(orderId, db)`).

Click "Copy code" → uses `navigator.clipboard.writeText(code)`, shows "Copied!" for 2s.

**Section B — Subscription nudge.** Shown only when `order.lines.every(l => /* product is not subscription */)`.

```
Loved sending this?

Weekly arrangements at her door, hand-built fresh every Thursday.
Pause anytime. Skip a week. Cancel in two clicks.

   [ See subscriptions → ]
```

CTA links to `/${locale}/shop?category=subscriptions`. Deep-linking to a specific subscription with pre-selection is v2.

**Component contract.**

```ts
type Props = {
  order: Order;       // full order, used for referral code derivation + subscription detection
  locale: Locale;
};
```

**Copy (`conversion.reciprocity.*`):**

```json
{
  "referral_eyebrow": "Refer a friend",
  "referral_title": "Send a friend $20.",
  "referral_body": "Get $20 toward your next arrangement when they order.",
  "referral_copy_cta": "Copy code",
  "referral_copied": "Copied!",
  "subscription_eyebrow": "Stay in bloom",
  "subscription_title": "Loved sending this?",
  "subscription_body": "Weekly arrangements at her door, hand-built fresh every Thursday. Pause anytime. Skip a week. Cancel in two clicks.",
  "subscription_cta": "See subscriptions"
}
```

**ES:**

```json
{
  "referral_eyebrow": "Invita a un amigo",
  "referral_title": "Regala $20 a un amigo.",
  "referral_body": "Recibe $20 para tu próximo arreglo cuando lo use.",
  "referral_copy_cta": "Copiar código",
  "referral_copied": "¡Copiado!",
  "subscription_eyebrow": "Sigue floreciendo",
  "subscription_title": "¿Te gustó enviarlo?",
  "subscription_body": "Arreglos semanales en su puerta, hechos cada jueves. Pausa cuando quieras. Salta una semana. Cancela en dos clics.",
  "subscription_cta": "Ver suscripciones"
}
```

**States.**
- **Order has zero subscription items** → render both sections (A above B).
- **Order has at least one subscription item** → render section A only.
- **Clipboard not supported** → "Copy code" button shows the code in a tooltip when clicked, with instructions to copy manually. (Defensive — modern browsers all support `navigator.clipboard`.)

**Accessibility.**
- Referral code is in `<code>` with `aria-label="Referral code DIVA-A4F2C9"`.
- "Copy code" button has `aria-live="polite"` for the "Copied!" feedback.
- Subscription nudge CTA is a `<Link>` with descriptive text.

**Mobile.** Stack vertically, each section becomes its own card-like block.

**Persistence.** v1 stores nothing — the user's chance to use the code is now (copy + paste into a message to a friend, or screenshot). v2 emails the code, lists past codes in `/account/referrals`, etc.

**Success metric (v2).** Referral copy rate, subscription nudge click rate, downstream redemption rate.

---

## §4 Data and contracts

### 4.1 Shared types — `lib/conversion/types.ts`

```ts
import type { Locale } from "@/types/locale";
import type { Occasion } from "@/types/product";

export type CutoffStatus = "before" | "closing-soon" | "after";

export type CutoffSnapshot = {
  status: CutoffStatus;
  minutesRemaining: number;   // 0 when status === "after"
  cutoff: string;             // "HH:MM" — echoed back for trace
};

export type ReviewMatch = {
  matched: { id: string; author: string; quote: string; initials: string }[];
  aggregateRating: number;
  aggregateCount: number;     // global count
  matchedCount: number;       // count of reviews matching the occasion (for matched-buyers copy)
  usedFallback: boolean;
  occasionLabel: string | null;  // localized — null when no occasion or fallback
};

export type UpsellSuggestion = {
  productId: string;
  priceCents: number;
  title: string;              // already localized
};
```

### 4.2 Cutoff helpers — `lib/conversion/cutoff.ts`

```ts
import { parseCutoff } from "@/lib/delivery";
import type { CutoffSnapshot, CutoffStatus } from "./types";

const CLOSING_SOON_MIN = 30;

export function snapshotCutoff(now: Date, cutoff: string): CutoffSnapshot {
  const { hour, minute } = parseCutoff(cutoff);
  const c = new Date(now);
  c.setHours(hour, minute, 0, 0);
  const diffMin = Math.floor((c.getTime() - now.getTime()) / 60000);
  let status: CutoffStatus;
  if (diffMin <= 0) status = "after";
  else if (diffMin <= CLOSING_SOON_MIN) status = "closing-soon";
  else status = "before";
  return {
    status,
    minutesRemaining: Math.max(0, diffMin),
    cutoff,
  };
}

// Note: formatting (e.g. "1h 47m") happens in components via i18n keys
// (cutoff.time_hours_minutes / time_minutes), not in this pure module.
// Components compose: { hours: Math.floor(min/60), minutes: min%60 }.
```

### 4.3 Cutoff hook — `lib/conversion/use-cutoff.ts`

```ts
"use client";
import { useEffect, useState } from "react";
import { snapshotCutoff } from "./cutoff";
import type { CutoffSnapshot } from "./types";

export function useCutoff(cutoff: string): CutoffSnapshot | null {
  const [snap, setSnap] = useState<CutoffSnapshot | null>(null);
  useEffect(() => {
    const tick = () => setSnap(snapshotCutoff(new Date(), cutoff));
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [cutoff]);
  return snap;
}
```

Returns `null` on first render → components show their non-ticking placeholder. Hydration-safe.

### 4.4 Reviews matcher — `lib/conversion/reviews-match.ts`

Pure function with the signature in §3.2. Tests live in `tests/unit/conversion/reviews-match.test.ts`.

### 4.5 Upsell catalog — `lib/conversion/upsell-catalog.ts`

Re-exports the priority logic from `data/gift-extras.ts` plus typed accessors that join with `PRODUCTS` for price + title. Keeps `CartUpsellStrip` from importing `data/` directly.

### 4.6 Referral code — `lib/conversion/referral-code.ts`

Pure derivation in §3.6. One test ensuring deterministic output for a given input.

### 4.7 Events — `lib/conversion/events.ts`

```ts
export const CONV_EVENTS = {
  cutoff: { view: "cutoff_view", expired_in_session: "cutoff_expired_in_session" },
  reviews: { view: "pdp_reviews_view", expand: "pdp_reviews_expand" },
  variants: { default_changed: "variant_default_changed" },
  upsell: { view: "cart_upsell_view", add: "cart_upsell_add", dismiss: "cart_upsell_dismiss" },
  assurance: { view: "assurance_view" },
  reciprocity: { referral_copy: "referral_copy", subscription_click: "subscription_nudge_click" },
} as const;
```

Components emit these as `data-conv-event="..."` attributes. v2 wires them to Plausible/PostHog by selector.

### 4.8 No new HTTP endpoints

All six tactics are presentational + local state. No `/api/*` routes added.

---

## §5 Visual + motion guidelines

- **Tokens.** Reuse existing brand tokens: `text-ink`, `text-rouge`, `text-mute-500`, `bg-bone`, `border-ink/10`. New components must not introduce new color or font tokens. Display font for titles, sans for body, mono for the cutoff timer (tabular numerals).
- **Cutoff timer typography.** Mono with `tabular-nums` so digits don't shift width as they tick.
- **Animation.** All ticking, transitions, and "added" feedbacks honor `useReducedMotion`. The "closing-soon" pulse is a 1.6s ease in/out on a small dot, never on text. No flashing or color shifts on digit change.
- **Layout density.** `CutoffCountdown` (PDP) takes one row of vertical space (~64px). `CartUpsellStrip` is ~96px horizontal scroll on mobile, ~80px static row on desktop. `GiftAssuranceBar size="md"` is ~88px. `ReciprocityCard` is two ~120px sections stacked, total ~280px including padding.
- **Conflict prevention.** `BloomImage` and `PetalRain` continue to dominate visual rhythm — none of the new components carry imagery. They are typographic + iconographic only. This keeps the home / catalog hierarchy intact.
- **Sympathy mode.** Anywhere a component receives a tone signal (`tone="sympathy"`), urgency framing softens. Detection: read `product.category === "sympathy"` in the PDP; in cart/checkout, derive from cart lines (`cart.every(l => isSympathy(l))`). When mixed, default tone is non-sympathy.

---

## §6 Testing

### 6.1 Vitest unit (in `tests/unit/conversion/`)

- `cutoff.test.ts` — `snapshotCutoff` table tests:
  - Before cutoff with 1h 47m remaining → `status: "before", minutesRemaining: 107`
  - 25 minutes before → `status: "closing-soon", minutesRemaining: 25`
  - Exactly at cutoff → `status: "after", minutesRemaining: 0`
  - 1 minute past → `status: "after", minutesRemaining: 0`
  - Edge: midnight crossing — undefined behavior expected, document
- `reviews-match.test.ts` — occasion-matching with the existing `REVIEWS` data:
  - Anniversary-tagged product → matches "Boda" reviews
  - Birthday-tagged product → matches "Cumpleaños" reviews
  - Sympathy product with no matching reviews → `usedFallback: true`, returns top-rated
  - Multi-occasion product (e.g., romance + anniversary) → union of matches
- `referral-code.test.ts` — deterministic output, format, length
- `gift-extras.test.ts` — `suggestExtrasForCart`:
  - Romance cart → card, chocolates, vase
  - Sympathy-only cart → card, vase (no chocolates, no ribbon)
  - All extras already in cart → empty
  - Mixed cart (romance + sympathy) → uses non-sympathy priority

### 6.2 Playwright e2e (in `tests/e2e/conversion/`)

- `cutoff.spec.ts` — visit a PDP with a known fixed clock (use `page.clock.install`), assert the cutoff text. Then advance clock past cutoff, assert text changes without page reload.
- `pdp-reviews.spec.ts` — visit a romance PDP, assert review block renders with anniversary-matched count. Visit a sympathy PDP, assert fallback copy is used.
- `anchor-pricing.spec.ts` — visit a top-12 PDP, assert middle variant is selected by default. Click standard, assert price updates, assert add-to-bag works with non-default variant.
- `cart-upsell.spec.ts` — add a romance arrangement to bag, open drawer, assert three chips render in priority order. Click "Premium card", assert it adds as a new line, assert chip becomes "Added", assert chip removes after 2s.
- `assurance-bar.spec.ts` — assert presence on PDP, drawer, and `OrderSummarySticky` with appropriate sizes.
- `reciprocity.spec.ts` — complete a checkout flow with no subscription, assert both sections render. Complete with subscription, assert only referral renders. Click "Copy code", assert clipboard contains the expected code.

### 6.3 Visual regression

Manual on the existing reviewable surfaces. Take screenshots at three viewports (375, 768, 1280) before and after. No automated visual regression added — out of scope.

### 6.4 Accessibility

- `axe` checks added to each new e2e (existing pattern in `tests/e2e/`).
- Manual screen-reader pass on cutoff state transitions, upsell add announcements, and copy-code feedback.

---

## §7 Rollout

### 7.1 Implementation order

The six tactics ship as a coordinated branch with the following internal order — each step is independently mergeable behind a single feature flag (or a feature directory unused until referenced, in v1 we'll use the latter to avoid flag scaffolding):

1. **Foundations** — `lib/conversion/{types,cutoff,use-cutoff,reviews-match,upsell-catalog,referral-code,events}.ts` + tests. No UI yet. Verifies pure logic before any rendering work.
2. **GiftAssuranceBar** — small, isolated, used by three later steps. Land first so subsequent surfaces compose it.
3. **Cutoff system** — `CutoffCountdown`, `CutoffPill`, `CutoffReminderRow`. Mount on PDP first (one surface to verify); add cart drawer + `/cart` + checkout in the same step.
4. **PdpReviewsBlock** — depends on `reviews-match` (step 1). Mount on PDP. Independent of cutoff.
5. **Anchor-pricing variants** — touches `data/products.ts` (12 products), `types/product.ts`, `PdpConfigurator`, `VariantChips`. Largest data change. Maky picks the 12 *before* this step starts.
6. **CartUpsellStrip + gift-extra products** — depends on the four new gift-extra products in `data/products.ts` and `data/gift-extras.ts`. Mount in `CartDrawer` and `CartPageList`.
7. **ReciprocityCard** — depends on the order shape; mount on `ConfirmationView`. Last because it's the lowest-traffic surface.

### 7.2 Maky's pre-implementation decisions (block step 5 only)

The following needs Maky's input *before* step 5 starts. Step 1-4 can proceed in parallel.

- **Which 12 products get anchor pricing?** Default proposal: the 8 catalog imports + 4 staff-pick / new arrivals. Maky confirms or swaps.
- **For each of the 12, what are the Standard / Lush / Opulent prices?** Default: ~75% / 100% / ~135%. Maky tunes per product (some might be flat 80/100/130, others 70/100/150).
- **Subtitle copy per variant** (the "+30% more stems" line). Maky writes for all 12 in EN; Santiago translates to ES.
- ~~**Photo on delivery — promise vs reality.**~~ **Decided 2026-05-02:** Maky does not send photos on delivery. Third assurance icon swapped to "Long Island florist since 2014" (authority signal). Spec §3.5 updated.
- ~~**Free re-do — promise vs reality.**~~ **Decided 2026-05-02:** Re-do is free *when the issue is on Diva's side* (not buyer's remorse). Copy reframed as "Free re-do if it's our miss" / "Lo rehacemos gratis si fue error nuestro" to be honest about the condition. Spec §3.5 updated.

### 7.3 Feature flags

None in v1. Each tactic is small enough to ship without a kill switch. If a problem surfaces, revert is one PR.

### 7.4 What to measure post-launch (without analytics)

Until analytics ship, manual checks:
- Maky reports: did inbound orders mention the photo / re-do promise unprompted? (Indicates the assurance bar is working.)
- Maky reports: any spike in subscription inquiries from one-off buyers? (Reciprocity card.)
- Spot-check: visit production PDPs, confirm cutoff status is accurate at random times of day across timezones.
- Spot-check: open cart drawer, confirm upsell suggestions match expectation for sympathy / romance / mixed carts.

Once analytics ship (v2), the events in §4.7 instrument the rest.

---

## §8 Out-of-scope and v2 hooks

### 8.1 Explicit v2 hooks

Marked `// V2-HOOK:` in code where the swap is mechanical. Catalog:

| Surface | v1 placeholder | v2 swap |
|---------|----------------|---------|
| `lib/conversion/referral-code.ts` | Deterministic from order id | Real ledger insert; return DB-issued code |
| `lib/conversion/events.ts` | Constants only | Wired to `plausible()` or `posthog.capture()` |
| `ReciprocityCard` subscription CTA | Links to `/shop?category=subscriptions` | Deep link to specific subscription with pre-selection |
| `GiftAssuranceBar` third icon | "Long Island since 2014" authority signal | If photo-on-delivery becomes operational, swap back to `Camera` icon + photo copy |
| `CutoffCountdown` per-zone cutoffs | Single `SITE.cutoff` | Per-delivery-zone cutoffs (Brooklyn earlier than Albertson) |
| `PdpReviewsBlock` aggregate | Static `REVIEWS_AGGREGATE` | Live Google Places API pull, cached daily |

### 8.2 Tactics evaluated but not in v1 (from audit §8 / §9)

For traceability, restating what was scored ≥18 in the audit but not picked:

- "Same-day eligible" filter chip pinned by default — strong fast-follow candidate
- Sticky mobile Add-to-bag bar
- "Going out today" live counter on home + nav
- Inquiry-page social proof (different funnel)
- Sympathy daily-limit honest scarcity
- "What happens after submit" preview on inquiry forms
- Occasion-first wedge below the hero
- Maky's pick this week
- "Sort by popular this week"

These are documented as the v1.1 candidate pool. None are blocked by v1; each is its own ~1-2 day implementation.

### 8.3 Hard out-of-scope

These do not belong to this spec at any version:

- **Performance, Core Web Vitals, bundle audit** — separate work
- **SEO content / `seo` field tuning** — Maky owns
- **Brand-voice rewrites of existing copy** — only new microcopy in this spec
- **Wedding/event consultation flow** — separate funnel
- **Account / loyalty mechanics** — depends on real auth + DB

---

## §9 Definition of done

This spec is "done" when:

1. All six tactics are merged to main with passing unit + e2e tests.
2. Assurance bar copy reflects the §7.2 decisions (no photo, conditional re-do) and Maky has signed off on the final EN/ES strings.
3. The 12 anchor-pricing products carry Maky-tuned Standard / Lush / Opulent prices and subtitles.
4. The `messages/{en,es}.json` `conversion.*` namespace is fully populated and reviewed for tone.
5. Manual a11y pass on cutoff transitions, upsell adds, and clipboard feedback.
6. The `data-conv-event` attributes are present on all instrumented elements (verifiable via DOM inspection — no analytics service required to count selectors).

---

## §10 Next step

If approved, invoke `superpowers:writing-plans` to convert this spec into a step-by-step implementation plan organized around §7.1's seven steps, with explicit task lists per step, file-by-file acceptance criteria, and review checkpoints between steps.
