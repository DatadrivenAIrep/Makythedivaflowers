// components/inquiry/EventsForm.tsx
"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { HoneypotField } from "@/components/inquiry/HoneypotField";
import { MagneticButton } from "@/components/motion/MagneticButton";
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

  if (state === "success") {
    return (
      <div className="rounded-2xl border border-ink/10 bg-petal/30 p-10 text-center max-w-2xl mx-auto">
        <p className="font-display text-4xl text-ink leading-tight">{t("success_title")}</p>
        <p className="mt-4 text-ink/75">{t("success_body")}</p>
      </div>
    );
  }

  const errors = form.formState.errors;
  const watchedFreq = form.watch("frequency");
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
      <Field label={t("company")} required error={errors.company?.message} {...form.register("company")} />
      <fieldset aria-describedby={errors.frequency ? "frequency-error" : undefined}>
        <legend className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink/60 mb-2">{t("frequency")}</legend>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {FREQUENCIES.map((f) => (
            <label key={f} className={`cursor-pointer rounded-xl border px-3 py-3 text-center text-sm transition-colors ${
              watchedFreq === f ? "border-rouge bg-rouge/5 text-ink" : "border-ink/15 text-ink/70 hover:border-ink/30"
            }`}>
              <input type="radio" value={f} className="sr-only" {...form.register("frequency")} />
              {t(`freq_${f}` as Parameters<typeof t>[0])}
            </label>
          ))}
        </div>
        {errors.frequency && (
          <p id="frequency-error" className="mt-1 font-mono text-[11px] text-error">{errors.frequency.message}</p>
        )}
      </fieldset>
      <fieldset aria-describedby={errors.budgetBand ? "budgetBand-error" : undefined}>
        <legend className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink/60 mb-2">{t("budget")}</legend>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {BUDGETS.map((b) => (
            <label key={b} className={`cursor-pointer rounded-xl border px-3 py-3 text-center text-sm transition-colors ${
              watchedBudget === b ? "border-rouge bg-rouge/5 text-ink" : "border-ink/15 text-ink/70 hover:border-ink/30"
            }`}>
              <input type="radio" value={b} className="sr-only" {...form.register("budgetBand")} />
              {t(`budget_${b}` as Parameters<typeof t>[0])}
            </label>
          ))}
        </div>
        {errors.budgetBand && (
          <p id="budgetBand-error" className="mt-1 font-mono text-[11px] text-error">{errors.budgetBand.message}</p>
        )}
      </fieldset>
      <Textarea label={t("brief")} required rows={5} error={errors.vibe?.message} {...form.register("vibe")} />
      {errorMsg && <p className="font-mono text-[11px] text-error">{t(`errors.${errorMsg}` as Parameters<typeof t>[0])}</p>}
      <MagneticButton
        type="submit"
        disabled={state === "submitting"}
        className="w-full"
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
