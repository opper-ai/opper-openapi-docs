import { sha256 } from "./manifest.js";
import type { SpecIndex } from "./spec-index.js";
import type { Section } from "./agents/planner.js";

/**
 * Compute a deterministic content hash for a section based on its type
 * and declared dependencies. Used to determine if a section needs regeneration.
 */
export function computeSectionHash(
  section: Section,
  specIndex: SpecIndex
): string {
  const parts: unknown[] = [];

  switch (section.type) {
    case "overview":
      parts.push(specIndex.info);
      parts.push(specIndex.servers);
      parts.push(specIndex.tags.map((t) => ({ name: t.name, description: t.description })));
      break;

    case "auth":
      parts.push(specIndex.security);
      break;

    case "endpoint-group": {
      const tags = section.relatedTags ?? [];
      for (const tag of tags.toSorted()) {
        parts.push({ tag, endpoints: specIndex.pathsByTag.get(tag) ?? [] });
      }
      const schemas = section.relatedSchemas ?? [];
      for (const name of schemas.toSorted()) {
        parts.push({ schema: name, definition: specIndex.schemas.get(name) });
      }
      break;
    }

    case "schemas": {
      const entries = Array.from(specIndex.schemas.entries()).sort(([a], [b]) =>
        a.localeCompare(b)
      );
      parts.push(entries);
      break;
    }

    case "errors": {
      // Collect all error responses across all endpoints
      const errorResponses: unknown[] = [];
      for (const [, endpoints] of specIndex.pathsByTag) {
        for (const endpoint of endpoints) {
          const responses = endpoint.operation.responses ?? {};
          for (const [code, response] of Object.entries(responses)) {
            if (code.startsWith("4") || code.startsWith("5")) {
              errorResponses.push({ path: endpoint.path, method: endpoint.method, code, response });
            }
          }
        }
      }
      errorResponses.sort((a, b) =>
        JSON.stringify(a).localeCompare(JSON.stringify(b))
      );
      parts.push(errorResponses);
      break;
    }
  }

  return sha256(JSON.stringify(parts));
}
