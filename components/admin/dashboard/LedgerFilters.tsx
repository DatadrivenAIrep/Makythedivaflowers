"use client";
import { useEffect, useRef, useState } from "react";
import { X } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";

export type LedgerFilterValue = {
  q?: string;
  from?: string;
  to?: string;
  paymentStatus?: string[];
  fulfillmentStatus?: string[];
  source?: string[];
  fulfillmentMethod?: string[];
};

type Props = {
  value: LedgerFilterValue;
  onChange: (next: LedgerFilterValue) => void;
};

type Translator = (key: string) => string;
type Option = { id: string; labelKey: string };

const PAY_OPTIONS: Option[] = [
  { id: "pending", labelKey: "payment_status.pending" },
  { id: "paid", labelKey: "payment_status.paid" },
  { id: "refunded", labelKey: "payment_status.refunded" },
];

const FUL_OPTIONS: Option[] = [
  { id: "pending", labelKey: "fulfillment_status.pending" },
  { id: "preparing", labelKey: "fulfillment_status.preparing" },
  { id: "out-for-delivery", labelKey: "fulfillment_status.out-for-delivery" },
  { id: "delivered", labelKey: "fulfillment_status.delivered" },
  { id: "canceled", labelKey: "fulfillment_status.canceled" },
];

const SRC_OPTIONS: Option[] = [
  { id: "web", labelKey: "source_web" },
  { id: "walk-in", labelKey: "source_walk_in" },
  { id: "phone", labelKey: "source_phone" },
  { id: "whatsapp", labelKey: "source_whatsapp" },
  { id: "event", labelKey: "source_event" },
];

const METHOD_OPTIONS: Option[] = [
  { id: "delivery", labelKey: "method_delivery" },
  { id: "pickup", labelKey: "method_pickup" },
];

function toggle(list: string[] | undefined, id: string): string[] | undefined {
  const set = new Set(list ?? []);
  if (set.has(id)) set.delete(id); else set.add(id);
  const next = Array.from(set);
  return next.length === 0 ? undefined : next;
}

function daysAgoISO(days: number): string {
  return new Date(Date.now() - days * 24 * 3600_000).toISOString();
}
function todayEndISO(): string {
  const d = new Date(); d.setHours(23, 59, 59, 999); return d.toISOString();
}

export default function LedgerFilters({ value, onChange }: Props) {
  const t = useTranslations("admin_ledger");
  const to = useTranslations("admin_orders");
  // Source and method labels live in admin_ledger; payment/fulfillment reuse admin_orders.
  const optLabel = (o: Option) => (o.labelKey.includes(".") ? to(o.labelKey) : t(o.labelKey));

  function patch(p: Partial<LedgerFilterValue>) { onChange({ ...value, ...p }); }

  return (
    <div className="space-y-3">
      <DebouncedSearch
        value={value.q ?? ""}
        placeholder={t("search_placeholder")}
        onDebouncedChange={(q) => patch({ q: q || undefined })}
      />

      <div className="flex flex-wrap gap-1.5 text-xs">
        <span className="self-center pr-1 text-ink/50">{t("date")}:</span>
        {[
          { id: "today", label: t("date_today"), days: 0 },
          { id: "7d", label: "7d", days: 7 },
          { id: "30d", label: "30d", days: 30 },
          { id: "90d", label: "90d", days: 90 },
        ].map((p) => (
          <button
            key={p.id}
            onClick={() => patch({ from: daysAgoISO(p.days || 1), to: todayEndISO() })}
            className="rounded border border-ink/15 px-2 py-1 hover:bg-ink/5"
          >{p.label}</button>
        ))}
      </div>

      <FilterGroup label={t("payment")} options={PAY_OPTIONS} optLabel={optLabel} selected={value.paymentStatus}
        onToggle={(id) => patch({ paymentStatus: toggle(value.paymentStatus, id) })} />
      <FilterGroup label={t("fulfillment")} options={FUL_OPTIONS} optLabel={optLabel} selected={value.fulfillmentStatus}
        onToggle={(id) => patch({ fulfillmentStatus: toggle(value.fulfillmentStatus, id) })} />
      <FilterGroup label={t("source")} options={SRC_OPTIONS} optLabel={optLabel} selected={value.source}
        onToggle={(id) => patch({ source: toggle(value.source, id) })} />
      <FilterGroup label={t("delivery")} options={METHOD_OPTIONS} optLabel={optLabel} selected={value.fulfillmentMethod}
        onToggle={(id) => patch({ fulfillmentMethod: toggle(value.fulfillmentMethod, id) })} />

      <ActiveChips value={value} onChange={onChange} t={t} optLabel={optLabel} />
    </div>
  );
}

