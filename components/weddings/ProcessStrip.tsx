// components/weddings/ProcessStrip.tsx
"use client";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";

const STEPS = ["consult", "design", "source", "install"] as const;

export function ProcessStrip({ namespace = "weddings.process" }: { namespace?: string }) {
  const t = useTranslations(namespace as "weddings.process");
  const reduce = useReducedMotion();
  return (
    <section className="bg-petal/40 py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <header className="max-w-2xl mb-12">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink/60">{t("eyebrow")}</p>
          <h2 className="mt-3 font-display text-5xl text-ink leading-[0.95] tracking-tighter">{t("title")}</h2>
        </header>
        <ol className="grid gap-6 lg:grid-cols-4">
          {STEPS.map((step, i) => (
            <motion.li
              key={step}
              initial={reduce ? false : { opacity: 0, y: 24 }}
              whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
              viewport={reduce ? undefined : { once: true, margin: "-10%" }}
              transition={reduce ? undefined : { duration: 0.5, delay: i * 0.08 }}
              className="rounded-2xl border border-ink/10 bg-bone/80 p-8 backdrop-blur-sm"
            >
              <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-rouge">0{i + 1}</span>
              <h3 className="mt-3 font-display text-2xl text-ink">{t(`${step}.title`)}</h3>
              <p className="mt-3 text-sm text-ink/75 leading-relaxed">{t(`${step}.body`)}</p>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  );
}
