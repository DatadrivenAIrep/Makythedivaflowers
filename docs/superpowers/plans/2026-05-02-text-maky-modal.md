# Text Maky Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a bilingual contact modal that lets visitors text Maky's personal mobile (`+1 516-851-2815`) with a pre-filled message based on the page they were on, plus WhatsApp and Call alternatives.

**Architecture:** Floating trigger globally mounted in the locale layout, conditionally visible on commercial routes (PDP, shop, weddings, events, cart, checkout). Pure helpers (`lib/contact-subject.ts`, `lib/text-maky-links.ts`) handle subject lookup and URL building, fully unit-tested. A small React Context lets PDP and shop/category pages register a more specific subject (product name, category). Modal uses Radix Dialog directly so layout can switch between bottom-sheet (mobile) and centered card (desktop). Inline link variant for footer + contact page.

**Tech Stack:** Next.js 16 App Router, next-intl, Radix Dialog (already in use via `Sheet`), framer-motion, Tailwind v4, `@phosphor-icons/react/dist/ssr` for icons (already in repo), Vitest + React Testing Library, Zustand is in repo but **not used here** (Context is enough).

**Spec:** `docs/superpowers/specs/2026-05-02-text-maky-modal-design.md`

**Conventions in this repo (verified):**
- Test files: `tests/unit/**/*.test.ts` and `*.test.tsx` (not `.spec.`).
- Aliases: `@/...` maps to repo root.
- Locale type: `import { type Locale } from "@/types/locale"` → `"en" | "es"`.
- i18n: `import { useTranslations } from "next-intl"` (client) / `getTranslations` (server).
- Buttons: `@/components/ui/Button` with variants `primary | ghost | outline | link`.
- Icons: `@phosphor-icons/react/dist/ssr` (SSR-safe).
- Class merge: `import { cn } from "@/lib/cn"`.

---

## File Structure

**Create:**
- `lib/contact-subject.ts` — pure subject-key resolver
- `lib/text-maky-links.ts` — pure URL builders (`buildSmsHref`, `buildWhatsappHref`, `buildTelHref`)
- `components/contact/ContactContextProvider.tsx` — React Context + `useSetContactSubject` hook
- `components/contact/PdpContactSubject.tsx` — tiny client child for PDP that calls the hook
- `components/contact/ShopCategoryContactSubject.tsx` — same for shop/category
- `components/contact/TextMakyModal.tsx` — the modal (Radix Dialog directly)
- `components/contact/TextMakyTrigger.tsx` — floating fixed button
- `components/contact/TextMakyInlineLink.tsx` — anchor-styled trigger for footer/contact
- `tests/unit/contact-subject.test.ts`
- `tests/unit/text-maky-links.test.ts`
- `tests/unit/text-maky-modal.test.tsx`

**Modify:**
- `data/site.ts` — add `mobile` block
- `messages/en.json` — add `text_modal` namespace
- `messages/es.json` — add `text_modal` namespace
- `app/[locale]/layout.tsx` — wrap children in `<ContactContextProvider>`, mount `<TextMakyTrigger />`
- `app/[locale]/product/[slug]/page.tsx` — render `<PdpContactSubject productName={product.title[locale]} />`
- `app/[locale]/shop/[category]/page.tsx` — render `<ShopCategoryContactSubject category={categoryLabel} />`
- `components/nav/Footer.tsx` — add `<TextMakyInlineLink />` near phone block
- `app/[locale]/contact/page.tsx` — add `<TextMakyInlineLink />` near the form

---

## Task 1: Add `mobile` block to site data

**Files:**
- Modify: `data/site.ts`

- [ ] **Step 1: Open and add the field**

After the `phoneHref` line (around line 6), add inside the `SITE` const:

```ts
  mobile: {
    display: "+1 (516) 851-2815",
    tel: "tel:+15168512815",
    e164: "+15168512815",
  },
```

The full edit (locate `email:` line, insert `mobile` block right above it):

```ts
  phoneHref: "tel:+15164843456",
  mobile: {
    display: "+1 (516) 851-2815",
    tel: "tel:+15168512815",
    e164: "+15168512815",
  },
  email: "makythedivagalaevents@gmail.com",
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: passes (the `as const` on `SITE` will widen the new keys correctly).

- [ ] **Step 3: Commit**

```bash
git add data/site.ts
git commit -m "feat(contact): add Maky's personal mobile to site data"
```

---

## Task 2: Pure subject-key resolver (`lib/contact-subject.ts`)

**Files:**
- Create: `lib/contact-subject.ts`
- Test: `tests/unit/contact-subject.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/contact-subject.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { getSubjectKey, type ContactOverride } from "@/lib/contact-subject";

