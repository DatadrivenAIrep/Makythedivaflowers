export const COOKIE_NAME = "dvf_consent";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`));
  if (!match) return null;
  const eqIdx = match.indexOf("=");
  return decodeURIComponent(match.slice(eqIdx + 1));
}

function gpcSignal(): boolean {
  if (typeof navigator === "undefined") return false;
  return (navigator as unknown as { globalPrivacyControl?: boolean })
    .globalPrivacyControl === true;
}

export function hasConsent(): boolean {
  if (typeof document === "undefined") return false;
  if (gpcSignal()) return false;
  const value = readCookie(COOKIE_NAME);
  if (value === "denied") return false;
  return true;
}

export function setConsent(granted: boolean): void {
  if (typeof document === "undefined") return;
  const value = granted ? "granted" : "denied";
  const secure = typeof location !== "undefined" && location.protocol === "https:" ? "; secure" : "";
  document.cookie = `${COOKIE_NAME}=${value}; max-age=${ONE_YEAR_SECONDS}; path=/; samesite=lax${secure}`;
}
