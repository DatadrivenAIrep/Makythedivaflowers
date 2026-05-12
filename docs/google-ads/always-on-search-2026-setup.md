# Always-On Local Search 2026 — Google Ads Setup Guide

Open this file side-by-side with the Google Ads UI. Work top to bottom, one section at a time.
Copy blocks verbatim — every field value has been pre-written for you.

This is the **first always-on campaign** for Diva Flowers. Budget: $500/month. Objective: drive
online orders + phone/WhatsApp inquiries from the North Shore of Long Island. Companion ops doc:
`always-on-search-2026-README.md`.

---

## 0. Conversion tracking (do this BEFORE creating the campaign)

Without conversion tracking the $500/mo is fired blind. Google's bidder needs conversion signals
to allocate spend; reviewer needs them to judge ROI.

```
Step 1: Tools → Linked accounts → Google Analytics → Link your GA4 property

Step 2: GA4 → Admin → Events → mark each as "conversion":
          purchase           (already firing on /order/[id]/confirmation)
          phone_click        (already firing — see lib/analytics.ts)
          whatsapp_click     (verify it fires on every wa.me click)
          sms_click          (verify it fires on every sms: click)

Step 3: Tools → Conversions → New conversion action → Import → Google Analytics 4
        Import the four events above. Mark as PRIMARY:
          - purchase
          - phone_click
          - whatsapp_click
        Mark as SECONDARY:
          - sms_click

Step 4: For purchase, set:
          Value: Use the value from the event (event_value, currency USD)
          Count: One per click
        For phone_click, whatsapp_click, sms_click set:
          Value: "Use the same value for each conversion"
            phone_click     →  $40
            whatsapp_click  →  $30
            sms_click       →  $25
          Count: One per click

Step 5: Settings → Account settings → Auto-tagging → ON

Step 6: Conversion window:
          Click-through:  30 days
          View-through:   1 day

Step 7: Test before enabling the campaign:
          - Place a $10 test order in production (refund afterwards)
          - Tap the phone, WhatsApp, and SMS CTAs from a real mobile device
          - Confirm all four events appear in GA4 Realtime within 60 seconds
          - Confirm Google Ads shows them under Tools → Conversions within 24 hours
```

---

## 1. Campaign settings

Create a new campaign and fill in each field exactly as shown:

```
Campaign name:        Always-On Local · Search · LI North Shore
Objective:            Sales
Campaign type:        Search
Networks:             Google search only
                      (UNCHECK Search Partners, UNCHECK Display Network)
Languages:            English, Spanish
Budget:               $16.50 / day  (≈ $500 / month)
Bidding:              Manual CPC, max bid $4.00
                      (we'll switch to Maximize Conversions after 15 conversions,
                       then Maximize Conversion Value after 30. Do NOT start on Smart Bidding.)
Ad rotation:          Optimize: prefer best performing
Start date:           Day after pre-launch checklist is complete
End date:             None (always-on)
```

---

## 2. Locations

Go to **Locations** and add by radius. Targeting setting must be
**"Presence: People in or regularly in your targeted locations"** (NOT "Presence or interest").

```
Location target                              Bid adjustment
─────────────────────────────────────────────────────────────
Albertson, NY 11507        radius 3 miles    +0%
Roslyn, NY 11576           radius 3 miles    +10%
Manhasset, NY 11030        radius 3 miles    +15%
Great Neck, NY 11021       radius 3 miles    +15%
Port Washington, NY 11050  radius 3 miles    +10%

Excluded locations: none
```

### Delivery pricing reference (source: `data/delivery-zones.ts`)

Used to keep ad copy and price extensions truthful. Update here AND in the source file
together if pricing changes.

```
Albertson         11507        $10
Roslyn            11576/11577  $15
Manhasset         11030        $18
Great Neck        11020-24     $25
Port Washington   11050        $15
Further (Nassau / Queens / W. Suffolk)   $25–$30
```

