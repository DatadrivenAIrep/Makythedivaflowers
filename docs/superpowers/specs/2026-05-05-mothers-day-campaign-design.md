# Mother's Day 2026 Campaign — Design Spec

**Date:** 2026-05-05 (T-5 days)
**Mother's Day:** Sunday 2026-05-10
**Order cutoff:** Saturday 2026-05-09 · 2:00 PM ET
**Approach:** A (Lean & Fast) — single English landing + Search-only Google Ads, geo-locked to delivery zones
**Locale scope:** `en` only. Spanish (`/es/dia-de-la-madre`) deferred to post-MD or Father's Day.

---

## 1. Context & Constraints

### Business
- Diva Flowers is a Long Island florist (1077 Willis Ave, Albertson, NY 11507), founded 2014.
- Same-day delivery to Nassau, Queens, Brooklyn (select), Western Suffolk. Cutoff 2 PM ET.
- Sunday hours 10 AM – 4 PM → Sunday 5/10 delivery is feasible for orders received Sat ≤ 2 PM.
- Press: Vogue, The Cut, Brides, NY Magazine, Town & Country, Refinery29.
- Bilingual brand (EN/ES). Hispanic customers are a meaningful segment.

### Technical
- Next.js (this version has breaking changes from training data — see `node_modules/next/dist/docs/`).
- Conversion tracking complete in GA4: `purchase`, `begin_checkout`, `add_to_cart`, `view_item`, `view_cart`, `add_payment_info`, `add_shipping_info`, occasion/contact/phone/whatsapp events all firing (commits `c32f9f8`…`a1a045b`).
- 99 products in `data/products.ts`. Existing `occasions` union: `romance | anniversary | birthday | congrats | just-because | sympathy`. **No `mothers-day` value yet — must extend the union.**
- Delivery zones in `data/delivery-zones.ts` — 4 zones, ZIP arrays available for client-side validation.
- `SITE` config in `data/site.ts` exposes `cutoff24` (HH:mm) and `cutoffTime` (display) — reusable in countdown.

