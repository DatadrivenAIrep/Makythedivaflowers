# Order Invoice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An "Invoice" button in the admin order drawer opens a printable, customer-facing invoice for that order in a new tab.

**Architecture:** A pure model builder (`lib/invoice.ts`) turns an `Order` into plain invoice data; `lib/invoice-html.tsx` renders it to a standalone HTML document with inline CSS and a print button; a protected `GET /api/admin/orders/[id]/invoice` route serves it — exactly mirroring the existing `/sheet` preview route. No DB changes.

**Tech Stack:** experimental Next.js (App Router route handlers), React `renderToStaticMarkup`, next-intl (drawer label only), vitest, node:sqlite.

**Spec:** `docs/superpowers/specs/2026-09-22-order-invoice-design.md`

## Global Constraints

- Tests run with `NODE_OPTIONS='--experimental-sqlite' npx vitest run <file>`; full suite `NODE_OPTIONS='--experimental-sqlite' pnpm test`. Known unrelated failures: `print-chromium`, `print-render`, `_preview` (headless Chromium `spawn ENOEXEC`) — ignore them.
- Typecheck: `npx tsc --noEmit`. Build needs Stripe env: `STRIPE_SECRET_KEY=sk_test_x STRIPE_WEBHOOK_SECRET=whsec_x NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_x npx next build`.
- Totals are never recomputed — always read `order.totals`, `order.amountPaidCents`, `order.giftCardCents`, `orderBalanceCents(order)`.
- Never render `internalNotes`, `takenBy`, `cardMessage`, `designerNotes`, Stripe ids.
- Invoice language = `order.locale` ("en" | "es").
- Several sessions edit this clone: stage explicit paths only, never `git add -A`; check `git log origin/main..HEAD` before any push. Do not push without the user's OK.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

### Task 1: Invoice model (`lib/invoice.ts`)

**Files:**
- Create: `lib/invoice.ts`
- Test: `tests/unit/invoice-model.test.ts`

**Interfaces:**
- Consumes: `resolveCartLine` (`lib/cart-helpers.ts`), `PRODUCTS` (`data/products.ts`), `orderBalanceCents` (`lib/order-balance.ts`), `formatDate` (`lib/format-datetime.ts`), `formatDeliveryWindow`, `formatPhoneUS` (`lib/format.ts`).
- Produces:
  ```ts
  export type InvoiceStatus = "paid" | "refunded" | "balance_due";
  export type InvoiceLine = { title: string; addOns: string[]; qty: number; unitCents: number | null; amountCents: number | null };
  export type InvoiceRow = { label: string; cents: number; kind?: "negative" | "total" | "balance" };
  export type InvoiceModel = {
    locale: "en" | "es";
    strings: InvoiceStrings;
    number: string;          // "INV-1001" | "INV-ABC123"
    issuedOn: string;        // formatted date
    orderedOn: string;       // formatted date
    status: InvoiceStatus;
    billTo: { name: string; email?: string; phone?: string };
    fulfillment: { heading: string; name: string; phone?: string; addressLines: string[]; when?: string };
    lines: InvoiceLine[];
    totals: InvoiceRow[];    // subtotal … total
    payments: InvoiceRow[];  // gift card, paid, balance/credit
  };
  export function buildInvoiceModel(order: Order, opts?: { products?: readonly Product[]; now?: Date }): InvoiceModel;
  export const INVOICE_STRINGS: Record<"en" | "es", InvoiceStrings>;
  ```

- [ ] **Step 1: Write the failing test** — `tests/unit/invoice-model.test.ts`

