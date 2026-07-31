import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// next-intl passthrough: t(key) => key, so we query by key strings.
vi.mock("next-intl", () => ({
  useTranslations: () => (k: string) => k,
  useLocale: () => "es",
}));
const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => new URLSearchParams(""),
}));

import IntakeForm from "@/components/admin/intake/IntakeForm";

beforeEach(() => {
  replace.mockReset();
  // CustomerBlock/AddressAutocomplete fire debounced lookups; keep them benign.
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ found: false, orderId: "do_test" }), { status: 200 }),
  );
});

describe("IntakeForm reset", () => {
  it("Descartar clears fulfillment, customer, and channel", () => {
    render(<IntakeForm products={[]} />);

    const recipient = screen.getByPlaceholderText("fulfillment_recipient_name_placeholder") as HTMLInputElement;
    fireEvent.change(recipient, { target: { value: "Lola" } });
    const card = screen.getByPlaceholderText("card_message_placeholder") as HTMLTextAreaElement;
    fireEvent.change(card, { target: { value: "Con cariño" } });
    // switch channel away from the default
    fireEvent.click(screen.getByRole("button", { name: "channel_phone" }));

    expect(recipient.value).toBe("Lola");
    expect(card.value).toBe("Con cariño");

    fireEvent.click(screen.getByRole("button", { name: "action_discard" }));

    expect((screen.getByPlaceholderText("fulfillment_recipient_name_placeholder") as HTMLInputElement).value).toBe("");
    expect((screen.getByPlaceholderText("card_message_placeholder") as HTMLTextAreaElement).value).toBe("");

    // channel reset to walk-in
    expect(screen.getByRole("button", { name: "channel_walk_in" }).className).toContain("bg-ink");
    expect(screen.getByRole("button", { name: "channel_phone" }).className).not.toContain("bg-ink");
  });

  it("clears fulfillment after a successful create", async () => {
    render(<IntakeForm products={[]} />);

    // pickup makes buyer optional; only a line is required to enable save.
    fireEvent.click(screen.getByRole("button", { name: "fulfillment_pickup" }));
    const recipient = screen.getByPlaceholderText("fulfillment_recipient_name_placeholder") as HTMLInputElement;
    fireEvent.change(recipient, { target: { value: "Lola" } });

    // add one custom line
    fireEvent.click(screen.getByRole("button", { name: "products_add_custom" }));
    fireEvent.change(screen.getByPlaceholderText("products_custom_title_placeholder"), { target: { value: "Rosas" } });
    fireEvent.change(screen.getByPlaceholderText("products_custom_price_placeholder"), { target: { value: "50" } });
    fireEvent.click(screen.getByRole("button", { name: "products_custom_add" }));

    const save = screen.getByRole("button", { name: "action_save" }) as HTMLButtonElement;
    expect(save.disabled).toBe(false);
    fireEvent.click(save);

    await waitFor(() =>
      expect((screen.getByPlaceholderText("fulfillment_recipient_name_placeholder") as HTMLInputElement).value).toBe(""),
    );
  });
});
