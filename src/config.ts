import { readFile } from "fs/promises";
import { resolve } from "path";

export interface Config {
  spec: string;
  output: string;
  instructions?: string;
  model?: string;
  site?: boolean;
  force?: boolean;
  title?: string;
  icon?: string;
}

const CONFIG_FILENAME = "opper-docs.config.json";
const DEFAULT_MODEL = "openai/gpt-5.2";

export async function loadConfig(cliOptions: Partial<Config>): Promise<Config> {
  let fileConfig: Partial<Config> = {};

  try {
    const raw = await readFile(resolve(CONFIG_FILENAME), "utf-8");
    fileConfig = JSON.parse(raw);
  } catch {
    // No config file, that's fine
  }

  const merged: Config = {
    spec: cliOptions.spec ?? fileConfig.spec ?? "",
    output: cliOptions.output ?? fileConfig.output ?? "./docs",
    instructions: cliOptions.instructions ?? fileConfig.instructions,
    model: cliOptions.model ?? fileConfig.model ?? DEFAULT_MODEL,
    site: cliOptions.site ?? fileConfig.site ?? false,
    force: cliOptions.force ?? false,
    title: cliOptions.title ?? fileConfig.title,
    icon: cliOptions.icon ?? fileConfig.icon,
  };

  if (!merged.spec) {
    throw new Error(
      "No spec file provided. Use --spec or set 'spec' in opper-docs.config.json"
    );
  }

  if (!process.env.OPPER_API_KEY) {
    throw new Error(
      "OPPER_API_KEY environment variable is required. Get your key at https://opper.ai"
    );
  }

  return merged;
}
