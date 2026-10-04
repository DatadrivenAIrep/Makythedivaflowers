"use client";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ChatCircleText, CheckCircle, CaretRight } from "@phosphor-icons/react/dist/ssr";
import { relativeTime } from "@/lib/relative-time";
import type { AttentionItem } from "@/lib/attention";

const MAX_SHOWN = 5;

/**
 * Dashboard card for unread customer SMS. Fed by the attention snapshot the
 * Bandeja already polls, so it adds no request of its own. The empty state is
 * deliberate: "Sin mensajes nuevos" tells the shop the inbox is being watched.
 */
export default function SmsInboxWidget({ locale, items }: { locale: string; items: AttentionItem[] }) {
  const t = useTranslations("admin_dashboard");
  const inbox = `/${locale}/admin/messages`;
  const total = items.reduce((n, i) => n + (i.count ?? 1), 0);
  const shown = items.slice(0, MAX_SHOWN);
  const extra = items.length - shown.length;
  const hasUnread = items.length > 0;

  return (
    <section
      data-testid="sms-widget"
      data-unread={hasUnread ? "true" : undefined}
      className={`mb-6 rounded-bento border bg-white p-4 shadow-sm transition-colors ${
        hasUnread ? "border-rouge/50 ring-1 ring-rouge/20" : "border-ink/10"
      }`}
    >
      <header className="mb-2 flex items-center gap-2">
        <ChatCircleText size={22} weight="duotone" className="text-rouge" />
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink/60">{t("sms_widget_title")}</h2>
        {hasUnread && (
          <span
            data-testid="sms-widget-total"
            className="rounded-full bg-rouge px-2.5 py-0.5 text-sm font-semibold tabular-nums text-bone"
          >
            {total}
          </span>
        )}
        <Link
          href={inbox}
          className="ml-auto flex min-h-11 items-center gap-0.5 rounded-lg px-2 text-xs text-ink/60 hover:bg-ink/5"
        >
          {t("sms_widget_view_all")} <CaretRight size={12} weight="bold" />
        </Link>
      </header>

      {hasUnread ? (
        <ul className="divide-y divide-ink/5">
          {shown.map((item) => (
            <li key={item.id}>
              <Link
                href={`${inbox}?c=${encodeURIComponent(item.conversationKey ?? "")}`}
                className="flex min-h-11 items-start gap-3 rounded-lg px-2 py-2.5 hover:bg-ink/5"
              >
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-rouge" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-ink">{item.label.replace(/^SMS · /, "")}</span>
                    <span className="shrink-0 text-xs text-ink/40">{relativeTime(item.createdAt, locale)}</span>
                  </span>
                  <span className="block truncate text-sm text-ink/70">{item.preview}</span>
                </span>
                {(item.count ?? 1) > 1 && (
                  <span className="mt-0.5 shrink-0 rounded-full bg-rouge/10 px-2 text-xs font-semibold tabular-nums text-rouge">
                    {item.count}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="flex items-center gap-1.5 px-2 py-1 text-sm text-ink/60">
          <CheckCircle size={18} weight="fill" className="text-success" /> {t("sms_widget_empty")}
        </p>
      )}
      {extra > 0 && <p className="mt-1 px-2 text-xs text-ink/50">{t("sms_widget_more", { count: extra })}</p>}
    </section>
  );
}
