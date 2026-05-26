"use client";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { HoneypotField } from "@/components/inquiry/HoneypotField";
import { CardMessageSkeleton } from "@/components/product/CardMessageSkeleton";
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
import { FormShell } from "@/components/ui/form/shell/FormShell";
import { PhotoPanel } from "@/components/ui/form/shell/PhotoPanel";
import { FormSuccess } from "@/components/ui/form/shell/FormSuccess";
import { FormField } from "@/components/ui/form/FormField";
import { TextInput } from "@/components/ui/form/TextInput";
import { TextArea } from "@/components/ui/form/TextArea";
import { DateInput } from "@/components/ui/form/DateInput";
import { SelectInput } from "@/components/ui/form/SelectInput";
import { RadioChips } from "@/components/ui/form/RadioChips";
import { FormSection } from "@/components/ui/form/FormSection";
import { FormSubmit } from "@/components/ui/form/FormSubmit";

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

const PLAN_IMAGES: Record<SubscriptionPlanId, string> = {
  small: "/products/blush-enchantment.jpg",
  medium: "/products/timeless-romance.jpg",
  large: "/products/hundred-roses-vase.png",
};

export function SubscriptionInquiryForm({ locale, plan }: Props) {
  const t = useTranslations("subscriptions.form");
  const cardOccasionsT = useTranslations("subscriptions.form.card_occasions");
  const cardRelationsT = useTranslations("subscriptions.form.card_relations");
  const cardAssistT = useTranslations("card_message_assist");
  const [state, setState] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [assistOpen, setAssistOpen] = useState(false);
  const [previewState, setPreviewState] = useState<
    | { kind: "idle" }
    | { kind: "loading" }
    | { kind: "success"; suggestions: string[] }
    | { kind: "error"; reason: "rate_limit" | "generic" }
  >({ kind: "idle" });
  const [regenerateNonce, setRegenerateNonce] = useState(0);

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

  const errors = form.formState.errors;
  const watchedCadence = form.watch("cadence");
  const watchedSlot = form.watch("window.slot");
  const watchedMode = form.watch("cardMessageMode") ?? "fixed";
  const watchedOccasion = form.watch("cardOccasion");
  const watchedRelation = form.watch("cardRelation");
  const planTitle = findSubscriptionPlan(plan).name[locale];
  const planImage = PLAN_IMAGES[plan];
  const relations = getRelations("default", locale);

  const lastFetchKey = useRef<string | null>(null);
  useEffect(() => {
    if (watchedMode !== "rotation" || !watchedOccasion || !watchedRelation) {
      return;
    }
    const key = `${watchedOccasion}|${watchedRelation}|${regenerateNonce}`;
    if (lastFetchKey.current === key) return;
    lastFetchKey.current = key;

    const controller = new AbortController();
    setPreviewState({ kind: "loading" });
    fetch("/api/card-message", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        productTitle: planTitle,
        occasion: watchedOccasion,
        relation: watchedRelation,
        locale,
      }),
      signal: controller.signal,
    })
      .then(async (res) => {
        if (res.status === 429) {
          setPreviewState({ kind: "error", reason: "rate_limit" });
          return;
        }
        if (!res.ok) {
          setPreviewState({ kind: "error", reason: "generic" });
          return;
        }
        const json = (await res.json()) as { suggestions: string[] };
        if (!Array.isArray(json.suggestions) || json.suggestions.length !== 3) {
          setPreviewState({ kind: "error", reason: "generic" });
          return;
        }
        setPreviewState({ kind: "success", suggestions: json.suggestions });
      })
      .catch((err) => {
        if (err?.name === "AbortError") return;
        setPreviewState({ kind: "error", reason: "generic" });
      });

    return () => controller.abort();
  }, [watchedMode, watchedOccasion, watchedRelation, regenerateNonce, planTitle, locale]);

  const leftPanel = (
    <PhotoPanel
      src={planImage}
      alt={t("shell.alt")}
      eyebrow={t("shell.eyebrow")}
      title={t("shell.title")}
      body={t("shell.body")}
      priority
    />
  );

  if (state === "success") {
    return (
      <FormShell left={leftPanel}>
        <FormSuccess title={t("success_title")} body={t("success_body")} />
      </FormShell>
    );
  }

  const cadenceItems = CADENCES.map((c) => ({ value: c, label: t(`cadence.${c}`) }));
  const slotItems = SLOTS.map((s) => ({ value: s, label: t(`window.${s}`) }));

  return (
    <FormShell left={leftPanel}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-md" noValidate>
        <HoneypotField register={form.register("honeypot")} />
        <input type="hidden" {...form.register("type")} />
        <input type="hidden" {...form.register("locale")} />
        <input type="hidden" {...form.register("plan")} />

        <FormField label={t("cadence_label")} htmlFor="s-cadence" error={errors.cadence?.message && t(`errors.${errors.cadence.message}`)}>
          <RadioChips
            name="cadence"
            items={cadenceItems}
            cols={2}
            value={watchedCadence}
            onChange={(v) => form.setValue("cadence", v as typeof CADENCES[number])}
          />
        </FormField>

        <FormField
          label={t("start_date_label")}
          htmlFor="s-start"
          required
          help={t("start_date_help")}
          error={errors.startDate?.message && t(`errors.${errors.startDate.message}`)}
        >
          <DateInput id="s-start" aria-invalid={!!errors.startDate || undefined} {...form.register("startDate")} />
        </FormField>

        <FormSection title={t("recipient_heading")} num={1} />
        <div className="grid sm:grid-cols-2 gap-5">
          <FormField label={t("recipient_name")} htmlFor="s-rname" required error={errors.recipient?.name?.message && t(`errors.${errors.recipient.name.message}`)}>
            <TextInput id="s-rname" aria-invalid={!!errors.recipient?.name || undefined} {...form.register("recipient.name")} />
          </FormField>
          <FormField label={t("recipient_phone")} htmlFor="s-rphone" required error={errors.recipient?.phone?.message && t(`errors.${errors.recipient.phone.message}`)}>
            <TextInput id="s-rphone" type="tel" inputMode="tel" aria-invalid={!!errors.recipient?.phone || undefined} {...form.register("recipient.phone")} />
          </FormField>
        </div>

        <FormSection title={t("address_heading")} num={2} />
        <FormField label={t("street1")} htmlFor="s-street1" required error={errors.address?.street1?.message && t(`errors.${errors.address.street1.message}`)}>
          <TextInput id="s-street1" aria-invalid={!!errors.address?.street1 || undefined} {...form.register("address.street1")} />
        </FormField>
        <FormField label={t("street2")} htmlFor="s-street2">
          <TextInput id="s-street2" {...form.register("address.street2")} />
        </FormField>
        <div className="grid sm:grid-cols-3 gap-5">
          <FormField label={t("city")} htmlFor="s-city" required error={errors.address?.city?.message && t(`errors.${errors.address.city.message}`)}>
            <TextInput id="s-city" aria-invalid={!!errors.address?.city || undefined} {...form.register("address.city")} />
          </FormField>
          <FormField label={t("state")} htmlFor="s-state" required error={errors.address?.state?.message && t(`errors.${errors.address.state.message}`)}>
            <TextInput id="s-state" maxLength={2} aria-invalid={!!errors.address?.state || undefined} {...form.register("address.state")} />
          </FormField>
          <FormField label={t("zip")} htmlFor="s-zip" required error={errors.address?.zip?.message && t(`errors.${errors.address.zip.message}`)}>
            <TextInput id="s-zip" aria-invalid={!!errors.address?.zip || undefined} {...form.register("address.zip")} />
          </FormField>
        </div>

        <FormField label={t("window_label")} htmlFor="s-window" error={errors.window?.slot?.message && t(`errors.${errors.window.slot.message}`)}>
          <RadioChips
            name="window.slot"
            items={slotItems}
            value={watchedSlot}
            onChange={(v) => form.setValue("window.slot", v as typeof SLOTS[number])}
          />
        </FormField>

        <FormSection title={t("contact_heading")} num={3} />
        <div className="grid sm:grid-cols-2 gap-5">
          <FormField label={t("contact_email")} htmlFor="s-cemail" required error={errors.contact?.email?.message && t(`errors.${errors.contact.email.message}`)}>
            <TextInput id="s-cemail" type="email" aria-invalid={!!errors.contact?.email || undefined} {...form.register("contact.email")} />
          </FormField>
          <FormField label={t("contact_phone")} htmlFor="s-cphone" required error={errors.contact?.phone?.message && t(`errors.${errors.contact.phone.message}`)}>
            <TextInput id="s-cphone" type="tel" inputMode="tel" aria-invalid={!!errors.contact?.phone || undefined} {...form.register("contact.phone")} />
          </FormField>
        </div>

        <FormField
          label={t("card_mode_heading")}
          htmlFor="s-cardmode"
          help={t(watchedMode === "rotation" ? "card_mode_rotation_help" : "card_mode_fixed_help")}
        >
          <RadioChips
            name="cardMessageMode"
            items={[
              { value: "fixed", label: t("card_mode_fixed") },
              { value: "rotation", label: t("card_mode_rotation") },
            ]}
            cols={2}
            value={watchedMode}
            onChange={(v) => form.setValue("cardMessageMode", v as "fixed" | "rotation")}
          />
        </FormField>

        {watchedMode === "fixed" ? (
          <div className="flex flex-col gap-3">
            <FormField
              label={t("card_message_label")}
              htmlFor="s-cardmsg"
              error={errors.cardMessage?.message && t(`errors.${errors.cardMessage.message}`)}
            >
              <TextArea id="s-cardmsg" rows={3} maxLength={500} aria-invalid={!!errors.cardMessage || undefined} {...form.register("cardMessage")} />
            </FormField>
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
          <div className="grid sm:grid-cols-2 gap-5">
            <FormField label={t("card_occasion_label")} htmlFor="s-occasion" required error={errors.cardOccasion?.message ? t("card_rotation_required") : undefined}>
              <SelectInput id="s-occasion" aria-invalid={!!errors.cardOccasion || undefined} {...form.register("cardOccasion")}>
                <option value="">—</option>
                {CARD_OCCASIONS.map((o) => (
                  <option key={o} value={o}>{cardOccasionsT(o)}</option>
                ))}
              </SelectInput>
            </FormField>
            <FormField label={t("card_relation_label")} htmlFor="s-relation" required>
              <SelectInput id="s-relation" {...form.register("cardRelation")}>
                <option value="">—</option>
                {relations.map((r) => (
                  <option key={r.key} value={r.key}>{cardRelationsT(r.key as Relation)}</option>
                ))}
              </SelectInput>
            </FormField>
            {watchedOccasion && watchedRelation && (
              <div className="sm:col-span-2 rounded-xl border border-rouge/20 bg-bone p-4">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-mute-500">
                    ✨ {t("preview_heading")}
                  </p>
                  {previewState.kind === "success" && (
                    <button
                      type="button"
                      onClick={() => setRegenerateNonce((n) => n + 1)}
                      className="font-mono text-[10px] uppercase tracking-[0.18em] text-rouge hover:text-rouge/80"
                    >
                      {t("preview_regenerate")}
                    </button>
                  )}
                </div>
                {previewState.kind === "loading" && <CardMessageSkeleton />}
                {previewState.kind === "success" && (
                  <ul className="flex flex-col gap-2">
                    {previewState.suggestions.map((s, i) => (
                      <li key={i} className="rounded-lg border border-ink/10 bg-petal/20 px-4 py-3 font-sans text-sm leading-relaxed text-ink/85">
                        <span className="block font-mono text-[9px] uppercase tracking-[0.22em] text-mute-500 mb-1.5">
                          {t("preview_sample", { n: i + 1 })}
                        </span>
                        {s}
                      </li>
                    ))}
                  </ul>
                )}
                {previewState.kind === "error" && (
                  <div role="alert" className="flex items-center justify-between gap-3">
                    <p className="font-sans text-sm text-ink/70">
                      {t(previewState.reason === "rate_limit" ? "preview_error_rate_limit" : "preview_error_generic")}
                    </p>
                    <button type="button" onClick={() => setRegenerateNonce((n) => n + 1)} className="font-mono text-[10px] uppercase tracking-[0.18em] text-rouge hover:text-rouge/80">
                      {t("preview_retry")}
                    </button>
                  </div>
                )}
                {previewState.kind === "success" && (
                  <p className="mt-3 font-mono text-[10px] text-ink/55 leading-relaxed">{t("preview_disclaimer")}</p>
                )}
              </div>
            )}
          </div>
        )}

        <FormField label={t("notes_label")} htmlFor="s-notes" help={t("notes_help")} error={errors.notes?.message && t(`errors.${errors.notes.message}`)}>
          <TextArea id="s-notes" rows={3} maxLength={1000} {...form.register("notes")} />
        </FormField>

        {errorMsg && (
          <p className="font-mono text-[11px] text-error" role="alert">
            {t(`errors.${errorMsg}`)}
          </p>
        )}

        <FormSubmit loading={state === "submitting"}>
          {state === "submitting" ? t("submitting") : t("submit")}
        </FormSubmit>
      </form>
    </FormShell>
  );
}
