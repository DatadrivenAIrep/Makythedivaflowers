"use client";
import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
  Megaphone,
  FloppyDisk,
  PaperPlaneTilt,
  CheckCircle,
  WarningCircle,
} from "@phosphor-icons/react/dist/ssr";
import AdminButton from "@/components/admin/dashboard/AdminButton";
import type { Campaign } from "@/lib/campaign-storage";
import { smsSegments } from "@/lib/sms-segments";
import type { CampaignTemplate } from "@/data/campaign-templates";
import CampaignHistory from "./CampaignHistory";
import CampaignTemplates from "./CampaignTemplates";

type Preview = {
  recipientCount: number;
  previewEs: string;
  previewEn: string;
  segmentsEs: number;
  segmentsEn: number;
};

type TestState = { state: "idle" | "sending" | "ok" | "error"; msg?: string };
type SendResult = { sent: number; failed: number; skipped: number };

const JSON_HEADERS = { "Content-Type": "application/json" };

export default function CampaignsPage({ locale }: { locale: string }) {
  const t = useTranslations("admin_campaigns");

  const [bodyEs, setBodyEs] = useState("");
  const [bodyEn, setBodyEn] = useState("");
  const [draftId, setDraftId] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [testTo, setTestTo] = useState("");
  const [testLocale, setTestLocale] = useState<"es" | "en">("es");
  const [test, setTest] = useState<TestState>({ state: "idle" });

  const [busy, setBusy] = useState(false);
  const [sendResult, setSendResult] = useState<SendResult | null>(null);

  const [history, setHistory] = useState<Campaign[]>([]);
  const [historyError, setHistoryError] = useState(false);

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/campaigns");
      if (!res.ok) throw new Error();
      const d = await res.json();
      setHistory(d.campaigns ?? []);
      setHistoryError(false);
    } catch {
      setHistoryError(true);
    }
  }, []);
  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  // Save (create or update the draft), then load the server-rendered preview. Editing
  // and re-saving PATCHes the same draft row (no duplicate drafts in history).
  async function saveDraft() {
    setSaving(true);
    setError(null);
    setSendResult(null);
    setTest({ state: "idle" });
    try {
      let id = draftId;
      if (id) {
        const res = await fetch(`/api/admin/campaigns/${id}`, {
          method: "PATCH",
          headers: JSON_HEADERS,
          body: JSON.stringify({ bodyEs, bodyEn }),
        });
        if (!res.ok) throw new Error();
      } else {
        const res = await fetch("/api/admin/campaigns", {
          method: "POST",
          headers: JSON_HEADERS,
          body: JSON.stringify({ bodyEs, bodyEn }),
        });
        if (!res.ok) throw new Error();
        const created = await res.json();
        id = created.campaign.id as string;
        setDraftId(id);
      }
      const dres = await fetch(`/api/admin/campaigns/${id}`);
      if (!dres.ok) throw new Error();
      const d = await dres.json();
      setPreview({
        recipientCount: d.recipientCount,
        previewEs: d.previewEs,
        previewEn: d.previewEn,
        segmentsEs: d.segmentsEs,
        segmentsEn: d.segmentsEn,
      });
    } catch {
      setError(t("error"));
    } finally {
      setSaving(false);
    }
  }

  function testErr(code: string): string {
    switch (code) {
      case "no_credentials":
        return t("err_no_credentials");
      case "sms_disabled":
        return t("err_sms_disabled");
      case "invalid_number":
        return t("err_invalid_number");
      default:
        return t("err_test_failed");
    }
  }

  async function sendTest() {
    if (!draftId) return;
    setTest({ state: "sending" });
    try {
      const res = await fetch(`/api/admin/campaigns/${draftId}/test`, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ to: testTo || undefined, locale: testLocale }),
      });
      const d = await res.json().catch(() => ({ ok: false }));
      setTest(d.ok ? { state: "ok" } : { state: "error", msg: testErr(String(d.error ?? "")) });
    } catch {
      setTest({ state: "error", msg: t("err_test_failed") });
    }
  }

  async function sendAll() {
    if (!draftId || !preview) return;
    if (!confirm(t("confirm_send", { count: preview.recipientCount }))) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/campaigns/${draftId}/send`, { method: "POST" });
      const d = await res.json().catch(() => ({ ok: false }));
      if (!d.ok) {
        setError(t("error"));
        return;
      }
      setSendResult({ sent: d.sent, failed: d.failed, skipped: d.skipped });
      setDraftId(null);
      setPreview(null);
      setBodyEs("");
      setBodyEn("");
      setTest({ state: "idle" });
      void loadHistory();
    } finally {
      setBusy(false);
    }
  }

  // Tapping a template fills the compose fields. Clear the stale preview so the
  // owner re-saves to preview the new copy; keep draftId so the re-save updates
  // the same draft row rather than minting a new one.
  function pickTemplate(tpl: CampaignTemplate) {
    setBodyEs(tpl.bodyEs);
    setBodyEn(tpl.bodyEn);
    setPreview(null);
    setError(null);
    setTest({ state: "idle" });
    setSendResult(null);
  }

  const hasDraft = draftId !== null;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <header className="flex items-center gap-2">
        <Megaphone size={26} weight="duotone" className="text-rouge" />
        <h1 className="font-display text-3xl text-ink">{t("title")}</h1>
      </header>
      <p className="text-sm text-ink/60">{t("intro")}</p>

      {/* 1. Compose */}
      <section className="overflow-hidden rounded-bento bg-white shadow-sm">
        <div className="border-b border-mute-100 px-6 py-4">
          <h2 className="font-display text-base text-ink">{t("compose_section")}</h2>
        </div>
        <div className="space-y-5 px-6 py-5">
          <CampaignTemplates locale={locale} onPick={pickTemplate} />
          <div className="grid gap-4 border-t border-ink/5 pt-5 md:grid-cols-2">
            <Field label={t("body_es_label")} value={bodyEs} onChange={setBodyEs} />
            <Field label={t("body_en_label")} value={bodyEn} onChange={setBodyEn} />
          </div>
          <p className="text-xs text-ink/50">{t("name_hint")}</p>
          <div className="flex items-center justify-between border-t border-ink/5 pt-4">
            {error && (
              <span className="flex items-center gap-1.5 text-sm text-error">
                <WarningCircle size={16} weight="fill" /> {error}
              </span>
            )}
            <AdminButton
              variant={hasDraft ? "secondary" : "primary"}
              icon={FloppyDisk}
              onClick={saveDraft}
              disabled={!bodyEs.trim() || saving}
              className="ml-auto"
            >
              {saving ? t("saving") : hasDraft ? t("update_draft") : t("save_draft")}
            </AdminButton>
          </div>
        </div>
      </section>

      {/* 2. Preview */}
      {hasDraft && preview && (
        <section className="overflow-hidden rounded-bento bg-white shadow-sm">
          <div className="border-b border-mute-100 px-6 py-4">
            <h2 className="font-display text-base text-ink">{t("preview_section")}</h2>
          </div>
          <div className="space-y-4 px-6 py-5">
            <div className="rounded border border-ink/10 bg-bone p-3">
              <div className="text-xs uppercase tracking-wide text-ink/50">{t("recipients_label")}</div>
              <div className="text-2xl font-semibold">{preview.recipientCount}</div>
            </div>
            <p className="text-xs text-ink/50">{t("preview_hint")}</p>
            <PreviewBubble lang={t("preview_es")} body={preview.previewEs} seg={preview.segmentsEs} />
            {bodyEn.trim() ? (
              <PreviewBubble lang={t("preview_en")} body={preview.previewEn} seg={preview.segmentsEn} />
            ) : (
              <p className="flex items-start gap-2 rounded-lg bg-mute-100 px-3 py-2 text-xs text-mute-600">
                <WarningCircle size={14} weight="fill" className="mt-0.5 shrink-0 text-mute-400" />
                {t("preview_en_fallback")}
              </p>
            )}
            <p className="text-xs text-ink/50">{t("sample_name_note")}</p>
          </div>
        </section>
      )}

      {/* 3. Send (test + blast) */}
      {hasDraft && preview && (
        <section className="overflow-hidden rounded-bento bg-white shadow-sm">
          <div className="border-b border-mute-100 px-6 py-4">
            <h2 className="font-display text-base text-ink">{t("send_section")}</h2>
          </div>
          <div className="space-y-5 px-6 py-5">
            {/* Test send */}
            <div>
              <div className="mb-2 text-xs uppercase tracking-wide text-ink/50">{t("test_section")}</div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="tel"
                  inputMode="tel"
                  value={testTo}
                  onChange={(e) => setTestTo(e.target.value)}
                  placeholder={t("test_to_placeholder")}
                  aria-label={t("test_to_placeholder")}
                  className="min-h-11 w-60 rounded-lg border border-ink/20 bg-bone px-3 text-sm outline-none focus:border-ink focus:bg-white"
                />
                <div className="flex gap-1" role="group" aria-label={t("test_language")}>
                  {(["es", "en"] as const).map((lc) => (
                    <button
                      key={lc}
                      type="button"
                      onClick={() => setTestLocale(lc)}
                      className={`flex min-h-11 items-center rounded-lg px-3 text-sm ${
                        testLocale === lc ? "bg-rouge text-bone" : "border border-ink/20 hover:bg-ink/5"
                      }`}
                    >
                      {lc.toUpperCase()}
                    </button>
                  ))}
                </div>
                <AdminButton
                  variant="secondary"
                  icon={PaperPlaneTilt}
                  onClick={sendTest}
                  disabled={test.state === "sending"}
                >
                  {test.state === "sending" ? t("sending") : t("test_send")}
                </AdminButton>
              </div>
              <p className="mt-2 text-xs text-ink/50">{t("test_hint")}</p>
              {test.state === "ok" && (
                <p className="mt-2 flex items-center gap-1.5 text-sm text-success">
                  <CheckCircle size={16} weight="fill" /> {t("test_ok")}
                </p>
              )}
              {test.state === "error" && (
                <p className="mt-2 flex items-center gap-1.5 text-sm text-error">
                  <WarningCircle size={16} weight="fill" /> {test.msg}
                </p>
              )}
            </div>

            {/* Blast */}
            <div className="border-t border-mute-100 pt-5">
              <AdminButton
                variant="primary"
                icon={PaperPlaneTilt}
                className="w-full"
                onClick={sendAll}
                disabled={busy || preview.recipientCount === 0}
              >
                {busy ? t("sending") : t("send_all", { count: preview.recipientCount })}
              </AdminButton>
            </div>
          </div>
        </section>
      )}

      {/* Post-send result (persists after the compose fields clear) */}
      {sendResult && (
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              ["result_sent_label", sendResult.sent],
              ["result_failed_label", sendResult.failed],
              ["result_skipped_label", sendResult.skipped],
            ] as const
          ).map(([key, value]) => (
            <div key={key} className="rounded border border-ink/10 bg-bone p-3">
              <div className="text-xs uppercase tracking-wide text-ink/50">{t(key)}</div>
              <div className="text-xl font-semibold">{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* 4. History */}
      <CampaignHistory campaigns={history} locale={locale} error={historyError} />
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs uppercase tracking-wide text-ink/50">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-28 w-full resize-y rounded-lg border border-mute-200 bg-bone p-3 text-sm outline-none focus:border-ink focus:bg-white"
      />
      <SmsMeter text={value} />
    </div>
  );
}

function SmsMeter({ text }: { text: string }) {
  const t = useTranslations("admin_campaigns");
  const chars = [...text].length;
  const seg = text.trim() ? smsSegments(text) : 0;
  return (
    <div className="mt-1 flex items-center justify-between text-xs text-ink/50">
      <span>{t("chars", { count: chars })}</span>
      <span className={seg > 1 ? "text-amber-700" : "text-ink/50"}>{t("sms_count", { count: seg })}</span>
    </div>
  );
}

function PreviewBubble({ lang, body, seg }: { lang: string; body: string; seg: number }) {
  const t = useTranslations("admin_campaigns");
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-ink/50">{lang}</span>
        <span
          className={`rounded-full px-2 py-0.5 text-xs ${
            seg > 1 ? "bg-amber-50 text-amber-800" : "bg-ink/5 text-ink/60"
          }`}
        >
          {t("sms_count", { count: seg })}
        </span>
      </div>
      <div className="max-w-[85%] rounded-2xl rounded-tl-sm border border-ink/10 bg-bone px-4 py-3 text-sm leading-relaxed">
        {body}
      </div>
    </div>
  );
}
