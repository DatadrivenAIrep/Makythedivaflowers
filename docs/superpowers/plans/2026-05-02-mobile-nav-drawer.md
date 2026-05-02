# Mobile Navigation Drawer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a right-side slide-in drawer with hamburger button so mobile users can navigate between all pages.

**Architecture:** A thin `MobileNavProvider` Client Component holds `isOpen` state and renders both the hamburger button (passed to `TopNav` via a new `mobileMenuSlot` prop) and the `MobileDrawer` as siblings, keeping `TopNav` free of client state. Category slugs/labels are extracted into a shared `lib/shop-categories.ts` so both `MegaMenu` and the drawer reference the same data.

**Tech Stack:** Next.js App Router, React, Framer Motion, next-intl, Tailwind CSS, Vitest + Testing Library (unit), Playwright (e2e)

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `lib/shop-categories.ts` | `CATS` and `LABELS` constants — single source of truth |
| Modify | `components/nav/MegaMenu.tsx` | Import from `lib/shop-categories.ts` instead of local constants |
| Create | `components/nav/MobileMenuButton.tsx` | Two-line hamburger icon button, `md:hidden` |
| Create | `components/nav/MobileDrawer.tsx` | Slide-in panel with nav links, chips, locale switcher, cart button |
| Create | `components/nav/MobileNavProvider.tsx` | Holds `isOpen` state; composes button + drawer |
| Modify | `components/nav/TopNav.tsx` | Add optional `mobileMenuSlot?: React.ReactNode` prop |
| Modify | `app/[locale]/layout.tsx` | Pass `mobileMenuSlot` from `MobileNavProvider` to `TopNav` |
| Create | `tests/unit/nav/MobileMenuButton.test.tsx` | Unit tests for button |
| Create | `tests/unit/nav/MobileDrawer.test.tsx` | Unit tests for drawer |
| Create | `tests/e2e/mobile-nav.spec.ts` | E2e tests for full flow |

---

## Task 1: Extract shop categories to shared lib

**Files:**
- Create: `lib/shop-categories.ts`
- Modify: `components/nav/MegaMenu.tsx`

- [ ] **Step 1: Create `lib/shop-categories.ts`**

```ts
export const CATS = [
  { slug: "arrangements", seed: "cat-arrangements" },
  { slug: "bouquets", seed: "cat-bouquets" },
  { slug: "plants", seed: "cat-plants" },
  { slug: "gifts", seed: "cat-gifts" },
  { slug: "sympathy", seed: "cat-sympathy" },
  { slug: "subscriptions", seed: "cat-subscriptions" },
] as const;

export type CatSlug = (typeof CATS)[number]["slug"];

export const LABELS: Record<CatSlug, { en: string; es: string }> = {
  arrangements: { en: "Arrangements", es: "Arreglos" },
  bouquets: { en: "Bouquets", es: "Ramos" },
  plants: { en: "Plants & Orchids", es: "Plantas y Orquídeas" },
  gifts: { en: "Gifts", es: "Regalos" },
  sympathy: { en: "Sympathy", es: "Condolencias" },
  subscriptions: { en: "Subscriptions", es: "Suscripciones" },
};
```

- [ ] **Step 2: Update `MegaMenu.tsx` to import from shared lib**

Remove the `CATS` and `LABELS` local constants and add the import at the top:

```tsx
import { CATS, LABELS } from "@/lib/shop-categories";
```

The rest of `MegaMenu.tsx` stays identical — `CATS` and `LABELS` are used the same way.

- [ ] **Step 3: Verify the app still compiles**

```bash
cd "/Users/santiagocardonacastellanos/Desktop/Diva Flowers" && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add lib/shop-categories.ts components/nav/MegaMenu.tsx
git commit -m "refactor(nav): extract shop categories to shared lib"
```

---

## Task 2: Add `mobileMenuSlot` prop to `TopNav`

**Files:**
- Modify: `components/nav/TopNav.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/nav/MobileMenuButton.test.tsx` with just a placeholder so we have a test file to run:

