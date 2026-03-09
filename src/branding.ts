import { readdirSync, readFileSync, writeFileSync, existsSync, copyFileSync, mkdirSync, statSync } from "fs";
import { join, extname, relative } from "path";
import type { analyze } from "./analyze";

// ─── Types ───

export interface ColorMeta {
  role: string;       // "Primary", "Text", "Background", "Border", "Overlay"
  count: number;
  sources: string[];  // CSS files where it appears
  components: string[]; // Designer-friendly component names
}

export interface RadiusMeta {
  count: number;
  components: string[];
}

export interface ImageMeta {
  width: number;
  height: number;
  sizeKB: number;
  usedIn: string[];   // HTML pages
}

export interface BrandingConfig {
  _info: string;
  _usage: string[];
  colors: Record<string, string>;
  fonts: Record<string, string>;
  texts: Record<string, string>;
  images: Record<string, string>;
  radii: Record<string, string>;
  _meta: {
    colors: Record<string, ColorMeta>;
    images: Record<string, ImageMeta>;
    radii: Record<string, RadiusMeta>;
  };
}

// ─── Export Branding ───

export function exportBranding(report: ReturnType<typeof analyze>, projectDir: string): BrandingConfig {
  const colorEntries: Record<string, string> = {};
  const colorMeta: Record<string, ColorMeta> = {};
  const seen = new Set<string>();

  // Asset-only file patterns to exclude (images, fonts, vendor docs)
  const ASSET_PATTERNS = /\.(png|jpg|jpeg|gif|svg|webp|ico|woff|woff2|ttf|otf|eot|mp4|pdf)$/i;
  const ASSET_DIR_PATTERNS = /\b(images?|img|assets?|icons?|fonts?|vendor|plugins?|Documentation|PSD)\b/i;

  for (const col of report.colors) {
    const val = col.value.toLowerCase();
    if (["#fff", "#ffffff", "#000", "#000000", "transparent", "inherit", "none"].includes(val)) continue;
    if (val.includes("transparent")) continue;
    if (/rgba?\([^)]*,\s*0\s*\)/.test(val)) continue;

    // Skip colors that ONLY appear in asset/vendor files
    const nonAssetSources = col.sources.filter(s => !ASSET_PATTERNS.test(s) && !ASSET_DIR_PATTERNS.test(s));
    if (nonAssetSources.length === 0 && col.sources.length > 0) continue;

    // Normalize to full 6-digit hex for dedup (handles #abc, rgb(), etc.)
    const normalized = normalizeToHex6(val);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    colorEntries[val] = val;
    colorMeta[val] = {
      role: classifyColorRole(val),
      count: col.count,
      sources: nonAssetSources.length > 0 ? nonAssetSources.slice(0, 5) : col.sources.slice(0, 5),
      components: selectorsToComponents(col.selectors || []),
    };
  }

  // --- Fonts ---
  const fontEntries: Record<string, string> = {};
  for (const font of report.fonts) {
    fontEntries[font] = font;
  }

  // --- Texts ---
  const textEntries: Record<string, string> = {};
  if (report.pages.length > 0) {
    const titles = report.pages.map(p => p.title);
    const brandName = extractBrandName(titles);
    if (brandName) textEntries[brandName] = brandName;
  }
  const commonTexts = extractCommonTexts(projectDir);
  for (const text of commonTexts) textEntries[text] = text;

  // --- Images: ALL images with metadata ---
  const imageEntries: Record<string, string> = {};
  const imageMeta: Record<string, ImageMeta> = {};
  const originalDir = join(projectDir, "_original");

  for (const img of report.images) {
    imageEntries[img.path] = img.path;
    // Get dimensions
    let width = 0, height = 0;
    try {
      const imgPath = join(originalDir, img.path);
      if (existsSync(imgPath)) {
        const dims = getImageDimensions(imgPath);
        width = dims.width;
        height = dims.height;
      }
    } catch {}
    imageMeta[img.path] = {
      width,
      height,
      sizeKB: img.sizeKB,
      usedIn: img.usedIn,
    };
  }

  // --- Radii ---
  const radiusEntries: Record<string, string> = {};
  const radiusMeta: Record<string, RadiusMeta> = {};
  for (const r of report.radii || []) {
    radiusEntries[r.value] = r.value;
    radiusMeta[r.value] = {
      count: r.count,
      components: selectorsToComponents(r.selectors || []),
    };
    if (Object.keys(radiusEntries).length >= 20) break;
  }

  return {
    _info: "Branding Configuration",
    _usage: [
      "1. Edit values via /editor in browser",
      "2. Run option 8 'Apply branding' in CLI",
    ],
    colors: colorEntries,
    fonts: fontEntries,
    texts: textEntries,
    images: imageEntries,
    radii: radiusEntries,
    _meta: {
      colors: colorMeta,
      images: imageMeta,
      radii: radiusMeta,
    },
  };
}

