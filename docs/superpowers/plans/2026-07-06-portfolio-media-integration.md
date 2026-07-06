# Portfolio Media Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate real wedding/event media (3 weddings, 3 events + a first communion) into the site with real playable video, via a conversion pipeline + a shared media gallery generalized from the existing wedding components.

**Architecture:** A one-time Node conversion script produces web assets (`.webp` photos, `.mp4`+poster videos) under `public/`. A shared `PortfolioEvent`/`MediaItem` data model feeds generalized, video-capable components (`MediaFrame`, `MediaLightbox`, `PortfolioCard`, `PortfolioGallery`) used by both the weddings and events pages. The old wedding-only gallery is replaced.

**Tech Stack:** Node ESM script (ffmpeg/cwebp/sips), Next.js App Router + next-intl, React 19 client components, framer-motion, Vitest 4 + @testing-library/react.

---

## Conventions (read once)

- **Node 22** (`/opt/homebrew/bin/node`); shell default v16 breaks vitest.
- **Run one test file:** `PATH="/opt/homebrew/bin:$PATH" NODE_OPTIONS='--experimental-sqlite' npx vitest run tests/unit/<file>`
- **i18n parity mandatory:** every key in both `messages/en.json` and `messages/es.json` at identical paths.
- **Project rules:** real media only (no AI); no "free delivery"; warm occasion-tailored copy.
- **Non-standard Next.js:** read `node_modules/next/dist/docs/` before route/metadata changes (this plan barely touches routes).
- Commit after each task with the message in its final step. Don't touch the untracked `docs/marketing/`.

## File Structure

**Create:**
- `scripts/convert-portfolio-media.mjs` — one-time media converter.
- `public/weddings/{boda-01,boda-02,boda-03}/…` and `public/events/{evento-01,evento-02,evento-03,comunion-01}/…` — produced assets (committed).
- `types/portfolio.ts` — `LocalizedText`, `MediaItem`, `PortfolioEvent`.
- `components/portfolio/MediaFrame.tsx` — draws one media item (photo image, or muted autoplay-loop video for card heroes).
- `components/portfolio/MediaLightbox.tsx` — fullscreen carousel (photo image or `<video controls>`).
- `components/portfolio/PortfolioCard.tsx` — one event card (hero = `media[0]`).
- `components/portfolio/PortfolioGallery.tsx` — the gallery section (cards + lightbox + inquire CTA).
- `data/wedding-projects.ts` — `weddingProjects: PortfolioEvent[]` (replaces `data/wedding-events.ts`).
- `data/event-projects.ts` — `eventProjects: PortfolioEvent[]`.
- Tests: `media-frame.test.tsx`, `media-lightbox.test.tsx`, `portfolio-card.test.tsx`, `portfolio-gallery.test.tsx`, `wedding-projects.test.ts`, `event-projects.test.ts`, `portfolio-assets.test.ts`.

**Modify:** `messages/en.json`, `messages/es.json`, `app/[locale]/weddings/page.tsx`, `app/[locale]/events/page.tsx`, `components/home/EventsTeaser.tsx`.

**Delete:** `components/weddings/{WeddingStories,WeddingStoryCard,WeddingLightbox}.tsx`, `data/wedding-events.ts`, and tests `tests/unit/{wedding-events,wedding-stories,wedding-story-card,wedding-lightbox,wedding-stories-cta}.test.*`.

**Model note (refinement of the spec):** the hero is `media[0]` (no separate `heroSrc`), so a video-first event autoplays a muted loop as its card hero — delivering the agreed in-grid video behavior.

---

## Task 1: Media conversion script + assets

**Files:** Create `scripts/convert-portfolio-media.mjs`; produces assets under `public/{weddings,events}/…`. (No vitest test — this is an asset build; Task 13 verifies the referenced files exist.)

- [ ] **Step 1: Write the script**

```js
// scripts/convert-portfolio-media.mjs
// One-time converter: Downloads/<folder> -> public/<bucket>/<slug>/{pNN.webp, vNN.mp4, vNN.webp}
// Usage: node scripts/convert-portfolio-media.mjs [INPUT_BASE_DIR]   (default: ~/Downloads)
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { join, extname } from "node:path";
import { tmpdir } from "node:os";

const INPUT_BASE = process.argv[2] || join(process.env.HOME, "Downloads");
const OUT_BASE = join(process.cwd(), "public");
const VIDEO_CAP = 4;
const MAX_EDGE = 2000;
const VIDEO_WIDTH = 1280;

const MANIFEST = [
  { folder: "Boda1", slug: "boda-01", bucket: "weddings" },
  { folder: "Boda 2", slug: "boda-02", bucket: "weddings" },
  { folder: "boda3", slug: "boda-03", bucket: "weddings" },
  { folder: "evento1", slug: "evento-01", bucket: "events" },
  { folder: "evento2", slug: "evento-02", bucket: "events" },
  { folder: "evento3", slug: "evento-03", bucket: "events" },
  { folder: "comunion", slug: "comunion-01", bucket: "events" },
];

const PHOTO_EXT = new Set([".heic", ".jpeg", ".jpg", ".png"]);
const VIDEO_EXT = new Set([".mov", ".mp4", ".m4v"]);

const run = (cmd, args) => execFileSync(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
const tmpPng = () => join(tmpdir(), `pm_${process.pid}_${Math.random().toString(36).slice(2)}.png`);

const listFiles = (dir, extSet) =>
  readdirSync(dir).filter((f) => !f.startsWith(".") && extSet.has(extname(f).toLowerCase())).sort();

function videoDuration(file) {
  const out = execFileSync("ffprobe", [
    "-v", "error", "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1", file,
  ]).toString().trim();
  return parseFloat(out) || 0;
}

function convertPhoto(src, outWebp) {
  if (existsSync(outWebp)) return;
  const tmp = tmpPng();
  run("sips", ["-s", "format", "png", "-Z", String(MAX_EDGE), src, "--out", tmp]);
  run("cwebp", ["-q", "80", tmp, "-o", outWebp]);
}

function convertVideo(src, outMp4, outPoster) {
  if (!existsSync(outMp4)) {
    run("ffmpeg", [
      "-y", "-i", src, "-vf", `scale='min(${VIDEO_WIDTH},iw)':-2`,
      "-c:v", "libx264", "-profile:v", "high", "-pix_fmt", "yuv420p",
      "-crf", "24", "-preset", "veryfast", "-c:a", "aac", "-b:a", "128k",
      "-movflags", "+faststart", outMp4,
    ]);
  }
  if (!existsSync(outPoster)) {
    const tmp = tmpPng();
    try { run("ffmpeg", ["-y", "-ss", "1", "-i", src, "-frames:v", "1", tmp]); }
    catch { run("ffmpeg", ["-y", "-ss", "0", "-i", src, "-frames:v", "1", tmp]); }
    run("cwebp", ["-q", "80", tmp, "-o", outPoster]);
  }
}

for (const { folder, slug, bucket } of MANIFEST) {
  const inDir = join(INPUT_BASE, folder);
  if (!existsSync(inDir)) { console.log(`SKIP ${folder} (not found)`); continue; }
  const outDir = join(OUT_BASE, bucket, slug);
  mkdirSync(outDir, { recursive: true });

  const photos = listFiles(inDir, PHOTO_EXT);
  photos.forEach((f, i) =>
    convertPhoto(join(inDir, f), join(outDir, `p${String(i + 1).padStart(2, "0")}.webp`)));

  const videos = listFiles(inDir, VIDEO_EXT).map((f) => ({ f, d: videoDuration(join(inDir, f)) }));
  const chosen = videos.sort((a, b) => a.d - b.d).slice(0, VIDEO_CAP);
  chosen.forEach(({ f }, i) => {
    const n = `v${String(i + 1).padStart(2, "0")}`;
    convertVideo(join(inDir, f), join(outDir, `${n}.mp4`), join(outDir, `${n}.webp`));
  });

  console.log(`${slug}: ${photos.length} photos, ${chosen.length}/${videos.length} videos`);
}
```

