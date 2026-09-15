import type { EChartsOption, ChartTokens } from "../charts";
import type { IconName } from "../icons";
import type { Metrics } from "../metrics";
import type { MarkdownRecord, VaultSnapshot } from "../scan/vault-scanner";
import type { Tab, ViewConfig } from "../settings";

/** A chart registered by a pane and drawn once its tab becomes active. */
export interface ChartRequest {
  tab: Tab;
  host: HTMLElement;
  build: (
    tokens: ChartTokens,
    width: number,
  ) => { option: EChartsOption; height?: number };
  onClick?: (params: { dataIndex?: number; value?: unknown }) => void;
}

/** What a pane renderer needs from the view: the scan result and a few of its actions. */
export interface PaneContext {
  snapshot: VaultSnapshot;
  config: ViewConfig;
  metrics: Metrics;
  rangeLabel: string;
  vaultName: string;
  addChart(
    tab: Tab,
    cls: string,
    build: ChartRequest["build"],
    onClick?: ChartRequest["onClick"],
  ): HTMLElement;
  noteItem(
    note: MarkdownRecord,
    iconName?: IconName,
    meta?: string,
    sub?: string,
  ): HTMLElement;
  recordsFor(paths: string[]): MarkdownRecord[];
  showNotes(title: string, sub: string, notes: MarkdownRecord[]): void;
  pane(tab: Tab): HTMLElement;
}
