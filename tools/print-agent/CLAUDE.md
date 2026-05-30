# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`maky-print-agent` is a Node.js daemon that runs on the shop's Windows PC. It polls the Diva Flowers production server for pending print jobs, renders each job's HTML to a PDF via headless Chrome, and sends the PDF to the local printer. It is installed as a Windows Service so it runs on boot.

## Commands

```powershell
npm run build          # Compile TypeScript → dist/
npm run dev            # Run from source via tsx (no compile step — for dev/debugging)
npm run test-print     # Send a 2-page duplex test sheet to the printer
npm run install-service   # Register the MakyPrintAgent Windows Service
npm run uninstall-service # Remove the Windows Service
```

`build` and `start` are for production. `dev` is for local iteration without rebuilding. There are no automated tests; `test-print` is the functional smoke test.

## Environment variables

Copy `.env.example` to `.env` before running anything. Required vars:

| Var | Description |
|---|---|
| `PRINT_API_URL` | `https://makythedivaflowers.com` |
| `PRINT_AGENT_TOKEN` | Bearer token — must match `PRINT_AGENT_TOKEN` on the Vercel server |
| `PRINTER_NAME` | Exact printer name from Windows Settings → Printers (case-sensitive) |

Optional: `POLL_INTERVAL_MS` (default 10 000 ms), `LOG_LEVEL` (default `info`), `PUPPETEER_EXECUTABLE_PATH` (auto-detected if unset).

## Architecture

The agent is a single-process poll loop with no external state beyond the `.env` file and daily log files (`logs/agent-YYYY-MM-DD.log`).

**Data flow per tick:**

1. `index.ts` — boots, runs a health check, then calls `tick()` in a `while(!stopping)` loop separated by `pollIntervalMs`.
2. `poll.ts` → `api.fetchQueue()` — `GET /api/print/queue` returns an array of `ServerJob { id, orderId, html }`. The server builds the HTML; the agent only renders it.
3. `print.ts` → `htmlToPdf()` — launches a singleton headless Chrome via `puppeteer-core` (re-used across jobs to avoid cold starts). Renders the HTML to a Letter-landscape PDF with zero margins.
4. `print.ts` → `pdfPrint()` — writes PDF to `os.tmpdir()` then calls `pdf-to-printer` to send to the named Windows printer. Duplex mode: `simplex` for regular jobs, `duplexlong` for the test page.
5. `poll.ts` → `api.ack()` — `POST /api/print/jobs/:id/ack` with `status: "printed" | "failed"`. Failed jobs also send the error message. Print is retried up to 4 times (0 s / 5 s / 30 s / 2 min) before acking as failed.

**Key invariant:** The server owns job state; the agent only pulls and acks. If the agent crashes mid-job, the server will re-queue the job on the next poll since no ack was sent.

## Server-side API contract

The agent only talks to three endpoints under `/api/print/`:

- `GET /queue` — returns `{ jobs: ServerJob[] }`
- `POST /jobs/:id/ack` — body `{ status, error? }`
- `GET /health` — returns `{ pendingCount, lastPrintedAt }`

All requests use `Authorization: Bearer <token>`.

## Print layout

Each job is a single Letter-landscape sheet intended to be printed simplex (one side). The HTML encodes the full layout — the agent does not manipulate content. The duplex test page (`test-print.ts`) uses `duplexlong` to verify the printer's duplex capability.
