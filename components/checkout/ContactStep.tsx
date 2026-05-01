// components/checkout/ContactStep.tsx
"use client";
import type { UseFormReturn } from "react-hook-form";
import { useTranslations } from "next-intl";
import type { CheckoutInput } from "@/schemas/checkout";

type Props = { form: UseFormReturn<CheckoutInput> };

export function ContactStep({ form }: Props) {
  const t = useTranslations("checkout");
  const { register, formState } = form;
  const errors = formState.errors.contact;
  return (
    <div className="space-y-5">
      <Field
        label={t("email")}
        error={errors?.email && t(`errors.${errors.email.message ?? "email_invalid"}`)}
        type="email"
        autoComplete="email"
        required
        {...register("contact.email")}
      />
      <Field
        label={t("phone")}
        error={errors?.phone && t(`errors.${errors.phone.message ?? "phone_too_short"}`)}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        required
        {...register("contact.phone")}
      />
    </div>
  );
}

type FieldProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string | false;
};
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