```bash
mkdir -p "/Users/santiagocardonacastellanos/Desktop/Diva Flowers/tests/unit/nav"
```

```tsx
// tests/unit/nav/MobileMenuButton.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// stub next-intl
vi.mock("next-intl", () => ({ useTranslations: () => (k: string) => k }));

// placeholder — real import added in Task 3
describe("MobileMenuButton placeholder", () => {
  it("true is true", () => {
    expect(true).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to confirm setup works**

```bash
cd "/Users/santiagocardonacastellanos/Desktop/Diva Flowers" && npx vitest run tests/unit/nav/MobileMenuButton.test.tsx
```

Expected: PASS (1 test).

- [ ] **Step 3: Update `TopNav.tsx` to accept `mobileMenuSlot`**

```tsx
export function TopNav({
  locale,
  navLinksSlot,
  mobileMenuSlot,
}: {
  locale: Locale;
  navLinksSlot: React.ReactNode;
  mobileMenuSlot?: React.ReactNode;
}) {
```

And inside the JSX, inside the right-side `<div className="flex items-center gap-2">`, add it before `LocaleSwitcher`:

```tsx
<div className="flex items-center gap-2">
  {mobileMenuSlot}
  <LocaleSwitcher current={locale} />
  <CartButton locale={locale} />
</div>
```

- [ ] **Step 4: Verify TypeScript**

```bash
cd "/Users/santiagocardonacastellanos/Desktop/Diva Flowers" && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add components/nav/TopNav.tsx tests/unit/nav/MobileMenuButton.test.tsx
git commit -m "feat(nav): add mobileMenuSlot prop to TopNav"
```

---

## Task 3: Create `MobileMenuButton`

**Files:**
- Create: `components/nav/MobileMenuButton.tsx`
- Modify: `tests/unit/nav/MobileMenuButton.test.tsx`

- [ ] **Step 1: Write the failing tests**

Replace the placeholder in `tests/unit/nav/MobileMenuButton.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MobileMenuButton } from "@/components/nav/MobileMenuButton";

vi.mock("next-intl", () => ({ useTranslations: () => (k: string) => k }));

