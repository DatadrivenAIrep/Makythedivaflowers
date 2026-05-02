# Google Reviews Widget Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a static, bilingual, auto-rotating Google reviews hero-quote section between `CategoryStrip` and `EditorialSplit` on the home page, with JSON-LD structured data for SEO and an outbound CTA to the Google profile.

**Architecture:** A server component (`GoogleReviews`) renders the static shell (header row, JSON-LD, CTA) and passes curated review data to a client component (`GoogleReviewsClient`) that owns rotation/navigation/translate-toggle state. A pure presentational component (`GoogleReviewsCard`) renders each individual review's quote + author footer. The JSON-LD is built by a pure function in `data/reviews.ts` that is unit-tested independently.

**Tech Stack:** Next.js App Router, TypeScript, Tailwind CSS v4, Framer Motion v12 (`useReducedMotion`, `AnimatePresence`, `motion`), next-intl v3, Vitest + @testing-library/react + @testing-library/user-event.

---

## Files

| Action | Path | Responsibility |
|--------|------|---------------|
| Create | `data/reviews.ts` | Type definitions, curated reviews array, aggregate constants, `buildReviewsJsonLd` helper |
| Modify | `messages/en.json` | Add `home.reviews.*` keys |
| Modify | `messages/es.json` | Add `home.reviews.*` keys |
| Create | `components/home/GoogleReviewsCard.tsx` | Pure presentational: quote block + footer row (avatar, meta, translate chip, nav arrows) |
| Create | `components/home/GoogleReviewsClient.tsx` | Client: autoplay, navigation, translate toggle, keyboard, ARIA live region, progress bar |
| Create | `components/home/GoogleReviews.tsx` | Server: section wrapper, header row, JSON-LD, mounts client, CTA link |
| Modify | `app/[locale]/page.tsx` | Import and slot `GoogleReviews` between `CategoryStrip` and `EditorialSplit` |
| Create | `tests/unit/reviews.test.tsx` | Unit tests for card, client, and `buildReviewsJsonLd` |

---

## Task 1: Data file, JSON-LD utility, and i18n keys

**Files:**
- Create: `data/reviews.ts`
- Modify: `messages/en.json`
- Modify: `messages/es.json`

> **Note:** The 7 review entries below use real Google review data provided by Santiago (May 2026). All are in English (`originalLang: "en"`). Spanish translations are provided. Before going live, update `REVIEWS_AGGREGATE.placeUrl` with the real Google profile URL.

- [ ] **Step 1: Write the failing test for `buildReviewsJsonLd`**

Create `tests/unit/reviews.test.tsx` with all imports upfront and the first describe block:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { buildReviewsJsonLd, type Review } from "@/data/reviews";

const mockAggregate = { rating: 4.9, total: 127, placeUrl: "https://g.page/r/test" } as const;

const mockReviews: Review[] = [
  {
    id: "jessica-morales-2026-04",
    author: "Jessica Morales",
    initials: "JM",
    rating: 5,
    occasion: "Boda",
    date: "2026-04",
    text: { en: "Amazing flowers for our wedding.", es: "Flores increíbles para nuestra boda." },
    originalLang: "es",
  },
  {
    id: "carmen-diaz-2026-03",
    author: "Carmen Díaz",
    initials: "CD",
    rating: 5,
    date: "2026-03",
    text: { en: "Best flowers in Long Island.", es: "Las mejores flores de Long Island." },
    originalLang: "en",
  },
];

describe("buildReviewsJsonLd", () => {
  it("returns valid JSON-LD with AggregateRating and Review entries", () => {
    const parsed = JSON.parse(buildReviewsJsonLd(mockReviews, mockAggregate, "Diva Flowers"));
    expect(parsed["@context"]).toBe("https://schema.org");
    expect(parsed["@type"]).toBe("LocalBusiness");
    expect(parsed.name).toBe("Diva Flowers");
    expect(parsed.aggregateRating["@type"]).toBe("AggregateRating");
    expect(parsed.aggregateRating.ratingValue).toBe(4.9);
    expect(parsed.aggregateRating.reviewCount).toBe(127);
    expect(parsed.review).toHaveLength(2);
    expect(parsed.review[0].author.name).toBe("Jessica Morales");
    expect(parsed.review[0].datePublished).toBe("2026-04");
    expect(parsed.review[0].reviewBody).toBe("Amazing flowers for our wedding.");
    expect(parsed.review[0].reviewRating.ratingValue).toBe(5);
    expect(parsed.review[0].reviewRating.bestRating).toBe(5);
  });
});
```

- [ ] **Step 2: Run test — expect it to fail**

```bash
pnpm vitest run tests/unit/reviews.test.tsx
```

Expected: `FAIL` — `Cannot find module '@/data/reviews'`

- [ ] **Step 3: Create `data/reviews.ts`**

```ts
// data/reviews.ts

