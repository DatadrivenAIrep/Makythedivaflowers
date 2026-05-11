# Print Format v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `lib/print-render.tsx` (currently using `@react-pdf/renderer`) with an HTML+Puppeteer renderer that produces a 2-page duplex PDF: page 1 = worksheet (top) + card front + back-cover (bottom), page 2 = blank top + card interior message (bottom). Folded card is 5.5"×4.25" with art on the front and message hidden inside.

**Architecture:** Two pure HTML-builder functions (`buildSideAHtml`, `buildSideBHtml`) produce full Letter-landscape HTML documents with embedded CSS and `@font-face` rules. A singleton `print-chromium.ts` launches headless Chromium (via `puppeteer-core` + `@sparticuz/chromium` for Vercel-serverless compatibility, or system Chrome locally). The orchestrator renders each HTML to a PDF buffer with `page.pdf({ format: "Letter", landscape: true, printBackground: true, margin: 0 })` and merges them via `pdf-lib` into one 2-page Buffer. The `renderOrderPdf(order): Promise<Buffer>` signature is unchanged from v1, so the queue, API routes, webhook integration, and Windows agent require no changes except a duplex flag passed at print time.

**Tech Stack:** Next.js 16 + React 19 (`renderToStaticMarkup`) + Vitest + `puppeteer-core@^23` + `@sparticuz/chromium@^131` + `pdf-lib@^1.17`. Self-hosted Fraunces (Google Fonts, OFL-1.1) and Cabinet Grotesk (already in project).

**Spec:** [docs/superpowers/specs/2026-05-08-print-format-v2-design.md](../specs/2026-05-08-print-format-v2-design.md)

---

## File map

**Create:**
- `lib/print-chromium.ts` — singleton Chromium launcher
- `lib/print-styles.ts` — CSS string with brand tokens, `@font-face` rules, layout for both pages
- `lib/print-render-html.tsx` — JSX components, exports `buildSideAHtml(order): string`, `buildSideBHtml(order): string`, `T` localization table
- `public/fonts/Fraunces/Fraunces-VF.ttf` — variable font, roman
- `public/fonts/Fraunces/Fraunces-Italic-VF.ttf` — variable font, italic
- `public/print/card-bg-front.jpg` — Higgsfield option B re-encoded
- `tests/unit/print-chromium.test.ts` — launcher smoke test

**Modify:**
- `lib/print-render.tsx` — wholesale replacement: imports the launcher and HTML builders, renders both pages, merges via pdf-lib, returns Buffer
- `tests/unit/print-render.test.ts` — rewrite assertions for the new 2-page output
- `tests/unit/helpers/pdf-text.ts` — extend for per-page extraction (`extractText(pdf, pageIndex?)`)
- `package.json` — add `puppeteer-core`, `@sparticuz/chromium`, `pdf-lib`; remove `@react-pdf/renderer`
- `tools/print-agent/src/print.ts` — pass duplex flag in `pdfPrint(...)` options
- `tools/print-agent/README.md` — append duplex setup section

**Delete:**
- `public/print/card-bg-default.png` — replaced by `card-bg-front.jpg`
- `public/print/logo-mark.png` — no longer used (logo rendered as Fraunces text in v2)
- `public/print/card-bg-default.jpg` — leftover from v1 debugging

---

## Conventions

- Test runner: `vitest run`. Shorthand: `pnpm test <path>`.
- Module mocks: same patterns as v1 (`vi.mock`, `vi.stubEnv`, `__resetRateLimitForTests` if needed).
- Test storage isolation: not applicable here (no on-disk side effects from the renderer).
- Imports use `@/` alias.
- Commits prefixed with `feat(print)`, `refactor(print)`, `docs(print-agent)`, etc., matching the existing v1 history on this branch.
- TDD where it gives signal (the renderer is heavily integration-tested; pure HTML builder functions are unit-testable).
- Pre-existing failure in `tests/unit/subscription-inquiry-schema.test.ts:59` is unrelated and ignored.

---

## Phase A — Setup: deps, fonts, artwork

### Task 1: Install Puppeteer + Chromium + pdf-lib; remove @react-pdf/renderer

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml`

- [ ] **Step 1: Remove the old dep**

```bash
pnpm remove @react-pdf/renderer
```

Expected: `@react-pdf/renderer` removed from `dependencies`.

- [ ] **Step 2: Add the new deps**

```bash
pnpm add puppeteer-core@^23 @sparticuz/chromium@^131 pdf-lib@^1.17
```

Expected: three packages added under `dependencies`. `@sparticuz/chromium` will print a postinstall warning about Chrome download — that's expected.

- [ ] **Step 3: Verify the swap**

```bash
grep -E "@react-pdf|puppeteer-core|sparticuz|pdf-lib" package.json
```

Expected output: lines for `puppeteer-core`, `@sparticuz/chromium`, `pdf-lib`. NO line for `@react-pdf/renderer`.

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "feat(print): swap @react-pdf/renderer for puppeteer-core + chromium + pdf-lib"
```

---

### Task 2: Add self-hosted Fraunces variable fonts

**Files:**
- Create: `public/fonts/Fraunces/Fraunces-VF.ttf`
- Create: `public/fonts/Fraunces/Fraunces-Italic-VF.ttf`
- Create: `public/fonts/Fraunces/OFL.txt`

Fraunces is OFL-1.1 (open license). Direct download from the Fraunces GitHub raw URL.

- [ ] **Step 1: Make the directory**

```bash
mkdir -p public/fonts/Fraunces
```

- [ ] **Step 2: Download the fonts**

```bash
cd public/fonts/Fraunces && \
  curl -L -o Fraunces-VF.ttf https://github.com/undercasetype/Fraunces/raw/main/fonts/variable/Fraunces%5BSOFT%2CWONK%2Copsz%2Cwght%5D.ttf && \
  curl -L -o Fraunces-Italic-VF.ttf https://github.com/undercasetype/Fraunces/raw/main/fonts/variable/Fraunces-Italic%5BSOFT%2CWONK%2Copsz%2Cwght%5D.ttf && \
  curl -L -o OFL.txt https://github.com/undercasetype/Fraunces/raw/main/OFL.txt && \
  cd -
```

- [ ] **Step 3: Verify**

```bash
ls -la public/fonts/Fraunces/ && file public/fonts/Fraunces/Fraunces-VF.ttf
```

Expected:
- `Fraunces-VF.ttf` and `Fraunces-Italic-VF.ttf` both present, > 200 KB each
- `file` reports them as `TrueType Font data`
- `OFL.txt` present

If any download fails, also try the alternate URL: `https://fonts.gstatic.com/s/fraunces/...` — but the GitHub URL is canonical. If GitHub itself is unreachable, report BLOCKED.

- [ ] **Step 4: Commit**

```bash
git add public/fonts/Fraunces/
git commit -m "feat(print): add self-hosted Fraunces variable fonts (OFL-1.1)"
```

---

### Task 3: Replace card-bg artwork with Higgsfield v2 option B as JPEG

