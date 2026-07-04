"use client";
import { useTranslations } from "next-intl";
import type { Segment } from "@/lib/customer-metrics";

const STYLES: Record<Segment, string> = {
  new: "bg-sky-50 text-sky-800",
  recurring: "bg-emerald-50 text-emerald-800",
  vip: "bg-amber-50 text-amber-800",
  at_risk: "bg-rose-50 text-rose-800",
};

export default function SegmentBadge({ segment }: { segment: Segment }) {
  const t = useTranslations("admin_customers");
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${STYLES[segment]}`}
    >
      {t(`badge_${segment}`)}
    </span>
  );
}
