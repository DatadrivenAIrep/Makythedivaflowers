# Auto-Print Paid Orders — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When Stripe `payment_intent.succeeded` fires, queue a PDF print job (order ticket on top half + decorative card on bottom half of a Letter sheet) that a Windows-Service print agent in the shop polls and sends to the local Wi-Fi printer.

**Architecture:** Print queue is persisted via the same file-based storage pattern as `lib/order-storage.ts`. The webhook enqueues; agent polls a bearer-authed endpoint, prints with `pdf-to-printer`, and acks. Failure of enqueue or print never reverts payment status — printing is best-effort.

**Tech Stack:** Next.js 16 + Vitest (server). `@react-pdf/renderer` for PDF generation. Standalone Node TypeScript agent (`tools/print-agent/`) using `pdf-to-printer`, `pino`, `node-windows`.

**Spec:** [docs/superpowers/specs/2026-05-07-order-print-system-design.md](../specs/2026-05-07-order-print-system-design.md)

---

## File map

**Server (main app):**
- Create `lib/print-queue.ts` — job storage + state machine
- Create `lib/print-render.tsx` — `renderOrderPdf(order, locale): Promise<Buffer>`
- Create `lib/print-auth.ts` — bearer-token validation helper
- Create `app/api/print/queue/route.ts` — `GET` (returns pending jobs, marks as printing)
- Create `app/api/print/jobs/[id]/ack/route.ts` — `POST` (acks printed/failed)
- Create `app/api/print/health/route.ts` — `GET` (auth-only health snapshot)
- Modify `app/api/stripe/webhook/route.ts` — call `enqueuePrintJob` after notify/analytics
- Modify `lib/order-notifications.ts` — add `notifyPrintFailed(orderId, error)`
- Modify `.env.local.example` — add `PRINT_AGENT_TOKEN`
- Modify `README.md` — add "Impresión automática" section
- Create `public/print/card-bg-default.png` — Higgsfield-generated artwork
- Create `public/print/logo-mark.webp` — print-optimized logo (or reuse `public/logo-header.webp`)

**Tests:**
- Create `tests/unit/print-queue.test.ts`
- Create `tests/unit/print-render.test.ts`
- Create `tests/unit/print-auth.test.ts`
- Create `tests/unit/api-print-queue.test.ts`
- Create `tests/unit/api-print-jobs-ack.test.ts`
- Create `tests/unit/api-print-health.test.ts`
- Modify `tests/unit/api-stripe-webhook.test.ts` — assert `enqueuePrintJob` is called

**Print agent (separate package):**
- Create `tools/print-agent/package.json`
- Create `tools/print-agent/tsconfig.json`
- Create `tools/print-agent/.env.example`
- Create `tools/print-agent/.gitignore`
- Create `tools/print-agent/src/index.ts` — entry
- Create `tools/print-agent/src/config.ts` — env loader + validation
- Create `tools/print-agent/src/log.ts` — pino logger
- Create `tools/print-agent/src/health.ts` — boot health check
- Create `tools/print-agent/src/poll.ts` — single tick (fetch, print, ack)
- Create `tools/print-agent/src/print.ts` — pdf-to-printer wrapper + retry
- Create `tools/print-agent/src/test-print.ts` — manual smoke test
- Create `tools/print-agent/install-service.js`
- Create `tools/print-agent/uninstall-service.js`
- Create `tools/print-agent/README.md`

---

## Conventions for this plan

- **Test runner**: `vitest` via `pnpm test` (or `npm run test` — verify which the project uses; commands below assume `pnpm`).
- **Storage isolation in tests**: same pattern as `tests/unit/api-stripe-webhook.test.ts` — set `vi.stubEnv("ORDER_STORAGE_FILE", ...)` and write a fresh JSON file in `beforeEach`. The print queue uses the same env var family: `PRINT_QUEUE_FILE`.
- **Module mocks in tests**: same pattern — `vi.mock("@/lib/print-queue", () => ({ enqueuePrintJob: vi.fn() }))` etc.
- **Imports use `@/`** alias (existing convention).
- **Commit style**: matches recent commits (`feat(print): ...`, `test(print): ...`).
- **TDD**: every implementation task starts with a failing test, then minimum impl, then green.

---

## Phase A — PDF rendering

### Task 1: Install `@react-pdf/renderer` and verify it loads in Node

**Files:**
- Modify: `package.json`
- Create: `tests/unit/print-render.test.ts` (initial smoke test)

- [ ] **Step 1: Install dependency**

```bash
pnpm add @react-pdf/renderer
```

Expected: `@react-pdf/renderer` (latest 4.x) added to `dependencies`.

- [ ] **Step 2: Write a smoke test that imports it**

Create `tests/unit/print-render.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { Document, Page, Text, renderToBuffer } from "@react-pdf/renderer";
import React from "react";

describe("@react-pdf/renderer smoke test", () => {
  it("renders a one-page PDF buffer", async () => {
    const doc = React.createElement(
      Document,
      null,
      React.createElement(
        Page,
        { size: "LETTER" },
        React.createElement(Text, null, "hello"),
      ),
    );
    const buf = await renderToBuffer(doc);
    expect(buf).toBeInstanceOf(Buffer);
    // PDF magic header: %PDF-
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
  });
});
```

- [ ] **Step 3: Run the test**

Run: `pnpm test tests/unit/print-render.test.ts`
Expected: PASS — proves the library loads and produces a valid PDF in Vitest's Node env.

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml tests/unit/print-render.test.ts
git commit -m "feat(print): add @react-pdf/renderer + smoke test"
```

---

### Task 2: Define `renderOrderPdf` signature with placeholder content

**Files:**
- Create: `lib/print-render.tsx`
- Modify: `tests/unit/print-render.test.ts`

- [ ] **Step 1: Write test for the public API**

Append to `tests/unit/print-render.test.ts`:

```ts
import type { Order } from "@/types/order";
import { renderOrderPdf } from "@/lib/print-render";

const baseOrder: Order = {
  id: "do_test123",
  locale: "en",
  lines: [],
  contact: { email: "buyer@example.com", phone: "5165551234" },
  totals: { subtotalCents: 19100, deliveryCents: 0, taxCents: 1647, totalCents: 20747 },
  status: "paid",
  createdAt: "2026-05-07T15:30:00.000Z",
  delivery: {
    method: "pickup",
    recipient: { name: "Lola Cardona", phone: "5165550101" },
    window: { date: "2026-05-15", slot: "midday" },
    cardMessage: "Happy birthday",
  },
};

describe("renderOrderPdf", () => {
  it("returns a non-empty PDF buffer", async () => {
    const buf = await renderOrderPdf(baseOrder);
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(1000);
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
  });
});
```

- [ ] **Step 2: Run test, expect failure**

Run: `pnpm test tests/unit/print-render.test.ts`
Expected: FAIL — module `@/lib/print-render` does not exist.

- [ ] **Step 3: Create minimal `lib/print-render.tsx`**

```tsx
// lib/print-render.tsx
import "server-only";
import React from "react";
import { Document, Page, Text, renderToBuffer, StyleSheet } from "@react-pdf/renderer";
import type { Order } from "@/types/order";

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 10 },
});

export async function renderOrderPdf(order: Order): Promise<Buffer> {
  const element = (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text>ORDER {order.id}</Text>
      </Page>
    </Document>
  );
  return renderToBuffer(element);
}
```

- [ ] **Step 4: Run test, expect pass**

Run: `pnpm test tests/unit/print-render.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/print-render.tsx tests/unit/print-render.test.ts
git commit -m "feat(print): scaffold renderOrderPdf with smoke output"
```

---

### Task 3: Implement the order ticket (top half) content

**Files:**
- Modify: `lib/print-render.tsx`
- Modify: `tests/unit/print-render.test.ts`

The order ticket needs: order id, paid timestamp, total, Stripe PI id, delivery vs pickup block, items with add-ons, buyer contact. Localized between `en` and `es` based on `order.locale`.

- [ ] **Step 1: Write tests asserting ticket content**

Replace the `describe("renderOrderPdf")` block in the test file with:

```ts
import { extractText } from "./helpers/pdf-text";
// (helper added in next step)

describe("renderOrderPdf — order ticket", () => {
  it("includes order id, total, Stripe PI, recipient, items, buyer contact", async () => {
    const order: Order = {
      ...baseOrder,
      stripePaymentIntentId: "pi_3O123abc",
      lines: [
        { productId: "p-arr-m01", variantId: "standard", addOnIds: ["balloon"], qty: 2 },
      ],
    };
    const buf = await renderOrderPdf(order);
    const text = await extractText(buf);
    expect(text).toContain("do_test123");
    expect(text).toContain("$207.47");
    expect(text).toContain("pi_3O123abc");
    expect(text).toContain("Lola Cardona");
    expect(text).toContain("buyer@example.com");
  });

  it("renders DELIVER TO block for delivery orders", async () => {
    const order: Order = {
      ...baseOrder,
      delivery: {
        method: "delivery",
        recipient: { name: "María González", phone: "2125550142" },
        address: {
          street1: "123 Park Ave",
          street2: "Apt 4B",
          city: "New York",
          state: "NY",
          zip: "10016",
          country: "US",
        },
        window: { date: "2026-05-07", slot: "afternoon" },
        cardMessage: "Te quiero",
      },
    };
    const buf = await renderOrderPdf(order);
    const text = await extractText(buf);
    expect(text).toContain("DELIVER TO");
    expect(text).toContain("123 Park Ave");
    expect(text).not.toContain("PICK UP AT SHOP");
  });

  it("renders PICK UP AT SHOP block for pickup orders", async () => {
    const buf = await renderOrderPdf(baseOrder); // pickup
    const text = await extractText(buf);
    expect(text).toContain("PICK UP AT SHOP");
    expect(text).toContain("1077 Willis Ave");
  });

  it("localizes ticket to Spanish when order.locale === 'es'", async () => {
    const order: Order = { ...baseOrder, locale: "es" };
    const buf = await renderOrderPdf(order);
    const text = await extractText(buf);
    expect(text).toContain("RECOGER EN TIENDA");
    expect(text).not.toContain("PICK UP AT SHOP");
  });
});
```

- [ ] **Step 2: Add a PDF text-extraction helper**

Create `tests/unit/helpers/pdf-text.ts`:

```ts
// Naive PDF text extractor for tests. Pulls strings from BT/ET text objects.
// Sufficient for asserting that known phrases appear in a rendered PDF.
export async function extractText(pdf: Buffer): Promise<string> {
  const raw = pdf.toString("latin1");
  const parts: string[] = [];
  // PDF strings appear as "(...)Tj" or in arrays "[(a)(b)]TJ"
  const re = /\(((?:[^()\\]|\\.)*)\)\s*T[jJ]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    parts.push(m[1].replace(/\\([()\\nrt])/g, (_, c) => {
      if (c === "n") return "\n";
      if (c === "r") return "\r";
      if (c === "t") return "\t";
      return c;
    }));
  }
  return parts.join("\n");
}
```

- [ ] **Step 3: Run tests, expect failure**

Run: `pnpm test tests/unit/print-render.test.ts`
Expected: FAIL — assertions on `DELIVER TO`, `PICK UP AT SHOP`, etc. don't pass yet.

- [ ] **Step 4: Implement the order-ticket content in `lib/print-render.tsx`**

Replace the file contents:

```tsx
// lib/print-render.tsx
import "server-only";
import React from "react";
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import type { Order } from "@/types/order";
import { PRODUCTS } from "@/data/products";
import { SITE } from "@/data/site";
import { resolveCartLines } from "@/lib/cart-helpers";
import { formatMoneyCents, formatPhoneUS, formatDeliveryWindow } from "@/lib/format";

