"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import AdminButton from "@/components/admin/dashboard/AdminButton";

type Props = { accountId: string; onClose: () => void; onDone: () => void };

export default function EntryModal({ accountId, onClose, onDone }: Props) {
  const t = useTranslations("admin_accounts");
  const [kind, setKind] = useState<"credit" | "adjustment">("credit");
  const [text, setText] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cents = Math.round(parseFloat(text) * 100);
  const valid = Number.isFinite(cents) && (kind === "credit" ? cents > 0 : cents !== 0) && note.trim().length > 0;

  async function submit() {
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/admin/accounts/${accountId}/entries`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind, amountCents: cents, note: note.trim() }),
      });
      if (!res.ok) { setError(t("error_generic")); return; }
      onDone();
    } catch { setError(t("error_generic"));
    } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-ink/30 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl bg-bone p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-4 text-lg font-semibold">{t("credit_or_adjustment")}</h2>
        <div className="mb-3 flex gap-1.5">
          {(["credit", "adjustment"] as const).map((k) => (
            <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium ${kind === k ? "border-ink bg-ink text-bone" : "border-ink/20 bg-white text-ink/70 hover:border-ink"}`}>{t(`entry_${k}`)}</button>
          ))}
        </div>
        <p className="mb-3 text-xs text-ink/60">{t(kind === "credit" ? "entry_hint_credit" : "entry_hint_adjustment")}</p>
        <label className="block text-sm"><span className="mb-1 block text-xs font-semibold">{t("pay_amount")}</span>
          <input autoFocus inputMode="decimal" value={text} placeholder="0.00" onChange={(e) => setText(e.target.value.replace(/[^0-9.\-]/g, ""))}
            className="w-full rounded-lg border border-ink/20 bg-white px-3 py-2 text-sm tabular-nums" /></label>
        <label className="mt-3 block text-sm"><span className="mb-1 block text-xs font-semibold">{t("pay_note")}</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} className="w-full rounded-lg border border-ink/20 bg-white px-3 py-2 text-sm" /></label>
        {error && <p className="mt-3 text-sm text-error">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <AdminButton variant="secondary" disabled={busy} onClick={onClose}>{t("cancel")}</AdminButton>
          <AdminButton variant="primary" disabled={busy || !valid} onClick={submit}>{t("save")}</AdminButton>
        </div>
      </div>
    </div>
  );
}
