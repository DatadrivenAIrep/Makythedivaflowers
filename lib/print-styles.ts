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
  const ext = path.extname(relPath).toLowerCase();
  const mime = ext === ".ttf" ? "font/ttf" : ext === ".woff2" ? "font/woff2" : "application/octet-stream";
  return `data:${mime};base64,${buf.toString("base64")}`;
}

function imageDataUri(relPath: string, mime: string): string {
  const abs = path.join(process.cwd(), relPath);
  const buf = readFileSync(abs);
  return `data:${mime};base64,${buf.toString("base64")}`;
}

let cached: string | null = null;
let cachedBg: string | null = null;
let cachedLogo: string | null = null;

export function getCardBgDataUri(): string {
  if (cachedBg !== null) return cachedBg;
  cachedBg = imageDataUri("public/print/card-bg-front.jpg", "image/jpeg");
  return cachedBg;
}

export function getLogoDataUri(): string {
  if (cachedLogo !== null) return cachedLogo;
  cachedLogo = imageDataUri("public/print/logo.jpg", "image/jpeg");
  return cachedLogo;
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

    /* === Card row (bottom half) — tri-fold === */
    .card-row { flex: 1; display: flex; position: relative; }
    .card-panel { flex: 1; position: relative; overflow: hidden; }

    /* Panel 1 (left): Maky brand — cover when folded */
    .card-panel.brand-cover {
      background-image: var(--card-bg);
      background-size: cover;
      background-position: center;
      display: flex; flex-direction: column; justify-content: flex-end;
      padding: 0.25in 0.3in;
    }
    .card-panel.brand-cover::after {
      content: ""; position: absolute; inset: 0;
      background: linear-gradient(180deg, transparent 45%, rgba(250,246,240,0.6) 100%);
      pointer-events: none;
    }
    .card-brand { position: relative; z-index: 2; }
    .card-brand .name {
      font-family: var(--font-display); font-size: 34pt; font-weight: 600;
      letter-spacing: -1.5px; color: var(--ink); line-height: 0.85;
      font-variation-settings: "opsz" 144;
    }
    .card-brand .tag {
      font-family: var(--font-sans); font-size: 8pt; text-transform: uppercase;
      letter-spacing: 2.5px; color: var(--rouge); margin-top: 4pt; font-weight: 600;
    }
    /* Recipient block on the brand cover (card 1) — a light "shipping label"
       chip so the delivery info is legible over the rose photo. No header. */
    .brand-cover .cover-recipient {
      position: relative; z-index: 2;
      margin-top: 8pt;
      background: rgba(250, 246, 240, 0.9);
      border: 1px solid var(--petal);
      border-radius: 4pt;
      padding: 6pt 8pt;
    }
    .cover-recipient .cr-name {
      font-family: var(--font-sans);
      font-weight: 700; font-size: 11pt; color: var(--ink);
      line-height: 1.2; margin-bottom: 2pt;
    }
    .cover-recipient .cr-line {
      font-family: var(--font-sans);
      font-size: 9pt; color: var(--mute-600); line-height: 1.4;
    }

    /* Panel 2 (middle): customer message — hidden when folded */
    .card-panel.inside-msg {
      background: var(--bone);
      display: flex; flex-direction: column; justify-content: center; align-items: center;
      text-align: center; padding: 0.3in 0.3in;
    }
    .inside-msg .orn-top, .inside-msg .orn-bot {
      color: var(--rouge); font-family: var(--font-display); font-size: 14pt;
    }
    .inside-msg .orn-top { margin-bottom: 10pt; }
    .inside-msg .orn-bot { margin-top: 10pt; }
    .inside-msg .text {
      font-family: var(--font-display);
      font-style: italic; line-height: 1.45; color: var(--ink);
      max-width: 92%; font-variation-settings: "opsz" 96;
    }
    .inside-msg .text.short { font-size: 16pt; }
    .inside-msg .text.med { font-size: 13pt; }
    .inside-msg .text.long { font-size: 11pt; }

    /* Panel 3 (right): logo lockup. The source logo has a flat white
       background (no alpha), so we wrap it in a white card with soft
       shadow to make the white edge blend rather than fight the bone. */
    .card-panel.logo-panel {
      background: var(--bone);
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      text-align: center; padding: 0.3in 0.3in;
    }
    .logo-panel .logo-frame {
      background: #fff;
      border-radius: 8pt;
      padding: 0.18in;
      box-shadow: 0 1pt 6pt rgba(14,13,12,0.08);
      display: flex; align-items: center; justify-content: center;
    }
    .logo-panel .logo-img {
      width: 2.4in; height: 2.4in; object-fit: contain;
      display: block;
    }
    .logo-panel .socials {
      margin-top: 10pt; display: flex; flex-direction: column; align-items: center; gap: 4pt;
    }
    .logo-panel .socials .handle {
      font-family: var(--font-sans);
      font-size: 8pt; color: var(--ink); letter-spacing: 1.5px;
      text-transform: uppercase; font-weight: 600;
    }
    .logo-panel .socials .icons {
      display: flex; align-items: center; gap: 8pt; color: var(--rouge);
    }
    .logo-panel .socials .ic {
      width: 12pt; height: 12pt; display: block;
    }
  `;
  return cached;
}
