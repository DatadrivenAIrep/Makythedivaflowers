# SMS Delivery 3 — Opt-out/STOP + marketing campaign engine — Design

**Date:** 2026-08-29
**Status:** Draft for review
**Author:** Santiago (with Claude)

## Problem

The A2P-approved Twilio rail sends transactional SMS (order/payment/delivery
confirmations) to web buyers who opted in, and a separate `sms-marketing` tag is
already captured at checkout for buyers who also opted into promotions. But two
things are missing before we can actually run promotions:

1. **No opt-out handling.** Nothing in our code sees an inbound `STOP`. Twilio's
   carrier-level opt-out (if configured) would block the number, but our CRM
   would never know — a marketing blast built from `listCustomers({tag:"sms-marketing"})`
   would keep targeting people who opted out, wasting sends and looking
   non-compliant in our own records. There is **no inbound webhook at all** today.
2. **No way to send a campaign.** The only send paths are order-scoped
   (`sendMessage` requires an `orderId`; `messages.order_id` is `NOT NULL`;
   `MessageTemplate` is a closed transactional enum). There is no bulk sender, no
   campaign audit, and no admin UI to compose and send a promotion.

Promotions are the owner's highest-value ask, and opt-out is the legal
prerequisite for them. This delivery closes both, in that order.

## Goal

- **Opt-out (Part A):** an inbound Twilio webhook that syncs `STOP`/`START` into
  the CRM, plus a defensive suppression check at send time, so no opted-out
  customer is ever targeted.
- **Campaigns (Part B):** an admin surface to compose a bilingual promotional SMS,
  preview it against the `sms-marketing` segment (recipient count + SMS-segment
  count + test-send), and send it once — with per-recipient audit.

## Non-Goals (YAGNI — confirmed with the owner)

- **No scheduler / no cron.** Send-now only. No scheduled or recurring campaigns.
  (Consistent with the roadmap: nothing cron-based.)
- **No custom STOP/HELP keyword replies from us.** Twilio Advanced Opt-Out (an
  owner console setting) owns the legal auto-reply and the carrier-level block.
  Our webhook only *syncs* the resulting state into the CRM; it responds with an
  empty TwiML document so we never double-reply.
- **No predefined promo templates.** The owner writes free-text (with an optional
  `{nombre}` merge). No template library.
- **No manual per-customer recipient picking.** Every campaign targets the whole
  opted-in `sms-marketing` list. (Segment narrowing — e.g. `sms-marketing ∩ lapsed`
  — is deliberately deferred; `listCustomers` already supports it, so it is a cheap
  future add, not built now.)
- **No re-consent to marketing on `START`.** An inbound `START` restores the
  transactional channel only; re-opting into promotions stays an explicit action
  (next checkout), never an inferred one.
- **No queue/worker.** Synchronous send within the request, sized for the current
  list (≤ ~200 opted-in). A scale ceiling is documented; migrating to a queue is a
  future task if the list grows into the thousands.
- **No MMS / no images.** Text only.

## Architecture

### Part A — Opt-out / STOP

**Twilio Advanced Opt-Out (owner console task, documented not coded).** The owner
enables Advanced Opt-Out on the Messaging Service / campaign so Twilio auto-replies
to `STOP`/`HELP`/`START` and blocks/unblocks the number at the carrier level. This
is the compliance guarantee; our code does not reproduce it.

**New inbound webhook — `app/api/twilio/inbound/route.ts`.** Deliberately *outside*
`/api/admin/*` (which `proxy.ts` gates with a 401 for unauthenticated requests —
that would reject Twilio). Twilio's matcher in `proxy.ts` is `/api/admin/:path*`, so
`/api/twilio/*` is not intercepted.

- **Signature validation first.** Verify `X-Twilio-Signature` using the Twilio auth
  token (`twilioAuthToken()`) and the exact request URL + posted params, via the
  Twilio SDK's `validateRequest`. Reject with 403 if it fails. This is the only
  thing standing between this public URL and a forged opt-in/opt-out, so it is not
  optional. (Requires reading the raw form-encoded body.)
