import { t } from "./i18n/i18n";
import { PROJECT_ICON } from "./icons";
import { dateKey, type DailyMetric } from "./metrics";
import type { YearbookModel } from "./yearbook";

/* The card is posted outside Obsidian, so it carries its own font stack,
   palettes and sizes. Nothing here reads the app theme. */
const CARD_FONT =
  '"PingFang SC","Hiragino Sans GB","Microsoft YaHei",-apple-system,Inter,sans-serif';

export const CARD_RATIOS: Record<
  "9:16" | "4:5" | "1:1",
  [number, number, number]
> = {
  "9:16": [1080, 1920, 84],
  "4:5": [1080, 1350, 76],
  "1:1": [1080, 1080, 62],
};

export interface CardPalette {
  id: string;
  name: string;
  bg: [string, string];
  accent: string;
  text: string;
  glow: [string, string];
}
export const CARD_PALETTES: CardPalette[] = [
  {
    id: "midnight",
    name: "Midnight",
    bg: ["#14132A", "#2C1B54"],
    accent: "#8E7CFF",
    text: "#FFFFFF",
    glow: ["rgba(142,124,255,.34)", "rgba(86,199,255,.18)"],
  },
  {
    id: "paper",
    name: "Paper",
    bg: ["#FBF6EB", "#EEE0C6"],
    accent: "#B4523A",
    text: "#241B12",
    glow: ["rgba(180,82,58,.18)", "rgba(201,144,46,.20)"],
  },
  {
    id: "forest",
    name: "Forest",
    bg: ["#06211C", "#0F3E34"],
    accent: "#4FD1A5",
    text: "#EAFBF5",
    glow: ["rgba(79,209,165,.26)", "rgba(155,232,200,.14)"],
  },
  {
    id: "ember",
    name: "Ember",
    bg: ["#1C0E09", "#4A1810"],
    accent: "#FF7A4D",
    text: "#FFF3EC",
    glow: ["rgba(255,122,77,.28)", "rgba(255,196,107,.16)"],
  },
];

export interface CardOptions {
  ratio?: keyof typeof CARD_RATIOS;
  palette?: string;
  blocks?: Record<string, boolean>;
  privacy?: boolean;
  handle?: string;
  vaultName?: string;
}

/** Privacy mode keeps the numbers and hides everything that names something. */
const MASK = "***";
function mask(value: string, privacy: boolean): string {
  return privacy && value ? MASK : value;
}

interface CardTheme extends CardPalette {
  muted: string;
  faint: string;
  panel: string;
  stroke: string;
  empty: string;
}

