# Plan 1 — Foundation & Brand System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a working bilingual (EN/ES) Diva Flowers home page with the full brand system, motion primitives, and i18n routing wired up. After this plan, the home page renders end-to-end at production quality with hero arch SVG draw-on-load, kinetic marquee, Bento grid with perpetual micro-interactions, magnetic CTAs, and reduced-motion handling.

**Architecture:** Next.js 15 App Router + React Server Components by default. Tailwind v4 with token CSS variables. `next-intl` for locale routing under `/[locale]`. All interactive/animated components are isolated, memoized `'use client'` leaves; the home page itself is a Server Component composing them. Strict adherence to taste-skill rules: no Inter, no `h-screen`, transform/opacity-only animations, single accent color, no AI-purple.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind v4, `@tailwindcss/postcss`, Framer Motion, `next-intl`, Zustand (scaffolded for Plan 3), `react-hook-form` + `zod` (scaffolded for Plan 4), `@phosphor-icons/react`, Fraunces (Google Fonts, free), Cabinet Grotesk (Fontshare, free), JetBrains Mono (Google Fonts, free), Vitest, Playwright, shadcn/ui (customized).

**Spec reference:** `docs/superpowers/specs/2026-04-30-diva-flowers-design.md`

**Font note:** Spec calls for PP Editorial New / Migra (paid). v1 uses **Fraunces** with custom axes (`opsz`, `SOFT`, `WONK`) as a free, editorial-grade alternative. Swap to a paid font is a single `next/font/local` change in §Task 3.

---

## File Structure (created in this plan)

```
diva-flowers/
├── app/
│   ├── layout.tsx                         # html, fonts, grain overlay, RootProviders
│   ├── globals.css                        # Tailwind v4 directives, base resets
│   ├── [locale]/
│   │   ├── layout.tsx                     # locale provider, TopNav, Footer
│   │   └── page.tsx                       # Home — Server Component composing the leaves
│   └── not-found.tsx
├── components/
│   ├── brand/
│   │   ├── Wordmark.tsx
│   │   ├── ArchSVG.tsx                    # draws itself on load
│   │   ├── Grain.tsx
│   │   └── KineticMarquee.tsx             # 'use client', reverses on scroll
│   ├── nav/
│   │   ├── TopNav.tsx                     # 'use client', condenses on scroll
│   │   ├── LocaleSwitcher.tsx             # 'use client', text-scramble morph
│   │   ├── CartButton.tsx                 # stub for Plan 3
│   │   └── Footer.tsx
│   ├── motion/
│   │   ├── MagneticButton.tsx             # 'use client', memoized
│   │   ├── BloomImage.tsx                 # 'use client'
│   │   ├── StaggerGroup.tsx               # 'use client'
│   │   └── SpotlightField.tsx             # 'use client', cursor-following gradient
│   ├── home/
│   │   ├── Hero.tsx                       # Server Component frame + client leaves
│   │   ├── BentoGrid.tsx                  # composes 4 tiles
│   │   ├── BentoFeaturedTile.tsx          # 'use client', perpetual rotate
│   │   ├── BentoSubscriptionsTile.tsx     # 'use client', shimmering CTA chip
│   │   ├── BentoLiveStatusTile.tsx        # 'use client', breathing dot + popup
│   │   ├── BentoPressTile.tsx             # 'use client', infinite carousel
│   │   ├── CategoryStrip.tsx              # 'use client' for snap-scroll
│   │   ├── EditorialSplit.tsx
│   │   ├── WeddingsTeaser.tsx
│   │   └── NewsletterField.tsx            # 'use client', success morph
│   └── ui/
│       └── (shadcn primitives — added per task as needed)
├── data/
│   └── site.ts                            # address, phone, hours, zones, social, taglines
├── lib/
│   ├── motion-config.ts                   # spring presets, useReducedMotionGate hook
│   ├── format.ts                          # money, phone, date helpers
│   └── cn.ts                              # tailwind class merge
├── messages/
│   ├── en.json
│   └── es.json
├── public/
│   ├── grain.png                          # generated, ~512x512, ~4% noise
│   └── fonts/
│       └── CabinetGrotesk/                # 4 weights from Fontshare
├── styles/
│   └── tokens.css                         # CSS vars: colors, radii, shadows, easings
├── tests/
│   ├── unit/
│   │   ├── motion-config.test.ts
│   │   ├── format.test.ts
│   │   └── cart-store.test.ts             # scaffolded for Plan 3
│   └── e2e/
│       ├── home.spec.ts
│       └── locale.spec.ts
├── types/
│   └── locale.ts
├── i18n.ts
├── middleware.ts                          # locale routing
├── next.config.mjs
├── tailwind.config.ts
├── postcss.config.mjs
├── tsconfig.json
├── vitest.config.ts
├── playwright.config.ts
├── package.json
├── .env.local.example
├── .gitignore
└── README.md
```

---

## Task 1: Initialize Next.js project

**Files:**
- Create: entire repo skeleton

- [ ] **Step 1: Run create-next-app**

```bash
cd "/Users/santiagocardonacastellanos/Desktop/Diva Flowers"
npx create-next-app@latest . --typescript --tailwind --app --turbopack --import-alias "@/*" --no-eslint --no-src-dir --use-npm --yes
```

Accept defaults if any prompt remains. The `.` installs into the current (empty besides `docs/`) directory.

- [ ] **Step 2: Verify dev server boots**

```bash
npm run dev
```

Expected: server starts at `http://localhost:3000`, default Next page renders. Stop the server with Ctrl-C.

- [ ] **Step 3: Add baseline `.gitignore` entries**

Append to `.gitignore`:

```
# Diva Flowers
.env.local
pending-inquiries.json
.DS_Store
playwright-report/
test-results/
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: initialize next.js 15 app router project"
```

---

## Task 2: Tailwind v4 config + design tokens

**Files:**
- Modify: `app/globals.css`
- Create: `styles/tokens.css`
- Modify: `postcss.config.mjs`
- Modify: `tailwind.config.ts` (or remove — Tailwind v4 is config-less by default)
- Create: `lib/cn.ts`

- [ ] **Step 1: Verify Tailwind v4 is installed**

```bash
npm ls tailwindcss
```

Expected: `tailwindcss@4.x.x`. If `3.x`, run `npm install tailwindcss@latest @tailwindcss/postcss@latest` and re-verify.

- [ ] **Step 2: Configure PostCSS for Tailwind v4**

Replace `postcss.config.mjs` content:

```js
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
```

- [ ] **Step 3: Create design token CSS**

Create `styles/tokens.css`:

```css
:root {
  /* Color tokens — see spec §4.1 */
  --color-petal: #F2C2D0;
  --color-rouge: #B8345E;
  --color-rouge-glow: #D24E78;
  --color-ink: #0E0D0C;
  --color-bone: #FAF6F0;
  --color-charcoal: #1A1816;
  --color-lilac: #C9B6D6;

  --color-mute-100: #EDE8E0;
  --color-mute-200: #DCD5C9;
  --color-mute-300: #BAB1A2;
  --color-mute-400: #968D7E;
  --color-mute-500: #6F685B;
  --color-mute-600: #4A453B;
  --color-mute-700: #2E2B25;

  --color-success: #1F6E3D;
  --color-warn: #A75A1F;
  --color-error: #8B1F1F;

  /* Radii */
  --radius-chip: 9999px;
  --radius-product: 1rem;
  --radius-bento: 2rem;
  --radius-arch-top: 10rem;

  /* Shadows */
  --shadow-diffusion: 0 30px 80px -40px rgb(14 13 12 / 0.18);
  --shadow-tile-rest: 0 1px 0 rgb(14 13 12 / 0.04), 0 12px 30px -20px rgb(14 13 12 / 0.06);

  /* Easings */
  --ease-elegant: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-overshoot: cubic-bezier(0.34, 1.56, 0.64, 1);

  /* Typography */
  --font-display: "Fraunces", "Times New Roman", serif;
  --font-sans: "Cabinet Grotesk", "Helvetica Neue", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", "SFMono-Regular", monospace;

  /* Layout */
  --container-max: 1400px;
}

@media (prefers-color-scheme: dark) {
  :root {
    /* keep light palette as default; dark mode handled per-component when needed */
  }
}
```

- [ ] **Step 4: Wire tokens + Tailwind v4 theme into `globals.css`**

Replace `app/globals.css` content:

```css
@import "tailwindcss";
@import "../styles/tokens.css";

@theme inline {
  --color-petal: var(--color-petal);
  --color-rouge: var(--color-rouge);
  --color-rouge-glow: var(--color-rouge-glow);
  --color-ink: var(--color-ink);
  --color-bone: var(--color-bone);
  --color-charcoal: var(--color-charcoal);
  --color-lilac: var(--color-lilac);
  --color-mute-100: var(--color-mute-100);
  --color-mute-200: var(--color-mute-200);
  --color-mute-300: var(--color-mute-300);
  --color-mute-400: var(--color-mute-400);
  --color-mute-500: var(--color-mute-500);
  --color-mute-600: var(--color-mute-600);
  --color-mute-700: var(--color-mute-700);
  --color-success: var(--color-success);
  --color-warn: var(--color-warn);
  --color-error: var(--color-error);

  --radius-chip: var(--radius-chip);
  --radius-product: var(--radius-product);
  --radius-bento: var(--radius-bento);
  --radius-arch-top: var(--radius-arch-top);

  --font-display: var(--font-display);
  --font-sans: var(--font-sans);
  --font-mono: var(--font-mono);
}

html, body {
  background: var(--color-bone);
  color: var(--color-ink);
  font-family: var(--font-sans);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}

::selection {
  background: var(--color-rouge);
  color: var(--color-bone);
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
    scroll-behavior: auto !important;
  }
}
```

- [ ] **Step 5: Remove the legacy `tailwind.config.ts` if present**

Tailwind v4 reads `@theme` directly from CSS. If `tailwind.config.ts` was created by `create-next-app`, leave it but trim it to:

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
};
export default config;
```

- [ ] **Step 6: Create `lib/cn.ts`**

```bash
npm install clsx tailwind-merge
```

Create `lib/cn.ts`:

```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 7: Smoke test the tokens by editing `app/page.tsx`**

Replace `app/page.tsx` content with a temporary token sanity check:

```tsx
export default function Home() {
  return (
    <main className="min-h-[100dvh] grid place-items-center bg-bone text-ink">
      <div className="space-y-6 text-center">
        <h1 style={{ fontFamily: "var(--font-display)" }} className="text-6xl tracking-tighter">
          Diva Flowers
        </h1>
        <div className="flex gap-3 justify-center">
          <span className="size-12 rounded-full bg-petal" />
          <span className="size-12 rounded-full bg-rouge" />
          <span className="size-12 rounded-full bg-ink" />
          <span className="size-12 rounded-full bg-lilac" />
          <span className="size-12 rounded-full bg-mute-400" />
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 8: Verify in browser**

```bash
npm run dev
```

Open `http://localhost:3000`. Expected:
- Background is warm bone (not pure white).
- Five color swatches show petal pink, deep rouge, ink black, lilac, mute slate.
- Headline reads "Diva Flowers" — currently in browser default serif (Fraunces will be loaded in Task 3).

