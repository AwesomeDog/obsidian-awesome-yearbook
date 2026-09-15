import type { ViewConfig } from "./settings";
import type { MarkdownRecord, VaultSnapshot } from "./scan/vault-scanner";

export interface DateRange {
  start: Date;
  end: Date;
}
export interface DailyMetric {
  date: Date;
  key: string;
  words: number;
  notePaths: string[];
  hours: number[];
}
export interface MetricsOptions {
  now?: Date;
}
export interface Metrics {
  range: DateRange;
  days: DailyMetric[];
  created: MarkdownRecord[];
  touched: MarkdownRecord[];
  words: number;
  activeDays: number;
  peakDay: DailyMetric | null;
  previousWords: number;
  changePercent: number | null;
  currentStreak: number;
  bestStreak: number;
  longestGap: number;
  averageActiveDay: number;
  tags: number;
  links: number;
  resourceRefs: number;
  today: DailyMetric;
  todayNoteCount: number;
  week: number;
  previousWeek: number;
  month: number;
}

const emptyHours = (): number[] => Array.from({ length: 24 }, () => 0);

export function startOfDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

export function addDays(value: Date, amount: number): Date {
  const result = startOfDay(value);
  result.setDate(result.getDate() + amount);
  return result;
}

export function dateKey(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

export function endOfDay(value: Date): Date {
  return new Date(
    value.getFullYear(),
    value.getMonth(),
    value.getDate(),
    23,
    59,
    59,
    999,
  );
}

function currentDate(options?: MetricsOptions): Date {
  return startOfDay(options?.now ?? new Date());
}

export function getRangeBounds(
  snapshot: VaultSnapshot,
  config: Pick<ViewConfig, "range" | "customRange">,
  options?: MetricsOptions,
): DateRange {
  const today = currentDate(options);
  if (config.range === "custom" && config.customRange)
    return {
      start: startOfDay(config.customRange.start),
      end: endOfDay(config.customRange.end),
    };
  if (config.range === "all")
    return {
      start: startOfDay(snapshot.earliestDate ?? today),
      end: endOfDay(today),
    };
  if (config.range === "ytd")
    return { start: new Date(today.getFullYear(), 0, 1), end: endOfDay(today) };
  if (config.range === "lastyear") {
    const year = today.getFullYear() - 1;
    return {
      start: new Date(year, 0, 1),
      end: new Date(year, 11, 31, 23, 59, 59, 999),
    };
  }
  const lengths: Record<string, number> = {
    last7: 7,
    last30: 30,
    last90: 90,
    last365: 365,
  };
  const length = (lengths[config.range] ?? Number(config.range)) || 7;
  return { start: addDays(today, -(length - 1)), end: endOfDay(today) };
}

function inRange(value: Date, range: DateRange): boolean {
  return (
    value.getTime() >= range.start.getTime() &&
    value.getTime() <= range.end.getTime()
  );
}

export function dailyMetrics(
  snapshot: VaultSnapshot,
  range: DateRange,
): DailyMetric[] {
  const byDay = new Map<string, DailyMetric>();
  const cursor = startOfDay(range.start);
  const last = startOfDay(range.end);
  for (let date = new Date(cursor); date <= last; date = addDays(date, 1)) {
    byDay.set(dateKey(date), {
      date: new Date(date),
      key: dateKey(date),
      words: 0,
      notePaths: [],
      hours: emptyHours(),
    });
  }
  for (const note of snapshot.notes) {
    const modified = note.modifiedAt;
    if (!inRange(modified, range)) continue;
    const key = dateKey(modified);
    const day = byDay.get(key);
    if (!day) continue;
    day.words += note.wordCount;
    day.notePaths.push(note.path);
    const hour = modified.getHours();
    day.hours[hour] = (day.hours[hour] ?? 0) + note.wordCount;
  }
  return [...byDay.values()];
}

function streaks(days: DailyMetric[]): {
  current: number;
  best: number;
  gap: number;
} {
  let current = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    const day = days[i];
    if (!day || day.words <= 0) break;
    current++;
  }
  let run = 0,
    best = 0,
    gap = 0,
    gapRun = 0;
  for (const day of days) {
    if (day.words > 0) {
      run++;
      best = Math.max(best, run);
      gap = Math.max(gap, gapRun);
      gapRun = 0;
    } else {
      run = 0;
      gapRun++;
    }
  }
  return { current, best, gap: Math.max(gap, gapRun) };
}

function sumDays(days: DailyMetric[], start: Date, end: Date): number {
  return days
    .filter((day) => inRange(day.date, { start, end }))
    .reduce((sum, day) => sum + day.words, 0);
}

