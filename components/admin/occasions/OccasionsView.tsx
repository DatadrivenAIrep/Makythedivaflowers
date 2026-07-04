"use client";
import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Cake, Heart, Phone, Plus, Star, WhatsappLogo } from "@phosphor-icons/react/dist/ssr";
import { formatMonthDay, type DateKind } from "@/lib/customer-dates";
import type { UpcomingOccasion } from "@/lib/customer-dates-storage";

type Props = { locale: string; initial: UpcomingOccasion[] };

const KIND_ICONS: Record<DateKind, typeof Cake> = {
  birthday: Cake,
  anniversary: Heart,
  custom: Star,
};

export default function OccasionsView({ locale, initial }: Props) {
  const t = useTranslations("admin_customers");
  const [days, setDays] = useState<7 | 30>(30);
  const [occasions, setOccasions] = useState<UpcomingOccasion[]>(initial);
  const [error, setError] = useState(false);

  async function setWindow(d: 7 | 30) {
    setDays(d);
    try {
      const res = await fetch(`/api/admin/occasions?days=${d}`, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      setOccasions(((await res.json()) as { occasions: UpcomingOccasion[] }).occasions);
      setError(false);
    } catch {
      setError(true);
    }
  }

  function monthDay(o: UpcomingOccasion): string {
    const [, m, d] = o.next.date.split("-").map(Number);
    return formatMonthDay(m, d, locale);
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-3 flex items-center gap-2">
        <h1 className="text-lg font-semibold">{t("occasions_title")}</h1>
        <div className="ml-auto flex gap-1">
          <button
            type="button"
            onClick={() => void setWindow(7)}
            className={`flex min-h-11 items-center rounded-lg px-3 text-sm ${
              days === 7 ? "bg-rouge text-bone" : "border border-ink/20 hover:bg-ink/5"
            }`}
          >
            {t("occasions_next_7")}
          </button>
          <button
            type="button"
            onClick={() => void setWindow(30)}
            className={`flex min-h-11 items-center rounded-lg px-3 text-sm ${
              days === 30 ? "bg-rouge text-bone" : "border border-ink/20 hover:bg-ink/5"
            }`}
          >
            {t("occasions_next_30")}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-3 rounded bg-rose-50 p-3 text-sm text-rose-800">{t("error_load")}</div>
      )}

      {occasions.length === 0 ? (
        <div className="rounded border border-ink/10 bg-bone p-6 text-center text-sm text-ink/50">
          {t("no_occasions")}
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {occasions.map((o) => {
            const Icon = KIND_ICONS[o.kind];
            return (
              <div
                key={o.dateId}
                className="flex flex-wrap items-center gap-2 rounded border border-ink/10 bg-bone px-3 py-2 text-sm"
              >
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    o.next.daysUntil === 0 ? "bg-rouge text-bone" : "bg-ink/5 text-ink/70"
                  }`}
                >
                  {o.next.daysUntil === 0 ? t("date_today") : t("date_in_days", { days: o.next.daysUntil })}
                </span>
                <Icon size={16} weight="bold" className="text-rouge" />
                <Link
                  href={`/${locale}/admin/customers/${o.customerId}`}
                  className="font-semibold underline decoration-ink/30 underline-offset-2 hover:decoration-ink"
                >
                  {o.customerName}
                </Link>
                <span className="text-ink/70">
                  {t(`date_kind_${o.kind}`)}
                  {o.label ? ` · ${o.label}` : ""}
                </span>
                <span className="text-ink/50">· {monthDay(o)}</span>
                <span className="ml-auto flex gap-1">
                  <a
                    href={`tel:${o.phone}`}
                    aria-label={t("call")}
                    className="flex min-h-11 items-center rounded-lg border border-ink/20 px-2 hover:bg-ink/5"
                  >
                    <Phone size={14} weight="bold" />
                  </a>
                  <a
                    href={`https://wa.me/${o.phone.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={t("whatsapp")}
                    className="flex min-h-11 items-center rounded-lg border border-ink/20 px-2 hover:bg-ink/5"
                  >
                    <WhatsappLogo size={14} weight="bold" />
                  </a>
                  <Link
                    href={`/${locale}/admin/intake?phone=${encodeURIComponent(o.phone)}`}
                    aria-label={t("new_order_cta")}
                    className="flex min-h-11 items-center rounded-lg bg-rouge px-2 text-bone"
                  >
                    <Plus size={14} weight="bold" />
                  </Link>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
