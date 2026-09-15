import type { EChartsOption } from "echarts";
import { t } from "../i18n/i18n";
import { fullNumber, shortNumber, type ChartTokens } from "./index";
import { axis, base, fade, legend, valueAxis } from "./theme";

interface TipPoint {
  name?: string;
  seriesName?: string;
  marker?: string;
  axisValue?: string;
  dataIndex?: number;
  percent?: number;
  value?: unknown;
}
const asPoints = (value: unknown): TipPoint[] => {
  const list: unknown[] = Array.isArray(value) ? value : [value ?? {}];
  return list as TipPoint[];
};
const num = (value: unknown): number =>
  typeof value === "number"
    ? value
    : Number(Array.isArray(value) ? value[1] : value) || 0;

/* ==========================================================================
   The fixed chart set. There is no chart picker: each panel owns its chart.
   ========================================================================= */

export function yearMonthOption(
  tk: ChartTokens,
  months: number[],
  previous: number[],
  year: number,
): EChartsOption {
  const top = Math.max(...months, 0);
  return {
    ...base(tk),
    grid: { left: 48, right: 16, top: 30, bottom: 26 },
    legend: legend(tk),
    tooltip: {
      ...base(tk).tooltip,
      trigger: "axis",
      formatter: (params: unknown) =>
        `${asPoints(params)[0]?.axisValue ?? ""}<br>` +
        asPoints(params)
          .map(
            (p) =>
              `${p.marker ?? ""}${p.seriesName ?? ""} <b>${fullNumber(num(p.value))}</b> ${t("words")}`,
          )
          .join("<br>"),
    },
    xAxis: {
      type: "category",
      data: months.map((_value, index) => `${index + 1}`),
      ...axis(tk),
      splitLine: { show: false },
    },
    yAxis: valueAxis(tk),
    series: [
      {
        name: `${year}`,
        type: "bar",
        barMaxWidth: 34,
        data: months.map((value) => ({
          value,
          itemStyle: {
            color: value === top && value > 0 ? tk.accent : tk.acc(0.5),
            borderRadius: [3, 3, 0, 0],
          },
        })),
      },
      {
        name: `${year - 1}`,
        type: "line",
        data: previous,
        showSymbol: false,
        lineStyle: { color: tk.base40, width: 1.5, type: "dashed" },
      },
    ],
  };
}

export function yearCumulativeOption(
  tk: ChartTokens,
  current: number[],
  previous: number[],
  labels: string[],
  year: number,
): EChartsOption {
  return {
    ...base(tk),
    grid: { left: 52, right: 16, top: 30, bottom: 26 },
    legend: legend(tk),
    tooltip: {
      ...base(tk).tooltip,
      trigger: "axis",
      formatter: (params: unknown) =>
        `${asPoints(params)[0]?.axisValue ?? ""}<br>` +
        asPoints(params)
          .map(
            (p) =>
              `${p.marker ?? ""}${p.seriesName ?? ""} <b>${shortNumber(num(p.value))}</b>`,
          )
          .join("<br>"),
    },
    xAxis: {
      type: "category",
      data: labels,
      ...axis(tk),
      splitLine: { show: false },
      axisLabel: { color: tk.faint, interval: 30 },
    },
    yAxis: valueAxis(tk),
    series: [
      {
        name: `${year}`,
        type: "line",
        data: current,
        showSymbol: false,
        lineStyle: { color: tk.accent, width: 2 },
        areaStyle: { color: fade(tk) },
      },
      {
        name: `${year - 1}`,
        type: "line",
        data: previous,
        showSymbol: false,
        lineStyle: { color: tk.base40, width: 1.5, type: "dashed" },
      },
    ],
  };
}

