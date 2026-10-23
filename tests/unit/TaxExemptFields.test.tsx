import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import es from "@/messages/es.json";
import TaxExemptFields from "@/components/admin/TaxExemptFields";
import type { TaxExemption } from "@/types/tax-exempt";

function setup(value: TaxExemption, onChange = vi.fn()) {
  render(
    <NextIntlClientProvider locale="es" messages={es as Record<string, unknown>}>
      <TaxExemptFields value={value} onChange={onChange} today="2026-10-12" idPrefix="t" />
    </NextIntlClientProvider>,
  );
  return onChange;
}

describe("TaxExemptFields", () => {
  it("hides the certificate inputs while not exempt", () => {
    setup({ exempt: false, cert: null, expires: null });
    expect(screen.queryByLabelText("Nº de certificado")).toBeNull();
  });
  it("toggling on reports exempt: true", () => {
    const onChange = setup({ exempt: false, cert: null, expires: null });
    fireEvent.click(screen.getByLabelText("Exento de impuesto"));
    expect(onChange).toHaveBeenCalledWith({ exempt: true, cert: null, expires: null });
  });
  it("shows the expired badge and edits the cert", () => {
    const onChange = setup({ exempt: true, cert: "1", expires: "2020-01-01" });
    expect(screen.getByText("Certificado vencido")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Nº de certificado"), { target: { value: "2" } });
    expect(onChange).toHaveBeenCalledWith({ exempt: true, cert: "2", expires: "2020-01-01" });
  });
});
