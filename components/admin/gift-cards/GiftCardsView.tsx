"use client";
import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowLeft, Plus } from "@phosphor-icons/react/dist/ssr";
import type { GiftCardListItem, GiftCardStats } from "@/lib/gift-card-storage";
import IssueGiftCardForm from "./IssueGiftCardForm";
import GiftCardDetail from "./GiftCardDetail";

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function initial(c: GiftCardListItem): string {
  return (c.recipientName?.trim()?.[0] ?? c.recipientEmail.trim()[0] ?? "?").toUpperCase();
}

const STATUS: Record<string, { key: string; cls: string }> = {
  active: { key: "status_active", cls: "bg-emerald-600/10 text-emerald-700" },
  partial: { key: "status_partial", cls: "bg-rouge/10 text-rouge" },
  empty: { key: "status_empty", cls: "bg-ink/10 text-ink/55" },
  expired: { key: "status_expired", cls: "bg-amber-500/15 text-amber-700" },
  void: { key: "status_void", cls: "bg-ink/10 text-ink/45 line-through" },
};

export default function GiftCardsView({
  initialCards,
  initialStats,
  locale,
}: {
  initialCards: GiftCardListItem[];
  initialStats: GiftCardStats;
  locale: "en" | "es";
}) {
  const t = useTranslations("admin_gift_cards");
  const [cards, setCards] = useState(initialCards);
  const [stats, setStats] = useState(initialStats);
  const [issuing, setIssuing] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  async function refresh() {
    const d = await fetch("/api/admin/gift-cards").then((r) => r.json());
    setCards(d.cards);
    setStats(d.stats);
  }

  return (
    <div className="mx-auto max-w-5xl">
      <Link
        href={`/${locale}/admin/dashboard`}
        className="mb-2 inline-flex items-center gap-1.5 text-sm text-rouge hover:underline"
      >
        <ArrowLeft size={15} weight="bold" /> {t("back_to_dashboard")}
      </Link>

      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl text-ink">{t("title")}</h1>
          <p className="mt-1 text-sm text-ink/55">{t("subtitle")}</p>
        </div>
        <button
          onClick={() => setIssuing(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-rouge px-4 py-2.5 text-sm font-bold text-bone hover:bg-rouge/90"
        >
          <Plus size={16} weight="bold" /> {t("issue_cta")}
        </button>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label={t("stat_active")} value={String(stats.activeCount)} />
        <Stat label={t("stat_pending")} value={money(stats.pendingCents)} liability />
        <Stat label={t("stat_issued")} value={money(stats.issuedCents)} />
        <Stat label={t("stat_redeemed")} value={money(stats.redeemedCents)} />
      </div>

      {cards.length === 0 ? (
        <div className="rounded-xl border border-dashed border-ink/15 bg-bone p-10 text-center text-ink/55">
          {t("empty")}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-ink/10 bg-bone">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wide text-ink/50">
                <th className="px-4 py-3 font-semibold">{t("col_code")}</th>
                <th className="px-4 py-3 font-semibold">{t("col_recipient")}</th>
                <th className="px-4 py-3 font-semibold">{t("col_balance")}</th>
                <th className="px-4 py-3 font-semibold">{t("col_status")}</th>
                <th className="px-4 py-3 font-semibold">{t("col_expires")}</th>
                <th className="px-4 py-3 font-semibold">{t("col_reason")}</th>
              </tr>
            </thead>
            <tbody>
              {cards.map((c) => {
                const pct = c.initialCents > 0 ? Math.round((c.balanceCents / c.initialCents) * 100) : 0;
                const s = STATUS[c.display] ?? STATUS.active;
                return (
                  <tr
                    key={c.id}
                    onClick={() => setOpenId(c.id)}
                    className="cursor-pointer border-t border-ink/8 transition hover:bg-ink/[0.03]"
                  >
                    <td className="px-4 py-3 font-mono font-semibold tracking-wide">{c.code}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-rouge text-xs font-bold text-bone">
                          {initial(c)}
                        </span>
                        <span>
                          {c.recipientName && <span className="font-semibold">{c.recipientName}</span>}
                          <span className="block text-[11px] text-ink/55">{c.recipientEmail}</span>
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="min-w-[110px]">
                        <div className="mb-1 text-xs">
                          <b>{money(c.balanceCents)}</b>
                          <span className="text-ink/45"> / {money(c.initialCents)}</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-ink/10">
                          <span className="block h-full rounded-full bg-rouge" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-semibold ${s.cls}`}>
                        {t(s.key)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-ink/70">
                      {c.expiresAt
                        ? new Date(c.expiresAt).toLocaleDateString(locale === "es" ? "es-ES" : "en-US")
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-[10px] uppercase tracking-wide text-ink/45">
                      {c.reason ? t(`reason_${c.reason}`) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {issuing && (
        <Drawer onClose={() => setIssuing(false)}>
          <IssueGiftCardForm
            onIssued={() => {
              setIssuing(false);
              void refresh();
            }}
          />
        </Drawer>
      )}
      {openId && (
        <Drawer onClose={() => setOpenId(null)}>
          <GiftCardDetail
            id={openId}
            onChanged={() => {
              setOpenId(null);
              void refresh();
            }}
          />
        </Drawer>
      )}
    </div>
  );
}

function Stat({ label, value, liability }: { label: string; value: string; liability?: boolean }) {
  return (
    <div
      className={`rounded-xl border p-3.5 ${
        liability ? "border-rouge/30 bg-rouge/[0.06]" : "border-ink/10 bg-bone"
      }`}
    >
      <div className={`text-2xl font-bold ${liability ? "text-rouge" : "text-ink"}`}>{value}</div>
      <div className="mt-0.5 text-[10px] uppercase tracking-wide text-ink/55">{label}</div>
    </div>
  );
}

function Drawer({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-20 flex justify-end bg-ink/40" onClick={onClose}>
      <div
        className="h-full w-full max-w-md overflow-auto bg-bone p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