```ts
import { describe, it, expect } from "vitest";
import type { Order } from "@/types/order";
import { buildInvoiceModel } from "@/lib/invoice";

const NOW = new Date("2026-09-22T15:00:00Z");

function order(over: Partial<Order> = {}): Order {
  return {
    id: "ord_abcdef123456",
    orderNumber: 1001,
    source: "phone",
    locale: "en",
    lines: [
      { kind: "catalog", productId: "p-arr-b1-01", variantId: "standard", addOnIds: ["candles"], qty: 2 },
      { kind: "custom", title: "Custom sympathy spray", priceCents: 15000, designerNotes: "SECRET-DESIGN", qty: 1 },
    ],
    fulfillment: {
      method: "delivery",
      recipient: { name: "Lola Cardona", phone: "5165550101" },
      address: { street1: "12 Main St", street2: "Apt 3", city: "Albertson", state: "NY", zip: "11507", country: "US" },
      window: { date: "2026-09-25", slot: "midday" },
      cardMessage: "SECRET-CARD",
    },
    contact: { name: "Ana Buyer", email: "ana@example.com", phone: "5165551234" },
    totals: { subtotalCents: 41800, deliveryCents: 1500, discountCents: 0, tipCents: 0, taxCents: 3734, totalCents: 47034 },
    status: "pending",
    paymentStatus: "paid",
    paymentMethod: "zelle",
    paidAt: "2026-09-21T14:00:00Z",
    amountPaidCents: 47034,
    internalNotes: "SECRET-NOTE",
    takenBy: "SECRET-STAFF",
    createdAt: "2026-09-21T13:00:00Z",
    updatedAt: "2026-09-21T13:00:00Z",
    ...over,
  };
}

describe("buildInvoiceModel", () => {
  it("numbers the invoice from the order number", () => {
    expect(buildInvoiceModel(order(), { now: NOW }).number).toBe("INV-1001");
  });

  it("falls back to the last 6 of the id for legacy orders", () => {
    expect(buildInvoiceModel(order({ orderNumber: undefined }), { now: NOW }).number).toBe("INV-123456");
  });

  it("resolves catalog lines with variant and add-ons, and custom lines", () => {
    const m = buildInvoiceModel(order(), { now: NOW });
    expect(m.lines).toEqual([
      { title: "Abundant Table — Standard", addOns: ["Add taper candle pair"], qty: 2, unitCents: 13400, amountCents: 26800 },
      { title: "Custom sympathy spray", addOns: [], qty: 1, unitCents: 15000, amountCents: 15000 },
    ]);
  });

  it("keeps an unresolvable catalog line with no price", () => {
    const m = buildInvoiceModel(order({
      lines: [{ kind: "catalog", productId: "p-gone", variantId: "x", addOnIds: [], qty: 1 }],
    }), { now: NOW });
    expect(m.lines).toEqual([{ title: "p-gone", addOns: [], qty: 1, unitCents: null, amountCents: null }]);
  });

  it("shows totals straight from order.totals, hiding zero discount and tip", () => {
    const m = buildInvoiceModel(order(), { now: NOW });
    expect(m.totals).toEqual([
      { label: "Subtotal", cents: 41800 },
      { label: "Delivery", cents: 1500 },
      { label: "Sales tax (NY)", cents: 3734 },
      { label: "Total", cents: 47034, kind: "total" },
    ]);
  });

  it("shows discount with the promo code and the tip when present", () => {
    const m = buildInvoiceModel(order({
      promoCode: "SPRING10",
      totals: { subtotalCents: 41800, deliveryCents: 1500, discountCents: 4180, tipCents: 1000, taxCents: 3374, totalCents: 43494 },
    }), { now: NOW });
    expect(m.totals).toContainEqual({ label: "Discount (SPRING10)", cents: 4180, kind: "negative" });
    expect(m.totals).toContainEqual({ label: "Tip", cents: 1000 });
  });

  it("marks a fully paid order as paid with method and date", () => {
    const m = buildInvoiceModel(order(), { now: NOW });
    expect(m.status).toBe("paid");
    expect(m.payments[0].label).toMatch(/^Paid · Zelle · /);
    expect(m.payments[0].cents).toBe(47034);
    expect(m.payments[1]).toEqual({ label: "Balance due", cents: 0, kind: "balance" });
  });

  it("shows balance due on a partial payment", () => {
    const m = buildInvoiceModel(order({ paymentStatus: "pending", amountPaidCents: 20000 }), { now: NOW });
    expect(m.status).toBe("balance_due");
    expect(m.payments.at(-1)).toEqual({ label: "Balance due", cents: 27034, kind: "balance" });
  });

  it("shows a credit when overpaid", () => {
    const m = buildInvoiceModel(order({ amountPaidCents: 50000 }), { now: NOW });
    expect(m.payments.at(-1)).toEqual({ label: "Credit", cents: 2966, kind: "balance" });
  });

  it("marks refunded orders", () => {
    expect(buildInvoiceModel(order({ paymentStatus: "refunded" }), { now: NOW }).status).toBe("refunded");
  });

  it("lists the gift card as a payment", () => {
    const m = buildInvoiceModel(order({ giftCardCents: 5000 }), { now: NOW });
    expect(m.payments[0]).toEqual({ label: "Gift card", cents: 5000, kind: "negative" });
  });

  it("describes delivery, pickup and in-store fulfillment", () => {
    const d = buildInvoiceModel(order(), { now: NOW }).fulfillment;
    expect(d.heading).toBe("Deliver to");
    expect(d.name).toBe("Lola Cardona");
    expect(d.addressLines).toEqual(["12 Main St", "Apt 3", "Albertson, NY 11507"]);
    expect(d.when).toBeTruthy();

    const p = buildInvoiceModel(order({
      fulfillment: { method: "pickup", recipient: { name: "Lola", phone: "5165550101" }, window: { date: "2026-09-25", slot: "morning" } },
    }), { now: NOW }).fulfillment;
    expect(p.heading).toBe("Pickup");
    expect(p.addressLines).toEqual([]);

    const s = buildInvoiceModel(order({
      fulfillment: { method: "in-store", recipient: { name: "Lola", phone: "" } },
    }), { now: NOW }).fulfillment;
    expect(s.heading).toBe("In-store");
    expect(s.when).toBeUndefined();
    expect(s.phone).toBeUndefined();
  });

  it("bills the contact, falling back to the recipient name", () => {
    const billTo = buildInvoiceModel(order(), { now: NOW }).billTo;
    expect(billTo.name).toBe("Ana Buyer");
    expect(billTo.email).toBe("ana@example.com");
    expect(billTo.phone).toMatch(/516.*555.*1234/);
    expect(buildInvoiceModel(order({ contact: { phone: "5165551234" } }), { now: NOW }).billTo.name).toBe("Lola Cardona");
  });

  it("uses Spanish strings for es orders", () => {
    const m = buildInvoiceModel(order({ locale: "es" }), { now: NOW });
    expect(m.strings.title).toBe("Factura");
    expect(m.lines[0].title).toBe("Mesa Abundante — Clásico");
    expect(m.fulfillment.heading).toBe("Entregar a");
  });

  it("never carries internal or card data", () => {
    const json = JSON.stringify(buildInvoiceModel(order(), { now: NOW }));
    for (const secret of ["SECRET-NOTE", "SECRET-STAFF", "SECRET-CARD", "SECRET-DESIGN"]) {
      expect(json).not.toContain(secret);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_OPTIONS='--experimental-sqlite' npx vitest run tests/unit/invoice-model.test.ts`
