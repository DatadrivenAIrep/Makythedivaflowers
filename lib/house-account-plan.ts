// Pure: cadence arithmetic and the per-account send plan. No DB, no I/O.
import { addDaysStr, dayDiff } from "@/lib/tv-slots";
import type { AccountCadence, ReminderStep, SendChannel } from "@/types/house-account";

export type PlanDefaults = {
  cadence: AccountCadence;
  issueDay: number;
  termsDays: number;
  reminderPlan: ReminderStep[];
  statementChannel: SendChannel;
};

export const SETTING_HOUSE_ACCOUNT_DEFAULTS = "house_account_defaults";

export const DEFAULT_PLAN: PlanDefaults = {
  cadence: "monthly",
  issueDay: 1,
  termsDays: 15,
  reminderPlan: [
    { offsetDays: -3, channel: "sms" },
    { offsetDays: 0, channel: "sms" },
    { offsetDays: 7, channel: "both" },
  ],
  statementChannel: "both",
};

const CADENCES = new Set<string>(["weekly", "biweekly", "monthly"]);
const CHANNELS = new Set<string>(["sms", "email", "both"]);

export function isCadence(v: unknown): v is AccountCadence { return typeof v === "string" && CADENCES.has(v); }
export function isChannel(v: unknown): v is SendChannel { return typeof v === "string" && CHANNELS.has(v); }

export function parseReminderPlan(json: string | null): ReminderStep[] {
  if (!json) return [];
  let raw: unknown;
  try { raw = JSON.parse(json); } catch { return []; }
  if (!Array.isArray(raw)) return [];
  const out: ReminderStep[] = [];
  for (const s of raw) {
    if (!s || typeof s !== "object") continue;
    const { offsetDays, channel } = s as { offsetDays?: unknown; channel?: unknown };
    if (!Number.isInteger(offsetDays) || !isChannel(channel)) continue;
    out.push({ offsetDays: offsetDays as number, channel });
  }
  return out;
}

/** Merge a `house_account_defaults` settings row over DEFAULT_PLAN, field by field. */
export function resolveDefaults(json: string | null): PlanDefaults {
  if (!json) return DEFAULT_PLAN;
  let raw: Record<string, unknown>;
  try {
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return DEFAULT_PLAN;
    raw = parsed as Record<string, unknown>;
  } catch { return DEFAULT_PLAN; }
  const out: PlanDefaults = { ...DEFAULT_PLAN, reminderPlan: [...DEFAULT_PLAN.reminderPlan] };
  if (isCadence(raw.cadence)) out.cadence = raw.cadence;
  if (Number.isInteger(raw.issueDay)) out.issueDay = raw.issueDay as number;
  if (Number.isInteger(raw.termsDays) && (raw.termsDays as number) >= 0) out.termsDays = raw.termsDays as number;
  if (isChannel(raw.statementChannel)) out.statementChannel = raw.statementChannel;
  if (Array.isArray(raw.reminderPlan)) out.reminderPlan = parseReminderPlan(JSON.stringify(raw.reminderPlan));
  return out;
}

function pad2(n: number): string { return String(n).padStart(2, "0"); }

/** 0 = Sunday … 6 = Saturday, for a bare YYYY-MM-DD (noon-anchored UTC, no DST drift). */
export function weekdayOf(ymd: string): number {
  return new Date(`${ymd}T12:00:00Z`).getUTCDay();
}

/** The next date (today included) whose weekday is `issueDay`. */
export function anchorFor(issueDay: number, today: string): string {
  const delta = (issueDay - weekdayOf(today) + 7) % 7;
  return addDaysStr(today, delta);
}

type CadenceInput = { cadence: AccountCadence; issueDay: number; anchorDate?: string };

export function isIssueDay(a: CadenceInput, today: string): boolean {
  switch (a.cadence) {
    case "monthly":
      return Number(today.slice(8, 10)) === a.issueDay;
    case "weekly":
      return weekdayOf(today) === a.issueDay;
    case "biweekly": {
      const anchor = a.anchorDate ?? anchorFor(a.issueDay, today);
      if (today < anchor) return false;
      return dayDiff(anchor, today) % 14 === 0;
    }
  }
}

/** First issue date on or after `from`. */
export function nextIssueDate(a: CadenceInput, from: string): string {
  switch (a.cadence) {
    case "monthly": {
      const y = Number(from.slice(0, 4));
      const m = Number(from.slice(5, 7));
      const d = Number(from.slice(8, 10));
      if (d <= a.issueDay) return `${y}-${pad2(m)}-${pad2(a.issueDay)}`;
      const ny = m === 12 ? y + 1 : y;
      const nm = m === 12 ? 1 : m + 1;
      return `${ny}-${pad2(nm)}-${pad2(a.issueDay)}`;
    }
    case "weekly":
      return anchorFor(a.issueDay, from);
    case "biweekly": {
      const anchor = a.anchorDate ?? anchorFor(a.issueDay, from);
      if (from <= anchor) return anchor;
      const k = Math.ceil(dayDiff(anchor, from) / 14);
      return addDaysStr(anchor, k * 14);
    }
  }
}

export type PlannedSend = {
  kind: "statement" | "reminder";
  stepIndex?: number;
  channel: SendChannel;
  scheduledFor: string;
};

/**
 * The queue rows for a freshly issued statement: the statement itself today,
 * then one reminder per plan step relative to the due date. Steps that land
 * on or before today are dropped — the statement send already covers today.
 */
export function scheduleFromPlan(args: {
  today: string;
  dueDate: string;
  statementChannel: SendChannel;
  reminderPlan: ReminderStep[];
}): PlannedSend[] {
  const rows: PlannedSend[] = [{ kind: "statement", channel: args.statementChannel, scheduledFor: args.today }];
  args.reminderPlan.forEach((step, i) => {
    const when = addDaysStr(args.dueDate, step.offsetDays);
    if (when <= args.today) return;
    rows.push({ kind: "reminder", stepIndex: i, channel: step.channel, scheduledFor: when });
  });
  return rows;
}
