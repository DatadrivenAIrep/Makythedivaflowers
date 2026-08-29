"use client";
import { useTranslations } from "next-intl";
import type { CampaignStatus } from "@/lib/campaign-storage";

const STYLES: Record<CampaignStatus, string> = {
  draft: "bg-stone-100 text-stone-700",
  sending: "bg-amber-50 text-amber-800",
  sent: "bg-emerald-50 text-emerald-800",
};

export default function CampaignStatusBadge({ status }: { status: CampaignStatus }) {
  const t = useTranslations("admin_campaigns");
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${STYLES[status]}`}
    >
      {t(`status_${status}`)}
    </span>
  );
}