- [ ] **Step 2: Run it against the real Downloads**

Run: `PATH="/opt/homebrew/bin:$PATH" node scripts/convert-portfolio-media.mjs`
Expected summary (order may vary):
```
boda-01: 2 photos, 4/25 videos
boda-02: 0 photos, 4/4 videos
boda-03: 2 photos, 4/5 videos
evento-01: 9 photos, 0/0 videos
evento-02: 8 photos, 0/0 videos
evento-03: 0 photos, 4/6 videos
comunion-01: 2 photos, 4/8 videos
```

- [ ] **Step 3: Verify the produced assets**

Run: `for d in public/weddings/boda-01 public/weddings/boda-02 public/weddings/boda-03 public/events/evento-01 public/events/evento-02 public/events/evento-03 public/events/comunion-01; do echo "$d:"; ls "$d"; done`
Expected: `boda-01` has `p01.webp p02.webp v01.mp4 v01.webp … v04.mp4 v04.webp`; `evento-01` has `p01.webp … p09.webp`; etc. Confirm every `.mp4` has a sibling `.webp` poster.

- [ ] **Step 4: Commit the script + assets**

```bash
git add scripts/convert-portfolio-media.mjs public/weddings/boda-01 public/weddings/boda-02 public/weddings/boda-03 public/events/evento-01 public/events/evento-02 public/events/evento-03 public/events/comunion-01
git commit -m "feat(media): convert + add real wedding/event photos and video"
```

---

## Task 2: Portfolio types

**Files:** Create `types/portfolio.ts`.

- [ ] **Step 1: Write the types**

```ts
// types/portfolio.ts
export type LocalizedText = { en: string; es: string };

export type MediaItem =
  | { type: "photo"; src: string; alt: LocalizedText }
  | { type: "video"; src: string; poster: string; alt: LocalizedText };

export type PortfolioEvent = {
  id: string;
  kind: "wedding" | "event";
  venue: LocalizedText;
  date: LocalizedText; // may be "" until the owner fills it in
  media: MediaItem[]; // media[0] is the hero
};
```

- [ ] **Step 2: Typecheck**

Run: `PATH="/opt/homebrew/bin:$PATH" npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add types/portfolio.ts
git commit -m "feat(portfolio): add PortfolioEvent + MediaItem types"
```

---

## Task 3: i18n keys (media_count + events.portfolio)

**Files:** Modify `messages/en.json`, `messages/es.json`. (Add new keys; keep the existing `weddings.stories.photo_count` for now — the old card still uses it until Task 9.)

- [ ] **Step 1: Add to `messages/en.json`**

Inside `weddings.stories`, add `"media_count": "{count} moments"`. Add a NEW top-level-of-`events` object `events.portfolio` mirroring `weddings.stories`:
```jsonc
"portfolio": {
  "eyebrow": "Real weddings & events",
  "title": "Moments we've made.",
  "cta": "See yourself here? Plan yours →",
  "media_count": "{count} moments",
  "open_label": "View gallery",
  "close": "Close",
  "prev": "Previous",
  "next": "Next",
  "go_to": "Go to item"
}
```

- [ ] **Step 2: Add to `messages/es.json`**

Inside `weddings.stories`, add `"media_count": "{count} momentos"`. Inside `events`, add:
```jsonc
"portfolio": {
  "eyebrow": "Bodas y eventos reales",
  "title": "Momentos que creamos.",
  "cta": "¿Te imaginas aquí? Planea el tuyo →",
  "media_count": "{count} momentos",
  "open_label": "Ver galería",
  "close": "Cerrar",
  "prev": "Anterior",
  "next": "Siguiente",
  "go_to": "Ir al elemento"
}
```

- [ ] **Step 3: Verify JSON + parity**

Run: `node -e "JSON.parse(require('fs').readFileSync('messages/en.json','utf8')); JSON.parse(require('fs').readFileSync('messages/es.json','utf8')); const e=require('./messages/en.json'),s=require('./messages/es.json'); console.log('en portfolio',Object.keys(e.events.portfolio).length,'es portfolio',Object.keys(s.events.portfolio).length,'wm',e.weddings.stories.media_count,s.weddings.stories.media_count)"`
Expected: both portfolio counts `9`, and media_count strings present.

- [ ] **Step 4: Commit**

```bash
git add messages/en.json messages/es.json
git commit -m "i18n(portfolio): add media_count + events.portfolio namespace"
```

---

## Task 4: MediaFrame component

**Files:** Create `components/portfolio/MediaFrame.tsx`, `tests/unit/media-frame.test.tsx`.

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/media-frame.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MediaFrame } from "@/components/portfolio/MediaFrame";
import type { MediaItem } from "@/types/portfolio";

const photo: MediaItem = { type: "photo", src: "/events/evento-01/p01.webp", alt: { en: "Event photo", es: "Foto de evento" } };
const video: MediaItem = { type: "video", src: "/weddings/boda-02/v01.mp4", poster: "/weddings/boda-02/v01.webp", alt: { en: "Wedding film", es: "Video de boda" } };

