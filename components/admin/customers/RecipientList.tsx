"use client";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Plus } from "@phosphor-icons/react/dist/ssr";
import { formatDateOnly } from "@/lib/format-datetime";
import { formatPhoneUS } from "@/lib/format";
import type { KnownRecipient } from "@/lib/recipient-history";
import type { ImportantDate } from "@/lib/customer-dates-storage";
import { formatMonthDay } from "@/lib/customer-dates";

type Props = { locale: string; senderPhone: string; recipients: KnownRecipient[]; dates?: ImportantDate[] };

/** Dates saved for this recipient: matched by phone, or by name for dates typed by hand. */
function datesFor(r: KnownRecipient, dates: ImportantDate[]): ImportantDate[] {
  const name = r.name.trim().toLowerCase();
  return dates.filter(
    (d) => (r.phone && d.recipientPhone === r.phone) || (name !== "" && (d.label ?? "").trim().toLowerCase() === name),
  );
}

/** Intake link that opens a new order from this sender, already addressed to this recipient. */
export function intakeHrefFor(locale: string, senderPhone: string, r: KnownRecipient): string {
  const q = new URLSearchParams({ phone: senderPhone });
  if (r.phone) q.set("rphone", r.phone);
  if (r.name) q.set("rname", r.name);
  return `/${locale}/admin/intake?${q.toString()}`;
}

export default function RecipientList({ locale, senderPhone, recipients, dates = [] }: Props) {
  const t = useTranslations("admin_customers");
  return (
    <section className="mb-3 rounded border border-ink/10 bg-bone p-3">
      <div className="mb-2 text-xs uppercase tracking-wide text-ink/50">{t("recipients_section")}</div>
      {recipients.length === 0 ? (
        <div className="text-sm text-ink/50">{t("recipients_empty")}</div>
      ) : (
        <ul className="flex flex-col gap-1">
          {recipients.map((r) => (
            <li
              key={r.phone || `name:${r.name}`}
              className="flex flex-wrap items-center justify-between gap-2 rounded border border-ink/10 px-3 py-2 text-sm"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-semibold">{r.name || "—"}</span>
                  {datesFor(r, dates).map((d) => (
                    <span key={d.id} className="rounded-full bg-rouge/10 px-2 py-0.5 text-[11px] font-semibold text-rouge">
                      {t("recipient_saved_date", {
                        kind: t(`date_kind_${d.kind}`),
                        date: formatMonthDay(d.month, d.day, locale),
                      })}
                    </span>
                  ))}
                </div>
                <div className="text-xs text-ink/60">
                  {[
                    r.phone ? formatPhoneUS(r.phone) : null,
                    r.lastAddress ? `${r.lastAddress.street1}, ${r.lastAddress.city}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
                <div className="text-xs text-ink/50">
                  {t(r.orderCount === 1 ? "recipient_orders_one" : "recipient_orders_other", { count: r.orderCount })}
                  {" · "}
                  {t("recipient_last", { date: formatDateOnly(r.lastDate, locale) })}
                </div>
              </div>
              <Link
                href={intakeHrefFor(locale, senderPhone, r)}
                className="flex min-h-11 items-center gap-1 rounded-lg border border-ink/20 px-3 text-sm hover:bg-ink/5"
              >
                <Plus size={14} weight="bold" /> {t("recipient_new_order")}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