export function trendOption(
  tk: ChartTokens,
  days: { label: string; words: number }[],
): EChartsOption {
  const moving = days.map((_day, index) => {
    const window = days.slice(Math.max(0, index - 6), index + 1);
    return Math.round(
      window.reduce((sum, day) => sum + day.words, 0) /
        Math.max(1, window.length),
    );
  });
  const shown = days.length > 180 ? days.slice(-180) : days;
  return {
    ...base(tk),
    grid: { left: 48, right: 16, top: 18, bottom: 26 },
    tooltip: {
      ...base(tk).tooltip,
      trigger: "axis",
      formatter: (params: unknown) =>
        `${asPoints(params)[0]?.axisValue ?? ""}<br>` +
        asPoints(params)
          .map(
            (p) =>
              `${p.marker ?? ""}${p.seriesName ?? ""} <b>${fullNumber(num(p.value))}</b> ${t("words")}`,
          )
          .join("<br>"),
    },
    xAxis: {
      type: "category",
      data: shown.map((day) => day.label),
      ...axis(tk),
      splitLine: { show: false },
      axisLabel: { color: tk.faint, interval: Math.ceil(shown.length / 12) },
    },
    yAxis: valueAxis(tk),
    series: [
      {
        name: t("Daily"),
        type: "bar",
        data: shown.map((day) => day.words),
        barMaxWidth: 14,
        itemStyle: { color: tk.acc(0.42), borderRadius: [2, 2, 0, 0] },
      },
      {
        name: t("7-day average"),
        type: "line",
        data: moving.slice(-shown.length),
        showSymbol: false,
        lineStyle: { color: tk.accent, width: 2 },
      },
    ],
  };
}

export interface HeatInput {
  days: { key: string; words: number }[];
  firstDay: number;
  dayNames: string[];
  monthNames: string[];
  width: number;
}

export function heatOption(
  tk: ChartTokens,
  input: HeatInput,
): { option: EChartsOption; height: number } {
  const days = input.days.length > 371 ? input.days.slice(-371) : input.days;
  const first = days[0];
  const last = days[days.length - 1];
  if (!first || !last) return { option: base(tk), height: 120 };
  const lead =
    (new Date(`${first.key}T00:00:00`).getDay() - input.firstDay + 7) % 7;
  const weeks = Math.ceil((days.length + lead) / 7);
  const cell = Math.max(
    7,
    Math.min(24, Math.floor((input.width - 56) / weeks)),
  );
  const positives = days
    .map((day) => day.words)
    .filter((value) => value > 0)
    .sort((a, b) => a - b);
  const quantile = (ratio: number): number =>
    positives[Math.floor(positives.length * ratio)] ?? 1;
  return {
    option: {
      ...base(tk),
      tooltip: {
        ...base(tk).tooltip,
        formatter: (params: unknown) => {
          const point = asPoints(params)[0];
          const value = Array.isArray(point?.value) ? point?.value : [];
          return `${String(value[0] ?? "")}<br><b>${fullNumber(Number(value[1] ?? 0))}</b> ${t("words")}`;
        },
      },
      visualMap: {
        show: false,
        type: "piecewise",
        pieces: [
          { value: 0, color: tk.sunken },
          { min: 1, max: quantile(0.25), color: tk.acc(0.26) },
          { min: quantile(0.25), max: quantile(0.5), color: tk.acc(0.48) },
          { min: quantile(0.5), max: quantile(0.8), color: tk.acc(0.72) },
          { min: quantile(0.8), color: tk.accent },
        ],
      },
      calendar: {
        left: 40,
        top: 30,
        cellSize: [cell, cell],
        range: [first.key, last.key],
        splitLine: { show: false },
        itemStyle: { color: "transparent", borderWidth: 0 },
        yearLabel: { show: false },
        dayLabel: {
          color: tk.faint,
          fontSize: 10,
          firstDay: input.firstDay,
          nameMap: input.dayNames,
        },
        monthLabel: {
          color: tk.muted,
          fontSize: 10,
          nameMap: input.monthNames,
        },
      },
      series: [
        {
          type: "heatmap",
          coordinateSystem: "calendar",
          data: days.map((day) => [day.key, day.words]),
          itemStyle: {
            borderRadius: Math.max(1, cell * 0.18),
            borderWidth: 1.5,
            borderColor: tk.bg,
          },
        },
      ],
    },
    height: 7 * cell + 48,
  };
}

