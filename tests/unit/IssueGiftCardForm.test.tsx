import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import esMessages from "@/messages/es.json";
import IssueGiftCardForm from "@/components/admin/gift-cards/IssueGiftCardForm";

afterEach(() => vi.restoreAllMocks());

function wrap() {
  return render(
    <NextIntlClientProvider locale="es" messages={esMessages as Record<string, unknown>}>
      <IssueGiftCardForm onIssued={() => {}} />
    </NextIntlClientProvider>,
  );
}

describe("IssueGiftCardForm", () => {
  it("defaults to an in-store sale, listed first, and asks how it was paid", () => {
    wrap();
    const reason = screen.getByLabelText(/Motivo/) as HTMLSelectElement;
    expect(reason.value).toBe("purchase");
    expect(reason.options[0].value).toBe("purchase");
    expect(screen.getByLabelText(/Cobrado con/)).toBeDefined();
  });

  it("a comp reason hides the payment method and sends none", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(new Response("{}", { status: 200 }));
    wrap();
    fireEvent.change(screen.getByLabelText(/Motivo/), { target: { value: "apology" } });
    expect(screen.queryByLabelText(/Cobrado con/)).toBeNull();
    fireEvent.change(screen.getByLabelText(/Email del destinatario/), { target: { value: "ana@example.com" } });
    fireEvent.submit(screen.getByLabelText(/Motivo/).closest("form")!);
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    const body = JSON.parse(String(fetchSpy.mock.calls[0][1]?.body));
    expect(body).toMatchObject({ reason: "apology" });
    expect(body.paymentMethod).toBeUndefined();
  });
});
