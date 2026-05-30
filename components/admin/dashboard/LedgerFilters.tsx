"use client";
import { useEffect, useRef, useState } from "react";
import { X } from "@phosphor-icons/react/dist/ssr";

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

const PAY_OPTIONS: { id: string; label: string }[] = [
  { id: "pending", label: "Pendiente" },
  { id: "paid", label: "Pagado" },
  { id: "refunded", label: "Reembolsado" },
];

const FUL_OPTIONS: { id: string; label: string }[] = [
  { id: "pending", label: "Pendiente" },
  { id: "preparing", label: "Preparando" },
  { id: "out-for-delivery", label: "En camino" },
  { id: "delivered", label: "Entregada" },
  { id: "canceled", label: "Cancelada" },
];

const SRC_OPTIONS: { id: string; label: string }[] = [
  { id: "web", label: "Web" },
  { id: "walk-in", label: "Walk-in" },
  { id: "phone", label: "Teléfono" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "event", label: "Evento" },
];

const METHOD_OPTIONS: { id: string; label: string }[] = [
  { id: "delivery", label: "Delivery" },
  { id: "pickup", label: "Pickup" },
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
  function patch(p: Partial<LedgerFilterValue>) { onChange({ ...value, ...p }); }

  return (
    <div className="space-y-3">
      <DebouncedSearch
        value={value.q ?? ""}
        onDebouncedChange={(q) => patch({ q: q || undefined })}
      />

      <div className="flex flex-wrap gap-1.5 text-xs">
        <span className="self-center pr-1 text-ink/50">Fecha:</span>
        {[
          { id: "today", label: "Hoy", days: 0 },
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

      <FilterGroup label="Pago" options={PAY_OPTIONS} selected={value.paymentStatus}
        onToggle={(id) => patch({ paymentStatus: toggle(value.paymentStatus, id) })} />
      <FilterGroup label="Cumplimiento" options={FUL_OPTIONS} selected={value.fulfillmentStatus}
        onToggle={(id) => patch({ fulfillmentStatus: toggle(value.fulfillmentStatus, id) })} />
      <FilterGroup label="Fuente" options={SRC_OPTIONS} selected={value.source}
        onToggle={(id) => patch({ source: toggle(value.source, id) })} />
      <FilterGroup label="Entrega" options={METHOD_OPTIONS} selected={value.fulfillmentMethod}
        onToggle={(id) => patch({ fulfillmentMethod: toggle(value.fulfillmentMethod, id) })} />

      <ActiveChips value={value} onChange={onChange} />
    </div>
  );
}

function DebouncedSearch({ value, onDebouncedChange }: {
  value: string;
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
      placeholder="Buscar por nombre, teléfono, email, ID o mensaje de tarjeta"
      onChange={(e) => setText(e.target.value)}
      className="w-full rounded border border-ink/15 bg-bone px-3 py-2 text-sm"
    />
  );
}

function FilterGroup({ label, options, selected, onToggle }: {
  label: string; options: { id: string; label: string }[]; selected: string[] | undefined;
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
          >{o.label}</button>
        );
      })}
    </div>
  );
}

function ActiveChips({ value, onChange }: Props) {
  const chips: { key: keyof Props["value"]; label: string }[] = [];
  if (value.paymentStatus) chips.push({ key: "paymentStatus", label: `Pago: ${value.paymentStatus.map(s => PAY_OPTIONS.find(o=>o.id===s)?.label ?? s).join(", ")}` });
  if (value.fulfillmentStatus) chips.push({ key: "fulfillmentStatus", label: `Cumplimiento: ${value.fulfillmentStatus.join(", ")}` });
  if (value.source) chips.push({ key: "source", label: `Fuente: ${value.source.join(", ")}` });
  if (value.fulfillmentMethod) chips.push({ key: "fulfillmentMethod", label: `Entrega: ${value.fulfillmentMethod.join(", ")}` });
  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2 pt-1 text-xs">
      {chips.map((c) => (
        <span key={String(c.key)} className="inline-flex items-center gap-1 rounded-full bg-ink/5 px-2 py-0.5">
          {c.label}
          <button
            aria-label={`Quitar ${c.label.split(":")[0]}`}
            onClick={() => onChange({ ...value, [c.key]: undefined } as Props["value"])}
            className="text-ink/40 hover:text-ink"
          ><X size={12} weight="bold" /></button>
        </span>
      ))}
    </div>
  );
}
