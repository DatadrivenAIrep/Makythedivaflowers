"use client";
import { useState } from "react";
import { PaperPlaneTilt } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";
import AdminButton from "./AdminButton";

type Channel = "sms" | "email" | "both";
type ChannelResult = { status: "sent" | "skipped" | "failed"; error?: string };
type SendResp = { link?: string; sms?: ChannelResult; email?: ChannelResult; error?: string };

const CHANNELS: Channel[] = ["sms", "email", "both"];

type Props = {
  orderId: string;
  defaultPhone: string;
  defaultEmail: string;
  onClose: () => void;
  /** Parent reloads the order so the new rows show in its message list. */
  onSent: () => void;
};

/** "Enviar factura" — text and/or email the invoice to the buyer (editable). */
export default function InvoiceSendPanel({ orderId, defaultPhone, defaultEmail, onClose, onSent }: Props) {
  const t = useTranslations("admin_orders");
  const [channel, setChannel] = useState<Channel>(defaultEmail ? "both" : "sms");
  const [phone, setPhone] = useState(defaultPhone);
  const [email, setEmail] = useState(defaultEmail);
  const [busy, setBusy] = useState(false);
  const [resp, setResp] = useState<SendResp | null>(null);

  const needsPhone = channel !== "email";
  const needsEmail = channel !== "sms";
  const canSend = !busy && (!needsPhone || phone.trim() !== "") && (!needsEmail || email.trim() !== "");

  function reason(error: string | undefined): string {
    switch (error) {
      case "opted_out": return t("invoice_send_opted_out");
      case "no_phone": return t("invoice_send_no_phone");
      case "no_email": return t("invoice_send_no_email");
      case "email_not_configured": return t("invoice_send_email_off");
      case "sms_disabled": return t("invoice_send_sms_off");
      default: return error ?? "";
    }
  }

  function line(label: string, r: ChannelResult | undefined) {
    if (!r) return null;
    const ok = r.status === "sent";
    return (
      <p className={ok ? "text-success" : "text-error"}>
        {label}: {ok ? t("invoice_send_sent") : `${t("invoice_send_not_sent")} — ${reason(r.error)}`}
      </p>
    );
  }

  async function send() {
    setBusy(true);
    setResp(null);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/invoice/send`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          channel,
          ...(needsPhone ? { phone: phone.trim() } : {}),
          ...(needsEmail ? { email: email.trim() } : {}),
        }),
      });
      const body = (await res.json().catch(() => ({ error: "send_failed" }))) as SendResp;
      if (res.status === 400) body.error = t("invoice_send_invalid");
      setResp(body);
      if (body.sms?.status === "sent" || body.email?.status === "sent") onSent();
    } catch {
      setResp({ error: t("invoice_send_failed") });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-3 rounded border border-ink/15 bg-bone p-3 text-xs">
      <div className="mb-2 font-semibold">{t("invoice_send_title")}</div>
      <div className="mb-2 flex flex-wrap gap-2" role="group" aria-label={t("invoice_send_channel")}>
        {CHANNELS.map((c) => (
          <button key={c} type="button" aria-pressed={channel === c} onClick={() => setChannel(c)}
            className={`rounded-full border px-2.5 py-1 ${channel === c ? "border-ink bg-ink text-bone" : "border-ink/20 bg-bone text-ink/70 hover:border-ink"}`}>
            {t(`invoice_send_ch_${c}`)}
          </button>
        ))}
      </div>
      <div className="mb-2 grid gap-2 sm:grid-cols-2">
        {needsPhone && (
          <label className="flex flex-col gap-1">
            <span className="text-ink/60">{t("invoice_send_phone")}</span>
            <input type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
              className="rounded border border-ink/20 bg-white px-2 py-1.5 text-sm" />
          </label>
        )}
        {needsEmail && (
          <label className="flex flex-col gap-1">
            <span className="text-ink/60">{t("invoice_send_email")}</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              className="rounded border border-ink/20 bg-white px-2 py-1.5 text-sm" />
          </label>
        )}
      </div>
      {resp && (
        <div className="mb-2 space-y-0.5">
          {resp.error && <p className="text-error">{resp.error}</p>}
          {line("SMS", resp.sms)}
          {line("Email", resp.email)}
        </div>
      )}
      <div className="flex gap-2">
        <AdminButton variant="primary" icon={PaperPlaneTilt} disabled={!canSend} onClick={send}>
          {busy ? t("invoice_send_sending") : t("invoice_send_submit")}
        </AdminButton>
        <AdminButton variant="secondary" disabled={busy} onClick={onClose}>{t("back")}</AdminButton>
      </div>
    </div>
  );
}
