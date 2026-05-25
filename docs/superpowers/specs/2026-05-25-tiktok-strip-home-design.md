# TikTok Strip on Home — Design Spec

**Date:** 2026-05-25
**Locale scope:** `en` + `es` (bilingual)
**Approach:** Curated 4-video strip between GoogleReviews and EditorialSplit. Thumbnails on the page; iframe lazy-loaded into a Radix Dialog lightbox on click.

---

## 1. Context & Goals

### Why
- Diva Flowers' TikTok presence (`@makythediva`) is one of the most authentic social-proof channels — behind-the-studio process videos, arrangements coming together, the human personality of the brand.
- The home page currently runs Google Reviews → EditorialSplit. Inserting a TikTok strip between them extends the social-proof sequence from "people writing words about us" into "a face and motion you can recognize."
- The codebase has a stale TikTok handle in `data/site.ts:36` (`@divaflowers`) that needs to be corrected to `@makythediva` at the same time — used by footer/megamenu/anywhere `SITE.social` is consumed.

### Goals
1. Insert a new home section featuring 4 curated TikTok videos between `GoogleReviews` and `EditorialSplit`.
2. Keep the home page fast: render thumbnails inline; lazy-load the heavy TikTok iframe only when a user clicks (Radix Dialog lightbox).
3. Keep visitors on `makythedivaflowers.com` — playing a video opens a modal in-place, with a discrete "Watch on TikTok" link inside the modal for users who prefer the native app.
4. Correct the stale `data/site.ts` social handle.

### Non-goals
- No automated feed pulling from TikTok (no API/scraping). Curation is manual via `data/tiktoks.ts`.
- No view-count auto-refresh. The optional `views` field is a free-form display string the owner edits.
- No analytics events specific to TikTok clicks in v1 (the existing site analytics already captures outbound social-link clicks generically).
- No autoplay scroll-driven preview. The strip stays calm.

---

## 2. Architecture Overview

```
app/[locale]/page.tsx
  └─ <TikTokStrip />  ← NEW, inserted between <GoogleReviews /> and <EditorialSplit />

components/home/TikTokStrip.tsx       ← NEW, async server component (reads data + i18n)
components/home/TikTokCard.tsx        ← NEW, client component (one card, controls its own lightbox open state)
components/home/TikTokLightbox.tsx    ← NEW, client component (Radix Dialog + lazy iframe)

data/tiktoks.ts                       ← NEW, hand-curated list of 4 videos
data/site.ts                          ← MODIFY, fix `social[1].href` to use @makythediva

messages/en.json                      ← MODIFY, add home.tiktok namespace
messages/es.json                      ← MODIFY, add home.tiktok namespace

public/tiktoks/                       ← NEW directory, owner uploads 4 .webp thumbnails
```

### Data flow
- `data/tiktoks.ts` exports `TIKTOKS: readonly TikTokVideo[]` — single source of truth.
- `TikTokStrip` reads `TIKTOKS` at render. If `TIKTOKS.length === 0`, returns `null` (graceful no-op so we can merge the feature before content is finalized).
- Each `TikTokCard` is its own client island with `useState<boolean>` for the modal. Click → setOpen(true) → `<TikTokLightbox>` mounts and renders the iframe. No global state needed because only one lightbox is open at a time (per-card state is sufficient and aligned with single-active-modal browser behavior — Radix manages focus trap).
- `TikTokLightbox` only renders the `<iframe>` when `open === true`. This is the central performance optimization: the home page sends 0 iframes on initial load.

---

## 3. Home page insertion (`app/[locale]/page.tsx`)

**Diff:**
- Add `import { TikTokStrip } from "@/components/home/TikTokStrip";`
- Insert `<TikTokStrip locale={locale} />` between `<GoogleReviews locale={locale} />` and `<EditorialSplit locale={locale} />`.

No other changes.

### `data/site.ts` correction

In `data/site.ts:36`, change:
```ts
{ label: "TikTok", href: "https://tiktok.com/@divaflowers" },
```
to:
```ts
{ label: "TikTok", href: "https://www.tiktok.com/@makythediva" },
```

