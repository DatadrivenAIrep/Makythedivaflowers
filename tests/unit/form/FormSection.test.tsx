import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FormSection } from "@/components/ui/form/FormSection";

describe("FormSection", () => {
  it("renders title and number when provided", () => {
    render(<FormSection title="Recipient" num={2} />);
    expect(screen.getByText("Recipient")).toBeInTheDocument();
    expect(screen.getByText("02")).toBeInTheDocument();
  });

  it("renders title without number when num omitted", () => {
    render(<FormSection title="Address" />);
    expect(screen.getByText("Address")).toBeInTheDocument();
    expect(screen.queryByText(/^\d{2}$/)).not.toBeInTheDocument();
  });
});
