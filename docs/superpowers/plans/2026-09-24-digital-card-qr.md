# Digital Card QR Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Staff can attach a digital greeting card to any order from the admin drawer; the printed card cover carries a per-order QR (`/c/<code>`) that redirects to the card, or shows a "being prepared" page until its URL is set.

**Architecture:** A `digital_cards` SQLite table maps each order to a random 8-char code and an optional target URL. Admin routes activate the card and set the URL; a public route `/c/[code]` (outside next-intl) redirects or renders a small HTML page. The print sheet swaps the static website QR for a generated one when the order has a digital card.

**Tech Stack:** Next 16.2 (App Router, route handlers), `node:sqlite` via `lib/db.ts`, hand-written SQL migrations, Zod 4, next-intl, Vitest (+ Testing Library), Playwright, new dependency `qrcode`.

**Spec:** `docs/superpowers/specs/2026-09-24-digital-card-qr-design.md`

## Global Constraints

- Branch: `feat/digital-card-qr` (repo `/Users/santiagocardonacastellanos/Desktop/Makythedivaflowers`). Task 9 is in the other repo, see there.
- Tests run with `npm test -- <path>` (the script sets `NODE_OPTIONS=--experimental-sqlite`). Unit tests live in `tests/unit/`, e2e in `tests/e2e/`.
- DB tests: `vi.stubEnv("SQLITE_FILE", ":memory:")` + `runMigrations()` in `beforeEach`; `closeDb()` + `vi.unstubAllEnvs()` in `afterEach`.
- Admin auth in route tests: header `cookie: intake_session=${signSession()}` with `INTAKE_SESSION_SECRET` stubbed.
- Code: 8 chars, base62 (`0-9A-Za-z`), from `crypto.randomBytes`; collision retry max 5 attempts.
- Allowed card hosts: env `DIGITAL_CARD_HOSTS` (comma-separated), default `tarjetas.makythedivaflowers.com`; protocol must be `https:`.
- Short URL base: `process.env.NEXT_PUBLIC_SITE_URL`, falling back to `https://makythedivaflowers.com`; path `/c/<code>`.
- QR: error correction `Q`, margin `2`; PNG download 1024 px.
- Cover copy: es `Escanea para abrir tu sorpresa`, en `Scan to open your surprise`.
- History entries: actor `"maky"`, kind `"digital_card"`, summaries `Tarjeta digital activada` / `URL de tarjeta digital actualizada`.
- `/c/*` responses: `Cache-Control: no-store`; HTML pages carry `<meta name="robots" content="noindex">`.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## File Structure

| File | Responsibility |
|---|---|
| `schemas/digital-card.ts` (new) | Allowed-host list, `isAllowedCardUrl`, PATCH body schema |
| `lib/digital-card-code.ts` (new) | Code generation, `CODE_PATTERN`, `shortUrl` (pure, no DB) |
| `types/digital-card.ts` (new) | `DigitalCardView` type shared by server and client |
| `db/migrations/029_digital_cards.sql` (new) | Table |
| `lib/digital-cards.ts` (new) | Storage: `enableForOrder`, `setTargetUrl`, `getByOrder`, `getByCode`, `digitalCardView` |
| `lib/digital-card-qr.ts` (new) | `qrSvgDataUri`, `qrPng` wrappers over `qrcode` |
| `lib/digital-card-pages.ts` (new) | HTML for "being prepared" and 404 pages |
| `app/api/admin/orders/[id]/digital-card/route.ts` (new) | POST activate, PATCH url |
| `app/api/admin/orders/[id]/digital-card/qr/route.ts` (new) | PNG download |
| `app/c/[code]/route.ts` (new) | Public redirect / pages |
| `lib/print-sheet.ts` (new) | `buildOrderSheetHtml(order)` = DB lookup + `buildSheetHtml` |
| `components/admin/dashboard/DigitalCardSection.tsx` (new) | Drawer block |
| `types/order.ts` (modify) | Add `"digital_card"` to `OrderChangeKind` |
| `app/api/admin/orders/[id]/route.ts` (modify) | GET includes `digitalCard` |
| `proxy.ts` (modify) | Exclude `c/` from matcher |
| `lib/print-render-html.tsx`, `lib/print-styles.ts` (modify) | Optional digital QR + caption |
| `app/api/admin/orders/[id]/sheet/route.ts`, `app/api/print/queue/route.ts` (modify) | Use `buildOrderSheetHtml` |
| `components/admin/dashboard/OrderDetailDrawer.tsx` (modify) | Render `DigitalCardSection` |
| `messages/es.json`, `messages/en.json` (modify) | `admin_orders.digital_card_*` keys |

`lib/print-render.tsx` (`renderOrderPdf`) is left unchanged: it has no production callers (only `tests/unit/print-render.test.ts`, which runs without a test DB).

---

### Task 1: URL validation and code helpers (pure)

**Files:**
- Create: `schemas/digital-card.ts`, `lib/digital-card-code.ts`, `types/digital-card.ts`
- Test: `tests/unit/digital-card-helpers.test.ts`

**Interfaces:**
- Produces:
  - `allowedDigitalCardHosts(): string[]`
  - `isAllowedCardUrl(value: string): boolean`
  - `digitalCardPatchSchema` — Zod object `{ targetUrl: string | null }`
  - `CODE_LENGTH = 8`, `CODE_PATTERN: RegExp`, `generateCardCode(random?: (n: number) => Buffer): string`
  - `shortUrl(code: string): string`
  - `type DigitalCardView = { code: string; shortUrl: string; targetUrl: string | null }`

- [ ] **Step 1: Write the failing test**

`tests/unit/digital-card-helpers.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect, afterEach, vi } from "vitest";
import { isAllowedCardUrl, allowedDigitalCardHosts, digitalCardPatchSchema } from "@/schemas/digital-card";
import { generateCardCode, CODE_PATTERN, shortUrl } from "@/lib/digital-card-code";

afterEach(() => vi.unstubAllEnvs());

describe("isAllowedCardUrl", () => {
  it("accepts https on the default host", () => {
    expect(isAllowedCardUrl("https://tarjetas.makythedivaflowers.com/i/raymond-50-k3x9")).toBe(true);
  });
  it("rejects http, other hosts and garbage", () => {
    expect(isAllowedCardUrl("http://tarjetas.makythedivaflowers.com/i/x")).toBe(false);
    expect(isAllowedCardUrl("https://evil.example.com/i/x")).toBe(false);
    expect(isAllowedCardUrl("https://tarjetas.makythedivaflowers.com.evil.com/i/x")).toBe(false);
    expect(isAllowedCardUrl("not a url")).toBe(false);
    expect(isAllowedCardUrl("")).toBe(false);
  });
  it("uses DIGITAL_CARD_HOSTS when set", () => {
    vi.stubEnv("DIGITAL_CARD_HOSTS", " cards.example.com , other.example.com ");
    expect(allowedDigitalCardHosts()).toEqual(["cards.example.com", "other.example.com"]);
    expect(isAllowedCardUrl("https://cards.example.com/i/a")).toBe(true);
    expect(isAllowedCardUrl("https://tarjetas.makythedivaflowers.com/i/a")).toBe(false);
  });
});

describe("digitalCardPatchSchema", () => {
  it("accepts an allowed url (trimmed) and null", () => {
    expect(digitalCardPatchSchema.parse({ targetUrl: "  https://tarjetas.makythedivaflowers.com/i/a  " }))
      .toEqual({ targetUrl: "https://tarjetas.makythedivaflowers.com/i/a" });
    expect(digitalCardPatchSchema.parse({ targetUrl: null })).toEqual({ targetUrl: null });
  });
  it("rejects a disallowed url", () => {
    expect(digitalCardPatchSchema.safeParse({ targetUrl: "https://evil.example.com" }).success).toBe(false);
  });
});

describe("generateCardCode", () => {
  it("returns 8 base62 chars", () => {
    for (let i = 0; i < 50; i++) expect(generateCardCode()).toMatch(CODE_PATTERN);
  });
  it("skips bytes >= 248 to avoid modulo bias", () => {
    const bytes = Buffer.from([255, 250, 248, 0, 1, 2, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70]);
    expect(generateCardCode(() => bytes)).toBe("012z0123");
  });
});

describe("shortUrl", () => {
  it("uses NEXT_PUBLIC_SITE_URL without a trailing slash", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://staging.example.com/");
    expect(shortUrl("Ab3dE5fG")).toBe("https://staging.example.com/c/Ab3dE5fG");
  });
  it("defaults to the shop domain", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    expect(shortUrl("Ab3dE5fG")).toBe("https://makythedivaflowers.com/c/Ab3dE5fG");
  });
});
```

