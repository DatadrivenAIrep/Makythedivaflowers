# Apple Fluid Redesign — Phase 2a: Cart Drawer (material + drag-to-dismiss + delight) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Bring the cart drawer — the funnel's highest-frequency surface (opens on every add-to-bag) — to the Apple feel: translucent material, the shared drawer spring, drag-to-dismiss, and a petal "delight" burst on add-to-bag.

**Architecture:** Upgrade the existing bespoke `CartDrawer` in place (it already handles enter/exit, focus, escape, scroll-lock, a11y). Swap hand-rolled translucency (`bg-bone/85 backdrop-blur-xl`) for the Phase-1 `--material-*` tokens, and legacy `springs.snappy` for `SPRING.drawer` (`@/lib/motion`). Add drag-to-dismiss with Framer's native `drag` driven by a header grab-handle via `useDragControls` (so the scrollable line list isn't hijacked). Add a finite petal burst reacting to the `added-to-bag` toast.

**Tech Stack:** Next.js 16, React 19, Tailwind v4, Framer Motion 12, next-intl, zustand (`lib/ui-store.ts` drawer state, `lib/cart-store.ts` cart), vitest + @testing-library/react (jsdom).

**Spec:** `docs/superpowers/specs/2026-08-22-apple-fluid-redesign-design.md` (Phase 2: "cart drawer arrastrable e interrumpible, rubber-band, petals de delight").

## Rulings (engineering decisions within the approved spec)
- **Upgrade the bespoke `CartDrawer` in place; do NOT replace it with the Radix `Sheet`.** The Phase-1 `Sheet` wraps `Dialog.Portal forceMount` in `AnimatePresence` (fragile exit; no consumers ever exercised it), and drag-to-dismiss over a Radix Dialog is high-risk. The bespoke drawer already gets enter/exit/focus/escape/scroll-lock right. It still adopts the shared **tokens + `SPRING`** — the parts that matter for consistency. `Sheet` stays for simple modals.
- **Drag-to-dismiss uses Framer's native `drag` (via `useDragControls` from a header handle), NOT `useDragSpring`.** A 2-state panel dismiss is exactly what Framer `drag` + `onDragEnd` velocity/offset does, and it composes cleanly with `AnimatePresence`. `useDragSpring` (momentum projection to nearest of N snap points) is reserved for the **PDP image gallery** (next slice, 2b) — its real consumer — where the `useDragSpring` unmount-leak follow-up will also be fixed.