export type Review = {
  id: string;
  author: string;
  initials: string;
  rating: 5;
  occasion?: string;
  date: string;                          // ISO YYYY-MM, absolute
  text: { en: string; es: string };
  originalLang: "en" | "es";
};

export const REVIEWS_AGGREGATE = {
  rating: 4.9,
  total: 127,
  placeUrl: "https://g.page/r/REPLACE_WITH_REAL_PLACE_URL",
} as const;

export function buildReviewsJsonLd(
  reviews: Review[],
  aggregate: typeof REVIEWS_AGGREGATE,
  brandName: string,
): string {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: brandName,
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: aggregate.rating,
      reviewCount: aggregate.total,
    },
    review: reviews.map((r) => ({
      "@type": "Review",
      author: { "@type": "Person", name: r.author },
      datePublished: r.date,
      reviewBody: r.text.en,
      reviewRating: { "@type": "Rating", ratingValue: r.rating, bestRating: 5 },
    })),
  });
}

export const REVIEWS: Review[] = [
  {
    id: "blanca-duarte-martini-2025-12",
    author: "Blanca Duarte Martini",
    initials: "BD",
    rating: 5,
    occasion: "Boda",
    date: "2025-12",
    text: {
      en: "Maky was available in the nick of time! I had ordered my daughter's bridal bouquet at a different place only to be disappointed when it looked like the bouquet was days old and looked terrible! She created a beautiful arrangement with different color flowers that complemented her dress. She was very knowledgeable about design and even created a corsage for the groom. You will be our preferred florist from now on!",
      es: "¡Maky estuvo disponible justo a tiempo! Había pedido el ramo de novia de mi hija en otro lugar y me decepcioné cuando llegó como si tuviera días y lucía terrible. Creó un arreglo hermoso con flores de diferentes colores que complementaban su vestido. Era muy experta en diseño e incluso creó una boutonnière para el novio. ¡Serás nuestra florista preferida de ahora en adelante!",
    },
    originalLang: "en",
  },
  {
    id: "jonathan-webb-2026-03",
    author: "Jonathan Webb",
    initials: "JW",
    rating: 5,
    occasion: "Cumpleaños",
    date: "2026-03",
    text: {
      en: "Maky makes the most creative and beautiful flower arrangements! My wife doesn't like to waste money on flowers, however every time I go there I leave it in the hands of Maky and she never disappoints! I highly recommend letting her do her thing! Thanks again for making my wife's 50th special!",
      es: "¡Maky hace los arreglos florales más creativos y hermosos! A mi esposa no le gusta gastar en flores, pero cada vez que voy dejo todo en manos de Maky y nunca decepciona. ¡Recomiendo ampliamente dejarla hacer su magia! ¡Gracias por hacer especial el 50 cumpleaños de mi esposa!",
    },
    originalLang: "en",
  },
  {
    id: "linda-arellano-2026-01",
    author: "Linda Arellano",
    initials: "LA",
    rating: 5,
    date: "2026-01",
    text: {
      en: "The best flower shop in town. Maky provides excellent customer service, shares her amazing ideas if you're clueless of what you're looking for, delivery is always on time. Maky does the most beautiful flower arrangements for gifts or any special occasion. Maky & her team always give the best to make clients happy ♥️",
      es: "La mejor florería de la ciudad. Maky brinda un excelente servicio al cliente, comparte sus increíbles ideas cuando no sabes qué buscar, la entrega siempre llega puntual. Maky hace los arreglos florales más hermosos para regalos o cualquier ocasión especial. Maky y su equipo siempre dan lo mejor para hacer felices a sus clientes ♥️",
    },
    originalLang: "en",
  },
  {
    id: "samantha-brown-2026-03",
    author: "Samantha Brown",
    initials: "SB",
    rating: 5,
    occasion: "Boda",
    date: "2026-03",
    text: {
      en: "Maky was amazing! She made my wedding day look so beautiful. Everything I was imagining she made possible. The flowers and decorations looked amazing. She is a professional and always comes prepared. Her and her team worked seamlessly and so fast! Thank you Maky and the Diva Florist team.",
      es: "¡Maky fue increíble! Hizo que mi día de boda luciera tan hermoso. Todo lo que imaginaba, ella lo hizo posible. Las flores y decoraciones quedaron espectaculares. Es muy profesional y siempre viene preparada. Ella y su equipo trabajaron de forma impecable y muy rápida. ¡Gracias Maky y al equipo de Diva Florist!",
    },
    originalLang: "en",
  },
  {
    id: "charlotte-silagyi-2025-05",
    author: "Charlotte Silagyi",
    initials: "CS",
    rating: 5,
    date: "2025-05",
    text: {
      en: "The most beautiful flowers I have ever received has been from Diva's! Everyone is so friendly and kind! They make ordering flowers so easy. You can tell with every bouquet I have received from them they put hard work and all their love into it. Thank you Diva!",
      es: "¡Las flores más hermosas que he recibido han sido de Diva! ¡Todos son muy amables y atentos! Hacen que ordenar flores sea muy fácil. Con cada ramo se nota que ponen mucho trabajo y amor. ¡Gracias Diva!",
    },
    originalLang: "en",
  },
  {
    id: "rosa-cirrincione-2025-05",
    author: "Rosa Cirrincione",
    initials: "RC",
    rating: 5,
    date: "2025-05",
    text: {
      en: "I've been a long time client of Diva Florist and I would highly recommend this business for all your floral needs. Maky the floral designer is extremely creative, kind and reliable. I have referred Diva Florist to all of my family and friends because I know that the flowers and designs are top quality. Thank you Diva Florist!",
      es: "Soy cliente de Diva Florist desde hace mucho tiempo y los recomendaría ampliamente para todas tus necesidades florales. Maky, la diseñadora floral, es extremadamente creativa, amable y confiable. He referido a Diva Florist a toda mi familia y amigos porque sé que las flores y los diseños son de primera calidad. ¡Gracias Diva Florist!",
    },
    originalLang: "en",
  },
  {
    id: "suedeh-ranjbar-2025-06",
    author: "Suedeh Ranjbar",
    initials: "SR",
    rating: 5,
    date: "2025-06",
    text: {
      en: "This is the best flower shop I've ever been to. Not only are their flowers fresh and beautiful, but the way they arrange and wrap them is unlike any other flower shop. Their prices are reasonable and everyone who works here is extremely kind. Do yourself a favor and COME HERE FOR ALL YOUR OCCASIONS! TRUST ME!",
      es: "Esta es la mejor florería a la que he ido. No solo sus flores son frescas y hermosas, sino que la forma en que las arreglan y envuelven es diferente a cualquier otra. Sus precios son razonables y todos son extremadamente amables. ¡Hazte un favor y VEN AQUÍ PARA TODAS TUS OCASIONES! ¡CONFÍA EN MÍ!",
    },
    originalLang: "en",
  },
];
```

- [ ] **Step 4: Run test — expect it to pass**

```bash
pnpm vitest run tests/unit/reviews.test.tsx
```

Expected: `PASS` — 1 test passing.

- [ ] **Step 5: Add i18n keys to `messages/en.json`**

Inside the `"home"` object, add the `"reviews"` key after `"editorial_split"`:

```json
"reviews": {
  "eyebrow": "★ Google Reviews",
  "verified": "Verified",
  "read_all": "Read all {count} reviews on Google",
  "translated": "Translated · view original",
  "original": "Showing original",
  "aria": {
    "section": "Customer reviews",
    "next": "Next review",
    "prev": "Previous review",
    "play": "Resume autoplay",
    "pause": "Pause autoplay",
    "goto": "Go to review {n}"
  }
}
```

- [ ] **Step 6: Add i18n keys to `messages/es.json`**

Inside the `"home"` object, add after `"editorial_split"`:

```json
"reviews": {
  "eyebrow": "★ Reseñas en Google",
  "verified": "Verificadas",
  "read_all": "Leer todas las {count} reseñas en Google",
  "translated": "Traducida · ver original",
  "original": "Mostrando original",
  "aria": {
    "section": "Reseñas de clientes",
    "next": "Siguiente reseña",
    "prev": "Anterior reseña",
    "play": "Reanudar reproducción",
    "pause": "Pausar reproducción",
    "goto": "Ir a la reseña {n}"
  }
}
```

- [ ] **Step 7: Commit**

```bash
git add data/reviews.ts messages/en.json messages/es.json tests/unit/reviews.test.tsx
git commit -m "feat(reviews): add data model, JSON-LD utility, and i18n keys"
```

---

## Task 2: `GoogleReviewsCard` — presentational component

**Files:**
- Create: `components/home/GoogleReviewsCard.tsx`
- Modify: `tests/unit/reviews.test.tsx` (add card tests)

- [ ] **Step 1: Add card tests to `tests/unit/reviews.test.tsx`**

Append this block after the `buildReviewsJsonLd` describe (no new imports needed — all imports are already at the top of the file from Task 1):

```tsx
import { GoogleReviewsCard } from "@/components/home/GoogleReviewsCard";

