"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { TvCard } from "@/lib/tv-board";
import {
  SLOT_LABEL_ES, SLOT_ICON, minutesUntilSlotStart, urgencyLevel, formatCountdown,
} from "@/lib/tv-slots";
import { useTvPolling } from "./useTvPolling";
import { useTvSound } from "./useTvSound";
import { paginate } from "./tv-detect";
import {
  POLL_INTERVAL_MS, PAGE_SIZE, PAGE_ROTATE_MS, NEW_FLASH_MS, CLOCK_TICK_MS,
} from "./tv-config";

const SOURCE: Record<string, { icon: string; label: string; color: string }> = {
  web: { icon: "🌐", label: "Web", color: "#C33E67" },
  phone: { icon: "📞", label: "Teléfono", color: "#3E77B0" },
  whatsapp: { icon: "💬", label: "WhatsApp", color: "#1FA855" },
  "walk-in": { icon: "🏬", label: "En tienda", color: "#9A7638" },
  event: { icon: "🎀", label: "Evento", color: "#9A63B8" },
};
const URGENCY_VAR: Record<string, string> = {
  red: "var(--color-error)", amber: "var(--color-warn)", green: "var(--color-success)",
};

function useNow(tickMs: number): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), tickMs);
    return () => clearInterval(t);
  }, [tickMs]);
  return now;
}

