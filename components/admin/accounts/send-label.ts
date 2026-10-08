import { dayDiff } from "@/lib/tv-slots";
import type { SendKind } from "@/types/house-account";

export type Translate = (key: string, values?: Record<string, number | string>) => string;
export type ReminderWhen = "before" | "on" | "after";
export type ReminderRow = { when: ReminderWhen; days: number };

/** Plan offset (negative = before the due date) -> editor row. */
export function offsetToRow(offsetDays: number): ReminderRow {
  if (offsetDays < 0) return { when: "before", days: -offsetDays };
  if (offsetDays === 0) return { when: "on", days: 0 };
  return { when: "after", days: offsetDays };
}

/** Editor row -> plan offset; keeps the stored plan format unchanged. */
export function rowToOffset(row: ReminderRow): number {
  const n = Math.max(0, Math.round(row.days) || 0);
  if (row.when === "on") return 0;
  return row.when === "before" ? -n : n;
}

/** Human label for a queue row. Reminders read relative to the statement's due date. */
export function sendLabel(kind: SendKind, scheduledFor: string, dueDate: string | undefined, t: Translate): string {
  if (kind === "statement") return t("send_label_statement");
  if (kind === "manual") return t("send_label_manual");
  if (!dueDate) return t("kind_reminder");
  const offset = dayDiff(dueDate, scheduledFor);
  if (offset === 0) return t("send_label_reminder_on");
  return offset < 0
    ? t("send_label_reminder_before", { count: -offset })
    : t("send_label_reminder_after", { count: offset });
}
