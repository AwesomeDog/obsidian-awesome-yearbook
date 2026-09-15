import type { CachedMetadata, ListItemCache } from "obsidian";
import { STOP_WORDS } from "./stop-words";

export interface MarkdownParseResult {
  wordCount: number;
  wordFrequencies: Record<string, number>;
  tags: string[];
  outgoingLinks: string[];
  taskOpen: number;
  resourceRefs: string[];
}

type Segment = { segment: string; isWordLike?: boolean };
type SegmenterLike = { segment(input: string): Iterable<Segment> };

export function createSegmenter(): SegmenterLike | null {
  const IntlObject = Intl as typeof Intl & {
    Segmenter?: new (
      locales?: string | string[],
      options?: { granularity: "word" },
    ) => SegmenterLike;
  };
  return IntlObject.Segmenter
    ? new IntlObject.Segmenter("zh-CN", { granularity: "word" })
    : null;
}

export function countCharacters(text: string): number {
  let count = 0;
  let latinRun = false;
  for (const char of text.normalize("NFC")) {
    if (/\p{Script=Han}/u.test(char)) {
      count++;
      latinRun = false;
    } else if (/[\p{L}\p{N}]/u.test(char)) {
      if (!latinRun) count++;
      latinRun = true;
    } else {
      latinRun = false;
    }
  }
  return count;
}

function segmentWords(
  text: string,
  segmenter: SegmenterLike | null = createSegmenter(),
): string[] {
  if (!segmenter) return [];
  /* One character is never a catchphrase: in Chinese it is a particle, in
     English it is "a" or "i". Two is the floor that keeps the card readable. */
  return [...segmenter.segment(text.normalize("NFC"))]
    .filter((part) => part.isWordLike)
    .map((part) => part.segment.normalize("NFC").toLocaleLowerCase("zh-CN"))
    .filter((word) => word.length >= 2 && !STOP_WORDS.has(word));
}

function wordFrequency(
  text: string,
  segmenter: SegmenterLike | null = createSegmenter(),
): Record<string, number> {
  const frequencies: Record<string, number> = {};
  for (const word of segmentWords(text, segmenter))
    frequencies[word] = (frequencies[word] ?? 0) + 1;
  return frequencies;
}

function frontmatterTags(cache?: CachedMetadata | null): string[] {
  const value: unknown = cache?.frontmatter?.tags;
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string") return value.split(/[\s,]+/u).filter(Boolean);
  return [];
}

function fallbackTasks(text: string): ListItemCache[] {
  const lines = text.split(/\r?\n/u);
  let inFence = false;
  const tasks: ListItemCache[] = [];
  lines.forEach((line, index) => {
    if (/^\s*(```|~~~)/u.test(line)) {
      inFence = !inFence;
      return;
    }
    if (!inFence) {
      const match = /^\s*(?:[-*+] |\d+[.)] )\[([ xX])\]/u.exec(line);
      if (match)
        tasks.push({
          task: match[1],
          parent: -index,
          position: {
            start: { line: index, col: 0, offset: 0 },
            end: { line: index, col: line.length, offset: line.length },
          },
        });
    }
  });
  return tasks;
}

export function parseMarkdown(
  text: string,
  cache: CachedMetadata | null | undefined,
  segmenter: SegmenterLike | null = createSegmenter(),
): MarkdownParseResult {
  const metadataTags = cache?.tags?.map((tag) => tag.tag) ?? [];
  const tags = [
    ...new Set(
      [...metadataTags, ...frontmatterTags(cache)]
        .map((tag) => (tag.startsWith("#") ? tag.slice(1) : tag))
        .filter(Boolean),
    ),
  ];
  const cachedTasks = cache?.listItems?.filter(
    (item) => item.task !== undefined,
  );
  const tasks =
    cachedTasks && cachedTasks.length > 0 ? cachedTasks : fallbackTasks(text);
  const links = cache?.links?.map((link) => link.link).filter(Boolean) ?? [];
  const resources =
    cache?.embeds?.map((embed) => embed.link).filter(Boolean) ?? [];
  return {
    wordCount: countCharacters(text),
    wordFrequencies: wordFrequency(text, segmenter),
    tags,
    outgoingLinks: links,
    taskOpen: tasks.filter((task) => task.task === " ").length,
    resourceRefs: resources,
  };
}

export type { SegmenterLike };
