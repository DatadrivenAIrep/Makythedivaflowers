// tests/unit/what-happens-next.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { WhatHappensNext } from "@/components/inquiry/WhatHappensNext";

describe("WhatHappensNext", () => {
  it("renders the title and each step in order", () => {
    render(
      <WhatHappensNext
        title="What happens next"
        steps={["You send this", "We reply within one business day", "We set up your consultation"]}
      />,
    );
    expect(screen.getByText("What happens next")).toBeInTheDocument();
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent("You send this");
    expect(items[1]).toHaveTextContent("We reply within one business day");
    expect(items[2]).toHaveTextContent("We set up your consultation");
  });
});
