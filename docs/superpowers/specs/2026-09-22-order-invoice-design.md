# Order invoice (admin) — design

**Date:** 2026-09-22
**Status:** approved in chat, pending spec review

## Goal

Staff can open a clean, customer-facing invoice for any order from the admin
order drawer, then print it or save it as PDF from the browser. Optional —
nothing is generated, stored, numbered or sent unless someone clicks the button.

## Non-goals (YAGNI)

- No emailing the invoice (may come later).
- No server-side PDF (no Chromium, no print queue).
- No separate invoice numbering, invoice table, or DB migration.
- No corporate / net-terms billing, no multi-order invoices, no manual invoices.

## Approach

Follow the existing work-sheet preview pattern
(`app/api/admin/orders/[id]/sheet/route.ts` → `buildSheetHtml`):

- **`lib/invoice.ts`** — pure `buildInvoiceModel(order, products)` → plain data
  (number, dates, bill-to, deliver-to, lines, totals rows, payment status,
  balance). No React, no I/O. This is where all logic and tests live.
- **`lib/invoice-html.tsx`** — `buildInvoiceHtml(order)`: renders the model to a
  full `<!doctype html>` document via `renderToStaticMarkup` (same dynamic
  `react-dom/server` import trick as `print-render-html.tsx`), inline CSS,
  logo inlined via `getLogoDataUri()`. Letter portrait, `@page { size: letter; margin: 0.6in }`.
  A "Print / Save PDF" button (`onclick="window.print()"`) hidden under `@media print`.
- **`app/api/admin/orders/[id]/invoice/route.ts`** — `GET`, `runtime = "nodejs"`,
  `requireAdmin` → 401, unknown order → 404, else 200 `text/html; charset=utf-8`.
  Also covered by `proxy.ts` (`/api/admin` prefix).
- **`components/admin/dashboard/OrderDetailDrawer.tsx`** — new
  `AdminButton variant="secondary" icon={FileText}` next to Preview, `href`
  to the route, `target="_blank" rel="noreferrer"`, label `t("invoice")`.
- **`messages/en.json` + `messages/es.json`** — drawer label (`invoice`:
  "Invoice" / "Factura"). Invoice body strings live in a small `{ en, es }`
  dictionary inside `lib/invoice.ts` (the sheet does the same — no next-intl
  on a raw HTML route).

## Invoice content

Language: `order.locale`.

1. **Header** — logo, `SITE.merchantName`, address (`SITE.address`),
   `SITE.phone`, `SITE.email`, site URL.
2. **Meta** — "INVOICE", number `INV-{orderNumber}`; for legacy orders without
   a number, `INV-{last 6 of id, uppercased}`. Issue date = now (shop-local,
   `formatDateTime`), order date = `createdAt`. Status stamp: **PAID** when
   balance ≤ 0 and `paymentStatus === "paid"`; **REFUNDED** when refunded;
   otherwise **BALANCE DUE**.
3. **Bill to** — `contact.name` (fallback recipient name), email, phone
   (`formatPhoneUS`).
4. **Deliver to / Pickup / In-store** — recipient name + phone; delivery
   address; date + window via `formatDeliveryWindow`. In-store shows just the
   method label.
5. **Lines** — catalog: product title — variant label, add-ons listed under it,
   qty, unit price (`unitPriceCents`), amount. Custom: `title`, qty,
   `priceCents`, amount. A catalog line that no longer resolves (deleted /
   quote-only product) shows the product id with "—" for price, so the invoice
   never silently drops a line; the totals still come from `order.totals`.
   `designerNotes` are NOT shown.
6. **Totals** (all from `order.totals`, never recomputed) — Subtotal, Delivery,
   Discount (`−`, with `promoCode` if any; row hidden when 0), Tax (NY), Tip
   (hidden when 0), **Total**; then Paid (`amountPaidCents`, with payment method
   + `paidAt` when present; gift card portion shown separately when
   `giftCardCents > 0`), and **Balance due** (`orderBalanceCents`, or "Credit"
   when negative).
7. **Footer** — thank-you line + website.

Never shown: `internalNotes`, `takenBy`, card message, designer notes, Stripe ids.

## Error handling

- 401 without session, 404 unknown order (JSON, same as sheet route).
- Missing optional fields just omit their row; nothing throws on legacy orders.
- All user text is escaped by React's static rendering.

## Testing

- `tests/unit/invoice-model.test.ts` — paid order; partial payment (balance
  due); overpaid (credit); discount with promo code; gift card; tip; custom
  line; unresolvable catalog line; pickup and in-store; legacy order without
  `orderNumber`; es locale strings; internal notes/card message absent.
- `tests/unit/api-admin-order-invoice.test.ts` — 200 HTML with `INV-1001`,
  401, 404 (mirrors `api-admin-order-sheet.test.ts`).
- Visual check: dump HTML, serve locally, inspect in the browser (screen +
  print emulation).
- Before commit: full `pnpm test` (known Chromium print failures excepted),
  `npx tsc --noEmit`, `next build`.
