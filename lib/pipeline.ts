// Pure, DB-free pipeline logic: stage ordering, grouping, and estimated value.
// No server-only import — client components import these values/types directly.

export type InquiryType = "wedding" | "event";
export type Stage =
  | "nuevo" | "contactado" | "propuesta" | "reservado" | "completado" | "perdido";
export type BudgetBand = "5-10k" | "10-25k" | "25k+" | "open";

export const ACTIVE_STAGES: readonly Stage[] = [
  "nuevo", "contactado", "propuesta", "reservado", "completado",
];
export const OPEN_STAGES: readonly Stage[] = ["nuevo", "contactado", "propuesta", "reservado"];
export const ALL_STAGES: readonly Stage[] = [...ACTIVE_STAGES, "perdido"];

export function isValidStage(s: string): s is Stage {
  return (ALL_STAGES as readonly string[]).includes(s);
}

export function budgetBandFloorCents(band: string | null | undefined): number {
  switch (band) {
    case "5-10k": return 500_000;
    case "10-25k": return 1_000_000;
    case "25k+": return 2_500_000;
    default: return 0; // open / unknown
  }
}

export type PipelineInquiry = {
  id: string;
  type: InquiryType;
  stage: Stage;
  contactName: string;
  budgetBand?: BudgetBand;
  eventDate?: string;
  guests?: number;
  followUpDate?: string;
  acknowledgedAt?: string;
  createdAt: string;
};

export function groupByStage<T extends PipelineInquiry>(inquiries: T[]): Record<Stage, T[]> {
  const groups = Object.fromEntries(ALL_STAGES.map((s) => [s, [] as T[]])) as Record<Stage, T[]>;
  for (const i of inquiries) {
    if (groups[i.stage]) groups[i.stage].push(i);
  }
  const rank = (i: T) => i.followUpDate ?? "9999-99-99";
  for (const s of ALL_STAGES) {
    groups[s].sort((a, b) => rank(a).localeCompare(rank(b)) || a.createdAt.localeCompare(b.createdAt));
  }
  return groups;
}

export function stageCounts(inquiries: PipelineInquiry[]): Record<Stage, number> {
  const counts = Object.fromEntries(ALL_STAGES.map((s) => [s, 0])) as Record<Stage, number>;
  for (const i of inquiries) {
    if (counts[i.stage] !== undefined) counts[i.stage] += 1;
  }
  return counts;
}

export function openPipelineValueCents(inquiries: PipelineInquiry[]): number {
  return inquiries
    .filter((i) => (OPEN_STAGES as readonly string[]).includes(i.stage))
    .reduce((sum, i) => sum + budgetBandFloorCents(i.budgetBand), 0);
}
