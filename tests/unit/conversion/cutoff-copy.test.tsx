import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";
import { CutoffCountdown } from "@/components/conversion/CutoffCountdown";

/**
 * Rendered against the real message bundle, unlike the sibling
 * CutoffCountdown.test.tsx which mocks next-intl.
 *
 * The countdown sits on every product page. It renders a message with a {time}
 * placeholder, and next-intl throws a FORMATTING_ERROR — visible to the buyer as
 * broken copy — if the component supplies different variables than the string
 * declares. These pin the contract between the two.
 */

function renderAt(hhmm: string, cutoff = "14:00") {
  const [h, m] = hhmm.split(":").map(Number);
  const now = new Date();
  now.setHours(h, m, 0, 0);
  vi.setSystemTime(now);
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <CutoffCountdown cutoff={cutoff} locale="en" />
    </NextIntlClientProvider>,
  );
}

let errors: string[] = [];

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  errors = [];
  vi.spyOn(console, "error").mockImplementation((...a: unknown[]) => {
    errors.push(a.map(String).join(" "));
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("CutoffCountdown", () => {
  it("renders the remaining time before the cutoff", async () => {
    renderAt("11:30");
    // 2h 30m before a 14:00 cutoff.
    expect(await screen.findByText(/2h 30m/)).toBeInTheDocument();
  });

  it("does not leave an unfilled placeholder in the copy", async () => {
    renderAt("11:30");
    const body = await screen.findByText(/delivery this afternoon/i);
    expect(body.textContent).not.toContain("{time}");
  });

  it("formats a sub-hour countdown without the hours part", async () => {
    renderAt("13:45");
    expect(await screen.findByText(/15m/)).toBeInTheDocument();
    expect(screen.queryByText(/0h/)).not.toBeInTheDocument();
  });

  it("says same-day is closed after the cutoff", async () => {
    renderAt("15:00");
    expect(await screen.findByText(/tomorrow afternoon/i)).toBeInTheDocument();
  });

  it("reports no formatting error, which is what a missing variable looks like", async () => {
    renderAt("11:30");
    await screen.findByText(/delivery this afternoon/i);
    expect(errors.filter((e) => e.includes("FORMATTING_ERROR"))).toEqual([]);
  });

  it("uses the sympathy wording when asked", async () => {
    vi.setSystemTime(new Date(new Date().setHours(11, 30, 0, 0)));
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <CutoffCountdown cutoff="14:00" tone="sympathy" locale="en" />
      </NextIntlClientProvider>,
    );
    expect(await screen.findByText(/as early as this afternoon/i)).toBeInTheDocument();
  });
});
