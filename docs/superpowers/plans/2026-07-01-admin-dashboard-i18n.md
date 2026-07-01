# Admin dashboard i18n (en/es) + language toggle — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the whole admin dashboard bilingual (en/es) with an EN·ES toggle in the admin header, by externalizing ~150 hardcoded Spanish strings into next-intl keys, standardizing date formatting, and reusing the existing URL-locale routing.

**Architecture:** Locale stays URL-driven (`[locale]` segment). Client admin components adopt `useTranslations(ns)` + `useLocale()`; shared status/slot labels live once in `admin_orders`; dates go through one `lib/format-datetime.ts` helper. The public `LocaleSwitcher` is reused in the admin header. A key-parity test gates en/es symmetry.

**Tech Stack:** Next.js (customized — `AGENTS.md`), next-intl (`messages/en.json` + `messages/es.json`, `useTranslations`/`useLocale`/`getTranslations`), React client components, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-07-01-admin-dashboard-i18n-design.md`

**Conventions (verified):**
- Message files: `messages/en.json` and `messages/es.json`; admin namespaces are top-level objects (e.g. `admin_intake`, `admin_gift_cards`). Keys must be **identical** across both files.
- Client component gets locale two ways: `useLocale()` (from next-intl) OR a `locale` prop (e.g. `DashboardShell`). Use whichever the component already has.
- Component tests mock next-intl: `vi.mock("next-intl", () => ({ useTranslations: () => (k: string) => k, useLocale: () => "es" }))`; assert on returned KEY strings.
- `LocaleSwitcher` (`components/nav/LocaleSwitcher.tsx`) takes `{ current: Locale }`, swaps `pathname` segment `[1]`, sets `NEXT_LOCALE` cookie — reuse as-is.
- Run one test file: `npm test -- tests/unit/<file>`

**Baseline:** the 5 known pre-existing failures (3× `checkout-schema` past date; `print-chromium`/`_preview`/`print-render` Chromium). Ignore them.

---

## The conversion pattern (every component task follows this)

For a hardcoded-Spanish client component:
1. Add `import { useTranslations } from "next-intl";` and, if it shows dates/statuses, `import { useLocale } from "next-intl";`.
2. At the top of the component: `const t = useTranslations("<ns>");` (and `const locale = useLocale();` if needed — unless the component already receives a `locale` prop).
3. Replace each hardcoded user-facing Spanish literal with `t("key")`. Add the `key` (with English + Spanish values) to BOTH `messages/en.json` and `messages/es.json` under `<ns>`.
4. Replace status/slot label maps (e.g. `Record<Status, string>`) with `t("admin_orders.fulfillment_status." + status)` etc. — reuse the shared keys from Task 1 (call `useTranslations("admin_orders")` as a second `t`, e.g. `const to = useTranslations("admin_orders");`).
5. Replace `toLocaleString("es-US")`/`toLocaleDateString(...)` with `formatDateTime(iso, locale)` / `formatDate(iso, locale)` from Task 2.
6. Update the component's test to mock next-intl (if it doesn't already) and assert on keys.

Task 4 (DashboardShell) is the fully-worked reference — read it before doing Tasks 5–11.

---

## Task 1: Shared `admin_orders` status/slot keys (reuse foundation)

**Files:** Modify `messages/en.json`, `messages/es.json`
**Test:** covered by Task 3 parity + used by later tasks.

- [ ] **Step 1: Add the `admin_orders` namespace to `messages/en.json`**

Add a new top-level key `"admin_orders"` (next to the other `admin_*` namespaces). English values:

```json
"admin_orders": {
  "fulfillment_status": {
    "pending": "Received",
    "preparing": "Preparing",
    "out-for-delivery": "Out for delivery",
    "delivered": "Delivered",
    "failed": "Failed",
    "canceled": "Canceled"
  },
  "payment_status": {
    "paid": "Paid",
    "pending": "Pending",
    "refunded": "Refunded"
  },
  "slot": {
    "morning": "Morning",
    "midday": "Midday",
    "afternoon": "Afternoon",
    "evening": "Evening"
  }
}
```

- [ ] **Step 2: Add the same namespace to `messages/es.json` (identical keys, Spanish values)**

```json
"admin_orders": {
  "fulfillment_status": {
    "pending": "Recibida",
    "preparing": "Preparando",
    "out-for-delivery": "En camino",
    "delivered": "Entregada",
    "failed": "Fallida",
    "canceled": "Cancelada"
  },
  "payment_status": {
    "paid": "Pagado",
    "pending": "Pendiente",
    "refunded": "Reembolsado"
  },
  "slot": {
    "morning": "Mañana",
    "midday": "Mediodía",
    "afternoon": "Tarde",
    "evening": "Noche"
  }
}
```

- [ ] **Step 3: Validate JSON**

Run: `node -e "require('./messages/en.json'); require('./messages/es.json'); console.log('json ok')"`
Expected: `json ok`

- [ ] **Step 4: Commit**

```bash
git add messages/en.json messages/es.json
git commit -m "i18n(admin): shared admin_orders status/slot labels (en+es)"
```

> More keys are added to `admin_orders` (drawer/history strings) in Task 5. Task 1 is only the shared status/slot foundation the other components reuse.

---

## Task 2: Date/locale helper

**Files:** Create `lib/format-datetime.ts`, `tests/unit/format-datetime.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/unit/format-datetime.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { formatDateTime, formatDate } from "@/lib/format-datetime";

