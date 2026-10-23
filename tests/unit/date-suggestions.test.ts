import { describe, it, expect } from "vitest";
import { suggestRecipientDates, type SuggestionInput } from "@/lib/date-suggestions";

function input(over: Partial<SuggestionInput> = {}): SuggestionInput {
  return { recipients: [], saved: [], dismissed: new Set(), ...over };
}

const MAMA = { name: "Mamá Rosa", phone: "5165550902" };

describe("suggestRecipientDates", () => {
  it("suggests a date a recipient gets flowers on in two different years", () => {
    const out = suggestRecipientDates(input({
      recipients: [{ ...MAMA, days: ["2026-03-21", "2025-03-19", "2025-08-02"] }],
    }));
    expect(out).toEqual([
      { key: "5165550902:03-21", recipientName: "Mamá Rosa", recipientPhone: "5165550902", month: 3, day: 21, years: [2025, 2026] },
    ]);
  });

  it("needs two different years: two orders in the same week of one year are not a pattern", () => {
    const out = suggestRecipientDates(input({ recipients: [{ ...MAMA, days: ["2026-03-21", "2026-03-18"] }] }));
    expect(out).toEqual([]);
  });

  it("allows a few days of drift between years", () => {
    const out = suggestRecipientDates(input({ recipients: [{ ...MAMA, days: ["2026-06-10", "2025-06-15"] }] }));
    expect(out.map((s) => [s.month, s.day])).toEqual([[6, 10]]);
    const far = suggestRecipientDates(input({ recipients: [{ ...MAMA, days: ["2026-06-01", "2025-06-15"] }] }));
    expect(far).toEqual([]);
  });

  it("finds a pattern across the new year", () => {
    const out = suggestRecipientDates(input({ recipients: [{ ...MAMA, days: ["2026-01-01", "2024-12-30"] }] }));
    expect(out.map((s) => [s.month, s.day])).toEqual([[1, 1]]);
  });

  it("skips Valentine's and Mother's Day weeks, which the seasonal campaigns already cover", () => {
    const out = suggestRecipientDates(input({
      recipients: [{ ...MAMA, days: ["2026-02-14", "2025-02-13", "2026-05-10", "2025-05-11"] }],
    }));
    expect(out).toEqual([]);
  });

  it("drops a pattern the customer already saved for that recipient (by phone or name)", () => {
    const recipients = [{ ...MAMA, days: ["2026-03-21", "2025-03-19"] }];
    expect(suggestRecipientDates(input({
      recipients, saved: [{ month: 3, day: 20, recipientPhone: "5165550902" }],
    }))).toEqual([]);
    expect(suggestRecipientDates(input({
      recipients, saved: [{ month: 3, day: 21, label: "mamá rosa" }],
    }))).toEqual([]);
    // A saved date for someone else does not hide it.
    expect(suggestRecipientDates(input({
      recipients, saved: [{ month: 3, day: 21, label: "Sofía" }],
    }))).toHaveLength(1);
  });

  it("drops a suggestion the shop dismissed", () => {
    const out = suggestRecipientDates(input({
      recipients: [{ ...MAMA, days: ["2026-03-21", "2025-03-19"] }],
      dismissed: new Set(["5165550902:03-21"]),
    }));
    expect(out).toEqual([]);
  });

  it("keys recipients without a phone by name", () => {
    const out = suggestRecipientDates(input({
      recipients: [{ name: "Abuela", phone: "", days: ["2026-09-01", "2025-09-02"] }],
    }));
    expect(out[0].key).toBe("name:abuela:09-01");
  });
});
