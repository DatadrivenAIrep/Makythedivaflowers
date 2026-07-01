import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import LedgerFilters from "@/components/admin/dashboard/LedgerFilters";

vi.mock("next-intl", () => ({
  useTranslations: () => (k: string) => k,
  useLocale: () => "es",
}));

it("emits q on text input change after debounce", () => {
  vi.useFakeTimers();
  try {
    const onChange = vi.fn();
    render(<LedgerFilters value={{}} onChange={onChange} />);
    fireEvent.change(screen.getByPlaceholderText("search_placeholder"), { target: { value: "Maria" } });
    expect(onChange).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(350); });
    expect(onChange).toHaveBeenCalledWith({ q: "Maria" });
  } finally {
    vi.useRealTimers();
  }
});

it("toggles a date-range chip", () => {
  const onChange = vi.fn();
  render(<LedgerFilters value={{}} onChange={onChange} />);
  fireEvent.click(screen.getByRole("button", { name: /^7d$/ }));
  const call = onChange.mock.calls[0][0];
  expect(call.from).toBeTruthy();
  expect(call.to).toBeTruthy();
});

it("toggles a paymentStatus chip", () => {
  const onChange = vi.fn();
  render(<LedgerFilters value={{}} onChange={onChange} />);
  fireEvent.click(screen.getByRole("button", { name: "payment_status.paid" }));
  expect(onChange).toHaveBeenCalledWith({ paymentStatus: ["paid"] });
});

it("renders active filter chips that are removable", () => {
  const onChange = vi.fn();
  render(<LedgerFilters value={{ paymentStatus: ["paid"], q: "Maria" }} onChange={onChange} />);
  expect(screen.getByText(/payment: payment_status\.paid/)).toBeInTheDocument();
  fireEvent.click(screen.getByLabelText("remove_filter"));
  expect(onChange).toHaveBeenCalledWith({ q: "Maria", paymentStatus: undefined });
});
