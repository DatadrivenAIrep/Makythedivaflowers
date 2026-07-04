# Weddings + Events Conversion Sprint ("Camino 1") — Design Spec

- **Date:** 2026-07-03
- **Author:** Santiago (with Claude)
- **Status:** Draft for owner review
- **Strategy:** Proof-first conversion sprint on the existing weddings + events funnel, plus two cheap high-value grafts (home events teaser, JSON-LD). No external-SEO campaign, no ads, no admin/CRM build.

---

## 1. Goal & Success

**Goal:** Book more weddings and events by lifting on-page conversion (more visitors start and submit the inquiry forms) and internal discovery — using **only real proof**, and making sure a submitted lead actually reaches a human.

**Success signals:**
- Both service pages present real social proof (rating + real testimonials) above the fold, a low-friction fast-lane to contact, and a clear "what happens next."
- The inquiry form feels short and communicates its one required phone number honestly.
- Every submitted inquiry triggers an **email alert to the shop's inbox** (today it silently lands in a file).
- Events gets organic discovery from the home page (parity with weddings).
- Google can read the weddings FAQ and the services as structured data.

**Non-goals (this sprint):** paid traffic / off-site SEO content, an admin inquiries inbox/CRM, a full redesign, new photography. These are noted as follow-ups in §8.

---

## 2. Current State (grounded in the codebase)

- **Weddings** (`app/[locale]/weddings/page.tsx`): Hero → ProcessStrip → PricingIntent → WeddingStories → WeddingsFAQ → WeddingsForm. Structurally strong, warm copy. Weakness is *momentum*: one CTA in the hero, then a long educational scroll with no intermediate ask, no trust signal above the fold, and the gallery lightbox is a dead end.
- **Events** (`app/[locale]/events/page.tsx`): EventsHero → UseCaseGrid → ProcessStrip (`events.process`) → EventsForm. Thinner on proof (no portfolio, no testimonials, use-case cards end without a CTA) and has **zero discovery from the home page**.
- **Lead capture** (`app/api/inquiry/route.ts`, `lib/inquiry-storage.ts`): validated submissions are written to `pending-inquiries.json` and only `console.log`'d. No email/notify. The success copy promises "one business day," but nothing guarantees a human sees the lead.
- **Discovery** (`app/[locale]/page.tsx`): home renders `WeddingsTeaser` but there is **no `EventsTeaser`**.
- **Social proof** (`data/reviews.ts`): 4.9★ / 127 reviews, with **real wedding/celebration reviews** (e.g. Blanca Duarte — `occasion: "Boda"` — about a bridal bouquet). None of this is surfaced on the service pages today; it only feeds home `GoogleReviews`.
- **SEO** (`components/seo/*`): global `LocalBusinessLD`, `PdpStructuredData`, and an unused `BreadcrumbListLD`. **No `FAQPage` schema** despite 6 ready-made bilingual Q&As in `data/wedding-faq.ts`; no `Service` schema on either page.
- **Contact infra** (`components/contact/TextMakyModal.tsx`, `lib/text-maky-links.ts`, `data/site.ts`): a WhatsApp/SMS/call modal already exists, driven by `ContactContextProvider` (`useContactContext()` → `open`/`setOpen`/`override`) and the shop number `SITE.mobile.e164` (+1 516-851-2815). **Reusable as-is.**
- **Form schema** (`schemas/inquiry.ts`): `baseContact.phone` is **already required** (10–15 digits). The UI just fails to mark it required — an honesty/clarity gap, not a schema change.

---

## 3. Locked Decisions (owner)

