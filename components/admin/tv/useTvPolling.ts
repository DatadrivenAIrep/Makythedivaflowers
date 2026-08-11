"use client";
import { useEffect, useRef, useState } from "react";
import type { TvBoardResponse } from "@/lib/tv-board";
import type { AttentionItem } from "@/lib/attention";
import { newPaidIds, newIds } from "./tv-detect";

export function useTvPolling(
  intervalMs: number,
  onNewPaid?: (ids: string[]) => void,
  onNewAttention?: (items: AttentionItem[]) => void,
) {
  const [data, setData] = useState<TvBoardResponse | null>(null);
  const [error, setError] = useState(false);
  const seenRef = useRef<Set<string>>(new Set());
  const primedRef = useRef(false);
  const seenAttnRef = useRef<Set<string>>(new Set());
  const primedAttnRef = useRef(false);
  const onNewPaidRef = useRef(onNewPaid);
  onNewPaidRef.current = onNewPaid;
  const onNewAttentionRef = useRef(onNewAttention);
  onNewAttentionRef.current = onNewAttention;

  useEffect(() => {
    let cancelled = false;
    async function tick() {
      try {
        const res = await fetch("/api/admin/tv/board", { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const board = (await res.json()) as TvBoardResponse;
        if (cancelled) return;

        const events = board.paidEvents ?? [];
        const fresh = primedRef.current ? newPaidIds(events, seenRef.current) : [];
        for (const e of events) seenRef.current.add(e.orderId);
        primedRef.current = true;

        const attnItems = board.attention?.items ?? [];
        const freshAttnIds = primedAttnRef.current
          ? newIds(attnItems.map((i) => i.id), seenAttnRef.current)
          : [];
        for (const i of attnItems) seenAttnRef.current.add(i.id);
        primedAttnRef.current = true;

        setData(board);
        setError(false);
        if (fresh.length && onNewPaidRef.current) onNewPaidRef.current(fresh);
        if (freshAttnIds.length && onNewAttentionRef.current) {
          const freshSet = new Set(freshAttnIds);
          onNewAttentionRef.current(attnItems.filter((i) => freshSet.has(i.id)));
        }
      } catch {
        if (!cancelled) setError(true); // keep last-good data on screen
      }
    }
    void tick();
    const timer = setInterval(() => void tick(), intervalMs); // never pauses on hidden tab
    return () => { cancelled = true; clearInterval(timer); };
  }, [intervalMs]);

  return { data, error };
}
