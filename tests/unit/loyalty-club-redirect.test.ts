// @vitest-environment node
import { describe, it, expect } from "vitest";
import config from "../../next.config";

describe("/club loyalty redirect", () => {
  it("sends the printed-poster QR path to the loyalty sign-up, temporarily", async () => {
    const redirects = await config.redirects!();
    for (const source of ["/club", "/:locale(en|es)/club"]) {
      const r = redirects.find((x) => x.source === source);
      expect(r, source).toBeDefined();
      expect(r!.destination).toBe("https://lightsalmon-dinosaur-949507.hostingersite.com/maky-the-diva-flowers");
      // 307, not 308: browsers must not cache it, so the target can change.
      expect("permanent" in r! && r!.permanent).toBe(false);
    }
  });
});
