import "server-only";
import { getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import {
  isValidStage,
  type BudgetBand,
  type InquiryType,
  type Stage,
} from "@/lib/pipeline";

export type Inquiry = {
  id: string;
  type: InquiryType;
  stage: Stage;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  budgetBand?: BudgetBand;
  eventDate?: string;
  venue?: string;
  guests?: number;
  company?: string;
  frequency?: string;
  vibe?: string;
  notes?: string;
  followUpDate?: string;
  lostReason?: string;
  sourceChannel: "web" | "manual";
  locale?: string;
  acknowledgedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type InquiryChange = {
  id: string;
  inquiryId: string;
  at: string;
  actor: string;
  kind: string;
  summary: string;
};

export type CreateInquiryInput = {
  id?: string;
  type: InquiryType;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  budgetBand?: BudgetBand;
  eventDate?: string;
  venue?: string;
  guests?: number;
  company?: string;
  frequency?: string;
  vibe?: string;
  notes?: string;
  sourceChannel: "web" | "manual";
  locale?: string;
  createdAt?: string;
};

const STAGE_LABELS_ES: Record<Stage, string> = {
  nuevo: "Nuevo",
  contactado: "Contactado",
  propuesta: "Propuesta",
  reservado: "Reservado",
  completado: "Completado",
  perdido: "Perdido",
};

type Row = {
  id: string; type: string; stage: string; contact_name: string; contact_email: string;
  contact_phone: string; budget_band: string | null; event_date: string | null; venue: string | null;
  guests: number | null; company: string | null; frequency: string | null; vibe: string | null;
  notes: string | null; follow_up_date: string | null; lost_reason: string | null;
  source_channel: string; locale: string | null; acknowledged_at: string | null;
  created_at: string; updated_at: string;
};

function rowToInquiry(r: Row): Inquiry {
  return {
    id: r.id,
    type: r.type as InquiryType,
    stage: r.stage as Stage,
    contactName: r.contact_name,
    contactEmail: r.contact_email,
    contactPhone: r.contact_phone,
    budgetBand: (r.budget_band as BudgetBand | null) ?? undefined,
    eventDate: r.event_date ?? undefined,
    venue: r.venue ?? undefined,
    guests: r.guests ?? undefined,
    company: r.company ?? undefined,
    frequency: r.frequency ?? undefined,
    vibe: r.vibe ?? undefined,
    notes: r.notes ?? undefined,
    followUpDate: r.follow_up_date ?? undefined,
    lostReason: r.lost_reason ?? undefined,
    sourceChannel: r.source_channel as "web" | "manual",
    locale: r.locale ?? undefined,
    acknowledgedAt: r.acknowledged_at ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function newInquiryId(): string {
  return `iq_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
function newChangeId(): string {
  return `ic_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function recordChange(inquiryId: string, actor: string, kind: string, summary: string, now: Date): void {
  getDb()
    .prepare("INSERT INTO inquiry_changes (id, inquiry_id, at, actor, kind, summary) VALUES (?, ?, ?, ?, ?, ?)")
    .run(newChangeId(), inquiryId, now.toISOString(), actor, kind, summary);
}

function getRow(id: string): Row | undefined {
  return getDb().prepare("SELECT * FROM inquiries WHERE id = ?").get(id) as Row | undefined;
}

export function createInquiry(input: CreateInquiryInput, now: Date = new Date(), actor = "maky"): Inquiry {
  runMigrations();
  const db = getDb();
  const id = input.id ?? newInquiryId();
  const at = input.createdAt ?? now.toISOString();
  db.prepare(
    `INSERT INTO inquiries (id, type, stage, contact_name, contact_email, contact_phone,
       budget_band, event_date, venue, guests, company, frequency, vibe, notes,
       follow_up_date, lost_reason, source_channel, locale, acknowledged_at, created_at, updated_at)
     VALUES (?, ?, 'nuevo', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, NULL, ?, ?)`,
  ).run(
    id, input.type, input.contactName, input.contactEmail, input.contactPhone,
    input.budgetBand ?? null, input.eventDate ?? null, input.venue ?? null, input.guests ?? null,
    input.company ?? null, input.frequency ?? null, input.vibe ?? null, input.notes ?? null,
    input.sourceChannel, input.locale ?? null, at, at,
  );
  recordChange(id, actor, "created", `Lead creado · ${input.sourceChannel === "web" ? "web" : "manual"}`, now);
  return rowToInquiry(getRow(id)!);
}

export function listInquiries(): Inquiry[] {
  runMigrations();
  const rows = getDb().prepare("SELECT * FROM inquiries ORDER BY created_at DESC").all() as Row[];
  return rows.map(rowToInquiry);
}

export type InquiryDetail = { inquiry: Inquiry; changes: InquiryChange[] };

export function getInquiry(id: string): InquiryDetail | null {
  runMigrations();
  const row = getRow(id);
  if (!row) return null;
  const changes = getDb()
    .prepare("SELECT * FROM inquiry_changes WHERE inquiry_id = ? ORDER BY at ASC")
    .all(id)
    .map((c) => {
      const r = c as { id: string; inquiry_id: string; at: string; actor: string; kind: string; summary: string };
      return { id: r.id, inquiryId: r.inquiry_id, at: r.at, actor: r.actor, kind: r.kind, summary: r.summary };
    });
  return { inquiry: rowToInquiry(row), changes };
}

function touch(id: string, now: Date): void {
  getDb().prepare("UPDATE inquiries SET updated_at = ? WHERE id = ?").run(now.toISOString(), id);
}

export function changeStage(id: string, stage: string, actor: string, now: Date = new Date()): InquiryDetail | null {
  runMigrations();
  const row = getRow(id);
  if (!row) return null;
  if (!isValidStage(stage)) return null;
  getDb().prepare("UPDATE inquiries SET stage = ? WHERE id = ?").run(stage, id);
  touch(id, now);
  recordChange(id, actor, "stage",
    `Etapa: ${STAGE_LABELS_ES[row.stage as Stage]} → ${STAGE_LABELS_ES[stage as Stage]}`, now);
  return getInquiry(id);
}

export function updateNotes(id: string, notes: string, actor: string, now: Date = new Date()): InquiryDetail | null {
  runMigrations();
  const row = getRow(id);
  if (!row) return null;
  const next = notes || null;
  if (next === (row.notes ?? null)) return getInquiry(id); // no-op: don't touch or log
  getDb().prepare("UPDATE inquiries SET notes = ? WHERE id = ?").run(next, id);
  touch(id, now);
  recordChange(id, actor, "note", "Notas actualizadas", now);
  return getInquiry(id);
}

export function setFollowUp(id: string, date: string, actor: string, now: Date = new Date()): InquiryDetail | null {
  runMigrations();
  const row = getRow(id);
  if (!row) return null;
  const next = date || null;
  if (next === (row.follow_up_date ?? null)) return getInquiry(id); // no-op: don't touch or log
  getDb().prepare("UPDATE inquiries SET follow_up_date = ? WHERE id = ?").run(next, id);
  touch(id, now);
  recordChange(id, actor, "followup", next ? `Seguimiento: ${next}` : "Seguimiento quitado", now);
  return getInquiry(id);
}

export function markLost(id: string, reason: string, actor: string, now: Date = new Date()): InquiryDetail | null {
  runMigrations();
  if (!getRow(id)) return null;
  getDb().prepare("UPDATE inquiries SET stage = 'perdido', lost_reason = ? WHERE id = ?").run(reason || null, id);
  touch(id, now);
  recordChange(id, actor, "lost", reason ? `Perdido · ${reason}` : "Perdido", now);
  return getInquiry(id);
}

export function acknowledge(id: string, now: Date = new Date()): InquiryDetail | null {
  runMigrations();
  const row = getRow(id);
  if (!row) return null;
  if (!row.acknowledged_at) {
    getDb().prepare("UPDATE inquiries SET acknowledged_at = ? WHERE id = ?").run(now.toISOString(), id);
  }
  return getInquiry(id);
}
