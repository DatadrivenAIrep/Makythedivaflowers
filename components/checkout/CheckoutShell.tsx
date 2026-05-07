// components/checkout/CheckoutShell.tsx
"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { CaretDown } from "@phosphor-icons/react/dist/ssr";
import type { Stripe as StripeJs, StripeElements } from "@stripe/stripe-js";
import { Button } from "@/components/ui/Button";
import { ContactStep } from "@/components/checkout/ContactStep";
import { DeliveryStep } from "@/components/checkout/DeliveryStep";
import { StripePaymentStep } from "@/components/checkout/StripePaymentStep";
import { FormShell } from "@/components/ui/form/shell/FormShell";
import { OrderSummaryPanel } from "@/components/checkout/OrderSummaryPanel";
import { FormSubmit } from "@/components/ui/form/FormSubmit";
import { useCartStore, type CartLine } from "@/lib/cart-store";
import { useUIStore } from "@/lib/ui-store";
import { checkoutSchema, type CheckoutInput } from "@/schemas/checkout";
import { resolveCartLines, cartSubtotalCents } from "@/lib/cart-helpers";
import { computeOrderTotals, computeDeliveryCentsForZip } from "@/lib/totals";
import { PRODUCTS } from "@/data/products";
import type { Locale } from "@/types/locale";
import { springs } from "@/lib/motion-config";
import {
  trackBeginCheckout,
  trackAddShippingInfo,
  trackAddPaymentInfo,
  trackRecipientInfoCompleted,
} from "@/lib/analytics";
import { resolvedLineToAnalyticsItem } from "@/lib/analytics-types";

type StepKey = "contact" | "delivery" | "payment";

type IntentState =
  | { status: "idle" }
  | { status: "creating" }
  | { status: "ready"; clientSecret: string; orderId: string; amountCents: number }
  | { status: "error"; message: string };

async function createIntent(payload: {
  locale: Locale;
  lines: CartLine[];
  form: CheckoutInput;
}): Promise<{ clientSecret: string; orderId: string } | { error: string }> {
  const res = await fetch("/api/checkout/intent", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const code = data?.errors?.formErrors?.[0] ?? "unknown_error";
    return { error: code };
  }
  return { clientSecret: data.clientSecret, orderId: data.orderId };
}

// Map of error codes the API can return → i18n key suffix under `checkout.errors`.
// Anything not in this set falls back to `unknown_error`.
const KNOWN_ERROR_CODES = new Set([
  "cart_empty",
  "zip_not_in_zone",
  "payment_init_failed",
  "unknown_error",
]);

function errorKey(code: string): string {
  return KNOWN_ERROR_CODES.has(code) ? `errors.${code}` : "errors.unknown_error";
}

