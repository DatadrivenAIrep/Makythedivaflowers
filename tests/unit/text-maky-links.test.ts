import { describe, it, expect } from "vitest";
import { buildSmsHref, buildWhatsappHref, buildTelHref } from "@/lib/text-maky-links";

const E164 = "+15168512815";
const MSG = "Hi Maky, I have a question about Garden Bloom.";

describe("buildSmsHref", () => {
  it("uses ?&body= for cross-platform compatibility", () => {
    const href = buildSmsHref(E164, MSG);
    expect(href.startsWith(`sms:${E164}?&body=`)).toBe(true);
  });

  it("URL-encodes the message body", () => {
    const href = buildSmsHref(E164, MSG);
    expect(href).toBe(
      `sms:${E164}?&body=Hi%20Maky%2C%20I%20have%20a%20question%20about%20Garden%20Bloom.`,
    );
  });

  it("encodes special characters like ampersands and quotes", () => {
    const href = buildSmsHref(E164, "Tom's & Jerry's");
    expect(href).toContain("Tom%27s%20%26%20Jerry%27s");
  });
});

describe("buildWhatsappHref", () => {
  it("strips the leading + from the number", () => {
    const href = buildWhatsappHref(E164, MSG);
    expect(href.startsWith("https://wa.me/15168512815?text=")).toBe(true);
    expect(href).not.toContain("wa.me/+");
  });

  it("URL-encodes the message text", () => {
    const href = buildWhatsappHref(E164, MSG);
    expect(href).toBe(
      "https://wa.me/15168512815?text=Hi%20Maky%2C%20I%20have%20a%20question%20about%20Garden%20Bloom.",
    );
  });
});

describe("buildTelHref", () => {
  it("returns tel: prefix and the raw e164 number", () => {
    expect(buildTelHref(E164)).toBe("tel:+15168512815");
  });
});
