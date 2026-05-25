# TikTok Strip on Home Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new home-page section between `<GoogleReviews />` and `<EditorialSplit />` showing 4 hand-curated TikTok videos as thumbnails; clicking opens a lazy-loaded Radix Dialog lightbox with the TikTok embed iframe. Also correct the stale `@divaflowers` social handle in `data/site.ts` to `@makythediva`.

**Architecture:** `data/tiktoks.ts` is the single source of truth (typed, bilingual alt text, optional views badge). `TikTokStrip` (async server component) reads the data and renders the strip header + a `<ul>` of `TikTokCard` cells (4-col grid on desktop, horizontal snap-scroll on mobile). Each `TikTokCard` is a `"use client"` component with local `useState` controlling its own `TikTokLightbox` (Radix Dialog + lazy `<iframe>`). Until `TIKTOKS` has entries, `TikTokStrip` returns `null` — the feature can ship before content arrives.

**Tech Stack:** Next.js 16 (App Router, breaking changes from training data — see `node_modules/next/dist/docs/`), TypeScript, Tailwind, `next-intl` for i18n, `@radix-ui/react-dialog` (already wired in `TextMakyModal`), `@phosphor-icons/react` (already wired), `framer-motion` (already wired), Vitest + Testing Library for unit tests.

**Reference spec:** `docs/superpowers/specs/2026-05-25-tiktok-strip-home-design.md`

---

## File Structure

**New files:**
- `data/tiktoks.ts` — type `TikTokVideo` + `TIKTOKS: readonly TikTokVideo[]` (starts empty; owner adds entries)
- `components/home/TikTokStrip.tsx` — server component, reads `TIKTOKS` and i18n, renders header + grid of cards
- `components/home/TikTokCard.tsx` — client component, one card with thumbnail/play/views badge + local lightbox state
- `components/home/TikTokLightbox.tsx` — client component, Radix Dialog with lazy `<iframe>`, framer-motion fade/scale, X close + "Watch on TikTok →" link
- `tests/unit/TikTokStrip.test.tsx` — renders nothing when empty, renders cards when non-empty, header link points to canonical TikTok profile URL
- `tests/unit/TikTokCard.test.tsx` — click opens lightbox, views badge conditional

**Modified files:**
- `app/[locale]/page.tsx` — add import + insert `<TikTokStrip locale={locale} />` between `<GoogleReviews />` and `<EditorialSplit />`
- `data/site.ts` — fix `social[1].href` from `https://tiktok.com/@divaflowers` to `https://www.tiktok.com/@makythediva`
- `messages/en.json` — add `home.tiktok.*` namespace
- `messages/es.json` — add `home.tiktok.*` namespace

**No changes:** routing/sitemap (no new routes); existing layout; existing test infrastructure.

**Photos:** owner uploads thumbnails to `/public/tiktoks/<slug>.webp` separately. Until then, `TIKTOKS` stays empty and the section is silently hidden.

---

### Task 1: Create `data/tiktoks.ts`

**Files:**
- Create: `data/tiktoks.ts`

- [ ] **Step 1: Write the data file**

```ts
// data/tiktoks.ts
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

export const TIKTOKS: readonly TikTokVideo[] = [];
```

- [ ] **Step 2: Verify TS compiles**

Run: `npx tsc --noEmit`
Expected: PASS (no errors).

- [ ] **Step 3: Commit**

```bash
git add data/tiktoks.ts
git commit -m "feat(tiktok): add tiktoks data file (empty seed)"
```

---

### Task 2: Fix stale TikTok handle in `data/site.ts`

**Files:**
- Modify: `data/site.ts`

- [ ] **Step 1: Replace the URL**

Open `data/site.ts`. Find the `social` array (around line 34-37). The TikTok entry currently reads:

```ts
{ label: "TikTok", href: "https://tiktok.com/@divaflowers" },
```

Replace it with:

```ts
{ label: "TikTok", href: "https://www.tiktok.com/@makythediva" },
```

