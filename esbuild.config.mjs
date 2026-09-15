import { readFileSync } from "node:fs";
import { builtinModules } from "node:module";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { build, context } from "esbuild";

const production = process.argv[2] === "production";
const nodeBuiltins = builtinModules.flatMap((name) => [name, `node:${name}`]);
// docs/specs/icon.svg is the only copy of the icon; src/icons.ts shapes it.
const iconSvg = readFileSync(
  fileURLToPath(new URL("./docs/specs/icon.svg", import.meta.url)),
  "utf8",
);

const options = {
  entryPoints: ["src/main.ts"],
  bundle: true,
  loader: { ".css": "text" },
  define: { __PROJECT_ICON_SVG__: JSON.stringify(iconSvg) },
  // Obsidian resolves CodeMirror at runtime
  external: [
    "obsidian",
    "electron",
    "@codemirror/state",
    "@codemirror/view",
    ...nodeBuiltins,
  ],
  format: "cjs",
  logLevel: "info",
  minify: production,
  charset: "utf8",
  outfile: "main.js",
  sourcemap: production ? false : "inline",
  target: "es2021",
  treeShaking: true,
};

try {
  if (production) {
    await build(options);
  } else {
    const watchContext = await context(options);
    await watchContext.watch();
  }
} catch {
  process.exitCode = 1;
}
