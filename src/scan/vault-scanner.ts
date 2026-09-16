import type { App, CachedMetadata, TFile } from "obsidian";
import { createSegmenter, parseMarkdown, type SegmenterLike } from "./markdown";

export interface MarkdownRecord {
  path: string;
  title: string;
  folder: string;
  createdAt: Date;
  modifiedAt: Date;
  wordCount: number;
  wordFrequencies: Record<string, number>;
  tags: string[];
  outgoingLinks: string[];
  unresolvedLinks: string[];
  incomingLinkCount: number;
  taskOpen: number;
  resourceRefs: string[];
}

export interface FileInventory {
  byExtension: Record<string, number>;
  attachmentPaths?: string[];
}

export interface ScanMetadata {
  startedAt: Date;
  finishedAt: Date;
  elapsedMs: number;
  fileCount: number;
  markdownCount: number;
  skippedCount: number;
}

export interface VaultSnapshot {
  notes: MarkdownRecord[];
  files: FileInventory;
  scan: ScanMetadata;
  segmenterAvailable?: boolean;
  earliestDate?: Date | null;
}

export interface ScanProgress {
  processed: number;
  total: number;
}

export interface ScanOptions {
  onProgress?: (progress: ScanProgress) => void;
  signal?: AbortSignal;
  segmenter?: SegmenterLike | null;
}

/** Notes read between two yields to the event loop. */
const BATCH_SIZE = 24;
/* Reading is async, but parsing is not: a batch that lands between two yields
   runs start to finish in one task. Yielding on a time budget instead of after
   every batch keeps those tasks short on a slow disk and skips the pointless
   yields on a fast one. */
const YIELD_BUDGET_MS = 8;

function normalizePath(path: string): string {
  return path.replaceAll("\\", "/").replace(/^\/+|\/+$/gu, "");
}

function folderOf(path: string): string {
  const slash = path.lastIndexOf("/");
  return slash < 0 ? "" : path.slice(0, slash);
}

