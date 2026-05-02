// lib/conversion/types.ts
import type { Occasion } from "@/types/product";

export type CutoffStatus = "before" | "closing-soon" | "after";

export type CutoffSnapshot = {
  status: CutoffStatus;
  minutesRemaining: number;   // 0 when status === "after"
  cutoff: string;             // "HH:MM" — echoed back for trace
};

export type ReviewMatch = {
  matched: { id: string; author: string; quote: string; initials: string }[];
  aggregateRating: number;
  aggregateCount: number;     // global count (e.g. 127)
  matchedCount: number;       // count of reviews matching the occasion
  usedFallback: boolean;
  occasionLabelKey: Occasion | null;  // i18n key, not localized text
};

export type UpsellSuggestion = {
  productId: string;
  priceCents: number;
  title: string;              // already localized at component layer
};