export function monthOption(
  tk: ChartTokens,
  buckets: { label: string; value: number }[],
): EChartsOption {
  const top = Math.max(...buckets.map((bucket) => bucket.value), 0);
  return {
    ...base(tk),
    grid: { left: 48, right: 14, top: 16, bottom: 26 },
    tooltip: {
      ...base(tk).tooltip,
      trigger: "axis",
      formatter: (params: unknown) =>
        `${asPoints(params)[0]?.axisValue ?? ""}<br><b>${fullNumber(num(asPoints(params)[0]?.value))}</b> ${t("words")}`,
    },
    xAxis: {
      type: "category",
      data: buckets.map((bucket) => bucket.label),
      ...axis(tk),
      splitLine: { show: false },
    },
    yAxis: valueAxis(tk),
    series: [
      {
        type: "bar",
        barMaxWidth: 34,
        data: buckets.map((bucket) => ({
          value: bucket.value,
          itemStyle: {
            color: bucket.value === top ? tk.accent : tk.acc(0.5),
            borderRadius: [3, 3, 0, 0],
          },
        })),
      },
    ],
  };
}

export function cumulativeOption(
  tk: ChartTokens,
  points: { key: string; value: number }[],
): EChartsOption {
  return {
    ...base(tk),
    grid: { left: 54, right: 16, top: 16, bottom: 26 },
    tooltip: {
      ...base(tk).tooltip,
      trigger: "axis",
      formatter: (params: unknown) =>
        `${asPoints(params)[0]?.axisValue ?? ""}<br>${t("Cumulative current words")} <b>${fullNumber(num(asPoints(params)[0]?.value))}</b>`,
    },
    xAxis: {
      type: "category",
      data: points.map((point) => point.key),
      ...axis(tk),
      splitLine: { show: false },
    },
    yAxis: valueAxis(tk),
    series: [
      {
        type: "line",
        data: points.map((point) => point.value),
        showSymbol: false,
        lineStyle: { color: tk.accent, width: 2 },
        areaStyle: { color: fade(tk) },
      },
    ],
  };
}

export function punchOption(
  tk: ChartTokens,
  cells: { hour: number; day: number; words: number }[],
  dayNames: string[],
): EChartsOption {
  const top = Math.max(...cells.map((cell) => cell.words), 1);
  return {
    ...base(tk),
    grid: { left: 46, right: 20, top: 14, bottom: 28 },
    tooltip: {
      ...base(tk).tooltip,
      formatter: (params: unknown) => {
        const point = asPoints(params)[0];
        const value = Array.isArray(point?.value) ? point?.value : [];
        return `${dayNames[Number(value[1] ?? 0)] ?? ""} ${value[0] ?? ""}:00<br><b>${fullNumber(Number(value[2] ?? 0))}</b> ${t("words")}`;
      },
    },
    xAxis: {
      type: "category",
      data: Array.from({ length: 24 }, (_value, hour) => String(hour)),
      ...axis(tk),
      splitLine: { show: false },
      axisLabel: {
        color: tk.faint,
        interval: 1,
        formatter: (value: unknown) =>
          Number(value) % 3 === 0 ? String(value) : "",
      },
    },
    yAxis: {
      type: "category",
      data: dayNames,
      inverse: true,
      ...axis(tk),
      axisLine: { show: false },
    },
    series: [
      {
        type: "scatter",
        data: cells.map((cell) => [cell.hour, cell.day, cell.words]),
        symbolSize: (value: unknown) => {
          const words = Array.isArray(value) ? Number(value[2] ?? 0) : 0;
          return 5 + Math.sqrt(words / top) * 20;
        },
        itemStyle: {
          color: (params: unknown) => {
            const point = (params ?? {}) as { value?: unknown };
            const words = Array.isArray(point.value)
              ? Number(point.value[2] ?? 0)
              : 0;
            return tk.acc(0.3 + 0.7 * (words / top));
          },
        },
      },
    ],
  };
}

