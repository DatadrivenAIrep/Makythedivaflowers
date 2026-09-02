// tests/unit/conversion/CutoffCountdown.test.tsx
//
// Render states, with next-intl mocked. Because the mock echoes whatever
// variables it is handed, it cannot tell whether they match the ones the real
// message declares — that contract is covered against the real message bundle
// in cutoff-copy.test.tsx.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { CutoffCountdown } from "@/components/conversion/CutoffCountdown";

vi.mock("next-intl", () => ({
  useTranslations: (ns?: string) => (k: string, vars?: Record<string, unknown>) => {
    if (vars) return `${ns ?? ""}.${k}|${JSON.stringify(vars)}`;
    return `${ns ?? ""}.${k}`;
  },
}));

describe("CutoffCountdown", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("renders placeholder on first paint (no client snapshot yet)", () => {
    vi.setSystemTime(new Date("2026-05-01T12:13:00"));
    render(<CutoffCountdown cutoff="14:00" tone="default" locale="en" />);
    expect(screen.getByText(/conversion\.cutoff\.before_label/)).toBeInTheDocument();
    expect(screen.getByText(/conversion\.cutoff\.placeholder/)).toBeInTheDocument();
  });

  it("renders before-cutoff body after hydration tick", async () => {
    vi.setSystemTime(new Date("2026-05-01T12:13:00"));
    render(<CutoffCountdown cutoff="14:00" tone="default" locale="en" />);
    await vi.runOnlyPendingTimersAsync();
    expect(screen.getByText(/conversion\.cutoff\.before_body/)).toBeInTheDocument();
    // One {time} fragment, which is what the message actually declares.
    expect(screen.getByText(/"time":/)).toBeInTheDocument();
  });

  it("renders sympathy variant when tone=sympathy", async () => {
    vi.setSystemTime(new Date("2026-05-01T12:13:00"));
    render(<CutoffCountdown cutoff="14:00" tone="sympathy" locale="en" />);
    await vi.runOnlyPendingTimersAsync();
    expect(screen.getByText(/conversion\.cutoff\.before_body_sym/)).toBeInTheDocument();
  });

  it("renders after-cutoff copy when past cutoff", async () => {
    vi.setSystemTime(new Date("2026-05-01T15:00:00"));
    render(<CutoffCountdown cutoff="14:00" tone="default" locale="en" />);
    await vi.runOnlyPendingTimersAsync();
    expect(screen.getByText(/conversion\.cutoff\.after_label/)).toBeInTheDocument();
    expect(screen.getByText(/conversion\.cutoff\.after_body/)).toBeInTheDocument();
  });
});
