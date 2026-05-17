"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/admin/intake";
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        router.replace(next);
        return;
      }
      setError(res.status === 401 ? "Contraseña incorrecta" : "Error de conexión");
    } catch {
      setError("Error de conexión");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-bone px-6">
      <form onSubmit={onSubmit} className="w-full max-w-sm">
        <h1 className="font-display text-3xl text-ink mb-2">Diva Flowers</h1>
        <p className="text-mute-500 text-sm mb-8">Acceso de mostrador</p>
        <label className="block text-xs uppercase tracking-widest text-mute-400 mb-2">Contraseña</label>
        <input
          autoFocus
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full p-4 rounded-xl bg-bone border border-mute-200 text-ink text-lg outline-none focus:border-ink"
          inputMode="text"
          autoComplete="current-password"
        />
        {error && <p className="text-error text-sm mt-3">{error}</p>}
        <button
          type="submit"
          disabled={busy || password.length === 0}
          className="mt-6 w-full py-4 rounded-full bg-ink text-bone font-display text-lg disabled:opacity-40"
        >
          {busy ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </main>
  );
}
