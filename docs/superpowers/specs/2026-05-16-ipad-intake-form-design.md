# iPad intake form — design (Phase 1)

**Status:** draft for review
**Date:** 2026-05-16
**Owner:** Santiago Cardona
**Phase:** 1 of 4 (roadmap below)

## Summary

A staff-facing order intake form, optimized for iPad, that captures walk-in, phone, WhatsApp, and event orders and feeds them into the same pipeline that already powers the web checkout — same print queue, same branded email, same data store. This is the foundation for a longer roadmap of automations (payment links, SMS, dashboard, CRM, accounting). Phase 1 ships the form, migrates persistence from JSON files to SQLite, and seeds a customer table for auto-fill on repeat callers. It does **not** generate Stripe links, send SMS, build a dashboard, or implement a CRM UI — those are Phases 2-4.

## Roadmap (context)

| Phase | Scope                                                  |
| ----- | ------------------------------------------------------ |
| **1** | **iPad intake form + SQLite migration + customers seed** (this spec) |
| 2     | Stripe payment links + SMS/WhatsApp confirmations      |
| 3     | Day dashboard + delivery route + driver app + Calendar |
| 4     | Full CRM + one-tap reorder + accounting export         |

Each later phase gets its own brainstorm → spec → plan cycle.

## Goals & non-goals

### In scope (Phase 1)
- New protected route `/admin/intake` for entering orders from the iPad
- One-page form that adapts to walk-in (immediate), walk-in (delivery), pickup, phone, WhatsApp, and event scenarios
- Catalog product picker + custom one-off arrangement items
- Auto-lookup of returning customers by phone number (auto-fills name, email, last address)
- Payment method capture (cash, Zelle, terminal card, ACH, "stripe" as manual label, or "pending")
- Triggers existing print pipeline (tri-fold ticket) and existing branded email (when email is present)
- Migration of `pending-orders.json` and `print-queue.json` to a single SQLite database
- Customer table seeded for use in later phases
- Simple password-based auth on `/admin/*` routes

### Out of scope (deferred)
- Stripe payment link generation from the form — Phase 2
- SMS / WhatsApp customer notifications — Phase 2
- Day-of dashboard, route view, driver mobile UI, Google Calendar sync — Phase 3
- CRM UI (customer history, birthdays, segmentation) — Phase 4
- One-tap reorder, accounting export, daily close — Phase 4
- Multi-user roles, per-employee PIN, audit trail of who took the order
- Offline / PWA support (shop wifi is reliable)
- Native iOS app — Safari on the existing Next.js site is the runtime

## Decisions captured during brainstorm

| Decision               | Choice                                                     |
| ---------------------- | ---------------------------------------------------------- |
| Scenarios covered      | Walk-in (immediate + delivery), phone, WhatsApp, event     |
| Users                  | Maky only; persistent login, no audit trail                |
| Custom arrangements    | Yes — catalog picker + freeform custom item with notes     |
| Payment methods        | Cash, Zelle, terminal card, ACH, Stripe (manual), Pending  |
| Pending payment OK?    | Yes — manual follow-up acceptable until Phase 2            |
| Connectivity           | Stable wifi — no PWA / offline queue needed                |
| Persistence            | Migrate JSON files → SQLite (`better-sqlite3`, file-based) |
| Field rename           | `order.delivery` → `order.fulfillment` across codebase     |

## Architecture

The iPad form is **not a parallel system**. It is a second entry point to the same pipeline the web checkout already uses. When `saveOrder(order)` is called — whether from `/api/checkout/intent` (web) or `/api/admin/orders` (iPad) — both paths run through the same print enqueue and email notification. This is what allows Phase 3's dashboard to query "today's orders" without caring about origin.

```
   [iPad - Safari]                       [Web - end customer]
          │                                      │
          ▼                                      ▼
/admin/intake (NEW)                  /[locale]/checkout (existing)
          │                                      │
          └──────────┬───────────────────────────┘
                     │
                     ▼
          ┌─────────────────────┐
          │  saveOrder(order)   │  ◄── lib/order-storage.ts
          │  (same API)         │       INTERNALS CHANGE
          └─────────────────────┘       JSON → SQLite
                     │
          ┌──────────┼──────────┐
          ▼          ▼          ▼
   enqueuePrint  sendEmail   (future: SMS, Stripe link)
   (existing)    (existing)
          │          │
          ▼          ▼
   Windows agent  Resend
   prints ticket  sends email
```

