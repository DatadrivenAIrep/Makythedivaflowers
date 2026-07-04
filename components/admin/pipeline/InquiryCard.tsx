"use client";
import { useTranslations } from "next-intl";
import { formatDateOnly } from "@/lib/format-datetime";
import type { Inquiry } from "@/lib/inquiry-storage-db";

type Props = { inquiry: Inquiry; locale: string; onOpen: (id: string) => void };

export default function InquiryCard({ inquiry, locale, onOpen }: Props) {
  const t = useTranslations("admin_pipeline");
  return (
    <button
      type="button"
      onClick={() => onOpen(inquiry.id)}
      className="w-full rounded border border-ink/10 bg-bone p-3 text-left text-sm hover:bg-ink/5"
    >
      <div className="flex items-center gap-2">
        {!inquiry.acknowledgedAt && (
          <span data-testid="unseen-dot" className="h-2 w-2 shrink-0 rounded-full bg-rouge" aria-hidden />
        )}
        <span className="font-semibold">{inquiry.contactName}</span>
        <span className="ml-auto rounded-full bg-ink/5 px-2 py-0.5 text-xs text-ink/60">
          {t(`type_${inquiry.type}`)}
        </span>
      </div>
      <div className="mt-1 flex flex-wrap gap-2 text-xs text-ink/60">
        {inquiry.budgetBand && <span>{t(`band_${inquiry.budgetBand}`)}</span>}
        {inquiry.eventDate && <span>· {formatDateOnly(inquiry.eventDate, locale)}</span>}
        {inquiry.followUpDate && <span>· {t("follow_up")}: {formatDateOnly(inquiry.followUpDate, locale)}</span>}
      </div>
    </button>
  );
}
