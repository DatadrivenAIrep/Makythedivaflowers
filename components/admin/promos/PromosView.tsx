"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { formatMoneyCents } from "@/lib/format";
import type { PromoListItem, PromoKind } from "@/lib/promo";

type Props = {
  initialPromos: PromoListItem[];
  locale: "en" | "es";
};

const KIND_LABEL: Record<PromoKind, { en: string; es: string }> = {
  percent: { en: "% off", es: "% de descuento" },
  fixed: { en: "$ off", es: "$ de descuento" },
  free_delivery: { en: "Free delivery", es: "Envío gratis" },
};

function describeValue(p: PromoListItem, locale: "en" | "es"): string {
  if (p.kind === "percent") return `${p.value}%`;
  if (p.kind === "fixed") return formatMoneyCents(p.value, locale);
  return locale === "es" ? "Envío" : "Delivery";
}

export default function PromosView({ initialPromos, locale }: Props) {
  const t = useTranslations("admin_promos");
  const [promos, setPromos] = useState(initialPromos);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state. Amounts are typed in dollars and converted at the seam, so the
  // owner never types cents.
  const [code, setCode] = useState("");
  const [kind, setKind] = useState<PromoKind>("percent");
  const [value, setValue] = useState("10");
  const [minSubtotal, setMinSubtotal] = useState("");
  const [maxRedemptions, setMaxRedemptions] = useState("");
  const [firstOrderOnly, setFirstOrderOnly] = useState(false);
  const [note, setNote] = useState("");

  async function refresh() {
    const res = await fetch("/api/admin/promos");
    const data = await res.json();
    setPromos(data.promos);
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body = {
        code,
        kind,
        value:
          kind === "percent"
            ? Number(value)
            : kind === "fixed"
              ? Math.round(Number(value) * 100)
              : 0,
        ...(minSubtotal ? { minSubtotalCents: Math.round(Number(minSubtotal) * 100) } : {}),
        ...(maxRedemptions ? { maxRedemptions: Number(maxRedemptions) } : {}),
        ...(firstOrderOnly ? { firstOrderOnly: true } : {}),
        ...(note ? { note } : {}),
      };
      const res = await fetch("/api/admin/promos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(
          data?.errors?.formErrors?.[0] === "duplicate_code" ? t("error_duplicate") : t("error_generic"),
        );
        return;
      }
      setCode("");
      setNote("");
      await refresh();
    } catch {
      setError(t("error_generic"));
    } finally {
      setBusy(false);
    }
  }

  async function toggle(id: string, active: boolean) {
    await fetch(`/api/admin/promos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active }),
    });
    await refresh();
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-4">
      <div>
        <h1 className="font-display text-3xl tracking-tight text-ink">{t("title")}</h1>
        <p className="mt-1 text-sm text-ink/70">{t("subtitle")}</p>
      </div>

      <form onSubmit={create} className="space-y-4 rounded-xl border border-ink/10 bg-bone p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.16em] text-mute-500">
              {t("field_code")}
            </span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              className="w-full rounded-lg border border-ink/15 px-3 py-2 font-mono text-sm uppercase tracking-widest"
            />
          </label>
          <label className="block">
            <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.16em] text-mute-500">
              {t("field_kind")}
            </span>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as PromoKind)}
              className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm"
            >
              {(Object.keys(KIND_LABEL) as PromoKind[]).map((k) => (
                <option key={k} value={k}>
                  {KIND_LABEL[k][locale]}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.16em] text-mute-500">
              {kind === "percent" ? t("field_percent") : t("field_amount")}
            </span>
            <input
              type="number"
              min={kind === "percent" ? 1 : 0}
              max={kind === "percent" ? 100 : undefined}
              step={kind === "percent" ? 1 : 0.01}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              disabled={kind === "free_delivery"}
              className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm disabled:bg-mute-100"
            />
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.16em] text-mute-500">
              {t("field_min_subtotal")}
            </span>
            <input
              type="number"
              min={0}
              step={0.01}
              value={minSubtotal}
              onChange={(e) => setMinSubtotal(e.target.value)}
              placeholder={t("placeholder_optional")}
              className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.16em] text-mute-500">
              {t("field_max_redemptions")}
            </span>
            <input
              type="number"
              min={1}
              step={1}
              value={maxRedemptions}
              onChange={(e) => setMaxRedemptions(e.target.value)}
              placeholder={t("placeholder_unlimited")}
              className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.16em] text-mute-500">
              {t("field_note")}
            </span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("placeholder_note")}
              className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm"
            />
          </label>
        </div>

        <label className="flex items-center gap-2 text-sm text-ink/80">
          <input
            type="checkbox"
            checked={firstOrderOnly}
            onChange={(e) => setFirstOrderOnly(e.target.checked)}
          />
          {t("field_first_order_only")}
        </label>

        {error && (
          <p role="alert" className="font-mono text-[11px] text-error">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="min-h-11 rounded-lg bg-rouge px-4 font-mono text-[11px] uppercase tracking-[0.16em] text-bone disabled:opacity-50"
        >
          {t("create_cta")}
        </button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-ink/10 bg-bone">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink/10 text-left font-mono text-[10px] uppercase tracking-[0.16em] text-mute-500">
              <th className="px-3 py-2">{t("col_code")}</th>
              <th className="px-3 py-2">{t("col_value")}</th>
              <th className="px-3 py-2">{t("col_rules")}</th>
              <th className="px-3 py-2 tabular-nums">{t("col_used")}</th>
              <th className="px-3 py-2 tabular-nums">{t("col_discounted")}</th>
              <th className="px-3 py-2">{t("col_status")}</th>
            </tr>
          </thead>
          <tbody>
            {promos.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-ink/60">
                  {t("empty")}
                </td>
              </tr>
            )}
            {promos.map((p) => (
              <tr key={p.id} className="border-b border-ink/[0.06] last:border-0">
                <td className="px-3 py-2 font-mono tracking-widest">{p.code}</td>
                <td className="px-3 py-2">{describeValue(p, locale)}</td>
                <td className="px-3 py-2 text-ink/70">
                  {[
                    p.minSubtotalCents ? `${t("rule_min")} ${formatMoneyCents(p.minSubtotalCents, locale)}` : null,
                    p.maxRedemptions ? `${t("rule_max")} ${p.maxRedemptions}` : null,
                    p.firstOrderOnly ? t("rule_first_order") : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </td>
                <td className="px-3 py-2 tabular-nums">{p.redemptionCount}</td>
                <td className="px-3 py-2 tabular-nums">
                  {formatMoneyCents(p.discountedCents, locale)}
                </td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => toggle(p.id, !p.active)}
                    className={`rounded-full px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] ${
                      p.active ? "bg-rouge/10 text-rouge" : "bg-ink/5 text-ink/50"
                    }`}
                  >
                    {p.active ? t("status_active") : t("status_inactive")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