Expected string for the bias test: 255, 250, 248 are skipped; 0,1,2 → `0`,`1`,`2`; 61 → `z`; 62 → `0`; 63 → `1`; 64 → `2`; 65 → `3` → `"012z0123"`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/digital-card-helpers.test.ts`
Expected: FAIL — cannot resolve `@/schemas/digital-card`.

- [ ] **Step 3: Implement**

`types/digital-card.ts`:

```ts
// What the admin UI and API see of an order's digital card.
export type DigitalCardView = {
  code: string;
  shortUrl: string;
  targetUrl: string | null;
};
```

`schemas/digital-card.ts`:

```ts
import { z } from "zod";

// Hosts the /c/<code> redirect may point to. Keeps the short link from being
// an open redirect: a pasted URL on any other host is rejected.
export const DEFAULT_DIGITAL_CARD_HOSTS = ["tarjetas.makythedivaflowers.com"];

export function allowedDigitalCardHosts(): string[] {
  const hosts = (process.env.DIGITAL_CARD_HOSTS ?? "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
  return hosts.length > 0 ? hosts : DEFAULT_DIGITAL_CARD_HOSTS;
}

export function isAllowedCardUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return url.protocol === "https:" && allowedDigitalCardHosts().includes(url.hostname.toLowerCase());
}

export const digitalCardPatchSchema = z.object({
  targetUrl: z.string().trim().refine(isAllowedCardUrl, "invalid_card_url").nullable(),
});
```

`lib/digital-card-code.ts`:

```ts
import crypto from "node:crypto";

const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
export const CODE_LENGTH = 8;
export const CODE_PATTERN = /^[0-9A-Za-z]{8}$/;

// 62^8 ≈ 2·10^14 codes. Bytes >= 248 (= 62 * 4) are skipped so every
// character is equally likely.
export function generateCardCode(random: (n: number) => Buffer = crypto.randomBytes): string {
  let out = "";
  while (out.length < CODE_LENGTH) {
    for (const b of random(16)) {
      if (b >= 248) continue;
      out += ALPHABET[b % 62];
      if (out.length === CODE_LENGTH) break;
    }
  }
  return out;
}

export function shortUrl(code: string): string {
  // `||` (not `??`) so an empty env var still falls back to the shop domain.
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "https://makythedivaflowers.com").replace(/\/+$/, "");
  return `${base}/c/${code}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/digital-card-helpers.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add schemas/digital-card.ts lib/digital-card-code.ts types/digital-card.ts tests/unit/digital-card-helpers.test.ts
git commit -m "feat(digital-card): URL allow-list, short codes and short URLs

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Migration and storage

**Files:**
- Create: `db/migrations/029_digital_cards.sql`, `lib/digital-cards.ts`
- Test: `tests/unit/digital-cards.test.ts`

**Interfaces:**
- Consumes: `generateCardCode`, `shortUrl`, `DigitalCardView` (Task 1).
- Produces:
  - `type DigitalCard = { orderId: string; code: string; targetUrl: string | null; shortUrl: string; createdAt: string; updatedAt: string }`
  - `enableForOrder(orderId: string, gen?: () => string): DigitalCard | null` — `null` when the order does not exist; returns the existing card if already enabled; throws after 5 code collisions.
  - `setTargetUrl(orderId: string, url: string | null): DigitalCard | null` — `null` when not enabled. Does NOT validate (callers validate with `digitalCardPatchSchema`).
  - `getByOrder(orderId: string): DigitalCard | null`
  - `getByCode(code: string): DigitalCard | null`
  - `digitalCardView(card: DigitalCard): DigitalCardView`

- [ ] **Step 1: Write the failing test**

`tests/unit/digital-cards.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import {
  enableForOrder, setTargetUrl, getByOrder, getByCode, digitalCardView,
} from "@/lib/digital-cards";

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://makythedivaflowers.com");
  runMigrations();
});
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

function seed(id: string) {
  getDb().prepare(
    `INSERT INTO orders (id, locale, source, recipient_name, recipient_phone, contact_phone,
       fulfillment_method, window_date, window_slot, lines_json, subtotal_cents, delivery_cents,
       tax_cents, total_cents, fulfillment_status, payment_status, created_at, updated_at)
     VALUES (?, 'es', 'walk-in', 'Ana', '555', '555', 'in-store', NULL, NULL, '[]', 0,0,0,0,
       'pending', 'pending', '2026-06-01T08:00:00Z', '2026-06-01T08:00:00Z')`,
  ).run(id);
}

describe("enableForOrder", () => {
  it("creates a card with a code and no url", () => {
    seed("o1");
    const card = enableForOrder("o1", () => "Ab3dE5fG")!;
    expect(card).toMatchObject({
      orderId: "o1", code: "Ab3dE5fG", targetUrl: null,
      shortUrl: "https://makythedivaflowers.com/c/Ab3dE5fG",
    });
    expect(getByCode("Ab3dE5fG")?.orderId).toBe("o1");
  });

  it("is idempotent", () => {
    seed("o1");
    const first = enableForOrder("o1", () => "Ab3dE5fG")!;
    const second = enableForOrder("o1", () => "Zz9yX8wV")!;
    expect(second.code).toBe(first.code);
  });

  it("returns null for a missing order", () => {
    expect(enableForOrder("nope")).toBeNull();
  });

  it("retries on a code collision", () => {
    seed("o1"); seed("o2");
    enableForOrder("o1", () => "AAAAAAAA");
    const codes = ["AAAAAAAA", "BBBBBBBB"];
    const card = enableForOrder("o2", () => codes.shift()!)!;
    expect(card.code).toBe("BBBBBBBB");
  });

  it("gives up after 5 collisions", () => {
    seed("o1"); seed("o2");
    enableForOrder("o1", () => "AAAAAAAA");
    expect(() => enableForOrder("o2", () => "AAAAAAAA")).toThrow(/digital card code/);
  });
});

describe("setTargetUrl", () => {
  it("stores and clears the url", () => {
    seed("o1");
    enableForOrder("o1", () => "Ab3dE5fG");
    const url = "https://tarjetas.makythedivaflowers.com/i/raymond-50-k3x9";
    expect(setTargetUrl("o1", url)?.targetUrl).toBe(url);
    expect(getByOrder("o1")?.targetUrl).toBe(url);
    expect(setTargetUrl("o1", null)?.targetUrl).toBeNull();
  });

  it("returns null when the card was never enabled", () => {
    seed("o1");
    expect(setTargetUrl("o1", "https://tarjetas.makythedivaflowers.com/i/a")).toBeNull();
  });
});