// ─── Selector → Component Mapping ───

const SELECTOR_COMPONENT_MAP: [RegExp, string][] = [
  // Buttons
  [/\.btn|\.button|button|input\[type=.submit.\]/i, "Button"],
  [/\.btn-primary/i, "Primary Button"],
  [/\.btn-secondary|\.btn-default/i, "Secondary Button"],
  [/\.btn-outline/i, "Outline Button"],
  [/\.btn-danger|\.btn-warning|\.btn-success|\.btn-info/i, "Status Button"],
  // Navigation
  [/\.nav|\.navbar|\.menu|\.topbar|\.main-menu|\.mobile-menu/i, "Navigation"],
  [/\.nav-link|\.nav-item/i, "Nav Link"],
  [/\.dropdown|\.submenu/i, "Dropdown Menu"],
  [/\.breadcrumb/i, "Breadcrumb"],
  [/\.pagination/i, "Pagination"],
  // Layout
  [/header|\.header|\.site-header|\.page-header/i, "Header"],
  [/footer|\.footer|\.site-footer/i, "Footer"],
  [/\.sidebar|aside/i, "Sidebar"],
  [/\.hero|\.banner|\.jumbotron|\.masthead/i, "Hero/Banner"],
  [/\.section|section/i, "Section"],
  [/\.container|\.wrapper/i, "Container"],
  // Cards
  [/\.card|\.panel|\.box|\.tile/i, "Card"],
  [/\.card-header|\.panel-heading/i, "Card Header"],
  [/\.card-body|\.panel-body/i, "Card Body"],
  [/\.card-footer|\.panel-footer/i, "Card Footer"],
  // Forms
  [/\.form-control|\.input|input|textarea|select/i, "Form Input"],
  [/\.form-group|\.form-field/i, "Form Field"],
  [/\.checkbox|\.radio/i, "Checkbox/Radio"],
  [/\.label|label/i, "Label"],
  // Feedback
  [/\.alert|\.notification|\.toast/i, "Alert/Toast"],
  [/\.badge|\.tag|\.chip|\.label/i, "Badge/Tag"],
  [/\.progress/i, "Progress Bar"],
  [/\.spinner|\.loader/i, "Loader"],
  [/\.tooltip|\.popover/i, "Tooltip"],
  // Content
  [/\.modal|\.dialog/i, "Modal"],
  [/\.tab|\.tab-pane/i, "Tabs"],
  [/\.accordion|\.collapse/i, "Accordion"],
  [/\.table|table|thead|tbody|tr|td|th/i, "Table"],
  [/\.list|\.list-group|ul|ol/i, "List"],
  [/\.carousel|\.slider|\.swiper|\.owl/i, "Carousel/Slider"],
  // Typography
  [/^h[1-6]$|\.heading|\.title/i, "Heading"],
  [/^p$|\.text|\.paragraph|\.desc/i, "Text/Paragraph"],
  [/^a$|\.link/i, "Link"],
  [/\.icon|\.fa|\.material-icons/i, "Icon"],
  // Media
  [/\.img|img|\.image|\.thumbnail|\.avatar/i, "Image"],
  [/\.video|video/i, "Video"],
  // States
  [/\:hover/i, "Hover State"],
  [/\:focus/i, "Focus State"],
  [/\:active|\.active/i, "Active State"],
  [/\.disabled|:disabled/i, "Disabled State"],
  // Special
  [/\.overlay|\.backdrop/i, "Overlay"],
  [/\.shadow|\.elevation/i, "Shadow"],
  [/body/i, "Page Body"],
  [/\*|:root/i, "Global"],
  // Misc
  [/\.social/i, "Social Links"],
  [/\.search/i, "Search"],
  [/\.price|\.pricing/i, "Pricing"],
  [/\.testimonial|\.review|\.quote/i, "Testimonial"],
  [/\.team|\.member/i, "Team"],
  [/\.feature|\.service/i, "Feature/Service"],
  [/\.counter|\.stat/i, "Stats"],
  [/\.cta|\.call-to-action/i, "CTA"],
  [/\.blog|\.post|\.article/i, "Blog/Article"],
  [/\.gallery|\.portfolio/i, "Gallery"],
  [/\.map/i, "Map"],
  [/\.footer-widget|\.widget/i, "Widget"],
  [/\.copyright/i, "Copyright"],
];

