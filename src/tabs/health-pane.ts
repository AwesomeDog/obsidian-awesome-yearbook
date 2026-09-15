import { radarOption } from "../charts/options";
import { calculateHealth } from "../health";
import { icon } from "../icons";
import { t } from "../i18n/i18n";
import { ISSUE_ROWS } from "../ui/constants";
import { callout, el, panelBox } from "../ui/dom";
import type { PaneContext } from "./context";

export function renderHealthPane(ctx: PaneContext): HTMLElement {
  const pane = ctx.pane("health");
  const snapshot = ctx.snapshot;
  const config = ctx.config;
  const health = calculateHealth(snapshot, config);

  const panels = el("div", "panel-grid");
  const scorePanel = panelBox(
    t("Vault health"),
    t("Whole vault · Ignores the time range"),
  );
  const wrap = el("div", "score-wrap");
  const score = el("div", "score");
  score.append(
    el("b", undefined, health.score === null ? "—" : String(health.score)),
    el("span", undefined, grade(health.score)),
  );
  const dimensions = [
    { name: t("Connectivity"), value: health.dimensions.connectivity },
    { name: t("Tagging"), value: health.dimensions.tagging },
    { name: t("Freshness"), value: health.dimensions.freshness },
    { name: t("Completeness"), value: health.dimensions.completeness },
    { name: t("Link integrity"), value: health.dimensions.linkCleanliness },
  ];
  wrap.append(
    score,
    ctx.addChart("health", "chart short", (tokens) => ({
      option: radarOption(tokens, dimensions),
    })),
  );
  scorePanel.append(wrap);

  const issuePanel = panelBox(
    t("To do"),
    t("Click a row to list the notes on the right"),
  );
  const issueList = el("div", "issue-list");
  ISSUE_ROWS.forEach((row) => {
    const button = el("button", row.mod ? `issue ${row.mod}` : "issue");
    button.type = "button";
    button.dataset.issue = row.key;
    const iconBox = el("span", "issue-icon");
    iconBox.append(icon(row.icon, "sm"));
    const body = el("span", "issue-body");
    body.append(
      el("span", "issue-name", t(row.name)),
      el("span", "issue-desc", t(row.desc)),
    );
    const count =
      row.key === "attach"
        ? health.unusedAttachmentRefs
        : health.sets[row.key].length;
    button.append(
      iconBox,
      body,
      el("span", "issue-count", String(count)),
      icon("chevron", "sm"),
    );
    issueList.append(button);
  });
  issuePanel.append(issueList);

  const advicePanel = panelBox(
    t("Tidy-up advice"),
    t("Ordered by effort and payoff"),
    "span-2",
  );
  const adviceGrid = el("div", "advice-grid");
  const worst = [...dimensions].sort((a, b) => a.value - b.value)[0];
  adviceGrid.append(
    callout(
      "mod-info",
      "trend",
      `${t("Fix this first")}: ${worst?.name ?? t("Unavailable")}`,
      t(
        "This is your weakest dimension, so it has the most room to improve. Start here and the score moves fastest.",
      ),
    ),
    callout(
      "mod-tip",
      "hash",
      t("Give the forgotten notes a routine"),
      `${health.sets.stale.length} ${t("notes")} ${t("untouched longer than the stale threshold")}. ${t("Review them in batches: tag, archive or delete.")}`,
    ),
    callout(
      "mod-warn",
      "alert",
      t("Fragments lower search quality"),
      `${health.sets.stub.length} ${t("notes")} ${t("under 90 words")}. ${t("Merge them into a topic note or delete them.")}`,
    ),
  );
  advicePanel.append(adviceGrid);

  panels.append(scorePanel, issuePanel, advicePanel);
  pane.append(panels);
  return pane;
}

function grade(score: number | null): string {
  if (score === null) return t("Unavailable");
  if (score >= 85) return t("Very tidy");
  if (score >= 70) return t("Fine");
  if (score >= 55) return t("Needs a sweep");
  return t("A bit messy");
}