const iso = "2026-07-04T15:30:00.000Z";

describe("format-datetime", () => {
  it("formats a datetime differently per locale", () => {
    const en = formatDateTime(iso, "en");
    const es = formatDateTime(iso, "es");
    expect(en).toBeTruthy();
    expect(es).toBeTruthy();
    expect(en).not.toBe(es); // month name / order differs
  });
  it("formats a date-only value", () => {
    expect(formatDate(iso, "en")).toBeTruthy();
    expect(formatDate("2026-07-04", "es")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (module missing) — `npm test -- tests/unit/format-datetime.test.ts`

- [ ] **Step 3: Implement `lib/format-datetime.ts`**

```ts
// Locale-aware date/time formatting for the admin UI. Pass the current locale
// (from useLocale()). Standardizes on es-ES / en-US.
function intlLocale(locale: string): string {
  return locale === "es" ? "es-ES" : "en-US";
}

export function formatDateTime(iso: string, locale: string): string {
  return new Date(iso).toLocaleString(intlLocale(locale), { dateStyle: "medium", timeStyle: "short" });
}

export function formatDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(intlLocale(locale), { dateStyle: "medium" });
}
```

- [ ] **Step 4: Run — expect PASS** — `npm test -- tests/unit/format-datetime.test.ts`

- [ ] **Step 5: Commit**

```bash
git add lib/format-datetime.ts tests/unit/format-datetime.test.ts
git commit -m "feat(admin): locale-aware date formatting helper"
```

---

## Task 3: en/es key-parity test (the completeness gate)

**Files:** Create `tests/unit/i18n-parity.test.ts`

- [ ] **Step 1: Write the test**

`tests/unit/i18n-parity.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import en from "@/messages/en.json";
import es from "@/messages/es.json";

function leafKeys(obj: unknown, prefix = ""): string[] {
  if (obj && typeof obj === "object" && !Array.isArray(obj)) {
    return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
      leafKeys(v, prefix ? `${prefix}.${k}` : k),
    );
  }
  return [prefix];
}

describe("i18n en/es parity", () => {
  it("en.json and es.json have identical key paths", () => {
    const enKeys = new Set(leafKeys(en));
    const esKeys = new Set(leafKeys(es));
    const missingInEs = [...enKeys].filter((k) => !esKeys.has(k));
    const missingInEn = [...esKeys].filter((k) => !enKeys.has(k));
    expect({ missingInEs, missingInEn }).toEqual({ missingInEs: [], missingInEn: [] });
  });
});
```

- [ ] **Step 2: Run it**

Run: `npm test -- tests/unit/i18n-parity.test.ts`

- [ ] **Step 3: Fix any PRE-EXISTING mismatch it reports**

If the test lists keys present in one file but not the other (pre-existing drift — the Explore map noted `admin_intake` differs by ~2 lines between files), add the missing key(s) to the file that lacks them, translating appropriately, until the test passes. This establishes the green baseline every later task must keep.

- [ ] **Step 4: Commit**

```bash
git add tests/unit/i18n-parity.test.ts messages/en.json messages/es.json
git commit -m "test(i18n): en/es key-parity gate (+ fix pre-existing drift)"
```

> Importing JSON in Vitest works via the project's TS config (`resolveJsonModule`). If the import errors, use `import en from "../../messages/en.json"` relative paths.

---

## Task 4: `DashboardShell` — worked example (nav strings + the toggle)

**Files:** Modify `components/admin/dashboard/DashboardShell.tsx`, `messages/en.json`, `messages/es.json`
**Test:** `tests/unit/components/DashboardShell.test.tsx` (create)

This is the reference conversion. It uses a `locale` prop (no `useLocale()` needed) and adds the `LocaleSwitcher` to the header.

- [ ] **Step 1: Add `admin_dashboard` nav keys to both message files**

To `admin_dashboard` (create the namespace) in `messages/en.json`:
```json
"admin_dashboard": {
  "nav_bandeja": "Inbox",
  "nav_run_sheet": "Deliveries today",
  "nav_ledger": "Order book",
  "nav_gift_cards": "Gift Cards",
  "nav_new_order": "New order",
  "last_updated": "Updated",
  "refresh": "Refresh"
}
```
and in `messages/es.json`:
```json
"admin_dashboard": {
  "nav_bandeja": "Bandeja",
  "nav_run_sheet": "Entregas hoy",
  "nav_ledger": "Libro de órdenes",
  "nav_gift_cards": "Gift Cards",
  "nav_new_order": "Nueva orden",
  "last_updated": "Actualizado",
  "refresh": "Actualizar"
}
```

- [ ] **Step 2: Convert `DashboardShell.tsx`**

Add imports:
```tsx
import { useTranslations } from "next-intl";
import { LocaleSwitcher } from "@/components/nav/LocaleSwitcher";
import type { Locale } from "@/types/locale";
```
At the top of the component body: `const t = useTranslations("admin_dashboard");`
Replace the nav link texts: `Bandeja` → `{t("nav_bandeja")}`, `Entregas hoy` → `{t("nav_run_sheet")}`, `Libro de órdenes` → `{t("nav_ledger")}`, `Gift Cards` → `{t("nav_gift_cards")}`, `Nueva orden` (after the `<Plus/>`) → `{t("nav_new_order")}`.
Replace `Actualizado: {lastUpdated}` → `{t("last_updated")}: {lastUpdated}` and the `Actualizar` button text → `{t("refresh")}`.
Add the toggle inside the right-aligned `ml-auto` group (before or after the refresh button):
```tsx
          <div className="ml-auto flex items-center gap-3 text-xs text-ink/60">
            <LocaleSwitcher current={locale as Locale} />
            {lastUpdated && <span>{t("last_updated")}: {lastUpdated}</span>}
            {onRefresh && (
              <button onClick={onRefresh} className="flex min-h-11 items-center gap-1 rounded-lg border border-ink/20 px-3 hover:bg-ink/5">
                <ArrowsClockwise size={16} weight="bold" /> {t("refresh")}
              </button>
            )}
          </div>
```

- [ ] **Step 3: Write the test**

`tests/unit/components/DashboardShell.test.tsx`:
```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import DashboardShell from "@/components/admin/dashboard/DashboardShell";

vi.mock("next-intl", () => ({ useTranslations: () => (k: string) => k }));
vi.mock("next/navigation", () => ({ usePathname: () => "/es/admin/dashboard" }));
vi.mock("@/components/nav/LocaleSwitcher", () => ({ LocaleSwitcher: () => <button>EN · ES</button> }));

describe("DashboardShell", () => {
  it("renders translated nav keys + the locale toggle", () => {
    render(<DashboardShell locale="es"><div>content</div></DashboardShell>);
    expect(screen.getByText("nav_bandeja")).toBeInTheDocument();
    expect(screen.getByText("nav_ledger")).toBeInTheDocument();
    expect(screen.getByText("EN · ES")).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Run — expect PASS** — `npm test -- tests/unit/components/DashboardShell.test.tsx`

- [ ] **Step 5: Parity + commit**

```bash
npm test -- tests/unit/i18n-parity.test.ts
git add components/admin/dashboard/DashboardShell.tsx messages/en.json messages/es.json tests/unit/components/DashboardShell.test.tsx
git commit -m "i18n(admin): DashboardShell nav + LocaleSwitcher toggle"
```

---

## Tasks 5–11: per-component conversions (subagent per component)

Each task follows **the conversion pattern** and the Task 4 worked example. For each: convert the component, add its keys to BOTH message files, reuse `admin_orders.fulfillment_status.*` / `payment_status.*` / `slot.*` for statuses/slots, swap dates to the Task 2 helper, update the component's test to mock next-intl, then run `npm test -- tests/unit/i18n-parity.test.ts` and the component test, and commit.

Dispatch each as a subagent with this brief: *"Read the file. Externalize EVERY user-facing Spanish literal (buttons, labels, section headers, statuses, empty states, confirm dialogs, aria-labels) into next-intl keys under `<ns>`. Reuse `admin_orders` status/slot keys for status/slot text. Replace date formatting with `formatDateTime`/`formatDate` from `@/lib/format-datetime` (using `useLocale()`). Add every new key to BOTH `messages/en.json` and `messages/es.json` with identical paths (English + Spanish). Update the component's test to `vi.mock('next-intl', ...)` returning the key and assert on keys. Do NOT touch order DATA rendering (customer names, addresses, prices). Return the list of {keyPath, en, es} you added."*

### Task 5: `OrderDetailDrawer.tsx` → `admin_orders` (largest, ~45 strings)
- **Files:** `components/admin/dashboard/OrderDetailDrawer.tsx`, `components/admin/dashboard/OrderEditForm.tsx` (its inline Spanish labels: "Contacto", "Teléfono", "Nombre", "Email", "Guardando…", "Guardar cambios", "Cancelar"), `messages/en.json`, `messages/es.json`, `tests/unit/components/OrderDetailDrawer.test.tsx`.
- Known strings to externalize (checklist, not exhaustive — externalize ALL): `FULFILLMENT_STEPS` labels → `admin_orders.fulfillment_status.*`; section headers `Entrega`, `Items`, `Totales`, `Estado`, `Mensajes`, `Notas internas`, `Historial`; buttons `Editar`, `Vista previa`, `Re-imprimir`, `Cerrar`, `Cash`, `Zelle`, `Reenviar link`, `Preparar`, `En camino`, `Entregada`, `Cancelar orden`, `Confirmar cancelación`, `Volver`, `WhatsApp`, `Agregar`, `Marcar saldado`; payment line `Pagado (…)`/`Reembolsado`/`Pendiente` → `admin_orders.payment_status.*`; balance chips `Saldo pendiente`/`Saldo a favor`; empty states `Sin items.`, `Ninguno todavía.`, `Cargando…`, `Orden cancelada`; the `window.confirm("¿Re-imprimir esta orden?")` → `t("reprint_confirm")`; delivery/pickup/in-store method words. Date at line ~35 → `formatDateTime(ts, locale)`.
- The existing test asserts mostly on order DATA (recipient, address, `$118.80`) which stays; retarget any button-name assertions (`Cash`, `Preparar`, `Entregada`) to their new keys, and add the next-intl mock.
- `OrderDetailDrawer` gets `const locale = useLocale();` for dates.

### Task 6: `OrderHistoryList.tsx` → `admin_orders`
- **Files:** `components/admin/dashboard/OrderHistoryList.tsx`, message files, `tests/unit/components/OrderHistoryList.test.tsx`.
- Strings: empty state `Sin cambios todavía.` → `admin_orders.history_empty`. Date (`fmtTs`, line ~4) → `formatDateTime(c.at, locale)` with `const locale = useLocale();`. The `→` between before/after is punctuation (leave). The test currently asserts on the summary/diff DATA (stays) and `Sin cambios` → retarget to key.

### Task 7: `BandejaView.tsx` → `admin_dashboard`
- **Files:** `components/admin/dashboard/BandejaView.tsx`, message files, its test if any.
- Strings: `Sin conexión — mostrando datos anteriores.`, `Pendientes`, `Todo al día`, `Feed`, `Sin actividad reciente.`, any header/aria. Keys under `admin_dashboard` (e.g. `offline`, `pending_title`, `all_caught_up`, `feed_title`, `feed_empty`).

### Task 8: `PendingCard.tsx` → `admin_dashboard`
- **Files:** `components/admin/dashboard/PendingCard.tsx`, message files, `tests/unit/components/PendingCard.test.tsx`.
- Strings: `Pickup en tienda`, `En tienda`, `Ahora`, `HOY`, action labels (`Reenviar link`, `Marcar pagado`, `Preparar`, `En camino`, etc.). Reuse `admin_orders.fulfillment_status.*`/`slot.*` for status/slot; card-specific words under `admin_dashboard`. Retarget the existing test's label assertions to keys + add the mock (the test already mocks next-intl per the map — verify).

### Task 9: `LedgerView.tsx` → `admin_ledger` (+ `admin_orders` statuses)
- **Files:** `components/admin/dashboard/LedgerView.tsx`, message files, its test if any.
- Strings: `FUL_LABEL` record → `admin_orders.fulfillment_status.*`; payment badges → `admin_orders.payment_status.*`; column/empty labels under `admin_ledger`. Date (line ~49) → `formatDate`/`formatDateTime` with `useLocale()`.

### Task 10: `LedgerFilters.tsx` → `admin_ledger` (+ `admin_orders`)
- **Files:** `components/admin/dashboard/LedgerFilters.tsx`, message files, `tests/unit/components/LedgerFilters.test.tsx`.
- Strings: group labels `Fecha`, `Pago`, `Cumplimiento`, `Fuente`, `Entrega`; the `PAY_OPTIONS`/`FUL_OPTIONS`/source/method option labels → reuse `admin_orders.payment_status.*` / `fulfillment_status.*` where they match; ledger-specific under `admin_ledger`. Retarget the existing test to keys + ensure the mock.

### Task 11: `RunSheetView.tsx` → `admin_dashboard` (+ `admin_orders`)
- **Files:** `components/admin/dashboard/RunSheetView.tsx`, message files, its test if any.
- Strings: `SLOT_LABEL` → `admin_orders.slot.*`; `FUL_LABEL` → `admin_orders.fulfillment_status.*`; `Hoy` button + headers under `admin_dashboard`. Any date → helper.

For EACH of Tasks 5–11: after conversion, run `npm test -- tests/unit/i18n-parity.test.ts` (must stay green) and the component's own test, then commit `i18n(admin): <component>`.

---

## Task 12: Date-format-only fixes (no new strings)

**Files:** `components/admin/intake/IntakeForm.tsx`, `components/admin/gift-cards/GiftCardsView.tsx`

- [ ] **Step 1: `IntakeForm.tsx`** — replace the header date `new Date().toLocaleString(locale === "es" ? "es-MX" : "en-US")` (line ~226) with `formatDateTime(new Date().toISOString(), locale)` (it already has `const locale = useLocale()`).

- [ ] **Step 2: `GiftCardsView.tsx`** — replace its `toLocaleDateString(locale === "es" ? "es-ES" : "en-US")` (line ~133) with `formatDate(<iso>, locale)` for consistency (it already resolves the locale). No string changes.

- [ ] **Step 3: Verify + commit**

Run: `npm test -- tests/unit/format-datetime.test.ts` and `npx tsc --noEmit`
```bash
git add components/admin/intake/IntakeForm.tsx components/admin/gift-cards/GiftCardsView.tsx
git commit -m "refactor(admin): route remaining date formatting through the locale helper"
```

---

## Task 13: Intake page header (server component)

**Files:** `app/[locale]/admin/intake/page.tsx`, message files

- [ ] **Step 1: Read the file** to confirm it is a server component. Its hardcoded strings: `← Bandeja` and `Nueva orden` (header). Add keys to `admin_dashboard`: `intake_back` ("← Inbox" / "← Bandeja"), `intake_title` ("New order" / "Nueva orden"). (If `intake_title` duplicates the intake form's own title, reuse the existing `admin_intake.title_new`.)

- [ ] **Step 2: Translate**

If server component: `import { getTranslations } from "next-intl/server";` then `const t = await getTranslations("admin_dashboard");` and replace the literals with `t("...")`. If it is a client component, use `useTranslations` instead. Place a `LocaleSwitcher` in this header too (`current={locale as Locale}`; the page already has the `locale` param).

- [ ] **Step 3: Parity + commit**

```bash
npm test -- tests/unit/i18n-parity.test.ts
git add "app/[locale]/admin/intake/page.tsx" messages/en.json messages/es.json
git commit -m "i18n(admin): intake page header + toggle"
```

---

## Final verification

- [ ] **Parity green:** `npm test -- tests/unit/i18n-parity.test.ts` → pass (en/es identical keys).
- [ ] **Full suite:** `npm test` → only the 5 documented baseline failures remain; every updated component test passes. Fix any other failure (usually a test still asserting a Spanish literal instead of its key).
- [ ] **Typecheck:** `npx tsc --noEmit` → exit 0.
- [ ] **Preview (both locales):** start the dev server, log in, and visit `/es/admin/dashboard` then `/en/admin/dashboard` (open the order drawer, ledger, run-sheet, a pending card). Confirm: (a) EN·ES toggle present in the header and switches the whole admin; (b) NO raw keys leak (e.g. `nav_bandeja`, `admin_orders.fulfillment_status.pending`) in either locale; (c) dates render in the locale's format. Use the harness preview workflow.
- [ ] Hand to the finishing-a-development-branch skill.

---

## Notes for the implementer

- **Identical keys in both files** is the hard rule — the parity test fails otherwise. Add English AND Spanish for every new key in the same task.
- **Reuse, don't duplicate** status/slot labels: `admin_orders.fulfillment_status.*`, `payment_status.*`, `slot.*` are the single source; other namespaces reference them via a `useTranslations("admin_orders")` call.
- **Don't translate DATA** — customer names, addresses, product titles, money, card messages are order data, not UI chrome.
- **AGENTS.md**: customized Next.js — prefer in-repo patterns; `getTranslations` for server components, `useTranslations` for client.
- Spanish stays the default locale; do not change the app's default.
