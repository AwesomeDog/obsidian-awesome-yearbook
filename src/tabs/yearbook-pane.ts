import { yearCumulativeOption, yearMonthOption } from "../charts/options";
import { t } from "../i18n/i18n";
import { icon, type IconName } from "../icons";
import { dailyMetrics } from "../metrics";
import type { ViewConfig } from "../settings";
import {
  CARD_PALETTES,
  CARD_RATIOS,
  cardText,
  drawShareCard,
} from "../share-card";
import {
  el,
  fmt,
  fmtW,
  iconButton,
  md,
  mdLong,
  meterRow,
  panelBox,
  settingItem,
  statGrid,
  text,
} from "../ui/dom";
import { availableYears, buildYearbook, type YearbookModel } from "../yearbook";
import type { PaneContext } from "./context";

function longestRun(days: { date: Date; words: number }[]): {
  length: number;
  start: Date | null;
  end: Date | null;
} {
  let best = {
    length: 0,
    start: null as Date | null,
    end: null as Date | null,
  };
  let start: Date | null = null;
  let run = 0;
  for (const day of days) {
    if (day.words > 0) {
      start ??= day.date;
      run++;
      if (run > best.length) best = { length: run, start, end: day.date };
    } else {
      start = null;
      run = 0;
    }
  }
  return best;
}

