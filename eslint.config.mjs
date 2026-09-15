import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import obsidianmd from "eslint-plugin-obsidianmd";

export default defineConfig(
  globalIgnores([
    "node_modules",
    "build",
    "main.js",
    "esbuild.config.mjs",
    "vitest.config.mts",
    "version-bump.mjs",
    "scripts/deploy.mjs",
    "scripts/seed.mjs",
    "scripts/social-preview.mjs",
    "package.json",
    "package-lock.json",
    "tsconfig.json",
  ]),
  {
    languageOptions: {
      globals: {
        ...globals.browser,
      },
      parserOptions: {
        projectService: {
          allowDefaultProject: ["eslint.config.mjs", "manifest.json"],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  ...obsidianmd.configs.recommended,
  {
    // Tests never ship; the i18n orphan check has to read the sources.
    files: ["tests/**/*.ts"],
    rules: { "obsidianmd/no-nodejs-modules": "off" },
  },
);
