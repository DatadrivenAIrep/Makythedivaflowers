"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { GiftCard, GiftCardRedemption } from "@/types/gift-card";

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function GiftCardDetail({ id, onChanged }: { id: string; onChanged: () => void }) {
  const t = useTranslations("admin_gift_cards");
  const [card, setCard] = useState<GiftCard | null>(null);
  const [history, setHistory] = useState<GiftCardRedemption[]>([]);

  useEffect(() => {
    fetch(`/api/admin/gift-cards/${id}`)
      .then((r) => r.json())
      .then((d) => {
        setCard(d.card);
        setHistory(d.redemptions ?? []);
      });
  }, [id]);

  if (!card) return null;

  async function voidCard() {
    await fetch(`/api/admin/gift-cards/${id}/void`, { method: "POST" });
    onChanged();
  }
  async function resend() {
    await fetch(`/api/admin/gift-cards/${id}/resend`, { method: "POST" });
  }
  function copy() {
    void navigator.clipboard?.writeText(card!.code);
  }

  return (
    <div className="space-y-4">
      <div className="font-mono text-lg font-bold text-rouge">{card.code}</div>
      <div className="text-sm">
        {card.recipientName ? `${card.recipientName} · ` : ""}
        {card.recipientEmail}
      </div>
      <div className="text-sm">{money(card.balanceCents)} / {money(card.initialCents)}</div>

      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase opacity-60">{t("detail_history")}</h4>
        <ul className="space-y-1 text-sm">
          {history.map((h) => (
            <li key={h.id} className="flex justify-between">
              <span>{h.type === "refund" ? "↩︎" : "→"} {h.orderId ?? "—"}</span>
              <span>{money(Math.abs(h.amountCents))}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex gap-2">
        <button onClick={resend} className="rounded-lg border border-ink/20 px-3 py-2 text-sm">{t("detail_resend")}</button>
        <button onClick={copy} className="rounded-lg border border-ink/20 px-3 py-2 text-sm">{t("detail_copy")}</button>
        {card.status !== "void" && (
          <button onClick={voidCard} className="rounded-lg border border-rouge px-3 py-2 text-sm text-rouge">{t("detail_void")}</button>
        )}
      </div>
    </div>
  );
}