it("digitalCardView keeps only what the UI needs", () => {
  seed("o1");
  const card = enableForOrder("o1", () => "Ab3dE5fG")!;
  expect(digitalCardView(card)).toEqual({
    code: "Ab3dE5fG", shortUrl: "https://makythedivaflowers.com/c/Ab3dE5fG", targetUrl: null,
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/digital-cards.test.ts`
Expected: FAIL — cannot resolve `@/lib/digital-cards`.

- [ ] **Step 3: Implement**

`db/migrations/029_digital_cards.sql`:

```sql
-- 029_digital_cards.sql — a digital greeting card attached to an order.
--
-- The printed card cover carries a QR to /c/<code>, which redirects to
-- target_url (a card on tarjetas.makythedivaflowers.com) or shows a
-- "being prepared" page while target_url is NULL. One card per order.
CREATE TABLE digital_cards (
  order_id   TEXT PRIMARY KEY REFERENCES orders(id),
  code       TEXT NOT NULL UNIQUE,
  target_url TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

`lib/digital-cards.ts`:

```ts
import "server-only";
import { getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { generateCardCode, shortUrl } from "@/lib/digital-card-code";
import type { DigitalCardView } from "@/types/digital-card";

export type DigitalCard = {
  orderId: string;
  code: string;
  targetUrl: string | null;
  shortUrl: string;
  createdAt: string;
  updatedAt: string;
};

type Row = {
  order_id: string; code: string; target_url: string | null;
  created_at: string; updated_at: string;
};

const MAX_CODE_ATTEMPTS = 5;

function toCard(r: Row): DigitalCard {
  return {
    orderId: r.order_id,
    code: r.code,
    targetUrl: r.target_url,
    shortUrl: shortUrl(r.code),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function getByOrder(orderId: string): DigitalCard | null {
  runMigrations();
  const row = getDb().prepare("SELECT * FROM digital_cards WHERE order_id = ?").get(orderId) as Row | undefined;
  return row ? toCard(row) : null;
}

export function getByCode(code: string): DigitalCard | null {
  runMigrations();
  const row = getDb().prepare("SELECT * FROM digital_cards WHERE code = ?").get(code) as Row | undefined;
  return row ? toCard(row) : null;
}

// Idempotent: an order keeps its first code forever, so a printed QR never
// goes stale. Returns null when the order does not exist.
export function enableForOrder(orderId: string, gen: () => string = generateCardCode): DigitalCard | null {
  const existing = getByOrder(orderId);
  if (existing) return existing;
  const db = getDb();
  if (!db.prepare("SELECT 1 FROM orders WHERE id = ?").get(orderId)) return null;
  const insert = db.prepare(
    "INSERT INTO digital_cards (order_id, code, target_url, created_at, updated_at) VALUES (?, ?, NULL, ?, ?)",
  );
  const taken = db.prepare("SELECT 1 FROM digital_cards WHERE code = ?");
  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
    const code = gen();
    if (taken.get(code)) continue;
    const now = new Date().toISOString();
    insert.run(orderId, code, now, now);
    return getByOrder(orderId);
  }
  throw new Error(`could not allocate a unique digital card code for order ${orderId}`);
}

export function setTargetUrl(orderId: string, url: string | null): DigitalCard | null {
  runMigrations();
  const res = getDb()
    .prepare("UPDATE digital_cards SET target_url = ?, updated_at = ? WHERE order_id = ?")
    .run(url, new Date().toISOString(), orderId);
  return res.changes === 0 ? null : getByOrder(orderId);
}

export function digitalCardView(card: DigitalCard): DigitalCardView {
  return { code: card.code, shortUrl: card.shortUrl, targetUrl: card.targetUrl };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/digital-cards.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add db/migrations/029_digital_cards.sql lib/digital-cards.ts tests/unit/digital-cards.test.ts
git commit -m "feat(digital-card): digital_cards table and storage

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Admin API — activate, set URL, expose in order detail

**Files:**
- Create: `app/api/admin/orders/[id]/digital-card/route.ts`
- Modify: `types/order.ts:133-134` (`OrderChangeKind`), `app/api/admin/orders/[id]/route.ts` (GET)
- Test: `tests/unit/api-admin-order-digital-card.test.ts`, `tests/unit/api-admin-orders-detail.test.ts` (add one test)

**Interfaces:**
- Consumes: `enableForOrder`, `getByOrder`, `setTargetUrl`, `digitalCardView` (Task 2); `digitalCardPatchSchema` (Task 1); `recordOrderChange` (`lib/order-history.ts`).
- Produces:
  - `POST /api/admin/orders/[id]/digital-card` → 200 `DigitalCardView` | 401 | 404 `{ error: "not_found" }`
  - `PATCH /api/admin/orders/[id]/digital-card` body `{ targetUrl: string | null }` → 200 `DigitalCardView` | 400 `{ error: "invalid_card_url" }` | 401 | 404 `{ error: "not_enabled" }`
  - `GET /api/admin/orders/[id]` response gains `digitalCard: DigitalCardView | null`

- [ ] **Step 1: Write the failing tests**

`tests/unit/api-admin-order-digital-card.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { signSession } from "@/lib/admin-auth";
import { POST, PATCH } from "@/app/api/admin/orders/[id]/digital-card/route";
import { listOrderHistory } from "@/lib/order-history";

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("INTAKE_SESSION_SECRET", "test-secret-test-secret-test-secret");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://makythedivaflowers.com");
  runMigrations();
});
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

function seed(id: string) {
  getDb().prepare(
    `INSERT INTO orders (id, locale, source, recipient_name, recipient_phone, contact_phone,
       fulfillment_method, window_date, window_slot, lines_json, subtotal_cents, delivery_cents,
       tax_cents, total_cents, fulfillment_status, payment_status, created_at, updated_at)
     VALUES (?, 'es', 'walk-in', 'Ana', '555', '555', 'in-store', NULL, NULL, '[]', 0,0,0,0,
       'pending', 'pending', '2026-06-01T08:00:00Z', '2026-06-01T08:00:00Z')`,
  ).run(id);
}
const params = (id: string) => ({ params: Promise.resolve({ id }) });
function req(method: string, body?: unknown, auth = true) {
  return new Request("http://x", {
    method,
    headers: {
      ...(auth ? { cookie: `intake_session=${signSession()}` } : {}),
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}
const GOOD = "https://tarjetas.makythedivaflowers.com/i/raymond-50-k3x9";

describe("POST /api/admin/orders/[id]/digital-card", () => {
  it("activates once and logs it once", async () => {
    seed("o1");
    const a = await (await POST(req("POST"), params("o1"))).json();
    expect(a.code).toMatch(/^[0-9A-Za-z]{8}$/);
    expect(a.shortUrl).toBe(`https://makythedivaflowers.com/c/${a.code}`);
    expect(a.targetUrl).toBeNull();
    const b = await (await POST(req("POST"), params("o1"))).json();
    expect(b.code).toBe(a.code);
    const history = await listOrderHistory("o1");
    const entries = history.filter((c) => c.kind === "digital_card");
    expect(entries).toHaveLength(1);
    expect(entries[0].summary).toBe("Tarjeta digital activada");
  });
  it("401 without session", async () => {
    seed("o1");
    expect((await POST(req("POST", undefined, false), params("o1"))).status).toBe(401);
  });
  it("404 for an unknown order", async () => {
    expect((await POST(req("POST"), params("nope"))).status).toBe(404);
  });
});

describe("PATCH /api/admin/orders/[id]/digital-card", () => {
  it("stores an allowed url and logs it", async () => {
    seed("o1");
    await POST(req("POST"), params("o1"));
    const res = await PATCH(req("PATCH", { targetUrl: GOOD }), params("o1"));
    expect(res.status).toBe(200);
    expect((await res.json()).targetUrl).toBe(GOOD);
    const history = await listOrderHistory("o1");
    expect(history.some((c) => c.summary === "URL de tarjeta digital actualizada")).toBe(true);
  });
  it("clears the url with null", async () => {
    seed("o1");
    await POST(req("POST"), params("o1"));
    await PATCH(req("PATCH", { targetUrl: GOOD }), params("o1"));
    expect((await (await PATCH(req("PATCH", { targetUrl: null }), params("o1"))).json()).targetUrl).toBeNull();
  });
  it("400 for a disallowed url or bad body", async () => {
    seed("o1");
    await POST(req("POST"), params("o1"));
    const bad = await PATCH(req("PATCH", { targetUrl: "https://evil.example.com/x" }), params("o1"));
    expect(bad.status).toBe(400);
    expect((await bad.json()).error).toBe("invalid_card_url");
    expect((await PATCH(req("PATCH", { nope: 1 }), params("o1"))).status).toBe(400);
  });
  it("404 when not enabled", async () => {
    seed("o1");
    expect((await PATCH(req("PATCH", { targetUrl: GOOD }), params("o1"))).status).toBe(404);
  });
  it("401 without session", async () => {
    seed("o1");
    expect((await PATCH(req("PATCH", { targetUrl: GOOD }, false), params("o1"))).status).toBe(401);
  });
});
```

In `tests/unit/api-admin-orders-detail.test.ts`, add the import at the top and one test at the end (the file already has `seed`, `GET` and `getDb` in scope; each test gets a fresh in-memory DB, so `seed` can be reused):

```ts
import { enableForOrder } from "@/lib/digital-cards";
```

```ts
it("includes digitalCard (null, then the view once enabled)", async () => {
  seed("d2");
  let body = await (await GET(new Request("http://x"), { params: Promise.resolve({ id: "d2" }) })).json();
  expect(body.digitalCard).toBeNull();
  enableForOrder("d2", () => "Ab3dE5fG");
  body = await (await GET(new Request("http://x"), { params: Promise.resolve({ id: "d2" }) })).json();
  expect(body.digitalCard).toMatchObject({ code: "Ab3dE5fG", targetUrl: null });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/unit/api-admin-order-digital-card.test.ts tests/unit/api-admin-orders-detail.test.ts`
Expected: FAIL — route module missing; `digitalCard` undefined.

- [ ] **Step 3: Implement**

`types/order.ts` — replace the `OrderChangeKind` union:

```ts
export type OrderChangeKind =
  | "created" | "edit" | "payment" | "fulfillment" | "cancel" | "note" | "reprint" | "digital_card";
```

`app/api/admin/orders/[id]/digital-card/route.ts`:

```ts
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { digitalCardView, enableForOrder, getByOrder, setTargetUrl } from "@/lib/digital-cards";
import { recordOrderChange } from "@/lib/order-history";
import { digitalCardPatchSchema } from "@/schemas/digital-card";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx): Promise<Response> {
  if (!requireAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const existing = getByOrder(id);
  const card = existing ?? enableForOrder(id);
  if (!card) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!existing) {
    await recordOrderChange({ orderId: id, actor: "maky", kind: "digital_card", summary: "Tarjeta digital activada" });
  }
  return NextResponse.json(digitalCardView(card));
}

export async function PATCH(req: Request, ctx: Ctx): Promise<Response> {
  if (!requireAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_card_url" }, { status: 400 });
  }
  const parsed = digitalCardPatchSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "invalid_card_url" }, { status: 400 });
  const card = setTargetUrl(id, parsed.data.targetUrl);
  if (!card) return NextResponse.json({ error: "not_enabled" }, { status: 404 });
  await recordOrderChange({
    orderId: id, actor: "maky", kind: "digital_card", summary: "URL de tarjeta digital actualizada",
  });
  return NextResponse.json(digitalCardView(card));
}
```

`app/api/admin/orders/[id]/route.ts` — add the import and extend the GET response:

```ts
import { digitalCardView, getByOrder as getDigitalCard } from "@/lib/digital-cards";
```

```ts
  const history = await listOrderHistory(id);
  const card = getDigitalCard(id);
  return NextResponse.json({
    order, customer, messages, history,
    balanceCents: orderBalanceCents(order),
    digitalCard: card ? digitalCardView(card) : null,
  });
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test -- tests/unit/api-admin-order-digital-card.test.ts tests/unit/api-admin-orders-detail.test.ts`
Expected: PASS.

Run: `npx tsc --noEmit`
Expected: no errors. If a `Record<OrderChangeKind, …>` exists somewhere, add a `digital_card` entry there with label `"Tarjeta digital"`.

- [ ] **Step 5: Commit**

```bash
git add types/order.ts "app/api/admin/orders/[id]/digital-card/route.ts" "app/api/admin/orders/[id]/route.ts" tests/unit/api-admin-order-digital-card.test.ts tests/unit/api-admin-orders-detail.test.ts
git commit -m "feat(digital-card): admin routes to activate and set the card URL

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: QR generation and PNG download

**Files:**
- Modify: `package.json`, `package-lock.json` (add `qrcode`, `@types/qrcode`)
- Create: `lib/digital-card-qr.ts`, `app/api/admin/orders/[id]/digital-card/qr/route.ts`
- Test: `tests/unit/digital-card-qr.test.ts`

**Interfaces:**
- Consumes: `getByOrder` (Task 2).
- Produces:
  - `qrSvgDataUri(text: string): Promise<string>` — `data:image/svg+xml;base64,…`
  - `qrPng(text: string): Promise<Buffer>` — 1024 px PNG
  - `GET /api/admin/orders/[id]/digital-card/qr` → 200 `image/png` attachment | 401 | 404

- [ ] **Step 1: Install the dependency**

```bash
npm install qrcode@^1.5.4
npm install -D @types/qrcode@^1.5.5
```

The repo also has a `pnpm-lock.yaml`. Run `git log -3 --format='%h %ad %s' --date=short -- pnpm-lock.yaml package-lock.json`: if recent dependency commits touched `pnpm-lock.yaml` too, also run `pnpm install` and include it in the commit; otherwise leave it.

- [ ] **Step 2: Write the failing test**

`tests/unit/digital-card-qr.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { signSession } from "@/lib/admin-auth";
import { enableForOrder } from "@/lib/digital-cards";
import { qrPng, qrSvgDataUri } from "@/lib/digital-card-qr";
import { GET } from "@/app/api/admin/orders/[id]/digital-card/qr/route";

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

describe("qr helpers", () => {
  it("qrSvgDataUri returns a deterministic svg data uri", async () => {
    const a = await qrSvgDataUri("https://makythedivaflowers.com/c/Ab3dE5fG");
    expect(a.startsWith("data:image/svg+xml;base64,")).toBe(true);
    const svg = Buffer.from(a.split(",")[1], "base64").toString("utf8");
    expect(svg).toContain("<svg");
    expect(await qrSvgDataUri("https://makythedivaflowers.com/c/Ab3dE5fG")).toBe(a);
    expect(await qrSvgDataUri("https://makythedivaflowers.com/c/Zz9yX8wV")).not.toBe(a);
  });
  it("qrPng returns a 1024px png", async () => {
    const png = await qrPng("https://makythedivaflowers.com/c/Ab3dE5fG");
    expect([...png.subarray(0, 8)]).toEqual(PNG_SIGNATURE);
    expect(png.readUInt32BE(16)).toBe(1024); // IHDR width
  });
});

describe("GET /api/admin/orders/[id]/digital-card/qr", () => {
  beforeEach(() => {
    vi.stubEnv("SQLITE_FILE", ":memory:");
    vi.stubEnv("INTAKE_SESSION_SECRET", "test-secret-test-secret-test-secret");
    runMigrations();
    getDb().prepare(
      `INSERT INTO orders (id, locale, source, recipient_name, recipient_phone, contact_phone,
         fulfillment_method, window_date, window_slot, lines_json, subtotal_cents, delivery_cents,
         tax_cents, total_cents, fulfillment_status, payment_status, created_at, updated_at)
       VALUES ('o1', 'es', 'walk-in', 'Ana', '555', '555', 'in-store', NULL, NULL, '[]', 0,0,0,0,
         'pending', 'pending', '2026-06-01T08:00:00Z', '2026-06-01T08:00:00Z')`,
    ).run();
  });
  afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

  const params = { params: Promise.resolve({ id: "o1" }) };
  const authed = () => new Request("http://x", { headers: { cookie: `intake_session=${signSession()}` } });

  it("downloads a png once enabled", async () => {
    enableForOrder("o1", () => "Ab3dE5fG");
    const res = await GET(authed(), params);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("content-disposition")).toBe('attachment; filename="tarjeta-o1.png"');
    const buf = Buffer.from(await res.arrayBuffer());
    expect([...buf.subarray(0, 8)]).toEqual(PNG_SIGNATURE);
  });
  it("404 when not enabled", async () => {
    expect((await GET(authed(), params)).status).toBe(404);
  });
  it("401 without session", async () => {
    expect((await GET(new Request("http://x"), params)).status).toBe(401);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- tests/unit/digital-card-qr.test.ts`
Expected: FAIL — cannot resolve `@/lib/digital-card-qr`.

- [ ] **Step 4: Implement**

`lib/digital-card-qr.ts`:

```ts
import "server-only";
import QRCode from "qrcode";

// Q (25% recovery) survives the fold, ink bleed and the rose photo behind the
// white chip better than the library default (M).
const OPTS = { errorCorrectionLevel: "Q" as const, margin: 2 };

export async function qrSvgDataUri(text: string): Promise<string> {
  const svg = await QRCode.toString(text, { ...OPTS, type: "svg" });
  return `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
}

export async function qrPng(text: string): Promise<Buffer> {
  return QRCode.toBuffer(text, { ...OPTS, type: "png", width: 1024 });
}
```

`app/api/admin/orders/[id]/digital-card/qr/route.ts`:

```ts
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getByOrder } from "@/lib/digital-cards";
import { qrPng } from "@/lib/digital-card-qr";

export const runtime = "nodejs";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  if (!requireAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const card = getByOrder(id);
  if (!card) return NextResponse.json({ error: "not_enabled" }, { status: 404 });
  const png = await qrPng(card.shortUrl);
  return new NextResponse(new Uint8Array(png), {
    status: 200,
    headers: {
      "content-type": "image/png",
      "content-disposition": `attachment; filename="tarjeta-${id}.png"`,
      "cache-control": "no-store",
    },
  });
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- tests/unit/digital-card-qr.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json lib/digital-card-qr.ts "app/api/admin/orders/[id]/digital-card/qr/route.ts" tests/unit/digital-card-qr.test.ts
git commit -m "feat(digital-card): QR generation and admin PNG download

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Public `/c/[code]` route and proxy exclusion

**Files:**
- Create: `lib/digital-card-pages.ts`, `app/c/[code]/route.ts`
- Modify: `proxy.ts` (matcher, ~L57)
- Test: `tests/unit/digital-card-public-route.test.ts`, `tests/unit/proxy-matcher-digital-card.test.ts`

**Interfaces:**
- Consumes: `getByCode` (Task 2), `CODE_PATTERN`, `isAllowedCardUrl` (Task 1), `getOrder` (`lib/order-storage.ts`).
- Produces:
  - `preparingPage(locale: "es" | "en"): string`, `notFoundPage(): string`
  - `GET /c/[code]` → 302 (Location = target URL) | 200 preparing page | 404 page; all `Cache-Control: no-store`

- [ ] **Step 1: Write the failing tests**

`tests/unit/digital-card-public-route.test.ts`:

```ts
// @vitest-environment node
import { it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { enableForOrder, setTargetUrl } from "@/lib/digital-cards";
import { GET } from "@/app/c/[code]/route";

beforeEach(() => { vi.stubEnv("SQLITE_FILE", ":memory:"); runMigrations(); });
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

function seed(id: string, locale: "es" | "en") {
  getDb().prepare(
    `INSERT INTO orders (id, locale, source, recipient_name, recipient_phone, contact_phone,
       fulfillment_method, window_date, window_slot, lines_json, subtotal_cents, delivery_cents,
       tax_cents, total_cents, fulfillment_status, payment_status, created_at, updated_at)
     VALUES (?, ?, 'walk-in', 'Ana', '555', '555', 'in-store', NULL, NULL, '[]', 0,0,0,0,
       'pending', 'pending', '2026-06-01T08:00:00Z', '2026-06-01T08:00:00Z')`,
  ).run(id, locale);
}
const get = (code: string) => GET(new Request(`http://x/c/${code}`), { params: Promise.resolve({ code }) });
const URL_OK = "https://tarjetas.makythedivaflowers.com/i/raymond-50-k3x9";

it("302s to the card when a url is set", async () => {
  seed("o1", "es");
  enableForOrder("o1", () => "Ab3dE5fG");
  setTargetUrl("o1", URL_OK);
  const res = await get("Ab3dE5fG");
  expect(res.status).toBe(302);
  expect(res.headers.get("location")).toBe(URL_OK);
  expect(res.headers.get("cache-control")).toBe("no-store");
});

it("shows the Spanish preparing page without a url", async () => {
  seed("o1", "es");
  enableForOrder("o1", () => "Ab3dE5fG");
  const res = await get("Ab3dE5fG");
  expect(res.status).toBe(200);
  expect(res.headers.get("cache-control")).toBe("no-store");
  expect(res.headers.get("content-type")).toContain("text/html");
  const html = await res.text();
  expect(html).toContain('<meta name="robots" content="noindex">');
  expect(html).toContain('lang="es"');
  expect(html).toContain("se está terminando de preparar");
});

it("uses English for an English order", async () => {
  seed("o2", "en");
  enableForOrder("o2", () => "Zz9yX8wV");
  const html = await (await get("Zz9yX8wV")).text();
  expect(html).toContain('lang="en"');
  expect(html).toContain("is being finished");
});

it("treats a stored url on a no-longer-allowed host as not ready", async () => {
  seed("o1", "es");
  enableForOrder("o1", () => "Ab3dE5fG");
  setTargetUrl("o1", "https://evil.example.com/x"); // bypasses the schema on purpose
  expect((await get("Ab3dE5fG")).status).toBe(200);
});

it("404s unknown and malformed codes", async () => {
  for (const code of ["Nope1234", "short", "has space!", "../../etc"]) {
    const res = await get(code);
    expect(res.status).toBe(404);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.text()).toContain('<meta name="robots" content="noindex">');
  }
});
```

`tests/unit/proxy-matcher-digital-card.test.ts`:

```ts
// @vitest-environment node
import { it, expect, vi } from "vitest";

vi.mock("next-intl/middleware", () => ({ default: () => () => undefined }));

it("the locale matcher skips /c/<code> but still covers normal pages", async () => {
  const { config } = await import("@/proxy");
  const pageMatcher = new RegExp(`^${config.matcher[0]}$`);
  expect(pageMatcher.test("/c/Ab3dE5fG")).toBe(false);
  expect(pageMatcher.test("/catalog")).toBe(true);
  expect(pageMatcher.test("/contact")).toBe(true);
  expect(pageMatcher.test("/en/shop")).toBe(true);
});
```

If importing `@/proxy` pulls in other modules that fail under Vitest, stub them with `vi.mock` the same way; the test only needs `config`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/unit/digital-card-public-route.test.ts tests/unit/proxy-matcher-digital-card.test.ts`
Expected: FAIL — route missing; `/c/Ab3dE5fG` still matches.

- [ ] **Step 3: Implement**

`lib/digital-card-pages.ts`:

```ts
// Tiny self-contained pages for /c/<code>. They live outside the localized app
// shell on purpose: the recipient only needs a friendly, branded message.

type Locale = "es" | "en";

const COPY: Record<Locale, { title: string; body: string; link: string }> = {
  es: {
    title: "Tu sorpresa está en camino",
    body: "Tu sorpresa digital se está terminando de preparar. Vuelve a escanear el código en un rato 💐",
    link: "Visitar Maky the Diva Flowers",
  },
  en: {
    title: "Your surprise is on its way",
    body: "Your digital surprise is being finished. Scan the code again in a little while 💐",
    link: "Visit Maky the Diva Flowers",
  },
};

function shell(locale: Locale, title: string, body: string, link: string): string {
  return `<!doctype html>
<html lang="${locale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${title}</title>
<style>
  body { margin: 0; min-height: 100vh; display: grid; place-items: center;
         background: #FAF6F0; color: #0E0D0C; font-family: Georgia, "Times New Roman", serif; }
  main { max-width: 26rem; padding: 2rem 1.5rem; text-align: center; }
  .brand { font-size: 2rem; letter-spacing: 0.02em; }
  .tag { font-size: 0.75rem; letter-spacing: 0.3em; text-transform: uppercase; opacity: 0.6; }
  h1 { font-size: 1.35rem; font-weight: normal; margin: 2rem 0 0.75rem; }
  p { line-height: 1.5; opacity: 0.8; }
  a { color: #B8345E; }
</style>
</head>
<body>
<main>
  <div class="brand">maky</div>
  <div class="tag">the diva flowers</div>
  <h1>${title}</h1>
  <p>${body}</p>
  <p><a href="https://makythedivaflowers.com">${link}</a></p>
</main>
</body>
</html>`;
}

export function preparingPage(locale: Locale): string {
  const c = COPY[locale];
  return shell(locale, c.title, c.body, c.link);
}

export function notFoundPage(): string {
  return shell(
    "es",
    "No encontramos esta tarjeta",
    "Revisa que el código esté completo o escríbenos y te ayudamos.",
    COPY.es.link,
  );
}
```

`app/c/[code]/route.ts`:

```ts
import { getByCode } from "@/lib/digital-cards";
import { CODE_PATTERN } from "@/lib/digital-card-code";
import { notFoundPage, preparingPage } from "@/lib/digital-card-pages";
import { getOrder } from "@/lib/order-storage";
import { isAllowedCardUrl } from "@/schemas/digital-card";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function html(body: string, status: number): Response {
  return new Response(body, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}

export async function GET(_req: Request, ctx: { params: Promise<{ code: string }> }): Promise<Response> {
  const { code } = await ctx.params;
  const card = CODE_PATTERN.test(code) ? getByCode(code) : null;
  if (!card) return html(notFoundPage(), 404);
  // Re-checked here too: if the allow-list changes, an old URL stops redirecting.
  if (card.targetUrl && isAllowedCardUrl(card.targetUrl)) {
    return new Response(null, {
      status: 302,
      headers: { location: card.targetUrl, "cache-control": "no-store" },
    });
  }
  const order = await getOrder(card.orderId);
  return html(preparingPage(order?.locale === "en" ? "en" : "es"), 200);
}
```

`proxy.ts` — change the first matcher entry so `/c/<code>` never reaches next-intl or admin auth:

```ts
export const config = {
  matcher: [
    "/((?!api|_next|_vercel|c/|.*\\..*).*)",
    "/api/admin/:path*",
  ],
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/unit/digital-card-public-route.test.ts tests/unit/proxy-matcher-digital-card.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the suites that exercise the proxy and i18n**

Run: `npm test -- tests/unit/admin-auth-edge.test.ts tests/unit/i18n-keys.test.ts`
Expected: PASS (no regressions from the matcher change).

- [ ] **Step 6: Commit**

```bash
git add lib/digital-card-pages.ts "app/c/[code]/route.ts" proxy.ts tests/unit/digital-card-public-route.test.ts tests/unit/proxy-matcher-digital-card.test.ts
git commit -m "feat(digital-card): public /c/<code> redirect and preparing page

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Digital QR on the printed card

**Files:**
- Modify: `lib/print-render-html.tsx` (`BrandCoverPanel` ~L320, `CardRow` ~L389, `Sheet` ~L400, `buildSheetHtml` ~L423), `lib/print-styles.ts` (after `.brand-cover .qr-img` ~L223)
- Create: `lib/print-sheet.ts`
- Modify callers: `app/api/admin/orders/[id]/sheet/route.ts`, `app/api/print/queue/route.ts`
- Test: `tests/unit/print-digital-card.test.ts`

**Interfaces:**
- Consumes: `qrSvgDataUri` (Task 4), `getByOrder` (Task 2), `enableForOrder` (Task 2, tests only).
- Produces:
  - `type SheetOptions = { digitalCardUrl?: string }`
  - `buildSheetHtml(order: Order, opts?: SheetOptions): Promise<string>` (stays DB-free)
  - `buildOrderSheetHtml(order: Order): Promise<string>` in `lib/print-sheet.ts`

- [ ] **Step 1: Write the failing test**

`tests/unit/print-digital-card.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { Order } from "@/types/order";
import { buildSheetHtml } from "@/lib/print-render-html";
import { buildOrderSheetHtml } from "@/lib/print-sheet";
import { qrSvgDataUri } from "@/lib/digital-card-qr";
import { getQrWebsiteDataUri } from "@/lib/print-styles";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { enableForOrder } from "@/lib/digital-cards";

const CARD_URL = "https://makythedivaflowers.com/c/Ab3dE5fG";

// Scope to the card row in <body>: the CSS in <head> mentions class names too.
function card(html: string) {
  const body = html.slice(html.indexOf("<body>"));
  return body.slice(body.indexOf('class="card-row"'));
}

function order(locale: "es" | "en", id = "do_dc01"): Order {
  return {
    id,
    orderNumber: 1042,
    source: "walk-in",
    locale,
    lines: [{ kind: "catalog", productId: "p-arr-b1-01", variantId: "standard", addOnIds: [], qty: 1 }],
    contact: { name: "Ana", email: "ana@example.com", phone: "5165551234" },
    totals: { subtotalCents: 40000, deliveryCents: 0, discountCents: 0, tipCents: 0, taxCents: 0, totalCents: 40000 },
    status: "pending",
    paymentStatus: "paid",
    createdAt: "2026-09-24T15:30:00.000Z",
    updatedAt: "2026-09-24T15:30:00.000Z",
    fulfillment: {
      method: "in-store",
      recipient: { name: "Raymond", phone: "5165550101" },
      cardMessage: "Feliz 50",
    },
  } as Order;
}

describe("buildSheetHtml with a digital card", () => {
  it("prints the digital QR and the Spanish caption", async () => {
    const c = card(await buildSheetHtml(order("es"), { digitalCardUrl: CARD_URL }));
    expect(c).toContain(`src="${await qrSvgDataUri(CARD_URL)}"`);
    expect(c).toContain("Escanea para abrir tu sorpresa");
    expect(c).not.toContain(getQrWebsiteDataUri());
  });
  it("uses the English caption for English orders", async () => {
    const c = card(await buildSheetHtml(order("en"), { digitalCardUrl: CARD_URL }));
    expect(c).toContain("Scan to open your surprise");
  });
  it("keeps the website QR and no caption without one", async () => {
    const c = card(await buildSheetHtml(order("es")));
    expect(c).toContain(`src="${getQrWebsiteDataUri()}"`);
    expect(c).not.toContain("qr-caption");
  });
});

describe("buildOrderSheetHtml", () => {
  beforeEach(() => {
    vi.stubEnv("SQLITE_FILE", ":memory:");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://makythedivaflowers.com");
    runMigrations();
    getDb().prepare(
      `INSERT INTO orders (id, locale, source, recipient_name, recipient_phone, contact_phone,
         fulfillment_method, window_date, window_slot, lines_json, subtotal_cents, delivery_cents,
         tax_cents, total_cents, fulfillment_status, payment_status, created_at, updated_at)
       VALUES ('do_dc01', 'es', 'walk-in', 'Raymond', '555', '555', 'in-store', NULL, NULL, '[]', 0,0,0,0,
         'pending', 'paid', '2026-09-24T15:30:00Z', '2026-09-24T15:30:00Z')`,
    ).run();
  });
  afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

  it("uses the order's digital card when enabled", async () => {
    enableForOrder("do_dc01", () => "Ab3dE5fG");
    const c = card(await buildOrderSheetHtml(order("es")));
    expect(c).toContain(`src="${await qrSvgDataUri(CARD_URL)}"`);
  });
  it("falls back to the website QR otherwise", async () => {
    const c = card(await buildOrderSheetHtml(order("es")));
    expect(c).toContain(`src="${getQrWebsiteDataUri()}"`);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/print-digital-card.test.ts`
Expected: FAIL — cannot resolve `@/lib/print-sheet`; caption missing.

- [ ] **Step 3: Implement**

`lib/print-render-html.tsx`:

1. Add the import next to the other `@/lib` imports:

```ts
import { qrSvgDataUri } from "@/lib/digital-card-qr";
```

2. Replace `BrandCoverPanel`:

```tsx
function BrandCoverPanel({ order, qrUri, digital }: { order: Order; qrUri: string; digital: boolean }) {
  const scanLine = order.locale === "en" ? "Scan to open your surprise" : "Escanea para abrir tu sorpresa";
  return (
    <div className="card-panel brand-cover">
      <div className="qr-chip">
        <img
          className="qr-img"
          src={qrUri}
          alt={digital ? scanLine : "Escanea para visitar makythedivaflowers.com"}
        />
        {digital && <div className="qr-caption">{scanLine}</div>}
      </div>
      <div className="card-brand">
        <div className="name">maky</div>
        <div className="tag">the diva flowers</div>
      </div>
      <CoverRecipient order={order} />
    </div>
  );
}
```

3. Thread `digital` through `CardRow` and `Sheet`: add `digital: boolean` to each props type; `CardRow` renders `<BrandCoverPanel order={order} qrUri={qrUri} digital={digital} />`; `Sheet` renders `<CardRow order={order} logoUri={logoUri} qrUri={qrUri} digital={digital} />`.

4. Replace `buildSheetHtml`:

```tsx
export type SheetOptions = { digitalCardUrl?: string };

// Stays DB-free so it can render any Order. lib/print-sheet.ts looks up the
// order's digital card and passes its short URL here.
export async function buildSheetHtml(order: Order, opts: SheetOptions = {}): Promise<string> {
  const renderToStaticMarkup = await loadRenderToStaticMarkup();
  const logoUri = getLogoDataUri();
  const digital = Boolean(opts.digitalCardUrl);
  const qrUri = opts.digitalCardUrl ? await qrSvgDataUri(opts.digitalCardUrl) : getQrWebsiteDataUri();
  return htmlDocument(
    renderToStaticMarkup(<Sheet order={order} logoUri={logoUri} qrUri={qrUri} digital={digital} />),
    order.locale,
  );
}
```

`lib/print-styles.ts` — right after the `.brand-cover .qr-img { … }` rule:

```css
    /* Digital-card caption under the QR. The chip sets line-height: 0 for the
       image, so the caption restores it. */
    .brand-cover .qr-caption {
      line-height: 1.15; margin-top: 3pt; max-width: 0.8in;
      font-size: 6.5pt; text-align: center; color: #0E0D0C;
    }
```

`lib/print-sheet.ts`:

```ts
import "server-only";
import type { Order } from "@/types/order";
import { buildSheetHtml } from "@/lib/print-render-html";
import { getByOrder } from "@/lib/digital-cards";

// The sheet for a stored order: the digital-card QR when the order has one,
// otherwise the website QR.
export async function buildOrderSheetHtml(order: Order): Promise<string> {
  const card = getByOrder(order.id);
  return buildSheetHtml(order, card ? { digitalCardUrl: card.shortUrl } : {});
}
```

Callers — replace the import and the call:

- `app/api/admin/orders/[id]/sheet/route.ts`: `import { buildOrderSheetHtml } from "@/lib/print-sheet";` and `const html = await buildOrderSheetHtml(order);`
- `app/api/print/queue/route.ts`: `import { buildOrderSheetHtml } from "@/lib/print-sheet";` and `html: await buildOrderSheetHtml(order),`

`tests/unit/api-print-queue.test.ts` mocks `buildSheetHtml` in `@/lib/print-render-html`; `lib/print-sheet.ts` imports that same mocked module, so the test keeps working, and it already uses an in-memory DB.

- [ ] **Step 4: Run the print suites**

Run: `npm test -- tests/unit/print-digital-card.test.ts tests/unit/print-qr-and-total.test.ts tests/unit/api-print-queue.test.ts tests/unit/api-admin-order-sheet.test.ts tests/unit/print-sheet-details.test.ts`
Expected: PASS.

- [ ] **Step 5: Look at it**

With `npm run dev` running and logged into admin, enable a digital card on a test order (`POST /api/admin/orders/<id>/digital-card` from the browser console with `fetch`), open `/api/admin/orders/<id>/sheet`, and confirm: the caption fits under the QR chip on the cover panel, and a phone camera scans the QR on screen to `…/c/<code>`.

- [ ] **Step 6: Commit**

```bash
git add lib/print-render-html.tsx lib/print-styles.ts lib/print-sheet.ts "app/api/admin/orders/[id]/sheet/route.ts" app/api/print/queue/route.ts tests/unit/print-digital-card.test.ts
git commit -m "feat(print): digital-card QR and caption on the card cover

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: "Tarjeta digital" block in the admin drawer

**Files:**
- Create: `components/admin/dashboard/DigitalCardSection.tsx`
- Modify: `components/admin/dashboard/OrderDetailDrawer.tsx` (`DetailResp` ~L24; insert after the recipient/card-message `</section>` ~L267), `messages/es.json`, `messages/en.json` (inside `"admin_orders"`, after `"reprint_confirm"`)
- Test: `tests/unit/DigitalCardSection.test.tsx`

**Interfaces:**
- Consumes: `DigitalCardView` (Task 1); API from Tasks 3–4.
- Produces: `<DigitalCardSection orderId={string} initial={DigitalCardView | null} />` (default export)

- [ ] **Step 1: Write the failing test**

`tests/unit/DigitalCardSection.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import DigitalCardSection from "@/components/admin/dashboard/DigitalCardSection";

vi.mock("next-intl", () => ({ useTranslations: () => (k: string) => k }));

const VIEW = { code: "Ab3dE5fG", shortUrl: "https://makythedivaflowers.com/c/Ab3dE5fG", targetUrl: null };
const GOOD = "https://tarjetas.makythedivaflowers.com/i/raymond-50-k3x9";

function mockFetch(...responses: Array<{ status: number; body: unknown }>) {
  const fn = vi.fn();
  for (const r of responses) {
    fn.mockResolvedValueOnce(new Response(JSON.stringify(r.body), { status: r.status }));
  }
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("DigitalCardSection", () => {
  it("activates a card", async () => {
    const fetchMock = mockFetch({ status: 200, body: VIEW });
    render(<DigitalCardSection orderId="o1" initial={null} />);
    fireEvent.click(screen.getByRole("button", { name: "digital_card_activate" }));
    await screen.findByText(VIEW.shortUrl);
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/orders/o1/digital-card", { method: "POST" });
    expect(screen.getByText("digital_card_preparing")).toBeTruthy();
    expect(screen.getByRole("link", { name: "digital_card_download_qr" }).getAttribute("href"))
      .toBe("/api/admin/orders/o1/digital-card/qr");
  });

  it("saves a url and shows ready", async () => {
    const fetchMock = mockFetch({ status: 200, body: { ...VIEW, targetUrl: GOOD } });
    render(<DigitalCardSection orderId="o1" initial={VIEW} />);
    fireEvent.change(screen.getByLabelText("digital_card_url_label"), { target: { value: `  ${GOOD} ` } });
    fireEvent.click(screen.getByRole("button", { name: "digital_card_save" }));
    await screen.findByText("digital_card_ready");
    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toEqual({ targetUrl: GOOD });
  });

  it("sends null for an empty url", async () => {
    const fetchMock = mockFetch({ status: 200, body: VIEW });
    render(<DigitalCardSection orderId="o1" initial={{ ...VIEW, targetUrl: GOOD }} />);
    fireEvent.change(screen.getByLabelText("digital_card_url_label"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "digital_card_save" }));
    await screen.findByText("digital_card_preparing");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ targetUrl: null });
  });

  it("shows the invalid-url error on 400", async () => {
    mockFetch({ status: 400, body: { error: "invalid_card_url" } });
    render(<DigitalCardSection orderId="o1" initial={VIEW} />);
    fireEvent.change(screen.getByLabelText("digital_card_url_label"), { target: { value: "https://evil.example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "digital_card_save" }));
    expect((await screen.findByRole("alert")).textContent).toBe("digital_card_invalid_url");
  });

  it("copies the short link", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    render(<DigitalCardSection orderId="o1" initial={VIEW} />);
    fireEvent.click(screen.getByRole("button", { name: "digital_card_copy" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(VIEW.shortUrl));
    await screen.findByText("digital_card_copied");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/DigitalCardSection.test.tsx`
Expected: FAIL — cannot resolve the component.

- [ ] **Step 3: Implement the component**

`components/admin/dashboard/DigitalCardSection.tsx`:

```tsx
"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Copy, QrCode, Sparkle } from "@phosphor-icons/react/dist/ssr";
import AdminButton from "./AdminButton";
import type { DigitalCardView } from "@/types/digital-card";

type Props = { orderId: string; initial: DigitalCardView | null };

export default function DigitalCardSection({ orderId, initial }: Props) {
  const t = useTranslations("admin_orders");
  const [card, setCard] = useState<DigitalCardView | null>(initial);
  const [url, setUrl] = useState(initial?.targetUrl ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const endpoint = `/api/admin/orders/${orderId}/digital-card`;

  async function activate() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(endpoint, { method: "POST" });
      if (!res.ok) { setError(t("digital_card_error")); return; }
      setCard((await res.json()) as DigitalCardView);
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const trimmed = url.trim();
      const res = await fetch(endpoint, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ targetUrl: trimmed === "" ? null : trimmed }),
      });
      if (res.status === 400) { setError(t("digital_card_invalid_url")); return; }
      if (!res.ok) { setError(t("digital_card_error")); return; }
      const next = (await res.json()) as DigitalCardView;
      setCard(next);
      setUrl(next.targetUrl ?? "");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!card) return;
    await navigator.clipboard.writeText(card.shortUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const inputId = `digital-card-url-${orderId}`;

  return (
    <section className="mb-3 rounded border border-ink/10 bg-bone p-3 text-sm">
      <div className="mb-2 text-xs uppercase tracking-wide text-ink/50">{t("digital_card_title")}</div>
      {!card ? (
        <AdminButton variant="secondary" icon={Sparkle} disabled={busy} onClick={activate}>
          {t("digital_card_activate")}
        </AdminButton>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                card.targetUrl ? "bg-green-50 text-green-800" : "bg-ink/10 text-ink/70"
              }`}
            >
              {card.targetUrl ? t("digital_card_ready") : t("digital_card_preparing")}
            </span>
            <a href={card.shortUrl} target="_blank" rel="noreferrer" className="min-w-0 truncate underline">
              {card.shortUrl}
            </a>
            <button
              type="button"
              onClick={copy}
              aria-label={t("digital_card_copy")}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg hover:bg-ink/5"
            >
              <Copy size={16} weight="bold" />
            </button>
            {copied && <span className="text-xs text-ink/60">{t("digital_card_copied")}</span>}
          </div>
          <label htmlFor={inputId} className="block text-xs text-ink/60">{t("digital_card_url_label")}</label>
          <div className="flex gap-2">
            <input
              id={inputId}
              type="url"
              inputMode="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://tarjetas.makythedivaflowers.com/i/…"
              className="min-h-11 min-w-0 flex-1 rounded-lg border border-ink/20 bg-white px-3 text-sm"
            />
            <AdminButton variant="primary" disabled={busy} onClick={save}>{t("digital_card_save")}</AdminButton>
          </div>
          {error && <div role="alert" className="text-xs text-error">{error}</div>}
          <AdminButton variant="secondary" icon={QrCode} href={`${endpoint}/qr`} download>
            {t("digital_card_download_qr")}
          </AdminButton>
          <p className="text-xs text-ink/60">{t("digital_card_reprint_hint")}</p>
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Add the strings**

In `messages/es.json`, inside `"admin_orders"`, after `"reprint_confirm"`:

```json
    "digital_card_title": "Tarjeta digital",
    "digital_card_activate": "Activar tarjeta digital",
    "digital_card_preparing": "Preparando",
    "digital_card_ready": "Lista ✓",
    "digital_card_copy": "Copiar enlace",
    "digital_card_copied": "Copiado",
    "digital_card_url_label": "URL de la tarjeta",
    "digital_card_save": "Guardar",
    "digital_card_download_qr": "Descargar QR",
    "digital_card_invalid_url": "La URL debe empezar con https://tarjetas.makythedivaflowers.com/",
    "digital_card_error": "No se pudo guardar. Intenta de nuevo.",
    "digital_card_reprint_hint": "Si la hoja ya se imprimió, usa Re-imprimir para que salga el QR nuevo.",
```

In `messages/en.json`, same place:

```json
    "digital_card_title": "Digital card",
    "digital_card_activate": "Activate digital card",
    "digital_card_preparing": "Preparing",
    "digital_card_ready": "Ready ✓",
    "digital_card_copy": "Copy link",
    "digital_card_copied": "Copied",
    "digital_card_url_label": "Card URL",
    "digital_card_save": "Save",
    "digital_card_download_qr": "Download QR",
    "digital_card_invalid_url": "The URL must start with https://tarjetas.makythedivaflowers.com/",
    "digital_card_error": "Couldn't save. Try again.",
    "digital_card_reprint_hint": "If the sheet was already printed, use Re-print to get the new QR.",
```

Keep the JSON valid: `"reprint_confirm"` must still be followed by a comma, and the last key in the object must not have one.

- [ ] **Step 5: Wire it into the drawer**

`components/admin/dashboard/OrderDetailDrawer.tsx` — imports:

```tsx
import DigitalCardSection from "./DigitalCardSection";
import type { DigitalCardView } from "@/types/digital-card";
```

Add to `DetailResp`:

```ts
  digitalCard?: DigitalCardView | null;
```

Immediately after the closing `</section>` of the recipient/card-message section (the one rendering `f.cardMessage`, ~L267), in the same JSX block where `data` is non-null:

```tsx
        <DigitalCardSection key={data.order.id} orderId={orderId} initial={data.digitalCard ?? null} />
```

- [ ] **Step 6: Run tests and typecheck**

Run: `npm test -- tests/unit/DigitalCardSection.test.tsx tests/unit/i18n-parity.test.ts tests/unit/i18n-keys.test.ts tests/unit/messages-no-placeholders.test.ts`
Expected: PASS.

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add components/admin/dashboard/DigitalCardSection.tsx components/admin/dashboard/OrderDetailDrawer.tsx messages/es.json messages/en.json tests/unit/DigitalCardSection.test.tsx
git commit -m "feat(admin): digital card block in the order drawer

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: End-to-end check

**Files:**
- Create: `tests/e2e/digital-card.spec.ts`

**Interfaces:**
- Consumes: everything above, through the dev server Playwright starts (`playwright.config.ts`: port 3333, `SQLITE_FILE=data/diva.e2e.sqlite`, `INTAKE_PASSWORD=test-pass`).

The drawer UI is covered by the component test (Task 7); this spec proves the real stack: admin session → API → `/c/<code>` served outside next-intl.

- [ ] **Step 1: Write the test**

`tests/e2e/digital-card.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

const PASSWORD = process.env.INTAKE_PASSWORD ?? "test-pass";
const CARD_URL = "https://tarjetas.makythedivaflowers.com/i/e2e-demo";

test("an order's digital card link prepares, then redirects", async ({ page }) => {
  await page.goto("/en/admin/login?next=/en/admin/intake");
  await page.fill("input[type='password']", PASSWORD);
  await page.click("button[type='submit']");
  await page.waitForURL(/\/admin\/intake/);

  // Same walk-in delivery flow as admin-intake.spec.ts, to get a real order id.
  await page.click("button:has-text('Walk-in')");
  await page.fill("input[placeholder='Teléfono']", "5165550300");
  await page.fill("input[placeholder='Nombre']", "E2E Digital Card");
  await page.click("button:has-text('Delivery')");
  await page.fill("input[placeholder='Destinatario']", "Raymond");
  await page.fill("input[placeholder='Tel destinatario']", "5165550399");
  await page.fill("input[placeholder*='Dirección']", "1 Main St, Albertson NY 11507");
  await page.locator(".grid-cols-3 > button").first().click();
  await page.click("button:has-text('Efectivo')");
  await page.click("button:has-text('Guardar e imprimir ticket')");
  await page.waitForURL(/\?ok=do_/);
  const orderId = new URL(page.url()).searchParams.get("ok")!;

  const activated = await page.request.post(`/api/admin/orders/${orderId}/digital-card`);
  expect(activated.ok()).toBe(true);
  const { code } = (await activated.json()) as { code: string };

  const preparing = await page.request.get(`/c/${code}`, { maxRedirects: 0 });
  expect(preparing.status()).toBe(200);
  expect(await preparing.text()).toContain('<meta name="robots" content="noindex">');

  const patched = await page.request.patch(`/api/admin/orders/${orderId}/digital-card`, {
    data: { targetUrl: CARD_URL },
  });
  expect(patched.ok()).toBe(true);

  const redirect = await page.request.get(`/c/${code}`, { maxRedirects: 0 });
  expect(redirect.status()).toBe(302);
  expect(redirect.headers()["location"]).toBe(CARD_URL);

  const unknown = await page.request.get("/c/Nope1234", { maxRedirects: 0 });
  expect(unknown.status()).toBe(404);
});
```

- [ ] **Step 2: Run it**

Run: `npx playwright test tests/e2e/digital-card.spec.ts`
Expected: PASS. If `/c/<code>` answers 307 to `/en/c/<code>`, the Task 5 matcher change is not in effect; restart the dev server.

- [ ] **Step 3: Run the whole unit suite once**

Run: `npm test`
Expected: PASS (no regressions).

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/digital-card.spec.ts
git commit -m "test(e2e): digital card short link prepares then redirects

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Card platform — cards are never indexed (other repo)

**Repo:** `/Volumes/Datadriven/02_PROYECTOS/proposals card`, branch `feat/birthday-gilded-noir`. That branch has unrelated uncommitted gilded-noir work: stage ONLY the two files below.

**Files:**
- Modify: `apps/web/app/i/[slug]/page.tsx` (`generateMetadata`, the `robots:` line ~L59)
- Test: `e2e/raymond-50.spec.ts` (add one test)

- [ ] **Step 1: Write the failing test**

Append to `e2e/raymond-50.spec.ts` (it already defines `const URL = '/i/raymond-50'`):

```ts
test('the card is never indexed (it is opened from a printed QR, not search)', async ({ page }) => {
  await page.goto(URL);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm test:e2e e2e/raymond-50.spec.ts -g "never indexed"`
Expected: FAIL — no robots meta when the card is opened without a guest token.

- [ ] **Step 3: Implement**

In `generateMetadata`, replace:

```ts
    robots: guest.guest ? { index: false } : undefined,
```

with:

```ts
    // Cards are personal and reached by link or printed QR — never from search.
    robots: { index: false },
```

- [ ] **Step 4: Run it to verify it passes**

Run: `pnpm test:e2e e2e/raymond-50.spec.ts`
Expected: PASS (whole Raymond spec).

- [ ] **Step 5: Commit (only these two files)**

```bash
git add "apps/web/app/i/[slug]/page.tsx" e2e/raymond-50.spec.ts
git commit -m "feat(web): never index card pages

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## After the plan (ops, not code)

From the spec's Rollout, listed so nothing is forgotten:

1. Merge `feat/digital-card-qr`; migration 029 runs on first DB access in production.
2. Set `DIGITAL_CARD_HOSTS` only if the card host differs from `tarjetas.makythedivaflowers.com`.
3. Create Raymond's order in admin, activate the digital card, print.
4. Deploy the card platform to `tarjetas.makythedivaflowers.com` (`docs/deploy/hostinger.md` in that repo), republish Raymond under an unguessable slug (e.g. `raymond-50-k3x9`, assets folder renamed to match), and paste the URL in the drawer.
