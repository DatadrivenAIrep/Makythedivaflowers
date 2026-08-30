"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft, ChatCircleText, MagnifyingGlass, WhatsappLogo } from "@phosphor-icons/react/dist/ssr";
import AdminButton from "@/components/admin/dashboard/AdminButton";
import { formatDateTime } from "@/lib/format-datetime";
import type { Conversation, ThreadMessage } from "@/lib/conversation-storage";

// Only these templates have `tpl_*` labels in admin_messages — next-intl throws on an
// unknown key, so anything else falls back to the raw template string.
const KNOWN_TEMPLATES = new Set([
  "order_received",
  "payment_link",
  "payment_confirmed",
  "out_for_delivery",
  "ready_for_pickup",
  "delivered",
  "review_request",
]);

const KNOWN_STATUSES = new Set(["sent", "failed", "skipped"]);

type Translator = ReturnType<typeof useTranslations>;

function templateLabel(t: Translator, template: string | undefined): string | null {
  if (!template) return null;
  if (KNOWN_TEMPLATES.has(template)) return t(`tpl_${template}`);
  return template;
}

function statusLabel(t: Translator, status: string | undefined): string | null {
  if (!status) return null;
  if (KNOWN_STATUSES.has(status)) return t(status);
  return status;
}

function relativeTime(iso: string, locale: string): string {
  const rtf = new Intl.RelativeTimeFormat(locale === "es" ? "es" : "en", { numeric: "auto" });
  const diffSec = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
  const abs = Math.abs(diffSec);
  if (abs < 60) return rtf.format(diffSec, "second");
  const diffMin = Math.round(diffSec / 60);
  if (Math.abs(diffMin) < 60) return rtf.format(diffMin, "minute");
  const diffHour = Math.round(diffMin / 60);
  if (Math.abs(diffHour) < 24) return rtf.format(diffHour, "hour");
  const diffDay = Math.round(diffHour / 24);
  if (Math.abs(diffDay) < 30) return rtf.format(diffDay, "day");
  const diffMonth = Math.round(diffDay / 30);
  if (Math.abs(diffMonth) < 12) return rtf.format(diffMonth, "month");
  return rtf.format(Math.round(diffMonth / 12), "year");
}

export default function MessagesInbox({ locale }: { locale: string }) {
  const t = useTranslations("admin_messages");

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [convLoading, setConvLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [thread, setThread] = useState<ThreadMessage[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/messages");
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (!cancelled) setConversations(data.conversations ?? []);
      } catch {
        // leave conversations empty — the empty state covers it
      } finally {
        if (!cancelled) setConvLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectConversation = useCallback((key: string) => {
    setSelectedKey(key);
    setThreadLoading(true);
    setThread([]);
    (async () => {
      try {
        const res = await fetch(`/api/admin/messages/${encodeURIComponent(key)}`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        setSelectedConv(data.conversation ?? null);
        setThread(data.thread ?? []);
      } catch {
        setSelectedConv(null);
        setThread([]);
      } finally {
        setThreadLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter(
      (c) => c.name.toLowerCase().includes(q) || c.phone.toLowerCase().includes(q),
    );
  }, [conversations, search]);

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-1 flex items-center gap-2">
        <ChatCircleText size={26} weight="duotone" className="text-rouge" />
        <h1 className="font-display text-3xl text-ink">{t("title")}</h1>
      </header>
      <p className="mb-4 text-sm text-ink/60">{t("intro")}</p>

      <div className="flex h-[calc(100vh-13rem)] min-h-[420px] overflow-hidden rounded-bento border border-ink/10 bg-white shadow-sm">
        {/* Conversation list */}
        <div
          className={`w-full flex-col border-ink/10 md:flex md:w-80 md:shrink-0 md:border-r ${
            selectedKey ? "hidden" : "flex"
          }`}
        >
          <div className="border-b border-ink/10 p-3">
            <div className="relative">
              <MagnifyingGlass size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink/40" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("search")}
                aria-label={t("search")}
                className="w-full rounded-lg border border-ink/20 bg-bone py-2 pl-9 pr-3 text-sm outline-none focus:border-ink focus:bg-white"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {!convLoading && filtered.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-ink/50">{t("empty")}</p>
            )}
            {filtered.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => selectConversation(c.key)}
                className={`flex w-full flex-col gap-0.5 border-b border-ink/5 px-4 py-3 text-left transition-colors hover:bg-ink/5 ${
                  selectedKey === c.key ? "bg-rouge/5" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium text-ink">{c.name}</span>
                  <span className="shrink-0 text-xs text-ink/40">{relativeTime(c.lastAt, locale)}</span>
                </div>
                <span className="truncate text-xs text-ink/60">
                  {c.lastDirection === "in" ? "↓" : "↑"} {c.lastPreview}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Thread */}
        <div className={`min-w-0 flex-1 flex-col ${selectedKey ? "flex" : "hidden md:flex"}`}>
          {!selectedKey ? (
            <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-ink/50">
              {t("no_selection")}
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 border-b border-ink/10 px-4 py-3">
                <button
                  type="button"
                  onClick={() => setSelectedKey(null)}
                  className="flex min-h-11 items-center rounded-lg px-1.5 hover:bg-ink/5 md:hidden"
                  aria-label={locale === "es" ? "Atrás" : "Back"}
                >
                  <ArrowLeft size={18} weight="bold" />
                </button>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-ink">
                    {selectedConv?.name ?? selectedKey}
                  </div>
                  {selectedConv?.phone && <div className="truncate text-xs text-ink/50">{selectedConv.phone}</div>}
                </div>
                {selectedConv?.phone && (
                  <AdminButton
                    variant="secondary"
                    icon={WhatsappLogo}
                    href={`https://wa.me/${selectedConv.phone.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t("reply_whatsapp")}
                  </AdminButton>
                )}
              </div>
              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                {!threadLoading &&
                  thread.map((msg) => <Bubble key={msg.id} msg={msg} locale={locale} t={t} />)}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Bubble({ msg, locale, t }: { msg: ThreadMessage; locale: string; t: Translator }) {
  const outbound = msg.direction === "out";
  const text = msg.text || templateLabel(t, msg.template) || "";

  let meta: string | null = null;
  if (msg.kind === "campaign") {
    meta = t("campaign");
  } else if (msg.kind === "transactional") {
    const tpl = templateLabel(t, msg.template);
    const status = statusLabel(t, msg.status);
    meta = [tpl, status].filter(Boolean).join(" · ") || null;
  }

  const outboundBg = msg.kind === "campaign" ? "bg-rouge/10" : "bg-ink/5";

  return (
    <div className={`flex ${outbound ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed text-ink ${
          outbound ? `rounded-tr-sm ${outboundBg}` : "rounded-tl-sm border border-ink/10 bg-bone"
        }`}
      >
        <p className="whitespace-pre-wrap">{text}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[11px] text-ink/50">
          {meta && <span>{meta}</span>}
          <span>{formatDateTime(msg.at, locale)}</span>
        </div>
      </div>
    </div>
  );
}
