"use client";
import { useEffect, useState } from "react";
import type { InquiryDetail } from "@/lib/inquiry-storage-db";

const TYPE_LABEL: Record<string, string> = { contact: "Contacto", wedding: "Boda", event: "Evento" };

export default function AttentionDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const [detail, setDetail] = useState<InquiryDetail | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await fetch(`/api/admin/inquiries/${id}/ack`, { method: "POST" });
        const res = await fetch(`/api/admin/inquiries/${id}`, { cache: "no-store" });
        if (cancelled) return;
        if (res.ok) setDetail((await res.json()) as InquiryDetail);
        else setFailed(true);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  const i = detail?.inquiry;
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/40" onClick={onClose}>
      <div
        className="h-full w-full max-w-md overflow-y-auto bg-bone p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="mb-4 text-sm text-ink/60">✕ Cerrar</button>
        {failed ? (
          <p className="text-ink/60">No se pudo cargar. Puede que ya se haya atendido.</p>
        ) : !i ? (
          <p className="text-ink/60">Cargando…</p>
        ) : (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">{i.contactName}</h2>
            <p className="text-sm text-ink/70">{TYPE_LABEL[i.type] ?? i.type}</p>
            {i.contactPhone && <a href={`tel:${i.contactPhone}`} className="block text-sm text-rouge">{i.contactPhone}</a>}
            <a href={`mailto:${i.contactEmail}`} className="block text-sm text-rouge">{i.contactEmail}</a>
            {i.notes && (
              <p className="whitespace-pre-wrap rounded border border-ink/10 bg-white p-3 text-sm">{i.notes}</p>
            )}
            <p className="text-xs text-ink/50">{new Date(i.createdAt).toLocaleString("es-US")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
