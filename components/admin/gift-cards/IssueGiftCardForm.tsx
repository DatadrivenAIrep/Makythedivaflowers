"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";

export default function IssueGiftCardForm({ onIssued }: { onIssued: () => void }) {
  const t = useTranslations("admin_gift_cards");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [from, setFrom] = useState("");
  const [message, setMessage] = useState("");
  const [reason, setReason] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/gift-cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amountCents: 15000,
        recipientEmail: email,
        recipientName: name || undefined,
        fromLabel: from || undefined,
        personalMessage: message || undefined,
        reason: reason || undefined,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setError(t("form_error"));
      return;
    }
    onIssued();
  }

  return (
    <form onSubmit={submit} className="max-w-md space-y-4">
      <div>
        <label className="mb-1 block text-xs font-semibold">{t("form_amount")}</label>
        <span className="inline-block rounded-lg bg-rouge px-4 py-2 font-bold text-bone">$150</span>
      </div>
      <label className="block">
        <span className="mb-1 block text-xs font-semibold">{t("form_recipient_email")}</span>
        <input
          type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-ink/20 px-3 py-2"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-semibold">{t("form_recipient_name")} <em className="opacity-50">({t("form_optional")})</em></span>
        <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-lg border border-ink/20 px-3 py-2" />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-semibold">{t("form_from")} <em className="opacity-50">({t("form_optional")})</em></span>
        <input value={from} onChange={(e) => setFrom(e.target.value)} className="w-full rounded-lg border border-ink/20 px-3 py-2" />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-semibold">{t("form_message")} <em className="opacity-50">({t("form_optional")})</em></span>
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} className="min-h-[60px] w-full rounded-lg border border-ink/20 px-3 py-2" />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-semibold">{t("form_reason")} <em className="opacity-50">({t("form_optional")})</em></span>
        <select value={reason} onChange={(e) => setReason(e.target.value)} className="w-full rounded-lg border border-ink/20 px-3 py-2">
          <option value="">—</option>
          <option value="loyalty">{t("reason_loyalty")}</option>
          <option value="apology">{t("reason_apology")}</option>
          <option value="prize">{t("reason_prize")}</option>
          <option value="marketing">{t("reason_marketing")}</option>
          <option value="other">{t("reason_other")}</option>
        </select>
      </label>
      {error && <p className="text-sm text-rouge">{error}</p>}
      <button type="submit" disabled={busy} className="w-full rounded-lg bg-rouge py-3 font-bold text-bone disabled:opacity-50">
        {busy ? t("form_submitting") : t("form_submit")}
      </button>
    </form>
  );
}