**Files:**
- Create: `public/print/card-bg-front.jpg`
- Delete: `public/print/card-bg-default.png`, `public/print/card-bg-default.jpg`, `public/print/logo-mark.png`

The chosen artwork (option B) lives at `.superpowers/brainstorm/*/content/v2.png` (committed-by-brainstorm-server) — copy it from there. As a fallback, it also exists at `/tmp/maky-card-v2/v2.png` if the brainstorm directory has been cleaned.

- [ ] **Step 1: Locate source and re-encode to JPEG with sharp (single bash session)**

`sharp` is already an `optionalDependency` in `package.json` (line `"sharp"` under `pnpm.onlyBuiltDependencies`). It should be installed in `node_modules`.

```bash
SRC=$(ls .superpowers/brainstorm/*/content/v2.png 2>/dev/null | head -1)
[ -z "$SRC" ] && SRC=/tmp/maky-card-v2/v2.png
echo "Using source: $SRC"
ls -la "$SRC" || { echo "SOURCE NOT FOUND — report BLOCKED"; exit 1; }

SRC="$SRC" node -e "
const sharp = require('sharp');
const src = process.env.SRC;
sharp(src)
  .resize(1100, null, { fit: 'inside' })
  .jpeg({ quality: 85, mozjpeg: true })
  .toFile('public/print/card-bg-front.jpg')
  .then(info => console.log('OK', info))
  .catch(err => { console.error('ERR', err); process.exit(1); });
"
```

Expected: prints a source path, an `ls` listing of a ~7 MB PNG, then `OK { width: 1100, ... }`. File `public/print/card-bg-front.jpg` written.

If sharp isn't available (`Cannot find module 'sharp'`): `pnpm add sharp` then retry the node call.

If neither source path has the file, report BLOCKED — the user needs to regenerate via Higgsfield.

- [ ] **Step 2: Verify**

```bash
file public/print/card-bg-front.jpg && ls -la public/print/card-bg-front.jpg
```

Expected: JPEG, ~150-200 KB, ~1100px wide.

- [ ] **Step 3: Delete the old assets**

```bash
git rm -f public/print/card-bg-default.png public/print/card-bg-default.jpg public/print/logo-mark.png 2>/dev/null
# If git rm warns about untracked files, fall back to plain rm:
rm -f public/print/card-bg-default.png public/print/card-bg-default.jpg public/print/logo-mark.png
```

- [ ] **Step 4: Commit**

```bash
git add public/print/card-bg-front.jpg public/print/
git commit -m "feat(print): replace card-bg artwork with Higgsfield v2 (option B, JPEG)"
```

---

## Phase B — Chromium launcher

### Task 4: Build the singleton Chromium launcher

**Files:**
- Create: `lib/print-chromium.ts`
- Create: `tests/unit/print-chromium.test.ts`

- [ ] **Step 1: Write the smoke test**

Create `tests/unit/print-chromium.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { renderHtmlToPdf } from "@/lib/print-chromium";

describe("renderHtmlToPdf", () => {
  it("returns a non-empty PDF buffer for a trivial HTML document", async () => {
    const html = `<!doctype html><html><head><meta charset="utf-8"></head><body><p>hello chromium</p></body></html>`;
    const buf = await renderHtmlToPdf(html);
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(500);
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
  }, 30_000); // chromium cold start can take 5-10s
});
```

- [ ] **Step 2: Run, expect fail (module missing)**

```bash
pnpm test tests/unit/print-chromium.test.ts
```

Expected: FAIL — `Failed to resolve import "@/lib/print-chromium"`.

- [ ] **Step 3: Implement the launcher**

Create `lib/print-chromium.ts`:

```ts
// lib/print-chromium.ts
// Singleton-style Chromium launcher. Re-uses one browser instance across
// renders to avoid the ~2s cold-start cost on every order.
//
// Local dev: uses system Chrome via PUPPETEER_EXECUTABLE_PATH if set,
// otherwise falls back to @sparticuz/chromium for parity with prod.
//
// Production (Vercel serverless): uses @sparticuz/chromium's bundled binary.
import "server-only";
import puppeteer, { type Browser } from "puppeteer-core";
import chromium from "@sparticuz/chromium";

let browserPromise: Promise<Browser> | null = null;

async function getBrowser(): Promise<Browser> {
  if (browserPromise) return browserPromise;

  const localPath = process.env.PUPPETEER_EXECUTABLE_PATH;
  const isLocalDev = process.env.NODE_ENV !== "production" && !!localPath;

  browserPromise = puppeteer.launch({
    args: chromium.args,
    defaultViewport: { width: 1100, height: 850 },
    executablePath: isLocalDev ? localPath : await chromium.executablePath(),
    headless: true,
  });
  return browserPromise;
}

export async function renderHtmlToPdf(html: string): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdf = await page.pdf({
      format: "Letter",
      landscape: true,
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    // Puppeteer returns Uint8Array; normalize to Buffer.
    return Buffer.isBuffer(pdf) ? pdf : Buffer.from(pdf);
  } finally {
    await page.close();
  }
}

// For tests + graceful shutdown.
export async function __closeBrowser(): Promise<void> {
  if (!browserPromise) return;
  const b = await browserPromise;
  browserPromise = null;
  await b.close();
}
```

- [ ] **Step 4: Run the test (cold start)**

```bash
pnpm test tests/unit/print-chromium.test.ts
```

Expected: PASS. The first run downloads/extracts the @sparticuz/chromium binary on macOS — this can take 30-60s. Subsequent runs are ~2-5s.

If the test fails with `Could not find Chrome (ver. ...)`: this is a `puppeteer-core` issue and means `chromium.executablePath()` returned an invalid path. Set `PUPPETEER_EXECUTABLE_PATH=/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` (mac) and re-run. Document this in step 5 if you had to use the env var.

- [ ] **Step 5: Commit**

```bash
git add lib/print-chromium.ts tests/unit/print-chromium.test.ts
git commit -m "feat(print): chromium launcher singleton with renderHtmlToPdf"
```

---

## Phase C — HTML stylesheet

### Task 5: Build the print stylesheet (CSS string)

**Files:**
- Create: `lib/print-styles.ts`

The stylesheet is a single CSS string baked into both Side A and Side B HTML documents. Self-contained — no external links — so Chromium needs no network.

- [ ] **Step 1: Create the file**

