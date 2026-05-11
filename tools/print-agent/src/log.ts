import pino from "pino";
import path from "node:path";

const LOG_DIR = path.resolve(__dirname, "..", "logs");
const today = new Date().toISOString().slice(0, 10);
const logFile = path.join(LOG_DIR, `agent-${today}.log`);

const level = (process.env.LOG_LEVEL ?? "info") as "debug" | "info" | "warn" | "error";

export const logger = pino({
  level,
  base: { svc: "maky-print-agent" },
  transport: {
    targets: [
      { target: "pino-pretty", level, options: { colorize: true } },
      { target: "pino/file", level, options: { destination: logFile, mkdir: true } },
    ],
  },
});
