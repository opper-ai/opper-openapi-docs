import { readFile, writeFile, mkdir, copyFile } from "fs/promises";
import { resolve, join, dirname } from "path";
import { Marked } from "marked";
import { createHighlighter } from "shiki";
import type { Manifest } from "./manifest.js";

export interface SiteConfig {
  title?: string;
  icon?: string;
}

interface Heading {
  level: number;
  text: string;
  slug: string;
}

interface NavItem {
  title: string;
  href: string;
  active?: boolean;
  toc?: Heading[];
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

type NavEntry = NavItem | NavGroup;

function isGroup(entry: NavEntry): entry is NavGroup {
  return "items" in entry;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

function extractHeadings(markdown: string): Heading[] {
  const headings: Heading[] = [];
  // Match ## and ### headings (not # which is the page title)
  const regex = /^(#{2,3})\s+(.+)$/gm;
  let match;
  while ((match = regex.exec(markdown)) !== null) {
    headings.push({
      level: match[1].length,
      text: match[2].replace(/`/g, ""),
      slug: slugify(match[2]),
    });
  }
  return headings;
}

export async function renderSite(docsDir: string): Promise<string> {
  const siteDir = resolve(join(docsDir, "_site"));
  await mkdir(siteDir, { recursive: true });

  // Read manifest to get section order and groups
  const manifestPath = resolve(join(docsDir, ".openapi-docs-manifest.json"));
  const manifest: Manifest = JSON.parse(await readFile(manifestPath, "utf-8"));

  const sections = Object.entries(manifest.sections)
    .map(([id, sec]) => ({ id, ...sec }))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  // Read optional site config for branding
  let siteConfig: SiteConfig = {};
  try {
    const raw = await readFile(resolve(join(docsDir, ".openapi-docs-site.json")), "utf-8");
    siteConfig = JSON.parse(raw);
  } catch {
    // No site config, use defaults
  }

  // Set up markdown renderer with shiki + heading IDs
  const highlighter = await createHighlighter({
    themes: ["github-light", "github-dark"],
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
      heading({ text, depth }) {
        const slug = slugify(text.replace(/<[^>]*>/g, ""));
        return `<h${depth} id="${slug}">${text}</h${depth}>\n`;
      },
      link({ href, text }) {
        // Rewrite relative .md links to .html for the static site
        const rewritten = href.replace(/\.md(#|$)/g, ".html$1");
        return `<a href="${rewritten}">${text}</a>`;
      },
      code({ text, lang }) {
        const language = lang || "text";
        try {
          return highlighter.codeToHtml(text, {
            lang: language,
            themes: { light: "github-light", dark: "github-dark" },
            defaultColor: "light",
          });
        } catch {
          return `<pre><code class="language-${language}">${escapeHtml(text)}</code></pre>`;
        }
      },
    },
  });

  // First pass: read all markdown and extract headings per section
  const sectionData = new Map<
    string,
    { mdContent: string; headings: Heading[]; title: string; htmlPath: string }
  >();

  for (const section of sections) {
    const mdPath = resolve(join(docsDir, section.outputPath));
    const mdContent = await readFile(mdPath, "utf-8");
    const headings = extractHeadings(mdContent);
    const titleMatch = mdContent.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1] : section.id;
    const htmlPath = section.outputPath.replace(/\.md$/, ".html");
    sectionData.set(section.id, { mdContent, headings, title, htmlPath });
  }

  // Copy icon if provided
  if (siteConfig.icon) {
    const iconSrc = resolve(siteConfig.icon);
    const iconFilename = siteConfig.icon.split("/").pop()!;
    await copyFile(iconSrc, resolve(join(siteDir, iconFilename)));
    siteConfig.icon = iconFilename;
  }

  // Render each section
  for (const section of sections) {
    const data = sectionData.get(section.id)!;
    const htmlContent = await marked.parse(data.mdContent);

    const nav = buildNav(sections, data.htmlPath, sectionData);

    const depth = data.htmlPath.split("/").length - 1;
    const rootPath = depth > 0 ? "../".repeat(depth) : "./";

    const fullHtml = template(data.title, htmlContent, nav, rootPath, siteConfig);

    const outPath = resolve(join(siteDir, data.htmlPath));
    await mkdir(dirname(outPath), { recursive: true });
    await writeFile(outPath, fullHtml);
  }

  // Write CSS
  await writeFile(resolve(join(siteDir, "style.css")), CSS);

  // Generate llms.txt files and copy markdown sources
  await generateLlmsTxt(siteDir, sections, sectionData, siteConfig);

  highlighter.dispose();

  console.log(`  Static site: ${sections.length} pages → ${siteDir}`);
  return siteDir;
}

function buildNav(
  sections: Array<{
    id: string;
    outputPath: string;
    title: string;
    group?: string;
  }>,
  currentPath: string,
  sectionData: Map<
    string,
    { headings: Heading[]; htmlPath: string }
  >
): NavEntry[] {
  const entries: NavEntry[] = [];
  const groups = new Map<string, NavItem[]>();

  for (const sec of sections) {
    const data = sectionData.get(sec.id)!;
    const isActive = data.htmlPath === currentPath;
    const item: NavItem = {
      title: sec.title,
      href: data.htmlPath,
      active: isActive,
      toc: isActive ? data.headings : undefined,
    };

    if (sec.group) {
      let group = groups.get(sec.group);
      if (!group) {
        group = [];
        groups.set(sec.group, group);
        entries.push({ label: sec.group, items: group });
      }
      group.push(item);
    } else {
      entries.push(item);
    }
  }

  return entries;
}

function renderToc(headings: Heading[]): string {
  return headings
    .map((h) => {
      const indent = h.level === 3 ? " toc-h3" : "";
      return `<li class="toc-item${indent}"><a href="#${h.slug}">${escapeHtml(h.text)}</a></li>`;
    })
    .join("\n              ");
}

function renderNavItem(item: NavItem, rootPath: string): string {
  const cls = item.active ? ' class="active"' : "";
  let html = `<li${cls}><a href="${rootPath}${item.href}">${escapeHtml(item.title)}</a>`;
  if (item.toc && item.toc.length > 0) {
    html += `\n            <ul class="toc">\n              ${renderToc(item.toc)}\n            </ul>`;
  }
  html += `</li>`;
  return html;
}

function renderNav(entries: NavEntry[], rootPath: string): string {
  return entries
    .map((entry) => {
      if (isGroup(entry)) {
        const items = entry.items
          .map((item) => renderNavItem(item, rootPath))
          .join("\n            ");
        return `<li class="nav-group">
          <span class="nav-group-label">${escapeHtml(entry.label)}</span>
          <ul>
            ${items}
          </ul>
        </li>`;
      }
      return renderNavItem(entry, rootPath);
    })
    .join("\n          ");
}

function template(
  title: string,
  content: string,
  nav: NavEntry[],
  rootPath: string,
  siteConfig: SiteConfig = {}
): string {
  const navHtml = renderNav(nav, rootPath);
  const siteTitle = siteConfig.title ?? "API Docs";
  const iconHtml = siteConfig.icon
    ? `<img src="${rootPath}${escapeHtml(siteConfig.icon)}" alt="" class="logo-icon"> `
    : "";

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
        <a href="${rootPath}index.html" class="logo">${iconHtml}${escapeHtml(siteTitle)}</a>
      </div>
      <ul>
          ${navHtml}
      </ul>
      <div class="sidebar-footer">
        <span class="sidebar-footer-label">For AI Agents</span>
        <a href="${rootPath}llms.txt">llms.txt</a>
        <a href="${rootPath}llms-full.txt">llms-full.txt</a>
      </div>
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

async function generateLlmsTxt(
  siteDir: string,
  sections: Array<{ id: string; outputPath: string; title: string; group?: string; order?: number }>,
  sectionData: Map<string, { mdContent: string; headings: Heading[]; title: string; htmlPath: string }>,
  siteConfig: SiteConfig
): Promise<void> {
  const siteTitle = siteConfig.title ?? "API Docs";

  // Copy .md files into site dir so llms.txt links resolve
  for (const section of sections) {
    const data = sectionData.get(section.id)!;
    const mdOutPath = resolve(join(siteDir, section.outputPath));
    await mkdir(dirname(mdOutPath), { recursive: true });
    await writeFile(mdOutPath, data.mdContent);
  }

  // Build llms.txt — index with links
  const llmsLines: string[] = [`# ${siteTitle}`, ""];
  const firstSection = sections[0];
  if (firstSection) {
    const firstData = sectionData.get(firstSection.id)!;
    const firstParagraph = firstData.mdContent.match(/^(?!#)(.+)$/m);
    if (firstParagraph) {
      llmsLines.push(`> ${firstParagraph[1].trim()}`, "");
    }
  }
  llmsLines.push("## Docs", "");
  for (const section of sections) {
    const data = sectionData.get(section.id)!;
    llmsLines.push(`- [${data.title}](${section.outputPath}): ${section.title}`);
  }
  llmsLines.push("");
  await writeFile(resolve(join(siteDir, "llms.txt")), llmsLines.join("\n"));

  // Build llms-full.txt — all content concatenated
  const fullLines: string[] = [`# ${siteTitle}`, ""];
  for (const section of sections) {
    const data = sectionData.get(section.id)!;
    // Strip the H1 title from each section since we have our own
    const contentWithoutH1 = data.mdContent.replace(/^#\s+.+\n+/, "");
    fullLines.push(`## ${data.title}`, "", contentWithoutH1.trim(), "", "---", "");
  }
  await writeFile(resolve(join(siteDir, "llms-full.txt")), fullLines.join("\n"));
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
  --sidebar-width: 260px;
  --content-max: 800px;
  --color-bg: #ffffff;
  --color-sidebar-bg: #f8f9fa;
  --color-border: #e1e4e8;
  --color-text: #24292e;
  --color-text-secondary: #586069;
  --color-text-muted: #8b949e;
  --color-toc-bg: #f0f4f8;
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
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.logo-icon {
  height: 24px;
  width: auto;
}

.sidebar > ul {
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

.sidebar li.active > a {
  color: var(--color-active);
  border-left-color: var(--color-active);
  background: var(--color-active-bg);
  font-weight: 500;
}

/* Nav groups */
.nav-group {
  margin-top: 0.75rem;
}

.nav-group-label {
  display: block;
  padding: 0.25rem 1rem;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-muted);
}

.nav-group > ul {
  list-style: none;
}

.nav-group li a {
  padding-left: 1.25rem;
}

/* Table of contents (on-page headings) */
.toc {
  list-style: none;
  margin: 0;
  padding: 0 0 0.25rem 0;
}

.toc-item a {
  padding: 0.15rem 1rem 0.15rem 1.5rem !important;
  font-size: 0.8rem !important;
  color: var(--color-text-muted) !important;
  border-left-color: transparent !important;
  font-weight: 400 !important;
}

.toc {
  background: var(--color-toc-bg);
  border-radius: 0;
  margin: 0 0 0.25rem 0;
  padding: 0.4rem 0 !important;
  border-bottom: 1px solid var(--color-border);
}

.toc-item.toc-h3 a {
  padding-left: 2rem !important;
}

.toc-item a:hover {
  color: var(--color-text-secondary) !important;
  background: none !important;
}

/* Sidebar footer (llms.txt links) */
.sidebar-footer {
  margin-top: 1.5rem;
  padding: 0.75rem 1rem 0;
  border-top: 1px solid var(--color-border);
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
}

.sidebar-footer-label {
  width: 100%;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-muted);
}

.sidebar-footer a {
  font-size: 0.75rem;
  font-family: var(--font-mono);
  color: var(--color-text-muted);
  text-decoration: none;
  padding: 0.2rem 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background: var(--color-bg);
}

.sidebar-footer a:hover {
  color: var(--color-text-secondary);
  border-color: var(--color-text-muted);
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
  background: var(--color-code-bg) !important;
  border: 1px solid var(--color-border);
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

/* Dark mode */
@media (prefers-color-scheme: dark) {
  :root {
    --color-bg: #0d1117;
    --color-sidebar-bg: #161b22;
    --color-border: #30363d;
    --color-text: #e6edf3;
    --color-text-secondary: #8b949e;
    --color-text-muted: #6e7681;
    --color-toc-bg: #1c2028;
    --color-link: #58a6ff;
    --color-active: #58a6ff;
    --color-active-bg: #1c2333;
    --color-code-bg: #161b22;
  }

  article .shiki,
  article .shiki span {
    color: var(--shiki-dark) !important;
    background-color: var(--shiki-dark-bg) !important;
  }

  article .shiki {
    background: var(--color-code-bg) !important;
  }
}

/* Responsive */
@media (max-width: 768px) {
  .sidebar {
    position: static;
    width: 100%;
    border-right: none;
    border-bottom: 1px solid var(--color-border);
  }

  .sidebar > ul {
    display: flex;
    flex-wrap: wrap;
    gap: 0;
  }

  .toc {
    display: none;
  }

  .nav-group {
    margin-top: 0;
  }

  .nav-group > ul {
    display: flex;
    flex-wrap: wrap;
  }

  .sidebar li a {
    border-left: none;
    border-bottom: 2px solid transparent;
    padding: 0.5rem 0.75rem;
  }

  .sidebar li.active > a {
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
