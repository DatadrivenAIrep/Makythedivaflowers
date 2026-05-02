# Forms Editorial Redesign

**Status:** Design — pending implementation plan
**Date:** 2026-05-02
**Owner:** Santiago

## Problem

Every form on the site (Contact, Weddings, Events, Subscription, Checkout, Auth, Newsletter, CardMessage) reads as visually underdeveloped. Symptoms:

- Flat, unanchored — fields stack on `bg-bone` with no architectural container, no visual rhythm.
- Labels read as utilitarian admin (11px mono ALL-CAPS, low contrast).
- Inputs lack affordance — no icons, no live help, no formatting cues; every field looks the same.
- No scenography — forms float in pages with no editorial header, eyebrow, or surrounding context.
- No reward — submit is a button, success is a flat petal box.
- Inconsistent across forms — each redefines local `Field`/`Textarea` helpers; submit treatment differs (some `MagneticButton`, some plain ink pill); only Subscription has section headings.

The user described this as "se ve poco atractivo visualmente, muy simple" (looks unattractive, too simple) and asked that all forms "grow visually."

## Goal

Redesign all forms under a single visual system that:

- Gives each form an architectural container with editorial scenography (a left-side panel with photo or display typography).
- Centralizes form atoms so the same input/label/section component is used everywhere — eliminating inconsistency and ~80 lines of duplication per form file.
- Upgrades type, spacing, focus states, microinteractions, and success states to feel intentional and polished.
- Preserves all existing logic — schemas, react-hook-form setup, API routes, validation rules, honeypot, i18n keys are untouched. The work is purely presentational.

Non-goals:

- No copy rewriting beyond what's needed for the new left-panel slots (eyebrow + headline + optional body per form).
- No new fields or schema changes.
- No backend or API changes.
- No animation library swap (continue using `framer-motion`).

## Direction (selected via brainstorm)

**Editorial Split** — every form is a two-column layout: a scenographic left panel and a clean form on the right. Within the brand's existing palette (rouge, petal, bone, ink) and typography (Cabinet Grotesk display, mono labels).

**Two panel variants** under the same shell:

- **`PhotoPanel`** — V2. An immersive photograph covers the panel, with a bottom-up ink gradient for legibility, copy in bone over it.
- **`EditorialPanel`** — V1+V3 mixed. Ink → ink-rouge gradient background with a radial rouge halo in the bottom-right corner. Rouge eyebrow + display serif headline + optional body + optional numbered "what to expect" steps + signature.

