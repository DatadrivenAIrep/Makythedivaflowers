# Maky → Diva Flowers Catalog Import — Design

**Status:** Proposed
**Date:** 2026-05-01
**Author:** Santiago + Claude
**Scope:** Import 95 product entries scraped from `makythedivagalaevents.com/shop` into the Diva Flowers Next.js catalog with enriched, SEO-optimized, neuromarketing-informed bilingual copy.

## 1. Goal

Take a flat scrape (name + photo + price for 95 products) and turn it into fully-formed Diva catalog entries that:

- Match the existing `Product` schema (`types/product.ts`).
- Carry rich bilingual copy (ES primary, EN adapted) tuned for conversion.
- Filter correctly across the existing facets (category, occasion, colorFamily, price band, tags).
- Pass type-checking and render at `/[locale]/product/[slug]` without runtime fallbacks.

## 2. Non-goals

- Building new filter facets, new categories, or new schema fields.
- Redesigning the PDP, grid, or filter UI.
- Replacing the existing 12 seed products — they coexist with the 95 imports.
- Synthesizing variant tiers (`grand`, `diva`) from a single source price (overreach).
- Adding subscriptions, plants, or sympathy products (none exist in the scrape).

## 3. Pricing & variants

**Rule:** One `standard` variant per product, priced at the exact Maky price.

**Exception:** The two "Designer's Choice" entries arrive with a `$55–$250` range from the source, so they are authored with three variants (`standard $55`, `grand $150`, `diva $250`).

**Rationale:** Inventing tiered prices that don't exist in the operation creates checkout-promise mismatch and is unrecoverable once orders flow. A single tier is honest and reversible — tiers can be added later when there is real cost data.

## 4. Image handling

- Move the 95 downloaded thumbnails into `public/products/<slug>.<ext>`.
- Reference as `src: "/products/<slug>.<ext>"` in product entries.
- Aspect: `4/5` for the cover (matches the grid default). Single image per product for the import (the source only provides one).
- The downloads in `/tmp/maky-shop-scrape/images` were resolved with a high-res-first strategy (strip `-300x300` from the WordPress URL, fall back to thumbnail). Most are full-size originals; thumbnails were the fallback for older media.
- Re-upload of higher-res or additional shots is a follow-up, not a blocker.

## 5. Category & filter mapping

### category (single value)

| Maky source category                                         | Diva `category`  |
| ------------------------------------------------------------ | ---------------- |
| Bouquets                                                     | `bouquets`       |
| Anniversary, Arrangements, Basket Arrangements, Exotic Arrangements | `arrangements`   |
| Designer's Choice                                            | `gifts`          |
| Birthday                                                     | `bouquets` if name suggests a hand-tied; `arrangements` otherwise |

### occasions (multi-value, never empty)

Inferred from name + source category:

- `romance` ← names containing Heart, Love, Romance, Roses, Altar, Garden Roses, Velvet
- `anniversary` ← Maky source category Anniversary
- `birthday` ← Maky source category Birthday + names with Sunshine, Pop, Fiesta, Bling
- `congrats` ← celebratory names (Cheers, Bling, Spring)
- `sympathy` ← (no clean matches in scrape; remain unmapped)
- `just-because` ← fallback so every product carries at least one occasion

### colorFamily (multi-value)

Inferred from product name keywords + thumbnail visual cue:

| Family    | Triggers                                              |
| --------- | ----------------------------------------------------- |
| `red`     | Ruby, Crimson, Red, Cardinal, "Roses" without color qualifier |
| `pink`    | Blush, Rose Pink, Magenta, Pink, Flamingo, Berry      |
| `white`   | White, Snow, Cloud, Pearl, Ivory                      |
| `green`   | Jungle, Monstera, Evergreen, Forest, Moss             |
| `pastel`  | Pastel, Soft, Lavender, Peach, Dusky                  |
| `mixed`   | Default fallback (most products)                      |

Multiple values allowed — e.g. "Ruby Altar" → `["red", "pink"]`.

### tags

- `same-day` — applied to all (matches the existing copy promise on Long Island).
- `staff-pick` — applied to ~6 high-margin/wow products selected during authoring.
- `seasonal` — applied to clearly seasonal names (Autumn, Winter, Holiday).
- `new` — applied only to Aug-2025-uploaded items (visible in the source URL).

## 6. Copy structure & voice

Each product carries five pieces of copy in two languages:

### `blurb` — ~14–18 words, one sentence

Sensory image + emotional hook. Drives the click on the grid.

> Estructura: \[material concreto\] + \[gesto/emoción\] + \[contexto silencioso\].

### `description` — 3 sentences, ~55–75 words. **A → B → C**

