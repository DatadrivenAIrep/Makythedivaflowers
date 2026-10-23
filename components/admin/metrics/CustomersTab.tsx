// components/admin/metrics/CustomersTab.tsx
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { MetricsPayload } from "@/lib/metrics-storage";
import { intakeHrefFor } from "@/components/admin/customers/RecipientList";
import { money } from "./format";

const box = "rounded-2xl bg-bone p-3.5";
const head = "mb-2 text-xs uppercase tracking-wide text-ink/50";
const KIND_ICON = { birthday: "🎂", anniversary: "💍", custom: "⭐" } as const;

export default function CustomersTab({ data, locale }: { data: MetricsPayload; locale: string }) {
  const t = useTranslations("admin_metrics");
  const c = data.customers;
  const total = c.split.newCents + c.split.returningCents || 1;
  return (
    <div className="grid gap-3 lg:grid-cols-3">
      <div className={box}>
        <div className={head}>{t("split_title")}</div>
        <div className="flex h-4 gap-0.5 overflow-hidden rounded">
          <div style={{ flex: c.split.newCents / total, background: "#B8345E" }} />
          <div style={{ flex: c.split.returningCents / total, background: "#BAB1A2" }} />
        </div>
        <ul className="mt-2 space-y-1 text-sm">
          <li className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-rouge" />{t("split_new")}: {t("split_value", { n: c.split.newBuyers, amount: money(c.split.newCents) })}</li>
          <li className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-mute-300" />{t("split_returning")}: {t("split_value", { n: c.split.returningBuyers, amount: money(c.split.returningCents) })}</li>
        </ul>
      </div>
      <div className={box}>
        <div className={head}>{t("top_customers_title")}</div>
        {c.top.length === 0 ? (
          <p className="text-sm text-ink/50">{t("empty")}</p>
        ) : (
          <ol className="space-y-1 text-sm">
            {c.top.map((x) => (
              <li key={x.key} className="flex justify-between gap-2">
                {x.customerId ? (
                  <Link href={`/${locale}/admin/customers/${x.customerId}`} className="truncate hover:underline">{x.name}</Link>
                ) : (
                  <span className="truncate">{x.name}</span>
                )}
                <span className="font-semibold tabular-nums">{money(x.cents)}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
      <div className={box}>
        <div className={head}>{t("at_risk_title")}</div>
        {c.atRisk.length === 0 ? (
          <p className="text-sm text-ink/50">{t("empty")}</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {c.atRisk.map((x) => (
              <li key={x.id} className="flex justify-between gap-2">
                <Link href={`/${locale}/admin/customers/${x.id}`} className="truncate hover:underline">{x.name}</Link>
                <span className="text-xs text-ink/50">{t("at_risk_meta", { n: x.orderCount, amount: money(x.ltvCents) })}</span>
              </li>
            ))}
          </ul>
        )}
        {c.atRiskCount > c.atRisk.length && <p className="mt-1 text-xs text-ink/50">{t("at_risk_more", { n: c.atRiskCount - c.atRisk.length })}</p>}
        {c.atRiskCount > 0 && (
          <Link href={`/${locale}/admin/campaigns`} className="mt-2 inline-block text-sm text-rouge hover:underline">{t("at_risk_cta")} →</Link>
        )}
      </div>
      <div className={`${box} lg:col-span-3`}>
        <div className={head}>{t("upcoming_dates_title")}</div>
        {c.upcomingDates.length === 0 ? (
          <p className="text-sm text-ink/50">{t("empty")}</p>
        ) : (
          <ul className="divide-y divide-mute-100 text-sm">
            {c.upcomingDates.map((d) => (
              <li key={d.dateId} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1.5">
                <span aria-hidden>{KIND_ICON[d.kind]}</span>
                <span className="font-semibold">{t(`kind_${d.kind}`)}{d.label ? ` · ${d.label}` : ""}</span>
                <span className="text-ink/60">{t("date_from", { name: d.customerName })}</span>
                <span className="text-ink/60">{d.daysUntil === 0 ? t("date_today") : t("date_in_days", { n: d.daysUntil })}</span>
                <Link
                  href={intakeHrefFor(locale, d.phone, {
                    name: d.label ?? "", phone: d.recipientPhone ?? "", addresses: [], days: [],
                    orderCount: 0, lastDate: d.date, lastOrderId: "",
                  })}
                  className="ml-auto text-rouge hover:underline"
                >
                  {t("new_order")}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
