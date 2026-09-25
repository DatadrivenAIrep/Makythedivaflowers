# Digital card QR (admin) — design

**Date:** 2026-09-24
**Status:** approved in chat, pending spec review
**Builds on:** `2026-07-20-print-qr-and-total-design.md` (static website QR on the card cover)

## Goal

Staff can attach an animated digital greeting card to any order. The printed
tri-fold card that goes with the bouquet carries a per-order QR code; the
recipient scans it and the card opens. Pilot: Raymond's 50th birthday card.

The cards themselves are built and hosted by the separate invitation platform
(`proposals card` monorepo), deployed at `tarjetas.makythedivaflowers.com`.
This shop only owns the short link, the QR and the admin workflow.

## Non-goals (YAGNI)

- No storefront add-on, no price, no checkout change. Activation is admin-only
  while the product is being validated.
- No API between the two apps. The card URL is pasted by hand.
- No SMS/email with the card link to the buyer (staff can copy the link).
- No health check of the card platform, no scan analytics.
- No behaviour tied to order cancellation or refunds.
- No new domain: the card platform lives on a subdomain of the shop's domain.

## Approach

A short code owned by the shop, printed as
`https://makythedivaflowers.com/c/<code>`, redirects to the card URL once one
is set, and shows a "being prepared" page until then. The printed card never
waits on the digital card, and the card URL can change after printing without
invalidating the QR.

```
Admin order drawer                        Card platform
  "Activate digital card"                   tarjetas.makythedivaflowers.com/i/<slug>
    → digital_cards row (code, url=null)         ▲
  paste card URL ────────────────────────────────┘ (stored as target_url)

Printed sheet: QR → makythedivaflowers.com/c/<code>
Recipient scans → /c/<code> → 302 to target_url, or "being prepared" page
```

## Data

Migration `db/migrations/029_digital_cards.sql`:

```sql
CREATE TABLE digital_cards (
  order_id   TEXT PRIMARY KEY REFERENCES orders(id),
  code       TEXT NOT NULL UNIQUE,
  target_url TEXT,
  created_at TEXT NOT NULL,   -- ISO 8601, like the other tables
  updated_at TEXT NOT NULL
);
```

- One digital card per order.
- `code`: 8 characters, base62, from `crypto.randomBytes` (62⁸ ≈ 2·10¹⁴).
  On a unique-constraint collision, regenerate and retry (max 5 attempts).
- `target_url`: `null` means "being prepared".

## Module `lib/digital-cards.ts`

- `enableForOrder(orderId)` — idempotent: returns the existing row if there is
  one, otherwise creates it. Fails with `not_found` if the order does not exist.
- `setTargetUrl(orderId, url | null)` — validates, stores, bumps `updated_at`.
  `null` clears it (back to "being prepared").
- `getByOrder(orderId)`, `getByCode(code)`.
- `shortUrl(code)` — `${NEXT_PUBLIC_SITE_URL ?? "https://makythedivaflowers.com"}/c/${code}`,
  the same base URL the rest of the app uses.

URL validation (Zod, `schemas/digital-card.ts`):

- Must parse as a URL with protocol `https:`.
- Host must be in `DIGITAL_CARD_HOSTS` (comma-separated env var, default
  `tarjetas.makythedivaflowers.com`). This keeps `/c/` from becoming an open
  redirect.

## Routes

Admin (all behind `requireAdmin`, `runtime = "nodejs"`):

| Method & path | Does |
|---|---|
| `POST /api/admin/orders/[id]/digital-card` | `enableForOrder`; returns `{ code, shortUrl, targetUrl }`. Records `recordOrderChange` kind `digital_card`, summary "Tarjeta digital activada". |
| `PATCH /api/admin/orders/[id]/digital-card` | Body `{ targetUrl: string \| null }`; 400 on invalid URL, 404 if not activated. Records "URL de tarjeta digital actualizada". |
| `GET /api/admin/orders/[id]/digital-card/qr` | PNG, 1024 px, error correction Q, `Content-Disposition: attachment; filename="tarjeta-<orderId>.png"`. 404 if not activated. |

The order detail payload used by `OrderDetailDrawer` includes
`digitalCard: { code, shortUrl, targetUrl } | null`.

