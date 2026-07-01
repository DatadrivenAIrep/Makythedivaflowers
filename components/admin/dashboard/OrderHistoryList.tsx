"use client";
import { useTranslations, useLocale } from "next-intl";
import { formatDateTime } from "@/lib/format-datetime";
import type { OrderChange } from "@/types/order";

export default function OrderHistoryList({ history }: { history: OrderChange[] }) {
  const t = useTranslations("admin_orders");
  const locale = useLocale();
  if (history.length === 0) {
    return <div className="text-ink/50">{t("no_changes")}</div>;
  }
  const ordered = [...history].reverse(); // newest first
  return (
    <ul className="space-y-2">
      {ordered.map((c) => (
        <li key={c.id} className="text-xs">
          <div>
            <span className="text-ink/60">{formatDateTime(c.at, locale)}</span>{" · "}
            <span className="font-semibold">{c.actor}</span>{" · "}
            <span>{c.summary}</span>
          </div>
          {c.changes && c.changes.length > 0 && (
            <ul className="mt-1 ml-3 space-y-0.5 text-ink/70">
              {c.changes.map((d, i) => (
                <li key={i}>
                  {d.label}: <span className="line-through">{d.before ?? "—"}</span> → <span className="font-medium">{d.after ?? "—"}</span>
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}
