import { loadConfig } from "./config";
import { logger } from "./log";
import { PrintApi } from "./api";
import { tick } from "./poll";

let stopping = false;
async function main() {
  const cfg = loadConfig();
  const api = new PrintApi(cfg);
  logger.info({ apiUrl: cfg.apiUrl, printer: cfg.printerName, intervalMs: cfg.pollIntervalMs }, "agent starting");

  // Boot health check. Failures don't abort — server may be temporarily unreachable.
  try {
    const h = await api.health();
    logger.info({ pending: h.pendingCount }, "boot health ok");
  } catch (e) {
    logger.warn({ err: (e as Error).message }, "boot health failed; continuing anyway");
  }

  while (!stopping) {
    try {
      await tick(api, cfg);
    } catch (e) {
      logger.error({ err: (e as Error).message }, "tick threw — continuing");
    }
    await new Promise((r) => setTimeout(r, cfg.pollIntervalMs));
  }
}

process.on("SIGINT", () => { stopping = true; logger.info("SIGINT received, stopping"); });
process.on("SIGTERM", () => { stopping = true; logger.info("SIGTERM received, stopping"); });

main().catch((e) => {
  logger.error({ err: (e as Error).message }, "agent crashed at startup");
  process.exit(1);
});
