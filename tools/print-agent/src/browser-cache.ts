// Keeps one Chrome alive across jobs (a cold start costs ~2-3s on Windows)
// but never holds on to a failure: a launch that rejects, or a browser that
// later dies, is forgotten so the next job launches a fresh one. Caching the
// rejected launch is what froze printing on 2026-09-26 — one failed start
// after a reboot made every job fail instantly until the service restarted.

type Disconnectable = { once(event: "disconnected", handler: () => void): unknown };

export function browserCache<B extends Disconnectable>() {
  let current: Promise<B> | null = null;

  function forget(launch: Promise<B>): void {
    // Only drop the launch that failed or died, never a newer replacement.
    if (current === launch) current = null;
  }

  return {
    get(launch: () => Promise<B>): Promise<B> {
      if (current) return current;
      const launching = launch();
      current = launching;
      launching.then(
        (browser) => { browser.once("disconnected", () => forget(launching)); },
        () => forget(launching),
      );
      return launching;
    },

    // Hands back the cached launch (if any) and forgets it, for shutdown.
    take(): Promise<B> | null {
      const launching = current;
      current = null;
      return launching;
    },
  };
}
