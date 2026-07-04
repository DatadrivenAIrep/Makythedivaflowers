// tests/unit/whatsapp-cta.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { WhatsAppCta } from "@/components/inquiry/WhatsAppCta";

describe("WhatsAppCta", () => {
  it("renders a link with the given label and a whatsapp href containing the shop number", () => {
    render(<WhatsAppCta label="Text us on WhatsApp" message="Hi Maky" />);
    const link = screen.getByRole("link", { name: "Text us on WhatsApp" });
    expect(link).toBeInTheDocument();
    expect(link.getAttribute("href") ?? "").toContain("15168512815");
    expect(link).toHaveAttribute("target", "_blank");
  });
});
