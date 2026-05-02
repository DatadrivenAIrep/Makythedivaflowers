# CategoryOrbit Mobile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the broken mobile rendering of the homepage `CategoryOrbit` ("The Collection · 06 Categories") section by making category images always visible, hiding hover-only chrome, and tightening spacing — without touching the desktop bento experience.

**Architecture:** Single-file change to `components/home/CategoryOrbit.tsx`. The hover-driven `motion.div` with `clip-path` reveal is wrapped in `hidden md:block` and a sibling static `<img>` (with `md:hidden`) is rendered for mobile, eliminating any need for JS viewport detection or SSR-flicker. Mobile-only Tailwind utilities (`max-md:`, `md:hidden`, `hidden md:flex`) toggle the rest of the chrome.

**Tech Stack:** Next.js 16.2.4, React 19.2.4, Tailwind CSS v4, framer-motion 12, Playwright (e2e), Vitest + @testing-library/react (unit). No new dependencies.

---

## Spec

See `docs/superpowers/specs/2026-05-02-category-orbit-mobile-design.md`. Acceptance criteria from the spec:

1. iPhone-class viewport (375×812) — all six tiles show their image with gradient overlay, name and index legible.
2. "[hover to enter]" hint and decorative line not visible below `md`.
3. LAT/LON chip not visible below `md`.
4. No tile reads as "dimmed/inactive" on mobile.
5. Tapping a tile navigates to `/${locale}/shop/${slug}`.
6. Desktop (≥md) is visually unchanged.
7. No console errors / hydration warnings.

## File Structure

- **Modify:** `components/home/CategoryOrbit.tsx` — sole component file.
- **Modify:** `tests/e2e/home.spec.ts` — add a mobile viewport test for this section.

No new files. No data, translations, or routing changes.

---

## Task 1: Add failing mobile e2e test

**Files:**
- Modify: `tests/e2e/home.spec.ts` (append a new `test(...)` block at the end of the file)

- [ ] **Step 1.1: Append the new failing test**

Open `tests/e2e/home.spec.ts` and append the following block (after the existing `home has no console errors` test):

```ts
test("CategoryOrbit renders correctly on mobile (iPhone viewport)", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/en");

  // Header is present
  await expect(page.getByRole("heading", { name: /Find your bloom/ })).toBeVisible();

  // Hover-only chrome is hidden on mobile
  await expect(page.getByText("[hover to enter]")).toBeHidden();
  await expect(page.getByText(/LAT 40\.7000/)).toBeHidden();

  // Each of the six category links is visible and points to the right shop page
  const slugs = [
    "arrangements",
    "bouquets",
    "plants",
    "gifts",
    "sympathy",
    "subscriptions",
  ];
  for (const slug of slugs) {
    const link = page.locator(`a[href="/en/shop/${slug}"]`);
    await expect(link).toBeVisible();
    // Image inside the tile must be visible (it was hover-gated before)
    const img = link.locator("img");
    await expect(img).toBeVisible();
    const box = await img.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(0);
    expect(box!.height).toBeGreaterThan(0);
  }
});
```

- [ ] **Step 1.2: Run the test and confirm it fails**

Run:

```bash
npm run e2e -- tests/e2e/home.spec.ts -g "CategoryOrbit renders correctly on mobile"
```

Expected: FAIL. The likely failure is on the image visibility check (image is hidden behind `clip-path: circle(0%)`) or the "[hover to enter]" text being visible on mobile. Either failure mode confirms the test exercises the broken behaviour.

- [ ] **Step 1.3: Commit the failing test**

```bash
git add tests/e2e/home.spec.ts
git commit -m "test(home): add failing mobile spec for CategoryOrbit"
```

---

## Task 2: Implement mobile changes in CategoryOrbit

**Files:**
- Modify: `components/home/CategoryOrbit.tsx`

The complete file should look like below after this task. Replace the existing file contents.

- [ ] **Step 2.1: Replace `components/home/CategoryOrbit.tsx`**

