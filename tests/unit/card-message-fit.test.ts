import { describe, it, expect } from "vitest";
import {
  FUNERAL_CARD_BOX, INSIDE_CARD_BOX, fitCardMessage, isLongCardMessage,
} from "@/lib/card-message-fit";

const LOREM =
  "Querida mamá, hoy quiero recordarte lo mucho que te quiero y lo agradecida que estoy por todo lo que has hecho por mí. ";
const text = (n: number) => LOREM.repeat(10).slice(0, n);

describe("fitCardMessage", () => {
  it("keeps a short message at the full 16pt", () => {
    expect(fitCardMessage("Feliz cumpleaños, mamá", INSIDE_CARD_BOX).fontPt).toBe(16);
  });

  it("never grows as the message gets longer", () => {
    let prev = Infinity;
    for (let n = 20; n <= 500; n += 20) {
      const { fontPt } = fitCardMessage(text(n), INSIDE_CARD_BOX);
      expect(fontPt).toBeLessThanOrEqual(prev);
      prev = fontPt;
    }
  });

  it("prints a full 500-char message at a readable size (>= 10pt)", () => {
    expect(fitCardMessage(text(500), INSIDE_CARD_BOX).fontPt).toBeGreaterThanOrEqual(10);
    expect(fitCardMessage(text(500), FUNERAL_CARD_BOX).fontPt).toBeGreaterThanOrEqual(10);
  });

  it("shrinks further for many short lines, since each break starts a new line", () => {
    const flat = fitCardMessage(text(300), INSIDE_CARD_BOX).fontPt;
    const poem = fitCardMessage(Array.from({ length: 15 }, () => "Te quiero").join("\n"), INSIDE_CARD_BOX).fontPt;
    expect(poem).toBeLessThan(16);
    expect(fitCardMessage(text(300).replace(/\. /g, ".\n\n"), INSIDE_CARD_BOX).fontPt).toBeLessThanOrEqual(flat);
  });

  it("keeps the typed line breaks when they fit", () => {
    const msg = "Querida mamá,\nte quiero mucho.\nAna";
    expect(fitCardMessage(msg, INSIDE_CARD_BOX).text).toBe(msg);
  });

  it("joins the lines of a message too tall to print with its breaks", () => {
    const poem = Array.from({ length: 22 }, (_, i) => (i % 2 ? "y en cada flor te pienso" : "Eres mi sol")).join("\n");
    const fit = fitCardMessage(poem, INSIDE_CARD_BOX);
    expect(fit.text).not.toContain("\n");
    expect(fit.text.startsWith("Eres mi sol y en cada flor te pienso Eres mi sol")).toBe(true);
    expect(fit.fontPt).toBeGreaterThanOrEqual(10);
  });

  it("bottoms out at 8pt instead of failing", () => {
    expect(fitCardMessage("x".repeat(5000), INSIDE_CARD_BOX)).toMatchObject({ fontPt: 8, lineHeight: 1.38 });
  });

  it("uses looser leading at the larger sizes", () => {
    expect(fitCardMessage("Hola", INSIDE_CARD_BOX).lineHeight).toBe(1.45);
  });
});

describe("isLongCardMessage", () => {
  it("flags messages past 320 chars", () => {
    expect(isLongCardMessage(text(320))).toBe(false);
    expect(isLongCardMessage(text(321))).toBe(true);
  });
});
