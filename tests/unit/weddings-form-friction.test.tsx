import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";
import { WeddingsForm } from "@/components/inquiry/WeddingsForm";

vi.mock("next/navigation", () => ({ usePathname: () => "/en/weddings" }));

function Harness() {
  return (
    <NextIntlClientProvider locale="en" messages={en as never}>
      <WeddingsForm locale="en" />
    </NextIntlClientProvider>
  );
}

describe("WeddingsForm friction", () => {
  it("marks the phone field required in the UI", () => {
    render(<Harness />);
    const phoneLabel = document.getElementById("w-phone-label");
    expect(phoneLabel).not.toBeNull();
    expect(phoneLabel?.textContent).toContain("*");
  });

  it("collapses optional fields under a 'more details' disclosure that is closed by default", () => {
    render(<Harness />);
    const summary = screen.getByText(en.weddings.form.more_details);
    const details = summary.closest("details");
    expect(details).not.toBeNull();
    expect(details).not.toHaveAttribute("open");
    expect(document.getElementById("w-venue")).not.toBeNull();
  });
});