Stop the server.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(brand): add design tokens, tailwind v4 theme, cn utility"
```

---

## Task 3: Fonts (Fraunces, Cabinet Grotesk, JetBrains Mono)

**Files:**
- Create: `public/fonts/CabinetGrotesk/*` (downloaded files)
- Modify: `app/layout.tsx`

- [ ] **Step 1: Download Cabinet Grotesk from Fontshare**

```bash
mkdir -p public/fonts/CabinetGrotesk
curl -L -o /tmp/cabinet.zip "https://api.fontshare.com/v2/fonts/download/cabinet-grotesk"
unzip -o /tmp/cabinet.zip -d /tmp/cabinet-extract
cp /tmp/cabinet-extract/Fonts/WEB/fonts/CabinetGrotesk-Regular.woff2 public/fonts/CabinetGrotesk/Regular.woff2
cp /tmp/cabinet-extract/Fonts/WEB/fonts/CabinetGrotesk-Medium.woff2 public/fonts/CabinetGrotesk/Medium.woff2
cp /tmp/cabinet-extract/Fonts/WEB/fonts/CabinetGrotesk-Bold.woff2 public/fonts/CabinetGrotesk/Bold.woff2
cp /tmp/cabinet-extract/Fonts/WEB/fonts/CabinetGrotesk-Extrabold.woff2 public/fonts/CabinetGrotesk/Extrabold.woff2
ls public/fonts/CabinetGrotesk/
```

Expected: 4 `.woff2` files. If the Fontshare URL structure has changed, manually download from `https://www.fontshare.com/fonts/cabinet-grotesk` and place the files at the same paths.

- [ ] **Step 2: Configure `next/font` in `app/layout.tsx`**

Replace `app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import { Fraunces, JetBrains_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  axes: ["SOFT", "WONK", "opsz"],
  display: "swap",
});

const cabinet = localFont({
  variable: "--font-sans",
  display: "swap",
  src: [
    { path: "../public/fonts/CabinetGrotesk/Regular.woff2", weight: "400", style: "normal" },
    { path: "../public/fonts/CabinetGrotesk/Medium.woff2", weight: "500", style: "normal" },
    { path: "../public/fonts/CabinetGrotesk/Bold.woff2", weight: "700", style: "normal" },
    { path: "../public/fonts/CabinetGrotesk/Extrabold.woff2", weight: "800", style: "normal" },
  ],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Diva Flowers — Romance, by the stem.",
  description: "Long Island floral studio. Signature arrangements, weddings, events.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${cabinet.variable} ${jetbrains.variable}`}>
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 3: Update `app/page.tsx` to confirm fonts load**

Edit the existing temporary page so the headline now uses the Tailwind utility:

```tsx
export default function Home() {
  return (
    <main className="min-h-[100dvh] grid place-items-center bg-bone text-ink">
      <div className="space-y-6 text-center">
        <h1 className="font-display text-6xl tracking-tighter">Diva Flowers</h1>
        <p className="font-sans text-base text-mute-500">Cabinet Grotesk, Fraunces, JetBrains Mono.</p>
        <p className="font-mono text-sm">516 484 3456</p>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Verify in browser**

```bash
npm run dev
```

Open `http://localhost:3000`. Expected:
- "Diva Flowers" renders in Fraunces (high-contrast serif, distinctive curls).
- Subtitle in Cabinet Grotesk.
- Phone number in JetBrains Mono.
- No FOIT / no Inter fallback.

Stop the server.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(brand): wire fraunces + cabinet grotesk + jetbrains mono"
```

---

## Task 4: i18n setup (next-intl)

**Files:**
- Create: `i18n.ts`
- Create: `middleware.ts`
- Create: `messages/en.json`
- Create: `messages/es.json`
- Create: `types/locale.ts`
- Modify: `next.config.mjs`

- [ ] **Step 1: Install next-intl**

```bash
npm install next-intl@latest
```

- [ ] **Step 2: Create `types/locale.ts`**

```ts
export const locales = ["en", "es"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";
```

- [ ] **Step 3: Create `i18n.ts` (request config)**

```ts
import { getRequestConfig } from "next-intl/server";
import { notFound } from "next/navigation";
import { locales, type Locale } from "./types/locale";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = (locales as readonly string[]).includes(requested ?? "")
    ? (requested as Locale)
    : null;
  if (!locale) notFound();

  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
  };
});
```

- [ ] **Step 4: Create `middleware.ts`**

```ts
import createMiddleware from "next-intl/middleware";
import { locales, defaultLocale } from "./types/locale";

export default createMiddleware({
  locales,
  defaultLocale,
  localePrefix: "always",
});

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
```

- [ ] **Step 5: Wire next-intl plugin in `next.config.mjs`**

Replace `next.config.mjs`:

```js
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "picsum.photos" },
    ],
  },
  experimental: {
    optimizePackageImports: ["@phosphor-icons/react", "framer-motion"],
  },
};

export default withNextIntl(nextConfig);
```

- [ ] **Step 6: Create `messages/en.json`**

```json
{
  "nav": {
    "shop": "Shop",
    "subscriptions": "Subscriptions",
    "weddings": "Weddings",
    "events": "Events",
    "story": "Story",
    "journal": "Journal",
    "contact": "Contact",
    "cart": "Bag",
    "search": "Search",
    "open_menu": "Open menu",
    "close_menu": "Close menu"
  },
  "categories": {
    "arrangements": "Arrangements",
    "bouquets": "Bouquets",
    "plants": "Plants & Orchids",
    "gifts": "Gifts",
    "sympathy": "Sympathy",
    "subscriptions": "Subscriptions"
  },
  "home": {
    "hero": {
      "eyebrow": "Long Island, New York",
      "title": "Romance, by the stem.",
      "sub": "Signature arrangements, hand-built daily under our hot-pink arch on Hempstead Turnpike.",
      "cta_primary": "Shop arrangements",
      "cta_secondary": "Plan a wedding"
    },
    "marquee": "DIVA FLOWERS · ROMANCE BY THE STEM · LONG ISLAND · DESDE 2014 · ENVÍOS HOY · SAME-DAY DELIVERY",
    "bento": {
      "featured_eyebrow": "Featured this week",
      "featured_cta": "Shop now",
      "subscriptions_title": "Weekly blooms, on rotation.",
      "subscriptions_body": "A new arrangement at your door every week. Pause anytime.",
      "subscriptions_cta": "Start a subscription",
      "live_status_label": "Delivering today",
      "live_status_zone": "Nassau & Queens",
      "live_status_cutoff": "Cutoff 2:00 PM",
      "press_eyebrow": "As seen in"
    },
    "categories_title": "Find your bloom.",
    "editorial_split": {
      "eyebrow": "Visit the studio",
      "title": "Built around our floral arch on Hempstead Turnpike.",
      "body": "We've been arranging flowers under the same pink awning since 2014. Walk in, call ahead, or order online — same-day delivery across Long Island and Queens."
    },
    "weddings_teaser": {
      "eyebrow": "Weddings",
      "title": "Installations, by Diva.",
      "cta": "Inquire"
    },
    "newsletter": {
      "eyebrow": "Stay in bloom",
      "title": "Letters from the studio.",
      "placeholder": "you@email.com",
      "cta": "Subscribe",
      "success": "Welcome aboard.",
      "error": "Something went wrong. Try again?"
    }
  },
  "footer": {
    "address_label": "Studio",
    "hours_label": "Hours",
    "phone_label": "Phone",
    "email_label": "Email",
    "social_label": "Follow",
    "rights": "All rights reserved.",
    "legal": {
      "privacy": "Privacy",
      "terms": "Terms"
    }
  },
  "a11y": {
    "skip_to_content": "Skip to content",
    "loading": "Loading"
  }
}
```

- [ ] **Step 7: Create `messages/es.json`**

```json
{
  "nav": {
    "shop": "Tienda",
    "subscriptions": "Suscripciones",
    "weddings": "Bodas",
    "events": "Eventos",
    "story": "Historia",
    "journal": "Editorial",
    "contact": "Contacto",
    "cart": "Bolsa",
    "search": "Buscar",
    "open_menu": "Abrir menú",
    "close_menu": "Cerrar menú"
  },
  "categories": {
    "arrangements": "Arreglos",
    "bouquets": "Ramos",
    "plants": "Plantas y Orquídeas",
    "gifts": "Regalos",
    "sympathy": "Condolencias",
    "subscriptions": "Suscripciones"
  },
  "home": {
    "hero": {
      "eyebrow": "Long Island, Nueva York",
      "title": "Romance, tallo a tallo.",
      "sub": "Arreglos firmados, hechos a mano cada día bajo nuestro arco rosa en Hempstead Turnpike.",
      "cta_primary": "Ver arreglos",
      "cta_secondary": "Planear una boda"
    },
    "marquee": "DIVA FLOWERS · ROMANCE BY THE STEM · LONG ISLAND · DESDE 2014 · ENVÍOS HOY · SAME-DAY DELIVERY",
    "bento": {
      "featured_eyebrow": "Lo destacado",
      "featured_cta": "Comprar",
      "subscriptions_title": "Flores semanales, en rotación.",
      "subscriptions_body": "Un arreglo nuevo en tu puerta cada semana. Pausa cuando quieras.",
      "subscriptions_cta": "Empezar suscripción",
      "live_status_label": "Entregando hoy",
      "live_status_zone": "Nassau y Queens",
      "live_status_cutoff": "Cierre 2:00 PM",
      "press_eyebrow": "En prensa"
    },
    "categories_title": "Encuentra tu flor.",
    "editorial_split": {
      "eyebrow": "Visita el estudio",
      "title": "Construido alrededor de nuestro arco floral en Hempstead Turnpike.",
      "body": "Arreglamos flores bajo el mismo toldo rosa desde 2014. Entra, llama o pide en línea — entrega el mismo día en Long Island y Queens."
    },
    "weddings_teaser": {
      "eyebrow": "Bodas",
      "title": "Instalaciones, por Diva.",
      "cta": "Cotizar"
    },
    "newsletter": {
      "eyebrow": "Mantente en flor",
      "title": "Cartas del estudio.",
      "placeholder": "tu@correo.com",
      "cta": "Suscribirme",
      "success": "Bienvenido a bordo.",
      "error": "Algo salió mal. ¿Intentar de nuevo?"
    }
  },
  "footer": {
    "address_label": "Estudio",
    "hours_label": "Horario",
    "phone_label": "Teléfono",
    "email_label": "Correo",
    "social_label": "Síguenos",
    "rights": "Todos los derechos reservados.",
    "legal": {
      "privacy": "Privacidad",
      "terms": "Términos"
    }
  },
  "a11y": {
    "skip_to_content": "Saltar al contenido",
    "loading": "Cargando"
  }
}
```

- [ ] **Step 8: Move home page under `[locale]`**

```bash
mkdir -p "app/[locale]"
mv app/page.tsx "app/[locale]/page.tsx"
```

- [ ] **Step 9: Create `app/[locale]/layout.tsx`**

```tsx
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { locales, type Locale } from "@/types/locale";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(locales, locale)) notFound();
  setRequestLocale(locale as Locale);

  return <NextIntlClientProvider locale={locale}>{children}</NextIntlClientProvider>;
}
```

- [ ] **Step 10: Update `app/[locale]/page.tsx` to read messages**

```tsx
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/types/locale";

export default async function Home({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("home.hero");

  return (
    <main className="min-h-[100dvh] grid place-items-center bg-bone text-ink px-6">
      <div className="space-y-6 text-center max-w-2xl">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-mute-500">{t("eyebrow")}</p>
        <h1 className="font-display text-6xl md:text-8xl tracking-tighter leading-none">{t("title")}</h1>
        <p className="text-mute-600">{t("sub")}</p>
      </div>
    </main>
  );
}
```

- [ ] **Step 11: Verify both locales work**

```bash
npm run dev
```

Open `http://localhost:3000` — should redirect to `http://localhost:3000/en` and render the EN hero. Then open `http://localhost:3000/es` — renders the ES hero ("Romance, tallo a tallo."). Stop the server.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "feat(i18n): set up next-intl with en/es locale routing and messages"
```

---

## Task 5: Site data file

**Files:**
- Create: `data/site.ts`

- [ ] **Step 1: Create `data/site.ts`**

```ts
export const SITE = {
  brand: "Diva Flowers",
  founded: 2014,
  phone: "+1 (516) 484-3456",
  phoneDisplay: "516 484 3456",
  phoneHref: "tel:+15164843456",
  email: "studio@divaflowers.com",
  emailHref: "mailto:studio@divaflowers.com",
  address: {
    line1: "1077 Hempstead Turnpike",
    locality: "Franklin Square",
    region: "NY",
    postal: "11010",
    country: "USA",
  },
  hours: [
    { day: "Mon–Fri", value: "9:00 AM – 7:00 PM" },
    { day: "Sat", value: "9:00 AM – 6:00 PM" },
    { day: "Sun", value: "10:00 AM – 4:00 PM" },
  ],
  deliveryZones: ["Nassau County", "Queens", "Brooklyn (select zip codes)", "Western Suffolk"],
  cutoffTime: "2:00 PM",
  social: [
    { label: "Instagram", href: "https://instagram.com/divaflowersli" },
    { label: "TikTok", href: "https://tiktok.com/@divaflowers" },
  ],
  recentDeliveries: [
    { city: "Garden City", time: "8 min ago" },
    { city: "Brentwood", time: "22 min ago" },
    { city: "Forest Hills", time: "41 min ago" },
    { city: "Mineola", time: "1 hr ago" },
    { city: "Bayside", time: "2 hr ago" },
  ],
  press: ["The Cut", "Vogue", "Brides", "New York Magazine", "Town & Country", "Refinery29"],
} as const;

export type SiteData = typeof SITE;
```

> Address note: `1077 Hempstead Turnpike, Franklin Square, NY 11010` is a working placeholder consistent with the photo. Replace once the client confirms (spec §13).

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat(data): add site data (address, phone, hours, social, recent deliveries)"
```

---

## Task 6: Format helpers + reduced-motion gate (with tests)

**Files:**
- Create: `lib/format.ts`
- Create: `lib/motion-config.ts`
- Create: `tests/unit/format.test.ts`
- Create: `tests/unit/motion-config.test.ts`
- Create: `vitest.config.ts`
- Modify: `package.json` (add `test` script)

- [ ] **Step 1: Install Vitest**

```bash
npm install -D vitest @vitest/ui jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

- [ ] **Step 2: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/unit/**/*.test.ts", "tests/unit/**/*.test.tsx"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
});
```

- [ ] **Step 3: Create `tests/setup.ts`**

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 4: Add `test` script to `package.json`**

In `package.json`, in the `scripts` block, add:

```json
"test": "vitest run",
"test:watch": "vitest",
"test:ui": "vitest --ui"
```

- [ ] **Step 5: Write the failing test for `formatMoneyCents`**

Create `tests/unit/format.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { formatMoneyCents, formatPhoneUS, formatDeliveryWindow } from "@/lib/format";

