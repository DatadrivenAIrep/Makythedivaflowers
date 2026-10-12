"use client";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { Insight } from "@/lib/metrics-insights";
import { money } from "./format";

export type TabId = "sales" | "operations" | "customers";

export default function InsightList({ insights, onTab }: { insights: Insight[]; onTab: (tab: TabId) => void }) {
  const t = useTranslations("admin_metrics");
  const text = (i: Insight) => {
    const v: Record<string, string | number> = { ...i.values };
    if (typeof i.values.amountCents === "number") v.amount = money(i.values.amountCents);
    if (i.refs.holiday) v.holiday = t(`holiday_${i.refs.holiday}`);
    if (i.refs.weekday !== undefined) v.day = t(`weekday_full_${i.refs.weekday}`);
    if (i.refs.channel) v.channel = t(`channel_${i.refs.channel}`);
    return t(i.key, v);
  };
  const cls = "flex w-full items-start gap-2 rounded-xl bg-white px-3 py-2 text-left text-sm";
  return (
    <ul className="flex flex-col gap-1.5">
      {insights.map((i) => {
        const body = (
          <>
            <span aria-hidden>{i.icon}</span>
            <span className="flex-1">{text(i)}</span>
          </>
        );
        if (i.action?.kind === "tab") {
          const tab = i.action.tab;
          return (
            <li key={i.id}>
              <button type="button" onClick={() => onTab(tab)} className={`${cls} hover:ring-1 hover:ring-rouge/30`}>
                {body}
                <span aria-hidden className="text-rouge">→</span>
              </button>
            </li>
          );
        }
        return (
          <li key={i.id} className={cls}>
            {body}
            {i.action?.kind === "link" && (
              <Link href={i.action.href} className="whitespace-nowrap text-rouge underline-offset-2 hover:underline">
                {t("insight_action_view")}
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}
