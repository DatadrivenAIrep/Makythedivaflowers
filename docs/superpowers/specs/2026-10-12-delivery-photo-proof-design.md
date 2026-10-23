# Delivery photo proof — design

**Date:** 2026-10-12
**Status:** approved in chat (option A), pending spec review

## Problem

When an order is delivered there is no record of *how* it was left — at the
door, with a neighbor, with the recipient — and nothing to show a buyer who
asks "did it arrive?". Drivers sometimes snap a photo on their own phone and
forward it over WhatsApp, but it never reaches the platform and the buyer only
gets the plain "your order was delivered" SMS.

## Goals

- When marking a **delivery** order as delivered, the person delivering can
  **optionally** take a photo from their phone.
- The photo is **stored on the platform** as proof of delivery and shown on the
  order in the admin panel.
- When a photo exists, the automatic **"delivered" SMS goes out as an MMS with
  the photo attached**, in the order's message language. No photo → the SMS is
  exactly what it is today.
- Taking a photo must never block marking the order delivered.

## Non-goals (v1)

- No driver role, driver login or per-route magic link. The driver uses the
  existing admin panel on their phone with the shared panel password (owner's
  choice, 2026-10-12).
- No photo for pickup / in-store orders (they get no "delivered" SMS today).
- No manual "send / resend photo" button and no adding a photo *after* the
  order is already delivered.
- No photo on the customer-facing order page or account history.
- No WhatsApp media: WhatsApp messages use pre-approved content templates with
  no media slot, so WhatsApp customers keep getting the text-only template.
- No inbound MMS parsing (photos customers send us).

## Decisions

| Topic | Decision |
|---|---|
| Who takes it | Whoever marks delivered, from the admin panel (phone or desktop). |
| Storage | Files on disk under `data/delivery-photos/` (persistent across deploys, next to `data/diva.sqlite`), metadata in SQLite. Not `public/` (redeploys can wipe it), not a BLOB, not S3. |
| Image prep | The **browser** downscales and re-encodes to JPEG before upload. No `sharp` dependency; iPhone HEIC is decoded by Safari itself. |
| Serving | Unauthenticated route keyed by an unguessable 128-bit token, because Twilio must fetch the image without our session cookie. |
| Photos per order | One. Uploading again before delivery replaces the previous photo. |
| Recipient of the MMS | The buyer (`order.contact.phone`) — same as today's delivered SMS. |
| Cost | An MMS costs roughly 2–3× an SMS (~$0.02 vs ~$0.008 per segment); only charged when a photo exists. |

## User flow

Entry points that mark delivered today, all of which get the same behavior for
`fulfillment.method === "delivery"` orders:

1. **Run sheet** (`/admin/dashboard/run-sheet`, `RunSheetList` "Entregado").
2. **Order detail drawer** (`OrderDetailDrawer` delivered button).
3. **Bandeja pending card** (`advance_delivered` action).

Tapping "Entregado" on a delivery order opens a **Deliver sheet** instead of
firing the PATCH immediately:

```
┌──────────────────────────────────┐
│  Entregar pedido #1234           │
│  Ana López · 12 Main St          │
│                                  │
│  [ 📷  Tomar foto ]  (primary)    │
│  [ Entregar sin foto ]           │
│  [ Cancelar ]                    │
└──────────────────────────────────┘
```

- **Tomar foto** opens the rear camera directly
  (`<input type="file" accept="image/*" capture="environment">`). On desktop it
  falls back to a file picker.
- After capture: preview of the photo with **Repetir** and
  **Confirmar entrega**.
- **Confirmar entrega** → status "Subiendo foto…" → upload → PATCH delivered →
  sheet closes, row shows delivered with a small 📷 badge.