### New files
- `app/[locale]/admin/intake/page.tsx` — the iPad screen
- `app/[locale]/admin/login/page.tsx` — login page
- `app/api/admin/orders/route.ts` — POST creates an intake order
- `app/api/admin/customers/lookup/route.ts` — GET by phone
- `app/api/admin/session/route.ts` — POST login / DELETE logout
- `lib/admin-auth.ts` — cookie signing, middleware helper
- `lib/customer-storage.ts` — `getByPhone`, `upsertOnOrder`
- `lib/db.ts` — `better-sqlite3` connection + migrations runner
- `db/migrations/001_init.sql` — initial schema
- `scripts/migrate-orders-json-to-sqlite.ts` — one-shot historical import
- `scripts/db-backup.ts` — manual `.sqlite` snapshot (cron comes in Phase 3)
- `components/admin/intake/*` — form parts (CustomerBlock, FulfillmentBlock, ProductPicker, CartSummary, PaymentBlock, IntakeForm)
- `schemas/intake.ts` — Zod schema for the intake POST body
- `middleware.ts` — gates `/admin/*` and `/api/admin/*` (Next.js middleware)

### Reused (behavior unchanged)
- `lib/order-storage.ts` — same exported functions, internals swap to SQLite
- `lib/print-queue.ts` — same exported functions, internals swap to SQLite
- `lib/order-notifications.ts` — branded email (skipped when no email)
- `lib/totals.ts` — subtotal / delivery / tax math
- `lib/delivery-zones.ts` — zone-based fees
- `data/products.ts` — catalog source for the picker
- `types/order.ts` — extended (additive + the one rename)

## Data model

### `orders` (extends current type)
```sql
CREATE TABLE orders (
  id              TEXT PRIMARY KEY,         -- "do_..." (same format as today)
  locale          TEXT NOT NULL,
  source          TEXT NOT NULL,            -- "web" | "walk-in" | "phone" | "whatsapp" | "event"
  customer_id     TEXT,                     -- FK to customers, nullable for anonymous walk-ins
  recipient_name  TEXT NOT NULL,
  recipient_phone TEXT NOT NULL,
  contact_email   TEXT,                     -- now optional
  contact_phone   TEXT NOT NULL,
  fulfillment_method TEXT NOT NULL,         -- "delivery" | "pickup" | "in-store"
  address_json    TEXT,                     -- JSON if delivery
  window_date     TEXT,                     -- YYYY-MM-DD if delivery/pickup
  window_slot     TEXT,                     -- "morning" | "midday" | "afternoon" | "evening"
  card_message    TEXT,
  lines_json      TEXT NOT NULL,            -- CartLine[] incl. custom variant
  subtotal_cents  INTEGER NOT NULL,
  delivery_cents  INTEGER NOT NULL,
  tax_cents       INTEGER NOT NULL,
  total_cents     INTEGER NOT NULL,
  fulfillment_status TEXT NOT NULL,         -- "pending" | "preparing" | "out-for-delivery" | "delivered" | "failed" | "canceled"
  payment_status  TEXT NOT NULL,            -- "paid" | "pending" | "refunded"
  payment_method  TEXT,                     -- "cash" | "zelle" | "card-terminal" | "ach" | "stripe" | NULL
  paid_at         TEXT,                     -- ISO timestamp when marked paid
  stripe_payment_intent_id TEXT,
  taken_by        TEXT,                     -- "maky" for now
  internal_notes  TEXT,                     -- private designer notes
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);

CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX idx_orders_payment_status ON orders(payment_status);
CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_window_date ON orders(window_date);
CREATE INDEX idx_orders_stripe_pi ON orders(stripe_payment_intent_id);
```

### `customers` (CRM seed)
```sql
CREATE TABLE customers (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  phone             TEXT NOT NULL UNIQUE,   -- normalized digits only
  email             TEXT,
  last_address_json TEXT,
  order_count       INTEGER NOT NULL DEFAULT 0,
  first_seen_at     TEXT NOT NULL,
  last_seen_at      TEXT NOT NULL
);

CREATE INDEX idx_customers_phone ON customers(phone);
```

### `print_jobs` (migration of `print-queue.json`)
Same fields as the current `PrintJob` type — moved to a table to allow queries from the future dashboard.

### TypeScript extensions to `types/order.ts`
```ts
export type OrderSource = "web" | "walk-in" | "phone" | "whatsapp" | "event";
export type PaymentMethod = "cash" | "zelle" | "card-terminal" | "ach" | "stripe";
export type PaymentStatus = "paid" | "pending" | "refunded";
// Existing OrderStatus minus "paid" (which now lives in PaymentStatus).
export type FulfillmentStatus =
  | "pending" | "preparing" | "out-for-delivery" | "delivered" | "failed" | "canceled";

// CartLine becomes a discriminated union to support custom items.
export type CartLine =
  | { kind: "catalog"; productId: string; variantId: string; addOnIds: string[]; qty: number }
  | { kind: "custom"; title: string; priceCents: number; designerNotes?: string; qty: number };

export type Order = {
  id: string;
  source: OrderSource;             // new — default "web" in existing checkout path
  locale: "en" | "es";
  customerId?: string;             // new
  lines: CartLine[];
  fulfillment: OrderFulfillment;   // renamed from `delivery`; now includes "in-store"
  contact: { email?: string; phone: string };   // email now optional
  totals: OrderTotals;
  paymentStatus: PaymentStatus;    // new
  paymentMethod?: PaymentMethod;   // new
  paidAt?: string;                 // new
  status: FulfillmentStatus;       // renamed from OrderStatus; "paid" moved to paymentStatus
  stripePaymentIntentId?: string;
  takenBy?: string;                // new
  internalNotes?: string;          // new
  createdAt: string;
  updatedAt: string;               // new
};
```

