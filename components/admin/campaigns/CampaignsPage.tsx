"use client";
import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";

type Campaign = { id: string; status: string; bodyEs: string; sentCount: number; failedCount: number; createdAt: string };

export default function CampaignsPage() {
  const t = useTranslations("admin_campaigns");
  const [bodyEs, setBodyEs] = useState("");
  const [bodyEn, setBodyEn] = useState("");
  const [draft, setDraft] = useState<{ id: string } | null>(null);
  const [recipientCount, setRecipientCount] = useState(0);
  const [testTo, setTestTo] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<Campaign[]>([]);

  const loadHistory = useCallback(async () => {
    const d = await fetch("/api/admin/campaigns").then((r) => r.json());
    setHistory(d.campaigns ?? []);
  }, []);
  useEffect(() => { void loadHistory(); }, [loadHistory]);

  async function saveDraft() {
    setResult(null);
    const res = await fetch("/api/admin/campaigns", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bodyEs, bodyEn }),
    });
    if (!res.ok) { setResult(t("error")); return; }
    const d = await res.json();
    setDraft({ id: d.campaign.id });
    setRecipientCount(d.recipientCount);
  }

  async function sendTest() {
    if (!draft) return;
    await fetch(`/api/admin/campaigns/${draft.id}/test`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: testTo || undefined, locale: "es" }),
    });
  }

  async function sendAll() {
    if (!draft) return;
    if (!confirm(t("confirm_send", { count: recipientCount }))) return;
    setBusy(true); setResult(null);
    const res = await fetch(`/api/admin/campaigns/${draft.id}/send`, { method: "POST" });
    const d = await res.json();
    setBusy(false);
    if (!d.ok) { setResult(t("error")); return; }
    setResult(t("sent_result", { sent: d.sent, failed: d.failed, skipped: d.skipped }));
    setDraft(null); setBodyEs(""); setBodyEn("");
    void loadHistory();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-xl font-semibold">{t("title")}</h1>
      <p className="text-sm text-ink/60">{t("intro")}</p>

      <label className="block text-sm font-medium">{t("body_es_label")}</label>
      <textarea value={bodyEs} onChange={(e) => setBodyEs(e.target.value)} rows={3}
        className="w-full rounded-lg border border-ink/20 p-2" />
      <label className="block text-sm font-medium">{t("body_en_label")}</label>
      <textarea value={bodyEn} onChange={(e) => setBodyEn(e.target.value)} rows={3}
        className="w-full rounded-lg border border-ink/20 p-2" />
      <p className="text-xs text-ink/50">{t("name_hint")}</p>

      <button onClick={saveDraft} disabled={!bodyEs.trim()}
        className="rounded-lg bg-ink px-4 py-2 text-sm text-bone disabled:opacity-40">
        {t("save_draft")}
      </button>

      {draft && (
        <div className="space-y-3 rounded-lg border border-ink/10 p-3">
          <p className="text-sm">{t("recipients", { count: recipientCount })}</p>
          <div className="flex items-center gap-2">
            <input value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="+1…"
              className="rounded-lg border border-ink/20 px-2 py-1 text-sm" />
            <button onClick={sendTest} className="rounded-lg border border-ink/20 px-3 py-1 text-sm">
              {t("test_send")}
            </button>
          </div>
          <button onClick={sendAll} disabled={busy}
            className="rounded-lg bg-rouge px-4 py-2 text-sm text-bone disabled:opacity-40">
            {busy ? t("sending") : t("send_all", { count: recipientCount })}
          </button>
        </div>
      )}

      {result && <p className="text-sm">{result}</p>}

      <h2 className="pt-4 text-lg font-semibold">{t("history")}</h2>
      <ul className="space-y-1 text-sm">
        {history.map((c) => (
          <li key={c.id} className="flex justify-between border-b border-ink/5 py-1">
            <span className="truncate">{c.bodyEs}</span>
            <span className="text-ink/50">{c.status} · {c.sentCount}/{c.sentCount + c.failedCount}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
