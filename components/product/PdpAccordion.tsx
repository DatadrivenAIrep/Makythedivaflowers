"use client";
import { memo } from "react";
import type { Locale } from "@/types/locale";

// Hardcoded copy — delivery zones and cutoff time are inlined here
// to avoid coupling the accordion to a site config shape.
const DELIVERY_ZONES = "Nassau County, Queens, Brooklyn (select zip codes), Western Suffolk";
const CUTOFF = "2:00 PM";

const COPY = {
  stems_label: { en: "Stems & care", es: "Tallos y cuidado" },
  stems_body: {
    en: "Each stem is conditioned for 24 hours before the build. Trim half an inch and change the water every other day. Keep out of direct sun. Bloom window: 7–9 days.",
    es: "Cada tallo se acondiciona durante 24 horas antes del montaje. Corta medio centímetro y cambia el agua cada dos días. Mantén fuera del sol directo. Florescencia: 7–9 días.",
  },
  sub_label: { en: "Substitution policy", es: "Política de sustitución" },
  sub_body: {
    en: "Markets vary. We may substitute a stem of equal or greater value to keep the silhouette and palette intact. We always confirm major substitutions in advance.",
    es: "Los mercados varían. Podemos sustituir un tallo por uno de igual o mayor valor para mantener silueta y paleta. Siempre confirmamos sustituciones mayores con antelación.",
  },
  delivery_label: { en: "Delivery zones", es: "Zonas de entrega" },
  delivery_body_en: `We deliver across ${DELIVERY_ZONES}. Same-day cutoff is ${CUTOFF}.`,
  delivery_body_es: `Entregamos en ${DELIVERY_ZONES}. El corte para el mismo día es a las ${CUTOFF}.`,
} as const;

function Item({ label, body }: { label: string; body: string }) {
  return (
    <details className="group border-b border-ink/10 py-4 [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between font-sans text-base text-ink">
        <span>{label}</span>
        <span className="font-mono text-xs text-mute-500 transition-transform group-open:rotate-45">
          +
        </span>
      </summary>
      <p className="mt-3 max-w-md font-sans text-sm leading-relaxed text-ink/75">{body}</p>
    </details>
  );
}

function PdpAccordionImpl({ locale }: { locale: Locale }) {
  return (
    <div className="border-t border-ink/10">
      <Item label={COPY.stems_label[locale]} body={COPY.stems_body[locale]} />
      <Item label={COPY.sub_label[locale]} body={COPY.sub_body[locale]} />
      <Item
        label={COPY.delivery_label[locale]}
        body={locale === "es" ? COPY.delivery_body_es : COPY.delivery_body_en}
      />
    </div>
  );
}

export const PdpAccordion = memo(PdpAccordionImpl);
