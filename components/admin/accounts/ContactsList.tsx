"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import AdminButton from "@/components/admin/dashboard/AdminButton";
import type { Customer } from "@/lib/customer-storage";

type Props = { locale: string; accountId: string; contacts: Customer[]; busy: boolean; onChanged: () => void };
type Hit = { id: string; name: string; phone: string };

export default function ContactsList({ locale, accountId, contacts, busy, onChanged }: Props) {
  const t = useTranslations("admin_accounts");
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!adding || q.trim().length < 2) { setHits([]); return; }
    let cancelled = false;
    const h = setTimeout(async () => {
      const res = await fetch(`/api/admin/customers?q=${encodeURIComponent(q.trim())}&limit=8`, { cache: "no-store" });
      if (!res.ok || cancelled) return;
      const d = (await res.json()) as { customers: Hit[] };
      if (!cancelled) setHits(d.customers.map((c) => ({ id: c.id, name: c.name, phone: c.phone })));
    }, 200);
    return () => { cancelled = true; clearTimeout(h); };
  }, [q, adding]);

  async function link(customerId: string) {
    setError(null);
    try {
      const res = await fetch(`/api/admin/accounts/${accountId}/contacts`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ customerId }),
      });
      if (res.status === 409) { setError(t("contact_taken")); return; }
      if (!res.ok) { setError(t("error_generic")); return; }
      setAdding(false); setQ(""); onChanged();
    } catch {
      setError(t("error_generic"));
    }
  }
  async function unlink(customerId: string) {
    setError(null);
    try {
      const res = await fetch(`/api/admin/accounts/${accountId}/contacts`, {
        method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ customerId }),
      });
      if (!res.ok) { setError(t("error_generic")); return; }
    } catch {
      setError(t("error_generic"));
      return;
    }
    onChanged();
  }

  return (
    <div>
      {contacts.length === 0 ? <p className="text-sm text-ink/50">{t("contacts_empty")}</p> : (
        <ul className="divide-y divide-ink/10 text-sm">
          {contacts.map((c) => (
            <li key={c.id} className="flex items-center gap-3 py-2">
              <Link href={`/${locale}/admin/customers/${c.id}`} className="font-medium underline decoration-ink/30 underline-offset-2 hover:decoration-ink">{c.name}</Link>
              <span className="text-ink/60">{c.phone}</span>
              <button type="button" disabled={busy} onClick={() => unlink(c.id)} className="ml-auto text-xs text-error underline">{t("remove")}</button>
            </li>
          ))}
        </ul>
      )}
      {!adding && error && <p className="mt-2 text-xs text-error">{error}</p>}
      {adding ? (
        <div className="mt-3">
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("contact_search_placeholder")}
            className="w-full rounded-lg border border-ink/20 bg-white px-3 py-2 text-sm" />
          {q.trim().length >= 2 && (
            <ul className="mt-1 divide-y divide-ink/10 rounded-lg border border-ink/10 bg-white text-sm">
              {hits.length === 0 && <li className="px-3 py-2 text-ink/50">{t("contact_no_results")}</li>}
              {hits.map((h) => (
                <li key={h.id}>
                  <button type="button" onClick={() => link(h.id)} className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-ink/5">
                    <span className="font-medium">{h.name}</span><span className="text-ink/60">{h.phone}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {error && <p className="mt-2 text-xs text-error">{error}</p>}
          <div className="mt-2"><AdminButton variant="secondary" onClick={() => { setAdding(false); setQ(""); setError(null); }}>{t("cancel")}</AdminButton></div>
        </div>
      ) : (
        <div className="mt-3"><AdminButton variant="secondary" disabled={busy} onClick={() => setAdding(true)}>{t("add_contact")}</AdminButton></div>
      )}
    </div>
  );
}
