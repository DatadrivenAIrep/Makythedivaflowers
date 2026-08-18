# Twilio Configuration in the Dashboard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the full Twilio config (Account SID, Auth Token, phone number, SMS on/off, dry-run) editable from `/admin/settings` alongside the Google Places key, read setting-first with env fallback, plus a send-test-SMS button.

**Architecture:** A new `lib/twilio-config.ts` resolves each value as `setting ?? env`. `lib/twilio-server.ts` and `lib/messaging.ts` read through it instead of `process.env`. The existing settings API + `SettingsPage` gain the five keys, per-key masking/validation, and a new test-send endpoint. The UI grows a second section built from an extracted `SecretField` plus a `TwilioSettings` subcomponent.

**Tech Stack:** Next.js 16 (App Router), TypeScript, Zod, `node:sqlite` via `lib/db.ts`, `twilio` SDK, next-intl, vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-08-18-twilio-settings-dashboard-design.md`

---

## Before you start

Read the spec. Then five things about this codebase and this plan:

1. **`server-only` is aliased in tests** (`vitest.config.ts` → `tests/stubs/server-only.ts`), so `lib/*` modules that import it are testable directly. Do not `vi.mock("server-only")`.
2. **DB-touching tests use an in-memory database**: `vi.stubEnv("SQLITE_FILE", ":memory:")` in `beforeEach`, `closeDb()` in `afterEach`. `getDb()` caches a singleton.
3. **`npm test` has ~7 pre-existing failures on `main`** (Chromium spawn ENOEXEC, print/preview, a date-sensitive checkout-schema spec). Compare against base before blaming your change.
4. **Resolved-config refinement (already in the spec):** the settings `GET` returns the *effective* config — each Twilio value read through `twilio-config` (`setting ?? env`), not the raw setting row — so on prod day-one (env set, settings empty) the dashboard shows the fields as configured, and the live/simulación banner always shows the true state. Secrets are still masked; flags are always `"true"`/`"false"`.
5. **`lib/twilio-server.ts` will start calling `getSetting` (via twilio-config), so its unit test now needs a DB.** Task 2 adds `SQLITE_FILE=:memory:` + `closeDb()` to that test file. Leave the WhatsApp env paths (`TWILIO_WHATSAPP_FROM`, `TWILIO_WHATSAPP_ENABLED`) untouched — WhatsApp is out of scope.

One deliberate refinement to the spec's UI section, decided for risk: **the working Google-key block is refactored to use the new `SecretField` too** (the spec's intent), and a render test is added as its safety net, since that block currently has no test.

---

## File structure

**New**

| File | Responsibility |
|---|---|
| `lib/twilio-config.ts` | Single resolver for Twilio config: `setting ?? env`, per value. |
| `app/api/admin/settings/twilio-test/route.ts` | POST that sends one real test SMS to the owner's mobile and reports the outcome. |
| `components/admin/settings/SecretField.tsx` | Presentational masked-secret input (status row, show/hide eye, save/clear). Reused by Google + the two Twilio secrets. |
| `components/admin/settings/TwilioSettings.tsx` | The Twilio section: SID/token fields, phone field, two toggles + live banner, test button. |
| `tests/unit/twilio-config.test.ts` | Precedence + boolean parsing. |
| `tests/unit/api-admin-settings.test.ts` | GET masking/resolution, PUT validation. |
| `tests/unit/api-admin-settings-twilio-test.test.ts` | Test-send endpoint. |
| `tests/unit/TwilioSettings.test.tsx` | Section renders, banner reflects state, test button posts. |

**Modified**

| File | Change |
|---|---|
| `lib/settings-storage.ts` | five `SETTING_TWILIO_*` key constants |
| `lib/twilio-server.ts` | read via twilio-config; `(sid,token)`-keyed cache |
| `lib/messaging.ts` | flag guards via twilio-config |
| `app/api/admin/settings/route.ts` | allow-list, resolved GET, per-key validation |
| `components/admin/settings/SettingsPage.tsx` | Google block → `SecretField`; render `<TwilioSettings/>` |
| `messages/en.json`, `messages/es.json` | new `admin_settings` keys |
| `tests/unit/twilio-server.test.ts` | `:memory:` DB + cache-invalidation test |
| `tests/unit/messaging.test.ts` | setting-overrides-env cases |

No DB migration — the `settings` table is schemaless key/value.

---

## Task 1: `twilio-config` resolver + key constants

**Files:**
- Modify: `lib/settings-storage.ts` (append constants after `SETTING_GOOGLE_PLACES_KEY`)
- Create: `lib/twilio-config.ts`
- Test: `tests/unit/twilio-config.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/twilio-config.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb } from "@/lib/db";
import {
  setSetting,
  SETTING_TWILIO_ACCOUNT_SID,
  SETTING_TWILIO_SMS_ENABLED,
  SETTING_TWILIO_DRY_RUN,
} from "@/lib/settings-storage";
import {
  twilioAccountSid,
  twilioSmsEnabled,
  twilioDryRun,
} from "@/lib/twilio-config";

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
});
afterEach(() => {
  closeDb();
  vi.unstubAllEnvs();
});

describe("twilio-config", () => {
  it("setting wins over env", () => {
    vi.stubEnv("TWILIO_ACCOUNT_SID", "ACenvvalue");
    setSetting(SETTING_TWILIO_ACCOUNT_SID, "ACsettingvalue");
    expect(twilioAccountSid()).toBe("ACsettingvalue");
  });

  it("falls back to env when no setting", () => {
    vi.stubEnv("TWILIO_ACCOUNT_SID", "ACenvvalue");
    expect(twilioAccountSid()).toBe("ACenvvalue");
  });

  it("undefined when neither setting nor env", () => {
    expect(twilioAccountSid()).toBeUndefined();
  });

  it("twilioSmsEnabled: a 'true' setting overrides a 'false' env", () => {
    vi.stubEnv("TWILIO_SMS_ENABLED", "false");
    setSetting(SETTING_TWILIO_SMS_ENABLED, "true");
    expect(twilioSmsEnabled()).toBe(true);
  });

  it("twilioDryRun parses only 'true' as true", () => {
    setSetting(SETTING_TWILIO_DRY_RUN, "false");
    expect(twilioDryRun()).toBe(false);
    setSetting(SETTING_TWILIO_DRY_RUN, "true");
    expect(twilioDryRun()).toBe(true);
  });
});
```

- [ ] **Step 2: Run it — expect failure**

```bash
npm test -- tests/unit/twilio-config.test.ts
```
Expected: FAIL — `@/lib/twilio-config` doesn't resolve, and the `SETTING_TWILIO_*` imports are undefined.

- [ ] **Step 3: Add the key constants**

Append to `lib/settings-storage.ts`, after the existing `export const SETTING_GOOGLE_PLACES_KEY = ...` line:

```ts
export const SETTING_TWILIO_ACCOUNT_SID = "twilio_account_sid";
export const SETTING_TWILIO_AUTH_TOKEN = "twilio_auth_token";
export const SETTING_TWILIO_PHONE_NUMBER = "twilio_phone_number";
export const SETTING_TWILIO_SMS_ENABLED = "twilio_sms_enabled";
export const SETTING_TWILIO_DRY_RUN = "twilio_dry_run";
```

- [ ] **Step 4: Write the resolver**

Create `lib/twilio-config.ts`:

```ts
import "server-only";
import {
  getSetting,
  SETTING_TWILIO_ACCOUNT_SID,
  SETTING_TWILIO_AUTH_TOKEN,
  SETTING_TWILIO_PHONE_NUMBER,
  SETTING_TWILIO_SMS_ENABLED,
  SETTING_TWILIO_DRY_RUN,
} from "@/lib/settings-storage";

// Each value resolves setting-first, env as fallback. This is the single source
// of truth for "what is Twilio's current config" — the client, the flag guards,
// and the settings GET all read through here.

export function twilioAccountSid(): string | undefined {
  return getSetting(SETTING_TWILIO_ACCOUNT_SID) ?? process.env.TWILIO_ACCOUNT_SID;
}

export function twilioAuthToken(): string | undefined {
  return getSetting(SETTING_TWILIO_AUTH_TOKEN) ?? process.env.TWILIO_AUTH_TOKEN;
}

export function twilioPhoneNumber(): string | undefined {
  return getSetting(SETTING_TWILIO_PHONE_NUMBER) ?? process.env.TWILIO_PHONE_NUMBER;
}

export function twilioSmsEnabled(): boolean {
  return (getSetting(SETTING_TWILIO_SMS_ENABLED) ?? process.env.TWILIO_SMS_ENABLED) === "true";
}

export function twilioDryRun(): boolean {
  return (getSetting(SETTING_TWILIO_DRY_RUN) ?? process.env.TWILIO_DRY_RUN) === "true";
}
```

- [ ] **Step 5: Run it — expect pass**

```bash
npm test -- tests/unit/twilio-config.test.ts
```
Expected: PASS (5 tests).

- [ ] **Step 6: Typecheck**

```bash
npx tsc --noEmit
```
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add lib/settings-storage.ts lib/twilio-config.ts tests/unit/twilio-config.test.ts
git commit -m "feat(settings): twilio-config resolver (setting over env)"
```

---

## Task 2: Rewire `twilio-server` + client cache invalidation

**Files:**
- Modify: `lib/twilio-server.ts`
- Test: `tests/unit/twilio-server.test.ts`

- [ ] **Step 1: Update the test setup and add the cache-invalidation test**

Replace the top of `tests/unit/twilio-server.test.ts` (the imports + `beforeEach`) with this, and append the new test. The file now needs a DB because `getTwilioClient` reads config through `twilio-config` → `getSetting`.

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { e164, getTwilioClient, __resetTwilioClient } from "@/lib/twilio-server";
import { setSetting } from "@/lib/settings-storage";
import { closeDb } from "@/lib/db";

beforeEach(() => {
  vi.unstubAllEnvs();
  __resetTwilioClient();
  vi.stubEnv("SQLITE_FILE", ":memory:");
});
afterEach(() => {
  closeDb();
  vi.unstubAllEnvs();
});
```

Keep the existing `describe("e164", ...)` and `describe("getTwilioClient", ...)` blocks as they are. Append inside the `getTwilioClient` describe:

```ts
  it("returns the same instance while credentials are unchanged", () => {
    vi.stubEnv("TWILIO_ACCOUNT_SID", "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx");
    vi.stubEnv("TWILIO_AUTH_TOKEN", "token_one_at_least_32_chars_long_xx");
    const first = getTwilioClient();
    expect(first).not.toBeNull();
    expect(getTwilioClient()).toBe(first);
  });

  it("rebuilds the client when a credential changes via settings", () => {
    vi.stubEnv("TWILIO_ACCOUNT_SID", "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx");
    vi.stubEnv("TWILIO_AUTH_TOKEN", "token_one_at_least_32_chars_long_xx");
    const first = getTwilioClient();
    setSetting("twilio_auth_token", "token_two_at_least_32_chars_long_xx");
    const second = getTwilioClient();
    expect(second).not.toBe(first);
  });
```

- [ ] **Step 2: Run it — expect failure**

```bash
npm test -- tests/unit/twilio-server.test.ts
```
Expected: FAIL — the singleton never rebuilds, so `second` equals `first`.

- [ ] **Step 3: Rewire the module**

Replace the top of `lib/twilio-server.ts` (imports through `__resetTwilioClient`) with:

```ts
import "server-only";
import twilio, { type Twilio } from "twilio";
import { twilioAccountSid, twilioAuthToken, twilioPhoneNumber } from "@/lib/twilio-config";

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

// Test hook only — vitest stubEnv changes envs but the singleton can leak.
export function __resetTwilioClient(): void {
  cached = null;
}
```

Leave `e164` unchanged. In `sendSms`, change the `from` source from env to the resolver:

```ts
export async function sendSms(to: string, body: string): Promise<{ sid: string }> {
  const c = getTwilioClient();
  if (!c) throw new Error("twilio_not_configured");
  const from = twilioPhoneNumber();
  if (!from) throw new Error("twilio_from_missing");
  const msg = await c.messages.create({ to: e164(to), from, body });
  return { sid: msg.sid };
}
```

Leave `sendWhatsApp` unchanged (its `from` stays `process.env.TWILIO_WHATSAPP_FROM` — WhatsApp is out of scope).

- [ ] **Step 4: Run it — expect pass**

```bash
npm test -- tests/unit/twilio-server.test.ts
```
Expected: PASS (all e164 + getTwilioClient tests, including the two new ones).

- [ ] **Step 5: Typecheck**

```bash
npx tsc --noEmit
```
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add lib/twilio-server.ts tests/unit/twilio-server.test.ts
git commit -m "refactor(twilio): read config via twilio-config, invalidate client cache on cred change"
```

Note: the `from`-via-config change is a one-liner covered by twilio-config's precedence tests plus tsc; a dedicated `sendSms` test would require mocking the Twilio client's `messages.create`, which is out of proportion for a one-line source swap.

---

## Task 3: Rewire `messaging.ts` flag guards

**Files:**
- Modify: `lib/messaging.ts`
- Test: `tests/unit/messaging.test.ts`

- [ ] **Step 1: Add the setting-overrides-env tests**

`tests/unit/messaging.test.ts` already stubs `SQLITE_FILE=:memory:`, `TWILIO_SMS_ENABLED`, `TWILIO_DRY_RUN`, and has a `baseReq`. Add the `setSetting` import at the top:

```ts
import { setSetting } from "@/lib/settings-storage";
```

Append these tests inside the `describe("sendMessage", ...)` block:

```ts
  it("a 'false' twilio_sms_enabled setting overrides a 'true' env", async () => {
    vi.stubEnv("TWILIO_SMS_ENABLED", "true");
    setSetting("twilio_sms_enabled", "false");
    const res = await sendMessage(baseReq);
    expect(res.status).toBe("skipped");
    expect(res.error).toBe("sms_disabled");
  });

  it("a 'false' twilio_dry_run setting overrides a 'true' env (attempts a real send)", async () => {
    // SMS enabled, env dry-run true, but the setting forces dry-run off.
    vi.stubEnv("TWILIO_SMS_ENABLED", "true");
    vi.stubEnv("TWILIO_DRY_RUN", "true");
    setSetting("twilio_dry_run", "false");
    // No real Twilio creds configured, so a real attempt fails at send —
    // proving it did NOT take the dry-run path (which would return "sent").
    const res = await sendMessage(baseReq);
    expect(res.status).toBe("failed");
  });
```

- [ ] **Step 2: Run it — expect failure**

```bash
npm test -- tests/unit/messaging.test.ts
```
Expected: FAIL — the guards still read `process.env`, so the first new test returns `"sent"` (dry-run) instead of `"skipped"`, and the second returns `"sent"` instead of `"failed"`.

- [ ] **Step 3: Rewire the guards**

In `lib/messaging.ts`, add the import near the top:

```ts
import { twilioSmsEnabled, twilioDryRun } from "@/lib/twilio-config";
```

Change the SMS-enabled guard (currently `process.env.TWILIO_SMS_ENABLED !== "true"`):

```ts
  if (req.channel === "sms" && !twilioSmsEnabled()) {
    updateMessage(id, { status: "skipped", error: "sms_disabled" });
    return { id, status: "skipped", error: "sms_disabled" };
  }
```

Change the dry-run guard (currently `process.env.TWILIO_DRY_RUN === "true"`):

```ts
  if (twilioDryRun()) {
```

Leave the `TWILIO_WHATSAPP_ENABLED` guard on `process.env` (WhatsApp is out of scope).

- [ ] **Step 4: Run it — expect pass**

```bash
npm test -- tests/unit/messaging.test.ts
```
Expected: PASS — all existing tests (their env stubs still work via fallback) plus the two new ones.

- [ ] **Step 5: Typecheck**

```bash
npx tsc --noEmit
```
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add lib/messaging.ts tests/unit/messaging.test.ts
git commit -m "refactor(messaging): read sms-enabled/dry-run via twilio-config"
```

---

## Task 4: Settings API — allow-list, resolved GET, validation

**Files:**
- Modify: `app/api/admin/settings/route.ts`
- Test: `tests/unit/api-admin-settings.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/api-admin-settings.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb } from "@/lib/db";
import { setSetting } from "@/lib/settings-storage";
import { GET, PUT } from "@/app/api/admin/settings/route";

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
});
afterEach(() => {
  closeDb();
  vi.unstubAllEnvs();
});

function put(body: unknown) {
  return PUT(
    new Request("http://x/api/admin/settings", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

const VALID_SID = "ACabcdefghijklmnopqrstuvwxyz012345"; // AC + 32 chars

describe("settings route — twilio", () => {
  it("GET masks the sid, returns the phone in full, and flags as booleans", async () => {
    setSetting("twilio_account_sid", VALID_SID);
    setSetting("twilio_phone_number", "+15165551234");
    setSetting("twilio_sms_enabled", "true");
    const body = await (await GET()).json();
    expect(body.twilio_account_sid).toBe("...2345");
    expect(body.twilio_phone_number).toBe("+15165551234");
    expect(body.twilio_sms_enabled).toBe("true");
    expect(body.twilio_dry_run).toBe("false"); // unset setting + unset env → false
  });

  it("GET resolves a value from env when no setting exists", async () => {
    vi.stubEnv("TWILIO_PHONE_NUMBER", "+15169999999");
    const body = await (await GET()).json();
    expect(body.twilio_phone_number).toBe("+15169999999");
  });

  it("PUT rejects a malformed SID", async () => {
    expect((await put({ key: "twilio_account_sid", value: "not-a-sid" })).status).toBe(400);
  });

  it("PUT rejects a non-E.164 phone", async () => {
    expect((await put({ key: "twilio_phone_number", value: "5165551234" })).status).toBe(400);
  });

  it("PUT rejects a flag value other than true/false", async () => {
    expect((await put({ key: "twilio_sms_enabled", value: "yes" })).status).toBe(400);
  });

  it("PUT rejects an unknown key", async () => {
    expect((await put({ key: "evil_key", value: "x" })).status).toBe(400);
  });

  it("PUT stores a valid SID, GET reads it back masked", async () => {
    expect((await put({ key: "twilio_account_sid", value: VALID_SID })).status).toBe(200);
    const body = await (await GET()).json();
    expect(body.twilio_account_sid).toBe("...2345");
  });

  it("PUT with an empty value clears the setting", async () => {
    setSetting("twilio_phone_number", "+15165551234");
    await put({ key: "twilio_phone_number", value: "" });
    const body = await (await GET()).json();
    expect(body.twilio_phone_number).toBeNull(); // no env fallback in this test
  });
});
```

- [ ] **Step 2: Run it — expect failure**

```bash
npm test -- tests/unit/api-admin-settings.test.ts
```
Expected: FAIL — the route only knows `google_places_api_key`, so twilio keys are absent from GET and rejected by PUT with the wrong shape.

- [ ] **Step 3: Rewrite the route**

Replace the entire contents of `app/api/admin/settings/route.ts` with:

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getSetting,
  setSetting,
  deleteSetting,
  SETTING_GOOGLE_PLACES_KEY,
  SETTING_TWILIO_ACCOUNT_SID,
  SETTING_TWILIO_AUTH_TOKEN,
  SETTING_TWILIO_PHONE_NUMBER,
  SETTING_TWILIO_SMS_ENABLED,
  SETTING_TWILIO_DRY_RUN,
} from "@/lib/settings-storage";
import {
  twilioAccountSid,
  twilioAuthToken,
  twilioPhoneNumber,
  twilioSmsEnabled,
  twilioDryRun,
} from "@/lib/twilio-config";

export const runtime = "nodejs";

// The only keys exposed through this route — guards against free-form injection.
const ALLOWED_KEYS = [
  SETTING_GOOGLE_PLACES_KEY,
  SETTING_TWILIO_ACCOUNT_SID,
  SETTING_TWILIO_AUTH_TOKEN,
  SETTING_TWILIO_PHONE_NUMBER,
  SETTING_TWILIO_SMS_ENABLED,
  SETTING_TWILIO_DRY_RUN,
] as const;

const putSchema = z
  .object({ key: z.enum(ALLOWED_KEYS), value: z.string() })
  .superRefine((data, ctx) => {
    const v = data.value.trim();
    if (v === "") return; // empty clears the setting — always allowed
    if (data.key === SETTING_TWILIO_ACCOUNT_SID && !/^AC[a-zA-Z0-9]{32}$/.test(v)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "invalid_sid", path: ["value"] });
    }
    if (data.key === SETTING_TWILIO_PHONE_NUMBER && !/^\+\d{11,15}$/.test(v)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "invalid_phone", path: ["value"] });
    }
    if (
      (data.key === SETTING_TWILIO_SMS_ENABLED || data.key === SETTING_TWILIO_DRY_RUN) &&
      v !== "true" &&
      v !== "false"
    ) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "invalid_flag", path: ["value"] });
    }
  });

function mask(v: string | undefined): string | null {
  return v ? `...${v.slice(-4)}` : null;
}

export async function GET() {
  // Google key is setting-only (no env fallback), kept as-is. Twilio values are
  // resolved (setting ?? env) so the dashboard reflects the effective config.
  const google = getSetting(SETTING_GOOGLE_PLACES_KEY);
  return NextResponse.json({
    [SETTING_GOOGLE_PLACES_KEY]: mask(google ?? undefined),
    [SETTING_TWILIO_ACCOUNT_SID]: mask(twilioAccountSid()),
    [SETTING_TWILIO_AUTH_TOKEN]: mask(twilioAuthToken()),
    [SETTING_TWILIO_PHONE_NUMBER]: twilioPhoneNumber() ?? null,
    [SETTING_TWILIO_SMS_ENABLED]: String(twilioSmsEnabled()),
    [SETTING_TWILIO_DRY_RUN]: String(twilioDryRun()),
  });
}

export async function PUT(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = putSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ errors: parsed.error.flatten() }, { status: 400 });
  }
  const { key } = parsed.data;
  const value = parsed.data.value.trim();
  if (value === "") {
    deleteSetting(key);
  } else {
    setSetting(key, value);
  }
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Run it — expect pass**

```bash
npm test -- tests/unit/api-admin-settings.test.ts
```
Expected: PASS (8 tests).

- [ ] **Step 5: Typecheck**

```bash
npx tsc --noEmit
```
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add app/api/admin/settings/route.ts tests/unit/api-admin-settings.test.ts
git commit -m "feat(settings): expose + validate twilio keys in the settings API"
```

---

## Task 5: Test-send endpoint

**Files:**
- Create: `app/api/admin/settings/twilio-test/route.ts`
- Test: `tests/unit/api-admin-settings-twilio-test.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/api-admin-settings-twilio-test.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";

const getTwilioClientMock = vi.fn();
const sendSmsMock = vi.fn();
vi.mock("@/lib/twilio-server", () => ({
  getTwilioClient: () => getTwilioClientMock(),
  sendSms: (...a: unknown[]) => sendSmsMock(...a),
}));

const twilioSmsEnabledMock = vi.fn();
vi.mock("@/lib/twilio-config", () => ({
  twilioSmsEnabled: () => twilioSmsEnabledMock(),
}));

import { POST } from "@/app/api/admin/settings/twilio-test/route";
import { SITE } from "@/data/site";

beforeEach(() => {
  getTwilioClientMock.mockReset().mockReturnValue({}); // a truthy client
  sendSmsMock.mockReset().mockResolvedValue({ sid: "SM1" });
  twilioSmsEnabledMock.mockReset().mockReturnValue(true);
});

describe("twilio test-send endpoint", () => {
  it("returns no_credentials when the client is null", async () => {
    getTwilioClientMock.mockReturnValue(null);
    const body = await (await POST()).json();
    expect(body).toEqual({ ok: false, error: "no_credentials" });
    expect(sendSmsMock).not.toHaveBeenCalled();
  });

  it("returns sms_disabled when SMS is off", async () => {
    twilioSmsEnabledMock.mockReturnValue(false);
    const body = await (await POST()).json();
    expect(body).toEqual({ ok: false, error: "sms_disabled" });
    expect(sendSmsMock).not.toHaveBeenCalled();
  });

  it("sends to the owner mobile and returns ok on success", async () => {
    const body = await (await POST()).json();
    expect(body).toEqual({ ok: true });
    expect(sendSmsMock).toHaveBeenCalledWith(SITE.mobile.e164, expect.any(String));
  });

  it("surfaces the twilio error verbatim on failure", async () => {
    sendSmsMock.mockRejectedValue(new Error("21610 unregistered"));
    const body = await (await POST()).json();
    expect(body).toEqual({ ok: false, error: "21610 unregistered" });
  });
});
```

- [ ] **Step 2: Run it — expect failure**

```bash
npm test -- tests/unit/api-admin-settings-twilio-test.test.ts
```
Expected: FAIL — `@/app/api/admin/settings/twilio-test/route` doesn't resolve.

- [ ] **Step 3: Write the endpoint**

Create `app/api/admin/settings/twilio-test/route.ts`:

```ts
import { NextResponse } from "next/server";
import { SITE } from "@/data/site";
import { twilioSmsEnabled } from "@/lib/twilio-config";
import { getTwilioClient, sendSms } from "@/lib/twilio-server";

export const runtime = "nodejs";

// Sends ONE real SMS to the owner's mobile so the config can be verified.
// Deliberately calls sendSms directly, which bypasses the dry-run branch in
// sendMessage — a test that only simulates proves nothing. Guarded by proxy.ts
// (all /api/admin/* is admin-only).
export async function POST() {
  if (!getTwilioClient()) {
    return NextResponse.json({ ok: false, error: "no_credentials" });
  }
  if (!twilioSmsEnabled()) {
    return NextResponse.json({ ok: false, error: "sms_disabled" });
  }
  try {
    await sendSms(SITE.mobile.e164, "Diva Flowers — prueba de configuración ✓");
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) });
  }
}
```

- [ ] **Step 4: Run it — expect pass**

```bash
npm test -- tests/unit/api-admin-settings-twilio-test.test.ts
```
Expected: PASS (4 tests).

- [ ] **Step 5: Typecheck**

```bash
npx tsc --noEmit
```
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add app/api/admin/settings/twilio-test/route.ts tests/unit/api-admin-settings-twilio-test.test.ts
git commit -m "feat(settings): add twilio test-send endpoint"
```

---

## Task 6: Extract `SecretField` + i18n + refactor the Google block

**Files:**
- Create: `components/admin/settings/SecretField.tsx`
- Modify: `components/admin/settings/SettingsPage.tsx` (Google block → `SecretField`)
- Modify: `messages/en.json`, `messages/es.json` (add all Twilio + section keys now, so Task 7 has them)
- Test: `tests/unit/SettingsPage.test.tsx` (new — safety net for the refactored Google block)

- [ ] **Step 1: Add all the i18n keys**

In `messages/en.json`, inside `admin_settings`, add these keys (next to the `places_*` keys):

```json
    "section_twilio": "SMS Messaging (Twilio)",
    "twilio_description": "Credentials from your Twilio console. Needed to send order confirmations and delivery updates by text.",
    "twilio_sid_label": "Account SID",
    "twilio_sid_placeholder": "AC...",
    "twilio_token_label": "Auth Token",
    "twilio_token_placeholder": "your Twilio auth token",
    "twilio_phone_label": "Twilio phone number",
    "twilio_phone_placeholder": "+15165551234",
    "twilio_phone_save": "Save number",
    "twilio_current": "Configured:",
    "twilio_not_set": "Not set",
    "twilio_save": "Save",
    "twilio_saving": "Saving...",
    "twilio_saved": "Saved",
    "twilio_error": "Could not save",
    "twilio_delete": "Remove",
    "twilio_sms_label": "SMS live",
    "twilio_sms_desc": "When on, real messages are sent to customers.",
    "twilio_dry_run_label": "Test mode (simulate)",
    "twilio_dry_run_desc": "When on, messages are logged but never actually sent.",
    "twilio_live_warning": "Real SMS will be sent to customers. Confirm your number is registered for A2P 10DLC.",
    "twilio_banner_live": "LIVE — real SMS are being sent",
    "twilio_banner_sim": "TEST MODE — no real SMS are sent",
    "twilio_banner_off": "SMS off — nothing is sent",
    "twilio_test_button": "Send test SMS",
    "twilio_test_sending": "Sending...",
    "twilio_test_sent": "Sent to 516 851 2815",
    "twilio_test_hint": "Sends a real message to Maky's mobile, regardless of test mode.",
    "twilio_test_err_no_credentials": "Twilio credentials are missing.",
    "twilio_test_err_sms_disabled": "Turn on \"SMS live\" first.",
    "twilio_test_err_generic": "Twilio error: {error}",
    "twilio_err_invalid_sid": "The SID must start with AC.",
    "twilio_err_invalid_phone": "Use +1XXXXXXXXXX format."
```

In `messages/es.json`, same keys under `admin_settings`:

```json
    "section_twilio": "Mensajería SMS (Twilio)",
    "twilio_description": "Credenciales de tu consola de Twilio. Necesarias para enviar confirmaciones de pedido y avisos de entrega por texto.",
    "twilio_sid_label": "Account SID",
    "twilio_sid_placeholder": "AC...",
    "twilio_token_label": "Auth Token",
    "twilio_token_placeholder": "tu auth token de Twilio",
    "twilio_phone_label": "Número de Twilio",
    "twilio_phone_placeholder": "+15165551234",
    "twilio_phone_save": "Guardar número",
    "twilio_current": "Configurado:",
    "twilio_not_set": "Sin configurar",
    "twilio_save": "Guardar",
    "twilio_saving": "Guardando...",
    "twilio_saved": "Guardado",
    "twilio_error": "Error al guardar",
    "twilio_delete": "Quitar",
    "twilio_sms_label": "SMS en vivo",
    "twilio_sms_desc": "Cuando está encendido, se envían mensajes reales a los clientes.",
    "twilio_dry_run_label": "Modo prueba (simulación)",
    "twilio_dry_run_desc": "Cuando está encendido, los mensajes se registran pero nunca se envían.",
    "twilio_live_warning": "Se enviarán SMS reales a los clientes. Confirma que tu número está registrado en A2P 10DLC.",
    "twilio_banner_live": "EN VIVO — se envían SMS reales",
    "twilio_banner_sim": "MODO PRUEBA — no se envían SMS reales",
    "twilio_banner_off": "SMS apagado — no se envía nada",
    "twilio_test_button": "Enviar SMS de prueba",
    "twilio_test_sending": "Enviando...",
    "twilio_test_sent": "Enviado a 516 851 2815",
    "twilio_test_hint": "Envía un mensaje real al móvil de Maky, sin importar el modo prueba.",
    "twilio_test_err_no_credentials": "Faltan las credenciales de Twilio.",
    "twilio_test_err_sms_disabled": "Enciende \"SMS en vivo\" primero.",
    "twilio_test_err_generic": "Error de Twilio: {error}",
    "twilio_err_invalid_sid": "El SID debe empezar con AC.",
    "twilio_err_invalid_phone": "Usa formato +1XXXXXXXXXX."
```

- [ ] **Step 2: Write the safety-net test**

Create `tests/unit/SettingsPage.test.tsx`. It stubs `fetch` so the mount GET resolves, then asserts the Google field still renders after the refactor:

```tsx
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import esMessages from "@/messages/es.json";
import SettingsPage from "@/components/admin/settings/SettingsPage";

function wrap(ui: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="es" messages={esMessages as Record<string, unknown>}>
      {ui}
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      new Response(
        JSON.stringify({
          google_places_api_key: "...ab12",
          twilio_account_sid: null,
          twilio_auth_token: null,
          twilio_phone_number: null,
          twilio_sms_enabled: "false",
          twilio_dry_run: "false",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    ),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SettingsPage", () => {
  it("still renders the Google Places field after the SecretField refactor", async () => {
    wrap(<SettingsPage />);
    expect(await screen.findByText("Google Places API Key")).toBeDefined();
    // the masked current value comes back from the mocked GET
    expect(await screen.findByText("...ab12")).toBeDefined();
  });
});
```

- [ ] **Step 3: Run it — expect failure**

```bash
npm test -- tests/unit/SettingsPage.test.tsx
```
Expected: FAIL — the masked value `...ab12` won't render yet if the component doesn't read `google_places_api_key` from the GET the same way (this pins the behaviour before refactor). If it passes as-is against the current component, that's fine too — proceed; the refactor must keep it green.

- [ ] **Step 4: Create `SecretField`**

Create `components/admin/settings/SecretField.tsx`:

```tsx
"use client";
import { useState } from "react";
import { CheckCircle, WarningCircle, Eye, EyeSlash } from "@phosphor-icons/react/dist/ssr";

export type SecretFieldLabels = {
  current: string;
  notSet: string;
  save: string;
  saving: string;
  saved: string;
  error: string;
  delete: string;
};

type Props = {
  label: string;
  description?: string;
  placeholder: string;
  /** undefined = loading, null = not set, string = masked current value */
  currentMasked: string | null | undefined;
  minLength?: number;
  labels: SecretFieldLabels;
  onSave: (value: string) => Promise<void>;
  onDelete: () => Promise<void>;
};

