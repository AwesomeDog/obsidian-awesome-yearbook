// Fills a directory with random notes so the dashboard has something to scan.
// Usage: npm run seed -- <dir> <count>
// Existing files with the same name are overwritten without asking.

import { mkdir, writeFile, utimes } from "node:fs/promises";
import { execFile } from "node:child_process";
import path from "node:path";

const dir = process.argv[2];
const count = Number(process.argv[3]);

if (!dir || !Number.isInteger(count) || count < 1) {
  console.error("Usage: npm run seed -- <dir> <count>");
  process.exit(1);
}

const target = path.resolve(dir);

const WORDS = [
  "alpha",
  "beta",
  "core",
  "data",
  "edge",
  "file",
  "grid",
  "hook",
  "item",
  "jazz",
];

const rnd = (n) => Math.floor(Math.random() * n);
const pick = (a) => a[rnd(a.length)];
// Mostly notes, so the scan has markdown to chew on.
const randName = () =>
  `${pick(WORDS)}-${pick(WORDS)}-${rnd(200)}.${rnd(5) ? "md" : "txt"}`;
// Anywhere in the last 3 years.
const randTime = () => Date.now() - rnd(3 * 365 * 24 * 3600) * 1000;

// macOS can set creation time; without SetFile we just keep the random mtime.
const setBirthTime = (file, ms) => {
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, "0");
  const stamp = `${p(d.getMonth() + 1)}/${p(d.getDate())}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  execFile("SetFile", ["-d", stamp, file], () => {});
};

await mkdir(target, { recursive: true });

for (let i = 0; i < count; i++) {
  const file = path.join(target, randName());
  await writeFile(file, `# Seed ${i}\n\n${"word ".repeat(rnd(400))}\n`, "utf8");
  const t = randTime() / 1000;
  await utimes(file, t, t);
  setBirthTime(file, t * 1000);
}

console.log(`Seeded ${count} files in ${target}`);
