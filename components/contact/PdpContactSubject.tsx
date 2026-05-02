"use client";
import { useSetContactSubject } from "@/components/contact/ContactContextProvider";

export function PdpContactSubject({ productName }: { productName: string }) {
  useSetContactSubject({ kind: "pdp", productName });
  return null;
}
