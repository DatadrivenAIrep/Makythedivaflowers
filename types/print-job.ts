export type PrintJobStatus = "pending" | "printing" | "printed" | "failed";

// Print jobs are now lightweight — they just track which order needs to
// print. The agent fetches the order's HTML on demand from the queue
// endpoint and renders the PDF locally (the server host can't run
// Chromium, but the shop computer can).
export type PrintJob = {
  id: string;
  orderId: string;
  status: PrintJobStatus;
  attempts: number;
  error?: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  printedAt?: string; // ISO
};
