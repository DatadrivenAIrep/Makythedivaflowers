# Diva Flowers v2 Roadmap

Items deferred from Plan 4 (launch-readiness polish). Each entry references the audit bullet that produced it.

## Motion

- Arch SVG section breaks — spec §4.5 calls for "subtle arched SVG section breaks" between major page sections; scope and placement TBD by design (audit §2.2)

## A11y

- Color-contrast audit — axe-core WCAG2A/AA/2.1 structural violations pass, but color-contrast violations were suppressed; run a dedicated contrast audit against the `rouge`, `ink`, and `mute` tokens (audit §2.3)

## SEO / Structured Data

_(No items deferred from Plan 4 — all SEO/structured-data findings were fixed in §2.4)_

## States

- Sold-out PDP — add `soldOut` boolean to product data model and render an in-page sold-out state instead of `notFound()` (audit §2.5)
- Delivery-zone-error PDP — address-validation API integration + inline error UI for addresses outside the delivery zone (audit §2.5)
- Loading skeletons for static routes — contact, story, journal index, journal/[slug], confirmation, account/*, legal pages are near-instant; defer loading.tsx until async data fetch is added (audit §2.5)
- Search empty state — no search UI exists; build search feature + empty-search state together (audit §2.5)

## Performance

- Hero LCP image — wire `<Image priority>` when real photography arrives; `Hero.tsx` currently renders gradient + `<ArchSVG>` ghost only (audit §2.7)
- Picsum placeholder replacement — swap `picsum.photos` calls (StudioMap and any remaining direct reads) with real assets via a centralized image facade (audit §2.7)
- Lighthouse manual baseline — run `next build && next start` triple-Lighthouse pass; record scores in the audit table at `docs/superpowers/audits/2026-05-01-plan-4-audit.md` (audit §2.7)
- Dynamic imports evaluation — re-evaluate `next/dynamic` for heavy motion components if framer-motion gets code-split in a future bundle analysis (audit §2.7)

## i18n

- FilterBar dictionary — migrate 25+ hardcoded `{ en, es }` filter/sort/occasion/color/size labels in `components/product/FilterBar.tsx` to `messages.shop.filters.*` (audit §2.8)
- EmptyFilterState strings — "Nothing matches yet", "Browse all", "No results" — tightly coupled to FilterBar refactor (audit §2.8)
- PdpConfigurator strings — "Size / Tamaño" and "First delivery / Primera entrega" section headings — batch with FilterBar (audit §2.8)
- SubscriptionCadence strings — "Cadence / Cadencia", "Weekly / Semanal", "Biweekly / Quincenal" — defer until subscription UI is finalized (audit §2.8)
- DeliveryDatePicker strings — "Delivery date / Fecha de entrega", "Today / Hoy", and dynamic copy — warrants its own task (audit §2.8)
- JournalTile strings — "From our journal / Del diario", "Read / Leer" (audit §2.8)
- AddOnToggles string — "Add-ons / Acompañamientos" single label (audit §2.8)
- ShopHubHero strings — eyebrow + body copy (audit §2.8)
- CategoryMosaic CTA — "Shop → / Ver →" (audit §2.8)
- CategoryStrip strings — eyebrow, "[hover to enter]", "Shop / Ver" (audit §2.8)

## Design / Taste

- WeddingsForm venue placeholder — move `placeholder="Glen Cove Mansion"` to `messages` when real client venue is confirmed (audit §2.8)
- Bilingual brand marks — `SAME-DAY DELIVERY` uppercase mark and marquee tokens are intentional; revisit if brand voice guidelines change (audit §2.8)
