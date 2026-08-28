import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { NextIntlClientProvider } from "next-intl";
import esMessages from "@/messages/es.json";
import { ContactStep } from "@/components/checkout/ContactStep";
import type { CheckoutInput } from "@/schemas/checkout";

function Harness() {
  const form = useForm<CheckoutInput>({
    defaultValues: {
      contact: { email: "", phone: "" },
      smsConsent: false,
    } as CheckoutInput,
  });
  return <ContactStep form={form} />;
}

describe("ContactStep consent", () => {
  it("renders an unchecked, optional sms consent checkbox with disclosure", () => {
    render(
      <NextIntlClientProvider locale="es" messages={esMessages as Record<string, unknown>}>
        <Harness />
      </NextIntlClientProvider>,
    );
    const box = screen.getByRole("checkbox");
    expect((box as HTMLInputElement).checked).toBe(false);
    expect(screen.getByText(/Envíenme textos/)).toBeDefined();
    expect(screen.getByText(/Responde STOP/)).toBeDefined();
  });
});
