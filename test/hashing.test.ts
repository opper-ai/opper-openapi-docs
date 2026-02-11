import { describe, it, expect } from "vitest";
import { buildSpecIndex } from "../src/spec-index.js";
import { computeSectionHash } from "../src/hashing.js";
import type { Section } from "../src/agents/planner.js";
import { resolve } from "path";

const FIXTURE = resolve(import.meta.dirname, "fixtures/petstore.yaml");

function makeSection(overrides: Partial<Section>): Section {
  return {
    id: "test",
    title: "Test",
    outputPath: "test.md",
    type: "overview",
    description: "Test section",
    order: 0,
    ...overrides,
  };
}

describe("computeSectionHash", () => {
  it("produces consistent hashes for overview", async () => {
    const index = await buildSpecIndex(FIXTURE);
    const section = makeSection({ type: "overview" });
    const hash1 = computeSectionHash(section, index);
    const hash2 = computeSectionHash(section, index);
    expect(hash1).toBe(hash2);
  });

  it("produces different hashes for different section types", async () => {
    const index = await buildSpecIndex(FIXTURE);
    const overview = computeSectionHash(makeSection({ type: "overview" }), index);
    const auth = computeSectionHash(makeSection({ type: "auth" }), index);
    const schemas = computeSectionHash(makeSection({ type: "schemas" }), index);
    expect(overview).not.toBe(auth);
    expect(overview).not.toBe(schemas);
    expect(auth).not.toBe(schemas);
  });

  it("produces different hashes for different tags", async () => {
    const index = await buildSpecIndex(FIXTURE);
    const pets = computeSectionHash(
      makeSection({ type: "endpoint-group", relatedTags: ["pets"] }),
      index
    );
    const store = computeSectionHash(
      makeSection({ type: "endpoint-group", relatedTags: ["store"] }),
      index
    );
    expect(pets).not.toBe(store);
  });

  it("includes referenced schemas in endpoint-group hash", async () => {
    const index = await buildSpecIndex(FIXTURE);
    const withSchemas = computeSectionHash(
      makeSection({
        type: "endpoint-group",
        relatedTags: ["pets"],
        relatedSchemas: ["Pet"],
      }),
      index
    );
    const withoutSchemas = computeSectionHash(
      makeSection({
        type: "endpoint-group",
        relatedTags: ["pets"],
      }),
      index
    );
    expect(withSchemas).not.toBe(withoutSchemas);
  });
});