describe("getSubjectKey", () => {
  it("returns pdp_named when override provides product name", () => {
    const result = getSubjectKey({
      pathname: "/en/product/garden-bloom",
      override: { kind: "pdp", productName: "Garden Bloom" },
    });
    expect(result).toEqual({ key: "pdp_named", vars: { product: "Garden Bloom" } });
  });

  it("returns pdp_generic when on PDP without override", () => {
    const result = getSubjectKey({
      pathname: "/en/product/garden-bloom",
      override: null,
    });
    expect(result).toEqual({ key: "pdp_generic" });
  });

  it("returns shop_category when override provides category", () => {
    const result = getSubjectKey({
      pathname: "/es/shop/bouquets",
      override: { kind: "shop", category: "Ramos" },
    });
    expect(result).toEqual({ key: "shop_category", vars: { category: "Ramos" } });
  });

  it("returns shop_all on /shop without override", () => {
    expect(getSubjectKey({ pathname: "/es/shop", override: null })).toEqual({ key: "shop_all" });
  });

  it("returns shop_all on /shop/[category] without override", () => {
    expect(getSubjectKey({ pathname: "/es/shop/bouquets", override: null })).toEqual({
      key: "shop_all",
    });
  });

  it("returns weddings on /weddings", () => {
    expect(getSubjectKey({ pathname: "/en/weddings", override: null })).toEqual({ key: "weddings" });
  });

  it("returns events on /events", () => {
    expect(getSubjectKey({ pathname: "/en/events", override: null })).toEqual({ key: "events" });
  });

  it("returns checkout on /cart", () => {
    expect(getSubjectKey({ pathname: "/en/cart", override: null })).toEqual({ key: "checkout" });
  });

  it("returns checkout on /checkout", () => {
    expect(getSubjectKey({ pathname: "/en/checkout", override: null })).toEqual({ key: "checkout" });
  });

  it("returns default on /journal", () => {
    expect(getSubjectKey({ pathname: "/en/journal", override: null })).toEqual({ key: "default" });
  });

  it("returns default on home", () => {
    expect(getSubjectKey({ pathname: "/en", override: null })).toEqual({ key: "default" });
  });

  it("returns default on /story", () => {
    expect(getSubjectKey({ pathname: "/es/story", override: null })).toEqual({ key: "default" });
  });

  it("strips locale prefix correctly even without trailing slash", () => {
    expect(getSubjectKey({ pathname: "/en/cart/", override: null })).toEqual({ key: "checkout" });
  });

  it("treats unknown override kinds as pathname-only", () => {
    // Forward-compat: if a future override kind appears that this resolver
    // doesn't know about, fall back to pathname-based detection.
    const result = getSubjectKey({
      pathname: "/en/weddings",
      override: { kind: "unknown" } as unknown as ContactOverride,
    });
    expect(result).toEqual({ key: "weddings" });
  });
});

