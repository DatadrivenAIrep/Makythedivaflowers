import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";
import { SubscriptionTiers } from "@/components/subscription/SubscriptionTiers";

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe("SubscriptionTiers", () => {
  it("renders all three plans", () => {
    renderWithIntl(<SubscriptionTiers locale="en" selected="medium" onSelect={() => {}} />);
    expect(screen.getByText("Small Bouquet")).toBeInTheDocument();
    expect(screen.getByText("Medium Bouquet")).toBeInTheDocument();
    expect(screen.getByText("Large Bouquet")).toBeInTheDocument();
  });

  it("shows the popular badge on Medium", () => {
    renderWithIntl(<SubscriptionTiers locale="en" selected="small" onSelect={() => {}} />);
    expect(screen.getByText(/most loved/i)).toBeInTheDocument();
  });

  it("calls onSelect with the clicked plan id", () => {
    const onSelect = vi.fn();
    renderWithIntl(<SubscriptionTiers locale="en" selected="medium" onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: /choose large bouquet/i }));
    expect(onSelect).toHaveBeenCalledWith("large");
  });

  it("marks the selected card with aria-pressed", () => {
    renderWithIntl(<SubscriptionTiers locale="en" selected="large" onSelect={() => {}} />);
    const largeBtn = screen.getByRole("button", { name: /selected/i });
    expect(largeBtn).toHaveAttribute("aria-pressed", "true");
  });
});
