"use client";
import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { WarningCircle, CheckCircle, PaperPlaneTilt } from "@phosphor-icons/react/dist/ssr";
import SecretField, { type SecretFieldLabels } from "./SecretField";

type Config = {
  twilio_account_sid: string | null;
  twilio_auth_token: string | null;
  twilio_phone_number: string | null;
  twilio_sms_enabled: string;
  twilio_dry_run: string;
  twilio_account_sid_is_setting: boolean;
  twilio_auth_token_is_setting: boolean;
};

const PHONE_RE = /^\+\d{11,15}$/;

export default function TwilioSettings() {
  const t = useTranslations("admin_settings");
  const [cfg, setCfg] = useState<Config | null>(null);
  const [phoneInput, setPhoneInput] = useState("");
  const [phoneErr, setPhoneErr] = useState(false);
  const [toggleErr, setToggleErr] = useState(false);
  const [test, setTest] = useState<{ state: "idle" | "sending" | "ok" | "error"; msg?: string }>({
    state: "idle",
  });

  const reload = useCallback(async () => {
    const d = (await fetch("/api/admin/settings").then((r) => r.json())) as Config;
    setCfg(d);
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);

  const saveKey = useCallback(
    async (key: string, value: string) => {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value }),
      });
      if (!res.ok) throw new Error("save_failed");
      await reload();
    },
    [reload],
  );

  async function savePhone() {
    if (!PHONE_RE.test(phoneInput.trim())) {
      setPhoneErr(true);
      return;
    }
    setPhoneErr(false);
    try {
      await saveKey("twilio_phone_number", phoneInput.trim());
      setPhoneInput("");
    } catch {
      setToggleErr(true); // reuse the existing generic error line below the toggles
    }
  }

  async function onToggle(key: string, next: boolean) {
    setToggleErr(false);
    try {
      await saveKey(key, next ? "true" : "false");
    } catch {
      setToggleErr(true);
    }
  }

  async function sendTest() {
    setTest({ state: "sending" });
    try {
      const d = await fetch("/api/admin/settings/twilio-test", { method: "POST" }).then((r) =>
        r.json(),
      );
      if (d.ok) setTest({ state: "ok" });
      else setTest({ state: "error", msg: d.error });
    } catch {
      setTest({ state: "error", msg: "network" });
    }
  }

  if (!cfg) return null;

  const smsLive = cfg.twilio_sms_enabled === "true";
  const dryRun = cfg.twilio_dry_run === "true";
  const credsComplete = !!cfg.twilio_account_sid && !!cfg.twilio_auth_token && !!cfg.twilio_phone_number;
  const credsIncomplete = smsLive && !credsComplete;

  const secretLabels: SecretFieldLabels = {
    current: t("twilio_current"),
    notSet: t("twilio_not_set"),
    save: t("twilio_save"),
    saving: t("twilio_saving"),
    saved: t("twilio_saved"),
    error: t("twilio_error"),
    delete: t("twilio_delete"),
    envSource: t("twilio_env_source"),
  };

  const bannerClass = credsIncomplete
    ? "bg-amber-50 text-amber-800"
    : !smsLive
    ? "bg-mute-100 text-mute-600"
    : dryRun
    ? "bg-amber-50 text-amber-800"
    : "bg-green-50 text-green-800";
  const bannerText = credsIncomplete
    ? t("twilio_banner_incomplete")
    : !smsLive
    ? t("twilio_banner_off")
    : dryRun
    ? t("twilio_banner_sim")
    : t("twilio_banner_live");

  const testErrText =
    test.state === "error"
      ? test.msg === "no_credentials"
        ? t("twilio_test_err_no_credentials")
        : test.msg === "sms_disabled"
        ? t("twilio_test_err_sms_disabled")
        : t("twilio_test_err_generic", { error: test.msg ?? "" })
      : "";

  return (
    <section className="bg-white rounded-bento shadow-sm overflow-hidden mt-4">
      <div className="px-6 py-4 border-b border-mute-100">
        <h2 className="font-display text-base text-ink">{t("section_twilio")}</h2>
      </div>

      <div className="px-6 py-5 space-y-6">
        <p className="text-sm text-mute-600">{t("twilio_description")}</p>

        {/* Effective state banner — always visible */}
        <div className={`flex items-center gap-2 text-sm font-medium px-3 py-2 rounded-xl ${bannerClass}`}>
          {credsIncomplete || (smsLive && !dryRun) ? (
            <WarningCircle size={16} weight="fill" className="shrink-0" />
          ) : (
            <CheckCircle size={16} weight="fill" className="shrink-0" />
          )}
          <span>{bannerText}</span>
        </div>

        {/* Account SID */}
        <SecretField
          label={t("twilio_sid_label")}
          placeholder={t("twilio_sid_placeholder")}
          currentMasked={cfg.twilio_account_sid}
          labels={secretLabels}
          canDelete={cfg.twilio_account_sid_is_setting}
          onSave={(v) => saveKey("twilio_account_sid", v)}
          onDelete={() => saveKey("twilio_account_sid", "")}
        />

        {/* Auth Token */}
        <SecretField
          label={t("twilio_token_label")}
          placeholder={t("twilio_token_placeholder")}
          currentMasked={cfg.twilio_auth_token}
          labels={secretLabels}
          canDelete={cfg.twilio_auth_token_is_setting}
          onSave={(v) => saveKey("twilio_auth_token", v)}
          onDelete={() => saveKey("twilio_auth_token", "")}
        />

        {/* Phone number (not a secret — shown in full) */}
        <div>
          <label className="font-medium text-sm text-ink block mb-2">{t("twilio_phone_label")}</label>
          <div
            className={`mb-3 flex items-center gap-2 text-sm px-3 py-2 rounded-xl ${
              cfg.twilio_phone_number ? "bg-green-50 text-green-800" : "bg-mute-100 text-mute-500"
            }`}
          >
            {cfg.twilio_phone_number ? (
              <>
                <CheckCircle size={16} weight="fill" className="text-green-600 shrink-0" />
                <span>
                  {t("twilio_current")} <code className="font-mono">{cfg.twilio_phone_number}</code>
                </span>
              </>
            ) : (
              <>
                <WarningCircle size={16} weight="fill" className="text-mute-400 shrink-0" />
                <span>{t("twilio_not_set")}</span>
              </>
            )}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              placeholder={t("twilio_phone_placeholder")}
              className="flex-1 p-3.5 rounded-xl bg-bone border border-mute-200 outline-none focus:border-ink focus:bg-white font-mono text-sm"
            />
            <button
              type="button"
              disabled={phoneInput.trim().length < 11}
              onClick={savePhone}
              className="px-5 py-3 rounded-xl bg-rouge text-bone text-sm font-display disabled:opacity-40 transition"
            >
              {t("twilio_phone_save")}
            </button>
          </div>
          {phoneErr && <p className="mt-1 text-xs text-rouge">{t("twilio_err_invalid_phone")}</p>}
        </div>

        {/* SMS live toggle */}
        <div>
          <label className="flex items-center justify-between gap-3">
            <span>
              <span className="font-medium text-sm text-ink">{t("twilio_sms_label")}</span>
              <span className="block text-sm text-mute-600">{t("twilio_sms_desc")}</span>
            </span>
            <input
              type="checkbox"
              checked={smsLive}
              onChange={(e) => void onToggle("twilio_sms_enabled", e.target.checked)}
              className="h-5 w-5 shrink-0 accent-rouge"
            />
          </label>
          {smsLive && (
            <p className="mt-2 flex items-start gap-2 text-xs text-amber-800 bg-amber-50 rounded-lg px-3 py-2">
              <WarningCircle size={14} weight="fill" className="shrink-0 mt-0.5" />
              {t("twilio_live_warning")}
            </p>
          )}
        </div>

        {/* Dry-run toggle */}
        <label className="flex items-center justify-between gap-3">
          <span>
            <span className="font-medium text-sm text-ink">{t("twilio_dry_run_label")}</span>
            <span className="block text-sm text-mute-600">{t("twilio_dry_run_desc")}</span>
          </span>
          <input
            type="checkbox"
            checked={dryRun}
            onChange={(e) => void onToggle("twilio_dry_run", e.target.checked)}
            className="h-5 w-5 shrink-0 accent-rouge"
          />
        </label>

        {toggleErr && <p className="text-xs text-rouge">{t("twilio_error")}</p>}

        {/* Test send */}
        <div className="border-t border-mute-100 pt-5">
          <button
            type="button"
            onClick={sendTest}
            disabled={test.state === "sending"}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-ink/20 text-sm font-display hover:bg-bone disabled:opacity-40 transition"
          >
            <PaperPlaneTilt size={16} weight="bold" />
            {test.state === "sending" ? t("twilio_test_sending") : t("twilio_test_button")}
          </button>
          <p className="mt-2 text-xs text-mute-500">{t("twilio_test_hint")}</p>
          {test.state === "ok" && (
            <p className="mt-2 text-sm text-green-700">{t("twilio_test_sent")}</p>
          )}
          {test.state === "error" && <p className="mt-2 text-sm text-rouge">{testErrText}</p>}
        </div>
      </div>
    </section>
  );
}
