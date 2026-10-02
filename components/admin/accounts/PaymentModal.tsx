"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import AdminButton from "@/components/admin/dashboard/AdminButton";

type Method = "cash" | "zelle" | "ach" | "check" | "card-terminal";
const METHODS: { id: Method; key: string }[] = [
  { id: "cash", key: "method_cash" }, { id: "zelle", key: "method_zelle" }, { id: "ach", key: "method_ach" },
  { id: "check", key: "method_check" }, { id: "card-terminal", key: "method_card_terminal" },
];
type Props = { accountId: string; onClose: () => void; onDone: () => void };

export default function PaymentModal({ accountId, onClose, onDone }: Props) {
  const t = useTranslations("admin_accounts");
  const [text, setText] = useState("");
  const [method, setMethod] = useState<Method>("zelle");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cents = Math.round(parseFloat(text) * 100);
  const valid = Number.isFinite(cents) && cents > 0;

  async function submit() {
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/admin/accounts/${accountId}/payments`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ amountCents: cents, method, note: note.trim() || undefined }),
      });
      if (!res.ok) { setError(t("error_generic")); return; }
      onDone();
    } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-ink/30 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl bg-bone p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-4 text-lg font-semibold">{t("record_payment")}</h2>
        <label className="block text-sm"><span className="mb-1 block text-xs font-semibold">{t("pay_amount")}</span>
          <div className="relative"><span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/50">$</span>
            <input autoFocus inputMode="decimal" value={text} placeholder="0.00" onChange={(e) => setText(e.target.value.replace(/[^0-9.]/g, ""))}
              onKeyDown={(e) => { if (e.key === "Enter" && valid) void submit(); }}
              className="w-full rounded-lg border border-ink/20 bg-white py-2 pl-6 pr-3 text-sm tabular-nums" /></div></label>
        <div className="mt-3 text-sm"><span className="mb-1 block text-xs font-semibold">{t("pay_method")}</span>
          <div className="flex flex-wrap gap-1.5">
            {METHODS.map((m) => (
              <button key={m.id} type="button" aria-pressed={method === m.id} onClick={() => setMethod(m.id)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium ${method === m.id ? "border-ink bg-ink text-bone" : "border-ink/20 bg-white text-ink/70 hover:border-ink"}`}>{t(m.key)}</button>
            ))}
          </div></div>
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
