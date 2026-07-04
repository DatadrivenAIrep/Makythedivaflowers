"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { X } from "@phosphor-icons/react/dist/ssr";
import type { InquiryType } from "@/lib/pipeline";
import type { Inquiry } from "@/lib/inquiry-storage-db";

type Props = { onClose: () => void; onCreated: (inquiry: Inquiry) => void };

export default function NewLeadForm({ onClose, onCreated }: Props) {
  const t = useTranslations("admin_pipeline");
  const [type, setType] = useState<InquiryType>("wedding");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [budgetBand, setBudgetBand] = useState("open");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch("/api/admin/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, contact: { name, email, phone }, budgetBand }),
      });
      if (!res.ok) throw new Error(String(res.status));
      onCreated(((await res.json()) as { inquiry: Inquiry }).inquiry);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-ink/30 p-4" onClick={onClose}>
      <form onSubmit={(e) => void submit(e)} onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-lg bg-bone p-4 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">{t("new_lead")}</h2>
          <button type="button" onClick={onClose} aria-label={t("cancel")} className="rounded border border-ink/20 px-2 py-1"><X size={16} weight="bold" /></button>
        </div>
        {error && <div className="mb-2 rounded bg-rose-50 p-2 text-sm text-rose-800">{t("error_load")}</div>}
        <div className="flex flex-col gap-2 text-sm">
          <select value={type} onChange={(e) => setType(e.target.value as InquiryType)} aria-label={t("form_type")}
            className="min-h-11 rounded border border-ink/20 bg-bone px-2">
            <option value="wedding">{t("type_wedding")}</option>
            <option value="event">{t("type_event")}</option>
          </select>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("form_name")} required
            className="min-h-11 rounded border border-ink/20 bg-bone px-2" />
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder={t("form_email")} required
            className="min-h-11 rounded border border-ink/20 bg-bone px-2" />
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t("form_phone")} required
            className="min-h-11 rounded border border-ink/20 bg-bone px-2" />
          <select value={budgetBand} onChange={(e) => setBudgetBand(e.target.value)} aria-label={t("form_budget")}
            className="min-h-11 rounded border border-ink/20 bg-bone px-2">
            <option value="open">{t("band_open")}</option>
            <option value="5-10k">{t("band_5-10k")}</option>
            <option value="10-25k">{t("band_10-25k")}</option>
            <option value="25k+">{t("band_25k+")}</option>
          </select>
          <button type="submit" disabled={busy || !name || !email || !phone}
            className="min-h-11 rounded-lg bg-rouge px-4 text-bone disabled:opacity-50">{t("create")}</button>
        </div>
      </form>
    </div>
  );
}