Public:

- `app/c/[code]/route.ts` (outside `[locale]`):
  - Unknown or malformed code → 404 page (shop-branded, link to the store).
  - `target_url` set → `302` to it, `Cache-Control: no-store`.
  - `target_url` null → "being prepared" page (200), `Cache-Control: no-store`.
  Both HTML pages carry `<meta name="robots" content="noindex">` and use the
  order's locale (es/en; the 404 uses es). They are small self-contained HTML
  responses, not pages in the localized app shell.
- `proxy.ts`: exclude `c/` from the matcher so next-intl does not redirect
  `/c/x` to `/en/c/x`.

## Admin UI

`components/admin/dashboard/OrderDetailDrawer.tsx`: a new "Tarjeta digital"
section right after the recipient/card-message section.

- Not active → button **Activar tarjeta digital**.
- Active →
  - Short link with a copy button.
  - Status chip: **Preparando** (no URL) or **Lista ✓** (URL set).
  - Input for the card URL + **Guardar** (inline error from the 400 response).
  - **Descargar QR** link (the `/qr` route).
  - Hint: "Si la hoja ya se imprimió, usa Reimprimir para que salga el QR
    nuevo."

Strings go in `messages/es.json` and `messages/en.json` under the admin
namespace the drawer already uses.

## Printed sheet

The sheet HTML is rendered when the print job is claimed, not when it is
queued (`lib/print-queue.ts`), so activating before printing is enough; after
printing, staff use the existing Reprint button.

`lib/print-render-html.tsx`:

- `buildSheetHtml` looks up `getByOrder(order.id)`.
- If present: `qrUri` becomes an inline SVG data URI of `shortUrl(code)`
  (`qrcode` package, error correction Q, margin 2), and `BrandCoverPanel`
  shows the line *"Escanea para abrir tu sorpresa"* / *"Scan to open your
  surprise"* (order locale) under the QR, with matching `alt` text.
- If absent: unchanged — the static website QR and current copy.

New dependency: `qrcode` (+ `@types/qrcode`).

## Card platform (separate repo, listed here for completeness)

1. Deploy `apps/web` to `tarjetas.makythedivaflowers.com` per
   `docs/deploy/hostinger.md` (own Node app + MySQL, `PUBLIC_BASE_URL` set to
   the subdomain).
2. `/i/[slug]`: always `robots: { index: false }`.
3. Republish Raymond under an unguessable slug (e.g. `raymond-50-k3x9`) once
   the remaining card details are finished; its assets folder follows the slug.

The shop side works, and orders can be printed, before any of these are done:
the QR shows "being prepared" until a URL is pasted.

## Error handling summary

| Situation | Behaviour |
|---|---|
| Unknown code | Branded 404, noindex |
| Code without URL | "Being prepared" page, noindex, no-store |
| URL with another host or `http:` | 400 in admin, not stored |
| Card platform down | Redirect still happens; the card fails to load there. Accepted during validation. |
| Activate twice | Returns the same code (idempotent) |
| Order cancelled | Card kept; no special handling |

## Testing

Unit (Vitest):

- Code generator: length 8, base62 alphabet, retry on collision.
- `enableForOrder` idempotent; `not_found` for a missing order.
- URL schema: accepts an allowed https host; rejects `http:`, other hosts,
  garbage.
- `buildSheetHtml`: with a digital card the QR encodes `/c/<code>` and the
  "Escanea para abrir tu sorpresa" line is present; without one the output
  keeps the website QR.

Route tests:

- `/c/[code]`: 302 + `no-store` with URL; 200 "being prepared" without; 404
  unknown.
- Admin routes: 401 without session; POST/PATCH/QR happy paths plus 400/404.

E2E (Playwright):

- Admin opens an order → activates → pastes an allowed URL → visiting
  `/c/<code>` redirects to it.

## Rollout

1. Merge the shop changes; run migration 029 in production.
2. Set `DIGITAL_CARD_HOSTS` only if the card host differs from the default.
3. Create Raymond's order (admin), activate the digital card, print.
4. When the card platform is deployed and Raymond's card is published, paste
   its URL. The already-printed QR starts redirecting.
