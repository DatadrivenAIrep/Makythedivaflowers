import "server-only";
import QRCode from "qrcode";

// Q (25% recovery) survives the fold, ink bleed and the rose photo behind the
// white chip better than the library default (M).
const OPTS = { errorCorrectionLevel: "Q" as const, margin: 2 };

export async function qrSvgDataUri(text: string): Promise<string> {
  const svg = await QRCode.toString(text, { ...OPTS, type: "svg" });
  return `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
}

export async function qrPng(text: string): Promise<Buffer> {
  return QRCode.toBuffer(text, { ...OPTS, type: "png", width: 1024 });
}
