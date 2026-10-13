"use client";
import { useTranslations } from "next-intl";
import { isRequestExempt } from "@/lib/tax-exempt";
import type { DefaultExemption, TaxExemptRequest } from "@/types/tax-exempt";

type Props = {
  /** What applies without staff action (account/customer certificate, or the order's own snapshot when editing). */
  fallback: DefaultExemption | null;
  /** A certificate on file exists but is expired. */
  expired?: boolean;
  /** Staff's explicit choice; undefined = follow the fallback. */
  value: TaxExemptRequest | undefined;
  onChange: (v: TaxExemptRequest | undefined) => void;
};

export default function TaxExemptToggle({ fallback, expired, value, onChange }: Props) {
  const t = useTranslations("admin_tax_exempt");
  const on = isRequestExempt(fallback, value);
  function toggle(next: boolean) {
    // Matching the default again means "follow the default" — no stale override.
    if (next === (fallback !== null) && !value?.cert) onChange(undefined);
    else onChange({ taxExempt: next, ...(value?.cert ? { cert: value.cert } : {}) });
  }
  const needsCert = on && !fallback;
  return (
    <div className="mb-2 rounded-lg border border-ink/10 px-3 py-2 text-sm">
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={on} onChange={(e) => toggle(e.target.checked)} className="h-4 w-4" />
        <span>
          {on && fallback && !value?.cert
            ? t("intake_on", { cert: fallback.cert, source: t(`source_${fallback.source}`) })
            : t("toggle")}
        </span>
      </label>
      {needsCert && (
        <input value={value?.cert ?? ""} maxLength={60} placeholder={t("intake_cert_placeholder")}
          onChange={(e) => onChange({ taxExempt: true, cert: e.target.value })}
          className="mt-2 w-full rounded border border-ink/20 px-2 py-1 text-sm" />
      )}
      {!on && expired && <p className="mt-1 text-[11.5px] text-rouge/80">{t("intake_expired_note")}</p>}
    </div>
  );
}