- **Sync logic (never throws; logs a structured line, always returns 200 TwiML):**
  - Parse `Body` (trim, uppercase). Twilio's opt-out keyword set, matched locally as
    defense-in-depth: `STOP, STOPALL, UNSUBSCRIBE, CANCEL, END, QUIT, BAJA`.
    → `getByPhone(From)`; if found, `updateCustomer(id, { messagingChannel: "none" })`
    and `removeTag(id, "sms-marketing")`.
  - Opt-in keyword set: `START, YES, UNSTOP, ALTA`.
    → `getByPhone(From)`; if found and currently `"none"`,
    `updateCustomer(id, { messagingChannel: "sms" })`. **Does not** re-add the
    `sms-marketing` tag.
  - Any other inbound body: no state change (a customer replying normally). Logged.
- **Response:** always `Content-Type: text/xml` with an empty `<Response></Response>`
  (200). Twilio Advanced Opt-Out already sent the human-facing reply.

**Phone matching (correctness-critical).** `customer-storage.ts` `normalizePhone`
only strips non-digits — it does *not* canonicalize the US country code. Twilio's
`From` is E.164 (`+15168512815` → `15168512815`, 11 digits), but customers are stored
with whatever the checkout form captured (typically 10 digits, `5168512815`). A naive
`getByPhone(From)` would therefore miss the customer and the STOP would sync nothing.
The webhook MUST resolve by the last 10 US digits. Add an exported
`getByPhoneUS(phone): Customer | null` to `customer-storage.ts` that matches on the
trailing 10 digits (strip a leading `1` from an 11-digit normalized value; match rows
by their last-10). The outbound side already funnels through `e164()` (which prepends
`+1`), so Twilio knows every customer as `+1XXXXXXXXXX` — this helper closes the loop
back. Explicit test: `From = "+15168512815"` resolves a customer stored as
`"5168512815"`.

**Defensive suppression at send time (used by Part B).** Even with Twilio's block,
the campaign sender:
1. Excludes `messagingChannel === "none"` when building the recipient list.
2. Re-checks each recipient's channel immediately before sending (in case they opted
   out between list-build and send).
3. On a Twilio `21610` ("attempt to send to unsubscribed recipient") error, marks
   that customer `messagingChannel: "none"` + `removeTag(..., "sms-marketing")` —
   syncing back an opt-out we hadn't recorded — and counts the send as skipped, not
   a hard failure.

### Part B — Campaign engine

**New data model** (a new migration; separate from order-scoped `messages`):

```sql
-- campaigns: one row per composed promotion
CREATE TABLE campaigns (
  id            TEXT PRIMARY KEY,
  body_es       TEXT NOT NULL,
  body_en       TEXT NOT NULL DEFAULT '',   -- empty ⇒ everyone gets ES
  segment       TEXT NOT NULL DEFAULT 'sms-marketing',
  status        TEXT NOT NULL DEFAULT 'draft',   -- draft | sending | sent
  recipient_count INTEGER NOT NULL DEFAULT 0,
  sent_count      INTEGER NOT NULL DEFAULT 0,
  failed_count    INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL,
  sent_at       TEXT
);

-- campaign_sends: one row per recipient attempt (audit + idempotency)
CREATE TABLE campaign_sends (
  id           TEXT PRIMARY KEY,
  campaign_id  TEXT NOT NULL,
  customer_id  TEXT NOT NULL,
  phone        TEXT NOT NULL,
  status       TEXT NOT NULL,               -- sent | failed | skipped | dry_run
  provider_sid TEXT,
  error        TEXT,
  created_at   TEXT NOT NULL
);
CREATE INDEX idx_campaign_sends_campaign ON campaign_sends(campaign_id);
```

**New storage module — `lib/campaign-storage.ts`:**
- `createDraft({ bodyEs, bodyEn, segment }): Campaign`
- `getCampaign(id): Campaign | null`
- `listCampaigns(limit?): Campaign[]` (newest first, for the history list)
- `markSending(id): boolean` (guarded transition `draft → sending`; returns false if
  not currently `draft` — the idempotency guard)
- `recordSend({ campaignId, customerId, phone, status, providerSid?, error? }): void`
- `finalizeCampaign(id, { sent, failed }): void` (`sending → sent`, writes counts +
  `sent_at`)

**New sender — `lib/campaign-sender.ts`:**
- `renderCampaignBody(campaign, customer): string` — pick `body_en` when the
  customer's `locale === "en"` and `body_en` is non-empty, else `body_es`; replace
  `{nombre}`/`{name}` with the customer's first name (drop the token cleanly when no
  name); append the locale-appropriate opt-out footer.
