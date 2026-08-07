"use client";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { HoneypotField } from "@/components/inquiry/HoneypotField";
import { FormField } from "@/components/ui/form/FormField";
import { TextInput } from "@/components/ui/form/TextInput";
import { TextArea } from "@/components/ui/form/TextArea";
import { FormSubmit } from "@/components/ui/form/FormSubmit";
import { contactSchema, type ContactInput } from "@/schemas/contact";
import type { Locale } from "@/types/locale";
import { SYMPATHY_PIECES } from "@/data/sympathy-pieces";
import { SITE } from "@/data/site";
import { buildSmsHref, buildWhatsappHref } from "@/lib/text-maky-links";

const COPY = {
  eyebrow: { en: "Coordinate", es: "Coordinar" },
  title: {
    en: "Call or text us.",
    es: "Llámanos o escríbenos.",
  },
  body: {
    en: "It's the fastest way — we reply directly from the shop, especially for services within 24 hours. Prefer to write? Leave your details below and we'll text you back.",
    es: "Es lo más rápido — te respondemos directo desde la tienda, sobre todo para servicios en menos de 24 horas. ¿Prefieres escribir? Déjanos tus datos abajo y te escribimos.",
  },
  call: { en: "Call", es: "Llamar" },
  text: { en: "Text us", es: "Enviar texto" },
  whatsapp: { en: "WhatsApp", es: "WhatsApp" },
  reference: { en: "Reference", es: "Referencia" },
  form_heading: { en: "Prefer to write?", es: "¿Prefieres escribir?" },
  form_sub: {
    en: "Leave your details and we'll text or call you back.",
    es: "Déjanos tus datos y te escribimos o llamamos.",
  },
  name: { en: "Your name", es: "Tu nombre" },
  email: { en: "Email", es: "Correo" },
  phone_in_message: {
    en: "Service date, funeral home, and any details — include a phone for the fastest reply.",
    es: "Fecha del servicio, funeraria y detalles — incluye un teléfono para respuesta más rápida.",
  },
  piece_label: { en: "Reference piece", es: "Pieza de referencia" },
  piece_none: { en: "No specific piece", es: "Sin pieza específica" },
  message: { en: "Message", es: "Mensaje" },
  submit: { en: "Send", es: "Enviar" },
  submitting: { en: "Sending…", es: "Enviando…" },
  success_title: { en: "Got it — thank you", es: "Recibido — gracias" },
  success_body: {
    en: "We'll text or call you back shortly. If it's urgent, calling or texting is fastest.",
    es: "Te escribiremos o llamaremos en breve. Si es urgente, llamar o escribir es lo más rápido.",
  },
  error_generic: {
    en: "Something went wrong. Please call or text us — we're here.",
    es: "Algo falló. Por favor llámanos o escríbenos — estamos aquí.",
  },
} as const;