1. **Portfolio (4 wedding events in `data/wedding-events.ts`) stays as-is** — the owner confirms all four are real events. No removal, no relabeling. (The `// Placeholder events` code comment is stale and will be removed to avoid future confusion — content unchanged.)
2. **No price anchor.** Weddings pricing stays quote-only, no numbers. For consistency, the FAQ minimum-spend answer that currently states "$5,000 / $1,500" will be **softened to remove the dollar figures** (see §4-A5) — flagged for owner review.
3. **Phone required + collapse optional fields.** Phone is already schema-required; surface it as required in the UI, reorder the form so the short required set is first, and tuck optional fields under a "more details" disclosure.
4. **Lead alert = email to the shop inbox**, configured on the Hostinger host via env var. Destination address: owner to provide → `INQUIRY_NOTIFY_EMAIL`.
5. **Site runs on the Hostinger Node host (not auto-deploy).** All of this ships live only after a manual Hostinger deploy; env vars are set there. (See §6.)
6. **WhatsApp fast-lane** reuses the existing `TextMakyModal` — no new number, no new service.

---

## 4. Scope — the changes

Each change lists: **what → why → files/keys → constraints**. Grouped by block. Every new copy string ships in **both** `messages/en.json` and `messages/es.json` (bilingual parity is mandatory).

### Block A — Confianza y prueba (biggest booking lift)

**A1. Rating chip + real testimonials on both service pages.**
- *What:* A small "4.9 ★ · 127 reseñas" chip near the top of `WeddingsHero` and `EventsHero`, and a testimonials section on each page drawing from `data/reviews.ts`.
  - Weddings: filter reviews by wedding/celebration occasions (`occasion` ∈ {"Boda", and celebration-type occasions}); show 2–3.
  - Events: fewer occasion-specific reviews may exist → show top general 5★ quotes + the aggregate rating. If none read as "event," show only the rating chip and 2 strongest general quotes (never fabricate an event-specific quote).
- *Why:* Real credibility currently only lives on the home page; high-intent prospects who land directly on the service page never see it.
- *Files:* new shared `components/inquiry/Testimonials.tsx` (or `components/social/Testimonials.tsx`) reading `REVIEWS` + `REVIEWS_AGGREGATE` from `data/reviews.ts`; rating-chip element added to `WeddingsHero.tsx` and `EventsHero.tsx`; section slot added to both `page.tsx` (weddings: between `WeddingStories` and `WeddingsFAQ`; events: after `UseCaseGrid`). New keys `weddings.testimonials.*` and `events.testimonials.*` (eyebrow/title) in both message files.
- *Constraints:* quotes must be verbatim from `data/reviews.ts` (already real). Render the correct locale via `text[locale]`.

**A2. "Qué pasa cuando escribes" (what-happens-next) block above each form.**
- *What:* A short 3-step reassurance strip immediately before the `#inquire` form: (1) you send this, (2) we reply **by email/WhatsApp within one business day**, (3) we set up your consultation. States timeline + channel explicitly.
- *Why:* Removes the "did this go into a void?" anxiety that kills form-start rate; aligns the page with the existing `form.success_body` promise.
- *Files:* new `components/inquiry/WhatHappensNext.tsx`; rendered in both `page.tsx` just above the form section. New keys `weddings.next_steps.*` / `events.next_steps.*` (title + 3 step labels) in both message files. Reuse the "one business day" wording already in `*.form.success_body`.
- *Constraints:* no "free delivery" or free-logistics language (project rule). Channel wording must match reality (email primary; WhatsApp if monitored).

**A3. WhatsApp fast-lane CTA in both heros.**
- *What:* A secondary button beside the primary hero CTA that opens the existing `TextMakyModal` (e.g. "Escríbenos por WhatsApp" / "Text us"). For the prospect who won't fill a multi-field form.
- *Why:* Captures high-intent-but-form-averse leads via a channel that already exists.
- *Files:* a small **client** trigger component (heros are server components) that calls `useContactContext().setOpen(true)` with an appropriate `override` subject, following the existing nav "Text Maky" trigger pattern; placed in `WeddingsHero.tsx` / `EventsHero.tsx`. If `getSubjectKey` (`lib/contact-subject.ts`) lacks weddings/events subjects, add subject keys + `text_modal.subjects.*` strings (both locales). Reuse `buildWhatsappHref` / `SITE.mobile.e164` — no new number.
- *Constraints:* verify the shop actively monitors WhatsApp before promising it as a fast reply channel.