- `OPT_OUT_FOOTER = { es: "Responde STOP para cancelar.", en: "Reply STOP to opt out." }`
- `smsSegments(body): number` — GSM-7 vs UCS-2 aware segment count for the preview.
- `sendCampaign(id): Promise<{ sent; failed; skipped }>`:
  1. `markSending(id)` — abort (return existing counts) if the guard rejects.
  2. Build recipients: `listCustomers({ tag: campaign.segment })`, drop
     `messagingChannel === "none"`.
  3. For each (sequentially): re-check channel; if `twilioDryRun()` record `dry_run`
     without calling Twilio; else `sendSms(e164(phone), body)` → record `sent` with
     the provider SID, or `failed`/`skipped` (21610 → skipped + sync opt-out).
  4. `finalizeCampaign` with the tallies.

Reuses `sendSms`/`e164` from `twilio-server.ts` and the digits-only phone from the
customer row. It does **not** use `sendMessage`/`messages` (order-scoped) — marketing
audit lives in `campaign_sends`.

**API routes (under `/api/admin/`, auto-gated by `proxy.ts`):**
- `POST /api/admin/campaigns` — body `{ bodyEs, bodyEn }` → `createDraft` → returns
  the draft + `recipientCount` (from `listCustomers`). Zod-validated (non-empty ES,
  length cap).
- `GET  /api/admin/campaigns` — `listCampaigns` for the history table.
- `GET  /api/admin/campaigns/[id]` — draft/campaign detail incl. rendered preview and
  recipient count.
- `POST /api/admin/campaigns/[id]/send` — `sendCampaign(id)` → returns tallies. The
  `markSending` guard makes a duplicate POST a no-op.
- `POST /api/admin/campaigns/[id]/test` — send the rendered body once to a supplied
  number (defaults to `SITE.mobile.e164`), reusing the twilio-test validation. Does
  not touch campaign state.

### Admin UI — `/admin/campaigns`

New page `app/[locale]/admin/campaigns/page.tsx` + nav entry in
`components/admin/dashboard/DashboardShell.tsx` (`nav_campaigns` in `messages/{en,es}.json`).

Compose view (client component):
- Two textareas (ES required, EN optional) with `{nombre}` hint.
- Live preview per language: rendered sample (first name substituted, footer
  appended) + SMS-segment count + character count.
- Recipient count for the `sms-marketing` segment (from the draft/preview endpoint).
- **Test-send** to the owner's mobile (or a typed number).
- **"Enviar a N clientes"** — confirms, POSTs the send, shows tallies (enviados /
  fallidos / omitidos), disables after click.
- History table below: past campaigns with status, counts, sent-at.

Draft-first flow: composing + "Guardar borrador" creates the `campaign` (draft);
test-send and preview operate on it; "Enviar" transitions it once. This yields
idempotency (the `markSending` guard), a test-send before spending real SMS, and a
persistent audit trail.

## Data flow

```
Inbound SMS (STOP/START/other)
  → Twilio Advanced Opt-Out auto-replies + blocks/unblocks   [Twilio, no code]
  → POST /api/twilio/inbound  (public; X-Twilio-Signature verified)
      → STOP-family  → updateCustomer(none) + removeTag(sms-marketing)
      → START-family → updateCustomer(sms)  (no marketing re-tag)
      → other        → no-op (logged)
      → returns empty <Response/>

Compose promotion (admin)
  → POST /api/admin/campaigns            → createDraft → recipientCount
  → POST /api/admin/campaigns/[id]/test  → sendSms(owner)             [preview]
  → POST /api/admin/campaigns/[id]/send
      → markSending (guard: draft only)
      → listCustomers({tag:'sms-marketing'}) minus messagingChannel='none'
      → per recipient: re-check channel → dry-run? record dry_run
                                         : sendSms → record sent / failed
                                           (21610 → skipped + sync opt-out)
      → finalizeCampaign(sent, failed) → status 'sent'
```

## Error handling

- **Webhook:** signature failure → 403 (no state change). Any internal error →
  logged, still returns 200 empty TwiML (Twilio must not retry a sync failure into a
  loop; the carrier-level block already happened).
