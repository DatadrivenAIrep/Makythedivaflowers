"use client";
import { useEffect, useRef, useState } from "react";
import type { AttentionSnapshot } from "@/lib/attention";

type PendingItem = { orderId: string; reason: string; order: unknown };
type QueueResp = { items: PendingItem[]; generatedAt: string };
type FeedEvent = { kind: string; orderId: string; at: string; label: string; source: string; totalCents: number; recipientName: string };
type FeedResp = { events: FeedEvent[] };

export type DashboardPollingOptions = {
  intervalMs?: number;
  onNewItem?: (newIds: string[]) => void;
};

export type DashboardPollingState = {
  queue: PendingItem[];
  feed: FeedEvent[];
  attention: AttentionSnapshot | null;
  lastUpdated: string | null;
  error: boolean;
  refresh: () => Promise<void>;
};

export function useDashboardPolling(opts: DashboardPollingOptions = {}): DashboardPollingState {
  const intervalMs = opts.intervalMs ?? 20_000;
  const [queue, setQueue] = useState<PendingItem[]>([]);
  const [feed, setFeed] = useState<FeedEvent[]>([]);
  const [attention, setAttention] = useState<AttentionSnapshot | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const primedRef = useRef(false);
  const onNewItemRef = useRef(opts.onNewItem);
  onNewItemRef.current = opts.onNewItem;

  async function tick() {
    try {
      const [qRes, fRes, aRes] = await Promise.all([
        fetch("/api/admin/orders/queue", { cache: "no-store" }),
        fetch("/api/admin/orders/feed", { cache: "no-store" }),
        fetch("/api/admin/attention", { cache: "no-store" }),
      ]);
      if (!qRes.ok || !fRes.ok || !aRes.ok) {
        throw new Error(`poll failed: queue ${qRes.status}, feed ${fRes.status}, attention ${aRes.status}`);
      }
      const q = (await qRes.json()) as QueueResp;
      const f = (await fRes.json()) as FeedResp;
      const a = (await aRes.json()) as AttentionSnapshot;
      const previous = seenIdsRef.current;
      const currentIds = new Set(a.items.map((i) => i.id));
      const newIds: string[] = [];
      if (primedRef.current) {
        for (const id of currentIds) if (!previous.has(id)) newIds.push(id);
      }
      primedRef.current = true;
      seenIdsRef.current = currentIds;
      setQueue(q.items);
      setFeed(f.events);
      setAttention(a);
      setLastUpdated(new Date().toISOString());
      setError(false);
      if (newIds.length > 0 && onNewItemRef.current) onNewItemRef.current(newIds);
    } catch {
      setError(true); // surface to UI; keeps last good data on screen
    }
  }

  useEffect(() => {
    void tick();
    let timer: ReturnType<typeof setInterval> | null = null;
    function start() {
      if (timer) return;
      timer = setInterval(() => { void tick(); }, intervalMs);
    }
    function stop() {
      if (timer) { clearInterval(timer); timer = null; }
    }
    function onVisibility() {
      if (document.visibilityState === "visible") { void tick(); start(); }
      else stop();
    }
    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => { stop(); document.removeEventListener("visibilitychange", onVisibility); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs]);

  return { queue, feed, attention, lastUpdated, error, refresh: tick };
}