Note: change is `tiktok.com` → `www.tiktok.com` (canonical) AND `@divaflowers` → `@makythediva`.

- [ ] **Step 2: Confirm no other references to the old handle**

Run: `grep -rn "@divaflowers" --include="*.ts" --include="*.tsx" --include="*.json" .`
Expected: no matches (or only matches in `node_modules/`/`.claude/` worktrees which are not the source tree — confirm by inspecting any hits).

If a non-`node_modules` source file references the old handle, flag it and ask before changing — the plan author missed it.

- [ ] **Step 3: TS compile**

Run: `npx tsc --noEmit` — clean.

- [ ] **Step 4: Commit**

```bash
git add data/site.ts
git commit -m "fix(site): correct TikTok handle (@divaflowers → @makythediva)"
```

---

### Task 3: Add i18n keys to `messages/{en,es}.json`

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/es.json`

- [ ] **Step 1: Add EN keys**

Open `messages/en.json` and locate the existing `home` block. Inside it (sibling of `home.bento`, `home.hero`, etc.), add a new `tiktok` sub-block:

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

Watch JSON commas carefully — a missing comma between sibling blocks fails the parse.

- [ ] **Step 2: Add ES keys**

Open `messages/es.json` and add the same shape with Spanish copy:

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

- [ ] **Step 3: Verify both JSON files parse**

Run: `node -e "JSON.parse(require('fs').readFileSync('messages/en.json','utf8')); JSON.parse(require('fs').readFileSync('messages/es.json','utf8')); console.log('ok')"`
Expected: prints `ok`. If you get `SyntaxError`, you missed a comma — fix and re-run.

- [ ] **Step 4: TS compile**

Run: `npx tsc --noEmit` — clean.

- [ ] **Step 5: Commit**

```bash
git add messages/en.json messages/es.json
git commit -m "feat(tiktok): add bilingual i18n keys for home tiktok strip"
```

---

### Task 4: Create `TikTokLightbox` component

**Files:**
- Create: `components/home/TikTokLightbox.tsx`

We build the lightbox first (no card or strip yet) because both `TikTokCard` and the unit tests depend on it. No tests for this component directly — it's exercised through `TikTokCard.test.tsx` (Task 6).

- [ ] **Step 1: Implement the lightbox**

```tsx
// components/home/TikTokLightbox.tsx
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
                  className="fixed inset-0 z-50 flex flex-col items-center justify-center p-4 md:p-8"
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ type: "spring", stiffness: 220, damping: 28 }}
                >
                  <Dialog.Close
                    aria-label={t("close")}
                    className="absolute top-4 right-4 size-10 rounded-full bg-bone/15 text-bone hover:bg-bone/25 flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bone/50"
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

- [ ] **Step 2: TS compile**

Run: `npx tsc --noEmit` — clean.

- [ ] **Step 3: Commit**

```bash
git add components/home/TikTokLightbox.tsx
git commit -m "feat(tiktok): TikTokLightbox client component (Radix dialog + lazy iframe)"
```

---

### Task 5: Create `TikTokCard` component with tests (TDD)

