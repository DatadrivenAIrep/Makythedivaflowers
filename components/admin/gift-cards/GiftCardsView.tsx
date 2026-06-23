"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import type { GiftCardListItem, GiftCardStats } from "@/lib/gift-card-storage";
import IssueGiftCardForm from "./IssueGiftCardForm";
import GiftCardDetail from "./GiftCardDetail";

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

const STATUS_KEY: Record<string, string> = {
  active: "status_active",
  partial: "status_partial",
  empty: "status_empty",
  expired: "status_expired",
  void: "status_void",
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
    <div className="mx-auto max-w-5xl p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">{t("title")}</h1>
        <button onClick={() => setIssuing(true)} className="rounded-lg bg-rouge px-4 py-2 font-bold text-bone">
          + {t("issue_cta")}
        </button>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label={t("stat_active")} value={String(stats.activeCount)} />
        <Stat label={t("stat_pending")} value={money(stats.pendingCents)} rouge />
        <Stat label={t("stat_issued")} value={money(stats.issuedCents)} />
        <Stat label={t("stat_redeemed")} value={money(stats.redeemedCents)} />
      </div>

      {cards.length === 0 ? (
        <p className="opacity-60">{t("empty")}</p>
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="text-left text-xs uppercase opacity-60">
              <th className="p-2">{t("col_code")}</th>
              <th className="p-2">{t("col_recipient")}</th>
              <th className="p-2">{t("col_balance")}</th>
              <th className="p-2">{t("col_status")}</th>
              <th className="p-2">{t("col_expires")}</th>
            </tr>
          </thead>
          <tbody>
            {cards.map((c) => (
              <tr key={c.id} className="cursor-pointer border-t border-ink/10 hover:bg-ink/5" onClick={() => setOpenId(c.id)}>
                <td className="p-2 font-mono font-semibold">{c.code}</td>
                <td className="p-2">
                  {c.recipientName && <><span>{c.recipientName}</span>{" · "}</>}
                  {c.recipientEmail}
                </td>
                <td className="p-2">{money(c.balanceCents)} / {money(c.initialCents)}</td>
                <td className="p-2">{t(STATUS_KEY[c.display])}</td>
                <td className="p-2">{c.expiresAt ? new Date(c.expiresAt).toLocaleDateString(locale === "es" ? "es-ES" : "en-US") : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
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

function Stat({ label, value, rouge }: { label: string; value: string; rouge?: boolean }) {
  return (
    <div className="rounded-lg border border-ink/10 bg-bone p-3">
      <div className={`text-2xl font-bold ${rouge ? "text-rouge" : "text-ink"}`}>{value}</div>
      <div className="text-xs uppercase opacity-60">{label}</div>
    </div>
  );
}

function Drawer({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-20 flex justify-end bg-ink/40" onClick={onClose}>
      <div className="h-full w-full max-w-md overflow-auto bg-bone p-6" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