Use the canonical `www.tiktok.com` host (matches what shows up in the address bar from the TikTok app/web shares).

---

## 4. `TikTokStrip.tsx` (new component)

**File:** `components/home/TikTokStrip.tsx`
**Type:** async server component (reads translations via `getTranslations`, reads `TIKTOKS`).

**Render behavior:**

```tsx
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import type { Locale } from "@/types/locale";
import { TIKTOKS } from "@/data/tiktoks";
import { TikTokCard } from "./TikTokCard";

const TIKTOK_PROFILE_URL = "https://www.tiktok.com/@makythediva";

export async function TikTokStrip({ locale }: { locale: Locale }) {
  if (TIKTOKS.length === 0) return null;
  const t = await getTranslations("home.tiktok");

  return (
    <section className="bg-petal text-ink">
      <div className="mx-auto max-w-[var(--container-max)] px-6 py-20 md:py-28">
        <div className="flex items-end justify-between gap-6 mb-10">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink/60">
              {t("eyebrow")}
            </p>
            <h2 className="mt-3 font-display italic text-4xl md:text-5xl tracking-tighter leading-[0.95]">
              {t("title")}
            </h2>
          </div>
          <Link
            href={TIKTOK_PROFILE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-sans text-sm tracking-tight text-ink underline underline-offset-4 hover:no-underline whitespace-nowrap"
          >
            @makythediva →
          </Link>
        </div>

        <ul
          className="
            flex md:grid md:grid-cols-4 gap-3
            -mx-6 px-6 md:mx-0 md:px-0
            overflow-x-auto md:overflow-visible
            snap-x snap-mandatory md:snap-none
            scroll-pl-6
          "
        >
          {TIKTOKS.map((video) => (
            <li
              key={video.slug}
              className="shrink-0 w-[78vw] sm:w-[60vw] md:w-auto snap-start"
            >
              <TikTokCard video={video} locale={locale} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
```

**Design notes:**
- The mobile horizontal scroll uses negative-margin tricks so the cards bleed to the viewport edges while keeping the section header padded.
- `snap-mandatory` + `snap-start` gives swipe-snap behavior on touch devices.
- On md+ it switches to a regular 4-col grid — no scroll, no snap.

---

## 5. `TikTokCard.tsx` (new client component)

**File:** `components/home/TikTokCard.tsx`
**Type:** `"use client"`.

```tsx
"use client";
import { useState } from "react";
import type { Locale } from "@/types/locale";
import type { TikTokVideo } from "@/data/tiktoks";
import { TikTokLightbox } from "./TikTokLightbox";

export function TikTokCard({
  video,
  locale,
}: {
  video: TikTokVideo;
  locale: Locale;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={video.thumbnail.alt[locale]}
        className="
          group relative block w-full aspect-[9/16]
          rounded-xl overflow-hidden bg-ink/5
          focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/40
        "
      >
        <img
          src={video.thumbnail.src}
          alt={video.thumbnail.alt[locale]}
          className="absolute inset-0 size-full object-cover transition-opacity group-hover:opacity-90"
          loading="lazy"
        />

        {/* Play icon */}
        <span
          aria-hidden
          className="
            absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
            size-12 rounded-full bg-bone/95 text-ink
            flex items-center justify-center
            shadow-[0_4px_16px_rgba(0,0,0,0.25)]
            transition group-hover:scale-105
          "
        >
          <span
            className="
              block w-0 h-0
              border-y-[8px] border-y-transparent
              border-l-[12px] border-l-ink
              ml-[3px]
            "
          />
        </span>

        {/* Views badge (optional) */}
        {video.views ? (
          <span
            className="
              absolute top-3 left-3 px-2 py-1 rounded-full
              bg-ink/55 text-bone backdrop-blur-sm
              font-mono text-[10px] tracking-[0.05em]
            "
          >
            {video.views}
          </span>
        ) : null}
      </button>

      <TikTokLightbox
        videoId={video.videoId}
        url={video.url}
        open={open}
        onOpenChange={setOpen}
        locale={locale}
      />
    </>
  );
}
```

