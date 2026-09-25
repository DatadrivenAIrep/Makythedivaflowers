"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Copy, QrCode, Sparkle } from "@phosphor-icons/react/dist/ssr";
import AdminButton from "./AdminButton";
import type { DigitalCardView } from "@/types/digital-card";

type Props = { orderId: string; initial: DigitalCardView | null };

export default function DigitalCardSection({ orderId, initial }: Props) {
  const t = useTranslations("admin_orders");
  const [card, setCard] = useState<DigitalCardView | null>(initial);
  const [url, setUrl] = useState(initial?.targetUrl ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const endpoint = `/api/admin/orders/${orderId}/digital-card`;

  async function activate() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(endpoint, { method: "POST" });
      if (!res.ok) { setError(t("digital_card_error")); return; }
      setCard((await res.json()) as DigitalCardView);
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const trimmed = url.trim();
      const res = await fetch(endpoint, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ targetUrl: trimmed === "" ? null : trimmed }),
      });
      if (res.status === 400) { setError(t("digital_card_invalid_url")); return; }
      if (!res.ok) { setError(t("digital_card_error")); return; }
      const next = (await res.json()) as DigitalCardView;
      setCard(next);
      setUrl(next.targetUrl ?? "");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!card) return;
    await navigator.clipboard.writeText(card.shortUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const inputId = `digital-card-url-${orderId}`;

  return (
    <section className="mb-3 rounded border border-ink/10 bg-bone p-3 text-sm">
      <div className="mb-2 text-xs uppercase tracking-wide text-ink/50">{t("digital_card_title")}</div>
      {!card ? (
        <AdminButton variant="secondary" icon={Sparkle} disabled={busy} onClick={activate}>
          {t("digital_card_activate")}
        </AdminButton>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                card.targetUrl ? "bg-green-50 text-green-800" : "bg-ink/10 text-ink/70"
              }`}
            >
              {card.targetUrl ? t("digital_card_ready") : t("digital_card_preparing")}
            </span>
            <a href={card.shortUrl} target="_blank" rel="noreferrer" className="min-w-0 truncate underline">
              {card.shortUrl}
            </a>
            <button
              type="button"
              onClick={copy}
              aria-label={t("digital_card_copy")}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg hover:bg-ink/5"
            >
              <Copy size={16} weight="bold" />
            </button>
            {copied && <span className="text-xs text-ink/60">{t("digital_card_copied")}</span>}
          </div>
          <label htmlFor={inputId} className="block text-xs text-ink/60">{t("digital_card_url_label")}</label>
          <div className="flex gap-2">
            <input
              id={inputId}
              type="url"
              inputMode="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://tarjetas.makythedivaflowers.com/i/…"
              className="min-h-11 min-w-0 flex-1 rounded-lg border border-ink/20 bg-white px-3 text-sm"
            />
            <AdminButton variant="primary" disabled={busy} onClick={save}>{t("digital_card_save")}</AdminButton>
          </div>
          {error && <div role="alert" className="text-xs text-error">{error}</div>}
          <AdminButton variant="secondary" icon={QrCode} href={`${endpoint}/qr`} download>
            {t("digital_card_download_qr")}
          </AdminButton>
          <p className="text-xs text-ink/60">{t("digital_card_reprint_hint")}</p>
        </div>
      )}
    </section>
  );
}