```ts
// lib/print-styles.ts
// CSS for the print PDF. Self-contained (no external links). Inlined into
// the HTML documents that get rendered by Chromium. Brand tokens come from
// styles/tokens.css; we duplicate the literal hex values here so the
// renderer doesn't depend on the Next.js build system.

import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";

function fontDataUri(relPath: string): string {
  const abs = path.join(process.cwd(), relPath);
  const buf = readFileSync(abs);
  return `data:font/ttf;base64,${buf.toString("base64")}`;
}

function imageDataUri(relPath: string): string {
  const abs = path.join(process.cwd(), relPath);
  const buf = readFileSync(abs);
  return `data:image/jpeg;base64,${buf.toString("base64")}`;
}

// Lazy: compute once on first call, cache forever.
let cached: string | null = null;
let cachedBg: string | null = null;

export function getCardBgDataUri(): string {
  if (cachedBg !== null) return cachedBg;
  cachedBg = imageDataUri("public/print/card-bg-front.jpg");
  return cachedBg;
}

export function getPrintStyles(): string {
  if (cached !== null) return cached;

  const fraunces = fontDataUri("public/fonts/Fraunces/Fraunces-VF.ttf");
  const fraunceItalic = fontDataUri("public/fonts/Fraunces/Fraunces-Italic-VF.ttf");
  const cabinetReg = fontDataUri("public/fonts/CabinetGrotesk/Regular.woff2");
  const cabinetMed = fontDataUri("public/fonts/CabinetGrotesk/Medium.woff2");
  const cabinetBold = fontDataUri("public/fonts/CabinetGrotesk/Bold.woff2");

  cached = `
    @font-face {
      font-family: "Fraunces";
      src: url(${fraunces}) format("truetype-variations");
      font-weight: 100 900;
      font-style: normal;
      font-display: swap;
    }
    @font-face {
      font-family: "Fraunces";
      src: url(${fraunceItalic}) format("truetype-variations");
      font-weight: 100 900;
      font-style: italic;
      font-display: swap;
    }
    @font-face { font-family: "Cabinet Grotesk"; src: url(${cabinetReg}) format("woff2"); font-weight: 400; font-style: normal; }
    @font-face { font-family: "Cabinet Grotesk"; src: url(${cabinetMed}) format("woff2"); font-weight: 500; font-style: normal; }
    @font-face { font-family: "Cabinet Grotesk"; src: url(${cabinetBold}) format("woff2"); font-weight: 700; font-style: normal; }

    :root {
      --rouge: #B8345E;
      --petal: #F2C2D0;
      --bone: #FAF6F0;
      --ink: #0E0D0C;
      --lilac: #C9B6D6;
      --mute-100: #F3EEE5;
      --mute-200: #E8DDC8;
      --mute-400: #B8A99A;
      --mute-600: #6B5F50;
      --font-display: "Fraunces", Georgia, serif;
      --font-sans: "Cabinet Grotesk", -apple-system, system-ui, sans-serif;
    }

    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body { font-family: var(--font-sans); color: var(--ink); -webkit-print-color-adjust: exact; print-color-adjust: exact; }

    /* Sheet */
    .sheet {
      width: 11in; height: 8.5in;
      display: flex; flex-direction: column;
      background: var(--bone);
      position: relative;
      overflow: hidden;
    }
    .cut-h { position: absolute; left: 0; right: 0; top: 4.25in; border-top: 1px dashed var(--mute-400); z-index: 5; }
    .cut-marker {
      position: absolute; top: 4.25in; transform: translateY(-50%);
      background: var(--bone); padding: 2px 8px;
      font-size: 8pt; color: var(--mute-400); z-index: 6;
      letter-spacing: 1.5px; text-transform: uppercase; font-family: var(--font-sans);
    }
    .cut-marker.left { left: 0.15in; }
    .cut-marker.right { right: 0.15in; }

    /* === Worksheet (top half) === */
    .worksheet {
      flex: 1;
      padding: 0.3in 0.4in;
      display: grid;
      grid-template-columns: 1.4fr 1fr 1fr;
      gap: 0.18in;
      overflow: hidden;
    }
    .ws-col { display: flex; flex-direction: column; gap: 0.1in; }
    .ws-col.meta { border-right: 1px solid var(--mute-200); padding-right: 0.18in; }
    .ws-brand { font-size: 8pt; text-transform: uppercase; letter-spacing: 2.5px; font-weight: 600; color: var(--rouge); }
    .ws-title {
      font-family: var(--font-display);
      font-size: 30pt; font-weight: 600; line-height: 0.95; margin: 0; letter-spacing: -1px;
      font-variation-settings: "opsz" 96;
    }
    .ws-paid { font-size: 9pt; color: var(--mute-600); line-height: 1.45; }
    .ws-paid strong { color: var(--ink); font-weight: 600; }
    .ws-window {
      background: var(--ink); color: var(--bone);
      padding: 0.1in 0.14in; border-radius: 4pt; margin-top: auto;
    }
    .ws-window .lbl { font-size: 7pt; text-transform: uppercase; letter-spacing: 1.5px; opacity: 0.65; }
    .ws-window .val-time { font-size: 13pt; font-weight: 600; margin-top: 1pt; }
    .ws-window .total-row {
      display: flex; justify-content: space-between;
      margin-top: 5pt; padding-top: 5pt;
      border-top: 1px solid rgba(250,246,240,0.18);
    }
    .ws-window .total-row .val { font-size: 13pt; font-weight: 600; }

    .ws-section { border: 1px solid var(--mute-200); border-radius: 4pt; padding: 0.1in 0.14in; background: #fff; }
    .ws-section.accent { background: var(--mute-100); border-color: var(--petal); }
    .pill {
      display: inline-block; background: var(--rouge); color: var(--bone);
      font-size: 7pt; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px;
      padding: 2pt 6pt; border-radius: 8pt; margin-bottom: 4pt;
    }
    .ws-section-label { font-size: 7pt; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 700; color: var(--rouge); margin-bottom: 3pt; }
    .ws-section p { margin: 0; font-size: 9pt; line-height: 1.4; }
    .ws-section p strong { font-weight: 600; }
    .ws-msg-quote {
      font-family: var(--font-display);
      font-style: italic; font-size: 11pt; line-height: 1.4;
      font-variation-settings: "opsz" 60;
    }
    .ws-items table { width: 100%; font-size: 9pt; border-collapse: collapse; }
    .ws-items td { padding: 2pt 0; vertical-align: top; }
    .ws-items td.qty { width: 18pt; font-weight: 700; }
    .ws-items td.price { text-align: right; font-variant-numeric: tabular-nums; width: 50pt; }
    .ws-items .addon { font-size: 8pt; color: var(--mute-600); padding-left: 8pt; }
    .ws-items tr.subtotal td { border-top: 1px solid var(--mute-200); padding-top: 4pt; font-size: 8pt; color: var(--mute-600); }
    .ws-buyer { margin-top: auto; padding-top: 5pt; border-top: 1px solid var(--mute-200); font-size: 8pt; color: var(--mute-600); line-height: 1.5; }
    .ws-buyer strong { color: var(--ink); font-size: 7pt; letter-spacing: 1.5px; text-transform: uppercase; }

    /* === Card row (bottom half) === */
    .card-row { flex: 1; display: flex; position: relative; }
    .card-half { flex: 1; position: relative; overflow: hidden; }
    .fold-v { position: absolute; left: 5.5in; top: 0; bottom: 0; border-left: 1px dashed var(--rouge); opacity: 0.35; z-index: 4; }
    .fold-marker {
      position: absolute; left: 5.5in; transform: translate(-50%, 0);
      background: var(--bone); color: var(--rouge);
      font-size: 8pt; text-transform: uppercase; letter-spacing: 1.5px;
      padding: 2pt 8pt; z-index: 5; font-weight: 600;
    }
    .fold-marker.top { top: 0.06in; }
    .fold-marker.bottom { bottom: 0.06in; }

    /* Side A: front cover (right) + back cover (left) */
    .card-half.front-cover {
      background-image: var(--card-bg);
      background-size: cover;
      background-position: center;
      display: flex; flex-direction: column; justify-content: flex-end;
      padding: 0.25in 0.32in;
    }
    .card-half.front-cover::after {
      content: ""; position: absolute; inset: 0;
      background: linear-gradient(180deg, transparent 50%, rgba(250,246,240,0.55) 100%);
      pointer-events: none;
    }
    .card-brand { position: relative; z-index: 2; }
    .card-brand .name {
      font-family: var(--font-display); font-size: 38pt; font-weight: 600;
      letter-spacing: -1.5px; color: var(--ink); line-height: 0.85;
      font-variation-settings: "opsz" 144;
    }
    .card-brand .tag {
      font-family: var(--font-sans); font-size: 9pt; text-transform: uppercase;
      letter-spacing: 2.5px; color: var(--rouge); margin-top: 4pt; font-weight: 600;
    }
    .card-half.back-cover {
      background: var(--bone);
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      text-align: center;
    }
    .back-cover .ornament {
      font-family: var(--font-display); color: var(--rouge); font-size: 16pt;
    }
    .back-cover .small-mark {
      font-family: var(--font-sans);
      font-size: 8pt; color: var(--mute-400); letter-spacing: 2px;
      text-transform: uppercase; line-height: 1.6; margin-top: 6pt;
    }

    /* Side B: interior message (left) + blank (right) */
    .ws-back { flex: 1; }
    .card-half.inside-msg {
      background: var(--bone);
      display: flex; flex-direction: column; justify-content: center; align-items: center;
      text-align: center; padding: 0.3in 0.4in;
    }
    .inside-msg .orn-top, .inside-msg .orn-bot {
      color: var(--rouge); font-family: var(--font-display); font-size: 14pt;
    }
    .inside-msg .orn-top { margin-bottom: 10pt; }
    .inside-msg .orn-bot { margin-top: 10pt; }
    .inside-msg .text {
      font-family: var(--font-display);
      font-style: italic; line-height: 1.45; color: var(--ink);
      max-width: 90%; font-variation-settings: "opsz" 96;
    }
    .inside-msg .text.short { font-size: 18pt; }
    .inside-msg .text.med { font-size: 14pt; }
    .inside-msg .text.long { font-size: 12pt; }
    .card-half.inside-blank { background: var(--bone); }
  `;
  return cached;
}
```

- [ ] **Step 2: Verify it compiles**

```bash
pnpm exec tsc --noEmit lib/print-styles.ts
```

If there are no compilation errors, proceed. (The file imports from `node:fs` and `node:path` which both exist in Node ≥18.)

If `tsc` errors with `Cannot use namespace 'NodeJS' as a type`, that's a tsconfig issue — the project already configures node types in `tsconfig.json`, so this should not happen.

- [ ] **Step 3: Commit**

```bash
git add lib/print-styles.ts
git commit -m "feat(print): print stylesheet with embedded fonts + card bg as data URIs"
```

---

## Phase D — HTML builder components

### Task 6: Build the worksheet HTML component (top half of Side A)

**Files:**
- Create: `lib/print-render-html.tsx` (start with worksheet only)

This task creates the file and adds the worksheet (3-column layout). Subsequent tasks add card row pieces and full document assembly.

- [ ] **Step 1: Create `lib/print-render-html.tsx`**

```tsx
// lib/print-render-html.tsx
import "server-only";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Order } from "@/types/order";
import { PRODUCTS } from "@/data/products";
import { SITE } from "@/data/site";
import { resolveCartLines } from "@/lib/cart-helpers";
import { formatMoneyCents, formatPhoneUS, formatDeliveryWindow } from "@/lib/format";
import { getPrintStyles, getCardBgDataUri } from "@/lib/print-styles";

type Locale = "en" | "es";

const T = {
  en: {
    eyebrow: "Maky · The Diva Flowers",
    order: "Order",
    paid: "Paid",
    deliveryWindow: "Delivery window",
    total: "Total",
    deliverTo: "Deliver to",
    pickUp: "Pick up at shop",
    items: "Items",
    buyer: "Buyer",
    cardMessage: "Card message",
    subtotalRow: "Subt · Ship · Tax",
  },
  es: {
    eyebrow: "Maky · The Diva Flowers",
    order: "Orden",
    paid: "Pagada",
    deliveryWindow: "Ventana de entrega",
    total: "Total",
    deliverTo: "Entrega",
    pickUp: "Recoger en tienda",
    items: "Productos",
    buyer: "Comprador",
    cardMessage: "Mensaje de tarjeta",
    subtotalRow: "Subt · Env · Tax",
  },
} as const;

function Worksheet({ order }: { order: Order }) {
  const locale: Locale = order.locale;
  const t = T[locale];
  const m = (cents: number) => formatMoneyCents(cents, locale);
  const resolved = resolveCartLines(order.lines, PRODUCTS);

  return (
    <section className="worksheet">
      {/* Col 1 — meta + window */}
      <div className="ws-col meta">
        <div>
          <div className="ws-brand">{t.eyebrow}</div>
          <h1 className="ws-title">{t.order} #{order.id}</h1>
          <div className="ws-paid">
            <strong>{t.paid}:</strong> {order.createdAt}<br />
            {order.stripePaymentIntentId ? <span style={{ opacity: 0.7 }}>Stripe {order.stripePaymentIntentId}</span> : null}
          </div>
        </div>
        <div className="ws-window">
          <div className="lbl">{t.deliveryWindow}</div>
          <div className="val-time">{formatDeliveryWindow(order.delivery.window, locale)}</div>
          <div className="total-row">
            <span className="lbl">{t.total}</span>
            <span className="val">{m(order.totals.totalCents)}</span>
          </div>
        </div>
      </div>

      {/* Col 2 — recipient + message */}
      <div className="ws-col">
        {order.delivery.method === "delivery" ? (
          <div className="ws-section accent">
            <span className="pill">{t.deliverTo}</span>
            <p><strong>{order.delivery.recipient.name}</strong></p>
            <p>{formatPhoneUS(order.delivery.recipient.phone)}</p>
            <p>
              {order.delivery.address.street1}
              {order.delivery.address.street2 ? `, ${order.delivery.address.street2}` : ""}
            </p>
            <p>{order.delivery.address.city}, {order.delivery.address.state} {order.delivery.address.zip}</p>
          </div>
        ) : (
          <div className="ws-section accent">
            <span className="pill">{t.pickUp}</span>
            <p><strong>{SITE.brand}</strong></p>
            <p>{SITE.address.line1}</p>
            <p>{SITE.address.locality}, {SITE.address.region} {SITE.address.postal}</p>
            <p>{order.delivery.recipient.name} · {formatPhoneUS(order.delivery.recipient.phone)}</p>
          </div>
        )}
        {order.delivery.cardMessage?.trim() ? (
          <div className="ws-section">
            <div className="ws-section-label">{t.cardMessage}</div>
            <p className="ws-msg-quote">"{order.delivery.cardMessage.trim()}"</p>
          </div>
        ) : null}
      </div>

      {/* Col 3 — items + buyer */}
      <div className="ws-col">
        <div className="ws-section-label">{t.items}</div>
        <div className="ws-items">
          <table>
            <tbody>
              {resolved.map((r) => (
                <tr key={`${r.line.productId}-${r.line.variantId}`}>
                  <td className="qty">{r.line.qty}×</td>
                  <td>
                    {r.product.title[locale]} <span style={{ color: "var(--mute-600)" }}>— {r.variant.label[locale]}</span>
                    {r.addOns.length > 0 ? (
                      <div className="addon">+ {r.addOns.map((a) => a.label[locale]).join(", ")}</div>
                    ) : null}
                  </td>
                  <td className="price">{m(r.lineTotalCents)}</td>
                </tr>
              ))}
              <tr className="subtotal">
                <td></td>
                <td>{t.subtotalRow}</td>
                <td className="price">
                  {m(order.totals.subtotalCents)} · {m(order.totals.deliveryCents)} · {m(order.totals.taxCents)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="ws-buyer">
          <strong>{t.buyer}</strong><br />
          {order.contact.email}<br />
          {formatPhoneUS(order.contact.phone)}
        </div>
      </div>
    </section>
  );
}

// Exported for unit tests; full Side A/B builders come in later tasks.
export function __renderWorksheetHtml(order: Order): string {
  return renderToStaticMarkup(<Worksheet order={order} />);
}
```

- [ ] **Step 2: Verify TS compiles**

```bash
pnpm exec tsc --noEmit lib/print-render-html.tsx
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/print-render-html.tsx
git commit -m "feat(print): worksheet HTML component (3-column layout, en/es)"
```

---

### Task 7: Add card row Side A (back cover + front cover)

**Files:**
- Modify: `lib/print-render-html.tsx`

- [ ] **Step 1: Append components to `lib/print-render-html.tsx`**

Add these components below `Worksheet`:

```tsx
function BackCoverPanel() {
  return (
    <div className="card-half back-cover">
      <div className="ornament">❀</div>
      <div className="small-mark">maky · diva flowers</div>
      <div className="small-mark" style={{ opacity: 0.7 }}>@makydivaflowers</div>
    </div>
  );
}

function FrontCoverPanel() {
  return (
    <div className="card-half front-cover">
      <div className="card-brand">
        <div className="name">maky</div>
        <div className="tag">the diva flowers</div>
      </div>
    </div>
  );
}

function CardRowSideA() {
  return (
    <section className="card-row">
      <div className="fold-marker top">↓ doblar ↓</div>
      <div className="fold-marker bottom">↑ doblar ↑</div>
      <div className="fold-v" />
      <BackCoverPanel />
      <FrontCoverPanel />
    </section>
  );
}
```

- [ ] **Step 2: Verify TS compiles**

```bash
pnpm exec tsc --noEmit lib/print-render-html.tsx
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/print-render-html.tsx
git commit -m "feat(print): card row Side A — back-cover + front-cover panels"
```

---

### Task 8: Add card row Side B (interior message + blank panel)

**Files:**
- Modify: `lib/print-render-html.tsx`

- [ ] **Step 1: Append components**

Add below `CardRowSideA`:

```tsx
function classifyMessageLength(msg: string | undefined): "short" | "med" | "long" {
  const len = (msg ?? "").trim().length;
  if (len === 0) return "short"; // unused; empty branch handled by parent
  if (len <= 120) return "short";
  if (len <= 220) return "med";
  return "long";
}

function InsideMessagePanel({ message }: { message: string | undefined }) {
  const trimmed = message?.trim();
  if (!trimmed) {
    // Empty message: show only ornaments, no text block.
    return (
      <div className="card-half inside-msg">
        <div className="orn-top">❀</div>
        <div className="orn-bot">❀</div>
      </div>
    );
  }
  const cls = classifyMessageLength(trimmed);
  return (
    <div className="card-half inside-msg">
      <div className="orn-top">❀</div>
      <div className={`text ${cls}`}>"{trimmed}"</div>
      <div className="orn-bot">❀</div>
    </div>
  );
}

function InsideBlankPanel() {
  return <div className="card-half inside-blank" />;
}

function CardRowSideB({ message }: { message: string | undefined }) {
  return (
    <section className="card-row">
      <div className="fold-v" />
      <InsideMessagePanel message={message} />
      <InsideBlankPanel />
    </section>
  );
}
```

- [ ] **Step 2: Verify TS compiles**

```bash
pnpm exec tsc --noEmit lib/print-render-html.tsx
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/print-render-html.tsx
git commit -m "feat(print): card row Side B — interior message panel with auto-shrink"
```

---

### Task 9: Add full Side A and Side B HTML document builders

**Files:**
- Modify: `lib/print-render-html.tsx`

- [ ] **Step 1: Append the Sheet component + builders**

Add at the bottom of the file, replacing the temporary `__renderWorksheetHtml` export:

```tsx
function SheetSideA({ order }: { order: Order }) {
  return (
    <div className="sheet">
      <div className="cut-marker left">✂ recortar</div>
      <div className="cut-marker right">recortar ✂</div>
      <div className="cut-h" />
      <Worksheet order={order} />
      <CardRowSideA />
    </div>
  );
}

function SheetSideB({ message }: { message: string | undefined }) {
  return (
    <div className="sheet">
      <div className="cut-marker left">✂ recortar</div>
      <div className="cut-marker right">recortar ✂</div>
      <div className="cut-h" />
      <div className="ws-back" />
      <CardRowSideB message={message} />
    </div>
  );
}

function htmlDocument(body: string): string {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<style>${getPrintStyles()}
:root { --card-bg: url(${getCardBgDataUri()}); }
@page { size: 11in 8.5in; margin: 0; }
</style>
</head>
<body>${body}</body>
</html>`;
}

