import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ModalShell from "@/components/admin/accounts/ModalShell";

describe("ModalShell", () => {
  it("is a labelled modal dialog", () => {
    render(<ModalShell title="Registrar pago" onClose={() => {}}><p>body</p></ModalShell>);
    expect(screen.getByRole("dialog").getAttribute("aria-modal")).toBe("true");
    expect(screen.getByRole("dialog", { name: "Registrar pago" })).toBeDefined();
  });
  it("closes on Escape and on backdrop click, not on inner click", () => {
    const onClose = vi.fn();
    render(<ModalShell title="X" onClose={onClose}><p>body</p></ModalShell>);
    fireEvent.click(screen.getByText("body"));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("dialog").parentElement as HTMLElement);
    expect(onClose).toHaveBeenCalledTimes(2);
  });
  it("returns focus to the previously focused element after close", () => {
    const opener = document.createElement("button");
    document.body.appendChild(opener);
    opener.focus();
    expect(document.activeElement).toBe(opener);
    const { unmount } = render(<ModalShell title="X" onClose={() => {}}><input aria-label="inner" /></ModalShell>);
    (screen.getByLabelText("inner") as HTMLInputElement).focus();
    expect(document.activeElement).not.toBe(opener);
    unmount();
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });
});
