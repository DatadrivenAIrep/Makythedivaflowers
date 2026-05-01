// components/account/AuthForm.tsx
"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";

type Mode = "sign-in" | "sign-up";

export function AuthForm({ mode }: { mode: Mode }) {
  const t = useTranslations(`account.${mode}`);
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="rounded-2xl border border-ink/10 bg-petal/20 p-8 space-y-3">
        <p className="font-display text-3xl text-ink">{t("stub_title")}</p>
        <p className="text-ink/75">{t("stub_body")}</p>
        <p className="font-mono text-[11px] text-ink/50 uppercase tracking-[0.18em]">{t("stub_notice")}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {mode === "sign-up" && (
        <Field label={t("name")} type="text" name="name" autoComplete="name" required />
      )}
      <Field label={t("email")} type="email" name="email" autoComplete="email" required />
      <Field label={t("password")} type="password" name="password" autoComplete={mode === "sign-in" ? "current-password" : "new-password"} required />
      <Button type="submit" variant="primary" size="lg" className="w-full">
        {t("submit")}
      </Button>
    </form>
  );
}

function Field({ label, ...rest }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const id = `auth-${rest.name}`;
  return (
    <label htmlFor={id} className="block">
      <span className="block font-mono text-[11px] uppercase tracking-[0.18em] text-ink/60 mb-1.5">{label}</span>
      <input
        id={id}
        {...rest}
        className="block w-full rounded-xl border border-ink/15 bg-bone px-4 py-3 text-base text-ink focus:outline-none focus:ring-2 focus:ring-rouge/40 focus:border-rouge"
      />
    </label>
  );
}
