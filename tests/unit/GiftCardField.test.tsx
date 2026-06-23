import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import GiftCardField from "@/components/checkout/GiftCardField";

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("GiftCardField", () => {
  it("applies a valid code and reports the applied amount", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ valid: true, code: "DIVA-7K2M-9XQ4", balanceCents: 15000 }), { status: 200 }),
    );
    const onApply = vi.fn();
    render(<GiftCardField totalCents={9000} onApply={onApply} onClear={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText(/DIVA/i), { target: { value: "diva 7k2m 9xq4" } });
    fireEvent.click(screen.getByRole("button", { name: /aplicar|apply/i }));
    await waitFor(() => expect(onApply).toHaveBeenCalledWith({ code: "DIVA-7K2M-9XQ4", appliedCents: 9000 }));
  });

  it("shows an error for an invalid code", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ valid: false, reason: "invalid" }), { status: 200 }),
    );
    render(<GiftCardField totalCents={9000} onApply={() => {}} onClear={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText(/DIVA/i), { target: { value: "nope" } });
    fireEvent.click(screen.getByRole("button", { name: /aplicar|apply/i }));
    await waitFor(() => expect(screen.getByText(/inválid|invalid/i)).toBeDefined());
  });
});
