"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { HoneypotField } from "@/components/inquiry/HoneypotField";
import { FormShell } from "@/components/ui/form/shell/FormShell";
import { PhotoPanel } from "@/components/ui/form/shell/PhotoPanel";
import { FormSuccess } from "@/components/ui/form/shell/FormSuccess";
import { FormField } from "@/components/ui/form/FormField";
import { Disclosure } from "@/components/ui/form/Disclosure";
import { TextInput } from "@/components/ui/form/TextInput";
import { TextArea } from "@/components/ui/form/TextArea";
import { DateInput } from "@/components/ui/form/DateInput";
import { RadioChips } from "@/components/ui/form/RadioChips";
import { FormSubmit } from "@/components/ui/form/FormSubmit";
import { weddingInquirySchema, type WeddingInquiry } from "@/schemas/inquiry";
import type { Locale } from "@/types/locale";

type WeddingInquiryInput = z.input<typeof weddingInquirySchema>;
const BUDGETS = ["5-10k", "10-25k", "25k+", "open"] as const;

export function WeddingsForm({ locale }: { locale: Locale }) {
  const t = useTranslations("weddings.form");
  const [state, setState] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const form = useForm<WeddingInquiryInput, unknown, WeddingInquiry>({
    resolver: zodResolver(weddingInquirySchema),
    mode: "onBlur",
    defaultValues: {
      type: "wedding",
      contact: { name: "", email: "", phone: "" },
      date: "",
      venue: "",
      guests: undefined,
      budgetBand: "open",
      vibe: "",
      source: "",
      locale,
      honeypot: "",
    },
  });

  async function onSubmit(values: WeddingInquiry) {
    setState("submitting");
    const res = await fetch("/api/inquiry", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErrorMsg(data?.errors?.formErrors?.[0] ?? "unknown_error");
      setState("error");
      return;
    }
    setState("success");
    form.reset();
  }

  const errors = form.formState.errors;
  const watchedBudget = form.watch("budgetBand");

  const budgetItems = BUDGETS.map((b) => ({ value: b, label: b }));

  return (
    <FormShell
      left={
        <PhotoPanel
          src="/weddings/05.webp"
          alt={t("shell.alt")}
          eyebrow={t("shell.eyebrow")}
          title={t("shell.title")}
          body={t("shell.body")}
          signature={t("shell.signature")}
          priority
        />
      }
    >
      {state === "success" ? (
        <FormSuccess title={t("success_title")} body={t("success_body")} />
      ) : (
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-md">
          <HoneypotField register={form.register("honeypot")} />
          <input type="hidden" {...form.register("type")} />
          <input type="hidden" {...form.register("locale")} />

          <div className="grid sm:grid-cols-2 gap-5">
            <FormField label={t("name")} htmlFor="w-name" required error={errors.contact?.name?.message}>
              <TextInput id="w-name" aria-invalid={!!errors.contact?.name || undefined} {...form.register("contact.name")} />
            </FormField>
            <FormField label={t("email")} htmlFor="w-email" required error={errors.contact?.email?.message}>
              <TextInput id="w-email" type="email" aria-invalid={!!errors.contact?.email || undefined} {...form.register("contact.email")} />
            </FormField>
          </div>

          <FormField label={t("phone")} htmlFor="w-phone" required error={errors.contact?.phone?.message}>
            <TextInput id="w-phone" type="tel" inputMode="tel" aria-invalid={!!errors.contact?.phone || undefined} {...form.register("contact.phone")} />
          </FormField>

          <FormField label={t("vibe")} htmlFor="w-vibe" required error={errors.vibe?.message}>
            <TextArea id="w-vibe" rows={5} aria-invalid={!!errors.vibe || undefined} {...form.register("vibe")} />
          </FormField>

          <Disclosure summary={t("more_details")}>
            <div className="grid sm:grid-cols-2 gap-5">
              <FormField label={t("date")} htmlFor="w-date">
                <DateInput id="w-date" {...form.register("date")} />
              </FormField>
              <FormField label={t("venue")} htmlFor="w-venue">
                <TextInput id="w-venue" placeholder="Glen Cove Mansion" {...form.register("venue")} />
              </FormField>
            </div>

            <FormField label={t("guests")} htmlFor="w-guests" error={errors.guests?.message}>
              <TextInput
                id="w-guests"
                type="number"
                inputMode="numeric"
                min={1}
                max={2000}
                aria-invalid={!!errors.guests || undefined}
                {...form.register("guests")}
              />
            </FormField>

            <FormField label={t("budget")} htmlFor="w-budget">
              <RadioChips
                name="budgetBand"
                items={budgetItems}
                value={watchedBudget}
                onChange={(v) => form.setValue("budgetBand", v as typeof BUDGETS[number])}
              />
            </FormField>

            <FormField label={t("source")} htmlFor="w-source" error={errors.source?.message}>
              <TextInput id="w-source" {...form.register("source")} />
            </FormField>
          </Disclosure>

          {errorMsg && (
            <p role="alert" className="font-mono text-[11px] text-error">{t(`errors.${errorMsg}`)}</p>
          )}

          <FormSubmit loading={state === "submitting"}>
            {state === "submitting" ? t("submitting") : t("submit")}
          </FormSubmit>
        </form>
      )}
    </FormShell>
  );
}
