import { createFunctionTool } from "@opperai/agents";
import { z } from "zod";
import type { SpecIndex } from "./spec-index.js";

export function createSpecTools(specIndex: SpecIndex) {
  const listTagsTool = createFunctionTool(
    () =>
      specIndex.tags.map((t) => ({
        name: t.name,
        description: t.description ?? "",
      })),
    {
      name: "list_tags",
      description: "List all API tags with descriptions",
      schema: z.object({}),
    }
  );

  const readEndpointsTool = createFunctionTool(
    (input: { tag: string }) => {
      const endpoints = specIndex.pathsByTag.get(input.tag) ?? [];
      return endpoints;
    },
    {
      name: "read_endpoints",
      description:
        "Get all endpoints for a given tag with full request/response details. Use 'untagged' for endpoints without tags.",
      schema: z.object({ tag: z.string() }),
    }
  );

  const readSchemaTool = createFunctionTool(
    (input: { name: string }) => specIndex.schemas.get(input.name) ?? null,
    {
      name: "read_schema",
      description:
        "Get a schema definition by name with all $refs resolved",
      schema: z.object({ name: z.string() }),
    }
  );

  const listSchemasTool = createFunctionTool(
    () => Array.from(specIndex.schemas.keys()),
    {
      name: "list_schemas",
      description: "List all available schema names",
      schema: z.object({}),
    }
  );

  const readSecurityTool = createFunctionTool(
    () => specIndex.security,
    {
      name: "read_security",
      description: "Get all security/authentication schemes",
      schema: z.object({}),
    }
  );

  const readSpecInfoTool = createFunctionTool(
    () => ({
      info: specIndex.info,
      servers: specIndex.servers,
    }),
    {
      name: "read_spec_info",
      description:
        "Get API metadata: title, version, description, servers",
      schema: z.object({}),
    }
  );

  return {
    listTagsTool,
    readEndpointsTool,
    readSchemaTool,
    listSchemasTool,
    readSecurityTool,
    readSpecInfoTool,
    all: [
      listTagsTool,
      readEndpointsTool,
      readSchemaTool,
      listSchemasTool,
      readSecurityTool,
      readSpecInfoTool,
    ],
  };
}
