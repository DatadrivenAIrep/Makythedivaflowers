"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { HoneypotField } from "@/components/inquiry/HoneypotField";
import { FormShell } from "@/components/ui/form/shell/FormShell";
import { EditorialPanel } from "@/components/ui/form/shell/EditorialPanel";
import { FormSuccess } from "@/components/ui/form/shell/FormSuccess";
import { FormField } from "@/components/ui/form/FormField";
import { TextInput } from "@/components/ui/form/TextInput";
import { TextArea } from "@/components/ui/form/TextArea";
import { FormSubmit } from "@/components/ui/form/FormSubmit";
import { contactSchema, type ContactInput } from "@/schemas/contact";
import type { Locale } from "@/types/locale";

export function ContactForm({ locale }: { locale: Locale }) {
  const t = useTranslations("contact.form");
  const [state, setState] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const form = useForm<ContactInput>({
    resolver: zodResolver(contactSchema),
    mode: "onBlur",
    defaultValues: {
      name: "",
      email: "",
      subject: "",
      body: "",
      locale,
      honeypot: "",
    },
  });

  async function onSubmit(values: ContactInput) {
    setState("submitting");
    const res = await fetch("/api/contact", {
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

  return (
    <FormShell
      left={
        <EditorialPanel
          eyebrow={t("shell.eyebrow")}
          title={t("shell.title")}
          body={t("shell.body")}
          signature={t("shell.signature")}
        />
      }
    >
      {state === "success" ? (
        <FormSuccess title={t("success_title")} body={t("success_body")} />
      ) : (
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-md">
          <HoneypotField register={form.register("honeypot")} />
          <input type="hidden" {...form.register("locale")} />
          <div className="grid sm:grid-cols-2 gap-5">
            <FormField label={t("name")} htmlFor="contact-name" required error={errors.name?.message}>
              <TextInput
                id="contact-name"
                aria-invalid={!!errors.name || undefined}
                {...form.register("name")}
              />
            </FormField>
            <FormField label={t("email")} htmlFor="contact-email" required error={errors.email?.message}>
              <TextInput
                id="contact-email"
                type="email"
                aria-invalid={!!errors.email || undefined}
                {...form.register("email")}
              />
            </FormField>
          </div>
          <FormField label={t("subject")} htmlFor="contact-subject" required error={errors.subject?.message}>
            <TextInput
              id="contact-subject"
              aria-invalid={!!errors.subject || undefined}
              {...form.register("subject")}
            />
          </FormField>
          <FormField label={t("body")} htmlFor="contact-body" required error={errors.body?.message}>
            <TextArea
              id="contact-body"
              rows={6}
              aria-invalid={!!errors.body || undefined}
              {...form.register("body")}
            />
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
