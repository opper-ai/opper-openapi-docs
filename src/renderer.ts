import { readFile, writeFile, mkdir, cp } from "fs/promises";
import { resolve, join, dirname, relative } from "path";
import { Marked } from "marked";
import { createHighlighter } from "shiki";
import type { Manifest } from "./manifest.js";

interface NavItem {
  title: string;
  href: string;
  active?: boolean;
}

export async function renderSite(docsDir: string): Promise<string> {
  const siteDir = resolve(join(docsDir, "_site"));
  await mkdir(siteDir, { recursive: true });

  // Read manifest to get section order
  const manifestPath = resolve(join(docsDir, ".openapi-docs-manifest.json"));
  const manifest: Manifest = JSON.parse(await readFile(manifestPath, "utf-8"));

  // Build navigation from manifest sections sorted by the file structure
  const sections = Object.entries(manifest.sections)
    .sort(([, a], [, b]) => a.outputPath.localeCompare(b.outputPath))
    .map(([id, sec]) => ({ id, ...sec }));

  // Put index first
  sections.sort((a, b) => {
    if (a.outputPath === "index.md") return -1;
    if (b.outputPath === "index.md") return 1;
    return 0;
  });

  // Set up markdown renderer with shiki
  const highlighter = await createHighlighter({
    themes: ["github-light"],
    langs: [
      "bash",
      "json",
      "javascript",
      "typescript",
      "python",
      "http",
      "shell",
      "yaml",
      "go",
    ],
  });

  const marked = new Marked({
    renderer: {
      code({ text, lang }) {
        const language = lang || "text";
        try {
          return highlighter.codeToHtml(text, {
            lang: language,
            theme: "github-light",
          });
        } catch {
          // Unsupported language, fall back to plain
          return `<pre><code class="language-${language}">${escapeHtml(text)}</code></pre>`;
        }
      },
    },
  });

  // Render each section
  for (const section of sections) {
    const mdPath = resolve(join(docsDir, section.outputPath));
    const mdContent = await readFile(mdPath, "utf-8");
    const htmlContent = await marked.parse(mdContent);

    // Extract title from first H1
    const titleMatch = mdContent.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1] : section.id;

    // Build nav for this page
    const htmlPath = section.outputPath.replace(/\.md$/, ".html");
    const nav = buildNav(sections, htmlPath);

    // Build relative path to root for asset references
    const depth = htmlPath.split("/").length - 1;
    const rootPath = depth > 0 ? "../".repeat(depth) : "./";

    const fullHtml = template(title, htmlContent, nav, rootPath);

    const outPath = resolve(join(siteDir, htmlPath));
    await mkdir(dirname(outPath), { recursive: true });
    await writeFile(outPath, fullHtml);
  }

  // Write CSS
  await writeFile(resolve(join(siteDir, "style.css")), CSS);

  highlighter.dispose();

  const pageCount = sections.length;
  console.log(`  Static site: ${pageCount} pages → ${siteDir}`);
  return siteDir;
}

