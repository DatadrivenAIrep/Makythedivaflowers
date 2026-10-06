"use client";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Plus } from "@phosphor-icons/react/dist/ssr";
import { formatDateOnly } from "@/lib/format-datetime";
import { formatPhoneUS } from "@/lib/format";
import type { KnownRecipient } from "@/lib/recipient-history";

type Props = { locale: string; senderPhone: string; recipients: KnownRecipient[] };

/** Intake link that opens a new order from this sender, already addressed to this recipient. */
export function intakeHrefFor(locale: string, senderPhone: string, r: KnownRecipient): string {
  const q = new URLSearchParams({ phone: senderPhone });
  if (r.phone) q.set("rphone", r.phone);
  if (r.name) q.set("rname", r.name);
  return `/${locale}/admin/intake?${q.toString()}`;
}

export default function RecipientList({ locale, senderPhone, recipients }: Props) {
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
                <div className="font-semibold">{r.name || "—"}</div>
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