function selectorsToComponents(selectors: string[]): string[] {
  const components = new Set<string>();
  for (const sel of selectors) {
    // Split multi-selectors (e.g., ".btn, .button")
    for (const part of sel.split(",")) {
      const trimmed = part.trim().toLowerCase();
      for (const [pattern, name] of SELECTOR_COMPONENT_MAP) {
        if (pattern.test(trimmed)) {
          components.add(name);
          break; // First match wins per selector part
        }
      }
    }
    if (components.size >= 6) break; // Cap to keep UI clean
  }
  return [...components];
}

// ─── Color Role Classification ───

function classifyColorRole(value: string): string {
  // RGBA/alpha → Overlay (system)
  if (value.includes("rgba") || value.includes("hsla")) return "Overlay";

  const rgb = parseToRGB(value);
  if (!rgb) return "Other";

  const [r, g, b] = rgb;
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  const sat = max === 0 ? 0 : (max - min) / max;

  // Detect system/feedback colors (red=error, yellow/orange=warning, green=success, blue=info)
  if (sat > 0.4) {
    const hue = rgbToHue(r, g, b);
    // Red zone (error): 0-15, 345-360
    if ((hue <= 15 || hue >= 345) && lum > 0.15 && lum < 0.85) return "System";
    // Orange/yellow zone (warning): 25-55
    if (hue >= 25 && hue <= 55 && lum > 0.15 && lum < 0.85) return "System";
    // Green zone (success): 90-160
    if (hue >= 90 && hue <= 160 && lum > 0.15 && lum < 0.85) return "System";
    // Cyan/light blue (info): 170-210
    if (hue >= 170 && hue <= 210 && lum > 0.15 && lum < 0.85) return "System";
  }

  // High saturation, not system → check if main brand or accent
  // Primary: high sat, medium luminance (the "hero" colors)
  if (sat > 0.5 && lum > 0.2 && lum < 0.7) return "Primary";
  // Accent: moderate sat or lighter saturated colors
  if (sat > 0.25 && lum > 0.15 && lum < 0.85) return "Accent";

  // Very dark → Text
  if (lum < 0.25) return "Text";

  // Very light → Background
  if (lum > 0.9) return "Background";

  // Light-ish gray → Border / Divider
  if (sat < 0.1 && lum > 0.7) return "Border";

  // Mid gray → Subtle Text
  if (sat < 0.1 && lum > 0.3) return "Subtle Text";

  // Everything else
  if (lum > 0.6) return "Background";
  return "Text";
}

function rgbToHue(r: number, g: number, b: number): number {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return 0;
  let h = 0;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h = Math.round(h * 60);
  return h < 0 ? h + 360 : h;
}

function parseToRGB(value: string): [number, number, number] | null {
  // Hex
  if (value.startsWith("#")) {
    let hex = value.replace("#", "");
    if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
    if (hex.length >= 6) {
      return [parseInt(hex.slice(0,2),16), parseInt(hex.slice(2,4),16), parseInt(hex.slice(4,6),16)];
    }
  }
  // rgb(r,g,b)
  const m = value.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (m) return [parseInt(m[1]), parseInt(m[2]), parseInt(m[3])];
  return null;
}

// ─── Image Dimensions ───

function getImageDimensions(filePath: string): { width: number; height: number } {
  try {
    const buf = readFileSync(filePath);
    const ext = extname(filePath).toLowerCase();

    if (ext === ".png" && buf.length > 24) {
      return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
    }
    if ((ext === ".jpg" || ext === ".jpeg") && buf.length > 2) {
      return parseJpegDimensions(buf);
    }
    if (ext === ".gif" && buf.length > 10) {
      return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
    }
    if (ext === ".webp" && buf.length > 30) {
      if (buf.toString("ascii", 12, 16) === "VP8 ") {
        return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
      }
    }
  } catch {}
  return { width: 0, height: 0 };
}