## Global Constraints
- Modified Next.js — consult `node_modules/next/dist/docs/` before any Next API. These edits are React/CSS/Framer only.
- `--material-*` tokens exist and are active (`styles/tokens.css`) and already used by `TopNav`/`Hero`. `SPRING` (`@/lib/motion`) has `default/snappy/momentum/drawer`. `PetalRain` (`components/home/PetalRain.tsx`, client, seeded, returns null under reduced motion).
- Drawer state lives in `lib/ui-store.ts` (`drawerOpen`/`openDrawer`/`closeDrawer`, `toast`/`showToast`/`clearToast`, toast kind `"added-to-bag"`). Cart state in `lib/cart-store.ts`. Do NOT change store APIs.
- **Do NOT change cart contents/behavior** — `CartLineItem`, `CartSummary` totals, `CartUpsellStrip`, `GiftAssuranceBar`, analytics calls, the header links stay as-is (only their surface styling may adopt tokens).
- Honor `prefers-reduced-motion` (no drag, no petals) — both `PetalRain` and the existing drawer already branch on `useReducedMotion`.
- Tests in `tests/unit/**`; run one file with `npx vitest run tests/unit/<file>`. Do NOT gate on full `npm test` (pre-existing failures in checkout-schema/_preview/print-*). Drag + petals are browser-verified (jsdom can't do gestures); controller runs the dev server (`npm run dev`, `/en`) — and **clears `.next` + restarts if Turbopack shows phantom errors after edits**.
- Branch `feat/apple-funnel-2a-cart`. Commit after each task. `npx tsc --noEmit` clean is a gate on every task.

## File Structure
```
components/cart/CartDrawer.tsx      MOD  material tokens + SPRING.drawer + drag-to-dismiss (useDragControls header handle)
components/cart/CartSummary.tsx     MOD  hand-rolled translucency → --material-* (small)
components/home/PetalRain.tsx       MOD  add optional `burst` prop (finite, one fall) — keep ambient default
components/cart/AddToBagDelight.tsx NEW  client: renders a PetalRain burst when toast==="added-to-bag" (reduced-motion safe)
components/nav/LocaleChrome.tsx     MOD  mount <AddToBagDelight/> globally (next to <ToastAddedToBag/>)
tests/unit/petal-rain-burst.test.tsx NEW  unit: burst prop renders finite (no infinite repeat) / null under reduced motion
tests/unit/cart-drawer-material.test.tsx NEW  unit: open drawer renders material surface + contents (as far as jsdom allows)
```

---

### Task 1: Cart drawer — material surface + `SPRING.drawer` + drag-to-dismiss

**Files:** Modify `components/cart/CartDrawer.tsx`, `components/cart/CartSummary.tsx`; Test `tests/unit/cart-drawer-material.test.tsx`

- [ ] **Step 1: Read** `components/cart/CartDrawer.tsx` (bespoke `motion.aside`, `AnimatePresence` on `open`, `springs.snappy` from `@/lib/motion-config`, panel class `bg-bone/85 backdrop-blur-xl border-l border-ink/10 shadow-[...]`) and `components/cart/CartSummary.tsx` (`bg-bone/80 backdrop-blur-md`).

- [ ] **Step 2: Write the failing test** `tests/unit/cart-drawer-material.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next-intl", () => ({ useTranslations: () => (k: string) => k }));
// open drawer via ui-store
import { useUIStore } from "@/lib/ui-store";
// cart-store: one line so it renders the list branch
vi.mock("@/lib/cart-store", () => ({
  useCartStore: (sel: (s: unknown) => unknown) =>
    sel({ lines: [], setQty: () => {}, remove: () => {} }),
}));

beforeEach(() => {
  window.matchMedia = vi.fn().mockImplementation((q: string) => ({
    matches: false, media: q, onchange: null,
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
    addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
  }));
  useUIStore.setState({ drawerOpen: true });
});

import { CartDrawer } from "@/components/cart/CartDrawer";

describe("CartDrawer material", () => {
  it("renders a dialog with the material surface when open", () => {
    render(<CartDrawer locale="en" />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog.className).toMatch(/material-bg|backdrop-filter/);
  });
});
```

> If the empty-cart branch (`CartEmpty`) makes the assertion awkward, the mock above yields an empty cart — assert on the `role="dialog"` element's class, which is on the panel regardless of contents. Adjust the cart-store mock only if a render error forces it; note any change in the report.

- [ ] **Step 3: Run test → FAIL** (`npx vitest run tests/unit/cart-drawer-material.test.tsx`) — panel has no material class yet.

- [ ] **Step 4: Implement in `CartDrawer.tsx`.**
  1. Imports: remove `import { springs } from "@/lib/motion-config";`; add `import { SPRING } from "@/lib/motion";` and add `useDragControls` to the framer import: `import { motion, AnimatePresence, useReducedMotion, useDragControls } from "framer-motion";`.
  2. Inside the component: `const dragControls = useDragControls();`.
  3. Panel `<motion.aside>` — replace the hand-rolled surface classes and legacy spring:
     - className: replace `bg-bone/85 backdrop-blur-xl border-l border-ink/10 shadow-[0_8px_60px_-16px_rgba(184,52,94,0.18)]` with the material surface:
       `"[background:var(--material-bg-strong)] [backdrop-filter:blur(var(--material-blur))_saturate(var(--material-saturate))] [-webkit-backdrop-filter:blur(var(--material-blur))_saturate(var(--material-saturate))] border-l border-[var(--border)] [box-shadow:inset_1px_0_0_var(--material-edge),var(--shadow-diffusion)]"` (keep the layout classes: `fixed right-0 top-0 z-50 h-[100dvh] w-full max-w-[440px] flex flex-col outline-none`).
     - `transition={reduce ? { duration: 0 } : springs.snappy}` → `transition={reduce ? { duration: 0 } : SPRING.drawer}`.
  4. Drag-to-dismiss (skip entirely when `reduce`): add to `<motion.aside>`:
     ```tsx
     drag={reduce ? false : "x"}
     dragControls={dragControls}
     dragListener={false}
     dragConstraints={{ left: 0, right: 0 }}
     dragElastic={{ left: 0, right: 0.5 }}
     onDragEnd={(_e, info) => {
       if (info.offset.x > 120 || info.velocity.x > 500) close();
     }}
     ```
     (Constraints pin the resting position to x:0; `dragElastic` right:0.5 lets it be pulled right with resistance; on release, past 120px OR a rightward fling >500px/s → `close()`, and `AnimatePresence` plays the existing `exit={{ x: "100%" }}`. Otherwise Framer springs it back to x:0.)
  5. Make the header initiate the drag (so the scrollable list still scrolls). On the existing `<header>` element add:
     ```tsx
     onPointerDown={(e) => { if (!reduce) dragControls.start(e); }}
     style={{ touchAction: "pan-y" }}
     className={cn(existingHeaderClasses, "cursor-grab active:cursor-grabbing")}
     ```
     (Import `cn` from `@/lib/cn` if not already; or append the classes to the existing string.) Keep the header's buttons/links working — `dragControls.start` on pointer-down of the header background won't block the child buttons' clicks.
  6. Add a small grab-handle affordance for discoverability: inside the header, a `<div aria-hidden className="...">` isn't required, but add `cursor-grab` (done above). (Optional: a 1×10 pill; keep minimal.)

- [ ] **Step 5: Materialize `CartSummary.tsx`** — replace `bg-bone/80 backdrop-blur-md` with `[background:var(--material-bg)] [backdrop-filter:blur(var(--material-blur))_saturate(var(--material-saturate))] [-webkit-backdrop-filter:blur(var(--material-blur))_saturate(var(--material-saturate))]`. Nothing else.

- [ ] **Step 6: Run test → PASS**; `npx tsc --noEmit` clean.

- [ ] **Step 7: Browser check (controller does this).** `npm run dev`, `/en`: add a product to bag → drawer opens as glass (content visible through it) with the drawer spring; drag the header to the right → it follows with resistance and, past a threshold / on a fling, dismisses; a small drag springs back. The line list still scrolls vertically. Toggle reduced-motion → no drag, plain open/close. No console errors (clear `.next` + restart if Turbopack shows phantom errors).

- [ ] **Step 8: Commit**

```bash
git add components/cart/CartDrawer.tsx components/cart/CartSummary.tsx tests/unit/cart-drawer-material.test.tsx
git commit -m "feat(cart): material cart drawer with drawer spring + drag-to-dismiss"
```

---

### Task 2: Petal "delight" burst on add-to-bag

**Files:** Modify `components/home/PetalRain.tsx`; Create `components/cart/AddToBagDelight.tsx`; Modify `components/nav/LocaleChrome.tsx`; Test `tests/unit/petal-rain-burst.test.tsx`

- [ ] **Step 1: Add a `burst` prop to `PetalRain.tsx`** (keep the ambient default). In `PetalRainImpl({ count = 14, burst = false })`, when `burst`:
  - the container is a full-area overlay (unchanged classes are fine),
  - each petal's transition uses `repeat: 0` (fall once) and a shorter duration (e.g. `2.4 + r*1.2` s) with `delay` in `0..0.4` (not negative), and `ease: "easeIn"`; when NOT burst keep the current `repeat: Infinity`, negative `delay`, `ease: "linear"`.
  Implement by branching the `transition`/`animate` on `burst` (keep `initial`/paths). Still `return null` under reduced motion.

- [ ] **Step 2: Write the failing test** `tests/unit/petal-rain-burst.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { PetalRain } from "@/components/home/PetalRain";

function setReduce(m: boolean) {
  window.matchMedia = vi.fn().mockImplementation((q: string) => ({
    matches: q.includes("reduced-motion") ? m : false, media: q, onchange: null,
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
    addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
  }));
}
beforeEach(() => setReduce(false));

describe("PetalRain burst", () => {
  it("renders petals in burst mode", () => {
    const { container } = render(<PetalRain burst count={6} />);
    expect(container.querySelectorAll("svg").length).toBe(6);
  });
  it("renders nothing under reduced motion", () => {
    setReduce(true);
    const { container } = render(<PetalRain burst count={6} />);
    expect(container.firstChild).toBeNull();
  });
});
```

- [ ] **Step 3: Run → FAIL then implement Step 1 then PASS** (`npx vitest run tests/unit/petal-rain-burst.test.tsx`).

- [ ] **Step 4: Create `components/cart/AddToBagDelight.tsx`** (client): reacts to the toast and shows a one-shot burst.

```tsx
"use client";
import { useEffect, useState } from "react";
import { useUIStore } from "@/lib/ui-store";
import { PetalRain } from "@/components/home/PetalRain";

// One-shot petal burst when a bag is added (reduced-motion safe via PetalRain).
export function AddToBagDelight() {
  const toast = useUIStore((s) => s.toast);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (toast?.kind !== "added-to-bag") return;
    setShow(true);
    const id = setTimeout(() => setShow(false), 2600);
    return () => clearTimeout(id);
  }, [toast]);

  if (!show) return null;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[55]">
      <PetalRain burst count={14} />
    </div>
  );
}
```

- [ ] **Step 5: Mount it globally.** In `components/nav/LocaleChrome.tsx`, import `AddToBagDelight` and render it next to the existing `<ToastAddedToBag />` (read the file to place it in the same host cluster). No other change.

- [ ] **Step 6: `npx tsc --noEmit` clean.**

- [ ] **Step 7: Browser check (controller).** Add to bag → a brief, gentle petal burst falls once and clears (~2.6s), over the opening drawer. Under reduced motion → no petals. No console errors.

- [ ] **Step 8: Commit**

```bash
git add components/home/PetalRain.tsx components/cart/AddToBagDelight.tsx components/nav/LocaleChrome.tsx tests/unit/petal-rain-burst.test.tsx
git commit -m "feat(cart): petal delight burst on add-to-bag"
```

---

## Self-Review
- **Spec coverage (Phase-2 cart):** material drawer ✅ (T1) · drawer spring ✅ (T1) · drag-to-dismiss + rubber-band/velocity ✅ (T1, Framer drag with elastic + velocity threshold) · petals de delight ✅ (T2). `useDragSpring` + its leak fix are correctly deferred to the PDP gallery slice (2b) where momentum-to-N-snap-points is needed (ruled above).
- **Verification honesty:** unit tests cover what jsdom allows (material class present; burst finite vs reduced-motion null); the gestures + petal motion are browser-verified by the controller on the live dev server (with the `.next`-clear caveat).
- **Type/interface consistency:** `SPRING.drawer` (exists), `useDragControls`/`drag` (Framer 12), `PetalRain` gains an optional `burst` (ambient callers unchanged — default false), `AddToBagDelight` reads `ui-store.toast` (existing shape).
- **No store/logic changes:** drawer/cart/toast store APIs untouched; cart contents + analytics untouched.
- **Follow-ups (next slice 2b — PDP gallery):** wire `useDragSpring` into `ImageStack` (swipe + `projectSnap` to N images) AND fix its unmount-listener leak there; sticky material add-to-bag bar; variant feedback.
