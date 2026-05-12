# Always-On Local Search 2026 — Google Ads Operations

Setup guide: `always-on-search-2026-setup.md`. Open both files side-by-side while building.

---

## What this campaign is

The **first always-on Google Ads campaign** for Diva Flowers, replacing one-off seasonal pushes
(Mother's Day, Father's Day) with a continuous baseline of paid demand capture for the North
Shore of Long Island.

- **Budget:** $500 / month ($16.50 / day)
- **Type:** Search only (no Display, no Search Partners)
- **Geo:** Albertson, Roslyn, Manhasset, Great Neck, Port Washington (3-mile radius each)
- **Languages:** English + Spanish (all ads in English for v1)
- **Goals:** online orders (purchase event) + phone calls + WhatsApp / SMS inquiries

---

## Order of operations

1. **Day −7 to −3 (~3 hours total):**
   - Wire up the four conversions in GA4 (purchase, phone_click, whatsapp_click, sms_click).
     `purchase` is already firing on `/order/[id]/confirmation`; verify the other three are
     instrumented in `lib/analytics.ts`. Add any that are missing.
   - Import all four to Google Ads. Mark the first three as PRIMARY, sms as SECONDARY.
   - Generate Higgsfield image extensions (see §3 below).
   - Verify Google Business Profile is verified and address is correct.

2. **Day −2 (~1 hour):**
   - Create the campaign in PAUSED state. Paste each panel of `setup.md` top to bottom.
   - Apply the master negative keyword list at the campaign level.
   - Upload image extensions to Assets.

3. **Day −1 (~30 min):**
   - Run the test purchase. Confirm `purchase` event in GA4 Realtime within 60 sec.
   - Tap-test phone, WhatsApp, and SMS CTAs from a real mobile device. Confirm all events
     in GA4 Realtime.
   - Walk the pre-launch checklist (`setup.md` §10). Block launch on any unchecked item.

4. **Day 0 — launch:**
   - Enable the campaign at 9 AM ET.
   - Don't touch anything until the daily 5 PM check.

5. **Days 1–7 (5 min/day):**
   - **Search Terms report** → add irrelevant matches as negatives.
   - **CTR by ad group** → if < 4%, pause the weakest pinned headline.
   - **Avg CPC by keyword** → if > $5, prune that keyword.
   - **Conversions panel** → confirm at least one event has fired.

6. **Days 8–30 (15 min every 3 days):**
   - Search Terms → more negatives.
   - Pause keywords with > $30 spend and 0 conversions.
   - Pause keywords with CTR < 2%.
   - At day 15, if conversions ≥ 15: switch bidding to Maximize Conversions.

7. **Month 2 (60 min, first Monday):**
   - Recalibrate location, hour, device bid adjustments with real data.
   - Generate 2–3 fresh Higgsfield images for A/B testing image extensions.
   - At month-end, if conversions ≥ 30: switch to Maximize Conversion Value.

8. **Month 3 (60 min, first Monday):**
   - Spanish queries showing up in Search Terms? Open Ad group 5 (Español).
   - Decide: scale budget to $800–1,000/mo if ROAS ≥ 3x, otherwise hold and optimize.

9. **Month 4+ (decision point):**
   - Open one of: Performance Max (needs Higgsfield video assets), Wedding Leads campaign,
     or geo-expansion to full Nassau County.

---

## Pre-launch checklist (also in setup.md §10)

- [ ] Four conversions firing in GA4 Realtime
- [ ] All four imported to Google Ads with correct primary/secondary + values
- [ ] Auto-tagging ON
- [ ] GA4 ↔ Google Ads linked
- [ ] Google Business Profile linked, Albertson NY 11507
- [ ] All four ad group Final URLs return 200 in production
- [ ] All four sitelink URLs return 200
- [ ] `?tag=same-day` filter works on `/en/shop`
- [ ] At least 4 image extensions uploaded
- [ ] Master negative keyword list applied
- [ ] Billing active

---

## Daily monitoring (5 min, weeks 1–4)

| Metric | Red flag | Action |
|---|---|---|
| Impressions | < 50 / day after day 3 | Raise max CPC by $0.50, or loosen exact-only keywords |
| CTR | < 4% | Pause weakest pinned headline; review Search Terms |
| Avg CPC | > $5 sustained | Lower max bid; prune costliest phrase keywords |
| Quality Score (avg) | < 6 / 10 | Tighten keyword ↔ ad ↔ landing page alignment |
| Conversions / week | < 2 by week 2 | Investigate landing page, cutoff messaging, mobile UX |
| Search terms | Irrelevant matches | Add as negative (phrase match preferred) |
| Top impression share | < 60% with healthy CPA | Increase budget gradually |

