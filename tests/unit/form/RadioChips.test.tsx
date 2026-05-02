import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RadioChips } from "@/components/ui/form/RadioChips";

describe("RadioChips", () => {
  const items = [
    { value: "a", label: "Alpha" },
    { value: "b", label: "Beta" },
    { value: "c", label: "Gamma" },
  ];

  it("renders one radio per item with name applied", () => {
    render(<RadioChips name="grp" items={items} value="a" onChange={() => {}} />);
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(3);
    expect(radios[0]).toHaveAttribute("name", "grp");
  });

  it("marks the active value as checked", () => {
    render(<RadioChips name="grp" items={items} value="b" onChange={() => {}} />);
    expect(screen.getByLabelText("Beta")).toBeChecked();
  });

  it("calls onChange with the new value when clicked", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<RadioChips name="grp" items={items} value="a" onChange={onChange} />);
    await user.click(screen.getByLabelText("Gamma"));
    expect(onChange).toHaveBeenCalledWith("c");
  });
});