**Files:**
- Create: `components/home/TikTokCard.tsx`
- Test: `tests/unit/TikTokCard.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/TikTokCard.test.tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { TikTokVideo } from "@/data/tiktoks";
import { TikTokCard } from "@/components/home/TikTokCard";

// next-intl's useTranslations needs i18n context; mock it for the lightbox
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

const VIDEO: TikTokVideo = {
  slug: "test-bouquet",
  videoId: "7300000000000000000",
  url: "https://www.tiktok.com/@makythediva/video/7300000000000000000",
  thumbnail: {
    src: "/tiktoks/test-bouquet.webp",
    alt: { en: "Test bouquet thumbnail", es: "Miniatura de ramo de prueba" },
  },
  views: "128K",
};

afterEach(() => {
  // Radix portals to document.body — clean up between tests
  document.body.innerHTML = "";
});

describe("TikTokCard", () => {
  it("renders the thumbnail with localized alt text in EN", () => {
    render(<TikTokCard video={VIDEO} locale="en" />);
    const img = screen.getByAltText("Test bouquet thumbnail") as HTMLImageElement;
    expect(img.src).toContain("/tiktoks/test-bouquet.webp");
  });

  it("renders the localized alt text in ES", () => {
    render(<TikTokCard video={VIDEO} locale="es" />);
    expect(screen.getByAltText("Miniatura de ramo de prueba")).toBeDefined();
  });

  it("renders the views badge when views are present", () => {
    render(<TikTokCard video={VIDEO} locale="en" />);
    expect(screen.getByText("128K")).toBeDefined();
  });

  it("omits the views badge when views are absent", () => {
    const { views: _omit, ...rest } = VIDEO;
    render(<TikTokCard video={rest as TikTokVideo} locale="en" />);
    expect(screen.queryByText("128K")).toBeNull();
  });

  it("opens the lightbox iframe when clicked", () => {
    render(<TikTokCard video={VIDEO} locale="en" />);
    expect(document.querySelector("iframe")).toBeNull();
    fireEvent.click(screen.getByRole("button"));
    const iframe = document.querySelector("iframe") as HTMLIFrameElement;
    expect(iframe).not.toBeNull();
    expect(iframe.src).toContain("tiktok.com/embed/v2/7300000000000000000");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- TikTokCard`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `TikTokCard`**

```tsx
// components/home/TikTokCard.tsx
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
        className="group relative block w-full aspect-[9/16] rounded-xl overflow-hidden bg-ink/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/40"
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
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-12 rounded-full bg-bone/95 text-ink flex items-center justify-center shadow-[0_4px_16px_rgba(0,0,0,0.25)] transition group-hover:scale-105"
        >
          <span className="block w-0 h-0 border-y-[8px] border-y-transparent border-l-[12px] border-l-ink ml-[3px]" />
        </span>

        {/* Views badge (optional) */}
        {video.views ? (
          <span className="absolute top-3 left-3 px-2 py-1 rounded-full bg-ink/55 text-bone backdrop-blur-sm font-mono text-[10px] tracking-[0.05em]">
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

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- TikTokCard`
Expected: PASS — 5/5 tests pass.

If the iframe-render test fails because Radix `Dialog.Portal` needs `forceMount`, confirm that `TikTokLightbox.tsx` already passes `forceMount` to `<Dialog.Portal>` (it does, per Task 4).

- [ ] **Step 5: Commit**

```bash
git add components/home/TikTokCard.tsx tests/unit/TikTokCard.test.tsx
git commit -m "feat(tiktok): TikTokCard client component with tests"
```

---

### Task 6: Create `TikTokStrip` component with tests (TDD)