export function clockOption(tk: ChartTokens, hours: number[]): EChartsOption {
  const top = Math.max(...hours, 1);
  return {
    ...base(tk),
    polar: { radius: ["22%", "78%"], center: ["50%", "52%"] },
    angleAxis: {
      type: "category",
      data: Array.from({ length: 24 }, (_value, hour) => String(hour)),
      startAngle: 90,
      clockwise: true,
      axisLine: { lineStyle: { color: tk.grid } },
      axisTick: { show: false },
      splitLine: { show: false },
      axisLabel: {
        color: tk.faint,
        formatter: (value: unknown) =>
          Number(value) % 3 === 0 ? `${Number(value)}:00` : "",
      },
    },
    radiusAxis: {
      max: top,
      axisLabel: { show: false },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: tk.grid } },
    },
    tooltip: {
      ...base(tk).tooltip,
      formatter: (params: unknown) => {
        const point = asPoints(params)[0];
        return `${point?.name ?? ""}:00<br><b>${fullNumber(num(point?.value))}</b> ${t("words")}`;
      },
    },
    series: [
      {
        type: "bar",
        coordinateSystem: "polar",
        roundCap: true,
        barWidth: "62%",
        data: hours.map((value) => ({
          value,
          itemStyle: {
            color:
              value === top ? tk.accent : tk.acc(0.28 + 0.55 * (value / top)),
          },
        })),
      },
    ],
  };
}

export function tagsOption(
  tk: ChartTokens,
  items: { name: string; notes: number; words: number }[],
): EChartsOption {
  const rows = items.slice(0, 12).reverse();
  return {
    ...base(tk),
    grid: { left: 8, right: 74, top: 6, bottom: 6, containLabel: true },
    tooltip: {
      ...base(tk).tooltip,
      formatter: (params: unknown) => {
        const point = asPoints(params)[0];
        const row = rows.find((item) => `#${item.name}` === point?.name);
        return `#${point?.name ?? ""}<br><b>${fullNumber(num(point?.value))}</b> ${t("notes")}${row ? ` · ${shortNumber(row.words)} ${t("words")}` : ""}`;
      },
    },
    xAxis: { type: "value", show: false },
    yAxis: {
      type: "category",
      data: rows.map((item) => `#${item.name}`),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: tk.muted },
    },
    series: [
      {
        type: "bar",
        barMaxWidth: 13,
        data: rows.map((item, index) => ({
          value: item.notes,
          name: item.name,
          itemStyle: {
            color: index === rows.length - 1 ? tk.accent : tk.acc(0.5),
            borderRadius: [0, 3, 3, 0],
          },
        })),
        label: {
          show: true,
          position: "right",
          color: tk.faint,
          fontSize: 11,
          formatter: "{c}",
        },
      },
    ],
  };
}

export function treeOption(
  tk: ChartTokens,
  items: { name: string; value: number }[],
): EChartsOption {
  return {
    ...base(tk),
    tooltip: {
      ...base(tk).tooltip,
      formatter: (params: unknown) => {
        const point = asPoints(params)[0];
        return `${point?.name ?? ""}<br><b>${shortNumber(num(point?.value))}</b> ${t("words")}`;
      },
    },
    series: [
      {
        type: "treemap",
        roam: false,
        nodeClick: false,
        breadcrumb: { show: false },
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        data: items.map((item) => ({ name: item.name, value: item.value })),
        itemStyle: {
          borderColor: tk.bg,
          borderWidth: 2,
          gapWidth: 2,
          borderRadius: 4,
        },
        levels: [
          {
            colorMappingBy: "value",
            color: [
              tk.acc(0.95),
              tk.acc(0.8),
              tk.acc(0.66),
              tk.acc(0.52),
              tk.acc(0.4),
              tk.acc(0.3),
              tk.acc(0.22),
            ],
          },
        ],
        label: {
          color: "#fff",
          fontSize: 11,
          lineHeight: 15,
          overflow: "truncate",
          formatter: (params: unknown) => {
            const point = (params ?? {}) as { name?: string; value?: unknown };
            const name = (point.name ?? "").split("/").pop() ?? "";
            return `${name}\n${shortNumber(num(point.value))}`;
          },
        },
      },
    ],
  };
}