const COLORS = { ink: "#111", muted: "#666", line: "#cccccc" };

const styles = StyleSheet.create({
  page: { paddingTop: 36, paddingHorizontal: 36, paddingBottom: 0, fontSize: 10, color: COLORS.ink },
  ticket: { paddingBottom: 12 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  headerLeft: {},
  headerRight: { textAlign: "right" },
  big: { fontSize: 16, fontWeight: "bold" },
  meta: { fontSize: 8, color: COLORS.muted },
  block: { marginTop: 8, padding: 8, borderWidth: 1, borderColor: COLORS.line, borderRadius: 4 },
  blockTitle: { fontSize: 9, fontWeight: "bold", marginBottom: 4 },
  itemRow: { flexDirection: "row", justifyContent: "space-between" },
  addons: { color: COLORS.muted, marginLeft: 12, fontSize: 9 },
  cardMsg: { marginTop: 8, fontStyle: "italic" },
});

const T = {
  en: {
    paid: "Paid",
    total: "TOTAL",
    deliverTo: "DELIVER TO",
    pickUp: "PICK UP AT SHOP",
    items: "ITEMS",
    buyer: "BUYER",
    cardMessage: "CARD MESSAGE",
    window: "Window",
  },
  es: {
    paid: "Pagada",
    total: "TOTAL",
    deliverTo: "ENTREGAR A",
    pickUp: "RECOGER EN TIENDA",
    items: "PRODUCTOS",
    buyer: "COMPRADOR",
    cardMessage: "MENSAJE DE TARJETA",
    window: "Ventana",
  },
} as const;

function OrderTicket({ order }: { order: Order }) {
  const locale = order.locale;
  const t = T[locale];
  const m = (cents: number) => formatMoneyCents(cents, locale);
  const resolved = resolveCartLines(order.lines, PRODUCTS);

  return (
    <View style={styles.ticket}>
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Text style={styles.big}>ORDEN #{order.id}</Text>
          <Text style={styles.meta}>{t.paid}: {order.createdAt}</Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.big}>{t.total}: {m(order.totals.totalCents)}</Text>
          {order.stripePaymentIntentId ? (
            <Text style={styles.meta}>Stripe: {order.stripePaymentIntentId}</Text>
          ) : null}
        </View>
      </View>

      <View style={styles.block}>
        {order.delivery.method === "delivery" ? (
          <>
            <Text style={styles.blockTitle}>{t.deliverTo}</Text>
            <Text>{order.delivery.recipient.name} · {formatPhoneUS(order.delivery.recipient.phone)}</Text>
            <Text>
              {order.delivery.address.street1}
              {order.delivery.address.street2 ? `, ${order.delivery.address.street2}` : ""}
            </Text>
            <Text>
              {order.delivery.address.city}, {order.delivery.address.state} {order.delivery.address.zip}
            </Text>
            <Text>{t.window}: {formatDeliveryWindow(order.delivery.window, locale)}</Text>
          </>
        ) : (
          <>
            <Text style={styles.blockTitle}>{t.pickUp}</Text>
            <Text>{SITE.brand} · {SITE.address.line1}, {SITE.address.locality}, {SITE.address.region} {SITE.address.postal}</Text>
            <Text>{order.delivery.recipient.name} · {formatPhoneUS(order.delivery.recipient.phone)}</Text>
            <Text>{t.window}: {formatDeliveryWindow(order.delivery.window, locale)}</Text>
          </>
        )}
        {order.delivery.cardMessage?.trim() ? (
          <Text style={styles.cardMsg}>"{order.delivery.cardMessage.trim()}"</Text>
        ) : null}
      </View>

      <View style={styles.block}>
        <Text style={styles.blockTitle}>{t.items}</Text>
        {resolved.map((r, i) => (
          <View key={i}>
            <View style={styles.itemRow}>
              <Text>{r.line.qty}× {r.product.title[locale]} — {r.variant.label[locale]}</Text>
              <Text>{m(r.lineTotalCents)}</Text>
            </View>
            {r.addOns.length > 0 ? (
              <Text style={styles.addons}>+ {r.addOns.map((a) => a.label[locale]).join(", ")}</Text>
            ) : null}
          </View>
        ))}
      </View>

      <View style={styles.block}>
        <Text style={styles.blockTitle}>{t.buyer}</Text>
        <Text>{order.contact.email} · {formatPhoneUS(order.contact.phone)}</Text>
      </View>
    </View>
  );
}

export async function renderOrderPdf(order: Order): Promise<Buffer> {
  const element = (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <OrderTicket order={order} />
      </Page>
    </Document>
  );
  return renderToBuffer(element);
}
```

- [ ] **Step 5: Run tests, expect pass**

Run: `pnpm test tests/unit/print-render.test.ts`
Expected: PASS for all four tests.

- [ ] **Step 6: Commit**

```bash
git add lib/print-render.tsx tests/unit/print-render.test.ts tests/unit/helpers/pdf-text.ts
git commit -m "feat(print): order ticket layout (en/es) with delivery/pickup variants"
```

---

### Task 4: Add cut line + decorative card (bottom half)

**Files:**
- Modify: `lib/print-render.tsx`
- Modify: `tests/unit/print-render.test.ts`

Card uses `public/print/card-bg-default.png` as background and `order.delivery.cardMessage` as the centerpiece. The asset is generated in Task 14 — for now we use a 1×1 transparent placeholder so the layout works in tests.

- [ ] **Step 1: Write tests for the bottom half**

Append to the `describe("renderOrderPdf — order ticket")` test file a new block:

```ts
describe("renderOrderPdf — decorative card", () => {
  it("includes the customer's card message", async () => {
    const order: Order = {
      ...baseOrder,
      delivery: { ...baseOrder.delivery, cardMessage: "Feliz cumpleaños mamá" } as any,
    };
    const buf = await renderOrderPdf(order);
    const text = await extractText(buf);
    expect(text).toContain("Feliz cumpleaños mamá");
  });

  it("renders a single LETTER page (cut line is on the same page)", async () => {
    const buf = await renderOrderPdf(baseOrder);
    const raw = buf.toString("latin1");
    // PDF /Count entry in the Pages object reflects total page count
    expect(raw).toMatch(/\/Count\s+1\b/);
  });

  it("omits the message block when cardMessage is empty", async () => {
    const order: Order = {
      ...baseOrder,
      delivery: { ...baseOrder.delivery, cardMessage: "" } as any,
    };
    const buf = await renderOrderPdf(order);
    expect(buf.length).toBeGreaterThan(1000);
    // No throw, valid PDF.
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
  });
});
```

- [ ] **Step 2: Add the placeholder background asset**

We use a 1×1 transparent PNG as the placeholder so unit tests can render without depending on Higgsfield-generated artwork. PNG is renderable by `@react-pdf/renderer` and is fine for the final asset too — Task 12 produces a real PNG at the same path.

```bash
mkdir -p public/print
node -e "require('fs').writeFileSync('public/print/card-bg-default.png', Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'))"
```

- [ ] **Step 3: Run tests, expect failure**

Run: `pnpm test tests/unit/print-render.test.ts`
Expected: FAIL — `Feliz cumpleaños` not in output, `/Count 1` not present (or whatever specifics break).

- [ ] **Step 4: Extend `lib/print-render.tsx` with cut line + card**

Add to the styles block:

```tsx
const cardStyles = StyleSheet.create({
  cutLine: {
    marginTop: 10,
    marginBottom: 10,
    borderTopWidth: 1,
    borderTopStyle: "dashed",
    borderTopColor: COLORS.line,
  },
  cutLabel: { textAlign: "center", fontSize: 8, color: COLORS.muted, marginTop: -6, marginBottom: 6 },
  card: {
    height: 360, // ~5" of the bottom half on Letter at 72dpi
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 36,
  },
  cardBg: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, width: "100%", height: "100%" },
  cardLogo: { position: "absolute", top: 16, alignSelf: "center", height: 28 },
  cardMessage: { fontSize: 22, textAlign: "center", color: COLORS.ink },
  cardSig: { position: "absolute", bottom: 12, alignSelf: "center", fontSize: 9, color: COLORS.muted, fontStyle: "italic" },
});
```

Add a `DecorativeCard` component above `renderOrderPdf`:

```tsx
import { Image } from "@react-pdf/renderer";
import path from "node:path";

