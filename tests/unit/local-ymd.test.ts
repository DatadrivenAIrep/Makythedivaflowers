import { describe, it, expect } from "vitest";
import { localYmd } from "@/lib/format-datetime";

describe("localYmd", () => {
  it("uses the device's calendar day, not UTC", () => {
    // 9:50 pm on Oct 7 local time — already Oct 8 in UTC when the device is in New York.
    expect(localYmd(new Date(2026, 9, 7, 21, 50))).toBe("2026-10-07");
    expect(localYmd(new Date(2026, 0, 3, 0, 5))).toBe("2026-01-03");
  });
});
