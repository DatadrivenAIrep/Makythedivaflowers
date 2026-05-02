import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { GiftAssuranceBar } from "@/components/conversion/GiftAssuranceBar";

vi.mock("next-intl", () => ({
  useTranslations: () => (k: string) => k,
}));

describe("GiftAssuranceBar", () => {
  it("renders three assurance items in md size with title and body", () => {
    render(<GiftAssuranceBar size="md" surface="pdp" locale="en" />);
    expect(screen.getByText("hand_built_title")).toBeInTheDocument();
    expect(screen.getByText("hand_built_body")).toBeInTheDocument();
    expect(screen.getByText("redo_title")).toBeInTheDocument();
    expect(screen.getByText("local_title")).toBeInTheDocument();
  });

  it("hides body in sm size, keeps titles", () => {
    render(<GiftAssuranceBar size="sm" surface="cart" locale="en" />);
    expect(screen.getByText("hand_built_title")).toBeInTheDocument();
    expect(screen.queryByText("hand_built_body")).not.toBeInTheDocument();
  });

  it("emits surface in data attribute for analytics", () => {
    const { container } = render(<GiftAssuranceBar size="sm" surface="checkout" locale="en" />);
    expect(container.querySelector('[data-conv-event="assurance_view"][data-surface="checkout"]')).toBeTruthy();
  });

  it("uses ul/li semantic markup", () => {
    render(<GiftAssuranceBar size="md" surface="pdp" locale="en" />);
    expect(screen.getByRole("list")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });
});