/** Every shade but the accent is the palette text at a fixed alpha. */
function cardTheme(palette: CardPalette): CardTheme {
  const [r, g, b] = [1, 3, 5].map((index) =>
    parseInt(palette.text.slice(index, index + 2), 16),
  );
  const alpha = (value: number) => `rgba(${r},${g},${b},${value})`;
  return {
    ...palette,
    muted: alpha(0.62),
    faint: alpha(0.34),
    panel: alpha(0.06),
    stroke: alpha(0.12),
    empty: alpha(0.09),
  };
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  ctx.beginPath();
  const r = Math.min(radius, width / 2, height / 2);
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

/** Letter spacing is a recent canvas property; older runtimes just ignore it. */
function letterSpacing(ctx: CanvasRenderingContext2D, value: number): void {
  const target = ctx as CanvasRenderingContext2D & { letterSpacing?: string };
  if (typeof target.letterSpacing === "string")
    target.letterSpacing = `${value}px`;
}

interface TextStyle {
  size: number;
  color: string;
  weight?: number;
  align?: CanvasTextAlign;
  spacing?: number;
}
function drawText(
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  style: TextStyle,
): void {
  ctx.save();
  ctx.font = `${style.weight ?? 400} ${style.size}px ${CARD_FONT}`;
  ctx.fillStyle = style.color;
  ctx.textAlign = style.align ?? "left";
  ctx.textBaseline = "alphabetic";
  if (style.spacing) letterSpacing(ctx, style.spacing);
  ctx.fillText(value, x, y);
  ctx.restore();
}
function measureText(
  ctx: CanvasRenderingContext2D,
  value: string,
  size: number,
  weight: number,
  spacing?: number,
): number {
  ctx.save();
  ctx.font = `${weight} ${size}px ${CARD_FONT}`;
  if (spacing) letterSpacing(ctx, spacing);
  const width = ctx.measureText(value).width;
  ctx.restore();
  return width;
}

/* One line while it fits, then two, and only then an ellipsis: a long title
   reads better small and complete than full size and cut. */
function fitTitle(
  ctx: CanvasRenderingContext2D,
  value: string,
  maxWidth: number,
  weight: number,
): { lines: string[]; size: number } {
  const min = 22;
  const widest = (parts: string[], at: number) =>
    Math.max(...parts.map((part) => measureText(ctx, part, at, weight)));
  /* Break at the last space when there is one near the end of the line, and
     between characters when there is not, as Chinese has no spaces. */
  const wrap = (at: number): string[] => {
    let cut = value.length;
    while (
      cut > 1 &&
      measureText(ctx, value.slice(0, cut), at, weight) > maxWidth
    )
      cut--;
    const space = value.lastIndexOf(" ", cut);
    if (cut < value.length && space > cut * 0.6) cut = space;
    /* No line starts on a closing mark; it joins the line below instead. */
    while (cut > 1 && "、。，；：！？）》…".includes(value[cut] ?? "")) cut--;
    return [value.slice(0, cut).trimEnd(), value.slice(cut).trimStart()].filter(
      (part) => part.length > 0,
    );
  };
  for (let at = 38; at >= min; at -= 2)
    if (widest([value], at) <= maxWidth) return { lines: [value], size: at };
  /* Two lines start smaller: they have to clear the label above them. */
  for (let at = 30; at >= min; at -= 2) {
    const lines = wrap(at);
    if (widest(lines, at) <= maxWidth) return { lines, size: at };
  }
  const lines = wrap(min);
  const last = lines[lines.length - 1] ?? "";
  for (let cut = last.length - 1; cut > 0; cut--)
    if (measureText(ctx, `${last.slice(0, cut)}…`, min, weight) <= maxWidth) {
      lines[lines.length - 1] = `${last.slice(0, cut)}…`;
      break;
    }
  return { lines, size: min };
}

function formatNumber(value: number): string {
  return Math.round(value).toLocaleString("en-US");
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
function monthName(month: number): string {
  return t(MONTHS[Math.max(0, month - 1)] ?? "");
}

/* The card is painted on a canvas, so addIcon() cannot help here. The shapes are
   read out of the icon file instead of being written down a second time, so the
   card and the ribbon can never fall out of step. The file is fixed and small:
   rounded rects and straight lines, and every colour is replaced by `color`. */
function drawProjectIcon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
): void {
  const box = (/viewBox="([^"]+)"/.exec(PROJECT_ICON)?.[1] ?? "0 0 100")
    .split(" ")
    .map(Number);
  const scale = size / (box[2] ?? 100);
  const px = (value: number) => x + (value - (box[0] ?? 0)) * scale;
  const py = (value: number) => y + (value - (box[1] ?? 0)) * scale;
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const [tag] of PROJECT_ICON.matchAll(/<(?:rect|line)\b[^>]*>/g)) {
    /* The leading space keeps a name from matching the tail of another one,
       as "width" would in "stroke-width". */
    const attr = (name: string) =>
      new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1] ?? "";
    const num = (name: string) => Number(attr(name));
    const shape = (): void =>
      roundedRect(
        ctx,
        px(num("x")),
        py(num("y")),
        num("width") * scale,
        num("height") * scale,
        num("rx") * scale,
      );
    ctx.globalAlpha = Number(attr("opacity") || 1);
    const line = tag.startsWith("<line");
    if (line || attr("stroke")) {
      ctx.lineWidth = num("stroke-width") * scale;
      ctx.beginPath();
      if (line) {
        ctx.moveTo(px(num("x1")), py(num("y1")));
        ctx.lineTo(px(num("x2")), py(num("y2")));
      } else shape();
      ctx.stroke();
    } else if (attr("fill")) {
      shape();
      ctx.fill();
    }
  }
  ctx.restore();
}

function cardBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  theme: CardTheme,
): void {
  const gradient = ctx.createLinearGradient(0, 0, width * 0.55, height);
  gradient.addColorStop(0, theme.bg[0]);
  gradient.addColorStop(1, theme.bg[1]);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  (
    [
      [0.88, 0.08, theme.glow[0], 0.6],
      [0.06, 0.9, theme.glow[1], 0.55],
      [0.5, 0.5, theme.glow[0], 0.3],
    ] as [number, number, string, number][]
  ).forEach(([x, y, color, radius]) => {
    const size = Math.max(width, height) * radius;
    const glow = ctx.createRadialGradient(
      width * x,
      height * y,
      0,
      width * x,
      height * y,
      size,
    );
    glow.addColorStop(0, color);
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);
  });
  ctx.save();
  ctx.globalAlpha = 0.05;
  ctx.fillStyle = theme.text;
  for (let y = 30; y < height; y += 44)
    for (let x = 30; x < width; x += 44) ctx.fillRect(x, y, 2, 2);
  ctx.restore();
}

function cardPanel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  theme: CardTheme,
  radius = 26,
): void {
  roundedRect(ctx, x, y, width, height, radius);
  ctx.fillStyle = theme.panel;
  ctx.fill();
  ctx.strokeStyle = theme.stroke;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function miniHeat(
  ctx: CanvasRenderingContext2D,
  days: YearbookModel["days"],
  x: number,
  y: number,
  width: number,
  height: number,
  theme: CardTheme,
): void {
  const first = days[0];
  if (!first) return;
  const lead = (first.date.getDay() + 6) % 7;
  const cells: (DailyMetric | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...days,
  ];
  while (cells.length % 7) cells.push(null);
  const weeks = cells.length / 7;
  const gap = 3;
  const cellWidth = (width - gap * (weeks - 1)) / weeks;
  const cellHeight = (height - gap * 6) / 7;
  const positive = days
    .map((day) => day.words)
    .filter((value) => value > 0)
    .sort((a, b) => a - b);
  const quantile = (ratio: number) =>
    positive[Math.floor(positive.length * ratio)] || 1;
  let lastMonth = -1;
  cells.forEach((day, index) => {
    if (!day) return;
    const cx = x + Math.floor(index / 7) * (cellWidth + gap);
    const cy = y + (index % 7) * (cellHeight + gap);
    if (index % 7 === 0 && day.date.getMonth() !== lastMonth) {
      lastMonth = day.date.getMonth();
      drawText(ctx, String(lastMonth + 1), cx, y - 12, {
        size: 17,
        weight: 600,
        color: theme.faint,
      });
    }
    if (day.words <= 0) ctx.fillStyle = theme.empty;
    else {
      ctx.globalAlpha =
        day.words < quantile(0.25)
          ? 0.3
          : day.words < quantile(0.5)
            ? 0.52
            : day.words < quantile(0.8)
              ? 0.76
              : 1;
      ctx.fillStyle = theme.accent;
    }
    roundedRect(ctx, cx, cy, cellWidth, cellHeight, Math.min(3, cellWidth / 3));
    ctx.fill();
    ctx.globalAlpha = 1;
  });
}

function hourRing(
  ctx: CanvasRenderingContext2D,
  hours: number[],
  cx: number,
  cy: number,
  inner: number,
  outer: number,
  theme: CardTheme,
): void {
  const max = Math.max(...hours, 1);
  const peak = hours.indexOf(max);
  ctx.save();
  ctx.lineCap = "round";
  ctx.strokeStyle = theme.empty;
  ctx.lineWidth = 2;
  [inner, outer + 6].forEach((radius) => {
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
  });
  hours.forEach((value, hour) => {
    const angle = (hour / 24) * Math.PI * 2 - Math.PI / 2;
    const length = (value / max) * (outer - inner);
    ctx.globalAlpha = 0.25 + 0.75 * (value / max);
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = hour === peak ? 10 : 7;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner);
    ctx.lineTo(
      cx + Math.cos(angle) * (inner + Math.max(3, length)),
      cy + Math.sin(angle) * (inner + Math.max(3, length)),
    );
    ctx.stroke();
  });
  ctx.restore();
  ctx.globalAlpha = 1;
}

/* The headline reads "this year, you wrote ...". The handle is typed by the
   user, so privacy mode leaves it alone; it takes the place of the "you"
   instead of sitting in the footer as a stamp. */
