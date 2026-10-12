"use client";
import { useEffect, useRef, useState } from "react";
import { Camera, CheckCircle, ArrowCounterClockwise, X } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";
import AdminButton from "./AdminButton";
import { prepareDeliveryPhoto } from "@/lib/client/prepare-delivery-photo";
import type { Order } from "@/types/order";

type Props = {
  order: Order;
  onDelivered: () => void;
  onClose: () => void;
  /** Test seam; defaults to the canvas-based prep. */
  prepare?: typeof prepareDeliveryPhoto;
};

type Phase =
  | { kind: "choose" }
  | { kind: "preview" }
  | { kind: "uploading" }
  | { kind: "delivering" }
  | { kind: "error"; message: "decode_failed" | "upload_failed" | "deliver_failed" };

export default function DeliverSheet({ order, onDelivered, onClose, prepare = prepareDeliveryPhoto }: Props) {
  const t = useTranslations("admin_deliver");
  const inputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "choose" });
  const [photo, setPhoto] = useState<{ blob: Blob; width: number; height: number } | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  // Set once the upload succeeded, so a PATCH retry never re-uploads.
  const uploadedRef = useRef(false);

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const busy = phase.kind === "uploading" || phase.kind === "delivering";
  const f = order.fulfillment.method === "delivery" ? order.fulfillment : null;

  async function onFile(file: File | undefined) {
    if (!file) return;
    try {
      const prepared = await prepare(file);
      setPhoto(prepared);
      uploadedRef.current = false;
      setPreviewUrl(URL.createObjectURL(prepared.blob));
      setPhase({ kind: "preview" });
    } catch {
      setPhase({ kind: "error", message: "decode_failed" });
    }
  }

  async function markDelivered() {
    setPhase({ kind: "delivering" });
    const res = await fetch(`/api/admin/orders/${order.id}/fulfillment`, {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "delivered" }),
    }).catch(() => null);
    if (!res?.ok) { setPhase({ kind: "error", message: "deliver_failed" }); return; }
    onDelivered();
  }

  /** A photo already uploaded must not reach the customer if staff now deliver without it. */
  async function deliverWithoutPhoto() {
    if (uploadedRef.current) {
      setPhase({ kind: "delivering" });
      const res = await fetch(`/api/admin/orders/${order.id}/delivery-photo`, { method: "DELETE" }).catch(() => null);
      if (!res?.ok) { setPhase({ kind: "error", message: "deliver_failed" }); return; }
      uploadedRef.current = false;
      setPhoto(null);
    }
    await markDelivered();
  }

  function close() {
    // Best effort: leave no orphaned photo that a later delivery would send.
    if (uploadedRef.current) {
      uploadedRef.current = false;
      void fetch(`/api/admin/orders/${order.id}/delivery-photo`, { method: "DELETE" }).catch(() => null);
    }
    onClose();
  }

  async function confirmWithPhoto() {
    if (photo && !uploadedRef.current) {
      setPhase({ kind: "uploading" });
      const form = new FormData();
      form.set("file", new File([photo.blob], "delivery.jpg", { type: "image/jpeg" }));
      form.set("width", String(photo.width));
      form.set("height", String(photo.height));
      const res = await fetch(`/api/admin/orders/${order.id}/delivery-photo`, { method: "POST", body: form }).catch(() => null);
      if (!res?.ok) { setPhase({ kind: "error", message: "upload_failed" }); return; }
      uploadedRef.current = true;
    }
    await markDelivered();
  }

  function retry() {
    if (phase.kind === "error" && phase.message === "decode_failed") { inputRef.current?.click(); return; }
    void confirmWithPhoto();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 sm:items-center" role="dialog" aria-modal="true" aria-label={t("title")}>
      <div className="w-full max-w-md rounded-t-2xl bg-bone p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-xl sm:rounded-2xl">
        <div className="mb-3 flex items-start gap-2">
          <div className="flex-1">
            <h2 className="text-base font-semibold">
              {t("title")}{order.orderNumber != null ? ` #${order.orderNumber}` : ""}
            </h2>
            {f && <p className="text-sm text-ink/70">{f.recipient.name} · {f.address.street1}</p>}
          </div>
          <button type="button" aria-label={t("cancel")} onClick={close} disabled={busy} className="p-1 text-ink/60"><X size={20} /></button>
        </div>

        <input
          ref={inputRef}
          data-testid="deliver-photo-input"
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ""; }}
        />

        {previewUrl && phase.kind !== "choose" && (
          // eslint-disable-next-line @next/next/no-img-element -- local blob preview
          <img src={previewUrl} alt="" className="mb-3 max-h-72 w-full rounded-lg bg-ink/5 object-contain" />
        )}

        {phase.kind === "uploading" && <p className="mb-3 text-sm text-ink/70">{t("uploading")}</p>}
        {phase.kind === "delivering" && <p className="mb-3 text-sm text-ink/70">{t("delivering")}</p>}
        {phase.kind === "error" && <p className="mb-3 text-sm text-error">{t(phase.message)}</p>}

        <div className="flex flex-col gap-2">
          {phase.kind === "choose" && (
            <>
              <AdminButton variant="primary" icon={Camera} className="w-full" onClick={() => inputRef.current?.click()}>{t("take_photo")}</AdminButton>
              <p className="text-center text-xs text-ink/50">{t("photo_hint")}</p>
              <AdminButton variant="secondary" className="w-full" onClick={() => void deliverWithoutPhoto()}>{t("without_photo")}</AdminButton>
              <AdminButton variant="secondary" className="w-full" onClick={close}>{t("cancel")}</AdminButton>
            </>
          )}
          {phase.kind === "preview" && (
            <>
              <AdminButton variant="primary" icon={CheckCircle} className="w-full" onClick={() => void confirmWithPhoto()}>{t("confirm")}</AdminButton>
              <AdminButton variant="secondary" icon={ArrowCounterClockwise} className="w-full" onClick={() => inputRef.current?.click()}>{t("retake")}</AdminButton>
            </>
          )}
          {phase.kind === "error" && (
            <>
              <AdminButton variant="primary" className="w-full" onClick={retry}>
                {phase.message === "decode_failed" ? t("retake") : t("retry")}
              </AdminButton>
              <AdminButton variant="secondary" className="w-full" onClick={() => void deliverWithoutPhoto()}>{t("without_photo")}</AdminButton>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
