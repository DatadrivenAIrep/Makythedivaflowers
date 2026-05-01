"use client";
import { memo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Check } from "@phosphor-icons/react/dist/ssr";

function NewsletterFieldImpl() {
  const t = useTranslations("home.newsletter");
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "submitting" | "success" | "error">("idle");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (state === "submitting") return;
    setState("submitting");
    await new Promise((r) => setTimeout(r, 600));
    if (!email.includes("@")) {
      setState("error");
      return;
    }
    setState("success");
  };

  return (
    <section className="py-24">
      <div className="max-w-[1400px] mx-auto px-6 grid md:grid-cols-12 gap-10 items-end">
        <div className="md:col-span-5 space-y-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-mute-500">
            {t("eyebrow")}
          </p>
          <h2 className="font-display text-4xl md:text-6xl tracking-tighter leading-none">
            {t("title")}
          </h2>
        </div>
        <form onSubmit={onSubmit} className="md:col-span-7 relative min-h-[68px]">
          <AnimatePresence mode="wait">
            {state !== "success" && (
              <motion.div
                key="form"
                initial={{ opacity: 1 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className="flex items-end gap-4 border-b border-ink/20 pb-3"
              >
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("placeholder")}
                  className="flex-1 bg-transparent font-mono text-base placeholder:text-mute-400 outline-none py-2"
                  aria-label={t("placeholder")}
                  disabled={state === "submitting"}
                />
                <button
                  type="submit"
                  disabled={state === "submitting"}
                  className="font-sans text-sm tracking-tight px-5 py-3 rounded-full bg-ink text-bone hover:bg-rouge transition-colors disabled:opacity-50"
                >
                  {state === "submitting" ? "…" : t("cta")}
                </button>
              </motion.div>
            )}
            {state === "success" && (
              <motion.div
                key="success"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 200, damping: 14 }}
                className="flex items-center gap-3 text-rouge"
              >
                <span className="inline-flex items-center justify-center size-8 rounded-full bg-rouge text-bone">
                  <Check size={16} weight="bold" />
                </span>
                <span className="font-display text-2xl tracking-tighter">{t("success")}</span>
              </motion.div>
            )}
          </AnimatePresence>
          {state === "error" && (
            <p className="absolute -bottom-6 left-0 font-mono text-xs text-error">{t("error")}</p>
          )}
        </form>
      </div>
    </section>
  );
}

export const NewsletterField = memo(NewsletterFieldImpl);
