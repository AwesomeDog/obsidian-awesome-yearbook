import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PROJECT_ICON } from "../src/icons";

describe("project icon", () => {
  it("is docs/specs/icon.svg, injected by the build", () => {
    const svg = readFileSync(
      new URL("../docs/specs/icon.svg", import.meta.url),
      "utf8",
    );
    expect(PROJECT_ICON).toBe(svg);
  });

  it("scales to the 100x100 box addIcon() nests it in", () => {
    // addIcon() puts the file inside a 0 0 100 100 <svg>; a nested svg only
    // fills that box while it has no width/height of its own.
    expect(PROJECT_ICON).not.toMatch(/<svg[^>]*\s(width|height)=/);
    expect(PROJECT_ICON).toMatch(
      /<svg[^>]*\bviewBox="[\d.]+ [\d.]+ [\d.]+ [\d.]+"/,
    );
  });

  it("stays readable by the canvas in the share card", () => {
    // The card paints the file itself on a canvas and reads rects and lines
    // only; anything else would be dropped there without a word.
    expect(PROJECT_ICON).not.toMatch(/<(path|circle|ellipse|polygon|g)\b/);
    expect(PROJECT_ICON.match(/<rect\b/g)?.length).toBe(9);
    expect(PROJECT_ICON.match(/<line\b/g)?.length).toBe(3);
  });
});
