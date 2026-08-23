"use client";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import type { Locale } from "@/types/locale";
import type { Product, SubscriptionCadence as Cadence } from "@/types/product";
import type { Occasion } from "@/schemas/card-message";
import { VariantChips } from "./VariantChips";
import { AddOnToggles } from "./AddOnToggles";
import { DeliveryDatePicker } from "./DeliveryDatePicker";
import { CardMessage } from "./CardMessage";
import { SubscriptionCadence as CadencePicker } from "./SubscriptionCadence";
import { AddToBag } from "./AddToBag";
import { RequestQuote } from "./RequestQuote";

type Props = {
  product: Product;
  locale: Locale;
  cutoff: string;
  motionMode: "default" | "sympathy";
  campaign?: Occasion;
};

function PdpConfiguratorImpl({ product, locale, cutoff, motionMode, campaign }: Props) {
  void motionMode;
  const isSympathy = product.category === "sympathy";
  const defaultVariantId = useMemo(() => {
    const middle = product.variants.find((v) => v.id === "lush");
    return middle?.id ?? product.variants[0]?.id ?? "";
  }, [product]);
  const [variantId, setVariantId] = useState(defaultVariantId);
  const [addOnIds, setAddOnIds] = useState<string[]>([]);
  const [date, setDate] = useState("");
  const [message, setMessage] = useState("");
  const isSubscription = product.category === "subscriptions" && Boolean(product.subscription);
  const [cadence, setCadence] = useState<Cadence>(
    product.subscription?.cadences[0] ?? "weekly",
  );

  // Apple sticky-CTA pattern: the mobile bar only appears once the inline
  // AddToBag has scrolled out of view, so it never sits permanently on top
  // of the footer's legal links (see components/product/PdpConfigurator.tsx
  // sticky bar below).
  const inlineRef = useRef<HTMLDivElement>(null);
  const [inlineInView, setInlineInView] = useState(true);

  useEffect(() => {
    if (!inlineRef.current || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setInlineInView(entry.isIntersecting));
    observer.observe(inlineRef.current);
    return () => observer.disconnect();
  }, []);

  const totalCents = useMemo(() => {
    const v = product.variants.find((x) => x.id === variantId)?.priceCents ?? 0;
    const adds =
      product.addOns?.filter((a) => addOnIds.includes(a.id)).reduce((s, a) => s + a.priceCents, 0) ?? 0;
    return v + adds;
  }, [product, variantId, addOnIds]);

  // Quote-only pieces are showcased, not sold from the cart: skip size/date/
  // card-message/add-to-bag and offer a "request a quote" CTA instead.
  if (product.quoteOnly) {
    return (
      <div className="mt-8 flex flex-col gap-4">
        <RequestQuote locale={locale} />
        <p className="max-w-md text-[13px] leading-relaxed text-ink/60">
          {locale === "es"
            ? "Pieza a la medida — te enviamos precio y disponibilidad por WhatsApp o texto."
            : "Made-to-order piece — we'll send price and availability by WhatsApp or text."}
        </p>
      </div>
    );
  }

  return (
    <div className="mt-8 flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <p className="font-mono text-[10px] uppercase tracking-wider text-mute-500">
          {locale === "es" ? "Tamaño" : "Size"}
        </p>
        <VariantChips product={product} locale={locale} value={variantId} onChange={setVariantId} />
      </div>

      {isSubscription && product.subscription && (
        <CadencePicker
          locale={locale}
          cadences={product.subscription.cadences}
          value={cadence}
          onChange={setCadence}
        />
      )}

      <AddOnToggles product={product} locale={locale} value={addOnIds} onChange={setAddOnIds} />

      <div className="flex flex-col gap-2">
        {isSubscription && (
          <p className="font-mono text-[10px] uppercase tracking-wider text-mute-500">
            {locale === "es" ? "Primera entrega" : "First delivery"}
          </p>
        )}
        <DeliveryDatePicker locale={locale} cutoff={cutoff} value={date} onChange={setDate} />
      </div>

      <CardMessage
        locale={locale}
        value={message}
        onChange={setMessage}
        productTitle={product.title[locale]}
        occasions={product.occasions}
        isSympathy={isSympathy}
        campaign={campaign}
      />

      <div ref={inlineRef}>
        <AddToBag
          productId={product.id}
          variantId={variantId}
          addOnIds={addOnIds}
          totalCents={totalCents}
          disabled={!variantId || !date}
          locale={locale}
          cardMessage={message}
        />
      </div>

      {/* Mobile-only sticky buy bar — shown only while the inline AddToBag
          above is scrolled out of view, so it never permanently covers the
          footer's legal links at the bottom of the page. Desktop keeps the
          sticky column instead. */}
      {!inlineInView && (
        <div
          className="lg:hidden fixed inset-x-0 bottom-0 z-40 px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3
                     [background:var(--material-bg-strong)]
                     [backdrop-filter:blur(var(--material-blur))_saturate(var(--material-saturate))]
                     [-webkit-backdrop-filter:blur(var(--material-blur))_saturate(var(--material-saturate))]
                     [box-shadow:inset_0_1px_0_var(--material-edge),0_-8px_30px_-24px_rgb(14_13_12/0.5)]"
        >
          <AddToBag
            productId={product.id}
            variantId={variantId}
            addOnIds={addOnIds}
            totalCents={totalCents}
            disabled={!variantId || !date}
            locale={locale}
            cardMessage={message}
          />
        </div>
      )}
    </div>
  );
}

export const PdpConfigurator = memo(PdpConfiguratorImpl);
