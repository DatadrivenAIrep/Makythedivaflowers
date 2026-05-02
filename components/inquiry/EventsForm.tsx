"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { HoneypotField } from "@/components/inquiry/HoneypotField";
import { FormShell } from "@/components/ui/form/shell/FormShell";
import { EditorialPanel } from "@/components/ui/form/shell/EditorialPanel";
import { FormSuccess } from "@/components/ui/form/shell/FormSuccess";
import { FormField } from "@/components/ui/form/FormField";
import { TextInput } from "@/components/ui/form/TextInput";
import { TextArea } from "@/components/ui/form/TextArea";
import { RadioChips } from "@/components/ui/form/RadioChips";
import { FormSubmit } from "@/components/ui/form/FormSubmit";
import { eventInquirySchema, type EventInquiry } from "@/schemas/inquiry";
import type { Locale } from "@/types/locale";

type EventInquiryInput = z.input<typeof eventInquirySchema>;
const FREQUENCIES = ["one-time", "weekly", "biweekly", "monthly", "quarterly"] as const;
const BUDGETS = ["5-10k", "10-25k", "25k+", "open"] as const;

export function EventsForm({ locale }: { locale: Locale }) {
  const t = useTranslations("events.form");
  const [state, setState] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const form = useForm<EventInquiryInput, unknown, EventInquiry>({
    resolver: zodResolver(eventInquirySchema),
    mode: "onBlur",
    defaultValues: {
      type: "event",
      contact: { name: "", email: "", phone: "" },
      company: "",
      frequency: "one-time",
      budgetBand: "open",
      vibe: "",
      locale,
      honeypot: "",
    },
  });

  async function onSubmit(values: EventInquiry) {
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
  const watchedFreq = form.watch("frequency");
  const watchedBudget = form.watch("budgetBand");

  const freqItems = FREQUENCIES.map((f) => ({
    value: f,
    label: t(`freq_${f}` as Parameters<typeof t>[0]),
  }));
  const budgetItems = BUDGETS.map((b) => ({
    value: b,
    label: t(`budget_${b}` as Parameters<typeof t>[0]),
  }));

  return (
    <FormShell
      left={
        <EditorialPanel
          eyebrow={t("shell.eyebrow")}
          title={t("shell.title")}
          body={t("shell.body")}
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
            <FormField label={t("name")} htmlFor="e-name" required error={errors.contact?.name?.message}>
              <TextInput id="e-name" aria-invalid={!!errors.contact?.name || undefined} {...form.register("contact.name")} />
            </FormField>
            <FormField label={t("email")} htmlFor="e-email" required error={errors.contact?.email?.message}>
              <TextInput id="e-email" type="email" aria-invalid={!!errors.contact?.email || undefined} {...form.register("contact.email")} />
            </FormField>
          </div>

          <FormField label={t("phone")} htmlFor="e-phone" error={errors.contact?.phone?.message}>
            <TextInput id="e-phone" type="tel" inputMode="tel" {...form.register("contact.phone")} />
          </FormField>

          <FormField label={t("company")} htmlFor="e-company" required error={errors.company?.message}>
            <TextInput id="e-company" {...form.register("company")} />
          </FormField>

          <FormField label={t("frequency")} htmlFor="e-frequency" error={errors.frequency?.message}>
            <RadioChips
              aria-labelledby="e-frequency-label"
              name="frequency"
              items={freqItems}
              cols={3}
              value={watchedFreq}
              onChange={(v) => form.setValue("frequency", v as typeof FREQUENCIES[number])}
            />
          </FormField>

          <FormField label={t("budget")} htmlFor="e-budget" error={errors.budgetBand?.message}>
            <RadioChips
              aria-labelledby="e-budget-label"
              name="budgetBand"
              items={budgetItems}
              value={watchedBudget}
              onChange={(v) => form.setValue("budgetBand", v as typeof BUDGETS[number])}
            />
          </FormField>

          <FormField label={t("brief")} htmlFor="e-brief" required error={errors.vibe?.message}>
            <TextArea id="e-brief" rows={5} aria-invalid={!!errors.vibe || undefined} {...form.register("vibe")} />
          </FormField>

          {errorMsg && (
            <p role="alert" className="font-mono text-[11px] text-error">
              {t(`errors.${errorMsg}` as Parameters<typeof t>[0])}
            </p>
          )}

          <FormSubmit loading={state === "submitting"}>
            {state === "submitting" ? t("submitting") : t("submit")}
          </FormSubmit>
        </form>
      )}
    </FormShell>
  );
}
