import { describe, expect, it } from "vitest";
import { scanVault } from "../src/scan/vault-scanner";

function file(path: string, ctime: number, mtime: number) {
  const name = path.split("/").pop() ?? path;
  return {
    path,
    name,
    basename: name.replace(/\.md$/u, ""),
    extension: name.includes(".") ? name.split(".").pop() : "",
    stat: { ctime, mtime, size: 10 },
  };
}

describe("vault scanner", () => {
  it("sorts once, skips read failures, and aggregates links", async () => {
    const first = file("B.md", 1, 86_400_000);
    const second = file("A.md", 1, 86_400_000);
    const attachment = file("image.png", 1, 86_400_000);
    const contents = new Map([
      ["A.md", "- [ ] fallback\n[[B]] ![[image.png]]"],
      ["B.md", "content"],
    ]);
    const cache = new Map<string, object>([
      [
        "A.md",
        {
          tags: [{ tag: "#one" }],
          links: [{ link: "B" }],
          embeds: [{ link: "image.png" }],
          listItems: [],
        },
      ],
      [
        "B.md",
        { tags: [{ tag: "#one" }, { tag: "#one" }], links: [], embeds: [] },
      ],
    ]);
    const app = {
      vault: {
        getFiles: () => [first, attachment, second],
        read: async (target: { path: string }) => {
          if (target.path === "B.md") throw new Error("deleted");
          return contents.get(target.path) ?? "";
        },
      },
      metadataCache: {
        getFileCache: (target: { path: string }) => cache.get(target.path),
        resolvedLinks: { "A.md": { "B.md": 2 } },
        unresolvedLinks: {},
      },
    } as never;
    const snapshot = await scanVault(app, { segmenter: null });
    expect(snapshot.notes.map((note) => note.path)).toEqual(["A.md"]);
    expect(snapshot.scan.skippedCount).toBe(1);
    expect(snapshot.files.byExtension).toEqual({ md: 2, png: 1 });
    expect(snapshot.files.attachmentPaths).toEqual(["image.png"]);
    expect(snapshot.notes[0]?.resourceRefs).toEqual(["image.png"]);
    expect(snapshot.notes[0]?.taskOpen).toBe(1);
    expect(snapshot.notes[0]?.unresolvedLinks).toEqual([]);
  });
});