function DecorativeCard({ message }: { message: string | undefined }) {
  const trimmed = message?.trim();
  return (
    <>
      <View style={cardStyles.cutLine} />
      <Text style={cardStyles.cutLabel}>✂  recortar / cut here  ✂</Text>
      <View style={cardStyles.card}>
        <Image src={path.join(process.cwd(), "public/print/card-bg-default.png")} style={cardStyles.cardBg} />
        {trimmed ? <Text style={cardStyles.cardMessage}>{trimmed}</Text> : null}
        <Text style={cardStyles.cardSig}>— maky the diva flowers</Text>
      </View>
    </>
  );
}
```

Update `renderOrderPdf` to include both:

```tsx
export async function renderOrderPdf(order: Order): Promise<Buffer> {
  const element = (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <OrderTicket order={order} />
        <DecorativeCard message={order.delivery.cardMessage} />
      </Page>
    </Document>
  );
  return renderToBuffer(element);
}
```

- [ ] **Step 5: Run tests, expect pass**

Run: `pnpm test tests/unit/print-render.test.ts`
Expected: PASS for all card tests.

- [ ] **Step 6: Manual smoke (optional but recommended)**

Run a one-off Node script to write the PDF to disk and visually inspect:

```bash
cat > /tmp/render-sample.mjs <<'EOF'
import { renderOrderPdf } from "./lib/print-render.tsx";
import { writeFileSync } from "node:fs";
const order = {
  id: "do_sample",
  locale: "es",
  lines: [],
  contact: { email: "buyer@example.com", phone: "5165551234" },
  totals: { subtotalCents: 19100, deliveryCents: 0, taxCents: 1647, totalCents: 20747 },
  status: "paid",
  createdAt: "2026-05-07T15:30:00.000Z",
  delivery: {
    method: "pickup",
    recipient: { name: "Lola Cardona", phone: "5165550101" },
    window: { date: "2026-05-15", slot: "midday" },
    cardMessage: "Feliz cumpleaños mamá",
  },
};
writeFileSync("/tmp/sample.pdf", await renderOrderPdf(order));
EOF
pnpm exec tsx /tmp/render-sample.mjs && open /tmp/sample.pdf
```

(If `tsx` isn't installed: `pnpm add -D tsx`. Don't commit it just for this — install ad hoc.)

- [ ] **Step 7: Commit**

```bash
git add lib/print-render.tsx tests/unit/print-render.test.ts public/print/card-bg-default.png
git commit -m "feat(print): cut line + decorative card bottom half"
```

---

## Phase B — Print queue

### Task 5: Define `PrintJob` type and storage primitives

**Files:**
- Create: `types/print-job.ts`
- Create: `lib/print-queue.ts`
- Create: `tests/unit/print-queue.test.ts`

- [ ] **Step 1: Write tests for read/write of an empty + populated queue**

Create `tests/unit/print-queue.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";

const TEST_FILE = path.join(os.tmpdir(), `diva-test-print-queue-${process.pid}.json`);

beforeEach(async () => {
  vi.stubEnv("PRINT_QUEUE_FILE", TEST_FILE);
  await fs.writeFile(TEST_FILE, "[]", "utf8");
});
afterEach(async () => {
  try { await fs.unlink(TEST_FILE); } catch {}
  vi.unstubAllEnvs();
});

describe("print-queue storage", () => {
  it("returns empty list for fresh queue", async () => {
    const { __readAll } = await import("@/lib/print-queue");
    expect(await __readAll()).toEqual([]);
  });

  it("returns empty when file does not exist", async () => {
    await fs.unlink(TEST_FILE);
    const { __readAll } = await import("@/lib/print-queue");
    expect(await __readAll()).toEqual([]);
  });
});
```

- [ ] **Step 2: Run, expect fail (module missing)**

Run: `pnpm test tests/unit/print-queue.test.ts`
Expected: FAIL — `@/lib/print-queue` not found.

- [ ] **Step 3: Create types and storage scaffold**

Create `types/print-job.ts`:

```ts
export type PrintJobStatus = "pending" | "printing" | "printed" | "failed";

export type PrintJob = {
  id: string;
  orderId: string;
  status: PrintJobStatus;
  pdfBase64: string;
  attempts: number;
  error?: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  printedAt?: string; // ISO
};
```

Create `lib/print-queue.ts`:

```ts
// lib/print-queue.ts
import { promises as fs } from "node:fs";
import path from "node:path";
import type { PrintJob, PrintJobStatus } from "@/types/print-job";

function storageFile(): string {
  const override = process.env.PRINT_QUEUE_FILE;
  if (override) return path.isAbsolute(override) ? override : path.resolve(override);
  return path.join(process.cwd(), "print-queue.json");
}

export async function __readAll(): Promise<PrintJob[]> {
  try {
    const raw = await fs.readFile(storageFile(), "utf8");
    return JSON.parse(raw) as PrintJob[];
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw e;
  }
}

export async function __writeAll(all: PrintJob[]): Promise<void> {
  await fs.writeFile(storageFile(), JSON.stringify(all, null, 2), "utf8");
}
```

- [ ] **Step 4: Run tests, expect pass**

Run: `pnpm test tests/unit/print-queue.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add types/print-job.ts lib/print-queue.ts tests/unit/print-queue.test.ts
git commit -m "feat(print): print-queue storage primitives + PrintJob type"
```

---

### Task 6: Implement `enqueuePrintJob`, `claimPendingJobs`, `ackJob`

**Files:**
- Modify: `lib/print-queue.ts`
- Modify: `tests/unit/print-queue.test.ts`

`claimPendingJobs(limit)` returns up to `limit` jobs and atomically flips them to `printing` (so concurrent agent polls don't pick up the same job). `ackJob(id, "printed" | "failed", error?)` finalizes.

- [ ] **Step 1: Write tests for state transitions**

Append to `tests/unit/print-queue.test.ts`:

```ts
import type { Order } from "@/types/order";

const baseOrder: Order = {
  id: "do_q1",
  locale: "en",
  lines: [],
  contact: { email: "x@y.com", phone: "5555555555" },
  totals: { subtotalCents: 1000, deliveryCents: 0, taxCents: 0, totalCents: 1000 },
  status: "paid",
  createdAt: "2026-05-07T00:00:00.000Z",
  delivery: {
    method: "pickup",
    recipient: { name: "R", phone: "5555555555" },
    window: { date: "2099-01-01", slot: "midday" },
  },
};

// Stub render to avoid pulling @react-pdf into queue tests.
vi.mock("@/lib/print-render", () => ({
  renderOrderPdf: vi.fn(async () => Buffer.from("FAKE-PDF-BYTES")),
}));

describe("print-queue state machine", () => {
  it("enqueuePrintJob adds a pending job with rendered PDF", async () => {
    const { enqueuePrintJob, __readAll } = await import("@/lib/print-queue");
    const job = await enqueuePrintJob(baseOrder);
    expect(job.status).toBe("pending");
    expect(job.orderId).toBe("do_q1");
    expect(job.pdfBase64.length).toBeGreaterThan(0);
    const all = await __readAll();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe(job.id);
  });

  it("claimPendingJobs flips pending → printing and returns the claimed jobs", async () => {
    const { enqueuePrintJob, claimPendingJobs, __readAll } = await import("@/lib/print-queue");
    await enqueuePrintJob(baseOrder);
    await enqueuePrintJob({ ...baseOrder, id: "do_q2" });

    const claimed = await claimPendingJobs(10);
    expect(claimed).toHaveLength(2);
    expect(claimed.every((j) => j.status === "printing")).toBe(true);

    const all = await __readAll();
    expect(all.every((j) => j.status === "printing")).toBe(true);
  });

  it("claimPendingJobs respects the limit", async () => {
    const { enqueuePrintJob, claimPendingJobs } = await import("@/lib/print-queue");
    await enqueuePrintJob(baseOrder);
    await enqueuePrintJob({ ...baseOrder, id: "do_q2" });
    await enqueuePrintJob({ ...baseOrder, id: "do_q3" });

    const claimed = await claimPendingJobs(2);
    expect(claimed).toHaveLength(2);
  });

  it("ackJob('printed') marks the job printed and stamps printedAt", async () => {
    const { enqueuePrintJob, claimPendingJobs, ackJob, __readAll } = await import("@/lib/print-queue");
    await enqueuePrintJob(baseOrder);
    const [j] = await claimPendingJobs(1);
    await ackJob(j.id, "printed");
    const all = await __readAll();
    expect(all[0].status).toBe("printed");
    expect(all[0].printedAt).toBeTruthy();
  });

  it("ackJob('failed', err) marks failed, increments attempts, stores error", async () => {
    const { enqueuePrintJob, claimPendingJobs, ackJob, __readAll } = await import("@/lib/print-queue");
    await enqueuePrintJob(baseOrder);
    const [j] = await claimPendingJobs(1);
    await ackJob(j.id, "failed", "printer offline");
    const all = await __readAll();
    expect(all[0].status).toBe("failed");
    expect(all[0].error).toBe("printer offline");
    expect(all[0].attempts).toBe(1);
  });

  it("recoverStuckJobs flips printing → pending after timeout", async () => {
    const { enqueuePrintJob, claimPendingJobs, recoverStuckJobs, __readAll } = await import("@/lib/print-queue");
    await enqueuePrintJob(baseOrder);
    await claimPendingJobs(1);
    // Backdate updatedAt to 6 minutes ago.
    const all = await __readAll();
    all[0].updatedAt = new Date(Date.now() - 6 * 60_000).toISOString();
    await fs.writeFile(TEST_FILE, JSON.stringify(all), "utf8");

    const recovered = await recoverStuckJobs(5 * 60_000);
    expect(recovered).toBe(1);
    const after = await __readAll();
    expect(after[0].status).toBe("pending");
  });
});
```

- [ ] **Step 2: Run tests, expect fail**

Run: `pnpm test tests/unit/print-queue.test.ts`
Expected: FAIL — exports missing.

- [ ] **Step 3: Implement state-machine functions in `lib/print-queue.ts`**

Append to the file:

```ts
import type { Order } from "@/types/order";
import { renderOrderPdf } from "@/lib/print-render";

function newId(): string {
  // 16 hex chars; collision-safe enough for in-shop volume.
  return Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
}

export async function enqueuePrintJob(order: Order): Promise<PrintJob> {
  const pdf = await renderOrderPdf(order);
  const now = new Date().toISOString();
  const job: PrintJob = {
    id: newId(),
    orderId: order.id,
    status: "pending",
    pdfBase64: pdf.toString("base64"),
    attempts: 0,
    createdAt: now,
    updatedAt: now,
  };
  const all = await __readAll();
  all.push(job);
  await __writeAll(all);
  return job;
}

export async function claimPendingJobs(limit: number): Promise<PrintJob[]> {
  const all = await __readAll();
  const pending = all.filter((j) => j.status === "pending").slice(0, limit);
  if (pending.length === 0) return [];
  const now = new Date().toISOString();
  for (const j of pending) {
    j.status = "printing";
    j.updatedAt = now;
  }
  await __writeAll(all);
  return pending;
}

