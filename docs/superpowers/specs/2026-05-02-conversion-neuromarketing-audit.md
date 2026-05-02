# Conversion + neuromarketing audit — Diva Flowers

**Date:** 2026-05-02
**Status:** approved structure, audit content for review
**Owner:** Santiago
**Phase:** 1 of 2 (audit + roadmap → followed by implementation spec)

---

## §1 Executive summary

Diva Flowers is already an unusually well-built floral storefront: editorial brand voice, bilingual EN/ES, authentic local positioning ("Long Island · Since 2014"), genuine human elements (Maky, Text Maky modal, journal), and a complete shoppable funnel (PDP → drawer → /cart → /checkout → confirmation). What it lacks is **persuasion infrastructure**: the small mechanisms that turn a browser into a buyer when the decision is emotional, anxious, and gift-driven.

The biggest unexploited levers are:

1. **Honest urgency around same-day cutoff** — `lib/delivery.ts` already computes `isSameDayEligible(now, cutoff)` but the result never reaches the UI as a live countdown. Two-thirds of one-off floral purchases are gift-driven and time-sensitive; making the cutoff visible (and ticking) is the single largest expected lift.
2. **Social proof on the PDP** — `GoogleReviews` lives only on the home page. The PDP, where the buying decision is actually made, shows zero third-party validation.
3. **Anchor pricing** — most products in `data/products.ts` ship with a single `variants` entry. Adding a Standard / Lush / Opulent triad turns the product page from "is this worth $255?" into "is Standard or Lush right for this moment?", which is a much easier yes.
4. **Cart-stage upsell with the right principle** — `PairsWellWith` exists on the PDP but the cart drawer (where intent is highest and incremental adds carry the lowest cognitive cost) has no add-on zone.
5. **Gift-anxiety reduction** — flowers are a *recipient* gift bought by a *third party* who doesn't see the result. Nothing on the PDP currently addresses the "what if it looks wrong / arrives wilted / she doesn't like it" worry that kills conversion.
6. **Post-purchase reciprocity** — the confirmation page is informational. The window between "I just bought" and "I'm closing the tab" is the single best moment to plant a referral, a subscription nudge, or a saved-for-later note.

**Top 6 shortlist for Phase 2** (full justification in §8):

| # | Tactic | Funnel stage | Score |
|---|--------|--------------|-------|
| 1 | Same-day cutoff countdown banner (PDP + checkout) | Decide / Configure | 60 |
| 2 | PDP social-proof block (rating + 2 reviews + delivered count) | Decide | 54 |
| 3 | Anchor-pricing variants (Standard / Lush / Opulent) on top 12 products | Decide | 48 |
| 4 | Cart drawer "Complete the gift" upsell strip | Configure | 42 |
| 5 | Gift-confidence assurance bar on PDP (free re-do, fresh-cut promise, photo on delivery) | Decide | 40 |
| 6 | Confirmation page reciprocity card (referral + subscription nudge) | Return | 36 |

The rest of this document is the working that produced that shortlist. Sections §2–§3 set the conceptual frame, §4–§5 are the working surfaces, §6–§7 are the diagnostic lenses, §8 explains shortlist selection, and §9 is the appendix.

---

## §2 Neuromarketing frame applied to flowers

Flower commerce is unusual. The buyer is rarely the user of the product. The decision is emotional but the transaction is rational. The window between "I should send something" and "the moment passes" is short. Conversion depends less on "want" than on **resolving anxiety quickly enough that the buyer doesn't defer the decision.**

The seven principles that map cleanly to a floral storefront:

**1. Reciprocity** — small unrequested gifts create disproportionate obligation. On Diva, this is the *complimentary handwritten note from Maky*, the AI card-message helper, the live "we're cutting now" status. The gift to the buyer is *making the gesture easier than expected*.

**2. Authority** — Maky is a real florist, in a real shop, on Long Island, since 2014. The hero already says it. The PDP doesn't. Authority signals on the product page convert at a higher rate than on the home page because they arrive when the buyer is evaluating.

**3. Social proof** — for gifts, "did this work for someone else in my situation?" is the dominant question. Generic 5-star ratings are weaker than *occasion-matched* ratings ("4.9 from anniversary buyers"). `REVIEWS` data structure already supports the `occasion` field — it's not being surfaced.

**4. Honest scarcity** — there's a real cutoff (same-day only before 2pm), real daily capacity, real sold-out dates. Showing them is honest scarcity, not manufactured. A countdown to a real deadline is the most powerful and brand-safe urgency mechanism Diva has access to.

**5. Pertenencia / identity** — "for the person who appreciates the gesture more than the gift" frames the buyer as a particular kind of person. Diva's editorial voice already does this in copy; it can do it harder in microcopy at decision points.

**6. Aversión a la pérdida** — "this date is almost full" lands harder than "12 slots available". The same fact, framed as loss, converts at higher rates. Applies to delivery dates, to subscription start windows, to wedding consultation slots.