/* Built per call, not at module load: the language is set after this module is
   imported, and the pronoun is the one word the dictionary has to supply. */
function pronoun(): RegExp {
  return new RegExp(`\\byou\\b|${t("you")}`);
}
function headlineParts(sentence: string, handle: string): [string, boolean][] {
  const found = handle ? pronoun().exec(sentence) : null;
  if (!found) return [[sentence, false]];
  return [
    [sentence.slice(0, found.index), false],
    [handle, true],
    [sentence.slice(found.index + found[0].length), false],
  ];
}

/** Shrinks below 38px only when a long handle would run off the card. */
function drawHeadline(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  handle: string,
  theme: CardTheme,
): void {
  const parts = headlineParts(t("This year, you wrote"), handle);
  const weightOf = (isHandle: boolean) => (isHandle ? 600 : 500);
  const span = (size: number) =>
    parts.reduce(
      (sum, [text, isHandle]) =>
        sum + measureText(ctx, text, size, weightOf(isHandle)),
      0,
    );
  let size = 38;
  if (span(size) > width)
    size = Math.max(26, Math.floor((size * width) / span(size)));
  let cursor = x;
  parts.forEach(([text, isHandle]) => {
    drawText(ctx, text, cursor, y, {
      size,
      weight: weightOf(isHandle),
      color: isHandle ? theme.accent : theme.muted,
    });
    cursor += measureText(ctx, text, size, weightOf(isHandle));
  });
}

/* The values a block needs, derived once so blocks stay pure drawing. */
interface CardData {
  model: YearbookModel;
  vaultName: string;
  handle: string;
  pages: number;
  readHours: number;
  yoy: number | null;
  tags: string[];
  star: { title: string; words: number; folder: string; date: string } | null;
  word: { text: string; count: number } | null;
  nextWord: { text: string; count: number } | null;
}

function peakLabel(hour: number): string {
  if (hour < 5) return t("Sharpest before dawn");
  if (hour < 11) return t("A morning person");
  if (hour < 14) return t("Even the lunch break counts");
  if (hour < 18) return t("The afternoon is home turf");
  if (hour < 23) return t("Free time after work");
  return t("Late night, the world is asleep");
}

interface CardBlock {
  height: number;
  ready?: (data: CardData) => boolean;
  draw: (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    data: CardData,
    theme: CardTheme,
  ) => void;
}

