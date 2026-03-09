import { readdirSync, readFileSync, statSync, existsSync } from "fs";
import { join, extname, relative } from "path";
import * as cheerio from "cheerio";
import * as csstree from "css-tree";

// ─── Types ───

interface SiteReport {
  templateType: "static-html" | "react" | "vue" | "wordpress" | "next" | "nuxt" | "unknown";
  pages: PageInfo[];
  colors: ColorInfo[];
  fonts: string[];
  images: ImageInfo[];
  sections: SectionInfo[];
  assets: AssetInfo[];
  cssFiles: string[];
  jsFiles: string[];
  radii: RadiusInfo[];
}

interface PageInfo {
  path: string;
  title: string;
  links: string[];
}

interface ColorInfo {
  value: string;
  count: number;
  sources: string[];
  selectors: string[];  // CSS selectors where this color appears
}

interface RadiusInfo {
  value: string;
  count: number;
  selectors: string[];
}

interface ImageInfo {
  path: string;
  usedIn: string[];
  sizeKB: number;
}

interface SectionInfo {
  page: string;
  tag: string;
  id: string;
  classes: string;
  textPreview: string;
  order: number;
  label: string;    // Designer-friendly name e.g. "Hero Banner", "Footer"
  heading: string;  // First heading text found in this section
}

interface AssetInfo {
  path: string;
  type: "css" | "js" | "font" | "image" | "other";
  sizeKB: number;
}

// ─── File Scanner ───

function walkDir(dir: string, base?: string): string[] {
  const root = base || dir;
  const results: string[] = [];
  if (!existsSync(dir)) return results;

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.name.startsWith(".")) continue;
    if (entry.isDirectory()) {
      // Skip node_modules, vendor, etc.
      if (["node_modules", "vendor", ".git", "__pycache__", ".next", ".nuxt"].includes(entry.name)) continue;
      results.push(...walkDir(fullPath, root));
    } else {
      results.push(relative(root, fullPath));
    }
  }
  return results;
}

// ─── Template Type Detection ───

function detectTemplateType(files: string[], dir: string): SiteReport["templateType"] {
  const fileSet = new Set(files.map(f => f.toLowerCase()));
  const hasFile = (name: string) => fileSet.has(name.toLowerCase());
  const hasExt = (ext: string) => files.some(f => f.endsWith(ext));

  // WordPress
  if (hasFile("style.css") && hasFile("functions.php") && hasFile("index.php")) return "wordpress";
  if (files.some(f => f.includes("wp-content") || f.includes("wp-includes"))) return "wordpress";

  // Next.js
  if (hasFile("next.config.js") || hasFile("next.config.mjs") || hasFile("next.config.ts")) return "next";
  if (files.some(f => f.startsWith("pages/") || f.startsWith("app/"))) {
    if (hasFile("package.json")) {
      try {
        const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf-8"));
        if (pkg.dependencies?.next) return "next";
      } catch {}
    }
  }

  // Nuxt
  if (hasFile("nuxt.config.js") || hasFile("nuxt.config.ts")) return "nuxt";

  // React (CRA, Vite React, etc.)
  if (hasFile("package.json")) {
    try {
      const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf-8"));
      if (pkg.dependencies?.react || pkg.devDependencies?.react) return "react";
      if (pkg.dependencies?.vue || pkg.devDependencies?.vue) return "vue";
    } catch {}
  }

  // Vue (standalone)
  if (hasExt(".vue")) return "vue";

  // React (JSX files without package.json)
  if (hasExt(".jsx") || hasExt(".tsx")) return "react";

  // Static HTML
  if (hasExt(".html") || hasExt(".htm")) return "static-html";

  return "unknown";
}

// ─── Color Extraction ───

function extractColorsFromCSS(cssContent: string, source: string, colorMap: Map<string, ColorInfo>) {
  // Use css-tree for structured parsing — track parent selector
  try {
    const ast = csstree.parse(cssContent, { parseCustomProperty: true });
    // First pass: walk rules and capture selector context for each color
    csstree.walk(ast, (node: any) => {
      if (node.type === "Rule" && node.prelude) {
        const selector = csstree.generate(node.prelude);
        csstree.walk(node.block || node, (inner: any) => {
          // css-tree uses "Hash" for hex colors in values (not "HexColor")
          if (inner.type === "Hash" || inner.type === "HexColor") {
            addColor(`#${inner.value}`.toLowerCase(), source, colorMap, selector);
          }
          if (inner.type === "Function" && ["rgb", "rgba", "hsl", "hsla"].includes(inner.name.toLowerCase())) {
            addColor(csstree.generate(inner), source, colorMap, selector);
          }
        });
      }
    });
  } catch {}

  // Always also run regex to catch colors in custom properties, gradients, etc.
  extractColorsRegex(cssContent, source, colorMap);
}

