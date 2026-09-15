export type WeekStartsOn = 0 | 1;
export type RangeKey =
  | "last7"
  | "last30"
  | "last90"
  | "last365"
  | "ytd"
  | "lastyear"
  | "all"
  | "custom";
export type CardRatio = "9:16" | "4:5" | "1:1";

export interface ViewConfig {
  dailyGoal: number;
  weekStartsOn: WeekStartsOn;
  staleDays: number;
  accent: { h: number; s: string; l: string };
  darkMode: "system" | "light" | "dark";
  range: RangeKey;
  customRange: { start: Date; end: Date } | null;
  card: {
    year: number;
    ratio: CardRatio;
    palette: string;
    blocks: Record<string, boolean>;
    privacy: boolean;
    handle: string;
  };
  activeTab: "yearbook" | "overview" | "rhythm" | "content" | "health";
}

export type Tab = ViewConfig["activeTab"];

export function createDefaultViewConfig(): ViewConfig {
  return {
    dailyGoal: 800,
    weekStartsOn: 1,
    staleDays: 180,
    accent: { h: 254, s: "80%", l: "68%" },
    darkMode: "system",
    range: "ytd",
    customRange: null,
    card: {
      year: new Date().getFullYear(),
      ratio: "9:16",
      palette: "midnight",
      blocks: {
        heat: true,
        topics: true,
        duo: true,
        words: true,
        closing: true,
      },
      privacy: false,
      handle: "",
    },
    activeTab: "yearbook",
  };
}
