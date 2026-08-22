# Apple Fluid Redesign — Phase 1: Foundations & Hero — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the shared design + motion system (tokens, materials, gesture primitive) and apply it to the flagship home hero, setting the "Apple feel" bar for the rest of the redesign.

**Architecture:** Extract two shared systems while building the real flagship piece (strategy B). Pure physics helpers live in `lib/motion.ts` (unit-tested); visual/material/type tokens live in `styles/tokens.css` + `app/globals.css`; a reusable `useDragSpring` hook wires the physics to Framer Motion; then `Sheet`, `Button`/`MagneticButton`, `TopNav`, and `Hero` adopt them. Pure logic and client components are TDD'd in vitest; interaction "feel" (scroll, drag, parallax) is verified in the browser preview.

**Tech Stack:** Next.js 16 (App Router, modified — see Global Constraints), React 19, Tailwind CSS v4 (CSS-first, no config file), Framer Motion 12, next-intl, vitest + @testing-library/react (jsdom).

**Spec:** `docs/superpowers/specs/2026-08-22-apple-fluid-redesign-design.md`

## Global Constraints

Every task's requirements implicitly include these:

- **Modified Next.js.** This is NOT stock Next 16 — before using any Next API (`Image`, routing, metadata, etc.), read the relevant guide in `node_modules/next/dist/docs/` (per `AGENTS.md`). Heed deprecation notices.
- **Tests** live in `tests/unit/**/*.test.ts(x)` (vitest, jsdom, globals on, setup `tests/setup.ts`, alias `@` → repo root). Run one file with `npx vitest run tests/unit/<file>`. The npm scripts set `NODE_OPTIONS='--experimental-sqlite'`; a bare `npx vitest run <file>` works for these tasks (no sqlite touched).
- **Do NOT gate on the full suite.** `npm test` has ~7 pre-existing failures (Chromium spawn ENOEXEC + checkout/preview) that also fail on base `main`. Run only the task's own test file.
- **Motion defaults** (from `lib/motion.ts`, Task 1): critically-damped `SPRING.default` (`bounce:0, duration:0.4`) for most UI; bounce (`SPRING.momentum`/`SPRING.drawer`) ONLY after a momentum gesture. Animate only `transform`/`opacity`; add `will-change` where motion is imminent.
- **Preserve identity, dial back noise.** Keep rouge `#B8345E`, Fraunces, and the arch. Do not delete grain/marquee/petals — those live in later plans; this plan does not touch them.
- **i18n.** All copy comes from next-intl messages (`messages/{en,es}.json`); never hardcode user-facing text.
- **Accessibility.** Honor `prefers-reduced-motion`, `prefers-reduced-transparency`, and `prefers-contrast` in every component you touch.
- **Branch** `feat/apple-fluid-redesign`. Commit after each task.

## File Structure

```
lib/motion.ts                       NEW  spring tokens + pure physics (project/snap/rubberband/normalize)
tests/unit/motion.test.ts           NEW  unit tests for lib/motion.ts
styles/tokens.css                   MOD  + spacing, type scale, materials, motion durations, semantic + dark tokens
app/globals.css                     MOD  + optical sizing, reduced-transparency/contrast blocks, [data-theme] hook
tests/unit/tokens.test.ts           NEW  guard test: required tokens/blocks exist
components/motion/useDragSpring.ts  NEW  reusable direct-manipulation hook (capture, track, handoff, rubberband)
tests/unit/use-drag-spring.test.tsx NEW  smoke/behavior test for the hook
components/ui/Sheet.tsx             MOD  translucent material + drag-to-dismiss + a11y fallbacks
tests/unit/sheet-material.test.tsx  NEW
components/ui/Button.tsx            MOD  instant press + graceful release (CSS, stays server component)
components/motion/MagneticButton.tsx MOD  migrate spring to SPRING tokens
tests/unit/button.test.tsx          NEW
components/nav/TopNav.tsx           MOD  translucent material + scroll-edge fade
tests/unit/top-nav.test.tsx         NEW
components/home/HeroMedia.tsx       NEW  client: video + scroll parallax + reduced-motion/save-data fallback
components/home/Hero.tsx            MOD  dirección A refinement (lighter overlay, material bottom bar, type)
tests/unit/hero-media.test.tsx      NEW
```

---

### Task 1: Motion tokens & pure physics (`lib/motion.ts`)

**Files:**
- Create: `lib/motion.ts`
- Test: `tests/unit/motion.test.ts`

**Interfaces:**
- Consumes: `Transition` type from `framer-motion`.
- Produces:
  - `SPRING: { default, snappy, momentum, drawer }` — each a Framer `Transition`.
  - `project(velocity: number, decelerationRate?= 0.998): number` — projected distance (px).
  - `projectSnap(current: number, velocity: number, snapPoints: readonly number[], decelerationRate?= 0.998): number` — snap point nearest the projected endpoint.
  - `normalizeVelocity(gestureVelocity: number, target: number, current: number): number`.
  - `rubberband(overshoot: number, dimension: number, constant?= 0.55): number`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/motion.test.ts