describe("formatMoneyCents", () => {
  it("formats USD with no decimals when whole dollars", () => {
    expect(formatMoneyCents(18700, "en")).toBe("$187");
  });
  it("formats USD with cents when not whole", () => {
    expect(formatMoneyCents(18750, "en")).toBe("$187.50");
  });
  it("uses Spanish locale formatting", () => {
    expect(formatMoneyCents(18700, "es")).toBe("US$187");
  });
});

describe("formatPhoneUS", () => {
  it("formats a 10-digit string", () => {
    expect(formatPhoneUS("5164843456")).toBe("(516) 484-3456");
  });
  it("returns input unchanged if not 10 digits", () => {
    expect(formatPhoneUS("123")).toBe("123");
  });
});

describe("formatDeliveryWindow", () => {
  it("formats morning slot in EN", () => {
    expect(formatDeliveryWindow({ date: "2026-05-12", slot: "morning" }, "en"))
      .toMatch(/May 12.+9:00 AM.+12:00 PM/);
  });
  it("formats midday slot in ES", () => {
    expect(formatDeliveryWindow({ date: "2026-05-12", slot: "midday" }, "es"))
      .toMatch(/12 de may/);
  });
});
```

- [ ] **Step 6: Run failing test**

```bash
npm test
```

Expected: tests fail because `lib/format.ts` does not yet exist.

- [ ] **Step 7: Implement `lib/format.ts`**

```ts
import type { Locale } from "@/types/locale";

export function formatMoneyCents(cents: number, locale: Locale): string {
  const value = cents / 100;
  const isWhole = cents % 100 === 0;
  const fmt = new Intl.NumberFormat(locale === "es" ? "es-US" : "en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: isWhole ? 0 : 2,
    maximumFractionDigits: isWhole ? 0 : 2,
  });
  return fmt.format(value);
}

export function formatPhoneUS(digits: string): string {
  const d = digits.replace(/\D/g, "");
  if (d.length !== 10) return digits;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

export type DeliveryWindow = {
  date: string;
  slot: "morning" | "midday" | "afternoon" | "evening";
};

const SLOT_HOURS: Record<DeliveryWindow["slot"], { start: number; end: number }> = {
  morning: { start: 9, end: 12 },
  midday: { start: 11, end: 14 },
  afternoon: { start: 13, end: 17 },
  evening: { start: 17, end: 20 },
};

export function formatDeliveryWindow(w: DeliveryWindow, locale: Locale): string {
  const range = SLOT_HOURS[w.slot];
  const date = new Date(w.date + "T00:00:00");
  const dateStr = new Intl.DateTimeFormat(locale === "es" ? "es-US" : "en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
  const fmtTime = (h: number) =>
    new Intl.DateTimeFormat(locale === "es" ? "es-US" : "en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(new Date(2000, 0, 1, h));
  return `${dateStr} · ${fmtTime(range.start)} – ${fmtTime(range.end)}`;
}
```

- [ ] **Step 8: Run tests, expect green**

```bash
npm test
```

Expected: all 7 format tests pass.

- [ ] **Step 9: Write the failing test for motion-config**

Create `tests/unit/motion-config.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { springs, easings } from "@/lib/motion-config";

describe("springs", () => {
  it("exports a 'soft' preset with stiffness 100, damping 20", () => {
    expect(springs.soft).toEqual({ type: "spring", stiffness: 100, damping: 20 });
  });
  it("exports an 'overshoot' preset", () => {
    expect(springs.overshoot.stiffness).toBeGreaterThanOrEqual(180);
    expect(springs.overshoot.damping).toBeLessThan(20);
  });
});

describe("easings", () => {
  it("exposes elegant cubic-bezier", () => {
    expect(easings.elegant).toEqual([0.16, 1, 0.3, 1]);
  });
});
```

Reduced-motion gating in components uses framer-motion's `useReducedMotion()` directly — no custom hook needed (DRY).

- [ ] **Step 10: Run failing test**

```bash
npm test
```

Expected: motion-config tests fail because the module does not exist.

- [ ] **Step 11: Implement `lib/motion-config.ts`**

```ts
export const springs = {
  soft: { type: "spring", stiffness: 100, damping: 20 } as const,
  snappy: { type: "spring", stiffness: 220, damping: 24 } as const,
  overshoot: { type: "spring", stiffness: 200, damping: 14 } as const,
} as const;

export const easings = {
  elegant: [0.16, 1, 0.3, 1] as const,
  overshoot: [0.34, 1.56, 0.64, 1] as const,
};
```

- [ ] **Step 12: Run tests, expect green**

```bash
npm test
```

Expected: 10 total tests pass (7 format + 3 motion-config).

- [ ] **Step 13: Commit**

```bash
git add -A
git commit -m "feat(lib): format helpers + motion-config with reduced-motion gate (tested)"
```

---

## Task 7: Brand primitives — Wordmark, ArchSVG, Grain

**Files:**
- Create: `components/brand/Wordmark.tsx`
- Create: `components/brand/ArchSVG.tsx`
- Create: `components/brand/Grain.tsx`
- Create: `public/grain.svg` (inline noise)

- [ ] **Step 1: Create `public/grain.svg`**

```bash
cat > public/grain.svg <<'SVG'
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
  <filter id="n">
    <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch"/>
    <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.55 0"/>
  </filter>
  <rect width="100%" height="100%" filter="url(#n)"/>
</svg>
SVG
```

- [ ] **Step 2: Create `components/brand/Grain.tsx`**

```tsx
import { cn } from "@/lib/cn";

export function Grain({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none fixed inset-0 z-[60] mix-blend-multiply opacity-[0.04]",
        className,
      )}
      style={{
        backgroundImage: "url(/grain.svg)",
        backgroundSize: "256px 256px",
      }}
    />
  );
}
```

- [ ] **Step 3: Create `components/brand/Wordmark.tsx`**

```tsx
import Link from "next/link";
import { cn } from "@/lib/cn";

export function Wordmark({
  locale,
  size = "default",
  className,
}: {
  locale: "en" | "es";
  size?: "default" | "sm";
  className?: string;
}) {
  return (
    <Link
      href={`/${locale}`}
      aria-label="Diva Flowers — Home"
      className={cn(
        "font-display tracking-tighter leading-none text-ink select-none",
        size === "default" ? "text-2xl md:text-3xl" : "text-lg",
        className,
      )}
      style={{ fontFeatureSettings: "'ss01' on, 'ss02' on", fontVariationSettings: "'WONK' 1, 'SOFT' 60" }}
    >
      <span aria-hidden>Diva</span>
      <span aria-hidden className="italic"> Flowers</span>
    </Link>
  );
}
```

- [ ] **Step 4: Create `components/brand/ArchSVG.tsx`**

This is the brand's signature digital moment — it draws itself on first paint.

```tsx
"use client";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/cn";

/**
 * Translates the storefront floral arch into a self-drawing SVG outline.
 * On mount, the arch line draws from base-left clockwise to base-right
 * over ~1.4s. Once drawn, children render inside the arch.
 */
export function ArchSVG({
  className,
  children,
  strokeWidth = 1.25,
  duration = 1.4,
}: {
  className?: string;
  children?: React.ReactNode;
  strokeWidth?: number;
  duration?: number;
}) {
  const reduce = useReducedMotion();
  // Arch: starts at (0,1), arcs through (0.5,0) to (1,1) — half-ellipse
  const d = "M 0 1 A 0.5 0.5 0 0 1 1 1";

  return (
    <div className={cn("relative", className)}>
      <svg
        viewBox="0 0 1 1"
        preserveAspectRatio="none"
        className="absolute inset-0 size-full"
        aria-hidden
      >
        <motion.path
          d={d}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth / 100}
          vectorEffect="non-scaling-stroke"
          strokeLinecap="round"
          initial={reduce ? { pathLength: 1 } : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: reduce ? 0 : duration, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>
      <motion.div
        className="relative size-full overflow-hidden"
        style={{ borderTopLeftRadius: "9999px", borderTopRightRadius: "9999px" }}
        initial={reduce ? { opacity: 1 } : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: reduce ? 0 : duration * 0.7, ease: [0.16, 1, 0.3, 1] }}
      >
        {children}
      </motion.div>
    </div>
  );
}
```

- [ ] **Step 5: Install framer-motion + phosphor-icons**

```bash
npm install framer-motion @phosphor-icons/react
```

- [ ] **Step 6: Smoke-render the brand primitives in `app/[locale]/page.tsx`**

```tsx
import { setRequestLocale, getTranslations } from "next-intl/server";
import type { Locale } from "@/types/locale";
import { Wordmark } from "@/components/brand/Wordmark";
import { ArchSVG } from "@/components/brand/ArchSVG";
import { Grain } from "@/components/brand/Grain";

export default async function Home({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("home.hero");

  return (
    <main className="min-h-[100dvh] bg-bone text-ink">
      <Grain />
      <header className="px-6 py-6">
        <Wordmark locale={locale} />
      </header>
      <section className="px-6 pb-20 grid lg:grid-cols-[1.1fr_0.9fr] gap-12 items-center max-w-[1400px] mx-auto">
        <div className="space-y-6">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-mute-500">{t("eyebrow")}</p>
          <h1 className="font-display text-6xl md:text-8xl tracking-tighter leading-[0.95]">
            {t("title")}
          </h1>
          <p className="text-mute-600 max-w-[48ch]">{t("sub")}</p>
        </div>
        <div className="aspect-[4/5] text-rouge">
          <ArchSVG className="size-full">
            <img
              alt=""
              src="https://picsum.photos/seed/diva-hero/900/1100"
              className="size-full object-cover"
            />
          </ArchSVG>
        </div>
      </section>
    </main>
  );
}
```

- [ ] **Step 7: Verify in browser**

```bash
npm run dev
```

Open `http://localhost:3000/en`. Expected:
- Wordmark "Diva *Flowers*" in upper-left in Fraunces.
- Hero text on the left.
- On the right, the arch outline draws itself in rouge over ~1.4s; once drawn, the floral image fades in inside the arched container.
- Subtle grain visible across the whole page.

Stop the server.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(brand): wordmark + self-drawing arch svg + grain overlay"
```

---

## Task 8: Motion primitives — MagneticButton, BloomImage, StaggerGroup, SpotlightField

**Files:**
- Create: `components/motion/MagneticButton.tsx`
- Create: `components/motion/BloomImage.tsx`
- Create: `components/motion/StaggerGroup.tsx`
- Create: `components/motion/SpotlightField.tsx`

- [ ] **Step 1: Create `components/motion/MagneticButton.tsx`**

```tsx
"use client";
import { memo, useRef } from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useReducedMotion,
} from "framer-motion";
import { cn } from "@/lib/cn";

