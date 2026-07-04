"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "@phosphor-icons/react/dist/ssr";
import { ACTIVE_STAGES, groupByStage, type Stage } from "@/lib/pipeline";
import type { Inquiry, InquiryDetail } from "@/lib/inquiry-storage-db";
import InquiryCard from "./InquiryCard";
import InquiryDrawer from "./InquiryDrawer";
import NewLeadForm from "./NewLeadForm";

type Payload = {
  inquiries: Inquiry[];
  stats: { counts: Record<Stage, number>; openValueCents: number };
};
type Props = { locale: string; initial: Payload };

function money(c: number) {
  return `$${(c / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function PipelineBoard({ locale, initial }: Props) {
  const t = useTranslations("admin_pipeline");
  const [data, setData] = useState<Payload>(initial);
  const [openDetail, setOpenDetail] = useState<InquiryDetail | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState(false);

  async function refresh() {
    try {
      const res = await fetch("/api/admin/inquiries", { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      setData((await res.json()) as Payload);
      setError(false);
    } catch {
      setError(true);
    }
  }

  async function open(id: string) {
    try {
      await fetch(`/api/admin/inquiries/${id}/ack`, { method: "POST" });
      const res = await fetch(`/api/admin/inquiries/${id}`, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      setOpenDetail((await res.json()) as InquiryDetail);
      setError(false);
    } catch {
      setError(true);
    }
  }

  const groups = groupByStage(data.inquiries);

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h1 className="text-lg font-semibold">{t("title")}</h1>
        <span className="text-sm text-ink/60">{t("open_value")}: <span>{money(data.stats.openValueCents)}</span></span>
        <button type="button" onClick={() => setAdding(true)}
          className="ml-auto flex min-h-11 items-center gap-1 rounded-lg bg-rouge px-3 text-sm text-bone">
          <Plus size={16} weight="bold" /> {t("new_lead")}
        </button>
      </div>

      {error && <div className="mb-3 rounded bg-rose-50 p-3 text-sm text-rose-800">{t("error_load")}</div>}

      <div className="flex gap-3 overflow-x-auto pb-2">
        {ACTIVE_STAGES.map((stage) => (
          <div key={stage} className="w-64 shrink-0">
            <div className="mb-2 flex items-center justify-between text-sm font-semibold">
              <span>{t(`stage_${stage}`)}</span>
              <span className="rounded-full bg-ink/5 px-2 text-xs text-ink/60">{data.stats.counts[stage]}</span>
            </div>
            <div className="flex flex-col gap-2">
              {groups[stage].length === 0 ? (
                <div className="rounded border border-dashed border-ink/15 p-3 text-center text-xs text-ink/40">{t("empty_stage")}</div>
              ) : (
                groups[stage].map((i) => (
                  <InquiryCard key={i.id} inquiry={i} locale={locale} onOpen={() => void open(i.id)} />
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      {openDetail && (
        <InquiryDrawer
          detail={openDetail}
          locale={locale}
          onClose={() => { setOpenDetail(null); void refresh(); }}
          onChanged={(next) => { setOpenDetail(next); void refresh(); }}
        />
      )}
      {adding && (
        <NewLeadForm onClose={() => setAdding(false)} onCreated={() => { setAdding(false); void refresh(); }} />
      )}
    </div>
  );
}