export default function TvBoard() {
  const now = useNow(CLOCK_TICK_MS);
  const { enabled, enable, chime } = useTvSound();
  const [flash, setFlash] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const pageJumpRef = useRef<string | null>(null);

  const { data, error } = useTvPolling(POLL_INTERVAL_MS, (ids) => {
    if (enabled) chime();
    setFlash((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
    ids.forEach((id) => setTimeout(() => {
      setFlash((prev) => { const n = new Set(prev); n.delete(id); return n; });
    }, NEW_FLASH_MS));
    pageJumpRef.current = ids[0] ?? null;
  });

  const todo = data?.todo ?? [];
  const pages = useMemo(() => paginate(todo, PAGE_SIZE), [todo]);

  // Jump to the page holding a newly-paid order.
  useEffect(() => {
    const id = pageJumpRef.current;
    if (!id) return;
    const idx = todo.findIndex((c) => c.orderId === id);
    if (idx >= 0) setPage(Math.floor(idx / PAGE_SIZE));
    pageJumpRef.current = null;
  }, [todo]);

  // Auto-rotate pages.
  useEffect(() => {
    if (pages.length <= 1) return;
    const t = setInterval(() => setPage((p) => (p + 1) % pages.length), PAGE_ROTATE_MS);
    return () => clearInterval(t);
  }, [pages.length]);

  const current = pages[Math.min(page, pages.length - 1)] ?? [];
  const clock = new Intl.DateTimeFormat("es-US", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/New_York" }).format(now);
  const dateStr = new Intl.DateTimeFormat("es-US", { weekday: "short", day: "numeric", month: "short", timeZone: "America/New_York" }).format(now);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-bone text-ink flex flex-col font-sans">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-4 border-b border-ink/10">
        <div>
          <h1 className="font-display text-4xl leading-none">
            Diva <span className="text-rouge">the Flowers</span>
          </h1>
          <p className="text-xs tracking-[0.25em] uppercase text-mute-400 mt-1">Producción de hoy</p>
        </div>
        <div className="flex items-center gap-8">
          <Counter n={todo.length} label="Por hacer" color="var(--color-rouge)" />
          <Counter n={data?.enRuta.length ?? 0} label="En ruta" color="var(--color-rouge-glow)" />
          <Counter n={data?.deliveredToday ?? 0} label="Entregadas" color="var(--color-success)" />
          <div className="text-right">
            <div className="text-3xl font-bold tabular-nums">{clock}</div>
            <div className="text-xs text-mute-400 capitalize">{dateStr}</div>
          </div>
          {error && <span className="text-xs text-mute-400">reconectando…</span>}
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 grid grid-cols-[1fr_320px] min-h-0">
        {/* Queue */}
        <section className="p-6 flex flex-col gap-3 min-h-0 overflow-hidden">
          <div className="flex items-center justify-between">
            <h2 className="text-sm tracking-widest uppercase text-mute-500">Por hacer · ordenadas por entrega</h2>
            <span className="text-sm text-mute-400">
              {todo.length} órdenes{pages.length > 1 ? ` · pág. ${(page % pages.length) + 1}/${pages.length}` : ""}
            </span>
          </div>
          {current.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-mute-400 text-2xl font-display">
              Sin órdenes por producir 🌿
            </div>
          ) : (
            current.map((c) => (
              <CardRow key={c.orderId} card={c} now={now} isNew={flash.has(c.orderId)} />
            ))
          )}
        </section>

        {/* Rail */}
        <aside className="border-l border-ink/10 bg-ink/[0.02] p-5 flex flex-col gap-5 min-h-0">
          <div>
            <h3 className="text-xs uppercase tracking-widest text-mute-400 mb-2 flex justify-between">
              En ruta <span className="text-rouge font-bold">{data?.enRuta.length ?? 0}</span>
            </h3>
            {(data?.enRuta ?? []).map((r) => (
              <div key={r.orderId} className="flex items-center gap-2 text-sm text-mute-600 py-1 border-b border-ink/5">
                <span className="h-2 w-2 rounded-full bg-rouge" />
                <span className="font-mono text-mute-400">#{r.orderNumber ?? "—"}</span>
                {r.zoneLabel ?? "Entrega"}
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-[color:var(--color-success)]/25 bg-[color:var(--color-success)]/[0.06] p-5 text-center">
            <div className="text-5xl font-extrabold text-[color:var(--color-success)] leading-none">{data?.deliveredToday ?? 0}</div>
            <div className="text-xs uppercase tracking-widest text-mute-400 mt-1">Entregadas hoy ✓</div>
          </div>
        </aside>
      </div>

      {/* Tomorrow strip */}
      <footer className="border-t border-ink/10 bg-ink/[0.02] px-8 py-2 flex items-center gap-4">
        <span className="text-xs uppercase tracking-widest text-mute-400">
          <b className="text-lilac">Mañana</b> · {data?.tomorrow.total ?? 0} órdenes
        </span>
        {(["morning", "midday", "afternoon", "evening"] as const).map((s) => (
          <span key={s} className="text-xs rounded-full bg-ink/5 px-3 py-1 text-mute-500">
            {SLOT_ICON[s]} {SLOT_LABEL_ES[s]} · {data?.tomorrow.bySlot[s] ?? 0}
          </span>
        ))}
      </footer>

      {/* Sound gate */}
      {!enabled && (
        <button
          onClick={enable}
          className="absolute inset-0 z-50 bg-ink/70 text-bone flex flex-col items-center justify-center gap-3"
        >
          <span className="text-5xl">🔔</span>
          <span className="font-display text-2xl">Toca para activar el sonido</span>
          <span className="text-sm text-bone/70">Necesario una vez al arrancar la pantalla</span>
        </button>
      )}
    </div>
  );
}

function Counter({ n, label, color }: { n: number; label: string; color: string }) {
  return (
    <div className="text-center min-w-16">
      <div className="text-4xl font-extrabold leading-none" style={{ color }}>{n}</div>
      <div className="text-[0.65rem] uppercase tracking-widest text-mute-400 mt-1">{label}</div>
    </div>
  );
}

function CardRow({ card, now, isNew }: { card: TvCard; now: Date; isNew: boolean }) {
  const mins = minutesUntilSlotStart(now, card.windowDate, card.slot);
  const urg = urgencyLevel(mins);
  const urgVar = URGENCY_VAR[urg];
  const src = SOURCE[card.source] ?? { icon: "•", label: card.source, color: "#6F685B" };
  return (
    <div
      className="grid grid-cols-[72px_1fr_auto] gap-4 items-center rounded-2xl border border-ink/5 bg-white px-4 py-2 shadow-[0_10px_30px_-18px_rgba(14,13,12,0.25)]"
      style={{ borderLeft: `6px solid ${urgVar}`, boxShadow: isNew ? `0 0 0 2px var(--color-rouge), 0 0 26px rgba(184,52,94,0.35)` : undefined }}
    >
      {card.thumb ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={card.thumb} alt="" className="h-[72px] w-[72px] rounded-xl object-cover" />
      ) : (
        <div className="h-[72px] w-[72px] rounded-xl border border-dashed border-rouge/40 text-rouge font-display flex flex-col items-center justify-center text-lg">
          DC<span className="text-[0.55rem] text-mute-400">sin foto</span>
        </div>
      )}
      <div className="min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-sm text-mute-400">#{card.orderNumber ?? "—"}</span>
          <span className="text-xl font-bold truncate">{card.productLabel}</span>
        </div>
        <div className="text-base text-mute-600">Para <b className="text-rouge">{card.recipientName}</b></div>
        <div className="flex flex-wrap gap-1.5 mt-1.5 text-xs">
          <span className="rounded-full px-2 py-0.5 border" style={{ color: src.color, borderColor: `${src.color}66`, background: `${src.color}22` }}>
            {src.icon} {src.label}
          </span>
          <span className="rounded-full px-2 py-0.5 bg-ink/5 text-mute-600">
            {card.fulfillmentStatus === "preparing" ? "● En preparación" : "Por empezar"}
          </span>
          <span className="rounded-full px-2 py-0.5 bg-ink/5 text-mute-600">
            {card.method === "pickup" ? "🛍 Recoge en tienda" : `🚚 ${card.zoneLabel ?? "Entrega"}`}
          </span>
          {card.hasCardMessage && <span className="rounded-full px-2 py-0.5 bg-ink/5 text-mute-600">💌 Con tarjeta</span>}
          {card.hasDesignerNotes && <span className="rounded-full px-2 py-0.5 bg-ink/5 text-mute-600">📝 Notas</span>}
        </div>
      </div>
      <div className="text-right min-w-24">
        <div className="text-4xl font-extrabold tabular-nums" style={{ color: urgVar }}>
          {mins < 0 ? "Vencida" : formatCountdown(mins)}
        </div>
        <div className="text-xs text-mute-400 mt-1 capitalize">hoy · {SLOT_LABEL_ES[card.slot]}</div>
      </div>
    </div>
  );
}
