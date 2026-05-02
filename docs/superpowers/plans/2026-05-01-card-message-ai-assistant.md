# Card-Message AI Assistant — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an opt-in AI assistant inside the PDP `CardMessage` component that generates three locale-matched card-message suggestions on demand via Claude Haiku 4.5.

**Architecture:** A new server-only POST `/api/card-message` route validates inputs with zod, applies a per-IP rate limit (reusing `lib/rate-limit.ts`), calls Anthropic's SDK with a strict JSON-output system prompt, and returns three suggestions. A new client component `CardMessageAssist` renders inline above the existing textarea: relation chips → generate → loading skeleton → three clickable suggestion cards → on pick, the text loads into the textarea. Sympathy-categorized products use a different chip set and tone instructions.

**Tech Stack:** Next.js 16 App Router, TypeScript, zod (already a dep), `@anthropic-ai/sdk` (new dep), Tailwind, vitest + @testing-library/react, Playwright. Reuses existing `lib/rate-limit.ts`, follows patterns from `app/api/contact/route.ts` and `schemas/contact.ts`.

**Spec:** `docs/superpowers/specs/2026-05-01-card-message-ai-assistant-design.md`

**Conventions discovered (must follow):**
- Tests live flat in `tests/unit/*.test.{ts,tsx}` — no subdirectories. Vitest config: `tests/unit/**/*.test.ts`, `tests/unit/**/*.test.tsx`.
- Schemas live in `schemas/<name>.ts` and export both the schema and an inferred `Input` type.
- Lib helpers live in `lib/<name>.ts` — one file per responsibility, no subfolders.
- API routes return `NextResponse.json(...)` with explicit `{ status }`.
- `lib/rate-limit.ts` exports `rateLimit(key, { max, windowMs })`, `ipFromRequest(req)`, and `__resetRateLimitForTests()`. Reuse these — do not write a new rate-limit module.
- i18n keys live in `messages/en.json` and `messages/es.json`, accessed via `next-intl` `useTranslations`/`getTranslations`. The existing keys `card_message`, `card_message_hint` already exist (used by checkout); add new keys under a non-colliding namespace.
- Existing API route pattern: `app/api/contact/route.ts` (read it before writing the new one).

**File map:**

| Path | Action | Responsibility |
|---|---|---|
| `package.json` | modify | Add `@anthropic-ai/sdk` dep. |
| `schemas/card-message.ts` | create | zod schema for the request body; exported types. |
| `lib/card-message-prompt.ts` | create | Pure function `buildCardMessagePrompt(input)` → `{ system, user }`. |
| `lib/card-message-relations.ts` | create | Pure function `getRelations(mode, locale)` → array of `{ key, label }`. |
| `app/api/card-message/route.ts` | create | POST handler: validate → rate-limit → call Anthropic → return suggestions. |
| `components/product/CardMessageSkeleton.tsx` | create | Three pulsing placeholder cards. |
| `components/product/CardMessageAssist.tsx` | create | Inline panel: chips, generate button, loading, suggestions, error. |
| `components/product/CardMessage.tsx` | modify | Accept new props (`productTitle`, `occasions`); render trigger + `CardMessageAssist`; manage panel open state. |
| `components/product/PdpConfigurator.tsx` | modify | Pass `productTitle={product.title[locale]}` and `occasions={product.occasions}` to `CardMessage`. |
| `messages/en.json` | modify | Add `card_message_assist.*` keys. |
| `messages/es.json` | modify | Add `card_message_assist.*` keys. |
| `tests/unit/card-message-relations.test.ts` | create | |
| `tests/unit/card-message-prompt.test.ts` | create | |
| `tests/unit/card-message-schema.test.ts` | create | |
| `tests/unit/card-message-route.test.ts` | create | Handler tests with mocked SDK. |
| `tests/unit/CardMessageAssist.test.tsx` | create | Component tests. |
| `tests/unit/CardMessage.test.tsx` | create | Container tests (existing component had no test). |
| `tests/e2e/card-message-ai.spec.ts` | create | Playwright with mocked `/api/card-message`. |

---

## Task 1: Install the Anthropic SDK

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install dependency**

Run: `npm install @anthropic-ai/sdk@latest`

Expected: `package.json` and `package-lock.json` (or pnpm-lock.yaml) updated; one new entry in `dependencies` for `@anthropic-ai/sdk`.

- [ ] **Step 2: Verify install**

Run: `node -e "console.log(require('@anthropic-ai/sdk').default.name || 'ok')"`

Expected: prints something (constructor function name) — confirms the package resolves.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json pnpm-lock.yaml 2>/dev/null
git commit -m "chore: add @anthropic-ai/sdk for card-message assistant"
```

---

## Task 2: zod schema for the request

**Files:**
- Create: `schemas/card-message.ts`
- Test: `tests/unit/card-message-schema.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/card-message-schema.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { cardMessageRequestSchema } from "@/schemas/card-message";