function readPieceFromHash(): string | null {
  if (typeof window === "undefined") return null;
  const match = window.location.hash.match(/[?&]piece=([^&]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export function SympathyInquiryForm({ locale }: { locale: Locale }) {
  const [state, setState] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [pieceSlug, setPieceSlug] = useState<string>("");

  useEffect(() => {
    const initial = readPieceFromHash();
    if (initial) setPieceSlug(initial);
    const onHash = () => {
      const slug = readPieceFromHash();
      if (slug) {
        setPieceSlug(slug);
        const el = document.getElementById("inquire");
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

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

  const piece = SYMPATHY_PIECES.find((p) => p.slug === pieceSlug);
  const pieceTitle = piece ? piece.title[locale] : null;
  // Prefill the direct call/text/WhatsApp with the referenced piece, if any.
  const directMessage =
    locale === "es"
      ? `Hola Diva Flowers, quisiera coordinar un arreglo de pésame${
          pieceTitle ? ` (referencia: "${pieceTitle}")` : ""
        }.`
      : `Hi Diva Flowers, I'd like to arrange a sympathy tribute${
          pieceTitle ? ` (reference: "${pieceTitle}")` : ""
        }.`;

  async function onSubmit(values: ContactInput) {
    setState("submitting");
    const subject = pieceTitle
      ? `Sympathy inquiry · ${piece!.title.en}`
      : "Sympathy inquiry";
    const res = await fetch("/api/contact", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...values, subject }),
    });
    if (!res.ok) {
      setState("error");
      return;
    }
    setState("success");
    form.reset();
    setPieceSlug("");
  }

  const errors = form.formState.errors;

  return (
    <section id="inquire" className="scroll-mt-24 bg-bone py-20 md:py-28">
      <div className="mx-auto grid max-w-[var(--container-max)] gap-12 px-6 lg:grid-cols-[1fr_1.2fr]">
        <header className="lg:pt-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-mute-500">
            {COPY.eyebrow[locale]}
          </p>
          <h2 className="mt-3 font-display text-4xl leading-[1] tracking-tighter text-ink md:text-5xl">
            {COPY.title[locale]}
          </h2>
          <p className="mt-5 max-w-md font-sans text-base leading-relaxed text-ink/75">
            {COPY.body[locale]}
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <a
              href={SITE.phoneHref}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-ink px-6 py-3 font-sans text-base text-bone transition-colors hover:bg-ink/90"
            >
              {COPY.call[locale]} · {SITE.phoneDisplay}
            </a>
            <a
              href={buildSmsHref(SITE.mobile.e164, directMessage)}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-ink/25 px-6 py-3 font-sans text-base text-ink transition-colors hover:border-ink/60"
            >
              {COPY.text[locale]}
            </a>
            <a
              href={buildWhatsappHref(SITE.mobile.e164, directMessage)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-ink/25 px-6 py-3 font-sans text-base text-ink transition-colors hover:border-ink/60"
            >
              {COPY.whatsapp[locale]}
            </a>
          </div>
          {pieceTitle && (
            <p className="mt-4 font-sans text-sm text-ink/60">
              {COPY.reference[locale]}:{" "}
              <span className="text-ink/90">&ldquo;{pieceTitle}&rdquo;</span>
            </p>
          )}
        </header>

        {state === "success" ? (
          <div className="rounded-[var(--radius-bento)] border border-ink/10 bg-bone/60 p-10">
            <h3 className="font-display text-3xl leading-tight tracking-tight text-ink">
              {COPY.success_title[locale]}
            </h3>
            <p className="mt-4 font-sans text-base leading-relaxed text-ink/75">
              {COPY.success_body[locale]}
            </p>
          </div>
        ) : (
          <div>
            <div className="mb-6">
              <h3 className="font-display text-2xl leading-tight tracking-tight text-ink">
                {COPY.form_heading[locale]}
              </h3>
              <p className="mt-1 font-sans text-sm text-ink/60">
                {COPY.form_sub[locale]}
              </p>
            </div>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <HoneypotField register={form.register("honeypot")} />
              <input type="hidden" {...form.register("locale")} />
              <input type="hidden" {...form.register("subject")} value="Sympathy inquiry" />

              <FormField label={COPY.name[locale]} htmlFor="symp-name" required error={errors.name?.message}>
                <TextInput
                  id="symp-name"
                  aria-invalid={!!errors.name || undefined}
                  {...form.register("name")}
                />
              </FormField>
              <FormField label={COPY.email[locale]} htmlFor="symp-email" required error={errors.email?.message}>
                <TextInput
                  id="symp-email"
                  type="email"
                  aria-invalid={!!errors.email || undefined}
                  {...form.register("email")}
                />
              </FormField>

              <FormField label={COPY.piece_label[locale]} htmlFor="symp-piece">
                <select
                  id="symp-piece"
                  value={pieceSlug}
                  onChange={(e) => setPieceSlug(e.target.value)}
                  className="block w-full rounded-md border border-ink/15 bg-bone px-3 py-2 font-sans text-base text-ink focus:border-ink/40 focus:outline-none"
                >
                  <option value="">{COPY.piece_none[locale]}</option>
                  {SYMPATHY_PIECES.map((p) => (
                    <option key={p.slug} value={p.slug}>
                      {p.title[locale]}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label={COPY.message[locale]} htmlFor="symp-body" required error={errors.body?.message}>
                <TextArea
                  id="symp-body"
                  rows={6}
                  placeholder={COPY.phone_in_message[locale]}
                  aria-invalid={!!errors.body || undefined}
                  {...form.register("body")}
                />
              </FormField>

              {state === "error" && (
                <p role="alert" className="font-mono text-[11px] text-error">
                  {COPY.error_generic[locale]}
                </p>
              )}

              <FormSubmit loading={state === "submitting"}>
                {state === "submitting" ? COPY.submitting[locale] : COPY.submit[locale]}
              </FormSubmit>
            </form>
          </div>
        )}
      </div>
    </section>
  );
}