The "from $10" in headlines/extensions reflects the cheapest in-zone option (Albertson).
Delivery is **never free** — do not write "free delivery" anywhere.

---

## 3. Ad schedule + bid adjustments

Go to **Ad schedule** tab and configure:

```
Active hours (Mon–Sun):  7:00 AM – 9:00 PM ET
```

Then go to **Bid adjustments** and add:

```
Time — 7 AM – 11 AM       +0%    (clean morning intent)
Time — 11 AM – 1:55 PM    +20%   (final pre-cutoff push for same-day)
Time — 2:00 PM – 5:00 PM  −40%   (cutoff passed; same-day dead, next-day still works)
Time — 5:00 PM – 9:00 PM  −10%   (decent next-day intent)

Device — Mobile           +15%
Device — Desktop          +0%
Device — Tablet           −20%
```

---

## 4. Ad groups

Create three ad groups inside the campaign:

```
Ad group 1:  Local Florist Intent · LI North Shore
             Default max CPC: $3.50
             Final URL:       https://makythedivaflowers.com/en/shop

Ad group 2:  Same-Day Urgency · LI North Shore
             Default max CPC: $4.00
             Final URL:       https://makythedivaflowers.com/en/shop?tag=same-day

Ad group 3:  Occasion · Birthday + Anniversary + Romance · LI
             Default max CPC: $3.50
             Final URL:       https://makythedivaflowers.com/en/shop/arrangements

Ad group 4:  Occasion · Sympathy · LI
             Default max CPC: $3.50
             Final URL:       https://makythedivaflowers.com/en/shop/sympathy
```

Note: ad group 3 was conceptually a single "Occasion" group during design, but sympathy
warrants its own ad group + landing page because the intent and tone differ sharply.

---

## 5. Keywords

Use the format shown — brackets `[ ]` for exact match, quotes `" "` for phrase match.
**No broad match anywhere in this campaign.** Broad match at $500/mo burns budget.

### Ad group 1 — Local Florist Intent

**Exact**
```
[florist albertson]
[florist roslyn]
[florist manhasset]
[florist great neck]
[florist port washington]
[flower shop albertson ny]
[flower shop roslyn ny]
[flower shop manhasset ny]
[flower shop great neck ny]
[flower delivery long island]
[long island florist]
[north shore florist]
```

**Phrase**
```
"florist near me"
"flower shop near me"
"local florist long island"
"best florist long island"
"florist nassau county"
```

### Ad group 2 — Same-Day Urgency

**Exact**
```
[same day flower delivery long island]
[same day flowers nassau county]
[flowers delivered today long island]
[same day flower delivery near me]
[flowers today albertson]
[same day flowers roslyn]
[same day flowers manhasset]
```

**Phrase**
```
"same day flower delivery"
"flowers delivered today"
"order flowers for today"
"flowers in 2 hours"
"florist open now"
```

### Ad group 3 — Birthday + Anniversary + Romance

**Exact**
```
[birthday flowers delivery long island]
[anniversary flowers long island]
[get well flowers long island]
[romantic flowers delivery long island]
[birthday bouquet delivery near me]
```

**Phrase**
```
"birthday flowers delivered"
"anniversary bouquet"
"romantic flowers"
"send flowers to long island"
"send flowers nassau"
```

### Ad group 4 — Sympathy

**Exact**
```
[sympathy flowers long island]
[sympathy bouquet delivery near me]
[condolence flowers long island]
```

**Phrase**
```
"sympathy flowers delivered"
"condolence flowers near me"
"flowers for funeral"
```

---

## 6. Negative keywords (campaign level)

Go to **Keywords → Negative keywords**, set scope to **Campaign**, and create a reusable list.

```
List name: Diva Flowers · Master Negatives
Match type: Phrase (apply phrase match to ALL of the below)
```