**Why per-card lightbox state:** Each card owns its modal. No prop drilling, no global store, no portal coordination. The Radix Dialog itself handles focus trap, escape, scroll lock; only one is "active" at a time because clicks only fire on the card a user actually presses.

---

## 6. `TikTokLightbox.tsx` (new client component)

**File:** `components/home/TikTokLightbox.tsx`
**Type:** `"use client"`. Uses `@radix-ui/react-dialog` (same dependency as `TextMakyModal`).

```tsx
"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "@phosphor-icons/react/dist/ssr";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslations } from "next-intl";
import type { Locale } from "@/types/locale";

export function TikTokLightbox({
  videoId,
  url,
  open,
  onOpenChange,
  locale: _locale,
}: {
  videoId: string;
  url: string;
  open: boolean;
  onOpenChange: (next: boolean) => void;
  locale: Locale;
}) {
  const t = useTranslations("home.tiktok.lightbox");

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal forceMount>
        <AnimatePresence>
          {open ? (
            <>
              <Dialog.Overlay asChild>
                <motion.div
                  className="fixed inset-0 z-50 bg-ink/70 backdrop-blur-md"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                />
              </Dialog.Overlay>
              <Dialog.Content asChild aria-label="TikTok video">
                <motion.div
                  className="
                    fixed inset-0 z-50 flex flex-col items-center justify-center
                    p-4 md:p-8
                  "
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ type: "spring", stiffness: 220, damping: 28 }}
                >
                  <Dialog.Close
                    aria-label={t("close")}
                    className="
                      absolute top-4 right-4 size-10 rounded-full
                      bg-bone/15 text-bone hover:bg-bone/25
                      flex items-center justify-center
                      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bone/50
                    "
                  >
                    <X size={20} weight="bold" />
                  </Dialog.Close>

                  <div className="w-full max-w-[min(420px,90vw)] aspect-[9/16] rounded-xl overflow-hidden bg-ink">
                    <iframe
                      src={`https://www.tiktok.com/embed/v2/${videoId}`}
                      allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                      allowFullScreen
                      className="size-full"
                      title="TikTok video"
                    />
                  </div>

                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 font-sans text-sm text-bone underline underline-offset-4 hover:no-underline"
                  >
                    {t("view_on_tiktok")} →
                  </a>
                </motion.div>
              </Dialog.Content>
            </>
          ) : null}
        </AnimatePresence>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

**Performance characteristics:**
- The `<iframe>` element only renders when `open` is true. Radix `Dialog.Content` is conditionally mounted via `AnimatePresence`, so closing the modal unmounts the iframe and releases its memory.
- On the home page initial load: 0 iframes. Heavy assets (TikTok player script, video metadata fetches) happen only on intentional click.

**Accessibility:**
- `aria-label="TikTok video"` on the dialog content (videos have no inherent text label).
- Focus trap inside dialog automatically managed by Radix.
- Esc key closes by default.
- Visible close button with `aria-label`.
- Outbound link to native TikTok has clear text ("Watch on TikTok →").

---

## 7. Data file (`data/tiktoks.ts`)

```ts
import type { Localized } from "@/types/product";

export type TikTokVideo = {
  /** Stable identifier; also used as the thumbnail filename. */
  slug: string;
  /** Numeric TikTok video ID — the last path segment of the TikTok URL. */
  videoId: string;
  /** Canonical TikTok URL (used as the outbound "Watch on TikTok" link). */
  url: string;
  thumbnail: {
    /** Path under /public, served at site root. */
    src: string;
    alt: Localized;
  };
  /** Optional display string for the views badge (e.g., "128K"). Free-form, owner-edited. */
  views?: string;
};

export const TIKTOKS: readonly TikTokVideo[] = [
  // Owner fills these in with real entries. Example shape:
  // {
  //   slug: "hand-tied-romance",
  //   videoId: "7300000000000000000",
  //   url: "https://www.tiktok.com/@makythediva/video/7300000000000000000",
  //   thumbnail: {
  //     src: "/tiktoks/hand-tied-romance.webp",
  //     alt: { en: "Hand-tied romantic bouquet", es: "Ramo romántico hecho a mano" },
  //   },
  //   views: "128K",
  // },
];
```