export async function ackJob(
  id: string,
  status: "printed" | "failed",
  error?: string,
): Promise<void> {
  const all = await __readAll();
  const job = all.find((j) => j.id === id);
  if (!job) return;
  const now = new Date().toISOString();
  job.status = status;
  job.updatedAt = now;
  if (status === "printed") {
    job.printedAt = now;
    job.error = undefined;
  } else {
    job.attempts += 1;
    job.error = error;
  }
  await __writeAll(all);
}

export async function recoverStuckJobs(timeoutMs: number): Promise<number> {
  const all = await __readAll();
  const cutoff = Date.now() - timeoutMs;
  let count = 0;
  const now = new Date().toISOString();
  for (const j of all) {
    if (j.status === "printing" && Date.parse(j.updatedAt) < cutoff) {
      j.status = "pending";
      j.updatedAt = now;
      count += 1;
    }
  }
  if (count > 0) await __writeAll(all);
  return count;
}

export async function getQueueHealth(): Promise<{
  pendingCount: number;
  oldestPendingAgeSeconds: number | null;
  lastPrintedAt: string | null;
}> {
  const all = await __readAll();
  const pending = all.filter((j) => j.status === "pending");
  const oldest = pending
    .map((j) => Date.parse(j.createdAt))
    .reduce<number | null>((min, t) => (min === null || t < min ? t : min), null);
  const printedAts = all
    .filter((j) => j.status === "printed" && j.printedAt)
    .map((j) => j.printedAt as string)
    .sort();
  return {
    pendingCount: pending.length,
    oldestPendingAgeSeconds: oldest === null ? null : Math.floor((Date.now() - oldest) / 1000),
    lastPrintedAt: printedAts.at(-1) ?? null,
  };
}
```

- [ ] **Step 4: Run tests, expect pass**

Run: `pnpm test tests/unit/print-queue.test.ts`
Expected: PASS for all 6 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/print-queue.ts tests/unit/print-queue.test.ts
git commit -m "feat(print): print-queue state machine (enqueue/claim/ack/recover)"
```

---

## Phase C — API endpoints + auth

### Task 7: Bearer-token auth helper

**Files:**
- Create: `lib/print-auth.ts`
- Create: `tests/unit/print-auth.test.ts`

- [ ] **Step 1: Write tests**

Create `tests/unit/print-auth.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { isPrintAuthValid } from "@/lib/print-auth";

describe("isPrintAuthValid", () => {
  beforeEach(() => {
    vi.stubEnv("PRINT_AGENT_TOKEN", "supersecret-32bytes");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("accepts a correct Bearer header", () => {
    expect(isPrintAuthValid("Bearer supersecret-32bytes")).toBe(true);
  });

  it("rejects missing header", () => {
    expect(isPrintAuthValid(null)).toBe(false);
    expect(isPrintAuthValid(undefined)).toBe(false);
  });

  it("rejects wrong scheme", () => {
    expect(isPrintAuthValid("Basic supersecret-32bytes")).toBe(false);
  });

  it("rejects wrong token", () => {
    expect(isPrintAuthValid("Bearer not-the-token")).toBe(false);
  });

  it("rejects when env var is missing", () => {
    vi.unstubAllEnvs();
    expect(isPrintAuthValid("Bearer anything")).toBe(false);
  });

  it("uses constant-time comparison (no early-exit on length mismatch)", () => {
    // Both should return false; we don't assert timing here, only correctness.
    expect(isPrintAuthValid("Bearer x")).toBe(false);
    expect(isPrintAuthValid("Bearer xx")).toBe(false);
  });
});
```

- [ ] **Step 2: Run, expect fail**

Run: `pnpm test tests/unit/print-auth.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement `lib/print-auth.ts`**

```ts
// lib/print-auth.ts
import { timingSafeEqual } from "node:crypto";

export function isPrintAuthValid(header: string | null | undefined): boolean {
  const expected = process.env.PRINT_AGENT_TOKEN;
  if (!expected) return false;
  if (!header || !header.startsWith("Bearer ")) return false;
  const provided = header.slice("Bearer ".length);
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) {
    // timingSafeEqual requires equal-length inputs; pad to avoid early return shape.
    timingSafeEqual(b, b);
    return false;
  }
  return timingSafeEqual(a, b);
}
```

- [ ] **Step 4: Run, expect pass**

Run: `pnpm test tests/unit/print-auth.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/print-auth.ts tests/unit/print-auth.test.ts
git commit -m "feat(print): bearer-token auth helper with timing-safe compare"
```

---

### Task 8: `GET /api/print/queue` endpoint

**Files:**
- Create: `app/api/print/queue/route.ts`
- Create: `tests/unit/api-print-queue.test.ts`

- [ ] **Step 1: Write tests**

Create `tests/unit/api-print-queue.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import type { Order } from "@/types/order";
import { __resetRateLimitForTests } from "@/lib/rate-limit";

const TEST_FILE = path.join(os.tmpdir(), `diva-test-print-api-${process.pid}.json`);

vi.mock("@/lib/print-render", () => ({
  renderOrderPdf: vi.fn(async () => Buffer.from("FAKE")),
}));

const baseOrder: Order = {
  id: "do_api1",
  locale: "en",
  lines: [],
  contact: { email: "x@y.com", phone: "5555555555" },
  totals: { subtotalCents: 1000, deliveryCents: 0, taxCents: 0, totalCents: 1000 },
  status: "paid",
  createdAt: "2026-05-07T00:00:00.000Z",
  delivery: {
    method: "pickup",
    recipient: { name: "R", phone: "5555555555" },
    window: { date: "2099-01-01", slot: "midday" },
  },
};

beforeEach(async () => {
  vi.stubEnv("PRINT_QUEUE_FILE", TEST_FILE);
  vi.stubEnv("PRINT_AGENT_TOKEN", "test-token-32bytes");
  await fs.writeFile(TEST_FILE, "[]", "utf8");
  __resetRateLimitForTests();
});
afterEach(async () => {
  try { await fs.unlink(TEST_FILE); } catch {}
  vi.unstubAllEnvs();
});

function req(headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/print/queue", { method: "GET", headers });
}