export function buildSideAHtml(order: Order): string {
  return htmlDocument(renderToStaticMarkup(<SheetSideA order={order} />));
}

export function buildSideBHtml(order: Order): string {
  return htmlDocument(renderToStaticMarkup(<SheetSideB message={order.delivery.cardMessage} />));
}
```

Then **delete** the line `export function __renderWorksheetHtml(...)` from earlier (the one we added in Task 6 step 1) — it was a temporary export.

- [ ] **Step 2: Verify TS compiles**

```bash
pnpm exec tsc --noEmit lib/print-render-html.tsx
```

Expected: no errors.

- [ ] **Step 3: Sanity-check the output**

```bash
node -e "
process.env.NODE_ENV = 'test';
require('tsx/cjs');
const { buildSideAHtml } = require('./lib/print-render-html.tsx');
const order = {
  id: 'do_test123', locale: 'es', lines: [],
  contact: { email: 't@example.com', phone: '5165551234' },
  totals: { subtotalCents: 19100, deliveryCents: 0, taxCents: 1647, totalCents: 20747 },
  status: 'paid', createdAt: '2026-05-08T15:30:00.000Z',
  delivery: { method: 'pickup', recipient: { name: 'Lola', phone: '5165550101' }, window: { date: '2026-05-15', slot: 'midday' }, cardMessage: 'Feliz cumpleaños' },
};
const html = buildSideAHtml(order);
console.log('len=' + html.length);
console.log('starts:', html.slice(0, 40));
console.log('contains ORDEN:', html.includes('ORDEN') || html.includes('Orden'));
console.log('contains feliz:', html.includes('Feliz cumpleaños'));
"
```

Expected: prints a length > 100KB (because of embedded font/image data URIs), starts with `<!doctype`, both `contains` are `true`.

If `tsx/cjs` not found, install once: `pnpm add -D tsx`.

- [ ] **Step 4: Commit**

```bash
git add lib/print-render-html.tsx
git commit -m "feat(print): full Side A and Side B HTML document builders"
```

---

## Phase E — Renderer orchestration

### Task 10: Wholesale-replace `lib/print-render.tsx`

**Files:**
- Modify: `lib/print-render.tsx`

This is a complete rewrite — the old @react-pdf/renderer JSX is deleted entirely.

- [ ] **Step 1: Replace the file content**

Overwrite `lib/print-render.tsx` with:

```tsx
// lib/print-render.tsx
// Renders an Order to a 2-page Letter-landscape PDF for duplex printing.
// Page 1 (Side A) = worksheet (top) + card front + back cover (bottom)
// Page 2 (Side B) = blank (top) + card interior message (bottom)
//
// The Buffer returned has the same shape as the v1 API, so callers
// (lib/print-queue.ts and tests) require no changes.
import "server-only";
import { PDFDocument } from "pdf-lib";
import type { Order } from "@/types/order";
import { renderHtmlToPdf } from "@/lib/print-chromium";
import { buildSideAHtml, buildSideBHtml } from "@/lib/print-render-html";

