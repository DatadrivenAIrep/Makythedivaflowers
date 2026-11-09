import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { NextIntlClientProvider } from "next-intl";
import esMessages from "@/messages/es.json";
import { ContactStep } from "@/components/checkout/ContactStep";
import type { CheckoutInput } from "@/schemas/checkout";

function Harness({ showJoinCard = false }: { showJoinCard?: boolean }) {
  const form = useForm<CheckoutInput>({
    defaultValues: {
      contact: { email: "", phone: "" },
      smsConsent: false,
      smsMarketingConsent: false,
    } as CheckoutInput,
  });
  return <ContactStep form={form} showJoinCard={showJoinCard} />;
}

describe("ContactStep consent", () => {
  it("renders two separate, unchecked, optional SMS consent checkboxes", () => {
    render(
      <NextIntlClientProvider locale="es" messages={esMessages as Record<string, unknown>}>
        <Harness />
      </NextIntlClientProvider>,
    );
    const boxes = screen.getAllByRole("checkbox") as HTMLInputElement[];
    // Two independent checkboxes: transactional + marketing.
    expect(boxes.length).toBe(2);
    expect(boxes.every((b) => !b.checked)).toBe(true);
    expect(screen.getByText(/Avisos de pedido y entrega/)).toBeDefined();
    expect(screen.getByText(/Promociones y ofertas/)).toBeDefined();
    expect(screen.getByText(/Responde STOP/)).toBeDefined();
  });

  it("renders the join-card checkbox only with showJoinCard, unchecked", () => {
    const { rerender } = render(
      <NextIntlClientProvider locale="es" messages={esMessages as Record<string, unknown>}>
        <Harness />
      </NextIntlClientProvider>,
    );
    expect(screen.queryByText(/tarjeta de fidelización de Diva Flowers/)).toBeNull();
    expect(screen.getAllByRole("checkbox").length).toBe(2);

    rerender(
      <NextIntlClientProvider locale="es" messages={esMessages as Record<string, unknown>}>
        <Harness showJoinCard />
      </NextIntlClientProvider>,
    );
    const join = screen.getByRole("checkbox", {
      name: /tarjeta de fidelización de Diva Flowers/,
    }) as HTMLInputElement;
    expect(join.checked).toBe(false);
    expect(screen.getAllByRole("checkbox").length).toBe(3);
  });
});
