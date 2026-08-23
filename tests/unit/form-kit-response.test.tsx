import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FormSubmit } from "@/components/ui/form/FormSubmit";
import { RadioChips } from "@/components/ui/form/RadioChips";
import { TextInput } from "@/components/ui/form/TextInput";

describe("FormSubmit", () => {
  it("gives instant press feedback and still submits", () => {
    const onClick = vi.fn();
    render(<FormSubmit onClick={onClick}>Send</FormSubmit>);
    const btn = screen.getByRole("button", { name: "Send" });
    expect(btn.className).toMatch(/active:scale-\[0\.98\]/);
    expect(btn.className).toMatch(/transition-\[transform/);
    expect(btn).toHaveAttribute("type", "submit");
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledOnce();
  });
});

describe("RadioChips", () => {
  const items = [
    { value: "a", label: "Alpha" },
    { value: "b", label: "Beta" },
  ];
  it("gives instant press feedback and fires onChange", () => {
    const onChange = vi.fn();
    render(<RadioChips name="g" items={items} value="a" onChange={onChange} />);
    const beta = screen.getByText("Beta").closest("label")!;
    expect(beta.className).toMatch(/active:scale-\[0\.9/);
    expect(beta.className).toMatch(/transition-\[transform/);
    fireEvent.click(screen.getByDisplayValue("b"));
    expect(onChange).toHaveBeenCalledWith("b");
  });
});

describe("TextInput", () => {
  it("transitions focus on the fast motion token", () => {
    render(<TextInput aria-label="name" />);
    const input = screen.getByLabelText("name");
    expect(input.className).toMatch(/transition-duration:var\(--motion-fast\)/);
  });
});
