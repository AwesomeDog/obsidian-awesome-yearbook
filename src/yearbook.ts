import type { MarkdownRecord, VaultSnapshot } from "./scan/vault-scanner";
import {
  addDays,
  aggregateWordFrequencies,
  dailyMetrics,
  endOfDay,
  startOfDay,
} from "./metrics";

export interface YearbookModel {
  year: number;
  start: Date;
  end: Date;
  days: ReturnType<typeof dailyMetrics>;
  wordCount: number;
  modifiedDays: number;
  createdNotes: MarkdownRecord[];
  monthlyWords: number[];
  previousMonthlyWords: number[];
  topTags: { name: string; notes: number; words: number }[];
  representative: MarkdownRecord | null;
  peakHour: number | null;
  hours: number[];
  longestSilence: { start: Date; end: Date; days: number } | null;
  previousWords: number;
  topMonth: number;
  longestStreak: number;
  topWords: { text: string; count: number }[];
}

export function buildYearbook(
  snapshot: VaultSnapshot,
  year: number,
  now = new Date(),
): YearbookModel {
  const start = new Date(year, 0, 1);
  const currentYear = now.getFullYear() === year;
  const end = currentYear ? startOfDay(now) : new Date(year, 11, 31);
  const lastMoment = endOfDay(end);
  const days = dailyMetrics(snapshot, { start, end: lastMoment });
  const createdNotes = snapshot.notes.filter(
    (note) => note.createdAt >= start && note.createdAt <= lastMoment,
  );
  const monthlyWords = new Array(12).fill(0) as number[];
  const previousMonthlyWords = new Array(12).fill(0) as number[];
  const hours = new Array(24).fill(0) as number[];
  days.forEach((day) => {
    const month = day.date.getMonth();
    monthlyWords[month] = (monthlyWords[month] ?? 0) + day.words;
    day.hours.forEach((value, hour) => {
      hours[hour] = (hours[hour] ?? 0) + value;
    });
  });
  snapshot.notes
    .filter((note) => note.modifiedAt.getFullYear() === year - 1)
    .forEach((note) => {
      const month = note.modifiedAt.getMonth();
      previousMonthlyWords[month] =
        (previousMonthlyWords[month] ?? 0) + note.wordCount;
    });
  const tags = new Map<string, { notes: number; words: number }>();
  for (const note of createdNotes)
    for (const tag of new Set(note.tags)) {
      const item = tags.get(tag) ?? { notes: 0, words: 0 };
      item.notes++;
      item.words += note.wordCount;
      tags.set(tag, item);
    }
  let run = 0;
  let longestStreak = 0;
  for (const day of days) {
    if (day.words > 0) {
      run++;
      if (run > longestStreak) longestStreak = run;
    } else run = 0;
  }
  let silenceStart: Date | null = null;
  let longest: { start: Date; end: Date; days: number } | null = null;
  for (const day of days) {
    if (day.words === 0 && silenceStart === null) silenceStart = day.date;
    if (day.words > 0 && silenceStart) {
      const endDate = addDays(day.date, -1);
      const count =
        Math.round((endDate.getTime() - silenceStart.getTime()) / 86_400_000) +
        1;
      if (!longest || count > longest.days)
        longest = { start: silenceStart, end: endDate, days: count };
      silenceStart = null;
    }
  }
  if (silenceStart) {
    const count =
      Math.round((end.getTime() - silenceStart.getTime()) / 86_400_000) + 1;
    if (!longest || count > longest.days)
      longest = { start: silenceStart, end, days: count };
  }
  return {
    year,
    start,
    end,
    days,
    wordCount: days.reduce((sum, day) => sum + day.words, 0),
    modifiedDays: days.filter((day) => day.words > 0).length,
    createdNotes,
    monthlyWords,
    previousMonthlyWords,
    topTags: [...tags.entries()]
      .map(([name, value]) => ({ name, ...value }))
      .sort((a, b) => b.notes - a.notes || b.words - a.words)
      .slice(0, 8),
    representative:
      createdNotes.slice().sort((a, b) => b.wordCount - a.wordCount)[0] ?? null,
    peakHour: hours.some(Boolean) ? hours.indexOf(Math.max(...hours)) : null,
    hours,
    longestSilence: longest,
    previousWords: previousMonthlyWords.reduce((sum, value) => sum + value, 0),
    topMonth: monthlyWords.indexOf(Math.max(...monthlyWords)) + 1,
    longestStreak,
    topWords: aggregateWordFrequencies(createdNotes, 4),
  };
}

export function availableYears(
  snapshot: VaultSnapshot,
  now = new Date(),
): number[] {
  const earliest = snapshot.earliestDate?.getFullYear() ?? now.getFullYear();
  const result: number[] = [];
  for (let year = now.getFullYear(); year >= earliest; year--)
    result.push(year);
  return result;
}
