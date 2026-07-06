# Portfolio Media Integration (Photos + Video) — Weddings & Events

- **Date:** 2026-07-06
- **Author:** Santiago (with Claude)
- **Status:** Draft for owner review
- **Branch:** `feat/portfolio-media-integration`

## 1. Goal

Integrate real wedding and event media (shot today) into the site as proof: 3 weddings into the existing weddings portfolio, and 3 events + 1 first-communion into a NEW events portfolio. Add **real playable video** to the galleries (the material is video-heavy and video is the shop's strength). Everything web-optimized and honest (real media, generic-but-true labels).

## 2. Source material (in `~/Downloads`, captured 2026-07-06)

| Folder | Photos | Videos | Site bucket | Output slug |
|---|---|---|---|---|
| `Boda1` | 2 `.heic` | 25 `.mov` | weddings | `boda-01` |
| `Boda 2` | 0 | 4 `.mov` | weddings | `boda-02` |
| `boda3` | 2 `.heic` | 5 `.mov` | weddings | `boda-03` |
| `evento1` | 9 `.jpeg` | 0 | events | `evento-01` |
| `evento2` | 8 `.jpeg` | 0 | events | `evento-02` |
| `evento3` | 0 | 6 `.mov` | events | `evento-03` |
| `comunion` | 2 `.jpeg` | 8 `.mov` | events | `comunion-01` |

Verified: videos are **HEVC in `.mov`** (won't play in most browsers), photos are `.heic`/`.jpeg`. All must be transcoded. Tools confirmed available: `ffmpeg`/`ffprobe` 8.1, `cwebp` 1.6.0, `sips` (macOS).

## 3. Locked decisions (owner)

1. **Real video playback** in the galleries (muted autoplay loop in the grid; full playback with controls/sound in the lightbox).
2. **Structure:** weddings → weddings portfolio; events + communion → a new events portfolio. **Shared media-gallery components** used by both pages.
3. **Curation:** convert everything, publish a sensible cap per event; owner prunes later by editing the data files.
4. **Labels:** generic-but-true venue labels ("Private Wedding" / "Private Event" / "First Communion"); date left blank for the owner to fill per event. No invented venue names (honesty rule).

## 4. Architecture

Four phases, each independently testable.

### Phase 0 — Media conversion pipeline

A committed one-time utility `scripts/convert-portfolio-media.mjs` (Node ESM) that reads a manifest (folder → slug → kind) plus an input base dir (default `~/Downloads`) and writes web assets under `public/weddings/<slug>/` and `public/events/<slug>/`. Idempotent (skips existing outputs). It shells out to the verified tools:

- **Photo** (`.heic`/`.jpeg`) → `.webp`: `sips -s format png -Z 2000 "$in" --out "$tmp.png"` (resizes longest edge ≤ 2000, honors EXIF orientation), then `cwebp -q 80 "$tmp.png" -o "$out/pNN.webp"`.
- **Video** (`.mov` HEVC) → `.mp4` (H.264): `ffmpeg -i "$in" -vf "scale='min(1280,iw)':-2" -c:v libx264 -profile:v high -pix_fmt yuv420p -crf 24 -preset veryfast -c:a aac -b:a 128k -movflags +faststart "$out/vNN.mp4"`. Poster: `ffmpeg -ss 1 -i "$in" -frames:v 1 "$tmp.png"` (fallback `-ss 0` if the clip is < 1 s), then `cwebp -q 80 "$tmp.png" -o "$out/vNN.webp"`.

Naming per slug: photos `p01.webp`, `p02.webp`, …; videos `v01.mp4` + poster `v01.webp`, `v02.mp4` + `v02.webp`, … (sorted by source filename; videos additionally probed for duration so the shortest can be preferred during curation).

The script prints a per-slug summary (converted counts + each output's dimensions/duration) so curation is informed. **Assets are committed to the repo** (like the existing wedding `.webp`s). The script is committed for provenance/re-runs; it takes the input dir as an arg so it doesn't hard-depend on one machine's `~/Downloads`.

### Phase 1 — Shared media model + video-capable gallery

**Types** (`types/portfolio.ts`):
```ts
export type LocalizedText = { en: string; es: string };
export type MediaItem =
  | { type: "photo"; src: string; alt: LocalizedText }
  | { type: "video"; src: string; poster: string; alt: LocalizedText };
export type PortfolioEvent = {
  id: string;
  kind: "wedding" | "event";
  venue: LocalizedText;
  date: LocalizedText;   // "" until the owner fills it in
  heroSrc: string;       // a photo, or a video's poster
  heroAlt: LocalizedText;
  media: MediaItem[];
};
```

**Components** (new dir `components/portfolio/`), generalized from the existing wedding components:
- `MediaFrame.tsx` — `{ item: MediaItem; sizes?: string; priority?: boolean }`. Photo → `next/image`. Video → `<video src poster muted loop playsInline autoPlay preload="metadata">`. Respects `prefers-reduced-motion` (renders the poster, paused — no autoplay). This is the single unit that knows how to draw one media item.
- `MediaLightbox.tsx` — generalized from `WeddingLightbox`. For a photo item, same as today. For a video item, renders an enlarged `<video controls playsInline>` (sound available; the shop's audio matters for weddings). Keyboard nav + focus trap preserved.
- `PortfolioCard.tsx` — generalized from `WeddingStoryCard`. Hero uses `heroSrc`; shows venue/date/media-count; opens the lightbox.
- `PortfolioGallery.tsx` — generalized from `WeddingStories`. Props `{ events: PortfolioEvent[]; namespace: string; locale: Locale }`. Renders the card list + the `MediaLightbox` + the existing "start planning / inquire" CTA (from the given namespace).

The existing wedding gallery (`WeddingStories`/`WeddingStoryCard`/`WeddingLightbox`) is **replaced** by these shared components; the weddings page renders `<PortfolioGallery events={weddingProjects} namespace="weddings.stories" locale={locale} />`. The old three components are removed once the page is migrated (no dead code).

### Phase 2 — Data population

- **Migrate** `data/wedding-events.ts` → export `weddingProjects: PortfolioEvent[]` using the new `MediaItem[]` model. The 4 existing real events keep their venue/date/hero and their photos become `{ type: "photo", … }` media (`kind: "wedding"`). Then **append 3 new weddings** (`boda-01/02/03`) with converted media, generic venue label, blank date.
- **Add** `data/event-projects.ts` → export `eventProjects: PortfolioEvent[]` for `evento-01/02/03` + `comunion-01` (`kind: "event"`), generic labels, blank dates.

**Curation rule** (what lands in the data file): each event includes **all converted photos** + up to **4 videos** (shortest first). Hero = first photo if any, else the first video's poster. (Owner prunes/reorders afterward by editing the array.)

### Phase 3 — Events portfolio wiring + teaser fix

- Add a `<PortfolioGallery events={eventProjects} namespace="events.portfolio" locale={locale} />` section to `app/[locale]/events/page.tsx`, placed **after `UseCaseGrid` and before the events `Testimonials`** (real work first, then quotes).
- New i18n keys `events.portfolio.*` mirroring the existing `weddings.stories.*` (eyebrow, title, cta, media_count, open_label, close, prev, next, go_to). Add a media-count label that reads naturally for mixed photos+video (e.g. "{count} pieces" / "{count} piezas"); update the weddings key to match if it currently says "photos".
- **EventsTeaser fix:** swap the home `EventsTeaser` image from the bridal-shower placeholder to a real corporate/event photo now available (e.g. `public/events/evento-01/p01.webp`), removing the earlier `TODO`.

### Phase 4 — Tests + verification

- Unit: `MediaFrame` renders an `<img>`/next-image for a photo and a `<video>` with `poster`/`muted`/`loop`/`playsinline` for a video; `MediaLightbox` shows `<video controls>` when opened on a video item and an image for a photo item; `PortfolioGallery` renders one card per event and opens the lightbox.
- **Asset-integrity test** (`tests/unit/portfolio-assets.test.ts`): every `src`, `poster`, and `heroSrc` path referenced by `weddingProjects` + `eventProjects` exists on disk under `public/`. This catches typos and missing conversions.
- i18n parity check (en/es) after adding keys.
- Manual preview on `/en` and `/es`: weddings + events galleries render, videos autoplay muted in-grid, lightbox plays with sound, reduced-motion shows posters, home EventsTeaser shows the new photo.

## 5. Data flow

`~/Downloads/<folder>` → **convert script** → `public/{weddings,events}/<slug>/{pNN.webp, vNN.mp4, vNN.webp}` → referenced by `data/{wedding-events,event-projects}.ts` (`PortfolioEvent[]`) → rendered by `PortfolioGallery`/`PortfolioCard`/`MediaFrame`/`MediaLightbox` on the weddings and events pages.

## 6. Constraints & risks

- **Honesty of proof:** real media only; generic-but-true labels; **no invented venue names or dates**. Blank dates until the owner supplies them.
- **No AI product photos** (project rule): all assets are the owner's real captures — satisfied by construction.
- **Never claim "free delivery"** (project rule): no new marketing copy claims free logistics.
- **Bilingual parity:** every new i18n key in both `messages/en.json` and `messages/es.json`; every `alt`/`venue`/`date` is `{en,es}`.
- **Repo weight:** transcoded H.264 at ≤1280px + curation cap keeps `.mp4`s modest; they are committed like the existing wedding `.webp`s. (No CDN/HLS — out of scope.)
- **Autoplay rules:** browser autoplay requires `muted` + `playsInline`; both set. In-grid videos `preload="metadata"` to limit bandwidth; optional in-view gating is a nice-to-have, not required.
- **Non-standard Next.js** (`AGENTS.md`): read `node_modules/next/dist/docs/` before any route/metadata change (this feature is mostly components/data, minimal route surface).
- **Hostinger deploy** (project memory): none of this is live until the site is redeployed to the Hostinger host (a `git push` does not auto-deploy). The committed assets ship with that deploy.

## 7. Out of scope (follow-ups)

- Owner filling real venue/date per event, and final pruning of curated media.
- Audio loudness normalization; adaptive-bitrate/HLS streaming; a CDN for video.
- In-view autoplay gating / lazy video loading beyond `preload="metadata"`.
- A dedicated `/portfolio` route or cross-page "all celebrations" index.
