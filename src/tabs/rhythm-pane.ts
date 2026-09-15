import {
  clockOption,
  cumulativeOption,
  heatOption,
  monthOption,
  punchOption,
} from "../charts/options";
import { t } from "../i18n/i18n";
import { WEEKDAYS } from "../ui/constants";
import { el, fmt, kvGrid, panelBox } from "../ui/dom";
import type { PaneContext } from "./context";

export function renderRhythmPane(ctx: PaneContext): HTMLElement {
  const pane = ctx.pane("rhythm");
  const config = ctx.config;
  const metrics = ctx.metrics;
  const weekStartsOn = config.weekStartsOn;
  const dayOrder = Array.from(
    { length: 7 },
    (_value, index) => (weekStartsOn + index) % 7,
  );
  const dayNames = dayOrder.map((day) => t(WEEKDAYS[day] ?? "Sunday"));
  const monthNames = Array.from({ length: 12 }, (_value, index) =>
    String(index + 1),
  );

  const heatPanel = panelBox(
    t("Writing heatmap"),
    `${metrics.days.length} ${t("days")} · ${metrics.activeDays} ${t("with output")} · ${t("Peak")} ${fmt(metrics.peakDay?.words ?? 0)} ${t("words")}`,
  );
  heatPanel.append(
    ctx.addChart(
      "rhythm",
      "chart",
      (tokens, width) =>
        heatOption(tokens, {
          days: metrics.days.map((day) => ({
            key: day.key,
            words: day.words,
          })),
          firstDay: weekStartsOn,
          dayNames: WEEKDAYS.map((day) => t(day)),
          monthNames,
          width,
        }),
      (params) => {
        const key = Array.isArray(params.value)
          ? String(params.value[0] ?? "")
          : "";
        const day = metrics.days.find((item) => item.key === key);
        if (!day) return;
        ctx.showNotes(
          key,
          t("Notes modified on this day"),
          ctx.recordsFor(day.notePaths),
        );
      },
    ),
  );

  const panels = el("div", "panel-grid");
  const buckets = new Map<string, number>();
  metrics.days.forEach((day) => {
    const key = `${day.date.getFullYear()}-${day.date.getMonth()}`;
    buckets.set(key, (buckets.get(key) ?? 0) + day.words);
  });
  const monthBuckets = [...buckets.entries()].map(([key, value]) => ({
    label: `${Number(key.split("-")[1] ?? 0) + 1}`,
    value,
  }));
  const monthPanel = panelBox(t("Monthly output"), t("Words per month"));
  monthPanel.append(
    ctx.addChart("rhythm", "chart", (tokens) => ({
      option: monthOption(tokens, monthBuckets),
    })),
  );

  let running = 0;
  const cumulative = metrics.days.map((day) => ({
    key: day.key,
    value: (running += day.words),
  }));
  const cumPanel = panelBox(
    t("Cumulative current words"),
    t("Attributed by last modification date"),
  );
  cumPanel.append(
    ctx.addChart("rhythm", "chart", (tokens) => ({
      option: cumulativeOption(tokens, cumulative),
    })),
  );

  const slotTotals = Array.from({ length: 7 }, () =>
    new Array<number>(24).fill(0),
  );
  metrics.days.forEach((day) => {
    const row = slotTotals[(day.date.getDay() - weekStartsOn + 7) % 7];
    if (!row) return;
    day.hours.forEach((value, hour) => {
      row[hour] = (row[hour] ?? 0) + value;
    });
  });
  const cells: { hour: number; day: number; words: number }[] = [];
  slotTotals.forEach((row, day) =>
    row.forEach((words, hour) => {
      if (words > 0) cells.push({ hour, day, words });
    }),
  );
  const punchPanel = panelBox(
    t("Weekday × hour"),
    t("Bigger dot, more words · Click for that slot"),
    "span-2",
  );
  punchPanel.append(
    ctx.addChart(
      "rhythm",
      "chart tall",
      (tokens) => ({ option: punchOption(tokens, cells, dayNames) }),
      (params) => {
        const value = Array.isArray(params.value) ? params.value : [];
        const hour = Number(value[0] ?? 0);
        const dayIndex = Number(value[1] ?? 0);
        const matching = metrics.days.filter(
          (item) => (item.date.getDay() - weekStartsOn + 7) % 7 === dayIndex,
        );
        ctx.showNotes(
          `${dayNames[dayIndex] ?? ""} ${hour}:00`,
          t("Notes modified in this slot"),
          matching.flatMap((item) => ctx.recordsFor(item.notePaths)),
        );
      },
    ),
  );

  const hours = new Array<number>(24).fill(0);
  metrics.days.forEach((day) =>
    day.hours.forEach((value, hour) => {
      hours[hour] = (hours[hour] ?? 0) + value;
    }),
  );
  const clockPanel = panelBox(
    t("Distribution over a day"),
    t("24 hours · last modification"),
  );
  clockPanel.append(
    ctx.addChart("rhythm", "chart", (tokens) => ({
      option: clockOption(tokens, hours),
    })),
  );

  const weekTotals = new Array<number>(7).fill(0);
  const weekCounts = new Array<number>(7).fill(0);
  metrics.days.forEach((day) => {
    const slot = (day.date.getDay() - weekStartsOn + 7) % 7;
    weekTotals[slot] = (weekTotals[slot] ?? 0) + day.words;
    weekCounts[slot] = (weekCounts[slot] ?? 0) + 1;
  });
  const averages = weekTotals.map(
    (value, index) => value / Math.max(1, weekCounts[index] ?? 1),
  );
  const bestSlot = averages.indexOf(Math.max(...averages));
  const peakHour = hours.some(Boolean)
    ? hours.indexOf(Math.max(...hours))
    : null;
  const totalWords = Math.max(1, metrics.words);
  const night = hours
    .slice(22)
    .concat(hours.slice(0, 5))
    .reduce((sum, value) => sum + value, 0);
  const summaryPanel = panelBox(t("Rhythm summary"));
  summaryPanel.append(
    kvGrid([
      {
        label: t("Current streak"),
        value: `${metrics.currentStreak} ${t("days")}`,
        note: t("Through today"),
      },
      {
        label: t("Longest streak"),
        value: `${metrics.bestStreak} ${t("days")}`,
        note: t("In range"),
      },
      {
        label: t("Longest gap"),
        value: `${metrics.longestGap} ${t("days")}`,
        note: t("No notes modified"),
      },
      {
        label: t("Most active weekday"),
        value:
          Math.max(...averages) > 0
            ? t(WEEKDAYS[dayOrder[bestSlot] ?? 0] ?? "Sunday")
            : t("Unavailable"),
        note: `${t("Daily average")} ${fmt(averages[bestSlot] ?? 0)} ${t("words")}`,
      },
      {
        label: t("Busiest modification hour"),
        value: peakHour === null ? t("Unavailable") : `${peakHour}:00`,
        note: `${Math.round(((peakHour === null ? 0 : (hours[peakHour] ?? 0)) / totalWords) * 100)}%`,
      },
      {
        label: t("Night share"),
        value: `${Math.round((night / totalWords) * 100)}%`,
        note: t("22:00–05:00"),
      },
    ]),
  );

  panels.append(monthPanel, cumPanel, punchPanel, clockPanel, summaryPanel);
  pane.append(heatPanel, panels);
  return pane;
}