export function renderYearbookPane(ctx: PaneContext): HTMLElement {
  const pane = ctx.pane("yearbook");
  const snapshot = ctx.snapshot;
  const config = ctx.config;

  const years = availableYears(snapshot);
  if (!years.includes(config.card.year))
    config.card.year = years[0] ?? new Date().getFullYear();
  const year = config.card.year;
  const model = buildYearbook(snapshot, year);
  const isCurrent = year === new Date().getFullYear();
  const index = years.indexOf(year);

  const hero = el("section", "panel year-hero");
  const top = el("div", "year-hero-top");
  const sw = el("div", "year-switch");
  const prev = iconButton("year-prev", "left", t("Previous year"));
  prev.disabled = index >= years.length - 1;
  const next = iconButton("year-next", "right", t("Next year"));
  next.disabled = index <= 0;
  const scope = el(
    "span",
    "year-scope",
    isCurrent
      ? `${t("Jan 1")} – ${mdLong(model.end)} · ${t("In progress")}`
      : t("Full year"),
  );
  sw.append(prev, el("b", undefined, String(year)), next, scope);

  const badges = el("div", "year-badges");
  const previousWords = model.previousWords;
  if (previousWords > 0) {
    const change = Math.round(
      ((model.wordCount - previousWords) / previousWords) * 100,
    );
    badges.append(
      el(
        "span",
        "badge",
        `${change >= 0 ? "↑" : "↓"} ${Math.abs(change)}% vs ${year - 1}`,
      ),
    );
  }
  const streak = longestRun(model.days);
  const plainBadge = (mod: string, name: IconName, label: string) => {
    const span = el("span", `badge ${mod}`);
    span.append(icon(name, "sm"), text(label));
    return span;
  };
  badges.append(
    plainBadge(
      "mod-plain",
      "flame",
      `${t("Longest streak")} ${streak.length} ${t("days")}`,
    ),
    plainBadge(
      "mod-plain",
      "clock",
      model.peakHour === null
        ? `${t("Busiest modification hour")}: ${t("Unavailable")}`
        : `${t("Busiest modification hour")} ${model.peakHour}:00`,
    ),
  );
  top.append(sw, badges);

  const headline = el("p", "year-headline");
  headline.append(
    text(t("This year, you wrote")),
    el("b", undefined, fmt(model.wordCount)),
    text(t("words")),
  );
  const pages = Math.max(1, Math.round(model.wordCount / 500));
  const sub = el(
    "p",
    "year-sub",
    `≈ ${pages} ${t("pages")} · ${t("Attributed by last modification date")}`,
  );
  const body = el("div");
  body.append(headline, sub);

  const topMonth = Math.max(0, model.topMonth - 1);
  const yearDays = model.days.length || 1;
  hero.append(
    top,
    body,
    statGrid([
      {
        label: t("Notes created"),
        value: fmt(model.createdNotes.length),
        unit: t("notes"),
        sub: `${t("Average")} ${fmt(model.wordCount / Math.max(1, model.createdNotes.length))} ${t("words")}`,
      },
      {
        label: t("Modification days"),
        value: fmt(model.modifiedDays),
        unit: t("days"),
        sub: `${Math.round((model.modifiedDays / yearDays) * 100)}% ${t("of the year")}`,
      },
      {
        label: t("Longest streak"),
        value: fmt(streak.length),
        unit: t("days"),
        sub:
          streak.start && streak.end
            ? `${md(streak.start)} – ${md(streak.end)}`
            : "—",
      },
      {
        label: t("Active-day average"),
        value: fmt(model.wordCount / Math.max(1, model.modifiedDays)),
        unit: t("words"),
        sub: t("Only days with output"),
      },
      {
        label: t("Top month"),
        value: String(topMonth + 1),
        unit: t("Month"),
        sub: `${fmtW(model.monthlyWords[topMonth] ?? 0)} ${t("words")}`,
      },
      {
        label: t("Same period, previous year"),
        value: fmtW(previousWords),
        sub: previousWords
          ? `${t("Difference")} ${model.wordCount >= previousWords ? "+" : "-"}${fmtW(Math.abs(model.wordCount - previousWords))} ${t("words")}`
          : t("No comparison period"),
      },
    ]),
  );

  const grid = el("div", "yearbook-grid");
  const stage = el("figure", "card-stage");
  const canvas = el("canvas");
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", t("Share card preview"));
  drawShareCard(canvas, model, {
    ratio: config.card.ratio,
    palette: config.card.palette,
    blocks: config.card.blocks,
    privacy: config.card.privacy,
    handle: config.card.handle,
    vaultName: ctx.vaultName,
  });
  const size = CARD_RATIOS[config.card.ratio];
  stage.append(
    canvas,
    el(
      "figcaption",
      undefined,
      `${size[0]} × ${size[1]} · ${t("Exported at 2x")}`,
    ),
  );

  const side = el("div", "card-side");
  side.append(
    buildCardPanel(config),
    buildCardTextPanel(model, config.card.privacy),
  );
  grid.append(stage, side);

  const panels = el("div", "panel-grid");
  const monthPanel = panelBox(
    t("Monthly output"),
    t("Bars: this year · Line: the same month last year"),
    "span-2",
  );
  monthPanel.append(
    ctx.addChart(
      "yearbook",
      "chart",
      (tokens) => ({
        option: yearMonthOption(
          tokens,
          model.monthlyWords,
          model.previousMonthlyWords,
          year,
        ),
      }),
      (params) => {
        const month = params.dataIndex ?? 0;
        ctx.showNotes(
          `${year}-${String(month + 1).padStart(2, "0")}`,
          t("Notes modified in this month"),
          model.days
            .filter((day) => day.date.getMonth() === month)
            .flatMap((day) => ctx.recordsFor(day.notePaths)),
        );
      },
    ),
  );

  const cumPanel = panelBox(
    t("Cumulative vs. last year"),
    t("Compared with the same point last year"),
  );
  cumPanel.append(
    ctx.addChart("yearbook", "chart", (tokens) => {
      const previousStart = new Date(year - 1, 0, 1);
      const previousEnd = new Date(year - 1, 11, 31, 23, 59, 59, 999);
      const previousDays = dailyMetrics(snapshot, {
        start: previousStart,
        end: previousEnd,
      });
      let running = 0;
      const current = model.days.map((day) => (running += day.words));
      let previousRunning = 0;
      const previous = previousDays.map(
        (day) => (previousRunning += day.words),
      );
      return {
        option: yearCumulativeOption(
          tokens,
          current,
          previous,
          model.days.map((day) => md(day.date)),
          year,
        ),
      };
    }),
  );

  const tagPanel = panelBox(t("Topics of the year"), t("By note count"));
  appendTagMeters(tagPanel, model);

  const topPanel = panelBox(
    t("Note of the year"),
    t("Created this year · By current words"),
  );
  const topList = el("div", "note-list");
  const topNotes = model.createdNotes
    .slice()
    .sort((a, b) => b.wordCount - a.wordCount)
    .slice(0, 5);
  if (topNotes.length)
    topNotes.forEach((note) => topList.append(ctx.noteItem(note)));
  else topList.append(el("p", "empty", t("No notes created this year.")));
  topPanel.append(topList);

  const momentPanel = panelBox(
    t("Moments of the year"),
    t("The storyline in your data"),
  );
  momentPanel.append(buildTimeline(model, streak, isCurrent));

  panels.append(monthPanel, cumPanel, tagPanel, topPanel, momentPanel);
  pane.append(hero, grid, panels);
  return pane;
}