export default function SecretField({
  label,
  description,
  placeholder,
  currentMasked,
  minLength = 10,
  labels,
  onSave,
  onDelete,
}: Props) {
  const [input, setInput] = useState("");
  const [show, setShow] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function save() {
    setStatus("saving");
    try {
      await onSave(input.trim());
      setStatus("saved");
      setInput("");
      setTimeout(() => setStatus("idle"), 2500);
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3000);
    }
  }

  return (
    <div>
      <label className="font-medium text-sm text-ink block mb-1">{label}</label>
      {description && <p className="text-sm text-mute-600 mb-3">{description}</p>}

      <div
        className={`mb-3 flex items-center gap-2 text-sm px-3 py-2 rounded-xl ${
          currentMasked ? "bg-green-50 text-green-800" : "bg-mute-100 text-mute-500"
        }`}
      >
        {currentMasked === undefined ? (
          <span className="animate-pulse">…</span>
        ) : currentMasked ? (
          <>
            <CheckCircle size={16} weight="fill" className="text-green-600 shrink-0" />
            <span>
              {labels.current} <code className="font-mono">{currentMasked}</code>
            </span>
            <button
              type="button"
              onClick={onDelete}
              className="ml-auto text-mute-500 hover:text-rouge text-xs underline"
            >
              {labels.delete}
            </button>
          </>
        ) : (
          <>
            <WarningCircle size={16} weight="fill" className="text-mute-400 shrink-0" />
            <span>{labels.notSet}</span>
          </>
        )}
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type={show ? "text" : "password"}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={placeholder}
            autoComplete="off"
            className="w-full p-3.5 pr-10 rounded-xl bg-bone border border-mute-200 outline-none focus:border-ink focus:bg-white font-mono text-sm"
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-mute-400 hover:text-ink"
            aria-label={show ? "Ocultar" : "Mostrar"}
          >
            {show ? <EyeSlash size={16} /> : <Eye size={16} />}
          </button>
        </div>
        <button
          type="button"
          disabled={input.trim().length < minLength || status === "saving"}
          onClick={save}
          className="px-5 py-3 rounded-xl bg-rouge text-bone text-sm font-display disabled:opacity-40 transition"
        >
          {status === "saving"
            ? labels.saving
            : status === "saved"
            ? labels.saved
            : status === "error"
            ? labels.error
            : labels.save}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Refactor the Google block in `SettingsPage`**

In `components/admin/settings/SettingsPage.tsx`, replace the entire Google Places `<div>…</div>` (the block starting at the `{/* Google Places API Key */}` comment through its closing tag, currently lines ~92–157) with a `SecretField`. Keep the surrounding `<section>`, the `useEffect` fetch, and the `status`/`currentMasked` state. Add the import:

```tsx
import SecretField from "./SecretField";
```

Replace the block with:

```tsx
          {/* Google Places API Key */}
          <SecretField
            label={t("places_label")}
            description={t("places_description")}
            placeholder={t("places_placeholder")}
            currentMasked={currentMasked}
            labels={{
              current: t("places_current"),
              notSet: t("places_not_set"),
              save: t("places_save"),
              saving: t("places_saving"),
              saved: t("places_saved"),
              error: t("places_error"),
              delete: t("places_delete"),
            }}
            onSave={async (v) => {
              const res = await fetch("/api/admin/settings", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ key: "google_places_api_key", value: v }),
              });
              if (!res.ok) throw new Error("save_failed");
              const d = await fetch("/api/admin/settings").then((r) => r.json());
              setCurrentMasked(d.google_places_api_key ?? null);
            }}
            onDelete={async () => {
              await fetch("/api/admin/settings", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ key: "google_places_api_key", value: "" }),
              });
              setCurrentMasked(null);
            }}
          />
```

Now the component's own `save`/`removeKey`/`keyInput`/`showKey`/`status` state and the inline input markup are dead. Remove them: delete the `keyInput`, `showKey`, `status` `useState` lines and the `save()` / `removeKey()` functions. Keep `currentMasked` + its `useEffect` fetch (SecretField needs `currentMasked`, and `setCurrentMasked` is used in the callbacks above). The instructions `<details>` block below can stay as-is.

- [ ] **Step 6: Run the safety-net test — expect pass**

```bash
npm test -- tests/unit/SettingsPage.test.tsx
```
Expected: PASS — the Google field still renders and shows `...ab12`.

- [ ] **Step 7: Typecheck**

```bash
npx tsc --noEmit
```
Expected: clean. If it flags unused `Key`/`Eye`/etc. imports in `SettingsPage.tsx`, remove the now-unused ones (they moved into `SecretField`).

- [ ] **Step 8: Commit**

```bash
git add components/admin/settings/SecretField.tsx components/admin/settings/SettingsPage.tsx messages/en.json messages/es.json tests/unit/SettingsPage.test.tsx
git commit -m "refactor(settings): extract SecretField, add twilio i18n"
```

---

## Task 7: `TwilioSettings` UI + compose into the page

**Files:**
- Create: `components/admin/settings/TwilioSettings.tsx`
- Modify: `components/admin/settings/SettingsPage.tsx` (render `<TwilioSettings/>`)
- Test: `tests/unit/TwilioSettings.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/TwilioSettings.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import esMessages from "@/messages/es.json";
import TwilioSettings from "@/components/admin/settings/TwilioSettings";

function wrap(ui: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="es" messages={esMessages as Record<string, unknown>}>
      {ui}
    </NextIntlClientProvider>,
  );
}

function stubConfig(over: Record<string, unknown> = {}) {
  const cfg = {
    google_places_api_key: null,
    twilio_account_sid: null,
    twilio_auth_token: null,
    twilio_phone_number: null,
    twilio_sms_enabled: "false",
    twilio_dry_run: "false",
    ...over,
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init?: { method?: string }) => {
      if (init?.method === "PUT" || init?.method === "POST") {
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
      return new Response(JSON.stringify(cfg), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }),
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("TwilioSettings", () => {
  it("shows the SIMULACIÓN banner when dry-run is on and SMS is live", async () => {
    stubConfig({ twilio_sms_enabled: "true", twilio_dry_run: "true" });
    wrap(<TwilioSettings />);
    expect(await screen.findByText(/MODO PRUEBA/)).toBeDefined();
  });

  it("shows the EN VIVO banner when SMS is live and dry-run is off", async () => {
    stubConfig({ twilio_sms_enabled: "true", twilio_dry_run: "false" });
    wrap(<TwilioSettings />);
    expect(await screen.findByText(/EN VIVO/)).toBeDefined();
  });

  it("shows the off banner when SMS is disabled", async () => {
    stubConfig({ twilio_sms_enabled: "false" });
    wrap(<TwilioSettings />);
    expect(await screen.findByText(/SMS apagado/)).toBeDefined();
  });

  it("posts to the test endpoint when the test button is clicked", async () => {
    stubConfig({ twilio_sms_enabled: "true" });
    wrap(<TwilioSettings />);
    const btn = await screen.findByText("Enviar SMS de prueba");
    fireEvent.click(btn);
    // fetch was called with the test endpoint at least once
    const calls = (globalThis.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls;
    expect(calls.some((c) => String(c[0]).includes("/twilio-test"))).toBe(true);
  });
});
```

- [ ] **Step 2: Run it — expect failure**

```bash
npm test -- tests/unit/TwilioSettings.test.tsx
```
Expected: FAIL — `@/components/admin/settings/TwilioSettings` doesn't resolve.

- [ ] **Step 3: Write `TwilioSettings`**

Create `components/admin/settings/TwilioSettings.tsx`:

```tsx
"use client";
import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { WarningCircle, CheckCircle, PaperPlaneTilt } from "@phosphor-icons/react/dist/ssr";
import SecretField, { type SecretFieldLabels } from "./SecretField";

type Config = {
  twilio_account_sid: string | null;
  twilio_auth_token: string | null;
  twilio_phone_number: string | null;
  twilio_sms_enabled: string;
  twilio_dry_run: string;
};

const PHONE_RE = /^\+\d{11,15}$/;

export default function TwilioSettings() {
  const t = useTranslations("admin_settings");
  const [cfg, setCfg] = useState<Config | null>(null);
  const [phoneInput, setPhoneInput] = useState("");
  const [phoneErr, setPhoneErr] = useState(false);
  const [test, setTest] = useState<{ state: "idle" | "sending" | "ok" | "error"; msg?: string }>({
    state: "idle",
  });

  const reload = useCallback(async () => {
    const d = (await fetch("/api/admin/settings").then((r) => r.json())) as Config;
    setCfg(d);
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);

  const saveKey = useCallback(
    async (key: string, value: string) => {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value }),
      });
      if (!res.ok) throw new Error("save_failed");
      await reload();
    },
    [reload],
  );

  async function savePhone() {
    if (!PHONE_RE.test(phoneInput.trim())) {
      setPhoneErr(true);
      return;
    }
    setPhoneErr(false);
    await saveKey("twilio_phone_number", phoneInput.trim());
    setPhoneInput("");
  }

  async function sendTest() {
    setTest({ state: "sending" });
    try {
      const d = await fetch("/api/admin/settings/twilio-test", { method: "POST" }).then((r) =>
        r.json(),
      );
      if (d.ok) setTest({ state: "ok" });
      else setTest({ state: "error", msg: d.error });
    } catch {
      setTest({ state: "error", msg: "network" });
    }
  }

  if (!cfg) return null;

  const smsLive = cfg.twilio_sms_enabled === "true";
  const dryRun = cfg.twilio_dry_run === "true";

  const secretLabels: SecretFieldLabels = {
    current: t("twilio_current"),
    notSet: t("twilio_not_set"),
    save: t("twilio_save"),
    saving: t("twilio_saving"),
    saved: t("twilio_saved"),
    error: t("twilio_error"),
    delete: t("twilio_delete"),
  };

  const bannerClass = !smsLive
    ? "bg-mute-100 text-mute-600"
    : dryRun
    ? "bg-amber-50 text-amber-800"
    : "bg-green-50 text-green-800";
  const bannerText = !smsLive
    ? t("twilio_banner_off")
    : dryRun
    ? t("twilio_banner_sim")
    : t("twilio_banner_live");

  const testErrText =
    test.state === "error"
      ? test.msg === "no_credentials"
        ? t("twilio_test_err_no_credentials")
        : test.msg === "sms_disabled"
        ? t("twilio_test_err_sms_disabled")
        : t("twilio_test_err_generic", { error: test.msg ?? "" })
      : "";

  return (
    <section className="bg-white rounded-bento shadow-sm overflow-hidden mt-4">
      <div className="px-6 py-4 border-b border-mute-100">
        <h2 className="font-display text-base text-ink">{t("section_twilio")}</h2>
      </div>

      <div className="px-6 py-5 space-y-6">
        <p className="text-sm text-mute-600">{t("twilio_description")}</p>

        {/* Effective state banner — always visible */}
        <div className={`flex items-center gap-2 text-sm font-medium px-3 py-2 rounded-xl ${bannerClass}`}>
          {smsLive && !dryRun ? (
            <WarningCircle size={16} weight="fill" className="shrink-0" />
          ) : (
            <CheckCircle size={16} weight="fill" className="shrink-0" />
          )}
          <span>{bannerText}</span>
        </div>

        {/* Account SID */}
        <SecretField
          label={t("twilio_sid_label")}
          placeholder={t("twilio_sid_placeholder")}
          currentMasked={cfg.twilio_account_sid}
          labels={secretLabels}
          onSave={(v) => saveKey("twilio_account_sid", v)}
          onDelete={() => saveKey("twilio_account_sid", "")}
        />

        {/* Auth Token */}
        <SecretField
          label={t("twilio_token_label")}
          placeholder={t("twilio_token_placeholder")}
          currentMasked={cfg.twilio_auth_token}
          labels={secretLabels}
          onSave={(v) => saveKey("twilio_auth_token", v)}
          onDelete={() => saveKey("twilio_auth_token", "")}
        />

        {/* Phone number (not a secret — shown in full) */}
        <div>
          <label className="font-medium text-sm text-ink block mb-2">{t("twilio_phone_label")}</label>
          <div
            className={`mb-3 flex items-center gap-2 text-sm px-3 py-2 rounded-xl ${
              cfg.twilio_phone_number ? "bg-green-50 text-green-800" : "bg-mute-100 text-mute-500"
            }`}
          >
            {cfg.twilio_phone_number ? (
              <>
                <CheckCircle size={16} weight="fill" className="text-green-600 shrink-0" />
                <span>
                  {t("twilio_current")} <code className="font-mono">{cfg.twilio_phone_number}</code>
                </span>
              </>
            ) : (
              <>
                <WarningCircle size={16} weight="fill" className="text-mute-400 shrink-0" />
                <span>{t("twilio_not_set")}</span>
              </>
            )}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              placeholder={t("twilio_phone_placeholder")}
              className="flex-1 p-3.5 rounded-xl bg-bone border border-mute-200 outline-none focus:border-ink focus:bg-white font-mono text-sm"
            />
            <button
              type="button"
              disabled={phoneInput.trim().length < 11}
              onClick={savePhone}
              className="px-5 py-3 rounded-xl bg-rouge text-bone text-sm font-display disabled:opacity-40 transition"
            >
              {t("twilio_phone_save")}
            </button>
          </div>
          {phoneErr && <p className="mt-1 text-xs text-rouge">{t("twilio_err_invalid_phone")}</p>}
        </div>

        {/* SMS live toggle */}
        <div>
          <label className="flex items-center justify-between gap-3">
            <span>
              <span className="font-medium text-sm text-ink">{t("twilio_sms_label")}</span>
              <span className="block text-sm text-mute-600">{t("twilio_sms_desc")}</span>
            </span>
            <input
              type="checkbox"
              checked={smsLive}
              onChange={(e) => void saveKey("twilio_sms_enabled", e.target.checked ? "true" : "false")}
              className="h-5 w-5 shrink-0 accent-rouge"
            />
          </label>
          {smsLive && (
            <p className="mt-2 flex items-start gap-2 text-xs text-amber-800 bg-amber-50 rounded-lg px-3 py-2">
              <WarningCircle size={14} weight="fill" className="shrink-0 mt-0.5" />
              {t("twilio_live_warning")}
            </p>
          )}
        </div>

        {/* Dry-run toggle */}
        <label className="flex items-center justify-between gap-3">
          <span>
            <span className="font-medium text-sm text-ink">{t("twilio_dry_run_label")}</span>
            <span className="block text-sm text-mute-600">{t("twilio_dry_run_desc")}</span>
          </span>
          <input
            type="checkbox"
            checked={dryRun}
            onChange={(e) => void saveKey("twilio_dry_run", e.target.checked ? "true" : "false")}
            className="h-5 w-5 shrink-0 accent-rouge"
          />
        </label>

        {/* Test send */}
        <div className="border-t border-mute-100 pt-5">
          <button
            type="button"
            onClick={sendTest}
            disabled={test.state === "sending"}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-ink/20 text-sm font-display hover:bg-bone disabled:opacity-40 transition"
          >
            <PaperPlaneTilt size={16} weight="bold" />
            {test.state === "sending" ? t("twilio_test_sending") : t("twilio_test_button")}
          </button>
          <p className="mt-2 text-xs text-mute-500">{t("twilio_test_hint")}</p>
          {test.state === "ok" && (
            <p className="mt-2 text-sm text-green-700">{t("twilio_test_sent")}</p>
          )}
          {test.state === "error" && <p className="mt-2 text-sm text-rouge">{testErrText}</p>}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Render it in `SettingsPage`**

In `components/admin/settings/SettingsPage.tsx`, add the import:

```tsx
import TwilioSettings from "./TwilioSettings";
```

Add `<TwilioSettings />` immediately after the closing `</section>` of the integrations section (so it appears below the Google block), still inside the `<main>`:

```tsx
      </section>

      <TwilioSettings />
    </main>
```

- [ ] **Step 5: Run it — expect pass**

```bash
npm test -- tests/unit/TwilioSettings.test.tsx
```
Expected: PASS (4 tests).

- [ ] **Step 6: Typecheck**

```bash
npx tsc --noEmit
```
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add components/admin/settings/TwilioSettings.tsx components/admin/settings/SettingsPage.tsx tests/unit/TwilioSettings.test.tsx
git commit -m "feat(settings): twilio configuration UI with test send"
```

---

## Task 8: Full verification

- [ ] **Step 1: Typecheck the whole project**

```bash
npx tsc --noEmit
```
Expected: clean.

- [ ] **Step 2: Run all feature test files**

```bash
npm test -- tests/unit/twilio-config.test.ts tests/unit/twilio-server.test.ts tests/unit/messaging.test.ts tests/unit/api-admin-settings.test.ts tests/unit/api-admin-settings-twilio-test.test.ts tests/unit/SettingsPage.test.tsx tests/unit/TwilioSettings.test.tsx
```
Expected: all pass.

- [ ] **Step 3: No new failures vs baseline**

```bash
npm test 2>&1 | tail -40
```
List failing files. Confirm every one is a known baseline failure (print-chromium / print-render / _preview / checkout-schema) and none is a file this feature touched. Any feature-file failure is a real regression — flag it.

- [ ] **Step 4: Build**

```bash
npm run build
```
Expected: succeeds. Confirms the new routes and client components compile.

- [ ] **Step 5: Browser smoke test (owner-facing verification)**

Start the dev server and open `/es/admin/settings`. Confirm: the new "Mensajería SMS (Twilio)" section renders below Google; the banner reflects the current flags; entering a bad SID shows a validation error on save; the toggles persist across a reload. This needs an admin session (`INTAKE_PASSWORD`). Do NOT click "Enviar SMS de prueba" against live Twilio unless you intend a real send.

- [ ] **Step 6: Confirm clean tree**

```bash
git status
```
Expected: clean apart from pre-existing untracked `Sympathy fotos/` and `print-ready/`.

---

## Deployment notes (owner-run)

1. Once merged and deployed, the owner can paste their Twilio credentials at `/admin/settings`, set the number, toggle SMS live, and click "Enviar SMS de prueba" to confirm. A 10DLC or credential problem shows up as a concrete Twilio error on that button.
2. Env vars remain the fallback — existing production behaviour is unchanged until a value is set in the dashboard.
3. Purge the Hostinger CDN after deploy (per the project's deploy notes), though `/admin/*` is not cached.

## Out of scope / notes

- WhatsApp config stays on env (`TWILIO_WHATSAPP_FROM`, `TWILIO_WHATSAPP_ENABLED`).
- Secrets are stored in plaintext in the `settings` table, matching the existing Google-key precedent; the GET only ever returns masked last-4.
- The test-send target is hardcoded to `SITE.mobile.e164`.