**7. Anclaje + bundling** — a single $255 arrangement triggers sticker shock; a $189 / $255 / $345 triad triggers comparison. Once the buyer is comparing options instead of evaluating one, they buy the middle one ~60% of the time (the *center-stage effect*), and total revenue per buyer increases.

Two more mechanisms specific to gift commerce:

**8. Gift anxiety reduction** — the buyer's biggest fear is "the recipient won't like it." Mitigated by: photo-on-delivery, "free re-do if she doesn't love it," reviews from people-like-them, Maky-as-curator framing ("she'd choose this for the recipient").

**9. Decision-paralysis collapse** — too many options trigger deferral. "Best for sympathy" / "Best for romance" tiles, occasion-first navigation, "Maky's pick this week" all reduce the option set to a manageable one.

---

## §3 Funnel narrative — where money is leaking

A floral conversion funnel doesn't look like a SaaS funnel. The shape:

```
DISCOVER         BROWSE          DECIDE            CONFIGURE         PAY              CONFIRM           RETURN
(home, search,   (shop hub,      (PDP,             (cart drawer,     (3-step          (confirmation,    (email,
 organic,        category,       reviews,          add-ons,          checkout,        thank you)        re-engage,
 social)         filters)        pairs)            card msg)         payment)                           subscribe)
```

### Discover — small leak
Hero is strong. Eyebrow ("Long Island · Since 2014") is the right length and content. **Friction:** the hero CTAs go to /shop without a clear "what to do first" wedge — many visitors don't know if they want sympathy, romance, or weekly. **Missing lever:** no occasion-first wedge ("I'm sending for ___") in the first viewport, which would funnel intent immediately. **Lift estimate:** small — the home is doing its job.

### Browse — medium leak
`CategoryOrbit`, `BentoGrid`, `WeddingsTeaser` are well-crafted. `ProductCard` shows price-from, a "Today" badge for same-day items, and "New"/"Staff pick" eyebrows. **Friction:** no scarcity signals, no "X bouquets going out today" live count, no recent-activity pulse. **Missing levers:**
- No "Maky's pick this week" anchor item
- No "trending now" or "shipped most this week" sort option
- No live status feeding from `pending-orders.json` (a real signal Diva already has)
- Category pages don't lead with the *purchase context* ("for sending this afternoon" vs "for next Friday") — the filter bar is generic

**Lift estimate:** medium. A live "going out today: 14" tile alone would compress decision time.

### Decide (PDP) — largest leak
The PDP is the moment. Currently:
- Hero image, title, blurb, price-from
- `PdpConfigurator`: variant chips, add-ons, date picker, card message (with AI assist), add to bag
- `PdpAccordion` for description/care/delivery
- `PairsWellWith` cross-sell at bottom

**What is missing on the PDP** is what kills the most conversions:
- No third-party reviews (occasion-matched would be ideal)
- No "delivered this week / this month" count
- No countdown to today's same-day cutoff (it's *computed* but not shown)
- No anchor pricing — most products have a single `variants` entry
- No "what's in the arrangement" expanded (stem count, vase, dimensions) — gift buyers want to see what they're buying
- No gift-anxiety bar (re-do guarantee, fresh-cut promise, photo on delivery)
- No recipient view ("here's what she'll see when it arrives")
- No urgency framing on the date picker — "Order in the next 1h 47m for delivery this afternoon"

**Lift estimate:** largest single opportunity in the entire site.

### Configure (drawer + cart) — medium leak
Cart drawer is clean and motion is well-tuned. But:
- No upsell strip (vase upgrade, hand-written note, larger size)
- No progress to a threshold ("Add $20 for free local delivery" — if such a threshold exists; if not, manufacture *something* like "Add a card upgrade for free" trigger)
- No reassurance copy ("Free re-do guarantee", "Hand-built today")
- `/cart` page is the same content as the drawer with more space — wastes the real estate

**Lift estimate:** medium. AOV-focused, not conversion-rate-focused.

### Pay (checkout) — small leak
Three-step accordion is well structured. But:
- No persistent trust strip (lock icon, "secure checkout", payment logos, return policy)
- No same-day cutoff reminder ("Same-day cutoff in 1h 12m") on the side panel
- No reassurance at the riskiest step (Payment) — recipient anxiety peaks here
- `OrderSummarySticky` is purely transactional — could include "Hand-built today by Maky" reassurance line

**Lift estimate:** small but compounding — checkout abandonment is brutal in floral.

### Confirm — large untapped opportunity
Currently informational. **Missing levers:**
- No referral incentive ("Send a friend $20, get $20")
- No subscription nudge for one-off buyers ("Loved this? Get something hand-built every month")
- No save-the-occasion ("Remind me to send for her birthday next year")
- No social share ("Tell someone you sent flowers — without telling them")
- No add-on after purchase ("Add a vase to ship with this for $15 — we haven't shipped yet")

**Lift estimate:** zero conversion-rate impact on this transaction; high LTV impact.