type Props = {
  children: React.ReactNode;
  href?: string;
  onClick?: () => void;
  variant?: "primary" | "ghost";
  className?: string;
  ariaLabel?: string;
  type?: "button" | "submit";
};

function MagneticButtonImpl({
  children,
  href,
  onClick,
  variant = "primary",
  className,
  ariaLabel,
  type = "button",
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 200, damping: 18 });
  const sy = useSpring(y, { stiffness: 200, damping: 18 });

  const onMove = (e: React.MouseEvent) => {
    if (reduce || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    x.set((e.clientX - cx) * 0.18);
    y.set((e.clientY - cy) * 0.18);
  };

  const onLeave = () => {
    x.set(0);
    y.set(0);
  };

  const styleByVariant: Record<NonNullable<Props["variant"]>, string> = {
    primary:
      "bg-rouge text-bone hover:bg-rouge-glow rounded-2xl rounded-t-[var(--radius-arch-top)] px-6 py-4 font-sans font-medium tracking-tight text-base shadow-tile-rest active:scale-[0.98]",
    ghost:
      "bg-transparent text-ink border border-ink/15 hover:border-ink/35 rounded-full px-5 py-3 font-sans tracking-tight text-sm",
  };

  const inner = (
    <motion.div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{ x: sx, y: sy }}
      className={cn(
        "inline-flex items-center justify-center transition-colors duration-300 will-change-transform",
        styleByVariant[variant],
        className,
      )}
    >
      {children}
    </motion.div>
  );

  if (href) {
    return (
      <a href={href} aria-label={ariaLabel} className="inline-block">
        {inner}
      </a>
    );
  }
  return (
    <button type={type} onClick={onClick} aria-label={ariaLabel} className="inline-block">
      {inner}
    </button>
  );
}

export const MagneticButton = memo(MagneticButtonImpl);
```

- [ ] **Step 2: Create `components/motion/BloomImage.tsx`**

```tsx
"use client";
import { memo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/cn";

type Props = {
  src: string;
  alt: string;
  className?: string;
  sizes?: string;
};

function BloomImageImpl({ src, alt, className, sizes }: Props) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={cn("relative overflow-hidden", className)}
      whileHover={reduce ? undefined : { scale: 1.02, rotate: -0.5 }}
      transition={{ type: "spring", stiffness: 120, damping: 16 }}
    >
      <img src={src} alt={alt} sizes={sizes} className="size-full object-cover" />
    </motion.div>
  );
}

export const BloomImage = memo(BloomImageImpl);
```

- [ ] **Step 3: Create `components/motion/StaggerGroup.tsx`**

```tsx
"use client";
import { memo } from "react";
import { motion, useReducedMotion } from "framer-motion";

type Props = {
  children: React.ReactNode;
  delay?: number;
  stagger?: number;
  className?: string;
};

function StaggerGroupImpl({
  children,
  delay = 0,
  stagger = 0.09,
  className,
}: Props) {
  const reduce = useReducedMotion();
  const variants = {
    hidden: {},
    show: {
      transition: { staggerChildren: reduce ? 0 : stagger, delayChildren: delay },
    },
  };
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.2 }}
      variants={variants}
    >
      {children}
    </motion.div>
  );
}

export const StaggerGroup = memo(StaggerGroupImpl);

export const staggerItemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 100, damping: 20 } as const,
  },
};
```

- [ ] **Step 4: Create `components/motion/SpotlightField.tsx`**

```tsx
"use client";
import { memo, useRef } from "react";
import { motion, useMotionValue, useSpring, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/cn";

/**
 * A 220px radial light that follows the cursor inside its container.
 * Hover-only effect — does NOT replace the cursor (taste-skill bans custom cursors).
 */
function SpotlightFieldImpl({
  className,
  color = "rgba(184, 52, 94, 0.18)",
}: {
  className?: string;
  color?: string;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(-9999);
  const y = useMotionValue(-9999);
  const sx = useSpring(x, { stiffness: 180, damping: 22 });
  const sy = useSpring(y, { stiffness: 180, damping: 22 });

  const onMove = (e: React.MouseEvent) => {
    if (reduce || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    x.set(e.clientX - rect.left);
    y.set(e.clientY - rect.top);
  };
  const onLeave = () => {
    x.set(-9999);
    y.set(-9999);
  };

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className={cn("relative overflow-hidden", className)}
    >
      <motion.div
        aria-hidden
        className="pointer-events-none absolute size-[440px] rounded-full"
        style={{
          x: sx,
          y: sy,
          translateX: "-50%",
          translateY: "-50%",
          background: `radial-gradient(circle at center, ${color}, transparent 60%)`,
        }}
      />
    </div>
  );
}

export const SpotlightField = memo(SpotlightFieldImpl);
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(motion): magnetic button, bloom image, stagger group, cursor spotlight"
```

---

## Task 9: shadcn/ui setup with brand customization

**Files:**
- Create: `components/ui/Button.tsx`, `Sheet.tsx`, `Input.tsx`, `Label.tsx`

We are not using the shadcn CLI in this plan; we hand-author the components we need so they fit the brand from day one. (Per taste-skill: shadcn primitives must never be in their default state.)

- [ ] **Step 1: Install peer deps for Sheet**

```bash
npm install @radix-ui/react-dialog @radix-ui/react-label @radix-ui/react-slot
```

- [ ] **Step 2: Create `components/ui/Button.tsx`**

```tsx
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/cn";

type Variant = "primary" | "ghost" | "outline" | "link";
type Size = "sm" | "md" | "lg";

const variantClass: Record<Variant, string> = {
  primary:
    "bg-rouge text-bone hover:bg-rouge-glow rounded-2xl rounded-t-[var(--radius-arch-top)] active:scale-[0.98]",
  ghost: "bg-transparent text-ink hover:bg-ink/[0.04] rounded-full",
  outline: "bg-transparent text-ink border border-ink/15 hover:border-ink/35 rounded-full",
  link: "bg-transparent text-ink underline-offset-4 hover:underline",
};
const sizeClass: Record<Size, string> = {
  sm: "px-3.5 py-2 text-sm",
  md: "px-5 py-3 text-base",
  lg: "px-6 py-4 text-base",
};

export const Button = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    asChild?: boolean;
    variant?: Variant;
    size?: Size;
  }
>(({ className, variant = "primary", size = "md", asChild, ...props }, ref) => {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center font-sans font-medium tracking-tight transition-colors duration-300 outline-none focus-visible:ring-2 focus-visible:ring-rouge focus-visible:ring-offset-2 focus-visible:ring-offset-bone disabled:opacity-50",
        variantClass[variant],
        sizeClass[size],
        className,
      )}
      {...props}
    />
  );
});
Button.displayName = "Button";
```

- [ ] **Step 3: Create `components/ui/Sheet.tsx`**

```tsx
"use client";
import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/cn";

export const Sheet = Dialog.Root;
export const SheetTrigger = Dialog.Trigger;
export const SheetClose = Dialog.Close;

export function SheetContent({
  children,
  side = "right",
  className,
}: {
  children: React.ReactNode;
  side?: "right" | "bottom";
  className?: string;
}) {
  return (
    <Dialog.Portal forceMount>
      <AnimatePresence>
        <Dialog.Overlay asChild>
          <motion.div
            className="fixed inset-0 z-50 bg-ink/30 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />
        </Dialog.Overlay>
        <Dialog.Content asChild>
          <motion.div
            className={cn(
              "fixed z-50 bg-bone text-ink shadow-[var(--shadow-diffusion)]",
              side === "right" && "top-0 right-0 h-full w-full sm:max-w-md p-8 border-l border-ink/10",
              side === "bottom" && "bottom-0 inset-x-0 max-h-[85dvh] p-8 rounded-t-[var(--radius-bento)] border-t border-ink/10",
              "[box-shadow:inset_0_1px_0_rgba(255,255,255,0.6)]",
              className,
            )}
            initial={side === "right" ? { x: "100%" } : { y: "100%" }}
            animate={side === "right" ? { x: 0 } : { y: 0 }}
            exit={side === "right" ? { x: "100%" } : { y: "100%" }}
            transition={{ type: "spring", stiffness: 220, damping: 28 }}
          >
            {children}
          </motion.div>
        </Dialog.Content>
      </AnimatePresence>
    </Dialog.Portal>
  );
}
```

- [ ] **Step 4: Create `components/ui/Input.tsx`**

```tsx
import * as React from "react";
import { cn } from "@/lib/cn";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "w-full bg-transparent border-b border-ink/20 py-3 px-1 text-base placeholder:text-mute-400 outline-none focus:border-rouge transition-colors",
      "font-mono", // mono for inputs (price, phone, email feel)
      className,
    )}
    {...props}
  />
));
Input.displayName = "Input";
```

- [ ] **Step 5: Create `components/ui/Label.tsx`**

```tsx
"use client";
import * as React from "react";
import * as RadixLabel from "@radix-ui/react-label";
import { cn } from "@/lib/cn";

export const Label = React.forwardRef<
  React.ElementRef<typeof RadixLabel.Root>,
  React.ComponentPropsWithoutRef<typeof RadixLabel.Root>
>(({ className, ...props }, ref) => (
  <RadixLabel.Root
    ref={ref}
    className={cn("font-mono text-xs uppercase tracking-[0.18em] text-mute-500", className)}
    {...props}
  />
));
Label.displayName = "Label";
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(ui): customized button, sheet, input, label primitives"
```

---

## Task 10: TopNav with LocaleSwitcher (text-scramble morph) and CartButton stub

**Files:**
- Create: `components/nav/TopNav.tsx`
- Create: `components/nav/LocaleSwitcher.tsx`
- Create: `components/nav/CartButton.tsx`
- Create: `components/nav/NavLinks.tsx`

- [ ] **Step 1: Create `components/nav/NavLinks.tsx`** (server-rendered)

```tsx
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/types/locale";

