import type { HealthIssueKey } from "../health";
import type { IconName } from "../icons";
import type { Tab } from "../settings";

export const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: "yearbook", label: "Yearbook", icon: "book" },
  { id: "overview", label: "Overview", icon: "pulse" },
  { id: "rhythm", label: "Rhythm", icon: "calendar" },
  { id: "content", label: "Content", icon: "hash" },
  { id: "health", label: "Health", icon: "activity" },
];

export const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;
export const WEEKDAY_MIN = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] as const;

export const ACCENTS: { h: number; s: string; l: string; name: string }[] = [
  { h: 254, s: "80%", l: "68%", name: "Violet" },
  { h: 210, s: "100%", l: "56%", name: "Blue" },
  { h: 160, s: "62%", l: "45%", name: "Green" },
  { h: 28, s: "92%", l: "56%", name: "Orange" },
  { h: 330, s: "78%", l: "64%", name: "Pink" },
  { h: 0, s: "75%", l: "60%", name: "Red" },
];

export const ISSUE_ROWS: {
  key: HealthIssueKey | "attach";
  name: string;
  desc: string;
  icon: IconName;
  mod?: string;
}[] = [
  {
    key: "orphan",
    name: "Orphan notes",
    desc: "No incoming and no outgoing links",
    icon: "ghost",
    mod: "mod-warn",
  },
  {
    key: "untagged",
    name: "Untagged",
    desc: "Hard to find again later",
    icon: "hash",
  },
  {
    key: "broken",
    name: "Broken links",
    desc: "Pointing at notes that do not exist",
    icon: "unlink",
    mod: "mod-error",
  },
  {
    key: "stale",
    name: "Forgotten notes",
    desc: "Untouched longer than the stale threshold",
    icon: "dust",
  },
  {
    key: "stub",
    name: "Fragments",
    desc: "Under 90 words, probably unfinished",
    icon: "file",
    mod: "mod-warn",
  },
  {
    key: "tasks",
    name: "Open tasks",
    desc: "Still has unchecked to-dos",
    icon: "check",
  },
  {
    key: "attach",
    name: "Unreferenced attachments",
    desc: "Take up space and can be cleaned up",
    icon: "folder",
  },
];
