import { describe, it, expect } from "vitest";
import {
  DEFAULT_PLAN, resolveDefaults, parseReminderPlan, weekdayOf, anchorFor,
  isIssueDay, nextIssueDate, scheduleFromPlan,
} from "@/lib/house-account-plan";

describe("defaults", () => {
  it("falls back to DEFAULT_PLAN on null or garbage", () => {
    expect(resolveDefaults(null)).toEqual(DEFAULT_PLAN);
    expect(resolveDefaults("{not json")).toEqual(DEFAULT_PLAN);
    expect(resolveDefaults('{"termsDays":"x","cadence":"daily"}')).toEqual(DEFAULT_PLAN);
  });
  it("merges valid overrides", () => {
    const d = resolveDefaults('{"termsDays":30,"cadence":"weekly","issueDay":1}');
    expect(d.termsDays).toBe(30);
    expect(d.cadence).toBe("weekly");
    expect(d.reminderPlan).toEqual(DEFAULT_PLAN.reminderPlan);
  });
  it("parses a reminder plan and drops invalid steps", () => {
    expect(parseReminderPlan('[{"offsetDays":-3,"channel":"sms"},{"offsetDays":"a","channel":"sms"},{"offsetDays":7,"channel":"fax"}]'))
      .toEqual([{ offsetDays: -3, channel: "sms" }]);
    expect(parseReminderPlan(null)).toEqual([]);
  });
});

describe("issue days", () => {
  it("weekdayOf: 2026-10-04 is a Sunday", () => {
    expect(weekdayOf("2026-10-04")).toBe(0);
    expect(weekdayOf("2026-10-05")).toBe(1);
  });
  it("anchorFor picks today when the weekday matches, else the next one", () => {
    expect(anchorFor(1, "2026-10-05")).toBe("2026-10-05");
    expect(anchorFor(1, "2026-10-06")).toBe("2026-10-12");
    expect(anchorFor(0, "2026-10-06")).toBe("2026-10-11");
  });
  it("monthly: issue_day of each month, including the 28th in February", () => {
    const a = { cadence: "monthly" as const, issueDay: 28 };
    expect(isIssueDay(a, "2027-02-28")).toBe(true);
    expect(isIssueDay(a, "2027-02-27")).toBe(false);
    expect(nextIssueDate({ cadence: "monthly", issueDay: 1 }, "2026-10-02")).toBe("2026-11-01");
    expect(nextIssueDate({ cadence: "monthly", issueDay: 1 }, "2026-12-02")).toBe("2027-01-01");
    expect(nextIssueDate({ cadence: "monthly", issueDay: 15 }, "2026-10-15")).toBe("2026-10-15");
  });
  it("weekly: every matching weekday", () => {
    const a = { cadence: "weekly" as const, issueDay: 1 };
    expect(isIssueDay(a, "2026-10-05")).toBe(true);
    expect(isIssueDay(a, "2026-10-06")).toBe(false);
    expect(nextIssueDate(a, "2026-10-06")).toBe("2026-10-12");
    expect(nextIssueDate(a, "2026-10-05")).toBe("2026-10-05");
  });
  it("biweekly: every 14 days from the anchor", () => {
    const a = { cadence: "biweekly" as const, issueDay: 1, anchorDate: "2026-10-05" };
    expect(isIssueDay(a, "2026-10-05")).toBe(true);
    expect(isIssueDay(a, "2026-10-12")).toBe(false);
    expect(isIssueDay(a, "2026-10-19")).toBe(true);
    expect(isIssueDay(a, "2026-09-21")).toBe(false); // before the anchor
    expect(nextIssueDate(a, "2026-10-13")).toBe("2026-10-19");
    expect(nextIssueDate(a, "2026-09-01")).toBe("2026-10-05");
  });
  it("biweekly without an anchor derives one from the weekday", () => {
    const a = { cadence: "biweekly" as const, issueDay: 1 };
    expect(nextIssueDate(a, "2026-10-06")).toBe("2026-10-12");
  });
});

describe("scheduleFromPlan", () => {
  const plan = [
    { offsetDays: -3, channel: "sms" as const },
    { offsetDays: 0, channel: "sms" as const },
    { offsetDays: 7, channel: "both" as const },
  ];
  it("one statement row today plus one reminder per future step", () => {
    const rows = scheduleFromPlan({ today: "2026-10-01", dueDate: "2026-10-16", statementChannel: "both", reminderPlan: plan });
    expect(rows).toEqual([
      { kind: "statement", channel: "both", scheduledFor: "2026-10-01" },
      { kind: "reminder", stepIndex: 0, channel: "sms", scheduledFor: "2026-10-13" },
      { kind: "reminder", stepIndex: 1, channel: "sms", scheduledFor: "2026-10-16" },
      { kind: "reminder", stepIndex: 2, channel: "both", scheduledFor: "2026-10-23" },
    ]);
  });
  it("drops steps that land on or before today", () => {
    const rows = scheduleFromPlan({ today: "2026-10-01", dueDate: "2026-10-03", statementChannel: "sms", reminderPlan: plan });
    expect(rows.map((r) => r.scheduledFor)).toEqual(["2026-10-01", "2026-10-03", "2026-10-10"]);
  });
});