describe("GET /api/print/queue", () => {
  it("returns 401 when Authorization header is missing", async () => {
    const { GET } = await import("@/app/api/print/queue/route");
    const res = await GET(req());
    expect(res.status).toBe(401);
  });

  it("returns 401 when token is wrong", async () => {
    const { GET } = await import("@/app/api/print/queue/route");
    const res = await GET(req({ Authorization: "Bearer wrong-token" }));
    expect(res.status).toBe(401);
  });

  it("returns empty jobs array when queue is empty", async () => {
    const { GET } = await import("@/app/api/print/queue/route");
    const res = await GET(req({ Authorization: "Bearer test-token-32bytes" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.jobs).toEqual([]);
  });

  it("returns pending jobs and flips them to printing", async () => {
    const { enqueuePrintJob } = await import("@/lib/print-queue");
    await enqueuePrintJob(baseOrder);
    const { GET } = await import("@/app/api/print/queue/route");
    const res = await GET(req({ Authorization: "Bearer test-token-32bytes" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.jobs).toHaveLength(1);
    expect(body.jobs[0]).toMatchObject({ orderId: "do_api1" });
    expect(typeof body.jobs[0].pdfBase64).toBe("string");

    // Second poll returns nothing — already claimed.
    const res2 = await GET(req({ Authorization: "Bearer test-token-32bytes" }));
    expect((await res2.json()).jobs).toEqual([]);
  });

  it("recovers stuck jobs (printing > 5min old) and re-claims them", async () => {
    const { enqueuePrintJob } = await import("@/lib/print-queue");
    await enqueuePrintJob(baseOrder);
    const { GET } = await import("@/app/api/print/queue/route");
    await GET(req({ Authorization: "Bearer test-token-32bytes" })); // claim

    // Backdate updatedAt
    const raw = JSON.parse(await fs.readFile(TEST_FILE, "utf8"));
    raw[0].updatedAt = new Date(Date.now() - 6 * 60_000).toISOString();
    await fs.writeFile(TEST_FILE, JSON.stringify(raw), "utf8");

    const res = await GET(req({ Authorization: "Bearer test-token-32bytes" }));
    expect((await res.json()).jobs).toHaveLength(1);
  });

  it("rate-limits after 30 requests in a minute", async () => {
    const { GET } = await import("@/app/api/print/queue/route");
    const auth = { Authorization: "Bearer test-token-32bytes" };
    let last: Response | null = null;
    for (let i = 0; i < 31; i++) last = await GET(req(auth));
    expect(last!.status).toBe(429);
  });
});
```

- [ ] **Step 2: Run, expect fail**

Run: `pnpm test tests/unit/api-print-queue.test.ts`
Expected: FAIL — route module missing.

- [ ] **Step 3: Implement the endpoint**

Create `app/api/print/queue/route.ts`:

```ts
import { NextResponse } from "next/server";
import { isPrintAuthValid } from "@/lib/print-auth";
import { claimPendingJobs, recoverStuckJobs } from "@/lib/print-queue";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

const STUCK_TIMEOUT_MS = 5 * 60_000;
const CLAIM_LIMIT = 5;

export async function GET(req: Request): Promise<Response> {
  const auth = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!isPrintAuthValid(auth)) {
    return new NextResponse("unauthorized", { status: 401 });
  }
  // One bucket per token: print agent is single-instance so this just protects
  // against runaway loops, not multi-tenant abuse.
  const rl = rateLimit("print:queue", { max: 30, windowMs: 60_000 });
  if (!rl.ok) {
    return new NextResponse("rate limited", { status: 429 });
  }
  await recoverStuckJobs(STUCK_TIMEOUT_MS);
  const jobs = await claimPendingJobs(CLAIM_LIMIT);
  return NextResponse.json({ jobs });
}
```

- [ ] **Step 4: Run, expect pass**

Run: `pnpm test tests/unit/api-print-queue.test.ts`
Expected: PASS for all 6 tests.

- [ ] **Step 5: Commit**

```bash
git add app/api/print/queue/route.ts tests/unit/api-print-queue.test.ts
git commit -m "feat(print): GET /api/print/queue with auth + stuck-job recovery"
```

---

### Task 9: `POST /api/print/jobs/[id]/ack` endpoint

**Files:**
- Create: `app/api/print/jobs/[id]/ack/route.ts`
- Create: `tests/unit/api-print-jobs-ack.test.ts`

- [ ] **Step 1: Write tests**

Create `tests/unit/api-print-jobs-ack.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import type { Order } from "@/types/order";

const TEST_FILE = path.join(os.tmpdir(), `diva-test-ack-${process.pid}.json`);

vi.mock("@/lib/print-render", () => ({
  renderOrderPdf: vi.fn(async () => Buffer.from("FAKE")),
}));

// Failure-alert email is exercised separately; stub here.
vi.mock("@/lib/order-notifications", async () => {
  const actual = await vi.importActual<typeof import("@/lib/order-notifications")>(
    "@/lib/order-notifications",
  );
  return { ...actual, notifyPrintFailed: vi.fn() };
});

const baseOrder: Order = {
  id: "do_ack1",
  locale: "en",
  lines: [],
  contact: { email: "x@y.com", phone: "5555555555" },
  totals: { subtotalCents: 1000, deliveryCents: 0, taxCents: 0, totalCents: 1000 },
  status: "paid",
  createdAt: "2026-05-07T00:00:00.000Z",
  delivery: {
    method: "pickup",
    recipient: { name: "R", phone: "5555555555" },
    window: { date: "2099-01-01", slot: "midday" },
  },
};

beforeEach(async () => {
  vi.stubEnv("PRINT_QUEUE_FILE", TEST_FILE);
  vi.stubEnv("PRINT_AGENT_TOKEN", "tok-32bytes");
  await fs.writeFile(TEST_FILE, "[]", "utf8");
});
afterEach(async () => {
  try { await fs.unlink(TEST_FILE); } catch {}
  vi.unstubAllEnvs();
});

function req(id: string, body: unknown, headers: Record<string, string> = {}) {
  return new Request(`http://localhost/api/print/jobs/${id}/ack`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

async function enqueueAndClaim(orderOverrides: Partial<Order> = {}) {
  const { enqueuePrintJob, claimPendingJobs } = await import("@/lib/print-queue");
  await enqueuePrintJob({ ...baseOrder, ...orderOverrides });
  const [job] = await claimPendingJobs(1);
  return job;
}

describe("POST /api/print/jobs/[id]/ack", () => {
  it("returns 401 without auth", async () => {
    const job = await enqueueAndClaim();
    const { POST } = await import("@/app/api/print/jobs/[id]/ack/route");
    const res = await POST(req(job.id, { status: "printed" }), { params: Promise.resolve({ id: job.id }) } as any);
    expect(res.status).toBe(401);
  });

  it("marks the job as printed", async () => {
    const job = await enqueueAndClaim();
    const { POST } = await import("@/app/api/print/jobs/[id]/ack/route");
    const res = await POST(
      req(job.id, { status: "printed" }, { Authorization: "Bearer tok-32bytes" }),
      { params: Promise.resolve({ id: job.id }) } as any,
    );
    expect(res.status).toBe(200);
    const all = JSON.parse(await fs.readFile(TEST_FILE, "utf8"));
    expect(all[0].status).toBe("printed");
    expect(all[0].printedAt).toBeTruthy();
  });

  it("marks the job as failed and stores the error", async () => {
    const job = await enqueueAndClaim();
    const { POST } = await import("@/app/api/print/jobs/[id]/ack/route");
    await POST(
      req(job.id, { status: "failed", error: "printer offline" }, { Authorization: "Bearer tok-32bytes" }),
      { params: Promise.resolve({ id: job.id }) } as any,
    );
    const all = JSON.parse(await fs.readFile(TEST_FILE, "utf8"));
    expect(all[0].status).toBe("failed");
    expect(all[0].error).toBe("printer offline");
  });

  it("rejects malformed body", async () => {
    const job = await enqueueAndClaim();
    const { POST } = await import("@/app/api/print/jobs/[id]/ack/route");
    const res = await POST(
      req(job.id, { status: "weird" }, { Authorization: "Bearer tok-32bytes" }),
      { params: Promise.resolve({ id: job.id }) } as any,
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 for unknown job id", async () => {
    const { POST } = await import("@/app/api/print/jobs/[id]/ack/route");
    const res = await POST(
      req("nope", { status: "printed" }, { Authorization: "Bearer tok-32bytes" }),
      { params: Promise.resolve({ id: "nope" }) } as any,
    );
    expect(res.status).toBe(404);
  });

  it("calls notifyPrintFailed on failure", async () => {
    const { notifyPrintFailed } = await import("@/lib/order-notifications");
    const job = await enqueueAndClaim();
    const { POST } = await import("@/app/api/print/jobs/[id]/ack/route");
    await POST(
      req(job.id, { status: "failed", error: "boom" }, { Authorization: "Bearer tok-32bytes" }),
      { params: Promise.resolve({ id: job.id }) } as any,
    );
    expect(notifyPrintFailed).toHaveBeenCalledWith("do_ack1", "boom");
  });
});
```

- [ ] **Step 2: Run, expect fail**

Run: `pnpm test tests/unit/api-print-jobs-ack.test.ts`
Expected: FAIL — route + `notifyPrintFailed` missing.

- [ ] **Step 3: Add `notifyPrintFailed` stub to `lib/order-notifications.ts`**

Append to the existing `lib/order-notifications.ts` file:

```ts
export async function notifyPrintFailed(orderId: string, error: string): Promise<void> {
  const resend = getResend();
  const to = process.env.ORDER_NOTIFICATIONS_TO;
  const from = process.env.ORDER_NOTIFICATIONS_FROM;
  if (!resend || !to || !from) {
    console.warn("[print-notifications] missing config; skipping print-failure email");
    return;
  }
  const subject = `[PRINT FAILED] order ${orderId}`;
  const text = `Print job for order ${orderId} failed.\n\nError: ${error}\n\nCheck the print agent logs in the shop or hit /api/print/health for queue state.`;
  try {
    const result = await resend.emails.send({ from, to, subject, text });
    if (result.error) {
      console.error("[print-notifications] resend returned error", result.error);
    }
  } catch (e) {
    console.error("[print-notifications] resend.emails.send threw", e);
  }
}
```

- [ ] **Step 4: Implement the endpoint**

Create `app/api/print/jobs/[id]/ack/route.ts`:

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { isPrintAuthValid } from "@/lib/print-auth";
import { ackJob, __readAll } from "@/lib/print-queue";
import { notifyPrintFailed } from "@/lib/order-notifications";

export const runtime = "nodejs";

const bodySchema = z.object({
  status: z.enum(["printed", "failed"]),
  error: z.string().max(500).optional(),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  // Next.js 16 wraps dynamic-segment params in a Promise.
  // See app/api/order/[id]/status/route.ts for an existing example.
  const auth = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!isPrintAuthValid(auth)) {
    return new NextResponse("unauthorized", { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return new NextResponse("bad json", { status: 400 });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return new NextResponse("bad body", { status: 400 });
  }

  const { id } = await ctx.params;
  const all = await __readAll();
  const job = all.find((j) => j.id === id);
  if (!job) {
    return new NextResponse("not found", { status: 404 });
  }

  await ackJob(id, parsed.data.status, parsed.data.error);

  if (parsed.data.status === "failed") {
    void notifyPrintFailed(job.orderId, parsed.data.error ?? "unknown");
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 5: Run, expect pass**

Run: `pnpm test tests/unit/api-print-jobs-ack.test.ts`
Expected: PASS for all 6 tests.

- [ ] **Step 6: Commit**

```bash
git add app/api/print/jobs/[id]/ack/route.ts tests/unit/api-print-jobs-ack.test.ts lib/order-notifications.ts
git commit -m "feat(print): POST /api/print/jobs/[id]/ack + failure email alert"
```

---

### Task 10: `GET /api/print/health` endpoint

**Files:**
- Create: `app/api/print/health/route.ts`
- Create: `tests/unit/api-print-health.test.ts`

- [ ] **Step 1: Write tests**

Create `tests/unit/api-print-health.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import type { Order } from "@/types/order";

const TEST_FILE = path.join(os.tmpdir(), `diva-test-health-${process.pid}.json`);

vi.mock("@/lib/print-render", () => ({
  renderOrderPdf: vi.fn(async () => Buffer.from("FAKE")),
}));

const baseOrder: Order = {
  id: "do_h1",
  locale: "en",
  lines: [],
  contact: { email: "x@y.com", phone: "5555555555" },
  totals: { subtotalCents: 1000, deliveryCents: 0, taxCents: 0, totalCents: 1000 },
  status: "paid",
  createdAt: "2026-05-07T00:00:00.000Z",
  delivery: {
    method: "pickup",
    recipient: { name: "R", phone: "5555555555" },
    window: { date: "2099-01-01", slot: "midday" },
  },
};

beforeEach(async () => {
  vi.stubEnv("PRINT_QUEUE_FILE", TEST_FILE);
  vi.stubEnv("PRINT_AGENT_TOKEN", "tok-32bytes");
  await fs.writeFile(TEST_FILE, "[]", "utf8");
});
afterEach(async () => {
  try { await fs.unlink(TEST_FILE); } catch {}
  vi.unstubAllEnvs();
});

const auth = { Authorization: "Bearer tok-32bytes" };
const req = (h: Record<string, string> = {}) =>
  new Request("http://localhost/api/print/health", { method: "GET", headers: h });

describe("GET /api/print/health", () => {
  it("returns 401 without auth", async () => {
    const { GET } = await import("@/app/api/print/health/route");
    expect((await GET(req())).status).toBe(401);
  });

  it("reports 0 pending and null lastPrintedAt for empty queue", async () => {
    const { GET } = await import("@/app/api/print/health/route");
    const res = await GET(req(auth));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ pendingCount: 0, oldestPendingAgeSeconds: null, lastPrintedAt: null });
  });

  it("reports counts for mixed queue", async () => {
    const { enqueuePrintJob, claimPendingJobs, ackJob } = await import("@/lib/print-queue");
    await enqueuePrintJob(baseOrder);
    await enqueuePrintJob({ ...baseOrder, id: "do_h2" });
    const [first] = await claimPendingJobs(1);
    await ackJob(first.id, "printed");

    const { GET } = await import("@/app/api/print/health/route");
    const body = await (await GET(req(auth))).json();
    expect(body.pendingCount).toBe(1);
    expect(body.lastPrintedAt).toBeTruthy();
    expect(body.oldestPendingAgeSeconds).toBeGreaterThanOrEqual(0);
  });
});
```

- [ ] **Step 2: Run, expect fail**

Run: `pnpm test tests/unit/api-print-health.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement endpoint**

Create `app/api/print/health/route.ts`:

```ts
import { NextResponse } from "next/server";
import { isPrintAuthValid } from "@/lib/print-auth";
import { getQueueHealth } from "@/lib/print-queue";

export const runtime = "nodejs";

export async function GET(req: Request): Promise<Response> {
  const auth = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!isPrintAuthValid(auth)) {
    return new NextResponse("unauthorized", { status: 401 });
  }
  const health = await getQueueHealth();
  return NextResponse.json(health);
}
```

- [ ] **Step 4: Run, expect pass**

Run: `pnpm test tests/unit/api-print-health.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/print/health/route.ts tests/unit/api-print-health.test.ts
git commit -m "feat(print): GET /api/print/health snapshot endpoint"
```

---

## Phase D — Webhook integration

### Task 11: Wire `enqueuePrintJob` into the Stripe webhook

**Files:**
- Modify: `app/api/stripe/webhook/route.ts`
- Modify: `tests/unit/api-stripe-webhook.test.ts`

- [ ] **Step 1: Extend the webhook test**

In `tests/unit/api-stripe-webhook.test.ts`, after the existing module mock for `@/lib/order-notifications`, add:

```ts
const enqueuePrintJobMock = vi.fn();
vi.mock("@/lib/print-queue", () => ({
  enqueuePrintJob: enqueuePrintJobMock,
}));
```

In `beforeEach`, after `notifyOrderPaidMock.mockReset();`, add:

```ts
enqueuePrintJobMock.mockReset();
```

Add a new test inside the `describe("POST /api/stripe/webhook")` block:

```ts
it("enqueues a print job on pending → paid transition", async () => {
  await saveOrder(makeOrder("o1", "pi_111"));
  constructEvent.mockReturnValue({
    type: "payment_intent.succeeded",
    data: { object: { id: "pi_111" } },
  });
  const { POST } = await import("@/app/api/stripe/webhook/route");
  await POST(makeReq("{}"));
  expect(enqueuePrintJobMock).toHaveBeenCalledTimes(1);
  expect(enqueuePrintJobMock.mock.calls[0][0].id).toBe("o1");
});

it("does not enqueue a print job for duplicate webhooks (already paid)", async () => {
  await saveOrder(makeOrder("o1", "pi_111", "paid"));
  constructEvent.mockReturnValue({
    type: "payment_intent.succeeded",
    data: { object: { id: "pi_111" } },
  });
  const { POST } = await import("@/app/api/stripe/webhook/route");
  await POST(makeReq("{}"));
  expect(enqueuePrintJobMock).not.toHaveBeenCalled();
});

it("returns 200 even when enqueuePrintJob throws (best-effort)", async () => {
  await saveOrder(makeOrder("o1", "pi_111"));
  constructEvent.mockReturnValue({
    type: "payment_intent.succeeded",
    data: { object: { id: "pi_111" } },
  });
  enqueuePrintJobMock.mockRejectedValue(new Error("disk full"));
  const { POST } = await import("@/app/api/stripe/webhook/route");
  const res = await POST(makeReq("{}"));
  expect(res.status).toBe(200);
  // Email notification still fired before the print failure.
  expect(notifyOrderPaidMock).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Run, expect fail**

Run: `pnpm test tests/unit/api-stripe-webhook.test.ts`
Expected: FAIL — `enqueuePrintJob` not yet wired.

- [ ] **Step 3: Modify the webhook to call enqueue**

Edit `app/api/stripe/webhook/route.ts`. At the imports, add:

```ts
import { enqueuePrintJob } from "@/lib/print-queue";
```

Replace the `payment_intent.succeeded` block:

```ts
case "payment_intent.succeeded": {
  const pi = event.data.object as Stripe.PaymentIntent;
  const order = await getOrderByPaymentIntent(pi.id);
  const wasAlreadyPaid = order?.status === "paid";
  await updateOrderStatusByPaymentIntent(pi.id, "paid");
  if (order && !wasAlreadyPaid) {
    await notifyOrderPaid(order);
    void sendPurchaseToGA4(orderToPurchasePayload(order));
    try {
      await enqueuePrintJob(order);
    } catch (e) {
      console.error("[print] enqueue failed for order", order.id, e);
      // Do not propagate: payment is recorded; print can be re-issued manually.
    }
  }
  break;
}
```

- [ ] **Step 4: Run all webhook tests, expect pass**

Run: `pnpm test tests/unit/api-stripe-webhook.test.ts`
Expected: PASS for all (existing + 3 new) tests.

- [ ] **Step 5: Commit**

```bash
git add app/api/stripe/webhook/route.ts tests/unit/api-stripe-webhook.test.ts
git commit -m "feat(print): enqueue print job on Stripe payment_intent.succeeded"
```

---

## Phase E — Card visual asset

### Task 12: Generate the card background with Higgsfield

**Files:**
- Modify: `public/print/card-bg-default.png` (replace placeholder)

This task is interactive and uses the `mcp__claude_ai_higgsfield__generate_image` tool. The generated image is committed as a static asset.

- [ ] **Step 1: Inspect Maky brand palette**

Open `app/globals.css` and look for the `petal` and `bone` color variables. The card background should pick up tones consistent with these.

- [ ] **Step 2: Generate the artwork**

Use the Higgsfield MCP `generate_image` tool with a prompt like:

> Soft watercolor floral background for a printed bouquet card, pale petal-pink and bone-cream tones, gentle ink wash, lots of negative space in the center for a hand-written message, subtle botanical sprigs framing the edges, no text, no logo, light and airy, high resolution, 5.5:8.5 aspect ratio.

Generate 3–5 candidates and pick the one with the best balance of decoration and central whitespace. Aim for a quiet image — the customer's message must read on top of it.

- [ ] **Step 3: Replace the placeholder**

Save the chosen image to `public/print/card-bg-default.png`. Target dimensions: ~1100×1700 px (5.5:8.5 aspect, with a bit of bleed). PNG keeps things simple and renders cleanly in `@react-pdf/renderer` — no conversion to webp needed.

- [ ] **Step 4: Run a manual render to verify**

```bash
cat > /tmp/render-sample.mjs <<'EOF'
import { renderOrderPdf } from "./lib/print-render.tsx";
import { writeFileSync } from "node:fs";
const order = {
  id: "do_sample",
  locale: "es",
  lines: [],
  contact: { email: "buyer@example.com", phone: "5165551234" },
  totals: { subtotalCents: 19100, deliveryCents: 0, taxCents: 1647, totalCents: 20747 },
  status: "paid",
  createdAt: "2026-05-07T15:30:00.000Z",
  delivery: {
    method: "pickup",
    recipient: { name: "Lola Cardona", phone: "5165550101" },
    window: { date: "2026-05-15", slot: "midday" },
    cardMessage: "Feliz cumpleaños mamá",
  },
};
writeFileSync("/tmp/sample.pdf", await renderOrderPdf(order));
EOF
pnpm exec tsx /tmp/render-sample.mjs && open /tmp/sample.pdf
```

Expected: visually correct order ticket on top, card with Maky-style background and the message centered on the bottom half.

- [ ] **Step 5: Run unit tests to make sure nothing regressed**

Run: `pnpm test tests/unit/print-render.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add public/print/card-bg-default.png
git commit -m "feat(print): card-bg-default artwork (Higgsfield-generated)"
```

---

## Phase F — Print agent (Windows)

### Task 13: Scaffold `tools/print-agent/`

**Files:**
- Create: `tools/print-agent/package.json`
- Create: `tools/print-agent/tsconfig.json`
- Create: `tools/print-agent/.env.example`
- Create: `tools/print-agent/.gitignore`

- [ ] **Step 1: Create the directory and `package.json`**

```bash
mkdir -p tools/print-agent/src tools/print-agent/logs
```

Create `tools/print-agent/package.json`:

```json
{
  "name": "maky-print-agent",
  "version": "0.1.0",
  "private": true,
  "description": "Polls the Diva Flowers server for paid-order print jobs and sends them to the local printer.",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "tsx src/index.ts",
    "test-print": "tsx src/test-print.ts",
    "install-service": "node install-service.js",
    "uninstall-service": "node uninstall-service.js"
  },
  "engines": {
    "node": ">=20"
  },
  "dependencies": {
    "dotenv": "^16.4.5",
    "node-windows": "^1.0.0-beta.8",
    "pdf-to-printer": "^5.6.0",
    "pino": "^9.5.0",
    "pino-pretty": "^11.3.0"
  },
  "devDependencies": {
    "@types/node": "^20",
    "tsx": "^4.19.2",
    "typescript": "^5"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "moduleResolution": "node",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "declaration": false,
    "sourceMap": true
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Create `.env.example`**

```
# URL of the Diva Flowers site (production).
PRINT_API_URL=https://makythedivaflowers.com

# Bearer token. Must match PRINT_AGENT_TOKEN on the server (Vercel env).
PRINT_AGENT_TOKEN=replace-with-the-token

# Exact printer name as shown in Windows Settings → Printers.
PRINTER_NAME=HP LaserJet Pro

# Polling interval in milliseconds (default 10000 = 10s).
POLL_INTERVAL_MS=10000

# Optional: log level (debug | info | warn | error). Default info.
LOG_LEVEL=info
```

- [ ] **Step 4: Create `.gitignore`**

```
node_modules/
dist/
logs/*.log
.env
*.pdf
```

- [ ] **Step 5: Install dependencies (locally to verify package.json is valid)**

```bash
cd tools/print-agent && npm install --no-package-lock --omit=optional --ignore-scripts && cd -
```

Expected: deps install. `node-windows` may print warnings on macOS (it's a no-op there); ignore them. Don't commit `node_modules/`.

- [ ] **Step 6: Commit**

```bash
git add tools/print-agent/package.json tools/print-agent/tsconfig.json tools/print-agent/.env.example tools/print-agent/.gitignore
git commit -m "feat(print-agent): scaffold tools/print-agent package"
```

---

### Task 14: Logger and config

**Files:**
- Create: `tools/print-agent/src/log.ts`
- Create: `tools/print-agent/src/config.ts`

- [ ] **Step 1: Create the logger**

`tools/print-agent/src/log.ts`:

```ts
import pino from "pino";
import path from "node:path";

const LOG_DIR = path.resolve(__dirname, "..", "logs");
const today = new Date().toISOString().slice(0, 10);
const logFile = path.join(LOG_DIR, `agent-${today}.log`);

const level = (process.env.LOG_LEVEL ?? "info") as "debug" | "info" | "warn" | "error";

export const logger = pino({
  level,
  base: { svc: "maky-print-agent" },
  transport: {
    targets: [
      { target: "pino-pretty", level, options: { colorize: true } },
      { target: "pino/file", level, options: { destination: logFile, mkdir: true } },
    ],
  },
});
```

- [ ] **Step 2: Create config loader**

`tools/print-agent/src/config.ts`:

```ts
import dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

export type Config = {
  apiUrl: string;
  token: string;
  printerName: string;
  pollIntervalMs: number;
};

export function loadConfig(): Config {
  const required = ["PRINT_API_URL", "PRINT_AGENT_TOKEN", "PRINTER_NAME"] as const;
  for (const k of required) {
    if (!process.env[k] || process.env[k]!.trim() === "") {
      throw new Error(`missing required env var: ${k}`);
    }
  }
  const interval = Number(process.env.POLL_INTERVAL_MS ?? "10000");
  if (!Number.isFinite(interval) || interval < 1000) {
    throw new Error(`POLL_INTERVAL_MS must be a number >= 1000, got: ${process.env.POLL_INTERVAL_MS}`);
  }
  return {
    apiUrl: process.env.PRINT_API_URL!.replace(/\/$/, ""),
    token: process.env.PRINT_AGENT_TOKEN!,
    printerName: process.env.PRINTER_NAME!,
    pollIntervalMs: interval,
  };
}
```

- [ ] **Step 3: Smoke check the config loader**

```bash
cd tools/print-agent && PRINT_API_URL=https://example.com PRINT_AGENT_TOKEN=x PRINTER_NAME=y node -e "require('tsx/cjs'); console.log(require('./src/config').loadConfig())" && cd -
```

Expected: prints the config object. Errors out clearly when any required env is missing.

- [ ] **Step 4: Commit**

```bash
git add tools/print-agent/src/log.ts tools/print-agent/src/config.ts
git commit -m "feat(print-agent): logger + config loader"
```

---

### Task 15: HTTP client (queue, ack, health)

**Files:**
- Create: `tools/print-agent/src/api.ts`

Node 20 has global `fetch`. We don't need `node-fetch`.

- [ ] **Step 1: Create `tools/print-agent/src/api.ts`**

```ts
import type { Config } from "./config";

export type ServerJob = {
  id: string;
  orderId: string;
  pdfBase64: string;
};

export class PrintApi {
  constructor(private cfg: Config) {}

  private h() {
    return { Authorization: `Bearer ${this.cfg.token}`, "content-type": "application/json" };
  }

  async fetchQueue(): Promise<ServerJob[]> {
    const res = await fetch(`${this.cfg.apiUrl}/api/print/queue`, { headers: this.h() });
    if (!res.ok) throw new Error(`queue fetch failed: ${res.status} ${res.statusText}`);
    const body = (await res.json()) as { jobs: ServerJob[] };
    return body.jobs;
  }

  async ack(jobId: string, status: "printed" | "failed", error?: string): Promise<void> {
    const res = await fetch(`${this.cfg.apiUrl}/api/print/jobs/${jobId}/ack`, {
      method: "POST",
      headers: this.h(),
      body: JSON.stringify({ status, error }),
    });
    if (!res.ok) throw new Error(`ack failed: ${res.status} ${res.statusText}`);
  }

  async health(): Promise<{ pendingCount: number; lastPrintedAt: string | null }> {
    const res = await fetch(`${this.cfg.apiUrl}/api/print/health`, { headers: this.h() });
    if (!res.ok) throw new Error(`health failed: ${res.status} ${res.statusText}`);
    return res.json();
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add tools/print-agent/src/api.ts
git commit -m "feat(print-agent): API client for queue/ack/health"
```

---

### Task 16: Print module (`pdf-to-printer` wrapper)

**Files:**
- Create: `tools/print-agent/src/print.ts`

- [ ] **Step 1: Create `tools/print-agent/src/print.ts`**

```ts
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { print as pdfPrint } from "pdf-to-printer";
import { logger } from "./log";

export async function printPdf(jobId: string, pdfBase64: string, printerName: string): Promise<void> {
  const tmpPath = path.join(os.tmpdir(), `maky-print-${jobId}.pdf`);
  try {
    await fs.writeFile(tmpPath, Buffer.from(pdfBase64, "base64"));
    logger.debug({ jobId, tmpPath }, "wrote temp pdf");
    await pdfPrint(tmpPath, { printer: printerName });
    logger.info({ jobId, printer: printerName }, "printed");
  } finally {
    try { await fs.unlink(tmpPath); } catch (e) {
      logger.warn({ jobId, err: (e as Error).message }, "failed to delete temp pdf");
    }
  }
}

export async function printPdfWithRetry(
  jobId: string,
  pdfBase64: string,
  printerName: string,
): Promise<void> {
  const delays = [0, 5_000, 30_000, 120_000]; // immediate, 5s, 30s, 2min — total 4 attempts
  let lastErr: unknown;
  for (let attempt = 0; attempt < delays.length; attempt++) {
    if (delays[attempt] > 0) {
      await new Promise((r) => setTimeout(r, delays[attempt]));
    }
    try {
      await printPdf(jobId, pdfBase64, printerName);
      if (attempt > 0) logger.info({ jobId, attempt }, "print succeeded after retry");
      return;
    } catch (e) {
      lastErr = e;
      logger.warn({ jobId, attempt, err: (e as Error).message }, "print attempt failed");
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("print failed");
}
```

- [ ] **Step 2: Commit**

```bash
git add tools/print-agent/src/print.ts
git commit -m "feat(print-agent): pdf-to-printer wrapper with retry policy"
```

---

### Task 17: Single tick (`poll`) + main loop (`index`)

**Files:**
- Create: `tools/print-agent/src/poll.ts`
- Create: `tools/print-agent/src/index.ts`

- [ ] **Step 1: Create `tools/print-agent/src/poll.ts`**

```ts
import { PrintApi } from "./api";
import { printPdfWithRetry } from "./print";
import { logger } from "./log";
import type { Config } from "./config";

export async function tick(api: PrintApi, cfg: Config): Promise<void> {
  let jobs;
  try {
    jobs = await api.fetchQueue();
  } catch (e) {
    logger.warn({ err: (e as Error).message }, "queue fetch failed; will retry next tick");
    return;
  }
  if (jobs.length === 0) return;
  logger.info({ count: jobs.length }, "claimed jobs");
  for (const job of jobs) {
    try {
      await printPdfWithRetry(job.id, job.pdfBase64, cfg.printerName);
      try {
        await api.ack(job.id, "printed");
        logger.info({ jobId: job.id, orderId: job.orderId }, "job printed and acked");
      } catch (e) {
        logger.error({ jobId: job.id, err: (e as Error).message }, "ack failed after print success");
      }
    } catch (e) {
      const errMsg = (e as Error).message;
      logger.error({ jobId: job.id, orderId: job.orderId, err: errMsg }, "all print attempts failed");
      try {
        await api.ack(job.id, "failed", errMsg);
      } catch (ackErr) {
        logger.error({ jobId: job.id, err: (ackErr as Error).message }, "ack(failed) failed");
      }
    }
  }
}
```

- [ ] **Step 2: Create `tools/print-agent/src/index.ts`**

```ts
import { loadConfig } from "./config";
import { logger } from "./log";
import { PrintApi } from "./api";
import { tick } from "./poll";

let stopping = false;
async function main() {
  const cfg = loadConfig();
  const api = new PrintApi(cfg);
  logger.info({ apiUrl: cfg.apiUrl, printer: cfg.printerName, intervalMs: cfg.pollIntervalMs }, "agent starting");

  // Boot health check. Failures don't abort — server may be temporarily unreachable.
  try {
    const h = await api.health();
    logger.info({ pending: h.pendingCount }, "boot health ok");
  } catch (e) {
    logger.warn({ err: (e as Error).message }, "boot health failed; continuing anyway");
  }

  // Loop forever. Each tick is sequential; we do not allow two ticks to overlap.
  while (!stopping) {
    try {
      await tick(api, cfg);
    } catch (e) {
      logger.error({ err: (e as Error).message }, "tick threw — continuing");
    }
    await new Promise((r) => setTimeout(r, cfg.pollIntervalMs));
  }
}

process.on("SIGINT", () => { stopping = true; logger.info("SIGINT received, stopping"); });
process.on("SIGTERM", () => { stopping = true; logger.info("SIGTERM received, stopping"); });

main().catch((e) => {
  logger.error({ err: (e as Error).message }, "agent crashed at startup");
  process.exit(1);
});
```

- [ ] **Step 3: Build the agent locally to validate**

```bash
cd tools/print-agent && npx tsc && cd -
```

Expected: `dist/` populated, no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add tools/print-agent/src/poll.ts tools/print-agent/src/index.ts
git commit -m "feat(print-agent): poll loop + main entry point"
```

---

### Task 18: `test-print` smoke script

**Files:**
- Modify: `tools/print-agent/package.json` (add `pdfkit`)
- Create: `tools/print-agent/src/test-print.ts`

This script generates a tiny PDF locally (without hitting the server) and prints it. It verifies the printer name + driver work end-to-end on the operator's machine. We use `pdfkit` so the PDF is guaranteed valid (a hand-rolled PDF risks bad xref offsets and confusing printer-driver errors).

- [ ] **Step 1: Add `pdfkit` to the agent's dependencies**

Edit `tools/print-agent/package.json` and add to `dependencies`:

```json
"pdfkit": "^0.15.0"
```

Then add to `devDependencies`:

```json
"@types/pdfkit": "^0.13.4"
```

Run:

```bash
cd tools/print-agent && npm install && cd -
```

- [ ] **Step 2: Create `tools/print-agent/src/test-print.ts`**

```ts
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { print as pdfPrint } from "pdf-to-printer";
import PDFDocument from "pdfkit";
import { loadConfig } from "./config";
import { logger } from "./log";

async function buildTestPdf(): Promise<Buffer> {
  return await new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "LETTER", margin: 72 });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c as Buffer));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.fontSize(20).text("Maky Print Agent — test page", { align: "center" });
    doc.moveDown();
    doc.fontSize(12).text(`Generated ${new Date().toISOString()}`, { align: "center" });
    doc.moveDown(2);
    doc.fontSize(10).text(
      "If you see this page, the printer connection works.\n" +
      "Run `npm run install-service` next to register the service.",
      { align: "center" },
    );
    doc.end();
  });
}