export async function NavLinks({ locale }: { locale: Locale }) {
  const t = await getTranslations("nav");
  const links: { href: string; label: string }[] = [
    { href: `/${locale}/shop`, label: t("shop") },
    { href: `/${locale}/shop/subscriptions`, label: t("subscriptions") },
    { href: `/${locale}/weddings`, label: t("weddings") },
    { href: `/${locale}/events`, label: t("events") },
    { href: `/${locale}/story`, label: t("story") },
  ];
  return (
    <ul className="hidden md:flex items-center gap-7">
      {links.map((l) => (
        <li key={l.href}>
          <Link
            href={l.href}
            className="font-sans text-sm tracking-tight text-ink/80 hover:text-ink transition-colors"
          >
            {l.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 2: Create `components/nav/LocaleSwitcher.tsx`**

```tsx
"use client";
import { usePathname, useRouter } from "next/navigation";
import { useTransition, memo, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/cn";
import { locales, type Locale } from "@/types/locale";

const SCRAMBLE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ.,/·";

function scramble(target: string, frame: number, frames: number): string {
  if (frame >= frames) return target;
  const out: string[] = [];
  for (let i = 0; i < target.length; i++) {
    const settle = (i / target.length) * frames;
    if (frame >= settle) out.push(target[i]);
    else out.push(SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)]);
  }
  return out.join("");
}

function LocaleSwitcherImpl({ current }: { current: Locale }) {
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();
  const [display, setDisplay] = useState(`EN · ES`);

  const switchTo = (next: Locale) => {
    if (next === current) return;
    // text-scramble effect
    const frames = 14;
    const target = next === "en" ? "EN · ES" : "ES · EN";
    let frame = 0;
    const interval = setInterval(() => {
      setDisplay(scramble(target, frame, frames));
      frame += 1;
      if (frame > frames) clearInterval(interval);
    }, 28);

    const segments = pathname.split("/");
    segments[1] = next;
    const url = segments.join("/") || `/${next}`;
    document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=31536000`;
    startTransition(() => router.replace(url));
  };

  const other = (locales as readonly string[]).find((l) => l !== current) as Locale;

  return (
    <button
      onClick={() => switchTo(other)}
      aria-label={`Switch language to ${other.toUpperCase()}`}
      className={cn(
        "font-mono text-[11px] uppercase tracking-[0.2em] px-2.5 py-1.5 rounded-full",
        "text-ink/70 hover:text-ink border border-ink/10 hover:border-ink/30 transition-colors",
      )}
    >
      <motion.span layout>{display}</motion.span>
    </button>
  );
}

export const LocaleSwitcher = memo(LocaleSwitcherImpl);
```

- [ ] **Step 3: Create `components/nav/CartButton.tsx`** (stub for Plan 3)

```tsx
"use client";
import Link from "next/link";
import { Bag } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";

export function CartButton({ locale }: { locale: "en" | "es" }) {
  const t = useTranslations("nav");
  // Plan 3 will replace this with the real Zustand-backed count.
  const count = 0;
  return (
    <Link
      href={`/${locale}/cart`}
      aria-label={`${t("cart")} (${count})`}
      className="relative inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-ink/80 hover:text-ink transition-colors"
    >
      <Bag size={18} weight="regular" />
      <span className="font-mono text-[11px] uppercase tracking-[0.18em]">{t("cart")}</span>
      {count > 0 && (
        <span className="ml-0.5 inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full bg-rouge text-bone text-[10px] font-mono">
          {count}
        </span>
      )}
    </Link>
  );
}
```

- [ ] **Step 4: Create `components/nav/TopNav.tsx`**

```tsx
"use client";
import { useEffect, useState } from "react";
import { motion, useScroll, useMotionValueEvent } from "framer-motion";
import { Wordmark } from "@/components/brand/Wordmark";
import { LocaleSwitcher } from "@/components/nav/LocaleSwitcher";
import { CartButton } from "@/components/nav/CartButton";
import type { Locale } from "@/types/locale";
import { cn } from "@/lib/cn";

export function TopNav({
  locale,
  navLinksSlot,
}: {
  locale: Locale;
  navLinksSlot: React.ReactNode;
}) {
  const { scrollY } = useScroll();
  const [condensed, setCondensed] = useState(false);

  useMotionValueEvent(scrollY, "change", (v) => {
    setCondensed(v > 80);
  });

  return (
    <motion.header
      className={cn(
        "fixed top-0 inset-x-0 z-40 transition-all duration-300",
        condensed
          ? "bg-bone/85 backdrop-blur-md border-b border-ink/[0.06]"
          : "bg-transparent border-b border-transparent",
      )}
    >
      <div className="max-w-[1400px] mx-auto px-6 flex items-center justify-between h-16">
        <Wordmark locale={locale} />
        {navLinksSlot}
        <div className="flex items-center gap-2">
          <LocaleSwitcher current={locale} />
          <CartButton locale={locale} />
        </div>
      </div>
    </motion.header>
  );
}
```

- [ ] **Step 5: Wire TopNav into `app/[locale]/layout.tsx`**

Replace `app/[locale]/layout.tsx`:

```tsx
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { locales, type Locale } from "@/types/locale";
import { TopNav } from "@/components/nav/TopNav";
import { NavLinks } from "@/components/nav/NavLinks";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(locales, locale)) notFound();
  setRequestLocale(locale as Locale);

  return (
    <NextIntlClientProvider locale={locale}>
      <TopNav locale={locale as Locale} navLinksSlot={<NavLinks locale={locale as Locale} />} />
      <div className="pt-16">{children}</div>
    </NextIntlClientProvider>
  );
}
```

Remove the inline `<header>` block from `app/[locale]/page.tsx` since TopNav now lives in the layout. Keep only the `<main>` content:

Edit `app/[locale]/page.tsx` — delete the `<header>` and the surrounding `<Wordmark>` import that's no longer used in the page (Wordmark stays, used by TopNav):

```tsx
import { setRequestLocale, getTranslations } from "next-intl/server";
import type { Locale } from "@/types/locale";
import { ArchSVG } from "@/components/brand/ArchSVG";
import { Grain } from "@/components/brand/Grain";

export default async function Home({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("home.hero");

  return (
    <main className="min-h-[100dvh] bg-bone text-ink">
      <Grain />
      <section className="px-6 py-20 grid lg:grid-cols-[1.1fr_0.9fr] gap-12 items-center max-w-[1400px] mx-auto">
        <div className="space-y-6">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-mute-500">{t("eyebrow")}</p>
          <h1 className="font-display text-6xl md:text-8xl tracking-tighter leading-[0.95]">
            {t("title")}
          </h1>
          <p className="text-mute-600 max-w-[48ch]">{t("sub")}</p>
        </div>
        <div className="aspect-[4/5] text-rouge">
          <ArchSVG className="size-full">
            <img alt="" src="https://picsum.photos/seed/diva-hero/900/1100" className="size-full object-cover" />
          </ArchSVG>
        </div>
      </section>
    </main>
  );
}
```

- [ ] **Step 6: Verify**

```bash
npm run dev
```

Open `http://localhost:3000/en`. Expected:
- Top nav floats over the hero, transparent.
- Wordmark, nav links (Shop / Subscriptions / Weddings / Events / Story), `EN · ES` pill, and Bag icon visible.
- Scroll down: nav condenses with backdrop blur and a hairline.
- Click `EN · ES`: characters scramble briefly, URL changes to `/es`, hero title becomes "Romance, tallo a tallo."

Stop the server.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(nav): top nav with scroll-condense, locale switcher (text scramble), cart stub"
```

---

## Task 11: Footer

**Files:**
- Create: `components/nav/Footer.tsx`
- Modify: `app/[locale]/layout.tsx`

- [ ] **Step 1: Create `components/nav/Footer.tsx`**

```tsx
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { SITE } from "@/data/site";
import { Wordmark } from "@/components/brand/Wordmark";
import type { Locale } from "@/types/locale";

export async function Footer({ locale }: { locale: Locale }) {
  const t = await getTranslations("footer");
  const year = new Date().getFullYear();

  return (
    <footer className="bg-ink text-bone mt-32">
      <div className="max-w-[1400px] mx-auto px-6 pt-20 pb-10">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-12 pb-16 border-b border-bone/10">
          <div className="md:col-span-5 space-y-6">
            <Wordmark locale={locale} className="text-bone text-3xl" />
            <p className="text-bone/70 max-w-[40ch] text-sm leading-relaxed">
              {SITE.address.line1} · {SITE.address.locality}, {SITE.address.region} {SITE.address.postal}
            </p>
          </div>

          <div className="md:col-span-2 space-y-3">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-bone/50">
              {t("hours_label")}
            </p>
            <ul className="space-y-1.5 font-mono text-[13px]">
              {SITE.hours.map((h) => (
                <li key={h.day}>
                  <span className="text-bone/50">{h.day}</span> <span>{h.value}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="md:col-span-2 space-y-3">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-bone/50">
              {t("phone_label")}
            </p>
            <a href={SITE.phoneHref} className="font-mono text-[13px] hover:text-petal transition-colors">
              {SITE.phoneDisplay}
            </a>
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-bone/50 pt-3">
              {t("email_label")}
            </p>
            <a href={SITE.emailHref} className="font-mono text-[13px] hover:text-petal transition-colors">
              {SITE.email}
            </a>
          </div>

          <div className="md:col-span-3 space-y-3">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-bone/50">
              {t("social_label")}
            </p>
            <ul className="space-y-1.5 text-sm">
              {SITE.social.map((s) => (
                <li key={s.label}>
                  <a href={s.href} target="_blank" rel="noreferrer" className="hover:text-petal transition-colors">
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pt-8 text-bone/50 text-xs font-mono">
          <p>
            © {year} Diva Flowers · {t("rights")}
          </p>
          <div className="flex gap-6">
            <Link href={`/${locale}/legal/privacy`} className="hover:text-bone transition-colors">
              {t("legal.privacy")}
            </Link>
            <Link href={`/${locale}/legal/terms`} className="hover:text-bone transition-colors">
              {t("legal.terms")}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
```

- [ ] **Step 2: Add Footer to layout**

Edit `app/[locale]/layout.tsx` — import and render the Footer below `{children}`:

```tsx
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { locales, type Locale } from "@/types/locale";
import { TopNav } from "@/components/nav/TopNav";
import { NavLinks } from "@/components/nav/NavLinks";
import { Footer } from "@/components/nav/Footer";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(locales, locale)) notFound();
  setRequestLocale(locale as Locale);

  return (
    <NextIntlClientProvider locale={locale}>
      <TopNav locale={locale as Locale} navLinksSlot={<NavLinks locale={locale as Locale} />} />
      <div className="pt-16">{children}</div>
      <Footer locale={locale as Locale} />
    </NextIntlClientProvider>
  );
}
```

- [ ] **Step 3: Verify**

```bash
npm run dev
```

Open `/en` and `/es`. Expected: dark ink footer with wordmark, address, hours, phone (mono), email, socials, legal links. Localized labels switch correctly between locales.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(nav): footer with site data, hours, contact, social, legal"
```

---

## Task 12: Home — Hero with arch + magnetic CTAs + spotlight + scroll cue

**Files:**
- Create: `components/home/Hero.tsx`
- Modify: `app/[locale]/page.tsx`

- [ ] **Step 1: Create `components/home/Hero.tsx`**

```tsx
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { ArchSVG } from "@/components/brand/ArchSVG";
import { MagneticButton } from "@/components/motion/MagneticButton";
import { SpotlightField } from "@/components/motion/SpotlightField";
import type { Locale } from "@/types/locale";

export async function Hero({ locale }: { locale: Locale }) {
  const t = await getTranslations("home.hero");

  return (
    <section className="relative min-h-[100dvh] overflow-hidden">
      <SpotlightField className="absolute inset-0" />
      <div className="relative max-w-[1400px] mx-auto px-6 pt-28 pb-24 grid lg:grid-cols-[1.05fr_0.95fr] gap-16 items-center">
        <div className="space-y-8">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-mute-500">
            {t("eyebrow")}
          </p>
          <h1
            className="font-display text-[clamp(3rem,7.5vw,7.5rem)] tracking-tighter leading-[0.95]"
            style={{ fontVariationSettings: "'WONK' 1, 'SOFT' 80, 'opsz' 144" }}
          >
            {t("title")}
          </h1>
          <p className="text-mute-600 max-w-[52ch] text-base md:text-lg leading-relaxed">
            {t("sub")}
          </p>
          <div className="flex flex-wrap items-center gap-4 pt-2">
            <MagneticButton href={`/${locale}/shop/arrangements`} ariaLabel={t("cta_primary")}>
              {t("cta_primary")}
            </MagneticButton>
            <Link
              href={`/${locale}/weddings`}
              className="font-sans text-sm tracking-tight underline-offset-4 hover:underline text-ink/80"
            >
              {t("cta_secondary")} →
            </Link>
          </div>
        </div>
        <div className="aspect-[4/5] text-rouge">
          <ArchSVG className="size-full">
            <img
              alt=""
              src="https://picsum.photos/seed/diva-hero-arrangement/900/1100"
              className="size-full object-cover"
            />
          </ArchSVG>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Use Hero in `app/[locale]/page.tsx`**

```tsx
import { setRequestLocale } from "next-intl/server";
import type { Locale } from "@/types/locale";
import { Grain } from "@/components/brand/Grain";
import { Hero } from "@/components/home/Hero";

export default async function Home({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main className="bg-bone text-ink">
      <Grain />
      <Hero locale={locale} />
    </main>
  );
}
```

- [ ] **Step 3: Verify**

```bash
npm run dev
```

Expected on `/en`:
- Full-viewport hero, asymmetric split.
- Title fluidly responsive (`clamp(3rem, 7.5vw, 7.5rem)`).
- Arch outline draws itself, photo fades in inside.
- Cursor inside the hero shows a soft rouge spotlight following it.
- "Shop arrangements" button pulls subtly toward the cursor; on press it scales to `0.98`.
- "Plan a wedding" link underlines on hover.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(home): hero with magnetic ctas, cursor spotlight, fluid display type"
```

---

## Task 13: Home — KineticMarquee with scroll-direction reverse

**Files:**
- Create: `components/brand/KineticMarquee.tsx`
- Modify: `app/[locale]/page.tsx`

- [ ] **Step 1: Create `components/brand/KineticMarquee.tsx`**

```tsx
"use client";
import { memo, useEffect, useRef, useState } from "react";
import {
  motion,
  useAnimationFrame,
  useMotionValue,
  useScroll,
  useTransform,
  useVelocity,
  useSpring,
  wrap,
  useReducedMotion,
} from "framer-motion";
import { cn } from "@/lib/cn";

function KineticMarqueeImpl({
  text,
  speed = 60, // px / s
  className,
}: {
  text: string;
  speed?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const baseX = useMotionValue(0);
  const { scrollY } = useScroll();
  const scrollVelocity = useVelocity(scrollY);
  const smoothVelocity = useSpring(scrollVelocity, { damping: 50, stiffness: 400 });
  const velocityFactor = useTransform(smoothVelocity, [0, 1000], [0, 5], { clamp: false });
  const directionFactor = useRef(1);

  const [repeat, setRepeat] = useState(6);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // ensure enough copies to cover viewport
    if (!ref.current) return;
    const widthOne = ref.current.firstElementChild?.getBoundingClientRect().width ?? 0;
    if (widthOne === 0) return;
    const needed = Math.ceil((window.innerWidth * 2) / widthOne) + 2;
    setRepeat(needed);
  }, [text]);

  const x = useTransform(baseX, (v) => `${wrap(-50, 0, v)}%`);

  useAnimationFrame((_, delta) => {
    if (reduce) return;
    let moveBy = directionFactor.current * (speed / 1000) * delta;
    if (scrollVelocity.get() < 0) directionFactor.current = -1;
    else if (scrollVelocity.get() > 0) directionFactor.current = 1;
    moveBy += directionFactor.current * moveBy * velocityFactor.get();
    baseX.set(baseX.get() + moveBy);
  });

  return (
    <div
      ref={ref}
      className={cn(
        "relative overflow-hidden border-y border-ink/10 bg-bone py-5",
        className,
      )}
      aria-hidden
    >
      <motion.div className="flex whitespace-nowrap" style={{ x }}>
        {Array.from({ length: repeat }).map((_, i) => (
          <span
            key={i}
            className="font-display text-3xl md:text-5xl tracking-tight px-8 text-ink"
            style={{ fontVariationSettings: "'WONK' 1, 'SOFT' 50" }}
          >
            {text}
          </span>
        ))}
      </motion.div>
    </div>
  );
}

export const KineticMarquee = memo(KineticMarqueeImpl);
```

- [ ] **Step 2: Use KineticMarquee in `app/[locale]/page.tsx`**

```tsx
import { setRequestLocale, getTranslations } from "next-intl/server";
import type { Locale } from "@/types/locale";
import { Grain } from "@/components/brand/Grain";
import { Hero } from "@/components/home/Hero";
import { KineticMarquee } from "@/components/brand/KineticMarquee";

export default async function Home({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("home");

  return (
    <main className="bg-bone text-ink">
      <Grain />
      <Hero locale={locale} />
      <KineticMarquee text={`${t("marquee")}  ·  `} />
    </main>
  );
}
```

- [ ] **Step 3: Verify**

```bash
npm run dev
```

Expected: A continuous marquee in Fraunces below the hero. Scrolling down speeds it up in one direction; scrolling up reverses it. Hairlines top and bottom.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(home): kinetic marquee with scroll-velocity-driven direction reversal"
```

---

## Task 14: Home — BentoGrid with 4 perpetual-motion tiles

**Files:**
- Create: `components/home/BentoGrid.tsx`
- Create: `components/home/BentoFeaturedTile.tsx`
- Create: `components/home/BentoSubscriptionsTile.tsx`
- Create: `components/home/BentoLiveStatusTile.tsx`
- Create: `components/home/BentoPressTile.tsx`
- Modify: `app/[locale]/page.tsx`

- [ ] **Step 1: Create `components/home/BentoFeaturedTile.tsx`**

```tsx
"use client";
import { memo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { ArchSVG } from "@/components/brand/ArchSVG";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";

function BentoFeaturedTileImpl({ locale }: { locale: "en" | "es" }) {
  const reduce = useReducedMotion();
  const t = useTranslations("home.bento");
  return (
    <motion.div
      animate={reduce ? undefined : { rotate: [-0.4, 0.4, -0.4] }}
      transition={{ duration: 9, ease: "easeInOut", repeat: Infinity }}
      className={cn(
        "relative bg-petal text-ink rounded-[var(--radius-bento)] overflow-hidden",
        "min-h-[480px] md:min-h-[520px] p-8 md:p-10 flex flex-col justify-end",
        "shadow-[var(--shadow-tile-rest)]",
      )}
    >
      <div className="absolute inset-x-10 top-10 bottom-32 text-rouge">
        <ArchSVG className="size-full">
          <img
            alt=""
            src="https://picsum.photos/seed/featured-arrangement/700/900"
            className="size-full object-cover"
          />
        </ArchSVG>
      </div>
      <div className="relative space-y-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink/60">
          {t("featured_eyebrow")}
        </p>
        <p className="font-display text-3xl tracking-tighter leading-tight">
          The Ingrid Bouquet
        </p>
        <p className="font-mono text-sm">$187</p>
        <Link
          href={`/${locale}/product/the-ingrid-bouquet`}
          className="font-sans text-sm underline underline-offset-4 hover:no-underline"
        >
          {t("featured_cta")} →
        </Link>
      </div>
    </motion.div>
  );
}

export const BentoFeaturedTile = memo(BentoFeaturedTileImpl);
```

- [ ] **Step 2: Create `components/home/BentoSubscriptionsTile.tsx`**

```tsx
"use client";
import { memo } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";

function BentoSubscriptionsTileImpl({ locale }: { locale: "en" | "es" }) {
  const reduce = useReducedMotion();
  const t = useTranslations("home.bento");
  return (
    <div className="relative bg-bone border border-ink/10 rounded-[var(--radius-bento)] p-8 md:p-10 flex flex-col justify-between min-h-[260px] shadow-[var(--shadow-tile-rest)] overflow-hidden">
      <p className="font-display text-2xl md:text-3xl tracking-tighter leading-tight max-w-[18ch]">
        {t("subscriptions_title")}
      </p>
      <p className="font-sans text-mute-600 max-w-[34ch] text-sm">
        {t("subscriptions_body")}
      </p>
      <Link
        href={`/${locale}/shop/subscriptions`}
        className="relative inline-flex w-fit font-sans font-medium text-sm tracking-tight px-5 py-3 rounded-full bg-ink text-bone overflow-hidden"
      >
        <span className="relative z-10">{t("subscriptions_cta")}</span>
        {!reduce && (
          <motion.span
            aria-hidden
            initial={{ x: "-120%" }}
            animate={{ x: "120%" }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0 bg-[linear-gradient(115deg,transparent_30%,rgba(250,246,240,0.5)_50%,transparent_70%)]"
          />
        )}
      </Link>
    </div>
  );
}

export const BentoSubscriptionsTile = memo(BentoSubscriptionsTileImpl);
```

- [ ] **Step 3: Create `components/home/BentoLiveStatusTile.tsx`**

```tsx
"use client";
import { memo, useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { SITE } from "@/data/site";

function BentoLiveStatusTileImpl() {
  const reduce = useReducedMotion();
  const t = useTranslations("home.bento");
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (reduce) return;
    const id = setInterval(() => setIdx((i) => (i + 1) % SITE.recentDeliveries.length), 4200);
    return () => clearInterval(id);
  }, [reduce]);

  const current = SITE.recentDeliveries[idx];

  return (
    <div className="relative bg-ink text-bone rounded-[var(--radius-bento)] p-8 md:p-10 min-h-[260px] flex flex-col justify-between overflow-hidden shadow-[var(--shadow-tile-rest)]">
      <div className="flex items-center gap-2.5 font-mono text-[11px] uppercase tracking-[0.22em] text-bone/70">
        <motion.span
          aria-hidden
          className="block size-2 rounded-full bg-petal"
          animate={reduce ? undefined : { scale: [1, 1.6, 1], opacity: [1, 0.6, 1] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        />
        {t("live_status_label")} · {t("live_status_zone")}
      </div>

      <div className="relative h-20">
        <AnimatePresence mode="popLayout">
          <motion.div
            key={current.city}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            transition={{ type: "spring", stiffness: 160, damping: 18 }}
            className="absolute inset-0 flex flex-col justify-center"
          >
            <p className="font-display text-2xl tracking-tighter">→ {current.city}</p>
            <p className="font-mono text-xs text-bone/60 mt-1">{current.time}</p>
          </motion.div>
        </AnimatePresence>
      </div>

      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-bone/50">
        {t("live_status_cutoff")}
      </p>
    </div>
  );
}

export const BentoLiveStatusTile = memo(BentoLiveStatusTileImpl);
```

- [ ] **Step 4: Create `components/home/BentoPressTile.tsx`**

```tsx
"use client";
import { memo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { SITE } from "@/data/site";

function BentoPressTileImpl() {
  const reduce = useReducedMotion();
  const t = useTranslations("home.bento");
  const items = [...SITE.press, ...SITE.press]; // duplicate for seamless loop

  return (
    <div className="relative bg-bone border border-ink/10 rounded-[var(--radius-bento)] p-8 md:p-10 min-h-[260px] flex flex-col justify-between overflow-hidden shadow-[var(--shadow-tile-rest)]">
      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-mute-500">
        {t("press_eyebrow")}
      </p>
      <div className="relative overflow-hidden">
        <motion.div
          className="flex gap-12 whitespace-nowrap"
          animate={reduce ? undefined : { x: ["0%", "-50%"] }}
          transition={{ duration: 22, repeat: Infinity, ease: "linear" }}
        >
          {items.map((p, i) => (
            <span
              key={`${p}-${i}`}
              className="font-display text-2xl md:text-3xl tracking-tighter text-ink"
              style={{ fontVariationSettings: "'WONK' 1, 'SOFT' 60" }}
            >
              {p}
            </span>
          ))}
        </motion.div>
      </div>
    </div>
  );
}

export const BentoPressTile = memo(BentoPressTileImpl);
```

- [ ] **Step 5: Create `components/home/BentoGrid.tsx`**

```tsx
import { BentoFeaturedTile } from "./BentoFeaturedTile";
import { BentoSubscriptionsTile } from "./BentoSubscriptionsTile";
import { BentoLiveStatusTile } from "./BentoLiveStatusTile";
import { BentoPressTile } from "./BentoPressTile";
import type { Locale } from "@/types/locale";

export function BentoGrid({ locale }: { locale: Locale }) {
  return (
    <section className="max-w-[1400px] mx-auto px-6 py-24 md:py-32">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6">
        <div className="md:row-span-2">
          <BentoFeaturedTile locale={locale} />
        </div>
        <BentoSubscriptionsTile locale={locale} />
        <BentoLiveStatusTile />
        <div className="md:col-span-2">
          <BentoPressTile />
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 6: Use BentoGrid in `app/[locale]/page.tsx`**

```tsx
import { setRequestLocale, getTranslations } from "next-intl/server";
import type { Locale } from "@/types/locale";
import { Grain } from "@/components/brand/Grain";
import { Hero } from "@/components/home/Hero";
import { KineticMarquee } from "@/components/brand/KineticMarquee";
import { BentoGrid } from "@/components/home/BentoGrid";

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
    </main>
  );
}
```

- [ ] **Step 7: Verify**

```bash
npm run dev
```

Expected:
- 4-tile asymmetric Bento below the marquee.
- Featured tile (left, tall): subtly rocks `-0.4° → 0.4°` over 9s; arched-frame product photo.
- Subscriptions tile: copy + dark CTA chip with a continuous shimmer sweep.
- Live status tile: dark, breathing petal-pink dot, recent-deliveries cycle every ~4s with overshoot spring.
- Press tile (bottom right, wide): seamless infinite carousel of press names in Fraunces.
- Mobile: collapses to single column, all motion preserved but no horizontal overflow.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(home): bento grid with 4 perpetual-motion tiles (featured/subs/live/press)"
```

---

## Task 15: Home — CategoryStrip (6 horizontally-scrolling cards)

**Files:**
- Create: `components/home/CategoryStrip.tsx`
- Modify: `app/[locale]/page.tsx`

- [ ] **Step 1: Create `components/home/CategoryStrip.tsx`**

```tsx
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { BloomImage } from "@/components/motion/BloomImage";
import type { Locale } from "@/types/locale";

const CATEGORIES = [
  { slug: "arrangements", seed: "cat-arrangements" },
  { slug: "bouquets", seed: "cat-bouquets" },
  { slug: "plants", seed: "cat-plants" },
  { slug: "gifts", seed: "cat-gifts" },
  { slug: "sympathy", seed: "cat-sympathy" },
  { slug: "subscriptions", seed: "cat-subscriptions" },
] as const;

export async function CategoryStrip({ locale }: { locale: Locale }) {
  const t = await getTranslations();

  return (
    <section className="py-20 md:py-28">
      <div className="max-w-[1400px] mx-auto px-6 flex items-end justify-between mb-8">
        <h2 className="font-display text-4xl md:text-6xl tracking-tighter leading-none">
          {t("home.categories_title")}
        </h2>
      </div>
      <div className="overflow-x-auto snap-x snap-mandatory pl-6 pb-4 scrollbar-thin">
        <ul className="flex gap-5 pr-6 max-w-[1400px] mx-auto">
          {CATEGORIES.map((c) => (
            <li
              key={c.slug}
              className="snap-start shrink-0 w-[78vw] sm:w-[44vw] md:w-[28vw] lg:w-[22vw]"
            >
              <Link
                href={`/${locale}/shop/${c.slug}`}
                className="group block space-y-4"
              >
                <BloomImage
                  src={`https://picsum.photos/seed/${c.seed}/600/750`}
                  alt={t(`categories.${c.slug}`)}
                  className="aspect-[4/5] rounded-[var(--radius-product)]"
                />
                <div className="flex items-center justify-between">
                  <span className="font-display text-xl tracking-tighter">
                    {t(`categories.${c.slug}`)}
                  </span>
                  <span className="font-mono text-xs uppercase tracking-[0.18em] text-mute-500 group-hover:text-rouge transition-colors">
                    Shop →
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Add CategoryStrip to home page**

Edit `app/[locale]/page.tsx`:

```tsx
import { CategoryStrip } from "@/components/home/CategoryStrip";
// ...
return (
  <main className="bg-bone text-ink">
    <Grain />
    <Hero locale={locale} />
    <KineticMarquee text={`${t("marquee")}  ·  `} />
    <BentoGrid locale={locale} />
    <CategoryStrip locale={locale} />
  </main>
);
```

- [ ] **Step 3: Verify**

```bash
npm run dev
```

Expected: 6 category cards in a horizontal snap-scroll. Hovering bloom-zooms each card slightly. Localized category names.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(home): horizontal category strip with bloom hover"
```

---

## Task 16: Home — EditorialSplit (storefront photo + brand story)

**Files:**
- Create: `components/home/EditorialSplit.tsx`
- Modify: `app/[locale]/page.tsx`

- [ ] **Step 1: Create `components/home/EditorialSplit.tsx`**

```tsx
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/types/locale";
import { BloomImage } from "@/components/motion/BloomImage";

export async function EditorialSplit({ locale }: { locale: Locale }) {
  const t = await getTranslations("home.editorial_split");
  return (
    <section className="py-24 md:py-32">
      <div className="max-w-[1400px] mx-auto px-6 grid md:grid-cols-12 gap-10 md:gap-16 items-center">
        <div className="md:col-span-5 space-y-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-mute-500">
            {t("eyebrow")}
          </p>
          <h2
            className="font-display text-4xl md:text-6xl tracking-tighter leading-[1.02]"
            style={{ fontVariationSettings: "'WONK' 1, 'SOFT' 70" }}
          >
            {t("title")}
          </h2>
          <p className="text-mute-600 max-w-[42ch] text-base leading-relaxed">{t("body")}</p>
        </div>
        <div className="md:col-span-7 md:-mr-6 md:translate-y-6">
          <BloomImage
            src="https://picsum.photos/seed/diva-storefront/1200/900"
            alt="Diva Flowers storefront with floral arch"
            className="aspect-[4/3] rounded-[var(--radius-bento)]"
          />
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Add to home**

```tsx
import { EditorialSplit } from "@/components/home/EditorialSplit";
// ...
<EditorialSplit locale={locale} />
```

- [ ] **Step 3: Verify**

Open `/en` and `/es`. Expected: asymmetric 5/7 split with text on left, large editorial photo offset to the right and slightly down. Bloom hover on the image.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(home): editorial split section (story + storefront photo)"
```

---

## Task 17: Home — WeddingsTeaser

**Files:**
- Create: `components/home/WeddingsTeaser.tsx`
- Modify: `app/[locale]/page.tsx`

- [ ] **Step 1: Create `components/home/WeddingsTeaser.tsx`**

```tsx
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import type { Locale } from "@/types/locale";

export async function WeddingsTeaser({ locale }: { locale: Locale }) {
  const t = await getTranslations("home.weddings_teaser");
  return (
    <section className="relative py-16">
      <div className="max-w-[1400px] mx-auto px-6">
        <div className="relative overflow-hidden rounded-[var(--radius-bento)] aspect-[16/9] md:aspect-[21/9]">
          <img
            alt=""
            src="https://picsum.photos/seed/diva-wedding-arch/1800/900"
            className="absolute inset-0 size-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-ink/60 via-ink/20 to-transparent" />
          <div className="relative h-full flex flex-col justify-end p-8 md:p-14 text-bone">
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-bone/80">
              {t("eyebrow")}
            </p>
            <h2 className="font-display text-4xl md:text-6xl tracking-tighter leading-[0.98] mt-3 max-w-[16ch]">
              {t("title")}
            </h2>
            <Link
              href={`/${locale}/weddings`}
              className="mt-6 inline-flex w-fit font-sans text-sm tracking-tight px-5 py-3 rounded-full border border-bone/40 hover:border-bone/100 transition-colors"
            >
              {t("cta")} →
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Add to home**

```tsx
import { WeddingsTeaser } from "@/components/home/WeddingsTeaser";
// ...
<WeddingsTeaser locale={locale} />
```

- [ ] **Step 3: Verify**

Expected: full-bleed widescreen photo with overlay copy + ghost CTA. Crisp on mobile (`aspect-[16/9]`) and wider on `md+` (`aspect-[21/9]`).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(home): weddings teaser with full-bleed photo overlay"
```

---

## Task 18: Home — NewsletterField with success morph

**Files:**
- Create: `components/home/NewsletterField.tsx`
- Modify: `app/[locale]/page.tsx`

- [ ] **Step 1: Create `components/home/NewsletterField.tsx`**

```tsx
"use client";
import { memo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Check } from "@phosphor-icons/react/dist/ssr";

function NewsletterFieldImpl() {
  const t = useTranslations("home.newsletter");
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "submitting" | "success" | "error">("idle");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (state === "submitting") return;
    setState("submitting");
    // Plan 4 will replace this with /api/newsletter
    await new Promise((r) => setTimeout(r, 600));
    if (!email.includes("@")) {
      setState("error");
      return;
    }
    setState("success");
  };

  return (
    <section className="py-24">
      <div className="max-w-[1400px] mx-auto px-6 grid md:grid-cols-12 gap-10 items-end">
        <div className="md:col-span-5 space-y-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-mute-500">
            {t("eyebrow")}
          </p>
          <h2 className="font-display text-4xl md:text-6xl tracking-tighter leading-none">
            {t("title")}
          </h2>
        </div>
        <form onSubmit={onSubmit} className="md:col-span-7 relative min-h-[68px]">
          <AnimatePresence mode="wait">
            {state !== "success" && (
              <motion.div
                key="form"
                initial={{ opacity: 1 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className="flex items-end gap-4 border-b border-ink/20 pb-3"
              >
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("placeholder")}
                  className="flex-1 bg-transparent font-mono text-base placeholder:text-mute-400 outline-none py-2"
                  aria-label={t("placeholder")}
                  disabled={state === "submitting"}
                />
                <button
                  type="submit"
                  disabled={state === "submitting"}
                  className="font-sans text-sm tracking-tight px-5 py-3 rounded-full bg-ink text-bone hover:bg-rouge transition-colors disabled:opacity-50"
                >
                  {state === "submitting" ? "…" : t("cta")}
                </button>
              </motion.div>
            )}
            {state === "success" && (
              <motion.div
                key="success"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 200, damping: 14 }}
                className="flex items-center gap-3 text-rouge"
              >
                <span className="inline-flex items-center justify-center size-8 rounded-full bg-rouge text-bone">
                  <Check size={16} weight="bold" />
                </span>
                <span className="font-display text-2xl tracking-tighter">{t("success")}</span>
              </motion.div>
            )}
          </AnimatePresence>
          {state === "error" && (
            <p className="absolute -bottom-6 left-0 font-mono text-xs text-error">{t("error")}</p>
          )}
        </form>
      </div>
    </section>
  );
}

export const NewsletterField = memo(NewsletterFieldImpl);
```

- [ ] **Step 2: Add to home**

```tsx
import { NewsletterField } from "@/components/home/NewsletterField";
// ...
<NewsletterField />
```

- [ ] **Step 3: Verify**

Type a valid-looking email and submit. Expected: input collapses, a check + "Welcome aboard." morphs in with overshoot. Type something without `@` and submit: error message under the line in mono red.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(home): newsletter field with submit-success morph (stub)"
```

---

## Task 19: Verify reduced-motion + mobile collapse

**Files:**
- (No code changes — verification only)

- [ ] **Step 1: macOS — verify with reduced motion enabled**

System Settings → Accessibility → Display → "Reduce motion" ON. Reload `/en`. Expected:
- Arch outline appears already drawn (no draw animation).
- Marquee static.
- Bento featured tile not rocking.
- Live status not cycling.
- Subscriptions shimmer not running.
- Press carousel static.
- Magnetic buttons do NOT pull.
- Bloom hover does NOT zoom.

Turn reduced motion OFF.

- [ ] **Step 2: Verify mobile responsive**

In Chrome DevTools, switch to iPhone 14 Pro viewport. Reload `/en`.

Expected:
- Hero: text-first stacked, arch image below; `min-h-[100dvh]` fills the viewport without iOS Safari jump.
- Marquee scrolls smoothly.
- Bento collapses to single column, no horizontal scroll.
- Category strip remains horizontal-snap-scroll (intended).
- Footer stacks cleanly.
- No element overflows the viewport (`overflow-x` of body must be `hidden` if needed; check with DevTools — if a horizontal scrollbar appears, identify the culprit and fix).

- [ ] **Step 3: Add `overflow-x-hidden` safety to body if needed**

If horizontal overflow was observed in Step 2, edit `app/globals.css`:

```css
body { overflow-x: hidden; }
```

- [ ] **Step 4: Commit any fix**

If a fix was applied:

```bash
git add -A
git commit -m "fix(layout): prevent horizontal overflow on small viewports"
```

If no fix needed, skip the commit.

---

## Task 20: Playwright e2e — home renders in EN and ES, locale toggle works

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/e2e/home.spec.ts`
- Create: `tests/e2e/locale.spec.ts`
- Modify: `package.json` (add scripts)

- [ ] **Step 1: Install Playwright**

```bash
npm install -D @playwright/test
npx playwright install chromium
```

- [ ] **Step 2: Create `playwright.config.ts`**

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  retries: 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000/en",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});
```

- [ ] **Step 3: Add scripts to `package.json`**

In `scripts`:

```json
"e2e": "playwright test",
"e2e:ui": "playwright test --ui"
```

- [ ] **Step 4: Create `tests/e2e/home.spec.ts`**

```ts
import { test, expect } from "@playwright/test";

test("home renders in English with hero, marquee, bento", async ({ page }) => {
  await page.goto("/en");
  await expect(page.getByRole("heading", { level: 1, name: /Romance, by the stem/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Shop arrangements/ })).toBeVisible();
  // bento featured tile
  await expect(page.getByText("The Ingrid Bouquet")).toBeVisible();
  // category strip headline
  await expect(page.getByRole("heading", { name: /Find your bloom/ })).toBeVisible();
  // editorial split
  await expect(page.getByText(/Hempstead Turnpike/)).toBeVisible();
  // weddings teaser
  await expect(page.getByRole("heading", { name: /Installations, by Diva/ })).toBeVisible();
  // newsletter
  await expect(page.getByPlaceholder("you@email.com")).toBeVisible();
  // footer
  await expect(page.getByText("516 484 3456")).toBeVisible();
});

test("home renders in Spanish", async ({ page }) => {
  await page.goto("/es");
  await expect(page.getByRole("heading", { level: 1, name: /Romance, tallo a tallo/ })).toBeVisible();
  await expect(page.getByText(/Encuentra tu flor/)).toBeVisible();
});

test("home has no console errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  await page.goto("/en");
  await page.waitForLoadState("networkidle");
  expect(errors).toEqual([]);
});
```

- [ ] **Step 5: Create `tests/e2e/locale.spec.ts`**

```ts
import { test, expect } from "@playwright/test";

test("locale switcher navigates en → es", async ({ page }) => {
  await page.goto("/en");
  await page.getByLabel(/Switch language to ES/i).click();
  await expect(page).toHaveURL(/\/es/);
  await expect(page.getByRole("heading", { level: 1, name: /tallo a tallo/ })).toBeVisible();
});

test("root redirects to default locale", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/en/);
});
```

- [ ] **Step 6: Run e2e**

```bash
npm run e2e
```

Expected: all 5 tests pass. If a test fails, read the failure, fix the offending component or selector, re-run.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "test(e2e): playwright coverage for home en/es and locale switching"
```

---

## Task 21: Lighthouse smoke check

**Files:**
- (No code changes — verification only)

- [ ] **Step 1: Build + start production**

```bash
npm run build
npm run start &
```

The `&` runs in the background; note the PID printed. (Or open a new terminal.)

- [ ] **Step 2: Run Lighthouse on home (EN)**

```bash
npx lighthouse http://localhost:3000/en --only-categories=performance,accessibility,best-practices,seo --chrome-flags="--headless" --output=json --output-path=/tmp/lh-en.json --quiet
node -e "const r=require('/tmp/lh-en.json');console.log({perf:Math.round(r.categories.performance.score*100),a11y:Math.round(r.categories.accessibility.score*100),bp:Math.round(r.categories['best-practices'].score*100),seo:Math.round(r.categories.seo.score*100)})"
```

Expected target (per spec §12): `perf ≥ 95`, `a11y ≥ 100`, `bp ≥ 95`, `seo ≥ 95`.

- [ ] **Step 3: Note any failures**

If `a11y < 100`: open `/tmp/lh-en.json`, locate the failing audits (`accessibility.audits[*].score < 1`), and fix.

Common fixes:
- Add explicit `lang` attribute (already set in root `<html>`).
- Ensure all `<img>` has `alt`. The `<img alt="">` (empty) is correct for purely decorative images; Lighthouse accepts this.
- Color contrast issues: only `mute-500 / mute-600` on `bone` could be borderline — verify with DevTools contrast tool. If failing, swap to `mute-600` or darker.
- Missing form label association: ensure each `<input>` has either an associated `<label>` or `aria-label`.

- [ ] **Step 4: Stop server**

```bash
kill %1
```

(Or close the spare terminal where you ran `npm run start`.)

- [ ] **Step 5: Commit any a11y fixes**

If fixes were applied:

```bash
git add -A
git commit -m "fix(a11y): address Lighthouse accessibility findings on home"
```

---

## Task 22: Wire test scaffolding for Plan 3 (cart-store skeleton)

**Files:**
- Create: `tests/unit/cart-store.test.ts` (placeholder, ready for Plan 3)
- Create: `lib/cart-store.ts` (skeleton)

This task lays a thin scaffold so Plan 3 can land its full cart implementation without test-infra setup work.

- [ ] **Step 1: Install Zustand**

```bash
npm install zustand
```

- [ ] **Step 2: Create `lib/cart-store.ts` skeleton**

```ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type CartLine = {
  productId: string;
  variantId: string;
  addOnIds: string[];
  qty: number;
};

type CartState = {
  lines: CartLine[];
  add: (line: CartLine) => void;
  remove: (productId: string, variantId: string) => void;
  setQty: (productId: string, variantId: string, qty: number) => void;
  clear: () => void;
  count: () => number;
};

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      lines: [],
      add: (line) =>
        set((state) => {
          const existingIdx = state.lines.findIndex(
            (l) => l.productId === line.productId && l.variantId === line.variantId,
          );
          if (existingIdx >= 0) {
            const next = [...state.lines];
            next[existingIdx] = { ...next[existingIdx], qty: next[existingIdx].qty + line.qty };
            return { lines: next };
          }
          return { lines: [...state.lines, line] };
        }),
      remove: (productId, variantId) =>
        set((state) => ({
          lines: state.lines.filter((l) => !(l.productId === productId && l.variantId === variantId)),
        })),
      setQty: (productId, variantId, qty) =>
        set((state) => ({
          lines: state.lines
            .map((l) =>
              l.productId === productId && l.variantId === variantId ? { ...l, qty } : l,
            )
            .filter((l) => l.qty > 0),
        })),
      clear: () => set({ lines: [] }),
      count: () => get().lines.reduce((s, l) => s + l.qty, 0),
    }),
    { name: "diva-cart" },
  ),
);
```

- [ ] **Step 3: Create `tests/unit/cart-store.test.ts`** (covers the skeleton; Plan 3 expands)

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { useCartStore } from "@/lib/cart-store";

describe("cartStore", () => {
  beforeEach(() => {
    useCartStore.setState({ lines: [] });
    if (typeof localStorage !== "undefined") localStorage.clear();
  });

  it("adds a new line", () => {
    useCartStore.getState().add({ productId: "p1", variantId: "v1", addOnIds: [], qty: 1 });
    expect(useCartStore.getState().lines).toHaveLength(1);
  });

  it("merges qty when adding the same product+variant twice", () => {
    const { add } = useCartStore.getState();
    add({ productId: "p1", variantId: "v1", addOnIds: [], qty: 1 });
    add({ productId: "p1", variantId: "v1", addOnIds: [], qty: 2 });
    expect(useCartStore.getState().lines).toHaveLength(1);
    expect(useCartStore.getState().lines[0].qty).toBe(3);
  });

  it("treats different variants as separate lines", () => {
    const { add } = useCartStore.getState();
    add({ productId: "p1", variantId: "v1", addOnIds: [], qty: 1 });
    add({ productId: "p1", variantId: "v2", addOnIds: [], qty: 1 });
    expect(useCartStore.getState().lines).toHaveLength(2);
  });

  it("setQty to 0 removes the line", () => {
    const { add, setQty } = useCartStore.getState();
    add({ productId: "p1", variantId: "v1", addOnIds: [], qty: 2 });
    setQty("p1", "v1", 0);
    expect(useCartStore.getState().lines).toHaveLength(0);
  });

  it("count sums qty across lines", () => {
    const { add, count } = useCartStore.getState();
    add({ productId: "p1", variantId: "v1", addOnIds: [], qty: 2 });
    add({ productId: "p2", variantId: "v1", addOnIds: [], qty: 3 });
    expect(count()).toBe(5);
  });
});
```

- [ ] **Step 4: Run unit tests**

```bash
npm test
```

Expected: all unit tests pass (format: 7, motion-config: 3, cart-store: 5 = 15 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(cart): zustand cart store skeleton with unit tests (Plan 3-ready)"
```

---

## Task 23: README + final pre-flight check

**Files:**
- Create: `README.md`
- Modify: `.env.local.example`

- [ ] **Step 1: Create `.env.local.example`**

```bash
cat > .env.local.example <<'EOF'
# Diva Flowers — environment variables
# Copy to .env.local and fill in real values when wiring v2 services.

# Resend / Postmark (Plan 4)
RESEND_API_KEY=

# Stripe (Plan 3 v2 swap)
STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=

# Sanity / Payload (post-v1 CMS swap)
SANITY_PROJECT_ID=
SANITY_DATASET=
EOF
```

- [ ] **Step 2: Create `README.md`**

```markdown
# Diva Flowers

Bilingual e-commerce website for Diva Flowers, a Long Island floral studio.

## Stack

Next.js 15 · React 19 · TypeScript · Tailwind v4 · Framer Motion · next-intl · Zustand · Vitest · Playwright.

## Develop

```bash
npm install
npm run dev          # http://localhost:3000
npm test             # vitest unit tests
npm run e2e          # playwright e2e
npm run build        # production build
```

## Project layout

See `docs/superpowers/specs/2026-04-30-diva-flowers-design.md` for the full design spec and `docs/superpowers/plans/` for implementation plans.

## Brand framework

Built using the [taste-skill](https://github.com/Leonxlnx/taste-skill) framework (DESIGN_VARIANCE: 8 · MOTION_INTENSITY: 6 · VISUAL_DENSITY: 4). Reduced-motion preferences are honored throughout.

## Status

Plan 1 complete: foundation, brand system, bilingual home page.
```

- [ ] **Step 3: Run the taste-skill pre-flight checklist for Plan 1 surface**

Confirm each:

- [ ] Global state (cart store) is used to avoid prop drilling, not arbitrarily.
- [ ] Mobile layout collapse is guaranteed (`max-w-[1400px] mx-auto px-6`, `grid-cols-1 md:grid-cols-*`).
- [ ] All full-height sections use `min-h-[100dvh]` (Hero only; no `h-screen` anywhere — verify with `grep -r "h-screen" app components`).
- [ ] All `useEffect` animations have cleanup (`BentoLiveStatusTile` clears its interval; verify by re-reading the file).
- [ ] Empty/loading/error states present for the only async UI on the home page (`NewsletterField` covers idle, submitting, success, error).
- [ ] Cards omitted in favor of negative space where possible (Hero, EditorialSplit, NewsletterField use no cards).
- [ ] CPU-heavy perpetual animations are isolated in their own memoized client components (Featured/Subscriptions/Live/Press tiles, KineticMarquee, MagneticButton, BloomImage, SpotlightField — all are `memo()`-wrapped `'use client'` files).

- [ ] **Step 4: Search for forbidden patterns**

```bash
grep -RE "h-screen|font-\['Inter|#000000\b|emoji|✨|🌸|💐" app components || echo "OK — no forbidden patterns"
```

Expected: `OK — no forbidden patterns`. If any match, fix the offending file.

- [ ] **Step 5: Final verification — full home page render**

```bash
npm run dev
```

Walk the page top-to-bottom in `/en` and `/es`. Confirm:
- Arch SVG draws on first load.
- Magnetic CTAs respond to cursor.
- Spotlight follows cursor in hero.
- Marquee runs and reverses on scroll up.
- Bento has all 4 perpetual motions running.
- Categories scroll horizontally with bloom hover.
- Editorial split image has bloom hover.
- Newsletter morphs to success state on valid email.
- Footer renders with all site data.
- Locale toggle scrambles text and switches URL.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "docs: add README and complete Plan 1 pre-flight checklist"
```

---

## Plan 1 Done — Summary

**Shipped:**
- Next.js 15 App Router skeleton with Tailwind v4 token system, Fraunces / Cabinet Grotesk / JetBrains Mono fonts.
- Bilingual EN/ES routing with next-intl, locale switcher with text-scramble morph.
- Brand primitives: Wordmark, self-drawing Arch SVG, Grain overlay, Kinetic Marquee.
- Motion primitives: MagneticButton, BloomImage, StaggerGroup, SpotlightField — all memoized client leaves.
- Full home page: Hero, KineticMarquee, BentoGrid (Featured / Subscriptions / Live Status / Press tiles, all with perpetual micro-interactions), CategoryStrip, EditorialSplit, WeddingsTeaser, NewsletterField (with success morph).
- Site data file (address, phone, hours, zones, social, recent deliveries, press).
- Customized shadcn primitives: Button, Sheet, Input, Label.
- Cart store skeleton (Plan 3-ready) with unit tests.
- Format helpers (money, phone, delivery window) with unit tests.
- Playwright e2e: home in EN + ES, locale switching, no console errors.
- Lighthouse pass on home (target ≥ 95 perf / ≥ 100 a11y).
- Reduced-motion gate honored throughout.
- README + `.env.local.example` for v2 services.

**Next:** Plan 2 — Catalog & PDP. Adds product data layer, shop hub, category pages, sticky filter bar, sort, product grid, PDP with image stack + variants + delivery picker + accordion.
