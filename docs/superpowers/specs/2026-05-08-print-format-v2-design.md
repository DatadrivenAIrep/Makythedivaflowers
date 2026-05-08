# Print Format v2 — Editorial Worksheet + Greeting Card — Design Spec

**Date:** 2026-05-08
**Approach:** HTML + Puppeteer (`@sparticuz/chromium`) replaces `@react-pdf/renderer` as the PDF render engine. Letter landscape, single sheet, **duplex printing**, single vertical fold creates a 5.5"×4.25" greeting card.
**Scope:** Complete rewrite of `lib/print-render.tsx`. The rest of the v1 system (queue, API endpoints, Stripe webhook integration, Windows agent) is preserved unchanged except for one new duplex flag passed by the agent at print time.
**Stack:** `puppeteer-core` 23.x + `@sparticuz/chromium` (Vercel-serverless-compatible) + self-hosted Fraunces and Cabinet Grotesk fonts.

---

## 1. Context

The v1 system (specced 2026-05-07, implemented in 27 commits on `worktree-feat-print-orders`) ships an end-to-end auto-print pipeline: Stripe webhook → print queue → bearer-authed REST endpoints → Windows print agent → physical printer. It works mechanically, but its visual output is dramatically below the bar of competitive florist worksheets (Teleflora, FTD).

Two specific problems with the v1 renderer:

1. **`@react-pdf/renderer` is the wrong tool for designed output.** Its CSS subset can't reproduce gradient overlays, custom font variations, layered images, or the visual hierarchy needed for an editorial worksheet. v1 attempted a card with a Higgsfield-generated background; the library silently failed to embed/render the PNG, leaving the card half blank in production-grade printers.
2. **Portrait single-sided format wastes space.** v1 used a portrait Letter with a 50/50 vertical split (worksheet left, card right). The worksheet is cramped vertically and the card had no clean "front cover" because everything was on one printed side.

v2 keeps the entire v1 infrastructure (queue, API, webhook, agent — all 21 tasks) and replaces only the renderer internals. The `renderOrderPdf(order: Order): Promise<Buffer>` signature is identical, so consumers (queue + tests) need no changes.

## 2. Goals & Non-goals

### Goals
1. Output rivals editorial florist competitors (Teleflora-quality visual treatment).
2. Letter landscape layout uses the full 11" width for the worksheet and yields a properly-proportioned greeting card.
3. Greeting card has a printed front cover (artwork + Maky branding) and an interior message revealed only when opened — true two-fold-state behavior.
4. The print agent prints the resulting PDF in duplex (both sides) automatically; operator does not need to remember a setting.
5. Existing v1 tests for queue/API/webhook/agent continue to pass; only the renderer's own tests need updating.

### Non-goals (YAGNI)
- Per-occasion artwork variants (still v1-style: one card front for all occasions).
- Multi-page worksheets (long orders truncate cleanly; tabular overflow handled by font sizing).
- Worksheet-back content (back of worksheet half is intentionally blank in duplex).
- Migration of existing pending print jobs from v1 → v2 (any in-flight jobs at deploy time are reprintable from the dashboard once we land).
- Print preview UI on the website (operator sees the actual printout).
- Configurable card layouts. The format is fixed.

## 3. Final design

### 3.1 Sheet layout (Letter landscape, 11" × 8.5")