- **Send:** per-recipient try/catch; one failure never aborts the batch. `21610` is
  reclassified as `skipped` + an opt-out sync. Twilio outage → each recipient records
  `failed` with the error; the campaign still finalizes with accurate counts, and the
  owner can see failures in the results.
- **Idempotency:** `markSending` is the single guard — a re-POSTed send returns the
  already-computed tallies instead of re-sending. Draft creation is explicit and
  separate, so a page reload never sends.
- **Dry-run:** `twilioDryRun()` short-circuits the Twilio call but still writes
  `campaign_sends` (`dry_run`) and finalizes — the whole flow is exercisable without
  spending SMS.

## Testing

`tests/unit/api-twilio-inbound.test.ts` (new)
- valid STOP → `updateCustomer(none)` + `removeTag`; returns empty TwiML
- valid START → `updateCustomer(sms)`, no re-tag
- unknown body → no state change
- bad/missing `X-Twilio-Signature` → 403, no state change
- unknown `From` (no customer) → 200, no throw
- `From = "+15168512815"` (E.164) resolves a customer stored as `"5168512815"`
  (the `getByPhoneUS` last-10-digit match)

`tests/unit/customer-storage-phone.test.ts` (new — or extend an existing
customer-storage test)
- `getByPhoneUS("+15168512815")` matches a customer stored as `"5168512815"`; a
  10-digit input still matches; a non-existent number returns null

`tests/unit/campaign-storage.test.ts` (new)
- createDraft / getCampaign / listCampaigns round-trip
- `markSending` transitions `draft→sending` once; second call returns false
- `finalizeCampaign` writes counts + status `sent`

`tests/unit/campaign-sender.test.ts` (new)
- `renderCampaignBody`: EN customer + non-empty `body_en` → EN; empty `body_en` → ES;
  `{nombre}` → first name; missing name → clean drop; footer appended
- `smsSegments`: GSM-7 vs UCS-2 boundaries
- `sendCampaign`: sends to opted-in only; skips `messagingChannel:"none"`; dry-run
  records `dry_run` and never calls Twilio; `21610` → skipped + opt-out sync; guard
  makes a second call a no-op

`tests/unit/api-admin-campaigns.test.ts` (new)
- POST creates a draft + returns recipient count; GET lists; send returns tallies and
  is idempotent on re-POST; Zod rejects empty ES body

Baseline: the suite carries the known ~7 pre-existing failures (Chromium spawn
ENOEXEC + the date-sensitive checkout-schema specs). Compare before attributing.

## Files touched (summary)

**New**
- `db/migrations/018_campaigns.sql`
- `lib/campaign-storage.ts`, `lib/campaign-sender.ts`
- `app/api/twilio/inbound/route.ts`
- `app/api/admin/campaigns/route.ts`, `.../campaigns/[id]/route.ts`,
  `.../campaigns/[id]/send/route.ts`, `.../campaigns/[id]/test/route.ts`
- `app/[locale]/admin/campaigns/page.tsx` + client components under
  `components/admin/campaigns/`
- tests as listed above

**Modified**
- `lib/customer-storage.ts` — add `getByPhoneUS(phone)` (last-10-digit US match, for
  the inbound webhook); the opt-out itself reuses existing `updateCustomer` + `removeTag`
- `components/admin/dashboard/DashboardShell.tsx` — `nav_campaigns` link
- `messages/en.json`, `messages/es.json` — campaign UI + nav strings
- `proxy.ts` — no change needed (`/api/twilio/*` is already un-gated); confirm the
  matcher does not accidentally catch it

No change to the transactional `messages` table or `MessageTemplate`.

## Deployment note

Deploy = push to `origin/main` (auto-builds; ~1–2 min), then purge the Hostinger CDN
per the deploy-cache memory. **Two owner-console tasks, documented here, gate live
promotions:**
1. Enable **Advanced Opt-Out** on the Twilio Messaging Service / A2P campaign.
2. Set the **inbound "A message comes in" webhook** to
   `https://makythedivaflowers.com/api/twilio/inbound` (POST).

Verify after deploy: text `STOP` from a test phone and confirm the customer flips to
`messagingChannel:"none"` and loses the `sms-marketing` tag; compose a dry-run
campaign and confirm `campaign_sends` rows without real sends; then a small real
test-send before the first full blast.
