import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { StaggerGroup, StaggerItem } from "@/components/motion/StaggerGroup";

describe("StaggerGroup/StaggerItem as prop", () => {
  it("renders the requested tags and children", () => {
    const { container, getByText } = render(
      <StaggerGroup as="ul" className="grid">
        <StaggerItem as="li">card one</StaggerItem>
      </StaggerGroup>,
    );
    expect(container.querySelector("ul")).not.toBeNull();
    expect(container.querySelector("li")).not.toBeNull();
    expect(getByText("card one")).toBeInTheDocument();
  });

  it("defaults to div when no as is given", () => {
    const { container } = render(<StaggerItem>x</StaggerItem>);
    expect(container.querySelector("div")).not.toBeNull();
  });
});