async function main() {
  const cfg = loadConfig();
  const tmp = path.join(os.tmpdir(), `maky-test-print-${Date.now()}.pdf`);
  const pdf = await buildTestPdf();
  await fs.writeFile(tmp, pdf);
  logger.info({ printer: cfg.printerName, tmp }, "sending test page to printer");
  await pdfPrint(tmp, { printer: cfg.printerName });
  logger.info("test page submitted to printer");
  await fs.unlink(tmp);
}

main().catch((e) => {
  logger.error({ err: (e as Error).message }, "test-print failed");
  process.exit(1);
});
```

- [ ] **Step 3: Build to verify TS compiles**

```bash
cd tools/print-agent && npx tsc && cd -
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add tools/print-agent/package.json tools/print-agent/src/test-print.ts
git commit -m "feat(print-agent): test-print smoke script using pdfkit"
```

---

### Task 19: Windows Service install/uninstall scripts

**Files:**
- Create: `tools/print-agent/install-service.js`
- Create: `tools/print-agent/uninstall-service.js`

These are plain JS (not TS) because they run via `node` directly without a build step, and `node-windows` examples use CJS.

- [ ] **Step 1: Create `tools/print-agent/install-service.js`**

```js
const path = require("path");
const { Service } = require("node-windows");

const svc = new Service({
  name: "MakyPrintAgent",
  description: "Polls the Diva Flowers server and prints paid orders.",
  script: path.join(__dirname, "dist", "index.js"),
  nodeOptions: [],
  workingDirectory: __dirname,
});