---

## Monthly KPI targets (90 days)

```
Month 1   8–15 conversions    CPA $50–80    ROAS 2.0–2.5x    "learning"
Month 2  15–25 conversions    CPA $40–60    ROAS 2.5–3.5x
Month 3  20–35 conversions    CPA $30–50    ROAS 3–5x        ← scale decision
```

A "conversion" here counts purchase + phone_click + whatsapp_click. ROAS uses event values
(real $ for purchases, estimated $ for calls/messages — recalibrate the estimates at month 3
once we know the real call → order conversion rate).

---

## 3. Visual asset production with Higgsfield

For image extensions in this Search-only v1, and for video / display assets later (PMax in
month 4+).

### Phase 0 (pre-launch) — image extensions

Generate 4–6 images, square 1200×1200 and landscape 1200×628. Use the briefs below verbatim
with `mcp__claude_ai_higgsfield__generate_image`. Generate 2–3 variations per concept and
pick the best.

```
1. Hero — Lush garden-rose bouquet
   "Editorial floral photography, abundant pink and cream garden roses with ranunculus
    and eucalyptus, hand-tied bouquet in kraft paper wrapping, morning light through linen
    curtains, shallow depth of field, warm tones, high-end florist aesthetic, no people
    faces visible"

2. Studio — Florist arranging flowers
   "Florist's hands arranging peonies and roses on white marble worktable, scattered stems
    and shears, natural daylight, Brooklyn brownstone studio aesthetic, candid editorial
    style, warm cream and blush palette"

3. Sympathy — Restrained, elegant arrangement
   "Elegant sympathy arrangement of white peonies, lisianthus and seeded eucalyptus in a
    low ceramic vase, soft gray background, gentle natural light, dignified and serene
    mood, no text"

4. Same-day proof — Bouquet at doorstep
   "Romantic mixed bouquet wrapped in cream paper resting at the entrance of a charming
    Long Island home, daylight, welcoming and warm, no people"

5. Anniversary/Romance — Bedroom vignette
   "Romantic bouquet of red garden roses on a marble bedside table beside a handwritten
    note, soft morning light, intimate and warm, editorial still-life photography"

6. Bouquet variety grid (landscape 1200×628)
   "Four florist arrangements side by side: blush pink, deep red, white sympathy, mixed
    pastel, all hand-tied editorial style, consistent lighting, neutral background"
```

Save selected variants to `/public/og/google-ads/` (or wherever the team standardizes
marketing assets). Upload to Google Ads → Assets → Image at the campaign level.

### Phase 2 (month 2) — A/B test refresh

Generate 2–3 new image variants, swap them into the same image extension slots, watch for
CTR lift over 30 days.

### Phase 3 (month 4+, if scaling to PMax)

Performance Max needs more assets per campaign:
- 5+ landscape images
- 5+ square images
- 1+ portrait image (1200×1500)
- 1+ logo (128×128 minimum)
- 5+ short videos (15–30 sec)

Use Higgsfield's video generation (`mcp__claude_ai_higgsfield__generate_video`) for the
videos. Brief examples for that phase will be added when the PMax decision is made.

### What NOT to use AI for

- **Google Business Profile photos:** Google detects synthetic images and penalizes the
  listing. Use real iPhone photos of the studio, exterior, and arrangements.
- **Press / award badges:** never fabricate Vogue / Brides / etc. badges. Only use what
  is verifiable. Google can disable ads for unsubstantiated claims.

---

## Cost notes for Higgsfield

`mcp__claude_ai_higgsfield__balance` and `show_plans_and_credits` show current credit
balance and pricing. Generating 6 image concepts × 3 variants = ~18 image generations
in Phase 0; budget accordingly.

---

## Post-90-day decision tree

```
Is ROAS ≥ 3x?
├── Yes: scale spend to $800–1,000/mo, then evaluate PMax / Wedding / Geo expansion.
└── No, but conversions ≥ 30/mo: hold spend, deepen optimization (LP tests, RSA refresh,
        Spanish ad group).
└── No, and conversions < 30/mo: audit fundamentals (tracking, LP load, mobile CR).
        Don't scale on broken funnel.
```

---

*Operations guide prepared 2026-05-11. Companion: `always-on-search-2026-setup.md`.*