export async function renderOrderPdf(order: Order): Promise<Buffer> {
  // Render the two pages serially. Chromium's page pool inside the singleton
  // browser handles concurrency; serial here keeps memory predictable.
  const sideA = await renderHtmlToPdf(buildSideAHtml(order));
  const sideB = await renderHtmlToPdf(buildSideBHtml(order));

  // Each render returns a single-page PDF. Merge them into one 2-page PDF.
  const merged = await PDFDocument.create();
  const docA = await PDFDocument.load(sideA);
  const docB = await PDFDocument.load(sideB);
  const [pageA] = await merged.copyPages(docA, [0]);
  const [pageB] = await merged.copyPages(docB, [0]);
  merged.addPage(pageA);
  merged.addPage(pageB);
  const bytes = await merged.save();
  return Buffer.from(bytes);
}
```

- [ ] **Step 2: Verify TS compiles**

```bash
pnpm exec tsc --noEmit lib/print-render.tsx
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/print-render.tsx
git commit -m "refactor(print): replace renderer with HTML+Chromium+pdf-lib pipeline"
```

---

## Phase F — Tests

### Task 11: Update `pdf-text.ts` helper to support per-page extraction

**Files:**
- Modify: `tests/unit/helpers/pdf-text.ts`

The v1 helper concatenated text from the entire PDF. v2 needs per-page extraction so we can assert "page 2 contains the message" vs "page 1 doesn't."

- [ ] **Step 1: Read the existing helper**

```bash
cat tests/unit/helpers/pdf-text.ts
```

Note the function signature (`extractText(pdf: Buffer): string`) and the regexes used for `(...)Tj` and `[<hex>]TJ` extraction.

- [ ] **Step 2: Add `extractPageTexts` (returns array, one entry per page)**

Append to `tests/unit/helpers/pdf-text.ts`:

```ts
import { PDFDocument } from "pdf-lib";