function targetKey(target: string): string {
  return normalizePath(
    target.replace(/^\[\[|\]\]$/gu, "").split(/[#[|]/u)[0] ?? "",
  )
    .replace(/\.md$/iu, "")
    .toLocaleLowerCase();
}

function linkDestination(
  sourcePath: string,
  link: string,
  app: App,
  paths: Map<string, TFile>,
): string | null {
  const key = targetKey(link);
  const exact = paths.get(`${key}.md`) ?? paths.get(key);
  if (exact) return exact.path;
  const resolved = app.metadataCache.getFirstLinkpathDest?.(
    link.split(/[#[|]/u)[0] ?? "",
    sourcePath,
  );
  return resolved?.path ?? null;
}

function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => {
    const timer =
      typeof window !== "undefined"
        ? window.setTimeout.bind(window)
        : setTimeout;
    timer(resolve, 0);
  });
}

export async function scanVault(
  app: App,
  options: ScanOptions = {},
): Promise<VaultSnapshot> {
  const startedAt = new Date();
  const files = app.vault
    .getFiles()
    .slice()
    .sort((a, b) => normalizePath(a.path).localeCompare(normalizePath(b.path)));
  const byExtension: Record<string, number> = {};
  for (const file of files) {
    const extension = (
      file.extension ||
      file.name.split(".").pop() ||
      ""
    ).toLocaleLowerCase();
    byExtension[extension] = (byExtension[extension] ?? 0) + 1;
  }
  const markdownFiles = files.filter(
    (file) => (file.extension || "").toLocaleLowerCase() === "md",
  );
  const attachmentPaths = files
    .filter((file) => (file.extension || "").toLocaleLowerCase() !== "md")
    .map((file) => normalizePath(file.path));
  const segmenter =
    options.segmenter === undefined ? createSegmenter() : options.segmenter;
  const notes: MarkdownRecord[] = [];
  const skippedPaths = new Set<string>();
  const pathIndex = new Map<string, TFile>();
  const ambiguousBasenames = new Set<string>();
  for (const file of markdownFiles) {
    const normalized = normalizePath(file.path).toLocaleLowerCase();
    pathIndex.set(normalized, file);
    pathIndex.set(normalized.replace(/\.md$/u, ""), file);
    const basename = (
      file.basename || file.name.replace(/\.md$/iu, "")
    ).toLocaleLowerCase();
    if (ambiguousBasenames.has(basename)) continue;
    if (!pathIndex.has(basename)) pathIndex.set(basename, file);
    else if (pathIndex.get(basename)?.path !== file.path) {
      pathIndex.delete(basename);
      ambiguousBasenames.add(basename);
    }
  }
  let sliceStart = Date.now();
  for (let index = 0; index < markdownFiles.length; index += BATCH_SIZE) {
    const batch = markdownFiles.slice(index, index + BATCH_SIZE);
    await Promise.all(
      batch.map(async (file) => {
        if (options.signal?.aborted) return;
        try {
          const text = await app.vault.read(file);
          const cache: CachedMetadata | null =
            app.metadataCache.getFileCache(file);
          const parsed = parseMarkdown(text, cache, segmenter);
          const unresolvedFromCache =
            app.metadataCache.unresolvedLinks?.[file.path] ?? {};
          const unresolvedLinks = [
            ...new Set([
              ...Object.keys(unresolvedFromCache),
              ...parsed.outgoingLinks.filter(
                (link) => !linkDestination(file.path, link, app, pathIndex),
              ),
            ]),
          ];
          const resourceRefs = parsed.resourceRefs.map(
            (ref) =>
              app.metadataCache.getFirstLinkpathDest?.(ref, file.path)?.path ??
              ref,
          );
          notes.push({
            path: normalizePath(file.path),
            title: file.basename || file.name.replace(/\.md$/iu, ""),
            folder: folderOf(normalizePath(file.path)),
            createdAt: new Date(file.stat.ctime),
            modifiedAt: new Date(file.stat.mtime),
            ...parsed,
            resourceRefs,
            unresolvedLinks,
            incomingLinkCount: 0,
          });
        } catch {
          skippedPaths.add(file.path);
        }
      }),
    );
    options.onProgress?.({
      processed: Math.min(index + batch.length, markdownFiles.length),
      total: markdownFiles.length,
    });
    if (index + BATCH_SIZE >= markdownFiles.length) break;
    if (Date.now() - sliceStart < YIELD_BUDGET_MS) continue;
    await yieldToEventLoop();
    sliceStart = Date.now();
  }
  notes.sort((a, b) => a.path.localeCompare(b.path));
  const noteByPath = new Map(
    notes.map((note) => [note.path.toLocaleLowerCase(), note]),
  );
  for (const note of notes) {
    const resolved = app.metadataCache.resolvedLinks?.[note.path] ?? {};
    for (const [destination, count] of Object.entries(resolved)) {
      const target = noteByPath.get(
        normalizePath(destination).toLocaleLowerCase(),
      );
      if (target) target.incomingLinkCount += count;
    }
    if (!Object.keys(resolved).length) {
      for (const link of note.outgoingLinks) {
        const destination = linkDestination(note.path, link, app, pathIndex);
        const target = destination
          ? noteByPath.get(destination.toLocaleLowerCase())
          : undefined;
        if (target) target.incomingLinkCount++;
      }
    }
  }
  const finishedAt = new Date();
  const earliest = notes.reduce<Date | null>((earliestDate, note) => {
    const value =
      note.modifiedAt < note.createdAt ? note.modifiedAt : note.createdAt;
    return !earliestDate || value < earliestDate ? value : earliestDate;
  }, null);
  return {
    notes,
    files: {
      byExtension,
      attachmentPaths,
    },
    scan: {
      startedAt,
      finishedAt,
      elapsedMs: finishedAt.getTime() - startedAt.getTime(),
      fileCount: files.length,
      markdownCount: markdownFiles.length,
      skippedCount: skippedPaths.size,
    },
    segmenterAvailable: segmenter !== null,
    earliestDate: earliest,
  };
}
