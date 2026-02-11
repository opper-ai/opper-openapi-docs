import { mkdir, writeFile, unlink } from "fs/promises";
import { resolve, join, dirname } from "path";
import type { Config } from "./config.js";
import { buildSpecIndex } from "./spec-index.js";
import { readManifest, writeManifest, sha256 } from "./manifest.js";
import type { Manifest } from "./manifest.js";
import { createPlanningAgent } from "./agents/planner.js";
import type { DocPlan } from "./agents/planner.js";
import { createWriterAgent } from "./agents/writer.js";
import { computeSectionHash } from "./hashing.js";

export async function generate(config: Config): Promise<void> {
  // 1. Parse spec
  console.log(`Parsing spec: ${config.spec}`);
  const specIndex = await buildSpecIndex(config.spec);

  console.log(`API: ${specIndex.info.title} v${specIndex.info.version}`);
  console.log(`Tags: ${specIndex.tags.map((t) => t.name).join(", ") || "(none)"}`);
  console.log(`Schemas: ${specIndex.schemas.size}`);
  console.log(
    `Endpoints: ${Array.from(specIndex.pathsByTag.values()).reduce((sum, v) => sum + v.length, 0)}`
  );

  const outputDir = resolve(config.output);
  await mkdir(outputDir, { recursive: true });

  // 2. Check if we can skip entirely
  const specHash = sha256(JSON.stringify(specIndex));
  const instructionsHash = sha256(config.instructions ?? "");
  const manifest = await readManifest(outputDir);

  if (
    !config.force &&
    manifest &&
    manifest.specHash === specHash &&
    manifest.instructionsHash === instructionsHash
  ) {
    console.log("Spec and instructions unchanged. Nothing to regenerate.");
    return;
  }

  const forceAll =
    config.force || !manifest || manifest.instructionsHash !== instructionsHash;

  if (forceAll && !config.force && manifest) {
    console.log("Instructions changed. Regenerating all sections.");
  }

  // 3. Run planning agent
  console.log("\nPlanning documentation structure...");
  const planner = createPlanningAgent(specIndex, {
    instructions: config.instructions,
    model: config.model,
  });

  const { result: plan } = await planner.run(
    "Analyze the API spec and create a documentation plan."
  );

  console.log(`Plan: ${plan.sections.length} sections`);
  for (const section of plan.sections.sort((a, b) => a.order - b.order)) {
    console.log(`  ${section.order}. ${section.title} (${section.outputPath})`);
  }

  // 4. Determine which sections need regeneration
  const sectionsToGenerate = plan.sections.filter((section) => {
    if (forceAll) return true;

    const contentHash = computeSectionHash(section, specIndex);
    const cached = manifest?.sections[section.id];

    if (cached && cached.contentHash === contentHash) {
      console.log(`  [cached] ${section.title}`);
      return false;
    }

    return true;
  });

  if (sectionsToGenerate.length === 0) {
    console.log("\nAll sections up to date. Nothing to regenerate.");
    await updateManifest(outputDir, plan, specIndex, specHash, instructionsHash);
    return;
  }

  console.log(`\nGenerating ${sectionsToGenerate.length} section(s)...`);

  // 5. Run doc writer agent for each changed section (sequentially)
  const writer = createWriterAgent(specIndex, {
    instructions: config.instructions,
    model: config.model,
  });

  const results = new Map<string, string>();

  for (const section of sectionsToGenerate.sort((a, b) => a.order - b.order)) {
    console.log(`  Writing: ${section.title}...`);

    try {
      const { result } = await writer.run({
        section,
        plan,
      });

      // Add the title heading
      const markdown = `# ${result.title}\n\n${result.markdown}`;
      results.set(section.id, markdown);
      console.log(`  Done: ${section.title}`);
    } catch (err) {
      console.error(
        `  Failed: ${section.title} - ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  // 6. Write markdown files
  for (const section of plan.sections) {
    const markdown = results.get(section.id);
    if (!markdown) continue;

    const filePath = resolve(join(outputDir, section.outputPath));
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, markdown + "\n");
    console.log(`  Wrote: ${section.outputPath}`);
  }

  // 7. Clean up orphaned files from previous plan
  if (manifest) {
    const currentPaths = new Set(plan.sections.map((s) => s.outputPath));
    for (const [id, cached] of Object.entries(manifest.sections)) {
      if (!currentPaths.has(cached.outputPath)) {
        const orphanPath = resolve(join(outputDir, cached.outputPath));
        try {
          await unlink(orphanPath);
          console.log(`  Removed orphan: ${cached.outputPath} (section "${id}" no longer in plan)`);
        } catch {
          // File might already be gone
        }
      }
    }
  }

  // 8. Update manifest
  await updateManifest(outputDir, plan, specIndex, specHash, instructionsHash);

  console.log(`\nGeneration complete. Output: ${outputDir}`);
}

async function updateManifest(
  outputDir: string,
  plan: DocPlan,
  specIndex: Awaited<ReturnType<typeof buildSpecIndex>>,
  specHash: string,
  instructionsHash: string
): Promise<void> {
  const newManifest: Manifest = {
    version: 1,
    specHash,
    instructionsHash,
    sections: {},
  };

  for (const section of plan.sections) {
    newManifest.sections[section.id] = {
      contentHash: computeSectionHash(section, specIndex),
      outputPath: section.outputPath,
      generatedAt: new Date().toISOString(),
    };
  }

  await writeManifest(outputDir, newManifest);
}
