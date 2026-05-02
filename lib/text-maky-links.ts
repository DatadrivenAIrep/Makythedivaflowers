export function buildSmsHref(e164: string, body: string): string {
  const encoded = encodeURIComponent(body).replace(/'/g, "%27");
  return `sms:${e164}?&body=${encoded}`;
}

export function buildWhatsappHref(e164: string, body: string): string {
  const digits = e164.replace(/^\+/, "");
  const encoded = encodeURIComponent(body).replace(/'/g, "%27");
  return `https://wa.me/${digits}?text=${encoded}`;
}

export function buildTelHref(e164: string): string {
  return `tel:${e164}`;
}
