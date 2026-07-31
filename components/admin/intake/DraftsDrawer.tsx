"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { X } from "@phosphor-icons/react/dist/ssr";
import { formatDateTime } from "@/lib/format-datetime";
import type { OrderDraft, OrderDraftDetail, DraftPayload } from "@/types/draft";

type Props = {
  locale: string;
  onResume: (payload: DraftPayload, id: string) => void;
  onClose: () => void;
};

export default function DraftsDrawer({ locale, onResume, onClose }: Props) {
  const t = useTranslations("admin_intake");
  const [drafts, setDrafts] = useState<OrderDraft[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/orders/drafts")
      .then((r) => (r.ok ? r.json() : { drafts: [] }))
      .then((d) => setDrafts(d.drafts as OrderDraft[]))
      .catch(() => setDrafts([]));
  }, []);

  async function resume(id: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/orders/drafts/${encodeURIComponent(id)}`);
      if (!res.ok) return;
      const { draft } = (await res.json()) as { draft: OrderDraftDetail };
      onResume(draft.payload, draft.id);
    } catch {
      // network error — leave the drawer open; the button re-enables via finally
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/orders/drafts/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) return;
      setDrafts((cur) => (cur ? cur.filter((d) => d.id !== id) : cur));
    } catch {
      // network error — keep the row; the button re-enables via finally
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex bg-ink/20" onClick={onClose}>
      <div
        className="ml-auto h-full w-full max-w-md overflow-y-auto bg-bone p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="mb-4 flex items-center justify-between gap-2">
          <h2 className="font-display text-lg text-ink">{t("drafts_title")}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("drafts_close")}
            className="rounded-full border border-mute-200 p-1.5 text-mute-600 hover:bg-ink/5"
          >
            <X size={16} weight="bold" />
          </button>
        </header>

        {drafts === null && <p className="text-mute-500 text-sm">{t("drafts_loading")}</p>}
        {drafts !== null && drafts.length === 0 && <p className="text-mute-500 text-sm">{t("drafts_empty")}</p>}

        <ul className="grid gap-2">
          {(drafts ?? []).map((d) => (
            <li key={d.id} className="rounded-xl border border-mute-200 bg-white p-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium text-ink truncate">{d.label || t("draft_untitled")}</div>
                  <div className="mt-0.5 text-xs text-mute-500 tabular-nums">
                    {t(d.itemCount === 1 ? "draft_items_one" : "draft_items_other", { count: d.itemCount })}
                    {" · "}
                    {`$${(d.totalCents / 100).toFixed(2)}`}
                  </div>
                  <div className="mt-0.5 text-xs text-mute-400">
                    {t("draft_updated", { when: formatDateTime(d.updatedAt, locale) })}
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    disabled={busyId !== null}
                    onClick={() => resume(d.id)}
                    className="rounded-full bg-ink px-3 py-1.5 text-xs text-bone disabled:opacity-40"
                  >
                    {t("draft_resume")}
                  </button>
                  <button
                    type="button"
                    disabled={busyId !== null}
                    onClick={() => remove(d.id)}
                    className="rounded-full border border-mute-200 px-3 py-1.5 text-xs text-mute-600 disabled:opacity-40"
                  >
                    {t("draft_delete")}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
