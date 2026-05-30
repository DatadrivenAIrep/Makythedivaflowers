# Wedding Stories Gallery — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat `GalleryEditorial` carousel on the weddings page with a per-event portfolio section: split-alternating cards (photo ↔ info) that open a per-wedding lightbox on click.

**Architecture:** `WeddingStories` (client component) holds `activeEventId` state and renders `WeddingStoryCard` instances plus a `WeddingLightbox`. Each card is a full-bleed grid row — photo on one side, dark info panel on the other, alternating per row. The lightbox is scoped to one `WeddingEvent`'s photos and manages its own photo index internally.

**Tech Stack:** Next.js 16, Tailwind CSS v4, Framer Motion v12, next-intl, @phosphor-icons/react, Vitest + @testing-library/react, next/image

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Create | `data/wedding-events.ts` | `WeddingEvent` type + placeholder `weddingEvents` array |
| Create | `components/weddings/WeddingStories.tsx` | Client wrapper: state, section header, renders cards + lightbox |
| Create | `components/weddings/WeddingStoryCard.tsx` | Single split-alternating card row |
| Create | `components/weddings/WeddingLightbox.tsx` | Full-screen lightbox scoped to one event |
| Modify | `messages/en.json` | Add `weddings.stories` namespace |
| Modify | `messages/es.json` | Add `weddings.stories` namespace |
| Modify | `app/[locale]/weddings/page.tsx` | Swap `GalleryEditorial` → `WeddingStories` |
| Create | `tests/unit/wedding-events.test.ts` | Data shape tests |
| Create | `tests/unit/wedding-lightbox.test.tsx` | Lightbox behavior tests |
| Create | `tests/unit/wedding-stories.test.tsx` | Integration: cards render + lightbox open/close |
| Delete | `components/weddings/gallery/GalleryEditorial.tsx` | Retired |
| Delete | `components/weddings/gallery/GalleryCarousel.tsx` | Retired |
| Delete | `components/weddings/gallery/GalleryLightbox.tsx` | Retired |
| Delete | `data/wedding-portfolio.ts` | Retired (photos remain in `public/weddings/`) |
| Delete | `tests/unit/gallery-editorial.test.tsx` | Retired |
| Delete | `tests/unit/gallery-carousel.test.tsx` | Retired |
| Delete | `tests/unit/gallery-lightbox.test.tsx` | Retired |
| Delete | `tests/unit/wedding-portfolio.test.ts` | Retired |

---

## Task 1: Add i18n strings

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/es.json`

The `i18n-keys.test.ts` enforces that `en.json` and `es.json` have identical keys. Add to **both files** simultaneously.

- [ ] **Step 1.1: Add `weddings.stories` to `messages/en.json`**

In `messages/en.json`, inside the `"weddings"` object, add after the `"faq"` key:

```json
"stories": {
  "eyebrow": "Portfolio",
  "title": "Our work, wedding by wedding.",
  "photo_count": "{count} photos",
  "open_label": "View gallery",
  "close": "Close gallery",
  "prev": "Previous photo",
  "next": "Next photo",
  "go_to": "Go to photo"
}
```

- [ ] **Step 1.2: Add `weddings.stories` to `messages/es.json`**

In `messages/es.json`, inside the `"weddings"` object, add after the `"faq"` key:

```json
"stories": {
  "eyebrow": "Portafolio",
  "title": "Nuestro trabajo, boda por boda.",
  "photo_count": "{count} fotos",
  "open_label": "Ver galería",
  "close": "Cerrar galería",
  "prev": "Foto anterior",
  "next": "Foto siguiente",
  "go_to": "Ir a la foto"
}
```

- [ ] **Step 1.3: Run i18n parity test**

```bash
npx vitest run tests/unit/i18n-keys.test.ts
```

Expected: **PASS** — both files now have identical key sets.

- [ ] **Step 1.4: Commit**

```bash
git add messages/en.json messages/es.json
git commit -m "feat(weddings): add stories i18n namespace"
```

---

## Task 2: Create the data model

**Files:**
- Create: `data/wedding-events.ts`
- Create: `tests/unit/wedding-events.test.ts`

- [ ] **Step 2.1: Write the failing test**

Create `tests/unit/wedding-events.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { weddingEvents, type WeddingEvent } from "@/data/wedding-events";

