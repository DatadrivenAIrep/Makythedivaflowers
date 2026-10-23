// One limit for the card message everywhere it is typed (web PDP + checkout,
// admin intake, order edits), and the font fit the printed card uses for it.

export const CARD_MESSAGE_MAX = 500;

/** Past this length the intake warns that the card will print in a smaller font. */
export const CARD_MESSAGE_LONG_HINT_AT = 220;

/** Past this length the worksheet's copy of the message drops a size so its column still fits. */
const WORKSHEET_LONG_AT = 320;

export type TextBox = { widthPt: number; heightPt: number };

// The inside panel's text area, measured from the rendered sheet (11in x 8.5in,
// three cards across): ~271px x ~256px once padding and ornaments are taken out.
// Kept a little under the measured room so a slightly wide line never clips.
export const INSIDE_CARD_BOX: TextBox = { widthPt: 200, heightPt: 185 };
// The funeral card has no ornaments but carries the shop contact at the bottom.
export const FUNERAL_CARD_BOX: TextBox = { widthPt: 198, heightPt: 200 };

/** Largest first; the first size whose wrapped text fits the box wins. */
const SIZES_PT = [16, 14, 13, 12, 11, 10, 9, 8];

// Average glyph advance of the italic display face, in em, including the slack
// lost at word wraps. Calibrated against Chrome renders of 100–500 char messages.
const AVG_CHAR_EM = 0.46;

export type CardMessageFit = {
  fontPt: number;
  lineHeight: number;
  /** The text to print: the message itself, or with its line breaks joined when they would not fit. */
  text: string;
};

function lineHeightFor(pt: number): number {
  return pt >= 14 ? 1.45 : 1.38;
}

/** Wrapped line count: each paragraph (a typed line break) starts a new line. */
function estimateLines(message: string, charsPerLine: number): number {
  return message
    .split("\n")
    .reduce((n, para) => n + Math.max(1, Math.ceil(para.trim().length / charsPerLine)), 0);
}

function largestFit(text: string, box: TextBox): number | null {
  // The printed message is wrapped in quote marks.
  const printed = `"${text}"`;
  for (const pt of SIZES_PT) {
    const charsPerLine = Math.max(1, Math.floor(box.widthPt / (AVG_CHAR_EM * pt)));
    if (estimateLines(printed, charsPerLine) * pt * lineHeightFor(pt) <= box.heightPt) return pt;
  }
  return null;
}

export function fitCardMessage(message: string, box: TextBox): CardMessageFit {
  const text = message.trim();
  const asTyped = largestFit(text, box);
  if (asTyped !== null) return { fontPt: asTyped, lineHeight: lineHeightFor(asTyped), text };
  // Too many short lines (a poem, a list of names): run them together instead of clipping.
  const joined = text.split(/\s*\n\s*/).filter(Boolean).join(" ");
  const pt = largestFit(joined, box) ?? SIZES_PT[SIZES_PT.length - 1];
  return { fontPt: pt, lineHeight: lineHeightFor(pt), text: joined };
}

export function isLongCardMessage(message: string): boolean {
  return message.trim().length > WORKSHEET_LONG_AT;
}
