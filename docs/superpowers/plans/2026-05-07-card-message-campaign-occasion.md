# Card Message Campaign-Aware Occasion Picker — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send the right `occasion` to the AI on Mother's Day-tagged products by reading a `?campaign=mothers-day` URL param, and stop conflating "tagged with sympathy" with "is a sympathy product".

**Architecture:** Add `mothers-day` to the schema enum and the prompt's tone list. Thread an optional `campaign` URL param from the Mother's Day landing page → product card → PDP server component → `PdpConfigurator` → `CardMessage`. Replace `CardMessage`'s inferred `isSympathy = occasions.includes("sympathy")` with an explicit `isSympathy` prop derived from `product.category === "sympathy"`. Update the picker to: sympathy → campaign-if-product-carries-it → first occasion fallback.

**Tech Stack:** Next.js (project-customized — read `node_modules/next/dist/docs/` for `searchParams` async usage if anything looks unfamiliar), TypeScript, Zod, Tailwind, Vitest + Testing Library.

**Spec:** [docs/superpowers/specs/2026-05-07-card-message-campaign-occasion-design.md](../specs/2026-05-07-card-message-campaign-occasion-design.md)

---

## Pre-flight

The starting branch is `main`. Before Task 1 begins, the controller (or first implementer) must create a feature branch:

```bash
git checkout -b feat/card-message-campaign-occasion main
```

When committing, always stage specific files by name — never `git add -A` or `git add .`. The repo has historically had unrelated dirty files appear in the worktree from parallel sessions.

## Background reading (do this once before Task 1)

- `schemas/card-message.ts` — current `occasionSchema` enum (6 values).
- `lib/card-message-prompt.ts` — `BASE_SYSTEM` and the per-occasion tone bullet list.
- `app/api/card-message/route.ts` — uses `cardMessageRequestSchema.safeParse` for input validation (so adding `"mothers-day"` to the enum is the only change needed for the API to accept it).
- `components/product/CardMessage.tsx` — the picker is at lines ~31–34.
- `components/product/PdpConfigurator.tsx` — calls `<CardMessage>` at line ~70; already receives `product` and `locale`.
- `app/[locale]/product/[slug]/page.tsx` — uses async `params: Promise<{ locale, slug }>`. Add `searchParams` with the same async pattern.
- `components/product/ProductCard.tsx` — builds `href` at line 21.
- `components/product/ProductGrid.tsx` — passes `product` and `locale` to `<ProductCard>`.
- `components/mothers-day/MothersDayEdit.tsx` — wraps `<ProductGrid>` for the MD landing page.

Test command: `npm test` (Vitest). Single file: `npm test -- tests/unit/<file>`.

The tests' `next-intl` mock returns the translation key as the literal value, so `t("trigger")` → `"trigger"` and `t("trigger_sympathy")` → `"trigger_sympathy"`. Use that fact to disambiguate which trigger label is rendered.

---

### Task 1: Add `mothers-day` to schema, prompt, and API acceptance

Three coupled, tiny changes that go together: schema enum, prompt tone hint, schema test, prompt test. Without all three the AI either rejects `mothers-day` or accepts it without a tone line.

**Files:**
- Modify: `schemas/card-message.ts`
- Modify: `lib/card-message-prompt.ts`
- Modify: `tests/unit/card-message-schema.test.ts`
- Modify: `tests/unit/card-message-prompt.test.ts`

- [ ] **Step 1: Write the failing schema test**

