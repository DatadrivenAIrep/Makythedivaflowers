import "server-only";
import type { DraftPayload, OrderDraft, OrderDraftDetail } from "@/types/draft";

export type DraftRow = {
  id: string;
  label: string;
  payload_json: string;
  item_count: number;
  total_cents: number;
  taken_by: string | null;
  created_at: string;
  updated_at: string;
};

export type DraftInput = {
  id: string;
  label: string;
  payload: DraftPayload;
  itemCount: number;
  totalCents: number;
  takenBy?: string;
  createdAt: string;
  updatedAt: string;
};

export function draftToRow(d: DraftInput): DraftRow {
  return {
    id: d.id,
    label: d.label,
    payload_json: JSON.stringify(d.payload),
    item_count: d.itemCount,
    total_cents: d.totalCents,
    taken_by: d.takenBy ?? null,
    created_at: d.createdAt,
    updated_at: d.updatedAt,
  };
}

export function rowToDraft(r: DraftRow): OrderDraft {
  return {
    id: r.id,
    label: r.label,
    itemCount: r.item_count,
    totalCents: r.total_cents,
    takenBy: r.taken_by ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function rowToDraftDetail(r: DraftRow): OrderDraftDetail {
  return {
    ...rowToDraft(r),
    payload: JSON.parse(r.payload_json) as DraftPayload,
  };
}
