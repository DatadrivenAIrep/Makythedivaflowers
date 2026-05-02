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
    renderWithIntl(<SubscriptionTiers locale="en" selected="maison" onSelect={() => {}} />);
    expect(screen.getByText("Petit Bouquet")).toBeInTheDocument();
    expect(screen.getByText("Maison")).toBeInTheDocument();
    expect(screen.getByText("Atelier")).toBeInTheDocument();
  });

  it("shows the popular badge on Maison", () => {
    renderWithIntl(<SubscriptionTiers locale="en" selected="petit" onSelect={() => {}} />);
    expect(screen.getByText(/most loved/i)).toBeInTheDocument();
  });

  it("calls onSelect with the clicked plan id", () => {
    const onSelect = vi.fn();
    renderWithIntl(<SubscriptionTiers locale="en" selected="maison" onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: /choose atelier/i }));
    expect(onSelect).toHaveBeenCalledWith("atelier");
  });

  it("marks the selected card with aria-pressed", () => {
    renderWithIntl(<SubscriptionTiers locale="en" selected="atelier" onSelect={() => {}} />);
    const atelierBtn = screen.getByRole("button", { name: /selected/i });
    expect(atelierBtn).toHaveAttribute("aria-pressed", "true");
  });
});
