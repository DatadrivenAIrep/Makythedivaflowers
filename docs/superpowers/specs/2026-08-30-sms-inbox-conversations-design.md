# SMS Inbox — per-customer message conversations — Design

**Date:** 2026-08-30
**Status:** Draft for review
**Author:** Santiago (with Claude)

## Problem

The shop sends a growing number of SMS (order confirmations, delivery updates,
pickup-ready, review requests, marketing campaigns) but there is nowhere in the
dashboard to SEE them: which customer got what, whether it sent or failed, and —
critically — **what customers reply back**. Today inbound replies are effectively
lost: Twilio calls `/api/twilio/inbound`, but that handler only reads the body for
the STOP/START keyword and discards everything else. The owner has no inbox.

## Goal

A **"Mensajes"** tab in the admin dashboard showing SMS **grouped by customer as a
conversation** (chat style): a list of people the shop has texted with, and, per
person, the full back-and-forth — outbound transactional SMS, outbound marketing
campaign sends, and inbound replies — newest activity first, each with its status
and timestamp.

## Non-Goals (YAGNI)

- **No two-way replying from the dashboard (v1).** This is a read/inbox view. The
  owner still replies via WhatsApp/phone (there's already a WhatsApp deep-link on
  the order). Sending a free reply from the thread is a natural v2, not now.
- **No real-time push.** The page loads/refreshes on open + a manual refresh; no
  websockets.
- **No email/WhatsApp threads.** SMS only (the only live channel).
- **No read/unread state (v1).** A simple "latest activity" sort. An unread badge
  is a cheap v2 once inbound is captured.
- **No backfill of historical message bodies.** Outbound rows sent before this
  ships have no stored body — they render as the template's friendly label. Only
  messages sent after deploy carry their exact text.

## Architecture

### 1. Capture inbound SMS (the missing half)

**New table** (`db/migrations/019_inbound_messages.sql`):
```sql
CREATE TABLE IF NOT EXISTS inbound_messages (
  id           TEXT PRIMARY KEY,
  from_phone   TEXT NOT NULL,          -- normalized digits (normalizePhone)
  customer_id  TEXT,                   -- resolved via getByPhoneUS; null if unknown
  body         TEXT NOT NULL,
  provider_sid TEXT,
  created_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_inbound_from ON inbound_messages(from_phone);
CREATE INDEX IF NOT EXISTS idx_inbound_customer ON inbound_messages(customer_id);
```

**Webhook change** (`app/api/twilio/inbound/route.ts`): after the existing
signature check + STOP/START sync, ALSO persist the inbound message —
`insertInboundMessage({ fromPhone: normalizePhone(From), customerId: customer?.id,
body: Body, providerSid: MessageSid })`. Stays never-throwing (a storage failure is
logged, still returns empty TwiML). The STOP/START keyword rows are stored too (they
ARE inbound messages the owner may want to see).

**Owner task (already owed):** point Twilio's inbound webhook at
`https://makythedivaflowers.com/api/twilio/inbound`. Same URL as the opt-out work —
no new console step, it just now also feeds the inbox.

### 2. Store the outbound body (so the chat shows real text)

`messages` today stores `template` but not the rendered SMS text. Add a nullable
column and populate it going forward:
```sql
-- in the same 019 migration
ALTER TABLE messages ADD COLUMN body TEXT;
```
`lib/messaging.ts` already renders the body before sending — pass it into the
`messages` row (extend `InsertInput`/`insertMessage`, or set it on the post-send
`updateMessage`). Historical rows keep `body = NULL` and the UI falls back to the
template's localized label.

Marketing sends live in `campaign_sends`, which links to `campaigns` — the exact
text is the campaign's `body_es`/`body_en`, so the thread reads it from the joined
campaign (no new column needed there).

### 3. Unified conversation model — `lib/conversation-storage.ts` (new)

A conversation is keyed by **customer** when the phone resolves to one, else by the
bare **phone** (an inbound from someone with no customer record). Two reads:

