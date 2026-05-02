import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import * as React from "react";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import { TextMakyModal } from "@/components/contact/TextMakyModal";
import { ContactContextProvider, useContactContext } from "@/components/contact/ContactContextProvider";

vi.mock("next/navigation", () => ({
  usePathname: () => "/en/product/garden-bloom",
}));

function OpenOnMount() {
  const { setOpen } = useContactContext();
  React.useEffect(() => { setOpen(true); }, [setOpen]);
  return null;
}

function SetPdp({ name }: { name: string }) {
  const { setOverride } = useContactContext();
  React.useEffect(() => {
    setOverride({ kind: "pdp", productName: name });
  }, [setOverride, name]);
  return null;
}

function Harness({ locale, pdpName }: { locale: "en" | "es"; pdpName?: string }) {
  const messages = locale === "en" ? en : es;
  return (
    <NextIntlClientProvider locale={locale} messages={messages as never}>
      <ContactContextProvider>
        {pdpName ? <SetPdp name={pdpName} /> : null}
        <OpenOnMount />
        <TextMakyModal />
      </ContactContextProvider>
    </NextIntlClientProvider>
  );
}

describe("TextMakyModal", () => {
  it("renders the EN preview with PDP product name", async () => {
    render(<Harness locale="en" pdpName="Garden Bloom" />);
    expect(
      await screen.findByText(/Hi Maky, I have a question about Garden Bloom\./),
    ).toBeInTheDocument();
  });

  it("renders the ES preview with PDP product name", async () => {
    render(<Harness locale="es" pdpName="Garden Bloom" />);
    expect(
      await screen.findByText(/Hola Maky, tengo una pregunta sobre Garden Bloom\./),
    ).toBeInTheDocument();
  });

  it("renders SMS, WhatsApp, and Call CTAs with correct hrefs", async () => {
    render(<Harness locale="en" pdpName="Garden Bloom" />);
    const sms = await screen.findByRole("link", { name: /Send via SMS/i });
    expect(sms).toHaveAttribute("href", expect.stringMatching(/^sms:\+15168512815\?&body=/));
    expect(sms.getAttribute("href")).toContain("Garden%20Bloom");

    const wa = screen.getByRole("link", { name: /WhatsApp/i });
    expect(wa).toHaveAttribute("href", expect.stringMatching(/^https:\/\/wa\.me\/15168512815\?text=/));

    const call = screen.getByRole("link", { name: /Call instead/i });
    expect(call).toHaveAttribute("href", "tel:+15168512815");
  });
});
