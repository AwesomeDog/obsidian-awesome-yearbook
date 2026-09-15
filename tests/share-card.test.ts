import { describe, expect, it } from "vitest";
import { setLanguage, t } from "../src/i18n/i18n";
import type { YearbookModel } from "../src/yearbook";
import { cardText, drawShareCard } from "../src/share-card";

/* The card paints on a canvas, so the stub records the strings it draws. */
function stubCanvas(): [HTMLCanvasElement, () => string] {
  const texts: string[] = [];
  const gradient = { addColorStop: () => {} };
  const ctx = {
    save: () => {},
    restore: () => {},
    beginPath: () => {},
    closePath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    arc: () => {},
    arcTo: () => {},
    fill: () => {},
    stroke: () => {},
    fillRect: () => {},
    fillText: (value: string) => texts.push(value),
    measureText: (value: string) => ({ width: value.length * 10 }),
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
    setTransform: () => {},
  };
  const canvas = {
    width: 0,
    height: 0,
    style: {},
    getContext: () => ctx,
  } as unknown as HTMLCanvasElement;
  return [canvas, () => texts.join("|")];
}

const NOTE = {
  title: "Diary",
  wordCount: 640,
  folder: "Journal/2026",
  modifiedAt: new Date(2026, 4, 6),
};
const model = {
  year: 2026,
  start: new Date(2026, 0, 1),
  end: new Date(2026, 11, 31),
  days: [
    { date: new Date(2026, 0, 2), words: 800, hours: new Array(24).fill(0) },
    { date: new Date(2026, 0, 4), words: 400, hours: new Array(24).fill(0) },
  ],
  wordCount: 1200,
  modifiedDays: 2,
  createdNotes: [],
  monthlyWords: new Array(12).fill(0),
  previousMonthlyWords: new Array(12).fill(0),
  topTags: [{ name: "secret", notes: 3, words: 900 }],
  representative: NOTE,
  peakHour: 21,
  hours: new Array(24).fill(0).map((_, hour) => (hour === 21 ? 9 : 1)),
  longestSilence: null,
  previousWords: 900,
  topMonth: 1,
  longestStreak: 2,
  topWords: [
    { text: "quantum", count: 42 },
    { text: "cipher", count: 21 },
  ],
} as unknown as YearbookModel;

describe("share card privacy mode", () => {
  it("leaves names alone when off", () => {
    const [canvas, drawn] = stubCanvas();
    drawShareCard(canvas, model, { vaultName: "Ada's Brain" });
    const text = drawn();
    expect(text).toContain("Ada's Brain");
    expect(text).toContain("secret");
    expect(text).toContain("Diary");
    expect(text).not.toContain("***");
  });

  it("masks the vault, the note title, the tags and the words", () => {
    const [canvas, drawn] = stubCanvas();
    drawShareCard(canvas, model, { privacy: true, vaultName: "Ada's Brain" });
    const text = drawn();
    expect(text).toContain("***");
    expect(text).not.toContain("Ada's Brain");
    expect(text).not.toContain("secret");
    expect(text).not.toContain("Diary");
    expect(text).not.toContain("quantum");
    expect(text).toContain("2026");
  });

  it("puts the handle where the headline says you", () => {
    const [canvas, drawn] = stubCanvas();
    drawShareCard(canvas, model, { handle: "@ada", privacy: true });
    const text = drawn();
    expect(text).toContain("@ada");
    expect(text).not.toContain("@@");
    /* The name splits the sentence, so it is bracketed by the two halves. */
    expect(text).toMatch(/.+\|@ada\|.+/);
  });

  it("splits the localized headline around the handle", () => {
    setLanguage("zh");
    try {
      const [whole, drawnWhole] = stubCanvas();
      drawShareCard(whole, model, {});
      const [split, drawnSplit] = stubCanvas();
      drawShareCard(split, model, { handle: "ada" });
      /* The dictionary owns the wording: whole without a handle, two pieces
         around the handle once there is one. */
      const headline = t("This year, you wrote");
      expect(drawnWhole()).toContain(`|${headline}|`);
      expect(drawnSplit()).toContain("|@ada|");
      expect(drawnSplit()).not.toContain(`|${headline}|`);
    } finally {
      setLanguage("en");
    }
  });

  it("leaves the headline whole without a handle", () => {
    const [canvas, drawn] = stubCanvas();
    drawShareCard(canvas, model, {});
    expect(drawn()).toContain(t("This year, you wrote"));
  });

  it("reads the month name from the dictionary, not the system locale", () => {
    expect(cardText(model)).toContain("Jan");
    setLanguage("zh");
    try {
      expect(cardText(model)).toContain("1 月");
      expect(cardText(model)).not.toContain("Jan");
    } finally {
      setLanguage("en");
    }
  });

  it("masks the copied text too", () => {
    expect(cardText(model, true)).toContain("***");
    expect(cardText(model, true)).not.toContain("secret");
    expect(cardText(model)).toContain("secret");
  });
});