function DebouncedSearch({ value, placeholder, onDebouncedChange }: {
  value: string;
  placeholder: string;
  onDebouncedChange: (q: string) => void;
}) {
  const [text, setText] = useState(value);
  const lastEmitted = useRef(value);

  // Sync external resets (e.g. "limpiar filtros") into the local input.
  useEffect(() => {
    if (value !== lastEmitted.current) { setText(value); lastEmitted.current = value; }
  }, [value]);

  useEffect(() => {
    if (text === lastEmitted.current) return;
    const t = setTimeout(() => { lastEmitted.current = text; onDebouncedChange(text); }, 350);
    return () => clearTimeout(t);
  }, [text, onDebouncedChange]);

  return (
    <input
      type="search"
      value={text}
      placeholder={placeholder}
      onChange={(e) => setText(e.target.value)}
      className="w-full rounded border border-ink/15 bg-bone px-3 py-2 text-sm"
    />
  );
}

function FilterGroup({ label, options, optLabel, selected, onToggle }: {
  label: string; options: Option[]; optLabel: (o: Option) => string; selected: string[] | undefined;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5 text-xs">
      <span className="self-center pr-1 text-ink/50">{label}:</span>
      {options.map((o) => {
        const on = selected?.includes(o.id);
        return (
          <button
            key={o.id}
            onClick={() => onToggle(o.id)}
            className={`rounded border px-2 py-1 ${on ? "border-ink bg-ink text-bone" : "border-ink/15 hover:bg-ink/5"}`}
          >{optLabel(o)}</button>
        );
      })}
    </div>
  );
}

function ActiveChips({ value, onChange, t, optLabel }: Props & {
  t: Translator; optLabel: (o: Option) => string;
}) {
  const labelFor = (opts: Option[], ids: string[]) =>
    ids.map((s) => { const o = opts.find((x) => x.id === s); return o ? optLabel(o) : s; }).join(", ");

  const chips: { key: keyof Props["value"]; group: string; label: string }[] = [];
  if (value.paymentStatus) chips.push({ key: "paymentStatus", group: t("payment"), label: labelFor(PAY_OPTIONS, value.paymentStatus) });
  if (value.fulfillmentStatus) chips.push({ key: "fulfillmentStatus", group: t("fulfillment"), label: labelFor(FUL_OPTIONS, value.fulfillmentStatus) });
  if (value.source) chips.push({ key: "source", group: t("source"), label: labelFor(SRC_OPTIONS, value.source) });
  if (value.fulfillmentMethod) chips.push({ key: "fulfillmentMethod", group: t("delivery"), label: labelFor(METHOD_OPTIONS, value.fulfillmentMethod) });
  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2 pt-1 text-xs">
      {chips.map((c) => (
        <span key={String(c.key)} className="inline-flex items-center gap-1 rounded-full bg-ink/5 px-2 py-0.5">
          {c.group}: {c.label}
          <button
            aria-label={t("remove_filter").replace("{label}", c.group)}
            onClick={() => onChange({ ...value, [c.key]: undefined } as Props["value"])}
            className="text-ink/40 hover:text-ink"
          ><X size={12} weight="bold" /></button>
        </span>
      ))}
    </div>
  );
}