function extractRadii(cssContent: string, radiusMap: Map<string, RadiusInfo>) {
  try {
    const ast = csstree.parse(cssContent, { parseCustomProperty: true });
    csstree.walk(ast, (node: any) => {
      if (node.type === "Rule" && node.prelude) {
        const selector = csstree.generate(node.prelude);
        csstree.walk(node.block || node, (inner: any) => {
          if (inner.type === "Declaration") {
            const prop = (inner.property || "").toLowerCase();
            if (prop === "border-radius" || (prop.startsWith("border-") && prop.endsWith("-radius"))) {
              const val = csstree.generate(inner.value).trim();
              if (!val || val === "0" || val === "0px" || val === "inherit" || val === "initial") return;
              const existing = radiusMap.get(val);
              if (existing) {
                existing.count++;
                if (selector && !existing.selectors.includes(selector) && existing.selectors.length < 20) existing.selectors.push(selector);
              } else {
                radiusMap.set(val, { value: val, count: 1, selectors: selector ? [selector] : [] });
              }
            }
          }
        });
      }
    });
  } catch {}
}

function extractColorsRegex(content: string, source: string, colorMap: Map<string, ColorInfo>) {
  const hexRegex = /#(?:[0-9a-fA-F]{3,4}){1,2}\b/g;
  const rgbRegex = /rgba?\([^)]+\)/gi;
  const hslRegex = /hsla?\([^)]+\)/gi;

  for (const match of content.matchAll(hexRegex)) {
    addColor(match[0].toLowerCase(), source, colorMap);
  }
  for (const match of content.matchAll(rgbRegex)) {
    addColor(match[0].toLowerCase().replace(/\s+/g, ""), source, colorMap);
  }
  for (const match of content.matchAll(hslRegex)) {
    addColor(match[0].toLowerCase().replace(/\s+/g, ""), source, colorMap);
  }
}

function addColor(value: string, source: string, colorMap: Map<string, ColorInfo>, selector?: string) {
  const existing = colorMap.get(value);
  if (existing) {
    existing.count++;
    if (!existing.sources.includes(source)) existing.sources.push(source);
    if (selector && !existing.selectors.includes(selector) && existing.selectors.length < 20) existing.selectors.push(selector);
  } else {
    colorMap.set(value, { value, count: 1, sources: [source], selectors: selector ? [selector] : [] });
  }
}

// ─── Font Extraction ───