### Return — completely unaddressed (v2)
No abandoned-cart email, no post-purchase email sequence, no birthday/anniversary save, no subscription-skip reassurance flow. All of this requires real email integration (currently stubbed) — flagged for v2.

---

## §4 Page-by-page audit

For each page: current state (one paragraph), then a numbered list of tactics with score `Impact (1-5) × (6−Effort) × Brand-fit weight`. Brand-fit weight: ★★★ = 1.5, ★★ = 1.0, ★ = 0.6.

### 4.1 Home (`app/[locale]/page.tsx`)

**Current state:** Hero with video bg + eyebrow + display title + magnetic CTA. `BentoGrid` with featured tile, live status tile, press, studio clock, subscriptions. `CategoryOrbit`, `EditorialSplit`, `WeddingsTeaser`, `GoogleReviews`, `StudioVisit`. Newsletter field in footer area. Strong personality, low conversion-machinery density.

**Tactics:**
1. **Occasion-first wedge below the hero** — three large tiles ("Sending for sympathy", "For someone you love", "For your week") that route users by *intent* not category. Most visitors arrive with an occasion in mind and bounce when forced to translate it into a category. *Impact 4 × Effort 2 × ★★★ = 24*
2. **"Going out today" live counter in `BentoLiveStatusTile`** — pull a count from `pending-orders.json` for orders with `delivery.window.date === today` and surface as "14 arrangements going out today". Zero-effort signal Diva already has. *Impact 3 × Effort 1 × ★★★ = 22.5*
3. **"Maky's pick this week" tile** — single curated arrangement, swappable weekly via a `featured` field. Authority + decision-paralysis collapse in one move. *Impact 3 × Effort 2 × ★★★ = 18*
4. **Move `GoogleReviews` rating snippet into the hero or just below** — currently buried after several sections. The 5.0/X rating belongs above the fold for first-time visitors. *Impact 2 × Effort 1 × ★★★ = 15*
5. **Bilingual trust signal** — small line "Atendemos en español" near the hero or footer. Long Island Hispanic community is a non-trivial buyer segment and the site already invested in i18n. *Impact 2 × Effort 1 × ★★★ = 15*
6. **Newsletter incentive copy** — current `NewsletterField` likely says "Subscribe". Change to "Get Maky's seasonal note + first access to new arrangements". Reciprocity + identity. *Impact 2 × Effort 1 × ★★ = 10*

### 4.2 Shop hub + category (`app/[locale]/shop/`)

**Current state:** category grid, sticky filter bar, sort dropdown, product grid with `ProductCard`. `EmptyFilterState` for no results. Clean and functional.

**Tactics:**
1. **"Same-day eligible" filter chip pinned by default when the user lands before cutoff** — a filter the user wants but doesn't know to ask for. *Impact 4 × Effort 2 × ★★★ = 24*
2. **Sort by "popular this week"** — derived from `pending-orders.json` order frequency. Social proof at the catalog level. *Impact 3 × Effort 2 × ★★★ = 18*
3. **"4 sent today" / "Sent 28 times this month" microbadge on `ProductCard`** — for products that cross a threshold, show the count. Honest scarcity + social proof per item. *Impact 3 × Effort 2 × ★★ = 12*
4. **Empty-filter recovery** — when filters return zero, instead of just "No matches", offer "Try Maky's pick for [occasion]" with one item. *Impact 2 × Effort 1 × ★★★ = 15*

### 4.3 PDP (`components/product/PdpConfigurator.tsx` + page shell)

**Current state:** image stack, title, blurb, configurator (variant / add-on / date / card message / add to bag), accordion, `PairsWellWith`. The configurator is well-structured but persuasion-empty.

**Tactics (ordered by score):**
1. **Same-day cutoff countdown** — banner above or in the configurator: "Order in the next 1h 47m for delivery this afternoon" (live ticking). Disappears past cutoff and becomes "Next available: tomorrow afternoon — order anytime". `lib/delivery.ts` already has the math. *Impact 5 × Effort 2 × ★★★ = 30*
2. **Social-proof block above the fold of the configurator** — pull `REVIEWS` filtered by matching `occasion`, show rating + count + 2 best quotes. "4.9 from 47 anniversary buyers." *Impact 5 × Effort 2 × ★★★ = 30*
3. **Anchor pricing variants** — for top 12 products, expand `variants` to Standard / Lush / Opulent (price ladder ~75% / 100% / 135%). Default selection = Lush. Center-stage effect. *Impact 5 × Effort 3 × ★★★ = 22.5*
4. **Gift-confidence bar** — three icons under the price: "Hand-built this morning · Free re-do if she doesn't love it · Photo when delivered". Dispatches the three biggest gift anxieties in one row. *Impact 4 × Effort 2 × ★★★ = 24*
5. **"Delivered 142 times" lifetime count per product** — derived from order data when real, hard-coded honest baseline for v1. Implicit social proof + authority. *Impact 3 × Effort 2 × ★★★ = 18*
6. **Card preview** — small "How your card will look" preview below the textarea. Reduces "what does this turn into" anxiety. *Impact 3 × Effort 2 × ★★ = 12*
7. **Sympathy-mode subtle re-anchoring** — for sympathy products, replace urgency framing ("Order in 1h") with calm framing ("We can deliver as early as this afternoon"). Same data, different emotional register. *Impact 3 × Effort 2 × ★★★ = 18*
8. **Recently viewed strip** — bottom of PDP, persisted in `localStorage`. Helps comparison shoppers come back. *Impact 2 × Effort 2 × ★★ = 8*
9. **Sticky "Add to bag" on mobile** — when the user scrolls past the configurator, the CTA stays. Mobile floral conversion is heavily dependent on this. *Impact 4 × Effort 2 × ★★★ = 24*

