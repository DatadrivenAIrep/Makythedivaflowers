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
.stamp.paid{color:#1f7a4d}.stamp.balance_due{color:#a15c00}.stamp.refunded{color:#6b635b}.stamp.canceled{color:#6b635b}
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