function parseJpegDimensions(buf: Buffer): { width: number; height: number } {
  let offset = 2;
  while (offset < buf.length - 1) {
    if (buf[offset] !== 0xff) break;
    const marker = buf[offset + 1];
    if (marker === 0xc0 || marker === 0xc2) {
      if (offset + 9 < buf.length) {
        return { height: buf.readUInt16BE(offset + 5), width: buf.readUInt16BE(offset + 7) };
      }
    }
    if (marker === 0xd9 || marker === 0xda) break;
    const len = buf.readUInt16BE(offset + 2);
    offset += 2 + len;
  }
  return { width: 0, height: 0 };
}

// ─── Apply Branding ───

export function applyBranding(projectDir: string): { filesChanged: number; changes: string[] } {
  // Find *-branding.json or branding.json
  const brandingFile = readdirSync(projectDir).find(f => f.endsWith("-branding.json")) || "branding.json";
  const brandingPath = join(projectDir, brandingFile);
  if (!existsSync(brandingPath)) {
    throw new Error("No branding file found. Run 'Export branding' first.");
  }

  const config: BrandingConfig = JSON.parse(readFileSync(brandingPath, "utf-8"));
  const workingDir = join(projectDir, "working");
  const originalDir = join(projectDir, "_original");
  if (!existsSync(originalDir)) {
    throw new Error("_original/ directory not found.");
  }

  // Build replacement maps (only entries where key !== value)
  const colorReplacements = getReplacements(config.colors);
  const fontReplacements = getReplacements(config.fonts);
  const textReplacements = getReplacements(config.texts || {});
  const imageReplacements = getReplacements(config.images);
  const radiusReplacements = getReplacements(config.radii || {});

  const totalReplacements = colorReplacements.length + fontReplacements.length + textReplacements.length + imageReplacements.length + radiusReplacements.length;

  // Also check if there are uploaded images
  const uploadsDir = join(projectDir, "_uploads");
  const hasUploads = existsSync(uploadsDir) && walkDir(uploadsDir).length > 0;

  if (totalReplacements === 0 && !hasUploads) {
    throw new Error("No changes detected. Edit values in the editor first.");
  }

  // ALWAYS restore working/ from _original/ first — ensures find-and-replace works on clean files
  restoreFromOriginal(projectDir);

  // Then overlay uploaded images from _uploads/ (if any)
  if (existsSync(uploadsDir)) {
    const uploadFiles = walkDir(uploadsDir);
    for (const file of uploadFiles) {
      const src = join(uploadsDir, file);
      const dest = join(workingDir, file);
      const destDir = dest.substring(0, dest.lastIndexOf("/"));
      if (!existsSync(destDir)) mkdirSync(destDir, { recursive: true });
      try { copyFileSync(src, dest); } catch {}
    }
  }

  const changes: string[] = [];
  let filesChanged = 0;

  // Walk all files in working/
  const files = walkDir(workingDir);

  for (const relFile of files) {
    const fullPath = join(workingDir, relFile);
    const ext = extname(relFile).toLowerCase();

    // Only process text files
    if (![".html", ".htm", ".css", ".scss", ".less", ".js", ".php", ".txt", ".svg"].includes(ext)) continue;

    let content: string;
    try {
      content = readFileSync(fullPath, "utf-8");
    } catch {
      continue;
    }

    let modified = content;
    const fileChanges: string[] = [];

    // Apply radius replacements (CSS + HTML inline styles)
    if ([".css", ".scss", ".less", ".html", ".htm", ".php", ".svg"].includes(ext)) {
      for (const [from, to] of radiusReplacements) {
        const escaped = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // Match any border-radius variant (incl. -webkit-, -moz-) with exact value
        // Lookahead: followed by ; } " ' newline or !important
        const regex = new RegExp(`((?:-(?:webkit|moz|ms|o)-)?border(?:-(?:top|bottom)-(?:left|right))?-radius\\s*:\\s*)${escaped}\\s*(?=[;}"'\\n\\r!])`, 'gi');
        const matches = modified.match(regex);
        if (matches && matches.length > 0) {
          modified = modified.replace(regex, `$1${to}`);
          fileChanges.push(`radius ${from} → ${to} (x${matches.length})`);
        }
      }
    }

    // Apply color replacements (CSS + HTML)
    if ([".css", ".scss", ".less", ".html", ".htm", ".php", ".svg"].includes(ext)) {
      for (const [from, to] of colorReplacements) {
        const count = countOccurrences(modified, from);
        if (count > 0) {
          modified = replaceAll(modified, from, to);
          fileChanges.push(`color ${from} → ${to} (x${count})`);
        }
        // Also try case-insensitive for hex
        if (from.startsWith("#")) {
          const upperFrom = from.toUpperCase();
          const countUpper = countOccurrences(modified, upperFrom);
          if (countUpper > 0) {
            modified = replaceAll(modified, upperFrom, to);
            fileChanges.push(`color ${upperFrom} → ${to} (x${countUpper})`);
          }
        }
      }
    }

    // Apply font replacements (CSS + HTML)
    if ([".css", ".scss", ".less", ".html", ".htm", ".php"].includes(ext)) {
      for (const [from, to] of fontReplacements) {
        // Match font in quotes and without quotes
        for (const variant of [from, `'${from}'`, `"${from}"`]) {
          const count = countOccurrences(modified, variant);
          if (count > 0) {
            const replacement = variant.startsWith("'") ? `'${to}'` : variant.startsWith('"') ? `"${to}"` : to;
            modified = replaceAll(modified, variant, replacement);
            fileChanges.push(`font "${from}" → "${to}" (x${count})`);
          }
        }
      }
    }

    // Apply text replacements (HTML only)
    if ([".html", ".htm", ".php"].includes(ext)) {
      for (const [from, to] of textReplacements) {
        const count = countOccurrences(modified, from);
        if (count > 0) {
          modified = replaceAll(modified, from, to);
          fileChanges.push(`text "${from.slice(0, 30)}" → "${to.slice(0, 30)}" (x${count})`);
        }
      }
    }

    // Apply image path replacements
    if ([".html", ".htm", ".css", ".php"].includes(ext)) {
      for (const [from, to] of imageReplacements) {
        const count = countOccurrences(modified, from);
        if (count > 0) {
          modified = replaceAll(modified, from, to);
          fileChanges.push(`image ${from} → ${to} (x${count})`);
        }
      }
    }

    // Write if changed
    if (modified !== content) {
      writeFileSync(fullPath, modified, "utf-8");
      filesChanged++;
      changes.push(`${relFile}: ${fileChanges.join(", ")}`);
    }
  }

  return { filesChanged, changes };
}