describe("cardMessageRequestSchema", () => {
  const valid = {
    productTitle: "Timeless Romance",
    occasion: "anniversary",
    relation: "partner",
    locale: "en",
  };

  it("accepts a valid request", () => {
    const r = cardMessageRequestSchema.safeParse(valid);
    expect(r.success).toBe(true);
  });

  it("accepts sympathy-mode relations", () => {
    for (const relation of ["family", "close-friend", "coworker", "other"]) {
      const r = cardMessageRequestSchema.safeParse({ ...valid, occasion: "sympathy", relation });
      expect(r.success).toBe(true);
    }
  });

  it("accepts default-mode relations", () => {
    for (const relation of ["partner", "mother", "father", "friend", "family", "other"]) {
      const r = cardMessageRequestSchema.safeParse({ ...valid, relation });
      expect(r.success).toBe(true);
    }
  });

  it("rejects unknown occasion", () => {
    expect(cardMessageRequestSchema.safeParse({ ...valid, occasion: "wedding" }).success).toBe(false);
  });

  it("rejects unknown locale", () => {
    expect(cardMessageRequestSchema.safeParse({ ...valid, locale: "fr" }).success).toBe(false);
  });

  it("rejects unknown relation", () => {
    expect(cardMessageRequestSchema.safeParse({ ...valid, relation: "boss" }).success).toBe(false);
  });

  it("rejects productTitle longer than 80 chars", () => {
    const long = "x".repeat(81);
    expect(cardMessageRequestSchema.safeParse({ ...valid, productTitle: long }).success).toBe(false);
  });

  it("rejects empty productTitle", () => {
    expect(cardMessageRequestSchema.safeParse({ ...valid, productTitle: "" }).success).toBe(false);
  });

  it("rejects missing fields", () => {
    expect(cardMessageRequestSchema.safeParse({}).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/card-message-schema.test.ts`

Expected: FAIL — module `@/schemas/card-message` does not exist.

- [ ] **Step 3: Write the schema**

Create `schemas/card-message.ts`:

```ts
import { z } from "zod";

export const occasionSchema = z.enum([
  "birthday",
  "anniversary",
  "sympathy",
  "romance",
  "congrats",
  "just-because",
]);

export const relationSchema = z.enum([
  // default mode
  "partner",
  "mother",
  "father",
  "friend",
  "family",
  "other",
  // sympathy mode (overlaps "family" and "other" intentionally)
  "close-friend",
  "coworker",
]);

export const cardMessageRequestSchema = z.object({
  productTitle: z.string().min(1).max(80),
  occasion: occasionSchema,
  relation: relationSchema,
  locale: z.enum(["en", "es"]),
});

export type CardMessageRequest = z.infer<typeof cardMessageRequestSchema>;
export type Occasion = z.infer<typeof occasionSchema>;
export type Relation = z.infer<typeof relationSchema>;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/card-message-schema.test.ts`

Expected: 9 tests pass.

- [ ] **Step 5: Commit**

```bash
git add schemas/card-message.ts tests/unit/card-message-schema.test.ts
git commit -m "feat(card-message): add zod request schema"
```

---

## Task 3: Pure relations helper

**Files:**
- Create: `lib/card-message-relations.ts`
- Test: `tests/unit/card-message-relations.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/card-message-relations.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { getRelations } from "@/lib/card-message-relations";

describe("getRelations", () => {
  it("returns 6 chips in default mode (en)", () => {
    const r = getRelations("default", "en");
    expect(r).toHaveLength(6);
    expect(r.map((x) => x.key)).toEqual([
      "partner",
      "mother",
      "father",
      "friend",
      "family",
      "other",
    ]);
    expect(r[0]).toEqual({ key: "partner", label: "Partner" });
  });

  it("returns 6 chips in default mode (es) with localized labels", () => {
    const r = getRelations("default", "es");
    expect(r).toHaveLength(6);
    expect(r.find((x) => x.key === "partner")?.label).toBe("Pareja");
    expect(r.find((x) => x.key === "mother")?.label).toBe("Mamá");
    expect(r.find((x) => x.key === "friend")?.label).toBe("Amigx");
  });

  it("returns 4 chips in sympathy mode", () => {
    const r = getRelations("sympathy", "en");
    expect(r).toHaveLength(4);
    expect(r.map((x) => x.key)).toEqual(["family", "close-friend", "coworker", "other"]);
  });

  it("localizes sympathy mode in es", () => {
    const r = getRelations("sympathy", "es");
    expect(r.find((x) => x.key === "close-friend")?.label).toBe("Amistad cercana");
    expect(r.find((x) => x.key === "coworker")?.label).toBe("Compañerx de trabajo");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/card-message-relations.test.ts`

Expected: FAIL — module not found.

- [ ] **Step 3: Write the helper**

Create `lib/card-message-relations.ts`:

```ts
import type { Locale } from "@/types/locale";
import type { Relation } from "@/schemas/card-message";

export type RelationMode = "default" | "sympathy";
export type RelationOption = { key: Relation; label: string };

const LABELS: Record<Locale, Record<Relation, string>> = {
  en: {
    partner: "Partner",
    mother: "Mom",
    father: "Dad",
    friend: "Friend",
    family: "Family",
    other: "Other",
    "close-friend": "Close friend",
    coworker: "Coworker",
  },
  es: {
    partner: "Pareja",
    mother: "Mamá",
    father: "Papá",
    friend: "Amigx",
    family: "Familia",
    other: "Otro",
    "close-friend": "Amistad cercana",
    coworker: "Compañerx de trabajo",
  },
};

const DEFAULT_KEYS: Relation[] = ["partner", "mother", "father", "friend", "family", "other"];
const SYMPATHY_KEYS: Relation[] = ["family", "close-friend", "coworker", "other"];

export function getRelations(mode: RelationMode, locale: Locale): RelationOption[] {
  const keys = mode === "sympathy" ? SYMPATHY_KEYS : DEFAULT_KEYS;
  return keys.map((key) => ({ key, label: LABELS[locale][key] }));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/card-message-relations.test.ts`

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/card-message-relations.ts tests/unit/card-message-relations.test.ts
git commit -m "feat(card-message): add relations helper"
```

---

## Task 4: Pure prompt builder

**Files:**
- Create: `lib/card-message-prompt.ts`
- Test: `tests/unit/card-message-prompt.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/card-message-prompt.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildCardMessagePrompt } from "@/lib/card-message-prompt";

const baseInput = {
  productTitle: "Timeless Romance",
  occasion: "anniversary" as const,
  relation: "partner" as const,
  locale: "en" as const,
};

describe("buildCardMessagePrompt", () => {
  it("returns a system and user prompt", () => {
    const r = buildCardMessagePrompt(baseInput);
    expect(typeof r.system).toBe("string");
    expect(typeof r.user).toBe("string");
    expect(r.system.length).toBeGreaterThan(50);
    expect(r.user.length).toBeGreaterThan(10);
  });

  it("system prompt mandates strict JSON output shape", () => {
    const { system } = buildCardMessagePrompt(baseInput);
    expect(system).toMatch(/\{"suggestions":/);
    expect(system.toLowerCase()).toContain("exactly three");
  });

  it("system prompt lists banned words", () => {
    const { system } = buildCardMessagePrompt(baseInput);
    for (const word of ["hermoso", "lindo", "perfecto", "increíble", "único", "especial"]) {
      expect(system).toContain(word);
    }
    for (const word of ["beautiful", "perfect", "amazing", "unique", "special"]) {
      expect(system).toContain(word);
    }
  });

  it("system prompt includes occasion-specific tone hints", () => {
    const { system } = buildCardMessagePrompt(baseInput);
    expect(system.toLowerCase()).toContain("anniversary");
    expect(system.toLowerCase()).toContain("birthday");
    expect(system.toLowerCase()).toContain("sympathy");
  });

  it("system prompt names locale (English/Spanish)", () => {
    expect(buildCardMessagePrompt({ ...baseInput, locale: "en" }).system).toContain("English");
    expect(buildCardMessagePrompt({ ...baseInput, locale: "es" }).system).toContain("Spanish");
  });

  it("user prompt contains all four fields verbatim", () => {
    const { user } = buildCardMessagePrompt(baseInput);
    expect(user).toContain("Timeless Romance");
    expect(user).toContain("anniversary");
    expect(user).toContain("partner");
    expect(user).toContain("en");
  });

  it("appends sympathy clause when occasion is sympathy", () => {
    const { system } = buildCardMessagePrompt({ ...baseInput, occasion: "sympathy", relation: "family" });
    expect(system.toLowerCase()).toContain("quiet presence");
    expect(system.toLowerCase()).toMatch(/no religious|no clich/i);
  });

  it("does not append sympathy clause for non-sympathy occasions", () => {
    const { system } = buildCardMessagePrompt(baseInput);
    expect(system.toLowerCase()).not.toContain("quiet presence");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/card-message-prompt.test.ts`

Expected: FAIL — module not found.

- [ ] **Step 3: Write the prompt builder**

Create `lib/card-message-prompt.ts`:

```ts
import type { CardMessageRequest } from "@/schemas/card-message";

const LOCALE_NAMES = { en: "English", es: "Spanish" } as const;

const BASE_SYSTEM = `You are an assistant that writes greeting-card messages for a Long Island florist (Diva Flowers).

You MUST respond with strictly valid JSON in exactly this shape:
{"suggestions": ["…", "…", "…"]}

No prose before or after. No markdown. Exactly three suggestions.

Each suggestion:
- Is written in {LOCALE_NAME} ({locale}).
- Is 1–2 sentences, between 12 and 30 words.
- Carries a distinct register from the other two: one tender, one warm-and-short, one with a specific image or unexpected turn.
- Does NOT include the literal product name.
- Does NOT contain a signature, name placeholder, or "—Love, X".
- Avoids these banned words in any language: hermoso, lindo, perfecto, increíble, único, especial, beautiful, perfect, amazing, unique, special.

Tone varies by occasion:
- anniversary → years, ritual, the long conversation
- birthday → celebration, small joys, the laugh
- romance → pulse, surprise, presence
- just-because → the small gesture that lands big
- congrats → pride, milestone, "you did it"
- sympathy → dignity, quiet presence, no clichés`;

const SYMPATHY_CLAUSE = `

This is a sympathy message. Lead with quiet presence over performance. No religious assumptions. Avoid "rest in peace" / "descansa en paz" as openers — too generic. Speak to the person, not at the loss.`;

export function buildCardMessagePrompt(input: CardMessageRequest): { system: string; user: string } {
  const localeName = LOCALE_NAMES[input.locale];
  let system = BASE_SYSTEM
    .replace("{LOCALE_NAME}", localeName)
    .replace("{locale}", input.locale);

  if (input.occasion === "sympathy") {
    system += SYMPATHY_CLAUSE;
  }

  const user = `Product: ${input.productTitle}
Occasion: ${input.occasion}
Recipient relation: ${input.relation}
Output language: ${input.locale}`;

  return { system, user };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/card-message-prompt.test.ts`

Expected: 8 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/card-message-prompt.ts tests/unit/card-message-prompt.test.ts
git commit -m "feat(card-message): add prompt builder"
```

---

## Task 5: API route handler

**Files:**
- Create: `app/api/card-message/route.ts`
- Test: `tests/unit/card-message-route.test.ts`

The handler depends on `@anthropic-ai/sdk`. We mock it via `vi.mock` to keep tests offline.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/card-message-route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { __resetRateLimitForTests } from "@/lib/rate-limit";

const createMock = vi.fn();
vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: class MockAnthropic {
      messages = { create: createMock };
    },
  };
});

beforeEach(() => {
  __resetRateLimitForTests();
  createMock.mockReset();
  vi.stubEnv("ANTHROPIC_API_KEY", "sk-test");
});
afterEach(() => {
  vi.unstubAllEnvs();
});

const validBody = {
  productTitle: "Timeless Romance",
  occasion: "anniversary",
  relation: "partner",
  locale: "en",
};

function makeReq(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/card-message", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "9.9.9.9", ...headers },
    body: JSON.stringify(body),
  });
}

describe("POST /api/card-message", () => {
  it("returns 400 on invalid body", async () => {
    const { POST } = await import("@/app/api/card-message/route");
    const res = await POST(makeReq({ bogus: 1 }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("invalid_input");
  });

  it("returns 400 on non-JSON body", async () => {
    const { POST } = await import("@/app/api/card-message/route");
    const res = await POST(
      new Request("http://localhost/api/card-message", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "not-json",
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 200 with three suggestions on happy path", async () => {
    createMock.mockResolvedValue({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            suggestions: ["one one one", "two two two", "three three three"],
          }),
        },
      ],
    });
    const { POST } = await import("@/app/api/card-message/route");
    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.suggestions).toEqual(["one one one", "two two two", "three three three"]);
  });

  it("trims and caps each suggestion to 200 chars", async () => {
    const long = "x".repeat(250);
    createMock.mockResolvedValue({
      content: [
        {
          type: "text",
          text: JSON.stringify({ suggestions: ["  hi  ", long, "ok"] }),
        },
      ],
    });
    const { POST } = await import("@/app/api/card-message/route");
    const res = await POST(makeReq(validBody));
    const json = await res.json();
    expect(json.suggestions[0]).toBe("hi");
    expect(json.suggestions[1].length).toBe(200);
    expect(json.suggestions[2]).toBe("ok");
  });

  it("returns 502 on malformed JSON from model", async () => {
    createMock.mockResolvedValue({ content: [{ type: "text", text: "not json at all" }] });
    const { POST } = await import("@/app/api/card-message/route");
    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe("upstream");
  });

  it("returns 502 when array has wrong length", async () => {
    createMock.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify({ suggestions: ["a", "b"] }) }],
    });
    const { POST } = await import("@/app/api/card-message/route");
    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(502);
  });

  it("returns 502 when SDK throws", async () => {
    createMock.mockRejectedValue(new Error("network"));
    const { POST } = await import("@/app/api/card-message/route");
    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(502);
  });

  it("returns 429 on rate limit exceeded", async () => {
    createMock.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify({ suggestions: ["a", "b", "c"] }) }],
    });
    const { POST } = await import("@/app/api/card-message/route");
    for (let i = 0; i < 20; i++) {
      const ok = await POST(makeReq(validBody));
      expect(ok.status).toBe(200);
    }
    const blocked = await POST(makeReq(validBody));
    expect(blocked.status).toBe(429);
    expect((await blocked.json()).error).toBe("rate_limit");
  });

  it("returns 502 when ANTHROPIC_API_KEY is missing", async () => {
    vi.unstubAllEnvs();
    vi.resetModules();
    const { POST } = await import("@/app/api/card-message/route");
    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(502);
  });

  it("logs anonymous telemetry on success without IP or content", async () => {
    createMock.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify({ suggestions: ["a", "b", "c"] }) }],
    });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const { POST } = await import("@/app/api/card-message/route");
    await POST(makeReq(validBody));
    const calls = logSpy.mock.calls.flat().join(" ");
    expect(calls).toContain("card_message");
    expect(calls).toContain("anniversary");
    expect(calls).toContain("partner");
    expect(calls).toContain("en");
    expect(calls).not.toContain("9.9.9.9");
    expect(calls).not.toContain("Timeless Romance");
    logSpy.mockRestore();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/card-message-route.test.ts`

Expected: FAIL — `app/api/card-message/route` does not exist.

- [ ] **Step 3: Write the route handler**

Create `app/api/card-message/route.ts`:

```ts
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { cardMessageRequestSchema } from "@/schemas/card-message";
import { buildCardMessagePrompt } from "@/lib/card-message-prompt";
import { rateLimit, ipFromRequest } from "@/lib/rate-limit";

const MAX_PER_HOUR = 20;
const WINDOW_MS = 60 * 60 * 1000;
const TIMEOUT_MS = 8000;
const MODEL = "claude-haiku-4-5-20251001";
const MAX_TOKENS = 600;
const MAX_SUGGESTION_CHARS = 200;

export async function POST(req: Request): Promise<Response> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("[card-message] ANTHROPIC_API_KEY missing");
    return NextResponse.json({ error: "upstream" }, { status: 502 });
  }

  const ip = ipFromRequest(req);
  const rl = rateLimit(`card-message:${ip}`, { max: MAX_PER_HOUR, windowMs: WINDOW_MS });
  if (!rl.ok) {
    return NextResponse.json({ error: "rate_limit" }, { status: 429 });
  }

  const json = await req.json().catch(() => null);
  const parsed = cardMessageRequestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const { system, user } = buildCardMessagePrompt(parsed.data);
  const client = new Anthropic({ apiKey });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let raw: string;
  try {
    const response = await client.messages.create(
      {
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system,
        messages: [{ role: "user", content: user }],
      },
      { signal: controller.signal },
    );
    const block = response.content.find((b: { type: string }) => b.type === "text") as
      | { type: "text"; text: string }
      | undefined;
    if (!block) {
      console.error("[card-message] no text block in response");
      return NextResponse.json({ error: "upstream" }, { status: 502 });
    }
    raw = block.text;
  } catch (err) {
    console.error("[card-message] sdk error", err);
    return NextResponse.json({ error: "upstream" }, { status: 502 });
  } finally {
    clearTimeout(timer);
  }

  let suggestions: string[];
  try {
    const obj = JSON.parse(raw);
    if (!Array.isArray(obj.suggestions) || obj.suggestions.length !== 3) {
      throw new Error("wrong shape");
    }
    suggestions = obj.suggestions.map((s: unknown) => {
      if (typeof s !== "string") throw new Error("non-string suggestion");
      return s.trim().slice(0, MAX_SUGGESTION_CHARS);
    });
  } catch (err) {
    console.error("[card-message] parse error", err, "raw=", raw);
    return NextResponse.json({ error: "upstream" }, { status: 502 });
  }

  console.log(
    JSON.stringify({
      event: "card_message",
      occasion: parsed.data.occasion,
      relation: parsed.data.relation,
      locale: parsed.data.locale,
      ok: true,
      ts: Date.now(),
    }),
  );

  return NextResponse.json({ suggestions }, { status: 200 });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/card-message-route.test.ts`

Expected: 10 tests pass.

- [ ] **Step 5: Commit**

```bash
git add app/api/card-message/route.ts tests/unit/card-message-route.test.ts
git commit -m "feat(card-message): add POST /api/card-message handler"
```

---

## Task 6: Skeleton component

**Files:**
- Create: `components/product/CardMessageSkeleton.tsx`

This component is purely visual. No tests for the skeleton itself — its presence is asserted in the `CardMessageAssist` tests of Task 7.

- [ ] **Step 1: Write the component**

Create `components/product/CardMessageSkeleton.tsx`:

```tsx
export function CardMessageSkeleton() {
  return (
    <div
      className="flex flex-col gap-2"
      aria-live="polite"
      aria-busy="true"
      data-testid="card-message-skeleton"
    >
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="rounded-[var(--radius-product)] border border-ink/10 bg-ink/5 px-4 py-3"
        >
          <div className="h-3 w-3/4 animate-pulse rounded bg-ink/10" />
          <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-ink/10" />
        </div>
      ))}
      <span className="sr-only">Generating suggestions…</span>
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npx tsc --noEmit`

Expected: clean exit (no errors).

- [ ] **Step 3: Commit**

```bash
git add components/product/CardMessageSkeleton.tsx
git commit -m "feat(card-message): add loading skeleton"
```

---

## Task 7: Assist panel component

**Files:**
- Create: `components/product/CardMessageAssist.tsx`
- Test: `tests/unit/CardMessageAssist.test.tsx`

This component receives all data via props (it does not call `useTranslations` directly — keeps testing simple and avoids needing a `next-intl` provider in unit tests). The parent (`CardMessage`) supplies localized strings.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/CardMessageAssist.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CardMessageAssist } from "@/components/product/CardMessageAssist";

const COPY = {
  title: "Who's it for?",
  generate: "Generate 3 ideas",
  regenerate: "Generate 3 more",
  retry: "Retry",
  close: "Close",
  errorGeneric: "We couldn't generate right now.",
  errorRateLimit: "Too many requests. Try again in an hour.",
};

const RELATIONS = [
  { key: "partner", label: "Partner" },
  { key: "mother", label: "Mom" },
] as const;

const baseProps = {
  productTitle: "Timeless Romance",
  occasion: "anniversary" as const,
  locale: "en" as const,
  relations: RELATIONS as unknown as { key: string; label: string }[],
  copy: COPY,
  onPick: vi.fn(),
  onClose: vi.fn(),
};

beforeEach(() => {
  baseProps.onPick = vi.fn();
  baseProps.onClose = vi.fn();
});
afterEach(() => {
  vi.restoreAllMocks();
});

function mockFetch(impl: (url: string, init?: RequestInit) => Promise<Response>) {
  vi.stubGlobal("fetch", vi.fn(impl));
}

describe("CardMessageAssist", () => {
  it("renders relation chips and disabled generate button initially", () => {
    render(<CardMessageAssist {...baseProps} />);
    expect(screen.getByRole("button", { name: /partner/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /mom/i })).toBeInTheDocument();
    const gen = screen.getByRole("button", { name: COPY.generate });
    expect(gen).toBeDisabled();
  });

  it("enables generate button after selecting a chip", async () => {
    const user = userEvent.setup();
    render(<CardMessageAssist {...baseProps} />);
    await user.click(screen.getByRole("button", { name: /partner/i }));
    expect(screen.getByRole("button", { name: COPY.generate })).toBeEnabled();
  });

  it("shows skeleton while fetching", async () => {
    mockFetch(
      () =>
        new Promise((resolve) => {
          setTimeout(
            () =>
              resolve(
                new Response(JSON.stringify({ suggestions: ["a", "b", "c"] }), { status: 200 }),
              ),
            10,
          );
        }),
    );
    const user = userEvent.setup();
    render(<CardMessageAssist {...baseProps} />);
    await user.click(screen.getByRole("button", { name: /partner/i }));
    await user.click(screen.getByRole("button", { name: COPY.generate }));
    expect(await screen.findByTestId("card-message-skeleton")).toBeInTheDocument();
  });

  it("renders three suggestion cards on success and onPick is called with the right text", async () => {
    mockFetch(
      async () =>
        new Response(JSON.stringify({ suggestions: ["alpha", "beta", "gamma"] }), { status: 200 }),
    );
    const user = userEvent.setup();
    render(<CardMessageAssist {...baseProps} />);
    await user.click(screen.getByRole("button", { name: /partner/i }));
    await user.click(screen.getByRole("button", { name: COPY.generate }));
    const card = await screen.findByRole("button", { name: /alpha/i });
    await user.click(card);
    expect(baseProps.onPick).toHaveBeenCalledWith("alpha");
  });

  it("shows rate-limit copy on 429", async () => {
    mockFetch(async () => new Response(JSON.stringify({ error: "rate_limit" }), { status: 429 }));
    const user = userEvent.setup();
    render(<CardMessageAssist {...baseProps} />);
    await user.click(screen.getByRole("button", { name: /partner/i }));
    await user.click(screen.getByRole("button", { name: COPY.generate }));
    expect(await screen.findByText(COPY.errorRateLimit)).toBeInTheDocument();
  });

  it("shows generic error on 502 with retry button", async () => {
    mockFetch(async () => new Response(JSON.stringify({ error: "upstream" }), { status: 502 }));
    const user = userEvent.setup();
    render(<CardMessageAssist {...baseProps} />);
    await user.click(screen.getByRole("button", { name: /partner/i }));
    await user.click(screen.getByRole("button", { name: COPY.generate }));
    expect(await screen.findByText(COPY.errorGeneric)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: COPY.retry })).toBeInTheDocument();
  });

  it("retry reuses the previously selected relation", async () => {
    let calls = 0;
    const captured: string[] = [];
    mockFetch(async (_url, init) => {
      calls++;
      const body = JSON.parse(String(init?.body));
      captured.push(body.relation);
      if (calls === 1) return new Response(JSON.stringify({ error: "upstream" }), { status: 502 });
      return new Response(JSON.stringify({ suggestions: ["x", "y", "z"] }), { status: 200 });
    });
    const user = userEvent.setup();
    render(<CardMessageAssist {...baseProps} />);
    await user.click(screen.getByRole("button", { name: /mom/i }));
    await user.click(screen.getByRole("button", { name: COPY.generate }));
    await screen.findByText(COPY.errorGeneric);
    await user.click(screen.getByRole("button", { name: COPY.retry }));
    await screen.findByRole("button", { name: /^x$/i });
    expect(captured).toEqual(["mother", "mother"]);
  });

  it("close button calls onClose", async () => {
    const user = userEvent.setup();
    render(<CardMessageAssist {...baseProps} />);
    await user.click(screen.getByRole("button", { name: COPY.close }));
    expect(baseProps.onClose).toHaveBeenCalled();
  });

  it("regenerate calls fetch a second time after success", async () => {
    mockFetch(
      async () =>
        new Response(JSON.stringify({ suggestions: ["a", "b", "c"] }), { status: 200 }),
    );
    const user = userEvent.setup();
    render(<CardMessageAssist {...baseProps} />);
    await user.click(screen.getByRole("button", { name: /partner/i }));
    await user.click(screen.getByRole("button", { name: COPY.generate }));
    await screen.findByRole("button", { name: /^a$/ });
    const regen = screen.getByRole("button", { name: COPY.regenerate });
    await user.click(regen);
    await waitFor(() => {
      expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/CardMessageAssist.test.tsx`

Expected: FAIL — module not found.

- [ ] **Step 3: Write the component**

Create `components/product/CardMessageAssist.tsx`:

```tsx
"use client";
import { useCallback, useState } from "react";
import type { Locale } from "@/types/locale";
import type { Occasion, Relation } from "@/schemas/card-message";
import { CardMessageSkeleton } from "./CardMessageSkeleton";

export type AssistCopy = {
  title: string;
  generate: string;
  regenerate: string;
  retry: string;
  close: string;
  errorGeneric: string;
  errorRateLimit: string;
};

type Props = {
  productTitle: string;
  occasion: Occasion;
  locale: Locale;
  relations: { key: string; label: string }[];
  copy: AssistCopy;
  onPick: (text: string) => void;
  onClose: () => void;
};

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "success"; suggestions: string[] }
  | { kind: "error"; reason: "rate_limit" | "generic" };

export function CardMessageAssist({
  productTitle,
  occasion,
  locale,
  relations,
  copy,
  onPick,
  onClose,
}: Props) {
  const [relation, setRelation] = useState<Relation | null>(null);
  const [state, setState] = useState<State>({ kind: "idle" });

  const generate = useCallback(
    async (rel: Relation) => {
      setState({ kind: "loading" });
      try {
        const res = await fetch("/api/card-message", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ productTitle, occasion, relation: rel, locale }),
        });
        if (res.status === 429) {
          setState({ kind: "error", reason: "rate_limit" });
          return;
        }
        if (!res.ok) {
          setState({ kind: "error", reason: "generic" });
          return;
        }
        const json = (await res.json()) as { suggestions: string[] };
        if (!Array.isArray(json.suggestions) || json.suggestions.length !== 3) {
          setState({ kind: "error", reason: "generic" });
          return;
        }
        setState({ kind: "success", suggestions: json.suggestions });
      } catch {
        setState({ kind: "error", reason: "generic" });
      }
    },
    [productTitle, occasion, locale],
  );

  const handleGenerate = useCallback(() => {
    if (relation) generate(relation);
  }, [relation, generate]);

  const handlePick = useCallback(
    (text: string) => {
      onPick(text);
    },
    [onPick],
  );

  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius-product)] border border-ink/10 bg-ink/5 p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="font-mono text-[10px] uppercase tracking-wider text-mute-500">{copy.title}</p>
        <button
          type="button"
          onClick={onClose}
          aria-label={copy.close}
          className="font-mono text-xs text-mute-500 hover:text-ink"
        >
          {copy.close}
        </button>
      </div>

      {state.kind === "idle" || state.kind === "error" ? (
        <div className="flex flex-wrap gap-2">
          {relations.map((r) => (
            <button
              key={r.key}
              type="button"
              aria-pressed={relation === r.key}
              onClick={() => setRelation(r.key as Relation)}
              className={`rounded-full border px-3 py-1.5 font-sans text-sm transition-colors ${
                relation === r.key
                  ? "border-ink bg-ink text-bone"
                  : "border-ink/20 text-ink hover:border-ink/40"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      ) : null}

      {state.kind === "idle" && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={!relation}
            className="rounded-[var(--radius-product)] bg-ink px-4 py-2 font-sans text-sm text-bone disabled:opacity-40"
          >
            {copy.generate}
          </button>
        </div>
      )}

      {state.kind === "loading" && <CardMessageSkeleton />}

      {state.kind === "success" && (
        <>
          <div className="flex flex-col gap-2">
            {state.suggestions.map((s, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handlePick(s)}
                aria-label={`${copy.generate}: ${s}`}
                className="rounded-[var(--radius-product)] border border-ink/15 px-4 py-3 text-left font-sans text-base leading-relaxed text-ink hover:border-ink/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rouge"
              >
                {s}
              </button>
            ))}
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleGenerate}
              className="font-mono text-xs text-mute-500 hover:text-ink"
            >
              {copy.regenerate}
            </button>
          </div>
        </>
      )}

      {state.kind === "error" && (
        <div role="alert" aria-live="assertive" className="flex flex-col gap-2">
          <p className="font-sans text-sm text-ink">
            {state.reason === "rate_limit" ? copy.errorRateLimit : copy.errorGeneric}
          </p>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={!relation}
              className="rounded-[var(--radius-product)] bg-ink px-4 py-2 font-sans text-sm text-bone disabled:opacity-40"
            >
              {copy.retry}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/CardMessageAssist.test.tsx`

Expected: 9 tests pass.

- [ ] **Step 5: Commit**

```bash
git add components/product/CardMessageAssist.tsx tests/unit/CardMessageAssist.test.tsx
git commit -m "feat(card-message): add assist panel component"
```

---

## Task 8: i18n keys

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/es.json`

These keys are read by `CardMessage` (Task 9) and passed down to `CardMessageAssist` as the `copy` prop. Place them under a new `card_message_assist` namespace at the same level as the existing `card_message` key (do not nest, to avoid breaking the existing flat lookup).

- [ ] **Step 1: Find the right insertion point**

Run: `grep -n '"card_message"' messages/en.json messages/es.json`

You'll see something like `"card_message": "Card message"` somewhere — note the surrounding object structure for both files.

- [ ] **Step 2: Add keys to en.json**

Add these keys to `messages/en.json` under the same parent object that contains `card_message` (the checkout namespace, based on existing usage):

```json
"card_message_assist": {
  "trigger": "Suggest message",
  "trigger_sympathy": "Suggest message",
  "title": "Who's it for?",
  "generate": "Generate 3 ideas",
  "generate_sympathy": "Generate 3 messages",
  "regenerate": "Generate 3 more",
  "retry": "Retry",
  "close": "Close",
  "error_generic": "We couldn't generate right now. In the meantime, write your own.",
  "error_rate_limit": "Too many requests. Please try again in an hour."
}
```

- [ ] **Step 3: Add keys to es.json**

Same shape in `messages/es.json`:

```json
"card_message_assist": {
  "trigger": "Sugerir mensaje",
  "trigger_sympathy": "Sugerir mensaje",
  "title": "¿Para quién es?",
  "generate": "Generar 3 ideas",
  "generate_sympathy": "Generar 3 mensajes",
  "regenerate": "Generar otras 3",
  "retry": "Reintentar",
  "close": "Cerrar",
  "error_generic": "No pudimos generar ahora. Mientras tanto, escribe el tuyo.",
  "error_rate_limit": "Pediste muchas en poco tiempo. Vuelve a intentarlo en una hora."
}
```

- [ ] **Step 4: Verify JSON is valid**

Run: `node -e "JSON.parse(require('fs').readFileSync('messages/en.json'))" && node -e "JSON.parse(require('fs').readFileSync('messages/es.json'))"`

Expected: no errors.

- [ ] **Step 5: Run typecheck**

Run: `npx tsc --noEmit`

Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add messages/en.json messages/es.json
git commit -m "feat(card-message): i18n keys for assist panel"
```

---

## Task 9: Refactor CardMessage to host the assist panel

**Files:**
- Modify: `components/product/CardMessage.tsx`
- Test: `tests/unit/CardMessage.test.tsx`

This is the integration point: the existing textarea stays exactly as-is; we add a trigger button and conditionally render `CardMessageAssist`. The `productTitle` and `occasions` arrive as new props (wired in Task 10).

- [ ] **Step 1: Write the failing test**

Create `tests/unit/CardMessage.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CardMessage } from "@/components/product/CardMessage";

vi.mock("next-intl", () => ({
  useTranslations: () => (k: string) => k,
}));

const baseProps = {
  locale: "en" as const,
  value: "",
  onChange: vi.fn(),
  productTitle: "Timeless Romance",
  occasions: ["anniversary"] as ("anniversary" | "sympathy" | "birthday")[],
};

describe("CardMessage", () => {
  it("renders the textarea and counter", () => {
    render(<CardMessage {...baseProps} />);
    expect(screen.getByRole("textbox")).toBeInTheDocument();
    expect(screen.getByText(/0\/200/)).toBeInTheDocument();
  });

  it("calls onChange when the user types", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<CardMessage {...baseProps} onChange={onChange} />);
    await user.type(screen.getByRole("textbox"), "hi");
    expect(onChange).toHaveBeenCalled();
  });

  it("shows the assist trigger by default", () => {
    render(<CardMessage {...baseProps} />);
    expect(screen.getByRole("button", { name: /trigger/i })).toBeInTheDocument();
  });

  it("opens the assist panel on trigger click", async () => {
    const user = userEvent.setup();
    render(<CardMessage {...baseProps} />);
    await user.click(screen.getByRole("button", { name: /trigger/i }));
    expect(screen.getByRole("button", { name: /partner|pareja|mom/i })).toBeInTheDocument();
  });

  it("uses sympathy chip set when occasions includes sympathy", async () => {
    const user = userEvent.setup();
    render(<CardMessage {...baseProps} occasions={["sympathy"]} />);
    await user.click(screen.getByRole("button", { name: /trigger/i }));
    expect(screen.getByRole("button", { name: /coworker|compañerx/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^mom$|^papá$|^mamá$/i })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/CardMessage.test.tsx`

Expected: FAIL — props mismatch (no productTitle/occasions yet).

- [ ] **Step 3: Refactor CardMessage**

Replace `components/product/CardMessage.tsx` entirely with:

```tsx
"use client";
import { memo, useState } from "react";
import { useTranslations } from "next-intl";
import type { Locale } from "@/types/locale";
import type { Occasion } from "@/schemas/card-message";
import { CardMessageAssist } from "./CardMessageAssist";
import { getRelations } from "@/lib/card-message-relations";

type Props = {
  locale: Locale;
  value: string;
  onChange: (next: string) => void;
  maxLength?: number;
  productTitle: string;
  occasions: string[];
};

function CardMessageImpl({
  locale,
  value,
  onChange,
  maxLength = 200,
  productTitle,
  occasions,
}: Props) {
  const t = useTranslations("card_message_assist");
  const [open, setOpen] = useState(false);

  const isSympathy = occasions.includes("sympathy");
  const mode = isSympathy ? "sympathy" : "default";
  const occasion = (isSympathy ? "sympathy" : (occasions[0] as Occasion | undefined)) ?? "just-because";
  const relations = getRelations(mode, locale);

  const copy = {
    title: t("title"),
    generate: isSympathy ? t("generate_sympathy") : t("generate"),
    regenerate: t("regenerate"),
    retry: t("retry"),
    close: t("close"),
    errorGeneric: t("error_generic"),
    errorRateLimit: t("error_rate_limit"),
  };

  const triggerLabel = isSympathy ? t("trigger_sympathy") : t("trigger");
  const triggerPrefix = isSympathy ? "" : "✨ ";

  return (
    <div className="flex flex-col gap-2">
      <p className="font-mono text-[10px] uppercase tracking-wider text-mute-500">
        {locale === "es" ? "Mensaje de tarjeta (opcional)" : "Card message (optional)"}
      </p>

      {open && (
        <CardMessageAssist
          productTitle={productTitle}
          occasion={occasion as Occasion}
          locale={locale}
          relations={relations}
          copy={copy}
          onPick={(text) => {
            onChange(text.slice(0, maxLength));
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
        />
      )}

      <textarea
        value={value}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        placeholder={locale === "es" ? "Para alguien especial…" : "For someone special…"}
        className="w-full resize-none rounded-[var(--radius-product)] border border-ink/15 bg-transparent px-4 py-3 font-sans text-base leading-relaxed text-ink placeholder:text-mute-400 focus-visible:border-ink/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rouge"
      />

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="font-mono text-xs text-mute-500 hover:text-ink"
        >
          {triggerPrefix}
          {triggerLabel}
        </button>
        <p className="font-mono text-xs text-mute-500">
          {value.length}/{maxLength}
        </p>
      </div>
    </div>
  );
}

export const CardMessage = memo(CardMessageImpl);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/CardMessage.test.tsx`

Expected: 5 tests pass.

- [ ] **Step 5: Run all tests to confirm nothing else broke**

Run: `npm test`

Expected: all previous tests + new ones pass.

- [ ] **Step 6: Commit**

```bash
git add components/product/CardMessage.tsx tests/unit/CardMessage.test.tsx
git commit -m "feat(card-message): wire assist panel into CardMessage"
```

---

## Task 10: Wire new props through PdpConfigurator

**Files:**
- Modify: `components/product/PdpConfigurator.tsx`

The current call site at `components/product/PdpConfigurator.tsx:66` is:

```tsx
<CardMessage locale={locale} value={message} onChange={setMessage} />
```

It needs `productTitle` and `occasions` from the `product` prop.

- [ ] **Step 1: Update the call**

In `components/product/PdpConfigurator.tsx`, replace:

```tsx
<CardMessage locale={locale} value={message} onChange={setMessage} />
```

with:

```tsx
<CardMessage
  locale={locale}
  value={message}
  onChange={setMessage}
  productTitle={product.title[locale]}
  occasions={product.occasions}
/>
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`

Expected: clean.

- [ ] **Step 3: Run tests**

Run: `npm test`

Expected: all pass.

- [ ] **Step 4: Build**

Run: `npm run build`

Expected: success.

- [ ] **Step 5: Commit**

```bash
git add components/product/PdpConfigurator.tsx
git commit -m "feat(card-message): pass productTitle + occasions from PDP"
```

---

## Task 11: E2E test with mocked route

**Files:**
- Create: `tests/e2e/card-message-ai.spec.ts`

Playwright `route.fulfill` mocks the API so the test runs offline and deterministically. The PDP route is dynamic, so use a slug we know exists in the catalog.

- [ ] **Step 1: Identify a non-sympathy slug and a sympathy slug**

Run: `grep -E '"all-my-love"|"lilies-for-lottie"' data/products.ts | head`

Expected: confirms both slugs exist. (These are stable from the recent catalog expansion.)

- [ ] **Step 2: Write the e2e spec**

Create `tests/e2e/card-message-ai.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

test.describe("PDP card-message AI assistant", () => {
  test("happy path: pick relation, generate, select suggestion", async ({ page }) => {
    await page.route("**/api/card-message", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          suggestions: [
            "Five years and counting — every one of them, yes.",
            "To us, again. Same time next year.",
            "Pajamas, late toast, our usual chaos. I love you.",
          ],
        }),
      });
    });

    await page.goto("/en/product/all-my-love");
    await page.getByRole("button", { name: /suggest message/i }).click();
    await page.getByRole("button", { name: /^partner$/i }).click();
    await page.getByRole("button", { name: /generate 3 ideas/i }).click();

    const firstCard = page.getByRole("button", { name: /five years and counting/i });
    await expect(firstCard).toBeVisible();
    await firstCard.click();

    const textarea = page.getByRole("textbox");
    await expect(textarea).toHaveValue(/five years and counting/i);
    await expect(page.getByRole("button", { name: /generate 3 ideas/i })).not.toBeVisible();
  });

  test("sympathy product shows sympathy chip set", async ({ page }) => {
    await page.goto("/en/product/lilies-for-lottie");
    await page.getByRole("button", { name: /suggest message/i }).click();
    await expect(page.getByRole("button", { name: /coworker/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^mom$/i })).not.toBeVisible();
  });

  test("rate-limit error shows specific copy", async ({ page }) => {
    await page.route("**/api/card-message", async (route) => {
      await route.fulfill({
        status: 429,
        contentType: "application/json",
        body: JSON.stringify({ error: "rate_limit" }),
      });
    });

    await page.goto("/en/product/all-my-love");
    await page.getByRole("button", { name: /suggest message/i }).click();
    await page.getByRole("button", { name: /^partner$/i }).click();
    await page.getByRole("button", { name: /generate 3 ideas/i }).click();
    await expect(page.getByText(/too many requests/i)).toBeVisible();
  });
});
```

- [ ] **Step 3: Run e2e**

Run: `npm run e2e -- tests/e2e/card-message-ai.spec.ts`

Expected: 3 tests pass.

If a test fails due to a `next-intl` provider needing the locale at root, debug by inspecting the page; the fix is usually to ensure `getTranslations` is called server-side before the component mounts, which it already is via the existing PDP layout.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/card-message-ai.spec.ts
git commit -m "test(card-message): e2e for assist flow + sympathy + rate-limit"
```

---

## Task 12: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Full typecheck**

Run: `npx tsc --noEmit`

Expected: clean.

- [ ] **Step 2: Full unit suite**

Run: `npm test`

Expected: all tests pass — original 68 + new ones (~36).

- [ ] **Step 3: Production build**

Run: `npm run build`

Expected: build succeeds. Verify `/api/card-message` appears as a `ƒ` (Dynamic) route in the output.

- [ ] **Step 4: Bundle check (no SDK leak to client)**

Run: `grep -rn "@anthropic-ai" components/ app/\[locale\]/`

Expected: no matches. The SDK is only imported by `app/api/card-message/route.ts`.

- [ ] **Step 5: Manual smoke (requires API key)**

Add a real `ANTHROPIC_API_KEY` to `.env.local`. Start dev server (`npm run dev`), open `/en/product/all-my-love`, click "Suggest message" → "Partner" → "Generate 3 ideas". Verify three coherent, on-voice English suggestions appear within ~2 s. Pick one and confirm it loads into the textarea. Repeat once on `/es/product/all-my-love` and once on `/en/product/lilies-for-lottie` (sympathy mode).

If the model output ever contains a banned word (hermoso/perfecto/etc.), file a follow-up issue noting the prompt regenerated successfully but a banned word slipped through. Out of scope for this plan.

- [ ] **Step 6: Telemetry sanity check**

In dev with one real generation, confirm a single line of the form `{"event":"card_message","occasion":"anniversary","relation":"partner","locale":"en","ok":true,"ts":...}` appears in the dev server stdout, with no IP or message content present.

---

## Self-review notes

- Spec coverage: each spec section maps to tasks 1–11. §1 scope → covered by file map. §2 architecture → matches file map (note: spec mentioned `lib/card-message/*.ts` subfolder; plan uses flat `lib/card-message-*.ts` to match repo convention discovered during planning; no functional difference). §3 contract → Task 5. §3 prompt → Task 4. §4 UI all states → Tasks 6, 7, 9. §4 sympathy mode → Tasks 7, 9. §5 testing strategy → Tasks 2, 3, 4, 5, 7, 9, 11. §6 risks → mitigations land in Task 5 (timeouts, missing key) and Task 7 (additive panel, error states). §7 delivery plan → Tasks 1–12.
- No placeholders. Every step has the exact code or command.
- Type consistency: `Relation`, `Occasion`, `RelationOption`, `AssistCopy` are defined once and reused. `getRelations(mode, locale)` signature is consistent across Tasks 3, 9.
- Spec's `lib/card-message/types.ts` was folded into `schemas/card-message.ts` (types co-located with the zod schema, the existing repo pattern). Spec's `lib/card-message/rate-limit.ts` was dropped — `lib/rate-limit.ts` already provides the exact functionality with `rateLimit(key, opts)` and `ipFromRequest`. No regression in capability.
