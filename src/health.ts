import type { ViewConfig } from "./settings";
import type { MarkdownRecord, VaultSnapshot } from "./scan/vault-scanner";

export type HealthIssueKey =
  "orphan" | "untagged" | "broken" | "stale" | "stub" | "tasks";
export interface HealthResult {
  sets: Record<HealthIssueKey, MarkdownRecord[]>;
  dimensions: {
    connectivity: number;
    tagging: number;
    freshness: number;
    completeness: number;
    linkCleanliness: number;
  };
  score: number | null;
  unusedAttachmentRefs: number;
}

function clamp(value: number): number {
  return Math.max(5, Math.min(100, value));
}

export function calculateHealth(
  snapshot: VaultSnapshot,
  config: Pick<ViewConfig, "staleDays">,
): HealthResult {
  const notes = snapshot.notes;
  const now = new Date();
  const staleLine = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - config.staleDays,
  );
  const sets: Record<HealthIssueKey, MarkdownRecord[]> = {
    orphan: notes.filter(
      (note) => note.outgoingLinks.length === 0 && note.incomingLinkCount === 0,
    ),
    untagged: notes.filter((note) => note.tags.length === 0),
    broken: notes.filter((note) => note.unresolvedLinks.length > 0),
    stale: notes.filter((note) => note.modifiedAt < staleLine),
    stub: notes.filter((note) => note.wordCount < 90),
    tasks: notes.filter((note) => note.taskOpen > 0),
  };
  const referenced = new Set(
    notes.flatMap((note) =>
      note.resourceRefs.map(
        (ref) =>
          ref
            .replace(/^!?\[\[/u, "")
            .replace(/\]\]$/u, "")
            .split(/[#[|]/u)[0]
            ?.replaceAll("\\", "/")
            .toLocaleLowerCase() ?? "",
      ),
    ),
  );
  const unusedAttachmentRefs = (snapshot.files.attachmentPaths ?? []).filter(
    (path) => {
      const normalized = path.toLocaleLowerCase();
      const basename = normalized.split("/").pop() ?? normalized;
      return (
        !referenced.has(normalized) &&
        !referenced.has(normalized.replace(/\.([^.]+)$/u, "")) &&
        ![...referenced].some(
          (ref) => ref === basename || ref.endsWith(`/${basename}`),
        )
      );
    },
  ).length;
  if (!notes.length)
    return {
      sets,
      dimensions: {
        connectivity: 0,
        tagging: 0,
        freshness: 0,
        completeness: 0,
        linkCleanliness: 0,
      },
      score: null,
      unusedAttachmentRefs,
    };
  const ratio = (key: HealthIssueKey) => sets[key].length / notes.length;
  const dimensions = {
    connectivity: clamp(100 - ratio("orphan") * 260),
    tagging: clamp(100 - ratio("untagged") * 200),
    freshness: clamp(100 - ratio("stale") * 130),
    completeness: clamp(100 - ratio("stub") * 230),
    linkCleanliness: clamp(100 - ratio("broken") * 300),
  };
  return {
    sets,
    dimensions,
    score: Math.round(
      Object.values(dimensions).reduce((sum, value) => sum + value, 0) / 5,
    ),
    unusedAttachmentRefs,
  };
}
