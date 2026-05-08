// Naive PDF text extractor for tests. Pulls strings from BT/ET text objects.
// Sufficient for asserting that known phrases appear in a rendered PDF.
// Handles FlateDecode-compressed content streams and hex-encoded array TJ forms.
import { inflateSync } from "node:zlib";
import { PDFDocument } from "pdf-lib";

function extractFromStream(stream: string): string {
  const parts: string[] = [];

  // Literal strings: (...)Tj or (...)TJ
  const litRe = /\(((?:[^()\\]|\\.)*)\)\s*T[jJ]/g;
  let m: RegExpExecArray | null;
  while ((m = litRe.exec(stream)) !== null) {
    parts.push(m[1].replace(/\\([()\\nrt])/g, (_, c) => {
      if (c === "n") return "\n";
      if (c === "r") return "\r";
      if (c === "t") return "\t";
      return c;
    }));
  }

  // Array form: [...<hex>...]TJ  — react-pdf always uses this form
  const arrayRe = /\[([^\]]*)\]\s*TJ/g;
  while ((m = arrayRe.exec(stream)) !== null) {
    const inner = m[1];
    const hexRe = /<([0-9A-Fa-f]*)>/g;
    let hm: RegExpExecArray | null;
    while ((hm = hexRe.exec(inner)) !== null) {
      if (hm[1].length > 0) {
        parts.push(Buffer.from(hm[1], "hex").toString("latin1"));
      }
    }
  }

  return parts.join("");
}

export function extractText(pdf: Buffer): string {
  const raw = pdf.toString("binary");
  const parts: string[] = [];

  // Find every stream...endstream pair by scanning for the markers.
  // We check the 300 bytes before "stream\n" to detect /FlateDecode.
  let searchFrom = 0;
  while (true) {
    const streamStart = raw.indexOf("stream\n", searchFrom);
    if (streamStart === -1) break;

    const dataStart = streamStart + 7; // past "stream\n"
    const endStreamIdx = raw.indexOf("\nendstream", dataStart);
    if (endStreamIdx === -1) break;

    // Look back up to 300 chars before the stream keyword to find the dict
    const dictChunk = raw.substring(Math.max(0, streamStart - 300), streamStart);
    const isFlate = dictChunk.includes("/FlateDecode");

    const streamData = Buffer.from(raw.substring(dataStart, endStreamIdx), "binary");

    let content: string;
    if (isFlate) {
      try {
        content = inflateSync(streamData).toString("latin1");
      } catch {
        content = "";
      }
    } else {
      content = streamData.toString("latin1");
    }

    parts.push(extractFromStream(content));
    searchFrom = endStreamIdx + 10;
  }

  return parts.join("\n");
}

/**
 * Extracts text per page. Returns an array; index 0 = page 1, etc.
 * Splits the input PDF into single-page PDFs via pdf-lib, then runs
 * the existing `extractText()` against each.
 */
export async function extractPageTexts(pdf: Buffer): Promise<string[]> {
  // Use new Uint8Array() to ensure pdf-lib accepts the buffer across environments
  // (jsdom's Uint8Array prototype differs from the worker context's Buffer class).
  const doc = await PDFDocument.load(new Uint8Array(pdf));
  const out: string[] = [];
  for (let i = 0; i < doc.getPageCount(); i++) {
    const single = await PDFDocument.create();
    const [page] = await single.copyPages(doc, [i]);
    single.addPage(page);
    const bytes = await single.save();
    out.push(extractText(Buffer.from(bytes)));
  }
  return out;
}
