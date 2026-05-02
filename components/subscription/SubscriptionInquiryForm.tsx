"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { HoneypotField } from "@/components/inquiry/HoneypotField";
import { submitSubscriptionInquiry } from "@/lib/submit-subscription-inquiry";
import {
  subscriptionInquirySchema,
  type SubscriptionInquiry,
  type SubscriptionInquiryInput,
} from "@/schemas/subscription-inquiry";
import type { Locale } from "@/types/locale";
import { findSubscriptionPlan, type SubscriptionPlanId } from "@/data/subscription-plans";
import { CardMessageAssist } from "@/components/product/CardMessageAssist";
import { getRelations } from "@/lib/card-message-relations";
import type { Occasion, Relation } from "@/schemas/card-message";

type Props = {
  locale: Locale;
  plan: SubscriptionPlanId;
};

const CADENCES = ["weekly", "biweekly"] as const;
const SLOTS = ["morning", "midday", "afternoon", "evening"] as const;
const CARD_OCCASIONS: Occasion[] = [
  "birthday",
  "anniversary",
  "romance",
  "just-because",
  "congrats",
  "sympathy",
];

export function SubscriptionInquiryForm({ locale, plan }: Props) {
  const t = useTranslations("subscriptions.form");
  const cardOccasionsT = useTranslations("subscriptions.form.card_occasions");
  const cardRelationsT = useTranslations("subscriptions.form.card_relations");
  const cardAssistT = useTranslations("card_message_assist");
  const [state, setState] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [assistOpen, setAssistOpen] = useState(false);

  const form = useForm<SubscriptionInquiryInput, unknown, SubscriptionInquiry>({
    resolver: zodResolver(subscriptionInquirySchema),
    mode: "onBlur",
    defaultValues: {
      type: "subscription",
      locale,
      plan,
      cadence: "weekly",
      startDate: "",
      recipient: { name: "", phone: "" },
      address: { street1: "", street2: "", city: "", state: "NY", zip: "", country: "US" },
      window: { slot: "midday" },
      contact: { email: "", phone: "" },
      cardMessageMode: "fixed",
      cardMessage: "",
      cardOccasion: undefined,
      cardRelation: undefined,
      notes: "",
      honeypot: "",
    },
  });

  async function onSubmit(values: SubscriptionInquiry) {
    setState("submitting");
    setErrorMsg(null);
    const res = await submitSubscriptionInquiry(values);
    if (!res.ok) {
      setErrorMsg(res.errors.formErrors?.[0] ?? "unknown_error");
      setState("error");
      return;
    }
    setState("success");
    form.reset();
  }

  if (state === "success") {
    return (
      <section id="inquire" className="bg-petal/40 border-t border-ink/8">
        <div className="mx-auto max-w-2xl px-6 py-20 md:py-28">
          <div className="rounded-2xl border border-ink/10 bg-bone p-10 text-center shadow-sm">
            <p className="font-display text-4xl text-ink leading-tight">{t("success_title")}</p>
            <p className="mt-4 text-ink/70">{t("success_body")}</p>
          </div>
        </div>
      </section>
    );
  }

  const errors = form.formState.errors;
  const watchedCadence = form.watch("cadence");
  const watchedSlot = form.watch("window.slot");
  const watchedMode = form.watch("cardMessageMode") ?? "fixed";
  const watchedOccasion = form.watch("cardOccasion");
  const watchedRelation = form.watch("cardRelation");
  const planTitle = findSubscriptionPlan(plan).name[locale];
  const relations = getRelations("default", locale);

  return (
    <section id="inquire" className="bg-petal/40 border-t border-ink/8">
      <div className="mx-auto max-w-2xl px-6 py-20 md:py-28">
      <header className="mb-8">
        <h2 className="font-display text-4xl text-ink leading-[0.95] tracking-tighter">
          {t("heading")}
        </h2>
        <p className="mt-3 text-ink/70 text-sm">{t("subheading")}</p>
      </header>
      <form onSubmit={form.handleSubmit(onSubmit)} className="relative space-y-6" noValidate>
        <HoneypotField register={form.register("honeypot")} />
        <input type="hidden" {...form.register("type")} />
        <input type="hidden" {...form.register("locale")} />
        <input type="hidden" {...form.register("plan")} />

        <fieldset>
          <legend className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink/60 mb-2">
            {t("cadence_label")}
          </legend>
          <div className="grid grid-cols-2 gap-2">
            {CADENCES.map((c) => (
              <label
                key={c}
                className={`cursor-pointer rounded-xl border px-3 py-3 text-center text-sm transition-colors ${
                  watchedCadence === c
                    ? "border-rouge bg-rouge/5 text-ink"
                    : "border-ink/15 text-ink/70 hover:border-ink/30"
                }`}
              >
                <input type="radio" value={c} className="sr-only" {...form.register("cadence")} />
                {t(`cadence.${c}`)}
              </label>
            ))}
          </div>
          {errors.cadence?.message && (
            <p className="mt-1 font-mono text-[11px] text-error" role="alert">
              {t(`errors.${errors.cadence.message}`)}
            </p>
          )}
        </fieldset>

        <Field
          label={t("start_date_label")}
          type="date"
          required
          help={t("start_date_help")}
          error={errors.startDate?.message && t(`errors.${errors.startDate.message}`)}
          {...form.register("startDate")}
        />

        <Heading>{t("recipient_heading")}</Heading>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field
            label={t("recipient_name")}
            required
            error={errors.recipient?.name?.message && t(`errors.${errors.recipient.name.message}`)}
            {...form.register("recipient.name")}
          />
          <Field
            label={t("recipient_phone")}
            type="tel"
            inputMode="tel"
            required
            error={
              errors.recipient?.phone?.message &&
              t(`errors.${errors.recipient.phone.message}`)
            }
            {...form.register("recipient.phone")}
          />
        </div>

        <Heading>{t("address_heading")}</Heading>
        <Field
          label={t("street1")}
          required
          error={errors.address?.street1?.message && t(`errors.${errors.address.street1.message}`)}
          {...form.register("address.street1")}
        />
        <Field label={t("street2")} {...form.register("address.street2")} />
        <div className="grid sm:grid-cols-3 gap-4">
          <Field
            label={t("city")}
            required
            error={errors.address?.city?.message && t(`errors.${errors.address.city.message}`)}
            {...form.register("address.city")}
          />
          <Field
            label={t("state")}
            required
            maxLength={2}
            error={errors.address?.state?.message && t(`errors.${errors.address.state.message}`)}
            {...form.register("address.state")}
          />
          <Field
            label={t("zip")}
            required
            error={errors.address?.zip?.message && t(`errors.${errors.address.zip.message}`)}
            {...form.register("address.zip")}
          />
        </div>

        <fieldset>
          <legend className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink/60 mb-2">
            {t("window_label")}
          </legend>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {SLOTS.map((s) => (
              <label
                key={s}
                className={`cursor-pointer rounded-xl border px-3 py-3 text-center text-sm transition-colors ${
                  watchedSlot === s
                    ? "border-rouge bg-rouge/5 text-ink"
                    : "border-ink/15 text-ink/70 hover:border-ink/30"
                }`}
              >
                <input
                  type="radio"
                  value={s}
                  className="sr-only"
                  {...form.register("window.slot")}
                />
                {t(`window.${s}`)}
              </label>
            ))}
          </div>
          {errors.window?.slot?.message && (
            <p className="mt-1 font-mono text-[11px] text-error" role="alert">
              {t(`errors.${errors.window.slot.message}`)}
            </p>
          )}
        </fieldset>

        <Heading>{t("contact_heading")}</Heading>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field
            label={t("contact_email")}
            type="email"
            required
            error={errors.contact?.email?.message && t(`errors.${errors.contact.email.message}`)}
            {...form.register("contact.email")}
          />
          <Field
            label={t("contact_phone")}
            type="tel"
            inputMode="tel"
            required
            error={
              errors.contact?.phone?.message && t(`errors.${errors.contact.phone.message}`)
            }
            {...form.register("contact.phone")}
          />
        </div>

        <fieldset>
          <legend className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink/60 mb-2">
            {t("card_mode_heading")}
          </legend>
          <div className="grid grid-cols-2 gap-2">
            {(["fixed", "rotation"] as const).map((m) => (
              <label
                key={m}
                className={`cursor-pointer rounded-xl border px-3 py-3 text-center text-sm transition-colors ${
                  watchedMode === m
                    ? "border-rouge bg-rouge/5 text-ink"
                    : "border-ink/15 text-ink/70 hover:border-ink/30"
                }`}
              >
                <input
                  type="radio"
                  value={m}
                  className="sr-only"
                  {...form.register("cardMessageMode")}
                />
                {t(m === "fixed" ? "card_mode_fixed" : "card_mode_rotation")}
              </label>
            ))}
          </div>
          <p className="mt-2 font-mono text-[11px] text-ink/55">
            {t(watchedMode === "rotation" ? "card_mode_rotation_help" : "card_mode_fixed_help")}
          </p>
        </fieldset>

        {watchedMode === "fixed" ? (
          <div className="flex flex-col gap-3">
            <Textarea
              label={t("card_message_label")}
              rows={3}
              maxLength={500}
              error={errors.cardMessage?.message && t(`errors.${errors.cardMessage.message}`)}
              {...form.register("cardMessage")}
            />
            {assistOpen ? (
              <CardMessageAssist
                productTitle={planTitle}
                occasion={(watchedOccasion ?? "just-because") as Occasion}
                locale={locale}
                relations={relations}
                copy={{
                  title: cardAssistT("title"),
                  generate: cardAssistT("generate"),
                  regenerate: cardAssistT("regenerate"),
                  retry: cardAssistT("retry"),
                  close: cardAssistT("close"),
                  errorGeneric: cardAssistT("error_generic"),
                  errorRateLimit: cardAssistT("error_rate_limit"),
                }}
                onPick={(text) => {
                  form.setValue("cardMessage", text, { shouldDirty: true });
                  setAssistOpen(false);
                }}
                onClose={() => setAssistOpen(false)}
              />
            ) : (
              <button
                type="button"
                onClick={() => setAssistOpen(true)}
                className="self-start font-mono text-[11px] uppercase tracking-[0.18em] text-rouge hover:text-rouge/80"
              >
                ✨ {cardAssistT("trigger")}
              </button>
            )}
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            <label htmlFor="f-cardOccasion" className="block">
              <span className="block font-mono text-[11px] uppercase tracking-[0.18em] text-ink/60 mb-1.5">
                {t("card_occasion_label")} *
              </span>
              <select
                id="f-cardOccasion"
                className="block w-full rounded-xl border border-ink/15 bg-bone px-4 py-3 text-base text-ink focus:outline-none focus:ring-2 focus:ring-rouge/40 focus:border-rouge"
                {...form.register("cardOccasion")}
              >
                <option value="">—</option>
                {CARD_OCCASIONS.map((o) => (
                  <option key={o} value={o}>
                    {cardOccasionsT(o)}
                  </option>
                ))}
              </select>
              {errors.cardOccasion?.message && (
                <span role="alert" className="mt-1 block font-mono text-[11px] text-error">
                  {t("card_rotation_required")}
                </span>
              )}
            </label>
            <label htmlFor="f-cardRelation" className="block">
              <span className="block font-mono text-[11px] uppercase tracking-[0.18em] text-ink/60 mb-1.5">
                {t("card_relation_label")} *
              </span>
              <select
                id="f-cardRelation"
                className="block w-full rounded-xl border border-ink/15 bg-bone px-4 py-3 text-base text-ink focus:outline-none focus:ring-2 focus:ring-rouge/40 focus:border-rouge"
                {...form.register("cardRelation")}
              >
                <option value="">—</option>
                {relations.map((r) => (
                  <option key={r.key} value={r.key}>
                    {cardRelationsT(r.key as Relation)}
                  </option>
                ))}
              </select>
            </label>
            {watchedOccasion && watchedRelation && (
              <div className="sm:col-span-2 rounded-xl border border-rouge/30 bg-rouge/5 px-4 py-3 font-mono text-[11px] text-ink/70">
                ✨ {cardOccasionsT(watchedOccasion)} · {cardRelationsT(watchedRelation as Relation)}
              </div>
            )}
          </div>
        )}

        <Textarea
          label={t("notes_label")}
          help={t("notes_help")}
          rows={3}
          maxLength={1000}
          error={errors.notes?.message && t(`errors.${errors.notes.message}`)}
          {...form.register("notes")}
        />

        {errorMsg && (
          <p className="font-mono text-[11px] text-error" role="alert">
            {t(`errors.${errorMsg}`)}
          </p>
        )}

        <button
          type="submit"
          disabled={state === "submitting"}
          className="inline-flex w-full items-center justify-center rounded-full bg-ink px-6 py-4 font-sans text-sm font-medium tracking-tight text-bone transition-opacity disabled:opacity-50"
        >
          {state === "submitting" ? t("submitting") : t("submit")}
        </button>
      </form>
      </div>
    </section>
  );
}

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink/60 pt-2 border-t border-ink/10">
      {children}
    </h3>
  );
}

type FieldProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string | false | null;
  help?: string;
};
function Field({ label, error, help, id, ...rest }: FieldProps) {
  const fid = id ?? `f-${(rest.name as string ?? label).replace(/\s+/g, "-").toLowerCase()}`;
  const errorId = error ? `${fid}-error` : undefined;
  const helpId = help ? `${fid}-help` : undefined;
  return (
    <label htmlFor={fid} className="block">
      <span className="block font-mono text-[11px] uppercase tracking-[0.18em] text-ink/60 mb-1.5">
        {label}
      </span>
      <input
        id={fid}
        aria-describedby={[helpId, errorId].filter(Boolean).join(" ") || undefined}
        aria-invalid={!!error}
        {...rest}
        className="block w-full rounded-xl border border-ink/15 bg-bone px-4 py-3 text-base text-ink focus:outline-none focus:ring-2 focus:ring-rouge/40 focus:border-rouge"
      />
      {help && (
        <span id={helpId} className="mt-1 block font-mono text-[11px] text-ink/55">
          {help}
        </span>
      )}
      {error && (
        <span id={errorId} role="alert" className="mt-1 block font-mono text-[11px] text-error">
          {error}
        </span>
      )}
    </label>
  );
}

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  error?: string | false | null;
  help?: string;
};
function Textarea({ label, error, help, id, ...rest }: TextareaProps) {
  const fid = id ?? `f-${(rest.name as string ?? label).replace(/\s+/g, "-").toLowerCase()}`;
  const errorId = error ? `${fid}-error` : undefined;
  const helpId = help ? `${fid}-help` : undefined;
  return (
    <label htmlFor={fid} className="block">
      <span className="block font-mono text-[11px] uppercase tracking-[0.18em] text-ink/60 mb-1.5">
        {label}
      </span>
      <textarea
        id={fid}
        aria-describedby={[helpId, errorId].filter(Boolean).join(" ") || undefined}
        aria-invalid={!!error}
        {...rest}
        className="block w-full rounded-xl border border-ink/15 bg-bone px-4 py-3 text-base text-ink focus:outline-none focus:ring-2 focus:ring-rouge/40 focus:border-rouge resize-none"
      />
      {help && (
        <span id={helpId} className="mt-1 block font-mono text-[11px] text-ink/55">
          {help}
        </span>
      )}
      {error && (
        <span id={errorId} role="alert" className="mt-1 block font-mono text-[11px] text-error">
          {error}
        </span>
      )}
    </label>
  );
}
