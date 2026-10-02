// Standalone, printable HTML for the public house-account statement (/s/<code>).
// Mirrors lib/invoice-html.tsx: Letter portrait, inline CSS, browser print = PDF.
import "server-only";
import React from "react";
import { SITE } from "@/data/site";
import { formatAddressLine, formatMoneyCents, formatPhoneUS } from "@/lib/format";
import { formatDateOnly } from "@/lib/format-datetime";
import { getLogoDataUri } from "@/lib/print-styles";
import { dueCents, entryDate } from "@/lib/house-account-settlement";
import type { HouseAccount, Statement, StatementLine, AccountPaymentMethod, EntryKind } from "@/types/house-account";

async function loadRenderToStaticMarkup() {
  const mod = await import("react-dom/server");
  return mod.renderToStaticMarkup;
}

type Locale = "en" | "es";
type Stamp = "open" | "overdue" | "paid" | "void";

type Strings = {
  title: string; number: string; period: string; issued: string; due: string; billTo: string;
  opening: string; charges: string; credits: string; payments: string; closing: string; settled: string; remaining: string;
  date: string; detail: string; amount: string; pay: string; justPaid: string; thanks: string; print: string;
  stamp: Record<Stamp, string>;
  kinds: Record<EntryKind, string>;
  methods: Record<AccountPaymentMethod, string>;
};

