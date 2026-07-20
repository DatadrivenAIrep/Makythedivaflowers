"use client";
import { useEffect, useRef, useState } from "react";
import type { TvBoardResponse } from "@/lib/tv-board";
import { newPaidIds } from "./tv-detect";

export function useTvPolling(intervalMs: number, onNewPaid?: (ids: string[]) => void) {
  const [data, setData] = useState<TvBoardResponse | null>(null);
  const [error, setError] = useState(false);
  const seenRef = useRef<Set<string>>(new Set());
  const primedRef = useRef(false);
  const onNewPaidRef = useRef(onNewPaid);
  onNewPaidRef.current = onNewPaid;

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
        setData(board);
        setError(false);
        if (fresh.length && onNewPaidRef.current) onNewPaidRef.current(fresh);
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