**Operational flow when the owner adds a new video:**
1. Save a thumbnail screenshot to `/public/tiktoks/<slug>.webp` (suggested: 9:16 ratio, 720×1280 or similar, optimized).
2. Open `data/tiktoks.ts`, append a new entry to `TIKTOKS` with the `videoId` (the trailing number in the TikTok URL), `url`, `slug`, and bilingual `alt`. `views` is optional.
3. To remove an older video, delete its entry. Order in the array = display order on the page.

**Until `TIKTOKS` has entries:** `TikTokStrip` early-returns `null`. The section is invisible; the feature can ship to production immediately and "turn on" the moment the array gets entries.

---

## 8. i18n strings

### `messages/en.json` — additions inside the existing `home` block:

```jsonc
"tiktok": {
  "eyebrow": "Behind the studio · TikTok",
  "title": "Watch the bouquets come together",
  "follow_cta": "Follow @makythediva",
  "lightbox": {
    "view_on_tiktok": "Watch on TikTok",
    "close": "Close"
  }
}
```

### `messages/es.json` — same shape:

```jsonc
"tiktok": {
  "eyebrow": "Detrás del estudio · TikTok",
  "title": "Mira cómo nacen los ramos",
  "follow_cta": "Síguenos @makythediva",
  "lightbox": {
    "view_on_tiktok": "Ver en TikTok",
    "close": "Cerrar"
  }
}
```

**Note:** The header-right CTA renders the literal handle `@makythediva →` (not translated). The `follow_cta` key is reserved for any future place that wants a full sentence ("Follow @makythediva" vs the standalone handle); v1 of this strip uses only the literal handle, but the key lives in the namespace from the start to avoid a follow-up i18n migration.

---

## 9. Routing, SEO, sitemap

No new routes, no sitemap changes. This is purely a home-page section.

The thumbnails are real static images under `/public/tiktoks/`, so the home page's existing OG/SEO posture is unaffected.

---

## 10. Testing

- **Unit (Vitest):** `tests/unit/TikTokStrip.test.tsx`
  - Renders nothing when `TIKTOKS` is empty (verify by importing a mocked empty array).
  - Renders N cards when `TIKTOKS` has N entries.
  - The "@makythediva →" header link points to the canonical profile URL with `target="_blank"`.
  - Reuses the `next-intl/server` mock pattern from `BentoPromTile.test.tsx` / `PromPieces.test.tsx`.
- **Unit:** `tests/unit/TikTokCard.test.tsx`
  - Clicking the card opens the lightbox (asserts the iframe appears in the DOM after click).
  - The views badge renders only when `video.views` is set.
- **Manual smoke (Task 14 of implementation plan):**
  - Visit `/en` and `/es`, scroll to the section, see thumbnails + header text.
  - Click a card: lightbox opens, iframe plays the TikTok video, Esc closes the modal, focus returns to the card.
  - Click "@makythediva →" header link: opens TikTok profile in new tab.

---

## 11. Out of scope (explicitly)

- No autoplay or scroll-triggered preview animations.
- No view-count auto-sync (free-form `views` string only).
- No per-video custom title shown on the card (just thumbnail + play + views badge — keeps the layout calm).
- No carousel with arrow buttons on desktop (the 4 cards always fit; no overflow on md+ viewports).
- No reordering UI / CMS. Order = order in `TIKTOKS` array.
- No analytics-specific TikTok event. The existing site analytics is sufficient for now.
- No TikTok oEmbed fetching. Thumbnails are owner-curated under `/public/tiktoks/`.

---

## 12. Reversal / sunsetting

If the strip is ever removed:
1. Remove `<TikTokStrip />` from `app/[locale]/page.tsx`.
2. Optionally delete `components/home/TikTok*.tsx` and `data/tiktoks.ts` (or leave them — they cost nothing to keep).
3. `messages/{en,es}.json` `home.tiktok` block can stay (small, harmless).

The corrected `data/site.ts` handle is not feature-specific and should remain regardless.
