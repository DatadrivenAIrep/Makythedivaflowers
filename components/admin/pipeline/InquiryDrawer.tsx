"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Phone, WhatsappLogo, EnvelopeSimple, X } from "@phosphor-icons/react/dist/ssr";
import { formatDate, formatDateTime } from "@/lib/format-datetime";
import { ACTIVE_STAGES, type Stage } from "@/lib/pipeline";
import type { InquiryDetail } from "@/lib/inquiry-storage-db";

type Props = {
  detail: InquiryDetail;
  locale: string;
  onClose: () => void;
  onChanged: (next: InquiryDetail) => void;
};

export default function InquiryDrawer({ detail, locale, onClose, onChanged }: Props) {
  const t = useTranslations("admin_pipeline");
  const { inquiry, changes } = detail;
  const [notes, setNotes] = useState(inquiry.notes ?? "");
  const [followUp, setFollowUp] = useState(inquiry.followUpDate ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const digits = inquiry.contactPhone.replace(/\D/g, "");

  async function patch(body: unknown) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/inquiries/${inquiry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(String(res.status));
      onChanged((await res.json()) as InquiryDetail);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-20 flex" onClick={onClose}>
      <div className="ml-auto h-full w-full max-w-xl overflow-y-auto bg-bone p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <header className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold"><span>{inquiry.contactName}</span> · {t(`type_${inquiry.type}`)}</h2>
          <button type="button" onClick={onClose} aria-label={t("cancel")} className="rounded border border-ink/20 px-2 py-1 text-sm hover:bg-ink/5">
            <X size={16} weight="bold" />
          </button>
        </header>

        {error && <div className="mb-3 rounded bg-rose-50 p-2 text-sm text-rose-800">{t("error_load")}</div>}

        <section className="mb-3 rounded border border-ink/10 p-3 text-sm">
          <div className="flex flex-wrap gap-2">
            <a href={`tel:${inquiry.contactPhone}`} className="flex items-center gap-1 underline"><Phone size={14} /> {t("call")}</a>
            <a href={`https://wa.me/${digits}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 underline"><WhatsappLogo size={14} /> {t("whatsapp")}</a>
            <a href={`mailto:${inquiry.contactEmail}`} className="flex items-center gap-1 underline"><EnvelopeSimple size={14} /> {t("email")}</a>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-1 text-ink/70">
            {inquiry.budgetBand && <div>{t("form_budget")}: {t(`band_${inquiry.budgetBand}`)}</div>}
            {inquiry.eventDate && <div>{t("event_date")}: {formatDate(inquiry.eventDate, locale)}</div>}
            {inquiry.venue && <div>{t("venue")}: <span>{inquiry.venue}</span></div>}
            {inquiry.guests != null && <div>{t("guests")}: {inquiry.guests}</div>}
            {inquiry.company && <div>{t("company")}: {inquiry.company}</div>}
            {inquiry.frequency && <div>{t("frequency")}: {inquiry.frequency}</div>}
          </div>
          {inquiry.vibe && <div className="mt-2 text-ink/70"><span className="text-ink/50">{t("vibe")}: </span>{inquiry.vibe}</div>}
        </section>

        <section className="mb-3 flex flex-wrap items-center gap-2 text-sm">
          <label htmlFor="stage-sel" className="text-xs uppercase tracking-wide text-ink/50">{t("stage_label")}</label>
          <select
            id="stage-sel"
            aria-label={t("stage_label")}
            value={inquiry.stage === "perdido" ? "perdido" : inquiry.stage}
            disabled={busy}
            onChange={(e) => void patch({ stage: e.target.value })}
            className="min-h-11 rounded-lg border border-ink/20 bg-bone px-2"
          >
            {ACTIVE_STAGES.map((s: Stage) => (
              <option key={s} value={s}>{t(`stage_${s}`)}</option>
            ))}
            {inquiry.stage === "perdido" && <option value="perdido">{t("stage_perdido")}</option>}
          </select>
          <button type="button" disabled={busy} onClick={() => void patch({ lost: { reason: window.prompt(t("lost_reason_prompt")) ?? "" } })}
            className="min-h-11 rounded-lg border border-ink/20 px-3 hover:bg-ink/5">{t("mark_lost")}</button>
        </section>

        <section className="mb-3">
          <label htmlFor="notes" className="mb-1 block text-xs uppercase tracking-wide text-ink/50">{t("notes")}</label>
          <textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
            placeholder={t("notes_placeholder")} className="w-full rounded border border-ink/20 bg-bone p-2 text-sm" />
          <div className="mt-1 flex items-center gap-2">
            <input type="date" value={followUp} onChange={(e) => setFollowUp(e.target.value)}
              aria-label={t("follow_up")} className="min-h-11 rounded border border-ink/20 bg-bone px-2 text-sm" />
            <button type="button" disabled={busy}
              onClick={() => void patch({ notes, followUpDate: followUp })}
              className="min-h-11 rounded-lg bg-rouge px-4 text-sm text-bone disabled:opacity-50">{t("save")}</button>
          </div>
        </section>

        <section className="text-sm">
          <div className="mb-1 text-xs uppercase tracking-wide text-ink/50">{t("history")}</div>
          <ul className="flex flex-col gap-1">
            {changes.map((c) => (
              <li key={c.id} className="text-ink/70">
                <span className="text-ink/40">{formatDateTime(c.at, locale)} · </span>{c.summary}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