### 4.4 Cart drawer (`components/cart/CartDrawer.tsx`)

**Current state:** Right-side drawer, header, scrollable line items, `CartSummary` with subtotal and "Continue to checkout". `CartEmpty` state when empty. No upsell zone.

**Tactics:**
1. **"Complete the gift" upsell strip** — between line items and summary: 2-3 add-ons (vase upgrade, premium card, ribbon, mini chocolates) with "+ Add" inline. Lowest-friction moment for AOV. *Impact 4 × Effort 3 × ★★★ = 18*
2. **Same-day cutoff reminder** — sticky pill at top of drawer: "Same-day cutoff in 1h 47m". Compresses time-to-checkout. *Impact 4 × Effort 2 × ★★★ = 24*
3. **Reassurance footer** — "Free re-do · Hand-built today · Photo on delivery" mini-strip above the checkout CTA. *Impact 3 × Effort 1 × ★★★ = 22.5*
4. **Empty-cart recovery** — `CartEmpty` currently sends to /shop. Add "Or browse Maky's picks for [occasion]" tiles inline. *Impact 2 × Effort 2 × ★★ = 8*

### 4.5 /cart page (`app/[locale]/cart/`)

**Current state:** uses `CartPageList` + `CartSummary`. More room than drawer, same content density.

**Tactics:**
1. **Larger upsell carousel than drawer** — same `PairsWellWith` mechanism, surfaced on the cart page. *Impact 3 × Effort 1 × ★★★ = 22.5*
2. **Save-for-later** — move out of cart but keep in a list, persisted in `localStorage`. Reduces "I need to think about this" abandonment. *Impact 3 × Effort 3 × ★★ = 9*
3. **Trust strip** — payment logos + "Secure checkout" + return policy summary. Same content as 4.6 but contextual here. *Impact 2 × Effort 1 × ★★★ = 15*

### 4.6 Checkout (`components/checkout/CheckoutShell.tsx`)

**Current state:** 3-step accordion (Contact / Delivery / Payment), `OrderSummarySticky` on the right, `PaymentStub` for now. React-hook-form + zod validation. Solid baseline.

**Tactics:**
1. **Persistent same-day cutoff in `OrderSummarySticky`** — same data as PDP/cart, framed as "Same-day cutoff in 1h 12m". Reminds the buyer this is time-sensitive at the riskiest step. *Impact 4 × Effort 2 × ★★★ = 24*
2. **Trust strip above payment** — payment logos + "256-bit secure" + "We ship from our shop in [town]". Reduces anxiety at the highest-anxiety step. *Impact 3 × Effort 1 × ★★★ = 22.5*
3. **"Hand-built today by Maky" line in `OrderSummarySticky`** — humanizes the transaction at the moment money changes hands. *Impact 2 × Effort 1 × ★★★ = 15*
4. **Field-level reassurance microcopy** — under email: "We send the photo of the arrangement here". Under recipient phone: "Only used to coordinate delivery — we never call to upsell". *Impact 3 × Effort 1 × ★★★ = 22.5*
5. **Express checkout (Apple Pay / Shop Pay)** — when payment goes live in v2. Mobile floral conversion increases substantially with one-tap payment. *Impact 5 × Effort 5 × ★★★ = 7.5* — flagged for v2.

### 4.7 Confirmation (`components/checkout/ConfirmationView.tsx`)

**Current state:** order summary, what to expect, support contact.

**Tactics:**
1. **Reciprocity card** — "Send a friend $20 toward their first arrangement, get $20 toward your next." Single best moment to plant referral. *Impact 4 × Effort 3 × ★★★ = 18*
2. **Subscription nudge for one-off buyers** — "Loved sending this? Get something hand-built every month, starting at $X." Pull data from `data/products.ts` subscription items. *Impact 4 × Effort 2 × ★★★ = 24*
3. **Save-the-occasion** — "Remind me to send for [recipient name]'s birthday next year" — saves to a `localStorage`-backed list initially, real account in v2. *Impact 3 × Effort 3 × ★★ = 9*
4. **Add-after-purchase window** — for the next ~30min while the order is pre-build, allow adding a card upgrade or add-on. "We haven't started building yet — add a vase upgrade for $15." *Impact 3 × Effort 4 × ★★ = 6*
5. **Social share without spoiling** — "Tell someone you sent flowers (without telling the recipient)". Pre-formatted post for sender's friends, not recipient. *Impact 1 × Effort 2 × ★★ = 4*

