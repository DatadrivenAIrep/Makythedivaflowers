// components/checkout/CheckoutShell.tsx
"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { CaretDown } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/Button";
import { ContactStep } from "@/components/checkout/ContactStep";
import { DeliveryStep } from "@/components/checkout/DeliveryStep";
import { PaymentStub } from "@/components/checkout/PaymentStub";
import { FormShell } from "@/components/ui/form/shell/FormShell";
import { OrderSummaryPanel } from "@/components/checkout/OrderSummaryPanel";
import { FormSubmit } from "@/components/ui/form/FormSubmit";
import { useCartStore } from "@/lib/cart-store";
import { useUIStore } from "@/lib/ui-store";
import { submitOrder } from "@/lib/submit-order";
import { checkoutSchema, type CheckoutInput } from "@/schemas/checkout";
import { resolveCartLines, cartSubtotalCents } from "@/lib/cart-helpers";
import { computeOrderTotals } from "@/lib/totals";
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

export function CheckoutShell({ locale }: { locale: Locale }) {
  const t = useTranslations("checkout");
  const router = useRouter();
  const reduce = useReducedMotion();
  const lines = useCartStore((s) => s.lines);
  const clear = useCartStore((s) => s.clear);
  const closeDrawer = useUIStore((s) => s.closeDrawer);

  const resolved = useMemo(() => resolveCartLines(lines, PRODUCTS), [lines]);
  const subtotal = useMemo(() => cartSubtotalCents(lines, PRODUCTS), [lines]);
  const totals = useMemo(() => computeOrderTotals(subtotal), [subtotal]);

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
    }
    setOpen(step === "contact" ? "delivery" : "payment");
  }

  async function onSubmit(values: CheckoutInput) {
    trackAddPaymentInfo("card", resolved.map(resolvedLineToAnalyticsItem));
    setTopError(null);
    if (lines.length === 0) {
      setTopError(t("errors.cart_empty"));
      return;
    }
    setSubmitting(true);
    const r = await submitOrder({ locale, lines, form: values });
    setSubmitting(false);
    if (!r.ok) {
      setTopError(t("errors.unknown_error"));
      return;
    }
    clear();
    closeDrawer();
    router.push(`/${locale}/order/${r.id}/confirmation`);
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
      locale={locale}
      eyebrow={t("summary")}
    />
  );

  return (
    <FormShell left={leftPanel}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
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
            <Button type="button" variant="primary" size="md" onClick={() => nextFrom("delivery")}>
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
          <PaymentStub submitting={submitting} />
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