export const STATEMENT_STRINGS: Record<Locale, Strings> = {
  en: {
    title: "Statement", number: "Statement #", period: "Period", issued: "Issued", due: "Due date", billTo: "Bill to",
    opening: "Previous balance", charges: "Charges", credits: "Credits", payments: "Payments received", closing: "Balance",
    settled: "Paid / credited after issue", remaining: "Amount due",
    date: "Date", detail: "Detail", amount: "Amount", pay: "Pay now",
    justPaid: "Payment received — updating…", thanks: "Thank you for choosing Maky The Diva Flowers.", print: "Print / Save PDF",
    stamp: { open: "Balance due", overdue: "Past due", paid: "Paid", void: "Void" },
    kinds: { charge: "Order", payment: "Payment", credit: "Credit", adjustment: "Adjustment", reversal: "Cancellation" },
    methods: { cash: "Cash", zelle: "Zelle", ach: "ACH", check: "Check", "card-terminal": "Card", stripe: "Card (online)" },
  },
  es: {
    title: "Estado de cuenta", number: "Estado #", period: "Período", issued: "Emitido", due: "Vence", billTo: "Facturar a",
    opening: "Saldo anterior", charges: "Cargos", credits: "Créditos", payments: "Pagos recibidos", closing: "Saldo",
    settled: "Pagado / acreditado después de emitido", remaining: "Saldo a pagar",
    date: "Fecha", detail: "Detalle", amount: "Importe", pay: "Pagar ahora",
    justPaid: "Pago recibido, actualizando…", thanks: "Gracias por elegir Maky The Diva Flowers.", print: "Imprimir / Guardar PDF",
    stamp: { open: "Saldo pendiente", overdue: "Vencido", paid: "Pagado", void: "Anulado" },
    kinds: { charge: "Orden", payment: "Pago", credit: "Crédito", adjustment: "Ajuste", reversal: "Cancelación" },
    methods: { cash: "Efectivo", zelle: "Zelle", ach: "ACH", check: "Cheque", "card-terminal": "Tarjeta", stripe: "Tarjeta (en línea)" },
  },
};

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
.meta h1{margin:0 0 6px;font-size:24px;letter-spacing:.08em;text-transform:uppercase}
.meta dl{margin:0;display:grid;grid-template-columns:auto auto;gap:2px 12px;justify-content:end;font-size:12px}
.meta dt{color:#6b635b}.meta dd{margin:0;font-weight:600}
.stamp{display:inline-block;margin-top:10px;padding:4px 10px;border:2px solid;border-radius:6px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;font-size:12px}
.stamp.open{color:#a15c00}.stamp.overdue{color:#b42318}.stamp.paid{color:#1f7a4d}.stamp.void{color:#6b635b}
.parties{margin:20px 0}
.parties h2{margin:0 0 4px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#6b635b}
.parties p{margin:0}
table{width:100%;border-collapse:collapse}
.items th{text-align:left;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#6b635b;border-bottom:1px solid #e6e0d8;padding:6px 0}
.items td{padding:8px 0;border-bottom:1px solid #f0ebe4;vertical-align:top}
.items .num{text-align:right;white-space:nowrap;padding-left:12px}
.sums{width:55%;margin:16px 0 0 auto}
.sums td{padding:4px 0}.sums td:last-child{text-align:right;white-space:nowrap}
.sums .total td{border-top:1px solid #1d1a17;font-weight:700;font-size:15px;padding-top:8px}
.paybox{margin:24px 0 0;text-align:right}
.pay{font:inherit;font-weight:700;padding:12px 22px;border-radius:10px;border:0;background:#b42318;color:#fff;cursor:pointer;font-size:15px}
.note{margin:16px 0 0;padding:10px 12px;border-radius:8px;background:#eef7f0;color:#1f7a4d;font-weight:600}
footer{margin-top:36px;padding-top:16px;border-top:1px solid #e6e0d8;text-align:center;color:#6b635b;font-size:12px}
@media (max-width:640px){.page{margin:12px 0;padding:20px 16px}.sums{width:100%}}
@page{size:letter;margin:0.6in}
@media print{body{background:#fff}.toolbar,.paybox{display:none}.page{margin:0;padding:0;box-shadow:none;max-width:none}}
`;

function lineLabel(l: StatementLine, s: Strings): string {
  const num = l.orderNumber != null ? `#${l.orderNumber}` : l.orderId ? `#${l.orderId.slice(-6)}` : "";
  switch (l.kind) {
    case "charge": return [s.kinds.charge, num, l.recipientName ? `· ${l.recipientName}` : ""].filter(Boolean).join(" ");
    case "payment": return [s.kinds.payment, l.method ? `· ${s.methods[l.method]}` : ""].filter(Boolean).join(" ");
    case "credit": return [s.kinds.credit, l.note ? `· ${l.note}` : ""].filter(Boolean).join(" ");
    case "adjustment": return [s.kinds.adjustment, num, l.note ? `· ${l.note}` : ""].filter(Boolean).join(" ");
    case "reversal": return [s.kinds.reversal, num].filter(Boolean).join(" ");
  }
}

function stampFor(st: Statement, today: string): Stamp {
  if (st.status === "void") return "void";
  if (st.status === "paid") return "paid";
  return today > st.dueDate ? "overdue" : "open";
}

function Doc({ st, account, today, justPaid }: { st: Statement; account: HouseAccount; today: string; justPaid: boolean }) {
  const locale = account.locale;
  const s = STATEMENT_STRINGS[locale];
  const money = (c: number) => formatMoneyCents(c, locale);
  const site = SITE.url.replace(/^https?:\/\//, "");
  const stamp = stampFor(st, today);
  const due = dueCents(st);
  const canPay = st.status === "open" && due > 0;
  return (
    <>
      <div className="toolbar"><button type="button" data-print>{s.print}</button></div>
      <main className="page">
        <header>
          <div>
            <img src={getLogoDataUri()} alt={SITE.merchantName} />
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
              <dt>{s.number}</dt><dd>{st.number}</dd>
              <dt>{s.period}</dt><dd>{formatDateOnly(st.periodStart, locale)} – {formatDateOnly(st.periodEnd, locale)}</dd>
              <dt>{s.issued}</dt><dd>{formatDateOnly(entryDate(st.issuedAt), locale)}</dd>
              <dt>{s.due}</dt><dd>{formatDateOnly(st.dueDate, locale)}</dd>
            </dl>
            <div className={`stamp ${stamp}`}>{s.stamp[stamp]}</div>
          </div>
        </header>

        <section className="parties">
          <h2>{s.billTo}</h2>
          <p><strong>{account.name}</strong></p>
          {account.billingName ? <p>{account.billingName}</p> : null}
          {account.billingPhone ? <p>{formatPhoneUS(account.billingPhone)}</p> : null}
          {account.billingEmail ? <p>{account.billingEmail}</p> : null}
        </section>

        <table className="sums">
          <tbody>
            <tr><td>{s.opening}</td><td>{money(st.openingCents)}</td></tr>
            <tr><td>{s.charges}</td><td>{money(st.chargesCents)}</td></tr>
            {st.creditsCents > 0 ? <tr><td>{s.credits}</td><td>−{money(st.creditsCents)}</td></tr> : null}
            <tr><td>{s.payments}</td><td>−{money(st.paymentsCents)}</td></tr>
            <tr className="total"><td>{s.closing}</td><td>{money(st.closingCents)}</td></tr>
            {st.settledCents > 0 ? (
              <>
                <tr><td>{s.settled}</td><td>−{money(st.settledCents)}</td></tr>
                <tr className="total"><td>{s.remaining}</td><td>{money(due)}</td></tr>
              </>
            ) : null}
          </tbody>
        </table>

        {st.lines.length > 0 ? (
          <table className="items" style={{ marginTop: 24 }}>
            <thead><tr><th>{s.date}</th><th>{s.detail}</th><th className="num">{s.amount}</th></tr></thead>
            <tbody>
              {st.lines.map((l, i) => (
                <tr key={i}>
                  <td>{formatDateOnly(l.date, locale)}</td>
                  <td>{lineLabel(l, s)}</td>
                  <td className="num">{l.amountCents < 0 ? "−" : ""}{money(Math.abs(l.amountCents))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}

        {justPaid && st.status === "open" ? <p className="note">{s.justPaid}</p> : null}
        {canPay ? (
          <form className="paybox" method="post" action={`/s/${st.code}/pay`}>
            <button type="submit" className="pay">{s.pay} · {money(due)}</button>
          </form>
        ) : null}

        <footer>{s.thanks} · {site}</footer>
      </main>
    </>
  );
}

function shell(lang: string, title: string, body: string, extraHead = ""): string {
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${title}</title>
${extraHead}
</head>
<body>${body}</body>
</html>`;
}

export async function buildStatementHtml(
  statement: Statement,
  account: HouseAccount,
  opts: { today: string; justPaid?: boolean },
): Promise<string> {
  const renderToStaticMarkup = await loadRenderToStaticMarkup();
  const body = renderToStaticMarkup(<Doc st={statement} account={account} today={opts.today} justPaid={!!opts.justPaid} />);
  // statement.number is "ST-" + digits — safe to interpolate into <title>.
  return shell(
    account.locale,
    `${statement.number} · ${SITE.merchantName}`,
    `${body}
<script>document.querySelector("[data-print]").addEventListener("click", function () { window.print(); });</script>`,
    `<style>${STYLES}</style>`,
  );
}

const SIMPLE = `body{margin:0;background:#f4f1ec;color:#1d1a17;font:15px/1.5 -apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif}
main{max-width:480px;margin:15vh auto;background:#fff;padding:32px;border-radius:12px;text-align:center}h1{font-size:20px;margin:0 0 8px}p{margin:0;color:#6b635b}`;

export function notFoundPage(): string {
  return shell("es", "Diva Flowers",
    `<main><h1>No encontramos este estado de cuenta</h1><p>Revisa que el enlace esté completo o escríbenos al ${SITE.phoneDisplay}.</p></main>`,
    `<style>${SIMPLE}</style>`);
}

export function voidPage(locale: Locale): string {
  const es = locale === "es";
  return shell(locale, "Diva Flowers",
    `<main><h1>${es ? "Este estado de cuenta fue anulado" : "This statement is no longer valid"}</h1><p>${es ? "Te enviaremos uno nuevo. Dudas: " : "A new one is on its way. Questions: "}${SITE.phoneDisplay}.</p></main>`,
    `<style>${SIMPLE}</style>`);
}