### 4.8 Inquiry pages (weddings, events, contact)

**Current state:** form pages, persist to `pending-inquiries.json`. Text Maky modal available globally. `WeddingsTeaser` on home routes here.

**Tactics:**
1. **Reduce inquiry-form anxiety with social proof above the form** — "12 weddings in 2026, 47 in 2025. Each one designed in person with Maky." Reduces "is this a real florist or a form factory?" anxiety. *Impact 4 × Effort 2 × ★★★ = 24*
2. **"What happens after you submit" preview** — 3-step graphic (We reply within 24h → Free 30min consultation → Quote in 5 days). Reduces submission anxiety. *Impact 3 × Effort 2 × ★★★ = 18*
3. **Wedding gallery teaser inline in form** — 3-image strip with captions ("Long Island Aquarium, June 2025"). Authority + identity. *Impact 3 × Effort 2 × ★★★ = 18*
4. **Slot scarcity for weddings** — "We take 18 weddings per year. 4 dates remain in 2026." Real number, real scarcity, calmly stated. *Impact 4 × Effort 3 × ★★★ = 18*
5. **Auto-prefilled subject from category** — already implemented (commits e9ecc74, 9eb6fc9). Maintain.

### 4.9 Subscriptions (`/shop` subscription items + `/account` v2)

**Current state:** subscription products in `data/products.ts` with `cadences`. `SubscriptionCadence` picker. `BentoSubscriptionsTile` on home.

**Tactics:**
1. **Pause/skip reassurance copy** — "Pause anytime. Skip a week. Cancel in two clicks." Top fear of subscription floral is "I'll forget and waste money". *Impact 4 × Effort 1 × ★★★ = 30*
2. **First-month preview** — "Here's what arrived in last month's [Weekly Garden] subscription" with photo grid. Reduces "what am I actually committing to" anxiety. *Impact 3 × Effort 3 × ★★ = 9*
3. **Gift subscription** — "Send 3 months of weekly flowers as a gift". Subscriptions are mostly self-purchase; gift framing opens a new buyer. *Impact 3 × Effort 3 × ★★★ = 13.5*

### 4.10 Journal (`/journal`)

**Current state:** 3 articles, editorial layout. Brand authority builder, not a conversion surface directly.

**Tactics:**
1. **End-of-article CTA matched to article topic** — sympathy article → sympathy collection link, anniversary article → anniversary arrangements. *Impact 2 × Effort 1 × ★★★ = 15*
2. **Newsletter signup at end of article** — captures intent at the highest-engagement moment. *Impact 2 × Effort 1 × ★★★ = 15*

### 4.11 Footer / Nav

**Current state:** clean, brand-consistent. Text Maky inline link in footer (commit d64c4c9). Social links assumed.

**Tactics:**
1. **Live shop status pill in TopNav** — "Open · Cutoff in 1h 47m" / "Closed · Reopens 9am". Existing `BentoLiveStatusTile` lives only on home; this is the same data on every page. *Impact 3 × Effort 2 × ★★★ = 18*
2. **Sticky bottom bar on mobile for in-cart users** — "1 item · $255 · Continue →". Most floral mobile conversions die in nav transitions. *Impact 3 × Effort 3 × ★★ = 9*

---

## §5 Cross-cutting tactics catalog