describe("MobileMenuButton", () => {
  it("renders a button with accessible label", () => {
    render(<MobileMenuButton onClick={vi.fn()} />);
    expect(screen.getByRole("button", { name: "open_menu" })).toBeInTheDocument();
  });

  it("calls onClick when clicked", async () => {
    const user = userEvent.setup();
    const handler = vi.fn();
    render(<MobileMenuButton onClick={handler} />);
    await user.click(screen.getByRole("button", { name: "open_menu" }));
    expect(handler).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd "/Users/santiagocardonacastellanos/Desktop/Diva Flowers" && npx vitest run tests/unit/nav/MobileMenuButton.test.tsx
```

Expected: FAIL — `MobileMenuButton` not found.

- [ ] **Step 3: Create `components/nav/MobileMenuButton.tsx`**

```tsx
"use client";
import { useTranslations } from "next-intl";

export function MobileMenuButton({ onClick }: { onClick: () => void }) {
  const t = useTranslations("nav");
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t("open_menu")}
      className="md:hidden flex flex-col justify-center gap-[7px] p-2 text-ink/80 hover:text-ink transition-colors"
    >
      <span className="block h-[1.5px] w-5 bg-current rounded-full" />
      <span className="block h-[1.5px] w-3.5 bg-current rounded-full" />
    </button>
  );
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd "/Users/santiagocardonacastellanos/Desktop/Diva Flowers" && npx vitest run tests/unit/nav/MobileMenuButton.test.tsx
```

Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add components/nav/MobileMenuButton.tsx tests/unit/nav/MobileMenuButton.test.tsx
git commit -m "feat(nav): add MobileMenuButton component"
```

---

## Task 4: Create `MobileDrawer`

**Files:**
- Create: `components/nav/MobileDrawer.tsx`
- Create: `tests/unit/nav/MobileDrawer.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/nav/MobileDrawer.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MobileDrawer } from "@/components/nav/MobileDrawer";

vi.mock("next-intl", () => ({ useTranslations: () => (k: string) => k }));
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...p }: React.HTMLAttributes<HTMLDivElement>) => <div {...p}>{children}</div>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useReducedMotion: () => false,
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...p }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...p}>{children}</a>
  ),
}));

describe("MobileDrawer", () => {
  it("is not rendered when isOpen is false", () => {
    render(<MobileDrawer isOpen={false} onClose={vi.fn()} locale="en" />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders dialog with nav links when isOpen is true", () => {
    render(<MobileDrawer isOpen={true} onClose={vi.fn()} locale="en" />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /shop/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /weddings/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /events/i })).toBeInTheDocument();
  });

  it("renders category chips when open", () => {
    render(<MobileDrawer isOpen={true} onClose={vi.fn()} locale="en" />);
    expect(screen.getByRole("link", { name: /arrangements/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /bouquets/i })).toBeInTheDocument();
  });

  it("calls onClose when close button is clicked", async () => {
    const user = userEvent.setup();
    const handler = vi.fn();
    render(<MobileDrawer isOpen={true} onClose={handler} locale="en" />);
    await user.click(screen.getByRole("button", { name: "close_menu" }));
    expect(handler).toHaveBeenCalledOnce();
  });

  it("calls onClose when overlay is clicked", async () => {
    const user = userEvent.setup();
    const handler = vi.fn();
    render(<MobileDrawer isOpen={true} onClose={handler} locale="en" />);
    await user.click(screen.getByTestId("drawer-overlay"));
    expect(handler).toHaveBeenCalledOnce();
  });

  it("calls onClose when a nav link is clicked", async () => {
    const user = userEvent.setup();
    const handler = vi.fn();
    render(<MobileDrawer isOpen={true} onClose={handler} locale="en" />);
    await user.click(screen.getByRole("link", { name: /weddings/i }));
    expect(handler).toHaveBeenCalledOnce();
  });

  it("renders es labels for locale=es", () => {
    render(<MobileDrawer isOpen={true} onClose={vi.fn()} locale="es" />);
    expect(screen.getByRole("link", { name: /arreglos/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /ramos/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd "/Users/santiagocardonacastellanos/Desktop/Diva Flowers" && npx vitest run tests/unit/nav/MobileDrawer.test.tsx
```

Expected: FAIL — `MobileDrawer` not found.

- [ ] **Step 3: Create `components/nav/MobileDrawer.tsx`**

```tsx
"use client";
import { useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslations } from "next-intl";
import { LocaleSwitcher } from "@/components/nav/LocaleSwitcher";
import { CartButton } from "@/components/nav/CartButton";
import { CATS, LABELS } from "@/lib/shop-categories";
import type { Locale } from "@/types/locale";

const NAV_LINKS = (locale: Locale) => [
  { href: `/${locale}/weddings`, key: "weddings" },
  { href: `/${locale}/events`, key: "events" },
  { href: `/${locale}/story`, key: "story" },
  { href: `/${locale}/journal`, key: "journal" },
  { href: `/${locale}/contact`, key: "contact" },
];

export function MobileDrawer({
  isOpen,
  onClose,
  locale,
}: {
  isOpen: boolean;
  onClose: () => void;
  locale: Locale;
}) {
  const t = useTranslations("nav");

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div
            data-testid="drawer-overlay"
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-ink/30 backdrop-blur-sm z-40"
          />

          {/* Panel */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={t("open_menu")}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="fixed inset-y-0 right-0 w-[280px] bg-bone z-50 flex flex-col shadow-2xl"
          >
            {/* Close button */}
            <div className="flex justify-end p-4">
              <button
                type="button"
                onClick={onClose}
                aria-label={t("close_menu")}
                className="p-2 text-ink/60 hover:text-ink transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {/* Nav content */}
            <nav className="flex-1 overflow-y-auto px-6 pb-6">
              {/* Shop + category chips */}
              <div className="border-b border-ink/[0.08] pb-4 mb-1">
                <Link
                  href={`/${locale}/shop`}
                  onClick={onClose}
                  className="font-display text-xl text-ink block py-3"
                >
                  {t("shop")} →
                </Link>
                <div className="flex flex-wrap gap-2 pb-2">
                  {CATS.map((c) => (
                    <Link
                      key={c.slug}
                      href={`/${locale}/shop/${c.slug}`}
                      onClick={onClose}
                      className="font-mono text-[11px] uppercase tracking-[0.12em] bg-ink/[0.05] rounded px-2 py-1 text-ink/70 hover:text-ink transition-colors"
                    >
                      {LABELS[c.slug][locale]}
                    </Link>
                  ))}
                </div>
              </div>

              {/* Main links */}
              {NAV_LINKS(locale).map((l) => (
                <Link
                  key={l.key}
                  href={l.href}
                  onClick={onClose}
                  className="font-display text-xl text-ink block py-3 border-b border-ink/[0.08]"
                >
                  {t(l.key as Parameters<typeof t>[0])}
                </Link>
              ))}
            </nav>

            {/* Bottom bar */}
            <div className="flex items-center gap-3 px-6 py-4 border-t border-ink/[0.08]">
              <LocaleSwitcher current={locale} />
              <CartButton locale={locale} />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd "/Users/santiagocardonacastellanos/Desktop/Diva Flowers" && npx vitest run tests/unit/nav/MobileDrawer.test.tsx
```

Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add components/nav/MobileDrawer.tsx tests/unit/nav/MobileDrawer.test.tsx
git commit -m "feat(nav): add MobileDrawer component"
```

---

## Task 5: Create `MobileNavProvider` and wire into layout

**Files:**
- Create: `components/nav/MobileNavProvider.tsx`
- Modify: `app/[locale]/layout.tsx`

- [ ] **Step 1: Create `components/nav/MobileNavProvider.tsx`**

```tsx
"use client";
import { useState } from "react";
import { MobileMenuButton } from "@/components/nav/MobileMenuButton";
import { MobileDrawer } from "@/components/nav/MobileDrawer";
import type { Locale } from "@/types/locale";

export function MobileNavProvider({ locale }: { locale: Locale }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <MobileMenuButton onClick={() => setIsOpen(true)} />
      <MobileDrawer isOpen={isOpen} onClose={() => setIsOpen(false)} locale={locale} />
    </>
  );
}
```

- [ ] **Step 2: Update `app/[locale]/layout.tsx`**

Add the import at the top:

```tsx
import { MobileNavProvider } from "@/components/nav/MobileNavProvider";
```

Update the `TopNav` usage to pass `mobileMenuSlot`:

```tsx
<TopNav
  locale={locale as Locale}
  navLinksSlot={<NavLinks locale={locale as Locale} />}
  mobileMenuSlot={<MobileNavProvider locale={locale as Locale} />}
/>
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd "/Users/santiagocardonacastellanos/Desktop/Diva Flowers" && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/nav/MobileNavProvider.tsx app/[locale]/layout.tsx
git commit -m "feat(nav): wire MobileNavProvider into layout"
```

---

## Task 6: E2e tests for mobile navigation

**Files:**
- Create: `tests/e2e/mobile-nav.spec.ts`

- [ ] **Step 1: Write the e2e tests**

Create `tests/e2e/mobile-nav.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

test.use({ viewport: { width: 390, height: 844 } });

test.describe("mobile navigation drawer", () => {
  test("hamburger button is visible on mobile", async ({ page }) => {
    await page.goto("/en");
    const btn = page.getByRole("button", { name: /open menu/i });
    await expect(btn).toBeVisible();
  });

  test("nav links are hidden on mobile (desktop-only ul)", async ({ page }) => {
    await page.goto("/en");
    // The desktop NavLinks ul is hidden — it shouldn't be visible
    const shopLink = page.locator("ul.hidden.md\\:flex");
    await expect(shopLink).toBeHidden();
  });

  test("clicking hamburger opens the drawer", async ({ page }) => {
    await page.goto("/en");
    await page.getByRole("button", { name: /open menu/i }).click();
    const drawer = page.getByRole("dialog");
    await expect(drawer).toBeVisible();
  });

  test("drawer contains main nav links", async ({ page }) => {
    await page.goto("/en");
    await page.getByRole("button", { name: /open menu/i }).click();
    const drawer = page.getByRole("dialog");
    await expect(drawer.getByRole("link", { name: /weddings/i })).toBeVisible();
    await expect(drawer.getByRole("link", { name: /events/i })).toBeVisible();
    await expect(drawer.getByRole("link", { name: /our story/i })).toBeVisible();
  });

  test("drawer contains Shop and category chips", async ({ page }) => {
    await page.goto("/en");
    await page.getByRole("button", { name: /open menu/i }).click();
    const drawer = page.getByRole("dialog");
    await expect(drawer.getByRole("link", { name: /^shop/i })).toBeVisible();
    await expect(drawer.getByRole("link", { name: /arrangements/i })).toBeVisible();
    await expect(drawer.getByRole("link", { name: /bouquets/i })).toBeVisible();
  });

  test("close button closes the drawer", async ({ page }) => {
    await page.goto("/en");
    await page.getByRole("button", { name: /open menu/i }).click();
    const drawer = page.getByRole("dialog");
    await expect(drawer).toBeVisible();
    await page.getByRole("button", { name: /close menu/i }).click();
    await expect(drawer).not.toBeVisible();
  });

  test("Escape key closes the drawer", async ({ page }) => {
    await page.goto("/en");
    await page.getByRole("button", { name: /open menu/i }).click();
    const drawer = page.getByRole("dialog");
    await expect(drawer).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(drawer).not.toBeVisible();
  });

  test("clicking overlay closes the drawer", async ({ page }) => {
    await page.goto("/en");
    await page.getByRole("button", { name: /open menu/i }).click();
    const drawer = page.getByRole("dialog");
    await expect(drawer).toBeVisible();
    // Click left of the panel (overlay area)
    await page.mouse.click(50, 400);
    await expect(drawer).not.toBeVisible();
  });

  test("clicking a link navigates and closes drawer", async ({ page }) => {
    await page.goto("/en");
    await page.getByRole("button", { name: /open menu/i }).click();
    await page.getByRole("dialog").getByRole("link", { name: /weddings/i }).click();
    await expect(page).toHaveURL(/\/en\/weddings/);
    await expect(page.getByRole("dialog")).not.toBeVisible();
  });

  test("drawer shows Spanish labels when locale is es", async ({ page }) => {
    await page.goto("/es");
    await page.getByRole("button", { name: /open menu/i }).click();
    const drawer = page.getByRole("dialog");
    await expect(drawer.getByRole("link", { name: /arreglos/i })).toBeVisible();
    await expect(drawer.getByRole("link", { name: /ramos/i })).toBeVisible();
  });

  test("hamburger button is NOT visible on desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/en");
    const btn = page.getByRole("button", { name: /open menu/i });
    await expect(btn).toBeHidden();
  });
});
```

- [ ] **Step 2: Run the dev server and verify e2e tests pass**

In one terminal:
```bash
cd "/Users/santiagocardonacastellanos/Desktop/Diva Flowers" && npm run dev
```

In another:
```bash
cd "/Users/santiagocardonacastellanos/Desktop/Diva Flowers" && npx playwright test tests/e2e/mobile-nav.spec.ts
```

Expected: all 10 tests PASS.

- [ ] **Step 3: Run the full unit test suite to confirm no regressions**

```bash
cd "/Users/santiagocardonacastellanos/Desktop/Diva Flowers" && npx vitest run
```

Expected: all tests PASS.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/mobile-nav.spec.ts
git commit -m "test(nav): add e2e tests for mobile navigation drawer"
```
