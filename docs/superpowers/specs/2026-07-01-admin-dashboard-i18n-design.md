# Admin dashboard i18n (en/es) + language toggle — design

**Status:** approved for plan
**Date:** 2026-07-01
**Owner:** Santiago Cardona
**Phase:** 3 polish (operational tooling parity)

## Summary

Make the **entire admin dashboard** bilingual (English + Spanish) and add a language toggle, closing the current mix where some admin surfaces already translate (login, settings, products, gift-cards, intake form) while the **dashboard** side is hardcoded Spanish (`OrderDetailDrawer`, `BandejaView`, `PendingCard`, `LedgerView`, `LedgerFilters`, `RunSheetView`, `OrderHistoryList`, `DashboardShell` nav, intake page header).

No new locale mechanism: the app already routes by URL `[locale]` and has a public `LocaleSwitcher`. We (1) externalize the ~150 hardcoded strings into next-intl message keys, (2) fix 5 date-formatting sites that hardcode `"es-US"`, and (3) surface an EN·ES toggle in the admin header. **Spanish stays the default** — nothing changes for Maky unless she toggles.

## Decisions captured during brainstorm

| Decision | Choice |
| -------- | ------ |
| Toggle mechanism | Reuse URL-locale routing + the existing `LocaleSwitcher` (switches `/es/admin ↔ /en/admin` + `NEXT_LOCALE` cookie). No separate admin-only preference. |
| Scope | The whole dashboard in one deliverable (~150 strings, ~12 components). |
| Default locale | Unchanged — Spanish default; English is opt-in via the toggle. |
| Shared locale caveat | The admin locale is the same URL/cookie locale as the public site (toggling admin also flips the public default in that browser). Acceptable for a solo operator. |
| Status labels | Fulfillment/payment/slot labels live in ONE shared namespace and are referenced from every component (DRY), not duplicated per file. |
| Dates | One shared `formatDateTime`/`formatDate` helper keyed off `useLocale()`, replacing the 5 hardcoded `"es-US"` sites. |

## Goals & non-goals

### In scope
- New namespaces in `messages/en.json` + `messages/es.json`:
  - `admin_dashboard` — `DashboardShell` nav, `BandejaView`, `PendingCard`, `RunSheetView`.
  - `admin_orders` — `OrderDetailDrawer`, `OrderHistoryList`, **and shared status/slot labels** (fulfillment statuses, payment statuses, delivery slots).
  - `admin_ledger` — `LedgerView`, `LedgerFilters`.
- Convert the listed components to `useTranslations(...)`; replace hardcoded Spanish with `t(...)`.
- `lib/format-datetime.ts` helper: `formatDateTime(iso, locale)` / `formatDate(iso, locale)` → `Intl` with `es-ES` / `en-US`. Replace the hardcoded `"es-US"`/`"es-MX"` calls in `OrderDetailDrawer`, `LedgerView`, `OrderHistoryList`, `IntakeForm`, `GiftCardsView`.
- Add the EN·ES toggle to the admin header (reuse/adapt `LocaleSwitcher`), reachable from the daily surfaces (`DashboardShell` header + intake page header).
- Tests: en/es key-parity test; update affected component tests to mock `next-intl`.

### Out of scope (deferred)
- Already-translated surfaces: `admin_login`, `admin_settings`, `admin_products`, `admin_gift_cards`, `admin_intake` (no re-translation; only their date-format sites are touched).
- A third language or an admin-only persisted language preference independent of the site locale.
- Translating server-side/system strings not shown in the admin UI (logs, error codes).
- Changing the default locale to English.

## Architecture

### Locale + toggle (no new mechanism)
- Locale comes from the URL `[locale]` segment (existing `i18n.ts` / `getRequestConfig`). Client components read it via `useLocale()` and translate via `useTranslations(ns)`.
- `components/nav/LocaleSwitcher.tsx` already switches the locale (URL replace + `NEXT_LOCALE` cookie). Reuse it (or a lighter admin-styled variant `AdminLocaleToggle`) in the admin header:
  - `DashboardShell` header (covers Bandeja / Entregas hoy / Libro).
  - The intake page's own header (`app/[locale]/admin/intake/page.tsx`).
- The switcher preserves the current admin path when swapping the locale segment.

### Message namespaces (new)
Add to BOTH `messages/en.json` and `messages/es.json`, keeping keys identical:

- **`admin_orders`** (shared, referenced widely):
  - `fulfillment_status.{pending,preparing,out-for-delivery,delivered,failed,canceled}`
  - `payment_status.{paid,pending,refunded}`
  - `slot.{morning,midday,afternoon,evening}`
  - Drawer strings: section headers (Entrega/Items/Totales/Estado/Mensajes/Notas/Historial/Saldo), buttons (Editar, Vista previa, Re-imprimir, Cash, Zelle, Preparar, En camino, Entregada, Cancelar orden, Confirmar, Volver, Marcar saldado, Agregar, Reenviar link), statuses, confirms (`reprint_confirm`), empty states, balance labels (saldo pendiente/a favor), history-entry rendering.
  - `OrderHistoryList` labels (empty state, "→" is punctuation).
- **`admin_dashboard`**:
  - `DashboardShell` nav (Bandeja, Entregas hoy, Libro de órdenes, Nueva orden, Actualizado, Actualizar).
  - `BandejaView` (Sin conexión…, Pendientes, Todo al día, Feed, Sin actividad reciente).
  - `PendingCard` (Pickup en tienda, En tienda, Ahora, HOY, action labels).
  - `RunSheetView` (Hoy, headers) — reuses `admin_orders.slot.*` + `fulfillment_status.*`.
