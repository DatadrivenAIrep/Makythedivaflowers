# Apple Fluid Redesign — Phase 2b: PDP (swipe gallery + sticky add-to-bag) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** Bring the product page to the Apple feel: a swipeable image gallery with momentum + snap (the first real consumer of `useDragSpring`), and a mobile sticky translucent add-to-bag bar so the buy action is always reachable. Fix the `useDragSpring` unmount-listener leak now that it has a consumer.

**Architecture:** Task 1 hardens `useDragSpring` (window-listener cleanup on unmount). Task 2 rewrites `ImageStack` into a horizontal track of N images bound to `useDragSpring` (`axis:"x"`, `snapPoints = images.map((_,i)=>-i*width)`, `projectSnap` picks the flung-to image, thumbnails stay in sync). Task 3 adds a mobile-only (`lg:hidden`) fixed material bar rendered by `PdpConfigurator` (it holds the variant/date/total state) reusing `AddToBag`.

**Tech Stack:** Next.js 16, React 19, Tailwind v4, Framer Motion 12 (`useMotionValue`/`animate`), next-intl, vitest + @testing-library/react (jsdom).

**Spec:** `docs/superpowers/specs/2026-08-22-apple-fluid-redesign-design.md` (Phase 2 PDP: "galería con manipulación directa (arrastrar, handoff de velocidad, snap), barra sticky de añadir a bolsa como material translúcido, feedback continuo en variantes").

## Global Constraints
- Modified Next.js — consult `node_modules/next/dist/docs/` before any Next API. Edits are React/CSS/Framer.
- `@/lib/motion` exports `SPRING`, `project`, `projectSnap`, `normalizeVelocity`, `rubberband`. `useDragSpring` returns `{ value, bind:{onPointerDown}, animateTo }`. `--material-*` tokens exist + active.
- Do NOT change cart/add-to-bag BEHAVIOR (`AddToBag.onClick` add+toast+openDrawer stays); do NOT touch checkout/Stripe. `PdpConfigurator` state contract (variantId/date/totalCents/disabled) unchanged.
- Reduced-motion: gallery falls back to no-drag click/crossfade navigation; sticky bar still works.
- Tests in `tests/unit/**`; run one file with `npx vitest run tests/unit/<file>`; do NOT gate on full `npm test` (flaky pre-existing set: checkout-schema/_preview/print-*/api-*). Gestures are browser-verified by the controller (`npm run dev`, `/en/product/<slug>`), clearing `.next` + restarting if Turbopack shows phantom errors.
- Branch `feat/apple-funnel-2b-pdp`. `npx tsc --noEmit` clean gates every task. Commit per task.

## File Structure
```
components/motion/useDragSpring.ts        MOD  window-listener cleanup on unmount (fix latent leak)
tests/unit/use-drag-spring.test.tsx       MOD  add: unmount removes window listeners
components/product/ImageStack.tsx         MOD  swipeable N-image track via useDragSpring + thumbnail sync + a11y
tests/unit/image-stack.test.tsx           NEW  renders N images + thumbnails; thumbnail click sets active
components/product/PdpConfigurator.tsx    MOD  render a mobile sticky material add-to-bag bar (reuses AddToBag)
```

---

### Task 1: Fix `useDragSpring` unmount-listener leak

**Files:** Modify `components/motion/useDragSpring.ts`, `tests/unit/use-drag-spring.test.tsx`

The hook adds `window` `pointermove`/`pointerup` listeners in `onPointerDown` and removes them in `onUp`. If the component unmounts mid-drag, `onUp` never fires → the listeners (and their stale closures over `value`/`hist`) leak. Add an unmount cleanup.

- [ ] **Step 1: Add the failing test** to `tests/unit/use-drag-spring.test.tsx` (a new `it`):

```tsx
import { act } from "@testing-library/react"; // ensure imported
it("removes window listeners on unmount after a drag starts", () => {
  const removed: string[] = [];
  const origAdd = window.addEventListener;
  const origRemove = window.removeEventListener;
  const addSpy = vi.spyOn(window, "addEventListener");
  vi.spyOn(window, "removeEventListener").mockImplementation((type, ...a) => {
    removed.push(String(type));
    return (origRemove as typeof window.removeEventListener).call(window, type, ...a);
  });
  const { unmount } = render(<Harness />);       // Harness already in this file
  const el = screen.getByTestId("sheet");
  fireEvent.pointerDown(el, { clientY: 10 });    // starts a drag → window listeners added
  expect(addSpy.mock.calls.some(([t]) => t === "pointermove")).toBe(true);
  act(() => { unmount(); });                     // unmount mid-drag
  expect(removed).toContain("pointermove");
  expect(removed).toContain("pointerup");
  (window.addEventListener as unknown) = origAdd; (window.removeEventListener as unknown) = origRemove;
});
```

