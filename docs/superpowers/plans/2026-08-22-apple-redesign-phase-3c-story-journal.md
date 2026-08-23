# Apple Fluid Redesign — Phase 3c: Story + Journal — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** Apply the shipped Reveal system to the Story page's below-the-fold editorial sections, with restraint. Journal is already handled and reading content is left clean.

**Architecture:** Add one `Reveal` per below-fold content group on the three Story blocks. Nothing else changes.

**Tech Stack:** Next.js 16, React 19, Tailwind v4, Framer Motion 12.

**Spec:** `docs/superpowers/specs/2026-08-22-apple-fluid-redesign-design.md` (Fase 3: inherit tokens/materials/motion; restraint; heroes/first-paint content not revealed).

## Global Constraints
- `Reveal` (`@/components/motion/Reveal`) shipped in 3a: `<Reveal as? className?>` — fade+rise once on scroll-in, `SPRING.default`, reduced-motion cross-fade.
- **Restraint + first-paint rule:** the page's opening heading/content is LCP and gets NO reveal (`StoryHero`, the Journal index `<h1>`, the article header). Reading content (article body/cover) gets NO scroll-reveal (readability). One reveal per below-fold group; never stack reveal on a list that already staggers.
- Preserve every class/attribute; touch no data/i18n/logic. Press logos + the article back-link are plain text links — no press recipe. No floating-glass surfaces exist here — no material.
- Verify `npx tsc --noEmit` clean + browser check. Branch `feat/apple-phase-3c-story-journal`.

## Decisions (what is and isn't touched)
- `components/story/StoryHero.tsx` — NO reveal (opening LCP heading).
- `components/story/ArchSection.tsx` — one Reveal wrapping header + prose group.
- `components/story/FounderPortrait.tsx` — Reveal AS the 2-col grid (replace the grid `<div>` with `<Reveal className="grid lg:grid-cols-2 gap-16 items-center">` so its two columns reveal together as one group; layout-safe — Reveal renders that grid div).
- `components/story/PressLogos.tsx` — one Reveal wrapping the eyebrow + press `<ul>`.
- `app/[locale]/journal/page.tsx` — NO change (already staggers articles via StaggerGroup/StaggerItem on SPRING.default; header is top-of-page LCP).
- `app/[locale]/journal/[slug]/page.tsx` — NO change (article is a reading experience; scroll-reveal on body/cover hurts readability).

---

### Task 1: Story below-fold sections → Reveal

**Files:** Modify `components/story/{ArchSection,FounderPortrait,PressLogos}.tsx`.

- [ ] **ArchSection:** import `Reveal`; wrap the `<header>` + the `<div className="prose-like …">` together in one `<Reveal>` (inside the `<section>`).
- [ ] **FounderPortrait:** import `Reveal`; replace `<div className="grid lg:grid-cols-2 gap-16 items-center">` with `<Reveal className="grid lg:grid-cols-2 gap-16 items-center">` (and its closing `</div>` → `</Reveal>`), keeping the two column children unchanged.
- [ ] **PressLogos:** import `Reveal`; wrap the eyebrow `<p>` + the `<ul>` together in one `<Reveal>` (inside the max-w container).
- [ ] **Verify:** `npx tsc --noEmit` clean; `/en/story` renders, sections reveal on scroll, hero present at first paint.
- [ ] **Commit** `feat(story): reveal on below-fold editorial sections (Apple system)`.

---

## Self-Review
- **Spec coverage:** Story below-fold sections revealed ✅; heroes/reading content correctly left at first paint ✅; journal already handled ✅.
- **Restraint:** one reveal per group; no material (none floating); no press (text links only).
- **Verification:** tsc + browser + a focused review of the small diff.
- **Follow-up → 3d (contact + account + legal).**
