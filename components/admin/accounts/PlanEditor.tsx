"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import AdminButton from "@/components/admin/dashboard/AdminButton";
import type { HouseAccount, AccountCadence, SendChannel, ReminderStep } from "@/types/house-account";

export type PlanPatch = {
  name: string; billingName: string; billingPhone: string; billingEmail: string; locale: "en" | "es";
  cadence: AccountCadence; issueDay: number; termsDays: number; statementChannel: SendChannel;
  reminderPlan: ReminderStep[]; notes: string;
};
type Props = { account: HouseAccount; busy: boolean; onSave: (patch: PlanPatch) => Promise<boolean> };

const INPUT = "w-full rounded-lg border border-ink/20 bg-white px-3 py-2 text-sm";
const CADENCES: AccountCadence[] = ["weekly", "biweekly", "monthly"];
const CHANNELS: SendChannel[] = ["sms", "email", "both"];

export default function PlanEditor({ account, busy, onSave }: Props) {
  const t = useTranslations("admin_accounts");
  const [f, setF] = useState<PlanPatch>({
    name: account.name, billingName: account.billingName ?? "", billingPhone: account.billingPhone ?? "",
    billingEmail: account.billingEmail ?? "", locale: account.locale, cadence: account.cadence, issueDay: account.issueDay,
    termsDays: account.termsDays, statementChannel: account.statementChannel,
    reminderPlan: account.reminderPlan.map((s) => ({ ...s })), notes: account.notes ?? "",
  });
  const [saved, setSaved] = useState(false);

  function set<K extends keyof PlanPatch>(k: K, v: PlanPatch[K]) {
    setSaved(false);
    setF((p) => ({ ...p, [k]: v }));
  }
  function setCadence(c: AccountCadence) {
    setSaved(false);
    setF((p) => ({ ...p, cadence: c, issueDay: c === "monthly" ? Math.min(Math.max(p.issueDay, 1), 28) : Math.min(p.issueDay, 6) }));
  }
  function setStep(i: number, step: ReminderStep) {
    set("reminderPlan", f.reminderPlan.map((s, j) => (j === i ? step : s)));
  }

  const field = (label: string, el: React.ReactNode) => (
    <label className="block text-sm"><span className="mb-1 block text-xs font-semibold">{label}</span>{el}</label>
  );

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {field(t("form_name"), <input value={f.name} onChange={(e) => set("name", e.target.value)} className={INPUT} />)}
      {field(t("form_billing_name"), <input value={f.billingName} onChange={(e) => set("billingName", e.target.value)} className={INPUT} />)}
      {field(t("form_billing_phone"), <input inputMode="tel" value={f.billingPhone} onChange={(e) => set("billingPhone", e.target.value)} className={INPUT} />)}
      {field(t("form_billing_email"), <input inputMode="email" value={f.billingEmail} onChange={(e) => set("billingEmail", e.target.value)} className={INPUT} />)}
      {field(t("form_locale"),
        <select value={f.locale} onChange={(e) => set("locale", e.target.value as "en" | "es")} className={INPUT}>
          <option value="es">Español</option><option value="en">English</option>
        </select>)}
      {field(t("form_cadence"),
        <select value={f.cadence} onChange={(e) => setCadence(e.target.value as AccountCadence)} className={INPUT}>
          {CADENCES.map((c) => <option key={c} value={c}>{t(`cadence_${c}`)}</option>)}
        </select>)}
      {field(t("form_issue_day"),
        f.cadence === "monthly" ? (
          <input type="number" min={1} max={28} value={f.issueDay} onChange={(e) => set("issueDay", Number(e.target.value))} className={INPUT} />
        ) : (
          <select value={f.issueDay} onChange={(e) => set("issueDay", Number(e.target.value))} className={INPUT}>
            {[0, 1, 2, 3, 4, 5, 6].map((d) => <option key={d} value={d}>{t(`weekday_${d}`)}</option>)}
          </select>
        ))}
      {field(t("form_terms_days"), <input type="number" min={0} max={120} value={f.termsDays} onChange={(e) => set("termsDays", Number(e.target.value))} className={INPUT} />)}
      {field(t("form_statement_channel"),
        <select value={f.statementChannel} onChange={(e) => set("statementChannel", e.target.value as SendChannel)} className={INPUT}>
          {CHANNELS.map((c) => <option key={c} value={c}>{t(`channel_${c}`)}</option>)}
        </select>)}
      <div className="text-sm md:col-span-2">
        <span className="mb-1 block text-xs font-semibold">{t("form_reminders")}</span>
        <ul className="space-y-2">
          {f.reminderPlan.map((s, i) => (
            <li key={i} className="flex flex-wrap items-center gap-2">
              <input type="number" min={-60} max={120} value={s.offsetDays} aria-label={t("offset_hint")}
                onChange={(e) => setStep(i, { ...s, offsetDays: Number(e.target.value) })} className="w-20 rounded-lg border border-ink/20 bg-white px-2 py-1.5 text-sm" />
              <span className="text-xs text-ink/60">{t("offset_hint")}</span>
              <select value={s.channel} onChange={(e) => setStep(i, { ...s, channel: e.target.value as SendChannel })} className="rounded-lg border border-ink/20 bg-white px-2 py-1.5 text-sm">
                {CHANNELS.map((c) => <option key={c} value={c}>{t(`channel_${c}`)}</option>)}
              </select>
              <button type="button" onClick={() => set("reminderPlan", f.reminderPlan.filter((_, j) => j !== i))} className="text-xs text-error underline">{t("remove")}</button>
            </li>
          ))}
        </ul>
        <button type="button" onClick={() => set("reminderPlan", [...f.reminderPlan, { offsetDays: 0, channel: "sms" }])} className="mt-2 text-xs text-rouge underline">{t("add_step")}</button>
      </div>
      <div className="md:col-span-2">{field(t("form_notes"), <textarea value={f.notes} onChange={(e) => set("notes", e.target.value)} rows={2} className={INPUT} />)}</div>
      <div className="flex items-center gap-3 md:col-span-2">
        <AdminButton variant="primary" disabled={busy || f.name.trim().length === 0} onClick={async () => setSaved(await onSave(f))}>{t("save")}</AdminButton>
        {saved && <span className="text-xs text-success">{t("saved")}</span>}
      </div>
    </div>
  );
}
