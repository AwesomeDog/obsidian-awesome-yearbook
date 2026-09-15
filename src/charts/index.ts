import { getInstanceByDom, init, use, type EChartsType } from "echarts/core";
import {
  BarChart,
  HeatmapChart,
  LineChart,
  PieChart,
  RadarChart,
  ScatterChart,
  TreemapChart,
} from "echarts/charts";
import {
  AriaComponent,
  CalendarComponent,
  GridComponent,
  LegendComponent,
  PolarComponent,
  RadarComponent,
  TooltipComponent,
  VisualMapComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { EChartsOption } from "echarts";

use([
  BarChart,
  LineChart,
  RadarChart,
  PieChart,
  ScatterChart,
  HeatmapChart,
  TreemapChart,
  AriaComponent,
  GridComponent,
  RadarComponent,
  PolarComponent,
  CalendarComponent,
  VisualMapComponent,
  LegendComponent,
  TooltipComponent,
  CanvasRenderer,
]);

export class ChartManager {
  private destroyed = false;
  private instances = new Set<EChartsType>();
  render(
    container: HTMLElement,
    option: EChartsOption,
    onClick?: (params: unknown) => void,
  ): boolean {
    if (this.destroyed) return false;
    try {
      const instance = getInstanceByDom(container) ?? init(container);
      instance.setOption(option, true);
      if (onClick) {
        instance.off("click");
        instance.on("click", (params) => onClick(params));
      }
      this.instances.add(instance);
      return true;
    } catch {
      return false;
    }
  }
  clear(): void {
    this.instances.forEach((instance) => instance.dispose());
    this.instances.clear();
  }
  destroy(): void {
    this.clear();
    this.destroyed = true;
  }
  resize(): void {
    if (this.destroyed) return;
    this.instances.forEach((instance) => instance.resize());
  }
}

export interface ChartTokens {
  font: string;
  accent: string;
  acc: (alpha: number) => string;
  text: string;
  muted: string;
  faint: string;
  border: string;
  bg: string;
  sunken: string;
  grid: string;
  base40: string;
}

/** Reads the dashboard tokens so charts follow the Obsidian theme and accent. */
export function chartTokens(root: HTMLElement): ChartTokens {
  const styles = getComputedStyle(root);
  const read = (name: string, fallback: string): string =>
    styles.getPropertyValue(name).trim() || fallback;
  const h = read("--yb-accent-h", "254");
  const s = read("--yb-accent-s", "80%");
  const l = read("--yb-accent-l", "68%");
  return {
    font: read("--yb-font-ui", "sans-serif"),
    accent: `hsl(${h},${s},${l})`,
    acc: (alpha) => `hsla(${h},${s},${l},${alpha})`,
    text: read("--yb-text", "currentColor"),
    muted: read("--yb-text-muted", "currentColor"),
    faint: read("--yb-text-faint", "currentColor"),
    border: read("--yb-border", "currentColor"),
    bg: read("--yb-bg-panel", "transparent"),
    sunken: read("--yb-bg-sunken", "transparent"),
    grid: read("--yb-grid", "transparent"),
    base40: read("--yb-base-40", "currentColor"),
  };
}

let compact: Intl.NumberFormat | null = null;
/** Axis labels stay short; tooltips keep the exact number. */
export function shortNumber(value: number): string {
  if (Math.abs(value) < 10000) return Math.round(value).toLocaleString();
  compact ??= new Intl.NumberFormat(undefined, {
    notation: "compact",
    maximumFractionDigits: 1,
  });
  return compact.format(Math.round(value));
}
export function fullNumber(value: number): string {
  return Math.round(value).toLocaleString();
}

export type { EChartsOption };