function buildNav(
  sections: Array<{ id: string; outputPath: string }>,
  currentPath: string
): NavItem[] {
  return sections.map((sec) => {
    const href = sec.outputPath.replace(/\.md$/, ".html");
    // Extract display name from outputPath
    const name = sec.outputPath
      .replace(/\.md$/, "")
      .replace(/^endpoints\//, "")
      .replace(/^index$/, "Overview");
    const title = name.charAt(0).toUpperCase() + name.slice(1);
    return { title, href, active: href === currentPath };
  });
}

function template(
  title: string,
  content: string,
  nav: NavItem[],
  rootPath: string
): string {
  const navHtml = nav
    .map((item) => {
      const cls = item.active ? ' class="active"' : "";
      return `<li${cls}><a href="${rootPath}${item.href}">${item.title}</a></li>`;
    })
    .join("\n          ");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <link rel="stylesheet" href="${rootPath}style.css">
</head>
<body>
  <div class="layout">
    <nav class="sidebar">
      <div class="sidebar-header">
        <a href="${rootPath}index.html" class="logo">API Docs</a>
      </div>
      <ul>
          ${navHtml}
      </ul>
    </nav>
    <main class="content">
      <article>
        ${content}
      </article>
    </main>
  </div>
</body>
</html>
`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const CSS = `/* opper-openapi-docs */
:root {
  --sidebar-width: 240px;
  --content-max: 800px;
  --color-bg: #ffffff;
  --color-sidebar-bg: #f8f9fa;
  --color-border: #e1e4e8;
  --color-text: #24292e;
  --color-text-secondary: #586069;
  --color-link: #0366d6;
  --color-active: #0366d6;
  --color-active-bg: #f0f4ff;
  --color-code-bg: #f6f8fa;
  --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
  --font-mono: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
}

* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: var(--font-sans);
  color: var(--color-text);
  line-height: 1.6;
  background: var(--color-bg);
}

.layout {
  display: flex;
  min-height: 100vh;
}

/* Sidebar */
.sidebar {
  width: var(--sidebar-width);
  background: var(--color-sidebar-bg);
  border-right: 1px solid var(--color-border);
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  overflow-y: auto;
  padding: 1rem 0;
}

.sidebar-header {
  padding: 0 1rem 1rem;
  border-bottom: 1px solid var(--color-border);
  margin-bottom: 0.5rem;
}

.logo {
  font-weight: 700;
  font-size: 1.1rem;
  color: var(--color-text);
  text-decoration: none;
}

.sidebar ul {
  list-style: none;
}

.sidebar li a {
  display: block;
  padding: 0.35rem 1rem;
  color: var(--color-text-secondary);
  text-decoration: none;
  font-size: 0.875rem;
  border-left: 3px solid transparent;
}

.sidebar li a:hover {
  color: var(--color-text);
  background: var(--color-active-bg);
}

.sidebar li.active a {
  color: var(--color-active);
  border-left-color: var(--color-active);
  background: var(--color-active-bg);
  font-weight: 500;
}

/* Content */
.content {
  margin-left: var(--sidebar-width);
  flex: 1;
  padding: 2rem 3rem;
  max-width: calc(var(--content-max) + 6rem);
}

article h1 {
  font-size: 2rem;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--color-border);
}

article h2 {
  font-size: 1.5rem;
  margin-top: 2rem;
  margin-bottom: 0.75rem;
}

article h3 {
  font-size: 1.15rem;
  margin-top: 1.5rem;
  margin-bottom: 0.5rem;
}

article h4 {
  font-size: 1rem;
  margin-top: 1.25rem;
  margin-bottom: 0.5rem;
}

article p {
  margin-bottom: 1rem;
}

article a {
  color: var(--color-link);
  text-decoration: none;
}

article a:hover {
  text-decoration: underline;
}

article ul, article ol {
  margin-bottom: 1rem;
  padding-left: 1.5rem;
}

article li {
  margin-bottom: 0.25rem;
}

/* Code */
article code {
  font-family: var(--font-mono);
  font-size: 0.875em;
  background: var(--color-code-bg);
  padding: 0.15em 0.35em;
  border-radius: 3px;
}

article pre {
  margin-bottom: 1rem;
  border-radius: 6px;
  overflow-x: auto;
}

article pre code {
  background: none;
  padding: 0;
}

/* Shiki code blocks */
article .shiki {
  padding: 1rem;
  border-radius: 6px;
  font-size: 0.85rem;
  line-height: 1.5;
  overflow-x: auto;
}

/* Tables */
article table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 1rem;
  font-size: 0.9rem;
}

article th, article td {
  text-align: left;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--color-border);
}

article th {
  background: var(--color-code-bg);
  font-weight: 600;
}

article tr:nth-child(even) {
  background: var(--color-sidebar-bg);
}

/* Blockquotes */
article blockquote {
  border-left: 3px solid var(--color-border);
  padding: 0.5rem 1rem;
  margin-bottom: 1rem;
  color: var(--color-text-secondary);
}

/* Responsive */
@media (max-width: 768px) {
  .sidebar {
    position: static;
    width: 100%;
    border-right: none;
    border-bottom: 1px solid var(--color-border);
  }

  .sidebar ul {
    display: flex;
    flex-wrap: wrap;
    gap: 0;
  }

  .sidebar li a {
    border-left: none;
    border-bottom: 2px solid transparent;
    padding: 0.5rem 0.75rem;
  }

  .sidebar li.active a {
    border-left: none;
    border-bottom-color: var(--color-active);
  }

  .layout {
    flex-direction: column;
  }

  .content {
    margin-left: 0;
    padding: 1.5rem 1rem;
  }
}
`;