- **Entregar sin foto** → PATCH delivered directly (today's behavior).
- Upload failure (bad signal, server error): the sheet stays open showing the
  error with **Reintentar** and **Entregar sin foto**. Nothing is marked
  delivered until one of those succeeds.
- Upload succeeded but the PATCH failed: show the error with **Reintentar**;
  the stored photo is reused (no re-upload).

Pickup / in-store orders keep today's one-tap behavior (no sheet).

The run sheet gets a pass to be comfortable at phone width (375px): stacked
cards, full-width tap targets ≥ 44px for "En camino" / "Entregado", address and
call / directions buttons visible without horizontal scroll.

## Architecture

### Data — migration `036_delivery_photos.sql`

```sql
CREATE TABLE delivery_photos (
  order_id   TEXT PRIMARY KEY REFERENCES orders(id),
  token      TEXT NOT NULL UNIQUE,      -- 32 hex chars, randomBytes(16)
  bytes      INTEGER NOT NULL,
  width      INTEGER NOT NULL,
  height     INTEGER NOT NULL,
  created_at TEXT NOT NULL              -- ISO 8601 UTC, like other tables
);
ALTER TABLE messages ADD COLUMN media_url TEXT;
```

`order_id` as primary key enforces one photo per order; replacing is an upsert
that also deletes the previous file. Each `ALTER` lives only in this migration
(SQLite has no `ADD COLUMN IF NOT EXISTS`; see the migrations concurrency note).

### Storage module — `lib/delivery-photos.ts` (server-only)

- `photosDir()` → `process.env.DELIVERY_PHOTOS_DIR ?? <cwd>/data/delivery-photos`,
  created on first write. Tests point it at a temp dir.
- `saveDeliveryPhoto(orderId, bytes: Buffer, dims)` → validates, writes
  `<token>.jpg` atomically (write to `.tmp`, rename), upserts the row, deletes
  the replaced file, returns `{ token }`.
- `getDeliveryPhoto(orderId)` → row or `undefined`.
- `readDeliveryPhotoByToken(token)` → `Buffer | undefined`; rejects anything
  not matching `/^[a-f0-9]{32}$/` before touching the filesystem (no path
  traversal), and requires the token to exist in the table.
- `deliveryPhotoUrl(token)` → absolute URL
  `${NEXT_PUBLIC_SITE_URL || "https://makythedivaflowers.com"}/api/delivery-photo/${token}`.

Validation in `saveDeliveryPhoto`: JPEG magic bytes (`FF D8 FF`), size
≤ 4.5 MB (Twilio's MMS limit is 5 MB), order exists and is a delivery order.

### Upload route — `POST /api/admin/orders/[id]/delivery-photo`

- Under `/api/admin/*`, so `proxy.ts` already requires the panel session; the
  handler re-checks the session like `product-images/route.ts` does.
- `multipart/form-data` with `file` (JPEG) plus `width` / `height` fields.
- Errors: 404 unknown order, 400 not a delivery order / not JPEG, 413 too large.
- Returns `{ token, url }` (`url` is the relative `/api/delivery-photo/<token>`
  for the preview / drawer).

The existing `PATCH /api/admin/orders/[id]/fulfillment` route is unchanged.

### Public image route — `GET /api/delivery-photo/[token]`

- Not under `/api/admin`, so not session-gated (the proxy matcher only gates
  `/api/admin/*`). The token is the access control.
- 200 `image/jpeg` with `Cache-Control: private, max-age=86400` and
  `X-Robots-Tag: noindex`; 404 for malformed or unknown tokens (same response
  for both).

### Client image prep — `lib/client/prepare-delivery-photo.ts`

- Decode with `createImageBitmap(file)` (browsers apply EXIF orientation),
  draw onto a canvas scaled so the long edge ≤ 1600px, export
  `canvas.toBlob("image/jpeg", 0.82)`. If the result exceeds 1.5 MB, retry at
  quality 0.7, then long edge 1200px.
- Re-encoding through canvas strips EXIF, including GPS — the buyer never
  receives the driver's location metadata.
- Returns `{ blob, width, height }`. Decode failure → the sheet shows "No se
  pudo leer la foto" with Repetir / Entregar sin foto.

### UI — `components/admin/dashboard/DeliverSheet.tsx`

One client component used by the three entry points. Props: the order (for
number / recipient / address), `onDelivered()`, `onClose()`. Owns the flow
above: capture → prepare → upload → PATCH. Each entry point opens it for
delivery orders instead of calling its current `advance(..., "delivered")`
directly. Strings go through `next-intl` (en + es admin messages).

### Messaging

- `sendSms(to, body, opts?: { mediaUrl?: string })` in `lib/twilio-server.ts`
  passes `mediaUrl: [opts.mediaUrl]` to `messages.create` when present.
- `SendMessageRequest` gains optional `mediaUrl`. `sendMessage` stores it in
  the new `messages.media_url` (both in the insert and dry-run paths) and
  forwards it **only on the SMS channel**; WhatsApp / email ignore it.
- `dispatchDelivered(order)`: after the existing guards, looks up
  `getDeliveryPhoto(order.id)`. If present **and** the channel is SMS **and**
  the site base URL is `https://` and not localhost, it passes
  `mediaUrl: deliveryPhotoUrl(token)` and the var `has_photo: "1"`. Otherwise
  the call is exactly today's.
- Template copy: the `delivered` body gets one extra localized line when
  `has_photo` is set — en "Here's a photo of the delivery 📷", es "Aquí tienes
  una foto de la entrega 📷". The template key stays `delivered`, so the
  24-hour dedupe (`hasRecentSuccess(..., "delivered", 24)`) is unchanged.
- The localhost guard keeps dev / preview runs from sending a production
  `mediaUrl` Twilio can't resolve to this machine's photo. Twilio fails an MMS
  asynchronously when it can't fetch the media, after our row already says
  `sent`, so the guard matters.

### Where the photo shows up in the panel

- **Order detail drawer:** a "Foto de entrega" block with the thumbnail
  (tap → full size in a new tab) and the time it was taken. The order payload
  gets `deliveryPhoto?: { url, createdAt }`.
- **Run sheet:** a 📷 badge on delivered rows that have a photo.
- **SMS Inbox** (`/admin/messages`): outbound bubbles with `media_url` render
  the thumbnail above the text (`conversation-storage` carries `mediaUrl`).

## Error handling summary

| Failure | Behavior |
|---|---|
| Photo can't be decoded in the browser | Message + Repetir / Entregar sin foto. |
| Upload fails / times out | Not marked delivered; Reintentar / Entregar sin foto. |
| Upload ok, PATCH fails | Reintentar reuses the stored photo. |
| Dispatch throws | Logged only, as today (`changeFulfillmentStatus` try/catch); the order is still delivered. |
| Twilio can't fetch media | Message fails on Twilio's side; surfaced in the Twilio log. Mitigated by the https / non-localhost guard. |
| Customer opted out (`messagingChannel = "none"`) | Nothing sent, photo still stored as proof. |

## Ops notes

- `data/delivery-photos/` must persist across Hostinger deploys the same way
  `data/diva.sqlite` does. Verify on the first deploy: upload a photo, redeploy,
  confirm `/api/delivery-photo/<token>` still returns it.
- Size: ~200–400 KB per photo. 1,000 deliveries ≈ 300 MB. No retention policy
  in v1; owner backups of `data/` should include the folder.
- `.gitignore` today lists only the `data/diva.sqlite*` files, not `data/`, so
  add an explicit `/data/delivery-photos/` line.

## Testing

Unit (vitest, `tests/unit/`):

- `delivery-photos.test.ts` — save writes the file + row, replace deletes the
  old file, rejects non-JPEG / oversize / pickup orders, token lookup rejects
  malformed tokens and unknown tokens, path traversal strings return undefined.
- `order-dispatch.test.ts` — delivered with photo on SMS → `mediaUrl` +
  `has_photo`; without photo → unchanged call; WhatsApp channel → no
  `mediaUrl`; localhost base URL → no `mediaUrl`; pickup → nothing sent.
- `messaging.test.ts` — `mediaUrl` stored in `media_url` and forwarded to
  `sendSms` only for SMS; dry-run stores it too.
- `messaging-templates.test.ts` — delivered body includes the photo line in
  en / es only when `has_photo` is set.
- Route tests for the upload (auth, 400 / 404 / 413, success) and the public
  GET (200 with headers, 404 for malformed / unknown).
- `DeliverSheet` component test (jsdom): sin foto path calls PATCH only; foto
  path uploads then PATCHes; upload failure keeps the order undelivered.

Browser check in the preview with `TWILIO_DRY_RUN=1` at phone width: run sheet
→ Entregado → upload a sample photo → order delivered, drawer shows the photo,
inbox shows the dry-run MMS row with thumbnail.
