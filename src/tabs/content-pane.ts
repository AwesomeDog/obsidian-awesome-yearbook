import {
  filesOption,
  histOption,
  tagsOption,
  treeOption,
  wordsOption,
} from "../charts/options";
import { t } from "../i18n/i18n";
import {
  aggregateWordFrequencies,
  folderWordTotals,
  lengthDistribution,
  topTags,
} from "../metrics";
import { el, panelBox } from "../ui/dom";
import type { PaneContext } from "./context";

export function renderContentPane(ctx: PaneContext): HTMLElement {
  const pane = ctx.pane("content");
  const snapshot = ctx.snapshot;
  const metrics = ctx.metrics;

  const panels = el("div", "panel-grid");
  const tagPanel = panelBox(t("Top tags"), t("Click a bar to list its notes"));
  const tags = topTags(metrics.touched, 12);
  tagPanel.append(
    ctx.addChart(
      "content",
      "chart tall",
      (tokens) => ({ option: tagsOption(tokens, tags) }),
      (params) => {
        const tag = tags[params.dataIndex ?? 0];
        if (!tag) return;
        ctx.showNotes(
          `#${tag.name}`,
          t("Notes with this tag"),
          metrics.touched.filter((note) => note.tags.includes(tag.name)),
        );
      },
    ),
  );

  const folders = folderWordTotals(metrics.touched).slice(0, 14);
  const folderPanel = panelBox(
    t("Folder distribution"),
    t("Area equals current words"),
  );
  folderPanel.append(
    ctx.addChart("content", "chart tall", (tokens) => ({
      option: treeOption(tokens, folders),
    })),
  );

  const bins = lengthDistribution(metrics.touched);
  const histPanel = panelBox(
    t("Note length distribution"),
    t("Click for the notes in a bucket"),
  );
  histPanel.append(
    ctx.addChart(
      "content",
      "chart",
      (tokens) => ({
        option: histOption(
          tokens,
          bins.map((bin) => ({ label: bin.label, count: bin.count })),
        ),
      }),
      (params) => {
        const bin = bins[params.dataIndex ?? 0];
        if (!bin) return;
        ctx.showNotes(
          `${bin.label} ${t("words")}`,
          t("Notes in this bucket"),
          metrics.touched.filter(
            (note) => note.wordCount >= bin.min && note.wordCount < bin.max,
          ),
        );
      },
    ),
  );

  const files = Object.entries(snapshot.files.byExtension)
    .map(([name, value]) => ({ name: name || t("No extension"), value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);
  const filePanel = panelBox(
    t("Vault file composition"),
    t("Whole vault · Ignores the time range"),
  );
  filePanel.append(
    ctx.addChart("content", "chart", (tokens) => ({
      option: filesOption(tokens, files),
    })),
  );

  const wordsPanel = panelBox(
    t("Frequent words"),
    t("Stop words removed · Find your own catchphrases"),
    "span-2",
  );
  if (snapshot.segmenterAvailable === false)
    wordsPanel.append(
      el("p", "empty", t("Word frequency is unavailable in this environment.")),
    );
  else
    wordsPanel.append(
      ctx.addChart("content", "chart", (tokens) => ({
        option: wordsOption(
          tokens,
          aggregateWordFrequencies(metrics.touched, 12),
        ),
      })),
    );

  const hubPanel = panelBox(t("Most linked notes"), t("Your central nodes"));
  const hubList = el("div", "note-list");
  snapshot.notes
    .slice()
    .sort((a, b) => b.incomingLinkCount - a.incomingLinkCount)
    .slice(0, 7)
    .forEach((note) =>
      hubList.append(
        ctx.noteItem(
          note,
          "link",
          `${note.incomingLinkCount} ${t("incoming links")}`,
          `${note.outgoingLinks.length} ${t("outgoing links")}`,
        ),
      ),
    );
  if (!hubList.childElementCount)
    hubList.append(el("p", "empty", t("No notes in this range.")));
  hubPanel.append(hubList);

  const longPanel = panelBox(t("Longest notes"), t("Within the range"));
  const longList = el("div", "note-list");
  metrics.touched
    .slice()
    .sort((a, b) => b.wordCount - a.wordCount)
    .slice(0, 7)
    .forEach((note) => longList.append(ctx.noteItem(note)));
  if (!longList.childElementCount)
    longList.append(el("p", "empty", t("No notes in this range.")));
  longPanel.append(longList);

  panels.append(
    tagPanel,
    folderPanel,
    histPanel,
    filePanel,
    wordsPanel,
    hubPanel,
    longPanel,
  );
  pane.append(panels);
  return pane;
}