Expected: FAIL — cannot resolve `@/lib/invoice`.

- [ ] **Step 3: Write the implementation** — `lib/invoice.ts`

```ts
// lib/invoice.ts
// Pure data for the customer-facing order invoice (admin "Invoice" button).
// Everything comes from the stored order — totals are never recomputed — and
// staff-only fields (internal notes, taken-by, card message, designer notes)
// are deliberately never read.
import type { Order, PaymentMethod } from "@/types/order";
import type { Product } from "@/types/product";
import { PRODUCTS } from "@/data/products";
import { resolveCartLine } from "@/lib/cart-helpers";
import { orderBalanceCents } from "@/lib/order-balance";
import { formatDate } from "@/lib/format-datetime";
import { formatDeliveryWindow, formatPhoneUS } from "@/lib/format";

export type InvoiceStatus = "paid" | "refunded" | "balance_due";
export type InvoiceLine = { title: string; addOns: string[]; qty: number; unitCents: number | null; amountCents: number | null };
export type InvoiceRow = { label: string; cents: number; kind?: "negative" | "total" | "balance" };

export type InvoiceStrings = {
  title: string; number: string; issued: string; ordered: string;
  billTo: string; deliverTo: string; pickup: string; inStore: string;
  item: string; qty: string; unit: string; amount: string;
  subtotal: string; delivery: string; discount: string; tax: string; tip: string; total: string;
  giftCard: string; paid: string; balanceDue: string; credit: string;
  status: Record<InvoiceStatus, string>;
  methods: Record<PaymentMethod, string>;
  thanks: string; print: string;
};

export const INVOICE_STRINGS: Record<"en" | "es", InvoiceStrings> = {
  en: {
    title: "Invoice", number: "Invoice #", issued: "Issued", ordered: "Order date",
    billTo: "Bill to", deliverTo: "Deliver to", pickup: "Pickup", inStore: "In-store",
    item: "Item", qty: "Qty", unit: "Unit price", amount: "Amount",
    subtotal: "Subtotal", delivery: "Delivery", discount: "Discount", tax: "Sales tax (NY)", tip: "Tip", total: "Total",
    giftCard: "Gift card", paid: "Paid", balanceDue: "Balance due", credit: "Credit",
    status: { paid: "Paid", refunded: "Refunded", balance_due: "Balance due" },
    methods: { cash: "Cash", zelle: "Zelle", "card-terminal": "Card", ach: "ACH", stripe: "Card (online)", "gift-card": "Gift card" },
    thanks: "Thank you for choosing Maky The Diva Flowers.", print: "Print / Save PDF",
  },
  es: {
    title: "Factura", number: "Factura #", issued: "Emitida", ordered: "Fecha de la orden",
    billTo: "Facturar a", deliverTo: "Entregar a", pickup: "Recogida", inStore: "En tienda",
    item: "Artículo", qty: "Cant.", unit: "Precio unitario", amount: "Importe",
    subtotal: "Subtotal", delivery: "Envío", discount: "Descuento", tax: "Impuesto (NY)", tip: "Propina", total: "Total",
    giftCard: "Tarjeta de regalo", paid: "Pagado", balanceDue: "Saldo pendiente", credit: "Saldo a favor",
    status: { paid: "Pagada", refunded: "Reembolsada", balance_due: "Saldo pendiente" },
    methods: { cash: "Efectivo", zelle: "Zelle", "card-terminal": "Tarjeta", ach: "ACH", stripe: "Tarjeta (en línea)", "gift-card": "Tarjeta de regalo" },
    thanks: "Gracias por elegir Maky The Diva Flowers.", print: "Imprimir / Guardar PDF",
  },
};

export type InvoiceModel = {
  locale: "en" | "es";
  strings: InvoiceStrings;
  number: string;
  issuedOn: string;
  orderedOn: string;
  status: InvoiceStatus;
  billTo: { name: string; email?: string; phone?: string };
  fulfillment: { heading: string; name: string; phone?: string; addressLines: string[]; when?: string };
  lines: InvoiceLine[];
  totals: InvoiceRow[];
  payments: InvoiceRow[];
};

function invoiceNumber(order: Order): string {
  return order.orderNumber != null
    ? `INV-${order.orderNumber}`
    : `INV-${order.id.slice(-6).toUpperCase()}`;
}

function phoneOrUndefined(digits: string | undefined): string | undefined {
  return digits ? formatPhoneUS(digits) : undefined;
}

export function buildInvoiceModel(
  order: Order,
  opts: { products?: readonly Product[]; now?: Date } = {},
): InvoiceModel {
  const locale = order.locale === "es" ? "es" : "en";
  const s = INVOICE_STRINGS[locale];
  const products = opts.products ?? PRODUCTS;
  const now = opts.now ?? new Date();

  const lines: InvoiceLine[] = order.lines.map((line) => {
    if (line.kind === "custom") {
      return { title: line.title, addOns: [], qty: line.qty, unitCents: line.priceCents, amountCents: line.priceCents * line.qty };
    }
    const r = resolveCartLine(line, products);
    if (!r) return { title: line.productId, addOns: [], qty: line.qty, unitCents: null, amountCents: null };
    return {
      title: `${r.product.title[locale]} — ${r.variant.label[locale]}`,
      addOns: r.addOns.map((a) => a.label[locale]),
      qty: line.qty,
      unitCents: r.unitPriceCents,
      amountCents: r.lineTotalCents,
    };
  });

  const t = order.totals;
  const totals: InvoiceRow[] = [
    { label: s.subtotal, cents: t.subtotalCents },
    { label: s.delivery, cents: t.deliveryCents },
  ];
  if (t.discountCents > 0) {
    totals.push({ label: order.promoCode ? `${s.discount} (${order.promoCode})` : s.discount, cents: t.discountCents, kind: "negative" });
  }
  totals.push({ label: s.tax, cents: t.taxCents });
  if (t.tipCents > 0) totals.push({ label: s.tip, cents: t.tipCents });
  totals.push({ label: s.total, cents: t.totalCents, kind: "total" });

  const payments: InvoiceRow[] = [];
  // A gift card is a payment, not a discount — same as the work sheet.
  if (order.giftCardCents && order.giftCardCents > 0) {
    payments.push({ label: s.giftCard, cents: order.giftCardCents, kind: "negative" });
  }
  const paidCents = order.amountPaidCents ?? 0;
  if (paidCents > 0) {
    const parts = [s.paid];
    if (order.paymentMethod) parts.push(s.methods[order.paymentMethod]);
    if (order.paidAt) parts.push(formatDate(order.paidAt, locale));
    payments.push({ label: parts.join(" · "), cents: paidCents });
  }
  const balance = orderBalanceCents(order);
  payments.push({ label: balance < 0 ? s.credit : s.balanceDue, cents: Math.abs(balance), kind: "balance" });

  const status: InvoiceStatus =
    order.paymentStatus === "refunded" ? "refunded"
    : order.paymentStatus === "paid" && balance <= 0 ? "paid"
    : "balance_due";

  const f = order.fulfillment;
  const fulfillment: InvoiceModel["fulfillment"] =
    f.method === "delivery"
      ? {
          heading: s.deliverTo,
          name: f.recipient.name,
          phone: phoneOrUndefined(f.recipient.phone),
          addressLines: [
            f.address.street1,
            ...(f.address.street2 ? [f.address.street2] : []),
            `${f.address.city}, ${f.address.state} ${f.address.zip}`,
          ],
          when: formatDeliveryWindow(f.window, locale),
        }
      : f.method === "pickup"
        ? { heading: s.pickup, name: f.recipient.name, phone: phoneOrUndefined(f.recipient.phone), addressLines: [], when: formatDeliveryWindow(f.window, locale) }
        : { heading: s.inStore, name: f.recipient.name, phone: phoneOrUndefined(f.recipient.phone), addressLines: [] };

  return {
    locale,
    strings: s,
    number: invoiceNumber(order),
    issuedOn: formatDate(now.toISOString(), locale),
    orderedOn: formatDate(order.createdAt, locale),
    status,
    billTo: {
      name: order.contact.name || f.recipient.name,
      ...(order.contact.email ? { email: order.contact.email } : {}),
      ...(order.contact.phone ? { phone: formatPhoneUS(order.contact.phone) } : {}),
    },
    fulfillment,
    lines,
    totals,
    payments,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `NODE_OPTIONS='--experimental-sqlite' npx vitest run tests/unit/invoice-model.test.ts`
Expected: all PASS.

- [ ] **Step 5: Typecheck and commit**

```bash
npx tsc --noEmit
git add lib/invoice.ts tests/unit/invoice-model.test.ts
git commit -m "feat(invoice): pure invoice model built from the stored order

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Invoice HTML + protected route

