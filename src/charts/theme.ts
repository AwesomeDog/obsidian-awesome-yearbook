import type { EChartsOption } from "echarts";
import { shortNumber, type ChartTokens } from "./index";

const SHADOW = "0 2px 10px rgba(0,0,0,.18)";

/** Shared pieces every chart option starts from. */
export function base(tk: ChartTokens): EChartsOption {
  return {
    animation: false,
    backgroundColor: "transparent",
    textStyle: { fontFamily: tk.font, fontSize: 11 },
    tooltip: {
      backgroundColor: tk.bg,
      borderColor: tk.border,
      textStyle: { color: tk.text, fontSize: 12 },
      padding: [7, 11],
      extraCssText: `border-radius:8px;box-shadow:${SHADOW}`,
    },
  };
}

export function axis(tk: ChartTokens) {
  return {
    axisLine: { lineStyle: { color: tk.border } },
    axisTick: { show: false },
    axisLabel: { color: tk.faint },
    splitLine: { lineStyle: { color: tk.grid } },
  };
}

export function valueAxis(tk: ChartTokens) {
  return {
    type: "value" as const,
    ...axis(tk),
    axisLine: { show: false },
    axisLabel: {
      color: tk.faint,
      formatter: (value: unknown) => shortNumber(Number(value)),
    },
  };
}

export function legend(tk: ChartTokens) {
  return {
    top: 0,
    right: 0,
    itemWidth: 12,
    itemHeight: 8,
    icon: "roundRect",
    textStyle: { color: tk.faint, fontSize: 11 },
  };
}

export const fade = (tk: ChartTokens) => ({
  type: "linear" as const,
  x: 0,
  y: 0,
  x2: 0,
  y2: 1,
  colorStops: [
    { offset: 0, color: tk.acc(0.3) },
    { offset: 1, color: tk.acc(0) },
  ],
});
