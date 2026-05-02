// lib/conversion/cutoff.ts
import { parseCutoff } from "@/lib/delivery";
import type { CutoffSnapshot, CutoffStatus } from "./types";

const CLOSING_SOON_MIN = 30;

export function snapshotCutoff(now: Date, cutoff: string): CutoffSnapshot {
  const { hour, minute } = parseCutoff(cutoff);
  const c = new Date(now);
  c.setHours(hour, minute, 0, 0);
  const diffMin = Math.floor((c.getTime() - now.getTime()) / 60000);
  let status: CutoffStatus;
  if (diffMin <= 0) status = "after";
  else if (diffMin <= CLOSING_SOON_MIN) status = "closing-soon";
  else status = "before";
  return {
    status,
    minutesRemaining: Math.max(0, diffMin),
    cutoff,
  };
}