**A4. Gallery → form bridge.**
- *What:* Add a "See yourself here? / ¿Te imaginas aquí?" CTA to `#inquire` inside `WeddingLightbox` and as a banner below `WeddingStories`.
- *Why:* The lightbox is currently a dead end; prospects lose momentum after browsing.
- *Files:* `components/weddings/WeddingLightbox.tsx` (CTA to `#inquire`), `components/weddings/WeddingStories.tsx` (banner). New key `weddings.stories.cta` (both locales).

**A5. Pricing consistency (quote-only).**
- *What:* Keep `PricingIntent` numberless (unchanged intent). **Soften the FAQ minimum-spend answer** in `data/wedding-faq.ts` to remove "$5,000 / $1,500" (e.g. "We work to a studio minimum, which we share during your consultation based on scope" / Spanish equivalent).
- *Why:* Owner chose quote-only; a hard dollar figure in the FAQ contradicts that.
- *Files:* `data/wedding-faq.ts` (both locales).
- *Owner review point:* this removes a natural budget pre-qualifier — may slightly increase unqualified leads. Flagged; owner can veto and keep the number.

### Block B — Fricción y descubrimiento

**B1. Reduce form friction + honest required phone.**
- *What:* In `WeddingsForm.tsx` and `EventsForm.tsx`: (a) mark the phone `FormField` as `required` (schema already enforces it); (b) reorder so the short required set (name, email, phone, + events: company/frequency) is first; (c) wrap the optional fields (weddings: date, venue, guests, budget, source; events: guests, budget) in a collapsible "Más detalles / More details" disclosure, collapsed by default.
- *Why:* A form that *looks* short gets more starts; the current UI hides that phone is mandatory, causing confusing validation errors.
- *Files:* `components/inquiry/WeddingsForm.tsx`, `components/inquiry/EventsForm.tsx`; a small reusable disclosure (new `components/ui/form/Disclosure.tsx` or reuse an existing accordion pattern). New key `*.form.more_details` (both locales). **No schema change** — `schemas/inquiry.ts` stays as-is.
- *Constraints:* keep validation behavior identical; the `vibe` textarea stays required (min 10 chars).

**B2. Home `EventsTeaser` (parity with weddings).**
- *What:* Clone `WeddingsTeaser.tsx` → `EventsTeaser.tsx` with `home.events_teaser.{eyebrow,title,cta}` keys, linking to `/events`. Insert in `app/[locale]/page.tsx` right after `WeddingsTeaser`.
- *Why:* Events has no organic discovery from the highest-traffic page.
- *Files:* new `components/home/EventsTeaser.tsx`; edit `app/[locale]/page.tsx`; new keys in both message files.
- *Content dependency:* needs a **real** corporate/event image (no-AI rule). If none exists, reuse an appropriate real arrangement photo already in the repo and note the swap for a future real events photo. See §5.

**B3. JSON-LD: FAQPage (weddings) + Service (both).**
- *What:* (a) `FAQPage` structured data rendered from `data/wedding-faq.ts` on the weddings page (per-locale). (b) `Service` schema on both pages: `name`, `description`, `areaServed` ("Long Island" / "NYC metro"), `provider` → the existing LocalBusiness, `serviceType`. No price in the schema (consistent with quote-only).
- *Why:* Competes for rich snippets on high-intent local queries without an SEO content project.
- *Files:* new `components/seo/WeddingFaqLD.tsx` and `components/seo/ServiceLD.tsx` (follow the existing `LocalBusinessLD` / `PdpStructuredData` JSON-LD pattern); mount in `weddings/page.tsx` and `events/page.tsx`.
- *Constraints:* **Read `node_modules/next/dist/docs/` before adding route-level structured data** (per `AGENTS.md` — this Next.js is non-standard). Render bilingual; keep FAQ JSON-LD text in sync with the softened A5 answer.

### Block C — Lead alert (the linchpin)