> Uses the existing `Harness`, `fireEvent`, `screen`, `vi` in that test file. If the spy/teardown pattern is awkward, a simpler equivalent is fine as long as it proves the two listeners are removed on unmount — note any change.

- [ ] **Step 2: Run → FAIL** (`npx vitest run tests/unit/use-drag-spring.test.tsx`) — no unmount cleanup yet.

- [ ] **Step 3: Implement the cleanup** in `useDragSpring.ts`:
  - Import `useEffect`: `import { useRef, useEffect } from "react";`.
  - Add a ref for the live listeners: `const active = useRef<{ move: (e: PointerEvent) => void; up: () => void } | null>(null);`.
  - In `onPointerDown`, after defining `onMove`/`onUp`, set `active.current = { move: onMove, up: onUp };` (before/after adding the window listeners).
  - In `onUp`, after removing the listeners, clear it: `active.current = null;`.
  - Add the unmount cleanup:
    ```ts
    useEffect(() => () => {
      if (active.current) {
        window.removeEventListener("pointermove", active.current.move);
        window.removeEventListener("pointerup", active.current.up);
      }
    }, []);
    ```

- [ ] **Step 4: Run → PASS** (that test + the pre-existing 2 in the file all green); `npx tsc --noEmit` clean.

- [ ] **Step 5: Commit**
```bash
git add components/motion/useDragSpring.ts tests/unit/use-drag-spring.test.tsx
git commit -m "fix(motion): remove useDragSpring window listeners on unmount mid-drag"
```

---

### Task 2: `ImageStack` swipeable gallery via `useDragSpring`

**Files:** Modify `components/product/ImageStack.tsx`; Test `tests/unit/image-stack.test.tsx`

Today `ImageStack` is thumbnail-click-only with a crossfade. Make the main image a horizontal track of N images that swipes with momentum and snaps (via `useDragSpring`), keeping the thumbnails in sync.

- [ ] **Step 1: Write the failing test** `tests/unit/image-stack.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ImageStack } from "@/components/product/ImageStack";
import type { Product } from "@/types/product";

beforeEach(() => {
  window.matchMedia = vi.fn().mockImplementation((q: string) => ({
    matches: false, media: q, onchange: null,
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
    addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
  }));
});

const product = {
  images: [
    { src: "/a.webp", alt: { en: "Alpha", es: "Alpha" }, aspect: "4/5" },
    { src: "/b.webp", alt: { en: "Beta", es: "Beta" }, aspect: "4/5" },
    { src: "/c.webp", alt: { en: "Gamma", es: "Gamma" }, aspect: "4/5" },
  ],
} as unknown as Product;

describe("ImageStack", () => {
  it("renders every image and a thumbnail per image", () => {
    render(<ImageStack product={product} locale="en" />);
    // main track has all images; thumbnails mirror them → each alt appears
    expect(screen.getAllByAltText("Alpha").length).toBeGreaterThan(0);
    expect(screen.getAllByAltText("Gamma").length).toBeGreaterThan(0);
    // one thumbnail button per image
    expect(screen.getAllByRole("button").length).toBe(3);
  });

  it("selecting a thumbnail marks it current", () => {
    render(<ImageStack product={product} locale="en" />);
    const thumbs = screen.getAllByRole("button");
    fireEvent.click(thumbs[2]!);
    expect(thumbs[2]).toHaveAttribute("aria-current", "true");
  });

  it("renders a single image without crashing (no track)", () => {
    const one = { images: [product.images[0]] } as unknown as Product;
    render(<ImageStack product={one} locale="en" />);
    expect(screen.getByAltText("Alpha")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run → FAIL** (`npx vitest run tests/unit/image-stack.test.tsx`).

- [ ] **Step 3: Rewrite `ImageStack.tsx`.** Keep the export `memo(ImageStackImpl)`, props `{ product, locale }`, and the aspect logic. Replace the single crossfading image with a measured N-image track bound to `useDragSpring`:

```tsx
"use client";
import { useState, useRef, useEffect, memo } from "react";
import { motion } from "framer-motion";
import { useDragSpring } from "@/components/motion/useDragSpring";
import type { Product } from "@/types/product";
import type { Locale } from "@/types/locale";
import { cn } from "@/lib/cn";