/**
 * Extracts text per page. Returns an array; index 0 = page 1, index 1 = page 2, etc.
 * Uses pdf-lib to split into individual page PDFs, then runs the existing
 * extractText() against each.
 */
export async function extractPageTexts(pdf: Buffer): Promise<string[]> {
  const doc = await PDFDocument.load(pdf);
  const out: string[] = [];
  for (let i = 0; i < doc.getPageCount(); i++) {
    const single = await PDFDocument.create();
    const [page] = await single.copyPages(doc, [i]);
    single.addPage(page);
    const bytes = await single.save();
    out.push(extractText(Buffer.from(bytes)));
  }
  return out;
}
```

- [ ] **Step 3: Verify TS compiles**

```bash
pnpm exec tsc --noEmit tests/unit/helpers/pdf-text.ts
```

Expected: no errors. (`pdf-lib` was added in Task 1.)

- [ ] **Step 4: Commit**

```bash
git add tests/unit/helpers/pdf-text.ts
git commit -m "test(print): extractPageTexts helper for per-page assertions"
```

---

### Task 12: Rewrite `print-render.test.ts` for v2 expectations

**Files:**
- Modify: `tests/unit/print-render.test.ts`

The v1 tests asserted single-page content. v2 produces 2 pages with content split between them. Replace the assertions wholesale.

- [ ] **Step 1: Replace the file content**

Overwrite `tests/unit/print-render.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import type { Order } from "@/types/order";
import { renderOrderPdf } from "@/lib/print-render";
import { extractPageTexts } from "./helpers/pdf-text";

const baseOrder: Order = {
  id: "do_test123",
  locale: "en",
  lines: [
    { productId: "p-arr-b1-01", variantId: "standard", addOnIds: ["candles"], qty: 1 },
  ],
  contact: { email: "buyer@example.com", phone: "5165551234" },
  totals: { subtotalCents: 19100, deliveryCents: 0, taxCents: 1647, totalCents: 20747 },
  status: "paid",
  createdAt: "2026-05-07T15:30:00.000Z",
  stripePaymentIntentId: "pi_3O123abc",
  delivery: {
    method: "pickup",
    recipient: { name: "Lola Cardona", phone: "5165550101" },
    window: { date: "2026-05-15", slot: "midday" },
    cardMessage: "Happy birthday",
  },
};

