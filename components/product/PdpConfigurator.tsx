"use client";
import { memo, useMemo, useState } from "react";
import type { Locale } from "@/types/locale";
import type { Product, SubscriptionCadence as Cadence } from "@/types/product";
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
};

function PdpConfiguratorImpl({ product, locale, cutoff, motionMode }: Props) {
  void motionMode;
  const [variantId, setVariantId] = useState(product.variants[0]?.id ?? "");
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

      <CardMessage locale={locale} value={message} onChange={setMessage} />

      <AddToBag
        productId={product.id}
        variantId={variantId}
        addOnIds={addOnIds}
        totalCents={totalCents}
        disabled={!variantId || !date}
        locale={locale}
      />
    </div>
  );
}

export const PdpConfigurator = memo(PdpConfiguratorImpl);
