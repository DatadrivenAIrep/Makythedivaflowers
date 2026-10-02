"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { X } from "@phosphor-icons/react/dist/ssr";

export type AccountHit = { id: string; name: string };
type Props = { value: AccountHit | null; onSelect: (a: AccountHit | null) => void; autoFocus?: boolean };

export default function AccountSearch({ value, onSelect, autoFocus }: Props) {
  const t = useTranslations("admin_accounts");
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<AccountHit[]>([]);

  useEffect(() => {
    if (q.trim().length < 2) { setHits([]); return; }
    let cancelled = false;
    const h = setTimeout(async () => {
      const res = await fetch(`/api/admin/accounts/search?q=${encodeURIComponent(q.trim())}`, { cache: "no-store" });
      if (!res.ok || cancelled) return;
      const d = (await res.json()) as { accounts: AccountHit[] };
      if (!cancelled) setHits(d.accounts);
    }, 200);
    return () => { cancelled = true; clearTimeout(h); };
  }, [q]);

  if (value) {
    return (
      <div className="inline-flex items-center gap-2 rounded-full border border-ink bg-ink px-3 py-1.5 text-sm text-bone">
        {value.name}
        <button type="button" aria-label={t("remove")} onClick={() => onSelect(null)} className="rounded-full hover:bg-bone/20"><X size={14} weight="bold" /></button>
      </div>
    );
  }
  return (
    <div>
      <input autoFocus={autoFocus} value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("account_search_placeholder")}
        aria-label={t("account_search_placeholder")} className="w-full rounded-lg border border-mute-200 bg-white px-3 py-2 text-sm" />
      {q.trim().length >= 2 && (
        <ul className="mt-1 divide-y divide-ink/10 rounded-lg border border-ink/10 bg-white text-sm">
          {hits.length === 0 && <li className="px-3 py-2 text-ink/50">{t("account_no_results")}</li>}
          {hits.map((h) => (
            <li key={h.id}>
              <button type="button" onClick={() => { onSelect(h); setQ(""); }} className="w-full px-3 py-2 text-left hover:bg-ink/5">{h.name}</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
