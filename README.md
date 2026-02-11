# opper-openapi-docs

Generate rich API documentation from OpenAPI specs using AI agents.

Unlike mechanical renderers (Swagger UI, Redoc), this tool uses AI agents to produce developer-friendly docs with narrative flow, code examples, and getting-started guides. Agents read the spec through tools, decide how to structure the docs, and write each section with full cross-referencing.

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
| `--model <model>` | LLM model to use | |
| `--site` | Also generate a static HTML site | |
| `--force` | Regenerate all sections (ignore cache) | |

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
  "model": "openai/gpt-4o"
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

      - uses: opper-ai/opper-openapi-docs@main
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
| `model` | LLM model to use | No | |
| `site` | Generate static site | No | `true` |
| `opper-api-key` | Opper API key | Yes | |

### Outputs

| Output | Description |
|--------|-------------|
| `docs-dir` | Path to generated markdown |
| `site-dir` | Path to generated static site (when `site: true`) |

### Deploy to GitHub Pages

```yaml
name: Deploy API Docs

on:
  push:
    paths:
      - 'openapi.yaml'

permissions:
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

      - uses: opper-ai/opper-openapi-docs@main
        id: docs
        with:
          spec: ./openapi.yaml
          opper-api-key: ${{ secrets.OPPER_API_KEY }}

      - uses: actions/configure-pages@v5

      - uses: actions/upload-pages-artifact@v3
        with:
          path: ${{ steps.docs.outputs.site-dir }}

      - uses: actions/deploy-pages@v4
        id: deployment
```

## How It Works

1. **Parse** - Reads and indexes the OpenAPI spec (resolves all `$ref`s)
2. **Plan** - A planning agent analyzes the spec and decides the doc structure
3. **Write** - A writer agent generates each section with full spec access via tools
4. **Render** - Optionally converts markdown to a static HTML site with syntax highlighting

## License

MIT
