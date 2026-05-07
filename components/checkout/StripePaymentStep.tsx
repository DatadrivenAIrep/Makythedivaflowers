"use client";
import { useEffect } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import type { Stripe as StripeJs, StripeElements } from "@stripe/stripe-js";
import { CreditCard } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";
import { getStripeClient } from "@/lib/stripe-client";

const stripePromise = getStripeClient();

type Props = {
  clientSecret: string;
  onReady: (stripe: StripeJs, elements: StripeElements) => void;
  errorMessage?: string | null;
};

function ElementsBridge({
  onReady,
  errorMessage,
}: {
  onReady: Props["onReady"];
  errorMessage?: string | null;
}) {
  const t = useTranslations("checkout");
  const stripe = useStripe();
  const elements = useElements();

  useEffect(() => {
    if (stripe && elements) onReady(stripe, elements);
  }, [stripe, elements, onReady]);

  return (
    <div className="rounded-2xl border border-ink/10 bg-bone/60 p-5 space-y-4">
      <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-ink/60">
        <CreditCard size={14} />
        {t("payment_label")}
      </div>
      <PaymentElement options={{ layout: "tabs" }} />
      {errorMessage && (
        <p className="font-mono text-[11px] text-error">{errorMessage}</p>
      )}
    </div>
  );
}

export function StripePaymentStep({ clientSecret, onReady, errorMessage }: Props) {
  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance: {
          theme: "stripe",
          variables: {
            fontFamily: "system-ui, sans-serif",
            colorPrimary: "#0E0D0C",
          },
        },
      }}
    >
      <ElementsBridge onReady={onReady} errorMessage={errorMessage} />
    </Elements>
  );
}
