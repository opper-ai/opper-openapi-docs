# Generate rich API documentation from OpenAPI specs using AI agents

Unlike mechanical renderers (Swagger UI, Redoc), this tool uses AI agents to produce developer-friendly docs with narrative flow, code examples, and getting-started guides. Agents read the spec through tools, decide how to structure the docs, and write each section with full cross-referencing.

[Live demo (Pet Store API)](https://opper-ai.github.io/opper-openapi-docs/)

## Quick Start

```bash
npm install opper-openapi-docs
export OPPER_API_KEY=your-key  # get one at https://opper.ai

npx opper-openapi-docs generate --spec ./openapi.yaml --output ./docs --site
npx opper-openapi-docs serve --dir ./docs
```

## CLI

### `generate`

Generate documentation from an OpenAPI spec (3.0 or 3.1, JSON or YAML).

```bash
npx opper-openapi-docs generate --spec ./openapi.yaml [options]
```

| Flag | Description | Default |
|------|-------------|---------|
| `--spec <path>` | Path to OpenAPI spec file | (required) |
| `--output <dir>` | Output directory | `./docs` |
| `--instructions <text>` | Custom tone/audience instructions | |
| `--model <model>` | LLM model to use | `openai/gpt-5.2` |
| `--site` | Also generate a static HTML site | |
| `--force` | Regenerate all sections (ignore cache) | |
| `--title <text>` | Site title for sidebar header | `API Docs` |
| `--icon <path>` | Path to icon file (SVG/PNG) for sidebar | |

### `render`

Re-render the static site from existing markdown without regenerating content.

```bash
npx opper-openapi-docs render --dir ./docs
```

### `serve`

Serve the generated site locally for preview.

```bash
npx opper-openapi-docs serve --dir ./docs --port 3333
```

## Configuration File

Create `opper-docs.config.json` to avoid repeating flags:

```json
{
  "spec": "./openapi.yaml",
  "output": "./docs",
  "instructions": "Write concise docs aimed at backend developers. Use curl for examples.",
  "model": "openai/gpt-5.2",
  "title": "My API",
  "icon": "./logo.svg"
}
```

CLI flags override config file values.

## Caching

The tool caches generated sections based on content hashes. When you re-run `generate`:

- Unchanged sections are skipped
- Only sections whose relevant spec content changed are regenerated
- Changing `--instructions` regenerates everything
- Use `--force` to regenerate all sections

## GitHub Action

Use in CI to generate docs automatically on spec changes.

```yaml
name: Generate API Docs

on:
  push:
    paths:
      - 'openapi.yaml'

jobs:
  docs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: opper-ai/opper-openapi-docs@v1
        with:
          spec: ./openapi.yaml
          opper-api-key: ${{ secrets.OPPER_API_KEY }}
```

### Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `spec` | Path to OpenAPI spec file | Yes | |
| `output` | Output directory | No | `./docs` |
| `instructions` | Custom documentation instructions | No | |
| `model` | LLM model to use | No | `openai/gpt-5.2` |
| `site` | Generate static site | No | `true` |
| `title` | Site title for sidebar header | No | `API Docs` |
| `icon` | Path to icon file (SVG/PNG) for sidebar | No | |
| `opper-api-key` | Opper API key | Yes | |

### Outputs

| Output | Description |
|--------|-------------|
| `docs-dir` | Path to generated markdown |
| `site-dir` | Path to generated static site (when `site: true`) |

### Deploy to GitHub Pages

Auto-deploy your docs whenever the spec changes.

**Prerequisites:**
1. Add `OPPER_API_KEY` to your repo secrets (Settings > Secrets and variables > Actions)
2. Enable GitHub Pages with source "GitHub Actions" (Settings > Pages > Source)

```yaml
name: Deploy API Docs

on:
  push:
    paths:
      - 'openapi.yaml'

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4

      # Cache docs output so only changed sections are regenerated
      - uses: actions/cache@v4
        with:
          path: ./docs
          key: api-docs-${{ hashFiles('openapi.yaml') }}
          restore-keys: api-docs-

      - uses: opper-ai/opper-openapi-docs@v1
        id: docs
        with:
          spec: ./openapi.yaml
          title: My API
          icon: ./logo.svg
          opper-api-key: ${{ secrets.OPPER_API_KEY }}

      - uses: actions/configure-pages@v5

      - uses: actions/upload-pages-artifact@v3
        with:
          path: ${{ steps.docs.outputs.site-dir }}

      - uses: actions/deploy-pages@v4
        id: deployment
```

## Customization

### Branding

Set a custom title and icon for the sidebar header:

```bash
npx opper-openapi-docs generate --spec ./openapi.yaml --site --title "My API" --icon ./logo.svg
```

The icon can be any SVG or PNG file. It's copied into the site output and displayed at 24px height next to the title.

### Dark Mode

The generated site automatically respects the user's OS dark mode preference via `prefers-color-scheme`. No configuration needed — code blocks also switch between light and dark syntax themes.

## How It Works

1. **Parse** - Reads and indexes the OpenAPI spec (resolves all `$ref`s)
2. **Plan** - A planning agent analyzes the spec and decides the doc structure
3. **Write** - A writer agent generates each section with full spec access via tools
4. **Render** - Optionally converts markdown to a static HTML site with syntax highlighting

## License

MIT
