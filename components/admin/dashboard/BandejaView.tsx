"use client";
import { useCallback, useRef, useState } from "react";
import DashboardShell from "./DashboardShell";
import PendingCard, { type PendingReason, type PendingActionId } from "./PendingCard";
import { useDashboardPolling } from "./useDashboardPolling";
import type { Order } from "@/types/order";

function isIpadLike(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iPad|iPhone|Macintosh.*Touch/i.test(ua) && "ontouchend" in document;
}

function timeOf(ts: string): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function BandejaView({ locale }: { locale: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUnlockedRef = useRef(false);
  const [drawerOrderId, setDrawerOrderId] = useState<string | null>(null);

  function playChime() {
    if (!isIpadLike()) return; // sound only on iPad
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

  const onNewOrder = useCallback((ids: string[]) => {
    playChime();
    flashTitle(ids.length);
  }, []);

  const { queue, feed, lastUpdated, refresh } = useDashboardPolling({ onNewOrder });

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
        <section className="mb-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink/60">
            Pendientes · {queue.length}
          </h2>
          {queue.length === 0 ? (
            <p className="rounded border border-ink/10 bg-bone p-4 text-sm text-ink/60">✓ Todo al día</p>
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
            Feed · {feed.length} eventos
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
            {feed.length === 0 && <li className="px-3 py-2 text-sm text-ink/50">Sin actividad reciente.</li>}
          </ul>
        </section>

        {drawerOrderId && (
          <OrderDetailDrawerStub orderId={drawerOrderId} onClose={() => setDrawerOrderId(null)} />
        )}
      </DashboardShell>
    </div>
  );
}

function OrderDetailDrawerStub({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-20 flex" onClick={onClose}>
      <div className="ml-auto h-full w-full max-w-xl bg-bone p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <p className="text-sm">Detalle de {orderId} — se completa en Task 23.</p>
        <button className="mt-2 rounded border border-ink/20 px-3 py-1 text-sm" onClick={onClose}>Cerrar</button>
      </div>
    </div>
  );
}