- **A — Atributo:** Qué es. Materiales, presentación, contexto.
- **B — Beneficio emocional:** Qué dice de quien lo regala / qué evoca al recibirlo.
- **C — Cierre de confianza:** Trust signal — entrega, frescura, hecho a mano, longevidad.

### `seo.title` — ≤60 chars

Pattern: `[Product Name] — [Primary Benefit] | Diva Flowers`.

### `seo.description` — ≤155 chars

Beneficio principal + ocasión + entrega. Implicit CTA, no exclamation marks.

### Image `alt`

Factual description of what the photo shows. Accessibility first, image SEO second.

### Voice rules

- **Banned words:** *hermoso, lindo, perfecto, increíble, único, especial, beautiful, perfect, amazing, unique, special* — empty intensifiers that lower conversion.
- **Verbs over adjectives.** Specific over generic.
- **Spanish first, English adapted.** Same gancho, not literal translation.
- **No invented stem counts** unless visible in the photo. Generic-but-honest beats specific-and-fictional.

### Neuromarketing levers (applied selectively, never all at once)

1. **Sensory anchoring** — visual/tactile verbs ("se levanta", "se posa", "envuelve").
2. **Social proof** — "nuestro más solicitado", "elegido por…" (only when true).
3. **Soft scarcity** — "edición de temporada", "disponibilidad limitada por temporada" (only for `seasonal` items).
4. **Buyer-identity affirmation** — frases que afirman al comprador ("para quien sabe que…").
5. **Asymmetric framing** — comparar con la alternativa ausente ("no son rosas de gasolinera, son rosas de jardín").

## 7. Existing products

The 12 existing seed products (Ruby Altar, etc.) **stay**. They occupy a premium tier with three variants and curated add-ons; the Maky imports occupy the operational tier. No deletions, no merges.

## 8. Pilot

Eight products selected for category/occasion/price coverage:

| # | Slug                    | Source price | Diva category   | Why in pilot                     |
| - | ----------------------- | ------------ | --------------- | -------------------------------- |
| 1 | a-thousand-heartbeats   | $255         | arrangements    | Romantic anniversary mid-tier    |
| 2 | dozen-roses-bouquet     | $105         | bouquets        | High-volume classic              |
| 3 | hundred-roses-vase      | $629         | arrangements    | Premium / wow factor             |
| 4 | sunburst-garden         | $150         | bouquets        | Birthday occasion                |
| 5 | rainforest-rhapsody     | $330         | arrangements    | Exotic / tropical aesthetic      |
| 6 | designers-choice        | $55–$250     | gifts           | Only multi-variant entry         |
| 7 | velvet-sun              | $75          | bouquets        | Low-price entry point            |
| 8 | katsobad                | $190         | arrangements    | Recent (Aug-2025) image          |

## 9. Acceptance criteria for the pilot

- All 8 products live in `data/products.ts`, syntactically valid TypeScript.
- `npm run typecheck` (or equivalent) passes.
- `npm run lint` passes.
- Each PDP route renders at `/en/product/<slug>` and `/es/product/<slug>` with no fallback strings — every text field populated in both locales.
- All 8 thumbnails accessible at `/products/<slug>.<ext>`.
- Each product has at least one `occasion` and one `colorFamily`.
- SEO title and description fit length budgets.
- Banned-word linter pass (manual): no copy contains the banned words listed above.

## 10. Rollout after pilot approval

1. Pilot review with user.
2. If voice approved → batch the remaining 87 products in groups of ~10–15, committing per batch so review is incremental and revertable.
3. Final pass: review all 95 entries in a single pass for tone consistency, run typecheck/lint, commit.
4. Smoke check on the catalog page (`/en/shop`, `/es/shop`) — filters work, no broken images, no untranslated strings.

## 11. Risks

- **Color inference from name alone is noisy.** Mitigation: also look at the thumbnail when authoring; default to `mixed` when unsure.
- **Inventing product details** (stem counts, vase materials) creates customer-promise risk. Mitigation: stay generic-but-honest; describe only what's visible in the photo.
- **Bulk-generating 95 products tempts shortcuts.** Mitigation: pilot establishes the bar; subsequent batches are reviewed against the pilot's output, not against an abstract spec.
- **English copy drifting into literal translation.** Mitigation: write English independently from Spanish, preserve emotional hook not syntax.

## 12. Out of scope (explicit)

- Per-product gallery (multiple shots) — single image only.
- Add-ons — none added to the 95 imports (existing products keep theirs).
- `pairsWith` — left unset on imports for now; can be populated as a follow-up once the catalog is in.
- Real-time inventory — `active: true` for all 95.
