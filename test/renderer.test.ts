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
        title: "Overview",
        order: 0,
        generatedAt: new Date().toISOString(),
      },
      auth: {
        contentHash: "bbb",
        outputPath: "authentication.md",
        title: "Authentication",
        order: 1,
        generatedAt: new Date().toISOString(),
      },
      "tag:pets": {
        contentHash: "ccc",
        outputPath: "endpoints/pets.md",
        title: "Pets",
        group: "Resources",
        order: 2,
        generatedAt: new Date().toISOString(),
      },
      "tag:stores": {
        contentHash: "ddd",
        outputPath: "endpoints/stores.md",
        title: "Stores",
        group: "Resources",
        order: 3,
        generatedAt: new Date().toISOString(),
      },
      "tag:chat": {
        contentHash: "eee",
        outputPath: "endpoints/chat.md",
        title: "Chat",
        group: "Compatibility",
        order: 4,
        generatedAt: new Date().toISOString(),
      },
    },
  });

  await writeFile(join(TEST_DIR, "index.md"), "# Overview\n\nWelcome.\n\n```bash\ncurl https://api.example.com\n```\n");
  await writeFile(join(TEST_DIR, "authentication.md"), "# Authentication\n\nUse Bearer tokens.\n");
  await writeFile(join(TEST_DIR, "endpoints/pets.md"), "# Pets\n\n`GET /pets`\n");
  await writeFile(join(TEST_DIR, "endpoints/stores.md"), "# Stores\n\n`GET /stores`\n");
  await writeFile(join(TEST_DIR, "endpoints/chat.md"), "# Chat\n\n`POST /chat`\n");
});

afterAll(async () => {
  await rm(TEST_DIR, { recursive: true, force: true });
});

describe("renderSite", () => {
  it("creates HTML files for each section", async () => {
    const siteDir = await renderSite(TEST_DIR);
    const indexHtml = await readFile(join(siteDir, "index.html"), "utf-8");
    const petsHtml = await readFile(join(siteDir, "endpoints/pets.html"), "utf-8");

    expect(indexHtml).toContain("<!DOCTYPE html>");
    expect(indexHtml).toContain("Welcome.");
    expect(petsHtml).toContain("Pets");
  });

  it("generates navigation with active state", async () => {
    const siteDir = await renderSite(TEST_DIR);
    const indexHtml = await readFile(join(siteDir, "index.html"), "utf-8");

    expect(indexHtml).toContain('class="active"');
    expect(indexHtml).toContain("index.html");
  });

  it("renders nav groups for grouped sections", async () => {
    const siteDir = await renderSite(TEST_DIR);
    const indexHtml = await readFile(join(siteDir, "index.html"), "utf-8");

    expect(indexHtml).toContain("nav-group-label");
    expect(indexHtml).toContain("Resources");
    expect(indexHtml).toContain("Compatibility");
  });

  it("keeps ungrouped sections as top-level nav items", async () => {
    const siteDir = await renderSite(TEST_DIR);
    const indexHtml = await readFile(join(siteDir, "index.html"), "utf-8");

    // Overview and Authentication should be direct links, not inside a group
    // Find the Overview link - it should be a direct child of the top-level ul
    const overviewLink = indexHtml.match(/<li[^>]*><a[^>]*>Overview<\/a><\/li>/);
    expect(overviewLink).toBeTruthy();
  });

  it("creates a style.css file with group styles", async () => {
    const siteDir = await renderSite(TEST_DIR);
    const css = await readFile(join(siteDir, "style.css"), "utf-8");

    expect(css).toContain(".nav-group");
    expect(css).toContain(".nav-group-label");
  });

  it("applies syntax highlighting to code blocks", async () => {
    const siteDir = await renderSite(TEST_DIR);
    const indexHtml = await readFile(join(siteDir, "index.html"), "utf-8");

    expect(indexHtml).toContain("shiki");
  });

  it("handles relative paths for nested pages", async () => {
    const siteDir = await renderSite(TEST_DIR);
    const petsHtml = await readFile(join(siteDir, "endpoints/pets.html"), "utf-8");

    expect(petsHtml).toContain("../style.css");
    expect(petsHtml).toContain("../index.html");
  });
});