- **`admin_ledger`**:
  - `LedgerView` (status badges reuse `admin_orders.*`; column/empty labels here).
  - `LedgerFilters` (Fecha, Pago, Cumplimiento, Fuente, Entrega + option labels reuse `admin_orders.*` where possible).

Reuse `admin_orders.fulfillment_status.*` / `payment_status.*` / `slot.*` from `LedgerFilters`, `LedgerView`, `RunSheetView`, `PendingCard`, `OrderDetailDrawer` so a status label is defined once.

### Date/locale helper — `lib/format-datetime.ts`
```ts
export function formatDateTime(iso: string, locale: string): string {
  return new Date(iso).toLocaleString(locale === "es" ? "es-ES" : "en-US", { dateStyle: "medium", timeStyle: "short" });
}
export function formatDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale === "es" ? "es-ES" : "en-US", { dateStyle: "medium" });
}
```
Callers pass `useLocale()`. Replaces the hardcoded `"es-US"`/`"es-MX"` calls.

### Component conversion pattern
Each hardcoded component:
1. `const t = useTranslations("<ns>");` and, where dates/statuses are shown, `const locale = useLocale();`.
2. Replace every hardcoded Spanish user-facing string with `t("key")` (or `t("admin_orders.fulfillment_status." + status)` via a full-namespace `useTranslations()` call at the component root, e.g. `const tf = useTranslations("admin_orders");`).
3. Replace status/slot `Record<...>` label maps with `t(...)` lookups.
4. Replace date formatting with the helper.

Server components (page wrappers) mostly need no change; the header strings in `app/[locale]/admin/intake/page.tsx` use `getTranslations` (next-intl/server) since it's a server component.

## Testing

- `tests/unit/i18n-parity.test.ts` — deep-collect all leaf key paths in `messages/en.json` and `messages/es.json`; assert the two sets are equal (catches any missing translation in either file). This is the safety net for the whole task.
- Update component tests that now call `useTranslations` to mock next-intl (`vi.mock("next-intl", () => ({ useTranslations: () => (k: string) => k, useLocale: () => "es" }))`) and assert on keys instead of Spanish literals:
  - `OrderDetailDrawer.test.tsx` (already asserts mostly on order DATA — recipient, address, totals — which stays; button-name assertions switch to keys).
  - `LedgerFilters.test.tsx`, `PendingCard.test.tsx` (retarget label assertions to keys).
- `lib/format-datetime.test.ts` — formats a fixed ISO under `es` and `en`, asserting locale-appropriate output differs.

## Implementation approach

Mechanical + wide (~12 components). Implement with **subagent-driven parallelism**: one subagent per component to convert its strings, each returning the exact set of keys it needs. A single coordinating step then writes those keys into `messages/en.json` + `messages/es.json` (both locales) to avoid parallel edits colliding on the shared message files. The shared `admin_orders` status/slot keys are authored first (dependency for the reuse). The parity test gates completion.

## Risks

| Risk | Mitigation |
| ---- | ---------- |
| Missing a translation → raw key shows in UI | `i18n-parity.test.ts` asserts en/es have identical keys; a dev-run of each admin page in both locales in the preview confirms no raw keys leak. |
| Parallel subagents collide on `messages/*.json` | Subagents return the keys they need; one central step writes both message files. |
| Retrofitting `useTranslations` breaks existing component tests (no provider) | Update those tests to mock next-intl (return the key). |
| Status labels duplicated/inconsistent across files | Single shared `admin_orders` status/slot namespace referenced everywhere. |
| Date region inconsistency (`es-US`/`es-MX`/`es-ES`) | One helper standardizes on `es-ES` / `en-US`. |
| Toggle not reachable from some admin page | Place in `DashboardShell` header + intake header (daily surfaces); other admin pages already translate and are reachable via nav. |

## File map

New files:
- `lib/format-datetime.ts`, `lib/format-datetime.test.ts`
- `tests/unit/i18n-parity.test.ts`
- (optional) `components/admin/AdminLocaleToggle.tsx` if the public `LocaleSwitcher` needs an admin-styled variant.

Modified files:
- `messages/en.json`, `messages/es.json` — add `admin_dashboard`, `admin_orders`, `admin_ledger` (identical keys).
- `components/admin/dashboard/DashboardShell.tsx` — nav strings + place the toggle.
- `components/admin/dashboard/OrderDetailDrawer.tsx` — ~45 strings + statuses + dates.
- `components/admin/dashboard/OrderHistoryList.tsx` — strings + dates.
- `components/admin/dashboard/BandejaView.tsx` — strings.
- `components/admin/dashboard/PendingCard.tsx` — strings + statuses/slots.
- `components/admin/dashboard/LedgerView.tsx` — strings + statuses + dates.
- `components/admin/dashboard/LedgerFilters.tsx` — filter labels + options.
- `components/admin/dashboard/RunSheetView.tsx` — slots + fulfillment labels.
- `components/admin/intake/IntakeForm.tsx` — date-format site → helper.
- `components/admin/gift-cards/GiftCardsView.tsx` — date-format site → helper (only).
- `app/[locale]/admin/intake/page.tsx` — header strings (server `getTranslations`) + toggle.
- Affected tests updated for the next-intl mock.
