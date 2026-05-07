// components/checkout/DeliveryStep.tsx
"use client";
import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { UseFormReturn } from "react-hook-form";
import { FormField } from "@/components/ui/form/FormField";
import { TextInput } from "@/components/ui/form/TextInput";
import { DateInput } from "@/components/ui/form/DateInput";
import { RadioChips } from "@/components/ui/form/RadioChips";
import type { CheckoutInput } from "@/schemas/checkout";
import { trackDeliveryDateSelected } from "@/lib/analytics";
import { SITE } from "@/data/site";

const SLOTS = ["morning", "midday", "afternoon", "evening"] as const;

export function DeliveryStep({ form }: { form: UseFormReturn<CheckoutInput> }) {
  const t = useTranslations("checkout");
  const { register, formState, watch, setValue } = form;
  const min = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today.toISOString().slice(0, 10);
  }, []);
  const method = watch("delivery.method");
  const isPickup = method === "pickup";
  const errors = formState.errors.delivery;
  const addressErrors = !isPickup ? (errors as { address?: Record<string, { message?: string }> } | undefined)?.address : undefined;
  const recipientErrors = (errors as { recipient?: { name?: { message?: string }; phone?: { message?: string } } } | undefined)?.recipient;
  const windowErrors = (errors as { window?: { date?: { message?: string }; slot?: { message?: string } } } | undefined)?.window;
  const selectedSlot = watch("delivery.window.slot");
  const slotItems = SLOTS.map((s) => ({ value: s, label: t(`slot_${s}`) }));

  return (
    <div className="space-y-6 max-w-md">
      <FormField label={t("fulfillment_label")} htmlFor="ck-fulfillment">
        <RadioChips
          name="delivery.method"
          items={[
            { value: "delivery", label: t("fulfillment_delivery") },
            { value: "pickup", label: t("fulfillment_pickup") },
          ]}
          value={method ?? "delivery"}
          onChange={(v) => setValue("delivery.method", v as "delivery" | "pickup", { shouldValidate: true })}
          cols={2}
        />
      </FormField>

      <div className="grid sm:grid-cols-2 gap-5">
        <FormField label={t("recipient_name")} htmlFor="ck-rname" required
          error={recipientErrors?.name ? t("errors.name_too_short") : undefined}>
          <TextInput id="ck-rname" aria-invalid={!!recipientErrors?.name || undefined} {...register("delivery.recipient.name")} />
        </FormField>
        <FormField label={t("recipient_phone")} htmlFor="ck-rphone" required
          error={recipientErrors?.phone ? t("errors.phone_too_short") : undefined}>
          <TextInput id="ck-rphone" type="tel" inputMode="tel"
            aria-invalid={!!recipientErrors?.phone || undefined} {...register("delivery.recipient.phone")} />
        </FormField>
      </div>

      {isPickup ? (
        <div className="rounded-2xl border border-ink/10 bg-bone/60 p-5 space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
            {t("pickup_at")}
          </p>
          <p className="font-display text-lg text-ink">
            {SITE.brand}
          </p>
          <p className="text-sm text-ink/80">
            {SITE.address.line1}<br />
            {SITE.address.locality}, {SITE.address.region} {SITE.address.postal}
          </p>
          <ul className="font-mono text-[11px] text-ink/65 mt-2 space-y-0.5">
            {SITE.hours.map((h) => (
              <li key={h.day}>{h.day} · {h.value}</li>
            ))}
          </ul>
        </div>
      ) : (
        <>
          <FormField label={t("address_street1")} htmlFor="ck-street1" required
            error={addressErrors?.street1 ? t("errors.street_required") : undefined}>
            <TextInput id="ck-street1" autoComplete="address-line1"
              aria-invalid={!!addressErrors?.street1 || undefined} {...register("delivery.address.street1")} />
          </FormField>
          <FormField label={t("address_street2")} htmlFor="ck-street2">
            <TextInput id="ck-street2" autoComplete="address-line2" {...register("delivery.address.street2")} />
          </FormField>
          <div className="grid sm:grid-cols-3 gap-5">
            <FormField label={t("address_city")} htmlFor="ck-city" required
              error={addressErrors?.city ? t("errors.city_required") : undefined}>
              <TextInput id="ck-city" autoComplete="address-level2"
                aria-invalid={!!addressErrors?.city || undefined} {...register("delivery.address.city")} />
            </FormField>
            <FormField label={t("address_state")} htmlFor="ck-state" required
              error={addressErrors?.state ? t("errors.state_invalid") : undefined}>
              <TextInput id="ck-state" maxLength={2} autoComplete="address-level1"
                aria-invalid={!!addressErrors?.state || undefined} {...register("delivery.address.state")} />
            </FormField>
            <FormField label={t("address_zip")} htmlFor="ck-zip" required
              error={addressErrors?.zip ? t("errors.zip_invalid") : undefined}>
              <TextInput id="ck-zip" inputMode="numeric" autoComplete="postal-code"
                aria-invalid={!!addressErrors?.zip || undefined} {...register("delivery.address.zip")} />
            </FormField>
          </div>
          <input type="hidden" value="US" {...register("delivery.address.country")} />
        </>
      )}

      <FormField label={isPickup ? t("pickup_date") : t("delivery_date")} htmlFor="ck-date"
        error={windowErrors?.date ? t("errors.date_invalid") : undefined}>
        {(() => {
          const dateReg = register("delivery.window.date");
          return (
            <DateInput
              id="ck-date"
              min={min}
              aria-invalid={!!windowErrors?.date || undefined}
              {...dateReg}
              onBlur={(e) => {
                dateReg.onBlur(e);
                const value = e.target.value;
                if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
                  trackDeliveryDateSelected(value);
                }
              }}
            />
          );
        })()}
      </FormField>
      <FormField label={isPickup ? t("pickup_window") : t("delivery_window")} htmlFor="ck-window">
        <RadioChips
          aria-labelledby="ck-window-label"
          name="delivery.window.slot"
          items={slotItems}
          value={selectedSlot ?? ""}
          onChange={(v) => setValue("delivery.window.slot", v as typeof SLOTS[number])}
          cols={4}
        />
      </FormField>
      <FormField label={t("card_message")} htmlFor="ck-card" help={t("card_message_hint")}>
        <TextInput id="ck-card" maxLength={200} {...register("delivery.cardMessage")} />
      </FormField>
    </div>
  );
}
