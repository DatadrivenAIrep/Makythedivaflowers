"use client";
import { useTranslations } from "next-intl";
import type { Campaign } from "@/lib/campaign-storage";
import { formatDate } from "@/lib/format-datetime";
import CampaignStatusBadge from "./CampaignStatusBadge";

export default function CampaignHistory({
  campaigns,
  locale,
  error,
}: {
  campaigns: Campaign[];
  locale: string;
  error?: boolean;
}) {
  const t = useTranslations("admin_campaigns");

  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink/60">
        {t("history")} · {campaigns.length}
      </h2>

      {error ? (
        <div className="rounded border border-error/30 bg-rose-50 p-3 text-sm text-error">
          {t("error_load")}
        </div>
      ) : campaigns.length === 0 ? (
        <div className="rounded border border-ink/10 bg-bone p-6 text-center text-sm text-ink/50">
          {t("empty")}
        </div>
      ) : (
        <div className="overflow-x-auto rounded border border-ink/10 bg-bone">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink/10 text-left text-xs uppercase tracking-wide text-ink/50">
                <th className="px-3 py-2 font-medium">{t("col_message")}</th>
                <th className="px-3 py-2 font-medium">{t("col_status")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("col_recipients")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("col_sent")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("col_failed")}</th>
                <th className="px-3 py-2 font-medium">{t("col_date")}</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.id} className="border-b border-ink/5 last:border-0 hover:bg-ink/5">
                  <td className="max-w-[22ch] truncate px-3 py-2">{c.bodyEs}</td>
                  <td className="px-3 py-2">
                    <CampaignStatusBadge status={c.status} />
                  </td>
                  <td className="px-3 py-2 text-right text-ink/70">{c.recipientCount}</td>
                  <td className="px-3 py-2 text-right font-semibold">{c.sentCount}</td>
                  <td
                    className={`px-3 py-2 text-right ${
                      c.failedCount > 0 ? "font-semibold text-error" : "text-ink/40"
                    }`}
                  >
                    {c.failedCount}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-ink/70">
                    {formatDate(c.createdAt, locale)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
