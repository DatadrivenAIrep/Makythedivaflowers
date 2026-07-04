import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";

const refreshSpy = vi.fn();

vi.mock("next-intl", () => ({
  useTranslations: () => (k: string) => k,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshSpy }),
}));
vi.mock("@/lib/cart-store", () => ({
  useCartStore: (sel: (s: { clear: () => void }) => unknown) => sel({ clear: () => {} }),
}));

import { ConfirmationPolling } from "@/components/checkout/ConfirmationPolling";

function stubFetch(body: { status: string; paymentStatus?: string }) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, json: async () => body })),
  );
}

describe("ConfirmationPolling", () => {
  beforeEach(() => {
    refreshSpy.mockClear();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    cleanup();
  });

  it("refreshes to the paid view once payment is confirmed while polling", async () => {
    // Payment lands (paymentStatus="paid") while fulfillment is still "pending":
    // the component must re-render the server page so `purchase` fires.
    stubFetch({ status: "pending", paymentStatus: "paid" });

    render(<ConfirmationPolling orderId="o1" initialStatus="pending" locale="en" />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(refreshSpy).toHaveBeenCalled();
  });

  it("does not refresh and shows the failed state when payment fails", async () => {
    stubFetch({ status: "failed", paymentStatus: "pending" });

    render(<ConfirmationPolling orderId="o2" initialStatus="pending" locale="en" />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(refreshSpy).not.toHaveBeenCalled();
    expect(screen.getByText("failed_label")).toBeInTheDocument();
  });
});
