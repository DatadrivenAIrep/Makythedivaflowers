import { loadConfig } from "./config";
import { logger } from "./log";
import { PrintApi } from "./api";
import { tick } from "./poll";
import { closeBrowser } from "./print";

let stopping = false;
async function main() {
  const cfg = loadConfig();
  const api = new PrintApi(cfg);
  logger.info({
    apiUrl: cfg.apiUrl,
    printer: cfg.printerName,
    intervalMs: cfg.pollIntervalMs,
    chrome: cfg.chromePath,
  }, "agent starting");

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

async function shutdown(signal: string) {
  stopping = true;
  logger.info({ signal }, "shutdown signal received");
  await closeBrowser();
}
process.on("SIGINT", () => { void shutdown("SIGINT"); });
process.on("SIGTERM", () => { void shutdown("SIGTERM"); });

main().catch((e) => {
  logger.error({ err: (e as Error).message }, "agent crashed at startup");
  process.exit(1);
});
