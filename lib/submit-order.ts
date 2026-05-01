import type { CheckoutInput } from "@/schemas/checkout";
import type { CartLine } from "@/lib/cart-store";
import type { Locale } from "@/types/locale";

export type SubmitOrderResult =
  | { ok: true; id: string }
  | { ok: false; errors: { fieldErrors?: Record<string, string[]>; formErrors?: string[] } };

export async function submitOrder(input: {
  locale: Locale;
  lines: CartLine[];
  form: CheckoutInput;
}): Promise<SubmitOrderResult> {
  const res = await fetch("/api/checkout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.ok) {
    return { ok: false, errors: data?.errors ?? { formErrors: ["unknown_error"] } };
  }
  return { ok: true, id: data.id as string };
}
