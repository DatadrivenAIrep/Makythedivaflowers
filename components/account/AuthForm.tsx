"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { FormShell } from "@/components/ui/form/shell/FormShell";
import { EditorialPanel } from "@/components/ui/form/shell/EditorialPanel";
import { FormSuccess } from "@/components/ui/form/shell/FormSuccess";
import { FormField } from "@/components/ui/form/FormField";
import { TextInput } from "@/components/ui/form/TextInput";
import { FormSubmit } from "@/components/ui/form/FormSubmit";

type Mode = "sign-in" | "sign-up";

export function AuthForm({ mode }: { mode: Mode }) {
  const t = useTranslations(`account.${mode}`);
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
  }

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
      {submitted ? (
        <FormSuccess title={t("stub_title")} body={t("stub_body")} />
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5 max-w-md">
          {/* TODO: wire RHF + zodResolver + honeypot when replacing stub with real auth */}
          {mode === "sign-up" && (
            <FormField label={t("name")} htmlFor="auth-name" required>
              <TextInput id="auth-name" type="text" name="name" autoComplete="name" required />
            </FormField>
          )}
          <FormField label={t("email")} htmlFor="auth-email" required>
            <TextInput id="auth-email" type="email" name="email" autoComplete="email" required />
          </FormField>
          <FormField label={t("password")} htmlFor="auth-password" required>
            <TextInput
              id="auth-password"
              type="password"
              name="password"
              autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
              required
            />
          </FormField>
          <FormSubmit>{t("submit")}</FormSubmit>
        </form>
      )}
    </FormShell>
  );
}
