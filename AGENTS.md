# Agent Notes

## Rules

- **Nothing about the vault is persisted.** The plugin writes only its own
  settings. If a number cannot be derived from a single scan of the vault, it is
  not shown. Do not add history, diffs, caches or "last seen" state.
- **The charts are fixed.** Users choose a time range, nothing else. Do not add
  a chart picker, a query language or configurable series.
- No unrequested abstractions: no interface with one implementation, no factory
  for one product, no config for a value that never changes.
- Deletion over addition. Boring over clever.
- Shortest working diff wins — but only once you understand the problem.

## Gotchas

- The share card does **not** follow the app theme: it is posted outside
  Obsidian, so it carries its own palettes.
- No binaries in `docs/`. Prototypes are HTML that draws itself; if a design
  question needs an image, answer it with SVG or canvas rather than committing a
  PNG.