**Files:**
- Create: `components/home/TikTokStrip.tsx`
- Test: `tests/unit/TikTokStrip.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/TikTokStrip.test.tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { TikTokVideo } from "@/data/tiktoks";

// Override the data import so we can drive empty / non-empty states per test.
const mockTiktoks: { TIKTOKS: TikTokVideo[] } = { TIKTOKS: [] };
vi.mock("@/data/tiktoks", () => mockTiktoks);

// Mock next-intl/server (jsdom has no RSC context — same pattern as prom tests)
vi.mock("next-intl/server", async () => {
  const en = (await import("@/messages/en.json")).default;
  return {
    getTranslations: async (namespace: string) => {
      return (key: string) => {
        const parts = `${namespace}.${key}`.split(".");
        let cur: unknown = en;
        for (const p of parts) {
          if (cur && typeof cur === "object" && p in (cur as Record<string, unknown>)) {
            cur = (cur as Record<string, unknown>)[p];
          } else {
            return parts.join(".");
          }
        }
        return typeof cur === "string" ? cur : parts.join(".");
      };
    },
  };
});

import { TikTokStrip } from "@/components/home/TikTokStrip";

afterEach(() => {
  mockTiktoks.TIKTOKS = [];
});

async function renderStrip(locale: "en" | "es" = "en") {
  const ui = await TikTokStrip({ locale });
  return render(<>{ui}</>);
}

describe("TikTokStrip", () => {
  it("renders nothing when TIKTOKS is empty", async () => {
    mockTiktoks.TIKTOKS = [];
    const { container } = await renderStrip("en");
    expect(container.firstChild).toBeNull();
  });

  it("renders the section header and 2 cards when TIKTOKS has 2 entries", async () => {
    mockTiktoks.TIKTOKS = [
      {
        slug: "a",
        videoId: "1",
        url: "https://www.tiktok.com/@makythediva/video/1",
        thumbnail: { src: "/tiktoks/a.webp", alt: { en: "A", es: "A" } },
      },
      {
        slug: "b",
        videoId: "2",
        url: "https://www.tiktok.com/@makythediva/video/2",
        thumbnail: { src: "/tiktoks/b.webp", alt: { en: "B", es: "B" } },
      },
    ];
    await renderStrip("en");
    expect(screen.getByText("Watch the bouquets come together")).toBeDefined();
    expect(screen.getByText(/Behind the studio · TikTok/)).toBeDefined();
    expect(screen.getByAltText("A")).toBeDefined();
    expect(screen.getByAltText("B")).toBeDefined();
  });

  it("header CTA links to the canonical TikTok profile in a new tab", async () => {
    mockTiktoks.TIKTOKS = [
      {
        slug: "a",
        videoId: "1",
        url: "https://www.tiktok.com/@makythediva/video/1",
        thumbnail: { src: "/tiktoks/a.webp", alt: { en: "A", es: "A" } },
      },
    ];
    await renderStrip("en");
    const link = screen.getByRole("link", { name: /@makythediva/ }) as HTMLAnchorElement;
    expect(link.href).toBe("https://www.tiktok.com/@makythediva");
    expect(link.target).toBe("_blank");
    expect(link.rel).toContain("noopener");
    expect(link.rel).toContain("noreferrer");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- TikTokStrip`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `TikTokStrip`**

```tsx
// components/home/TikTokStrip.tsx
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

        <ul className="flex md:grid md:grid-cols-4 gap-3 -mx-6 px-6 md:mx-0 md:px-0 overflow-x-auto md:overflow-visible snap-x snap-mandatory md:snap-none scroll-pl-6">
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

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- TikTokStrip`
Expected: PASS — 3/3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add components/home/TikTokStrip.tsx tests/unit/TikTokStrip.test.tsx
git commit -m "feat(tiktok): TikTokStrip server component with tests"
```

---

### Task 7: Insert `<TikTokStrip />` into the home page

**Files:**
- Modify: `app/[locale]/page.tsx`

- [ ] **Step 1: Add import + insert the section**

Open `app/[locale]/page.tsx`. Find the existing imports and add:

```tsx
import { TikTokStrip } from "@/components/home/TikTokStrip";
```

Then find the `<main>` body. The current relevant ordering is:

```tsx
      <GoogleReviews locale={locale} />
      <EditorialSplit locale={locale} />
```

Insert `<TikTokStrip locale={locale} />` BETWEEN them so it becomes:

```tsx
      <GoogleReviews locale={locale} />
      <TikTokStrip locale={locale} />
      <EditorialSplit locale={locale} />
```

No other changes to the file.

- [ ] **Step 2: TS compile**

Run: `npx tsc --noEmit` — clean.

- [ ] **Step 3: Commit**

```bash
git add app/[locale]/page.tsx
git commit -m "feat(home): mount TikTokStrip between GoogleReviews and EditorialSplit"
```

---

### Task 8: Full test suite + manual smoke

**Files:** none (verification only)

- [ ] **Step 1: Run the full unit test suite**

Run: `npm test`
Expected: All TikTok-related tests pass (8 new tests across `TikTokCard.test.tsx` and `TikTokStrip.test.tsx`). Pre-existing failures unrelated to this work (puppeteer/print-chromium, checkout-schema) are acceptable and should be unchanged from baseline.

- [ ] **Step 2: TS compile**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Manual smoke — empty state (TIKTOKS is empty)**

Run: `npm run dev`. Visit `http://localhost:3000/en` and `http://localhost:3000/es`. Scroll between the Google Reviews section and the Editorial Split section. There should be NO TikTok section visible (early-return `null` because `TIKTOKS = []`). Confirm no console errors.