### Campaign constraints
- New Google Ads account, no conversion history → **Manual CPC** only. Smart Bidding deferred.
- Merchant Center / Shopping ads NOT in scope (3–5 day approval window won't make MD).
- 4 effective selling days (Wed 5/6 → Sat 5/9 2 PM).

---

## 2. Goals & Success Metrics

**Primary:** capture local high-intent Mother's Day floral orders via paid search.

**Hard targets (4-day campaign, $500 budget):**
- 125–180 paid clicks
- ≥ 4% landing conversion rate
- 5–12 paid orders
- $600–$1,440 paid revenue
- ROAS ≥ 1.2× (break-even+)

**Soft targets:**
- ≥ 4% CTR on RSA
- ≤ $5 avg CPC
- ≥ 60% impression share (Top)
- Build 200+ remarketing audience for Father's Day reuse

---

## 3. Site Changes

### 3.1 New route: `app/[locale]/mothers-day/page.tsx`

Only `en` locale active for v1. The route still lives under `[locale]` for consistency; if accessed with `locale=es`, render the EN version with a banner "Pronto en español" linking to `/es/shop?occasion=mothers-day` (or just to `/es/shop`).

**Page sections, top → bottom:**

1. **Cutoff banner (sticky, full-width)**
   - Component: `<MothersDayCutoffBanner>`
   - Coral/red contrast against bone background.
   - Text: "Order by Saturday May 9 · 2 PM for Sunday delivery"
   - Live countdown to next 2 PM cutoff using `SITE.cutoff24` + ET timezone.
   - When cutoff has passed for the day, swap to "Order today for Monday" (post-MD safety).

2. **Hero**
   - H1 (must match ad headline verbatim for Quality Score): **"Mother's Day Flowers · Long Island"**
   - Sub: "Same-day delivery to Nassau, Queens & Western Suffolk. Hand-delivered by our studio since 2014."
   - Primary CTA: "Shop the Mother's Day Edit" (anchor scroll to grid).
   - Inline `<ZipChecker>` (see 3.3).
   - Background: hero photo (user provides; fallback to existing studio photo).

3. **Trust strip**
   - Press logos: Vogue · The Cut · Brides · NY Mag (read from `SITE.press`).
   - "**★★★★★ 4.9 · 127 reviews on Google**" + Google Reviews widget (component already exists: `<GoogleReviews>`). The specific review count is high-leverage social proof — render the number prominently, not the bare star rating.
   - "Recent deliveries" ticker reusing `SITE.recentDeliveries`.

4. **The Mother's Day Edit grid**
   - Component: `<MothersDayEdit>` accepting `slugs: string[]`.
   - Renders existing product card (no new card design).
   - Initial slugs (subject to stock confirmation):
     - `blush-enchantment`
     - `dona-rosita`
     - `cottage-garden-charm`
     - `pink-opus`
     - `designers-choice-maky`
     - `maison-de-diva`
     - `hundred-roses-vase`
   - Alternates if any out of stock: `dusky-bloom`, `talitas-bouquet`.

5. **"Why Diva" module** (3 columns, reuse `<EditorialSplit>` adapted)
   - Real florists, real studio (photo of the Albertson studio)
   - Hand-delivered, never boxed (vs 1-800-Flowers)
   - Order by 2 PM, arrives same day

6. **FAQ accordion** (~5 items)
   - When should I order?
   - Do you deliver Sunday May 10?
   - What if she's not home?
   - Can I add a card / chocolate?
   - Where exactly do you deliver?

7. **Footer** — reused, unchanged.

8. **Sticky bottom CTA on mobile** — "Order by Sat 2 PM →" anchors to grid.

### 3.2 Hero strip on home (`app/[locale]/page.tsx`)

Insert between `<Hero>` and `<KineticMarquee>`:
- Component: `<MothersDayHomeStrip>` (small, dismissible).
- Text EN: "Mother's Day · Order by Sat May 9 · Same-day to Long Island"
- Text ES: "Día de la Madre · Pide antes del sáb 9 de mayo"
- Click → `/{locale}/mothers-day` (ES routes to EN landing for v1; banner on landing handles translation message).
- Auto-hides after 5/10 4 PM.

### 3.3 New components

**`<MothersDayCutoffBanner>`**
- Sticky top, z-index above main nav.
- Reads `SITE.cutoff24` and ET timezone.
- Renders `HH:MM:SS` countdown. Updates every 1s client-side.
- Source of truth for "is cutoff passed" — use existing `isSameDayEligible` helper if present (referenced in `data/site.ts` comment).

**`<ZipChecker>`**
- Input: 5-digit ZIP.
- Validates against flat list of all ZIPs in `data/delivery-zones.ts`.
- States:
  - empty: "Enter your ZIP to confirm same-day delivery"
  - valid: "✓ We deliver to {zoneLabel}" + "Shop the Edit" button
  - invalid: "Sorry, we don't deliver to {zip} yet" + link to contact form
- Fires `zip_check_pass` / `zip_check_fail` events to GA4 (see §5.4).

**`<MothersDayEdit>`**
- Props: `slugs: string[]`.
- Lookup products from `data/products.ts` by slug (use existing `getProductBySlug` helper if present).
- Skip any returning `undefined` (graceful if a slug is removed).
- Render existing product card.

**`<MothersDayHomeStrip>`**
- Lightweight banner; localStorage-dismissible.
- Auto-hide after `2026-05-10T16:00:00-04:00`.

### 3.4 Data changes

**`data/products.ts`** — extend `occasions` union to include `"mothers-day"` and tag the 7 curated products. Format:

```ts
occasions: ["romance", "anniversary", "mothers-day"]
```

**`types/`** — wherever `Occasion` is typed, add `"mothers-day"`. Audit any UI that lists occasions (filter chips, etc.) — only show `mothers-day` chip if at least one product carries it AND date < May 11.

### 3.5 Schema / SEO

On `/en/mothers-day`:
- `LocalBusiness` JSON-LD already in layout — verify it renders.
- `Product` JSON-LD for each product in the Edit grid (using existing product helpers if available; otherwise a simple inline `<script type="application/ld+json">`).
- Include `shippingDetails` with delivery time (same-day) and area served (Nassau / Queens / W. Suffolk).
- `<title>`: "Mother's Day Flowers · Long Island Same-Day Delivery — Diva Flowers"
- `<meta description>`: "Hand-delivered Mother's Day bouquets across Nassau, Queens & W. Suffolk. Order by Sat May 9 · 2 PM. Real florist studio since 2014."
- Canonical: `https://divaflowers.com/en/mothers-day`
- OG image: reuse hero photo or generate via `opengraph-image.tsx` pattern.

---

## 4. Google Ads Campaign

### 4.1 Structure
- 1 campaign · 1 ad group · 1 RSA.
- Type: Search Network only (no Search Partners, no Display).
- Bidding: **Manual CPC**, max bid $5.00.
- Budget: **$500 total over 4 days, Sat-weighted** (Wed $50 / Thu $100 / Fri $125 / Sat $225). Set as daily budgets per day, not a campaign-level cap.
- Rationale: a fresh account benefits from light initial spend (learn, validate conversion fires) and heavy spend on the day of peak intent (Sat cutoff). $50 of the Sat budget is reserved as a flex pool — bump bids on top-performing keyword if data warrants by Sat morning.
- Daily budget overdelivery: leave default (Google may spend up to 2× on high-intent days).

### 4.2 Geo-targeting
- Include: Nassau County NY + Queens NY + Western Suffolk (target by named locations, not lat/lon radius — more reliable for residential intent).
- Optional: 15-mile radius around `1077 Willis Ave, Albertson NY 11507` as a backup layer.
- Mode: **Presence** ("People in your targeted locations") — NOT "Presence or interest".
- Exclude: rest of US.

### 4.3 Schedule & bid adjustments
- Active hours: 7 AM – 9 PM ET, Wed–Sat (May 6–9).
- Mobile: +20%.
- 7–9 PM weekdays: +15%.
- Sat May 9, 12–2 PM: +50% (cutoff push).
- Sunday May 10: ad scheduling OFF (campaign paused at Sat 2:30 PM).

### 4.4 Keywords (12 total)

**Exact match:**
- `[mother's day flowers long island]`
- `[same day flowers nassau county]`
- `[florist long island mother's day]`
- `[flower delivery garden city]`
- `[mother's day bouquet delivery]`

**Phrase match:**
- `"mother's day flowers near me"`
- `"flower delivery long island"`
- `"same day flowers queens"`
- `"florist albertson"`
- `"mother's day delivery sunday"`
- `"flower shop nassau"`
- `"florist near me mother's day"`

**Negatives:** `cheap`, `wholesale`, `wedding`, `funeral`, `1800flowers`, `teleflora`, `proflowers`, `silk`, `fake`, `diy`, `wikipedia`, `meaning`

### 4.5 Responsive Search Ad

**Headlines (15, ≤30 chars):**
1. Mother's Day Flowers
2. Long Island Same-Day
3. Order by Sat May 9
4. Hand-Delivered Florist
5. As Seen in Vogue & Brides
6. Nassau · Queens · Suffolk
7. Real Studio Since 2014
8. Sunday Delivery May 10
9. Skip the 1-800 Box
10. Garden-Style Bouquets
11. From $94 · Same-Day
12. Order Today, Arrives Today
13. Romance, by the Stem
14. ★ 4.9 · 127 Google Reviews
15. Florist in Albertson, NY

**Descriptions (4, ≤90 chars):**
1. Hand-tied florals delivered same-day across Long Island. Order by Saturday 2 PM.
2. As featured in Vogue, The Cut & Brides. Real florist studio, never a warehouse.
3. Lush garden bouquets from $94. Hand-delivered, never boxed. Sunday delivery May 10.
4. Same-day to Nassau, Queens & W. Suffolk. Free card. Order before Sat 2 PM.

**Final URL:** `https://divaflowers.com/en/mothers-day?utm_source=google&utm_medium=cpc&utm_campaign=mothers-day-2026&utm_content=rsa-main`

**Display path:** `/mothers-day/long-island`

**Pinning:** none — let Google rotate. (Pinning hurts Quality Score on a fresh account with no data.)

### 4.6 Extensions
- **Sitelinks (4):** "The MD Edit" → `#edit-grid` · "How Delivery Works" → FAQ · "Reviews" → reviews section · "Visit the Studio" → `/contact`
- **Callouts:** Order by Sat 2 PM · Sunday Delivery · Free Card · Hand-Delivered · As Seen in Vogue
- **Call extension:** +1 (516) 484-3456, scheduled 8 AM – 6 PM
- **Location extension:** linked to Google Business Profile (must be verified — pre-launch dependency)
- **Promotion extension:** "Mother's Day · Order by Sat May 9"

### 4.7 Deliverable: Google Ads Editor CSV
- Pre-built `.csv` exported per Google Ads Editor format covering campaign, ad group, RSA, keywords, negatives, geo, schedule, extensions.
- User imports via Google Ads Editor app: File → Import → CSV → Post.
- Setup time on user side: ~20 min vs ~2h via web UI.

---

## 5. Tracking & Measurement

### 5.1 Account linking (one-time)
- GA4 Admin → Google Ads Links → link new Ads account.
- Google Ads → Tools → Conversions → Import → GA4 → mark `purchase` as **primary** conversion goal.
- Auto-tagging ON in Google Ads (adds `gclid` to URLs).
- Conversion window: 7-day click, 1-day view.
- Attribution: Data-driven (default; falls back to last-click on new accounts with low data).

### 5.2 Enhanced Conversions (nice-to-have)
- Google Ads → Conversions → Enhanced conversions for web → ON.
- Method: Google Tag (already running server-side per recent commits).
- Hash + send `email`/`phone` from checkout (already collected in `app/api/checkout`).
- Defer if implementation > 1h. Not blocking for launch.

### 5.3 UTMs
- Auto-tagging covers Google Ads. The Final URL above also includes UTMs as belt-and-suspenders for GA4 if `gclid` is stripped.

### 5.4 New events for this campaign
Wire into the same GA4 client used by existing analytics:

| Event | Trigger | Purpose |
|---|---|---|
| `mothers_day_view` | Mount of `/en/mothers-day` | Remarketing audience seed |
| `zip_check_pass` | ZIP validates against `deliveryZones` | Mid-funnel signal; potential secondary conversion |
| `zip_check_fail` | ZIP outside zones | Exclude from remarketing |
| `cutoff_banner_click` | Click on countdown CTA | Urgency signal |

Defer if adds > 30 min. Only `mothers_day_view` is required (used for remarketing audience).

### 5.5 Pre-launch QA checklist
- [ ] 1 real test purchase → `purchase` appears in GA4 Realtime.
- [ ] Conversion appears in Google Ads Conversions panel (may take ≤24h on first event).
- [ ] ZipChecker rejects out-of-zone ZIP (e.g., 90210).
- [ ] Cutoff countdown reads `SITE.cutoff24` and ET timezone correctly (test by setting clock or with mock).
- [ ] Mobile LCP < 2.5s on `/en/mothers-day` (PageSpeed Insights).
- [ ] `Product` and `LocalBusiness` schemas pass schema.org validator.
- [ ] All sitelinks open valid pages.
- [ ] Call extension number is correct, rings the studio.
- [ ] Google Business Profile verified (else location extension fails review).

### 5.6 Daily monitoring (5 min/day during campaign)

| Metric | Red flag | Action |
|---|---|---|
| CTR | < 4% | Pause weakest headline, generate replacement |
| Avg CPC | > $5 | Lower max bid, prune broad phrase keywords |
| Landing CR | < 2% | Investigate checkout / cutoff confusion / hero photo |
| Search terms | Irrelevant matches | Add as negative keyword |
| Impression share Top | < 60% | Increase budget IF CR ≥ 3% |

### 5.7 Post-MD (May 11)
- Pause campaign at Sat May 9 2:30 PM (campaign-level pause, not just budget).
- Save remarketing audience: "MD 2026 visitors" — reuse for Father's Day & MD 2027.
- Pull report: spend, impressions, clicks, CTR, CPC, conversions, revenue, ROAS.
- Keyword/headline winners → memo for Father's Day campaign (June 21, 2026).
- Begin Merchant Center setup (3–5 day approval, comfortable for FD).

---

## 6. Timeline & Ownership

| Day | Date | Claude (next sessions) | User |
|---|---|---|---|
| 0 | Tue 5/5 | Write spec + plan | Open Google Ads acct, billing, verify GBP, confirm stock for 7 SKUs |
| 1 | Wed 5/6 | Build landing, components, schema, hero strip; tag products | Provide hero photo, approve copy |
| 2 | Thu 5/7 | QA, deploy, generate Ads Editor CSV | Import CSV, link GA4↔Ads, import conversion, test purchase, soft-launch ad 6 PM |
| 3 | Fri 5/8 | (On request) adjust negatives, headlines | Daily 5-min check; flag weird search terms |
| 4 | Sat 5/9 | (On request) execute cutoff push & pause | 12 PM bump bids; 2:30 PM pause; fulfill orders |
| 5 | Sun 5/10 | — | Studio delivers |
| 6 | Mon 5/11 | Pull report, save audience, FD memo, start Merchant Center | Review report |

---

## 7. Out of Scope (explicit)

- Spanish landing (`/es/dia-de-la-madre`) — deferred. ES traffic on home strip routes to EN landing for v1.
- Display / YouTube / PMax / Shopping ads.
- Smart Bidding (no conversion history).
- Email blast to existing list (separate effort, owner = user, not blocking).
- New product photography for landing.
- A/B testing variants of landing.
- Influencer / press push.
- Paid social (Meta/TikTok).

---

## 8. Risks & Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Google Business Profile not verified by Wed | Medium | Verify Tue night; if fails, drop location extension (campaign still runs) |
| Stock runs out on a curated SKU mid-campaign | Medium | Alternates pre-defined; landing reads from `data/products.ts` so swap is one-line |
| Ad disapproved (florist not common but possible) | Low | Pre-launch CSV review; have backup headline set without superlatives |
| Conversion tag misfires → can't optimize | Low | QA test purchase Thu before launch; soft-launch at 6 PM gives overnight to verify |
| Saturday volume overwhelms studio fulfillment | Low | Cutoff is hard-stop at Sat 2 PM; pause campaign at 2:30 PM |
| New account triggers Google review/hold | Medium | Soft-launch Thu 6 PM (24h before peak); have phone-number-verified business |

---

## 9. Open Questions for User Review

1. ~~Daily budget confirmation~~ — **CONFIRMED: $500 total, Sat-weighted ($50/$100/$125/$225).**
2. **Hero photo:** default — use existing premium product photo (likely `maison-de-diva` or `hundred-roses-vase`) unless user provides a Mother's Day specific shot.
3. **Curated SKU list:** keep as-is, user confirms stock Wed AM before deploy.
4. ~~Google Business Profile status~~ — **CONFIRMED: Verified, active, ★4.9 / 127 reviews. Listed city = Albertson. See §10 for address reconciliation.**
5. **ES home strip behavior:** default — route ES users to EN landing with "Pronto en español" banner up top.

## 10. Address Reconciliation — RESOLVED

Resolved on 2026-05-05 in commit `a1459de` (separate session). `data/site.ts` now reads **1077 Willis Ave, Albertson, NY 11507**, matching the verified Google Business Profile. Map embed and directions href updated. All spec references in this document have been updated to Albertson.

Residual cleanup outside spec scope (does not block launch):
- `tests/e2e/checkout.spec.ts:21` and `tests/unit/checkout-schema.test.ts:9` still reference "Franklin Square" — these are recipient/customer test fixtures, not studio address. Updating is cosmetic; tests still pass. Worth a follow-up commit at user's discretion, not a blocker.
