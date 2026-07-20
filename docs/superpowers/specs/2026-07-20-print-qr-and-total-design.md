# Printed order sheet — QR on card + total relocation

Date: 2026-07-20
Status: approved design, ready to implement

## Context

Orders auto-print as a single Letter-landscape sheet (`lib/print-render-html.tsx`
+ `lib/print-styles.ts`), cut in half:

- Top half — worksheet (stays at the shop): 3 columns. Col 1 = brand/order #,
  internal notes, and a black box with the delivery window **and total**. Col 2 =
  recipient + card message. Col 3 = product list + subtotal breakdown + buyer.
- Bottom half — tri-fold card (goes with the bouquet): panel 1 = brand cover
  (rose photo + recipient chip), panel 2 = logo/socials, panel 3 = customer message.

## Changes

### 1. QR code on card face 1 (brand cover)

Add a QR code to the **top-left corner** of the brand-cover panel that, when
scanned, opens `https://makythedivaflowers.com`.

- Same QR on every sheet (the URL is fixed — not order-specific).
- Rendered on a **white chip** (rounded white background with a small quiet-zone
  margin) so it scans reliably over the rose photo. High contrast is required for
  QR readability.
- Size ~0.8in. Absolutely positioned top-left; the brand name/recipient stay
  bottom-aligned as today.

### 2. Move the total off the black box → worksheet column 3

- Remove the total row from the black delivery-window box (`.ws-window`). The box
  keeps only the delivery-window label + time.
- Add a prominent **Total** line in column 3, directly under the
  `Subt · Env · Tax` subtotal breakdown.
- In-store ("take it now") orders have no delivery window, so the black box would
  be nearly empty. For in-store, **hide the black box entirely** (the total now
  lives in column 3). Delivery/pickup keep the box with their window.

## Implementation approach

QR is generated **once** as a static SVG asset (matching the repo's existing
inline-asset pattern for the logo and card background) — no runtime dependency:

- `public/print/qr-website.svg` — QR for `https://makythedivaflowers.com`,
  generated with Python `qrcode` (error-correction level M, quiet-zone margin).
- `lib/print-styles.ts`: add `getQrWebsiteDataUri()` (reads the file, returns a
  cached `data:image/svg+xml;base64,…`), mirroring `getLogoDataUri()`.
- `lib/print-render-html.tsx`: render the QR inside the `brand-cover` panel as an
  `<img>` in a white chip, top-left. Move the total out of `Worksheet`'s
  `.ws-window` and into column 3; make `.ws-window` conditional on a real window
  (delivery/pickup only).
- `lib/print-styles.ts`: CSS for `.qr-chip` / `.qr-img` and the column-3 total.

The website URL comes from `data/site.ts` (SITE) if it already holds it; otherwise
hard-code `https://makythedivaflowers.com` in the asset + alt text.

## Out of scope

- **Designer/internal notes on the worksheet** — already implemented and on
  `origin/main`; ships with the same deploy, no work here.
- **Deploy** — the shop's print-agent host is updated separately (a push does not
  auto-deploy). Not part of this change.
- The intake "take it now" recipient behavior is untouched.

## Testing

Fast `buildSheetHtml` unit tests (no Chromium), like `print-render-notes.test.ts`:

- QR: brand-cover panel contains the QR `<img>` (e.g. a `qr-` class / the alt
  text); the QR does not appear on the worksheet half.
- Total: the `.ws-window` block no longer contains the total amount; column 3
  contains a Total line with the amount.
- In-store: the black delivery-window box is absent; the total still renders in
  column 3.
- Delivery/pickup: the black box still renders with the window.
