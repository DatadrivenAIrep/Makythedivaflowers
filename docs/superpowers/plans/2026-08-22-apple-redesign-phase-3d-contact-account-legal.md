# Apple Fluid Redesign — Phase 3d: Contact + Account + Legal — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** Close Phase 3 by confirming contact/account/legal inherit the Apple system, and adding the one tasteful, restraint-appropriate motion these pages actually want (the contact delivery-zone pills).

**Architecture:** These pages are dominated by (a) forms that already inherit the 3a form kit, and (b) reading/reference content that should NOT get scroll-reveal. The only net-new is `DeliveryZonePills` (a clearly below-fold section): reveal its header + stagger the pills.

**Tech Stack:** Next.js 16, React 19, Tailwind v4, Framer Motion 12.

**Spec:** `docs/superpowers/specs/2026-08-22-apple-fluid-redesign-design.md` (Fase 3: "aplican el sistema ya probado… sin lógica nueva"; restraint; first-paint/reading content not revealed).

## Assessment (why account + legal need no change)
- **Account** (`AccountShell`, `AuthForm`, `OrdersEmpty`): `AuthForm` already composes the 3a form kit (`FormSubmit` press, `TextInput` fast-focus, `FormSuccess` spring); `OrdersEmpty` already uses `Button` (press); `AccountShell`'s header is the page LCP and its tab links are nav (not CTAs). Forms must stay immediately actionable (no fade-in — same rule as `ZipChecker`). → no change.
- **Legal** (`LegalShell`, 4 pages): reference/reading content — per the journal-article precedent, no scroll-reveal (findability/readability). Typography already follows the system: h1 `text-5xl sm:text-6xl tracking-tighter leading-[0.92]`, h2 `tracking-tighter`, body `leading-relaxed max-w-[68ch]`. → no change.
- **Contact**: header + info/form grid are above-the-fold and the form is interactive → no reveal there. `TextMaky*` is functional (SMS) → untouched. Only `DeliveryZonePills` (below the `mb-24` grid) gets motion.

## Global Constraints
- `Reveal` + `StaggerGroup`/`StaggerItem` (with `as`) shipped in 3a/3b. Preserve all classes/attrs/logic. Verify `npx tsc --noEmit` clean + browser. Branch `feat/apple-phase-3d-contact-account-legal`.

## File Structure
```
components/contact/DeliveryZonePills.tsx   MOD  Reveal header + StaggerGroup as="ul" / StaggerItem as="li" on the pills
```

---

### Task 1: Contact delivery-zone pills → reveal + stagger

**Files:** Modify `components/contact/DeliveryZonePills.tsx`.

- [ ] Import `Reveal` + `StaggerGroup`/`StaggerItem`.
- [ ] Wrap the `<header className="mb-8">` (eyebrow + h2) in `<Reveal as="header" className="mb-8">`.
- [ ] Convert `<ul className="flex flex-wrap gap-3">` → `<StaggerGroup as="ul" className="flex flex-wrap gap-3">`, and each `<li … className="rounded-full border …">` → `<StaggerItem as="li" key={zone.id} className="…same pill classes…">`.
- [ ] Leave the trailing note `<p>` as-is.
- [ ] **Verify:** `npx tsc --noEmit` clean; `/en/contact` renders (200), pills cascade in on scroll, form + StudioInfo present at first paint.
- [ ] **Commit** `feat(contact): reveal + stagger the delivery-zone pills (Apple system)`.

---

## Self-Review
- **Spec coverage:** contact/account/legal confirmed on the system; the one below-fold contact section gets restrained motion ✅; no manufactured motion on forms/reading content ✅.
- **Restraint/honesty:** account inherits 3a; legal is reading content already well-typeset — documented, not churned.
- **Verification:** tsc + browser/SSR. This completes Phase 3.
