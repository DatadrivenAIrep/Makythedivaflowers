// components/inquiry/WeddingsForm.tsx
"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { HoneypotField } from "@/components/inquiry/HoneypotField";
import { Button } from "@/components/ui/Button";
import { weddingInquirySchema, type WeddingInquiry } from "@/schemas/inquiry";
import type { Locale } from "@/types/locale";

// The input type (before Zod transforms/coercion) is used for useForm field values.
// guests is a raw string from the input before z.coerce.number() transforms it.
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

  if (state === "success") {
    return (
      <div className="rounded-2xl border border-ink/10 bg-petal/30 p-10 text-center max-w-2xl mx-auto">
        <p className="font-display text-4xl text-ink leading-tight">{t("success_title")}</p>
        <p className="mt-4 text-ink/75">{t("success_body")}</p>
      </div>
    );
  }

  const errors = form.formState.errors;
  const watchedBudget = form.watch("budgetBand");

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="relative space-y-6 max-w-2xl mx-auto">
      <HoneypotField register={form.register("honeypot")} />
      <input type="hidden" {...form.register("type")} />
      <input type="hidden" {...form.register("locale")} />
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label={t("name")} required error={errors.contact?.name?.message} {...form.register("contact.name")} />
        <Field label={t("email")} type="email" required error={errors.contact?.email?.message} {...form.register("contact.email")} />
      </div>
      <Field label={t("phone")} type="tel" inputMode="tel" error={errors.contact?.phone?.message} {...form.register("contact.phone")} />
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label={t("date")} type="date" {...form.register("date")} />
        <Field label={t("venue")} placeholder="Glen Cove Mansion" {...form.register("venue")} />
      </div>
      <Field label={t("guests")} type="number" inputMode="numeric" min={1} max={2000} error={errors.guests?.message} {...form.register("guests")} />
      <fieldset>
        <legend className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink/60 mb-2">{t("budget")}</legend>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {BUDGETS.map((b) => (
            <label key={b} className={`cursor-pointer rounded-xl border px-3 py-3 text-center text-sm transition-colors ${
              watchedBudget === b ? "border-rouge bg-rouge/5 text-ink" : "border-ink/15 text-ink/70 hover:border-ink/30"
            }`}>
              <input type="radio" value={b} className="sr-only" {...form.register("budgetBand")} />
              {b}
            </label>
          ))}
        </div>
      </fieldset>
      <Textarea label={t("vibe")} required rows={5} error={errors.vibe?.message} {...form.register("vibe")} />
      <Field label={t("source")} error={errors.source?.message} {...form.register("source")} />
      {errorMsg && <p className="font-mono text-[11px] text-error">{t(`errors.${errorMsg}`)}</p>}
      <Button
        type="submit"
        variant="primary"
        size="lg"
        disabled={state === "submitting"}
        className="w-full"
      >
        {state === "submitting" ? t("submitting") : t("submit")}
      </Button>
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
