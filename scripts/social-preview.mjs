// Generate the GitHub social preview (1280x640, 2:1) from the repo's own SVG
// screenshots. Idempotent: no timestamps, no randomness, no network.
//
//   node scripts/social-preview.mjs
//
// Outputs:
//   docs/img/social-preview.svg  (editable source of truth)
//   /tmp/ay-social-preview.png   (the file to upload: repo Settings → Social preview)
//
// Requires rsvg-convert (brew install librsvg) for the raster step.

import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

// --- copy (edit strings here, not markup) -----------------------------------
const COPY = {
  badge: "OBSIDIAN PLUGIN",
  title: "Awesome Yearbook",
  tagline: [
    "Writing stats, heatmaps, streaks and vault",
    "health — plus a one-tap Year in Review card.",
  ],
  foot: "100% local · zero telemetry · no account",
};

// --- layout constants ---------------------------------------------------------
const W = 1280;
const H = 640;

const badge = { x: 64, y: 72, h: 28, font: 13 };
const title = { x: 64, y: 162, font: 50 };
const tagline = { x: 64, y: 204, font: 19, line: 27 };
const foot = { x: 64, y: 560, font: 14 };

// dashboard screenshot (docs/screenshots/overview.svg, 1240x1214) cropped to
// its top 798px: header + Today + Range overview + Writing trend.
const shot = { x: 556, y: 169, w: 470, srcW: 1240, srcH: 806 };

// year-in-review share card (docs/screenshots/share-card.svg, 1080x1920).
const card = { x: 905, y: 40, w: 315 };

// --- assets -------------------------------------------------------------------
const OVERVIEW = readFileSync("docs/screenshots/overview.svg").toString(
  "base64",
);
const SHARE_CARD = readFileSync("docs/screenshots/share-card.svg").toString(
  "base64",
);

const shotH = Math.round((shot.w * shot.srcH) / shot.srcW); // 302
const cardH = Math.round((card.w * 1920) / 1080); // 560

const href = (b64, mime) => `data:${mime};base64,${b64}`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="${W}" y2="${H}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#1A1233"/>
      <stop offset="1" stop-color="#0D0A1E"/>
    </linearGradient>
    <radialGradient id="glowTR" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#7C3AED" stop-opacity="0.40"/>
      <stop offset="1" stop-color="#7C3AED" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glowBL" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#A855F7" stop-opacity="0.22"/>
      <stop offset="1" stop-color="#A855F7" stop-opacity="0"/>
    </radialGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="10" stdDeviation="18" flood-color="#000000" flood-opacity="0.5"/>
    </filter>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <ellipse cx="1150" cy="60" rx="430" ry="300" fill="url(#glowTR)"/>
  <ellipse cx="180" cy="630" rx="390" ry="260" fill="url(#glowBL)"/>

  <!-- badge -->
  <rect x="${badge.x}" y="${badge.y}" width="168" height="${badge.h}" rx="${badge.h / 2}" fill="#7C3AED" fill-opacity="0.22" stroke="#A78BFA" stroke-opacity="0.55"/>
  <text x="${badge.x + 84}" y="${badge.y + 18.5}" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="${badge.font}" font-weight="600" letter-spacing="2" fill="#C4B5FD" text-anchor="middle">${COPY.badge}</text>

  <!-- title + tagline -->
  <text x="${title.x}" y="${title.y}" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="${title.font}" font-weight="700" fill="#FFFFFF">${COPY.title}</text>
  ${COPY.tagline
    .map(
      (line, i) =>
        `<text x="${tagline.x}" y="${tagline.y + i * tagline.line}" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="${tagline.font}" fill="#B4A9D6">${line}</text>`,
    )
    .join("\n  ")}

  <!-- dashboard screenshot (back) -->
  <g filter="url(#shadow)">
    <svg x="${shot.x}" y="${shot.y}" width="${shot.w}" height="${shotH}" viewBox="0 0 ${shot.srcW} ${shot.srcH}">
      <image href="${href(OVERVIEW, "image/svg+xml")}" xlink:href="${href(OVERVIEW, "image/svg+xml")}" width="${shot.srcW}" height="1214" preserveAspectRatio="xMinYMin slice"/>
    </svg>
  </g>
  <rect x="${shot.x}" y="${shot.y}" width="${shot.w}" height="${shotH}" rx="0" fill="none" stroke="#FFFFFF" stroke-opacity="0.16"/>

  <!-- share card (front) -->
  <g filter="url(#shadow)">
    <svg x="${card.x}" y="${card.y}" width="${card.w}" height="${cardH}" viewBox="0 0 1080 1920">
      <image href="${href(SHARE_CARD, "image/svg+xml")}" xlink:href="${href(SHARE_CARD, "image/svg+xml")}" width="1080" height="1920"/>
    </svg>
  </g>
  <rect x="${card.x}" y="${card.y}" width="${card.w}" height="${cardH}" rx="12" fill="none" stroke="#FFFFFF" stroke-opacity="0.18"/>

  <!-- foot -->
  <text x="${foot.x}" y="${foot.y}" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="${foot.font}" fill="#8B7FB8">${COPY.foot}</text>
</svg>
`;

writeFileSync("docs/img/social-preview.svg", svg);
console.log("wrote docs/img/social-preview.svg");

try {
  execFileSync("rsvg-convert", [
    "-w",
    String(W),
    "-h",
    String(H),
    "-o",
    "/tmp/ay-social-preview.png",
    "docs/img/social-preview.svg",
  ]);
  console.log("wrote /tmp/ay-social-preview.png");
} catch (err) {
  if (err.code === "ENOENT") {
    console.error("rsvg-convert not found — brew install librsvg, then rerun.");
  } else {
    throw err;
  }
}