The rename `delivery` → `fulfillment` is a mechanical find-and-replace across API routes, components, and the email template. It is intentional: a field called `delivery.method = "in-store"` is misleading.

**Naming overlap note:** The TypeScript `Order.fulfillment` field is the discriminated union with method + recipient + address + window. In SQL we flatten this — the method goes to `fulfillment_method`, the rest become their own columns (`address_json`, `recipient_name`, `window_date`, ...). Serialization happens in `lib/order-storage.ts`.

**Status separation:** Today's `OrderStatus` conflates payment and fulfillment ("paid" and "delivered" both terminal). We split into `PaymentStatus` ("paid" | "pending" | "refunded") and `FulfillmentStatus` (the rest). Existing rows are migrated by mapping: `paid` → `{ paymentStatus: "paid", status: "preparing" }`; all other statuses keep their meaning under `status` with `paymentStatus` derived from whether `stripePaymentIntentId` settled.

## UI

One scrollable page. Adapts in place — no wizard, no step counter. Optimized for iPad in landscape (1024-1180px) but degrades to portrait via stacked columns.

### Layout
- **Top bar:** channel chips (Walk-in / Phone / WhatsApp / Event), order ID, timestamp
- **Left column:** Customer (phone + name + optional email + recurring-customer hint) · Fulfillment type segmented control (Take it now / Delivery / Pickup) · address + window fields shown conditionally · Card message
- **Right column:** Product search + "+ Custom" button · 3-column catalog grid · Cart summary · Totals (with override-on-tap) · Payment chips
- **Sticky bottom bar:** Discard (ghost) and Save & Print Ticket (primary)

