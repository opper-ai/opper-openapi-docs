# opper-openapi-docs: Branding, Dark Mode, Parallel Writing, Demo Pages

## Status: Complete

## Changes

### 1. Dark Mode (CSS-only)
- [x] Add `@media (prefers-color-scheme: dark)` CSS block
- [x] Switch Shiki to dual themes (github-light/github-dark)
- [x] Tests for dark mode CSS

### 2. Configurable Branding (title + icon)
- [x] Add `title`, `icon` to `Config` interface
- [x] Add `--title`, `--icon` CLI flags
- [x] Add `title`, `icon` inputs to `action.yml`
- [x] Write `.openapi-docs-site.json` site config during generation
- [x] Renderer reads site config for title/icon
- [x] Tests for custom title, default title, icon rendering

### 3. Parallel Section Writing
- [x] Replace sequential loop with `Promise.allSettled`

### 4. GitHub Pages Demo
- [x] Create `.github/workflows/demo.yml`

## Files Modified
- `src/config.ts` - Add title, icon fields
- `src/cli.ts` - Add --title, --icon flags; write site config
- `src/generate.ts` - Write site config file; parallel section writing
- `src/renderer.ts` - Read site config, custom title/icon, dark mode CSS, dual Shiki themes
- `action.yml` - Add title, icon inputs
- `test/renderer.test.ts` - Tests for title, icon, dark mode
- `.github/workflows/demo.yml` - New: GitHub Pages deployment