// ─── Helpers ───

function normalizeHex(hex: string): string {
  if (!hex.startsWith("#")) return hex;
  const clean = hex.replace("#", "").toLowerCase();
  if (clean.length === 3) {
    return `#${clean[0]}${clean[0]}${clean[1]}${clean[1]}${clean[2]}${clean[2]}`;
  }
  return `#${clean}`;
}

// Normalize any color format to 6-digit hex for dedup
function normalizeToHex6(val: string): string {
  // Hex
  if (val.startsWith("#")) return normalizeHex(val);
  // rgb/rgba → hex
  const rgb = parseToRGB(val);
  if (rgb) {
    return "#" + rgb.map(c => c.toString(16).padStart(2, "0")).join("");
  }
  return val;
}

function extractBrandName(titles: string[]): string | null {
  if (titles.length === 0) return null;
  // Find the common prefix/part across titles
  // e.g. "Academics | Home 1", "Academics | About" → "Academics"
  const parts = titles.map(t => t.split(/\s*[|–—-]\s*/)[0].trim());
  const counts = new Map<string, number>();
  for (const p of parts) {
    if (p.length > 1) counts.set(p, (counts.get(p) || 0) + 1);
  }
  // Most common prefix that appears in >50% of pages
  let best: string | null = null;
  let bestCount = 0;
  for (const [text, count] of counts) {
    if (count > bestCount && count > titles.length * 0.3) {
      best = text;
      bestCount = count;
    }
  }
  return best;
}

