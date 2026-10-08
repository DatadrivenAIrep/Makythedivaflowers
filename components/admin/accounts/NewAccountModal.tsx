// components/admin/accounts/NewAccountModal.tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import AdminButton from "@/components/admin/dashboard/AdminButton";
import ModalShell from "./ModalShell";

type Props = { locale: string; onClose: () => void };

const INPUT = "w-full rounded-lg border border-ink/20 bg-white px-3 py-2 text-sm";

export default function NewAccountModal({ locale, onClose }: Props) {
  const t = useTranslations("admin_accounts");
  const router = useRouter();
  const [name, setName] = useState("");
  const [billingName, setBillingName] = useState("");
  const [billingPhone, setBillingPhone] = useState("");
  const [billingEmail, setBillingEmail] = useState("");
  const [lang, setLang] = useState<"en" | "es">(locale === "es" ? "es" : "en");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/accounts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, billingName: billingName || undefined, billingPhone: billingPhone || undefined, billingEmail, locale: lang }),
      });
      if (!res.ok) { setError(t("error_generic")); return; }
      const { account } = (await res.json()) as { account: { id: string } };
      router.push(`/${locale}/admin/accounts/${account.id}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell title={t("new_account")} onClose={onClose}>
      <div className="space-y-3">
        <label className="block text-sm"><span className="mb-1 block text-xs font-semibold">{t("form_name")}</span>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} className={INPUT} /></label>
        <label className="block text-sm"><span className="mb-1 block text-xs font-semibold">{t("form_billing_name")}</span>
          <input value={billingName} onChange={(e) => setBillingName(e.target.value)} className={INPUT} /></label>
        <label className="block text-sm"><span className="mb-1 block text-xs font-semibold">{t("form_billing_phone")}</span>
          <input inputMode="tel" value={billingPhone} onChange={(e) => setBillingPhone(e.target.value)} className={INPUT} /></label>
        <label className="block text-sm"><span className="mb-1 block text-xs font-semibold">{t("form_billing_email")}</span>
          <input inputMode="email" value={billingEmail} onChange={(e) => setBillingEmail(e.target.value)} className={INPUT} /></label>
        <label className="block text-sm"><span className="mb-1 block text-xs font-semibold">{t("form_locale")}</span>
          <select value={lang} onChange={(e) => setLang(e.target.value as "en" | "es")} className={INPUT}>
            <option value="es">Español</option><option value="en">English</option>
          </select></label>
      </div>
      {error && <p className="mt-3 text-sm text-error">{error}</p>}
      <div className="mt-5 flex justify-end gap-2">
        <AdminButton variant="secondary" disabled={busy} onClick={onClose}>{t("cancel")}</AdminButton>
        <AdminButton variant="primary" disabled={busy || name.trim().length === 0} onClick={submit}>{t("create")}</AdminButton>
      </div>
    </ModalShell>
  );
}
