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

const COPY = {
  eyebrow: { en: "Send an inquiry", es: "Enviar consulta" },
  title: {
    en: "Tell us what you have in mind.",
    es: "Cuéntanos qué tienes en mente.",
  },
  body: {
    en: "We respond within 15 minutes during business hours. For services within 24 hours, calling is faster.",
    es: "Respondemos en menos de 15 minutos en horario laboral. Para servicios en menos de 24 horas, llamar es más rápido.",
  },
  call_now: { en: "Call now", es: "Llamar ahora" },
  name: { en: "Your name", es: "Tu nombre" },
  email: { en: "Email", es: "Correo" },
  phone_in_message: {
    en: "Service date, funeral home, and any details — include a phone for fastest reply.",
    es: "Fecha del servicio, funeraria y detalles — incluye un teléfono para respuesta más rápida.",
  },
  piece_label: { en: "Reference piece", es: "Pieza de referencia" },
  piece_none: { en: "No specific piece", es: "Sin pieza específica" },
  message: { en: "Message", es: "Mensaje" },
  submit: { en: "Send inquiry", es: "Enviar consulta" },
  submitting: { en: "Sending…", es: "Enviando…" },
  success_title: { en: "Inquiry received", es: "Consulta recibida" },
  success_body: {
    en: "We'll reply within 15 minutes during business hours. If it's urgent, please call.",
    es: "Responderemos en 15 minutos en horario laboral. Si es urgente, por favor llama.",
  },
  error_generic: {
    en: "Something went wrong. Please call us — we're here.",
    es: "Algo falló. Por favor llámanos — estamos aquí.",
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

  async function onSubmit(values: ContactInput) {
    setState("submitting");
    const piece = SYMPATHY_PIECES.find((p) => p.slug === pieceSlug);
    const subject = piece
      ? `Sympathy inquiry · ${piece.title.en}`
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
          <a
            href={SITE.phoneHref}
            className="mt-8 inline-flex items-center gap-3 rounded-full bg-ink px-6 py-3 font-sans text-base text-bone transition-colors hover:bg-ink/90"
          >
            {COPY.call_now[locale]} · {SITE.phoneDisplay}
          </a>
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
        )}
      </div>
    </section>
  );
}
