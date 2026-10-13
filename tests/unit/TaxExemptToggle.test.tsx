import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import es from "@/messages/es.json";
import TaxExemptToggle from "@/components/admin/intake/TaxExemptToggle";
import type { DefaultExemption, TaxExemptRequest } from "@/types/tax-exempt";

function setup(fallback: DefaultExemption | null, value?: TaxExemptRequest, expired = false) {
  const onChange = vi.fn();
  render(
    <NextIntlClientProvider locale="es" messages={es}>
      <TaxExemptToggle fallback={fallback} expired={expired} value={value} onChange={onChange} />
    </NextIntlClientProvider>,
  );
  return onChange;
}

describe("TaxExemptToggle", () => {
  it("is on with the account certificate by default", () => {
    setup({ cert: "ACC-9", source: "account" });
    expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(true);
    expect(screen.getByText("Exento de tax · Cert #ACC-9 (cuenta)")).toBeTruthy();
  });
  it("switching a default off sends taxExempt: false", () => {
    const onChange = setup({ cert: "ACC-9", source: "account" });
    fireEvent.click(screen.getByRole("checkbox"));
    expect(onChange).toHaveBeenLastCalledWith({ taxExempt: false });
  });
  it("re-enabling a switched-off default clears the override", () => {
    const onChange = setup({ cert: "ACC-9", source: "account" }, { taxExempt: false });
    fireEvent.click(screen.getByRole("checkbox"));
    expect(onChange).toHaveBeenLastCalledWith(undefined);
  });
  it("a one-off asks for the certificate", () => {
    const onChange = setup(null, { taxExempt: true });
    fireEvent.change(screen.getByPlaceholderText("Nº de certificado"), { target: { value: "X1" } });
    expect(onChange).toHaveBeenLastCalledWith({ taxExempt: true, cert: "X1" });
  });
  it("shows the expired note when nothing applies", () => {
    setup(null, undefined, true);
    expect(screen.getByText("El certificado de este cliente venció: se cobra tax.")).toBeTruthy();
  });
});
