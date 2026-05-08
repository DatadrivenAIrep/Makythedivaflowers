import dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

export type Config = {
  apiUrl: string;
  token: string;
  printerName: string;
  pollIntervalMs: number;
};

export function loadConfig(): Config {
  const required = ["PRINT_API_URL", "PRINT_AGENT_TOKEN", "PRINTER_NAME"] as const;
  for (const k of required) {
    if (!process.env[k] || process.env[k]!.trim() === "") {
      throw new Error(`missing required env var: ${k}`);
    }
  }
  const interval = Number(process.env.POLL_INTERVAL_MS ?? "10000");
  if (!Number.isFinite(interval) || interval < 1000) {
    throw new Error(`POLL_INTERVAL_MS must be a number >= 1000, got: ${process.env.POLL_INTERVAL_MS}`);
  }
  return {
    apiUrl: process.env.PRINT_API_URL!.replace(/\/$/, ""),
    token: process.env.PRINT_AGENT_TOKEN!,
    printerName: process.env.PRINTER_NAME!,
    pollIntervalMs: interval,
  };
}
