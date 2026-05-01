# Plan 4 — Quality, A11y, SEO & Motion Polish (v1 Launch-Readiness)

**Date:** 2026-05-01
**Author:** Brainstorming session, Santiago Cardona
**Status:** Approved, ready for implementation planning
**Predecessors:** Plans 1–3 (foundation, catalog/PDP, cart/checkout/content) all complete.
**Spec reference:** `docs/superpowers/specs/2026-04-30-diva-flowers-design.md`

---

## 1. Goal & Scope

Take v1 from "feature-complete" to "launch-ready" by closing every gap between current state and the spec's Definition of Done (§12), with content placeholders centralized for future client swaps.

### In scope

- Audit current state vs. spec DoD across motion coverage, a11y, SEO/structured data, OG images, perf, taste-skill pre-flight, i18n gaps, empty/loading/error states.
- Centralize content placeholders (studio address, founding year, hero tagline, same-day cutoff, phone) into `data/site.ts`.
- Fix everything the audit surfaces, with a per-category "defer to v2" rule if scope blows up.
- Manual Lighthouse pass on home / catalog / PDP — fix to ≥ 95 perf / 100 a11y.
- Final pre-launch QA pass: manual click-through EN + ES, keyboard-only, reduced-motion, mobile breakpoint.

### Out of scope (explicit non-goals)

- Stripe payment, real auth, real email send, CMS migration, real photography swap (all v2).
- Lighthouse CI gating (v2).
- New features beyond the v1 spec.
- Open items §13 *content values* — only the centralization is in scope; the values stay placeholder until the client provides them.

## 2. Plan Structure

The plan has three phases in one document.

### Phase 1 — Audit (single task)

Task 1.1 writes a single audit document committed to `docs/superpowers/audits/2026-05-01-plan-4-audit.md`. The audit walks the spec DoD section by section and records, for each item: ✅ present / ⚠️ partial / ❌ missing, plus a one-line note. The audit is the source of truth for Phase 2.

### Phase 2 — Execution (one task per audit category)

Each Phase 2 task references the audit by name and fixes its findings. Categories:

- **2.1 Content centralization** (deterministic, not audit-driven) — `data/site.ts` with all §13 placeholders, refactor every reference.
- **2.2 Motion coverage** — apply primitives (`MagneticButton`, `BloomImage`, `StaggerGroup`, `Grain`, `KineticMarquee`, `ArchSVG`) to locations the audit flagged.
- **2.3 A11y fixes** — focus rings, alt text, headings, reduced-motion gaps. Add `axe-core` via Playwright on home / PDP / checkout once, in this task.
- **2.4 SEO + structured data** — per-page metadata, `Product` / `LocalBusiness` / `BreadcrumbList` JSON-LD, OG images, `robots.ts` if missing.
- **2.5 Empty / loading / error states** — anywhere data is loaded that's missing one.
- **2.6 Taste-skill pre-flight** — fix any spec §12 checklist violation (no `h-screen`, no `top/left/width/height` animations, perpetual animations isolated, etc.).
- **2.7 Perf pass** — manual Lighthouse, fix specific findings (image priorities, font preload, JS bundle, route-level `loading.tsx`, dynamic imports for heavy client motion).
- **2.8 i18n gap sweep** — diff `messages/en.json` vs `messages/es.json` keys + grep for hardcoded strings outside message bundles. Fill anything missing.

**Scope-creep guard:** each Phase 2 task includes a rule — *"if audit finds > 10 fixes in this category, defer 'nice-to-have' subset to v2 with rationale recorded in the audit doc."*

### Phase 3 — Verification (single task)

Task 3.1: pre-launch QA. Manual click-through EN + ES, keyboard-only nav, reduced-motion, mobile breakpoint at `md:` and below. Re-run Lighthouse on home / catalog / PDP. Re-run Playwright e2e + Vitest. All green = done.

## 3. Audit Deliverable Format

Audit doc: `docs/superpowers/audits/2026-05-01-plan-4-audit.md`. One section per Phase 2 category, mirroring the DoD checklist. Each finding is a single bullet:

```
- <STATUS> — <spec ref> — <location> — <one-line note>
```

`STATUS` ∈ `OK | PARTIAL | MISSING | DEFER`.

Example skeleton:

```md
## 2.2 Motion coverage

- OK       — §4.3 magnetic CTAs — applied on home hero, weddings hero
- PARTIAL  — §4.3 magnetic CTAs — missing on PDP "Add to bag"
- MISSING  — §4.3 bloom hover — not applied on /shop product cards
- OK       — §4.3 stagger reveal — applied on home Bento, PDP "Pairs well with"
- DEFER    — §4.3 magnetic CTAs — events page (low-traffic, v2 polish)

## 2.4 SEO + structured data

- OK       — §8 metadata — home, PDP, category have title/description
- MISSING  — §8 LocalBusiness JSON-LD — no instances site-wide; add to root layout
- MISSING  — §8 Product JSON-LD — add to /product/[slug]
- MISSING  — §8 BreadcrumbList JSON-LD — add to category + PDP
- PARTIAL  — §8 OG images — only home has one; need per-template fallback
```

