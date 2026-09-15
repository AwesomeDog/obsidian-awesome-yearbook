/** Inline SVG icons, drawn as Lucide-style 24×24 outlines. */

const SVG_NS = "http://www.w3.org/2000/svg";

/** docs/specs/icon.svg, injected by the build (esbuild.config.mjs). */
declare const __PROJECT_ICON_SVG__: string;

/**
 * The project icon, and the id `addIcon()` registers it under. The file is used
 * as it is: `addIcon()` nests it in a `0 0 100 100` box, which the file's own
 * viewBox fills because it carries no width/height of its own.
 */
export const PROJECT_ICON_ID = "awesome-yearbook";
export const PROJECT_ICON = __PROJECT_ICON_SVG__;

type Shape =
  | { kind: "path"; d: string }
  | {
      kind: "rect";
      x: number;
      y: number;
      width: number;
      height: number;
      rx?: number;
    }
  | { kind: "circle"; cx: number; cy: number; r: number };

/** Lucide-style 24×24 outlines; only the icons the dashboard uses. */
const ICONS: Record<string, Shape[]> = {
  book: [
    { kind: "path", d: "M12 7v14" },
    {
      kind: "path",
      d: "M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z",
    },
  ],
  pulse: [{ kind: "path", d: "M3.5 13H6l2-5 3 9 2.5-6 1.5 2h5.5" }],
  calendar: [
    { kind: "rect", x: 3, y: 4, width: 18, height: 18, rx: 2 },
    { kind: "path", d: "M16 2v4M8 2v4M3 10h18" },
  ],
  hash: [{ kind: "path", d: "M4 9h16M4 15h16M10 3 8 21M16 3l-2 18" }],
  activity: [{ kind: "path", d: "M22 12h-4l-3 9L9 3l-3 9H2" }],
  file: [
    {
      kind: "path",
      d: "M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z",
    },
    { kind: "path", d: "M14 2v5h6" },
  ],
  folder: [
    {
      kind: "path",
      d: "M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z",
    },
  ],
  settings: [
    {
      kind: "path",
      d: "M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6",
    },
  ],
  refresh: [
    { kind: "path", d: "M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" },
    { kind: "path", d: "M21 3v5h-5" },
    { kind: "path", d: "M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" },
    { kind: "path", d: "M8 16H3v5" },
  ],
  panel: [
    { kind: "rect", x: 3, y: 3, width: 18, height: 18, rx: 2 },
    { kind: "path", d: "M15 3v18" },
  ],
  x: [{ kind: "path", d: "M18 6 6 18M6 6l12 12" }],
  left: [{ kind: "path", d: "m15 18-6-6 6-6" }],
  right: [{ kind: "path", d: "m9 18 6-6-6-6" }],
  chevron: [{ kind: "path", d: "m9 18 6-6-6-6" }],
  download: [
    { kind: "path", d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" },
    { kind: "path", d: "m7 10 5 5 5-5M12 15V3" },
  ],
  copy: [
    { kind: "rect", x: 8, y: 8, width: 14, height: 14, rx: 2 },
    {
      kind: "path",
      d: "M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2",
    },
  ],
  link: [
    {
      kind: "path",
      d: "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71",
    },
    {
      kind: "path",
      d: "M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71",
    },
  ],
  unlink: [
    {
      kind: "path",
      d: "m18.84 12.25 1.72-1.71a5 5 0 0 0-7.07-7.07l-1.71 1.71",
    },
    { kind: "path", d: "m5.17 11.75-1.71 1.71a5 5 0 0 0 7.07 7.07l1.71-1.71" },
    { kind: "path", d: "m2 2 20 20" },
  ],
  ghost: [
    { kind: "path", d: "M9 10h.01M15 10h.01" },
    {
      kind: "path",
      d: "M12 2a8 8 0 0 0-8 8v12l3-3 2.5 2.5L12 19l2.5 2.5L17 19l3 3V10a8 8 0 0 0-8-8Z",
    },
  ],
  dust: [
    { kind: "circle", cx: 12, cy: 12, r: 9 },
    { kind: "path", d: "M12 7v5l3 2" },
  ],
  check: [
    { kind: "rect", x: 3, y: 3, width: 18, height: 18, rx: 2 },
    { kind: "path", d: "m9 12 2 2 4-4" },
  ],
  alert: [
    {
      kind: "path",
      d: "m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z",
    },
    { kind: "path", d: "M12 9v4M12 17h.01" },
  ],
  trend: [
    { kind: "path", d: "M22 7 13.5 15.5 8.5 10.5 2 17" },
    { kind: "path", d: "M16 7h6v6" },
  ],
  flame: [
    {
      kind: "path",
      d: "M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 2 3.5 2 5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5Z",
    },
  ],
  clock: [
    { kind: "circle", cx: 12, cy: 12, r: 9 },
    { kind: "path", d: "M12 7v5l3 2" },
  ],
  contrast: [
    { kind: "circle", cx: 12, cy: 12, r: 10 },
    { kind: "path", d: "M12 18a6 6 0 0 0 0-12v12Z" },
  ],
};

export type IconName = keyof typeof ICONS;

export function svgElement<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attributes: Record<string, string | number> = {},
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attributes))
    node.setAttribute(name, String(value));
  return node;
}

/** Builds a 24×24 stroked icon; `size` maps to the `.sm` / `.lg` icon rules. */
export function icon(name: IconName, size?: "sm" | "lg"): SVGSVGElement {
  const svg = svgElement("svg", {
    viewBox: "0 0 24 24",
    class: `yb-svg-icon${size ? ` ${size}` : ""}`,
    "aria-hidden": "true",
  });
  for (const shape of ICONS[name] ?? []) {
    if (shape.kind === "path") svg.append(svgElement("path", { d: shape.d }));
    else if (shape.kind === "circle")
      svg.append(
        svgElement("circle", {
          cx: shape.cx,
          cy: shape.cy,
          r: shape.r,
        }),
      );
    else
      svg.append(
        svgElement("rect", {
          x: shape.x,
          y: shape.y,
          width: shape.width,
          height: shape.height,
          rx: shape.rx ?? 0,
        }),
      );
  }
  return svg;
}
