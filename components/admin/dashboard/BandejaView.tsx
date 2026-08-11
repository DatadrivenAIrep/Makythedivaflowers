"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { WarningCircle, CheckCircle } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";
import DashboardShell from "./DashboardShell";
import OrderDetailDrawer from "./OrderDetailDrawer";
import PendingCard, { type PendingReason, type PendingActionId } from "./PendingCard";
import AdminButton from "./AdminButton";
import AttentionDrawer from "./AttentionDrawer";
import { useDashboardPolling } from "./useDashboardPolling";
import type { Order } from "@/types/order";

function timeOf(ts: string): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function BandejaView({ locale }: { locale: string }) {
  const t = useTranslations("admin_dashboard");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUnlockedRef = useRef(false);
  const [drawerOrderId, setDrawerOrderId] = useState<string | null>(null);
  const [attnId, setAttnId] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(false);
  mutedRef.current = muted;

  useEffect(() => { setMuted(localStorage.getItem("diva_dashboard_muted") === "1"); }, []);

  function toggleMute() {
    setMuted((m) => {
      const next = !m;
      localStorage.setItem("diva_dashboard_muted", next ? "1" : "0");
      return next;
    });
  }

  function playChime() {
    if (mutedRef.current) return;
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = 0;
    a.play().catch(() => {});
  }

  function flashTitle(count: number) {
    const original = document.title;
    let on = true;
    let ticks = 0;
    const interval = setInterval(() => {
      document.title = on ? `(${count}) Diva · Bandeja` : original;
      on = !on;
      if (++ticks >= 10) { clearInterval(interval); document.title = original; }
    }, 500);
  }

  const onNewItem = useCallback((ids: string[]) => {
    playChime();
    flashTitle(ids.length);
  }, []);

  const { queue, feed, attention, lastUpdated, error, refresh } = useDashboardPolling({ onNewItem });
  const newRequests = (attention?.items ?? []).filter((item) => item.kind !== "order");

  function unlockAudio() {
    if (audioUnlockedRef.current) return;
    const a = audioRef.current;
    if (!a) return;
    const wasMuted = a.muted;
    a.muted = true;
    a.play().then(() => { a.pause(); a.muted = wasMuted; audioUnlockedRef.current = true; }).catch(() => {});
  }

  async function onAction(orderId: string, action: PendingActionId) {
    switch (action) {
      case "open": setDrawerOrderId(orderId); return;
      case "whatsapp": {
        const order = queue.find((q) => q.orderId === orderId)?.order as Order | undefined;
        const phone = order?.contact.phone.replace(/\D/g, "") ?? "";
        window.open(`https://wa.me/${phone}`, "_blank"); return;
      }
      case "call": {
        const order = queue.find((q) => q.orderId === orderId)?.order as Order | undefined;
        window.location.href = `tel:${order?.contact.phone}`; return;
      }
      case "resend_link":
        await fetch(`/api/admin/orders/${orderId}/resend`, {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ kind: "payment_link" }),
        });
        await refresh(); return;
      case "mark_paid":
        await fetch(`/api/admin/orders/${orderId}/payment`, {
          method: "PATCH", headers: { "content-type": "application/json" },
          body: JSON.stringify({ method: "cash" }), // default; drawer can offer a picker later
        });
        await refresh(); return;
      case "advance_preparing":
      case "advance_out":
      case "advance_delivered": {
        const status = action === "advance_preparing" ? "preparing"
          : action === "advance_out" ? "out-for-delivery" : "delivered";
        await fetch(`/api/admin/orders/${orderId}/fulfillment`, {
          method: "PATCH", headers: { "content-type": "application/json" },
          body: JSON.stringify({ status }),
        });
        await refresh(); return;
      }
    }
  }

  return (
    <div onPointerDown={unlockAudio}>
      <audio ref={audioRef} src="/sounds/new-order.mp3" preload="auto" />
      <DashboardShell
        locale={locale}
        lastUpdated={lastUpdated ? timeOf(lastUpdated) : undefined}
        onRefresh={() => { void refresh(); }}
      >
        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
            <WarningCircle size={18} weight="fill" />
            <span>{t("offline_notice")}</span>
            <AdminButton variant="danger" className="ml-auto" onClick={() => { void refresh(); }}>{t("retry")}</AdminButton>
          </div>
        )}
        <section className="mb-6">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-ink/60">
            {t("new_requests")} · {newRequests.length}
            <button
              type="button"
              onClick={toggleMute}
              title={muted ? t("unmute") : t("mute")}
              className="ml-auto text-base"
            >
              {muted ? "🔇" : "🔔"}
            </button>
          </h2>
          {newRequests.length === 0 ? (
            <p className="rounded-lg border border-ink/10 bg-bone p-4 text-sm text-ink/60">
              {t("no_new_requests")}
            </p>
          ) : (
            <ul className="space-y-2">
              {newRequests.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setAttnId(item.id)}
                    className="w-full rounded-lg border border-ink/10 bg-white p-3 text-left text-sm hover:bg-ink/5"
                  >
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mb-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink/60">
            {t("pending")} · {queue.length}
          </h2>
          {queue.length === 0 ? (
            <p className="flex items-center gap-1.5 rounded-lg border border-ink/10 bg-bone p-4 text-sm text-ink/60">
              <CheckCircle size={18} weight="fill" className="text-success" /> {t("all_caught_up")}
            </p>
          ) : (
            <ul className="space-y-2">
              {queue.map((item) => (
                <li key={item.orderId}>
                  <PendingCard
                    order={item.order as Order}
                    reason={item.reason as PendingReason}
                    onOpen={(id) => setDrawerOrderId(id)}
                    onAction={onAction}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink/60">
            {t("feed")} · {feed.length} {t("events")}
          </h2>
          <ul className="divide-y divide-ink/5 rounded border border-ink/10 bg-bone">
            {feed.map((e, i) => (
              <li
                key={`${e.orderId}-${e.kind}-${i}`}
                className="cursor-pointer px-3 py-2 text-sm hover:bg-ink/5"
                onClick={() => setDrawerOrderId(e.orderId)}
              >
                <span className="text-ink/60">{timeOf(e.at)}</span> — {e.label}
              </li>
            ))}
            {feed.length === 0 && <li className="px-3 py-2 text-sm text-ink/50">{t("no_recent_activity")}</li>}
          </ul>
        </section>

        {drawerOrderId && (
          <OrderDetailDrawer
            orderId={drawerOrderId}
            onClose={() => setDrawerOrderId(null)}
            onChanged={() => { void refresh(); }}
          />
        )}
        {attnId && (
          <AttentionDrawer id={attnId} onClose={() => { setAttnId(null); void refresh(); }} />
        )}
      </DashboardShell>
    </div>
  );
}