export function CheckoutShell({ locale }: { locale: Locale }) {
  const t = useTranslations("checkout");
  const router = useRouter();
  const reduce = useReducedMotion();
  const lines = useCartStore((s) => s.lines);
  const clear = useCartStore((s) => s.clear);
  const closeDrawer = useUIStore((s) => s.closeDrawer);

  const resolved = useMemo(() => resolveCartLines(lines, PRODUCTS), [lines]);
  const subtotal = useMemo(() => cartSubtotalCents(lines, PRODUCTS), [lines]);

  useEffect(() => {
    if (resolved.length === 0) return;
    trackBeginCheckout(resolved.map(resolvedLineToAnalyticsItem));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const form = useForm<CheckoutInput>({
    resolver: zodResolver(checkoutSchema),
    mode: "onBlur",
    defaultValues: {
      contact: { email: "", phone: "" },
      delivery: {
        recipient: { name: "", phone: "" },
        address: { street1: "", street2: "", city: "", state: "NY", zip: "", country: "US" },
        window: { date: "", slot: "midday" },
        cardMessage: "",
      },
    },
  });

  const [open, setOpen] = useState<StepKey>("contact");
  const [submitting, setSubmitting] = useState(false);
  const [topError, setTopError] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [intent, setIntent] = useState<IntentState>({ status: "idle" });
  const stripeRef = useRef<{ stripe: StripeJs; elements: StripeElements } | null>(null);

  const handleStripeReady = useCallback((stripe: StripeJs, elements: StripeElements) => {
    stripeRef.current = { stripe, elements };
  }, []);

  const zipValue = form.watch("delivery.address.zip");
  const deliveryCents = computeDeliveryCentsForZip(zipValue ?? "");
  const deliveryPending = deliveryCents === null;
  const totals = useMemo(
    () => computeOrderTotals(subtotal, deliveryCents ?? 0),
    [subtotal, deliveryCents],
  );

  // Recreate the PaymentIntent if the amount changes after we already have one.
  useEffect(() => {
    if (intent.status !== "ready") return;
    if (totals.totalCents === intent.amountCents) return;
    if (totals.totalCents <= 0) return;
    let cancelled = false;
    (async () => {
      const r = await createIntent({ locale, lines, form: form.getValues() });
      if (cancelled) return;
      if ("error" in r) {
        setIntent({ status: "error", message: r.error });
      } else {
        setIntent({
          status: "ready",
          clientSecret: r.clientSecret,
          orderId: r.orderId,
          amountCents: totals.totalCents,
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [totals.totalCents, intent, locale, lines, form]);

  async function nextFrom(step: StepKey) {
    const fields: Record<StepKey, string[]> = {
      contact: ["contact.email", "contact.phone"],
      delivery: [
        "delivery.recipient.name",
        "delivery.recipient.phone",
        "delivery.address.street1",
        "delivery.address.city",
        "delivery.address.state",
        "delivery.address.zip",
        "delivery.window.date",
        "delivery.window.slot",
        "delivery.cardMessage",
      ],
      payment: [],
    };
    const valid = await form.trigger(fields[step] as never);
    if (!valid) return;

    if (step === "delivery") {
      const items = resolved.map(resolvedLineToAnalyticsItem);
      trackAddShippingInfo("standard", items);
      const cardMessage = form.getValues("delivery.cardMessage") ?? "";
      trackRecipientInfoCompleted(cardMessage.trim().length > 0);
      trackAddPaymentInfo("card", items);

      // Create the PaymentIntent before showing step 3.
      setIntent({ status: "creating" });
      const r = await createIntent({ locale, lines, form: form.getValues() });
      if ("error" in r) {
        setIntent({ status: "error", message: r.error });
        setTopError(t(errorKey(r.error)));
        return;
      }
      setIntent({
        status: "ready",
        clientSecret: r.clientSecret,
        orderId: r.orderId,
        amountCents: totals.totalCents,
      });
    }
    setOpen(step === "contact" ? "delivery" : "payment");
  }

  async function onSubmit() {
    setTopError(null);
    setPaymentError(null);
    if (lines.length === 0) {
      setTopError(t("errors.cart_empty"));
      return;
    }
    if (intent.status !== "ready") {
      setTopError(t("errors.unknown_error"));
      return;
    }
    if (!stripeRef.current) {
      setTopError(t("errors.unknown_error"));
      return;
    }

    setSubmitting(true);
    const { stripe, elements } = stripeRef.current;
    const result = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/${locale}/order/${intent.orderId}/confirmation`,
      },
      redirect: "if_required",
    });

    if (result.error) {
      setSubmitting(false);
      setPaymentError(result.error.message ?? t("errors.unknown_error"));
      return;
    }

    // Success without redirect: navigate manually.
    clear();
    closeDrawer();
    router.push(`/${locale}/order/${intent.orderId}/confirmation`);
  }

  const leftPanel = (
    <OrderSummaryPanel
      items={resolved.map((r) => ({
        id: `${r.line.productId}-${r.line.variantId}`,
        name: r.product.title[locale],
        image: r.product.images[0].src,
        price: r.variant.priceCents,
        qty: r.line.qty,
      }))}
      subtotal={totals.subtotalCents}
      delivery={totals.deliveryCents}
      total={totals.totalCents}
      deliveryPending={deliveryPending}
      locale={locale}
      eyebrow={t("summary")}
    />
  );

  return (
    <FormShell left={leftPanel}>
      <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }} className="space-y-3">
        <Section
          title={`1. ${t("step_contact")}`}
          isOpen={open === "contact"}
          onHeaderClick={() => setOpen("contact")}
          reduce={!!reduce}
        >
          <ContactStep form={form} />
          <div className="pt-4">
            <Button type="button" variant="primary" size="md" onClick={() => nextFrom("contact")}>
              {t("continue")}
            </Button>
          </div>
        </Section>

        <Section
          title={`2. ${t("step_delivery")}`}
          isOpen={open === "delivery"}
          onHeaderClick={() => setOpen("delivery")}
          reduce={!!reduce}
        >
          <DeliveryStep form={form} />
          <div className="pt-4 flex gap-3">
            <Button type="button" variant="ghost" size="md" onClick={() => setOpen("contact")}>
              {t("back")}
            </Button>
            <Button
              type="button"
              variant="primary"
              size="md"
              disabled={intent.status === "creating"}
              onClick={() => nextFrom("delivery")}
            >
              {t("continue")}
            </Button>
          </div>
        </Section>

        <Section
          title={`3. ${t("step_payment")}`}
          isOpen={open === "payment"}
          onHeaderClick={() => setOpen("payment")}
          reduce={!!reduce}
        >
          {intent.status === "ready" && (
            <StripePaymentStep
              clientSecret={intent.clientSecret}
              onReady={handleStripeReady}
              errorMessage={paymentError}
            />
          )}
          {intent.status === "creating" && (
            <p className="font-mono text-[11px] text-ink/60">{t("payment_loading")}</p>
          )}
          {intent.status === "error" && (
            <p className="font-mono text-[11px] text-error">
              {t(errorKey(intent.message))}
            </p>
          )}
          {topError && <p className="font-mono text-[11px] text-error">{topError}</p>}
          <div className="pt-4 flex gap-3">
            <Button type="button" variant="ghost" size="md" onClick={() => setOpen("delivery")}>
              {t("back")}
            </Button>
            <FormSubmit loading={submitting} fullWidth={false}>
              {t("place_order")}
            </FormSubmit>
          </div>
        </Section>
      </form>
    </FormShell>
  );
}

function Section({
  title,
  isOpen,
  onHeaderClick,
  reduce,
  children,
}: {
  title: string;
  isOpen: boolean;
  onHeaderClick: () => void;
  reduce: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-ink/10 bg-bone/40 overflow-hidden">
      <button
        type="button"
        onClick={onHeaderClick}
        aria-expanded={isOpen}
        className="w-full flex items-center justify-between px-5 py-4 text-left"
      >
        <span className="font-display text-xl text-ink">{title}</span>
        <CaretDown size={16} className={`transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="body"
            initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={reduce ? { opacity: 1 } : { height: "auto", opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={reduce ? { duration: 0 } : springs.soft}
            className="overflow-hidden"
          >
            <div className="px-5 pb-6 space-y-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
