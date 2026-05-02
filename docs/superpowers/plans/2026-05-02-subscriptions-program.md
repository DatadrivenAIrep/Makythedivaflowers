# Subscriptions Program Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a `/subscriptions` landing page with three tiers (Petit Bouquet / Maison / Atelier) and a lead-capture inquiry form that extends the existing `/api/inquiry` discriminated union. No payment processor.

**Architecture:** Single Server Component page mounting a Client wrapper (`SubscriptionLanding`) that holds `selectedPlan` state shared between tier cards and the form. Form posts to existing `/api/inquiry` with `type: "subscription"`, persisted alongside wedding/event leads in `pending-inquiries.json`.

**Tech Stack:** Next.js (App Router), TypeScript, react-hook-form, zod, next-intl, Tailwind, framer-motion, Vitest, Playwright.

**Spec:** [`docs/superpowers/specs/2026-05-02-subscriptions-program-design.md`](../specs/2026-05-02-subscriptions-program-design.md)

---

## Pre-flight

Engineer should:

- Be on main branch (or a worktree from main).
- Run `npm install` once if not already done.
- Run `npm test` once to confirm clean baseline.

---

## File Structure

**New files:**

```
data/subscription-plans.ts                          Plan data (3 tiers, localized)
schemas/subscription-inquiry.ts                     zod schema + types
lib/submit-subscription-inquiry.ts                  Client wrapper to POST inquiry
components/subscription/SubscriptionTierCard.tsx    One tier card
components/subscription/SubscriptionTiers.tsx       Row of 3 cards
components/subscription/SubscriptionHero.tsx        Hero section (server)
components/subscription/SubscriptionHowItWorks.tsx  3-step section (server)
components/subscription/SubscriptionInquiryForm.tsx Form
components/subscription/SubscriptionLanding.tsx     Client wrapper, holds state
app/[locale]/subscriptions/page.tsx                 Page
app/[locale]/subscriptions/loading.tsx              Loading skeleton
tests/unit/subscription-inquiry-schema.test.ts
tests/unit/SubscriptionTiers.test.tsx
tests/unit/SubscriptionInquiryForm.test.tsx
tests/e2e/subscriptions.spec.ts
```

**Modified files:**

```
lib/inquiry-storage.ts                  Add "subscription" to type union
app/api/inquiry/route.ts                Add subscriptionInquirySchema to discriminated union
components/home/BentoSubscriptionsTile.tsx   Update href to /subscriptions
app/sitemap.ts                          Add "subscriptions" to STATIC_PATHS, drop "shop/subscriptions"
messages/en.json                        Add "subscriptions" namespace
messages/es.json                        Add "subscriptions" namespace
```

---

## Task 1: Subscription plans data

**Files:**
- Create: `data/subscription-plans.ts`

- [ ] **Step 1: Write the data module**

Create `data/subscription-plans.ts`:

```ts
import type { Localized } from "@/types/product";

export type SubscriptionPlanId = "petit" | "maison" | "atelier";

export type SubscriptionPlan = {
  id: SubscriptionPlanId;
  name: Localized;
  priceCents: number;
  blurb: Localized;
  stems?: number;
  highlights: [Localized, Localized, Localized];
  popular?: boolean;
};

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: "petit",
    name: { en: "Petit Bouquet", es: "Petit Bouquet" },
    priceCents: 4500,
    stems: 15,
    blurb: {
      en: "A hand-tied bouquet of about fifteen seasonal stems, wrapped in kraft and signed by the studio.",
      es: "Un ramo atado a mano con unos quince tallos de temporada, envuelto en kraft y firmado por el estudio.",
    },
    highlights: [
      { en: "~15 seasonal stems, hand-tied", es: "~15 tallos de temporada, atados a mano" },
      { en: "Kraft wrap, hand-written card", es: "Envoltura kraft, tarjeta a mano" },
      { en: "Cancel anytime", es: "Cancela cuando quieras" },
    ],
  },
  {
    id: "maison",
    name: { en: "Maison", es: "Maison" },
    priceCents: 8500,
    stems: 25,
    popular: true,
    blurb: {
      en: "Our most-loved plan: a generous bouquet of about twenty-five stems with premium seasonal flowers.",
      es: "Nuestro plan más querido: un ramo generoso de unos veinticinco tallos con flores premium de temporada.",
    },
    highlights: [
      { en: "~25 stems incl. premium varieties", es: "~25 tallos con variedades premium" },
      { en: "Signed paper, hand-written card", es: "Papel firmado, tarjeta a mano" },
      { en: "Cancel anytime", es: "Cancela cuando quieras" },
    ],
  },
  {
    id: "atelier",
    name: { en: "Atelier", es: "Atelier" },
    priceCents: 14500,
    blurb: {
      en: "A vase arrangement of rare seasonal flowers, with a studio vase rotated in every fourth delivery.",
      es: "Un arreglo en jarrón con flores raras de temporada y un jarrón del estudio cada cuatro entregas.",
    },
    highlights: [
      { en: "Vase arrangement, rare seasonal", es: "Arreglo en jarrón, raras de temporada" },
      { en: "Studio vase every 4th delivery", es: "Jarrón del estudio cada 4 entregas" },
      { en: "Priority delivery window", es: "Ventana de entrega prioritaria" },
    ],
  },
];

export function findSubscriptionPlan(id: SubscriptionPlanId): SubscriptionPlan {
  const plan = SUBSCRIPTION_PLANS.find((p) => p.id === id);
  if (!plan) throw new Error(`Unknown subscription plan: ${id}`);
  return plan;
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS (no errors).

- [ ] **Step 3: Commit**

```bash
git add data/subscription-plans.ts
git commit -m "feat(subscriptions): add SUBSCRIPTION_PLANS data with three tiers"
```

---

## Task 2: Subscription inquiry schema

**Files:**
- Create: `schemas/subscription-inquiry.ts`
- Create: `tests/unit/subscription-inquiry-schema.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/subscription-inquiry-schema.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { subscriptionInquirySchema } from "@/schemas/subscription-inquiry";

function tomorrow(plus = 2): string {
  const d = new Date();
  d.setDate(d.getDate() + plus);
  return d.toISOString().slice(0, 10);
}

const baseSubscription = {
  type: "subscription" as const,
  locale: "en" as const,
  plan: "maison" as const,
  cadence: "weekly" as const,
  startDate: tomorrow(3),
  recipient: { name: "Lola Cardona", phone: "5165550101" },
  address: {
    street1: "1 Park Ave",
    street2: "",
    city: "New York",
    state: "NY",
    zip: "10010",
    country: "US" as const,
  },
  window: { slot: "midday" as const },
  contact: { email: "lola@example.com", phone: "5165550101" },
  cardMessage: "",
  notes: "",
  honeypot: "",
};

