"use client";
import { useState } from "react";

type Applied = { code: string; appliedCents: number };

export default function GiftCardField({
  totalCents,
  onApply,
  onClear,
}: {
  totalCents: number;
  onApply: (a: Applied) => void;
  onClear: () => void;
}) {
  const [code, setCode] = useState("");
  const [applied, setApplied] = useState<Applied | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function apply() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout/gift-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!data.valid) {
        setError("Código inválido o sin saldo / Invalid or empty code");
        return;
      }
      const appliedCents = Math.min(data.balanceCents, totalCents);
      const a = { code: data.code, appliedCents };
      setApplied(a);
      onApply(a);
    } finally {
      setBusy(false);
    }
  }

  function clear() {
    setApplied(null);
    setCode("");
    setError(null);
    onClear();
  }

  if (applied) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-green-700/30 bg-green-700/10 px-3 py-2 text-sm">
        <span>✓ Gift card <strong>{applied.code}</strong> · −${(applied.appliedCents / 100).toFixed(2)}</span>
        <button type="button" onClick={clear} className="opacity-60">quitar ✕</button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="DIVA-XXXX-XXXX"
          className="flex-1 rounded-lg border border-ink/20 px-3 py-2 font-mono text-sm"
        />
        <button type="button" onClick={apply} disabled={busy || !code} className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-bone disabled:opacity-50">
          Aplicar
        </button>
      </div>
      {error && <p className="mt-1 text-sm text-rouge">{error}</p>}
    </div>
  );
}
