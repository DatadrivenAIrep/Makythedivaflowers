import { PrintApi } from "./api";
import { printJobWithRetry } from "./print";
import { logger } from "./log";
import type { Config } from "./config";

export async function tick(api: PrintApi, cfg: Config): Promise<void> {
  let jobs;
  try {
    jobs = await api.fetchQueue();
  } catch (e) {
    logger.warn({ err: (e as Error).message }, "queue fetch failed; will retry next tick");
    return;
  }
  if (jobs.length === 0) return;
  logger.info({ count: jobs.length }, "claimed jobs");
  for (const job of jobs) {
    try {
      await printJobWithRetry(job.id, job.html, cfg.printerName, cfg.chromePath);
      try {
        await api.ack(job.id, "printed");
        logger.info({ jobId: job.id, orderId: job.orderId }, "job printed and acked");
      } catch (e) {
        logger.error({ jobId: job.id, err: (e as Error).message }, "ack failed after print success");
      }
    } catch (e) {
      const errMsg = (e as Error).message;
      logger.error({ jobId: job.id, orderId: job.orderId, err: errMsg }, "all print attempts failed");
      try {
        await api.ack(job.id, "failed", errMsg);
      } catch (ackErr) {
        logger.error({ jobId: job.id, err: (ackErr as Error).message }, "ack(failed) failed");
      }
    }
  }
}
