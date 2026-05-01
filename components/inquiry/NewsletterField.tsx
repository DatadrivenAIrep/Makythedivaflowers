// components/inquiry/NewsletterField.tsx
"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { HoneypotField } from "@/components/inquiry/HoneypotField";
import { newsletterSchema, type NewsletterInput } from "@/schemas/newsletter";
import type { Locale } from "@/types/locale";

export function NewsletterField({ locale }: { locale: Locale }) {
  const t = useTranslations("home.newsletter");
  const [state, setState] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const form = useForm<NewsletterInput>({
    resolver: zodResolver(newsletterSchema),
    defaultValues: { email: "", locale, honeypot: "" },
  });

  async function onSubmit(values: NewsletterInput) {
    setState("submitting");
    const res = await fetch("/api/newsletter", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(values),
    });
    setState(res.ok ? "success" : "error");
    if (res.ok) form.reset();
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-3" noValidate>
      <HoneypotField register={form.register("honeypot")} />
      <input type="hidden" {...form.register("locale")} />
      <div className="relative">
        <input
          type="email"
          placeholder={t("placeholder")}
          aria-label={t("placeholder")}
          {...form.register("email")}
          className="w-full rounded-full border border-ink/15 bg-transparent pl-4 pr-12 py-3 text-base text-ink placeholder:text-ink/40 focus:outline-none focus:ring-2 focus:ring-rouge/40 focus:border-rouge"
        />
        <button
          type="submit"
          aria-label={t("cta")}
          disabled={state === "submitting"}
          className="absolute right-1 top-1/2 -translate-y-1/2 inline-flex h-9 w-9 items-center justify-center rounded-full bg-rouge text-bone hover:bg-rouge/90 disabled:opacity-60"
        >
          <ArrowRight size={14} />
        </button>
      </div>
      {state === "success" && <p className="font-mono text-[11px] text-success">{t("success")}</p>}
      {state === "error" && <p className="font-mono text-[11px] text-error">{t("error")}</p>}
    </form>
  );
}
