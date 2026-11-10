import { describe, it, expect } from "vitest";
import { readCard } from "@/lib/card-dates";

const TABLE: [string, unknown][] = [
  ["Happy Birthday Mom! Love, Ana", { result: "date", kind: "birthday", relationship: "madre" }],
  ["FELIZ CUMPLEAÑOS mamá 🎉\n\nte quiero", { result: "date", kind: "birthday", relationship: "madre" }],
  ["Feliz cumpleanos", { result: "date", kind: "birthday" }],
  ["Feliz cumple mi amor", { result: "date", kind: "birthday" }],
  ["Feliz cumpleaños mi cielo", { result: "date", kind: "birthday" }],
  ["Feliz cumpleaños, son tus favoritas", { result: "date", kind: "birthday" }],
  ["Happy b-day!!", { result: "date", kind: "birthday" }],
  ["Happy 50th Birthday", { result: "date", kind: "birthday", years: 50 }],
  ["Happy 200th birthday", { result: "date", kind: "birthday" }],
  ["Happy anniversary to my wife", { result: "date", kind: "anniversary", relationship: "esposa" }],
  ["Feliz aniversario, 10 años juntos", { result: "date", kind: "anniversary", years: 10 }],
  ["Happy 90th anniversary", { result: "date", kind: "anniversary" }],
  ["Felices 15 mija", { result: "review", years: 15 }],
  ["Happy 25th", { result: "review", years: 25 }],
  ["Happy birthday and happy anniversary", { result: "review" }],
  ["Happy birthday in heaven, Dad", { result: "memorial" }],
  ["Feliz cumpleaños hasta el cielo", { result: "memorial" }],
  ["Happy birthday! Enjoy the trip", { result: "date", kind: "birthday" }],
  ["Get well soon", { result: "none" }],
  ["", { result: "none" }],
];

describe("readCard", () => {
  it.each(TABLE)("%j", (message, expected) => {
    expect(readCard(message)).toEqual(expected);
  });
});