const BLOCKS: Record<string, CardBlock> = {
  header: {
    height: 132,
    draw(ctx, x, y, width, height, data, theme) {
      drawProjectIcon(ctx, x, y + 6, 56, theme.accent);
      drawText(ctx, t("YEARBOOK"), x + 74, y + 28, {
        size: 20,
        weight: 600,
        color: theme.faint,
        spacing: 5,
      });
      drawText(ctx, data.vaultName, x + 74, y + 56, {
        size: 26,
        weight: 500,
        color: theme.muted,
      });
      drawText(ctx, String(data.model.year), x + width, y + 58, {
        size: 76,
        weight: 800,
        color: theme.text,
        align: "right",
        spacing: -2,
      });
      ctx.strokeStyle = theme.stroke;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, y + height - 18);
      ctx.lineTo(x + width, y + height - 18);
      ctx.stroke();
    },
  },
  hero: {
    height: 318,
    draw(ctx, x, y, width, _height, data, theme) {
      drawHeadline(ctx, x, y + 44, width, data.handle, theme);
      const number = formatNumber(data.model.wordCount);
      const size = number.length > 7 ? 112 : 128;
      drawText(ctx, number, x, y + 176, {
        size,
        weight: 800,
        color: theme.text,
        spacing: -3,
      });
      drawText(
        ctx,
        t("words"),
        x + measureText(ctx, number, size, 800, -3) + 14,
        y + 172,
        { size: 44, weight: 600, color: theme.accent },
      );
      let cursor = y + 232;
      if (data.yoy !== null) {
        const chip = `${data.yoy >= 0 ? "↑" : "↓"} ${Math.abs(data.yoy)}% ${t("vs")} ${data.model.year - 1}`;
        roundedRect(
          ctx,
          x,
          cursor,
          measureText(ctx, chip, 24, 600) + 40,
          46,
          23,
        );
        ctx.save();
        ctx.globalAlpha = 0.18;
        ctx.fillStyle = theme.accent;
        ctx.fill();
        ctx.restore();
        drawText(ctx, chip, x + 20, cursor + 31, {
          size: 24,
          weight: 600,
          color: theme.accent,
        });
        cursor += 74;
      } else cursor += 20;
      drawText(
        ctx,
        `≈ ${data.pages} ${t("pages")} · ${t("Read time")} ${data.readHours} ${data.readHours === 1 ? t("hour") : t("hours")}`,
        x,
        cursor + 8,
        { size: 27, color: theme.muted },
      );
    },
  },
  heat: {
    height: 234,
    draw(ctx, x, y, width, height, data, theme) {
      cardPanel(ctx, x, y, width, height, theme);
      drawText(ctx, t("Heatmap"), x + 32, y + 50, {
        size: 27,
        weight: 600,
        color: theme.text,
      });
      drawText(
        ctx,
        `${data.model.modifiedDays} ${t("days")}`,
        x + width - 32,
        y + 50,
        { size: 24, color: theme.muted, align: "right" },
      );
      miniHeat(
        ctx,
        data.model.days,
        x + 32,
        y + 92,
        width - 64,
        height - 124,
        theme,
      );
    },
  },
  stats: {
    height: 142,
    draw(ctx, x, y, width, height, data, theme) {
      const gap = 20;
      const column = (width - gap * 2) / 3;
      (
        [
          [
            t("Notes created"),
            `${data.model.createdNotes.length} ${t("notes")}`,
          ],
          [t("Modification days"), `${data.model.modifiedDays} ${t("days")}`],
          [t("Longest streak"), `${data.model.longestStreak} ${t("days")}`],
        ] as [string, string][]
      ).forEach(([label, value], index) => {
        const cx = x + index * (column + gap);
        cardPanel(ctx, cx, y, column, height, theme, 22);
        drawText(ctx, value, cx + column / 2, y + 76, {
          size: 42,
          weight: 700,
          color: theme.text,
          align: "center",
        });
        drawText(ctx, label, cx + column / 2, y + 114, {
          size: 23,
          color: theme.muted,
          align: "center",
        });
      });
    },
  },
  topics: {
    height: 124,
    ready: (data) => data.tags.length > 0,
    draw(ctx, x, y, _width, _height, data, theme) {
      drawText(ctx, t("Topics of the year"), x, y + 26, {
        size: 27,
        weight: 600,
        color: theme.text,
      });
      let cursor = x;
      data.tags.forEach((name, index) => {
        const label = `#${name}`;
        const pillWidth = measureText(ctx, label, 30, 600) + 50;
        roundedRect(ctx, cursor, y + 50, pillWidth, 62, 31);
        ctx.save();
        ctx.globalAlpha = index === 0 ? 0.24 : 0.12;
        ctx.fillStyle = theme.accent;
        ctx.fill();
        ctx.restore();
        drawText(ctx, label, cursor + 25, y + 90, {
          size: 30,
          weight: 600,
          color: index === 0 ? theme.accent : theme.text,
        });
        cursor += pillWidth + 14;
      });
    },
  },
  duo: {
    height: 250,
    ready: (data) => data.model.peakHour !== null || data.star !== null,
    draw(ctx, x, y, width, height, data, theme) {
      const gap = 20;
      const column = (width - gap) / 2;
      cardPanel(ctx, x, y, column, height, theme);
      drawText(ctx, t("Busiest modification hour"), x + 32, y + 50, {
        size: 24,
        color: theme.muted,
      });
      drawText(
        ctx,
        data.model.peakHour === null
          ? t("Unavailable")
          : `${data.model.peakHour}:00`,
        x + 32,
        y + 118,
        { size: 58, weight: 800, color: theme.accent },
      );
      if (data.model.peakHour !== null)
        drawText(ctx, peakLabel(data.model.peakHour), x + 32, y + 158, {
          size: 22,
          color: theme.faint,
        });
      if (data.model.peakHour !== null)
        hourRing(
          ctx,
          data.model.hours,
          x + column - 104,
          y + height - 96,
          40,
          78,
          theme,
        );
      const right = x + column + gap;
      cardPanel(ctx, right, y, column, height, theme);
      drawText(ctx, t("Note of the year"), right + 32, y + 50, {
        size: 24,
        color: theme.muted,
      });
      if (!data.star) return;
      /* The brackets are measured at full size, so they keep their shape
         whatever size the title itself lands on. */
      const bracket = measureText(ctx, "《》", 38, 700);
      const { lines, size: titleSize } = fitTitle(
        ctx,
        data.star.title,
        column - 64 - bracket,
        700,
      );
      /* The words line below is fixed, so two lines are bottom aligned. */
      const leading = Math.round(titleSize * 1.2);
      const top =
        lines.length > 1 ? y + 130 - (lines.length - 1) * leading : y + 116;
      lines.forEach((line, index) =>
        drawText(
          ctx,
          `${index === 0 ? "《" : ""}${line}${index === lines.length - 1 ? "》" : ""}`,
          right + 32,
          top + index * leading,
          { size: titleSize, weight: 700, color: theme.text },
        ),
      );
      drawText(
        ctx,
        `${formatNumber(data.star.words)} ${t("words")}`,
        right + 32,
        y + 164,
        { size: 28, color: theme.accent },
      );
      drawText(ctx, data.star.date, right + 32, y + 206, {
        size: 22,
        color: theme.faint,
      });
      drawText(ctx, data.star.folder, right + column - 32, y + 206, {
        size: 22,
        color: theme.faint,
        align: "right",
      });
    },
  },
  words: {
    height: 104,
    ready: (data) => data.word !== null && data.nextWord !== null,
    draw(ctx, x, y, width, height, data, theme) {
      cardPanel(ctx, x, y, width, height, theme, 22);
      drawText(ctx, t("Your catchphrase"), x + 32, y + 42, {
        size: 23,
        color: theme.muted,
      });
      const lead = `「${data.word?.text ?? ""}」`;
      drawText(ctx, lead, x + 32, y + 82, {
        size: 30,
        weight: 700,
        color: theme.accent,
      });
      drawText(
        ctx,
        `${data.word?.count ?? 0} ${t("times")} · ${t("followed by")} 「${data.nextWord?.text ?? ""}」`,
        x + 42 + measureText(ctx, lead, 30, 700),
        y + 80,
        { size: 24, color: theme.muted },
      );
    },
  },
  closing: {
    height: 124,
    ready: (data) =>
      (data.model.monthlyWords[Math.max(0, data.model.topMonth - 1)] ?? 0) >
        0 || (data.model.longestSilence?.days ?? 0) > 0,
    draw(ctx, x, y, _width, _height, data, theme) {
      drawText(
        ctx,
        `${monthName(data.model.topMonth)} ${t("was your most productive month")}`,
        x,
        y + 34,
        { size: 33, weight: 600, color: theme.text },
      );
      const gap = data.model.longestSilence?.days ?? 0;
      if (gap > 0)
        drawText(
          ctx,
          `${t("The longest silence ran")} ${gap} ${t("days")} — ${t("but you came back")}`,
          x,
          y + 86,
          { size: 26, color: theme.muted },
        );
    },
  },
};

