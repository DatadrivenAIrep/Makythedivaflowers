import { describe, it, expect } from "vitest";
import { formatDateTime, formatDate } from "@/lib/format-datetime";
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
});
