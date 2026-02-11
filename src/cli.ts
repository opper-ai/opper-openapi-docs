import { Command } from "commander";
import { loadConfig } from "./config.js";
import { generate } from "./generate.js";

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
  .action(async (options) => {
    try {
      const config = await loadConfig(options);
      await generate(config);
    } catch (err) {
      console.error(
        `Error: ${err instanceof Error ? err.message : String(err)}`
      );
      process.exit(1);
    }
  });

program.parse();