- `listConversations(limit?): Conversation[]` — one row per customer/phone that has
  ANY message (in or out), with: display name (customer name or the phone),
  phone, `lastAt` (max timestamp across the three sources), `lastPreview` (the
  latest message's text/label + direction), and counts. Sorted by `lastAt` desc.
  Built by unioning the latest-per-group across `messages`, `campaign_sends`, and
  `inbound_messages`.
- `conversationThread(key): ThreadMessage[]` — every message for that customer/phone,
  chronological, each: `{ direction: "in" | "out", kind: "transactional" | "campaign" | "inbound", text, status?, template?, at }`.
  - transactional out ← `messages` (text = `body` or template label; status).
  - campaign out ← `campaign_sends` join `campaigns` (text = campaign body in the
    customer's locale; status).
  - inbound ← `inbound_messages` (text = body).

Grouping detail: match on the customer's stored phone AND `customer_id` so a
customer's transactional rows (customer_id) and their inbound (matched by phone) land
in the same thread. For unknown inbound phones, the thread key is the phone.

### 4. Admin API — under the auto-gated `/api/admin/`

- `GET /api/admin/messages` → `{ conversations: Conversation[] }` (the list).
- `GET /api/admin/messages/[key]` → `{ conversation: Conversation, thread: ThreadMessage[] }`
  where `[key]` is a customer id or a normalized phone.

### 5. UI — `/admin/messages` (new tab)

New nav entry in `DashboardShell.tsx` ("Mensajes" / "Messages"). A two-pane
chat layout (matching the admin card language):
- **Left:** conversation list — each row: customer name (or phone), a one-line
  preview of the latest message with a ↑/↓ direction hint, and a relative time.
  Click selects it. A search box filters by name/phone.
- **Right:** the selected thread — SMS-style bubbles, outbound aligned right
  (rouge/ink), inbound aligned left (bone), each with a tiny meta line: the
  channel/template or "Campaña", the status (✓ enviado / ✗ falló / omitido) for
  outbound, and the time. A header with the customer's name + phone + a WhatsApp
  deep-link (reuse the existing pattern) so the owner can reply out-of-band.
- On mobile the left list and the thread stack (list → tap → thread → back).
- A refresh control; loads on open.

Reuse: the message-bubble styling can mirror the campaigns `PreviewBubble`; the
list rows mirror the customers list; status pills mirror `CampaignStatusBadge`.

## Data flow

```
Customer replies "gracias!"  →  Twilio  →  POST /api/twilio/inbound
    → verify signature → STOP/START sync (existing)
    → insertInboundMessage(from, customerId?, body, sid)          [NEW]

Owner opens Mensajes tab
    → GET /api/admin/messages            → listConversations()   (union of 3 sources)
    → click a person → GET /api/admin/messages/[key]
                                         → conversationThread(key) (merged, chronological)

Every outbound send (existing dispatch/campaign paths) now also records the rendered
body on its messages row, so the thread shows the exact text going forward.
```

## Error handling

- Inbound storage failure → logged, webhook still returns 200 empty TwiML (never
  block Twilio, never lose the STOP that already applied).
- Unknown inbound phone (no customer) → stored with `customer_id = NULL`, shown as a
  phone-keyed conversation labeled by the number.
- The list/thread queries are read-only and admin-gated; empty state when there are
  no messages yet.

## Testing

- `tests/unit/inbound-storage.test.ts` — insert + list inbound; `getByPhoneUS`
  resolution stored as customer_id; unknown phone → null customer.
- `tests/unit/api-twilio-inbound.test.ts` (extend) — a normal reply is STORED (not
  just STOP); a STOP is stored AND syncs opt-out; signature failure stores nothing.
- `tests/unit/conversation-storage.test.ts` — listConversations groups by
  customer/phone, newest first, correct preview + direction; conversationThread
  merges transactional + campaign + inbound in chronological order with right
  direction/status; outbound body falls back to template label when null.
- `tests/unit/api-admin-messages.test.ts` — list + thread routes shape.
- `tests/unit/messaging.test.ts` (extend) — a sent message records its rendered body.

Baseline: the suite carries the known ~7 pre-existing failures (Chromium + date-
sensitive checkout-schema). Compare before attributing.

## Files touched (summary)

**New**
- `db/migrations/019_inbound_messages.sql`
- `lib/inbound-storage.ts` (insert/list inbound)
- `lib/conversation-storage.ts` (listConversations, conversationThread)
- `app/api/admin/messages/route.ts`, `app/api/admin/messages/[key]/route.ts`
- `app/[locale]/admin/messages/page.tsx` + `components/admin/messages/*` (list + thread)
- tests as listed

**Modified**
- `app/api/twilio/inbound/route.ts` — persist inbound
- `lib/messaging.ts` + `lib/message-storage.ts` — store the rendered `body`
- `components/admin/dashboard/DashboardShell.tsx` — nav link
- `messages/en.json`, `messages/es.json` — nav + inbox strings

## Deployment note

Deploy = push to `origin/main` + purge the Hostinger CDN. Inbound capture needs the
Twilio inbound webhook pointed at `/api/twilio/inbound` (the opt-out task) — until
then the inbox shows outbound only. No customer data leaves the app.