/** Greedy fill order: essentials first, then whatever the user left on. */
const DRAW_ORDER = [
  "header",
  "hero",
  "heat",
  "stats",
  "topics",
  "duo",
  "words",
  "closing",
];
const PRIORITY = [
  "header",
  "hero",
  "stats",
  "heat",
  "topics",
  "duo",
  "words",
  "closing",
];
const ALWAYS = ["header", "hero", "stats"];

export function drawShareCard(
  canvas: HTMLCanvasElement,
  model: YearbookModel,
  options: CardOptions = {},
): void {
  const ratio = options.ratio ?? "9:16";
  const [width, height, pad] = CARD_RATIOS[ratio] ?? CARD_RATIOS["9:16"];
  const palette =
    CARD_PALETTES.find((item) => item.id === options.palette) ??
    CARD_PALETTES[0];
  if (!palette) return;
  /* Cards are exported at 2x so they stay sharp when posted elsewhere. */
  const pixelRatio = 2;
  canvas.width = width * pixelRatio;
  canvas.height = height * pixelRatio;
  canvas.style.aspectRatio = `${width} / ${height}`;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  const theme = cardTheme(palette);
  cardBackground(ctx, width, height, theme);

  const representative = model.representative;
  const privacy = options.privacy ?? false;
  const lead = model.topWords[0];
  const runnerUp = model.topWords[1];
  /* The handle is typed by the user, so privacy mode leaves it alone. */
  const rawHandle = (options.handle ?? "").trim().replace(/^@+/, "");
  const data: CardData = {
    model,
    vaultName: mask(options.vaultName ?? "", privacy),
    handle: rawHandle ? `@${rawHandle}` : "",
    pages: Math.max(1, Math.round(model.wordCount / 500)),
    readHours: Math.max(1, Math.round(model.wordCount / 260 / 60)),
    yoy: model.previousWords
      ? Math.round(
          ((model.wordCount - model.previousWords) / model.previousWords) * 100,
        )
      : null,
    tags: model.topTags.slice(0, 3).map((tag) => mask(tag.name, privacy)),
    star: representative
      ? {
          title: mask(representative.title, privacy),
          words: representative.wordCount,
          folder: mask(representative.folder.split("/")[0] || ".", privacy),
          date: dateKey(representative.modifiedAt),
        }
      : null,
    word: lead ? { text: mask(lead.text, privacy), count: lead.count } : null,
    nextWord: runnerUp
      ? { text: mask(runnerUp.text, privacy), count: runnerUp.count }
      : null,
  };

  /* Layout engine: keep what fits by priority, then spread the leftovers. */
  const footHeight = Math.round(pad * 1.3) + 46;
  const available = height - pad - footHeight;
  const blocks = options.blocks ?? {};
  const kept: string[] = [];
  let usedHeight = 0;
  for (const key of PRIORITY) {
    const block = BLOCKS[key];
    if (!block) continue;
    if (!ALWAYS.includes(key) && blocks[key] === false) continue;
    if (block.ready && !block.ready(data)) continue;
    const next = usedHeight + block.height + (kept.length ? 22 : 0);
    if (next <= available) {
      kept.push(key);
      usedHeight = next;
    }
  }
  const order = DRAW_ORDER.filter((key) => kept.includes(key));
  const total = order.reduce((sum, key) => sum + (BLOCKS[key]?.height ?? 0), 0);
  let gap = order.length > 1 ? (available - total) / (order.length - 1) : 0;
  gap = Math.min(gap, 92);
  const spent = total + gap * (order.length - 1);
  let y = pad + Math.max(0, (available - spent) / 2);
  for (const key of order) {
    const block = BLOCKS[key];
    if (!block) continue;
    block.draw(ctx, pad, y, width - pad * 2, block.height, data, theme);
    y += block.height + gap;
  }

  const footY = height - Math.round(pad * 0.82);
  ctx.strokeStyle = theme.stroke;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(pad, footY - 44);
  ctx.lineTo(width - pad, footY - 44);
  ctx.stroke();
  drawText(ctx, t("By Awesome Yearbook"), pad, footY, {
    size: 24,
    weight: 600,
    color: theme.muted,
  });
  drawText(ctx, dateKey(new Date()).replace(/-/g, " / "), width - pad, footY, {
    size: 22,
    color: theme.faint,
    align: "right",
  });
}

export function cardText(model: YearbookModel, privacy = false): string {
  const peak =
    model.peakHour === null ? t("Unavailable") : `${model.peakHour}:00`;
  const star = model.representative;
  return [
    `${model.year} ${t("yearbook")} · ${formatNumber(model.wordCount)} ${t("words")} · ${t("Attributed by last modification date")}`,
    `${t("Notes created")} ${model.createdNotes.length} ${t("notes")} · ${t("Modification days")} ${model.modifiedDays} ${t("days")} · ${t("Longest streak")} ${model.longestStreak} ${t("days")}`,
    `${t("Busiest modification hour")}: ${peak} · ${t("Top month")}: ${monthName(model.topMonth)}`,
    `${t("Topics of the year")}: ${model.topTags
      .slice(0, 3)
      .map((tag) => `#${mask(tag.name, privacy)}`)
      .join(" ")}`,
    star
      ? `${t("Note of the year")}: 《${mask(star.title, privacy)}》 ${formatNumber(star.wordCount)} ${t("words")}`
      : `${t("Note of the year")}: ${t("Unavailable")}`,
    `— ${t("Awesome Yearbook")}`,
  ].join("\n");
}