**Files:**
- Create: `lib/invoice-html.tsx`
- Create: `app/api/admin/orders/[id]/invoice/route.ts`
- Test: `tests/unit/api-admin-order-invoice.test.ts`

**Interfaces:**
- Consumes: `buildInvoiceModel`, `InvoiceModel`, `InvoiceRow` (Task 1); `getLogoDataUri` (`lib/print-styles.ts`); `SITE` (`data/site.ts`); `formatAddressLine`, `formatMoneyCents` (`lib/format.ts`); `getOrder` (`lib/order-storage.ts`); `requireAdmin` (`lib/admin-auth.ts`).
- Produces: `export async function buildInvoiceHtml(order: Order, opts?: { now?: Date }): Promise<string>`; route `GET /api/admin/orders/[id]/invoice` → 200 `text/html`, 401, 404.

- [ ] **Step 1: Write the failing test** — `tests/unit/api-admin-order-invoice.test.ts`

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { signSession } from "@/lib/admin-auth";
import { GET } from "@/app/api/admin/orders/[id]/invoice/route";

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("INTAKE_SESSION_SECRET", "test-secret-test-secret-test-secret");
  runMigrations();
});
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

function seed(id: string) {
  getDb().prepare(
    `INSERT INTO orders (id, locale, source, recipient_name, recipient_phone, contact_phone,
       fulfillment_method, window_date, window_slot, lines_json, subtotal_cents, delivery_cents,
       tax_cents, total_cents, fulfillment_status, payment_status, order_number, created_at, updated_at)
     VALUES (?, 'en', 'walk-in', 'Ana <b>', '555', '5165551234', 'in-store', NULL, NULL, '[]', 10000,0,863,10863,
       'pending', 'pending', 1001, '2026-06-01T08:00:00Z', '2026-06-01T08:00:00Z')`,
  ).run(id);
}
function authed() {
  return new Request("http://x", { headers: { cookie: `intake_session=${signSession()}` } });
}

