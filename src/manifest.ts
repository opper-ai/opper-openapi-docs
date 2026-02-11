import { readFile, writeFile } from "fs/promises";
import { resolve, join } from "path";
import { createHash } from "crypto";

export interface SectionManifest {
  contentHash: string;
  outputPath: string;
  generatedAt: string;
}

export interface Manifest {
  version: number;
  specHash: string;
  instructionsHash: string;
  sections: Record<string, SectionManifest>;
}

const MANIFEST_FILENAME = ".openapi-docs-manifest.json";

export function sha256(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

export async function readManifest(
  outputDir: string
): Promise<Manifest | null> {
  try {
    const raw = await readFile(
      resolve(join(outputDir, MANIFEST_FILENAME)),
      "utf-8"
    );
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function writeManifest(
  outputDir: string,
  manifest: Manifest
): Promise<void> {
  await writeFile(
    resolve(join(outputDir, MANIFEST_FILENAME)),
    JSON.stringify(manifest, null, 2) + "\n"
  );
}
