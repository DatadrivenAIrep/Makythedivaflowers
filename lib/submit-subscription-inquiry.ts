import type { SubscriptionInquiry } from "@/schemas/subscription-inquiry";

export type SubmitSubscriptionInquiryResult =
  | { ok: true; id: string }
  | { ok: false; errors: { fieldErrors?: Record<string, string[]>; formErrors?: string[] } };

export async function submitSubscriptionInquiry(
  values: SubscriptionInquiry,
): Promise<SubmitSubscriptionInquiryResult> {
  const res = await fetch("/api/inquiry", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(values),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.ok) {
    return { ok: false, errors: data?.errors ?? { formErrors: ["unknown_error"] } };
  }
  return { ok: true, id: data.id as string };
}
