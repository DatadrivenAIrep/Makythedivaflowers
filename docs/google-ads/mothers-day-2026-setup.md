# Mother's Day 2026 — Google Ads Setup Guide

Open this file side-by-side with the Google Ads UI. Work top to bottom, one section at a time.
Copy blocks verbatim — every field value has been pre-written for you.

---

## 1. Campaign settings

Create a new campaign and fill in each field exactly as shown:

```
Campaign name:        Mother's Day 2026 - Search
Objective:            Sales
Campaign type:        Search
Networks:             Google search only (uncheck Search Partners, uncheck Display Network)
Locations:            Nassau County NY + Queens NY + Western Suffolk County NY
                      (select each by name; targeting mode → "Presence: People in your targeted locations")
Languages:            English
Budget:               $40 Wed  |  $80 Thu  |  $100 Fri  |  $130 Sat  |  $150 Sun
                      (change the daily budget each morning — do NOT use a campaign-level lifetime cap)
                      Total = $500. Sunday gets the most because it is the cutoff day with peak intent.
Bidding:              Manual CPC — max bid $5.00
Ad rotation:          Optimize: prefer best performing
Start date:           Wednesday May 6, 2026 (leave campaign PAUSED until pre-launch checklist is complete)
End date:             Sunday May 10, 2026  17:30 ET  (pause 30 min before the 6 PM order cutoff)
```

---

## 2. Ad schedule + bid adjustments

After saving campaign settings, go to **Ad schedule** tab and configure:

```
Active hours:         Wed–Sat: 7:00 AM – 9:00 PM ET
                      Sun May 10: 8:00 AM – 5:30 PM ET   (last 30 min reserved for fulfillment)
```

Then go to **Bid adjustments** and add:

```
Device — Mobile:      +20%
Time — Weekdays 7 PM – 9 PM:   +15%
Time — Saturday 12 PM – 4 PM:  +30%   (weekend buying window)
Time — Sunday 12 PM – 5 PM:    +50%   (cutoff-push window — last chance buyers)
```

Note: campaign is paused Sunday at 5:30 PM (30 min before the 6 PM order cutoff).

---

## 3. Ad group

Create one ad group inside the campaign:

```
Ad group name:        Mother's Day Flowers · Long Island
Default max CPC:      $5.00
```

---

## 4. Keywords

Inside the ad group, open the **Keywords** tab and add the following.
Use the format shown — brackets `[ ]` for exact match, quotes `" "` for phrase match.

### Exact match

```
[mother's day flowers long island]
[same day flowers nassau county]
[florist long island mother's day]
[flower delivery garden city]
[mother's day bouquet delivery]
```

### Phrase match

```
"mother's day flowers near me"
"flower delivery long island"
"same day flowers queens"
"florist albertson"
"mother's day delivery sunday"
"flower shop nassau"
"florist near me mother's day"
```

---

## 5. Negative keywords (campaign level)

Go to **Keywords → Negative keywords**, set scope to **Campaign**, and add each term below (broad match negative — no brackets or quotes needed here):

```
cheap
wholesale
wedding
funeral
1800flowers
teleflora
proflowers
silk
fake
diy
wikipedia
meaning
```

---

## 6. Responsive Search Ad (RSA)

Inside the ad group, click **New ad → Responsive search ad**.

### Final URL

```
https://makythedivaflowers.com/en/mothers-day?utm_source=google&utm_medium=cpc&utm_campaign=mothers-day-2026&utm_content=rsa-main
```

### Display path (two fields after the slash)

```
mothers-day / long-island
```

### Headlines — enter all 15 (each field ≤ 30 characters)

```
Mother's Day Flowers
Long Island Same-Day
Order Through Sunday
Hand-Delivered Florist
As Seen in Vogue & Brides
Nassau · Queens · Suffolk
Real Studio Since 2014
Sunday Delivery May 10
Skip the 1-800 Box
Garden-Style Bouquets
From $94 · Same-Day
Order Today, Arrives Today
Romance, by the Stem
★ 4.9 · 127 Google Reviews
Florist in Albertson, NY
```

### Descriptions — enter all 4 (each field ≤ 90 characters)

```
Hand-tied florals delivered same-day across Long Island. Orders accepted until Sun May 10 6 PM.
As featured in Vogue, The Cut & Brides. Real florist studio, never a warehouse.
Lush garden bouquets from $94. Hand-delivered, never boxed. Same-day Mother's Day delivery.
Same-day to Nassau, Queens & W. Suffolk. Free card. Order until Sun May 10 6 PM.
```

### Long headlines — enter 1 to 3 (each field ≤ 90 characters)

If Google asks for "Long headlines" (newer Search-ads asset; not always shown — skip if not in your UI):

```
Mother's Day Flowers Hand-Delivered Across Long Island — Open Through Sunday May 10
Real Florist Studio in Albertson NY · Same-Day Mother's Day Delivery · 4.9★ Reviews
Featured in Vogue & Brides · Hand-Tied Mother's Day Bouquets · Same-Day Long Island
```

### Pinning

Leave all pins set to **None**. Pinning headlines on a new account lowers Quality Score — let Google rotate freely.

---

## 7. Extensions (Assets)

Go to **Assets** (formerly Extensions) at the campaign level and add the following.

### Sitelinks (add 4)

```
Text: The MD Edit
Final URL: https://makythedivaflowers.com/en/mothers-day#md-edit

Text: How Delivery Works
Final URL: https://makythedivaflowers.com/en/mothers-day#faq

Text: Reviews
Final URL: https://makythedivaflowers.com/en/mothers-day#reviews

Text: Visit the Studio
Final URL: https://makythedivaflowers.com/en/contact
```

### Callouts (add all 5)

```
Order Until Sun 6 PM
Sunday Delivery
Free Card
Hand-Delivered
As Seen in Vogue
```

### Call asset

```
Phone number: +1 (516) 484-3456
Schedule: 8:00 AM – 6:00 PM   Wednesday through Sunday
```

### Location asset

```
Link to your verified Google Business Profile.
Address must show: 1077 Willis Ave, Albertson, NY 11507
(Go to Assets → Location → Connect Google Business Profile)
```

### Promotion asset

```
Occasion: Mother's Day
Promotion headline: Order Until Sun May 10 6 PM
Start: May 6, 2026
End:   May 10, 2026 at 6:00 PM
```

---

## 8. Conversion tracking

Complete this section **before enabling the campaign**. Go to **Tools** in the top nav.

```
Step 1: Tools → Linked accounts → Google Analytics → Link your GA4 property

Step 2: Tools → Conversions → New conversion action
         → Import → Google Analytics 4
         → Select the "purchase" event → mark as PRIMARY conversion

Step 3: Settings → Account settings → Auto-tagging → ON

Step 4: Conversion window settings:
         Click-through conversion window: 7 days
         View-through conversion window: 1 day
```

---

## 9. Final URL parameters (campaign level)

Go to **Settings → Campaign URL options** and set:

```
{campaignid}  →  mothers-day-2026
{adgroupid}   →  main
```

This ensures GA4 reports show clean campaign/ad-group labels instead of numeric IDs.

---

*Content prepared May 5, 2026. All URLs, phone number, and dates are final — no edits needed before pasting.*