Also confirm the footer / mega menu now point to `https://www.tiktok.com/@makythediva` (not the old `@divaflowers`). Look in the footer where social links render — clicking TikTok should open the correct profile.

Kill dev server.

- [ ] **Step 4: Manual smoke — non-empty state (temporary seed)**

For this smoke test, temporarily add one entry to `data/tiktoks.ts` so the strip renders. Append inside the `TIKTOKS` array literal:

```ts
{
  slug: "smoke-test",
  videoId: "7300000000000000000",
  url: "https://www.tiktok.com/@makythediva/video/7300000000000000000",
  thumbnail: {
    src: "/tiktoks/smoke-test.webp",
    alt: {
      en: "Smoke test thumbnail",
      es: "Miniatura de prueba",
    },
  },
  views: "10K",
},
```

(The thumbnail file doesn't exist, so you'll see a broken-image placeholder over the `bg-ink/5` neutral background — that's expected for the smoke test.)

Run `npm run dev` again. Visit `/en` and `/es`:
- The TikTok section appears between GoogleReviews and EditorialSplit
- Header shows the eyebrow ("Behind the studio · TikTok" / "Detrás del estudio · TikTok") + bilingual title
- "@makythediva →" link in the header (opens canonical profile in new tab)
- One card with views badge "10K" and a centered play icon overlay (image broken — that's OK)
- Click the card → Radix lightbox opens with the TikTok iframe loading the embed URL. Note: the placeholder `videoId` `73000…0` is not real, so TikTok will show an error inside the iframe — that's also expected. Verify:
  - Modal overlay fades in with backdrop blur
  - X close button works
  - "Watch on TikTok →" link goes to the canonical URL in a new tab
  - Esc key closes the modal

After the smoke test passes, **revert the temporary entry** so the committed `TIKTOKS` stays empty:

```bash
git checkout data/tiktoks.ts
```

Kill dev server.

- [ ] **Step 5: No commit** (verification step only)

---

## Self-Review

**Spec coverage:**
- Spec §3 (home insertion + site.ts correction) → Tasks 2, 7
- Spec §4 (TikTokStrip) → Task 6
- Spec §5 (TikTokCard) → Task 5
- Spec §6 (TikTokLightbox) → Task 4
- Spec §7 (data file) → Task 1
- Spec §8 (i18n) → Task 3
- Spec §10 (testing) → Tasks 5, 6, 8
- Spec §11 (out of scope) → respected; no extra features added
- Spec §12 (reversal) → documented in spec, no code work needed

**Placeholder scan:** No TBD/TODO entries; all code blocks are complete; commands have explicit expected output; test code is fully written, not paraphrased.

**Type/name consistency:**
- `TikTokVideo` type (Task 1) used identically in Tasks 5 (`TikTokCard`), 6 (`TikTokStrip`), and both test files.
- `TIKTOKS` array name used consistently.
- Field names (`videoId`, `slug`, `thumbnail.src`, `thumbnail.alt.{en,es}`, `views`) match across the data file, the components, and the test fixtures.
- Translation namespace `home.tiktok` and sub-namespace `home.tiktok.lightbox` are used consistently between Task 3 (definition), Task 4 (lightbox `useTranslations`), and Task 6 (strip `getTranslations`).

**Out of scope correctly omitted:**
- No autoplay, no scroll-driven preview, no analytics events, no oEmbed fetching, no carousel arrows, no admin CMS — all explicitly excluded per spec §11.
