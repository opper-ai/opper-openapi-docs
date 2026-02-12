import { Command } from "commander";
import { loadConfig } from "./config.js";
import { generate } from "./generate.js";
import { renderSite } from "./renderer.js";
import { resolve, join } from "path";
import { writeFile } from "fs/promises";
import type { SiteConfig } from "./renderer.js";

const program = new Command();

program
  .name("opper-openapi-docs")
  .description(
    "Generate rich API documentation from OpenAPI specs using AI agents"
  )
  .version("0.1.0");

program
  .command("generate")
  .description("Generate documentation from an OpenAPI spec")
  .requiredOption("--spec <path>", "Path to OpenAPI spec file")
  .option("--output <dir>", "Output directory", "./docs")
  .option("--instructions <text>", "Custom documentation instructions")
  .option("--model <model>", "LLM model to use")
  .option("--site", "Also generate a static site")
  .option("--force", "Force regenerate all sections (ignore cache)")
  .option("--title <text>", "Site title for sidebar header")
  .option("--icon <path>", "Path to icon file (SVG/PNG) for sidebar header")
  .action(async (options) => {
    try {
      const config = await loadConfig(options);
      await generate(config);
      if (config.site) {
        const siteConfig: SiteConfig = {};
        if (config.title) siteConfig.title = config.title;
        if (config.icon) siteConfig.icon = resolve(config.icon);
        await writeFile(
          resolve(join(config.output, ".openapi-docs-site.json")),
          JSON.stringify(siteConfig, null, 2) + "\n"
        );
        await renderSite(resolve(config.output));
      }
    } catch (err) {
      console.error(
        `Error: ${err instanceof Error ? err.message : String(err)}`
      );
      process.exit(1);
    }
  });

program
  .command("render")
  .description("Render static site from existing markdown (no regeneration)")
  .option("--dir <dir>", "Docs directory containing markdown files", "./docs")
  .action(async (options) => {
    try {
      await renderSite(resolve(options.dir));
    } catch (err) {
      console.error(
        `Error: ${err instanceof Error ? err.message : String(err)}`
      );
      process.exit(1);
    }
  });

program
  .command("serve")
  .description("Serve the generated static site locally")
  .option("--dir <dir>", "Docs directory containing _site", "./docs")
  .option("--port <port>", "Port to serve on", "3333")
  .action(async (options) => {
    const siteDir = resolve(join(options.dir, "_site"));
    const port = parseInt(options.port, 10);
    const { createServer } = await import("http");
    const { readFile: rf } = await import("fs/promises");
    const { join: pjoin, extname } = await import("path");

    const mimeTypes: Record<string, string> = {
      ".html": "text/html",
      ".css": "text/css",
      ".js": "application/javascript",
      ".json": "application/json",
    };

    const server = createServer(async (req, res) => {
      let urlPath = req.url ?? "/";
      if (urlPath === "/") urlPath = "/index.html";
      if (!extname(urlPath)) urlPath += ".html";

      try {
        const filePath = pjoin(siteDir, urlPath);
        const content = await rf(filePath);
        const ext = extname(filePath);
        res.writeHead(200, { "Content-Type": mimeTypes[ext] ?? "text/plain" });
        res.end(content);
      } catch {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Not found");
      }
    });

    server.listen(port, () => {
      console.log(`Serving docs at http://localhost:${port}`);
    });
  });

program.parse();
