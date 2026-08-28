// components/checkout/ContactStep.tsx
"use client";
import type { UseFormReturn } from "react-hook-form";
import { useTranslations, useLocale } from "next-intl";
import { FormField } from "@/components/ui/form/FormField";
import { TextInput } from "@/components/ui/form/TextInput";
import type { CheckoutInput } from "@/schemas/checkout";

type Props = { form: UseFormReturn<CheckoutInput> };

export function ContactStep({ form }: Props) {
  const t = useTranslations("checkout");
  const locale = useLocale();
  const { register, formState } = form;
  const errors = formState.errors.contact;
  return (
    <div className="space-y-5 max-w-md">
      <FormField label={t("email")} htmlFor="ck-email" required
        error={errors?.email ? t(`errors.${errors.email.message ?? "email_invalid"}`) : undefined}>
        <TextInput id="ck-email" type="email" autoComplete="email"
          aria-invalid={!!errors?.email || undefined}
          {...register("contact.email")} />
      </FormField>
      <FormField label={t("phone")} htmlFor="ck-phone" required
        error={errors?.phone ? t(`errors.${errors.phone.message ?? "phone_too_short"}`) : undefined}>
        <TextInput id="ck-phone" type="tel" inputMode="tel" autoComplete="tel"
          aria-invalid={!!errors?.phone || undefined}
          {...register("contact.phone")} />
      </FormField>
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          className="mt-1 h-5 w-5 shrink-0 accent-rouge"
          {...register("smsConsent")}
        />
        <span className="text-sm text-ink">
          <span className="font-medium">{t("consent_label")}</span>
          <span className="mt-1 block text-xs text-ink/60">{t("consent_fine")}</span>
          <span className="mt-1 block text-xs">
            <a href={`/${locale}/legal/terms`} target="_blank" rel="noopener noreferrer" className="underline">
              {t("consent_terms")}
            </a>
            {" · "}
            <a href={`/${locale}/legal/privacy`} target="_blank" rel="noopener noreferrer" className="underline">
              {t("consent_privacy")}
            </a>
          </span>
        </span>
      </label>
    </div>
  );
}