function buildCardPanel(config: ViewConfig): HTMLElement {
  const panel = panelBox(
    t("Share card"),
    t("The layout engine drops modules that do not fit"),
  );
  const ratios = el("div", "segmented");
  ratios.setAttribute("role", "group");
  ratios.setAttribute("aria-label", t("Ratio"));
  const ratioLabels: Record<string, string> = {
    "9:16": t("9:16 story"),
    "4:5": t("4:5 post"),
    "1:1": t("1:1 square"),
  };
  (Object.keys(CARD_RATIOS) as (keyof typeof CARD_RATIOS)[]).forEach(
    (ratio) => {
      const button = el("button", undefined, ratioLabels[ratio] ?? ratio);
      button.type = "button";
      button.dataset.ratio = ratio;
      button.setAttribute("aria-pressed", String(config.card.ratio === ratio));
      ratios.append(button);
    },
  );

  const palettes = el("div", "palette-row");
  CARD_PALETTES.forEach((palette) => {
    const button = el(
      "button",
      `palette${config.card.palette === palette.id ? " is-active" : ""}`,
    );
    button.type = "button";
    button.dataset.palette = palette.id;
    const swatch = el("i");
    swatch.style.background = `linear-gradient(135deg,${palette.bg[0]},${palette.bg[1]} 58%,${palette.accent})`;
    button.append(swatch, el("span", undefined, t(palette.name)));
    palettes.append(button);
  });

  const handle = el("input");
  handle.type = "text";
  handle.value = config.card.handle;
  handle.dataset.setting = "handle";
  handle.maxLength = 24;
  handle.placeholder = t("your-name");
  handle.setAttribute("aria-label", t("Username"));

  const blocks = el("div", "block-toggles");
  const blockLabels: Record<string, string> = {
    heat: t("Heatmap"),
    topics: t("Topics"),
    duo: t("Peak hour and representative note"),
    words: t("Catchphrase"),
    closing: t("Closing note"),
  };
  Object.entries(config.card.blocks).forEach(([key, enabled]) => {
    const name = blockLabels[key] ?? key;
    const label = el("span", "block-toggle");
    const toggle = el("button", `toggle${enabled ? " is-on" : ""}`);
    toggle.type = "button";
    toggle.dataset.block = key;
    toggle.setAttribute("role", "switch");
    toggle.setAttribute("aria-checked", String(enabled));
    toggle.setAttribute("aria-label", name);
    label.append(toggle, text(name));
    blocks.append(label);
  });

  const privacyLabel = el("span", "block-toggle is-privacy");
  const privacyToggle = el(
    "button",
    `toggle${config.card.privacy ? " is-on" : ""}`,
  );
  privacyToggle.type = "button";
  privacyToggle.dataset.privacy = "on";
  privacyToggle.setAttribute("role", "switch");
  privacyToggle.setAttribute("aria-checked", String(config.card.privacy));
  privacyToggle.setAttribute("aria-label", t("Privacy mode"));
  privacyToggle.title = t("Masks the vault name, titles, tags and words");
  privacyLabel.append(privacyToggle, text(t("Privacy mode")));
  blocks.append(privacyLabel);

  const actions = el("div", "card-actions");
  const download = el("button", "btn mod-cta");
  download.type = "button";
  download.dataset.action = "download";
  download.append(icon("download", "sm"), text(t("Download PNG")));
  const copyImage = el("button", "btn");
  copyImage.type = "button";
  copyImage.dataset.action = "copy-image";
  copyImage.append(icon("copy", "sm"), text(t("Copy image")));
  const copyText = el("button", "btn");
  copyText.type = "button";
  copyText.dataset.action = "copy-text";
  copyText.append(icon("copy", "sm"), text(t("Copy text")));
  actions.append(download, copyImage, copyText);

  panel.append(
    settingItem(t("Ratio"), t("Pick the shape for the platform"), ratios),
    settingItem(
      t("Palette"),
      t("Independent of the interface theme"),
      palettes,
    ),
    settingItem(t("Username"), t("Written into the headline as @name"), handle),
    settingItem(
      t("Included modules"),
      t("Disabled modules hand their space to the rest"),
      blocks,
    ),
    actions,
  );
  return panel;
}

