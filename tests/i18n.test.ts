import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import zh from "../src/i18n/zh";

/** Keys are English source text, so an entry no source contains is an orphan. */
function sourceText(dir: string): string {
  return readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory())
        return entry.name === "i18n" ? [] : sourceText(path);
      return entry.name.endsWith(".ts") ? [readFileSync(path, "utf8")] : [];
    })
    .join("\n");
}

const source = sourceText(fileURLToPath(new URL("../src", import.meta.url)));

/** Catches the one silent failure of keying by English: renaming the source. */
describe("dictionaries", () => {
  const dicts = { zh };
  for (const [code, dict] of Object.entries(dicts))
    it(`${code} has no orphaned keys`, () => {
      const orphans = Object.keys(dict).filter(
        (key) => !source.includes(`"${key}"`),
      );
      expect(orphans).toEqual([]);
    });
});