```
# Wholesale / supply chain
wholesale
bulk
supplier
wholesaler
distributor
import
exporter

# Bargain hunters
cheap
free
discount
99 cents
dollar tree
walmart
costco
trader joe
trader joes
trader joe's

# Informational searches
how to
tutorial
diy
arrange
arrangement diy
care
how long
meaning
symbolism
language of flowers
wikipedia
images
photos
clipart

# Wrong product
silk
fake
artificial
plastic
preserved
dried
seeds
plants
gardening
landscaping
garden center
nursery
soap
bath
edible
fruit
chocolate covered
candy
balloon

# Out of scope (separate campaigns later)
wedding
weddings
bridal
bouquet wedding
ceremony
reception
event planner
corporate event
holiday party

# Job seekers
jobs
hiring
career
salary
school
class
course
training
license
delivery driver
florist jobs

# Branded competitor terms (do NOT bid on these at $500/mo)
1800flowers
1-800-flowers
proflowers
ftd
teleflora
from you flowers
ode a la rose
urbanstems
bouqs
the bouqs

# Out of delivery zone
brooklyn
manhattan
the bronx
newark
new jersey
nj
hamptons
montauk

# Restricted / risky for Google policy
funeral home
funeral homes
casket
crematorium
```

Apply this list to the campaign once created.

---

## 7. Responsive Search Ads

One RSA per ad group. Each headline ≤ 30 chars; each description ≤ 90 chars.

**Pinning: leave all pins set to None at launch.** Pinning on a new campaign suppresses Quality
Score signals while Google is learning. After 60 days and 1,000+ impressions per ad group, you
can pin the strongest position-1 headline (the one with highest CTR) per ad group. The position
hints in the Mother's Day setup doc are kept here as a record of intent for that future review,
not as instructions to pin now.

### RSA — Ad group 1 (Local Florist Intent)

**Final URL**
```
https://makythedivaflowers.com/en/shop?utm_source=google&utm_medium=cpc&utm_campaign=always-on-search-2026&utm_content=local-florist
```

**Display path**
```
long-island / florist
```

**Headlines (15)** — the first 3 are position-1 candidates, the next 2 are position-2 candidates,
the rest rotate freely. Do NOT pin at launch.
```
Diva Flowers · Long Island
Florist on Long Island
Long Island's Romantic Florist
Same-Day by 2 PM
Designer-Made in Albertson
Romance, By the Stem
Hand-Tied Garden Roses
Family Owned Since 2014
Local Florist · Albertson
Lush, Romantic Bouquets
Crafted in Our Studio
Same-Day Delivery from $10
Bilingual Service · EN/ES
Order Online in 60 Seconds
12 Years on the North Shore
```

**Descriptions (4)**
```
Romantic, abundant bouquets designed in our Albertson studio. Same-day by 2 PM ET.
Long Island's florist for 12 years. Order online or call us — we'll handle the rest.
Hand-tied with garden roses, peonies & seasonal stems. Designed locally, never mass-made.
Serving Roslyn, Manhasset, Great Neck & Port Washington with same-day delivery.
```

### RSA — Ad group 2 (Same-Day Urgency)

**Final URL**
```
https://makythedivaflowers.com/en/shop?tag=same-day&utm_source=google&utm_medium=cpc&utm_campaign=always-on-search-2026&utm_content=same-day
```

**Display path**
```
same-day / delivery
```

**Headlines (15)** — no pinning at launch.
```
Same-Day Flower Delivery
Flowers Delivered Today
Order by 2 PM · Delivers Today
Long Island Florist
Same-Day Delivery from $10
Designer Bouquets · Today
Lush, Romantic, Hand-Tied
Roslyn · Manhasset · GN
No Cookie-Cutter Bouquets
12 Years on the North Shore
Crafted in Our Albertson Studio
Send Flowers in 60 Seconds
Call · Text · Order Online
Bilingual: EN & ES
Romance, By the Stem
```

