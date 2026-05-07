# Mother's Day 2026 — Google Ads Operations

Setup guide: `mothers-day-2026-setup.md`. Open both files side-by-side while building the campaign.

---

## Order of operations

1. **Tue May 5 (today, ~1 hour):**
   - Open Google Ads, complete billing setup.
   - Verify Google Business Profile is active and address shows 1077 Willis Ave, Albertson, NY 11507.
   - Create the campaign in PAUSED state, paste content from setup.md panel-by-panel.

2. **Wed May 6 (~1 hour):**
   - Link GA4 property.
   - Import `purchase` as primary conversion goal.
   - Auto-tagging ON.
   - Run 1 real test purchase from `https://makythedivaflowers.com/en/mothers-day` → confirm `purchase` event in GA4 Realtime within 30 seconds.
   - 6 PM: ENABLE the campaign.

3. **Thu–Fri (5 min/day):**
   - Check search terms. Add irrelevant matches as negative keywords.
   - Pause weakest headlines if CTR < 4%.

4. **Sat May 9:**
   - 12 PM – 4 PM: +30% bid adjustment is scheduled (weekend window). No action needed unless a top keyword is running hot — then bump max CPC manually for that keyword only.

5. **Sun May 10 — Mother's Day:**
   - 8 AM: campaign auto-resumes per ad schedule. This is peak intent — last-chance buyers.
   - 12 PM – 5 PM: +50% bid adjustment is scheduled (cutoff-push window).
   - 5:30 PM: PAUSE the campaign at the campaign level (30 min before the 6 PM order cutoff).

6. **Mon May 11:** export report. Save remarketing audience "MD 2026 visitors". Plan Father's Day (June 21).

---

## Pre-launch checklist (block launch if any item is unchecked)

- [ ] Google Ads billing active.
- [ ] GA4 ↔ Google Ads linked.
- [ ] Auto-tagging ON.
- [ ] `purchase` imported as primary conversion.
- [ ] Test purchase fires `purchase` in GA4 Realtime.
- [ ] Google Business Profile linked, address Albertson NY 11507.
- [ ] Landing page `https://makythedivaflowers.com/en/mothers-day` returns 200 in production.
- [ ] All 4 sitelink URLs return 200.

---

## Daily monitoring (5 min)

| Metric | Red flag | Action |
|---|---|---|
| CTR | < 4% | Pause weakest headline |
| Avg CPC | > $5.00 | Lower max bid or prune phrase keywords |
| Landing CR | < 2% | Investigate — likely checkout or cutoff-date confusion |
| Search terms | Irrelevant matches | Add as negative keyword |
| Top impression share | < 60% | Increase budget IF conversion rate ≥ 3% |

---

## Post-campaign

1. **Sun May 10 at 5:30 PM:** PAUSE campaign (30 min before the 6 PM order cutoff).
2. **Mon May 11:** export full report — Campaign + Ad group + Search terms + Demographics + Devices.
3. Save audience "MD 2026 visitors" → Audiences → Save → reuse for Father's Day and MD 2027.
4. Identify winning keywords and headlines → memo for Father's Day campaign.
5. Begin Merchant Center setup (3–5 day approval). Goal: Shopping ads ready for Father's Day.