function buildCardTextPanel(
  model: YearbookModel,
  privacy: boolean,
): HTMLElement {
  const panel = panelBox(t("Copy text"), t("Click to select all, then paste"));
  const area = el("textarea");
  area.rows = 6;
  area.readOnly = true;
  area.value = cardText(model, privacy);
  panel.append(area);
  return panel;
}

function appendTagMeters(panel: HTMLElement, model: YearbookModel): void {
  if (!model.topTags.length) {
    panel.append(el("p", "empty", t("No tags this year.")));
    return;
  }
  const list = el("ol", "chart-list");
  const max = model.topTags[0]?.notes ?? 1;
  model.topTags.forEach((tag, position) =>
    list.append(
      meterRow(
        `#${tag.name}`,
        tag.notes / max,
        `${tag.notes} ${t("notes")}`,
        position !== 0,
        "mod-tag",
      ),
    ),
  );
  panel.append(list);
}

function buildTimeline(
  model: YearbookModel,
  streak: { length: number; start: Date | null; end: Date | null },
  isCurrent: boolean,
): HTMLElement {
  const list = el("ol", "timeline");
  const moment = (
    time: string,
    title: string,
    note: string,
    muted?: boolean,
  ) => {
    const item = el("li", muted ? "is-muted" : undefined);
    item.append(el("time", undefined, time));
    const box = el("div");
    box.append(el("b", undefined, title), el("span", undefined, note));
    item.append(box);
    list.append(item);
  };
  const first = model.createdNotes
    .slice()
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];
  if (first)
    moment(
      md(first.createdAt),
      t("First note this year"),
      `${first.title} · ${first.folder || "."}`,
    );
  const bestDay = model.days.slice().sort((a, b) => b.words - a.words)[0];
  if (bestDay && bestDay.words > 0)
    moment(
      md(bestDay.date),
      t("Highest attributed day"),
      `${fmt(bestDay.words)} ${t("words")} · ${bestDay.notePaths.length} ${t("notes")}`,
    );
  if (streak.start && streak.end && streak.length > 1)
    moment(
      `${md(streak.start)}–${md(streak.end)}`,
      `${t("Longest streak")} ${streak.length} ${t("days")}`,
      t("Your steadiest stretch"),
    );
  if (model.longestSilence)
    moment(
      `${md(model.longestSilence.start)}–${md(model.longestSilence.end)}`,
      `${t("Silent for")} ${model.longestSilence.days} ${t("days")}`,
      t("No note was modified in this window"),
      true,
    );
  moment(
    md(model.end),
    isCurrent ? t("Up to today") : t("Year end"),
    `${fmt(model.wordCount)} ${t("words")} · ${model.createdNotes.length} ${t("notes")}`,
  );
  return list;
}