The sheet is divided horizontally at the middle (4.25"):

- **Top half (11" × 4.25") — Worksheet** (single-sided; back is blank)
- **Bottom half (11" × 4.25") — Card strip** (printed both sides; cut off, fold vertically at 5.5")

A dashed cut line at y=4.25" with `✂ recortar` markers on both ends indicates where to cut.

A dashed fold line at x=5.5" (within the bottom half only) with `↓ doblar ↓` and `↑ doblar ↑` markers indicates where to fold.

### 3.2 Worksheet (top half)

3-column grid filling 11" × 4.25":

**Column 1 (1.4fr) — Order header & delivery window**
- "Maky · The Diva Flowers" eyebrow (uppercase, Cabinet Grotesk, rouge `#B8345E`, 9pt, letter-spacing 2.5px)
- Order title: `Orden #ABCD1234` (Fraunces display, ~30pt, weight 600, opsz 96, letter-spacing -1px)
- Paid metadata: `Pagada: 8 may · 11:34 a.m.` + Stripe PI (Cabinet Grotesk, 10pt, mute-600)
- Delivery window block (auto-bottomed via flex): black background `#0E0D0C`, bone text, 8pt label + 13pt value, with TOTAL on a divider row inside the same block
- Right-side border separates this column from the next

**Column 2 (1fr) — Recipient & card message**
- Top section: "Entrega" pill + recipient name/phone/address. Background `--color-mute-100`, border `--color-petal`. (For pickup orders, the pill reads "Recoger en tienda" and the address is `data/site.ts` SITE.address.)
- Bottom section: "Mensaje de tarjeta" label + the customer's `cardMessage` rendered in Fraunces italic (font-display) at 12pt. Wrapped in quotes. Empty section omits cardMessage block (no placeholder).

**Column 3 (1fr) — Items & buyer**
- "Productos" label
- Items table: qty (18pt bold) | name + add-ons indented (10pt) | line total right-aligned (tabular-nums)
- Subtotal row with total breakdown (`Subt · Env · Tax`)
- Buyer block at bottom (auto-bottomed via flex): "Comprador" + email + phone, 8pt mute-600

**Worksheet localization.** All labels are looked up from a `T` table by `order.locale`. English variants:
- "Orden" → "Order", "Entrega" → "Deliver to", "Recoger en tienda" → "Pick up at shop"
- "Productos" → "Items", "Comprador" → "Buyer", "Mensaje de tarjeta" → "Card message"
- "Pagada" → "Paid", "Ventana" → "Window", "Subt · Env · Tax" → "Subt · Ship · Tax"

### 3.3 Card strip (bottom half) — duplex layout

The bottom 11"×4.25" is the card strip, printed on **both sides** of the paper. Fold direction is print-OUT (the printed front cover is on the outside of the folded card).

**Side A — visible at first print pass** (front of paper, same face as the worksheet):

| Region | Width | Purpose |
|---|---|---|
| LEFT panel (5.5"×4.25") | half-strip | Back cover of folded card. Bone background. Centered: small ornament `❀` (Fraunces, rouge), then small uppercase mark `maky · diva flowers` (Cabinet Grotesk, 8pt, mute-400), then optional `@makydivaflowers` handle. Quiet, elegant. |
| RIGHT panel (5.5"×4.25") | half-strip | Front cover of folded card. Full-bleed Higgsfield artwork (`card-bg-front.jpg` — option B from Higgsfield iteration v2). Bottom-anchored: Maky wordmark (Fraunces 38pt, opsz 144, weight 600, letter-spacing -1.5px) over a subtle bottom-fade gradient `linear-gradient(180deg, transparent 50%, rgba(250,246,240,0.55) 100%)`. Small "the diva flowers" tag below in Cabinet Grotesk 9pt rouge. |

**Side B — back of paper** (worksheet's reverse + interior of card):

| Region | Width | Purpose |
|---|---|---|
| Top half (full width × 4.25") | 11" | Intentionally blank. Back of the worksheet is not used (no production reason; deferred). |
| LEFT panel of bottom (5.5"×4.25") | half-strip | Inside-LEFT panel of the opened card. Bone background. Centered: `❀` ornament, the customer's `cardMessage` (Fraunces italic, 18pt, opsz 96, line-height 1.45, color ink), `❀` ornament. Mirrors the front cover's typographic confidence. Localized: same message, no label. |
| RIGHT panel of bottom (5.5"×4.25") | half-strip | Inside-RIGHT panel of the opened card. Bone background, blank (clean, lets the message breathe). Could host a small "— maky" sign-off in italic at lower right; we keep it blank in v2. |

**Why this geometry works.** When the bottom strip is cut off (11"×4.25") and folded vertically with print-side OUT, the LEFT-of-strip and RIGHT-of-strip panels become the two outside faces of the 5.5"×4.25" folded card. The Side B panels then face inward and become visible only when the card is opened (unfolded). The FRONT cover (right of strip on Side A) is what the recipient sees first; the message (left of strip on Side B) is the reveal.

### 3.4 Typography

| Use | Font | Source | Weight |
|---|---|---|---|
| Order title, Maky wordmark, card message, ornaments | Fraunces | Self-hosted in `public/fonts/Fraunces/` (download VF-italic + VF-roman) | 400, 500, 600 |
| Worksheet labels, body, eyebrow, pills, tags | Cabinet Grotesk | Already in `public/fonts/CabinetGrotesk/` | Regular (400), Medium (500), Bold (700) |

Fraunces is the project's `--font-display`. We register both VF files via `@font-face` in the print stylesheet and use `font-variation-settings: "opsz" 96` (or 144 for the wordmark) to pick the optical-size cut.

### 3.5 Color palette (Maky tokens, from `styles/tokens.css`)

| Name | Value | Where |
|---|---|---|
| `--color-rouge` | #B8345E | Brand accent, eyebrow text, pills, ornaments, fold-line |
| `--color-petal` | #F2C2D0 | Light accent for delivery section |
| `--color-bone` | #FAF6F0 | Sheet background, message panel background, back-cover panel |
| `--color-ink` | #0E0D0C | All body text, delivery window block background |
| `--color-lilac` | #C9B6D6 | (Available but not used in v2; part of brand palette) |
| `--color-mute-100..600` | F3EEE5 → 6B5F50 | Section backgrounds, borders, subtle text |

### 3.6 Card front artwork

`public/print/card-bg-front.jpg` — chosen from 4 Higgsfield candidates generated 2026-05-08. The chosen image (option B) features a central rouge peony with surrounding ranunculus, white roses, and eucalyptus, painted on a visible watercolor wash. 4:3 aspect ratio, 2400×1792px source, re-encoded for print as 800px-wide JPEG with profile stripped.

## 4. Architecture

### 4.1 Render pipeline

```
renderOrderPdf(order)
  ├─ build a single HTML document: worksheet (top) + card front (bottom-right) + back-cover (bottom-left) + cut/fold markers
  ├─ build a second HTML document: blank top + interior message (bottom-left) + blank inner-right
  ├─ launch headless Chromium via puppeteer-core + @sparticuz/chromium
  ├─ render each HTML to a PDF buffer (Letter landscape, 11"×8.5", margins: 0)
  ├─ merge the two PDF buffers into a single 2-page PDF using pdf-lib
  └─ return Buffer
```

The 2-page PDF is what gets printed in duplex. Page 1 = front of paper (worksheet + card front+back-cover), Page 2 = back of paper (blank + card interior).

### 4.2 New files

| File | Purpose |
|---|---|
| `lib/print-render.tsx` | Replaced. Now exports `renderOrderPdf(order): Promise<Buffer>`. Internally orchestrates HTML build + Chromium + pdf-lib merge. |
| `lib/print-render-html.tsx` | Pure functions returning HTML strings: `buildSideAHtml(order)`, `buildSideBHtml(order)`. JSX components rendered to string via `renderToStaticMarkup`. |
| `lib/print-chromium.ts` | Singleton-style Chromium launcher: lazily-initialized browser instance, reused across requests. Handles Vercel-vs-local detection (`@sparticuz/chromium` vs system Chrome). |
| `public/print/card-bg-front.jpg` | The Higgsfield artwork (option B, re-encoded). Replaces `card-bg-default.png`. |
| `public/fonts/Fraunces/Fraunces-VariableFont_SOFT,WONK,opsz,wght.ttf` | Self-hosted variable font — roman. Downloaded from Google Fonts. |
| `public/fonts/Fraunces/Fraunces-Italic-VariableFont_SOFT,WONK,opsz,wght.ttf` | Self-hosted variable font — italic. |

### 4.3 Modified files

| File | Change |
|---|---|
| `package.json` | Remove `@react-pdf/renderer`. Add `puppeteer-core@^23`, `@sparticuz/chromium@^131`, `pdf-lib@^1.17`. |
| `tools/print-agent/src/print.ts` | Pass `--print-settings duplex=long-edge` (or equivalent platform flag) to `pdf-to-printer` so jobs default to two-sided long-edge binding. Existing single-sided behavior is removed; duplex is the only mode in v2. |
| `tools/print-agent/README.md` | New section: "Configurar impresora para duplex automático". Operator-facing guide to ensure the printer's "Print on both sides" default is enabled at install; verification step with a duplex test print. |
| `lib/print-render.tsx` | Wholesale replacement (vs incremental edit) — old @react-pdf/renderer JSX deleted. |
| `tests/unit/print-render.test.ts` | Updated assertions: `extractText` still works (Chromium-rendered PDFs are also FlateDecode + TJ/Tj — the existing extractor handles both). New tests for: page count = 2, side B contains cardMessage, side B does NOT contain order id (sanity check that worksheet info isn't on the back). |
| `tests/unit/helpers/pdf-text.ts` | Re-validate against Chromium output. May need a small extension to handle Type1 vs Type0 font encoding differences. |

### 4.4 Files NOT changed

- `lib/print-queue.ts` — no change. Same `enqueuePrintJob(order)` API, same state machine.
- `lib/print-auth.ts` — no change.
- `app/api/print/queue/route.ts`, `app/api/print/jobs/[id]/ack/route.ts`, `app/api/print/health/route.ts` — no change. Renderer is invoked by `enqueuePrintJob`, transparently from these.
- `app/api/stripe/webhook/route.ts` — no change. Already calls `enqueuePrintJob(order)`.
- `tools/print-agent/src/api.ts`, `poll.ts`, `index.ts`, `config.ts`, `log.ts` — no change.
- `tools/print-agent/src/test-print.ts` — no change.
- `tools/print-agent/install-service.js`, `uninstall-service.js` — no change.

## 5. Chromium runtime strategy

`@sparticuz/chromium` is the production package designed for AWS Lambda / Vercel serverless. It bundles a stripped-down Chromium build (~50MB) that fits in the function size limit.

### 5.1 Local dev

When `process.env.NODE_ENV !== "production"` and an env var like `PUPPETEER_EXECUTABLE_PATH` is set, use the system Chrome/Chromium for faster iteration and smaller node_modules. Otherwise fall back to `@sparticuz/chromium`.

### 5.2 Production (Vercel)

```ts
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";

const browser = await puppeteer.launch({
  args: chromium.args,
  defaultViewport: chromium.defaultViewport,
  executablePath: await chromium.executablePath(),
  headless: chromium.headless,
});
```

A module-level cache holds the browser instance; subsequent renders reuse it (typical Lambda warm-instance behavior). On cold start, launch takes ~2s; warm renders are ~500ms.

### 5.3 Fonts inside Chromium

Fonts are loaded via `@font-face` inside the rendered HTML. Chromium reads them directly from `file://` URLs pointing into `public/fonts/`. Using `puppeteer.page.setContent(html, { waitUntil: "networkidle0" })` ensures fonts finish loading before PDF generation.

## 6. Duplex printing on the agent

`pdf-to-printer` accepts a `printDialog: false` and additional CLI flags. To force duplex, the agent will call:

```ts
await pdfPrint(tmpPath, {
  printer: PRINTER_NAME,
  // PDFtoPrinter.exe (the underlying tool on Windows) supports -print-settings.
  // Long-edge is the default for landscape book-style binding.
  printDialog: false,
  win32: ['-print-settings', 'duplex=long-edge,paper=letter,fit=true'],
});
```

The exact flag syntax depends on the PDFtoPrinter version that the npm package wraps. Verification step at implementation time: run the test-print script with a 2-page PDF and confirm both pages print on opposite sides of one sheet.

If the printer doesn't support automatic duplex, the operator falls back to manual duplex (printer setting "Print on both sides — flip on long edge, manually feed back"). This is documented in the agent README but not the default flow.

## 7. Migration from v1 to v2

v1 is on the same branch (`worktree-feat-print-orders`) as v2 will be. We have not deployed v1 to production. Migration is therefore a code change only, not a data migration.

Steps at implementation time:
1. Rip out `@react-pdf/renderer` from `package.json`. The single file that imports it (`lib/print-render.tsx`) is being replaced.
2. The existing `print-render.test.ts` from v1 is mostly behavior-driven (extractText assertions on the rendered PDF). Many assertions will continue to pass against the Chromium-rendered output. Adjust assertions for: removed `OrderTicket` text patterns that were specific to @react-pdf, addition of new text that comes from the new layout, page count change (1 → 2).
3. Replace the `lib/print-render.tsx` body (don't preserve any imports from @react-pdf).
4. Update `tools/print-agent/src/print.ts` to pass duplex flag. Add a corresponding test to `pdf-to-printer` mock.
5. Re-render a sample PDF locally and visually confirm it matches the approved mockup (`docs/superpowers/specs/2026-05-08-print-format-v2-design.md` and the brainstorm screen in `.superpowers/brainstorm/.../09-approved-summary.html`).
6. Run the full unit suite. The pre-existing `subscription-inquiry-schema.test.ts:59` flake is irrelevant.

## 8. Testing

### Unit tests (Vitest)

`tests/unit/print-render.test.ts` (rewritten):
- **renders 2-page LETTER landscape PDF** — assert `/Count 2`, MediaBox dimensions correspond to 11×8.5.
- **page 1 (Side A) contains order id, total, recipient, items, buyer, Stripe PI, "maky"** — `extractText(pdf, page=1)` includes all these.
- **page 1 contains the card front artwork wordmark "maky" in Fraunces display size** — text "maky" appears in the rendered output.
- **page 1 does NOT contain the customer's cardMessage** — message lives on page 2 only.
- **page 2 (Side B) contains the customer's cardMessage** — `extractText(pdf, page=2)`.
- **page 2 does NOT contain the order id** — back of worksheet is blank.
- **localization (locale=en)** — page 1 contains "PICK UP AT SHOP" or "DELIVER TO"; not "RECOGER" or "ENTREGAR A".
- **localization (locale=es)** — inverse.
- **empty cardMessage** — message panel renders without the message text but the page is still valid.
- **delivery vs pickup** — both branches render correctly.

`tests/unit/print-chromium.test.ts` (new): smoke test that the launcher returns a usable browser and can render a trivial HTML to PDF buffer.

### Integration / manual

- Run a sample render via Vitest test that writes to `/tmp/sample-front.pdf` and `/tmp/sample-back.pdf` (or the merged `sample.pdf`); open in Preview, visually confirm the layout matches `09-approved-summary.html`.
- On the shop computer (manual): operator runs `npm run test-print` with the v2 agent. Should print a 2-page test sheet on duplex.

## 9. Performance & cost

- **Render time per order**: ~500ms warm, ~2s cold start. Well below Stripe webhook timeout (5s).
- **Memory**: Chromium adds ~150MB to the Vercel function. Within free-tier limits.
- **PDF size**: ~300-500KB per order (Higgsfield artwork is JPEG, ~150KB). Roughly the same as v1.
- **Higgsfield credits**: spent during this brainstorm to generate v2 candidates. No ongoing cost.

## 10. Open questions

- **Printer model.** Does the Maky shop printer support automatic duplex? Most modern HP/Brother/Epson office printers do. Verify at install time. If not, the agent prints page 1 then prompts the operator to flip and re-feed for page 2 (manual duplex). This is a degraded path; v2's default assumes automatic.
- **Long card messages.** The interior message panel is 5.5"×4.25" with ~3.5" of usable width after padding. Auto-shrink rules: 18pt for ≤120 chars, 14pt for ≤220, 12pt for >220. Hard cap on `cardMessage` length is set in `schemas/checkout.ts` (verify at implementation time; expand if needed).
- **Fraunces font weight licensing.** Fraunces is OFL-1.1 (open, free for commercial use, no special steps).

## 11. Deferred to v3

- Per-occasion artwork variants (7 variants from the original spec).
- Worksheet back content (operator notes, care instructions, QR code to order).
- Multi-page card option (e.g., A6 fold for very long messages).
- Operator preview UI on the website.
