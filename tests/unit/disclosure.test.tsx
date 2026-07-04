import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Disclosure } from "@/components/ui/form/Disclosure";

describe("Disclosure", () => {
  it("renders a closed details with the summary and keeps children in the DOM", () => {
    render(
      <Disclosure summary="More details">
        <input aria-label="venue" />
      </Disclosure>,
    );
    const details = screen.getByText("More details").closest("details");
    expect(details).not.toBeNull();
    expect(details).not.toHaveAttribute("open");
    expect(screen.getByLabelText("venue")).toBeInTheDocument();
  });
});