**Universal scope** — applied to all 8 forms, with proportions adapted per context. Forms without dedicated photography fall back to `EditorialPanel` (no V2 forced where it doesn't fit).

## Per-form mapping

| Form | Panel | Notes |
|---|---|---|
| Contact | Editorial | Eyebrow + headline + 1–2 sentence body about response time. |
| Weddings | Photo | One curated still from `/public/weddings/*.webp` (17-image catalog). Selection is fixed (not rotative) per migration; can be re-curated later without code change. |
| Events | Editorial → Photo | Editorial today; switches to Photo when events photography is shot. API of the panel is identical so the swap is one-line. |
| Subscription | Photo | Foto of the selected plan's product (driven by `findSubscriptionPlan(plan)` data). |
| Checkout | Order Summary (Photo-derived) | Left panel becomes the order summary — products + totals — visually rich, replacing the existing `CheckoutShell` summary placement. Acordeón on mobile. |
| Auth | Editorial | Compact variant. Signature "— Diva, NYC". |
| Newsletter (home) | Keep current layout | The home newsletter is already a de-facto split. Only the inputs/labels/submit are upgraded to the new system; outer layout unchanged. |
| CardMessage (cart/PDP embed) | None (atoms only) | Embedded inside other UI. No shell. Atoms (`FormField`, `TextArea`, `FormSubmit`) are upgraded but the surrounding layout stays. |

## Copy authorship

The new `EditorialPanel` and `PhotoPanel` introduce three new content slots per form: `eyebrow` (mono uppercase tag), `title` (display headline), and `body` (1–2 sentence prose). These are not authored in this design — they are written during each form's migration step, in the same `messages/{en,es}.json` i18n files where existing form labels live. New i18n keys live under each form's existing namespace (e.g. `contact.form.shell.eyebrow`, parallel to existing `contact.form.name`). Initial copy can be a placeholder; a follow-up pass refines tone with the user. No copy is shipped without a review.

## Architecture

### Shared atoms — `components/ui/form/`

Centralized primitives that replace every per-form duplicate:

- `<FormField label help error required>` — wrapper. Renders the label (mono uppercase 12px, tracking 0.16em, `text-ink/70`, asterisk-suffix when required), an optional help line, the slotted input, and the error.
- `<TextInput>` — line-only input. Border-bottom 1px `border-ink/20`, `py-3 px-0`, font-sans 16px (avoids iOS zoom). Focus: border-bottom rouge 1.5px, 200ms transition. Hover: `border-ink/35`. Error: border-bottom rouge solid + mono error text below.
- `<TextArea>` — boxed (line-only is unreadable multi-row). Border `ink/15`, radius 8px, padding `14px 16px`, min-height 110px, `resize: none`. Focus: border rouge + ring `rouge/20`.
- `<DateInput>` — boxed like textarea, font-mono inside (it's a technical value).
- `<SelectInput>` — boxed, native `<select>`. We don't replicate a custom select; native is accessible by default.
- `<RadioChips items value onChange>` — pill grid (the existing budget/cadence/window pattern). `py-3.5 px-4`, border `ink/15` → `rouge` active, fill `transparent` → `rouge/8` active. Label `font-sans text-sm`.
- `<FormSection title num?>` — divider + eyebrow rouge mono 10px tracking 0.22em + optional serif number (`01`, `02`) in `text-ink/40`. `border-t border-ink/10 pt-3 mb-4`.
- `<FormSubmit>` — canonical submit. Pill `bg-ink text-bone`, `py-4 px-8`, font-sans 14px medium, hover `bg-rouge`. Mobile full-width, desktop auto-width right-aligned. Replaces all current submit treatments. `MagneticButton` is removed from form submits (causes miss-clicks on submit) and kept only for hero CTAs.

### Shell + panels — `components/ui/form/shell/`

- `<FormShell>` — root component. Resolves split proportions (42/58 desktop, stacked mobile), padding, scroll behavior, success cross-fade. Slots: `left` (panel) and `right` (form children).
- `<PhotoPanel src eyebrow title body>` — V2 variant. Image covers panel, ink gradient bottom for legibility, copy in bone overlay. `aria-hidden` on the decorative image; semantic `<h2>` on the title.
- `<EditorialPanel eyebrow title body? steps? signature?>` — V1+V3 variant. Gradient ink → ink-rouge background, radial rouge halo in bottom-right. Rouge eyebrow + display serif title + optional body + optional numbered steps + optional signature.
- `<FormSuccess title body action?>` — replaces the form on success. Cross-fade 250ms. Check icon scales 0→1 with spring (respects `prefers-reduced-motion`). Display serif headline + body + optional CTA. Receives `autoFocus` on its `<h2>` for keyboard users.

### Checkout-specific — `components/checkout/OrderSummaryPanel.tsx`

The Checkout left panel is not a generic `PhotoPanel` — it's a domain component that renders the cart summary editorially. Visual recipe: dark ink background, eyebrow "Your order" rouge, list of cart line items each with a small product thumbnail (40×40 rounded) + product name (font-display) + qty/price (mono), divider, subtotal/delivery/total stack with the total in display serif. Surfaces existing cart state from the cart store — no new data sources. On mobile collapses to a Stripe-style accordion: a top bar showing "Order details · 3 items · $245" with a chevron that expands the full summary inline.

### Subscription AI assist re-skin

The existing `CardMessageAssist` component (used inside `SubscriptionInquiryForm`) keeps its logic, API, and behavior intact. Only its presentation is updated to match the new system: the trigger button uses the new mono small-link style, the suggestions panel renders inside a `<FormSection>` with the rouge eyebrow divider, each suggestion sits in a `<TextArea>`-styled card, and the rotation preview state (`loading` / `success` / `error`) keeps its current structure but adopts the new color/spacing tokens. No changes to `lib/card-message-prompt.ts`, the API route, or the relations/occasions data.

### Per-form refactor

Each form becomes:

```tsx
<FormShell>
  <EditorialPanel eyebrow="..." title="..." body="..." />
  <form onSubmit={...}>
    <FormField label={t("name")} required error={...}>
      <TextInput {...register("name")} />
    </FormField>
    {/* ...etc */}
    <FormSubmit>{t("submit")}</FormSubmit>
  </form>
</FormShell>
```

Local `Field` / `Textarea` / `Heading` functions are deleted from each form file. Net reduction: ~80 lines per form.

## Visual specifications

### Labels
- Font: mono ALL-CAPS, 12px (was 11px), tracking 0.16em (was 0.18em).
- Color: `text-ink/70` (was `text-ink/60`) for better contrast.
- Margin-bottom: 8px (was 6px).
- Required: rouge asterisk suffixed after the label text (not before).

### Inputs (line-only `TextInput`)
- Border-bottom 1px `border-ink/20`, `py-3 px-0`, font-sans 16px.
- Focus: border-bottom rouge 1.5px, no ring, 200ms transition.
- Hover: `border-ink/35`.
- Error: border-bottom rouge solid + mono 11px error text below.
- Disabled: opacity 0.5, no interaction.

### Boxed inputs (`TextArea`, `SelectInput`, `DateInput`)
- Border `ink/15`, radius 8px, padding `14px 16px`.
- Focus: border rouge + ring `rouge/20`.
- TextArea min-height 110px, `resize: none`.

### RadioChips
- Padding `py-3.5 px-4`.
- Inactive: border `ink/15`, fill transparent.
- Active: border `rouge`, fill `rouge/8`.
- Label `font-sans text-sm`.

### FormSubmit
- Pill `bg-ink text-bone hover:bg-rouge`, `py-4 px-8`, font-sans 14px medium, tracking-tight.
- Submitting: text replaced with three animated dots, button doesn't resize (no layout shift).
- Mobile: full-width. Desktop: auto-width, right-aligned within form.

### FormSection
- `border-t border-ink/10 pt-3 mb-4`.
- Eyebrow mono 10px tracking 0.22em rouge.
- Optional serif number `01`, `02` in `text-ink/40`.

### Microinteractions (motion)
- Field focus: label rises 2px, color animates `ink/70` → `rouge` (200ms).
- Submit submitting: text → three dots, no resize.
- Form success: cross-fade 250ms between form panel and `<FormSuccess>`. Check icon spring-scales 0→1.
- Field stagger on mount: 40ms between fields, max 6 fields, then instant. Respects `prefers-reduced-motion` → instant.

### Left panel typography
- Eyebrow: `font-mono text-[10px] uppercase tracking-[0.22em]` rouge (no new accent colors introduced).
- Display: `font-display text-3xl md:text-4xl tracking-tighter leading-[0.95]`.
- Body: `font-sans text-sm leading-relaxed text-bone/85` (raised from `/75` for AA contrast on small text).
- Signature: `font-mono text-[10px] uppercase tracking-[0.22em] text-bone/45`.

## States

### Field-level
- Idle, validating (invisible — no per-field spinner), error (border + mono message + `aria-invalid` + `aria-describedby`), disabled (opacity 0.5).
- Success per field is intentionally not visualized. Success is a form-level event, not a field-level one.

### Form-level
- Idle.
- Submitting: button loading, inputs `disabled` with opacity 0.6. Left panel stays visible.
- Success: cross-fade right side. Left panel persists. Right side renders `<FormSuccess>` (check + display headline + body + optional CTA). Focus moves to the success `<h2>`.
- Error (submit failure): rouge banner above submit, mono 11px, with translated cause. Form state preserved.

## Mobile (< 768px)

Split collapses to stack:

- **PhotoPanel:** photo becomes a 280px-tall hero strip at the top, strong ink gradient bottom, copy overlay. Form below, `px-6 py-8`.
- **EditorialPanel:** ink panel becomes a top header with `auto` height. Display drops to `text-2xl`, body hides, signature hides. Form below.
- **Checkout OrderSummary:** does not become a hero photo. Collapses to a Stripe-style accordion at top: "Order details (3 items, $245)", expandable.
- **Newsletter:** unchanged (already responsive).
- **CardMessage:** unchanged structurally.

### Tap targets
- Inputs min-height 48px (WCAG AAA).
- RadioChips min-height 52px.
- Submit min-height 52px.
- Visual padding and interactive padding are equal (no invisible hit-area tricks).

## Accessibility

Preserved from current implementation:
- `aria-invalid`, `aria-describedby`, `role="alert"` on errors (RHF default).
- Honeypot field.
- Semantic `<form>` element.

Improved:
- `<FormShell>` adds a hierarchically correct `<h2>` in the left panel — currently inconsistent (Subscription has it, Contact doesn't).
- Success cross-fade does not lose focus; focus moves programmatically to the success `<h2>` (`autoFocus`).
- PhotoPanel image is `aria-hidden="true"` (decorative); copy lives in the DOM, not as `background-image`.
- Skip-link "Skip to form" — visually hidden but focusable, jumps to the first form field. Important on long forms (Subscription, Wedding) where the left panel has substantial copy.
- Body text in panel raised to `text-bone/85` to pass AA on small text over ink background.
- `prefers-reduced-motion` respected on stagger, focus animation, success spring.
- Focus-visible: rouge 2px ring, 2px offset, single pattern across all interactive elements in the form system.

## Testing

- **Existing unit tests** (`SubscriptionInquiryForm.test.tsx`, `subscription-inquiry-schema.test.ts`, etc.) remain unchanged and must pass — they test logic, not visuals.
- **New unit tests:** snapshot of `FormShell` in both `Photo` and `Editorial` variants. Render test for each new atom (`FormField`, `TextInput`, `TextArea`, `RadioChips`, `FormSubmit`).
- **New a11y tests:** `axe-core` assertion on each migrated form rendered in test.
- **Existing e2e** (`contact.spec.ts`, `weddings-inquiry.spec.ts`, `checkout.spec.ts`, `subscriptions.spec.ts`) must continue to pass. Selectors are by label/role, not by class — should be resilient. Any selector that breaks indicates a fragile test that gets fixed inline.
- **New e2e:** with `prefers-reduced-motion: reduce`, the success transition is instant (no animation race conditions).
- **Manual:** iOS Safari for input zoom on focus (must not zoom — confirms 16px font).

## Implementation order

One feature branch (`feat/forms-editorial-redesign`). Commits per step. Single PR at the end with before/after screenshots per form.

1. **Atoms** — `components/ui/form/{FormField, TextInput, TextArea, DateInput, SelectInput, RadioChips, FormSection, FormSubmit}`. With unit tests. No form file touched yet.
2. **Shell + panels** — `components/ui/form/shell/{FormShell, PhotoPanel, EditorialPanel, FormSuccess}`. With unit tests and inline usage examples.
3. **Migration, lowest risk first:**
   1. **Auth** — stub today, validates atoms in isolation.
   2. **Contact** — first real backend-wired migration with `EditorialPanel`.
   3. **Newsletter** — atoms-only upgrade, layout unchanged.
   4. **CardMessage** — atoms-only embed, no shell.
   5. **Weddings** — first real `PhotoPanel` (uses `/public/weddings/`).
   6. **Events** — `EditorialPanel`, more fields than Contact.
   7. **Subscription** — largest, with sections and AI assist UI re-skinned (logic unchanged).
   8. **Checkout** — most complex; left panel becomes new `OrderSummaryPanel` component. Mobile accordion.
4. **Cleanup** — delete all per-form `Field` / `Textarea` / `Heading` helpers, delete unused `components/ui/Input.tsx` (the underline original that nobody adopted), audit imports, update i18n keys if any string changed.

Each migration: one commit, e2e + unit pass, manual screenshot review, push.

## What is NOT touched

- Zod schemas, react-hook-form configuration, API routes, validation rules.
- Honeypot field implementation.
- i18n keys (visual presentation changes; copy keys are reused).
- `MagneticButton` (kept for hero CTAs like the homepage subscribe button — removed only from form submits).
- Plan data, product data, subscription logic, AI card-message generation logic.

## Risks and mitigations

- **RadioChips behavior may regress** — the existing `budget`/`cadence`/`window` selections are radio-based with `sr-only` inputs. Tests for Subscription and Events cover this; manual keyboard-tab verification before merge.
- **`prefers-reduced-motion` regression** — covered by new e2e that asserts instant cross-fade with reduced motion.
- **iOS zoom on focus** — input font-size confirmed 16px in spec; manual Safari test before merge.
- **Visual change is large for current users** — no feature flag. The change is uniformly an upgrade; there is no "old mode" worth preserving.
- **Checkout OrderSummaryPanel is the riskiest piece** — it's a new component (not a renamed existing one). Migrating it last lets us learn from all prior migrations first.

## Files affected (summary)

**New:**
- `components/ui/form/FormField.tsx`
- `components/ui/form/TextInput.tsx`
- `components/ui/form/TextArea.tsx`
- `components/ui/form/DateInput.tsx`
- `components/ui/form/SelectInput.tsx`
- `components/ui/form/RadioChips.tsx`
- `components/ui/form/FormSection.tsx`
- `components/ui/form/FormSubmit.tsx`
- `components/ui/form/shell/FormShell.tsx`
- `components/ui/form/shell/PhotoPanel.tsx`
- `components/ui/form/shell/EditorialPanel.tsx`
- `components/ui/form/shell/FormSuccess.tsx`
- `components/checkout/OrderSummaryPanel.tsx`
- Unit tests for each new component.

**Modified (refactored to use new atoms; logic unchanged):**
- `components/inquiry/ContactForm.tsx`
- `components/inquiry/WeddingsForm.tsx`
- `components/inquiry/EventsForm.tsx`
- `components/subscription/SubscriptionInquiryForm.tsx`
- `components/checkout/CheckoutShell.tsx`
- `components/checkout/ContactStep.tsx`
- `components/checkout/DeliveryStep.tsx`
- `components/account/AuthForm.tsx`
- `components/home/NewsletterField.tsx`
- `components/product/CardMessage.tsx`

**Deleted:**
- `components/ui/Input.tsx` (legacy underline input, unused).

**Untouched (verified):**
- All `schemas/*.ts`.
- All `app/api/*` routes.
- All `lib/*` (validation, submission, format helpers).
