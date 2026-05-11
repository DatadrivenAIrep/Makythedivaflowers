# Auto-Print Paid Orders to Shop Printer — Design Spec

**Date:** 2026-05-07
**Approach:** Persistent print queue + local Windows polling agent (Approach 1)
**Scope:** v1 — single shop, single printer, single generic card design. Localized order ticket (es/en).
**Stack:** `@react-pdf/renderer` (PDF on server) + `pdf-to-printer` (Windows print) + `node-windows` (Windows Service)

---

## 1. Context

Today, when a Stripe `payment_intent.succeeded` webhook fires ([app/api/stripe/webhook/route.ts:57](app/api/stripe/webhook/route.ts#L57)), the server transitions the order to `paid`, calls [`notifyOrderPaid`](lib/order-notifications.ts) (sends a plain-text email via Resend with order details + card message), and pushes a GA4 purchase event. There is no physical print artifact; the shop staff reads the email and writes/prints things manually.

This spec adds an automatic print of each paid order to a Wi-Fi printer in the shop. Each print contains:

1. An **order ticket** (top half) with delivery info, items, buyer contact, Stripe ID — for the floral-arrangement team to work from.
2. A **decorative card** (bottom half) with Maky-branded background art, the customer's card message in decorative typography — to be cut out and attached to the bouquet.

The two halves share one Letter-size sheet, separated by a cut line. One sheet of paper per order.

## 2. Goals & Non-goals

### Goals
1. When `payment_intent.succeeded` fires, an automatic print job lands at the shop printer within ~15 seconds (10s polling worst case + render time).
2. The system survives the shop computer being off / offline / restarting: jobs queued while the agent is unavailable print as soon as it reconnects.
3. The shop computer needs no inbound network access; auth via bearer token over HTTPS, agent-initiated requests only.
4. Printing failures do not block or revert the rest of the post-payment flow (email, analytics).
5. The agent installs as a Windows Service and survives reboots without manual intervention.

### Non-goals (YAGNI)
- Per-occasion card variants (v1 = 1 generic card; 7 variants are a follow-up).
- Admin web panel to view / retry / reprint failed jobs (v1 = inspect logs + DB record).
- Multi-printer, multi-shop, or printer routing.
- Reprint button in the existing order confirmation email.
- Graphical metrics dashboard (pending/failed counts, latency).
- Manual printing of orders that pre-date this feature.
- Job expiry / GC for old printed jobs (small data, deferred).

## 3. Architecture

### 3.1 Data flow

```
Stripe webhook → updateOrderStatusByPaymentIntent("paid")
              → notifyOrderPaid(order)             [existing]
              → sendPurchaseToGA4(...)              [existing]
              → enqueuePrintJob(order)              [NEW]
                  ├─ render PDF (ticket + card)
                  └─ persist as { id, orderId, pdf, status: "pending" }

Shop computer (Windows Service, every 10s):
  print agent → GET /api/print/queue (Bearer token)
             → for each job: write PDF to %TEMP%, print, ack
             → POST /api/print/jobs/:id/ack { status: "printed" | "failed", error? }
```

### 3.2 New files (server)

| File | Purpose |
|---|---|
| `lib/print-render.tsx` | `renderOrderPdf(order: Order, locale: "es" \| "en"): Promise<Buffer>`. Uses `@react-pdf/renderer`. Components: `<OrderTicket>` (top) + `<CutLine>` + `<DecorativeCard>` (bottom). |
| `lib/print-queue.ts` | `enqueuePrintJob`, `getPendingJobs`, `markPrinting`, `markPrinted`, `markFailed`, `recoverStuckJobs`. Same storage backend as `lib/order-storage.ts` (file-based JSON in dev, blob in prod — same pattern). |
| `app/api/print/queue/route.ts` | `GET` handler. Auth: `Authorization: Bearer ${PRINT_AGENT_TOKEN}` with `crypto.timingSafeEqual`. Returns `{ jobs: Array<{ id, orderId, pdfBase64 }> }`. Side effect: marks returned jobs as `printing`. |
| `app/api/print/jobs/[id]/ack/route.ts` | `POST` handler. Auth: same bearer. Body: `{ status: "printed" \| "failed", error?: string }`. Updates job. |
| `app/api/print/health/route.ts` | `GET` handler. Auth: same bearer. Returns `{ pendingCount, oldestPendingAge, lastPrintedAt }`. Used by agent on boot to validate config and by ops for at-a-glance status. |

### 3.3 Files modified

| File | Change |
|---|---|
| `app/api/stripe/webhook/route.ts` | After `notifyOrderPaid(order)` and `sendPurchaseToGA4(...)`, call `await enqueuePrintJob(order)`. Wrap in try/catch — failures log but do not propagate (we already returned 200 conceptually; mirroring how `notifyOrderPaid` errors are handled). |
| `types/order.ts` | No changes. Print job is its own type, not a field on Order. |
| `.env.local.example` | Add `PRINT_AGENT_TOKEN=<generate with openssl rand -base64 32>`. |
| `README.md` | New "Impresión automática de órdenes" section: env var setup + link to `tools/print-agent/README.md`. |

### 3.4 New files (agent — `tools/print-agent/`)

```
tools/print-agent/
├── package.json          # standalone — separate from main app
├── tsconfig.json
├── .env.example          # PRINT_API_URL, PRINT_AGENT_TOKEN, PRINTER_NAME, POLL_INTERVAL_MS
├── src/
│   ├── index.ts          # entry — load .env, validate, start loop
│   ├── poll.ts           # one tick: GET queue, dispatch each job, ack
│   ├── print.ts          # write PDF to temp, call pdf-to-printer, retry policy
│   ├── log.ts            # pino → rotating file (logs/agent-YYYY-MM-DD.log) + stdout
│   └── health.ts         # boot-time GET /api/print/health to validate token+url
├── install-service.js    # node-windows: register MakyPrintAgent service
├── uninstall-service.js
└── README.md             # install steps for shop staff
```

Agent dependencies: `pdf-to-printer`, `node-fetch`, `pino`, `pino-pretty`, `dotenv`, `node-windows`. TypeScript dev-deps. Built to plain JS via `tsc` so no ts-node in production.

## 4. Print job model

```ts
type PrintJob = {
  id: string;             // ulid or nanoid
  orderId: string;
  status: "pending" | "printing" | "printed" | "failed";
  pdfBase64: string;      // ~50-150 KB — fine in JSON storage
  attempts: number;       // incremented on each printing → failed transition
  error?: string;         // last error message if failed
  createdAt: string;      // ISO
  updatedAt: string;      // ISO; bumped on each transition
  printedAt?: string;     // ISO when status reaches printed
};
```

### State machine

```
pending → printing  (GET /queue marks them; updatedAt bumped)
printing → printed  (POST /ack { status: "printed" })
printing → failed   (POST /ack { status: "failed", error })
printing → pending  (recovery: updatedAt > 5min ago — re-fetched on next GET)
failed → pending    (manual; v1 = direct DB edit; v2 = admin button)
```

`attempts` increments on each `printing → failed` transition. v1 has no automatic server-side retry of failed jobs — the agent's per-job retry (3 attempts with backoff) covers transient printer issues; persistent `failed` requires human action.

## 5. PDF layout

Letter (8.5" × 11"), portrait, single page.

### Top half — Order Ticket (5.5" × 8.5")

Sans monospace (`Roboto Mono` via `@react-pdf/renderer` font registration). Dense, no decoration.

```
ORDEN #ABCD1234                        TOTAL: $125.00
Pagada: 7 may 2026, 2:34 PM            Stripe: pi_3O...x2

╔════════════════════════════════════════════════════╗
║ ENTREGAR A                                         ║
║ María González · (212) 555-0142                    ║
║ 123 Park Ave, Apt 4B                               ║
║ New York, NY 10016                                 ║
║ Ventana: 7 may, 2:00 PM – 5:00 PM                 ║
╚════════════════════════════════════════════════════╝

ITEMS
2× Ramo Primavera — Mediano                  $85.00
   Add-ons: Globo "Te Amo", Tarjeta artesanal
1× Caja sorpresa                             $40.00

COMPRADOR
juan@example.com · (646) 555-0190
```

`PICK UP AT SHOP` block replaces `ENTREGAR A` when `delivery.method === "pickup"` (using shop address from `data/site.ts`).

Localized: full ticket renders in Spanish if `order.locale === "es"`, English otherwise (locale to be added to Order if not present — verify in implementation; otherwise infer from existing field or default to `es`).

### Cut line (centered, y = 5.5")

Dashed horizontal line + small `✂ recortar / cut here ✂` text centered on the line.

### Bottom half — Decorative Card (5.5" × 8.5")

Layered:
1. **Background**: `<Image src="/print/card-bg-default.webp" />` covering the entire bottom half. Generated with Higgsfield offline, committed as a static asset. Soft, low-contrast — must not compete with the message text. Maky brand palette (petal/bone tones).
2. **Logo**: small Maky logo (`/print/logo-mark.webp`), centered horizontally at top of bottom half, ~0.5" tall.
3. **Message**: customer's `order.delivery.cardMessage`, centered both axes within the available space, in a serif decorative font (matching the site's heading typeface — register via `@react-pdf/renderer`'s `Font.register`). Size ~24pt with auto-shrink to ~18pt if message is long. Word wrap to 3-4 lines max width ~4.5".
4. **Signature**: `— maky the diva flowers` in small italic at the bottom, ~0.4" from cut.

If `cardMessage` is empty/whitespace, render only logo + signature (no message block, no placeholder).

### Asset generation (one-time, offline)

- Generate `card-bg-default.webp` using Higgsfield (`mcp__claude_ai_higgsfield__generate_image`) with a prompt aligned to Maky branding. Iterate until satisfactory; commit final to `public/print/`.
- Logo: reuse existing `public/logo-header.webp` or export a print-optimized version.

## 6. Webhook integration

```ts
// app/api/stripe/webhook/route.ts
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
      // do not throw: payment is recorded, email sent, GA4 sent.
      // Job can be re-enqueued manually if needed.
    }
  }
  break;
}
```

## 7. Agent behavior

### Boot
1. Load `.env`. Fail loud if any of `PRINT_API_URL`, `PRINT_AGENT_TOKEN`, `PRINTER_NAME` is missing.
2. `GET /api/print/health` with Bearer token. If 401 → log and abort (operator must fix token). If network error → log warning, continue (server may be temporarily unreachable).
3. Enter polling loop.

### Each tick (every `POLL_INTERVAL_MS`, default 10000)
1. `GET /api/print/queue` with Bearer.
2. Server returns up to N jobs (N=5; protects against thundering-herd after long disconnect) and atomically marks them as `printing`.
3. For each job in serial:
   - Decode `pdfBase64` → `Buffer`.
   - Write to `%TEMP%/maky-print-{jobId}.pdf`.
   - Call `print(path, { printer: PRINTER_NAME })` from `pdf-to-printer`.
   - On success: `POST /api/print/jobs/:id/ack { status: "printed" }`. Delete temp file.
   - On error: retry up to 3 times with backoff (5s, 30s, 2min). If all fail: `POST /ack { status: "failed", error: <message> }`. Delete temp file.
4. Sleep until next tick.

### Crash recovery
- Service-mode (`node-windows`) auto-restarts the process on crash.
- If the agent crashes mid-print: server-side recovery (`recoverStuckJobs`) flips `printing` jobs older than 5min back to `pending`, so they re-appear on the next poll. Risk: a job that did successfully print but crashed before ack will print twice. Acceptable trade-off — duplicate print is recoverable by the operator; missing print is not.

## 8. Security

- **Bearer token** generated by operator (`openssl rand -base64 32`), stored:
  - Vercel env var `PRINT_AGENT_TOKEN` (server)
  - `tools/print-agent/.env` `PRINT_AGENT_TOKEN` (agent)
- All print endpoints validate with `crypto.timingSafeEqual`. Mismatch → 401, no token-shape leak in body.
- Endpoints rate-limited via `lib/rate-limit.ts` to 30 req/min per token (poll every 2s would still be fine; this catches runaway loops).
- All print endpoints declare `export const runtime = "nodejs"` (matches Stripe webhook).
- PDF contents include PII (recipient name, address, phone, buyer email/phone). If token is compromised, attacker can read all current pending orders until rotation. Rotation procedure is documented in `tools/print-agent/README.md`: change Vercel env, redeploy, change agent `.env`, restart service.
- Agent logs do not include the token or PDF contents (only job IDs and status).

## 9. Observability

- **Server logs**: structured JSON via `console.log({ event: "print_job_enqueued", orderId, jobId })`. Events: `print_job_enqueued`, `print_queue_fetched`, `print_job_acked`, `print_job_failed`, `print_recovery_unstuck`.
- **Agent logs**: `pino` to `logs/agent-YYYY-MM-DD.log` (rotated daily, 7-day retention). Same event names as server.
- **Health endpoint** (`/api/print/health`): authenticated GET returns `{ pendingCount, oldestPendingAgeSeconds, lastPrintedAt }`. Operator can hit this from their browser with a curl to spot-check.
- **Failure alert**: when a job transitions to `failed` (status from agent ack), server sends a Resend email to `ORDER_NOTIFICATIONS_TO` with subject `[PRINT FAILED] order {id}` and the error message. Reuses the existing Resend setup.

## 10. Testing

### Unit tests (`tests/unit/`)
- `print-render.test.ts` — given a synthetic `Order`, the rendered PDF buffer's text layer contains: order id, recipient name, formatted address, each line item, the card message, the Stripe PI id. Snapshot the text extraction for stability.
- `print-queue.test.ts` — `enqueuePrintJob` writes a `pending` row; `getPendingJobs` returns it and flips to `printing`; ack flips to `printed`/`failed`; `recoverStuckJobs` flips stale `printing` back to `pending`.
- `api-print-queue.test.ts` — auth (no header → 401, wrong token → 401, right token → 200); rate-limit returns 429 after threshold; response shape includes `jobs` array with `pdfBase64`.
- `api-print-jobs-ack.test.ts` — auth; `printed` and `failed` transitions persist; bad job id → 404.
- `api-stripe-webhook.test.ts` — extend existing test: on `payment_intent.succeeded` of a previously-pending order, `enqueuePrintJob` is called once; on duplicate webhook (already paid), it is NOT called.

### Integration / manual
- Agent has `npm run test-print`: generates a small test PDF (one-page "Maky print test, {timestamp}") and prints it via `pdf-to-printer`. Operator runs once at install. Not in CI.

### Out of CI
- Agent's `node-windows` service install is manual (Windows-only, requires admin elevation). Documented step-by-step in `tools/print-agent/README.md`.

## 11. Operator install (Windows shop computer)

1. Install Node.js LTS (https://nodejs.org).
2. Clone or download `tools/print-agent/` to e.g. `C:\maky-print-agent\`.
3. `npm install`.
4. Copy `.env.example` → `.env`. Fill:
   - `PRINT_API_URL=https://makythedivaflowers.com`
   - `PRINT_AGENT_TOKEN=<token from password manager>`
   - `PRINTER_NAME=<exact name from Settings → Printers>`
   - `POLL_INTERVAL_MS=10000`
5. `npm run build` (compiles TS → JS in `dist/`).
6. `npm run test-print` — verifies printer + token + connectivity. Should produce one test sheet from the printer.
7. `npm run install-service` (run as Administrator) — registers `MakyPrintAgent` Windows Service, set to auto-start.
8. Verify in Services.msc that `MakyPrintAgent` is `Running`. Reboot the machine to confirm auto-start.

Recovery for operator when prints stop:
- Open `Services.msc` → restart `MakyPrintAgent`.
- If still failing: open `C:\maky-print-agent\logs\agent-<today>.log` to see the error.
- Common issues documented in README: printer offline, printer renamed, token rotated and not updated, antivirus blocking node.

## 12. Cost

- **$0/month additional.** All components built on existing infrastructure: Vercel hosting, the file/blob storage already used by `order-storage.ts`, Resend (already configured for `notifyOrderPaid`).
- One-time: Higgsfield credits to generate the card background art. Estimated 5-10 generations until satisfied.

## 13. Open questions

- Does `Order` carry the user's locale (es/en)? If not, we add it to the schema or infer from the checkout flow. Verify during implementation; default to `es` if absent.
- Does `Order` carry an `occasion` field? Used only when we expand to per-occasion cards (post-v1). Spec assumes "no" for v1 since one generic card serves all.
- Final printer model in the shop — TBD by operator. Code is printer-agnostic via `pdf-to-printer`; operator just enters the printer's Windows name.

## 14. Deferred to v2

- Per-occasion card backgrounds (7 variants).
- Admin web panel for queue inspection / manual reprint.
- Reprint button in confirmation email.
- Multi-printer routing (e.g., kitchen receipt vs. card on different printers).
- Job archival / cleanup.
- Metrics dashboard.