function extractCommonTexts(projectDir: string): string[] {
  const texts: string[] = [];
  const workingDir = join(projectDir, "working");
  if (!existsSync(workingDir)) return texts;

  // Look for common brand-related patterns in HTML
  const htmlFiles = walkDir(workingDir).filter(f => f.endsWith(".html") || f.endsWith(".htm"));
  const phoneCounts = new Map<string, number>();
  const emailCounts = new Map<string, number>();
  const addressCounts = new Map<string, number>();

  for (const file of htmlFiles.slice(0, 10)) {
    try {
      const content = readFileSync(join(workingDir, file), "utf-8");

      // Phone numbers
      const phones = content.match(/(?:tel:|phone[^"]*?)[:\s]*([+\d\s()-]{7,20})/gi);
      if (phones) for (const p of phones) {
        const clean = p.replace(/^(tel:|phone[^:]*:)\s*/i, "").trim();
        if (clean.length > 5) phoneCounts.set(clean, (phoneCounts.get(clean) || 0) + 1);
      }

      // Emails
      const emails = content.match(/[\w.-]+@[\w.-]+\.\w{2,}/g);
      if (emails) for (const e of emails) emailCounts.set(e, (emailCounts.get(e) || 0) + 1);
    } catch {}
  }

  // Add most common phone/email
  const topPhone = [...phoneCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  const topEmail = [...emailCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topPhone) texts.push(topPhone[0]);
  if (topEmail) texts.push(topEmail[0]);

  return texts;
}

function getReplacements(map: Record<string, string>): [string, string][] {
  return Object.entries(map).filter(([from, to]) => from !== to && to.trim() !== "");
}

function countOccurrences(str: string, sub: string): number {
  let count = 0;
  let pos = 0;
  while ((pos = str.indexOf(sub, pos)) !== -1) {
    count++;
    pos += sub.length;
  }
  return count;
}

function replaceAll(str: string, from: string, to: string): string {
  return str.split(from).join(to);
}

function walkDir(dir: string, base?: string): string[] {
  const root = base || dir;
  const results: string[] = [];
  if (!existsSync(dir)) return results;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.name.startsWith(".")) continue;
    if (entry.isDirectory()) {
      if (["node_modules", ".git"].includes(entry.name)) continue;
      results.push(...walkDir(fullPath, root));
    } else {
      results.push(relative(root, fullPath));
    }
  }
  return results;
}

function backupWorking(projectDir: string) {
  const workingDir = join(projectDir, "working");
  const backupDir = join(projectDir, "_backup");

  // Copy working → _backup (overwrite)
  const files = walkDir(workingDir);
  for (const file of files) {
    const src = join(workingDir, file);
    const dest = join(backupDir, file);
    const destDir = dest.substring(0, dest.lastIndexOf("/"));
    if (!existsSync(destDir)) mkdirSync(destDir, { recursive: true });
    try {
      copyFileSync(src, dest);
    } catch {}
  }
}

// Restore working/ from _original/ (clean slate for re-applying)
function restoreFromOriginal(projectDir: string) {
  const originalDir = join(projectDir, "_original");
  const workingDir = join(projectDir, "working");
  if (!existsSync(originalDir)) return;

  const files = walkDir(originalDir);
  for (const file of files) {
    const src = join(originalDir, file);
    const dest = join(workingDir, file);
    const destDir = dest.substring(0, dest.lastIndexOf("/"));
    if (!existsSync(destDir)) mkdirSync(destDir, { recursive: true });
    try {
      copyFileSync(src, dest);
    } catch {}
  }
}

// Reset everything back to original state
export function resetBranding(projectDir: string): BrandingConfig | null {
  // 1. Restore working/ from _original/
  restoreFromOriginal(projectDir);

  // 2. Delete _uploads/
  const uploadsDir = join(projectDir, "_uploads");
  if (existsSync(uploadsDir)) {
    const files = walkDir(uploadsDir);
    for (const file of files.reverse()) {
      try { require("fs").unlinkSync(join(uploadsDir, file)); } catch {}
    }
    try { require("fs").rmSync(uploadsDir, { recursive: true }); } catch {}
  }

  // 3. Load branding file and reset all values to keys (original state)
  const brandingFile = readdirSync(projectDir).find(f => f.endsWith("-branding.json")) || "branding.json";
  const brandingPath = join(projectDir, brandingFile);
  if (!existsSync(brandingPath)) return null;

  const config: BrandingConfig = JSON.parse(readFileSync(brandingPath, "utf-8"));

  // Reset: set every value = key (no changes)
  for (const key of Object.keys(config.colors || {})) config.colors[key] = key;
  for (const key of Object.keys(config.fonts || {})) config.fonts[key] = key;
  for (const key of Object.keys(config.images || {})) config.images[key] = key;
  for (const key of Object.keys(config.radii || {})) config.radii[key] = key;
  if (config.texts) {
    for (const key of Object.keys(config.texts)) config.texts[key] = key;
  }

  // Save the reset branding
  writeFileSync(brandingPath, JSON.stringify(config, null, 2), "utf-8");

  return config;
}