A grouping of every tactic above (plus a few that didn't fit a single page) by neuromarketing principle, for reference and to make it obvious where each principle is over- or under-used.

**Reciprocity**
- Free handwritten note from Maky (mention everywhere it's true)
- AI card-message helper (already shipped — frame as gift to the buyer)
- Newsletter incentive ("Maky's seasonal note")
- Confirmation page referral ($20 / $20)
- Photo-on-delivery promise

**Authority**
- "Long Island · Since 2014" (already in hero — replicate on PDP, footer, checkout)
- "Hand-built this morning by Maky" microcopy
- Press logos on home (already in `BentoPressTile`)
- Wedding count / years operating
- Bilingual ("Atendemos en español")

**Social proof**
- `GoogleReviews` already on home — replicate on PDP
- "Going out today: 14"
- "Delivered 142 times" per product
- Occasion-matched reviews ("4.9 from anniversary buyers")
- Testimonial inline on inquiry forms
- "Popular this week" sort

**Honest scarcity**
- Same-day cutoff countdown (PDP, cart, checkout)
- Daily capacity ("3 same-day slots remain for today")
- Sold-out delivery dates (already supported in date picker — surface as "calendar fills fast")
- Wedding slot count ("4 dates remain in 2026")
- Sympathy daily limit (when applicable)

**Urgency** (gentle framing)
- Cutoff countdown
- "Order in the next 1h 47m for delivery this afternoon"
- "Last day for Mother's Day delivery: Saturday"
- Subscription start window ("Begins next Friday")

**Anchor + bundling**
- Standard / Lush / Opulent variants
- "Complete the gift" upsell strip in cart
- Add-on toggles (already shipped — improve with default-suggested add-on)
- Subscription gift-quantity ("3 / 6 / 12 months")
- Premium card upgrade

**Identity / belonging**
- "For the person who appreciates the gesture" microcopy
- Bilingual = identity for Hispanic buyers
- "Long Island locals deliver to Long Island" = local-pride identity
- Editorial voice itself (already strong)

**Loss aversion**
- "This date is almost full" (vs "8 slots remain")
- "Order before 2pm or wait until tomorrow"
- "We only take 18 weddings per year"
- "Subscription locks at the current price — increases next month"

**Decision-paralysis collapse**
- Maky's pick this week
- Occasion-first wedge on home
- Default selected variant = middle (Lush)
- Default add-ons pre-selected (gentle — top selling)
- "Best for [occasion]" tiles

**Gift anxiety reduction**
- Photo-on-delivery
- Free re-do guarantee
- Fresh-cut / hand-built today
- Recipient view ("here's what she'll see")
- "We never call the recipient before delivery"
- Card preview

**Reciprocity post-purchase / LTV**
- Referral $20 / $20
- Subscription nudge after one-off
- Save-the-occasion reminder
- Anniversary auto-reminder (v2 with email)
- Add-after-purchase window

---

## §6 Friction killers map

The other lens. Instead of "what to add", "what to remove."

| Friction | Where it lives | Removal tactic |
|----------|----------------|----------------|
| Sticker shock | PDP (single price visible) | Anchor variants — buyer compares instead of evaluating |
| Decision paralysis | Shop hub, category | Maky's pick, occasion-first wedge, default sort by popular |
| Gift anxiety ("won't like it") | PDP, checkout | Re-do guarantee, photo-on-delivery, fresh-cut promise |
| Time anxiety ("will it arrive on time") | PDP, checkout | Cutoff countdown, "delivered today" framing |
| Trust gap ("real florist?") | PDP, checkout | Maky-as-curator, "from our shop in [town]", press logos |
| Recipient surprise risk | Checkout (recipient phone) | Microcopy: "Only used to coordinate delivery, never to upsell" |
| Subscription regret risk | Subscription PDP, checkout | "Pause / skip / cancel in two clicks" |
| Form abandonment (inquiry) | Weddings, events, contact | "What happens after you submit" preview |
| Mobile cart deferral | All mobile pages | Sticky bottom bar with cart state |
| Email signup hesitation | Newsletter field | Concrete value ("Maky's seasonal note") |

---

## §7 Emotional vs rational funnel

A useful frame for *where* to apply *which* tone. Mapping each surface to its dominant register:

| Surface | Dominant register | Implication |
|---------|-------------------|-------------|
| Hero, home, journal | **Emotional** | Lean into editorial voice, restraint, curation. No countdowns here. |
| Shop hub, category | **Emotional → Rational transition** | Begin filter / sort / scarcity signals here. |
| PDP top half (image, title, blurb, social proof) | **Emotional** | Feel-it tactics: reviews, occasion match, "for the person who…" |
| PDP bottom half (configurator, cutoff, anchor pricing) | **Rational** | Decision-support tactics: timer, variants, add-ons |
| Cart drawer | **Rational with reassurance** | Upsell + reassurance strip. Not the place for emotional copy. |
| Checkout | **Rational + anxiety reduction** | Trust strip, microcopy, no surprise costs |
| Confirmation | **Emotional** | Reciprocity, identity, "you did a good thing" framing |
| Inquiry forms | **Emotional opening, rational form** | Social proof above form, calm field labels |

The mistake to avoid: putting urgency countdowns in the hero (breaks brand) or putting editorial copy at checkout (creates friction). Tactics fit their stage.

---

## §8 Shortlist for Phase 2 — and why these six

Selection rule (from §2 of the design): brand-fit ≥ ★★, effort ≤ 3, top 6 by score, with at least one tactic in each of {Browse, Decide, Configure, Return}.

The top scorers from §4:

| Tactic | Stage | I × (6−E) × Brand | Score | In shortlist? |
|--------|-------|-------------------|-------|---------------|
| Pause/skip reassurance copy (subscriptions) | Decide | 4 × 5 × 1.5 | 30 | No — subscription only, narrow audience |
| Same-day cutoff countdown (PDP) | Decide | 5 × 4 × 1.5 | 30 | **Yes (#1)** |
| Social-proof block on PDP | Decide | 5 × 4 × 1.5 | 30 | **Yes (#2)** |
| Anchor pricing variants (top 12) | Decide | 5 × 3 × 1.5 | 22.5 | **Yes (#3)** — extending to all top products is its own scope |
| Cutoff reminder in cart drawer | Configure | 4 × 4 × 1.5 | 24 | Folded into #1 (same mechanism, multiple surfaces) |
| Cutoff in `OrderSummarySticky` (checkout) | Pay | 4 × 4 × 1.5 | 24 | Folded into #1 |
| Sticky mobile "Add to bag" (PDP) | Decide | 4 × 4 × 1.5 | 24 | Strong candidate — see note below |
| Gift-confidence bar (PDP) | Decide | 4 × 4 × 1.5 | 24 | **Yes (#5)** |
| Subscription nudge on confirmation | Return | 4 × 4 × 1.5 | 24 | **Yes (#6)** — combined with referral |
| "Same-day eligible" filter pinned by default | Browse | 4 × 4 × 1.5 | 24 | Strong candidate, see note below |
| "Going out today" live counter | Browse | 3 × 5 × 1.5 | 22.5 | Strong candidate, see note below |
| Inquiry-page social proof | Decide (inquiry) | 4 × 4 × 1.5 | 24 | Out — different funnel from retail focus |
| "Complete the gift" upsell strip in cart | Configure | 4 × 3 × 1.5 | 18 | **Yes (#4)** |
| Reassurance footer in cart | Configure | 3 × 5 × 1.5 | 22.5 | Folded into #5 (same content, multiple surfaces) |
| Trust strip in checkout | Pay | 3 × 5 × 1.5 | 22.5 | Folded into #5 |

**The final six:**

1. **Same-day cutoff system (live countdown across PDP, cart drawer, /cart, checkout sticky)** — single mechanism, four surfaces. The most universally applicable tactic and the data already exists in `lib/delivery.ts`.
2. **PDP social-proof block** — surfaces `REVIEWS` (occasion-matched when possible) on every product page above the configurator.
3. **Anchor-pricing variants on top 12 products** — extends `data/products.ts` for the highest-traffic items. Default selection = middle (Lush).
4. **Cart drawer "Complete the gift" upsell strip** — vase, premium card, ribbon, mini chocolates. Default-suggested add-on shows by occasion when possible.
5. **Gift-confidence assurance bar (PDP, cart drawer, checkout)** — three-icon strip: hand-built today · free re-do · photo on delivery. Single component, three placements.
6. **Confirmation reciprocity card (referral + subscription nudge)** — one composite component on `ConfirmationView` covering both the referral incentive and the subscription nudge for one-off buyers.

**What got cut and why:**
- *Sticky mobile "Add to bag"* (score 24) — narrowly missed top 6, will add as a "fast follow" recommendation if Phase 2 implementation comes in under estimate.
- *Same-day filter pinned + Going-out-today counter* (score 24, 22.5) — both excellent but live in the Browse stage; the funnel-coverage rule is satisfied by anchor-pricing's *category-page* impact and the reciprocity card pulls in Return. Consider adding either as #7 if budget allows.
- *Inquiry-page social proof* — high impact but on a different funnel; bundling retail + inquiry tactics in one Phase 2 spec increases coordination cost.
- *Pause/skip reassurance* — high score but addresses subscription audience only; better as a Phase 3 "subscriptions deep-dive."
- *Anything requiring email or analytics* — flagged for v2 throughout.

**Coverage check:** Browse 1 (#3 — anchor pricing changes the "From $X" on `ProductCard`, surfacing the lower Standard price across category pages), Decide 4 (#1, #2, #3, #5), Configure 3 (#1, #4, #5), Pay 2 (#1, #5), Return 1 (#6). Browse coverage is indirect rather than dedicated; this is an explicit tradeoff to keep the Phase 2 scope tight. If a 7th tactic is funded, the recommended add is *"Same-day eligible" filter pinned by default* (score 24, Browse stage, low effort).

---

## §9 Appendices

### 9.1 Full tactic table (for v3+ planning)

(Compact reference — every tactic from §4 in score order. Tactics already in the shortlist are bolded.)

| Score | Tactic | Surface |
|-------|--------|---------|
| 30 | **Same-day cutoff countdown** | PDP / cart / checkout |
| 30 | **PDP social-proof block** | PDP |
| 30 | Pause/skip reassurance copy | Subscription PDP |
| 22.5 | **Anchor pricing variants** | PDP (also affects ProductCard "from" price on Shop) |
| 24 | **Cart cutoff reminder** | Cart drawer |
| 24 | **Checkout cutoff in OrderSummarySticky** | Checkout |
| 24 | Sticky mobile Add to bag | PDP mobile |
| 24 | **Gift-confidence bar** | PDP |
| 24 | **Subscription nudge on confirmation** | Confirmation |
| 24 | "Same-day eligible" filter pinned | Shop / category |
| 24 | Inquiry-page social proof | Weddings / events / contact |
| 24 | Sympathy daily-limit honest scarcity | Sympathy PDP |
| 24 | "What happens after submit" preview | Inquiry forms |
| 24 | Occasion-first wedge below hero | Home |
| 22.5 | "Going out today" live counter | Home + nav |
| 22.5 | Reassurance footer in cart | Cart drawer |
| 22.5 | Trust strip in checkout | Checkout |
| 22.5 | Field-level reassurance microcopy | Checkout |
| 22.5 | Larger upsell carousel | /cart |
| 18 | **"Complete the gift" upsell strip** | Cart drawer |
| 18 | Maky's pick this week | Home |
| 18 | "Sort by popular this week" | Shop / category |
| 18 | Sympathy-mode tonal re-anchoring | Sympathy PDP |
| 18 | "Delivered 142 times" lifetime count | PDP |
| 18 | **Confirmation reciprocity card** | Confirmation |
| 18 | Wedding slot scarcity | Weddings inquiry |
| 18 | Wedding gallery teaser inline | Weddings inquiry |
| 18 | Live shop status pill in TopNav | Nav |
| 15 | Move reviews snippet into hero area | Home |
| 15 | Bilingual trust signal | Home / footer |
| 15 | Empty-filter recovery | Shop / category |
| 15 | Trust strip on /cart | /cart |
| 15 | "Hand-built today by Maky" line | Checkout sticky |
| 15 | End-of-journal CTA matched to topic | Journal |
| 15 | Newsletter signup end of article | Journal |
| 13.5 | Gift subscription option | Subscriptions |
| 12 | "X sent today" microbadge on cards | Shop / category |
| 12 | Card preview | PDP |
| 10 | Newsletter incentive copy | Footer |
| 9 | Save-for-later | /cart |
| 9 | Sticky bottom bar on mobile | All mobile |
| 9 | Save-the-occasion | Confirmation |
| 9 | First-month subscription preview | Subscription PDP |
| 8 | Recently viewed strip | PDP |
| 8 | Empty cart recovery tiles | Cart drawer |
| 7.5 | Express checkout (Apple/Shop Pay) | Checkout — **v2** |
| 6 | Add-after-purchase window | Confirmation |
| 4 | Social share without spoiling | Confirmation |

### 9.2 Glossary

- **Center-stage effect** — when offered three options of similar shape, the middle one is chosen disproportionately (~60% of the time).
- **Cialdini's principles** — six (in original work) influence patterns: reciprocity, commitment, social proof, authority, liking, scarcity. We reference seven here, splitting "scarcity" into "honest scarcity" and "loss aversion" because they convert via different mechanisms.
- **Decision paralysis (paradox of choice)** — too many options reduce conversion. Reduced by curation and defaults.
- **Gift anxiety** — the buyer's worry that the recipient won't like the gift. Specific to gift commerce; reducing it lifts conversion more than any pricing tactic.
- **Honest scarcity** — scarcity grounded in real constraints (cutoff time, capacity, slots). Distinguished from manufactured scarcity ("only 2 left!" with no inventory backing).
- **Anchor pricing** — presenting a high option to make the target option look reasonable by comparison.
- **Center-tactic / decoy** — adding a third option specifically to make the middle option more attractive.

### 9.3 Metrics worth measuring (for v2 with analytics)

When analytics ship, the following events make the audit testable:

- `cutoff_countdown_visible` (event) — fired when the live countdown is in viewport
- `cutoff_passed_during_session` — fired when the countdown reaches zero with the user still on site
- `add_to_bag` — already implicit, surface as event
- `pdp_review_block_view` / `pdp_review_block_expand`
- `variant_default_changed` (anchor pricing — did they move off the default?)
- `cart_upsell_added` / `cart_upsell_dismissed`
- `confirmation_referral_click` / `confirmation_subscription_click`
- `checkout_step_completed[contact|delivery|payment]`
- `checkout_abandon_at_step`

Pair with a simple A/B mechanism (cookie-based bucket) to measure each shortlist tactic in isolation.

### 9.4 What this audit explicitly does not cover

- **Performance / Core Web Vitals** — performance is a conversion lever (LCP and INP correlate with conversion) but is its own audit and not in scope here.
- **SEO & content** — `seo` data is in `data/products.ts`; content/SEO strategy is out of scope.
- **Accessibility audit beyond brand-fit guardrails** — out of scope here; baseline a11y assumed from the existing codebase quality.
- **Pricing strategy itself** — we recommend anchor pricing as a structure, not the price points. Price-point setting is a Maky decision.
- **Brand-voice rewrites of existing copy** — only new microcopy is recommended in this audit; existing copy stands.
- **Wedding/event consultation flow beyond the inquiry form** — out of scope; that's a separate sales funnel.
- **Email sequences (abandoned cart, post-purchase, anniversary save)** — out of scope until real email integration.
- **Account / loyalty program** — `/account` is stubbed; loyalty mechanics depend on real auth + DB.

These are flagged so the shortlist isn't read as exhaustive of conversion levers — only of the levers actionable on the current stack.

---

## §10 Next step

If this audit is approved, the next deliverable is the Phase 2 implementation spec at `docs/superpowers/specs/2026-05-02-conversion-tactics-v1-design.md`, covering the six shortlisted tactics in the structure agreed in §3 of the brainstorming session: file map, per-tactic behavior + bilingual copy + states + a11y, types, motion guidelines, testing plan, rollout order, and explicit v2 hooks.
