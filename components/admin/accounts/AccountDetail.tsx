"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowLeft, HandCoins, Receipt, PauseCircle, PlayCircle, XCircle, PlusMinus } from "@phosphor-icons/react/dist/ssr";
import { shopDateStr } from "@/lib/tv-slots";
import AdminButton from "@/components/admin/dashboard/AdminButton";
import OrderDetailDrawer from "@/components/admin/dashboard/OrderDetailDrawer";
import type { AccountDetailData } from "@/lib/house-account-detail";
import type { AccountStatus, SendChannel } from "@/types/house-account";
import AccountStatusBadge from "./AccountStatusBadge";
import PlanEditor, { type PlanPatch } from "./PlanEditor";
import StatementsTable from "./StatementsTable";
import LedgerTable from "./LedgerTable";
import ContactsList from "./ContactsList";
import SendsQueue from "./SendsQueue";
import PaymentModal from "./PaymentModal";
import EntryModal from "./EntryModal";

type Props = { locale: string; initial: AccountDetailData };
function money(c: number) { return `$${(Math.abs(c) / 100).toFixed(2)}`; }

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="mb-4 rounded-xl border border-ink/10 bg-bone p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-xs uppercase tracking-wide text-ink/50">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export default function AccountDetail({ locale, initial }: Props) {
  const t = useTranslations("admin_accounts");
  const [data, setData] = useState<AccountDetailData>(initial);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [entryOpen, setEntryOpen] = useState(false);
  const [openOrderId, setOpenOrderId] = useState<string | null>(null);
  const [editingPlan, setEditingPlan] = useState(false);
  const [issued, setIssued] = useState<{ id: string; number: string; channel: SendChannel } | null>(null);
  // Always holds the latest fetched data so follow-up actions never read a stale closure.
  const dataRef = useRef<AccountDetailData>(initial);
  const sendInFlight = useRef(false);
  const { account } = data;
  const today = shopDateStr(new Date());
  const overdue = data.statements.some((s) => s.status === "open" && s.dueCents > 0 && s.dueDate < today);

  async function refresh(): Promise<AccountDetailData | null> {
    const res = await fetch(`/api/admin/accounts/${account.id}`, { cache: "no-store" });
    if (!res.ok) return null;
    const fresh = (await res.json()) as AccountDetailData;
    dataRef.current = fresh;
    setData(fresh);
    return fresh;
  }

  function errorText(json: { error?: string; reason?: string; send?: { error?: string } }): string {
    switch (json.error) {
      case "no_channel": return t("send_error_no_channel", { reason: json.reason ?? "" });
      case "send_failed": return t("send_failed", { reason: json.send?.error ?? "" });
      case "statement_paid": return t("void_error_paid");
      case "not_latest": return t("void_error_not_latest");
      default: return t("error_generic");
    }
  }

  /** `quiet` skips the error flash so the caller can show a more specific message. */
  async function call(method: string, url: string, body?: unknown, quiet = false): Promise<Record<string, unknown> | null> {
    setBusy(true); setFlash(null);
    try {
      const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
      const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) { if (!quiet) setFlash({ ok: false, text: errorText(json as { error?: string }) }); return null; }
      // The write already happened: a failed re-read must not look like a failed write (the user could resend).
      try { await refresh(); } catch { /* keep the write's result */ }
      return json;
    } catch {
      if (!quiet) setFlash({ ok: false, text: t("error_generic") });
      return null;
    } finally { setBusy(false); }
  }

  async function savePlan(patch: PlanPatch): Promise<boolean> {
    const ok = (await call("PATCH", `/api/admin/accounts/${account.id}`, patch)) !== null;
    if (ok) { setFlash({ ok: true, text: t("saved") }); setEditingPlan(false); }
    return ok;
  }
  async function setStatus(status: AccountStatus) {
    if (status === "closed" && !window.confirm(t("close_confirm"))) return;
    await call("PATCH", `/api/admin/accounts/${account.id}`, { status });
  }
  async function issueNow() {
    const r = await call("POST", `/api/admin/accounts/${account.id}/statements`);
    if (!r) return;
    const st = r.statement as { id: string; number: string } | null | undefined;
    if (st) setIssued({ id: st.id, number: st.number, channel: account.statementChannel });
    else if (st === null) {
      // One statement per closing day: say so instead of claiming there is nothing pending.
      const issuedToday = dataRef.current.statements.some((s) => s.status !== "void" && s.periodEnd >= shopDateStr(new Date()));
      setFlash({ ok: true, text: t(issuedToday ? "already_issued_today" : "nothing_to_issue") });
    }
  }
  /** The queue answers 200 even when delivery failed; the reason is in send.error. */
  function sendFailure(json: Record<string, unknown>): string | null {
    const send = json.send as { status?: string; error?: string } | undefined;
    return send?.status === "failed" ? t("send_failed", { reason: send.error ?? "" }) : null;
  }
  /** Dispatches an already-queued row now; true only when it actually went out. */
  async function dispatchQueuedNow(id: string): Promise<boolean> {
    const r = await call("PATCH", `/api/admin/accounts/sends/${id}`, { sendNow: true });
    if (!r) return false;
    const failure = sendFailure(r);
    if (failure) { setFlash({ ok: false, text: failure }); return false; }
    setFlash({ ok: true, text: t("sent_ok") });
    return true;
  }
  /** Guarded entry point for the queue's "Enviar ya": a same-tick double click would otherwise 409 over the success flash. */
  async function dispatchQueued(id: string): Promise<boolean> {
    if (sendInFlight.current) return false;
    sendInFlight.current = true;
    try { return await dispatchQueuedNow(id); } finally { sendInFlight.current = false; }
  }
  async function sendStatement(sid: string, channel: SendChannel) {
    if (sendInFlight.current) return;
    sendInFlight.current = true;
    try {
      // Issuing already queued this statement; reuse that row instead of sending a second copy.
      const queued = dataRef.current.sends.find((x) => x.statementId === sid && x.kind === "statement" && x.status === "scheduled");
      if (queued && queued.channel === channel) { await dispatchQueuedNow(queued.id); return; }
      const r = await call("POST", `/api/admin/accounts/statements/${sid}/send`, { channel });
      if (!r) return;
      if (queued && (await call("PATCH", `/api/admin/accounts/sends/${queued.id}`, { skip: true }, true)) === null) {
        // The statement went out but its queued copy is still scheduled and would go out again.
        setFlash({ ok: false, text: t("sent_but_still_queued") });
        return;
      }
      setFlash({ ok: true, text: t("sent_ok") });
    } finally { sendInFlight.current = false; }
  }
  async function voidStatement(sid: string) {
    await call("PATCH", `/api/admin/accounts/statements/${sid}`, { void: true });
  }
  async function sendAction(id: string, action: "sendNow" | "skip" | "reschedule", date?: string): Promise<boolean> {
    if (action === "sendNow") return dispatchQueued(id);
    const body = action === "skip" ? { skip: true } : { scheduledFor: date };
    return (await call("PATCH", `/api/admin/accounts/sends/${id}`, body)) !== null;
  }

  const statementRefs = Object.fromEntries(data.statements.map((s) => [s.id, { number: s.number, dueDate: s.dueDate }]));
  const weekday = (d: number) => (locale === "es" ? t(`weekday_${d}`).toLowerCase() : t(`weekday_${d}`));
  const cadenceText = account.cadence === "monthly"
    ? t("plan_summary_monthly", { day: account.issueDay })
    : t(`plan_summary_${account.cadence}`, { day: weekday(account.issueDay) });
  const billing = [account.billingName, account.billingPhone, account.billingEmail].filter(Boolean).join(" · ");
  const summary = [
    cadenceText,
    t("plan_summary_terms", { days: account.termsDays }),
    t("plan_summary_channel", { channel: t(`channel_${account.statementChannel}`) }),
    t("plan_summary_reminders", { count: account.reminderPlan.length }),
    billing,
  ].filter(Boolean).join(" · ");

  return (
    <div className="mx-auto max-w-5xl">
      <Link href={`/${locale}/admin/accounts`} className="mb-2 inline-flex items-center gap-1.5 text-sm text-rouge hover:underline">
        <ArrowLeft size={15} weight="bold" /> {t("back_to_accounts")}
      </Link>

      <header className="mb-4 flex flex-wrap items-start gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold">{account.name}</h1>
            <AccountStatusBadge status={account.status} />
            {overdue && <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">{t("overdue")}</span>}
          </div>
          <div className={`mt-1 text-lg tabular-nums ${data.balanceCents > 0 ? (overdue ? "text-rose-700" : "text-amber-800") : "text-ink/70"}`}>
            {data.balanceCents < 0 ? t("credit_balance") : t("balance")}: <strong>{money(data.balanceCents)}</strong>
          </div>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <AdminButton variant="primary" icon={HandCoins} disabled={busy} onClick={() => setPayOpen(true)}>{t("record_payment")}</AdminButton>
          <AdminButton variant="secondary" icon={PlusMinus} disabled={busy} onClick={() => setEntryOpen(true)}>{t("credit_or_adjustment")}</AdminButton>
          <AdminButton variant="secondary" icon={Receipt} disabled={busy || account.status !== "active"} onClick={issueNow}>{t("issue_now")}</AdminButton>
          {account.status === "active" && <AdminButton variant="secondary" icon={PauseCircle} disabled={busy} onClick={() => setStatus("paused")}>{t("pause")}</AdminButton>}
          {account.status === "paused" && <AdminButton variant="secondary" icon={PlayCircle} disabled={busy} onClick={() => setStatus("active")}>{t("resume")}</AdminButton>}
          {account.status !== "closed" && <AdminButton variant="danger" icon={XCircle} disabled={busy} onClick={() => setStatus("closed")}>{t("close_account")}</AdminButton>}
        </div>
      </header>
      {flash && <p className={`mb-3 text-sm ${flash.ok ? "text-success" : "text-error"}`}>{flash.text}</p>}

      {issued && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-rouge/30 bg-white p-4 text-sm">
          <span className="font-medium">{t("issued_prompt", { number: issued.number })}</span>
          <select aria-label={t("send_channel_pick")} value={issued.channel} onChange={(e) => setIssued({ ...issued, channel: e.target.value as SendChannel })}
            className="rounded-lg border border-ink/20 bg-white px-2 py-1.5 text-sm">
            {(["sms", "email", "both"] as SendChannel[]).map((c) => <option key={c} value={c}>{t(`channel_${c}`)}</option>)}
          </select>
          <AdminButton variant="primary" disabled={busy} onClick={async () => { const { id, channel } = issued; setIssued(null); await sendStatement(id, channel); }}>{t("send_now_long")}</AdminButton>
          <AdminButton variant="secondary" disabled={busy} onClick={() => setIssued(null)}>{t("issued_later")}</AdminButton>
        </div>
      )}

      <Section title={t("section_plan")} action={!editingPlan && <AdminButton variant="secondary" disabled={busy} onClick={() => setEditingPlan(true)}>{t("plan_edit")}</AdminButton>}>
        {editingPlan
          ? <PlanEditor key={account.updatedAt} account={account} busy={busy} onSave={savePlan} onCancel={() => setEditingPlan(false)} />
          : <p className="text-sm text-ink/80">{summary}</p>}
      </Section>
      <Section title={t("section_statements")}>
        <StatementsTable locale={locale} statements={data.statements} defaultChannel={account.statementChannel} busy={busy} onSend={sendStatement} onVoid={voidStatement} />
      </Section>
      <Section title={t("section_queue")}><SendsQueue locale={locale} sends={data.sends} statements={statementRefs} busy={busy} onAction={sendAction} /></Section>
      <Section title={t("section_ledger")}><LedgerTable locale={locale} entries={data.entries} onOpenOrder={setOpenOrderId} /></Section>
      <Section title={t("section_contacts")}>
        <ContactsList locale={locale} accountId={account.id} contacts={data.contacts} busy={busy} onChanged={refresh} />
      </Section>

      {payOpen && <PaymentModal accountId={account.id} onClose={() => setPayOpen(false)} onDone={async () => { setPayOpen(false); await refresh(); }} />}
      {entryOpen && <EntryModal accountId={account.id} onClose={() => setEntryOpen(false)} onDone={async () => { setEntryOpen(false); await refresh(); }} />}
      {openOrderId && <OrderDetailDrawer orderId={openOrderId} onClose={() => setOpenOrderId(null)} onChanged={refresh} />}
    </div>
  );
}