describe("renderOrderPdf — v2", () => {
  it("returns a 2-page Letter-landscape PDF", async () => {
    const buf = await renderOrderPdf(baseOrder);
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
    const pages = await extractPageTexts(buf);
    expect(pages).toHaveLength(2);
  }, 60_000);

  it("page 1 contains worksheet info: order id, total, recipient, items, buyer", async () => {
    const buf = await renderOrderPdf(baseOrder);
    const [pageA] = await extractPageTexts(buf);
    expect(pageA).toContain("do_test123");
    expect(pageA).toContain("$207.47");
    expect(pageA).toContain("Lola Cardona");
    expect(pageA).toContain("buyer@example.com");
    expect(pageA).toContain("Abundant Table");
  }, 60_000);

  it("page 1 contains the Maky front-cover wordmark", async () => {
    const buf = await renderOrderPdf(baseOrder);
    const [pageA] = await extractPageTexts(buf);
    expect(pageA.toLowerCase()).toContain("maky");
  }, 60_000);

  it("page 2 contains the customer's cardMessage", async () => {
    const buf = await renderOrderPdf(baseOrder);
    const [, pageB] = await extractPageTexts(buf);
    expect(pageB).toContain("Happy birthday");
  }, 60_000);

  it("page 2 does NOT contain the order id (back of worksheet is blank)", async () => {
    const buf = await renderOrderPdf(baseOrder);
    const [, pageB] = await extractPageTexts(buf);
    expect(pageB).not.toContain("do_test123");
    expect(pageB).not.toContain("Lola Cardona");
  }, 60_000);

  it("renders DELIVER TO block for delivery orders (en)", async () => {
    const order: Order = {
      ...baseOrder,
      delivery: {
        method: "delivery",
        recipient: { name: "María González", phone: "2125550142" },
        address: { street1: "123 Park Ave", street2: "Apt 4B", city: "New York", state: "NY", zip: "10016", country: "US" },
        window: { date: "2026-05-07", slot: "afternoon" },
        cardMessage: "Te quiero",
      },
    };
    const buf = await renderOrderPdf(order);
    const [pageA] = await extractPageTexts(buf);
    expect(pageA).toContain("Deliver to");
    expect(pageA).toContain("123 Park Ave");
    expect(pageA).not.toContain("Pick up at shop");
  }, 60_000);

  it("renders PICK UP AT SHOP for pickup orders (en)", async () => {
    const buf = await renderOrderPdf(baseOrder);
    const [pageA] = await extractPageTexts(buf);
    expect(pageA).toContain("Pick up at shop");
    expect(pageA).toContain("1077 Willis Ave");
  }, 60_000);

  it("localizes worksheet to Spanish when order.locale === 'es'", async () => {
    const order: Order = { ...baseOrder, locale: "es" };
    const buf = await renderOrderPdf(order);
    const [pageA] = await extractPageTexts(buf);
    expect(pageA).toContain("Recoger en tienda");
    expect(pageA).not.toContain("Pick up at shop");
  }, 60_000);

  it("renders without crashing when cardMessage is empty", async () => {
    const order: Order = {
      ...baseOrder,
      delivery: { ...baseOrder.delivery, cardMessage: "" } as Order["delivery"],
    };
    const buf = await renderOrderPdf(order);
    expect(buf.length).toBeGreaterThan(1000);
    const [, pageB] = await extractPageTexts(buf);
    // Without a message, page 2 should not contain the previous default ("Happy birthday").
    expect(pageB).not.toContain("Happy birthday");
  }, 60_000);
});
```

- [ ] **Step 2: Run, expect pass**

```bash
pnpm test tests/unit/print-render.test.ts
```

Expected: all 9 tests pass. Total runtime ~30-45 seconds (Chromium cold start once, then warm renders).

If a test fails because the asserted text isn't in the PDF, run a focused test, write the actual page text to disk, and inspect it to figure out what changed:

```bash
pnpm test tests/unit/print-render.test.ts -t "page 2 contains the customer's cardMessage" -- --reporter=verbose
```

If `extractPageTexts` returns an empty string for a page that visually has text, the issue is likely font glyph encoding (Chromium-rendered PDFs sometimes use Type0 fonts with `/Identity-H` encoding which encode glyph indices, not Unicode). If you hit this, the helper extension in Task 11 needs an extra step: handle the `ToUnicode` CMap. Document the issue and report DONE_WITH_CONCERNS.

- [ ] **Step 3: Commit**

```bash
git add tests/unit/print-render.test.ts
git commit -m "test(print): rewrite renderer tests for v2 — 2-page assertions, locale, edge cases"
```

---

## Phase G — Print agent updates

### Task 13: Pass duplex flag to pdf-to-printer in the agent

**Files:**
- Modify: `tools/print-agent/src/print.ts`

- [ ] **Step 1: Read the current file**

```bash
cat tools/print-agent/src/print.ts
```

The current `printPdf` function calls `await pdfPrint(tmpPath, { printer: printerName });`. We need to add the duplex option.

- [ ] **Step 2: Modify the call**

In `tools/print-agent/src/print.ts`, locate the `printPdf` function and change the `pdfPrint` call. Find:

```ts
    await pdfPrint(tmpPath, { printer: printerName });
```

Replace with:

```ts
    await pdfPrint(tmpPath, {
      printer: printerName,
      // Force duplex (long-edge binding). v2 renders a 2-page PDF designed
      // to print on the front and back of one sheet of Letter paper.
      // The flag is forwarded to the underlying PDFtoPrinter.exe / lp.
      win32: ["-print-settings", "duplex=long-edge,paper=letter,fit=true"],
      unix: ["-o", "sides=two-sided-long-edge", "-o", "media=Letter"],
    });
```

`pdf-to-printer`'s TypeScript types may not include `win32`/`unix` keys. If `tsc` complains, cast the options object: `await pdfPrint(tmpPath, { printer: printerName, ... } as any);` — that's acceptable here because we're routing through to the underlying binary's CLI.

- [ ] **Step 3: Verify TS compiles**

```bash
cd tools/print-agent && npx tsc && cd -
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add tools/print-agent/src/print.ts
git commit -m "feat(print-agent): force duplex (long-edge) for v2 two-page PDFs"
```

---

### Task 14: Append duplex setup section to agent README

**Files:**
- Modify: `tools/print-agent/README.md`

- [ ] **Step 1: Append the section**

Append to the end of `tools/print-agent/README.md`:

```markdown
## Configurar impresora para duplex automático

Desde v2, cada orden se imprime como una hoja de 2 páginas (frente + dorso). El frente lleva el worksheet y el lado externo de la tarjeta; el dorso lleva el interior de la tarjeta. La impresora debe configurar **impresión a dos caras (duplex) automática**.

### Requisitos

La impresora debe soportar duplex automático. Casi todas las impresoras láser modernas y muchas inkjet de oficina lo soportan. Si la tuya solo soporta "duplex manual" (te pide voltear la hoja a la mitad), v2 funciona pero el operador tiene que asistir cada impresión — no es un flujo viable para producción.

Cómo verificar:
1. Abrir **Configuración → Impresoras y escáneres → [tu impresora] → Preferencias de impresora**
2. Buscar la opción "Imprimir a dos caras", "Duplex" o "Print on both sides"
3. Si aparece como opción: tu impresora la soporta. Si no aparece: confirma con el manual del fabricante.

### Configuración

1. **Configurar duplex como default en Windows**:
   - Configuración → Impresoras → [tu impresora] → Preferencias
   - Pestaña "Acabado" o "Layout": cambiar "Print on Both Sides" a **"Long-edge binding"** (encuadernación por borde largo)
   - Aceptar / Aplicar
2. **Reiniciar el agente**: `Restart-Service MakyPrintAgent`
3. **Probar**: `npm run test-print`. Debe salir UNA hoja con la página de prueba en el frente y la página 2 (texto adicional o blanco) en el dorso.

### Si solo sale una cara

