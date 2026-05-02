// lib/conversion/use-cutoff.ts
"use client";
import { useEffect, useState } from "react";
import { snapshotCutoff } from "./cutoff";
import type { CutoffSnapshot } from "./types";

export function useCutoff(cutoff: string): CutoffSnapshot | null {
  const [snap, setSnap] = useState<CutoffSnapshot | null>(null);
  useEffect(() => {
    const tick = () => setSnap(snapshotCutoff(new Date(), cutoff));
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [cutoff]);
  return snap;
}
