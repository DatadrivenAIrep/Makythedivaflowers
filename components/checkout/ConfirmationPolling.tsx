"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useCartStore } from "@/lib/cart-store";
import { Button } from "@/components/ui/Button";
import type { Locale } from "@/types/locale";
import type { OrderStatus } from "@/types/order";

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 15000;

type Props = {
  orderId: string;
  initialStatus: OrderStatus;
  locale: Locale;
};

type DisplayState =
  | { kind: "processing" }
  | { kind: "timeout" }
  | { kind: "paid" }
  | { kind: "failed" }
  | { kind: "canceled" };

function statusToDisplay(s: OrderStatus): DisplayState {
  if (s === "paid" || s === "preparing" || s === "out-for-delivery" || s === "delivered") {
    return { kind: "paid" };
  }
  if (s === "failed") return { kind: "failed" };
  if (s === "canceled") return { kind: "canceled" };
  return { kind: "processing" };
}

export function ConfirmationPolling({ orderId, initialStatus, locale }: Props) {
  const t = useTranslations("confirmation");
  const clearCart = useCartStore((s) => s.clear);
  const [display, setDisplay] = useState<DisplayState>(statusToDisplay(initialStatus));

  // Clear local cart whenever we land on a paid order (covers tab-close-after-pay edge case).
  useEffect(() => {
    if (display.kind === "paid") clearCart();
  }, [display.kind, clearCart]);

  useEffect(() => {
    if (display.kind !== "processing") return;
    let cancelled = false;
    const start = Date.now();
    let timer: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      if (cancelled) return;
      try {
        const res = await fetch(`/api/order/${orderId}/status`, { cache: "no-store" });
        if (res.ok) {
          const data = (await res.json()) as { status: OrderStatus };
          const next = statusToDisplay(data.status);
          if (next.kind !== "processing") {
            setDisplay(next);
            return;
          }
        }
      } catch {
        // network blip; keep polling
      }
      if (Date.now() - start >= POLL_TIMEOUT_MS) {
        setDisplay({ kind: "timeout" });
        return;
      }
      timer = setTimeout(poll, POLL_INTERVAL_MS);
    };

    timer = setTimeout(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [display.kind, orderId]);

  if (display.kind === "paid") {
    // Page-level component renders the full ConfirmationView for paid orders. This branch
    // should rarely be hit — only if the user lands `pending` and the webhook flips them
    // to paid mid-poll. Show a simple notice; reload restores the full view.
    return (
      <div className="space-y-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-success">
          {t("paid_label")}
        </p>
        <p className="text-base text-ink/75">{t("body")}</p>
      </div>
    );
  }

  if (display.kind === "processing") {
    return (
      <div className="space-y-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink/55 animate-pulse">
          {t("processing_label")}
        </p>
        <p className="text-base text-ink/75 max-w-[58ch]">{t("processing_body")}</p>
      </div>
    );
  }

  if (display.kind === "timeout") {
    return (
      <div className="space-y-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink/55">
          {t("processing_label")}
        </p>
        <p className="text-base text-ink/75 max-w-[58ch]">{t("verifying_timeout")}</p>
      </div>
    );
  }

  if (display.kind === "failed") {
    return (
      <div className="space-y-4">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-error">
          {t("failed_label")}
        </p>
        <p className="text-base text-ink/75 max-w-[58ch]">{t("failed_body")}</p>
        <Button asChild variant="primary" size="md">
          <Link href={`/${locale}/checkout`}>{t("failed_cta")}</Link>
        </Button>
      </div>
    );
  }

  // canceled
  return (
    <div className="space-y-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink/55">
        {t("canceled_label")}
      </p>
      <p className="text-base text-ink/75 max-w-[58ch]">{t("canceled_body")}</p>
      <Button asChild variant="primary" size="md">
        <Link href={`/${locale}/checkout`}>{t("failed_cta")}</Link>
      </Button>
    </div>
  );
}