The audit doc is committed to git. Phase 2 tasks reference findings by their bullet text. When a Phase 2 task ships, the corresponding audit bullets get `→ FIXED in <commit-sha>` appended; deferred items get `→ DEFERRED to v2: <reason>`. The audit doc tracks closure.

## 4. Execution Task Shape

### Standard shape for every Phase 2 task

1. Read the audit punch-list, copy the findings for this category into the task.
2. Fix each finding (or DEFER with rationale appended to the audit doc).
3. For each fix, the task records: file(s) touched, brief explanation if non-obvious.
4. Append `→ FIXED in <commit-sha>` to each closed audit bullet.
5. Run targeted tests (see per-category notes below).
6. Single commit per task (or per logical sub-group if a task spans many files).

### Category-specific notes

- **2.1 Content centralization** — deterministic. Create `data/site.ts` with `studio.address`, `studio.foundingYear`, `studio.sameDayCutoff`, `studio.phone`, `hero.tagline.{en,es}`, `marquee.tokens`. Grep for current placeholders, refactor every reference. Vitest coverage: a single test that imports `siteContent` and checks the schema.

- **2.2 Motion coverage** — fixes are JSX-level. Test by manual click + verify the existing `motion-config.ts` honors `prefers-reduced-motion`.

- **2.3 A11y fixes** — for each fix add an e2e assertion if behavioral (focus order, `aria-controls`), else manual verification. Run `axe-core` via Playwright on home / PDP / checkout — add this once, in this task.

- **2.4 SEO + structured data** — add JSON-LD components in `components/seo/` (`LocalBusinessLD`, `ProductLD`, `BreadcrumbListLD`). Per-template OG fallback via `app/[locale]/[...]/opengraph-image.tsx` files. Test: snapshot the rendered `<script type="application/ld+json">` in Vitest; manual verification via Google's Rich Results test deferred to Phase 3 QA.

- **2.5 Empty / loading / error states** — for any missing state, add the state component. e2e test: a single Playwright spec that forces empty cart / empty filter / error route.

- **2.6 Taste-skill pre-flight** — checklist items in the spec §12 become individual greps, fix violations.

- **2.7 Perf pass** — Lighthouse on home / `/en/shop/arrangements` / a sample PDP. Common fixes: `<Image priority>` on hero, `font-display: swap`, route-level `loading.tsx` if not present, `dynamic` imports for client-only motion components if the bundle warrants it. No CI gate.

- **2.8 i18n gap sweep** — script that diffs `messages/en.json` vs `messages/es.json` keys + greps for hardcoded strings outside message bundles. Vitest snapshot of key parity.

### Test discipline

Every Phase 2 task ends with `npm test && npm run e2e` green. Plan 4 must not ship with red tests.

## 5. Definition of Done

Plan 4 is done when:

1. Audit doc exists at `docs/superpowers/audits/2026-05-01-plan-4-audit.md` and every bullet has either `→ FIXED in <sha>` or `→ DEFERRED to v2: <reason>`.
2. `data/site.ts` exists; no remaining placeholder strings (`DESDE 2014`, `2:00 PM`, `Romance, by the stem.`, `1077`) appear anywhere outside it via grep.
3. Lighthouse on home / `/en/shop/arrangements` / a sample PDP: ≥ 95 perf, 100 a11y. Numbers recorded in the audit doc.
4. `npm test` + `npm run e2e` green.
5. Manual QA pass complete: EN + ES, keyboard-only, reduced-motion, mobile breakpoint at `md:` and below.
6. README "v1 status" section updated to reflect Plan 4 completion.
7. No new TODOs introduced. Any TODOs Plan 4 punts to v2 are listed in the audit doc under their category, not scattered in code.

## 6. Risks & Mitigations

- **Risk:** Audit surfaces > 50 findings, plan balloons.
  **Mitigation:** the per-category "defer if > 10 fixes" rule. Plan 4 is a polish pass, not a re-implementation.

- **Risk:** Lighthouse perf < 95 because of a structural issue (e.g., font loading, large hero image).
  **Mitigation:** if a single fix won't get there, record the score reached + the path to ≥ 95 in the audit doc; that path becomes a v2 task. Don't block launch on chasing two perf points.

- **Risk:** Real photography not arriving means OG images are placeholder-feeling.
  **Mitigation:** OG images use the same `<ProductImage>` swap point — generated from current placeholders, swap is automatic when client photos arrive.

## 7. Transition Out of Plan 4

- README updated to "v1 launch-ready".
- Remaining v2 swaps consolidated in a single `docs/superpowers/v2-roadmap.md`:
  - Stripe (`<PaymentStub />` → `<PaymentElement />`)
  - CMS (Sanity / Payload)
  - Auth (NextAuth / Clerk)
  - Email send (Resend / Postmark)
  - Analytics (Plausible / PostHog)
  - Real product photography
  - Address autocomplete (Google Places)
  - Lighthouse CI gating
  - All `DEFER` audit findings, by category

## 8. Next Step

Spec → implementation plan via `superpowers:writing-plans`.
