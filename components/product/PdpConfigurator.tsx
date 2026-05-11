"use client";
import { memo, useMemo, useState } from "react";
import type { Locale } from "@/types/locale";
import type { Product, SubscriptionCadence as Cadence } from "@/types/product";
import type { Occasion } from "@/schemas/card-message";
import { VariantChips } from "./VariantChips";
import { AddOnToggles } from "./AddOnToggles";
import { DeliveryDatePicker } from "./DeliveryDatePicker";
import { CardMessage } from "./CardMessage";
import { SubscriptionCadence as CadencePicker } from "./SubscriptionCadence";
import { AddToBag } from "./AddToBag";

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

  const totalCents = useMemo(() => {
    const v = product.variants.find((x) => x.id === variantId)?.priceCents ?? 0;
    const adds =
      product.addOns?.filter((a) => addOnIds.includes(a.id)).reduce((s, a) => s + a.priceCents, 0) ?? 0;
    return v + adds;
  }, [product, variantId, addOnIds]);

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
  );
}

export const PdpConfigurator = memo(PdpConfiguratorImpl);
