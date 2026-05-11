import dotenv from "dotenv";
import path from "node:path";
import { existsSync } from "node:fs";

dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

export type Config = {
  apiUrl: string;
  token: string;
  printerName: string;
  pollIntervalMs: number;
  chromePath: string;
};

// Common Chrome / Edge / Chromium install paths the agent will try if
// PUPPETEER_EXECUTABLE_PATH isn't set explicitly. Windows first since
// that's the shop deployment target.
const CHROME_CANDIDATES = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium-browser",
  "/usr/bin/chromium",
];

function findChrome(): string {
  const explicit = process.env.PUPPETEER_EXECUTABLE_PATH;
  if (explicit && explicit.trim() !== "") {
    if (!existsSync(explicit)) {
      throw new Error(`PUPPETEER_EXECUTABLE_PATH is set to "${explicit}" but the file does not exist`);
    }
    return explicit;
  }
  for (const p of CHROME_CANDIDATES) {
    if (existsSync(p)) return p;
  }
  throw new Error(
    "Could not locate Chrome / Edge / Chromium. Install Chrome from https://www.google.com/chrome/ " +
      "or set PUPPETEER_EXECUTABLE_PATH in .env to the chrome.exe path.",
  );
}

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
    chromePath: findChrome(),
  };
}