svc.on("install", () => {
  console.log("Service installed. Starting…");
  svc.start();
});
svc.on("start", () => console.log("MakyPrintAgent service started."));
svc.on("error", (e) => console.error("Service error:", e));

svc.install();
```

- [ ] **Step 2: Create `tools/print-agent/uninstall-service.js`**

```js
const path = require("path");
const { Service } = require("node-windows");

const svc = new Service({
  name: "MakyPrintAgent",
  script: path.join(__dirname, "dist", "index.js"),
});

svc.on("uninstall", () => console.log("MakyPrintAgent service removed."));
svc.uninstall();
```

- [ ] **Step 3: Commit**

```bash
git add tools/print-agent/install-service.js tools/print-agent/uninstall-service.js
git commit -m "feat(print-agent): Windows Service install/uninstall scripts"
```

---

### Task 20: Print agent README

**Files:**
- Create: `tools/print-agent/README.md`

- [ ] **Step 1: Create `tools/print-agent/README.md`**

```markdown
# Maky Print Agent

Local Windows agent that polls https://makythedivaflowers.com for paid-order print jobs and sends them to the shop printer.

## Requirements

- Windows 10 or 11
- Node.js LTS (>= 20) — install from https://nodejs.org
- A Wi-Fi printer paired with this computer in **Settings → Bluetooth & Devices → Printers**
- Bearer token for the print API (ask the developer; rotated periodically)

