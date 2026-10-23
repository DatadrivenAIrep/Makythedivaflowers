"use client";
import { useTranslations } from "next-intl";
import { exemptionStatus } from "@/lib/tax-exempt";
import type { TaxExemption } from "@/types/tax-exempt";

const INPUT = "w-full rounded-lg border border-ink/20 bg-white px-3 py-2 text-sm";

type Props = {
  value: TaxExemption;
  onChange: (v: TaxExemption) => void;
  /** YYYY-MM-DD — `localYmd()` on the client. */
  today: string;
  /** Keeps input ids unique when two editors are on one page. */
  idPrefix: string;
};

/** Sales-tax exemption editor shared by the customer profile and house accounts. */
export default function TaxExemptFields({ value, onChange, today, idPrefix }: Props) {
  const t = useTranslations("admin_tax_exempt");
  const status = exemptionStatus(value, today);
  return (
    <div className="space-y-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <input id={`${idPrefix}-te`} type="checkbox" checked={value.exempt}
          onChange={(e) => onChange({ ...value, exempt: e.target.checked })} className="h-4 w-4" />
        <label htmlFor={`${idPrefix}-te`}>{t("toggle")}</label>
        {status === "active" && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700">{t("status_active")}</span>}
        {status === "expired" && <span className="rounded-full bg-rouge/10 px-2 py-0.5 text-[11px] text-rouge">{t("status_expired")}</span>}
        {status === "missing_cert" && <span className="rounded-full bg-rouge/10 px-2 py-0.5 text-[11px] text-rouge">{t("status_missing_cert")}</span>}
      </div>
      {value.exempt && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor={`${idPrefix}-cert`} className="mb-1 block text-xs font-semibold">{t("cert")}</label>
            <input id={`${idPrefix}-cert`} value={value.cert ?? ""} maxLength={60}
              onChange={(e) => onChange({ ...value, cert: e.target.value })} className={INPUT} />
          </div>
          <div>
            <label htmlFor={`${idPrefix}-exp`} className="mb-1 block text-xs font-semibold">{t("expires")}</label>
            <input id={`${idPrefix}-exp`} type="date" value={value.expires ?? ""}
              onChange={(e) => onChange({ ...value, expires: e.target.value || null })} className={INPUT} />
          </div>
        </div>
      )}
    </div>
  );
}