Open `tests/unit/card-message-schema.test.ts` and add a new test inside the existing `describe(...)` (or wherever `occasionSchema` is asserted; if there's no existing describe block for the enum, add one). Append:

```ts
import { occasionSchema } from "@/schemas/card-message";

describe("occasionSchema", () => {
  it("accepts mothers-day", () => {
    expect(occasionSchema.safeParse("mothers-day").success).toBe(true);
  });
});
```

If `occasionSchema` is already imported and there's already a similar describe block, add only the `it(...)` case inside the existing block. The point is a new test that fails today.

- [ ] **Step 2: Run the failing schema test**

Run: `npm test -- tests/unit/card-message-schema.test.ts`
Expected: FAIL on the new "accepts mothers-day" test (and only that one).

- [ ] **Step 3: Add `mothers-day` to the schema enum**

Open `schemas/card-message.ts`. The current `occasionSchema` is:

```ts
export const occasionSchema = z.enum([
  "birthday",
  "anniversary",
  "sympathy",
  "romance",
  "congrats",
  "just-because",
]);
```

Replace with:

```ts
export const occasionSchema = z.enum([
  "birthday",
  "anniversary",
  "sympathy",
  "romance",
  "congrats",
  "just-because",
  "mothers-day",
]);
```

- [ ] **Step 4: Run the schema test, confirm pass**

Run: `npm test -- tests/unit/card-message-schema.test.ts`
Expected: All tests pass.

- [ ] **Step 5: Write the failing prompt test**

Open `tests/unit/card-message-prompt.test.ts`. The existing test at lines 36–41 reads:

```ts
it("system prompt includes occasion-specific tone hints", () => {
  const { system } = buildCardMessagePrompt(baseInput);
  expect(system.toLowerCase()).toContain("anniversary");
  expect(system.toLowerCase()).toContain("birthday");
  expect(system.toLowerCase()).toContain("sympathy");
});
```

Replace with the extended version (adds `mothers-day` and a more specific assertion for the new line):

```ts
it("system prompt includes occasion-specific tone hints", () => {
  const { system } = buildCardMessagePrompt(baseInput);
  expect(system.toLowerCase()).toContain("anniversary");
  expect(system.toLowerCase()).toContain("birthday");
  expect(system.toLowerCase()).toContain("sympathy");
  expect(system.toLowerCase()).toContain("mothers-day");
});

it("system prompt includes the mothers-day tone line", () => {
  const { system } = buildCardMessagePrompt(baseInput);
  expect(system.toLowerCase()).toMatch(/mothers-day → mother.*gratitude.*unseen labor/i);
});
```

- [ ] **Step 6: Run the failing prompt test**

Run: `npm test -- tests/unit/card-message-prompt.test.ts`
Expected: FAIL on the two updated/new assertions.

- [ ] **Step 7: Add the tone line to the prompt**

Open `lib/card-message-prompt.ts`. The current tone block in `BASE_SYSTEM` ends with:

```
- congrats → pride, milestone, "you did it"
- sympathy → dignity, no clichés
```

Add one line after `sympathy`:

```
- congrats → pride, milestone, "you did it"
- sympathy → dignity, no clichés
- mothers-day → mother, gratitude for the unseen labor, the small rituals she made into love
```

- [ ] **Step 8: Run the prompt tests, confirm pass**

Run: `npm test -- tests/unit/card-message-prompt.test.ts`
Expected: All tests pass.

- [ ] **Step 9: Run the full suite for safety**

Run: `npm test`
Expected: Whole suite passes. The route test (`tests/unit/card-message-route.test.ts`) automatically inherits the wider enum because it goes through `safeParse`.

- [ ] **Step 10: Commit**

```bash
git add schemas/card-message.ts lib/card-message-prompt.ts \
        tests/unit/card-message-schema.test.ts tests/unit/card-message-prompt.test.ts
git commit -m "feat(card-message): add mothers-day occasion to schema and prompt"
```

---

### Task 2: `CardMessage` props refactor + `PdpConfigurator` wiring (one commit)

The biggest task. Replace inferred sympathy detection with an explicit prop. Add `campaign?: Occasion`. Implement the new picker. Update the only production call site (`PdpConfigurator`) in the same commit so the codebase never lands in a state where `CardMessage` requires `isSympathy` but its caller doesn't pass it.

**Files:**
- Modify: `components/product/CardMessage.tsx`
- Modify: `components/product/PdpConfigurator.tsx`
- Modify: `tests/unit/CardMessage.test.tsx`

- [ ] **Step 1: Write the failing tests**

Open `tests/unit/CardMessage.test.tsx`. The current `baseProps` is:

```ts
const baseProps = {
  locale: "en" as const,
  value: "",
  onChange: vi.fn(),
  productTitle: "Timeless Romance",
  occasions: ["anniversary"] as ("anniversary" | "sympathy" | "birthday")[],
};
```

Replace it with the wider type and append the four new tests below. Place the new tests after the existing "uses sympathy chip set when occasions includes sympathy" test (which itself needs updating — see notes inside the file to use the new prop). The full updated test file should look like this (replace the entire file contents):

```tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CardMessage } from "@/components/product/CardMessage";

vi.mock("next-intl", () => ({
  useTranslations: () => (k: string) => k,
}));

afterEach(() => {
  vi.restoreAllMocks();
});

const baseProps = {
  locale: "en" as const,
  value: "",
  onChange: vi.fn(),
  productTitle: "Timeless Romance",
  occasions: ["anniversary"] as string[],
  isSympathy: false,
};

function mockFetchCapture(): { captured: { body?: Record<string, unknown> } } {
  const captured: { body?: Record<string, unknown> } = {};
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init?: RequestInit) => {
      captured.body = JSON.parse(String(init?.body));
      return new Response(
        JSON.stringify({ suggestions: ["a", "b", "c"] }),
        { status: 200 },
      );
    }),
  );
  return { captured };
}

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
    expect(screen.getAllByRole("button", { name: /partner|pareja|mom/i })[0]).toBeInTheDocument();
  });

  it("uses sympathy chip set and bare label when isSympathy prop is true", async () => {
    const user = userEvent.setup();
    render(<CardMessage {...baseProps} isSympathy occasions={["sympathy"]} />);
    expect(screen.getByRole("button", { name: "trigger_sympathy" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "trigger_sympathy" }));
    expect(screen.getByRole("button", { name: /coworker|compañerx/i })).toBeInTheDocument();
  });

  it("uses default trigger label when occasions includes sympathy but isSympathy prop is false", () => {
    render(
      <CardMessage
        {...baseProps}
        isSympathy={false}
        occasions={["mothers-day", "anniversary", "sympathy"]}
      />,
    );
    expect(screen.getByRole("button", { name: /^.*trigger$/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "trigger_sympathy" })).not.toBeInTheDocument();
  });

  it("toggles aria-expanded on the trigger when opening and closing the assist panel", async () => {
    const user = userEvent.setup();
    render(<CardMessage {...baseProps} />);
    const trigger = screen.getByRole("button", { name: /trigger/i });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("sends campaign occasion when product carries it", async () => {
    const { captured } = mockFetchCapture();
    const user = userEvent.setup();
    render(
      <CardMessage
        {...baseProps}
        occasions={["birthday", "just-because", "mothers-day"]}
        campaign="mothers-day"
      />,
    );
    await user.click(screen.getByRole("button", { name: /trigger/i }));
    await user.click(screen.getAllByRole("button", { name: /partner|mom/i })[0]);
    await user.click(screen.getByRole("button", { name: /generate/i }));
    await waitFor(() => expect(captured.body).toBeDefined());
    expect(captured.body?.occasion).toBe("mothers-day");
  });

  it("falls back to first occasion when campaign is set but product doesn't carry it", async () => {
    const { captured } = mockFetchCapture();
    const user = userEvent.setup();
    render(
      <CardMessage
        {...baseProps}
        occasions={["birthday", "just-because"]}
        campaign="mothers-day"
      />,
    );
    await user.click(screen.getByRole("button", { name: /trigger/i }));
    await user.click(screen.getAllByRole("button", { name: /partner|mom/i })[0]);
    await user.click(screen.getByRole("button", { name: /generate/i }));
    await waitFor(() => expect(captured.body).toBeDefined());
    expect(captured.body?.occasion).toBe("birthday");
  });

  it("sympathy beats campaign — isSympathy prop wins", async () => {
    const { captured } = mockFetchCapture();
    const user = userEvent.setup();
    render(
      <CardMessage
        {...baseProps}
        isSympathy
        occasions={["sympathy", "mothers-day"]}
        campaign="mothers-day"
      />,
    );
    await user.click(screen.getByRole("button", { name: "trigger_sympathy" }));
    await user.click(screen.getAllByRole("button", { name: /coworker|family|other/i })[0]);
    await user.click(screen.getByRole("button", { name: /generate/i }));
    await waitFor(() => expect(captured.body).toBeDefined());
    expect(captured.body?.occasion).toBe("sympathy");
  });
});
```

Notes for the implementer:
- The `next-intl` mock returns the translation key, so the trigger button's accessible name in tests is exactly `"trigger"` or `"trigger_sympathy"` (no sparkle in test environment because the mock returns just the key — actually in production rendering the prefix `"✨ "` is concatenated, but `triggerPrefix` is `"✨ "` only when `isSympathy` is false; in tests this means default trigger has accessible name `"✨ trigger"` and sympathy has `"trigger_sympathy"`). The `/^.*trigger$/i` regex matches both `"✨ trigger"` and `"trigger"` — the explicit-string assertion `name: "trigger_sympathy"` is the negative path.
- The `getAllByRole("button", { name: /partner|mom/i })[0]` pattern follows the existing test file at line 42.
- `vi.stubGlobal` mirrors the `CardMessageAssist.test.tsx` mock-fetch pattern.

- [ ] **Step 2: Run the test file to confirm new tests fail**

Run: `npm test -- tests/unit/CardMessage.test.tsx`
Expected: The new tests "uses sympathy chip set and bare label when isSympathy prop is true" / "uses default trigger label when occasions includes sympathy but isSympathy prop is false" / the three `captured.body` tests fail because the props don't exist yet and the picker doesn't honor them. The pre-existing tests (textarea, counter, onChange, opens panel, aria-expanded) should still pass.

- [ ] **Step 3: Update `CardMessage.tsx` — props and picker**

Open `components/product/CardMessage.tsx`. Replace the entire `Props` type and `CardMessageImpl` body with:

```tsx
"use client";
import { memo, useState } from "react";
import { useTranslations } from "next-intl";
import type { Locale } from "@/types/locale";
import type { Occasion } from "@/schemas/card-message";
import { CardMessageAssist } from "./CardMessageAssist";
import { getRelations } from "@/lib/card-message-relations";
import { FormField } from "@/components/ui/form/FormField";
import { TextArea } from "@/components/ui/form/TextArea";

type Props = {
  locale: Locale;
  value: string;
  onChange: (next: string) => void;
  maxLength?: number;
  productTitle: string;
  occasions: string[];
  isSympathy: boolean;
  campaign?: Occasion;
};

function CardMessageImpl({
  locale,
  value,
  onChange,
  maxLength = 200,
  productTitle,
  occasions,
  isSympathy,
  campaign,
}: Props) {
  const t = useTranslations("card_message_assist");
  const [open, setOpen] = useState(false);

  const mode = isSympathy ? "sympathy" : "default";
  const occasion: Occasion = isSympathy
    ? "sympathy"
    : campaign && occasions.includes(campaign)
      ? campaign
      : ((occasions[0] as Occasion | undefined) ?? "just-because");

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

  const label = locale === "es" ? "Mensaje de tarjeta (opcional)" : "Card message (optional)";
  const placeholder = locale === "es" ? "Para alguien especial…" : "For someone special…";

  return (
    <div className="flex flex-col gap-2">
      {open && (
        <CardMessageAssist
          productTitle={productTitle}
          occasion={occasion}
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

      <FormField label={label} htmlFor="card-message">
        <TextArea
          id="card-message"
          value={value}
          maxLength={maxLength}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          placeholder={placeholder}
        />
      </FormField>

      <div className="flex flex-col gap-1.5">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className={
            open
              ? "self-start rounded-full border border-ink bg-ink px-3.5 py-1.5 font-sans text-sm text-bone transition-colors hover:bg-ink/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rouge"
              : "self-start rounded-full border border-ink/30 px-3.5 py-1.5 font-sans text-sm text-ink transition-colors hover:border-ink hover:bg-ink/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rouge"
          }
        >
          {triggerPrefix}
          {triggerLabel}
        </button>
        <p className="self-end font-mono text-xs text-mute-500">
          {value.length}/{maxLength}
        </p>
      </div>
    </div>
  );
}

export const CardMessage = memo(CardMessageImpl);
```

What changed:
- `occasions` is now typed as `string[]` (it was already, after Task 2 of the previous branch — no change). The previous narrow type `("anniversary" | "sympathy" | "birthday")[]` was test-only.
- Removed `const isSympathy = occasions.includes("sympathy")` — now an explicit prop.
- Added `campaign?: Occasion` prop.
- New picker logic.
- `Occasion` is imported from `@/schemas/card-message` (not `@/types/locale`).
- Pill JSX (kept exactly as-is from the previous branch).

- [ ] **Step 4: Run the file's tests, confirm all pass**

Run: `npm test -- tests/unit/CardMessage.test.tsx`
Expected: All ten tests pass.

- [ ] **Step 5: Update `PdpConfigurator.tsx` (same commit as the `CardMessage` change)**

`CardMessage` now requires `isSympathy` and accepts `campaign`. `PdpConfigurator` is the right place to compute `isSympathy` because it owns the `product` object. Update it now to keep the codebase compilable.

Open `components/product/PdpConfigurator.tsx`. Make three changes:

1. Add `Occasion` import at the top, alongside the other type imports:
   ```ts
   import type { Occasion } from "@/schemas/card-message";
   ```

2. Replace the `Props` type (currently around lines 12–17):
   ```ts
   type Props = {
     product: Product;
     locale: Locale;
     cutoff: string;
     motionMode: "default" | "sympathy";
     campaign?: Occasion;
   };
   ```

3. Update the function signature and the `<CardMessage>` call. Destructure `campaign`, derive `isSympathy`, pass both:

   ```ts
   function PdpConfiguratorImpl({ product, locale, cutoff, motionMode, campaign }: Props) {
     void motionMode;
     const isSympathy = product.category === "sympathy";
     // …existing useMemo / useState lines unchanged…
   ```

   And lower in the file, replace the `<CardMessage … />` call with:

   ```tsx
   <CardMessage
     locale={locale}
     value={message}
     onChange={setMessage}
     productTitle={product.title[locale]}
     occasions={product.occasions}
     isSympathy={isSympathy}
     campaign={campaign}
   />
   ```

- [ ] **Step 6: Run the full test suite**

Run: `npm test`
Expected: Whole suite passes. The PDP page (`app/[locale]/product/[slug]/page.tsx`) currently calls `<PdpConfigurator>` without a `campaign` prop — that's still fine because `campaign` is optional. Task 3 wires the page to start passing it.

- [ ] **Step 7: Commit**

```bash
git add components/product/CardMessage.tsx components/product/PdpConfigurator.tsx \
        tests/unit/CardMessage.test.tsx
git commit -m "feat(card-message): explicit isSympathy prop + campaign-aware picker

Replace inferred isSympathy=occasions.includes('sympathy') with an
explicit prop derived from product.category at the call site. Add
optional campaign prop; if the product's occasions array carries it
the picker prefers it over occasions[0]. Sympathy still wins.

PdpConfigurator updated in the same commit so the contract stays
compilable end-to-end."
```

---

### Task 3: PDP page — read & validate `?campaign=...`

The product detail page is a server component. Add async `searchParams`. Validate the value against `occasionSchema.options` so junk URLs are silently dropped. Pass the validated value into `<PdpConfigurator>`.

**Files:**
- Modify: `app/[locale]/product/[slug]/page.tsx`

This is a server-component change. The Vitest unit tests don't render this page directly. Validation correctness is exercised by Task 6's manual verification. To keep it testable in isolation, extract the validation into a tiny pure helper.

- [ ] **Step 1: Create the helper file**

Create `lib/campaign-occasion.ts`:

```ts
import type { Occasion } from "@/schemas/card-message";
import { occasionSchema } from "@/schemas/card-message";

const VALID = new Set<string>(occasionSchema.options);

export function parseCampaign(raw: string | string[] | undefined): Occasion | undefined {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return undefined;
  return VALID.has(value) ? (value as Occasion) : undefined;
}
```

- [ ] **Step 2: Write tests for the helper**

Create `tests/unit/campaign-occasion.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseCampaign } from "@/lib/campaign-occasion";

describe("parseCampaign", () => {
  it("returns undefined for undefined input", () => {
    expect(parseCampaign(undefined)).toBeUndefined();
  });

  it("returns undefined for empty string", () => {
    expect(parseCampaign("")).toBeUndefined();
  });

  it("returns the value for a known occasion", () => {
    expect(parseCampaign("mothers-day")).toBe("mothers-day");
    expect(parseCampaign("anniversary")).toBe("anniversary");
  });

  it("returns undefined for unknown values", () => {
    expect(parseCampaign("hacker")).toBeUndefined();
    expect(parseCampaign("MOTHERS-DAY")).toBeUndefined();
  });

  it("takes the first element when given an array", () => {
    expect(parseCampaign(["mothers-day", "birthday"])).toBe("mothers-day");
    expect(parseCampaign(["junk", "anniversary"])).toBeUndefined();
  });
});
```

- [ ] **Step 3: Run helper tests, confirm pass**

Run: `npm test -- tests/unit/campaign-occasion.test.ts`
Expected: All 5 tests pass.

- [ ] **Step 4: Update the PDP page**

Open `app/[locale]/product/[slug]/page.tsx`. Make two changes:

1. Add the import near the top (alongside other `@/lib/...` imports):
   ```ts
   import { parseCampaign } from "@/lib/campaign-occasion";
   ```

2. Update the `default async function ProductPage` signature and add the `searchParams` await. The current signature is:
   ```ts
   export default async function ProductPage({
     params,
   }: {
     params: Promise<{ locale: Locale; slug: string }>;
   }) {
     const { locale, slug } = await params;
   ```

   Replace with:
   ```ts
   export default async function ProductPage({
     params,
     searchParams,
   }: {
     params: Promise<{ locale: Locale; slug: string }>;
     searchParams: Promise<{ campaign?: string | string[] }>;
   }) {
     const { locale, slug } = await params;
     const sp = await searchParams;
     const campaign = parseCampaign(sp.campaign);
   ```

3. Pass `campaign` into `<PdpConfigurator>`. The current call (around line 132):
   ```tsx
   <PdpConfigurator
     product={product}
     locale={locale}
     cutoff={SITE.cutoff24}
     motionMode={isSympathy ? "sympathy" : "default"}
   />
   ```

   Replace with:
   ```tsx
   <PdpConfigurator
     product={product}
     locale={locale}
     cutoff={SITE.cutoff24}
     motionMode={isSympathy ? "sympathy" : "default"}
     campaign={campaign}
   />
   ```

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: Whole suite passes.

- [ ] **Step 6: Commit**

```bash
git add lib/campaign-occasion.ts tests/unit/campaign-occasion.test.ts \
        app/[locale]/product/[slug]/page.tsx
git commit -m "feat(pdp): read and validate ?campaign= search param"
```

---

### Task 4: `ProductCard` and `ProductGrid` — optional `campaign` prop on links

When set, append `?campaign=<value>` to the product link. Default behavior (no query string) when the prop is absent — every existing call site keeps working.

**Files:**
- Modify: `components/product/ProductCard.tsx`
- Modify: `components/product/ProductGrid.tsx`
- Create: `tests/unit/ProductCard.test.tsx` (new file — there's no existing one)

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/ProductCard.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProductCard } from "@/components/product/ProductCard";
import type { Product } from "@/types/product";

vi.mock("next-intl", () => ({
  useTranslations: () => (k: string) => k,
}));

const stub: Product = {
  id: "p1",
  slug: "test-arrangement",
  active: true,
  category: "arrangements",
  title: { en: "Test Arrangement", es: "Arreglo de Prueba" },
  blurb: { en: "x", es: "x" },
  description: { en: "x", es: "x" },
  seo: { title: { en: "x", es: "x" }, description: { en: "x", es: "x" } },
  images: [{ src: "/test.jpg", alt: { en: "alt", es: "alt" } }],
  variants: [{ id: "lush", label: { en: "Lush", es: "Lush" }, priceCents: 9500 }],
  addOns: [],
  occasions: ["mothers-day"],
  tags: [],
} as unknown as Product;

describe("ProductCard", () => {
  it("renders a link without a campaign query string by default", () => {
    render(<ProductCard product={stub} locale="en" />);
    const link = screen.getByTestId("product-card");
    expect(link.getAttribute("href")).toBe("/en/product/test-arrangement");
  });

  it("appends ?campaign=<value> when campaign prop is set", () => {
    render(<ProductCard product={stub} locale="en" campaign="mothers-day" />);
    const link = screen.getByTestId("product-card");
    expect(link.getAttribute("href")).toBe("/en/product/test-arrangement?campaign=mothers-day");
  });

  it("URL-encodes campaign values", () => {
    render(<ProductCard product={stub} locale="en" campaign={"weird value" as never} />);
    const link = screen.getByTestId("product-card");
    expect(link.getAttribute("href")).toBe("/en/product/test-arrangement?campaign=weird%20value");
  });
});
```

Notes:
- The `Product` type cast is loose because `ProductCard` only reads a small subset of fields. If the implementer finds the project's actual `Product` type requires more fields, they should expand the stub — but DO NOT change the production code to accommodate the test stub.
- `getByTestId("product-card")` uses the `data-testid="product-card"` already on the `<Link>` at `ProductCard.tsx:32`.

- [ ] **Step 2: Run the new test file, confirm tests fail**

Run: `npm test -- tests/unit/ProductCard.test.tsx`
Expected: First test passes (default behavior unchanged), the other two FAIL because the `campaign` prop doesn't exist.

- [ ] **Step 3: Update `ProductCard.tsx`**

Open `components/product/ProductCard.tsx`. Update the `Props` type and the href computation:

```tsx
type Props = {
  product: Product;
  locale: Locale;
  reduceMotion?: boolean;
  priority?: boolean;
  campaign?: string;
};

function ProductCardImpl({ product, locale, reduceMotion, priority, campaign }: Props) {
  const t = useTranslations("product");
  const base = `/${locale}/product/${product.slug}`;
  const href = campaign ? `${base}?campaign=${encodeURIComponent(campaign)}` : base;
  // ...rest unchanged
```

- [ ] **Step 4: Update `ProductGrid.tsx` to forward `campaign`**

Open `components/product/ProductGrid.tsx`. Update `Props` and the JSX:

```tsx
type Props = {
  products: Product[];
  locale: Locale;
  motionMode?: "default" | "sympathy";
  className?: string;
  campaign?: string;
};
```

In the function signature destructure `campaign`:
```tsx
function ProductGridImpl({ products, locale, motionMode = "default", className, campaign }: Props) {
```

And on the `<ProductCard>` call (around line 34) add the prop:
```tsx
<ProductCard
  product={p}
  locale={locale}
  reduceMotion={motionMode === "sympathy"}
  priority={i < 3}
  campaign={campaign}
/>
```

- [ ] **Step 5: Run the new tests + full suite**

Run: `npm test`
Expected: Whole suite passes, including the three new ProductCard tests.

- [ ] **Step 6: Commit**

```bash
git add components/product/ProductCard.tsx components/product/ProductGrid.tsx \
        tests/unit/ProductCard.test.tsx
git commit -m "feat(product-card): optional campaign prop appends to href"
```

---

### Task 5: `MothersDayEdit` — pass `campaign="mothers-day"` to the grid

**Files:**
- Modify: `components/mothers-day/MothersDayEdit.tsx`

- [ ] **Step 1: Update `MothersDayEdit.tsx`**

Open `components/mothers-day/MothersDayEdit.tsx`. The current return body is:

```tsx
return (
  <section id="md-edit" className="mx-auto max-w-7xl px-4 py-16">
    <ProductGrid products={products} locale={locale} />
  </section>
);
```

Replace with:

```tsx
return (
  <section id="md-edit" className="mx-auto max-w-7xl px-4 py-16">
    <ProductGrid products={products} locale={locale} campaign="mothers-day" />
  </section>
);
```

- [ ] **Step 2: Run the full suite**

Run: `npm test`
Expected: Whole suite passes.

- [ ] **Step 3: Commit**

```bash
git add components/mothers-day/MothersDayEdit.tsx
git commit -m "feat(mothers-day): tag landing-page product links with campaign=mothers-day"
```

---

### Task 6: Manual browser verification (this step is for the human)

Subagents cannot meaningfully verify a real browser. Stop, report DONE for the implementation tasks, and have the human run through this list. The human reports back with what they see.

Start the dev server:

```bash
npm run dev
```

Then in a browser verify each scenario:

1. **MD landing → MD-tagged product** — Navigate `/en/mothers-day`, click any product. URL on the PDP should include `?campaign=mothers-day`. Click the pill → assist panel → pick a relation → "Generate". Suggestions should be Mother's Day-themed (mention the mother, gratitude, small rituals). Repeat at `/es/mothers-day`.

2. **Direct visit to Angel's Touch (no campaign)** — Navigate `/en/product/angels-touch`. Pill should now show `✨ Need ideas? Suggest a message` (NOT the bare sympathy label). Generate suggestions — they should NOT be sympathy-toned (this product's category is `arrangements`, not `sympathy`). They should match `just-because` tone or whatever is `occasions[0]`.

3. **Direct visit to Angel's Touch with campaign param** — Navigate `/en/product/angels-touch?campaign=mothers-day`. Same pill, and the AI should now generate Mother's Day-themed suggestions.

4. **A real sympathy SKU** — Find a product whose `category === "sympathy"` (look in `data/products.ts` for `category: "sympathy"`). Visit its PDP. Pill should show the bare `Suggest message` label (no sparkle, no "need ideas"). Generate — relation chips should include `coworker` / `close-friend` (sympathy chip set). Suggestions should be sympathy-toned. Confirm `?campaign=mothers-day` does NOT change this — sympathy SKUs always render sympathy.

5. **Junk campaign param** — `/en/product/angels-touch?campaign=hacker`. Should behave identically to scenario 2 (param silently dropped).

6. **Mobile viewport (375 px)** — Pill, counter, and textarea stack cleanly. No horizontal scroll. The pill's longer copy (`✨ Need ideas? Suggest a message`) wraps gracefully or fits on one line.

If any step fails, the human reports which one and the implementer iterates.

---

## Spec coverage check

Mapping each spec section to a task:

- **Defect 1 (wrong AI occasion):** Task 1 (schema + prompt), Task 2 (picker + configurator wiring), Task 3 (validate URL param), Task 4 (link forwards param), Task 5 (MD page sets it).
- **Defect 2 (bogus sympathy detection):** Task 2 (props change in `CardMessage` + `PdpConfigurator` derives from category).
- **Picker logic (sympathy → campaign-if-product-carries → first occasion fallback):** Task 2 Step 3.
- **Validation rules for `?campaign=`:** Task 3 helper + tests.
- **Edge cases:**
  - MD landing → MD-tagged product → covered by Tasks 4+5, verified in Task 6 step 1.
  - MD landing → product without `mothers-day` in occasions → fallback, covered by Task 2 test "falls back to first occasion".
  - Direct visit (no campaign) → fallback, covered by Task 2 default tests + Task 6 step 2.
  - `?campaign=hacker` → silently dropped, covered by Task 3 helper test "returns undefined for unknown values" + Task 6 step 5.
  - Sympathy SKU + `?campaign=mothers-day` → covered by Task 2 test "sympathy beats campaign" + Task 6 step 4.
  - Angel's Touch direct visit (no campaign) → covered by Task 2 test "default trigger label when occasions includes sympathy but isSympathy prop is false" + Task 6 step 2.
  - Subscription form unchanged → no task, that file is untouched.
- **Tests:**
  - Schema test for `mothers-day` → Task 1 Step 1.
  - Prompt test for `mothers-day` tone line → Task 1 Step 5.
  - `CardMessage` tests for `isSympathy` prop and campaign picker → Task 2 Step 1.
  - API route test for `mothers-day` happy path → not added separately. The route's input validation is covered by the schema test in Task 1 (the route uses `safeParse` against the same schema), and the prompt construction is covered by the prompt tests. A duplicate route test is YAGNI.
  - `ProductCard` tests for href with and without campaign → Task 4 Step 1.
- **Manual verification scenarios → Task 6.**

No gaps found. The "extend the existing tone hints test" requirement from the spec is satisfied by Task 1 Step 5 (the existing test is rewritten in place to also assert `mothers-day`).
