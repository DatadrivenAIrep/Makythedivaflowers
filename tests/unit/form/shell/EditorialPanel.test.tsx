import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { EditorialPanel } from "@/components/ui/form/shell/EditorialPanel";

describe("EditorialPanel", () => {
  it("renders eyebrow, title (h2), and optional body", () => {
    render(
      <EditorialPanel
        eyebrow="Talk to us"
        title="Tell us what you're imagining."
        body="One business day."
      />,
    );
    expect(screen.getByText("Talk to us")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: /imagining/i })).toBeInTheDocument();
    expect(screen.getByText(/one business day/i)).toBeInTheDocument();
  });

  it("renders numbered steps when provided", () => {
    render(
      <EditorialPanel
        eyebrow="Process"
        title="How it works"
        steps={[
          { title: "Send inquiry", body: "Under 2 min." },
          { title: "We reply", body: "Within 24h." },
        ]}
      />,
    );
    expect(screen.getByText("Send inquiry")).toBeInTheDocument();
    expect(screen.getByText("We reply")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });
});