describe("subscriptionInquirySchema", () => {
  it("accepts a valid payload", () => {
    expect(subscriptionInquirySchema.safeParse(baseSubscription).success).toBe(true);
  });

  it("rejects bot-filled honeypot", () => {
    expect(
      subscriptionInquirySchema.safeParse({ ...baseSubscription, honeypot: "spam" }).success,
    ).toBe(false);
  });

  it("rejects unknown plan", () => {
    expect(
      subscriptionInquirySchema.safeParse({ ...baseSubscription, plan: "platinum" }).success,
    ).toBe(false);
  });

  it("rejects unknown cadence", () => {
    expect(
      subscriptionInquirySchema.safeParse({ ...baseSubscription, cadence: "monthly" }).success,
    ).toBe(false);
  });

  it("rejects start date earlier than today + 2 days", () => {
    expect(
      subscriptionInquirySchema.safeParse({ ...baseSubscription, startDate: tomorrow(1) }).success,
    ).toBe(false);
  });

  it("rejects malformed startDate", () => {
    expect(
      subscriptionInquirySchema.safeParse({ ...baseSubscription, startDate: "soon" }).success,
    ).toBe(false);
  });

  it("rejects card message longer than 500 chars", () => {
    expect(
      subscriptionInquirySchema.safeParse({ ...baseSubscription, cardMessage: "x".repeat(501) }).success,
    ).toBe(false);
  });

  it("rejects notes longer than 1000 chars", () => {
    expect(
      subscriptionInquirySchema.safeParse({ ...baseSubscription, notes: "x".repeat(1001) }).success,
    ).toBe(false);
  });

  it("requires recipient name", () => {
    expect(
      subscriptionInquirySchema.safeParse({ ...baseSubscription, recipient: { name: "", phone: "5165550101" } }).success,
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/unit/subscription-inquiry-schema.test.ts`
Expected: FAIL — module `@/schemas/subscription-inquiry` not found.

- [ ] **Step 3: Write the schema**

Create `schemas/subscription-inquiry.ts`:

```ts
import { z } from "zod";

const phone = z
  .string()
  .transform((s) => s.replace(/\D/g, ""))
  .pipe(z.string().min(10, "phone_too_short").max(15));

const zip = z.string().regex(/^\d{5}(-\d{4})?$/, "zip_invalid");

const startDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "date_invalid")
  .refine((s) => {
    const d = new Date(s + "T00:00:00");
    const min = new Date();
    min.setHours(0, 0, 0, 0);
    min.setDate(min.getDate() + 2);
    return d.getTime() >= min.getTime();
  }, "date_too_soon");

export const subscriptionInquirySchema = z.object({
  type: z.literal("subscription"),
  locale: z.enum(["en", "es"]),
  plan: z.enum(["petit", "maison", "atelier"]),
  cadence: z.enum(["weekly", "biweekly"]),
  startDate,
  recipient: z.object({
    name: z.string().min(2, "name_too_short").max(80),
    phone,
  }),
  address: z.object({
    street1: z.string().min(3, "street_required").max(120),
    street2: z.string().max(120).optional().or(z.literal("")),
    city: z.string().min(2, "city_required").max(80),
    state: z.string().length(2, "state_invalid"),
    zip,
    country: z.literal("US"),
  }),
  window: z.object({
    slot: z.enum(["morning", "midday", "afternoon", "evening"]),
  }),
  contact: z.object({
    email: z.string().email("email_invalid"),
    phone,
  }),
  cardMessage: z.string().max(500, "card_too_long").optional().or(z.literal("")),
  notes: z.string().max(1000, "notes_too_long").optional().or(z.literal("")),
  honeypot: z.string().max(0),
});

export type SubscriptionInquiry = z.infer<typeof subscriptionInquirySchema>;
export type SubscriptionInquiryInput = z.input<typeof subscriptionInquirySchema>;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/unit/subscription-inquiry-schema.test.ts`
Expected: PASS — 9 tests.

- [ ] **Step 5: Commit**

```bash
git add schemas/subscription-inquiry.ts tests/unit/subscription-inquiry-schema.test.ts
git commit -m "feat(subscriptions): add subscriptionInquirySchema with tests"
```

---

## Task 3: Extend inquiry storage type

**Files:**
- Modify: `lib/inquiry-storage.ts`

- [ ] **Step 1: Add "subscription" to InquiryRecord type union**

In `lib/inquiry-storage.ts` line 9, change:

```ts
type: "wedding" | "event" | "contact" | "newsletter";
```

to:

```ts
type: "wedding" | "event" | "subscription" | "contact" | "newsletter";
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add lib/inquiry-storage.ts
git commit -m "feat(subscriptions): extend InquiryRecord type union"
```

---

## Task 4: Wire subscription into /api/inquiry route

**Files:**
- Modify: `app/api/inquiry/route.ts`

- [ ] **Step 1: Replace the route file**

Overwrite `app/api/inquiry/route.ts`:

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { weddingInquirySchema, eventInquirySchema } from "@/schemas/inquiry";
import { subscriptionInquirySchema } from "@/schemas/subscription-inquiry";
import { saveInquiry } from "@/lib/inquiry-storage";
import { rateLimit, ipFromRequest } from "@/lib/rate-limit";

const requestSchema = z.discriminatedUnion("type", [
  weddingInquirySchema,
  eventInquirySchema,
  subscriptionInquirySchema,
]);

export async function POST(req: Request) {
  const ip = ipFromRequest(req);
  const rl = rateLimit(`inquiry:${ip}`, { max: 5, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json({ ok: false, errors: { formErrors: ["rate_limited"] } }, { status: 429 });
  }
  const json = await req.json().catch(() => null);
  const parsed = requestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, errors: parsed.error.flatten() }, { status: 400 });
  }
  const id = `iq_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  await saveInquiry({
    id,
    type: parsed.data.type,
    payload: parsed.data,
    createdAt: new Date().toISOString(),
    ip,
    locale: parsed.data.locale,
  });
  const contactEmail =
    parsed.data.type === "subscription" ? parsed.data.contact.email : parsed.data.contact.email;
  console.log(`[inquiry] ${parsed.data.type} from ${contactEmail}`);
  return NextResponse.json({ ok: true, id }, { status: 200 });
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Run existing inquiry tests**

Run: `npx vitest run tests/unit/inquiry-schema.test.ts`
Expected: PASS — no regressions.

- [ ] **Step 4: Commit**

```bash
git add app/api/inquiry/route.ts
git commit -m "feat(subscriptions): accept subscription inquiries on /api/inquiry"
```

---

## Task 5: Submit-inquiry client wrapper

**Files:**
- Create: `lib/submit-subscription-inquiry.ts`

- [ ] **Step 1: Write the wrapper**

Create `lib/submit-subscription-inquiry.ts`:

```ts
import type { SubscriptionInquiry } from "@/schemas/subscription-inquiry";

export type SubmitSubscriptionInquiryResult =
  | { ok: true; id: string }
  | { ok: false; errors: { fieldErrors?: Record<string, string[]>; formErrors?: string[] } };

export async function submitSubscriptionInquiry(
  values: SubscriptionInquiry,
): Promise<SubmitSubscriptionInquiryResult> {
  const res = await fetch("/api/inquiry", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(values),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.ok) {
    return { ok: false, errors: data?.errors ?? { formErrors: ["unknown_error"] } };
  }
  return { ok: true, id: data.id as string };
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add lib/submit-subscription-inquiry.ts
git commit -m "feat(subscriptions): add submitSubscriptionInquiry client wrapper"
```

---

## Task 6: i18n — English namespace

**Files:**
- Modify: `messages/en.json`

- [ ] **Step 1: Add `subscriptions` namespace**

In `messages/en.json`, at the top level (alongside other namespaces like `home`, `weddings`, `checkout`), insert:

```json
"subscriptions": {
  "page_title": "Subscriptions — Diva Flowers",
  "meta_description": "Weekly and biweekly bouquet subscriptions, curated and delivered.",
  "eyebrow": "Programa · Suscripción",
  "hero": {
    "title": "Flores frescas, todas las semanas.",
    "body": "Una suscripción curada por el estudio. Cada lunes elegimos lo más bello de la semana y lo dejamos en tu puerta."
  },
  "tiers": {
    "heading": "Tres planes, una rutina",
    "popular_badge": "Most Loved",
    "per_delivery": "per delivery",
    "cta": "Choose {name}",
    "selected": "Selected"
  },
  "how": {
    "heading": "How it works",
    "step_1": { "title": "Choose a plan and cadence", "body": "Pick the size that fits your space and how often you want fresh flowers." },
    "step_2": { "title": "We curate by season", "body": "Our florists build each delivery from in-season stems — no two weeks alike." },
    "step_3": { "title": "We deliver on schedule", "body": "Hand-delivered on the day you chose, with a card if you'd like." }
  },
  "form": {
    "heading": "Start your subscription",
    "subheading": "We'll reach out within 24 hours to confirm the first delivery and arrange payment.",
    "plan_label": "Plan",
    "cadence_label": "Cadence",
    "cadence": { "weekly": "Weekly", "biweekly": "Biweekly" },
    "start_date_label": "Start date",
    "start_date_help": "First delivery — at least 2 days from today",
    "recipient_heading": "Recipient",
    "recipient_name": "Recipient name",
    "recipient_phone": "Recipient phone",
    "address_heading": "Delivery address",
    "street1": "Street",
    "street2": "Apt, suite (optional)",
    "city": "City",
    "state": "State (2 letters)",
    "zip": "ZIP",
    "window_label": "Preferred window",
    "window": {
      "morning": "Morning",
      "midday": "Midday",
      "afternoon": "Afternoon",
      "evening": "Evening"
    },
    "contact_heading": "Your contact",
    "contact_email": "Email",
    "contact_phone": "Phone",
    "card_message_label": "Recurring card message (optional)",
    "card_message_help": "Up to 500 characters. We'll write the same note on every delivery.",
    "notes_label": "Notes (optional)",
    "notes_help": "Color preferences, allergies, building access, anything we should know.",
    "submit": "Send subscription request",
    "submitting": "Sending…",
    "errors": {
      "unknown_error": "Something went wrong. Please try again.",
      "rate_limited": "Too many requests. Please try again in a moment.",
      "name_too_short": "Name is too short.",
      "phone_too_short": "Phone number is too short.",
      "email_invalid": "Please enter a valid email.",
      "street_required": "Street is required.",
      "city_required": "City is required.",
      "state_invalid": "State must be 2 letters.",
      "zip_invalid": "ZIP must be 5 digits.",
      "date_invalid": "Please pick a valid date.",
      "date_too_soon": "Start date must be at least 2 days out.",
      "card_too_long": "Card message is too long.",
      "notes_too_long": "Notes are too long."
    },
    "success_title": "We'll be in touch.",
    "success_body": "We received your subscription request. Expect an email within 24 hours to confirm the first delivery and arrange payment."
  }
}
```

- [ ] **Step 2: Validate JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('messages/en.json'))"`
Expected: no error.

- [ ] **Step 3: Run i18n keys test**

Run: `npx vitest run tests/unit/i18n-keys.test.ts`
Expected: PASS (or document keys to mirror in es).

- [ ] **Step 4: Commit**

```bash
git add messages/en.json
git commit -m "feat(subscriptions): add subscriptions i18n namespace (en)"
```

---

## Task 7: i18n — Spanish namespace

**Files:**
- Modify: `messages/es.json`

- [ ] **Step 1: Add mirror namespace**

In `messages/es.json`, at the top level, insert:

```json
"subscriptions": {
  "page_title": "Suscripciones — Diva Flowers",
  "meta_description": "Suscripciones semanales y quincenales de ramos, curadas y entregadas en casa.",
  "eyebrow": "Programa · Suscripción",
  "hero": {
    "title": "Flores frescas, todas las semanas.",
    "body": "Una suscripción curada por el estudio. Cada lunes elegimos lo más bello de la semana y lo dejamos en tu puerta."
  },
  "tiers": {
    "heading": "Tres planes, una rutina",
    "popular_badge": "Más Querido",
    "per_delivery": "por entrega",
    "cta": "Elegir {name}",
    "selected": "Seleccionado"
  },
  "how": {
    "heading": "Cómo funciona",
    "step_1": { "title": "Eliges plan y cadencia", "body": "Escoge el tamaño que cabe en tu espacio y la frecuencia con la que quieres flores frescas." },
    "step_2": { "title": "Curamos según temporada", "body": "Nuestras floristas arman cada entrega con tallos de temporada — ninguna semana es igual." },
    "step_3": { "title": "Entregamos el día acordado", "body": "Entrega a mano el día que elegiste, con tarjeta si lo prefieres." }
  },
  "form": {
    "heading": "Comienza tu suscripción",
    "subheading": "Te escribimos en 24 horas para confirmar la primera entrega y coordinar el pago.",
    "plan_label": "Plan",
    "cadence_label": "Cadencia",
    "cadence": { "weekly": "Semanal", "biweekly": "Quincenal" },
    "start_date_label": "Fecha de inicio",
    "start_date_help": "Primera entrega — mínimo 2 días desde hoy",
    "recipient_heading": "Destinatario",
    "recipient_name": "Nombre del destinatario",
    "recipient_phone": "Teléfono del destinatario",
    "address_heading": "Dirección de entrega",
    "street1": "Calle",
    "street2": "Apto, suite (opcional)",
    "city": "Ciudad",
    "state": "Estado (2 letras)",
    "zip": "Código Postal",
    "window_label": "Ventana preferida",
    "window": {
      "morning": "Mañana",
      "midday": "Mediodía",
      "afternoon": "Tarde",
      "evening": "Noche"
    },
    "contact_heading": "Tu contacto",
    "contact_email": "Email",
    "contact_phone": "Teléfono",
    "card_message_label": "Mensaje recurrente para la tarjeta (opcional)",
    "card_message_help": "Hasta 500 caracteres. Escribimos la misma nota en cada entrega.",
    "notes_label": "Notas (opcional)",
    "notes_help": "Preferencias de color, alergias, acceso al edificio, cualquier cosa que debamos saber.",
    "submit": "Enviar solicitud de suscripción",
    "submitting": "Enviando…",
    "errors": {
      "unknown_error": "Algo salió mal. Inténtalo de nuevo.",
      "rate_limited": "Demasiadas solicitudes. Inténtalo en un momento.",
      "name_too_short": "El nombre es muy corto.",
      "phone_too_short": "El número de teléfono es muy corto.",
      "email_invalid": "Ingresa un correo válido.",
      "street_required": "La calle es requerida.",
      "city_required": "La ciudad es requerida.",
      "state_invalid": "El estado debe ser de 2 letras.",
      "zip_invalid": "El código postal debe tener 5 dígitos.",
      "date_invalid": "Elige una fecha válida.",
      "date_too_soon": "La fecha de inicio debe ser al menos 2 días después de hoy.",
      "card_too_long": "El mensaje de la tarjeta es muy largo.",
      "notes_too_long": "Las notas son muy largas."
    },
    "success_title": "Estaremos en contacto.",
    "success_body": "Recibimos tu solicitud de suscripción. En 24 horas te escribimos para confirmar la primera entrega y coordinar el pago."
  }
}
```

- [ ] **Step 2: Validate JSON and i18n keys**

Run: `node -e "JSON.parse(require('fs').readFileSync('messages/es.json'))"` — Expected: no error.
Run: `npx vitest run tests/unit/i18n-keys.test.ts` — Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add messages/es.json
git commit -m "feat(subscriptions): add subscriptions i18n namespace (es)"
```

---

## Task 8: SubscriptionTierCard

**Files:**
- Create: `components/subscription/SubscriptionTierCard.tsx`

- [ ] **Step 1: Write the component**

Create `components/subscription/SubscriptionTierCard.tsx`:

```tsx
"use client";
import { memo } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { formatPrice } from "@/lib/format";
import type { Locale } from "@/types/locale";
import type { SubscriptionPlan } from "@/data/subscription-plans";

type Props = {
  locale: Locale;
  plan: SubscriptionPlan;
  selected: boolean;
  onSelect: (id: SubscriptionPlan["id"]) => void;
};

function SubscriptionTierCardImpl({ locale, plan, selected, onSelect }: Props) {
  const t = useTranslations("subscriptions.tiers");
  const name = plan.name[locale];

  return (
    <button
      type="button"
      onClick={() => onSelect(plan.id)}
      aria-pressed={selected}
      className={cn(
        "relative flex h-full flex-col gap-5 rounded-[var(--radius-bento)] border bg-bone p-6 md:p-7 text-left",
        "shadow-[var(--shadow-tile-rest)] transition-colors",
        selected ? "border-rouge ring-1 ring-rouge/40" : "border-ink/10 hover:border-ink/30",
      )}
    >
      {plan.popular && (
        <span className="absolute -top-3 left-6 rounded-full bg-rouge px-3 py-1 font-mono text-[9px] uppercase tracking-[0.18em] text-bone">
          {t("popular_badge")}
        </span>
      )}
      <div className="flex flex-col gap-1">
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-mute-500">
          {plan.id}
        </span>
        <p className="font-display text-3xl tracking-tighter leading-tight">{name}</p>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="font-display text-4xl tracking-tighter">
          {formatPrice(plan.priceCents, locale)}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-mute-500">
          {t("per_delivery")}
        </span>
      </div>
      <p className="text-sm text-ink/75 leading-relaxed">{plan.blurb[locale]}</p>
      <ul className="flex flex-col gap-1.5 text-sm text-ink/85">
        {plan.highlights.map((h, i) => (
          <li key={i} className="flex gap-2">
            <span aria-hidden className="mt-2 size-1 shrink-0 rounded-full bg-ink/40" />
            <span>{h[locale]}</span>
          </li>
        ))}
      </ul>
      <span
        className={cn(
          "mt-auto inline-flex w-fit items-center rounded-full px-4 py-2.5 font-sans text-sm font-medium tracking-tight transition-colors",
          selected ? "bg-rouge text-bone" : "bg-ink text-bone",
        )}
      >
        {selected ? t("selected") : t("cta", { name })}
      </span>
    </button>
  );
}

export const SubscriptionTierCard = memo(SubscriptionTierCardImpl);
```

- [ ] **Step 2: Verify formatPrice exists**

Run: `grep -n "export function formatPrice\|export const formatPrice" lib/format.ts`
Expected: a match. If `formatPrice` does not exist or signature differs, adapt the call to match (e.g., `formatPrice(cents)` without locale). Inspect `lib/format.ts` and adjust.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add components/subscription/SubscriptionTierCard.tsx
git commit -m "feat(subscriptions): add SubscriptionTierCard component"
```

---

## Task 9: SubscriptionTiers (with test)

**Files:**
- Create: `components/subscription/SubscriptionTiers.tsx`
- Create: `tests/unit/SubscriptionTiers.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/SubscriptionTiers.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";
import { SubscriptionTiers } from "@/components/subscription/SubscriptionTiers";

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe("SubscriptionTiers", () => {
  it("renders all three plans", () => {
    renderWithIntl(<SubscriptionTiers locale="en" selected="maison" onSelect={() => {}} />);
    expect(screen.getByText("Petit Bouquet")).toBeInTheDocument();
    expect(screen.getByText("Maison")).toBeInTheDocument();
    expect(screen.getByText("Atelier")).toBeInTheDocument();
  });

  it("shows the popular badge on Maison", () => {
    renderWithIntl(<SubscriptionTiers locale="en" selected="petit" onSelect={() => {}} />);
    expect(screen.getByText(/most loved/i)).toBeInTheDocument();
  });

  it("calls onSelect with the clicked plan id", () => {
    const onSelect = vi.fn();
    renderWithIntl(<SubscriptionTiers locale="en" selected="maison" onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: /choose atelier/i }));
    expect(onSelect).toHaveBeenCalledWith("atelier");
  });

  it("marks the selected card with aria-pressed", () => {
    renderWithIntl(<SubscriptionTiers locale="en" selected="atelier" onSelect={() => {}} />);
    const atelierBtn = screen.getByRole("button", { name: /selected/i });
    expect(atelierBtn).toHaveAttribute("aria-pressed", "true");
  });
});
```

- [ ] **Step 2: Run the test (expect failure)**

Run: `npx vitest run tests/unit/SubscriptionTiers.test.tsx`
Expected: FAIL — `SubscriptionTiers` not found.

- [ ] **Step 3: Write the component**

Create `components/subscription/SubscriptionTiers.tsx`:

```tsx
"use client";
import { memo } from "react";
import { useTranslations } from "next-intl";
import type { Locale } from "@/types/locale";
import { SUBSCRIPTION_PLANS, type SubscriptionPlanId } from "@/data/subscription-plans";
import { SubscriptionTierCard } from "@/components/subscription/SubscriptionTierCard";

type Props = {
  locale: Locale;
  selected: SubscriptionPlanId;
  onSelect: (id: SubscriptionPlanId) => void;
};

function SubscriptionTiersImpl({ locale, selected, onSelect }: Props) {
  const t = useTranslations("subscriptions.tiers");
  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 md:py-24">
      <header className="mb-10 max-w-2xl">
        <h2 className="font-display text-4xl sm:text-5xl text-ink leading-[0.95] tracking-tighter">
          {t("heading")}
        </h2>
      </header>
      <div className="grid gap-6 md:grid-cols-3 md:gap-5">
        {SUBSCRIPTION_PLANS.map((plan) => (
          <SubscriptionTierCard
            key={plan.id}
            locale={locale}
            plan={plan}
            selected={selected === plan.id}
            onSelect={onSelect}
          />
        ))}
      </div>
    </section>
  );
}

export const SubscriptionTiers = memo(SubscriptionTiersImpl);
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/unit/SubscriptionTiers.test.tsx`
Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add components/subscription/SubscriptionTiers.tsx tests/unit/SubscriptionTiers.test.tsx
git commit -m "feat(subscriptions): add SubscriptionTiers with tests"
```

---

## Task 10: SubscriptionHero

**Files:**
- Create: `components/subscription/SubscriptionHero.tsx`

- [ ] **Step 1: Write the component**

Create `components/subscription/SubscriptionHero.tsx`:

```tsx
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/types/locale";

export async function SubscriptionHero({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "subscriptions" });
  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-32 pb-12 md:pb-16">
      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink/60">{t("eyebrow")}</p>
      <h1 className="mt-3 max-w-3xl font-display text-5xl sm:text-6xl md:text-7xl text-ink leading-[0.95] tracking-tighter">
        {t("hero.title")}
      </h1>
      <p className="mt-6 max-w-xl text-ink/75 leading-relaxed">{t("hero.body")}</p>
    </section>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add components/subscription/SubscriptionHero.tsx
git commit -m "feat(subscriptions): add SubscriptionHero"
```

---

## Task 11: SubscriptionHowItWorks

**Files:**
- Create: `components/subscription/SubscriptionHowItWorks.tsx`

- [ ] **Step 1: Write the component**

Create `components/subscription/SubscriptionHowItWorks.tsx`:

```tsx
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/types/locale";

const STEPS = ["step_1", "step_2", "step_3"] as const;

export async function SubscriptionHowItWorks({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "subscriptions.how" });
  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 md:py-24 border-t border-ink/10">
      <h2 className="font-display text-4xl sm:text-5xl text-ink leading-[0.95] tracking-tighter max-w-2xl">
        {t("heading")}
      </h2>
      <ol className="mt-10 grid gap-8 md:grid-cols-3 md:gap-6">
        {STEPS.map((key, idx) => (
          <li key={key} className="flex flex-col gap-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-rouge">
              {String(idx + 1).padStart(2, "0")}
            </span>
            <p className="font-display text-2xl tracking-tighter leading-tight">
              {t(`${key}.title`)}
            </p>
            <p className="text-sm text-ink/75 leading-relaxed">{t(`${key}.body`)}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add components/subscription/SubscriptionHowItWorks.tsx
git commit -m "feat(subscriptions): add SubscriptionHowItWorks"
```

---

## Task 12: SubscriptionInquiryForm (with test)

**Files:**
- Create: `components/subscription/SubscriptionInquiryForm.tsx`
- Create: `tests/unit/SubscriptionInquiryForm.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/SubscriptionInquiryForm.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";
import { SubscriptionInquiryForm } from "@/components/subscription/SubscriptionInquiryForm";

function renderForm(plan: "petit" | "maison" | "atelier" = "maison") {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <SubscriptionInquiryForm locale="en" plan={plan} />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  global.fetch = vi.fn();
});

describe("SubscriptionInquiryForm", () => {
  it("renders required fields", () => {
    renderForm();
    expect(screen.getByLabelText(/recipient name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^email$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/start date/i)).toBeInTheDocument();
  });

  it("submits a valid payload and shows success", async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, id: "iq_test" }),
    });
    const user = userEvent.setup();
    renderForm("atelier");

    const future = new Date();
    future.setDate(future.getDate() + 5);
    const futureStr = future.toISOString().slice(0, 10);

    await user.type(screen.getByLabelText(/recipient name/i), "Lola Cardona");
    await user.type(screen.getByLabelText(/recipient phone/i), "5165550101");
    await user.type(screen.getByLabelText(/start date/i), futureStr);
    await user.type(screen.getByLabelText(/^street$/i), "1 Park Ave");
    await user.type(screen.getByLabelText(/^city$/i), "New York");
    await user.clear(screen.getByLabelText(/^state/i));
    await user.type(screen.getByLabelText(/^state/i), "NY");
    await user.type(screen.getByLabelText(/^zip$/i), "10010");
    await user.type(screen.getByLabelText(/^email$/i), "lola@example.com");
    await user.type(screen.getByLabelText(/^phone$/i), "5165550101");

    await user.click(screen.getByRole("button", { name: /send subscription request/i }));

    await waitFor(() => {
      expect(screen.getByText(/we'll be in touch/i)).toBeInTheDocument();
    });
    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/inquiry",
      expect.objectContaining({ method: "POST" }),
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.type).toBe("subscription");
    expect(body.plan).toBe("atelier");
    expect(body.cadence).toBe("weekly");
  });

  it("shows validation errors when submitting empty", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByRole("button", { name: /send subscription request/i }));
    await waitFor(() => {
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 2: Run the test (expect failure)**

Run: `npx vitest run tests/unit/SubscriptionInquiryForm.test.tsx`
Expected: FAIL — `SubscriptionInquiryForm` not found.

- [ ] **Step 3: Write the component**

Create `components/subscription/SubscriptionInquiryForm.tsx`:

```tsx
"use client";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { HoneypotField } from "@/components/inquiry/HoneypotField";
import { submitSubscriptionInquiry } from "@/lib/submit-subscription-inquiry";
import {
  subscriptionInquirySchema,
  type SubscriptionInquiry,
  type SubscriptionInquiryInput,
} from "@/schemas/subscription-inquiry";
import type { Locale } from "@/types/locale";
import type { SubscriptionPlanId } from "@/data/subscription-plans";

type Props = {
  locale: Locale;
  plan: SubscriptionPlanId;
};

const CADENCES = ["weekly", "biweekly"] as const;
const SLOTS = ["morning", "midday", "afternoon", "evening"] as const;

export function SubscriptionInquiryForm({ locale, plan }: Props) {
  const t = useTranslations("subscriptions.form");
  const [state, setState] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const form = useForm<SubscriptionInquiryInput, unknown, SubscriptionInquiry>({
    resolver: zodResolver(subscriptionInquirySchema),
    mode: "onBlur",
    defaultValues: {
      type: "subscription",
      locale,
      plan,
      cadence: "weekly",
      startDate: "",
      recipient: { name: "", phone: "" },
      address: { street1: "", street2: "", city: "", state: "NY", zip: "", country: "US" },
      window: { slot: "midday" },
      contact: { email: "", phone: "" },
      cardMessage: "",
      notes: "",
      honeypot: "",
    },
  });

  useEffect(() => {
    form.setValue("plan", plan);
  }, [plan, form]);

  async function onSubmit(values: SubscriptionInquiry) {
    setState("submitting");
    setErrorMsg(null);
    const res = await submitSubscriptionInquiry(values);
    if (!res.ok) {
      setErrorMsg(res.errors.formErrors?.[0] ?? "unknown_error");
      setState("error");
      return;
    }
    setState("success");
    form.reset();
  }

  if (state === "success") {
    return (
      <section id="inquire" className="mx-auto max-w-2xl px-4 sm:px-6 py-16 md:py-24">
        <div className="rounded-2xl border border-ink/10 bg-petal/30 p-10 text-center">
          <p className="font-display text-4xl text-ink leading-tight">{t("success_title")}</p>
          <p className="mt-4 text-ink/75">{t("success_body")}</p>
        </div>
      </section>
    );
  }

  const errors = form.formState.errors;
  const watchedCadence = form.watch("cadence");
  const watchedSlot = form.watch("window.slot");

  return (
    <section id="inquire" className="mx-auto max-w-2xl px-4 sm:px-6 py-16 md:py-24">
      <header className="mb-8">
        <h2 className="font-display text-4xl text-ink leading-[0.95] tracking-tighter">
          {t("heading")}
        </h2>
        <p className="mt-3 text-ink/70 text-sm">{t("subheading")}</p>
      </header>
      <form onSubmit={form.handleSubmit(onSubmit)} className="relative space-y-6" noValidate>
        <HoneypotField register={form.register("honeypot")} />
        <input type="hidden" {...form.register("type")} />
        <input type="hidden" {...form.register("locale")} />
        <input type="hidden" {...form.register("plan")} />

        <fieldset>
          <legend className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink/60 mb-2">
            {t("cadence_label")}
          </legend>
          <div className="grid grid-cols-2 gap-2">
            {CADENCES.map((c) => (
              <label
                key={c}
                className={`cursor-pointer rounded-xl border px-3 py-3 text-center text-sm transition-colors ${
                  watchedCadence === c
                    ? "border-rouge bg-rouge/5 text-ink"
                    : "border-ink/15 text-ink/70 hover:border-ink/30"
                }`}
              >
                <input type="radio" value={c} className="sr-only" {...form.register("cadence")} />
                {t(`cadence.${c}`)}
              </label>
            ))}
          </div>
        </fieldset>

        <Field
          label={t("start_date_label")}
          type="date"
          required
          help={t("start_date_help")}
          error={errors.startDate?.message && t(`errors.${errors.startDate.message}`)}
          {...form.register("startDate")}
        />

        <Heading>{t("recipient_heading")}</Heading>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field
            label={t("recipient_name")}
            required
            error={errors.recipient?.name?.message && t(`errors.${errors.recipient.name.message}`)}
            {...form.register("recipient.name")}
          />
          <Field
            label={t("recipient_phone")}
            type="tel"
            inputMode="tel"
            required
            error={errors.recipient?.phone?.message && t(`errors.${errors.recipient.phone.message}`)}
            {...form.register("recipient.phone")}
          />
        </div>

        <Heading>{t("address_heading")}</Heading>
        <Field
          label={t("street1")}
          required
          error={errors.address?.street1?.message && t(`errors.${errors.address.street1.message}`)}
          {...form.register("address.street1")}
        />
        <Field label={t("street2")} {...form.register("address.street2")} />
        <div className="grid sm:grid-cols-3 gap-4">
          <Field
            label={t("city")}
            required
            error={errors.address?.city?.message && t(`errors.${errors.address.city.message}`)}
            {...form.register("address.city")}
          />
          <Field
            label={t("state")}
            required
            maxLength={2}
            error={errors.address?.state?.message && t(`errors.${errors.address.state.message}`)}
            {...form.register("address.state")}
          />
          <Field
            label={t("zip")}
            required
            error={errors.address?.zip?.message && t(`errors.${errors.address.zip.message}`)}
            {...form.register("address.zip")}
          />
        </div>

        <fieldset>
          <legend className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink/60 mb-2">
            {t("window_label")}
          </legend>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {SLOTS.map((s) => (
              <label
                key={s}
                className={`cursor-pointer rounded-xl border px-3 py-3 text-center text-sm transition-colors ${
                  watchedSlot === s
                    ? "border-rouge bg-rouge/5 text-ink"
                    : "border-ink/15 text-ink/70 hover:border-ink/30"
                }`}
              >
                <input type="radio" value={s} className="sr-only" {...form.register("window.slot")} />
                {t(`window.${s}`)}
              </label>
            ))}
          </div>
        </fieldset>

        <Heading>{t("contact_heading")}</Heading>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field
            label={t("contact_email")}
            type="email"
            required
            error={errors.contact?.email?.message && t(`errors.${errors.contact.email.message}`)}
            {...form.register("contact.email")}
          />
          <Field
            label={t("contact_phone")}
            type="tel"
            inputMode="tel"
            required
            error={errors.contact?.phone?.message && t(`errors.${errors.contact.phone.message}`)}
            {...form.register("contact.phone")}
          />
        </div>

        <Textarea
          label={t("card_message_label")}
          help={t("card_message_help")}
          rows={3}
          maxLength={500}
          error={errors.cardMessage?.message && t(`errors.${errors.cardMessage.message}`)}
          {...form.register("cardMessage")}
        />

        <Textarea
          label={t("notes_label")}
          help={t("notes_help")}
          rows={3}
          maxLength={1000}
          error={errors.notes?.message && t(`errors.${errors.notes.message}`)}
          {...form.register("notes")}
        />

        {errorMsg && (
          <p className="font-mono text-[11px] text-error" role="alert">
            {t(`errors.${errorMsg}`, { default: t("errors.unknown_error") })}
          </p>
        )}

        <button
          type="submit"
          disabled={state === "submitting"}
          className="inline-flex w-full items-center justify-center rounded-full bg-ink px-6 py-4 font-sans text-sm font-medium tracking-tight text-bone transition-opacity disabled:opacity-50"
        >
          {state === "submitting" ? t("submitting") : t("submit")}
        </button>
      </form>
    </section>
  );
}

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink/60 pt-2 border-t border-ink/10">
      {children}
    </h3>
  );
}

type FieldProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  help?: string;
};
function Field({ label, error, help, id, ...rest }: FieldProps) {
  const fid = id ?? `f-${label.replace(/\s+/g, "-").toLowerCase()}`;
  const errorId = error ? `${fid}-error` : undefined;
  const helpId = help ? `${fid}-help` : undefined;
  return (
    <label htmlFor={fid} className="block">
      <span className="block font-mono text-[11px] uppercase tracking-[0.18em] text-ink/60 mb-1.5">
        {label}
      </span>
      <input
        id={fid}
        aria-describedby={[helpId, errorId].filter(Boolean).join(" ") || undefined}
        aria-invalid={!!error}
        {...rest}
        className="block w-full rounded-xl border border-ink/15 bg-bone px-4 py-3 text-base text-ink focus:outline-none focus:ring-2 focus:ring-rouge/40 focus:border-rouge"
      />
      {help && !error && (
        <span id={helpId} className="mt-1 block font-mono text-[11px] text-ink/55">
          {help}
        </span>
      )}
      {error && (
        <span id={errorId} className="mt-1 block font-mono text-[11px] text-error">
          {error}
        </span>
      )}
    </label>
  );
}

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  error?: string;
  help?: string;
};
function Textarea({ label, error, help, id, ...rest }: TextareaProps) {
  const fid = id ?? `f-${label.replace(/\s+/g, "-").toLowerCase()}`;
  const errorId = error ? `${fid}-error` : undefined;
  const helpId = help ? `${fid}-help` : undefined;
  return (
    <label htmlFor={fid} className="block">
      <span className="block font-mono text-[11px] uppercase tracking-[0.18em] text-ink/60 mb-1.5">
        {label}
      </span>
      <textarea
        id={fid}
        aria-describedby={[helpId, errorId].filter(Boolean).join(" ") || undefined}
        aria-invalid={!!error}
        {...rest}
        className="block w-full rounded-xl border border-ink/15 bg-bone px-4 py-3 text-base text-ink focus:outline-none focus:ring-2 focus:ring-rouge/40 focus:border-rouge resize-none"
      />
      {help && !error && (
        <span id={helpId} className="mt-1 block font-mono text-[11px] text-ink/55">
          {help}
        </span>
      )}
      {error && (
        <span id={errorId} className="mt-1 block font-mono text-[11px] text-error">
          {error}
        </span>
      )}
    </label>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/unit/SubscriptionInquiryForm.test.tsx`
Expected: PASS — 3 tests.

- [ ] **Step 5: Commit**

```bash
git add components/subscription/SubscriptionInquiryForm.tsx tests/unit/SubscriptionInquiryForm.test.tsx
git commit -m "feat(subscriptions): add SubscriptionInquiryForm with tests"
```

---

## Task 13: SubscriptionLanding wrapper

**Files:**
- Create: `components/subscription/SubscriptionLanding.tsx`

- [ ] **Step 1: Write the wrapper**

Create `components/subscription/SubscriptionLanding.tsx`:

```tsx
"use client";
import { useState, useCallback } from "react";
import type { Locale } from "@/types/locale";
import type { SubscriptionPlanId } from "@/data/subscription-plans";
import { SubscriptionTiers } from "@/components/subscription/SubscriptionTiers";
import { SubscriptionInquiryForm } from "@/components/subscription/SubscriptionInquiryForm";

type Props = {
  locale: Locale;
  initialPlan: SubscriptionPlanId;
  hero: React.ReactNode;
  howItWorks: React.ReactNode;
};

export function SubscriptionLanding({ locale, initialPlan, hero, howItWorks }: Props) {
  const [selected, setSelected] = useState<SubscriptionPlanId>(initialPlan);

  const handleSelect = useCallback((id: SubscriptionPlanId) => {
    setSelected(id);
    if (typeof window !== "undefined") {
      const target = document.getElementById("inquire");
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  return (
    <main>
      {hero}
      <SubscriptionTiers locale={locale} selected={selected} onSelect={handleSelect} />
      {howItWorks}
      <SubscriptionInquiryForm locale={locale} plan={selected} />
    </main>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add components/subscription/SubscriptionLanding.tsx
git commit -m "feat(subscriptions): add SubscriptionLanding wrapper"
```

---

## Task 14: Page route + loading

**Files:**
- Create: `app/[locale]/subscriptions/page.tsx`
- Create: `app/[locale]/subscriptions/loading.tsx`

- [ ] **Step 1: Write the page**

Create `app/[locale]/subscriptions/page.tsx`:

```tsx
import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { SubscriptionLanding } from "@/components/subscription/SubscriptionLanding";
import { SubscriptionHero } from "@/components/subscription/SubscriptionHero";
import { SubscriptionHowItWorks } from "@/components/subscription/SubscriptionHowItWorks";
import type { Locale } from "@/types/locale";

export async function generateMetadata({
  params,
}: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "subscriptions" });
  return {
    title: t("page_title"),
    description: t("meta_description"),
    alternates: {
      languages: {
        en: "/en/subscriptions",
        es: "/es/subscriptions",
      },
    },
  };
}

export default async function SubscriptionsPage({
  params,
}: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <SubscriptionLanding
      locale={locale}
      initialPlan="maison"
      hero={<SubscriptionHero locale={locale} />}
      howItWorks={<SubscriptionHowItWorks locale={locale} />}
    />
  );
}
```

- [ ] **Step 2: Write the loading skeleton**

Create `app/[locale]/subscriptions/loading.tsx`:

```tsx
export default function Loading() {
  return (
    <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-32 pb-24">
      <div className="h-3 w-40 rounded-full bg-ink/10 animate-pulse" />
      <div className="mt-4 h-12 w-3/4 rounded-md bg-ink/10 animate-pulse" />
      <div className="mt-6 h-4 w-1/2 rounded-md bg-ink/10 animate-pulse" />
      <div className="mt-16 grid gap-6 md:grid-cols-3">
        <div className="h-80 rounded-[var(--radius-bento)] bg-ink/5 animate-pulse" />
        <div className="h-80 rounded-[var(--radius-bento)] bg-ink/5 animate-pulse" />
        <div className="h-80 rounded-[var(--radius-bento)] bg-ink/5 animate-pulse" />
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Run the dev server, visit /en/subscriptions and /es/subscriptions**

Run: `npm run dev` (then open http://localhost:3000/en/subscriptions and http://localhost:3000/es/subscriptions)
Expected: page renders hero + three tiers + how-it-works + form. Click a tier → form's hidden `plan` field updates and page scrolls to form.

- [ ] **Step 4: Commit**

```bash
git add app/[locale]/subscriptions
git commit -m "feat(subscriptions): add /subscriptions page route"
```

---

## Task 15: Update bento tile link

**Files:**
- Modify: `components/home/BentoSubscriptionsTile.tsx`

- [ ] **Step 1: Change the href**

In `components/home/BentoSubscriptionsTile.tsx`, change:

```tsx
href={`/${locale}/shop/subscriptions`}
```

to:

```tsx
href={`/${locale}/subscriptions`}
```

- [ ] **Step 2: Type-check + run unit tests**

Run: `npx tsc --noEmit && npm test`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add components/home/BentoSubscriptionsTile.tsx
git commit -m "feat(subscriptions): point bento tile to /subscriptions landing"
```

---

## Task 16: Update sitemap

**Files:**
- Modify: `app/sitemap.ts`

- [ ] **Step 1: Replace the STATIC_PATHS list**

In `app/sitemap.ts`, change:

```ts
const STATIC_PATHS = [
  "",
  "shop",
  "shop/arrangements",
  "shop/bouquets",
  "shop/plants",
  "shop/gifts",
  "shop/sympathy",
  "shop/subscriptions",
  "weddings",
  "events",
  "story",
  "journal",
  "contact",
  "legal/privacy",
  "legal/terms",
];
```

to:

```ts
const STATIC_PATHS = [
  "",
  "shop",
  "shop/arrangements",
  "shop/bouquets",
  "shop/plants",
  "shop/gifts",
  "shop/sympathy",
  "subscriptions",
  "weddings",
  "events",
  "story",
  "journal",
  "contact",
  "legal/privacy",
  "legal/terms",
];
```

(Removed `shop/subscriptions`, added `subscriptions`. The `/shop/subscriptions` category route still exists but isn't promoted to crawlers.)

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/sitemap.ts
git commit -m "feat(subscriptions): include /subscriptions in sitemap"
```

---

## Task 17: E2E happy path

**Files:**
- Create: `tests/e2e/subscriptions.spec.ts`

- [ ] **Step 1: Write the test**

Create `tests/e2e/subscriptions.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

function plusDays(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

test("subscription inquiry submits and shows success (en)", async ({ page }) => {
  await page.goto("/en/subscriptions");

  // Click Atelier tier
  await page.getByRole("button", { name: /choose atelier/i }).click();

  // Form should be in view; fill required fields
  await page.locator("#f-recipient-name").fill("Lola Cardona");
  await page.locator("#f-recipient-phone").fill("5165550101");
  await page.locator("#f-start-date").fill(plusDays(5));
  await page.locator("#f-street").fill("1 Park Ave");
  await page.locator("#f-city").fill("New York");
  await page.locator("#f-state-(2-letters)").fill("NY");
  await page.locator("#f-zip").fill("10010");
  await page.locator("#f-email").fill("lola@example.com");
  await page.locator("#f-phone").fill("5165550101");

  await page.getByRole("button", { name: /send subscription request/i }).click();

  await expect(page.getByText(/in touch/i)).toBeVisible({ timeout: 15000 });
});

test("Spanish subscriptions page renders", async ({ page }) => {
  await page.goto("/es/subscriptions");
  await expect(page.getByText("Maison")).toBeVisible();
  await expect(page.getByRole("button", { name: /elegir atelier/i })).toBeVisible();
});
```

Note: Field IDs are derived from the English label via the `Field` component's `${label.replace(/\s+/g, "-").toLowerCase()}` rule. Verify by inspecting rendered HTML in dev mode if locators fail.

- [ ] **Step 2: Run the e2e test**

Run: `npm run e2e -- subscriptions.spec.ts`
Expected: PASS.

If a locator fails because the label-to-id transformation differs, run `npm run dev` and inspect the rendered IDs in DevTools, then update the locators in the spec.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/subscriptions.spec.ts
git commit -m "test(subscriptions): e2e happy path for inquiry submission"
```

---

## Task 18: Final verification

- [ ] **Step 1: Full test suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 2: Full e2e**

Run: `npm run e2e`
Expected: PASS.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Manual smoke**

Run: `npm run dev`
Visit:
- `/en/subscriptions` — hero, three tiers (Maison shows "Most Loved" badge), three steps, form. Click "Choose Atelier" → form scrolls into view; submitting with valid data shows "We'll be in touch."
- `/es/subscriptions` — same in Spanish.
- `/en` — bento tile "Subscriptions" links to `/en/subscriptions` (not `/en/shop/subscriptions`).

---

## Self-review notes

**Spec coverage check:**
- Hero / Tiers / How / Form sections — Tasks 10, 9, 11, 12.
- Three tiers data with localized fields, popular flag — Task 1.
- `SubscriptionCadence` reuse — schema in Task 2 reuses the same enum values.
- `subscriptionInquirySchema` discriminated by `type` literal — Task 2.
- `lib/inquiry-storage.ts` extended type union — Task 3.
- `app/api/inquiry/route.ts` discriminated union — Task 4.
- `lib/submit-subscription-inquiry.ts` — Task 5.
- i18n namespace en + es — Tasks 6, 7.
- Components Hero/Tiers/TierCard/HowItWorks/Form/Landing — Tasks 8–13.
- Page + loading — Task 14.
- Bento tile href — Task 15.
- Sitemap — Task 16.
- Tests: schema, Tiers, Form, e2e — Tasks 2, 9, 12, 17.

**Honeypot:** added to schema and form even though not in original spec — matches the existing pattern in `weddingInquirySchema`/`eventInquirySchema` and `WeddingsForm`. Spam protection is implicit in "follow the existing inquiry pattern".

**Type consistency:** `SubscriptionPlanId` used in data/component/form/wrapper. `SubscriptionInquiry`/`SubscriptionInquiryInput` used in form + lib. `Locale` from `@/types/locale` everywhere. Plan literal enum (`"petit" | "maison" | "atelier"`) appears in data, schema, and form types — synchronized.