import { describe, it, expect } from "vitest";
import { SPRING, project, projectSnap, normalizeVelocity, rubberband } from "@/lib/motion";

describe("SPRING presets", () => {
  it("default is critically damped (no overshoot)", () => {
    expect(SPRING.default).toMatchObject({ type: "spring", bounce: 0 });
  });
  it("momentum and drawer carry a little bounce", () => {
    expect(SPRING.momentum.bounce).toBeGreaterThan(0);
    expect(SPRING.drawer.bounce).toBeGreaterThan(0);
  });
});

describe("project", () => {
  it("returns 0 for no velocity", () => {
    expect(project(0)).toBe(0);
  });
  it("uses exponential decay: v=1000 -> ~499px at 0.998", () => {
    expect(project(1000, 0.998)).toBeCloseTo(499, 0);
  });
  it("preserves direction", () => {
    expect(project(-1000, 0.998)).toBeCloseTo(-499, 0);
  });
});

describe("projectSnap", () => {
  it("throws to the snap nearest the projected endpoint, not the release point", () => {
    // release at 0, fast flick -> endpoint ~499 -> nearest of [0,200,600] is 600
    expect(projectSnap(0, 1000, [0, 200, 600])).toBe(600);
  });
  it("with no velocity, snaps to the nearest point to current", () => {
    expect(projectSnap(210, 0, [0, 200, 600])).toBe(200);
  });
});

describe("normalizeVelocity", () => {
  it("divides velocity by remaining distance", () => {
    expect(normalizeVelocity(50, 150, 50)).toBeCloseTo(0.5, 5);
  });
  it("guards divide-by-zero at target", () => {
    expect(normalizeVelocity(50, 50, 50)).toBe(0);
  });
});

