"use client";
import { useSetContactSubject } from "@/components/contact/ContactContextProvider";

export function PdpContactSubject({
  productName,
  quote,
}: {
  productName: string;
  quote?: boolean;
}) {
  useSetContactSubject({ kind: quote ? "pdp_quote" : "pdp", productName });
  return null;
}