export function calculateMetrics(
  snapshot: VaultSnapshot,
  config: Pick<ViewConfig, "range" | "customRange" | "weekStartsOn">,
  options?: MetricsOptions,
): Metrics {
  const range = getRangeBounds(snapshot, config, options);
  const days = dailyMetrics(snapshot, range);
  const created = snapshot.notes.filter((note) =>
    inRange(note.createdAt, range),
  );
  const touched = snapshot.notes.filter((note) =>
    inRange(note.modifiedAt, range),
  );
  const words = days.reduce((sum, day) => sum + day.words, 0);
  const active = days.filter((day) => day.words > 0);
  const length = Math.max(1, days.length);
  const previousEnd = addDays(range.start, -1);
  const previousStart = addDays(previousEnd, -(length - 1));
  const previousWords = sumDays(
    dailyMetrics(snapshot, {
      start: previousStart,
      end: endOfDay(previousEnd),
    }),
    previousStart,
    endOfDay(previousEnd),
  );
  const todayDate = currentDate(options);
  const today = dailyMetrics(snapshot, {
    start: todayDate,
    end: endOfDay(todayDate),
  })[0] ?? {
    date: todayDate,
    key: dateKey(todayDate),
    words: 0,
    notePaths: [],
    hours: emptyHours(),
  };
  const weekStartsOn = config.weekStartsOn ?? 1;
  const weekStart = addDays(
    todayDate,
    -((todayDate.getDay() - weekStartsOn + 7) % 7),
  );
  const previousWeekStart = addDays(weekStart, -7);
  const monthStart = new Date(todayDate.getFullYear(), todayDate.getMonth(), 1);
  const allTodayDays = dailyMetrics(snapshot, {
    start: addDays(todayDate, -3650),
    end: endOfDay(todayDate),
  });
  const s = streaks(days);
  const tagSet = new Set<string>();
  let links = 0,
    resourceRefs = 0;
  touched.forEach((note) => {
    note.tags.forEach((tag) => tagSet.add(tag));
    links += note.outgoingLinks.length;
    resourceRefs += note.resourceRefs.length;
  });
  return {
    range,
    days,
    created,
    touched,
    words,
    activeDays: active.length,
    peakDay: active.slice().sort((a, b) => b.words - a.words)[0] ?? null,
    previousWords,
    changePercent: previousWords
      ? Math.round(((words - previousWords) / previousWords) * 100)
      : null,
    currentStreak: s.current,
    bestStreak: s.best,
    longestGap: s.gap,
    averageActiveDay: active.length ? Math.round(words / active.length) : 0,
    tags: tagSet.size,
    links,
    resourceRefs,
    today,
    todayNoteCount: today.notePaths.length,
    week: sumDays(allTodayDays, weekStart, endOfDay(todayDate)),
    previousWeek: sumDays(
      allTodayDays,
      previousWeekStart,
      endOfDay(addDays(weekStart, -1)),
    ),
    month: sumDays(allTodayDays, monthStart, endOfDay(todayDate)),
  };
}

export function topTags(
  notes: MarkdownRecord[],
  limit = 12,
): { name: string; notes: number; words: number }[] {
  const map = new Map<string, { notes: number; words: number }>();
  for (const note of notes)
    for (const tag of new Set(note.tags)) {
      const current = map.get(tag) ?? { notes: 0, words: 0 };
      current.notes++;
      current.words += note.wordCount;
      map.set(tag, current);
    }
  return [...map.entries()]
    .map(([name, value]) => ({ name, ...value }))
    .sort(
      (a, b) =>
        b.notes - a.notes || b.words - a.words || a.name.localeCompare(b.name),
    )
    .slice(0, limit);
}

export function folderWordTotals(
  notes: MarkdownRecord[],
): { name: string; value: number }[] {
  const map = new Map<string, number>();
  for (const note of notes)
    map.set(
      note.folder || ".",
      (map.get(note.folder || ".") ?? 0) + note.wordCount,
    );
  return [...map.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

export function aggregateWordFrequencies(
  notes: MarkdownRecord[],
  limit = 26,
): { text: string; count: number }[] {
  const totals = new Map<string, number>();
  for (const note of notes)
    for (const [word, count] of Object.entries(note.wordFrequencies))
      totals.set(word, (totals.get(word) ?? 0) + count);
  return [...totals.entries()]
    .map(([text, count]) => ({ text, count }))
    .sort((a, b) => b.count - a.count || a.text.localeCompare(b.text))
    .slice(0, limit);
}

export function lengthDistribution(
  notes: MarkdownRecord[],
): { label: string; min: number; max: number; count: number }[] {
  const bins = [
    [0, 200, "<200"],
    [200, 500, "200-500"],
    [500, 1000, "500-1k"],
    [1000, 2000, "1k-2k"],
    [2000, 5000, "2k-5k"],
    [5000, Number.POSITIVE_INFINITY, "5k+"],
  ] as const;
  return bins.map(([min, max, label]) => ({
    label,
    min,
    max,
    count: notes.filter((note) => note.wordCount >= min && note.wordCount < max)
      .length,
  }));
}