describe("isAllowlistedRoute", () => {
  it("is true for product, shop, weddings, events, cart, checkout", () => {
    const { isAllowlistedRoute } = require("@/lib/contact-subject") as typeof import("@/lib/contact-subject");
    for (const p of [
      "/en/product/x",
      "/en/shop",
      "/en/shop/bouquets",
      "/en/weddings",
      "/en/events",
      "/en/cart",
      "/en/checkout",
    ]) {
      expect(isAllowlistedRoute(p)).toBe(true);
    }
  });

  it("is false for editorial routes", () => {
    const { isAllowlistedRoute } = require("@/lib/contact-subject") as typeof import("@/lib/contact-subject");
    for (const p of [
      "/en",
      "/en/story",
      "/en/journal",
      "/en/journal/some-post",
      "/en/contact",
      "/en/legal/privacy",
      "/en/account",
      "/en/order/abc/confirmation",
    ]) {
      expect(isAllowlistedRoute(p)).toBe(false);
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- contact-subject`
Expected: FAIL — module `@/lib/contact-subject` does not exist.

- [ ] **Step 3: Implement `lib/contact-subject.ts`**

Create the file:

```ts
export type SubjectKey =
  | "pdp_named"
  | "pdp_generic"
  | "shop_all"
  | "shop_category"
  | "weddings"
  | "events"
  | "checkout"
  | "default";

export type ContactOverride =
  | { kind: "pdp"; productName: string }
  | { kind: "shop"; category: string }
  | null;

export type SubjectResult = { key: SubjectKey; vars?: Record<string, string> };

const LOCALE_PREFIX = /^\/(en|es)(?=\/|$)/;

function stripLocale(pathname: string): string {
  const stripped = pathname.replace(LOCALE_PREFIX, "");
  return stripped === "" ? "/" : stripped.replace(/\/+$/, "") || "/";
}

export function getSubjectKey(input: {
  pathname: string;
  override: ContactOverride;
}): SubjectResult {
  const { pathname, override } = input;

  if (override && override.kind === "pdp") {
    return { key: "pdp_named", vars: { product: override.productName } };
  }
  if (override && override.kind === "shop") {
    return { key: "shop_category", vars: { category: override.category } };
  }

  const path = stripLocale(pathname);

  if (path.startsWith("/product/")) return { key: "pdp_generic" };
  if (path === "/shop" || path.startsWith("/shop/")) return { key: "shop_all" };
  if (path === "/weddings") return { key: "weddings" };
  if (path === "/events") return { key: "events" };
  if (path === "/cart" || path === "/checkout") return { key: "checkout" };

  return { key: "default" };
}

export function isAllowlistedRoute(pathname: string): boolean {
  // The trigger renders only on routes that resolve to a non-default subject
  // when no override is present.
  return getSubjectKey({ pathname, override: null }).key !== "default";
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- contact-subject`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/contact-subject.ts tests/unit/contact-subject.test.ts
git commit -m "feat(contact): add subject-key resolver for Text Maky modal"
```

---

## Task 3: Pure URL builders (`lib/text-maky-links.ts`)

**Files:**
- Create: `lib/text-maky-links.ts`
- Test: `tests/unit/text-maky-links.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/text-maky-links.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildSmsHref, buildWhatsappHref, buildTelHref } from "@/lib/text-maky-links";

const E164 = "+15168512815";
const MSG = "Hi Maky, I have a question about Garden Bloom.";

describe("buildSmsHref", () => {
  it("uses ?&body= for cross-platform compatibility", () => {
    const href = buildSmsHref(E164, MSG);
    expect(href.startsWith(`sms:${E164}?&body=`)).toBe(true);
  });

  it("URL-encodes the message body", () => {
    const href = buildSmsHref(E164, MSG);
    expect(href).toBe(
      `sms:${E164}?&body=Hi%20Maky%2C%20I%20have%20a%20question%20about%20Garden%20Bloom.`,
    );
  });

  it("encodes special characters like ampersands and quotes", () => {
    const href = buildSmsHref(E164, "Tom's & Jerry's");
    expect(href).toContain("Tom%27s%20%26%20Jerry%27s");
  });
});

describe("buildWhatsappHref", () => {
  it("strips the leading + from the number", () => {
    const href = buildWhatsappHref(E164, MSG);
    expect(href.startsWith("https://wa.me/15168512815?text=")).toBe(true);
    expect(href).not.toContain("wa.me/+");
  });

  it("URL-encodes the message text", () => {
    const href = buildWhatsappHref(E164, MSG);
    expect(href).toBe(
      "https://wa.me/15168512815?text=Hi%20Maky%2C%20I%20have%20a%20question%20about%20Garden%20Bloom.",
    );
  });
});

describe("buildTelHref", () => {
  it("returns tel: prefix and the raw e164 number", () => {
    expect(buildTelHref(E164)).toBe("tel:+15168512815");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- text-maky-links`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/text-maky-links.ts`**

Create the file:

```ts
export function buildSmsHref(e164: string, body: string): string {
  return `sms:${e164}?&body=${encodeURIComponent(body)}`;
}

export function buildWhatsappHref(e164: string, body: string): string {
  const digits = e164.replace(/^\+/, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(body)}`;
}

export function buildTelHref(e164: string): string {
  return `tel:${e164}`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- text-maky-links`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/text-maky-links.ts tests/unit/text-maky-links.test.ts
git commit -m "feat(contact): add SMS/WhatsApp/tel URL builders"
```

---

## Task 4: Add `text_modal` i18n namespace

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/es.json`

- [ ] **Step 1: Add the `text_modal` block to `messages/en.json`**

Insert as a new top-level key (before or after an existing namespace; placement doesn't matter for next-intl):

```json
"text_modal": {
  "trigger": "Text Maky",
  "title": "Text Maky",
  "subtitle": "I'll respond as soon as I can.",
  "preview_label": "Your message",
  "send_sms": "Send via SMS",
  "send_whatsapp": "WhatsApp",
  "call": "Call instead",
  "footer_note": "Mon–Sun · A real person",
  "inline_link": "Text Maky directly →",
  "close": "Close",
  "greeting": "Hi Maky, ",
  "subjects": {
    "pdp_generic": "I have a question about a product I'm looking at.",
    "pdp_named": "I have a question about {product}.",
    "shop_all": "I'm browsing your shop and have a question.",
    "shop_category": "I'm browsing your {category} collection and have a question.",
    "weddings": "I'd like to inquire about wedding florals.",
    "events": "I'd like to ask about florals for an event.",
    "checkout": "I need help completing my order.",
    "default": "I have a quick question."
  }
}
```

- [ ] **Step 2: Add the equivalent block to `messages/es.json`**

```json
"text_modal": {
  "trigger": "Escríbele a Maky",
  "title": "Escríbele a Maky",
  "subtitle": "Te responderé lo antes posible.",
  "preview_label": "Tu mensaje",
  "send_sms": "Enviar por SMS",
  "send_whatsapp": "WhatsApp",
  "call": "Llamar mejor",
  "footer_note": "Lun–Dom · Una persona real",
  "inline_link": "Escríbele a Maky directamente →",
  "close": "Cerrar",
  "greeting": "Hola Maky, ",
  "subjects": {
    "pdp_generic": "tengo una pregunta sobre un producto que estoy viendo.",
    "pdp_named": "tengo una pregunta sobre {product}.",
    "shop_all": "estoy viendo tu tienda y tengo una pregunta.",
    "shop_category": "estoy viendo tu colección de {category} y tengo una pregunta.",
    "weddings": "me gustaría consultar sobre flores para una boda.",
    "events": "me gustaría consultar sobre flores para un evento.",
    "checkout": "necesito ayuda para completar mi pedido.",
    "default": "tengo una pregunta rápida."
  }
}
```

- [ ] **Step 3: Validate JSON syntax**

Run: `node -e "JSON.parse(require('fs').readFileSync('messages/en.json','utf8')); JSON.parse(require('fs').readFileSync('messages/es.json','utf8')); console.log('ok')"`
Expected: prints `ok`.

- [ ] **Step 4: Commit**

```bash
git add messages/en.json messages/es.json
git commit -m "feat(contact): add text_modal i18n keys (en, es)"
```

---

## Task 5: ContactContextProvider + hook

**Files:**
- Create: `components/contact/ContactContextProvider.tsx`

- [ ] **Step 1: Create the provider**

```tsx
"use client";
import * as React from "react";
import type { ContactOverride } from "@/lib/contact-subject";

type Ctx = {
  override: ContactOverride;
  setOverride: (o: ContactOverride) => void;
  open: boolean;
  setOpen: (o: boolean) => void;
};

const ContactContext = React.createContext<Ctx | null>(null);

export function ContactContextProvider({ children }: { children: React.ReactNode }) {
  const [override, setOverride] = React.useState<ContactOverride>(null);
  const [open, setOpen] = React.useState(false);

  return (
    <ContactContext.Provider value={{ override, setOverride, open, setOpen }}>
      {children}
    </ContactContext.Provider>
  );
}

export function useContactContext(): Ctx {
  const ctx = React.useContext(ContactContext);
  if (!ctx) {
    throw new Error("useContactContext must be used inside <ContactContextProvider>");
  }
  return ctx;
}

export function useSetContactSubject(override: ContactOverride): void {
  const { setOverride } = useContactContext();
  // Stable JSON for dep array — avoids re-running on object identity changes.
  const key = JSON.stringify(override);
  React.useEffect(() => {
    setOverride(override);
    return () => setOverride(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add components/contact/ContactContextProvider.tsx
git commit -m "feat(contact): add ContactContextProvider and useSetContactSubject hook"
```

---

## Task 6: TextMakyModal component

**Files:**
- Create: `components/contact/TextMakyModal.tsx`
- Test: `tests/unit/text-maky-modal.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/text-maky-modal.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import { TextMakyModal } from "@/components/contact/TextMakyModal";
import { ContactContextProvider, useContactContext } from "@/components/contact/ContactContextProvider";

vi.mock("next/navigation", () => ({
  usePathname: () => "/en/product/garden-bloom",
}));

function OpenOnMount() {
  const { setOpen } = useContactContext();
  // Open immediately so Radix portal renders for the test
  // eslint-disable-next-line react-hooks/rules-of-hooks
  React.useEffect(() => setOpen(true), [setOpen]);
  return null;
}

import * as React from "react";

function Harness({
  locale,
  pdpName,
}: {
  locale: "en" | "es";
  pdpName?: string;
}) {
  const messages = locale === "en" ? en : es;
  return (
    <NextIntlClientProvider locale={locale} messages={messages as never}>
      <ContactContextProvider>
        {pdpName ? <SetPdp name={pdpName} /> : null}
        <OpenOnMount />
        <TextMakyModal />
      </ContactContextProvider>
    </NextIntlClientProvider>
  );
}

function SetPdp({ name }: { name: string }) {
  const { setOverride } = useContactContext();
  React.useEffect(() => {
    setOverride({ kind: "pdp", productName: name });
  }, [setOverride, name]);
  return null;
}

describe("TextMakyModal", () => {
  it("renders the EN preview with PDP product name", async () => {
    render(<Harness locale="en" pdpName="Garden Bloom" />);
    expect(
      await screen.findByText(/Hi Maky, I have a question about Garden Bloom\./),
    ).toBeInTheDocument();
  });

  it("renders the ES preview with PDP product name", async () => {
    render(<Harness locale="es" pdpName="Garden Bloom" />);
    expect(
      await screen.findByText(/Hola Maky, tengo una pregunta sobre Garden Bloom\./),
    ).toBeInTheDocument();
  });

  it("renders SMS, WhatsApp, and Call CTAs with correct hrefs", async () => {
    render(<Harness locale="en" pdpName="Garden Bloom" />);
    const sms = await screen.findByRole("link", { name: /Send via SMS/i });
    expect(sms).toHaveAttribute("href", expect.stringMatching(/^sms:\+15168512815\?&body=/));
    expect(sms.getAttribute("href")).toContain("Garden%20Bloom");

    const wa = screen.getByRole("link", { name: /WhatsApp/i });
    expect(wa).toHaveAttribute("href", expect.stringMatching(/^https:\/\/wa\.me\/15168512815\?text=/));

    const call = screen.getByRole("link", { name: /Call instead/i });
    expect(call).toHaveAttribute("href", "tel:+15168512815");
  });

  it("falls back to default subject on a non-allowlisted route", async () => {
    vi.doMock("next/navigation", () => ({
      usePathname: () => "/en/journal",
    }));
    // Re-import after re-mock
    const { TextMakyModal: M } = await import("@/components/contact/TextMakyModal");
    render(
      <NextIntlClientProvider locale="en" messages={en as never}>
        <ContactContextProvider>
          <OpenOnMount />
          <M />
        </ContactContextProvider>
      </NextIntlClientProvider>,
    );
    expect(await screen.findByText(/Hi Maky, I have a quick question\./)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- text-maky-modal`
Expected: FAIL — `TextMakyModal` not found.

- [ ] **Step 3: Implement `components/contact/TextMakyModal.tsx`**

```tsx
"use client";
import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { ChatCircleText, Phone, WhatsappLogo, X } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { SITE } from "@/data/site";
import { getSubjectKey } from "@/lib/contact-subject";
import { buildSmsHref, buildTelHref, buildWhatsappHref } from "@/lib/text-maky-links";
import { useContactContext } from "@/components/contact/ContactContextProvider";

export function TextMakyModal() {
  const t = useTranslations("text_modal");
  const pathname = usePathname() ?? "/";
  const { override, open, setOpen } = useContactContext();

  const { key, vars } = getSubjectKey({ pathname, override });
  const greeting = t("greeting");
  const subject = t(`subjects.${key}`, vars ?? {});
  const message = `${greeting}${subject}`;

  const smsHref = buildSmsHref(SITE.mobile.e164, message);
  const whatsappHref = buildWhatsappHref(SITE.mobile.e164, message);
  const telHref = buildTelHref(SITE.mobile.e164);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal forceMount>
        <AnimatePresence>
          {open && (
            <>
              <Dialog.Overlay asChild>
                <motion.div
                  className="fixed inset-0 z-50 bg-ink/30 backdrop-blur-md"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                />
              </Dialog.Overlay>
              <Dialog.Content asChild>
                <motion.div
                  className={cn(
                    "fixed z-50 bg-bone text-ink shadow-[var(--shadow-diffusion)]",
                    // mobile: bottom-sheet
                    "inset-x-0 bottom-0 max-h-[85dvh] rounded-t-[var(--radius-bento)] border-t border-ink/10 p-8",
                    // desktop: centered card
                    "md:inset-auto md:left-1/2 md:top-1/2 md:bottom-auto md:-translate-x-1/2 md:-translate-y-1/2",
                    "md:w-[min(28rem,calc(100vw-3rem))] md:max-h-none md:rounded-[var(--radius-bento)] md:border md:border-ink/10",
                    "[box-shadow:inset_0_1px_0_rgba(255,255,255,0.6)]",
                  )}
                  initial={{ y: "100%", opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: "100%", opacity: 0 }}
                  transition={{ type: "spring", stiffness: 220, damping: 28 }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <Dialog.Title className="font-display text-2xl text-ink">
                        {t("title")}
                      </Dialog.Title>
                      <Dialog.Description className="mt-1 text-sm text-ink/60">
                        {t("subtitle")}
                      </Dialog.Description>
                    </div>
                    <Dialog.Close asChild>
                      <button
                        type="button"
                        aria-label={t("close")}
                        className="rounded-full p-2 text-ink/60 transition-colors hover:bg-ink/[0.04] hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rouge"
                      >
                        <X size={18} weight="regular" aria-hidden />
                      </button>
                    </Dialog.Close>
                  </div>

                  <div
                    role="region"
                    aria-label={t("preview_label")}
                    className="mt-6 rounded-xl border border-ink/10 bg-ink/[0.03] p-4"
                  >
                    <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/50">
                      {t("preview_label")}
                    </p>
                    <p className="mt-1.5 font-display text-[15px] italic leading-relaxed text-ink/80">
                      {message}
                    </p>
                  </div>

                  <div className="mt-6 flex flex-col gap-2">
                    <Button asChild variant="primary" size="md" className="w-full justify-center">
                      <a
                        href={smsHref}
                        aria-label={`${t("send_sms")} (${SITE.mobile.display})`}
                      >
                        <ChatCircleText size={18} weight="regular" className="mr-2" aria-hidden />
                        {t("send_sms")}
                      </a>
                    </Button>
                    <Button asChild variant="outline" size="md" className="w-full justify-center">
                      <a
                        href={whatsappHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`${t("send_whatsapp")} (${SITE.mobile.display})`}
                      >
                        <WhatsappLogo size={18} weight="regular" className="mr-2" aria-hidden />
                        {t("send_whatsapp")}
                      </a>
                    </Button>
                    <Button asChild variant="ghost" size="md" className="w-full justify-center">
                      <a
                        href={telHref}
                        aria-label={`${t("call")} (${SITE.mobile.display})`}
                      >
                        <Phone size={18} weight="regular" className="mr-2" aria-hidden />
                        {t("call")}
                      </a>
                    </Button>
                  </div>

                  <p className="mt-4 text-center font-mono text-[11px] uppercase tracking-[0.2em] text-ink/40">
                    {t("footer_note")}
                  </p>
                </motion.div>
              </Dialog.Content>
            </>
          )}
        </AnimatePresence>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- text-maky-modal`
Expected: all PASS.

If a test fails because Radix `Dialog.Portal` content is not in `document.body` for queries: that's expected to work because RTL queries `screen` against `document.body` and Radix portals there by default. If it doesn't, add a `container={document.body}` prop check — but it should work as written.

- [ ] **Step 5: Commit**

```bash
git add components/contact/TextMakyModal.tsx tests/unit/text-maky-modal.test.tsx
git commit -m "feat(contact): add TextMakyModal with SMS/WhatsApp/Call CTAs"
```

---

## Task 7: TextMakyTrigger floating button

**Files:**
- Create: `components/contact/TextMakyTrigger.tsx`

- [ ] **Step 1: Implement the trigger**

```tsx
"use client";
import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { ChatCircleText } from "@phosphor-icons/react/dist/ssr";
import { isAllowlistedRoute } from "@/lib/contact-subject";
import { useContactContext } from "@/components/contact/ContactContextProvider";
import { TextMakyModal } from "@/components/contact/TextMakyModal";

export function TextMakyTrigger() {
  const t = useTranslations("text_modal");
  const pathname = usePathname() ?? "/";
  const { setOpen, open } = useContactContext();
  const visible = isAllowlistedRoute(pathname);

  return (
    <>
      <AnimatePresence>
        {visible && (
          <motion.button
            type="button"
            onClick={() => setOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-label={t("trigger")}
            className="fixed bottom-6 right-6 z-30 inline-flex items-center gap-2 rounded-full bg-ink px-5 py-3 text-bone shadow-[var(--shadow-diffusion)] transition-colors hover:bg-rouge focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rouge focus-visible:ring-offset-2 focus-visible:ring-offset-bone"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.25 }}
          >
            <ChatCircleText size={18} weight="regular" aria-hidden />
            <span className="font-sans text-sm font-medium tracking-tight">{t("trigger")}</span>
          </motion.button>
        )}
      </AnimatePresence>
      <TextMakyModal />
    </>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add components/contact/TextMakyTrigger.tsx
git commit -m "feat(contact): add floating TextMakyTrigger button"
```

---

## Task 8: TextMakyInlineLink

**Files:**
- Create: `components/contact/TextMakyInlineLink.tsx`

- [ ] **Step 1: Implement the inline link**

```tsx
"use client";
import * as React from "react";
import { useTranslations } from "next-intl";
import { useContactContext } from "@/components/contact/ContactContextProvider";
import { cn } from "@/lib/cn";

type Props = {
  className?: string;
};

export function TextMakyInlineLink({ className }: Props) {
  const t = useTranslations("text_modal");
  const { setOpen } = useContactContext();

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className={cn(
        "inline-flex items-center font-mono text-[13px] underline-offset-4 transition-colors hover:text-petal hover:underline focus-visible:outline-none focus-visible:underline",
        className,
      )}
    >
      {t("inline_link")}
    </button>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add components/contact/TextMakyInlineLink.tsx
git commit -m "feat(contact): add TextMakyInlineLink for footer/contact"
```

---

## Task 9: Mount provider + trigger in locale layout

**Files:**
- Modify: `app/[locale]/layout.tsx`

- [ ] **Step 1: Wrap children and mount the trigger**

Current file:

```tsx
return (
  <NextIntlClientProvider locale={locale}>
    <TopNav locale={locale as Locale} navLinksSlot={<NavLinks locale={locale as Locale} />} />
    <div className="pt-16">{children}</div>
    <Footer locale={locale as Locale} />
    <CartDrawerHost locale={locale as Locale} />
    <ToastAddedToBag />
  </NextIntlClientProvider>
);
```

Change to:

```tsx
import { ContactContextProvider } from "@/components/contact/ContactContextProvider";
import { TextMakyTrigger } from "@/components/contact/TextMakyTrigger";

// ...

return (
  <NextIntlClientProvider locale={locale}>
    <ContactContextProvider>
      <TopNav locale={locale as Locale} navLinksSlot={<NavLinks locale={locale as Locale} />} />
      <div className="pt-16">{children}</div>
      <Footer locale={locale as Locale} />
      <CartDrawerHost locale={locale as Locale} />
      <ToastAddedToBag />
      <TextMakyTrigger />
    </ContactContextProvider>
  </NextIntlClientProvider>
);
```

- [ ] **Step 2: Run dev server and smoke check**

Run: `npm run dev` (in background or another terminal)
Visit `http://localhost:3000/en/product/<any-slug>` — floating button should be visible bottom-right.
Visit `http://localhost:3000/en/story` — button should NOT appear.
Visit `http://localhost:3000/en/cart` — button should appear.

Stop the dev server.

- [ ] **Step 3: Commit**

```bash
git add app/[locale]/layout.tsx
git commit -m "feat(contact): mount ContactContextProvider and TextMakyTrigger globally"
```

---

## Task 10: Wire PDP override

**Files:**
- Create: `components/contact/PdpContactSubject.tsx`
- Modify: `app/[locale]/product/[slug]/page.tsx`

- [ ] **Step 1: Create the PDP subject-setter**

```tsx
"use client";
import { useSetContactSubject } from "@/components/contact/ContactContextProvider";

export function PdpContactSubject({ productName }: { productName: string }) {
  useSetContactSubject({ kind: "pdp", productName });
  return null;
}
```

- [ ] **Step 2: Mount it on the PDP page**

In `app/[locale]/product/[slug]/page.tsx`, add the import at the top:

```tsx
import { PdpContactSubject } from "@/components/contact/PdpContactSubject";
```

Then in the JSX, right after the opening `<main className="bg-bone text-ink">`, add:

```tsx
<PdpContactSubject productName={product.title[locale]} />
```

So that section becomes:

```tsx
return (
  <main className="bg-bone text-ink">
    <PdpContactSubject productName={product.title[locale]} />
    <PdpStructuredData product={product} locale={locale} origin={origin} />
    {/* ... existing sections ... */}
  </main>
);
```

- [ ] **Step 3: Smoke check in browser**

Run dev server. Visit `http://localhost:3000/en/product/<any-slug>`. Click the floating "Text Maky" button. The preview should read:

> Hi Maky, I have a question about *<actual product title>*.

Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add components/contact/PdpContactSubject.tsx app/[locale]/product/[slug]/page.tsx
git commit -m "feat(contact): wire PDP product name into Text Maky subject"
```

---

## Task 11: Wire shop/category override

**Files:**
- Create: `components/contact/ShopCategoryContactSubject.tsx`
- Modify: `app/[locale]/shop/[category]/page.tsx`

- [ ] **Step 1: Create the shop-category subject-setter**

```tsx
"use client";
import { useSetContactSubject } from "@/components/contact/ContactContextProvider";

export function ShopCategoryContactSubject({ category }: { category: string }) {
  useSetContactSubject({ kind: "shop", category });
  return null;
}
```

- [ ] **Step 2: Mount it on the shop/category page**

Open `app/[locale]/shop/[category]/page.tsx`. Find the `CATEGORY_TITLES` map and the page render. After the `setRequestLocale(...)` and `notFound` checks, you'll already have `locale` and the category param resolved.

Add the import:

```tsx
import { ShopCategoryContactSubject } from "@/components/contact/ShopCategoryContactSubject";
```

In the page render JSX, near the top of the returned tree (before `<FilterBar>` or whatever opens the page), add:

```tsx
<ShopCategoryContactSubject category={CATEGORY_TITLES[category][locale]} />
```

If the page returns a Fragment or top-level wrapper, place the subject-setter as the first child so it mounts immediately on hydration.

- [ ] **Step 3: Smoke check**

Run dev server. Visit `http://localhost:3000/es/shop/bouquets`. Click the trigger. Preview should read:

> Hola Maky, estoy viendo tu colección de Ramos y tengo una pregunta.

Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add components/contact/ShopCategoryContactSubject.tsx app/[locale]/shop/[category]/page.tsx
git commit -m "feat(contact): wire shop category into Text Maky subject"
```

---

## Task 12: Add inline link to footer

**Files:**
- Modify: `components/nav/Footer.tsx`

- [ ] **Step 1: Read the phone block area of the footer**

Open `components/nav/Footer.tsx`. Around lines 45-58 there is a column with the phone label and `<a href={SITE.phoneHref}>` business line.

- [ ] **Step 2: Add the inline link beneath the phone link**

`Footer.tsx` is a server component. The inline link is a client component, which is allowed inside a server component as a child.

Add the import at the top:

```tsx
import { TextMakyInlineLink } from "@/components/contact/TextMakyInlineLink";
```

In the phone-column block, after the `<a href={SITE.phoneHref}>...</a>`, insert:

```tsx
<TextMakyInlineLink className="block pt-1.5 text-bone/60 hover:text-petal" />
```

The full column should look like:

```tsx
<div className="md:col-span-2 space-y-3">
  <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-bone/50">
    {t("phone_label")}
  </p>
  <a href={SITE.phoneHref} className="font-mono text-[13px] hover:text-petal transition-colors">
    {SITE.phoneDisplay}
  </a>
  <TextMakyInlineLink className="block pt-1.5 text-bone/60 hover:text-petal" />

  <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-bone/50 pt-3">
    {t("email_label")}
  </p>
  <a href={SITE.emailHref} className="font-mono text-[13px] hover:text-petal transition-colors">
    {SITE.email}
  </a>
</div>
```

- [ ] **Step 3: Smoke check**

Run dev server. On any page, scroll to the footer. The "Text Maky directly →" link should appear under the business phone. Click it — modal opens, preview reflects the current page.

Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add components/nav/Footer.tsx
git commit -m "feat(contact): add Text Maky inline link to footer"
```

---

## Task 13: Add inline link to contact page

**Files:**
- Modify: `app/[locale]/contact/page.tsx`

- [ ] **Step 1: Read the contact page and find a sensible placement**

Open `app/[locale]/contact/page.tsx`. Locate the area where the form or contact info is rendered.

- [ ] **Step 2: Add the inline link**

Add the import:

```tsx
import { TextMakyInlineLink } from "@/components/contact/TextMakyInlineLink";
```

Near the form / studio info block, add:

```tsx
<div className="mt-6">
  <TextMakyInlineLink />
</div>
```

If the page doesn't have an obvious slot, place it under the form's submit button area or under the studio phone display.

- [ ] **Step 3: Smoke check**

Run dev server. Visit `http://localhost:3000/en/contact`. Confirm the inline link is visible and the modal opens, with the preview defaulting to the generic message ("I have a quick question.") because contact is not allowlisted.

Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add app/[locale]/contact/page.tsx
git commit -m "feat(contact): add Text Maky inline link to contact page"
```

---

## Task 14: Final verification pass

**Files:** none (verification only)

- [ ] **Step 1: Run the full unit test suite**

Run: `npm test`
Expected: all tests PASS, including the three new files.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: passes.

- [ ] **Step 3: Run the production build**

Run: `npm run build`
Expected: successful build, no warnings about missing translation keys, no client/server boundary errors.

- [ ] **Step 4: Manual cross-route check**

Run dev server. For each pathname below, confirm:

| Route | Trigger visible? | Preview (EN) |
|---|---|---|
| `/en` | NO | n/a |
| `/en/story` | NO | n/a |
| `/en/journal` | NO | n/a |
| `/en/journal/<slug>` | NO | n/a |
| `/en/legal/privacy` | NO | n/a |
| `/en/account` | NO | n/a |
| `/en/contact` | NO | inline link → "I have a quick question." |
| `/en/product/<slug>` | YES | "Hi Maky, I have a question about <Product>." |
| `/en/shop` | YES | "I'm browsing your shop and have a question." |
| `/en/shop/bouquets` | YES | "I'm browsing your Bouquets collection and have a question." |
| `/en/weddings` | YES | "I'd like to inquire about wedding florals." |
| `/en/events` | YES | "I'd like to ask about florals for an event." |
| `/en/cart` | YES | "I need help completing my order." |
| `/en/checkout` | YES | "I need help completing my order." |

Repeat the visible-route checks on `/es/...` for Spanish copy.

- [ ] **Step 5: Native-link sanity check**

On a phone (or with the browser's mobile emulator):
- Click "Send via SMS" → native Messages app opens with body pre-filled.
- Click "WhatsApp" → opens WhatsApp app (or `web.whatsapp.com` on desktop) with text pre-filled.
- Click "Call instead" → opens dialer.

- [ ] **Step 6: Final commit if anything was tweaked**

If any small fixes were needed during the manual pass (a route mapping, a copy tweak), commit them with a descriptive message. If nothing changed, no commit needed.

---

## Self-Review Notes

- **Spec coverage:** all sections of `2026-05-02-text-maky-modal-design.md` are covered: site data (Task 1), pure helpers (Tasks 2-3), i18n (Task 4), context (Task 5), modal (Task 6), trigger (Task 7), inline link (Task 8), layout mount (Task 9), PDP wiring (Task 10), shop wiring (Task 11), footer (Task 12), contact page (Task 13), verification (Task 14).
- **No placeholders:** every code step shows full code; every test step shows the exact assertions; every commit step shows the exact command.
- **Type/name consistency:** `ContactOverride`, `SubjectKey`, `SubjectResult`, `useContactContext`, `useSetContactSubject`, `getSubjectKey`, `isAllowlistedRoute`, `buildSmsHref`, `buildWhatsappHref`, `buildTelHref` — used consistently across all tasks.
- **Phosphor icons** chosen instead of lucide (per repo convention). The spec mentioned a one-path SVG fallback for WhatsApp; using Phosphor's `WhatsappLogo` is simpler and consistent.
- **Test file convention:** `.test.ts` / `.test.tsx` (verified against `vitest.config.ts`).
