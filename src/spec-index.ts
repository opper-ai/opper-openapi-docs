import SwaggerParser from "@apidevtools/swagger-parser";
import type { OpenAPI, OpenAPIV3 } from "openapi-types";

export interface EndpointInfo {
  path: string;
  method: string;
  operation: OpenAPIV3.OperationObject;
}

export interface SpecIndex {
  info: OpenAPIV3.InfoObject;
  servers: OpenAPIV3.ServerObject[];
  tags: OpenAPIV3.TagObject[];
  security: Record<string, OpenAPIV3.SecuritySchemeObject>;
  pathsByTag: Map<string, EndpointInfo[]>;
  schemas: Map<string, OpenAPIV3.SchemaObject>;
}

function isV3Document(doc: OpenAPI.Document): doc is OpenAPIV3.Document {
  return "openapi" in doc;
}

export async function buildSpecIndex(specPath: string): Promise<SpecIndex> {
  const doc = await SwaggerParser.dereference(specPath);

  if (!isV3Document(doc)) {
    throw new Error(
      "Only OpenAPI 3.0/3.1 specs are supported. Swagger 2.0 is not supported."
    );
  }

  const info = doc.info;
  const servers = doc.servers ?? [];
  const tags = doc.tags ?? [];

  // Extract security schemes
  const security: Record<string, OpenAPIV3.SecuritySchemeObject> = {};
  const securitySchemes = doc.components?.securitySchemes ?? {};
  for (const [name, scheme] of Object.entries(securitySchemes)) {
    // After dereference, all $refs are resolved
    security[name] = scheme as OpenAPIV3.SecuritySchemeObject;
  }

  // Group endpoints by tag
  const pathsByTag = new Map<string, EndpointInfo[]>();
  const paths = doc.paths ?? {};

  for (const [path, pathItem] of Object.entries(paths)) {
    if (!pathItem) continue;

    const methods = [
      "get",
      "post",
      "put",
      "delete",
      "patch",
      "options",
      "head",
    ] as const;

    for (const method of methods) {
      const operation = (pathItem as Record<string, unknown>)[
        method
      ] as OpenAPIV3.OperationObject | undefined;
      if (!operation) continue;

      const endpoint: EndpointInfo = { path, method, operation };
      const operationTags =
        operation.tags && operation.tags.length > 0
          ? operation.tags
          : ["untagged"];

      for (const tag of operationTags) {
        const existing = pathsByTag.get(tag) ?? [];
        existing.push(endpoint);
        pathsByTag.set(tag, existing);
      }
    }
  }

  // Extract schemas
  const schemas = new Map<string, OpenAPIV3.SchemaObject>();
  const componentSchemas = doc.components?.schemas ?? {};
  for (const [name, schema] of Object.entries(componentSchemas)) {
    schemas.set(name, schema as OpenAPIV3.SchemaObject);
  }

  return { info, servers, tags, security, pathsByTag, schemas };
}
