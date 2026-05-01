// components/checkout/DeliveryStep.tsx
"use client";
import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { UseFormReturn } from "react-hook-form";
import type { CheckoutInput } from "@/schemas/checkout";
// lib/delivery.ts does not export earliestAvailableDate; min date computed inline below.

const SLOTS = ["morning", "midday", "afternoon", "evening"] as const;

export function DeliveryStep({ form }: { form: UseFormReturn<CheckoutInput> }) {
  const t = useTranslations("checkout");
  const { register, formState, watch } = form;
  const min = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today.toISOString().slice(0, 10);
  }, []);
  const errors = formState.errors.delivery;
  const selectedSlot = watch("delivery.window.slot");

  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label={t("recipient_name")} required {...register("delivery.recipient.name")}
          error={errors?.recipient?.name && t("errors.name_too_short")} />
        <Field label={t("recipient_phone")} type="tel" inputMode="tel" required {...register("delivery.recipient.phone")}
          error={errors?.recipient?.phone && t("errors.phone_too_short")} />
      </div>
      <Field label={t("address_street1")} required autoComplete="address-line1" {...register("delivery.address.street1")}
        error={errors?.address?.street1 && t("errors.street_required")} />
      <Field label={t("address_street2")} autoComplete="address-line2" {...register("delivery.address.street2")} />
      <div className="grid sm:grid-cols-3 gap-4">
        <Field label={t("address_city")} required autoComplete="address-level2" {...register("delivery.address.city")}
          error={errors?.address?.city && t("errors.city_required")} />
        <Field label={t("address_state")} required maxLength={2} autoComplete="address-level1" {...register("delivery.address.state")}
          error={errors?.address?.state && t("errors.state_invalid")} />
        <Field label={t("address_zip")} required inputMode="numeric" autoComplete="postal-code" {...register("delivery.address.zip")}
          error={errors?.address?.zip && t("errors.zip_invalid")} />
      </div>
      <input type="hidden" value="US" {...register("delivery.address.country")} />
      <div>
        <p className="block font-mono text-[11px] uppercase tracking-[0.18em] text-ink/60 mb-2">{t("delivery_date")}</p>
        <input
          type="date"
          min={min}
          {...register("delivery.window.date")}
          className="rounded-xl border border-ink/15 bg-bone px-4 py-3 font-mono text-sm text-ink focus:outline-none focus:ring-2 focus:ring-rouge/40 focus:border-rouge"
        />
        {errors?.window?.date && (
          <span className="mt-1 block font-mono text-[11px] text-error">{t("errors.date_invalid")}</span>
        )}
      </div>
      <fieldset>
        <legend className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink/60 mb-2">
          {t("delivery_window")}
        </legend>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {SLOTS.map((slot) => {
            const isActive = selectedSlot === slot;
            return (
              <label
                key={slot}
                className={`cursor-pointer rounded-xl border px-3 py-3 text-center transition-colors ${
                  isActive ? "border-rouge bg-rouge/5 text-ink" : "border-ink/15 text-ink/70 hover:border-ink/30"
                }`}
              >
                <input
                  type="radio"
                  value={slot}
                  className="sr-only"
                  {...register("delivery.window.slot")}
                />
                <span className="font-mono text-[11px] uppercase tracking-[0.18em]">{t(`slot_${slot}`)}</span>
              </label>
            );
          })}
        </div>
      </fieldset>
      <div>
        <Field
          label={t("card_message")}
          maxLength={200}
          {...register("delivery.cardMessage")}
        />
        <p className="mt-1 font-mono text-[10px] text-ink/50">{t("card_message_hint")}</p>
      </div>
    </div>
  );
}

type FieldProps = React.InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string | false };
function Field({ label, error, id, ...rest }: FieldProps) {
  const fid = id ?? `f-${label.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <label htmlFor={fid} className="block">
      <span className="block font-mono text-[11px] uppercase tracking-[0.18em] text-ink/60 mb-1.5">{label}</span>
      <input
        id={fid}
        {...rest}
        className="block w-full rounded-xl border border-ink/15 bg-bone px-4 py-3 text-base text-ink focus:outline-none focus:ring-2 focus:ring-rouge/40 focus:border-rouge"
      />
      {error && <span className="mt-1 block font-mono text-[11px] text-error">{error}</span>}
    </label>
  );
}