function aspectClass(a?: string) {
  return a === "1/1" ? "aspect-square" : a === "16/9" ? "aspect-video" : "aspect-[4/5]";
}

function ImageStackImpl({ product, locale }: { product: Product; locale: Locale }) {
  const images = product.images;
  const [activeIdx, setActiveIdx] = useState(0);
  const [width, setWidth] = useState(0);
  const viewportRef = useRef<HTMLDivElement>(null);
  const first = images[0];

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const measure = () => setWidth(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const snapPoints = images.map((_, i) => -i * width);
  const { value, bind, animateTo } = useDragSpring({
    axis: "x",
    snapPoints: snapPoints.length ? snapPoints : [0],
    onSettle: (p) => { if (width) setActiveIdx(Math.round(-p / width)); },
  });

  function goTo(i: number) {
    setActiveIdx(i);
    if (width) animateTo(-i * width);
  }

  if (!first) return null;
  const single = images.length < 2;

  return (
    <div>
      <div
        ref={viewportRef}
        className={cn(
          "relative overflow-hidden rounded-[var(--radius-product)] bg-mute-100 touch-pan-y",
          aspectClass(first.aspect),
        )}
        role="group"
        aria-roledescription="carousel"
        onKeyDown={(e) => {
          if (e.key === "ArrowRight" && activeIdx < images.length - 1) goTo(activeIdx + 1);
          if (e.key === "ArrowLeft" && activeIdx > 0) goTo(activeIdx - 1);
        }}
        tabIndex={0}
      >
        {single ? (
          <img src={first.src} alt={first.alt[locale]} className="absolute inset-0 size-full object-cover" />
        ) : (
          <motion.div className="flex h-full" style={{ x: value, willChange: "transform" }} {...bind}>
            {images.map((img) => (
              <img
                key={img.src}
                src={img.src}
                alt={img.alt[locale]}
                draggable={false}
                className="h-full w-full shrink-0 object-cover select-none"
              />
            ))}
          </motion.div>
        )}
      </div>

      {!single && (
        <div className="mt-3 grid grid-cols-3 gap-3">
          {images.map((img, i) => (
            <button
              key={img.src}
              type="button"
              onClick={() => goTo(i)}
              aria-label={img.alt[locale]}
              aria-current={i === activeIdx}
              className={cn(
                "aspect-square overflow-hidden rounded-[var(--radius-product)] border transition-colors",
                i === activeIdx ? "border-ink/45" : "border-ink/10 hover:border-ink/25",
              )}
            >
              <img src={img.src} alt={img.alt[locale]} className="size-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export const ImageStack = memo(ImageStackImpl);
```

Notes for the implementer:
- `touch-pan-y` on the viewport lets vertical page scroll pass while the horizontal drag is captured by `useDragSpring`'s pointer capture.
- Each track image is `w-full shrink-0` so it's exactly the viewport width; the track translateX = `value`.
- `useDragSpring` handles velocity handoff + `projectSnap` (nearest of the `-i*width` snap points) + rubber-band at the ends + reduced-motion (its `animateTo`/release set the value instantly when reduced). No extra reduced-motion branch needed for the drag, but the click/keyboard path always works.
- jsdom reports `clientWidth === 0`, so in tests `width` stays 0 and `snapPoints=[0]` — the component still renders all images + thumbnails and thumbnail-click still sets `activeIdx` (that's what the unit test checks). The real swipe/snap is browser-verified.
- Keep `aria-current`, thumbnail alts, and add the carousel `role`/keyboard for a11y.

- [ ] **Step 4: Run → PASS**; `npx tsc --noEmit` clean.

- [ ] **Step 5: Browser check (controller).** `/en/product/<multi-image slug>` (e.g. `ivory-and-emerald`): swipe the main image left/right on touch/trackpad → it follows the finger, flings to the projected image with momentum, rubber-bands at the ends; thumbnails update to the current image and clicking a thumbnail animates to it; arrow keys navigate; single-image products show no track. Vertical scroll still works over the image. Reduced-motion → instant jumps, no drag.

- [ ] **Step 6: Commit**
```bash
git add components/product/ImageStack.tsx tests/unit/image-stack.test.tsx
git commit -m "feat(pdp): swipeable image gallery with momentum + snap (useDragSpring)"
```

---

### Task 3: Mobile sticky material add-to-bag bar

**Files:** Modify `components/product/PdpConfigurator.tsx`

On desktop the right column is `lg:sticky` so the add-to-bag stays visible; on mobile it sits at the bottom of a long page. Add a mobile-only (`lg:hidden`) fixed translucent material bar so the buy action is always reachable. It reuses `AddToBag` with the same state, so behavior is identical.

- [ ] **Step 1: Read** `components/product/PdpConfigurator.tsx` (it holds `variantId`, `date`, `totalCents`, and renders the inline `<AddToBag .../>` with `disabled={!variantId || !date}`).

- [ ] **Step 2: Add the sticky bar.** In the non-quote return, after the existing inline `<AddToBag/>`, render a mobile-only fixed material bar carrying the SAME props. Skip it for `quoteOnly` (that branch returns early already) and for subscriptions is fine to keep. Add before the closing `</div>`:

```tsx
{/* Mobile-only sticky buy bar — desktop keeps the sticky column */}
<div
  className="lg:hidden fixed inset-x-0 bottom-0 z-40 px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3
             [background:var(--material-bg-strong)]
             [backdrop-filter:blur(var(--material-blur))_saturate(var(--material-saturate))]
             [-webkit-backdrop-filter:blur(var(--material-blur))_saturate(var(--material-saturate))]
             [box-shadow:inset_0_1px_0_var(--material-edge),0_-8px_30px_-24px_rgb(14_13_12/0.5)]"
>
  <AddToBag
    productId={product.id}
    variantId={variantId}
    addOnIds={addOnIds}
    totalCents={totalCents}
    disabled={!variantId || !date}
    locale={locale}
    cardMessage={message}
  />
</div>
```

> Two `AddToBag` instances now exist on mobile (inline + sticky); both add correctly (shared cart store). Their local `idle/added` label state is independent — acceptable. If a reviewer prefers a single control, that's a larger refactor deferred to a follow-up. Ensure the sticky bar doesn't overlap the last content: add `pb-24 lg:pb-0` to the configurator's outer `<div>` (the `flex flex-col gap-6`) so the inline content clears the fixed bar on mobile.

- [ ] **Step 3: `npx tsc --noEmit` clean.** (No new unit test — this is layout/visual; browser-verified. The existing PdpConfigurator behavior is unchanged.)

- [ ] **Step 4: Browser check (controller).** On a narrow viewport (`/en/product/<slug>`), a translucent material bar is pinned to the bottom with the price + add-to-bag; it adds to bag (drawer opens) exactly like the inline one; on `lg` widths the bar is hidden and the sticky column behaves as before; content above isn't hidden behind the bar. Reduced-transparency → the bar solidifies (Task-2 tokens already handle it).

- [ ] **Step 5: Commit**
```bash
git add components/product/PdpConfigurator.tsx
git commit -m "feat(pdp): mobile sticky material add-to-bag bar"
```

---

## Self-Review
- **Spec coverage (PDP):** direct-manipulation gallery (drag + velocity handoff + snap) ✅ T2; sticky material add-to-bag bar ✅ T3; `useDragSpring` leak fixed ✅ T1. Variant "feedback continuo" (press spring on VariantChips) is the remaining PDP polish — deferred to a small follow-up (out of this slice's core).
- **Verification honesty:** unit tests cover the leak cleanup (T1), and ImageStack's non-gesture behavior (renders N images/thumbnails, thumbnail-click sets active, single-image) — jsdom `clientWidth=0` means the swipe/snap itself is browser-verified by the controller. Sticky bar is browser-verified.
- **Type/interface consistency:** `useDragSpring({axis,snapPoints,onSettle}) → {value,bind,animateTo}` used as defined; `AddToBag` reused with its exact prop shape; `PdpConfigurator` state contract unchanged.
- **No behavior/logic changes:** add-to-bag/cart/toast/checkout untouched; only the gallery interaction + a second (identical) buy affordance + the hook cleanup.
- **Follow-ups:** VariantChips/AddToBag press-spring feedback; consider unifying the two AddToBag instances; then Phase 2c (shop filters polish, checkout visual) and Phase 3.
