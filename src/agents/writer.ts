import { Agent } from "@opperai/agents";
import { z } from "zod";
import type { SpecIndex } from "../spec-index.js";
import type { DocPlan, Section } from "./planner.js";
import { createSpecTools } from "../tools.js";

const SectionOutputSchema = z.object({
  markdown: z.string().describe("The complete markdown content for this section"),
  title: z.string().describe("The section title"),
});

export type SectionOutput = z.infer<typeof SectionOutputSchema>;

export interface WriterInput {
  section: Section;
  plan: DocPlan;
}

export function createWriterAgent(
  specIndex: SpecIndex,
  options: { instructions?: string; model?: string }
) {
  const tools = createSpecTools(specIndex);

  const userInstructions = options.instructions
    ? `\n\nUser instructions for documentation style:\n${options.instructions}`
    : "";

  return new Agent<WriterInput, SectionOutput>({
    name: "doc-writer",
    instructions: `You are a technical API documentation writer. Write clear, accurate markdown documentation for the given section.

Guidelines:
- Use the tools to look up endpoint details, schemas, and auth info as needed
- Include practical code examples (curl, and language examples if appropriate)
- Cross-reference related endpoints and schemas by linking to their section files
- Use tables for parameter lists and response fields
- Include request and response examples with realistic sample data
- For endpoint sections: document each endpoint with method, path, description, parameters, request body, and response
- For the overview section: include API title, description, base URL, and a quick-start guide
- For the auth section: explain each authentication method with example headers
- For the schemas section: document key models with field descriptions
- For the errors section: list common error codes with descriptions and handling advice
- Output clean, well-structured markdown
- Do NOT include a top-level heading (# Title) - it will be added automatically

The full documentation plan is provided so you can create cross-links to other sections.
When linking to other sections, use relative markdown links but with .html extensions instead of .md (e.g. if outputPath is "endpoints/pets.md", link to "endpoints/pets.html").${userInstructions}`,
    tools: tools.all,
    model: options.model,
    outputSchema: SectionOutputSchema,
    maxIterations: 10,
  });
}