export function histOption(
  tk: ChartTokens,
  items: { label: string; count: number }[],
): EChartsOption {
  const top = Math.max(...items.map((item) => item.count), 0);
  return {
    ...base(tk),
    grid: { left: 38, right: 14, top: 20, bottom: 26 },
    tooltip: {
      ...base(tk).tooltip,
      trigger: "axis",
      formatter: (params: unknown) =>
        `${asPoints(params)[0]?.axisValue ?? ""}<br><b>${fullNumber(num(asPoints(params)[0]?.value))}</b> ${t("notes")}`,
    },
    xAxis: {
      type: "category",
      data: items.map((item) => item.label),
      ...axis(tk),
      splitLine: { show: false },
    },
    yAxis: { type: "value", ...axis(tk), axisLine: { show: false } },
    series: [
      {
        type: "bar",
        barMaxWidth: 42,
        label: { show: true, position: "top", color: tk.faint, fontSize: 11 },
        data: items.map((item) => ({
          value: item.count,
          itemStyle: {
            color: item.count === top ? tk.accent : tk.acc(0.45),
            borderRadius: [3, 3, 0, 0],
          },
        })),
      },
    ],
  };
}

export function filesOption(
  tk: ChartTokens,
  items: { name: string; value: number }[],
): EChartsOption {
  return {
    ...base(tk),
    tooltip: {
      ...base(tk).tooltip,
      formatter: (params: unknown) => {
        const point = asPoints(params)[0];
        return `${point?.name ?? ""}<br><b>${fullNumber(num(point?.value))}</b> · ${point?.percent ?? 0}%`;
      },
    },
    legend: {
      orient: "vertical",
      right: 4,
      top: "center",
      itemWidth: 9,
      itemHeight: 9,
      icon: "roundRect",
      textStyle: { color: tk.muted, fontSize: 11 },
    },
    series: [
      {
        type: "pie",
        radius: ["54%", "80%"],
        center: ["32%", "50%"],
        data: items.map((item, index) => ({
          name: item.name,
          value: item.value,
          itemStyle: {
            color: index === 0 ? tk.accent : tk.acc(0.72 - index * 0.11),
          },
        })),
        label: { show: false },
        itemStyle: { borderColor: tk.bg, borderWidth: 2 },
      },
    ],
  };
}

/** The prototype used a word cloud; without that dependency it degrades to bars. */
export function wordsOption(
  tk: ChartTokens,
  items: { text: string; count: number }[],
): EChartsOption {
  const rows = items.slice(0, 12).reverse();
  return {
    ...base(tk),
    grid: { left: 8, right: 40, top: 6, bottom: 6, containLabel: true },
    tooltip: {
      ...base(tk).tooltip,
      formatter: (params: unknown) => {
        const point = asPoints(params)[0];
        return `${point?.name ?? ""}<br><b>${fullNumber(num(point?.value))}</b>`;
      },
    },
    xAxis: { type: "value", show: false },
    yAxis: {
      type: "category",
      data: rows.map((item) => item.text),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: tk.muted },
    },
    series: [
      {
        type: "bar",
        data: rows.map((item) => item.count),
        barMaxWidth: 12,
        itemStyle: { color: tk.acc(0.6), borderRadius: [0, 3, 3, 0] },
        label: { show: true, position: "right", color: tk.faint, fontSize: 11 },
      },
    ],
  };
}

export function radarOption(
  tk: ChartTokens,
  dimensions: { name: string; value: number }[],
): EChartsOption {
  return {
    ...base(tk),
    radar: {
      radius: "68%",
      center: ["50%", "54%"],
      splitNumber: 4,
      indicator: dimensions.map((item) => ({ name: item.name, max: 100 })),
      splitArea: { show: false },
      splitLine: { lineStyle: { color: tk.grid } },
      axisLine: { lineStyle: { color: tk.grid } },
      axisName: { color: tk.muted, fontSize: 11 },
    },
    tooltip: {
      ...base(tk).tooltip,
      formatter: (params: unknown) => {
        const point = asPoints(params)[0];
        const values = Array.isArray(point?.value) ? point?.value : [];
        return dimensions
          .map(
            (item, index) =>
              `${item.name} <b>${Math.round(Number(values[index] ?? 0))}</b>`,
          )
          .join("<br>");
      },
    },
    series: [
      {
        type: "radar",
        symbolSize: 4,
        data: [
          {
            value: dimensions.map((item) => item.value),
            name: t("Health"),
            itemStyle: { color: tk.accent },
            lineStyle: { color: tk.accent, width: 2 },
            areaStyle: { color: tk.acc(0.22) },
          },
        ],
      },
    ],
  };
}