- Verifica que el driver de la impresora esté actualizado.
- Algunas impresoras requieren que el flag duplex se pase a nivel del driver y no del trabajo. Si el agente lo pasa pero la impresora ignora: cambiar el default en Preferencias de impresora (paso 1) suele resolverlo.
- Si todo lo anterior falla: la impresora podría no soportar duplex automático. Considera reemplazarla o aceptar duplex manual (no recomendado).
```

- [ ] **Step 2: Verify the file**

```bash
tail -40 tools/print-agent/README.md
```

Expected: the new section is present.

- [ ] **Step 3: Commit**

```bash
git add tools/print-agent/README.md
git commit -m "docs(print-agent): duplex printer setup section for v2"
```

---

## Phase H — Final integration

### Task 15: Visual sample test

**Files:**
- Create: `tests/unit/_render-sample-v2.test.ts` (this file is `.gitignore`d — kept local for visual checks)

This task produces a real PDF file from the v2 renderer so you can open it in Preview and confirm the layout matches the approved mockup. Test is committed but the output PDF goes to `/tmp` (already ignored).

- [ ] **Step 1: Add a temporary local test that writes to /tmp**

Create `tests/unit/_render-sample-v2.test.ts`:

```ts
import { it } from "vitest";
import type { Order } from "@/types/order";
import { renderOrderPdf } from "@/lib/print-render";
import { writeFileSync } from "node:fs";

it("renders a sample v2 PDF for visual inspection", async () => {
  const order: Order = {
    id: "do_sample_es01",
    locale: "es",
    lines: [
      { productId: "p-arr-b1-01", variantId: "standard", addOnIds: ["candles"], qty: 1 },
      { productId: "p-arr-b3-01", variantId: "standard", addOnIds: [], qty: 1 },
    ],
    contact: { email: "carla.diaz@example.com", phone: "5165551234" },
    totals: { subtotalCents: 28500, deliveryCents: 1500, taxCents: 2596, totalCents: 32596 },
    status: "paid",
    createdAt: "2026-05-08T15:30:00.000Z",
    stripePaymentIntentId: "pi_3OabcXYZ987",
    delivery: {
      method: "delivery",
      recipient: { name: "María González", phone: "9173334411" },
      address: { street1: "245 East 53rd St", street2: "Apt 14C", city: "New York", state: "NY", zip: "10022", country: "US" },
      window: { date: "2026-05-08", slot: "afternoon" },
      cardMessage: "Feliz cumpleaños, mamá. Que este día sea tan dulce como tú. Te amo siempre.",
    },
  };
  const pdf = await renderOrderPdf(order);
  writeFileSync("/tmp/maky-v2-sample-es.pdf", pdf);
  console.log(`Wrote /tmp/maky-v2-sample-es.pdf (${pdf.length} bytes)`);
}, 60_000);
```

- [ ] **Step 2: Run + open in Preview**

```bash
pnpm test tests/unit/_render-sample-v2.test.ts
open /tmp/maky-v2-sample-es.pdf
```

Verify visually:
- Page 1 (Side A): worksheet on top half (3 columns), card row on bottom (back-cover left + Higgsfield art front-cover with "maky" wordmark right)
- Page 2 (Side B): blank top half, message panel on bottom-left, blank panel on bottom-right
- Cut markers at horizontal midline; fold markers at vertical midline of bottom half
- Fonts: Fraunces serif for headings/message, Cabinet Grotesk sans for everything else

If the visual doesn't match the approved mockup at `.superpowers/brainstorm/*/content/09-approved-summary.html`, identify the gap and iterate before committing.

- [ ] **Step 3: Run the FULL test suite to confirm no regressions**

```bash
pnpm test 2>&1 | tail -10
```

Expected: previously-passing tests (queue, API, webhook, agent — ~448 tests) all still pass plus the new renderer tests. The pre-existing `subscription-inquiry-schema.test.ts:59` failure is OK to ignore.

- [ ] **Step 4: Delete the sample test (it was a one-off check) and commit**

```bash
rm tests/unit/_render-sample-v2.test.ts
git add tests/unit/
git commit --allow-empty -m "test(print): visual sample check passed for v2 renderer"
```

(The commit is empty if no other test files changed, which is fine — it serves as a marker that the visual verification step was performed.)

---

## Verification checklist

After all 15 tasks:

- [ ] `pnpm test` — all unit tests pass except the pre-existing `subscription-inquiry-schema.test.ts:59` failure
- [ ] `pnpm build` — Next.js production build succeeds (no TS errors)
- [ ] `cd tools/print-agent && npx tsc` — agent TS compiles
- [ ] Visual verification of `/tmp/maky-v2-sample-es.pdf` matches the approved mockup
- [ ] Manual test on a real duplex printer (deferred to operator install): `npm run test-print` prints a 2-page sheet duplex
- [ ] `git diff main..HEAD` reviewed — no unintended changes to v1 files (queue, API, webhook, etc.)

---

## Self-review notes

**Spec coverage:**
- §3.1 sheet layout (cut horizontal, fold vertical) — Tasks 5 (CSS positioning), 9 (cut markers), 6/7/8 (panels)
- §3.2 worksheet 3-column — Task 6
- §3.3 card strip duplex layout — Tasks 7 (Side A) + 8 (Side B)
- §3.4 typography (Fraunces + Cabinet Grotesk) — Tasks 2 (fonts) + 5 (CSS @font-face)
- §3.5 color palette — Task 5 (CSS tokens)
- §3.6 card front artwork — Task 3
- §4 architecture (Chromium + pdf-lib + HTML builders) — Tasks 4, 9, 10
- §5 Chromium runtime strategy — Task 4 (local vs prod fork in `getBrowser`)
- §6 duplex printing on agent — Tasks 13, 14
- §7 migration — handled implicitly by branch state (no v1 deploy)
- §8 testing — Tasks 11, 12, 15
- §10 open questions — message-length auto-shrink covered in Task 8 (`classifyMessageLength`); printer model is an operator concern handled in Task 14 README

**Type/name consistency check:**
- `renderOrderPdf(order: Order): Promise<Buffer>` — defined in Task 10, asserted in Task 12.
- `renderHtmlToPdf(html: string): Promise<Buffer>` — defined in Task 4, used in Task 10.
- `buildSideAHtml(order: Order): string`, `buildSideBHtml(order: Order): string` — defined in Task 9, used in Task 10.
- `getPrintStyles()`, `getCardBgDataUri()` — defined in Task 5, used in Task 9.
- `extractPageTexts(pdf: Buffer): Promise<string[]>` — defined in Task 11, used in Task 12.
- `T` table keys (`order`, `paid`, `deliverTo`, `pickUp`, `cardMessage`, etc.) — defined in Task 6, asserted (case-insensitive) in Task 12.

**Placeholder check:**
- No "TBD"/"TODO"/"implement later" anywhere.
- Every code step has the actual code.
- Every command has the expected output described.
- Edge cases (Chromium executable path on macOS, font CMap encoding) are flagged with concrete fallback instructions, not vague "handle this somehow."
