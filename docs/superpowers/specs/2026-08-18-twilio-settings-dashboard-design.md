# Twilio Configuration in the Dashboard Settings — Design

**Date:** 2026-08-18
**Status:** Draft for review
**Author:** Santiago (with Claude)

## Problem

Twilio is configured entirely through `process.env` — `lib/twilio-server.ts`
reads `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`, and
`lib/messaging.ts` reads `TWILIO_SMS_ENABLED` and `TWILIO_DRY_RUN`. Changing any
of these means editing `.env.local` on the Hostinger server and restarting —
something the shop owner (non-technical, avoids anything server-side) cannot do.

The Google Places API key already solved the same problem: it lives in the
`settings` table, is edited from `/admin/settings`, and is read at runtime via
`lib/settings-storage.ts`. Twilio should work the same way, so the owner can set
up and operate SMS entirely from the dashboard.

## Goal

Make the full Twilio configuration editable from the settings tab, alongside the
Google Places key: Account SID, Auth Token, phone number, an SMS on/off switch,
and a test-mode (dry-run) switch — plus a "send test SMS" button so the owner can
verify the setup works without waiting for a real customer.

After this: the owner can paste their Twilio credentials, set the number, toggle
SMS live, send themselves a test, and never touch the server.

## Non-Goals (YAGNI)

- **No WhatsApp config.** The owner isn't using WhatsApp; `TWILIO_WHATSAPP_FROM`
  and `TWILIO_WHATSAPP_ENABLED` stay on env only. Adding them is scope creep.
- **No migration of existing env values into the DB.** Env stays as a fallback
  (see Architecture), so production keeps working untouched; the owner overrides
  from the dashboard when they choose to.
- **No per-message send UI, no campaign tooling.** This is configuration only.
- **No secret encryption-at-rest beyond what the DB already gives.** The Google
  key already lives in plaintext in the same `settings` table; matching that
  precedent, not raising the bar here. (Noted as a known limitation.)
- **No A2P 10DLC automation.** That remains an owner task in the Twilio console.

## Architecture

### 1. Read precedence: setting first, env fallback — `lib/twilio-config.ts` (new)

A small server-only module is the single source of truth for "what is Twilio's
current config", resolving each value as `getSetting(key) ?? process.env.X`:

```ts
export function twilioAccountSid(): string | undefined
export function twilioAuthToken(): string | undefined
export function twilioPhoneNumber(): string | undefined
export function twilioSmsEnabled(): boolean   // setting/env === "true"
export function twilioDryRun(): boolean        // setting/env === "true"
```

Setting-first means: if the dashboard has a value it wins; otherwise the existing
`.env.local` value is used, so nothing breaks for current production on day one.

`lib/settings-storage.ts` gains the five key constants:
`SETTING_TWILIO_ACCOUNT_SID`, `SETTING_TWILIO_AUTH_TOKEN`,
`SETTING_TWILIO_PHONE_NUMBER`, `SETTING_TWILIO_SMS_ENABLED`,
`SETTING_TWILIO_DRY_RUN`.

### 2. Rewire the two consumers to read through the helper

- `lib/twilio-server.ts`: `getTwilioClient()`, `sendSms` (the `from`), and
  `sendWhatsApp` (the WhatsApp `from` stays env-only via `process.env`) read
  through `twilio-config` instead of `process.env` directly.
- `lib/messaging.ts`: the `TWILIO_SMS_ENABLED` and `TWILIO_DRY_RUN` guards call
  `twilioSmsEnabled()` / `twilioDryRun()`. (The `TWILIO_WHATSAPP_ENABLED` guard
  is left on env — WhatsApp is out of scope.)

### 3. Cache invalidation for the Twilio client

`getTwilioClient()` currently caches a singleton built from env, which never
changes at runtime. Once credentials can change from the dashboard, a cached
client built from old credentials would keep sending. Fix: cache the client
alongside the `(sid, token)` it was built from; on each call, read the current
sid/token and rebuild if they differ.

```ts
let cached: { sid: string; token: string; client: Twilio } | null = null;
export function getTwilioClient(): Twilio | null {
  const sid = twilioAccountSid();
  const token = twilioAuthToken();
  if (!sid || !token) return null;
  if (cached && cached.sid === sid && cached.token === token) return cached.client;
  const client = twilio(sid, token);
  cached = { sid, token, client };
  return client;
}
```

`getSetting` is a fast indexed SQLite read; SMS sends are low-frequency, so
reading per call is fine. `__resetTwilioClient()` (test hook) still clears
`cached`.

### 4. Settings API — `app/api/admin/settings/route.ts`

Extend the existing route (already admin-guarded by `proxy.ts` for
`/api/admin/*`).

- **Allow-list** grows from `[google_places_api_key]` to include the five Twilio
  keys, so the PUT still rejects free-form key injection.