**Descriptions (4)**
```
Order by 2 PM, delivered today across Long Island's North Shore. Designer-made, never boxed.
Skip the national sites. We design every bouquet locally — and deliver it same-day.
Hand-tied romantic bouquets from a real Long Island florist. Order online or call now.
Serving Albertson, Roslyn, Manhasset, Great Neck & Port Washington. 12 years local.
```

### RSA — Ad group 3 (Birthday + Anniversary + Romance)

**Final URL**
```
https://makythedivaflowers.com/en/shop/arrangements?utm_source=google&utm_medium=cpc&utm_campaign=always-on-search-2026&utm_content=occasion
```

**Display path**
```
birthday / anniversary
```

**Headlines (15)** — no pinning at launch.
```
Birthday Flowers · Long Island
Anniversary Bouquets · LI
Romantic Flowers · Long Island
Designer-Made on Long Island
Same-Day by 2 PM
Romantic, Hand-Tied Bouquets
Garden Roses & Peonies
Family Owned Since 2014
Crafted in Albertson Studio
Same-Day Delivery from $10
Order Online in 60 Seconds
Birthday · Anniversary · Romance
Long Island's Romantic Florist
Bilingual: EN & ES
Romance, By the Stem
```

**Descriptions (4)**
```
Designer arrangements for birthdays, anniversaries & romance. Delivered same-day across LI.
Romantic, abundant bouquets — never mass-made. Designed in our Albertson studio since 2014.
Order by 2 PM for same-day delivery. Hand-tied with garden roses, peonies & seasonal stems.
Send flowers to Roslyn, Manhasset, Great Neck, Port Washington & beyond. 12 years local.
```

### RSA — Ad group 4 (Sympathy)

**Final URL**
```
https://makythedivaflowers.com/en/shop/sympathy?utm_source=google&utm_medium=cpc&utm_campaign=always-on-search-2026&utm_content=sympathy
```

**Display path**
```
sympathy / flowers
```

**Headlines (15)** — no pinning at launch.
```
Sympathy Flowers · Long Island
Condolence Flowers · LI
Sympathy Bouquets · Same-Day
Designer-Made on Long Island
Same-Day by 2 PM
Restrained, Elegant Designs
Family Owned Since 2014
Crafted in Albertson Studio
Same-Day Delivery from $10
Order Online or Call
White Peonies & Lisianthus
Hand-Tied with Care
Long Island Florist · 12 Years
Bilingual: EN & ES
Romance, By the Stem
```

**Descriptions (4)**
```
Restrained, elegant sympathy arrangements designed in our Albertson studio since 2014.
Same-day delivery by 2 PM across Long Island's North Shore. Order online or call us.
White peonies, lisianthus, eucalyptus — hand-tied with care for every condolence.
Serving Roslyn, Manhasset, Great Neck, Port Washington and beyond. Real Long Island florist.
```

---

## 8. Extensions (Assets — campaign level)

### Sitelinks (4)

```
Text:        Shop All Bouquets
Final URL:   https://makythedivaflowers.com/en/shop
Description 1: Romantic designs, hand-tied locally.
Description 2: Same-day delivery by 2 PM ET.

Text:        Subscriptions
Final URL:   https://makythedivaflowers.com/en/subscriptions
Description 1: Weekly or monthly fresh florals.
Description 2: Skip or pause anytime.

Text:        About Diva Flowers
Final URL:   https://makythedivaflowers.com/en/story
Description 1: Family-owned in Albertson since 2014.
Description 2: 12 years on the North Shore.

Text:        Contact & Visit
Final URL:   https://makythedivaflowers.com/en/contact
Description 1: 1077 Willis Ave, Albertson NY.
Description 2: Call, text, or stop by.
```

### Callouts (10)

```
Same-Day by 2 PM
Designer-Made Locally
Family Owned Since 2014
Same-Day Delivery from $10
Hand-Tied Bouquets
Garden Roses & Peonies
Bilingual: English & Español
1077 Willis Ave, Albertson
Real Long Island Florist
12 Years on the North Shore
```

