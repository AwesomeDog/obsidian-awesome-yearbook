import { describe, expect, it } from "vitest";
import { countCharacters, parseMarkdown } from "../src/scan/markdown";
import { calculateMetrics, getRangeBounds } from "../src/metrics";
import type { VaultSnapshot } from "../src/scan/vault-scanner";
import { createDefaultViewConfig } from "../src/settings";

const segmenter = {
  segment: (value: string) => [
    { segment: value.includes("Alpha") ? "Alpha" : "时间", isWordLike: true },
    { segment: "the", isWordLike: true },
    { segment: "!", isWordLike: false },
  ],
};

function note(path: string, modifiedAt: string, wordCount: number) {
  return {
    path,
    title: path,
    folder: "",
    createdAt: new Date(modifiedAt),
    modifiedAt: new Date(modifiedAt),
    wordCount,
    wordFrequencies: { alpha: 2 },
    tags: ["topic"],
    outgoingLinks: [],
    unresolvedLinks: [],
    incomingLinkCount: 0,
    taskOpen: 0,
    resourceRefs: [],
  };
}

function snapshot(): VaultSnapshot {
  return {
    notes: [
      note("one.md", "2024-02-28T09:00:00", 5),
      note("two.md", "2024-02-29T23:00:00", 7),
      note("three.md", "2024-03-01T01:00:00", 11),
    ],
    files: {
      byExtension: { md: 3 },
      attachmentPaths: [],
    },
    scan: {
      startedAt: new Date("2024-03-01"),
      finishedAt: new Date("2024-03-01"),
      elapsedMs: 0,
      fileCount: 3,
      markdownCount: 3,
      skippedCount: 0,
    },
    segmenterAvailable: true,
    earliestDate: new Date("2024-02-28"),
  };
}

describe("markdown rules", () => {
  it("counts Han characters and contiguous Latin or numeric runs", () => {
    expect(countCharacters("中文 alpha 123 !")).toBe(4);
  });

  it("uses the fixed segmenter and excludes non-word segments and stop words", () => {
    expect(parseMarkdown("Alpha !", null, segmenter).wordFrequencies).toEqual({
      alpha: 1,
    });
    expect(
      parseMarkdown("- [ ] task", { listItems: [] }, segmenter).taskOpen,
    ).toBe(1);
  });
});

describe("date ranges and metrics", () => {
  it("includes leap day in a local last-year range", () => {
    const config = createDefaultViewConfig();
    config.range = "lastyear";
    const bounds = getRangeBounds(snapshot(), config, {
      now: new Date("2025-02-28T12:00:00"),
    });
    expect([
      bounds.start.getFullYear(),
      bounds.start.getMonth(),
      bounds.start.getDate(),
    ]).toEqual([2024, 0, 1]);
    expect([
      bounds.end.getFullYear(),
      bounds.end.getMonth(),
      bounds.end.getDate(),
    ]).toEqual([2024, 11, 31]);
  });

  it("recomputes all values from the same snapshot when the range changes", () => {
    const config = createDefaultViewConfig();
    config.range = "all";
    const all = calculateMetrics(snapshot(), config, {
      now: new Date("2024-03-01T12:00:00"),
    });
    config.range = "last7";
    const recent = calculateMetrics(snapshot(), config, {
      now: new Date("2024-03-01T12:00:00"),
    });
    expect(all.words).toBe(23);
    expect(recent.words).toBe(23);
    expect(all.days.find((day) => day.key === "2024-02-29")?.words).toBe(7);
  });
});