- **GET returns the EFFECTIVE (resolved) config** — each value read through
  `twilio-config` (setting `??` env), not the raw setting — so the dashboard
  always reflects what SMS is actually using. On prod day-one (env set, settings
  table empty) this correctly shows the fields as configured rather than "not
  set". Per key type:
  - `twilio_account_sid`, `twilio_auth_token` → masked `...last4` of the resolved
    value (like the Google key), or `null` when neither setting nor env has it.
  - `twilio_phone_number` → resolved value **in full** (not a secret; the owner
    must be able to read it back to confirm), or `null`.
  - `twilio_sms_enabled`, `twilio_dry_run` → the resolved boolean as `"true"` /
    `"false"` (never `null`), so the toggles and the live/test banner always show
    the true effective state.
  - The Google key stays setting-only masked (it has no env fallback), unchanged.
- **PUT validation** (new — today the route accepts any string):
  - `twilio_account_sid`: must start with `AC` and be 34 chars, or empty (clear).
  - `twilio_phone_number`: must match `+`digits, 11–15 digits (E.164), or empty.
  - `twilio_auth_token`: non-empty string when setting, or empty. No strict
    length/format check — Twilio could rotate the token format, and a wrong token
    fails loudly at send/test time anyway.
  - `twilio_sms_enabled`, `twilio_dry_run`: exactly `"true"` or `"false"`.
  - Empty value on any key deletes the setting (existing behaviour → falls back
    to env).

### 5. Test-send endpoint — `app/api/admin/settings/twilio-test/route.ts` (new)

