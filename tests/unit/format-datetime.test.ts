import { describe, it, expect } from "vitest";
import { formatDateTime, formatDate, formatDateOnly } from "@/lib/format-datetime";
const iso = "2026-07-04T15:30:00.000Z";
describe("format-datetime", () => {
  it("formats a datetime differently per locale", () => {
    const en = formatDateTime(iso, "en");
    const es = formatDateTime(iso, "es");
    expect(en).toBeTruthy(); expect(es).toBeTruthy(); expect(en).not.toBe(es);
  });
  it("formats a date-only value", () => {
    expect(formatDate(iso, "en")).toBeTruthy(); expect(formatDate("2026-07-04", "es")).toBeTruthy();
  });
  it("formatDateOnly renders the stored calendar day regardless of the runner's timezone", () => {
    // A UTC-midnight parse would drift to the previous day in Eastern time; the
    // UTC-pinned formatter must keep the 1st as the 1st.
    expect(formatDateOnly("2027-06-01", "en")).toContain("1");
    expect(formatDateOnly("2027-06-01", "en")).toContain("Jun");
    expect(formatDateOnly("2027-06-01", "en")).not.toContain("May");
    expect(formatDateOnly("2027-12-31", "en")).toContain("31");
  });
});
