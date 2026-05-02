# Mobile Navigation Drawer

**Date:** 2026-05-02
**Branch:** feat/conversion-tactics-v1
**Status:** Approved

## Problem

On mobile, `NavLinks` is hidden via `hidden md:flex` with no replacement. Users have no way to navigate to pages other than the homepage.

## Solution Overview

A right-side slide-in drawer triggered by a two-line hamburger button in the top nav. Pattern mirrors the existing `CartDrawerHost` so the UI stays consistent.

## Components

### `MobileMenuButton` — `components/nav/MobileMenuButton.tsx`

- Client Component, `md:hidden`
- Two-line icon (full-width line + 70%-width line below), 1.5px stroke, `text-ink`
- Accessible: `aria-label` from `t("nav.open_menu")` (i18n key already exists)
- Accepts `onClick: () => void` prop
- No internal state — state lives in the wrapper

### `MobileNavProvider` — `components/nav/MobileNavProvider.tsx`

- Client Component, thin wrapper
- Holds `isOpen: boolean` state
- Renders `MobileMenuButton` (passed to `TopNav` via `mobileMenuSlot`) and `MobileDrawer` as siblings
- This keeps `TopNav` and `NavLinks` free of client-side state

### `MobileDrawer` — `components/nav/MobileDrawer.tsx`

- Client Component
- Props: `isOpen: boolean`, `onClose: () => void`, `locale: Locale`
- Framer Motion: panel slides in from `x: "100%"` → `x: 0`, duration 0.25s ease-out
- Overlay: `fixed inset-0 bg-ink/30 backdrop-blur-sm z-40`, fades in/out
- Panel: `fixed inset-y-0 right-0 w-[280px] bg-bone z-50 flex flex-col`
- Closes on: overlay click, close button, Escape key, any link click
- Traps focus while open (uses native `dialog` element or manual tab trap)

#### Drawer content (top to bottom)

```
[close button — top right, ✕ icon, aria-label t("nav.close_menu")]
────────────────────────────────
Link: "Shop →"  →  /${locale}/shop
Chips row (flex-wrap, gap-2, mono text-[11px]):
  Arrangements · Bouquets · Plants & Orchids
  Gifts · Sympathy · Subscriptions
  each chip → /${locale}/shop/${slug}
────────────────────────────────
Link: Weddings   →  /${locale}/weddings
Link: Events     →  /${locale}/events
Link: Our Story  →  /${locale}/story
Link: Journal    →  /${locale}/journal
Link: Contact    →  /${locale}/contact
────────────────────────────────
[LocaleSwitcher]   [CartButton]   ← bottom of panel
```

Category slugs and labels reuse the `CATS` / `LABELS` constants already defined in `MegaMenu.tsx` — import from a shared `lib/shop-categories.ts` (extract from MegaMenu).

### Changes to existing files

| File | Change |
|---|---|
| `components/nav/TopNav.tsx` | Add optional `mobileMenuSlot?: React.ReactNode` prop; render it inside the right-side `div` before `LocaleSwitcher`, visible only on mobile |
| `app/[locale]/layout.tsx` | Replace `<TopNav navLinksSlot={…} />` with `<MobileNavProvider locale={…} />` that composes TopNav internally, or pass `mobileMenuSlot` from a wrapper |
| `components/nav/MegaMenu.tsx` | Extract `CATS` + `LABELS` into `lib/shop-categories.ts`; import from there |

## Accessibility

- Drawer rendered as `<dialog>` or with `role="dialog"` + `aria-modal="true"` + `aria-label`
- Focus moves to close button on open; returns to hamburger button on close
- `Escape` closes the drawer
- Overlay has `aria-hidden="true"`
- All i18n keys needed (`open_menu`, `close_menu`) already exist in `messages/en.json` and `messages/es.json`

## Styling notes

- Drawer background: `bg-bone` (matches top nav condensed state)
- Main links: `font-display text-xl text-ink` with `border-b border-ink/[0.08]` separators
- Category chips: `font-mono text-[11px] uppercase tracking-[0.12em] bg-ink/[0.05] rounded px-2 py-1 text-ink/70 hover:text-ink`
- Close button: `p-2 text-ink/60 hover:text-ink`, top-right corner
- No animations on chips or links — panel slide is the only motion

## Out of scope

- Search functionality
- User account / login link
- Mega-menu imagery on mobile (categories go to their slug pages directly)
