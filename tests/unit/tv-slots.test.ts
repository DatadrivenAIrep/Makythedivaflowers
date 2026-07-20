import { describe, it, expect } from "vitest";
import {
  shopDateStr, shopMinutesOfDay, addDaysStr, dayDiff,
  minutesUntilSlotStart, urgencyLevel, formatCountdown,
} from "@/lib/tv-slots";

const TZ = "America/New_York";

describe("tv-slots", () => {
  it("shopDateStr uses shop timezone (UTC-4 in July)", () => {
    // 2026-07-20T02:00Z = 2026-07-19 22:00 ET
    expect(shopDateStr(new Date("2026-07-20T02:00:00Z"), TZ)).toBe("2026-07-19");
    // 2026-07-20T14:15Z = 2026-07-20 10:15 ET
    expect(shopDateStr(new Date("2026-07-20T14:15:00Z"), TZ)).toBe("2026-07-20");
  });

  it("shopMinutesOfDay returns minutes since local midnight", () => {
    // 10:15 ET
    expect(shopMinutesOfDay(new Date("2026-07-20T14:15:00Z"), TZ)).toBe(10 * 60 + 15);
  });

  it("addDaysStr / dayDiff do calendar math", () => {
    expect(addDaysStr("2026-07-20", 1)).toBe("2026-07-21");
    expect(addDaysStr("2026-07-31", 1)).toBe("2026-08-01");
    expect(dayDiff("2026-07-20", "2026-07-21")).toBe(1);
    expect(dayDiff("2026-07-20", "2026-07-20")).toBe(0);
  });

  it("minutesUntilSlotStart handles today, tomorrow, and overdue", () => {
    const now = new Date("2026-07-20T14:15:00Z"); // 10:15 ET
    expect(minutesUntilSlotStart(now, "2026-07-20", "midday", TZ)).toBe(105);   // 12:00 - 10:15
    expect(minutesUntilSlotStart(now, "2026-07-20", "morning", TZ)).toBe(-75);  // 09:00 - 10:15
    expect(minutesUntilSlotStart(now, "2026-07-21", "morning", TZ)).toBe(1365); // +1 day
  });

  it("urgencyLevel buckets on 60 / 180 boundaries", () => {
    expect(urgencyLevel(45)).toBe("red");
    expect(urgencyLevel(60)).toBe("red");
    expect(urgencyLevel(61)).toBe("amber");
    expect(urgencyLevel(180)).toBe("amber");
    expect(urgencyLevel(181)).toBe("green");
    expect(urgencyLevel(-10)).toBe("red");
  });

  it("formatCountdown prints h:mm with overdue sign", () => {
    expect(formatCountdown(105)).toBe("1:45");
    expect(formatCountdown(5)).toBe("0:05");
    expect(formatCountdown(-75)).toBe("-1:15");
  });
});