function extractFonts(cssContent: string, fonts: Set<string>) {
  const fontFaceRegex = /font-family\s*:\s*([^;}\n]+)/gi;
  for (const match of cssContent.matchAll(fontFaceRegex)) {
    const raw = match[1].trim();
    // Split by comma to get individual font names
    for (const part of raw.split(",")) {
      const name = part.trim().replace(/^['"]|['"]$/g, "").trim();
      // Skip generic families and CSS functions
      const generics = ["serif", "sans-serif", "monospace", "cursive", "fantasy", "system-ui", "ui-serif", "ui-sans-serif", "ui-monospace", "inherit", "initial", "unset"];
      if (name && !generics.includes(name.toLowerCase()) && !name.includes("(") && name.length < 60) {
        fonts.add(name);
      }
    }
  }

  // Also check Google Fonts / CDN links in HTML
  const googleFontRegex = /fonts\.googleapis\.com\/css2?\?family=([^"'&\s]+)/gi;
  for (const match of cssContent.matchAll(googleFontRegex)) {
    const families = decodeURIComponent(match[1]).split("|");
    for (const f of families) {
      const name = f.split(":")[0].replace(/\+/g, " ");
      if (name) fonts.add(name);
    }
  }
}

// ─── Section Label Mapping ───

const SECTION_LABEL_MAP: Record<string, string> = {
  // Tags
  header: "Header",
  nav: "Navigation",
  footer: "Footer",
  main: "Main Content",
  aside: "Sidebar",
  article: "Article",
  // Common class patterns → friendly labels
  hero: "Hero Section",
  banner: "Banner",
  slider: "Slider / Carousel",
  carousel: "Carousel",
  cta: "Call to Action",
  "call-to-action": "Call to Action",
  about: "About",
  contact: "Contact",
  testimonial: "Testimonials",
  team: "Team",
  pricing: "Pricing",
  faq: "FAQ",
  feature: "Features",
  service: "Services",
  portfolio: "Portfolio",
  gallery: "Gallery",
  blog: "Blog",
  news: "News",
  event: "Events",
  counter: "Stats / Counter",
  stat: "Stats",
  partner: "Partners",
  client: "Clients",
  sponsor: "Sponsors",
  subscribe: "Subscribe / Newsletter",
  newsletter: "Newsletter",
  login: "Login",
  register: "Registration",
  search: "Search",
  breadcrumb: "Breadcrumb",
  pagination: "Pagination",
  sidebar: "Sidebar",
  widget: "Widget",
  modal: "Modal / Dialog",
  tab: "Tabs",
  accordion: "Accordion",
  map: "Map",
  video: "Video",
  course: "Courses",
  shop: "Shop",
  product: "Products",
  cart: "Cart",
  checkout: "Checkout",
  comment: "Comments",
  review: "Reviews",
  form: "Form",
  "inner-page-banner": "Page Banner",
  "page-banner": "Page Banner",
  "section-divider": "Divider",
  divider: "Divider",
  "scroll-to-top": "Scroll to Top",
  "back-to-top": "Back to Top",
  copyright: "Copyright",
  social: "Social Links",
  overlay: "Overlay",
  preloader: "Loading Screen",
  loader: "Loading Screen",
};

function guessSectionLabel(tag: string, id: string, classes: string): string {
  const allText = `${id} ${classes}`.toLowerCase();

  // Check class/id patterns against the map (longest match first)
  const sortedKeys = Object.keys(SECTION_LABEL_MAP).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    if (allText.includes(key)) return SECTION_LABEL_MAP[key];
  }

  // Fallback to tag-level label
  if (SECTION_LABEL_MAP[tag]) return SECTION_LABEL_MAP[tag];

  // Last resort: humanize class name
  if (classes) {
    const firstClass = classes.split(/\s+/)[0];
    return firstClass
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, c => c.toUpperCase())
      .replace(/\s(Area|Wrapper|Container|Section|Block|Box)$/i, "")
      .trim() || "Section";
  }

  return "Section";
}

// ─── HTML Analysis ───

function analyzeHTML(htmlContent: string, filePath: string) {
  const $ = cheerio.load(htmlContent);

  const title = $("title").first().text().trim() || filePath;

  // Internal links
  const links: string[] = [];
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") || "";
    if (href && !href.startsWith("http") && !href.startsWith("#") && !href.startsWith("mailto:") && !href.startsWith("tel:")) {
      links.push(href);
    }
  });

  // Images
  const images: string[] = [];
  $("img[src]").each((_, el) => {
    const src = $(el).attr("src") || "";
    if (src && !src.startsWith("data:")) images.push(src);
  });
  $("[style]").each((_, el) => {
    const style = $(el).attr("style") || "";
    const bgMatch = style.match(/url\(['"]?([^'")]+)['"]?\)/);
    if (bgMatch) images.push(bgMatch[1]);
  });
  $("source[srcset]").each((_, el) => {
    const srcset = $(el).attr("srcset") || "";
    images.push(...srcset.split(",").map(s => s.trim().split(" ")[0]).filter(Boolean));
  });

  // Sections
  const sections: Omit<SectionInfo, "page">[] = [];
  const sectionSelectors = "header, nav, section, main, article, aside, footer, [class*='section'], [class*='hero'], [class*='banner'], [class*='cta']";
  let sectionOrder = 0;
  $(sectionSelectors).each((_, el) => {
    const $el = $(el);
    // Skip nested sections (only top-level or direct body children depth)
    if ($el.parents(sectionSelectors).length > 0) return;

    const tag = el.tagName.toLowerCase();
    const id = $el.attr("id") || "";
    const classes = ($el.attr("class") || "").split(/\s+/).slice(0, 5).join(" ");
    const text = $el.text().replace(/\s+/g, " ").trim().slice(0, 100);

    // Extract first heading text
    const $heading = $el.find("h1, h2, h3, h4, h5, h6").first();
    const heading = $heading.length ? $heading.text().replace(/\s+/g, " ").trim().slice(0, 80) : "";

    const label = guessSectionLabel(tag, id, classes);

    sections.push({
      tag,
      id,
      classes,
      textPreview: text,
      order: sectionOrder++,
      label,
      heading,
    });
  });

  // Inline styles (for color + font extraction)
  let inlineCSS = "";
  $("style").each((_, el) => {
    inlineCSS += $(el).html() || "";
  });
  $("[style]").each((_, el) => {
    inlineCSS += $(el).attr("style") || "";
  });
  // Include font CDN links for font detection
  $('link[href*="fonts.googleapis.com"], link[href*="fonts.cdnfonts.com"]').each((_, el) => {
    inlineCSS += " " + ($(el).attr("href") || "");
  });

  // CSS/JS references
  const cssRefs: string[] = [];
  $('link[rel="stylesheet"]').each((_, el) => {
    const href = $(el).attr("href") || "";
    if (href && !href.startsWith("http")) cssRefs.push(href);
  });

  const jsRefs: string[] = [];
  $("script[src]").each((_, el) => {
    const src = $(el).attr("src") || "";
    if (src && !src.startsWith("http")) jsRefs.push(src);
  });

  return { title, links, images, sections, inlineCSS, cssRefs, jsRefs };
}