describe("weddingEvents", () => {
  it("has at least one event", () => {
    expect(weddingEvents.length).toBeGreaterThanOrEqual(1);
  });

  it("each event has all required fields", () => {
    weddingEvents.forEach((e: WeddingEvent) => {
      expect(typeof e.id).toBe("string");
      expect(e.id.trim().length).toBeGreaterThan(0);
      expect(typeof e.venue.en).toBe("string");
      expect(typeof e.venue.es).toBe("string");
      expect(typeof e.date.en).toBe("string");
      expect(typeof e.date.es).toBe("string");
      expect(typeof e.heroSrc).toBe("string");
      expect(e.heroSrc.startsWith("/")).toBe(true);
      expect(typeof e.heroAlt.en).toBe("string");
      expect(typeof e.heroAlt.es).toBe("string");
      expect(Array.isArray(e.photos)).toBe(true);
      expect(e.photos.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("event ids are unique", () => {
    const ids = weddingEvents.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("each photo has a src and bilingual alt", () => {
    weddingEvents.forEach((e: WeddingEvent) => {
      e.photos.forEach((p) => {
        expect(typeof p.src).toBe("string");
        expect(p.src.length).toBeGreaterThan(0);
        expect(p.alt.en.trim().length).toBeGreaterThan(0);
        expect(p.alt.es.trim().length).toBeGreaterThan(0);
      });
    });
  });
});
```

- [ ] **Step 2.2: Run to confirm it fails**

```bash
npx vitest run tests/unit/wedding-events.test.ts
```

Expected: **FAIL** — `Cannot find module '@/data/wedding-events'`

- [ ] **Step 2.3: Create `data/wedding-events.ts`**

```ts
export type WeddingEventPhoto = {
  src: string;
  alt: { en: string; es: string };
};

export type WeddingEvent = {
  id: string;
  venue: { en: string; es: string };
  date: { en: string; es: string };
  heroSrc: string;
  heroAlt: { en: string; es: string };
  photos: WeddingEventPhoto[];
};

// Placeholder data — replace heroSrc/photos with real paths once event photos
// are imported to public/weddings/{event-id}/
export const weddingEvents: WeddingEvent[] = [
  {
    id: "westbury-oct-2024",
    venue: { en: "Westbury Manor", es: "Westbury Manor" },
    date:  { en: "October 12, 2024", es: "12 de octubre de 2024" },
    heroSrc: "/weddings/06.webp",
    heroAlt: {
      en: "Cinematic wide view of a Diva wedding install",
      es: "Vista panorámica de una instalación de boda Diva",
    },
    photos: [
      { src: "/weddings/01.webp", alt: { en: "Wedding florals from the Diva studio floor",    es: "Florales de boda desde el estudio de Diva" } },
      { src: "/weddings/02.webp", alt: { en: "Bridal bouquet in soft natural light",          es: "Ramo de novia en luz natural suave" } },
      { src: "/weddings/03.webp", alt: { en: "Reception centerpiece in full bloom",           es: "Centro de mesa de recepción en plena flor" } },
      { src: "/weddings/04.webp", alt: { en: "Detail of garden roses and ranunculus",         es: "Detalle de rosas de jardín y ranúnculos" } },
      { src: "/weddings/05.webp", alt: { en: "Ceremony arrangement, elegant white blooms",    es: "Arreglo de ceremonia, flores blancas elegantes" } },
      { src: "/weddings/06.webp", alt: { en: "Cinematic wide view of a Diva wedding install", es: "Vista panorámica de una instalación de boda Diva" } },
    ],
  },
  {
    id: "garden-city-jun-2024",
    venue: { en: "Garden City Hotel", es: "Garden City Hotel" },
    date:  { en: "June 8, 2024", es: "8 de junio de 2024" },
    heroSrc: "/weddings/12.webp",
    heroAlt: {
      en: "Full-room reception florals, wide view",
      es: "Florales de recepción de salón completo",
    },
    photos: [
      { src: "/weddings/07.webp", alt: { en: "Tablescape with low-and-lush centerpieces",   es: "Mesa con centros bajos y abundantes" } },
      { src: "/weddings/08.webp", alt: { en: "Vertical floral installation detail",          es: "Detalle de instalación floral vertical" } },
      { src: "/weddings/09.webp", alt: { en: "Reception florals at golden hour",             es: "Florales de recepción al atardecer" } },
      { src: "/weddings/10.webp", alt: { en: "Tall arrangement against natural backdrop",    es: "Arreglo alto contra fondo natural" } },
      { src: "/weddings/11.webp", alt: { en: "Soft and romantic floral palette",             es: "Paleta floral suave y romántica" } },
      { src: "/weddings/12.webp", alt: { en: "Full-room reception florals, wide view",       es: "Florales de recepción de salón completo" } },
    ],
  },
  {
    id: "oheka-mar-2024",
    venue: { en: "Oheka Castle", es: "Oheka Castle" },
    date:  { en: "March 22, 2024", es: "22 de marzo de 2024" },
    heroSrc: "/weddings/13.webp",
    heroAlt: {
      en: "Ceremony arch in full bloom",
      es: "Arco de ceremonia en plena flor",
    },
    photos: [
      { src: "/weddings/13.webp", alt: { en: "Ceremony arch in full bloom",                   es: "Arco de ceremonia en plena flor" } },
      { src: "/weddings/14.webp", alt: { en: "Square detail of textured greenery and blooms", es: "Detalle cuadrado de follaje texturado y flores" } },
      { src: "/weddings/15.webp", alt: { en: "Mixed bouquet with seasonal stems",             es: "Ramo mixto con tallos de temporada" } },
      { src: "/weddings/16.webp", alt: { en: "Editorial portrait of a Diva arrangement",      es: "Retrato editorial de un arreglo Diva" } },
      { src: "/weddings/17.webp", alt: { en: "Panoramic view of a Diva wedding setup",        es: "Vista panorámica de un montaje de boda Diva" } },
    ],
  },
];
```

- [ ] **Step 2.4: Run test to confirm it passes**

```bash
npx vitest run tests/unit/wedding-events.test.ts
```

Expected: **PASS** — 4 tests pass.

- [ ] **Step 2.5: Commit**

```bash
git add data/wedding-events.ts tests/unit/wedding-events.test.ts
git commit -m "feat(weddings): WeddingEvent data model + placeholder events"
```

---

## Task 3: WeddingLightbox component

**Files:**
- Create: `components/weddings/WeddingLightbox.tsx`
- Create: `tests/unit/wedding-lightbox.test.tsx`

- [ ] **Step 3.1: Write the failing tests**

Create `tests/unit/wedding-lightbox.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WeddingLightbox } from "@/components/weddings/WeddingLightbox";
import type { WeddingEvent } from "@/data/wedding-events";

vi.mock("next-intl", () => ({ useTranslations: () => (k: string) => k }));

const mockEvent: WeddingEvent = {
  id: "test-event",
  venue: { en: "Test Venue", es: "Venue de prueba" },
  date: { en: "January 1, 2025", es: "1 de enero de 2025" },
  heroSrc: "/weddings/01.webp",
  heroAlt: { en: "Hero alt", es: "Alt hero" },
  photos: [
    { src: "/weddings/01.webp", alt: { en: "Photo 1 en", es: "Foto 1 es" } },
    { src: "/weddings/02.webp", alt: { en: "Photo 2 en", es: "Foto 2 es" } },
    { src: "/weddings/03.webp", alt: { en: "Photo 3 en", es: "Foto 3 es" } },
  ],
};

describe("WeddingLightbox", () => {
  it("renders nothing when event is null", () => {
    const { container } = render(
      <WeddingLightbox event={null} locale="en" onClose={() => {}} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders a dialog with venue name when event is provided", () => {
    render(<WeddingLightbox event={mockEvent} locale="en" onClose={() => {}} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Test Venue")).toBeInTheDocument();
  });

  it("shows the date in the top bar", () => {
    render(<WeddingLightbox event={mockEvent} locale="en" onClose={() => {}} />);
    expect(screen.getByText("January 1, 2025")).toBeInTheDocument();
  });

  it("shows the first photo's alt text", () => {
    render(<WeddingLightbox event={mockEvent} locale="en" onClose={() => {}} />);
    expect(screen.getByAltText("Photo 1 en")).toBeInTheDocument();
  });

  it("calls onClose when the close button is clicked", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<WeddingLightbox event={mockEvent} locale="en" onClose={onClose} />);
    await user.click(screen.getByRole("button", { name: "close" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose on Escape key", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<WeddingLightbox event={mockEvent} locale="en" onClose={onClose} />);
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });

  it("navigates to the next photo when the next button is clicked", async () => {
    const user = userEvent.setup();
    render(<WeddingLightbox event={mockEvent} locale="en" onClose={() => {}} />);
    await user.click(screen.getByRole("button", { name: "next" }));
    expect(screen.getByAltText("Photo 2 en")).toBeInTheDocument();
  });

  it("navigates to the previous photo when the prev button is clicked", async () => {
    const user = userEvent.setup();
    render(<WeddingLightbox event={mockEvent} locale="en" onClose={() => {}} />);
    // Go to photo 2 first
    await user.click(screen.getByRole("button", { name: "next" }));
    expect(screen.getByAltText("Photo 2 en")).toBeInTheDocument();
    // Now go back
    await user.click(screen.getByRole("button", { name: "prev" }));
    expect(screen.getByAltText("Photo 1 en")).toBeInTheDocument();
  });

  it("wraps around to the last photo when navigating prev from the first", async () => {
    const user = userEvent.setup();
    render(<WeddingLightbox event={mockEvent} locale="en" onClose={() => {}} />);
    await user.click(screen.getByRole("button", { name: "prev" }));
    expect(screen.getByAltText("Photo 3 en")).toBeInTheDocument();
  });

  it("wraps around to the first photo when navigating next past the last", async () => {
    const user = userEvent.setup();
    render(<WeddingLightbox event={mockEvent} locale="en" onClose={() => {}} />);
    await user.click(screen.getByRole("button", { name: "next" }));
    await user.click(screen.getByRole("button", { name: "next" }));
    await user.click(screen.getByRole("button", { name: "next" }));
    expect(screen.getByAltText("Photo 1 en")).toBeInTheDocument();
  });

  it("resets to the first photo when a new event is opened", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <WeddingLightbox event={mockEvent} locale="en" onClose={() => {}} />
    );
    await user.click(screen.getByRole("button", { name: "next" }));
    expect(screen.getByAltText("Photo 2 en")).toBeInTheDocument();

    const anotherEvent: WeddingEvent = {
      ...mockEvent,
      id: "another-event",
      venue: { en: "Another Venue", es: "Otro venue" },
      photos: [
        { src: "/weddings/10.webp", alt: { en: "Another photo en", es: "Otra foto es" } },
      ],
    };
    rerender(<WeddingLightbox event={anotherEvent} locale="en" onClose={() => {}} />);
    expect(screen.getByAltText("Another photo en")).toBeInTheDocument();
  });

  it("renders in Spanish when locale is es", () => {
    render(<WeddingLightbox event={mockEvent} locale="es" onClose={() => {}} />);
    expect(screen.getByText("Venue de prueba")).toBeInTheDocument();
    expect(screen.getByText("1 de enero de 2025")).toBeInTheDocument();
    expect(screen.getByAltText("Foto 1 es")).toBeInTheDocument();
  });
});
```

- [ ] **Step 3.2: Run to confirm tests fail**

```bash
npx vitest run tests/unit/wedding-lightbox.test.tsx
```

Expected: **FAIL** — `Cannot find module '@/components/weddings/WeddingLightbox'`

- [ ] **Step 3.3: Create `components/weddings/WeddingLightbox.tsx`**

```tsx
"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { X, CaretLeft, CaretRight } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";
import type { WeddingEvent } from "@/data/wedding-events";
import type { Locale } from "@/types/locale";

type Props = {
  event: WeddingEvent | null;
  locale: Locale;
  onClose: () => void;
};

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function WeddingLightbox({ event, locale, onClose }: Props) {
  const t = useTranslations("weddings.stories");
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const triggerRef = useRef<Element | null>(null);
  const onCloseRef = useRef(onClose);
  const indexRef = useRef(index);

  useEffect(() => { onCloseRef.current = onClose; });
  useEffect(() => { indexRef.current = index; }, [index]);

  // Reset index when a different event opens
  useEffect(() => {
    if (event !== null) setIndex(0);
  }, [event?.id]);

  // Body-scroll lock + initial focus
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

  const photos = event?.photos ?? [];
  const total = photos.length;

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
      if (e.key === "ArrowLeft")  setIndex((i) => (i - 1 + total) % total);
      trapFocus(e);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [event?.id, total, trapFocus]);

  const active = photos[index] ?? null;

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
          {/* Top bar */}
          <div className="flex items-center justify-between px-6 pt-6 pb-4 shrink-0">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-petal">
                {event.venue[locale]}
              </p>
              <p className="font-mono text-[10px] text-bone/50 mt-0.5">
                {event.date[locale]}
              </p>
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

          {/* Main photo */}
          <div className="relative flex-1 min-h-0">
            <Image
              src={active.src}
              alt={active.alt[locale]}
              fill
              sizes="100vw"
              priority
              className="object-contain"
            />
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

          {/* Thumbnail strip */}
          <div
            className="shrink-0 flex gap-2 overflow-x-auto px-6 py-4"
            style={{ scrollbarWidth: "none" }}
          >
            {photos.map((photo, i) => (
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
                <Image src={photo.src} alt="" fill sizes="96px" className="object-cover" />
              </button>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

- [ ] **Step 3.4: Run tests to confirm they pass**

```bash
npx vitest run tests/unit/wedding-lightbox.test.tsx
```

Expected: **PASS** — all 11 tests pass.

- [ ] **Step 3.5: Commit**

```bash
git add components/weddings/WeddingLightbox.tsx tests/unit/wedding-lightbox.test.tsx
git commit -m "feat(weddings): WeddingLightbox component"
```

---

## Task 4: WeddingStoryCard component

**Files:**
- Create: `components/weddings/WeddingStoryCard.tsx`
- Create: `tests/unit/wedding-story-card.test.tsx`

- [ ] **Step 4.1: Write the failing tests**

Create `tests/unit/wedding-story-card.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WeddingStoryCard } from "@/components/weddings/WeddingStoryCard";
import type { WeddingEvent } from "@/data/wedding-events";

vi.mock("next-intl", () => ({ useTranslations: () => (k: string) => k }));

const mockEvent: WeddingEvent = {
  id: "test-event",
  venue: { en: "Test Venue EN", es: "Test Venue ES" },
  date: { en: "January 1, 2025", es: "1 de enero de 2025" },
  heroSrc: "/weddings/01.webp",
  heroAlt: { en: "Hero alt en", es: "Hero alt es" },
  photos: [
    { src: "/weddings/01.webp", alt: { en: "p1 en", es: "p1 es" } },
    { src: "/weddings/02.webp", alt: { en: "p2 en", es: "p2 es" } },
    { src: "/weddings/03.webp", alt: { en: "p3 en", es: "p3 es" } },
  ],
};

describe("WeddingStoryCard", () => {
  it("renders venue name in English", () => {
    render(
      <WeddingStoryCard event={mockEvent} index={0} locale="en" onOpen={() => {}} />
    );
    expect(screen.getAllByText("Test Venue EN").length).toBeGreaterThan(0);
  });

  it("renders venue name in Spanish", () => {
    render(
      <WeddingStoryCard event={mockEvent} index={0} locale="es" onOpen={() => {}} />
    );
    expect(screen.getAllByText("Test Venue ES").length).toBeGreaterThan(0);
  });

  it("renders the formatted date", () => {
    render(
      <WeddingStoryCard event={mockEvent} index={0} locale="en" onOpen={() => {}} />
    );
    expect(screen.getByText("January 1, 2025")).toBeInTheDocument();
  });

  it("renders the photo count badge", () => {
    render(
      <WeddingStoryCard event={mockEvent} index={0} locale="en" onOpen={() => {}} />
    );
    // t("photo_count", { count: 3 }) returns "photo_count" with the mock
    expect(screen.getByText(/photo_count/)).toBeInTheDocument();
  });

  it("calls onOpen when clicked", async () => {
    const onOpen = vi.fn();
    const user = userEvent.setup();
    render(
      <WeddingStoryCard event={mockEvent} index={0} locale="en" onOpen={onOpen} />
    );
    await user.click(screen.getByRole("button"));
    expect(onOpen).toHaveBeenCalled();
  });

  it("calls onOpen on Enter key", async () => {
    const onOpen = vi.fn();
    const user = userEvent.setup();
    render(
      <WeddingStoryCard event={mockEvent} index={0} locale="en" onOpen={onOpen} />
    );
    screen.getByRole("button").focus();
    await user.keyboard("{Enter}");
    expect(onOpen).toHaveBeenCalled();
  });

  it("has an accessible label with venue name", () => {
    render(
      <WeddingStoryCard event={mockEvent} index={0} locale="en" onOpen={() => {}} />
    );
    expect(
      screen.getByRole("button", { name: /Test Venue EN/i })
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 4.2: Run to confirm tests fail**

```bash
npx vitest run tests/unit/wedding-story-card.test.tsx
```

Expected: **FAIL** — `Cannot find module '@/components/weddings/WeddingStoryCard'`

- [ ] **Step 4.3: Create `components/weddings/WeddingStoryCard.tsx`**

```tsx
"use client";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import type { WeddingEvent } from "@/data/wedding-events";
import type { Locale } from "@/types/locale";

type Props = {
  event: WeddingEvent;
  index: number;
  locale: Locale;
  onOpen: () => void;
};

export function WeddingStoryCard({ event, index, locale, onOpen }: Props) {
  const t = useTranslations("weddings.stories");
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
        {/* Photo panel */}
        <div className={`relative overflow-hidden min-h-[280px] sm:min-h-0 ${reversed ? "sm:order-2" : "sm:order-1"}`}>
          <Image
            src={event.heroSrc}
            alt={event.heroAlt[locale]}
            fill
            sizes="(max-width: 640px) 100vw, 60vw"
            className="object-cover transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.04]"
          />
          <div className="pointer-events-none absolute inset-0 bg-ink/0 transition-colors duration-300 group-hover:bg-ink/10" />
          <p className="absolute bottom-5 right-5 font-mono text-[11px] uppercase tracking-[0.18em] text-bone/80 bg-ink/50 backdrop-blur-sm rounded-full px-3 py-1.5">
            {t("photo_count", { count: event.photos.length })}
          </p>
        </div>

        {/* Info panel */}
        <div
          className={`bg-ink flex flex-col justify-end px-8 py-10 sm:px-10 ${
            reversed ? "sm:order-1" : "sm:order-2"
          }`}
        >
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

- [ ] **Step 4.4: Run tests to confirm they pass**

```bash
npx vitest run tests/unit/wedding-story-card.test.tsx
```

Expected: **PASS** — all 7 tests pass.

- [ ] **Step 4.5: Commit**

```bash
git add components/weddings/WeddingStoryCard.tsx tests/unit/wedding-story-card.test.tsx
git commit -m "feat(weddings): WeddingStoryCard split-alternating card"
```

---

## Task 5: WeddingStories parent component

**Files:**
- Create: `components/weddings/WeddingStories.tsx`
- Create: `tests/unit/wedding-stories.test.tsx`

- [ ] **Step 5.1: Write the failing tests**

Create `tests/unit/wedding-stories.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WeddingStories } from "@/components/weddings/WeddingStories";
import { weddingEvents } from "@/data/wedding-events";

vi.mock("next-intl", () => ({ useTranslations: () => (k: string) => k }));

describe("WeddingStories", () => {
  it("renders section eyebrow and title", () => {
    render(<WeddingStories locale="en" />);
    expect(screen.getByText("eyebrow")).toBeInTheDocument();
    expect(screen.getByText("title")).toBeInTheDocument();
  });

  it("renders one button per event", () => {
    render(<WeddingStories locale="en" />);
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBe(weddingEvents.length);
  });

  it("opens the lightbox when a card is clicked", async () => {
    const user = userEvent.setup();
    render(<WeddingStories locale="en" />);
    const cards = screen.getAllByRole("button");
    await user.click(cards[0]);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("closes the lightbox on Escape key", async () => {
    const user = userEvent.setup();
    render(<WeddingStories locale="en" />);
    const cards = screen.getAllByRole("button");
    await user.click(cards[0]);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    await user.keyboard("{Escape}");
    // AnimatePresence may animate out — wait for removal
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
  });

  it("renders the page in Spanish when locale is es", () => {
    render(<WeddingStories locale="es" />);
    expect(screen.getByText("eyebrow")).toBeInTheDocument();
  });
});
```

- [ ] **Step 5.2: Run to confirm tests fail**

```bash
npx vitest run tests/unit/wedding-stories.test.tsx
```

Expected: **FAIL** — `Cannot find module '@/components/weddings/WeddingStories'`

- [ ] **Step 5.3: Create `components/weddings/WeddingStories.tsx`**

```tsx
"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { weddingEvents } from "@/data/wedding-events";
import { WeddingStoryCard } from "./WeddingStoryCard";
import { WeddingLightbox } from "./WeddingLightbox";
import type { Locale } from "@/types/locale";

export function WeddingStories({ locale }: { locale: Locale }) {
  const t = useTranslations("weddings.stories");
  const [activeEventId, setActiveEventId] = useState<string | null>(null);
  const activeEvent = weddingEvents.find((e) => e.id === activeEventId) ?? null;

  return (
    <section className="py-16 sm:py-20">
      <header className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mb-12">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink/60">
          {t("eyebrow")}
        </p>
        <h2 className="mt-3 font-display text-5xl text-ink leading-[0.95] tracking-tighter">
          {t("title")}
        </h2>
      </header>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 divide-y divide-ink/10">
        {weddingEvents.map((event, i) => (
          <WeddingStoryCard
            key={event.id}
            event={event}
            index={i}
            locale={locale}
            onOpen={() => setActiveEventId(event.id)}
          />
        ))}
      </div>

      <WeddingLightbox
        event={activeEvent}
        locale={locale}
        onClose={() => setActiveEventId(null)}
      />
    </section>
  );
}
```

- [ ] **Step 5.4: Run tests to confirm they pass**

```bash
npx vitest run tests/unit/wedding-stories.test.tsx
```

Expected: **PASS** — all 5 tests pass.

- [ ] **Step 5.5: Run the full test suite to catch any regressions**

```bash
npx vitest run
```

Expected: all pre-existing tests still pass; new tests pass. Note any failures.

- [ ] **Step 5.6: Commit**

```bash
git add components/weddings/WeddingStories.tsx tests/unit/wedding-stories.test.tsx
git commit -m "feat(weddings): WeddingStories parent component"
```

---

## Task 6: Wire WeddingStories into the page

**Files:**
- Modify: `app/[locale]/weddings/page.tsx`

- [ ] **Step 6.1: Update the import and JSX in `app/[locale]/weddings/page.tsx`**

Replace the `GalleryEditorial` import and usage:

```tsx
// app/[locale]/weddings/page.tsx
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { WeddingsHero } from "@/components/weddings/WeddingsHero";
import { ProcessStrip } from "@/components/weddings/ProcessStrip";
import { WeddingStories } from "@/components/weddings/WeddingStories";
import { WeddingsFAQ } from "@/components/weddings/WeddingsFAQ";
import { PricingIntent } from "@/components/weddings/PricingIntent";
import { WeddingsForm } from "@/components/inquiry/WeddingsForm";
import type { Locale } from "@/types/locale";

export async function generateMetadata({
  params,
}: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "weddings" });
  return {
    title: t("page_title"),
    description: t("meta_description"),
    alternates: { languages: { en: "/en/weddings", es: "/es/weddings" } },
  };
}

export default async function WeddingsPage({
  params,
}: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  return (
    <>
      <WeddingsHero locale={locale} />
      <ProcessStrip />
      <PricingIntent locale={locale} />
      <WeddingStories locale={locale} />
      <WeddingsFAQ locale={locale} />
      <section id="inquire" className="py-24">
        <WeddingsForm locale={locale} />
      </section>
    </>
  );
}
```

- [ ] **Step 6.2: Run the full test suite**

```bash
npx vitest run
```

Expected: **PASS** — all tests pass (old gallery tests still run at this point).

- [ ] **Step 6.3: Commit**

```bash
git add app/[locale]/weddings/page.tsx
git commit -m "feat(weddings): wire WeddingStories into weddings page"
```

---

## Task 7: Delete retired files

Old gallery components and their tests are no longer imported anywhere. Remove them all.

- [ ] **Step 7.1: Delete the retired component files**

```bash
rm "components/weddings/gallery/GalleryEditorial.tsx"
rm "components/weddings/gallery/GalleryCarousel.tsx"
rm "components/weddings/gallery/GalleryLightbox.tsx"
```

If the `gallery/` directory is now empty, remove it too:

```bash
rmdir "components/weddings/gallery" 2>/dev/null || true
```

- [ ] **Step 7.2: Delete the retired data file**

```bash
rm "data/wedding-portfolio.ts"
```

The photo files in `public/weddings/*.webp` are kept — they are still referenced by the placeholder `weddingEvents` in `data/wedding-events.ts`.

- [ ] **Step 7.3: Delete the retired test files**

```bash
rm "tests/unit/gallery-editorial.test.tsx"
rm "tests/unit/gallery-carousel.test.tsx"
rm "tests/unit/gallery-lightbox.test.tsx"
rm "tests/unit/wedding-portfolio.test.ts"
```

- [ ] **Step 7.4: Run the full test suite to confirm nothing breaks**

```bash
npx vitest run
```

Expected: **PASS** — deleted tests are gone, all remaining tests pass with no import errors.

- [ ] **Step 7.5: Commit**

```bash
git add -A
git commit -m "chore(weddings): delete retired gallery components, data, and tests"
```

---

## Done

After Task 7 the weddings page at `/en/weddings` and `/es/weddings` shows the new `WeddingStories` section with split-alternating cards backed by real `public/weddings/*.webp` photos. The owner can replace the placeholder entries in `data/wedding-events.ts` with their actual event data and add photos to `public/weddings/{event-id}/` subfolders at any time — no code changes needed beyond updating that one data file.
