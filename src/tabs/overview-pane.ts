import { trendOption } from "../charts/options";
import { t } from "../i18n/i18n";
import { svgElement } from "../icons";
import { addDays, dailyMetrics, endOfDay, startOfDay } from "../metrics";
import { WEEKDAYS, WEEKDAY_MIN } from "../ui/constants";
import { el, fmt, fmtW, mdLong, meterRow, panelBox, statGrid } from "../ui/dom";
import type { PaneContext } from "./context";

export function renderOverviewPane(ctx: PaneContext): HTMLElement {
  const pane = ctx.pane("overview");
  const snapshot = ctx.snapshot;
  const config = ctx.config;
  const metrics = ctx.metrics;

  const today = startOfDay(new Date());
  const goal = config.dailyGoal;
  const percent = Math.round((metrics.today.words / Math.max(1, goal)) * 100);
  const circumference = 2 * Math.PI * 51;

  const todayPanel = panelBox(
    t("Today"),
    t("Not affected by the time range"),
    "today-panel",
  );
  const todayHeader = todayPanel.querySelector<HTMLElement>(".panel-header");
  todayHeader?.insertBefore(
    el(
      "span",
      "panel-desc",
      `${mdLong(today)} · ${t(WEEKDAYS[today.getDay()] ?? "Sunday")}`,
    ),
    todayHeader.querySelector(".panel-desc"),
  );

  const grid = el("div", "today-grid");
  const ring = el("figure", "ring");
  const svg = svgElement("svg", {
    viewBox: "0 0 120 120",
    "aria-hidden": "true",
  });
  const track = svgElement("circle", {
    class: "ring-track",
    cx: 60,
    cy: 60,
    r: 51,
  });
  const fill = svgElement("circle", {
    class: "ring-fill",
    cx: 60,
    cy: 60,
    r: 51,
    transform: "rotate(-90 60 60)",
  });
  fill.setAttribute("stroke-dasharray", String(circumference));
  fill.setAttribute(
    "stroke-dashoffset",
    String(circumference * (1 - Math.min(1, Math.max(0, percent / 100)))),
  );
  svg.append(track, fill);
  const ringLabel = el("figcaption", "ring-label");
  ringLabel.append(
    el("b", undefined, fmt(metrics.today.words)),
    el("span", undefined, t("words today")),
  );
  ring.append(svg, ringLabel);

  const stats = el("dl", "today-stats");
  const weekChange =
    metrics.previousWeek > 0
      ? `${metrics.week >= metrics.previousWeek ? "+" : ""}${Math.round(((metrics.week - metrics.previousWeek) / metrics.previousWeek) * 100)}% ${t("vs last week")}`
      : t("No data for last week");
  const monthDays = Math.max(1, today.getDate());
  [
    {
      label: t("Goal completion"),
      value: `${percent}%`,
      sub:
        metrics.today.words >= goal
          ? t("Reached")
          : `${t("Short by")} ${fmt(goal - metrics.today.words)} ${t("words")}`,
    },
    {
      label: t("Current streak"),
      value: `${metrics.currentStreak} ${t("days")}`,
      sub: `${t("Best in range")} ${metrics.bestStreak} ${t("days")}`,
    },
    {
      label: t("This week"),
      value: fmtW(metrics.week),
      sub: weekChange,
    },
    {
      label: t("This month"),
      value: fmtW(metrics.month),
      sub: `${t("Daily average")} ${fmt(metrics.month / monthDays)} ${t("words")}`,
    },
  ].forEach((item) => {
    const row = el("div");
    row.append(
      el("dt", undefined, item.label),
      el("dd", undefined, item.value),
      el("small", undefined, item.sub),
    );
    stats.append(row);
  });

  const sparkBox = el("div", "today-spark");
  const spark = el("div", "spark");
  spark.setAttribute("role", "img");
  spark.setAttribute("aria-label", t("Last 14 days"));
  const recent = dailyMetrics(snapshot, {
    start: addDays(today, -13),
    end: endOfDay(today),
  });
  const peak = Math.max(...recent.map((day) => day.words), 1);
  recent.forEach((day, position) => {
    const bar = el(
      "span",
      day.words === 0
        ? "is-empty"
        : position === recent.length - 1
          ? "is-today"
          : undefined,
    );
    bar.style.height = `${day.words ? Math.max(6, (day.words / peak) * 100) : 5}%`;
    bar.title = `${day.key} · ${fmt(day.words)} ${t("words")}`;
    spark.append(bar);
  });
  const cap = el("p", "spark-cap");
  cap.append(
    el("span", undefined, t("Last 14 days")),
    el("span", undefined, `${t("Peak")} ${fmt(peak)} ${t("words")}`),
  );
  sparkBox.append(spark, cap);
  grid.append(ring, stats, sparkBox);
  todayPanel.append(grid);

  const panels = el("div", "panel-grid");
  const rangePanel = panelBox(t("Range overview"), ctx.rangeLabel, "span-2");
  rangePanel.append(
    statGrid([
      {
        label: t("Range words"),
        value: fmtW(metrics.words),
        unit: t("words"),
        sub: `≈ ${Math.max(1, Math.round(metrics.words / 500))} ${t("pages")}`,
        delta:
          metrics.changePercent === null
            ? undefined
            : `${metrics.changePercent >= 0 ? "↑" : "↓"} ${Math.abs(metrics.changePercent)}%`,
        down: (metrics.changePercent ?? 0) < 0,
      },
      {
        label: t("Notes created"),
        value: fmt(metrics.created.length),
        unit: t("notes"),
        sub: `${t("Modified")} ${fmt(metrics.touched.length)} ${t("notes")}`,
      },
      {
        label: t("Days with output"),
        value: fmt(metrics.activeDays),
        unit: t("days"),
        sub: `${Math.round((metrics.activeDays / Math.max(1, metrics.days.length)) * 100)}% ${t("of the range")} · ${t("Best")} ${metrics.bestStreak} ${t("days")}`,
      },
      {
        label: t("Active-day average"),
        value: fmt(metrics.averageActiveDay),
        unit: t("words"),
        sub: `${t("Range average")} ${fmt(metrics.words / Math.max(1, metrics.days.length))} ${t("words")}`,
      },
      {
        label: t("Tags / links"),
        value: `${metrics.tags} / ${fmt(metrics.links)}`,
        sub: `${t("Attachments")} ${fmt(metrics.resourceRefs)}`,
      },
      {
        label: t("Single-day peak"),
        value: metrics.peakDay ? fmt(metrics.peakDay.words) : "0",
        unit: t("words"),
        sub: metrics.peakDay ? metrics.peakDay.key : "—",
      },
    ]),
  );

  const trendPanel = panelBox(
    t("Writing trend"),
    t("Bars: words per day · Line: 7-day average"),
    "span-2",
  );
  trendPanel.append(
    ctx.addChart(
      "overview",
      "chart",
      (tokens) => ({
        option: trendOption(
          tokens,
          metrics.days.map((day) => ({ label: day.key, words: day.words })),
        ),
      }),
      (params) => {
        const day = metrics.days[params.dataIndex ?? 0];
        if (!day) return;
        ctx.showNotes(
          day.key,
          t("Notes modified on this day"),
          ctx.recordsFor(day.notePaths),
        );
      },
    ),
  );

  const todayNotesPanel = panelBox(
    t("Notes modified today"),
    `${metrics.todayNoteCount} ${t("notes")}`,
  );
  const todayKeys = new Set(metrics.today.notePaths);
  const todayList = el("div", "note-list");
  const touchedToday = snapshot.notes
    .filter((note) => todayKeys.has(note.path))
    .sort((a, b) => b.modifiedAt.getTime() - a.modifiedAt.getTime());
  if (touchedToday.length)
    touchedToday
      .slice(0, 12)
      .forEach((note) => todayList.append(ctx.noteItem(note)));
  else todayList.append(el("p", "empty", t("Nothing modified today yet.")));
  todayNotesPanel.append(todayList);

  const weekStart = addDays(
    today,
    -((today.getDay() - config.weekStartsOn + 7) % 7),
  );
  const weekDays = dailyMetrics(snapshot, {
    start: weekStart,
    end: endOfDay(today),
  });
  const hit = weekDays.filter((day) => day.words >= goal).length;
  const weekPanel = panelBox(
    t("Weekly goal"),
    `${hit} / ${weekDays.length} ${t("days on target")}`,
  );
  if (weekDays.length) {
    const list = el("ol", "chart-list");
    weekDays.forEach((day) =>
      list.append(
        meterRow(
          t(WEEKDAY_MIN[day.date.getDay()] ?? "Su"),
          day.words / Math.max(1, goal),
          fmt(day.words),
          day.words < goal,
        ),
      ),
    );
    weekPanel.append(list);
  } else weekPanel.append(el("p", "empty", t("No data in this range.")));

  panels.append(rangePanel, trendPanel, todayNotesPanel, weekPanel);
  pane.append(todayPanel, panels);
  return pane;
}