describe("MediaFrame", () => {
  it("renders an image for a photo item", () => {
    render(<MediaFrame item={photo} locale="en" sizes="100vw" />);
    expect(screen.getByAltText("Event photo")).toBeInTheDocument();
  });

  it("renders a looping muted inline video for a video item", () => {
    const { container } = render(<MediaFrame item={video} locale="en" />);
    const el = container.querySelector("video");
    expect(el).not.toBeNull();
    expect(el!.getAttribute("src")).toBe("/weddings/boda-02/v01.mp4");
    expect(el!.getAttribute("poster")).toBe("/weddings/boda-02/v01.webp");
    expect(el!.hasAttribute("loop")).toBe(true);
    expect(el!.hasAttribute("playsinline")).toBe(true);
    expect(el!.getAttribute("aria-label")).toBe("Wedding film");
  });

  it("uses the es alt for locale es", () => {
    render(<MediaFrame item={photo} locale="es" sizes="100vw" />);
    expect(screen.getByAltText("Foto de evento")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it, verify FAILS** (module not found).

- [ ] **Step 3: Write the component**

```tsx
// components/portfolio/MediaFrame.tsx
"use client";
import Image from "next/image";
import { useReducedMotion } from "framer-motion";
import { cn } from "@/lib/cn";
import type { MediaItem } from "@/types/portfolio";
import type { Locale } from "@/types/locale";

export function MediaFrame({
  item,
  locale,
  sizes,
  priority,
  className,
}: {
  item: MediaItem;
  locale: Locale;
  sizes?: string;
  priority?: boolean;
  className?: string;
}) {
  const reduce = useReducedMotion();

  if (item.type === "photo") {
    return (
      <Image
        src={item.src}
        alt={item.alt[locale]}
        fill
        sizes={sizes}
        priority={priority}
        className={cn("object-cover", className)}
      />
    );
  }

  return (
    <video
      src={item.src}
      poster={item.poster}
      muted
      loop
      playsInline
      autoPlay={!reduce}
      preload="metadata"
      aria-label={item.alt[locale]}
      className={cn("absolute inset-0 h-full w-full object-cover", className)}
    />
  );
}
```

- [ ] **Step 4: Run it, verify PASS.**

Run: `PATH="/opt/homebrew/bin:$PATH" NODE_OPTIONS='--experimental-sqlite' npx vitest run tests/unit/media-frame.test.tsx`
Expected: 3 pass.

- [ ] **Step 5: Commit**

```bash
git add components/portfolio/MediaFrame.tsx tests/unit/media-frame.test.tsx
git commit -m "feat(portfolio): MediaFrame (photo image / muted-loop video)"
```

---

## Task 5: MediaLightbox component

**Files:** Create `components/portfolio/MediaLightbox.tsx`, `tests/unit/media-lightbox.test.tsx`. Generalized from `components/weddings/WeddingLightbox.tsx` (photo→image, video→`<video controls>`; thumbnails use posters; `namespace` prop).

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/media-lightbox.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MediaLightbox } from "@/components/portfolio/MediaLightbox";
import type { PortfolioEvent } from "@/types/portfolio";

vi.mock("next-intl", () => ({ useTranslations: () => (k: string) => k }));

const event: PortfolioEvent = {
  id: "test-event",
  kind: "event",
  venue: { en: "Private Event", es: "Evento privado" },
  date: { en: "", es: "" },
  media: [
    { type: "photo", src: "/events/evento-01/p01.webp", alt: { en: "Photo 1 en", es: "Foto 1 es" } },
    { type: "video", src: "/events/evento-03/v01.mp4", poster: "/events/evento-03/v01.webp", alt: { en: "Video 1 en", es: "Video 1 es" } },
  ],
};

describe("MediaLightbox", () => {
  it("renders nothing when event is null", () => {
    const { container } = render(<MediaLightbox event={null} locale="en" namespace="events.portfolio" onClose={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders a dialog with the venue and the first (photo) item", () => {
    render(<MediaLightbox event={event} locale="en" namespace="events.portfolio" onClose={() => {}} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Private Event")).toBeInTheDocument();
    expect(screen.getByAltText("Photo 1 en")).toBeInTheDocument();
  });

  it("shows a <video> with controls when navigated to a video item", async () => {
    const user = userEvent.setup();
    const { container } = render(<MediaLightbox event={event} locale="en" namespace="events.portfolio" onClose={() => {}} />);
    await user.click(screen.getByRole("button", { name: "next" }));
    const vid = container.querySelector("video");
    expect(vid).not.toBeNull();
    expect(vid!.hasAttribute("controls")).toBe(true);
    expect(vid!.getAttribute("src")).toBe("/events/evento-03/v01.mp4");
    expect(vid!.getAttribute("poster")).toBe("/events/evento-03/v01.webp");
  });

  it("calls onClose on the close button", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<MediaLightbox event={event} locale="en" namespace="events.portfolio" onClose={onClose} />);
    await user.click(screen.getByRole("button", { name: "close" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("renders one thumbnail per media item", () => {
    render(<MediaLightbox event={event} locale="en" namespace="events.portfolio" onClose={() => {}} />);
    const thumbs = screen.getAllByRole("button", { name: /go_to/ });
    expect(thumbs).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run it, verify FAILS.**

- [ ] **Step 3: Write the component**

```tsx
// components/portfolio/MediaLightbox.tsx
"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { X, CaretLeft, CaretRight, Play } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";
import type { PortfolioEvent } from "@/types/portfolio";
import type { Locale } from "@/types/locale";

type Props = {
  event: PortfolioEvent | null;
  locale: Locale;
  namespace: string;
  onClose: () => void;
};

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function MediaLightbox({ event, locale, namespace, onClose }: Props) {
  const t = useTranslations(namespace);
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const triggerRef = useRef<Element | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => { onCloseRef.current = onClose; });
  useEffect(() => { if (event !== null) setIndex(0); }, [event?.id]);

  useEffect(() => {
    if (!event) return;
    triggerRef.current = document.activeElement;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = prev;
      if (triggerRef.current instanceof HTMLElement) triggerRef.current.focus();
    };
  }, [event?.id]);

  const media = event?.media ?? [];
  const total = media.length;

  const trapFocus = useCallback((e: KeyboardEvent) => {
    if (!dialogRef.current) return;
    const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.key === "Tab") {
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }
  }, []);

  useEffect(() => {
    if (!event) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
      if (e.key === "ArrowRight") setIndex((i) => (i + 1) % total);
      if (e.key === "ArrowLeft") setIndex((i) => (i - 1 + total) % total);
      trapFocus(e);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [event?.id, total, trapFocus]);

  const active = media[index] ?? null;

  return (
    <AnimatePresence>
      {event && active && (
        <motion.div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label={`${event.venue[locale]} — ${event.date[locale]}`}
          className="fixed inset-0 z-[60] flex flex-col bg-ink/90 backdrop-blur-xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={reduce ? { duration: 0 } : { duration: 0.25 }}
        >
          <div className="flex items-center justify-between px-6 pt-6 pb-4 shrink-0">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-petal">
                {event.venue[locale]}
              </p>
              <p className="font-mono text-[10px] text-bone/50 mt-0.5">{event.date[locale]}</p>
            </div>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label={t("close")}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-bone/10 text-bone hover:bg-bone/20 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          <div className="relative flex-1 min-h-0">
            {active.type === "photo" ? (
              <Image src={active.src} alt={active.alt[locale]} fill sizes="100vw" priority className="object-contain" />
            ) : (
              <video
                key={active.src}
                src={active.src}
                poster={active.poster}
                controls
                playsInline
                aria-label={active.alt[locale]}
                className="absolute inset-0 h-full w-full object-contain"
              />
            )}
            <button
              type="button"
              onClick={() => setIndex((i) => (i - 1 + total) % total)}
              aria-label={t("prev")}
              className="absolute left-4 top-1/2 -translate-y-1/2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-bone/10 text-bone hover:bg-bone/20 transition-colors"
            >
              <CaretLeft size={18} />
            </button>
            <button
              type="button"
              onClick={() => setIndex((i) => (i + 1) % total)}
              aria-label={t("next")}
              className="absolute right-4 top-1/2 -translate-y-1/2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-bone/10 text-bone hover:bg-bone/20 transition-colors"
            >
              <CaretRight size={18} />
            </button>
            <p className="absolute bottom-4 right-4 font-mono text-[11px] text-bone/60 bg-ink/50 rounded-full px-3 py-1 backdrop-blur-sm">
              {index + 1} / {total}
            </p>
          </div>

          <div className="shrink-0 flex gap-2 overflow-x-auto px-6 py-4" style={{ scrollbarWidth: "none" }}>
            {media.map((m, i) => (
              <button
                key={`${event.id}-${i}`}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`${t("go_to")} ${i + 1}`}
                aria-current={i === index ? "true" : undefined}
                className={`relative shrink-0 overflow-hidden rounded-md transition-all duration-300 ${
                  i === index
                    ? "h-16 w-24 ring-2 ring-petal ring-offset-2 ring-offset-ink opacity-100"
                    : "h-12 w-16 opacity-50 hover:opacity-100"
                }`}
              >
                <Image src={m.type === "photo" ? m.src : m.poster} alt="" fill sizes="96px" className="object-cover" />
                {m.type === "video" && (
                  <span className="absolute inset-0 grid place-items-center bg-ink/20">
                    <Play size={14} weight="fill" className="text-bone" />
                  </span>
                )}
              </button>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

- [ ] **Step 4: Run it, verify PASS.**

Run: `PATH="/opt/homebrew/bin:$PATH" NODE_OPTIONS='--experimental-sqlite' npx vitest run tests/unit/media-lightbox.test.tsx`
Expected: 5 pass.

- [ ] **Step 5: Commit**

```bash
git add components/portfolio/MediaLightbox.tsx tests/unit/media-lightbox.test.tsx
git commit -m "feat(portfolio): MediaLightbox (photo + video carousel)"
```

---

## Task 6: PortfolioCard component

**Files:** Create `components/portfolio/PortfolioCard.tsx`, `tests/unit/portfolio-card.test.tsx`. Generalized from `WeddingStoryCard` (hero = `media[0]` via `MediaFrame`; `media_count`; `namespace` prop).

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/portfolio-card.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PortfolioCard } from "@/components/portfolio/PortfolioCard";
import type { PortfolioEvent } from "@/types/portfolio";

vi.mock("next-intl", () => ({ useTranslations: () => (k: string) => k }));

const event: PortfolioEvent = {
  id: "test",
  kind: "wedding",
  venue: { en: "Private Wedding", es: "Boda privada" },
  date: { en: "", es: "" },
  media: [
    { type: "photo", src: "/weddings/boda-01/p01.webp", alt: { en: "a", es: "a" } },
    { type: "video", src: "/weddings/boda-01/v01.mp4", poster: "/weddings/boda-01/v01.webp", alt: { en: "b", es: "b" } },
  ],
};

describe("PortfolioCard", () => {
  it("renders the venue and an accessible open label", () => {
    render(<PortfolioCard event={event} index={0} locale="en" namespace="weddings.stories" onOpen={() => {}} />);
    expect(screen.getAllByText("Private Wedding").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /Private Wedding/i })).toBeInTheDocument();
  });

  it("renders the media count label", () => {
    render(<PortfolioCard event={event} index={0} locale="en" namespace="weddings.stories" onOpen={() => {}} />);
    expect(screen.getByText(/media_count/)).toBeInTheDocument();
  });

  it("calls onOpen when clicked", async () => {
    const onOpen = vi.fn();
    const user = userEvent.setup();
    render(<PortfolioCard event={event} index={0} locale="en" namespace="weddings.stories" onOpen={onOpen} />);
    await user.click(screen.getByRole("button"));
    expect(onOpen).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it, verify FAILS.**

- [ ] **Step 3: Write the component**

```tsx
// components/portfolio/PortfolioCard.tsx
"use client";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { MediaFrame } from "@/components/portfolio/MediaFrame";
import type { PortfolioEvent } from "@/types/portfolio";
import type { Locale } from "@/types/locale";

type Props = {
  event: PortfolioEvent;
  index: number;
  locale: Locale;
  namespace: string;
  onOpen: () => void;
};

export function PortfolioCard({ event, index, locale, namespace, onOpen }: Props) {
  const t = useTranslations(namespace);
  const reduce = useReducedMotion();
  const reversed = index % 2 === 1;

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 24 }}
      whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-10%" }}
      transition={{ duration: 0.5 }}
    >
      <button
        type="button"
        onClick={onOpen}
        aria-label={`${event.venue[locale]} — ${t("open_label")}`}
        className={`group w-full flex flex-col sm:grid min-h-[420px] cursor-pointer text-left ${
          reversed ? "sm:grid-cols-[2fr_3fr]" : "sm:grid-cols-[3fr_2fr]"
        }`}
      >
        <div className={`relative overflow-hidden min-h-[280px] sm:min-h-0 ${reversed ? "sm:order-2" : "sm:order-1"}`}>
          <MediaFrame
            item={event.media[0]}
            locale={locale}
            sizes="(max-width: 640px) 100vw, 60vw"
            className="transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.04]"
          />
          <div className="pointer-events-none absolute inset-0 bg-ink/0 transition-colors duration-300 group-hover:bg-ink/10" />
          <p className="absolute bottom-5 right-5 font-mono text-[11px] uppercase tracking-[0.18em] text-bone/80 bg-ink/50 backdrop-blur-sm rounded-full px-3 py-1.5">
            {t("media_count", { count: event.media.length })}
          </p>
        </div>

        <div className={`bg-ink flex flex-col justify-end px-8 py-10 sm:px-10 ${reversed ? "sm:order-1" : "sm:order-2"}`}>
          <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-bone/20 mb-auto">
            {String(index + 1).padStart(2, "0")}
          </span>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-petal mt-6 mb-3">
            {event.venue[locale]}
          </p>
          <h3 className="font-display text-3xl sm:text-4xl text-bone leading-tight tracking-tight mb-2">
            {event.venue[locale]}
          </h3>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-bone/50 mb-8">
            {event.date[locale]}
          </p>
          <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-bone/60 border-b border-bone/20 pb-1 w-fit transition-colors duration-200 group-hover:text-petal group-hover:border-petal/50">
            {t("open_label")} →
          </span>
        </div>
      </button>
    </motion.div>
  );
}
```

- [ ] **Step 4: Run it, verify PASS.**

Run: `PATH="/opt/homebrew/bin:$PATH" NODE_OPTIONS='--experimental-sqlite' npx vitest run tests/unit/portfolio-card.test.tsx`
Expected: 3 pass.

- [ ] **Step 5: Commit**

```bash
git add components/portfolio/PortfolioCard.tsx tests/unit/portfolio-card.test.tsx
git commit -m "feat(portfolio): PortfolioCard (media[0] hero + count)"
```

---

## Task 7: PortfolioGallery component

**Files:** Create `components/portfolio/PortfolioGallery.tsx`, `tests/unit/portfolio-gallery.test.tsx`. Generalized from `WeddingStories` (props `events`, `namespace`, `locale`; includes the inquire CTA).

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/portfolio-gallery.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PortfolioGallery } from "@/components/portfolio/PortfolioGallery";
import type { PortfolioEvent } from "@/types/portfolio";

vi.mock("next-intl", () => ({ useTranslations: () => (k: string) => k }));

const events: PortfolioEvent[] = [
  { id: "a", kind: "event", venue: { en: "One", es: "Uno" }, date: { en: "", es: "" }, media: [{ type: "photo", src: "/events/evento-01/p01.webp", alt: { en: "x", es: "x" } }] },
  { id: "b", kind: "event", venue: { en: "Two", es: "Dos" }, date: { en: "", es: "" }, media: [{ type: "video", src: "/events/evento-03/v01.mp4", poster: "/events/evento-03/v01.webp", alt: { en: "y", es: "y" } }] },
];

describe("PortfolioGallery", () => {
  it("renders eyebrow, title and one card per event", () => {
    render(<PortfolioGallery events={events} namespace="events.portfolio" locale="en" />);
    expect(screen.getByText("eyebrow")).toBeInTheDocument();
    expect(screen.getByText("title")).toBeInTheDocument();
    // each card is a button; the CTA link is separate
    expect(screen.getAllByRole("button").length).toBe(events.length);
  });

  it("has a CTA link to #inquire", () => {
    render(<PortfolioGallery events={events} namespace="events.portfolio" locale="en" />);
    expect(screen.getByRole("link", { name: /cta/ })).toHaveAttribute("href", "#inquire");
  });

  it("opens the lightbox on card click and closes on Escape", async () => {
    const user = userEvent.setup();
    render(<PortfolioGallery events={events} namespace="events.portfolio" locale="en" />);
    await user.click(screen.getAllByRole("button")[0]);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run it, verify FAILS.**

- [ ] **Step 3: Write the component**

```tsx
// components/portfolio/PortfolioGallery.tsx
"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { PortfolioCard } from "@/components/portfolio/PortfolioCard";
import { MediaLightbox } from "@/components/portfolio/MediaLightbox";
import type { PortfolioEvent } from "@/types/portfolio";
import type { Locale } from "@/types/locale";

export function PortfolioGallery({
  events,
  namespace,
  locale,
}: {
  events: PortfolioEvent[];
  namespace: string;
  locale: Locale;
}) {
  const t = useTranslations(namespace);
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = events.find((e) => e.id === activeId) ?? null;

  return (
    <section className="py-16 sm:py-20">
      <header className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mb-12">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink/60">{t("eyebrow")}</p>
        <h2 className="mt-3 font-display text-5xl text-ink leading-[0.95] tracking-tighter">{t("title")}</h2>
      </header>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 divide-y divide-ink/10">
        {events.map((event, i) => (
          <PortfolioCard
            key={event.id}
            event={event}
            index={i}
            locale={locale}
            namespace={namespace}
            onOpen={() => setActiveId(event.id)}
          />
        ))}
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mt-12">
        <a
          href="#inquire"
          className="inline-flex w-fit items-center gap-2 rounded-full bg-ink px-6 py-3 font-sans text-sm tracking-tight text-bone transition-colors hover:bg-ink/90"
        >
          {t("cta")}
        </a>
      </div>

      <MediaLightbox event={active} locale={locale} namespace={namespace} onClose={() => setActiveId(null)} />
    </section>
  );
}
```

- [ ] **Step 4: Run it, verify PASS.**

Run: `PATH="/opt/homebrew/bin:$PATH" NODE_OPTIONS='--experimental-sqlite' npx vitest run tests/unit/portfolio-gallery.test.tsx`
Expected: 3 pass.

- [ ] **Step 5: Commit**

```bash
git add components/portfolio/PortfolioGallery.tsx tests/unit/portfolio-gallery.test.tsx
git commit -m "feat(portfolio): PortfolioGallery (cards + lightbox + inquire CTA)"
```

---

## Task 8: Weddings data → `weddingProjects` (migrate + add 3)

**Files:** Create `data/wedding-projects.ts`; create `tests/unit/wedding-projects.test.ts`; delete `data/wedding-events.ts` and `tests/unit/wedding-events.test.ts`.

The 4 existing wedding events are migrated to the new model (keep venue/date, `kind: "wedding"`, each `photos` entry `{src,alt}` → `{type:"photo",src,alt}`, and order media so the OLD `heroSrc` photo is `media[0]`). Then append the 3 new bodas from Task 1's assets.

- [ ] **Step 1: Write the failing data test**

```ts
// tests/unit/wedding-projects.test.ts
import { describe, it, expect } from "vitest";
import { weddingProjects } from "@/data/wedding-projects";

describe("weddingProjects", () => {
  it("has at least the 4 existing + 3 new = 7 events, all kind wedding, unique ids", () => {
    expect(weddingProjects.length).toBeGreaterThanOrEqual(7);
    expect(weddingProjects.every((e) => e.kind === "wedding")).toBe(true);
    const ids = weddingProjects.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("each event has bilingual venue/date and at least one media item", () => {
    weddingProjects.forEach((e) => {
      expect(typeof e.venue.en).toBe("string");
      expect(typeof e.venue.es).toBe("string");
      expect(typeof e.date.en).toBe("string");
      expect(typeof e.date.es).toBe("string");
      expect(e.media.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("each media item is a valid photo or video with bilingual alt", () => {
    weddingProjects.forEach((e) => {
      e.media.forEach((m) => {
        expect(m.src.startsWith("/")).toBe(true);
        expect(m.alt.en.trim().length).toBeGreaterThan(0);
        expect(m.alt.es.trim().length).toBeGreaterThan(0);
        if (m.type === "video") expect(m.poster.startsWith("/")).toBe(true);
      });
    });
  });

  it("includes the 3 new bodas", () => {
    const ids = weddingProjects.map((e) => e.id);
    expect(ids).toEqual(expect.arrayContaining(["boda-01", "boda-02", "boda-03"]));
  });
});
```

- [ ] **Step 2: Run it, verify FAILS** (module not found).

- [ ] **Step 3: Write `data/wedding-projects.ts`**

Migrate each of the 4 existing entries from `data/wedding-events.ts` using this exact rule, then append the 3 new. Example — the real `dani-bridal-shower-jun-2026` entry migrates to:
```ts
// data/wedding-projects.ts
import type { PortfolioEvent } from "@/types/portfolio";

export const weddingProjects: PortfolioEvent[] = [
  {
    id: "dani-bridal-shower-jun-2026",
    kind: "wedding",
    venue: { en: "Private Venue", es: "Salón Privado" },
    date: { en: "June 2, 2026", es: "2 de junio de 2026" },
    media: [
      { type: "photo", src: "/weddings/dani-bridal-shower-jun-2026/7234.webp", alt: { en: "Floral centerpiece at Dani's bridal shower", es: "Centro de mesa floral en el bridal shower de Dani" } },
      { type: "photo", src: "/weddings/dani-bridal-shower-jun-2026/7236.webp", alt: { en: "Soft floral arrangement in pastel tones", es: "Arreglo floral suave en tonos pastel" } },
      { type: "photo", src: "/weddings/dani-bridal-shower-jun-2026/7238.webp", alt: { en: "Detail of fresh blooms for the celebration", es: "Detalle de flores frescas para la celebración" } },
      { type: "photo", src: "/weddings/dani-bridal-shower-jun-2026/7240a.webp", alt: { en: "Wide view of the bridal shower floral decor", es: "Vista general de la decoración floral del bridal shower" } },
      { type: "photo", src: "/weddings/dani-bridal-shower-jun-2026/7240b.webp", alt: { en: "Elegant floral display at the venue", es: "Exhibición floral elegante en el salón" } },
      { type: "photo", src: "/weddings/dani-bridal-shower-jun-2026/7240c.webp", alt: { en: "Romantic florals by Diva Flowers", es: "Florales románticos por Diva Flowers" } },
      { type: "photo", src: "/weddings/dani-bridal-shower-jun-2026/7243.webp", alt: { en: "Lush bouquet arrangement for the bride-to-be", es: "Arreglo exuberante para la futura novia" } },
      { type: "photo", src: "/weddings/dani-bridal-shower-jun-2026/7244.webp", alt: { en: "Table setting with seasonal blooms", es: "Mesa decorada con flores de temporada" } },
      { type: "photo", src: "/weddings/dani-bridal-shower-jun-2026/7246.webp", alt: { en: "Cascading floral installation detail", es: "Detalle de instalación floral en cascada" } },
      { type: "photo", src: "/weddings/dani-bridal-shower-jun-2026/7247.webp", alt: { en: "Full floral setup at the bridal shower", es: "Montaje floral completo del bridal shower" } },
      { type: "photo", src: "/weddings/dani-bridal-shower-jun-2026/7248.webp", alt: { en: "Close-up of mixed blooms and greenery", es: "Primer plano de flores mixtas y follaje" } },
    ],
  },
  // ... migrate westbury-oct-2024, garden-city-jun-2024, oheka-mar-2024 the SAME way:
  //   keep id/venue/date, add kind:"wedding", map each photos[] entry to {type:"photo",src,alt},
  //   and reorder so the photo whose src === the old heroSrc is FIRST in media.
  //   (Old heroSrc values: westbury→/weddings/06.webp, garden-city→/weddings/12.webp, oheka→/weddings/13.webp.)

  {
    id: "boda-01",
    kind: "wedding",
    venue: { en: "Private Wedding", es: "Boda privada" },
    date: { en: "", es: "" },
    media: [
      { type: "photo", src: "/weddings/boda-01/p01.webp", alt: { en: "Wedding florals by Diva Flowers", es: "Florales de boda por Diva Flowers" } },
      { type: "photo", src: "/weddings/boda-01/p02.webp", alt: { en: "Wedding florals by Diva Flowers", es: "Florales de boda por Diva Flowers" } },
      { type: "video", src: "/weddings/boda-01/v01.mp4", poster: "/weddings/boda-01/v01.webp", alt: { en: "Wedding film by Diva Flowers", es: "Video de boda por Diva Flowers" } },
      { type: "video", src: "/weddings/boda-01/v02.mp4", poster: "/weddings/boda-01/v02.webp", alt: { en: "Wedding film by Diva Flowers", es: "Video de boda por Diva Flowers" } },
      { type: "video", src: "/weddings/boda-01/v03.mp4", poster: "/weddings/boda-01/v03.webp", alt: { en: "Wedding film by Diva Flowers", es: "Video de boda por Diva Flowers" } },
      { type: "video", src: "/weddings/boda-01/v04.mp4", poster: "/weddings/boda-01/v04.webp", alt: { en: "Wedding film by Diva Flowers", es: "Video de boda por Diva Flowers" } },
    ],
  },
  {
    id: "boda-02",
    kind: "wedding",
    venue: { en: "Private Wedding", es: "Boda privada" },
    date: { en: "", es: "" },
    media: [
      { type: "video", src: "/weddings/boda-02/v01.mp4", poster: "/weddings/boda-02/v01.webp", alt: { en: "Wedding film by Diva Flowers", es: "Video de boda por Diva Flowers" } },
      { type: "video", src: "/weddings/boda-02/v02.mp4", poster: "/weddings/boda-02/v02.webp", alt: { en: "Wedding film by Diva Flowers", es: "Video de boda por Diva Flowers" } },
      { type: "video", src: "/weddings/boda-02/v03.mp4", poster: "/weddings/boda-02/v03.webp", alt: { en: "Wedding film by Diva Flowers", es: "Video de boda por Diva Flowers" } },
      { type: "video", src: "/weddings/boda-02/v04.mp4", poster: "/weddings/boda-02/v04.webp", alt: { en: "Wedding film by Diva Flowers", es: "Video de boda por Diva Flowers" } },
    ],
  },
  {
    id: "boda-03",
    kind: "wedding",
    venue: { en: "Private Wedding", es: "Boda privada" },
    date: { en: "", es: "" },
    media: [
      { type: "photo", src: "/weddings/boda-03/p01.webp", alt: { en: "Wedding florals by Diva Flowers", es: "Florales de boda por Diva Flowers" } },
      { type: "photo", src: "/weddings/boda-03/p02.webp", alt: { en: "Wedding florals by Diva Flowers", es: "Florales de boda por Diva Flowers" } },
      { type: "video", src: "/weddings/boda-03/v01.mp4", poster: "/weddings/boda-03/v01.webp", alt: { en: "Wedding film by Diva Flowers", es: "Video de boda por Diva Flowers" } },
      { type: "video", src: "/weddings/boda-03/v02.mp4", poster: "/weddings/boda-03/v02.webp", alt: { en: "Wedding film by Diva Flowers", es: "Video de boda por Diva Flowers" } },
      { type: "video", src: "/weddings/boda-03/v03.mp4", poster: "/weddings/boda-03/v03.webp", alt: { en: "Wedding film by Diva Flowers", es: "Video de boda por Diva Flowers" } },
      { type: "video", src: "/weddings/boda-03/v04.mp4", poster: "/weddings/boda-03/v04.webp", alt: { en: "Wedding film by Diva Flowers", es: "Video de boda por Diva Flowers" } },
    ],
  },
];
```
For the 3 migrated placeholder entries, open the OLD `data/wedding-events.ts` and copy each `photos` array verbatim into `media` with each item prefixed `type: "photo"`, then move the `heroSrc`-matching photo to the front. (The `alt`/`src` text is already in that file — reuse it exactly.)

- [ ] **Step 4: Run the data test, verify PASS.**

Run: `PATH="/opt/homebrew/bin:$PATH" NODE_OPTIONS='--experimental-sqlite' npx vitest run tests/unit/wedding-projects.test.ts`
Expected: 4 pass.

- [ ] **Step 5: Delete the old data file + its test**

```bash
git rm data/wedding-events.ts tests/unit/wedding-events.test.ts
```
(If `tsc` now reports references to `@/data/wedding-events`, they are the old components — handled in Task 9.)

- [ ] **Step 6: Commit**

```bash
git add data/wedding-projects.ts tests/unit/wedding-projects.test.ts
git commit -m "feat(portfolio): migrate weddings to weddingProjects + add 3 new bodas"
```

---

## Task 9: Swap weddings page to PortfolioGallery; delete old wedding gallery

**Files:** Modify `app/[locale]/weddings/page.tsx`, `messages/en.json`, `messages/es.json`; delete `components/weddings/{WeddingStories,WeddingStoryCard,WeddingLightbox}.tsx` and tests `tests/unit/{wedding-stories,wedding-story-card,wedding-lightbox,wedding-stories-cta}.test.*`.

- [ ] **Step 1: Update the weddings page**

In `app/[locale]/weddings/page.tsx`: replace `import { WeddingStories } from "@/components/weddings/WeddingStories";` with `import { PortfolioGallery } from "@/components/portfolio/PortfolioGallery";` and `import { weddingProjects } from "@/data/wedding-projects";`. Replace `<WeddingStories locale={locale} />` with:
```tsx
      <PortfolioGallery events={weddingProjects} namespace="weddings.stories" locale={locale} />
```
Leave every other section (WeddingFaqLD, ServiceLD, hero, testimonials, WhatHappensNext, form, etc.) unchanged.

- [ ] **Step 2: Delete the old components + their tests**

```bash
git rm components/weddings/WeddingStories.tsx components/weddings/WeddingStoryCard.tsx components/weddings/WeddingLightbox.tsx tests/unit/wedding-stories.test.tsx tests/unit/wedding-story-card.test.tsx tests/unit/wedding-lightbox.test.tsx tests/unit/wedding-stories-cta.test.tsx
```
(Coverage for these is replaced by the portfolio-component tests + `portfolio-gallery.test.tsx`, which includes the inquire-CTA assertion that `wedding-stories-cta.test.tsx` used to cover.)

- [ ] **Step 3: Remove the now-unused `photo_count` key**

In both `messages/en.json` and `messages/es.json`, delete `weddings.stories.photo_count` (superseded by `media_count`). Keep all other `weddings.stories.*` keys.

- [ ] **Step 4: Verify tsc + no stale references**

Run: `PATH="/opt/homebrew/bin:$PATH" npx tsc --noEmit` → no errors.
Run: `grep -rn "wedding-events\|WeddingStories\|WeddingStoryCard\|WeddingLightbox\|photo_count" app components data tests messages || echo "clean"` → `clean` (no references remain).

- [ ] **Step 5: Run the portfolio suite + weddings-adjacent tests**

Run: `PATH="/opt/homebrew/bin:$PATH" NODE_OPTIONS='--experimental-sqlite' npx vitest run tests/unit/media-frame.test.tsx tests/unit/media-lightbox.test.tsx tests/unit/portfolio-card.test.tsx tests/unit/portfolio-gallery.test.tsx tests/unit/wedding-projects.test.ts`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add app/[locale]/weddings/page.tsx messages/en.json messages/es.json
git commit -m "feat(weddings): use PortfolioGallery; remove legacy wedding gallery"
```

---

## Task 10: Events data → `eventProjects`

**Files:** Create `data/event-projects.ts`, `tests/unit/event-projects.test.ts`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/event-projects.test.ts
import { describe, it, expect } from "vitest";
import { eventProjects } from "@/data/event-projects";

describe("eventProjects", () => {
  it("has the 4 events (3 events + communion), all kind event, unique ids", () => {
    expect(eventProjects.map((e) => e.id)).toEqual(
      expect.arrayContaining(["evento-01", "evento-02", "evento-03", "comunion-01"]),
    );
    expect(eventProjects.every((e) => e.kind === "event")).toBe(true);
    const ids = eventProjects.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("each media item is a valid photo/video with bilingual alt", () => {
    eventProjects.forEach((e) => {
      expect(e.media.length).toBeGreaterThanOrEqual(1);
      e.media.forEach((m) => {
        expect(m.src.startsWith("/")).toBe(true);
        expect(m.alt.en.trim().length).toBeGreaterThan(0);
        expect(m.alt.es.trim().length).toBeGreaterThan(0);
        if (m.type === "video") expect(m.poster.startsWith("/")).toBe(true);
      });
    });
  });
});
```

- [ ] **Step 2: Run it, verify FAILS.**

- [ ] **Step 3: Write `data/event-projects.ts`**

```ts
// data/event-projects.ts
import type { PortfolioEvent } from "@/types/portfolio";

const eventPhoto = (src: string) => ({
  type: "photo" as const, src,
  alt: { en: "Event florals by Diva Flowers", es: "Florales de evento por Diva Flowers" },
});
const eventVideo = (n: string, slug: string) => ({
  type: "video" as const, src: `/events/${slug}/${n}.mp4`, poster: `/events/${slug}/${n}.webp`,
  alt: { en: "Event film by Diva Flowers", es: "Video de evento por Diva Flowers" },
});

export const eventProjects: PortfolioEvent[] = [
  {
    id: "evento-01",
    kind: "event",
    venue: { en: "Private Event", es: "Evento privado" },
    date: { en: "", es: "" },
    media: ["p01","p02","p03","p04","p05","p06","p07","p08","p09"].map((p) => eventPhoto(`/events/evento-01/${p}.webp`)),
  },
  {
    id: "evento-02",
    kind: "event",
    venue: { en: "Private Event", es: "Evento privado" },
    date: { en: "", es: "" },
    media: ["p01","p02","p03","p04","p05","p06","p07","p08"].map((p) => eventPhoto(`/events/evento-02/${p}.webp`)),
  },
  {
    id: "evento-03",
    kind: "event",
    venue: { en: "Private Event", es: "Evento privado" },
    date: { en: "", es: "" },
    media: ["v01","v02","v03","v04"].map((v) => eventVideo(v, "evento-03")),
  },
  {
    id: "comunion-01",
    kind: "event",
    venue: { en: "First Communion", es: "Primera comunión" },
    date: { en: "", es: "" },
    media: [
      { type: "photo", src: "/events/comunion-01/p01.webp", alt: { en: "First-communion florals by Diva Flowers", es: "Florales de primera comunión por Diva Flowers" } },
      { type: "photo", src: "/events/comunion-01/p02.webp", alt: { en: "First-communion florals by Diva Flowers", es: "Florales de primera comunión por Diva Flowers" } },
      { type: "video", src: "/events/comunion-01/v01.mp4", poster: "/events/comunion-01/v01.webp", alt: { en: "First-communion film by Diva Flowers", es: "Video de primera comunión por Diva Flowers" } },
      { type: "video", src: "/events/comunion-01/v02.mp4", poster: "/events/comunion-01/v02.webp", alt: { en: "First-communion film by Diva Flowers", es: "Video de primera comunión por Diva Flowers" } },
      { type: "video", src: "/events/comunion-01/v03.mp4", poster: "/events/comunion-01/v03.webp", alt: { en: "First-communion film by Diva Flowers", es: "Video de primera comunión por Diva Flowers" } },
      { type: "video", src: "/events/comunion-01/v04.mp4", poster: "/events/comunion-01/v04.webp", alt: { en: "First-communion film by Diva Flowers", es: "Video de primera comunión por Diva Flowers" } },
    ],
  },
];
```

- [ ] **Step 4: Run it, verify PASS.**

Run: `PATH="/opt/homebrew/bin:$PATH" NODE_OPTIONS='--experimental-sqlite' npx vitest run tests/unit/event-projects.test.ts`
Expected: 2 pass.

- [ ] **Step 5: Commit**

```bash
git add data/event-projects.ts tests/unit/event-projects.test.ts
git commit -m "feat(portfolio): add eventProjects (3 events + communion)"
```

---

## Task 11: Wire the events portfolio into the events page

**Files:** Modify `app/[locale]/events/page.tsx`.

- [ ] **Step 1: Add the gallery after `UseCaseGrid`, before `Testimonials`**

Add imports `import { PortfolioGallery } from "@/components/portfolio/PortfolioGallery";` and `import { eventProjects } from "@/data/event-projects";`. Insert between `<UseCaseGrid locale={locale} />` and the `<Testimonials … />`:
```tsx
      <PortfolioGallery events={eventProjects} namespace="events.portfolio" locale={locale} />
```

- [ ] **Step 2: Verify tsc**

Run: `PATH="/opt/homebrew/bin:$PATH" npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/[locale]/events/page.tsx
git commit -m "feat(events): add real events portfolio to the events page"
```

---

## Task 12: Swap the EventsTeaser image to a real event photo

**Files:** Modify `components/home/EventsTeaser.tsx`.

- [ ] **Step 1: Update the image + remove the TODO**

In `components/home/EventsTeaser.tsx`, replace the `<img … src="/weddings/dani-bridal-shower-jun-2026/7247.webp" …>` (and its `TODO` comment) with a real corporate/event photo now available:
```tsx
          <img
            alt=""
            src="/events/evento-01/p01.webp"
            className="absolute inset-0 size-full object-cover"
          />
```

- [ ] **Step 2: Verify the file exists + test still passes**

Run: `ls -la public/events/evento-01/p01.webp`
Run: `PATH="/opt/homebrew/bin:$PATH" NODE_OPTIONS='--experimental-sqlite' npx vitest run tests/unit/events-teaser.test.tsx`
Expected: file exists; test passes (it asserts the title + link, not the image src).

- [ ] **Step 3: Commit**

```bash
git add components/home/EventsTeaser.tsx
git commit -m "feat(home): use a real event photo in the EventsTeaser"
```

---

## Task 13: Asset-integrity test

**Files:** Create `tests/unit/portfolio-assets.test.ts`. Verifies every media path referenced by the data exists on disk under `public/`.

- [ ] **Step 1: Write the test**

```ts
// tests/unit/portfolio-assets.test.ts
import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { weddingProjects } from "@/data/wedding-projects";
import { eventProjects } from "@/data/event-projects";
import type { PortfolioEvent } from "@/types/portfolio";

const PUBLIC = join(process.cwd(), "public");
const all: PortfolioEvent[] = [...weddingProjects, ...eventProjects];

function paths(e: PortfolioEvent): string[] {
  return e.media.flatMap((m) => (m.type === "video" ? [m.src, m.poster] : [m.src]));
}

describe("portfolio assets exist on disk", () => {
  it("every referenced media file is present under public/", () => {
    const missing: string[] = [];
    for (const e of all) {
      for (const p of paths(e)) {
        if (!existsSync(join(PUBLIC, p))) missing.push(`${e.id}: ${p}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it, verify PASS.**

Run: `PATH="/opt/homebrew/bin:$PATH" NODE_OPTIONS='--experimental-sqlite' npx vitest run tests/unit/portfolio-assets.test.ts`
Expected: 1 pass. (If it fails, the listed paths are typos or un-converted files — fix the data or re-run Task 1's script.)

- [ ] **Step 3: Final full-suite + tsc check**

Run: `PATH="/opt/homebrew/bin:$PATH" npx tsc --noEmit` → clean.
Run: `PATH="/opt/homebrew/bin:$PATH" NODE_OPTIONS='--experimental-sqlite' npx vitest run tests/unit/media-frame.test.tsx tests/unit/media-lightbox.test.tsx tests/unit/portfolio-card.test.tsx tests/unit/portfolio-gallery.test.tsx tests/unit/wedding-projects.test.ts tests/unit/event-projects.test.ts tests/unit/portfolio-assets.test.ts tests/unit/events-teaser.test.tsx` → all pass.
(The repo has a known-noisy baseline of ~5-7 pre-existing unrelated failures — print/checkout — not caused by this branch.)

- [ ] **Step 4: Commit**

```bash
git add tests/unit/portfolio-assets.test.ts
git commit -m "test(portfolio): assert all referenced media exist on disk"
```

---

## Post-implementation: manual verification + owner follow-ups

- [ ] Dev preview on `/en` and `/es`: weddings gallery (now with the 3 new bodas incl. video), events page shows the new portfolio, video-first cards autoplay muted loops, the lightbox plays video with sound/controls, `prefers-reduced-motion` shows posters, and the home EventsTeaser shows the new event photo.
- [ ] **Owner:** fill real `date` per new event in `data/wedding-projects.ts` / `data/event-projects.ts`, and prune any media you don't want (remove array entries). Raise `VIDEO_CAP` in the script + re-run to publish more than 4 videos for an event.
- [ ] **Deploy:** this is not live until the site is redeployed to the Hostinger host (a `git push` does not auto-deploy); the committed assets ship with that deploy.
