export type PrintJobStatus = "pending" | "printing" | "printed" | "failed";

export type PrintJob = {
  id: string;
  orderId: string;
  status: PrintJobStatus;
  pdfBase64: string;
  attempts: number;
  error?: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  printedAt?: string; // ISO
};
