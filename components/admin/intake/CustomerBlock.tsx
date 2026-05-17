"use client";
import { useEffect, useState } from "react";
import type { Address } from "@/types/address";

export type CustomerSnapshot = {
  name: string;
  phone: string;
  email: string;
};

type Props = {
  value: CustomerSnapshot;
  onChange: (v: CustomerSnapshot) => void;
  onApplyAddress: (address: Address) => void;
};

export default function CustomerBlock({ value, onChange, onApplyAddress }: Props) {
  const [match, setMatch] = useState<{ orderCount: number; lastCity?: string; lastAddress?: Address } | null>(null);

  useEffect(() => {
    const digits = value.phone.replace(/\D/g, "");
    if (digits.length < 10) {
      setMatch(null);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/customers/lookup?phone=${encodeURIComponent(digits)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!data.found) {
          setMatch(null);
          return;
        }
        const c = data.customer;
        setMatch({
          orderCount: c.orderCount,
          lastCity: c.lastAddress?.city,
          lastAddress: c.lastAddress,
        });
        onChange({
          ...value,
          name: value.name || c.name,
          email: value.email || c.email || "",
        });
      } catch {
        // ignore network errors here
      }
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.phone]);

  function applyLastAddress() {
    if (match?.lastAddress) onApplyAddress(match.lastAddress);
  }

  return (
    <div className="mb-5">
      <label className="block text-[11px] uppercase tracking-widest text-mute-400 mb-2">Cliente</label>
      <div className="grid grid-cols-2 gap-2">
        <input
          inputMode="tel"
          autoComplete="off"
          value={value.phone}
          onChange={(e) => onChange({ ...value, phone: e.target.value })}
          placeholder="Teléfono"
          className="p-3.5 rounded-xl bg-bone border border-mute-200 text-ink outline-none focus:border-ink focus:bg-white"
        />
        <input
          value={value.name}
          onChange={(e) => onChange({ ...value, name: e.target.value })}
          placeholder="Nombre"
          className="p-3.5 rounded-xl bg-bone border border-mute-200 text-ink outline-none focus:border-ink focus:bg-white"
        />
      </div>
      <input
        type="email"
        value={value.email}
        onChange={(e) => onChange({ ...value, email: e.target.value })}
        placeholder="Email (opcional)"
        className="mt-2 w-full p-3.5 rounded-xl bg-bone border border-mute-200 text-ink outline-none focus:border-ink focus:bg-white"
      />
      {match && (
        <div className="mt-2 flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-rouge/[0.06] border-l-2 border-rouge text-[12.5px] text-mute-700">
          <span>
            <strong className="text-rouge font-medium">★ Cliente recurrente</strong>
            {" · "}{match.orderCount} pedido{match.orderCount === 1 ? "" : "s"}
            {match.lastCity ? ` · último: ${match.lastCity}` : ""}
          </span>
          {match.lastAddress && (
            <button type="button" onClick={applyLastAddress} className="underline text-rouge">
              usar última dirección
            </button>
          )}
        </div>
      )}
    </div>
  );
}