describe("GET /api/admin/orders/[id]/invoice", () => {
  it("returns the invoice HTML", async () => {
    seed("i1");
    const res = await GET(authed(), { params: Promise.resolve({ id: "i1" }) });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    const html = await res.text();
    expect(html.toLowerCase()).toContain("<!doctype html>");
    expect(html).toContain("INV-1001");
    expect(html).toContain("Balance due");
    expect(html).toContain("window.print()");
    // user text is escaped
    expect(html).toContain("Ana &lt;b&gt;");
    expect(html).not.toContain("Ana <b>");
  });

  it("401 without session", async () => {
    seed("i2");
    const res = await GET(new Request("http://x"), { params: Promise.resolve({ id: "i2" }) });
    expect(res.status).toBe(401);
  });

  it("404 unknown order", async () => {
    const res = await GET(authed(), { params: Promise.resolve({ id: "nope" }) });
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_OPTIONS='--experimental-sqlite' npx vitest run tests/unit/api-admin-order-invoice.test.ts`
Expected: FAIL — cannot resolve the route module.

- [ ] **Step 3: Write `lib/invoice-html.tsx`**

```tsx
// lib/invoice-html.tsx
// Standalone, printable HTML for the customer-facing invoice. Letter portrait;
// the browser's print dialog is the PDF path (no Chromium, no print queue).
import "server-only";
import React from "react";

// Same dynamic import as print-render-html.tsx — keeps Turbopack's static
// `react-dom/server` check from rejecting the App Router bundle.
async function loadRenderToStaticMarkup() {
  const mod = await import("react-dom/server");
  return mod.renderToStaticMarkup;
}
import type { Order } from "@/types/order";
import { SITE } from "@/data/site";
import { formatAddressLine, formatMoneyCents } from "@/lib/format";
import { getLogoDataUri } from "@/lib/print-styles";
import { buildInvoiceModel, type InvoiceModel, type InvoiceRow } from "@/lib/invoice";

const STYLES = `
*{box-sizing:border-box}
body{margin:0;background:#f4f1ec;color:#1d1a17;font:13px/1.45 -apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif}
.page{max-width:8.5in;margin:24px auto;background:#fff;padding:0.6in;box-shadow:0 1px 8px rgba(0,0,0,.08)}
.toolbar{max-width:8.5in;margin:16px auto 0;padding:0 16px;text-align:right}
.toolbar button{font:inherit;font-weight:600;padding:8px 16px;border-radius:8px;border:1px solid #1d1a17;background:#1d1a17;color:#fff;cursor:pointer}
header{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:flex-start;gap:24px;padding-bottom:20px;border-bottom:1px solid #e6e0d8}
header img{height:56px}
.shop{font-size:12px;color:#6b635b;margin-top:6px}
.meta{text-align:right;margin-left:auto}
.meta h1{margin:0 0 6px;font-size:26px;letter-spacing:.08em;text-transform:uppercase}
.meta dl{margin:0;display:grid;grid-template-columns:auto auto;gap:2px 12px;justify-content:end;font-size:12px}
.meta dt{color:#6b635b}
.meta dd{margin:0;font-weight:600}
.stamp{display:inline-block;margin-top:10px;padding:4px 10px;border:2px solid;border-radius:6px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;font-size:12px}
.stamp.paid{color:#1f7a4d}.stamp.balance_due{color:#a15c00}.stamp.refunded{color:#6b635b}
.parties{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin:20px 0}
.parties h2{margin:0 0 4px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#6b635b}
.parties p{margin:0}
table{width:100%;border-collapse:collapse}
.items th{text-align:left;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#6b635b;border-bottom:1px solid #e6e0d8;padding:6px 0}
.items td{padding:8px 0;border-bottom:1px solid #f0ebe4;vertical-align:top}
.items .num{text-align:right;white-space:nowrap;padding-left:12px}
.addons{color:#6b635b;font-size:12px}
.sums{width:55%;margin:16px 0 0 auto}
.sums td{padding:4px 0}
.sums td:last-child{text-align:right;white-space:nowrap}
.sums .total td{border-top:1px solid #1d1a17;font-weight:700;font-size:15px;padding-top:8px}
.sums .gap td{padding-top:12px}
.sums .balance td{font-weight:700;border-top:1px solid #e6e0d8}
footer{margin-top:36px;padding-top:16px;border-top:1px solid #e6e0d8;text-align:center;color:#6b635b;font-size:12px}
@media (max-width:640px){
  .page{margin:12px 0;padding:20px 16px}
  .parties{grid-template-columns:1fr}
  .sums{width:100%}
}
@page{size:letter;margin:0.6in}
@media print{
  body{background:#fff}
  .toolbar{display:none}
  .page{margin:0;padding:0;box-shadow:none;max-width:none}
}
`;

function Row({ row, locale, first }: { row: InvoiceRow; locale: "en" | "es"; first?: boolean }) {
  const cls = [row.kind === "total" ? "total" : "", row.kind === "balance" ? "balance" : "", first ? "gap" : ""].filter(Boolean).join(" ");
  const value = (row.kind === "negative" ? "−" : "") + formatMoneyCents(row.cents, locale);
  return (
    <tr className={cls || undefined}>
      <td>{row.label}</td>
      <td>{value}</td>
    </tr>
  );
}

function Invoice({ m, logoUri }: { m: InvoiceModel; logoUri: string }) {
  const s = m.strings;
  const site = SITE.url.replace(/^https?:\/\//, "");
  const money = (c: number | null) => (c == null ? "—" : formatMoneyCents(c, m.locale));
  return (
    <>
      <div className="toolbar">
        <button type="button" data-print>{s.print}</button>
      </div>
      <main className="page">
        <header>
          <div>
            <img src={logoUri} alt={SITE.merchantName} />
            <div className="shop">
              <div><strong>{SITE.merchantName}</strong></div>
              <div>{formatAddressLine(SITE.address)}</div>
              <div>{SITE.phone} · {SITE.email}</div>
              <div>{site}</div>
            </div>
          </div>
          <div className="meta">
            <h1>{s.title}</h1>
            <dl>
              <dt>{s.number}</dt><dd>{m.number}</dd>
              <dt>{s.issued}</dt><dd>{m.issuedOn}</dd>
              <dt>{s.ordered}</dt><dd>{m.orderedOn}</dd>
            </dl>
            <div className={`stamp ${m.status}`}>{s.status[m.status]}</div>
          </div>
        </header>

        <section className="parties">
          <div>
            <h2>{s.billTo}</h2>
            <p><strong>{m.billTo.name}</strong></p>
            {m.billTo.email ? <p>{m.billTo.email}</p> : null}
            {m.billTo.phone ? <p>{m.billTo.phone}</p> : null}
          </div>
          <div>
            <h2>{m.fulfillment.heading}</h2>
            <p><strong>{m.fulfillment.name}</strong></p>
            {m.fulfillment.phone ? <p>{m.fulfillment.phone}</p> : null}
            {m.fulfillment.addressLines.map((l, i) => <p key={i}>{l}</p>)}
            {m.fulfillment.when ? <p>{m.fulfillment.when}</p> : null}
          </div>
        </section>

        <table className="items">
          <thead>
            <tr><th>{s.item}</th><th className="num">{s.qty}</th><th className="num">{s.unit}</th><th className="num">{s.amount}</th></tr>
          </thead>
          <tbody>
            {m.lines.map((l, i) => (
              <tr key={i}>
                <td>
                  {l.title}
                  {l.addOns.length > 0 ? <div className="addons">+ {l.addOns.join(", ")}</div> : null}
                </td>
                <td className="num">{l.qty}</td>
                <td className="num">{money(l.unitCents)}</td>
                <td className="num">{money(l.amountCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <table className="sums">
          <tbody>
            {m.totals.map((r, i) => <Row key={`t${i}`} row={r} locale={m.locale} />)}
            {m.payments.map((r, i) => <Row key={`p${i}`} row={r} locale={m.locale} first={i === 0} />)}
          </tbody>
        </table>

        <footer>{s.thanks} · {site}</footer>
      </main>
    </>
  );
}

export async function buildInvoiceHtml(order: Order, opts: { now?: Date } = {}): Promise<string> {
  const renderToStaticMarkup = await loadRenderToStaticMarkup();
  const m = buildInvoiceModel(order, { now: opts.now });
  const body = renderToStaticMarkup(<Invoice m={m} logoUri={getLogoDataUri()} />);
  // m.number is "INV-" + digits or uppercased id chars — safe to interpolate.
  return `<!doctype html>
<html lang="${m.locale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${m.number} · ${SITE.merchantName}</title>
<style>${STYLES}</style>
</head>
<body>${body}
<script>document.querySelector("[data-print]").addEventListener("click", function () { window.print(); });</script>
</body>
</html>`;
}
```

- [ ] **Step 4: Write the route** — `app/api/admin/orders/[id]/invoice/route.ts`

```ts
import { NextResponse } from "next/server";
import { getOrder } from "@/lib/order-storage";
import { buildInvoiceHtml } from "@/lib/invoice-html";
import { requireAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  if (!requireAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const order = await getOrder(id);
  if (!order) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const html = await buildInvoiceHtml(order);
  return new NextResponse(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `NODE_OPTIONS='--experimental-sqlite' npx vitest run tests/unit/api-admin-order-invoice.test.ts tests/unit/invoice-model.test.ts`
Expected: all PASS.

- [ ] **Step 6: Typecheck and commit**

```bash
npx tsc --noEmit
git add lib/invoice-html.tsx "app/api/admin/orders/[id]/invoice/route.ts" tests/unit/api-admin-order-invoice.test.ts
git commit -m "feat(invoice): printable invoice HTML behind /api/admin/orders/[id]/invoice

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: "Invoice" button in the order drawer

**Files:**
- Modify: `components/admin/dashboard/OrderDetailDrawer.tsx` (phosphor icon import ~lines 5-8; header buttons ~line 158-160)
- Modify: `messages/en.json`, `messages/es.json` (`admin_orders` namespace, next to `"preview"` ~line 1415)

**Interfaces:**
- Consumes: route `GET /api/admin/orders/[id]/invoice` (Task 2).
- Produces: nothing downstream.

- [ ] **Step 1: Add the translation keys**

In `messages/en.json`, inside `admin_orders`, after `"preview": "Preview",` add `"invoice": "Invoice",`.
In `messages/es.json`, after `"preview": "Vista previa",` add `"invoice": "Factura",`.

- [ ] **Step 2: Add the button**

Add `FileText` to the `@phosphor-icons/react/dist/ssr` import list (after `Printer`).

After the Preview button line:
```tsx
<AdminButton variant="secondary" icon={Eye} href={`/api/admin/orders/${order.id}/sheet`} target="_blank" rel="noreferrer">{t("preview")}</AdminButton>
```
add:
```tsx
<AdminButton variant="secondary" icon={FileText} href={`/api/admin/orders/${order.id}/invoice`} target="_blank" rel="noreferrer">{t("invoice")}</AdminButton>
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit` — expected clean.
Run: `grep -rln 'OrderDetailDrawer\|messages/en.json' tests/unit` and run those files with vitest — expected PASS (covers en/es key-parity tests if present).

- [ ] **Step 4: Commit**

```bash
git add components/admin/dashboard/OrderDetailDrawer.tsx messages/en.json messages/es.json
git commit -m "feat(invoice): Invoice button in the admin order drawer

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Visual verification + full gate

**Files:** throwaway only (deleted before finishing).

- [ ] **Step 1: Dump sample invoices** — create `tests/unit/zz-invoice-dump.test.ts`:

```ts
import { it } from "vitest";
import { writeFileSync, mkdirSync } from "node:fs";
import { buildInvoiceHtml } from "@/lib/invoice-html";
import type { Order } from "@/types/order";

const base: Order = {
  id: "ord_demo00000001", orderNumber: 1042, source: "phone", locale: "en",
  lines: [
    { kind: "catalog", productId: "p-arr-b1-01", variantId: "standard", addOnIds: ["candles"], qty: 1 },
    { kind: "custom", title: "Custom sympathy spray", priceCents: 15000, qty: 1 },
  ],
  fulfillment: {
    method: "delivery", recipient: { name: "Lola Cardona", phone: "5165550101" },
    address: { street1: "12 Main St", city: "Albertson", state: "NY", zip: "11507", country: "US" },
    window: { date: "2026-09-25", slot: "midday" },
  },
  contact: { name: "Ana Buyer", email: "ana@example.com", phone: "5165551234" },
  totals: { subtotalCents: 28400, deliveryCents: 1500, discountCents: 2840, tipCents: 1000, taxCents: 2334, totalCents: 30394 },
  promoCode: "SPRING10", status: "pending", paymentStatus: "pending", amountPaidCents: 10000,
  paymentMethod: "zelle", paidAt: "2026-09-21T14:00:00Z",
  createdAt: "2026-09-21T13:00:00Z", updatedAt: "2026-09-21T13:00:00Z",
};

it("dump", async () => {
  const dir = process.env.INVOICE_DUMP_DIR!;
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/en.html`, await buildInvoiceHtml(base));
  writeFileSync(`${dir}/es-paid.html`, await buildInvoiceHtml({ ...base, locale: "es", paymentStatus: "paid", amountPaidCents: 30394 }));
});
```

Run: `INVOICE_DUMP_DIR=<scratchpad>/invoice NODE_OPTIONS='--experimental-sqlite' npx vitest run tests/unit/zz-invoice-dump.test.ts`

- [ ] **Step 2: Inspect in the browser** — `python3 -m http.server 8765 --directory <scratchpad>/invoice`, open `/en.html` and `/es-paid.html` in the built-in browser. Check: logo renders, header/meta aligned, stamp color (amber BALANCE DUE / green PAGADA), line table, discount with code, tip, paid/balance rows, no horizontal scroll at mobile width. Fix CSS in `lib/invoice-html.tsx` if needed and re-run Step 1.

- [ ] **Step 3: Delete throwaways** — `rm tests/unit/zz-invoice-dump.test.ts`, stop the server.

- [ ] **Step 4: Full gate**

```bash
NODE_OPTIONS='--experimental-sqlite' pnpm test
npx tsc --noEmit
STRIPE_SECRET_KEY=sk_test_x STRIPE_WEBHOOK_SECRET=whsec_x NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_x npx next build
```
Expected: only the known Chromium print test files fail; tsc clean; build succeeds.

- [ ] **Step 5: Commit any CSS fixes** (explicit paths), then `git status` + `git log origin/main..HEAD` and ask the user before pushing.
