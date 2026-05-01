"use client";
import { memo } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";

function BentoSubscriptionsTileImpl({ locale }: { locale: "en" | "es" }) {
  const reduce = useReducedMotion();
  const t = useTranslations("home.bento");
  return (
    <div className="relative bg-bone border border-ink/10 rounded-[var(--radius-bento)] p-8 md:p-10 flex flex-col justify-between min-h-[260px] shadow-[var(--shadow-tile-rest)] overflow-hidden">
      <p className="font-display text-2xl md:text-3xl tracking-tighter leading-tight max-w-[18ch]">
        {t("subscriptions_title")}
      </p>
      <p className="font-sans text-mute-600 max-w-[34ch] text-sm">
        {t("subscriptions_body")}
      </p>
      <Link
        href={`/${locale}/shop/subscriptions`}
        className="relative inline-flex w-fit font-sans font-medium text-sm tracking-tight px-5 py-3 rounded-full bg-ink text-bone overflow-hidden"
      >
        <span className="relative z-10">{t("subscriptions_cta")}</span>
        {!reduce && (
          <motion.span
            aria-hidden
            initial={{ x: "-120%" }}
            animate={{ x: "120%" }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0 bg-[linear-gradient(115deg,transparent_30%,rgba(250,246,240,0.5)_50%,transparent_70%)]"
          />
        )}
      </Link>
    </div>
  );
}

export const BentoSubscriptionsTile = memo(BentoSubscriptionsTileImpl);
