"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { CaretDown, CaretUp, Plus, UserCircle } from "@phosphor-icons/react/dist/ssr";
import { intakeHrefFor } from "@/components/admin/customers/RecipientList";
import { formatPhoneUS } from "@/lib/format";
import { relativeTime } from "@/lib/relative-time";
import type { KnownRecipient, RecipientProfile } from "@/lib/recipient-history";

const RECIPIENTS_SHOWN = 4;

type LookupCustomer = { id: string; name: string; orderCount: number; lastSeenAt?: string };

type Lookup = {
  found: boolean;
  customer?: LookupCustomer;
  recipients: KnownRecipient[];
  asRecipient: RecipientProfile | null;
};

/** Digits the intake form and the lookup expect: the last 10 of a US number. */
function phoneDigits(phone: string): string {
  const d = phone.replace(/\D/g, "");
  return d.length >= 10 ? d.slice(-10) : d;
}

/**
 * Who is texting, for the open conversation: their customer record, the people
 * they send flowers to, and one tap into a new order. A side column on wide
 * screens; a compact bar with expandable details above the thread otherwise.
 */
export default function ConversationContext({ locale, phone }: { locale: string; phone: string }) {
  const t = useTranslations("admin_messages");
  const digits = phoneDigits(phone);
  const [data, setData] = useState<Lookup | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    setData(null);
    setShowAll(false);
    if (digits.length < 10) {
      setState("error");
      return;
    }
    (async () => {
      try {
        const res = await fetch(`/api/admin/customers/lookup?phone=${encodeURIComponent(digits)}`);
        if (!res.ok) throw new Error();
        const body = await res.json();
        if (cancelled) return;
        setData({
          found: Boolean(body.found && body.customer),
          customer: body.customer,
          recipients: Array.isArray(body.recipients) ? body.recipients : [],
          asRecipient: body.asRecipient ?? null,
        });
        setState("ready");
      } catch {
        if (!cancelled) setState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [digits]);

  const newOrderHref = `/${locale}/admin/intake?${new URLSearchParams(digits ? { phone: digits } : {}).toString()}`;
  const customer = data?.found ? data.customer : undefined;
  const recipients = data?.recipients ?? [];
  const asRecipient = data?.asRecipient ?? null;
  const unknown = state === "ready" && !customer && !asRecipient && recipients.length === 0;

  const receivedNote = asRecipient
    ? t(asRecipient.orderCount === 1 ? "ctx_received_one" : "ctx_received_other", {
        count: asRecipient.orderCount,
        sender:
          asRecipient.senders[0]?.name ||
          (asRecipient.senders[0]?.phone ? formatPhoneUS(asRecipient.senders[0].phone) : "—"),
      })
    : null;

  // Title + one line under it, always visible.
  let title: string | null = null;
  let subtitle: string | null = null;
  if (customer) {
    title = customer.name;
    subtitle = [
      t(customer.orderCount === 1 ? "ctx_orders_one" : "ctx_orders_other", { count: customer.orderCount }),
      customer.lastSeenAt ? t("ctx_last_seen", { when: relativeTime(customer.lastSeenAt, locale) }) : null,
    ]
      .filter(Boolean)
      .join(" · ");
  } else if (asRecipient) {
    title = asRecipient.name || null;
    subtitle = receivedNote;
  } else if (unknown) {
    title = t("ctx_new_number");
    subtitle = t("ctx_new_number_hint");
  }
  // Otherwise: no customer record, but orders placed from this number list recipients below.

  // Expandable details (always shown in the side column).
  const showReceivedInDetails = Boolean(customer && receivedNote);
  const hasDetails = Boolean(customer) || showReceivedInDetails || recipients.length > 0;
  const visible = showAll ? recipients : recipients.slice(0, RECIPIENTS_SHOWN);

  return (
    <aside
      aria-label={t("ctx_label")}
      className="max-h-[45%] shrink-0 overflow-y-auto border-b border-ink/10 bg-bone xl:max-h-none xl:w-72 xl:border-b-0 xl:border-l"
    >
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 xl:flex-col xl:items-stretch">
        <div className="min-w-0 flex-1">
          {state === "loading" ? (
            <div className="text-xs text-ink/40">{t("ctx_loading")}</div>
          ) : (
            <>
              {title && <div className="truncate text-sm font-semibold text-ink">{title}</div>}
              {subtitle && <div className="text-xs text-ink/60">{subtitle}</div>}
            </>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <Link
            href={newOrderHref}
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg bg-rouge px-3 text-sm font-medium text-bone transition-colors hover:bg-rouge/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rouge"
          >
            <Plus size={16} weight="bold" /> {t("ctx_new_order")}
          </Link>
          {hasDetails && (
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              aria-label={open ? t("ctx_hide_details") : t("ctx_show_details")}
              className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-ink/20 text-ink hover:bg-ink/5 xl:hidden"
            >
              {open ? <CaretUp size={16} weight="bold" /> : <CaretDown size={16} weight="bold" />}
            </button>
          )}
        </div>
      </div>

      {hasDetails && (
        <div className={`${open ? "block" : "hidden"} space-y-3 px-4 pb-4 xl:block`}>
          {customer && (
            <Link
              href={`/${locale}/admin/customers/${encodeURIComponent(customer.id)}`}
              className="inline-flex min-h-11 items-center gap-1.5 text-sm text-rouge underline-offset-2 hover:underline"
            >
              <UserCircle size={18} weight="duotone" /> {t("ctx_view_profile")}
            </Link>
          )}
          {showReceivedInDetails && (
            <div className="rounded-lg bg-mute-100 px-3 py-2 text-xs text-ink/70">{receivedNote}</div>
          )}
          {recipients.length > 0 && (
            <div>
              <div className="mb-1.5 text-[11px] uppercase tracking-widest text-ink/50">{t("ctx_recipients")}</div>
              <ul className="flex flex-col gap-1.5">
                {visible.map((r) => {
                  const label = r.name || (r.phone ? formatPhoneUS(r.phone) : "—");
                  return (
                    <li key={r.phone || `name:${r.name}`}>
                      <Link
                        href={intakeHrefFor(locale, digits, r)}
                        aria-label={t("ctx_new_order_for", { name: label })}
                        title={t("ctx_new_order_for", { name: label })}
                        className="flex min-h-11 items-center justify-between gap-2 rounded-lg border border-mute-200 bg-white px-3 py-1.5 text-sm text-ink transition hover:border-ink/40"
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{label}</span>
                          <span className="block truncate text-xs text-ink/50">
                            {[r.lastAddress?.city, `×${r.orderCount}`].filter(Boolean).join(" · ")}
                          </span>
                        </span>
                        <Plus size={14} weight="bold" className="shrink-0 text-rouge" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
              {!showAll && recipients.length > RECIPIENTS_SHOWN && (
                <button
                  type="button"
                  onClick={() => setShowAll(true)}
                  className="mt-1 min-h-11 text-sm text-rouge underline"
                >
                  {t("ctx_show_more", { count: recipients.length - RECIPIENTS_SHOWN })}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