## First-time install

Run all commands in **PowerShell as Administrator**.

1. Get the agent code on the machine. Either:
   - Clone the repo: `git clone https://github.com/<org>/diva-flowers.git C:\maky` then `cd C:\maky\tools\print-agent`
   - Or copy the `tools/print-agent/` folder by hand into `C:\maky-print-agent\` and `cd C:\maky-print-agent`

2. Install dependencies:
   ```powershell
   npm install
   npm run build
   ```

3. Configure environment:
   ```powershell
   copy .env.example .env
   notepad .env
   ```

   Fill in:
   - `PRINT_API_URL=https://makythedivaflowers.com`
   - `PRINT_AGENT_TOKEN=<token from password manager>`
   - `PRINTER_NAME=<exact printer name from Settings → Printers>`

4. Verify the printer works:
   ```powershell
   npm run test-print
   ```
   You should see one page come out of the printer with the text "Maky Print Agent — test page". If not, see **Troubleshooting** below.

5. Install as a Windows Service so it runs forever and auto-starts on boot:
   ```powershell
   npm run install-service
   ```

6. Confirm it's running. Open **Services.msc**, find `MakyPrintAgent`, status should be `Running` and startup type `Automatic`.

7. Reboot the machine and verify the service auto-started.

## Operating

- Logs: `C:\maky-print-agent\logs\agent-YYYY-MM-DD.log` (one per day; old files are kept)
- Health check (from a browser, with the same token): `https://makythedivaflowers.com/api/print/health`
  Use a tool like Postman or `curl` because the browser can't set Authorization headers easily.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `npm run test-print` errors `printer not found` | `PRINTER_NAME` typo | Open **Settings → Printers**, copy the exact name (case-sensitive). |
| Service installed but not printing | Token rotated on server | Update `.env`, restart service: `Restart-Service MakyPrintAgent`. |
| Service can't start | Antivirus blocking node.exe | Add `C:\Program Files\nodejs\node.exe` to the allowlist. |
| Agent log shows `401 Unauthorized` | Wrong or expired token | Rotate as above. |
| Agent log shows `ENOTFOUND` or network errors | Internet outage / DNS | Check the shop's connection. The agent retries automatically. |
| Pages print blank or with strange characters | Printer driver issue | Reinstall the printer driver from the manufacturer; rerun `npm run test-print`. |

## Updating the agent

When the developer pushes a new version:

```powershell
cd C:\maky-print-agent
git pull
npm install
npm run build
Restart-Service MakyPrintAgent
```

## Uninstall

```powershell
npm run uninstall-service
```

This removes the Windows Service. The folder and config remain — delete by hand if desired.

## Token rotation

When the developer rotates `PRINT_AGENT_TOKEN`:
1. Update `.env` on this machine.
2. `Restart-Service MakyPrintAgent`.
3. Verify in the log that the next poll succeeds.
```

- [ ] **Step 2: Commit**

```bash
git add tools/print-agent/README.md
git commit -m "docs(print-agent): operator README"
```

---

## Phase G — Wrap-up: env example + main README

### Task 21: Add env var to `.env.local.example` and main README section

**Files:**
- Modify: `.env.local.example`
- Modify: `README.md`

- [ ] **Step 1: Add the env var**

Append to `.env.local.example`:

```
# Bearer token used by the in-shop print agent (tools/print-agent) to fetch
# print jobs from /api/print/queue. Generate with: openssl rand -base64 32
# The same value must be set in tools/print-agent/.env on the shop computer.
PRINT_AGENT_TOKEN=
```

- [ ] **Step 2: Add a README section**

Append to `README.md`:

```markdown
## Impresión automática de órdenes

Cuando una orden se paga (Stripe `payment_intent.succeeded`), el servidor encola un trabajo de impresión: una hoja tamaño carta con el ticket de orden arriba y la tarjeta decorativa abajo. Un agente que corre en una computadora Windows en la tienda hace polling al endpoint `/api/print/queue` cada 10s y manda los PDFs a la impresora local.

### Configuración (servidor)

1. Genera un token: `openssl rand -base64 32`
2. Agrégalo como `PRINT_AGENT_TOKEN` en las variables de entorno de Vercel (production).
3. Copia ese mismo valor a `tools/print-agent/.env` en la compu de la tienda.

### Configuración (compu de la tienda)

Sigue las instrucciones en [tools/print-agent/README.md](./tools/print-agent/README.md).

### Estado de la cola

Hace un GET autenticado a `/api/print/health` para ver `{ pendingCount, oldestPendingAgeSeconds, lastPrintedAt }`.

### Si una impresión falla

- El agente intenta hasta 3 veces con backoff (5s, 30s, 2min).
- Si fallan los 3, se envía un email a `ORDER_NOTIFICATIONS_TO` con asunto `[PRINT FAILED] order <id>`.
- Para reimprimir manualmente, edita `print-queue.json` y cambia `status: "failed"` → `"pending"` (v1; un panel admin queda para v2).
```

- [ ] **Step 3: Verify everything still passes**

Run: `pnpm test`
Expected: full suite green.

- [ ] **Step 4: Commit**

```bash
git add .env.local.example README.md
git commit -m "docs(print): env var + README section for auto-print"
```

---

## Done — verification checklist

After all tasks are complete and committed:

- [ ] `pnpm test` — all unit tests pass.
- [ ] `pnpm build` — Next.js production build succeeds (no TS errors in API routes).
- [ ] Manual end-to-end (dev environment):
  1. Set `PRINT_AGENT_TOKEN=test-token` in `.env.local`.
  2. `pnpm dev` in main app.
  3. `cd tools/print-agent && npm install && npm run build && PRINT_API_URL=http://localhost:3000 PRINT_AGENT_TOKEN=test-token PRINTER_NAME="<your dev printer>" npm run dev`
  4. Hit `curl -H "Authorization: Bearer test-token" http://localhost:3000/api/print/health` — should return `{pendingCount: 0, ...}`
  5. Trigger a Stripe test payment (use the existing Stripe test flow — `stripe trigger payment_intent.succeeded` against a saved order).
  6. Within ~15s, see the print job arrive at the dev machine printer. Inspect: ticket on top, card on bottom, message centered.
- [ ] Operator install: follow `tools/print-agent/README.md` on the actual shop machine, run `npm run test-print`, get a clean test page.

---

## Self-review notes

**Spec coverage:**
- Section 1 (Context) — N/A
- §2 Goals — covered by tasks 4 (one-sheet layout), 11 (webhook integration, best-effort), 6 (queue durability), 17 (loop survives boot), 19 (Windows Service)
- §3 Architecture — implemented in tasks 5-11, 15-17
- §4 Print job model — task 5
- §5 PDF layout — tasks 3, 4, 12
- §6 Webhook integration — task 11
- §7 Agent behavior — tasks 14-17
- §8 Security — tasks 7, 8, 21 (env var); rate-limit in task 8
- §9 Observability — tasks 10 (health), 14 (logger), task 9 (failure email via `notifyPrintFailed`)
- §10 Testing — every task has tests; agent's `test-print` in task 18
- §11 Operator install — task 20
- §12 Cost — N/A
- §13 Open questions — `Order.locale` confirmed present (verified during planning); `occasion` not on Order, single-card v1 is correct; printer model deferred to operator
- §14 Deferred — explicitly out of scope

**Type/name consistency check:** `enqueuePrintJob`, `claimPendingJobs`, `ackJob`, `recoverStuckJobs`, `getQueueHealth`, `isPrintAuthValid`, `notifyPrintFailed`, `renderOrderPdf`, `PrintJob`, `PrintJobStatus` — names used consistently across tasks 5-11 and 17.

**Placeholder check:** Every implementation step shows the actual code or command. No "TBD", no "implement appropriately", no "similar to above".