`POST` with no body. Sends a fixed SMS ("Diva Flowers — prueba de configuración
✓") to the owner's mobile `SITE.mobile.e164` (`+15168512815`), using the current
resolved config, and returns the outcome so the UI can show it:

- `{ ok: true }` when Twilio accepts it (returns a message SID).
- `{ ok: false, error: "<twilio message>" }` when it fails — the raw Twilio error
  is surfaced so a `10DLC`/credential problem is legible to the owner.

Guards: returns a specific error if SMS isn't configured (`no credentials`) or if
`twilioSmsEnabled()` is false (`sms disabled — turn it on first`). The test send
**ignores dry-run** on purpose — a test that only simulates proves nothing; the
whole point is to confirm a real message leaves Twilio. This is stated in the UI.
Route lives under `/api/admin/*` so `proxy.ts` guards it automatically.

### 6. UI — a second section in `components/admin/settings/SettingsPage.tsx`

Below the Google Places section, a new "Mensajería SMS (Twilio)" section reusing
the existing visual pattern (masked status row, password input with show/hide
eye, save/clear). Contents:

- **Account SID** — password input, masked status, save/clear.
- **Auth Token** — password input, masked status, save/clear.
- **Phone number** — text input (not masked), shows the current number in full.
- **SMS en vivo** — a toggle. Turning it ON shows an inline warning: real messages
  will be sent to customers; confirm A2P 10DLC is registered.
- **Modo prueba (dry-run)** — a toggle, with a always-visible state line so the
  owner can never be unsure whether sends are simulated or real. When dry-run is
  ON, a clear "SIMULACIÓN — no se envían SMS reales" banner; when OFF, "EN VIVO —
  se envían SMS reales".
- **Enviar SMS de prueba** — a button that POSTs to the test endpoint and shows
  the result inline (green "Enviado a 516 851 2815" or red with the Twilio error).
  Disabled while sending; explains it sends a real message regardless of dry-run.

The settings page is currently a single-key component with local `useState` per
field. Adding five more fields plus two toggles plus a test button would bloat it.
**Refactor:** extract the existing Google-key block into a small `SettingField`
(or `SecretField`) presentational component, and add a `TwilioSettings`
subcomponent for the new section. This keeps `SettingsPage` a thin composition
and each field independently readable — a targeted improvement to code we're
already growing, not unrelated refactoring.

### 7. i18n

New keys under `admin_settings` in both `messages/en.json` and `messages/es.json`
for the section title, each label/description, the two toggle states, the warning
copy, the test button and its result states, and validation errors. Spanish is
the owner's working language; copy above shows the intended ES tone.

## Data flow

```
Owner opens /admin/settings
  → GET /api/admin/settings   (values RESOLVED as setting ?? env)
      google_places_api_key: "...ab12" | null              (setting-only, masked)
      twilio_account_sid:    "...cd34" | null               (resolved, masked)
      twilio_auth_token:     "...ef56" | null               (resolved, masked)
      twilio_phone_number:   "+15165551234" | null          (resolved, full)
      twilio_sms_enabled:    "true" | "false"               (resolved, never null)
      twilio_dry_run:        "true" | "false"               (resolved, never null)

Owner edits a field / toggles a switch
  → PUT /api/admin/settings { key, value }  (validated, allow-listed)
      → setSetting(key, value) or deleteSetting(key) when empty

Owner clicks "Enviar SMS de prueba"
  → POST /api/admin/settings/twilio-test
      → reads current config via twilio-config
      → sends real SMS to SITE.mobile.e164 (ignores dry-run)
      → { ok } | { ok:false, error }

Any later SMS (order confirmation, etc.)
  → sendMessage → messaging.ts guards call twilioSmsEnabled()/twilioDryRun()
                → twilio-server getTwilioClient()/from read via twilio-config
      → setting value wins; env is the fallback
```

## Error handling

- **Missing/partial credentials:** `getTwilioClient()` returns `null` when sid or
  token is absent (unchanged contract); `sendSms` throws `twilio_not_configured`,
  which `sendMessage` already catches and records as a `failed` message row. The
  test endpoint reports it as a legible error instead of throwing.
- **Bad input:** PUT validation rejects a malformed SID/number with a 400 and a
  field error the UI shows, so a typo can't silently disable sending.
- **Test send failure:** surfaced verbatim from Twilio (e.g. unregistered 10DLC,
  invalid `from`), which is the diagnostic the owner needs.
- **Cache staleness:** handled by the (sid, token)-keyed rebuild in §3.

## Testing

`tests/unit/twilio-config.test.ts` (new)
- setting present → setting wins over env
- setting absent → env fallback
- neither → undefined / false
- `twilioSmsEnabled`/`twilioDryRun` parse `"true"` only as true

`tests/unit/twilio-server.test.ts` (extend)
- `getTwilioClient` rebuilds when sid/token change between calls (cache
  invalidation); returns the same instance when unchanged
- reads `from` via twilio-config (setting overrides env)

`tests/unit/api-admin-settings.test.ts` (new — no settings-route test exists yet)
- GET masks sid/token, returns phone in full, returns flags as literals
- PUT rejects a non-`AC` SID, a non-E.164 number, a flag value other than
  true/false
- empty value deletes the setting

`tests/unit/api-admin-settings-twilio-test.test.ts` (new)
- returns `{ok:false}` with a clear reason when credentials missing / SMS disabled
- on a mocked successful Twilio send returns `{ok:true}` and targets
  `SITE.mobile.e164`
- ignores dry-run (a real send is attempted even when dry-run is on)

`tests/unit/messaging.test.ts` (extend)
- the SMS-enabled and dry-run guards honour the setting over env

Baseline: the full suite carries ~7 pre-existing failures unrelated to this work
(Chromium spawn ENOEXEC + checkout/preview + a date-sensitive checkout-schema
spec). Compare against base before attributing any failure to this change.

## Files touched (summary)

**New**
- `lib/twilio-config.ts`
- `app/api/admin/settings/twilio-test/route.ts`
- `components/admin/settings/SettingField.tsx` (extracted)
- `components/admin/settings/TwilioSettings.tsx`
- `tests/unit/twilio-config.test.ts`
- `tests/unit/api-admin-settings-twilio-test.test.ts`
- `tests/unit/api-admin-settings.test.ts`

**Modified**
- `lib/settings-storage.ts` — five key constants
- `lib/twilio-server.ts` — read via twilio-config; cache invalidation
- `lib/messaging.ts` — flag guards via twilio-config
- `app/api/admin/settings/route.ts` — allow-list, per-key masking, validation
- `components/admin/settings/SettingsPage.tsx` — compose the new section
- `messages/en.json`, `messages/es.json` — new `admin_settings` keys
- `tests/unit/twilio-server.test.ts`, `tests/unit/messaging.test.ts` — extend

No database migration — the `settings` table already exists and is schemaless
key/value.

## Security & safety notes

- **This lets a web UI enable live SMS and disable test mode.** A mistake sends
  real messages (cost + A2P compliance). Mitigations: the always-visible
  live/simulación state banner, the confirm-warning on enabling live SMS, and
  E.164/SID validation so a typo fails loudly rather than silently.
- **Secrets in plaintext in SQLite.** Matches the existing Google-key precedent;
  called out as a known limitation, not solved here. The DB file is server-side
  and not web-exposed; the GET masks secrets so the dashboard never re-displays
  them.
- **A2P 10DLC still required** for reliable delivery — the test-send button will
  surface a 10DLC problem as a concrete Twilio error, which is the fastest way for
  the owner to discover it.

## Open questions (defaults chosen; flag if you disagree)

1. **Test-send target is hardcoded to `SITE.mobile.e164`** (Maky's mobile) rather
   than a free-text field, to avoid turning the settings page into an
   arbitrary-SMS sender. If the owner wants to test to a different number, that's
   a small follow-up.
2. **Flags stored as `"true"`/`"false"` strings** in the same key/value table
   (no schema change), consistent with how everything else in `settings` is
   stored.
3. **Enabling live SMS uses an inline confirm/warning, not a modal.** Lighter and
   matches the page's current style; the always-visible state banner is the real
   safeguard.
