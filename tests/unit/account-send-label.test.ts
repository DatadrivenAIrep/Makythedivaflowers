import { describe, it, expect } from "vitest";
import { sendLabel, offsetToRow, rowToOffset } from "@/components/admin/accounts/send-label";

const t = (key: string, values?: Record<string, number | string>) => (values ? `${key}:${values.count}` : key);

describe("sendLabel", () => {
  it("labels statements and manual sends", () => {
    expect(sendLabel("statement", "2026-10-01", "2026-10-16", t)).toBe("send_label_statement");
    expect(sendLabel("manual", "2026-10-01", "2026-10-16", t)).toBe("send_label_manual");
  });
  it("labels reminders relative to the due date", () => {
    expect(sendLabel("reminder", "2026-10-13", "2026-10-16", t)).toBe("send_label_reminder_before:3");
    expect(sendLabel("reminder", "2026-10-15", "2026-10-16", t)).toBe("send_label_reminder_before:1");
    expect(sendLabel("reminder", "2026-10-16", "2026-10-16", t)).toBe("send_label_reminder_on");
    expect(sendLabel("reminder", "2026-10-23", "2026-10-16", t)).toBe("send_label_reminder_after:7");
  });
  it("falls back to the generic reminder name without a due date", () => {
    expect(sendLabel("reminder", "2026-10-13", undefined, t)).toBe("kind_reminder");
  });
});

describe("reminder row mapping", () => {
  it("maps offsets to rows", () => {
    expect(offsetToRow(-3)).toEqual({ when: "before", days: 3 });
    expect(offsetToRow(0)).toEqual({ when: "on", days: 0 });
    expect(offsetToRow(7)).toEqual({ when: "after", days: 7 });
  });
  it("maps rows to offsets", () => {
    expect(rowToOffset({ when: "before", days: 3 })).toBe(-3);
    expect(rowToOffset({ when: "on", days: 9 })).toBe(0);
    expect(rowToOffset({ when: "after", days: 7 })).toBe(7);
    expect(rowToOffset({ when: "before", days: 1 })).toBe(-1);
  });
  it("round-trips -3, 0 and 7", () => {
    for (const n of [-3, 0, 7]) expect(rowToOffset(offsetToRow(n))).toBe(n);
  });
});
