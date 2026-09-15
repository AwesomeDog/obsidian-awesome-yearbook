import zh from "./zh";

type Dict = Readonly<Record<string, string>>;

/** Keyed by what `getLanguage()` returns; English is the source text. */
const DICTS: Record<string, Dict> = { zh };

const EMPTY: Dict = {};
let current: Dict = EMPTY;

export function setLanguage(code: string): void {
  const normalized = code.toLocaleLowerCase();
  current = DICTS[normalized] ?? DICTS[normalized.split("-")[0] ?? ""] ?? EMPTY;
}

/** UI literals, keyed by their own English. */
export function t(text: string): string {
  return current[text] || text;
}