### Structured snippets

```
Header: Types
Values: Birthday, Anniversary, Sympathy, Romance, Just Because, Subscriptions

Header: Service catalog
Values: Same-Day Delivery, In-Store Pickup, Subscriptions, Custom Arrangements
```

### Call asset

```
Phone number:  +1 (516) 484-3456
Schedule:      Mon–Fri  9:00 AM – 7:00 PM ET
               Sat      9:00 AM – 6:00 PM ET
               Sun     10:00 AM – 4:00 PM ET
Conversion:    Track calls 60+ seconds → import as a secondary conversion
```

> Use the **studio line** (516-484-3456), NOT the mobile (516-851-2815). Google Ads needs a
> phone that is reliably answered during business hours. Maky's mobile stays for the in-site
> "Text Maky" modal.

### Location asset

```
Link to your verified Google Business Profile.
Address must show: 1077 Willis Ave, Albertson, NY 11507
(Go to Assets → Location → Connect Google Business Profile)
```

### Image extensions (4–6 — generated via Higgsfield, see README §3)

Upload all to **Assets → Image** at the campaign level. Square (1200×1200) and landscape
(1200×628) variants for each concept.

```
1. Hero — Lush garden-rose bouquet, hand of florist tying ribbon
2. Studio — Florist arranging flowers at marble worktable
3. Sympathy — Restrained, elegant white arrangement
4. Same-day proof — Bouquet at doorstep
5. Anniversary/Romance — Bedroom vignette with bouquet on marble nightstand
6. Bouquet variety grid (landscape only)
```

### Price extensions (optional, recommended)

Prices below match the real `Standard` / `Lush` / `Opulent` tiers in `data/products.ts`.
Verify before publishing if the catalog has changed.

```
Header: Bouquets · Same-Day Delivery from $10
Currency: USD

  Petite Romance     from $79    →  https://makythedivaflowers.com/en/shop
  Studio Classic     from $150   →  https://makythedivaflowers.com/en/shop
  Lush Designer      from $250   →  https://makythedivaflowers.com/en/shop
  Statement Piece    from $400   →  https://makythedivaflowers.com/en/shop
```

### Promotion extension

Leave empty until there's a real promo to run.

---

## 9. Campaign URL options

Go to **Settings → Campaign URL options** and set:

```
Tracking template: {lpurl}?gclid={gclid}
Final URL suffix:  utm_source=google&utm_medium=cpc&utm_campaign=always-on-search-2026
```

This complements the per-ad UTMs in the Final URLs above and ensures GA4 attribution
even if an RSA is created later without manual UTMs.

---

## 10. Pre-launch checklist (block launch if any item is unchecked)

- [ ] Conversion tracking complete (§0): all four events firing in GA4 Realtime
- [ ] `purchase` imported to Google Ads as PRIMARY with dynamic value
- [ ] `phone_click`, `whatsapp_click` imported as PRIMARY with fixed values
- [ ] `sms_click` imported as SECONDARY
- [ ] Auto-tagging ON
- [ ] GA4 ↔ Google Ads linked
- [ ] Google Business Profile linked, address Albertson NY 11507
- [ ] All four ad group Final URLs return 200 in production
- [ ] All four sitelink URLs return 200
- [ ] `?tag=same-day` actually filters the shop grid (verify in production)
- [ ] Image extensions uploaded (at least 2 square + 2 landscape)
- [ ] Negative keyword list applied to campaign
- [ ] Test purchase fires `purchase` in GA4 Realtime within 60 sec
- [ ] Tap-test on mobile fires `phone_click`, `whatsapp_click`, `sms_click` within 60 sec
- [ ] Billing active and payment method valid

---

*Content prepared 2026-05-11. Update price extension and verify same-day filter URL before publishing.*
