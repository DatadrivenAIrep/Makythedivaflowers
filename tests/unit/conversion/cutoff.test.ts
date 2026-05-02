// tests/unit/conversion/cutoff.test.ts
import { describe, it, expect } from "vitest";
import { snapshotCutoff } from "@/lib/conversion/cutoff";

const CUTOFF = "14:00";

describe("snapshotCutoff", () => {
  it("returns status=before with correct minutesRemaining when well before cutoff", () => {
    const now = new Date("2026-05-01T12:13:00");
    const snap = snapshotCutoff(now, CUTOFF);
    expect(snap.status).toBe("before");
    expect(snap.minutesRemaining).toBe(107);
    expect(snap.cutoff).toBe(CUTOFF);
  });

  it("returns status=closing-soon when within 30 minutes of cutoff", () => {
    const now = new Date("2026-05-01T13:35:00");
    const snap = snapshotCutoff(now, CUTOFF);
    expect(snap.status).toBe("closing-soon");
    expect(snap.minutesRemaining).toBe(25);
  });

  it("returns status=after exactly at cutoff", () => {
    const now = new Date("2026-05-01T14:00:00");
    const snap = snapshotCutoff(now, CUTOFF);
    expect(snap.status).toBe("after");
    expect(snap.minutesRemaining).toBe(0);
  });

  it("returns status=after one minute past cutoff", () => {
    const now = new Date("2026-05-01T14:01:00");
    const snap = snapshotCutoff(now, CUTOFF);
    expect(snap.status).toBe("after");
    expect(snap.minutesRemaining).toBe(0);
  });

  it("returns status=closing-soon at the boundary (30 min before)", () => {
    const now = new Date("2026-05-01T13:30:00");
    const snap = snapshotCutoff(now, CUTOFF);
    expect(snap.status).toBe("closing-soon");
    expect(snap.minutesRemaining).toBe(30);
  });
});
