import "server-only";
import { renderSmsBody, whatsappContentSid, whatsappContentVars, type TemplateVars } from "@/lib/messaging-templates";
import { insertMessage, updateMessage, type MessageChannel, type MessageTemplate } from "@/lib/message-storage";
import { sendSms, sendWhatsApp } from "@/lib/twilio-server";

export type SendMessageRequest = {
  orderId: string;
  customerId?: string;
  channel: MessageChannel;
  locale: "en" | "es";
  template: MessageTemplate;
  vars: TemplateVars;
  to: { phone?: string; email?: string };
};

export type SendMessageResult = {
  id: string;
  status: "sent" | "skipped" | "failed";
  error?: string;
};

function dryRunSid(): string {
  return `dry_run_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export async function sendMessage(req: SendMessageRequest): Promise<SendMessageResult> {
  // Audit row first — always have a trail, even on env misconfig.
  const id = insertMessage({
    orderId: req.orderId,
    customerId: req.customerId,
    channel: req.channel,
    template: req.template,
    locale: req.locale,
    toPhone: req.to.phone,
    toEmail: req.to.email,
  });

  if (req.channel === "email") {
    updateMessage(id, { status: "skipped", error: "use_existing_email_pipeline" });
    return { id, status: "skipped", error: "use_existing_email_pipeline" };
  }

  if (req.channel === "sms" && process.env.TWILIO_SMS_ENABLED !== "true") {
    updateMessage(id, { status: "skipped", error: "sms_disabled" });
    return { id, status: "skipped", error: "sms_disabled" };
  }
  if (req.channel === "whatsapp" && process.env.TWILIO_WHATSAPP_ENABLED !== "true") {
    updateMessage(id, { status: "skipped", error: "whatsapp_disabled" });
    return { id, status: "skipped", error: "whatsapp_disabled" };
  }
  if (req.channel === "whatsapp") {
    const sid = whatsappContentSid(req.template, req.locale);
    if (!sid) {
      updateMessage(id, { status: "skipped", error: "missing_whatsapp_template" });
      return { id, status: "skipped", error: "missing_whatsapp_template" };
    }
  }

  if (!req.to.phone) {
    updateMessage(id, { status: "failed", error: "no_destination_phone" });
    return { id, status: "failed", error: "no_destination_phone" };
  }

  // Dry-run path — log + audit, no network call.
  if (process.env.TWILIO_DRY_RUN === "true") {
    const body = renderSmsBody(req.template, req.locale, req.vars);
    console.log(JSON.stringify({
      event: "messaging_dry_run",
      channel: req.channel,
      to: req.to.phone,
      template: req.template,
      locale: req.locale,
      body,
    }));
    const providerSid = dryRunSid();
    updateMessage(id, { status: "sent", providerSid });
    return { id, status: "sent" };
  }

  try {
    if (req.channel === "sms") {
      const body = renderSmsBody(req.template, req.locale, req.vars);
      const { sid } = await sendSms(req.to.phone, body);
      updateMessage(id, { status: "sent", providerSid: sid });
      return { id, status: "sent" };
    } else {
      const contentSid = whatsappContentSid(req.template, req.locale)!;
      const contentVars = whatsappContentVars(req.template, req.vars);
      const { sid } = await sendWhatsApp(req.to.phone, contentSid, contentVars);
      updateMessage(id, { status: "sent", providerSid: sid });
      return { id, status: "sent" };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    updateMessage(id, { status: "failed", error: msg });
    return { id, status: "failed", error: msg };
  }
}
