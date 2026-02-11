import { Agent } from "@opperai/agents";
import { z } from "zod";
import type { SpecIndex } from "../spec-index.js";
import { createSpecTools } from "../tools.js";

const SectionSchema = z.object({
  id: z.string().describe("Unique section identifier, e.g. 'overview', 'auth', 'tag:users'"),
  title: z.string().describe("Human-readable section title"),
  outputPath: z.string().describe("Relative file path, e.g. 'index.md', 'endpoints/users.md'"),
  type: z.enum(["overview", "auth", "endpoint-group", "schemas", "errors"]),
  description: z.string().describe("Brief description of what this section should cover"),
  relatedTags: z.array(z.string()).optional().describe("Tags this section depends on"),
  relatedSchemas: z.array(z.string()).optional().describe("Schema names this section depends on"),
  order: z.number().describe("Display order in navigation"),
});

const DocPlanSchema = z.object({
  sections: z.array(SectionSchema),
});

export type DocPlan = z.infer<typeof DocPlanSchema>;
export type Section = z.infer<typeof SectionSchema>;

export function createPlanningAgent(
  specIndex: SpecIndex,
  options: { instructions?: string; model?: string }
) {
  const tools = createSpecTools(specIndex);

  const userInstructions = options.instructions
    ? `\n\nUser instructions for documentation style:\n${options.instructions}`
    : "";

  return new Agent<string, DocPlan>({
    name: "doc-planner",
    instructions: `You are an API documentation architect. Analyze the OpenAPI spec using the available tools and decide the optimal documentation structure.

Rules:
- Always include an "overview" section first (outputPath: "index.md", order: 0)
- Include an "authentication" section if security schemes exist (outputPath: "authentication.md")
- Create one "endpoint-group" section per tag, using outputPath: "endpoints/{tag-slug}.md"
- Group untagged endpoints under a section with relatedTags: ["untagged"]
- Include a "schemas" section if there are schemas (outputPath: "schemas.md")
- Include an "errors" section if endpoints define error responses (outputPath: "errors.md")
- Each section must declare its relatedTags and relatedSchemas so we can compute content hashes
- For endpoint-group sections, set relatedTags to the tag name and relatedSchemas to schemas referenced by those endpoints
- Use lowercase kebab-case for file paths
- Order sections logically: overview first, then auth, then endpoint groups alphabetically, then schemas, then errors

Use the tools to explore the spec before deciding on the structure.${userInstructions}`,
    tools: tools.all,
    model: options.model,
    outputSchema: DocPlanSchema,
    maxIterations: 10,
  });
}