// ─── Main Analyze ───

export function analyze(projectDir: string): SiteReport {
  const originalDir = join(projectDir, "_original");
  if (!existsSync(originalDir)) {
    throw new Error(`No _original/ directory found in ${projectDir}`);
  }

  const allFiles = walkDir(originalDir);
  const templateType = detectTemplateType(allFiles, originalDir);

  const colorMap = new Map<string, ColorInfo>();
  const fontSet = new Set<string>();
  const radiusMap = new Map<string, RadiusInfo>();
  const pages: PageInfo[] = [];
  const imageMap = new Map<string, ImageInfo>();
  const sectionList: SectionInfo[] = [];
  const cssFiles: string[] = [];
  const jsFiles: string[] = [];

  for (const file of allFiles) {
    const fullPath = join(originalDir, file);
    const ext = extname(file).toLowerCase();

    // Categorize
    if ([".css", ".scss", ".less"].includes(ext)) cssFiles.push(file);
    if ([".js", ".ts", ".jsx", ".tsx"].includes(ext)) jsFiles.push(file);

    // Analyze CSS files
    if ([".css", ".scss"].includes(ext)) {
      try {
        const content = readFileSync(fullPath, "utf-8");
        extractColorsFromCSS(content, file, colorMap);
        extractFonts(content, fontSet);
        extractRadii(content, radiusMap);
      } catch {}
    }

    // Analyze HTML files
    if ([".html", ".htm", ".php"].includes(ext)) {
      try {
        const content = readFileSync(fullPath, "utf-8");
        const result = analyzeHTML(content, file);

        pages.push({ path: file, title: result.title, links: [...new Set(result.links)] });

        // Inline CSS
        if (result.inlineCSS) {
          extractColorsFromCSS(result.inlineCSS, file, colorMap);
          extractFonts(result.inlineCSS, fontSet);
          extractRadii(result.inlineCSS, radiusMap);
        }

        // Images
        for (const img of result.images) {
          const existing = imageMap.get(img);
          if (existing) {
            if (!existing.usedIn.includes(file)) existing.usedIn.push(file);
          } else {
            let sizeKB = 0;
            try {
              const imgPath = join(originalDir, img);
              if (existsSync(imgPath)) sizeKB = Math.round(statSync(imgPath).size / 1024);
            } catch {}
            imageMap.set(img, { path: img, usedIn: [file], sizeKB });
          }
        }

        // Sections
        for (const sec of result.sections) {
          sectionList.push({ ...sec, page: file });
        }
      } catch {}
    }
  }

  // Build assets list
  const imageExts = [".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".ico", ".avif"];
  const fontExts = [".woff", ".woff2", ".ttf", ".otf", ".eot"];
  const assets: AssetInfo[] = allFiles.map(file => {
    const ext = extname(file).toLowerCase();
    let type: AssetInfo["type"] = "other";
    if ([".css", ".scss", ".less"].includes(ext)) type = "css";
    else if ([".js", ".ts", ".jsx", ".tsx"].includes(ext)) type = "js";
    else if (fontExts.includes(ext)) type = "font";
    else if (imageExts.includes(ext)) type = "image";

    let sizeKB = 0;
    try { sizeKB = Math.round(statSync(join(originalDir, file)).size / 1024); } catch {}
    return { path: file, type, sizeKB };
  });

  // Sort colors by count
  const colors = [...colorMap.values()].sort((a, b) => b.count - a.count);
  const radii = [...radiusMap.values()].sort((a, b) => b.count - a.count);

  return {
    templateType,
    pages,
    colors,
    fonts: [...fontSet],
    images: [...imageMap.values()],
    sections: sectionList,
    assets,
    cssFiles,
    jsFiles,
    radii,
  };
}

// ─── Report Generator ───

function generateReport(report: SiteReport, projectDir: string): string {
  const lines: string[] = [];
  const hr = "---";

  lines.push(`# Site Analysis Report`);
  lines.push(`**Project:** ${projectDir}`);
  lines.push(`**Template Type:** ${report.templateType}`);
  lines.push(`**Total Files:** ${report.assets.length}`);
  lines.push("");

  // Pages
  lines.push(`## Pages (${report.pages.length})`);
  lines.push(hr);
  for (const page of report.pages) {
    lines.push(`- **${page.path}** — "${page.title}"`);
    if (page.links.length) lines.push(`  Links to: ${page.links.join(", ")}`);
  }
  lines.push("");

  // Sections
  lines.push(`## Sections (${report.sections.length})`);
  lines.push(hr);
  const byPage = new Map<string, SectionInfo[]>();
  for (const sec of report.sections) {
    if (!byPage.has(sec.page)) byPage.set(sec.page, []);
    byPage.get(sec.page)!.push(sec);
  }
  for (const [page, secs] of byPage) {
    lines.push(`\n### ${page}`);
    for (const sec of secs) {
      const techRef = [sec.tag, sec.id ? `#${sec.id}` : "", sec.classes ? `.${sec.classes.split(" ")[0]}` : ""].filter(Boolean).join("");
      const heading = sec.heading ? ` — "${sec.heading.slice(0, 60)}"` : "";
      lines.push(`${sec.order + 1}. **${sec.label || "Section"}**${heading}  \`<${techRef}>\``);
    }
  }
  lines.push("");

  // Colors
  lines.push(`## Colors (${report.colors.length} unique)`);
  lines.push(hr);
  const topColors = report.colors.slice(0, 30);
  lines.push("| Color | Count | Used In |");
  lines.push("|-------|-------|---------|");
  for (const c of topColors) {
    lines.push(`| \`${c.value}\` | ${c.count} | ${c.sources.slice(0, 3).join(", ")} |`);
  }
  if (report.colors.length > 30) lines.push(`\n*...and ${report.colors.length - 30} more colors*`);
  lines.push("");

  // Fonts
  lines.push(`## Fonts (${report.fonts.length})`);
  lines.push(hr);
  for (const f of report.fonts) lines.push(`- ${f}`);
  lines.push("");

  // Images
  lines.push(`## Images (${report.images.length})`);
  lines.push(hr);
  lines.push("| Path | Size | Used In |");
  lines.push("|------|------|---------|");
  for (const img of report.images) {
    lines.push(`| \`${img.path}\` | ${img.sizeKB}KB | ${img.usedIn.join(", ")} |`);
  }
  lines.push("");

  // Assets summary
  lines.push(`## Assets Summary`);
  lines.push(hr);
  const assetsByType = new Map<string, number>();
  for (const a of report.assets) {
    assetsByType.set(a.type, (assetsByType.get(a.type) || 0) + 1);
  }
  for (const [type, count] of assetsByType) {
    lines.push(`- **${type}**: ${count} files`);
  }
  lines.push("");

  // CSS files
  if (report.cssFiles.length) {
    lines.push(`## CSS Files`);
    lines.push(hr);
    for (const f of report.cssFiles) lines.push(`- ${f}`);
    lines.push("");
  }

  // JS files
  if (report.jsFiles.length) {
    lines.push(`## JS Files`);
    lines.push(hr);
    for (const f of report.jsFiles) lines.push(`- ${f}`);
    lines.push("");
  }

  return lines.join("\n");
}

// ─── CLI Entry ───

if (import.meta.main) {
  const projectDir = process.argv[2];
  if (!projectDir) {
    console.error("Usage: bun run src/analyze.ts <project-dir>");
    process.exit(1);
  }

  console.log("Analyzing template...\n");
  const report = analyze(projectDir);
  const markdown = generateReport(report, projectDir);

  // Save report
  const reportPath = join(projectDir, "site-report.md");
  await Bun.write(reportPath, markdown);

  // Also save raw JSON
  const jsonPath = join(projectDir, "site-config.json");
  await Bun.write(jsonPath, JSON.stringify(report, null, 2));

  console.log(markdown);
  console.log(`\nReport saved to: ${reportPath}`);
  console.log(`Config saved to: ${jsonPath}`);
}