const baseCardProps = {
  author: "Jessica Morales",
  initials: "JM",
  displayText: "Amazing flowers for our wedding.",
  date: "2026-04",
  locale: "en" as const,
  occasion: "Boda",
  showTranslateChip: false,
  showingOriginal: false,
  translateLabel: "Translated · view original",
  originalLabel: "Showing original",
  onToggleTranslate: vi.fn(),
  onPrev: vi.fn(),
  onNext: vi.fn(),
  prevLabel: "Previous review",
  nextLabel: "Next review",
};

describe("GoogleReviewsCard", () => {
  it("renders the display text", () => {
    render(<GoogleReviewsCard {...baseCardProps} />);
    expect(screen.getByText("Amazing flowers for our wedding.")).toBeInTheDocument();
  });

  it("renders the author name", () => {
    render(<GoogleReviewsCard {...baseCardProps} />);
    expect(screen.getByText("Jessica Morales")).toBeInTheDocument();
  });

  it("renders formatted date and occasion", () => {
    render(<GoogleReviewsCard {...baseCardProps} />);
    expect(screen.getByText(/April 2026.*Boda/)).toBeInTheDocument();
  });

  it("does not render translate chip when showTranslateChip is false", () => {
    render(<GoogleReviewsCard {...baseCardProps} showTranslateChip={false} />);
    expect(screen.queryByText("Translated · view original")).not.toBeInTheDocument();
  });

  it("renders translate chip when showTranslateChip is true", () => {
    render(<GoogleReviewsCard {...baseCardProps} showTranslateChip={true} />);
    expect(screen.getByText("Translated · view original")).toBeInTheDocument();
  });

  it("shows originalLabel when showingOriginal is true", () => {
    render(<GoogleReviewsCard {...baseCardProps} showTranslateChip={true} showingOriginal={true} />);
    expect(screen.getByText("Showing original")).toBeInTheDocument();
    expect(screen.queryByText("Translated · view original")).not.toBeInTheDocument();
  });

  it("calls onToggleTranslate when translate chip is clicked", async () => {
    const user = userEvent.setup();
    const onToggleTranslate = vi.fn();
    render(<GoogleReviewsCard {...baseCardProps} showTranslateChip={true} onToggleTranslate={onToggleTranslate} />);
    await user.click(screen.getByText("Translated · view original"));
    expect(onToggleTranslate).toHaveBeenCalledTimes(1);
  });

  it("calls onNext when next arrow is clicked", async () => {
    const user = userEvent.setup();
    const onNext = vi.fn();
    render(<GoogleReviewsCard {...baseCardProps} onNext={onNext} />);
    await user.click(screen.getByRole("button", { name: "Next review" }));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it("calls onPrev when prev arrow is clicked", async () => {
    const user = userEvent.setup();
    const onPrev = vi.fn();
    render(<GoogleReviewsCard {...baseCardProps} onPrev={onPrev} />);
    await user.click(screen.getByRole("button", { name: "Previous review" }));
    expect(onPrev).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run tests — expect them to fail**

```bash
pnpm vitest run tests/unit/reviews.test.tsx
```

Expected: `FAIL` — `Cannot find module '@/components/home/GoogleReviewsCard'`

- [ ] **Step 3: Create `components/home/GoogleReviewsCard.tsx`**

```tsx
// components/home/GoogleReviewsCard.tsx

type GoogleReviewsCardProps = {
  author: string;
  initials: string;
  displayText: string;
  date: string;           // YYYY-MM
  locale: "en" | "es";
  occasion?: string;
  showTranslateChip: boolean;
  showingOriginal: boolean;
  translateLabel: string;
  originalLabel: string;
  onToggleTranslate: () => void;
  onPrev: () => void;
  onNext: () => void;
  prevLabel: string;
  nextLabel: string;
};

function formatDate(dateStr: string, locale: "en" | "es"): string {
  const [year, month] = dateStr.split("-").map(Number);
  return new Intl.DateTimeFormat(locale === "es" ? "es-US" : "en-US", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1));
}

export function GoogleReviewsCard({
  author,
  initials,
  displayText,
  date,
  locale,
  occasion,
  showTranslateChip,
  showingOriginal,
  translateLabel,
  originalLabel,
  onToggleTranslate,
  onPrev,
  onNext,
  prevLabel,
  nextLabel,
}: GoogleReviewsCardProps) {
  const formattedDate = formatDate(date, locale);
  const meta = occasion ? `${formattedDate} · ${occasion}` : formattedDate;

  return (
    <>
      <p className="font-sans text-[32px] md:text-[44px] font-normal leading-[1.02] tracking-[-0.035em] max-w-[22ch] min-h-[6rem] md:min-h-[5rem]">
        {displayText}
      </p>

      <div className="flex items-center justify-between border-t border-mute-100 pt-5 mt-6">
        <div className="flex items-center gap-3">
          <div
            className="flex shrink-0 items-center justify-center w-9 h-9 rounded-full text-bone text-sm font-semibold select-none"
            style={{
              background:
                "linear-gradient(135deg, var(--color-petal), var(--color-rouge-glow))",
            }}
            aria-hidden="true"
          >
            {initials}
          </div>
          <div>
            <p className="text-[13px] font-semibold leading-tight">{author}</p>
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-mute-500 mt-0.5">
              {meta}
            </p>
            {showTranslateChip && (
              <button
                type="button"
                onClick={onToggleTranslate}
                className="font-mono text-[10px] uppercase tracking-[0.12em] text-mute-400 hover:text-ink transition-colors mt-1"
              >
                {showingOriginal ? originalLabel : translateLabel}
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            aria-label={prevLabel}
            onClick={onPrev}
            className="flex items-center justify-center w-9 h-9 rounded-full border border-mute-100 text-ink hover:border-mute-300 transition-colors"
          >
            ←
          </button>
          <button
            type="button"
            aria-label={nextLabel}
            onClick={onNext}
            className="flex items-center justify-center w-9 h-9 rounded-full bg-ink text-bone hover:bg-charcoal transition-colors"
          >
            →
          </button>
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 4: Run tests — expect them to pass**

```bash
pnpm vitest run tests/unit/reviews.test.tsx
```

Expected: `PASS` — 9 tests passing (1 JSON-LD + 8 card).

- [ ] **Step 5: Commit**

```bash
git add components/home/GoogleReviewsCard.tsx tests/unit/reviews.test.tsx
git commit -m "feat(reviews): add GoogleReviewsCard presentational component"
```

---

## Task 3: `GoogleReviewsClient` — rotation, navigation, translate toggle

**Files:**
- Create: `components/home/GoogleReviewsClient.tsx`
- Modify: `tests/unit/reviews.test.tsx` (add client tests)

- [ ] **Step 1: Add client tests to `tests/unit/reviews.test.tsx`**

Add these two module mocks and the import at the top of the file, after the existing imports:

```tsx
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("framer-motion", () => ({
  useReducedMotion: () => false,
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    article: ({ children, initial: _i, animate: _a, exit: _e, transition: _t, ...props }: any) => (
      <article {...props}>{children}</article>
    ),
    span: ({ children, initial: _i, animate: _a, transition: _t, style, ...props }: any) => (
      <span style={style} {...props}>{children}</span>
    ),
  },
}));

import { GoogleReviewsClient } from "@/components/home/GoogleReviewsClient";

const clientReviews: Review[] = [
  {
    id: "r1",
    author: "Alice B.",
    initials: "AB",
    rating: 5,
    occasion: "Boda",
    date: "2026-04",
    text: { en: "First review in English.", es: "Primera reseña en español." },
    originalLang: "en",
  },
  {
    id: "r2",
    author: "Carlos M.",
    initials: "CM",
    rating: 5,
    date: "2026-03",
    text: { en: "Second review in English.", es: "Segunda reseña en español." },
    originalLang: "es",
  },
  {
    id: "r3",
    author: "Diana P.",
    initials: "DP",
    rating: 5,
    date: "2026-02",
    text: { en: "Third review in English.", es: "Tercera reseña en español." },
    originalLang: "en",
  },
];

describe("GoogleReviewsClient", () => {
  it("renders the first review on mount", () => {
    render(
      <GoogleReviewsClient
        reviews={clientReviews}
        locale="en"
        autoplayMs={0}
      />,
    );
    expect(screen.getByText("First review in English.")).toBeInTheDocument();
  });

  it("advances to the next review when next arrow is clicked", async () => {
    const user = userEvent.setup();
    render(
      <GoogleReviewsClient
        reviews={clientReviews}
        locale="en"
        autoplayMs={0}
      />,
    );
    await user.click(screen.getByRole("button", { name: "aria.next" }));
    expect(screen.getByText("Second review in English.")).toBeInTheDocument();
  });

  it("wraps from last to first on next click", async () => {
    const user = userEvent.setup();
    render(
      <GoogleReviewsClient
        reviews={clientReviews}
        locale="en"
        autoplayMs={0}
      />,
    );
    // advance to last
    await user.click(screen.getByRole("button", { name: "aria.next" }));
    await user.click(screen.getByRole("button", { name: "aria.next" }));
    expect(screen.getByText("Third review in English.")).toBeInTheDocument();
    // wrap
    await user.click(screen.getByRole("button", { name: "aria.next" }));
    expect(screen.getByText("First review in English.")).toBeInTheDocument();
  });

  it("goes to previous review on prev click; wraps from first to last", async () => {
    const user = userEvent.setup();
    render(
      <GoogleReviewsClient
        reviews={clientReviews}
        locale="en"
        autoplayMs={0}
      />,
    );
    await user.click(screen.getByRole("button", { name: "aria.prev" }));
    expect(screen.getByText("Third review in English.")).toBeInTheDocument();
  });

  it("jumps to a review when a progress segment is clicked", async () => {
    const user = userEvent.setup();
    render(
      <GoogleReviewsClient
        reviews={clientReviews}
        locale="en"
        autoplayMs={0}
      />,
    );
    const segments = screen.getAllByRole("tab");
    await user.click(segments[2]);
    expect(screen.getByText("Third review in English.")).toBeInTheDocument();
  });

  it("shows translate chip when locale differs from originalLang", () => {
    render(
      <GoogleReviewsClient
        reviews={clientReviews}
        locale="en"
        autoplayMs={0}
      />,
    );
    // r1 has originalLang "en", locale is "en" — no chip
    expect(screen.queryByText("translated")).not.toBeInTheDocument();
  });

  it("shows translate chip for a review in a different original language", async () => {
    const user = userEvent.setup();
    render(
      <GoogleReviewsClient
        reviews={clientReviews}
        locale="en"
        autoplayMs={0}
      />,
    );
    // r2 has originalLang "es", locale is "en" — chip should appear
    await user.click(screen.getByRole("button", { name: "aria.next" }));
    expect(screen.getByText("translated")).toBeInTheDocument();
  });

  it("toggling translate chip shows original text; resets on slide change", async () => {
    const user = userEvent.setup();
    render(
      <GoogleReviewsClient
        reviews={clientReviews}
        locale="en"
        autoplayMs={0}
      />,
    );
    // go to r2 (originalLang "es", locale "en" → shows en text, chip visible)
    await user.click(screen.getByRole("button", { name: "aria.next" }));
    expect(screen.getByText("Second review in English.")).toBeInTheDocument();
    // click chip → show original (es)
    await user.click(screen.getByText("translated"));
    expect(screen.getByText("Segunda reseña en español.")).toBeInTheDocument();
    // navigate away and back → resets to translated
    await user.click(screen.getByRole("button", { name: "aria.next" }));
    await user.click(screen.getByRole("button", { name: "aria.prev" }));
    expect(screen.getByText("Second review in English.")).toBeInTheDocument();
  });

  it("advances review on ArrowRight keydown", () => {
    render(
      <GoogleReviewsClient
        reviews={clientReviews}
        locale="en"
        autoplayMs={0}
      />,
    );
    const container = document.querySelector("[data-reviews-client]")!;
    fireEvent.keyDown(container, { key: "ArrowRight" });
    expect(screen.getByText("Second review in English.")).toBeInTheDocument();
  });

  it("goes back on ArrowLeft keydown", () => {
    render(
      <GoogleReviewsClient
        reviews={clientReviews}
        locale="en"
        autoplayMs={0}
      />,
    );
    const container = document.querySelector("[data-reviews-client]")!;
    fireEvent.keyDown(container, { key: "ArrowLeft" });
    expect(screen.getByText("Third review in English.")).toBeInTheDocument();
  });

  it("autoplay advances review after interval", async () => {
    vi.useFakeTimers();
    render(
      <GoogleReviewsClient
        reviews={clientReviews}
        locale="en"
        autoplayMs={3000}
      />,
    );
    expect(screen.getByText("First review in English.")).toBeInTheDocument();
    vi.advanceTimersByTime(3000);
    expect(await screen.findByText("Second review in English.")).toBeInTheDocument();
    vi.useRealTimers();
  });

  it("active progress segment has aria-selected=true", () => {
    render(
      <GoogleReviewsClient
        reviews={clientReviews}
        locale="en"
        autoplayMs={0}
      />,
    );
    const tabs = screen.getAllByRole("tab");
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    expect(tabs[1]).toHaveAttribute("aria-selected", "false");
  });
});
```

- [ ] **Step 2: Run tests — expect them to fail**

```bash
pnpm vitest run tests/unit/reviews.test.tsx
```

Expected: `FAIL` — `Cannot find module '@/components/home/GoogleReviewsClient'`

- [ ] **Step 3: Create `components/home/GoogleReviewsClient.tsx`**

```tsx
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useReducedMotion, AnimatePresence, motion } from "framer-motion";
import { GoogleReviewsCard } from "./GoogleReviewsCard";
import type { Review } from "@/data/reviews";

type Props = {
  reviews: Review[];
  locale: "en" | "es";
  autoplayMs?: number;
};

export function GoogleReviewsClient({ reviews, locale, autoplayMs = 7_000 }: Props) {
  const t = useTranslations("home.reviews");
  const reduceMotion = useReducedMotion();

  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [showingOriginal, setShowingOriginal] = useState(false);
  const [inView, setInView] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setShowingOriginal(false);
  }, [activeIndex]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), {
      threshold: 0.1,
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const shouldAutoplay = !isPaused && inView && !reduceMotion && autoplayMs > 0;

  useEffect(() => {
    if (!shouldAutoplay) return;
    const id = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % reviews.length);
    }, autoplayMs);
    return () => clearInterval(id);
  }, [shouldAutoplay, autoplayMs, reviews.length]);

  const goNext = useCallback(
    () => setActiveIndex((prev) => (prev + 1) % reviews.length),
    [reviews.length],
  );
  const goPrev = useCallback(
    () => setActiveIndex((prev) => (prev - 1 + reviews.length) % reviews.length),
    [reviews.length],
  );
  const goTo = useCallback((i: number) => setActiveIndex(i), []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowRight") { e.preventDefault(); goNext(); }
      if (e.key === "ArrowLeft") { e.preventDefault(); goPrev(); }
      if (e.key === " ") { e.preventDefault(); setIsPaused((p) => !p); }
    },
    [goNext, goPrev],
  );

  const review = reviews[activeIndex];
  const localeText = review.text[locale];
  const originalText = review.text[review.originalLang];
  const displayText = showingOriginal ? originalText : localeText;
  const showTranslateChip = locale !== review.originalLang;

  return (
    <div
      ref={containerRef}
      data-reviews-client
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={() => setIsPaused(false)}
      onKeyDown={handleKeyDown}
    >
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {review.author}{review.occasion ? ` · ${review.occasion}` : ""}
      </div>

      <AnimatePresence mode="wait">
        <motion.article
          key={review.id}
          role="group"
          aria-roledescription="review"
          aria-current="true"
          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? false : { opacity: 0, y: -8 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        >
          <GoogleReviewsCard
            author={review.author}
            initials={review.initials}
            displayText={displayText}
            date={review.date}
            locale={locale}
            occasion={review.occasion}
            showTranslateChip={showTranslateChip}
            showingOriginal={showingOriginal}
            translateLabel={t("translated")}
            originalLabel={t("original")}
            onToggleTranslate={() => setShowingOriginal((s) => !s)}
            onPrev={goPrev}
            onNext={goNext}
            prevLabel={t("aria.prev")}
            nextLabel={t("aria.next")}
          />
        </motion.article>
      </AnimatePresence>

      <div className="flex gap-1.5 mt-6" role="tablist">
        {reviews.map((r, i) => (
          <button
            key={r.id}
            type="button"
            role="tab"
            aria-selected={i === activeIndex}
            aria-label={t("aria.goto", { n: i + 1 })}
            onClick={() => goTo(i)}
            className="relative h-[2px] flex-1 bg-mute-100 rounded-full overflow-hidden"
          >
            {i < activeIndex && (
              <span className="absolute inset-0 bg-ink rounded-full" />
            )}
            {i === activeIndex && (
              <motion.span
                key={`${r.id}-fill`}
                className="absolute inset-y-0 left-0 bg-ink rounded-full"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: isPaused || reduceMotion ? 0 : 1 }}
                transition={
                  isPaused || reduceMotion
                    ? { duration: 0 }
                    : { duration: autoplayMs / 1000, ease: "linear" }
                }
                style={{ transformOrigin: "left" }}
              />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests — expect them to pass**

```bash
pnpm vitest run tests/unit/reviews.test.tsx
```

Expected: `PASS` — all tests passing (1 JSON-LD + 8 card + 11 client).

- [ ] **Step 5: Commit**

```bash
git add components/home/GoogleReviewsClient.tsx tests/unit/reviews.test.tsx
git commit -m "feat(reviews): add GoogleReviewsClient with rotation, navigation, and translate toggle"
```

---

## Task 4: `GoogleReviews` server component

**Files:**
- Create: `components/home/GoogleReviews.tsx`

No unit test — this is pure glue code (wires server data + i18n → client). Verified visually in Task 5.

- [ ] **Step 1: Create `components/home/GoogleReviews.tsx`**

```tsx
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/types/locale";
import { REVIEWS, REVIEWS_AGGREGATE, buildReviewsJsonLd } from "@/data/reviews";
import { SITE } from "@/data/site";
import { GoogleReviewsClient } from "./GoogleReviewsClient";

export async function GoogleReviews({ locale }: { locale: Locale }) {
  const t = await getTranslations("home.reviews");

  const jsonLd = buildReviewsJsonLd(REVIEWS, REVIEWS_AGGREGATE, SITE.brand);

  return (
    <section className="py-24 md:py-32" aria-label={t("aria.section")}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd }}
      />

      <div className="max-w-[1400px] mx-auto px-6">
        <div className="rounded-[var(--radius-bento)] border border-mute-100 px-7 py-9 md:px-12 md:py-12">

          {/* HEADER ROW */}
          <div className="flex flex-wrap items-end justify-between gap-4 mb-10">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-mute-500">
                {t("eyebrow")}
              </p>
              <div className="flex items-baseline gap-3 mt-2">
                <span
                  className="font-display italic text-[54px] md:text-[72px] leading-none tracking-tighter"
                  style={{ fontVariationSettings: "'WONK' 1, 'SOFT' 70" }}
                >
                  {REVIEWS_AGGREGATE.rating}
                </span>
                <span
                  className="text-rouge text-xl tracking-widest"
                  aria-label={`Rated ${REVIEWS_AGGREGATE.rating} out of 5 stars`}
                  aria-hidden="false"
                >
                  ★★★★★
                </span>
                <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-mute-500">
                  /{REVIEWS_AGGREGATE.total}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-mute-100">
              <span
                className="w-3.5 h-3.5 rounded-full shrink-0 block"
                style={{
                  background:
                    "conic-gradient(from 0deg, #4285F4 0%, #EA4335 25%, #FBBC05 50%, #34A853 75%, #4285F4 100%)",
                }}
                aria-hidden="true"
              />
              <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-mute-600">
                {t("verified")}
              </span>
            </div>
          </div>

          {/* ROTATING QUOTE */}
          <GoogleReviewsClient
            reviews={REVIEWS}
            locale={locale}
          />

          {/* OUTBOUND CTA */}
          <div className="mt-8 pt-6 border-t border-mute-100">
            <a
              href={REVIEWS_AGGREGATE.placeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-[11px] uppercase tracking-[0.18em] text-mute-500 hover:text-ink transition-colors"
            >
              → {t("read_all", { count: REVIEWS_AGGREGATE.total })}
            </a>
          </div>

        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/home/GoogleReviews.tsx
git commit -m "feat(reviews): add GoogleReviews server component with JSON-LD and header"
```

---

## Task 5: Wire into home page and verify

**Files:**
- Modify: `app/[locale]/page.tsx`

- [ ] **Step 1: Add `GoogleReviews` import and slot it into the home page**

Open `app/[locale]/page.tsx`. The current file looks like:

```tsx
import { setRequestLocale, getTranslations } from "next-intl/server";
import type { Locale } from "@/types/locale";
import { Grain } from "@/components/brand/Grain";
import { Hero } from "@/components/home/Hero";
import { KineticMarquee } from "@/components/brand/KineticMarquee";
import { BentoGrid } from "@/components/home/BentoGrid";
import { CategoryStrip } from "@/components/home/CategoryStrip";
import { EditorialSplit } from "@/components/home/EditorialSplit";
import { WeddingsTeaser } from "@/components/home/WeddingsTeaser";
import { NewsletterField } from "@/components/home/NewsletterField";

export default async function Home({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("home");

  return (
    <main className="bg-bone text-ink">
      <Grain />
      <Hero locale={locale} />
      <KineticMarquee text={`${t("marquee")}  ·  `} />
      <BentoGrid locale={locale} />
      <CategoryStrip locale={locale} />
      <EditorialSplit locale={locale} />
      <WeddingsTeaser locale={locale} />
      <NewsletterField />
    </main>
  );
}
```

Replace with:

```tsx
import { setRequestLocale, getTranslations } from "next-intl/server";
import type { Locale } from "@/types/locale";
import { Grain } from "@/components/brand/Grain";
import { Hero } from "@/components/home/Hero";
import { KineticMarquee } from "@/components/brand/KineticMarquee";
import { BentoGrid } from "@/components/home/BentoGrid";
import { CategoryStrip } from "@/components/home/CategoryStrip";
import { GoogleReviews } from "@/components/home/GoogleReviews";
import { EditorialSplit } from "@/components/home/EditorialSplit";
import { WeddingsTeaser } from "@/components/home/WeddingsTeaser";
import { NewsletterField } from "@/components/home/NewsletterField";

export default async function Home({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("home");

  return (
    <main className="bg-bone text-ink">
      <Grain />
      <Hero locale={locale} />
      <KineticMarquee text={`${t("marquee")}  ·  `} />
      <BentoGrid locale={locale} />
      <CategoryStrip locale={locale} />
      <GoogleReviews locale={locale} />
      <EditorialSplit locale={locale} />
      <WeddingsTeaser locale={locale} />
      <NewsletterField />
    </main>
  );
}
```

- [ ] **Step 2: Start dev server and verify visually**

```bash
pnpm dev
```

Open `http://localhost:3000/en` and `http://localhost:3000/es`.

Check:
- Reviews section appears between the category strip and the editorial section.
- Rating `4.9 ★★★★★ /127` visible with large Playfair italic display.
- Verified Google chip visible top-right.
- First review quote visible in Inter sans-serif.
- Autoplay advances every 7 seconds; progress bar fills left-to-right.
- Hover pauses autoplay; progress bar freezes.
- `→` and `←` arrows navigate manually.
- Clicking a progress segment jumps to that review.
- On `es` locale: reviews that have `originalLang: "en"` (most of them) show a "Traducida · ver original" chip; clicking it shows the Spanish original.
- CTA "Leer todas las 127 reseñas en Google" at the bottom links to `REVIEWS_AGGREGATE.placeUrl` (currently a placeholder — update the URL in `data/reviews.ts` with the real Google profile link Santiago provides).
- JSON-LD: open DevTools → Network → reload → inspect the page HTML; find `<script type="application/ld+json">` and verify it contains `AggregateRating` and `"review"` array.
- Mobile (`375px`): section is readable, header stacks properly, quote font scales down, no overflow.

- [ ] **Step 3: Run full test suite**

```bash
pnpm vitest run
```

Expected: all existing tests still pass + new reviews tests pass.

- [ ] **Step 4: Final commit**

```bash
git add app/\[locale\]/page.tsx
git commit -m "feat(reviews): wire GoogleReviews into home between CategoryStrip and EditorialSplit"
```

---

## Post-launch checklist

Before going live, complete these data updates in `data/reviews.ts`:

1. **Update `REVIEWS_AGGREGATE.placeUrl`** — replace `"https://g.page/r/REPLACE_WITH_REAL_PLACE_URL"` with the actual Google profile link. Find it by opening your Google Business Profile → "Share review form" → copy the URL.
2. **Confirm `REVIEWS_AGGREGATE.total` and `rating`** — verify the current count and average on your Google profile and update if they differ from `127` / `4.9`.

The 7 review entries in `REVIEWS` are already populated with real review data from Google. No content changes needed.

These are data changes only — no component code changes needed.
