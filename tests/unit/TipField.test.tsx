import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TipField, centsFromDollarInput, MAX_TIP_CENTS } from "@/components/checkout/TipField";

vi.mock("next-intl", () => ({ useTranslations: () => (k: string) => k }));

describe("centsFromDollarInput", () => {
  it("reads whole and fractional dollars", () => {
    expect(centsFromDollarInput("25")).toBe(2500);
    expect(centsFromDollarInput("12.50")).toBe(1250);
    expect(centsFromDollarInput("0.99")).toBe(99);
  });

  it("ignores currency symbols and stray characters", () => {
    expect(centsFromDollarInput("$25")).toBe(2500);
    expect(centsFromDollarInput("20 ")).toBe(2000);
    // The sign is stripped like any other stray character — a tip is never negative.
    expect(centsFromDollarInput("-5")).toBe(500);
  });

  it("reads junk and empty as no tip", () => {
    expect(centsFromDollarInput("")).toBe(0);
    expect(centsFromDollarInput("abc")).toBe(0);
    expect(centsFromDollarInput(".")).toBe(0);
  });

  it("never returns a value outside 0…cap", () => {
    for (const raw of ["-999", "abc", "", "1e9", "0.001", "999999", "12.34"]) {
      const cents = centsFromDollarInput(raw);
      expect(cents).toBeGreaterThanOrEqual(0);
      expect(cents).toBeLessThanOrEqual(MAX_TIP_CENTS);
      expect(Number.isInteger(cents)).toBe(true);
    }
  });

  it("clamps to the server's cap so a typo can't bounce the checkout", () => {
    // /api/checkout/intent refuses tipCents > 20000, which would fail the whole
    // order rather than just the tip.
    expect(centsFromDollarInput("100000")).toBe(MAX_TIP_CENTS);
    expect(centsFromDollarInput("250")).toBe(MAX_TIP_CENTS);
  });
});

/** Controlled the way CheckoutShell holds the tip, so `value` really updates. */
function Harness({ initial = 0, onChange }: { initial?: number; onChange: (cents: number) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <TipField
      value={value}
      locale="en"
      onChange={(cents) => {
        setValue(cents);
        onChange(cents);
      }}
    />
  );
}

describe("TipField", () => {
  function setup(initial = 0) {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Harness initial={initial} onChange={onChange} />);
    return { onChange, user };
  }

  /** Real timers: the debounce is 600ms, so wait past it before asserting. */
  const settled = (fn: () => void) => waitFor(fn, { timeout: 2000 });
  const afterDebounce = () => new Promise((r) => setTimeout(r, 800));

  it("reports a preset amount immediately", async () => {
    const { onChange, user } = setup();
    await user.click(screen.getByRole("button", { name: "$10" }));
    expect(onChange).toHaveBeenCalledWith(1000);
  });

  it("opens a field for a buyer-chosen amount", async () => {
    const { user } = setup();
    expect(screen.queryByLabelText("custom_label")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "custom" }));
    expect(screen.getByLabelText("custom_label")).toBeInTheDocument();
  });

  it("commits the typed amount", async () => {
    const { onChange, user } = setup();
    await user.click(screen.getByRole("button", { name: "custom" }));
    await user.type(screen.getByLabelText("custom_label"), "25");
    await settled(() => expect(onChange).toHaveBeenCalledWith(2500));
  });

  it("commits once for the whole number, not once per keystroke", async () => {
    // Each committed change re-prices the PaymentIntent and writes an order row,
    // so typing "25" must not also charge a $2 tip on the way through.
    const { onChange, user } = setup();
    await user.click(screen.getByRole("button", { name: "custom" }));
    await user.type(screen.getByLabelText("custom_label"), "25");
    await settled(() => expect(onChange).toHaveBeenCalledWith(2500));
    await afterDebounce();
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).not.toHaveBeenCalledWith(200);
  });

  it("clamps a typed amount above the cap", async () => {
    const { onChange, user } = setup();
    await user.click(screen.getByRole("button", { name: "custom" }));
    await user.type(screen.getByLabelText("custom_label"), "5000");
    await settled(() => expect(onChange).toHaveBeenLastCalledWith(MAX_TIP_CENTS));
  });

  it("carries a chosen preset over instead of dropping it", async () => {
    const { onChange, user } = setup();
    await user.click(screen.getByRole("button", { name: "$15" }));
    onChange.mockClear();
    await user.click(screen.getByRole("button", { name: "custom" }));
    expect(screen.getByLabelText("custom_label")).toHaveValue("15");
    await afterDebounce();
    // Same amount, so nothing is re-committed and no new intent is created.
    expect(onChange).not.toHaveBeenCalled();
  });

  it("treats a cleared field as no tip", async () => {
    const { onChange, user } = setup(1500);
    await user.click(screen.getByRole("button", { name: "custom" }));
    await user.clear(screen.getByLabelText("custom_label"));
    await settled(() => expect(onChange).toHaveBeenCalledWith(0));
  });
});