**C1. Email notification on inquiry submit.**
- *What:* After `saveInquiry` succeeds in `app/api/inquiry/route.ts`, send an email to `INQUIRY_NOTIFY_EMAIL` with the inquiry type, contact details, and payload summary. **Best-effort:** wrap in try/catch so a mail failure never breaks the save or the user's success response; log failures.
- *Why:* Today leads accumulate unseen. This is the single change without which every conversion gain is wasted.
- *Files:* new `lib/notify-inquiry.ts` (provider-agnostic send); call it from `app/api/inquiry/route.ts` after the existing `saveInquiry`.
- *Provider:* recommend **SMTP via nodemailer** given the self-hosted Hostinger host (uses a domain mailbox, no third-party signup) — env vars `INQUIRY_NOTIFY_EMAIL`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`. Resend (HTTP `RESEND_API_KEY`) is an acceptable alternative if outbound SMTP is blocked. Final provider chosen in the implementation plan.
- *Constraints:* the flat-file save is unchanged (still the durable record). Do not log full PII beyond what's needed. See §6 for the deploy reality — this only works once the env vars exist **on the Hostinger host** and the site is redeployed there.

---

## 5. Data & content dependencies (owner-provided)

- **Destination email** for `INQUIRY_NOTIFY_EMAIL` (and SMTP creds, or a Resend key). — *blocks C1 going live, not the build.*
- **A real events/corporate image** for `EventsTeaser` and (optionally) an events hero refresh. If unavailable now, we ship with a real existing arrangement photo and mark it for later swap. — *no-AI-photos rule applies.*
- **Confirmation WhatsApp is monitored** (for A2/A3 channel promises).
- **FAQ A5 veto?** confirm removing the dollar minimum is OK.

---

## 6. Constraints & Risks

- **Hostinger deploy reality (critical):** the public site runs on a **separate Hostinger Node host that is NOT auto-deployed from GitHub**. Merging to `main` does **not** update the live site. Nothing here — especially the C1 email alert — is live until the site is manually redeployed to Hostinger and `INQUIRY_NOTIFY_EMAIL` + mail creds are set **there**. Verify the inquiry API route's runtime on that host before assuming env vars are read.
- **Honesty of proof:** all portfolio events and every surfaced testimonial must be real. Portfolio stays because the owner confirms it's real; testimonials come verbatim from `data/reviews.ts`. Do not invent event-specific quotes for the events page.
- **No AI product photos** (project rule): the `EventsTeaser` image and any new imagery use real assets only.
- **Never claim "free delivery"** (project rule): the what-happens-next block, teaser, and Service schema must avoid free-delivery/free-logistics language.
- **Bilingual parity:** every new key in both `messages/en.json` and `messages/es.json`; JSON-LD rendered per locale.
- **Non-standard Next.js** (`AGENTS.md`): read `node_modules/next/dist/docs/` before route-metadata / JSON-LD / API changes.
- **No schema/validation regressions:** `schemas/inquiry.ts` is unchanged; form edits are presentational + ordering only.

---

## 7. Verification approach

- **Unit/behavior:** form still validates (phone required already enforced), success/error states unchanged; testimonials render from real data per locale; notify module is best-effort (mail failure ⇒ still `200 ok`, lead still saved).
- **Preview:** run the dev server and verify on both `/en` and `/es` — weddings & events pages (rating chip, testimonials, what-happens-next, WhatsApp button opens the modal, collapsed form, gallery→form CTA), home (EventsTeaser present, links to `/events`), and view-source for FAQPage/Service JSON-LD validity.
- **Notify:** submit a test inquiry against a local SMTP/Resend sandbox and confirm the email arrives; confirm a forced mail error does not break the API response.
- **Honesty pass:** grep new copy for "free delivery" / invented claims; confirm no fabricated testimonials.

---

## 8. Out of scope / follow-ups

- **Admin inquiries inbox** (view/filter/mark-replied) — deferred; email is the working surface this sprint.
- **Off-site SEO / local content** ("bodas en Long Island / Nassau") and Google Business optimization.
- **Real events photography** and a dedicated `public/events/` set.
- **Analytics on funnel** (form-start vs submit) to measure lift.
- **Auto-reply confirmation email to the lead** (with reference ID) — natural next step after C1.
