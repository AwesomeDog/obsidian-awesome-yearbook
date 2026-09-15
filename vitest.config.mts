import { readFileSync } from "node:fs";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // same injection as esbuild.config.mjs, so tests see the real icon
  define: {
    __PROJECT_ICON_SVG__: JSON.stringify(
      readFileSync(new URL("./docs/specs/icon.svg", import.meta.url), "utf8"),
    ),
  },
  resolve: {
    alias: {
      // `obsidian` is a types-only package; see tests/stubs/obsidian.ts.
      obsidian: new URL("./tests/stubs/obsidian.ts", import.meta.url).pathname,
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
