"use client";
import { useEffect, useState } from "react";
import type { AttentionSnapshot } from "@/lib/attention";

/** Fired by the inbox after it marks a conversation read, so badges refresh at once. */
export const SMS_READ_EVENT = "diva:sms-read";

export function unreadSmsTotal(snapshot: AttentionSnapshot | null | undefined): number {
  return (snapshot?.items ?? []).reduce((n, i) => (i.kind === "sms" ? n + (i.count ?? 1) : n), 0);
}

/**
 * Unread customer SMS for the nav badge on pages that don't already poll the
 * attention snapshot. Pass `enabled: false` where the caller has the count.
 */
export function useUnreadSmsCount(enabled: boolean, intervalMs = 30_000): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    async function tick() {
      try {
        const res = await fetch("/api/admin/attention", { cache: "no-store" });
        if (!res.ok) return;
        const snap = (await res.json()) as AttentionSnapshot;
        if (!cancelled) setCount(unreadSmsTotal(snap));
      } catch {
        // offline or unauthenticated — keep the last count
      }
    }
    void tick();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void tick();
    }, intervalMs);
    const onRead = () => void tick();
    const onVisible = () => { if (document.visibilityState === "visible") void tick(); };
    window.addEventListener(SMS_READ_EVENT, onRead);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener(SMS_READ_EVENT, onRead);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled, intervalMs]);

  return count;
}