```tsx
"use client";
import { memo, useState, useCallback, useRef } from "react";
import Link from "next/link";
import {
  motion,
  useMotionValue,
  useSpring,
  useReducedMotion,
  AnimatePresence,
} from "framer-motion";
import { cn } from "@/lib/cn";
import { PetalRain } from "@/components/home/PetalRain";

type Item = {
  slug: string;
  seed: string;
  index: string;
  name: string;
  href: string;
};

type Props = {
  title: string;
  eyebrow: string;
  hoverHint: string;
  shopLabel: string;
  items: Item[];
};

const ELEGANT = [0.16, 1, 0.3, 1] as const;

const TILE_LAYOUT: { col: string; row: string }[] = [
  { col: "md:col-start-1 md:col-span-5", row: "md:row-start-1 md:row-span-3" },
  { col: "md:col-start-6 md:col-span-4", row: "md:row-start-1 md:row-span-2" },
  { col: "md:col-start-10 md:col-span-3", row: "md:row-start-1 md:row-span-3" },
  { col: "md:col-start-6 md:col-span-3", row: "md:row-start-3 md:row-span-3" },
  { col: "md:col-start-9 md:col-span-4", row: "md:row-start-4 md:row-span-3" },
  { col: "md:col-start-1 md:col-span-5", row: "md:row-start-4 md:row-span-3" },
];

type TileProps = {
  item: Item;
  layout: { col: string; row: string };
  shopLabel: string;
  isActive: boolean;
  onEnter: (slug: string) => void;
  onLeave: () => void;
  reduce: boolean;
};

function TileImpl({
  item,
  layout,
  shopLabel,
  isActive,
  onEnter,
  onLeave,
  reduce,
}: TileProps) {
  const ref = useRef<HTMLAnchorElement | null>(null);
  const x = useMotionValue(50);
  const y = useMotionValue(50);
  const sx = useSpring(x, { stiffness: 200, damping: 22 });
  const sy = useSpring(y, { stiffness: 200, damping: 22 });
  const [leavePos, setLeavePos] = useState({ x: 50, y: 50 });

  const handleMove = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const px = ((e.clientX - rect.left) / rect.width) * 100;
      const py = ((e.clientY - rect.top) / rect.height) * 100;
      x.set(px);
      y.set(py);
    },
    [x, y]
  );

  const handleEnter = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      handleMove(e);
      onEnter(item.slug);
    },
    [handleMove, onEnter, item.slug]
  );

  const handleLeave = useCallback(() => {
    setLeavePos({ x: x.get(), y: y.get() });
    onLeave();
  }, [x, y, onLeave]);

  const cx = reduce ? 50 : sx.get();
  const cy = reduce ? 50 : sy.get();

  return (
    <Link
      ref={ref}
      href={item.href}
      onMouseEnter={handleEnter}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      className={cn(
        "group relative block overflow-hidden rounded-[var(--radius-product)] border bg-charcoal transition-colors duration-500",
        "h-32 md:h-auto md:aspect-auto",
        layout.col,
        layout.row,
        "max-md:border-petal/40",
        isActive ? "md:border-petal/40" : "md:border-petal/15"
      )}
      style={{ borderRadius: "var(--radius-product)" }}
    >
      {/* Mobile: static always-visible image with side gradient */}
      <div className="absolute inset-0 md:hidden">
        <img
          src={`https://picsum.photos/seed/${item.seed}/1200/800`}
          alt={item.name}
          className="size-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-ink/65 via-ink/20 to-transparent" />
      </div>

      {/* Desktop: hover-driven clip-path reveal */}
      <motion.div
        className="absolute inset-0 hidden md:block"
        initial={false}
        animate={
          reduce
            ? { opacity: isActive ? 1 : 0 }
            : {
                clipPath: isActive
                  ? `circle(140% at ${cx}% ${cy}%)`
                  : `circle(0% at ${leavePos.x}% ${leavePos.y}%)`,
              }
        }
        transition={{ duration: 0.6, ease: ELEGANT }}
        style={{ willChange: "clip-path, opacity" }}
      >
        <img
          src={`https://picsum.photos/seed/${item.seed}/1200/800`}
          alt=""
          className="size-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-ink/10 to-transparent" />
      </motion.div>

      <div className="relative z-10 flex h-full flex-col justify-between p-4 md:p-7">
        <div className="flex items-start justify-end">
          <span
            className={cn(
              "font-mono text-[10px] tracking-[0.25em]",
              "max-md:text-rouge",
              "md:transition-colors md:duration-500",
              isActive ? "md:text-rouge" : "md:text-petal/40"
            )}
          >
            {item.index}
          </span>
        </div>

        <div className="flex items-end justify-between gap-3">
          <motion.div
            animate={{ scale: isActive && !reduce ? 1.04 : 1 }}
            transition={{ duration: 0.4, ease: ELEGANT }}
            className="flex flex-col gap-2"
            style={{ transformOrigin: "left bottom" }}
          >
            <span
              className={cn(
                "font-display italic tracking-tight",
                "text-2xl md:text-3xl",
                "max-md:text-bone",
                "md:transition-colors md:duration-500",
                isActive ? "md:text-bone" : "md:text-bone/70"
              )}
            >
              {item.name}
            </span>
            <AnimatePresence>
              {isActive && (
                <motion.span
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  transition={{ duration: 0.3, ease: ELEGANT }}
                  className="hidden md:inline font-mono text-[10px] uppercase tracking-[0.18em] text-petal"
                >
                  {shopLabel} {item.name} →
                </motion.span>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Mobile chevron */}
          <span
            aria-hidden
            className="md:hidden font-mono text-sm text-bone/70"
          >
            →
          </span>

          {/* Desktop pulse dot */}
          <div className="hidden md:block">
            {isActive && !reduce ? (
              <motion.span
                aria-hidden
                className="block size-1 rounded-full bg-rouge"
                animate={{ scale: [1, 1.4, 1] }}
                transition={{ duration: 2.4, ease: "easeInOut", repeat: Infinity }}
              />
            ) : (
              <span aria-hidden className="block size-1 rounded-full bg-rouge/60" />
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

const Tile = memo(TileImpl);

function CategoryOrbitImpl({
  title,
  eyebrow,
  hoverHint,
  shopLabel,
  items,
}: Props) {
  const reduce = useReducedMotion() ?? false;
  const [activeSlug, setActiveSlug] = useState<string | null>(null);

  const activeItem = items.find((i) => i.slug === activeSlug) ?? null;
  const activeIndex = activeItem ? activeItem.index : "00";

  const handleEnter = useCallback((slug: string) => setActiveSlug(slug), []);
  const handleLeave = useCallback(() => setActiveSlug(null), []);

  return (
    <section
      className="relative min-h-[100dvh] overflow-hidden py-16 text-bone md:py-32"
      style={{
        backgroundImage:
          "linear-gradient(to bottom, var(--color-charcoal) 0%, #F2C5D1 100%)",
      }}
    >
      <PetalRain />
      <div className="relative z-10 mx-auto max-w-[1600px] px-6">
        <div className="relative z-20 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-col gap-4">
            <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-petal/40">
              {eyebrow}
            </span>
            <motion.h2
              animate={{ opacity: activeSlug ? 0.15 : 1 }}
              transition={{ duration: 0.5, ease: ELEGANT }}
              className="font-display tracking-tighter leading-[0.95] text-bone"
              style={{ fontSize: "clamp(2.5rem, 5vw, 4rem)" }}
            >
              {title}
            </motion.h2>
          </div>

          <div className="hidden md:flex items-center gap-4">
            <span aria-hidden className="block h-px w-16 bg-petal/20" />
            <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-petal/30">
              {hoverHint}
            </span>
          </div>
        </div>

        <div
          className="relative mt-10 grid grid-cols-1 gap-2.5 md:mt-16 md:grid-cols-12 md:gap-3"
          style={{ gridAutoRows: "clamp(80px, 12vh, 140px)" }}
        >
          {items.map((item, i) => (
            <Tile
              key={item.slug}
              item={item}
              layout={TILE_LAYOUT[i] ?? TILE_LAYOUT[0]}
              shopLabel={shopLabel}
              isActive={activeSlug === item.slug}
              onEnter={handleEnter}
              onLeave={handleLeave}
              reduce={reduce}
            />
          ))}

          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 z-30 hidden -translate-x-1/2 -translate-y-1/2 md:block"
          >
            <span className="inline-block rounded-full border border-bone/30 bg-charcoal/70 px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.3em] text-bone/80 backdrop-blur">
              LAT 40.7000° N · LON 73.6700° W
            </span>
          </div>
        </div>
      </div>

      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 z-10 hidden md:flex flex-col items-center overflow-hidden"
      >
        <AnimatePresence mode="wait">
          {activeItem && (
            <motion.div
              key={activeItem.slug}
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              transition={{ duration: 0.5, ease: ELEGANT }}
              className="flex w-full flex-col items-center"
            >
              <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-ink/50">
                [ {activeIndex} / 06 ]
              </span>
              <span
                className="font-display italic tracking-tighter leading-[0.85] text-ink/15"
                style={{ fontSize: "clamp(8rem, 18vw, 22rem)" }}
              >
                {activeItem.name}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}

export const CategoryOrbit = memo(CategoryOrbitImpl);
```

Notes on the diff:
- Tile root: `aspect-[16/10] md:aspect-auto` → `h-32 md:h-auto md:aspect-auto`. Border colour split into `max-md:border-petal/40` (always lit on mobile) and `md:border-petal/{40|15}` (hover-driven on desktop).
- New mobile-only image block (`md:hidden`) renders the static `<img>` with a horizontal gradient `from-ink/65 via-ink/20 to-transparent`. The desktop `motion.div` gains `hidden md:block` and its inner `<img>` gets `alt=""` to avoid double announcement (mobile copy carries the accessible name).
- Padding `p-5 md:p-7` → `p-4 md:p-7` for tighter mobile spacing.
- Index span: `max-md:text-rouge` always, desktop transitions preserved.
- Name span: `max-md:text-bone` always, desktop transitions preserved.
- New `<span aria-hidden className="md:hidden font-mono text-sm text-bone/70">→</span>` on the right.
- Pulse dot block wrapped in `hidden md:block`.
- Section padding `py-24 md:py-32` → `py-16 md:py-32`.
- Header hover-hint group: `flex items-center gap-4` → `hidden md:flex items-center gap-4`.
- Grid header offset `mt-12 md:mt-16` → `mt-10 md:mt-16`. Grid gap `gap-3 md:gap-3` → `gap-2.5 md:gap-3`.
- Active-name giant text container: `flex flex-col items-center overflow-hidden` → `hidden md:flex flex-col items-center overflow-hidden`.

- [ ] **Step 2.2: Run the e2e test that was failing**

```bash
npm run e2e -- tests/e2e/home.spec.ts -g "CategoryOrbit renders correctly on mobile"
```

Expected: PASS.

- [ ] **Step 2.3: Run the rest of the home e2e tests to confirm desktop is intact**

```bash
npm run e2e -- tests/e2e/home.spec.ts
```

Expected: All four tests PASS (English, Spanish, no console errors, mobile).

- [ ] **Step 2.4: Run typecheck and full unit suite**

```bash
npm run test
```

Expected: All vitest unit tests PASS, no TS errors surfaced via test runner.

If a separate typecheck command is configured (e.g. `tsc --noEmit`), run it as well — otherwise rely on `next build` in the next step.

- [ ] **Step 2.5: Run the production build**

```bash
npm run build
```

Expected: Build completes without errors. No new warnings related to `CategoryOrbit`.

- [ ] **Step 2.6: Manual visual verification**

Start the dev server in one terminal:

```bash
npm run dev
```

Open Chrome DevTools, toggle device toolbar, select "iPhone 12 Pro" or set viewport to 375×812. Navigate to `http://localhost:3000/en` and scroll to the "Find your bloom." section. Verify:

1. Six tiles each show a different background image with a left-anchored dark gradient.
2. Each tile shows: rouge index top-right (`01`–`06`), bone-coloured italic name centred-left, bone/70 chevron right.
3. No "[hover to enter]" text anywhere in the section.
4. No "LAT 40.7000° N · LON 73.6700° W" chip.
5. Tap any tile → navigates to `/en/shop/<slug>`.
6. Resize the window above 768px — desktop bento appears with hover reveals, pulse dot, LAT/LON chip, and "[hover to enter]" hint, exactly as before.
7. Browser DevTools console shows no errors or hydration warnings on either viewport.

If any check fails, return to step 2.1 and adjust before proceeding.

- [ ] **Step 2.7: Commit**

```bash
git add components/home/CategoryOrbit.tsx
git commit -m "fix(home): render CategoryOrbit correctly on mobile"
```

---

## Self-Review

- **Spec coverage:**
  1. Six tiles with images on iPhone viewport → covered by Task 1 test (image visibility per slug) and Step 2.6 manual check.
  2. "[hover to enter]" hidden on mobile → Task 1 assertion + Step 2.1 `hidden md:flex` on hover-hint group.
  3. LAT/LON chip hidden on mobile → already `hidden md:block`; Task 1 asserts not visible.
  4. No tile reads as dimmed → Step 2.1 `max-md:text-rouge`, `max-md:text-bone`, `max-md:border-petal/40` and always-on mobile image.
  5. Tap navigates → preserved by existing `<Link href={item.href}>`; Task 1 asserts the link is present at the correct href.
  6. Desktop unchanged → desktop branches retain the original `motion.div`, transition classes, pulse dot, hover hint, LAT/LON chip, and active-name text. Step 2.3 e2e assertions confirm desktop content is still rendered.
  7. No console errors → `home has no console errors` test in `tests/e2e/home.spec.ts` already covers desktop; Step 2.6 covers mobile manually.
- **Placeholder scan:** No TBD/TODO/"add appropriate"/"similar to" found in the plan.
- **Type consistency:** No new types or signatures introduced; the `Tile`/`Item`/`Props` shapes are unchanged.

No gaps, no fixes needed.