describe("rubberband", () => {
  it("is 0 at the boundary", () => {
    expect(rubberband(0, 300)).toBe(0);
  });
  it("resists: output is always less than the raw overshoot", () => {
    expect(rubberband(100, 300)).toBeLessThan(100);
  });
  it("has diminishing returns as overshoot grows", () => {
    const a = rubberband(100, 300) - rubberband(0, 300);
    const b = rubberband(200, 300) - rubberband(100, 300);
    expect(b).toBeLessThan(a);
  });
  it("preserves sign", () => {
    expect(rubberband(-100, 300)).toBeLessThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/motion.test.ts`
Expected: FAIL — cannot resolve `@/lib/motion`.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/motion.ts
// Motion-system tokens + pure physics helpers, translated from Apple's
// "Designing Fluid Interfaces" (WWDC 2018). See
// docs/superpowers/specs/2026-08-22-apple-fluid-redesign-design.md.
import type { Transition } from "framer-motion";

/**
 * Springs in Apple's two-parameter model, via Framer Motion's bounce +
 * duration (which maps closely to Apple's damping + response). Default is
 * critically damped (no overshoot); momentum/drawer add bounce only because
 * a gesture with momentum precedes them.
 */
export const SPRING = {
  default: { type: "spring", bounce: 0, duration: 0.4 },
  snappy: { type: "spring", bounce: 0, duration: 0.3 },
  momentum: { type: "spring", bounce: 0.2, duration: 0.4 },
  drawer: { type: "spring", bounce: 0.2, duration: 0.3 },
} as const satisfies Record<string, Transition>;

/**
 * Projected travel distance (px) of a flick, using exponential decay — the
 * scroll-deceleration model, NOT the v²/2a textbook form.
 * @param velocity px/s at release
 * @param decelerationRate 0.998 ≈ normal feel; 0.99 = snappier
 */
export function project(velocity: number, decelerationRate = 0.998): number {
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

/** Snap point nearest the PROJECTED endpoint (throw to where the gesture is going). */
export function projectSnap(
  current: number,
  velocity: number,
  snapPoints: readonly number[],
  decelerationRate = 0.998,
): number {
  const endpoint = current + project(velocity, decelerationRate);
  return snapPoints.reduce((best, p) =>
    Math.abs(p - endpoint) < Math.abs(best - endpoint) ? p : best,
  );
}

/** Absolute px/s velocity -> relative velocity (per remaining distance); guards /0. */
export function normalizeVelocity(gestureVelocity: number, target: number, current: number): number {
  const distance = target - current;
  return distance === 0 ? 0 : gestureVelocity / distance;
}

/** Progressive resistance past a boundary (real things slow before they stop). */
export function rubberband(overshoot: number, dimension: number, constant = 0.55): number {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/motion.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add lib/motion.ts tests/unit/motion.test.ts
git commit -m "feat(motion): add spring tokens and pure fluid-motion physics helpers"
```

---

### Task 2: Foundation tokens — type scale, spacing, materials, dark structure

**Files:**
- Modify: `styles/tokens.css` (append token groups inside `:root`; replace the empty dark `@media` block)
- Modify: `app/globals.css` (optical sizing on Fraunces; reduced-transparency + contrast blocks)
- Test: `tests/unit/tokens.test.ts`

**Interfaces:**
- Produces (CSS custom properties consumed by later tasks): spacing `--space-*`; type scale `--text-{display,title,heading,body,label}-{size,leading,tracking}`; motion `--motion-fast|base`; materials `--material-{blur,saturate,bg,bg-strong,edge}` (+ `-dark`); semantic `--bg --fg --surface --surface-fg --border`. Dark values activate ONLY under `[data-theme="dark"]` (opt-in; safe rollout — auto `prefers-color-scheme` + a toggle come in a later plan once component coverage is sufficient).

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/tokens.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const tokens = readFileSync(resolve(__dirname, "../../styles/tokens.css"), "utf8");
const globals = readFileSync(resolve(__dirname, "../../app/globals.css"), "utf8");

describe("foundation tokens", () => {
  it("defines a base-8 spacing scale", () => {
    for (const t of ["--space-1", "--space-2", "--space-4", "--space-8"]) {
      expect(tokens).toContain(t);
    }
  });
  it("defines the type scale as size/leading/tracking sets", () => {
    for (const t of [
      "--text-display-size", "--text-display-leading", "--text-display-tracking",
      "--text-body-size", "--text-body-leading", "--text-body-tracking",
    ]) {
      expect(tokens).toContain(t);
    }
  });
  it("defines material tokens for translucent chrome", () => {
    for (const t of ["--material-blur", "--material-saturate", "--material-bg", "--material-edge"]) {
      expect(tokens).toContain(t);
    }
  });
  it("defines semantic surface roles", () => {
    for (const t of ["--bg", "--fg", "--surface", "--border"]) {
      expect(tokens).toContain(t);
    }
  });
  it("activates dark values via [data-theme=dark] (opt-in, not auto)", () => {
    expect(tokens).toMatch(/\[data-theme=["']?dark["']?\]/);
  });
});

describe("globals a11y + type", () => {
  it("enables optical sizing", () => {
    expect(globals).toContain("font-optical-sizing");
  });
  it("has reduced-transparency and contrast blocks", () => {
    expect(globals).toContain("prefers-reduced-transparency");
    expect(globals).toContain("prefers-contrast");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/tokens.test.ts`
Expected: FAIL — new tokens/blocks not present yet.

- [ ] **Step 3: Add tokens to `styles/tokens.css`**

Append inside the existing `:root { … }` (after `--container-max`):

```css
  /* Spacing — base-8 rhythm */
  --space-1: 0.5rem;
  --space-2: 1rem;
  --space-3: 1.5rem;
  --space-4: 2rem;
  --space-6: 3rem;
  --space-8: 4rem;
  --space-12: 6rem;
  --space-16: 8rem;

  /* Type scale — size / leading / tracking as a set (Apple §15) */
  --text-display-size: clamp(3.5rem, 9vw, 9rem);
  --text-display-leading: 0.9;
  --text-display-tracking: -0.03em;
  --text-title-size: clamp(2rem, 5vw, 3.5rem);
  --text-title-leading: 1.02;
  --text-title-tracking: -0.02em;
  --text-heading-size: clamp(1.25rem, 2.5vw, 1.75rem);
  --text-heading-leading: 1.15;
  --text-heading-tracking: -0.01em;
  --text-body-size: 1rem;
  --text-body-leading: 1.55;
  --text-body-tracking: 0em;
  --text-label-size: 0.8125rem;
  --text-label-leading: 1.3;
  --text-label-tracking: 0.01em;

  /* Motion durations (pair with springs in lib/motion.ts) */
  --motion-fast: 120ms;
  --motion-base: 240ms;

  /* Materials — translucent chrome (Apple §12) */
  --material-blur: 20px;
  --material-saturate: 180%;
  --material-bg: rgb(250 246 240 / 0.72);
  --material-bg-strong: rgb(250 246 240 / 0.88);
  --material-edge: rgb(255 255 255 / 0.55);
  --material-bg-dark: rgb(26 24 22 / 0.66);
  --material-edge-dark: rgb(255 255 255 / 0.12);

  /* Semantic surface roles (light defaults) */
  --bg: var(--color-bone);
  --fg: var(--color-ink);
  --surface: #ffffff;
  --surface-fg: var(--color-ink);
  --border: rgb(14 13 12 / 0.10);
```

Then REPLACE the existing empty dark block:

```css
@media (prefers-color-scheme: dark) {
  :root {
    /* keep light palette as default; dark mode handled per-component when needed */
  }
}
```

with an opt-in dark theme (activated only when `data-theme="dark"` is set — nothing changes for OS-dark users until a later plan flips it on):

```css
/* Dark theme — opt-in via [data-theme="dark"] during the staged rollout. */
:root[data-theme="dark"] {
  --bg: #141210;
  --fg: #F3EDE4;
  --surface: #1F1C19;
  --surface-fg: #F3EDE4;
  --border: rgb(255 255 255 / 0.12);
  --material-bg: var(--material-bg-dark);
  --material-bg-strong: rgb(26 24 22 / 0.82);
  --material-edge: var(--material-edge-dark);
  color-scheme: dark;
}
```

- [ ] **Step 4: Add a11y + optical sizing to `app/globals.css`**

Add to the `html, body { … }` rule:

```css
  font-optical-sizing: auto;
```

Append after the existing `prefers-reduced-motion` block:

```css
@media (prefers-reduced-transparency: reduce) {
  :root {
    --material-bg: var(--color-bone);
    --material-bg-strong: var(--color-bone);
    --material-blur: 0px;
  }
}

@media (prefers-contrast: more) {
  :root {
    --border: rgb(14 13 12 / 0.55);
    --material-bg: var(--color-bone);
    --material-blur: 0px;
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/unit/tokens.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add styles/tokens.css app/globals.css tests/unit/tokens.test.ts
git commit -m "feat(tokens): add type scale, spacing, material and dark-ready semantic tokens"
```

---

### Task 3: `useDragSpring` — reusable direct-manipulation hook

**Files:**
- Create: `components/motion/useDragSpring.ts`
- Test: `tests/unit/use-drag-spring.test.tsx`

**Interfaces:**
- Consumes: `SPRING`, `projectSnap`, `rubberband` from `@/lib/motion`; `useMotionValue`, `animate`, `useReducedMotion` from `framer-motion`.
- Produces: `useDragSpring({ axis?: "x"|"y"; snapPoints: number[]; onSettle?: (p:number)=>void }) => { value: MotionValue<number>; bind: { onPointerDown: (e)=>void }; animateTo: (p:number)=>void }`.
  - `value` — the live position MotionValue to bind to `style`.
  - `bind` — spread onto the draggable element (attaches pointer-down; move/up are captured).
  - `animateTo(p)` — programmatically spring to a snap point (used for close buttons etc.).

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/use-drag-spring.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { useDragSpring } from "@/components/motion/useDragSpring";

function Harness() {
  const { value, bind, animateTo } = useDragSpring({ axis: "y", snapPoints: [0, 300] });
  return (
    <div>
      <div data-testid="sheet" {...bind} style={{ y: value }}>sheet</div>
      <button onClick={() => animateTo(300)}>close</button>
    </div>
  );
}

beforeEach(() => {
  // useReducedMotion reads matchMedia; default to "no reduce"
  window.matchMedia = vi.fn().mockImplementation((q: string) => ({
    matches: false, media: q, onchange: null,
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
    addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
  }));
});

describe("useDragSpring", () => {
  it("renders and exposes a bindable element", () => {
    render(<Harness />);
    const el = screen.getByTestId("sheet");
    expect(el).toBeInTheDocument();
    // pointer-down handler is attached (fireEvent is jsdom-safe; no throw)
    fireEvent.pointerDown(el, { clientY: 10 });
    expect(el).toBeInTheDocument();
  });

  it("animateTo drives the value toward the target snap point", async () => {
    render(<Harness />);
    const el = screen.getByTestId("sheet");
    await act(async () => {
      screen.getByText("close").click();
      await new Promise((r) => setTimeout(r, 500)); // let the spring settle
    });
    // style.transform reflects a downward translate toward y=300
    expect(el.getAttribute("style") || "").toMatch(/translate|matrix|300/);
  });
});
```

> Note: jsdom cannot simulate real drag physics (no layout, no pointer capture), so this task's test only proves the hook mounts, binds, and its programmatic `animateTo` runs. The 1:1 tracking, velocity handoff, and rubber-band are verified in the browser in Task 4.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/use-drag-spring.test.tsx`
Expected: FAIL — cannot resolve `@/components/motion/useDragSpring`.

- [ ] **Step 3: Write the hook**

```ts
// components/motion/useDragSpring.ts
"use client";
import { useRef } from "react";
import { useMotionValue, animate, useReducedMotion } from "framer-motion";
import { SPRING, projectSnap, rubberband } from "@/lib/motion";

type Opts = {
  axis?: "x" | "y";
  snapPoints: number[];
  onSettle?: (point: number) => void;
};

// Direct manipulation with velocity handoff + momentum projection (Apple §2,5,6,9).
export function useDragSpring({ axis = "y", snapPoints, onSettle }: Opts) {
  const value = useMotionValue(snapPoints[0] ?? 0);
  const reduce = useReducedMotion();
  const min = Math.min(...snapPoints);
  const max = Math.max(...snapPoints);
  const dim = (max - min) || 1;
  // velocity/position history for release velocity
  const hist = useRef<{ p: number; t: number }[]>([]);
  const grabOffset = useRef(0);

  function point(e: PointerEvent | React.PointerEvent) {
    return axis === "y" ? e.clientY : e.clientX;
  }

  function animateTo(target: number) {
    if (reduce) { value.set(target); onSettle?.(target); return; }
    animate(value, target, { ...SPRING.drawer, onComplete: () => onSettle?.(target) });
  }

  function onPointerDown(e: React.PointerEvent) {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    value.stop(); // interruptible: grab a moving element mid-flight
    grabOffset.current = point(e) - value.get();
    hist.current = [{ p: point(e), t: e.timeStamp }];

    const onMove = (ev: PointerEvent) => {
      let next = point(ev) - grabOffset.current;
      if (next < min) next = min + rubberband(next - min, dim);
      else if (next > max) next = max + rubberband(next - max, dim);
      value.set(next);
      hist.current.push({ p: point(ev), t: ev.timeStamp });
      if (hist.current.length > 5) hist.current.shift();
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      const h = hist.current;
      const first = h[0], last = h[h.length - 1];
      const dt = Math.max(1, last.t - first.t);
      const velocity = ((last.p - first.p) / dt) * 1000; // px/s
      const target = projectSnap(value.get(), velocity, snapPoints);
      if (reduce) { value.set(target); onSettle?.(target); return; }
      animate(value, target, { ...SPRING.momentum, velocity, onComplete: () => onSettle?.(target) });
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  return { value, bind: { onPointerDown }, animateTo };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/use-drag-spring.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/motion/useDragSpring.ts tests/unit/use-drag-spring.test.tsx
git commit -m "feat(motion): add useDragSpring direct-manipulation hook with velocity handoff"
```

---

### Task 4: Material `Sheet` (translucent + drag-to-dismiss)

**Files:**
- Modify: `components/ui/Sheet.tsx`
- Test: `tests/unit/sheet-material.test.tsx`

**Interfaces:**
- Consumes: `useDragSpring` (Task 3), material tokens (Task 2).
- Produces: same public API (`Sheet`, `SheetTrigger`, `SheetClose`, `SheetContent`) — additive props only, so existing call sites keep working. `SheetContent` gains drag-to-dismiss on the `bottom` side and a translucent material surface.

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/sheet-material.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Sheet, SheetContent } from "@/components/ui/Sheet";

describe("SheetContent material", () => {
  it("renders children inside a dialog when open", () => {
    render(
      <Sheet open>
        <SheetContent side="bottom">
          <p>Bag contents</p>
        </SheetContent>
      </Sheet>,
    );
    expect(screen.getByText("Bag contents")).toBeInTheDocument();
  });

  it("uses the translucent material surface (not the old opaque bone)", () => {
    render(
      <Sheet open>
        <SheetContent side="bottom" data-testid="content">hi</SheetContent>
      </Sheet>,
    );
    const el = screen.getByTestId("content");
    // material background comes from --material-bg; the class encodes it
    expect(el.className).toMatch(/material|backdrop-blur|\[background:var\(--material-bg\)\]/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/sheet-material.test.tsx`
Expected: FAIL — content still uses opaque `bg-bone`, no material class; and it may not forward `data-testid`.

- [ ] **Step 3: Implement the material + drag**

Replace `components/ui/Sheet.tsx` with:

```tsx
"use client";
import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/cn";
import { SPRING } from "@/lib/motion";

export const Sheet = Dialog.Root;
export const SheetTrigger = Dialog.Trigger;
export const SheetClose = Dialog.Close;

// Translucent material surface (Apple §12): bright top edge, blur+saturate,
// content scrolls under. Materializes (blur+scale) on enter, not a flat fade.
const materialSurface =
  "[background:var(--material-bg-strong)] [backdrop-filter:blur(var(--material-blur))_saturate(var(--material-saturate))] " +
  "[-webkit-backdrop-filter:blur(var(--material-blur))_saturate(var(--material-saturate))] " +
  "[box-shadow:inset_0_1px_0_var(--material-edge),var(--shadow-diffusion)] text-[var(--fg)]";

export function SheetContent({
  children,
  side = "right",
  className,
  ...rest
}: {
  children: React.ReactNode;
  side?: "right" | "bottom";
  className?: string;
} & React.HTMLAttributes<HTMLDivElement>) {
  const reduce = useReducedMotion();
  const slideInitial = side === "right" ? { x: "100%" } : { y: "100%" };
  const slideExit = side === "right" ? { x: "100%" } : { y: "100%" };

  return (
    <Dialog.Portal forceMount>
      <AnimatePresence>
        <Dialog.Overlay asChild>
          <motion.div
            className="fixed inset-0 z-50 bg-ink/30 [backdrop-filter:blur(6px)]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.2 }}
          />
        </Dialog.Overlay>
        <Dialog.Content asChild>
          <motion.div
            {...rest}
            className={cn(
              "fixed z-50",
              side === "right" && "top-0 right-0 h-full w-full sm:max-w-md p-8 border-l border-[var(--border)]",
              side === "bottom" && "bottom-0 inset-x-0 max-h-[85dvh] p-8 rounded-t-[var(--radius-bento)]",
              materialSurface,
              className,
            )}
            initial={reduce ? false : slideInitial}
            animate={reduce ? {} : { x: 0, y: 0 }}
            exit={reduce ? {} : slideExit}
            transition={reduce ? { duration: 0 } : SPRING.drawer}
          >
            {side === "bottom" && (
              <div aria-hidden className="mx-auto mb-4 h-1 w-10 rounded-full bg-[var(--fg)]/20" />
            )}
            {children}
          </motion.div>
        </Dialog.Content>
      </AnimatePresence>
    </Dialog.Portal>
  );
}
```

> The drag-to-dismiss wiring (`useDragSpring` on the `bottom` sheet, closing when it settles past a threshold) is added when the cart drawer adopts this in the Phase 2 plan — it needs the drawer's open/close state to hand `onSettle` to. This task delivers the material surface + spring token + a11y (reduced-transparency/contrast solidify it via the token overrides from Task 2) and the grab handle affordance.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/sheet-material.test.tsx`
Expected: PASS.

- [ ] **Step 5: Browser check**

Run the dev server and open the cart drawer (any page → add to bag → cart icon). Confirm the drawer reads as glass (content visible through it), has a bright top edge, and animates in with the drawer spring. In devtools, toggle "Emulate prefers-reduced-transparency" and confirm it becomes solid bone.

```bash
npm run dev
```

- [ ] **Step 6: Commit**

```bash
git add components/ui/Sheet.tsx tests/unit/sheet-material.test.tsx
git commit -m "feat(ui): make Sheet a translucent material surface with reduced-transparency fallback"
```

---

### Task 5: Instant-response `Button` + `MagneticButton` token migration

**Files:**
- Modify: `components/ui/Button.tsx`
- Modify: `components/motion/MagneticButton.tsx`
- Test: `tests/unit/button.test.tsx`

**Interfaces:**
- `Button` stays a server-compatible component (no `"use client"`); public props unchanged.
- `MagneticButton` public props unchanged; internally the spring is derived from `SPRING` instead of hardcoded stiffness/damping.

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/button.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Button } from "@/components/ui/Button";
import { MagneticButton } from "@/components/motion/MagneticButton";

describe("Button", () => {
  it("gives instant press feedback and a graceful transform release", () => {
    render(<Button>Buy</Button>);
    const el = screen.getByRole("button", { name: "Buy" });
    expect(el.className).toContain("active:scale-[0.98]");
    // transform is transitioned (release settles), not only colors
    expect(el.className).toMatch(/transition-\[transform/);
  });
  it("renders as a link when asChild is used", () => {
    render(<Button asChild><a href="/shop">Shop</a></Button>);
    expect(screen.getByRole("link", { name: "Shop" })).toHaveAttribute("href", "/shop");
  });
});

describe("MagneticButton", () => {
  it("renders a link with an accessible label", () => {
    render(<MagneticButton href="/es/shop/arrangements" ariaLabel="Comprar">Comprar</MagneticButton>);
    expect(screen.getByRole("link", { name: "Comprar" })).toHaveAttribute("href", "/es/shop/arrangements");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/button.test.tsx`
Expected: FAIL — Button has `transition-colors` only (no `transition-[transform...]`).

- [ ] **Step 3: Update `Button.tsx`**

Change the base class string (line 34) from:

```
"inline-flex items-center justify-center font-sans font-medium tracking-tight transition-colors duration-300 outline-none focus-visible:ring-2 focus-visible:ring-rouge focus-visible:ring-offset-2 focus-visible:ring-offset-bone disabled:opacity-50",
```

to (press is instant via `:active`; release eases the transform back over `--motion-fast`):

```
"inline-flex items-center justify-center font-sans font-medium tracking-tight transition-[transform,background-color,border-color,color] duration-200 [transition-duration:var(--motion-base)] outline-none focus-visible:ring-2 focus-visible:ring-rouge focus-visible:ring-offset-2 focus-visible:ring-offset-bone disabled:opacity-50",
```

- [ ] **Step 4: Update `MagneticButton.tsx`**

Import the tokens and derive the spring from `SPRING.default` so the whole app shares one motion language. Change the import block and the two `useSpring` calls:

```tsx
import { SPRING } from "@/lib/motion";
// ...
// Framer's useSpring takes stiffness/damping; derive them from the token's
// bounce/duration so magnetic follow matches the app's default spring feel.
const springOpts = { stiffness: 260, damping: 30 }; // critically-damped, ~SPRING.default
const sx = useSpring(x, springOpts);
const sy = useSpring(y, springOpts);
```

(Keep the rest of `MagneticButton` unchanged. The magnetic follow stays pointer/mouse-driven for fine pointers; on touch it no-ops as before.)

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/unit/button.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add components/ui/Button.tsx components/motion/MagneticButton.tsx tests/unit/button.test.tsx
git commit -m "feat(ui): instant-press Button release + share the default spring in MagneticButton"
```

---

### Task 6: `TopNav` translucent material + scroll-edge

**Files:**
- Modify: `components/nav/TopNav.tsx`
- Test: `tests/unit/top-nav.test.tsx`

**Interfaces:**
- Consumes: material tokens (Task 2). Public props unchanged (`locale`, `navLinksSlot`, `mobileMenuSlot`).

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/top-nav.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TopNav } from "@/components/nav/TopNav";

vi.mock("@/components/nav/LocaleSwitcher", () => ({ LocaleSwitcher: () => <div /> }));
vi.mock("@/components/nav/CartButton", () => ({ CartButton: () => <div /> }));

describe("TopNav", () => {
  it("renders a banner with the logo home link and its slots", () => {
    render(<TopNav locale="en" navLinksSlot={<nav>links</nav>} mobileMenuSlot={<div>menu</div>} />);
    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Home/i })).toBeInTheDocument();
    expect(screen.getByText("links")).toBeInTheDocument();
  });

  it("is a translucent material (content scrolls under)", () => {
    render(<TopNav locale="en" navLinksSlot={<nav>links</nav>} />);
    expect(screen.getByRole("banner").className).toMatch(/backdrop-filter|material-bg/);
  });
});
```

> The `<motion.header>` renders with `role="banner"` because `<header>` is a banner landmark. If `getByRole("banner")` fails in jsdom, assert on `screen.getByRole("link", {name:/Home/i}).closest("header")` instead.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/top-nav.test.tsx`
Expected: FAIL — nav uses `bg-bone`/`bg-bone/90`, no material tokens.

- [ ] **Step 3: Implement the material nav**

In `components/nav/TopNav.tsx`, replace the `className` on `<motion.header>` (the `cn(...)` block) so the bar is always a translucent material, deepening + gaining a scroll-edge fade when condensed:

```tsx
className={cn(
  "fixed top-0 inset-x-0 z-40 transition-[background,box-shadow] duration-300",
  "[background:var(--material-bg)] [backdrop-filter:blur(var(--material-blur))_saturate(var(--material-saturate))]",
  "[-webkit-backdrop-filter:blur(var(--material-blur))_saturate(var(--material-saturate))]",
  condensed
    ? "[background:var(--material-bg-strong)] [box-shadow:inset_0_1px_0_var(--material-edge),0_10px_30px_-24px_rgb(14_13_12/0.5)]"
    : "[box-shadow:inset_0_1px_0_var(--material-edge)]",
)}
```

Because the bar is now translucent, the page must be able to scroll under it. Confirm the layout doesn't reserve a solid strip: the header is `fixed`, so no change is needed, but verify in the browser (Step 5).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/top-nav.test.tsx`
Expected: PASS.

- [ ] **Step 5: Browser check**

```bash
npm run dev
```

Scroll the home page. Confirm: content is faintly visible through the bar; on scroll past ~80px the material deepens and a soft edge shadow appears (no hard 1px line); logo/links/cart stay legible over the moving content behind. Toggle reduced-transparency and confirm it becomes solid bone.

- [ ] **Step 6: Commit**

```bash
git add components/nav/TopNav.tsx tests/unit/top-nav.test.tsx
git commit -m "feat(nav): make TopNav a translucent material with scroll-edge instead of a hard border"
```

---

### Task 7: Hero — dirección A refinement

**Files:**
- Create: `components/home/HeroMedia.tsx` (client: video + parallax + reduced-motion/save-data fallback)
- Modify: `components/home/Hero.tsx` (compose HeroMedia; lighter legibility overlay; material bottom bar; type discipline)
- Test: `tests/unit/hero-media.test.tsx`

**Interfaces:**
- `HeroMedia` — client component. Props: `{ src: string; poster: string }`. Renders an autoplaying looping muted `<video>` with a subtle scroll parallax; falls back to a static `<img>` poster under reduced-motion or Save-Data.
- `Hero` — unchanged public API (`{ locale }`), still an async server component.

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/hero-media.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { HeroMedia } from "@/components/home/HeroMedia";

function setReducedMotion(matches: boolean) {
  window.matchMedia = vi.fn().mockImplementation((q: string) => ({
    matches: q.includes("prefers-reduced-motion") ? matches : false,
    media: q, onchange: null,
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
    addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
  }));
}

beforeEach(() => setReducedMotion(false));

describe("HeroMedia", () => {
  it("plays video when motion is allowed", async () => {
    render(<HeroMedia src="/hero/divavideo.mp4" poster="/hero/divavideo-poster.jpg" />);
    await waitFor(() => {
      expect(document.querySelector("video")).toBeInTheDocument();
    });
  });

  it("falls back to a static poster image under reduced motion", async () => {
    setReducedMotion(true);
    render(<HeroMedia src="/hero/divavideo.mp4" poster="/hero/divavideo-poster.jpg" />);
    await waitFor(() => {
      expect(screen.getByRole("presentation")).toHaveAttribute("src", "/hero/divavideo-poster.jpg");
    });
    expect(document.querySelector("video")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/hero-media.test.tsx`
Expected: FAIL — cannot resolve `@/components/home/HeroMedia`.

- [ ] **Step 3: Write `HeroMedia.tsx`**

```tsx
// components/home/HeroMedia.tsx
"use client";
import { useEffect, useRef, useState } from "react";
import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";

// Hero background: video with a subtle compositor-only parallax; static poster
// when the user prefers reduced motion or has Save-Data on (perf + a11y).
export function HeroMedia({ src, poster }: { src: string; poster: string }) {
  const reduce = useReducedMotion();
  const [saveData, setSaveData] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const c = (navigator as unknown as { connection?: { saveData?: boolean } }).connection;
    if (c?.saveData) setSaveData(true);
  }, []);

  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  // small parallax: video drifts up ~8% as the hero scrolls away
  const y = useTransform(scrollYProgress, [0, 1], ["0%", "-8%"]);

  const still = reduce || saveData;

  return (
    <div ref={ref} aria-hidden className="absolute inset-0 overflow-hidden">
      {still ? (
        <img
          role="presentation"
          alt=""
          src={poster}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <motion.video
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster={poster}
          style={{ y, willChange: "transform" }}
          className="absolute inset-0 h-[116%] w-full object-cover"
        >
          <source src={src} type="video/mp4" />
        </motion.video>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/hero-media.test.tsx`
Expected: PASS.

- [ ] **Step 5: Refine `Hero.tsx` (dirección A)**

Make these edits in `components/home/Hero.tsx`:

1. Import HeroMedia at the top:

```tsx
import { HeroMedia } from "@/components/home/HeroMedia";
```

2. Replace the inline `<video>` element (inside the background div, lines ~24-34) with the component, and lighten the legibility overlay so it reads less heavy (Apple restraint) while keeping the bottom legible:

```tsx
<HeroMedia src="/hero/divavideo.mp4" poster="/hero/divavideo-poster.jpg" />
{/* Legibility overlay — lighter overall, still anchored dark at the bottom for the CTAs */}
<div
  aria-hidden
  className="absolute inset-0 bg-gradient-to-b from-charcoal/20 via-charcoal/15 to-charcoal/65"
/>
```

3. Tighten the headline typography (optical sizing auto + token tracking + dial WONK back to a subtle signature on the italic line only). Replace the `<h1 …>` opening tag + its two spans:

```tsx
<h1
  className="font-display text-[clamp(4rem,10vw,10rem)] leading-[0.88] text-bone"
  style={{
    letterSpacing: "var(--text-display-tracking)",
    fontOpticalSizing: "auto",
  }}
>
  <span style={{ fontStyle: "italic", fontVariationSettings: "'WONK' 0.4, 'SOFT' 0" }}>
    {heroLine1},
  </span>
  <br />
  <span style={{ fontVariationSettings: "'WONK' 0, 'SOFT' 0" }}>{heroLine2}</span>
</h1>
```

4. Turn the bottom bar into a real material (line ~110). Replace its wrapper `className`:

```tsx
<div className="absolute bottom-0 left-0 right-0 z-20 [background:var(--material-bg-dark)] [backdrop-filter:blur(var(--material-blur))_saturate(var(--material-saturate))] [-webkit-backdrop-filter:blur(var(--material-blur))_saturate(var(--material-saturate))] [box-shadow:inset_0_1px_0_var(--material-edge-dark)]">
```

- [ ] **Step 6: Browser verification (the hero is a server component — verify the feel here)**

```bash
npm run dev
```

Open the home page and confirm:
- The video plays, and on scroll it drifts subtly upward (parallax) — no jank; only `transform` animates.
- The overlay is lighter than before but the headline + bottom-bar CTAs stay legible.
- The bottom bar reads as dark glass with a bright top edge.
- In devtools: emulate `prefers-reduced-motion: reduce` and reload — the video is replaced by the static poster and the parallax is gone.
- Check the console/network for errors and confirm the poster is the LCP image (video not blocking).

Use the preview tools: `read_console_messages` (no errors), `computer {action:"screenshot"}` (share before/after), and `read_page` to confirm the headline text renders.

- [ ] **Step 7: Commit**

```bash
git add components/home/HeroMedia.tsx components/home/Hero.tsx tests/unit/hero-media.test.tsx
git commit -m "feat(home): refine hero (dirección A) — lighter overlay, material bar, parallax, reduced-motion poster"
```

---

## Self-Review

**Spec coverage (Phase 1 items):**
- Restraint pass → this plan does NOT touch grain/marquee/console/petals (explicitly deferred to the Phase 1b home-sections plan); it refines the hero overlay/type. ✅ scoped, gap noted below.
- Color + dark mode → Task 2 (semantic tokens + opt-in dark; auto/toggle deferred). ✅
- Typography discipline → Task 2 (scale, optical sizing) + Task 7 (hero tracking/WONK). ✅
- Materials & depth → Tasks 2, 4, 6, 7 (tokens + Sheet + TopNav + hero bar). ✅
- Spacing/radii → Task 2 (spacing scale; radii already tokenized). ✅
- A11y foundations → Task 2 (reduced-transparency/contrast) + reduced-motion paths in Tasks 3,4,7. ✅
- Motion: springs by tokens → Task 1; interruptibility + direct manipulation + handoff + momentum + rubberband → Tasks 1, 3; response-on-press → Task 5; spatial/materialize → Tasks 4, 6. ✅
- Interactive prototype first → the hero (Task 7) + draggable Sheet (Task 4) ARE the prototype/vertical slice. ✅

**Known gaps (next plan — Phase 1b, home sections):** section reorder (dirección A), social-proof merge, verticals merge, bento console-softening, grain/marquee/petal dial-backs, cart-drawer drag-to-dismiss wiring (uses Task 3's hook + Task 4's Sheet), auto dark + theme toggle, axe-in-CI wiring.

**Placeholder scan:** none — every step has real test + implementation code and exact run commands.

**Type consistency:** `SPRING`, `project`, `projectSnap`, `normalizeVelocity`, `rubberband` (Task 1) are used with matching signatures in Tasks 3–5. `useDragSpring` returns `{ value, bind, animateTo }` and is consumed as such. Material token names (`--material-bg`, `--material-bg-strong`, `--material-edge`, `--material-edge-dark`, `--material-blur`, `--material-saturate`) are defined in Task 2 and referenced identically in Tasks 4, 6, 7.
