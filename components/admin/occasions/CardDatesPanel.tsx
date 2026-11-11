"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import type { CardReview, CardScanPreview, CardScanReport } from "@/lib/card-dates-scan";
import { formatMonthDay } from "@/lib/customer-dates";

type Props = { initialPreview: CardScanPreview; initialReviews: CardReview[]; locale?: string };

const BTN = "flex min-h-11 items-center rounded-lg px-3 text-sm disabled:opacity-40";

/** Reads the card messages of past orders and lets staff settle the unclear ones. Sends nothing. */
export default function CardDatesPanel({ initialPreview, initialReviews, locale = "es" }: Props) {
  const t = useTranslations("card_dates");
  const [preview, setPreview] = useState(initialPreview);
  const [reviews, setReviews] = useState(initialReviews);
  const [report, setReport] = useState<CardScanReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});

  async function run() {
    setBusy(true);
    setError(false);
    try {
      const res = await fetch("/api/admin/occasions/card-dates", { method: "POST" });
      if (!res.ok) throw new Error(String(res.status));
      const body = (await res.json()) as { report: CardScanReport; preview: CardScanPreview; reviews: CardReview[] };
      setReport(body.report);
      setPreview(body.preview);
      setReviews(body.reviews);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  async function resolve(r: CardReview, action: "birthday" | "anniversary" | "dismiss") {
    setBusy(true);
    setError(false);
    setNote(null);
    try {
      const name = names[r.orderId]?.trim();
      const res = await fetch("/api/admin/occasions/card-dates/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: r.orderId, action, ...(name ? { name } : {}) }),
      });
      if (res.status === 404) {
        // Already settled somewhere else: drop it and say so.
        setReviews((list) => list.filter((x) => x.orderId !== r.orderId));
        setNote(t("already_resolved"));
        return;
      }
      if (res.status === 400 && action !== "dismiss") {
        setNote(t("name_required"));
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      const body = (await res.json()) as { reviews: CardReview[] | null };
      // A null list means the date was settled but the list could not be re-read.
      setReviews((list) => body.reviews ?? list.filter((x) => x.orderId !== r.orderId));
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto mb-4 max-w-4xl rounded border border-ink/10 bg-bone p-3">
      <h2 className="mb-2 text-sm font-semibold">{t("title")}</h2>
      {preview.pendingOrders > 0 ? (
        <p className="mb-2 text-sm">
          {t("pending", { orders: preview.pendingOrders, saved: preview.wouldSave, review: preview.wouldReview })}
        </p>
      ) : (
        <p className="mb-2 text-sm text-ink/60">{t("nothing")}</p>
      )}
      {preview.unlinkedOrders > 0 && (
        <p className="mb-2 text-sm text-ink/70">{t("unlinked", { count: preview.unlinkedOrders })}</p>
      )}
      <button
        type="button"
        disabled={busy || preview.pendingOrders === 0}
        onClick={() => void run()}
        className={`${BTN} bg-rouge text-bone`}
      >
        {t("run")}
      </button>
      {report && (
        <div className="mt-2 text-sm" role="status">
          <p>{t("done", { saved: report.saved, review: report.review })}</p>
          {report.failed > 0 && <p className="text-ink/70">{t("failed", { count: report.failed })}</p>}
        </div>
      )}
      {error && <p className="mt-2 text-sm text-rouge" role="alert">{t("error")}</p>}
      {note && <p className="mt-2 text-sm text-ink/70" role="status">{note}</p>}

      {reviews.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-2 text-sm font-semibold">{t("review_title", { count: reviews.length })}</h3>
          <ul className="divide-y divide-ink/10">
            {reviews.map((r) => {
              const typed = (names[r.orderId] ?? "").trim();
              const blocked = busy || (r.needsName && typed === "");
              return (
                <li key={r.orderId} className="py-2">
                  <p className="text-sm font-medium">
                    {r.customerName} · {r.recipientName}
                    {r.orderNumber !== undefined ? ` · #${r.orderNumber}` : ""} · {formatMonthDay(r.month, r.day, locale)}
                    {r.relationship ? ` · ${t(`relationship.${r.relationship}`)}` : ""}
                  </p>
                  <p className="my-1 whitespace-pre-line text-sm italic text-ink/70">{r.cardMessage}</p>
                  {r.needsName && (
                    <input
                      value={names[r.orderId] ?? ""}
                      maxLength={40}
                      onChange={(e) => setNames((n) => ({ ...n, [r.orderId]: e.target.value }))}
                      placeholder={t("name_placeholder")}
                      className="mb-1 min-h-11 w-full rounded-lg border border-ink/20 bg-bone px-3 text-sm"
                    />
                  )}
                  <div className="flex flex-wrap gap-1">
                    <button type="button" disabled={blocked} onClick={() => void resolve(r, "birthday")} className={`${BTN} border border-ink/20 hover:bg-ink/5`}>
                      {t("birthday")}
                    </button>
                    <button type="button" disabled={blocked} onClick={() => void resolve(r, "anniversary")} className={`${BTN} border border-ink/20 hover:bg-ink/5`}>
                      {t("anniversary")}
                    </button>
                    <button type="button" disabled={busy} onClick={() => void resolve(r, "dismiss")} className={`${BTN} text-ink/60 hover:bg-ink/5`}>
                      {t("dismiss")}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