### Brand
- Background: `--color-bone` (#FAF6F0)
- Frame: elevated white card with soft shadow, `--radius-bento` (1.5rem)
- Display headings and totals: Fraunces (existing site display font)
- UI text: Inter / Cabinet Grotesk
- Accents (recurring-customer hint, custom items, delivery zone): `--color-rouge` (#B8345E)
- Primary button: ink black, hover → rouge
- Pending payment chip: warn amber, dashed border (soft alert, not error)

### Key behaviors
- **Channel switch labels the order** (`source`) but does not hide fields — Maky decides what to fill
- **Phone auto-lookup** debounced 300ms; if a `customers` row matches, show "Recurring customer · N prior orders · last: <city> · use last address" with a tap to apply
- **3-way fulfillment toggle** — "Take it now" hides recipient/address/window; "Delivery" shows all; "Pickup" shows recipient + window
- **Custom item** opens an inline row with name + price + designer notes; appears in cart in italic rouge
- **Live totals** recalculate on each change; tap any total to override (manual discount support)
- **Payment chips** are single-select; "Pending" is allowed alongside any of the methods being "the next step"
- **Save & Print** runs the same enqueue + email pipeline as the web checkout; email step is skipped if no `contact.email`

## Auth

- Single shared password stored in `INTAKE_PASSWORD` env var
- Session cookie name: `intake_session`, HttpOnly, Secure, SameSite=Lax
- Signed with HMAC-SHA256 using `INTAKE_SESSION_SECRET`; payload: `{ iat, exp }`
- Lifetime: 30 days sliding window — every authenticated request re-issues the cookie with a fresh 30-day expiry
- `middleware.ts` gates `/admin/*` and `/api/admin/*`; missing/invalid cookie redirects to `/admin/login` (UI routes) or returns 401 (API routes)
- Logout: discreet link in the top bar deletes the cookie
- **Emergency invalidation:** rotate `INTAKE_SESSION_SECRET` env var to log everyone out instantly

Risk accepted: a stolen iPad with a live session can read/write orders. For Phase 1 with a single user this is acceptable. Per-user PINs come in Phase 2 if/when staff is added.

## Migration plan: JSON → SQLite

Three steps, designed so the web checkout keeps writing successfully throughout.

### Step 1 — Dual write (1-2 days in production)
- `lib/order-storage.ts` and `lib/print-queue.ts` write to both JSON and SQLite on every call
- Reads remain from JSON (source of truth)
- Any divergence between the two is logged for inspection

### Step 2 — One-shot historical import
- `scripts/migrate-orders-json-to-sqlite.ts` reads current `pending-orders.json` and `print-queue.json`, inserts into SQLite with `INSERT OR IGNORE` (idempotent)
- Validation: `SELECT count(*) FROM orders` must equal `pending-orders.json` length; same for print jobs

### Step 3 — Cut over reads
- Reads switch to SQLite
- Writes remain dual for ~1 week as a safety net
- After one clean week, JSON write is removed; existing JSON files stay on disk as historical backup

### Stack details
- `better-sqlite3` — synchronous, no separate server, single file `data/diva.sqlite`
- Migrations: numbered SQL files in `db/migrations/`, applied at app startup by `scripts/migrate.ts`
- Backups: manual `scripts/db-backup.ts` copies the `.sqlite` to `.backups/diva-YYYY-MM-DD.sqlite`. Cron / automated backups land in Phase 3.

## API contracts

### `POST /api/admin/orders`
Body (Zod-validated against `schemas/intake.ts`):
```ts
{
  source: "walk-in" | "phone" | "whatsapp" | "event";
  customer: { phone: string; name: string; email?: string };
  fulfillment: { method: "in-store" } | { method: "pickup"; recipient, window, cardMessage? } | { method: "delivery"; recipient, address, window, cardMessage? };
  lines: CartLine[];                 // mix of catalog + custom
  totalsOverride?: Partial<OrderTotals>;  // when Maky manually adjusts
  cardMessage?: string;
  internalNotes?: string;
  payment:
    | { status: "paid"; method: PaymentMethod }
    | { status: "pending" };
}
```
Response: `201 { orderId, printJobId }`. On Zod failure: `400` with field errors.

### `GET /api/admin/customers/lookup?phone=<digits>`
Returns `{ found: false }` or `{ found: true, customer: { name, email, lastAddress, orderCount, lastSeenAt } }`.

### `POST /api/admin/session`
Body `{ password }`; sets cookie on success, returns 401 on failure.

### `DELETE /api/admin/session`
Clears cookie, returns 204.

## Testing

### Unit (vitest)
- `lib/db.ts` — connection, migrations runner, `:memory:` setup
- `lib/order-storage.ts` (SQLite backend) — same suite as today, swapped to in-memory DB
- `lib/print-queue.ts` (SQLite backend) — same
- `lib/customer-storage.ts` — `getByPhone`, `upsertOnOrder` (idempotent on repeat orders)
- `schemas/intake.ts` — optional email, custom items, valid `source`, valid `payment` discriminated union
- Totals math with mixed catalog + custom lines

### Component (vitest + @testing-library/react)
- `<IntakeForm />` initial render and channel switching
- Phone auto-lookup: debounce, hint shows, "use last address" applies
- Fulfillment 3-way toggle: conditional fields appear/disappear
- "+ Custom" adds an inline row and reflects in cart
- Pending vs paid: Save button works in both states
- Totals override flow

### E2E (playwright)
- Login → walk-in immediate → cash → ticket queued, no email sent
- Login → walk-in delivery → Zelle → ticket queued + branded email received
- Login → phone → Pending → order stored with `paymentStatus: "pending"`
- Recurring customer auto-fill on second order
- Expired session redirects to login

### Coverage rule
- No new lines in `lib/` merge without a test covering them
- Components with conditional rendering need tests per branch

## Risks and mitigations

| Risk                                                       | Mitigation                                                    |
| ---------------------------------------------------------- | ------------------------------------------------------------- |
| `delivery → fulfillment` rename breaks web checkout        | Type-driven rename via `tsc`; full E2E run before deploy      |
| Dual-write divergence between JSON and SQLite              | Log every diff during Step 1; investigate before Step 3 cut-over |
| SQLite file corruption on host                             | Daily `scripts/db-backup.ts` (manual until Phase 3 cron)      |
| Stolen iPad with live session                              | Rotate `INTAKE_SESSION_SECRET` env var to invalidate          |
| Custom items pollute future reporting                      | `lines_json` distinguishes `kind: "catalog"` vs `"custom"`    |
| Walk-ins with no contact info skew customer table          | `customer_id` nullable; only upsert when phone is provided    |

## Open questions

None at design time — all decisions captured above. New questions surfaced during implementation go back into the plan.

## Definition of done

- All Phase 1 in-scope items above are implemented and merged to `main`
- All web checkout E2E tests still pass after the `delivery → fulfillment` rename
- One real walk-in order has been entered on the iPad end-to-end in production and the ticket printed correctly
- SQLite contains the full historical import (`count(*) == pending-orders.json.length`)
- `INTAKE_PASSWORD` and `INTAKE_SESSION_SECRET` are set in production env
