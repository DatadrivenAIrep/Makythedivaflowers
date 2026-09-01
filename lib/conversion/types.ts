// lib/conversion/types.ts
export type CutoffStatus = "before" | "closing-soon" | "after";

export type CutoffSnapshot = {
  status: CutoffStatus;
  minutesRemaining: number;   // 0 when status === "after"
  cutoff: string;             // "HH:MM" — echoed back for trace
};

export type UpsellSuggestion = {
  productId: string;
  priceCents: number;
  title: string;              // already localized at component layer
};
