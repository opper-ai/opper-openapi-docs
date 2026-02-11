import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { renderSite } from "../src/renderer.js";
import { writeManifest } from "../src/manifest.js";
import { writeFile, mkdir, readFile, rm } from "fs/promises";
import { resolve, join } from "path";
import { tmpdir } from "os";

const TEST_DIR = resolve(join(tmpdir(), "opper-docs-renderer-test"));

beforeAll(async () => {
  await mkdir(join(TEST_DIR, "endpoints"), { recursive: true });

  await writeManifest(TEST_DIR, {
    version: 1,
    specHash: "abc",
    instructionsHash: "def",
    sections: {
      overview: {
        contentHash: "aaa",
        outputPath: "index.md",
        generatedAt: new Date().toISOString(),
      },
      "tag:pets": {
        contentHash: "bbb",
        outputPath: "endpoints/pets.md",
        generatedAt: new Date().toISOString(),
      },
    },
  });

  await writeFile(
    join(TEST_DIR, "index.md"),
    "# Overview\n\nWelcome to the API.\n\n```bash\ncurl https://api.example.com\n```\n"
  );
  await writeFile(
    join(TEST_DIR, "endpoints/pets.md"),
    "# Pets\n\n## List Pets\n\n`GET /pets`\n\nReturns all pets.\n"
  );
});

afterAll(async () => {
  await rm(TEST_DIR, { recursive: true, force: true });
});

describe("renderSite", () => {
  it("creates HTML files for each section", async () => {
    const siteDir = await renderSite(TEST_DIR);
    const indexHtml = await readFile(join(siteDir, "index.html"), "utf-8");
    const petsHtml = await readFile(
      join(siteDir, "endpoints/pets.html"),
      "utf-8"
    );

    expect(indexHtml).toContain("<!DOCTYPE html>");
    expect(indexHtml).toContain("Welcome to the API.");
    expect(petsHtml).toContain("List Pets");
  });

  it("generates navigation with active state", async () => {
    const siteDir = await renderSite(TEST_DIR);
    const indexHtml = await readFile(join(siteDir, "index.html"), "utf-8");

    expect(indexHtml).toContain('class="active"');
    expect(indexHtml).toContain("index.html");
    expect(indexHtml).toContain("endpoints/pets.html");
  });

  it("creates a style.css file", async () => {
    const siteDir = await renderSite(TEST_DIR);
    const css = await readFile(join(siteDir, "style.css"), "utf-8");

    expect(css).toContain(".sidebar");
    expect(css).toContain(".content");
  });

  it("applies syntax highlighting to code blocks", async () => {
    const siteDir = await renderSite(TEST_DIR);
    const indexHtml = await readFile(join(siteDir, "index.html"), "utf-8");

    // Shiki wraps code in a div with class "shiki"
    expect(indexHtml).toContain("shiki");
  });

  it("handles relative paths for nested pages", async () => {
    const siteDir = await renderSite(TEST_DIR);
    const petsHtml = await readFile(
      join(siteDir, "endpoints/pets.html"),
      "utf-8"
    );

    // Nested pages should use ../ to reference root assets
    expect(petsHtml).toContain("../style.css");
    expect(petsHtml).toContain("../index.html");
  });
});
