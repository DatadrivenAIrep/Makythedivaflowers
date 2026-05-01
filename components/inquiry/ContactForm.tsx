// components/inquiry/ContactForm.tsx
"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { HoneypotField } from "@/components/inquiry/HoneypotField";
import { MagneticButton } from "@/components/motion/MagneticButton";
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

  if (state === "success") {
    return (
      <div className="rounded-2xl border border-ink/10 bg-petal/30 p-10 text-center">
        <p className="font-display text-4xl text-ink leading-tight">{t("success_title")}</p>
        <p className="mt-4 text-ink/75">{t("success_body")}</p>
      </div>
    );
  }

  const errors = form.formState.errors;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="relative space-y-6">
      <HoneypotField register={form.register("honeypot")} />
      <input type="hidden" {...form.register("locale")} />
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label={t("name")} required error={errors.name?.message} {...form.register("name")} />
        <Field label={t("email")} type="email" required error={errors.email?.message} {...form.register("email")} />
      </div>
      <Field label={t("subject")} required error={errors.subject?.message} {...form.register("subject")} />
      <Textarea label={t("body")} required rows={6} error={errors.body?.message} {...form.register("body")} />
      {errorMsg && (
        <p className="font-mono text-[11px] text-error">{t(`errors.${errorMsg}` as Parameters<typeof t>[0])}</p>
      )}
      <MagneticButton
        type="submit"
        disabled={state === "submitting"}
        wrapperClassName="w-full"
      >
        {state === "submitting" ? t("submitting") : t("submit")}
      </MagneticButton>
    </form>
  );
}

type FieldProps = React.InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string };
function Field({ label, error, id, ...rest }: FieldProps) {
  const fid = id ?? `f-${label.replace(/\s+/g, "-").toLowerCase()}`;
  const errorId = error ? `${fid}-error` : undefined;
  return (
    <label htmlFor={fid} className="block">
      <span className="block font-mono text-[11px] uppercase tracking-[0.18em] text-ink/60 mb-1.5">{label}</span>
      <input
        id={fid}
        aria-describedby={errorId}
        aria-invalid={!!error}
        {...rest}
        className="block w-full rounded-xl border border-ink/15 bg-bone px-4 py-3 text-base text-ink focus:outline-none focus:ring-2 focus:ring-rouge/40 focus:border-rouge"
      />
      {error && <span id={errorId} className="mt-1 block font-mono text-[11px] text-error">{error}</span>}
    </label>
  );
}

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; error?: string };
function Textarea({ label, error, id, ...rest }: TextareaProps) {
  const fid = id ?? `f-${label.replace(/\s+/g, "-").toLowerCase()}`;
  const errorId = error ? `${fid}-error` : undefined;
  return (
    <label htmlFor={fid} className="block">
      <span className="block font-mono text-[11px] uppercase tracking-[0.18em] text-ink/60 mb-1.5">{label}</span>
      <textarea
        id={fid}
        aria-describedby={errorId}
        aria-invalid={!!error}
        {...rest}
        className="block w-full rounded-xl border border-ink/15 bg-bone px-4 py-3 text-base text-ink focus:outline-none focus:ring-2 focus:ring-rouge/40 focus:border-rouge resize-none"
      />
      {error && <span id={errorId} className="mt-1 block font-mono text-[11px] text-error">{error}</span>}
    </label>
  );
}
