"use client";
import { memo } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";

const DAYS = ["M", "T", "W", "T", "F", "S", "S"] as const;
const ACTIVE = 3;

function BentoSubscriptionsTileImpl({ locale }: { locale: "en" | "es" }) {
  const reduce = useReducedMotion();
  const t = useTranslations("home.bento");

  return (
    <div className="relative bg-bone border border-ink/10 rounded-[var(--radius-bento)] p-6 md:p-7 flex flex-col justify-between gap-5 min-h-[140px] h-full shadow-[var(--shadow-tile-rest)] overflow-hidden">
      <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-mute-500">
        {t("subscriptions_cadence_label")}
      </span>

      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          {DAYS.map((d, i) => (
            <div key={i} className="flex flex-col items-center gap-1.5">
              <span
                className={cn(
                  "font-mono text-[9px] uppercase tracking-[0.18em]",
                  i === ACTIVE ? "text-rouge" : "text-mute-400",
                )}
              >
                {d}
              </span>
              {i === ACTIVE ? (
                <motion.span
                  aria-hidden
                  className="block size-2.5 rounded-full bg-rouge"
                  animate={reduce ? undefined : { scale: [1, 1.4, 1], opacity: [1, 0.7, 1] }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                />
              ) : (
                <span aria-hidden className="block size-1.5 rounded-full bg-ink/15" />
              )}
            </div>
          ))}
        </div>
        <span aria-hidden className="block w-full h-px bg-ink/10" />
      </div>

      <div className="flex flex-col gap-3">
        <p className="font-display text-xl tracking-tighter leading-tight">
          {t("subscriptions_title")}
        </p>
        <Link
          href={`/${locale}/subscriptions`}
          className="relative inline-flex w-fit font-sans font-medium text-sm tracking-tight px-4 py-2.5 rounded-full bg-ink text-bone overflow-hidden"
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
    </div>
  );
}

export const BentoSubscriptionsTile = memo(BentoSubscriptionsTileImpl);
