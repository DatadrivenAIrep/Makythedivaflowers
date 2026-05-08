import type { Config } from "./config";

export type ServerJob = {
  id: string;
  orderId: string;
  pdfBase64: string;
};

export class PrintApi {
  constructor(private cfg: Config) {}

  private h() {
    return { Authorization: `Bearer ${this.cfg.token}`, "content-type": "application/json" };
  }

  async fetchQueue(): Promise<ServerJob[]> {
    const res = await fetch(`${this.cfg.apiUrl}/api/print/queue`, { headers: this.h() });
    if (!res.ok) throw new Error(`queue fetch failed: ${res.status} ${res.statusText}`);
    const body = (await res.json()) as { jobs: ServerJob[] };
    return body.jobs;
  }

  async ack(jobId: string, status: "printed" | "failed", error?: string): Promise<void> {
    const res = await fetch(`${this.cfg.apiUrl}/api/print/jobs/${jobId}/ack`, {
      method: "POST",
      headers: this.h(),
      body: JSON.stringify({ status, error }),
    });
    if (!res.ok) throw new Error(`ack failed: ${res.status} ${res.statusText}`);
  }

  async health(): Promise<{ pendingCount: number; lastPrintedAt: string | null }> {
    const res = await fetch(`${this.cfg.apiUrl}/api/print/health`, { headers: this.h() });
    if (!res.ok) throw new Error(`health failed: ${res.status} ${res.statusText}`);
    return res.json();
  }
}
