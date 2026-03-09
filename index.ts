import { setup } from "./src/setup";
import { analyze } from "./src/analyze";
import { undo, reset } from "./src/backup";
import { serve } from "./src/serve";
import { exportBranding, applyBranding } from "./src/branding";
import { join, resolve } from "path";
import { existsSync, readdirSync } from "fs";

const PROJECTS_DIR = join(import.meta.dir, "projects");

// ─── ANSI Colors ───

const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  // Foreground
  pink: "\x1b[38;5;205m",
  violet: "\x1b[38;5;141m",
  cyan: "\x1b[38;5;116m",
  green: "\x1b[38;5;114m",
  yellow: "\x1b[38;5;222m",
  orange: "\x1b[38;5;209m",
  red: "\x1b[38;5;203m",
  gray: "\x1b[38;5;245m",
  white: "\x1b[38;5;255m",
  // Background
  bgDark: "\x1b[48;5;236m",
  bgViolet: "\x1b[48;5;53m",
};

// ─── Helpers ───

function prompt(message: string): string {
  process.stdout.write(message);
  const buf = Buffer.alloc(4096);
  const bytesRead = require("fs").readSync(0, buf, 0, buf.length, null);
  return buf.toString("utf-8", 0, bytesRead).trim();
}

function listProjects(): string[] {
  if (!existsSync(PROJECTS_DIR)) return [];
  return readdirSync(PROJECTS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory() && !d.name.startsWith("."))
    .map(d => d.name);
}

function pickProject(): string | null {
  const projects = listProjects();
  if (projects.length === 0) {
    console.log(`\n  ${c.yellow}No projects yet.${c.reset} Choose option 1 to import a template.\n`);
    return null;
  }
  if (projects.length === 1) {
    console.log(`\n  ${c.cyan}Using project:${c.reset} ${c.bold}${projects[0]}${c.reset}\n`);
    return join(PROJECTS_DIR, projects[0]);
  }
  console.log(`\n  ${c.cyan}Available projects:${c.reset}`);
  projects.forEach((p, i) => console.log(`    ${c.violet}${i + 1}.${c.reset} ${p}`));
  const choice = prompt(`\n  ${c.white}Select project [1-${projects.length}]:${c.reset} `);
  const idx = parseInt(choice) - 1;
  if (idx >= 0 && idx < projects.length) {
    return join(PROJECTS_DIR, projects[idx]);
  }
  console.log(`  ${c.red}Invalid selection.${c.reset}`);
  return null;
}

// ─── Pretty Report (Terminal) ───

function printReport(report: ReturnType<typeof analyze>, projectDir: string) {
  const ln = () => console.log("");
  const divider = `  ${c.dim}${"─".repeat(50)}${c.reset}`;

  ln();
  console.log(`  ${c.bgViolet}${c.white}${c.bold} SITE ANALYSIS REPORT ${c.reset}`);
  ln();
  console.log(`  ${c.gray}Project:${c.reset}  ${c.bold}${projectDir.split("/").pop()}${c.reset}`);
  console.log(`  ${c.gray}Type:${c.reset}     ${c.cyan}${report.templateType}${c.reset}`);
  console.log(`  ${c.gray}Files:${c.reset}    ${c.white}${report.assets.length}${c.reset}`);
  ln();
  console.log(divider);

  // ── Pages (always show) ──
  console.log(`  ${c.pink}${c.bold}Pages${c.reset} ${c.dim}(${report.pages.length})${c.reset}`);
  for (const page of report.pages) {
    console.log(`    ${c.violet}>${c.reset} ${c.bold}${page.path}${c.reset} ${c.dim}— "${page.title}"${c.reset}`);
    if (page.links.length) {
      console.log(`      ${c.gray}Links: ${page.links.slice(0, 5).join(", ")}${page.links.length > 5 ? ` +${page.links.length - 5} more` : ""}${c.reset}`);
    }
  }
  ln();
  console.log(divider);

  // ── Sections (collapsed) ──
  const totalSections = report.sections.length;
  const byPage = new Map<string, typeof report.sections>();
  for (const sec of report.sections) {
    if (!byPage.has(sec.page)) byPage.set(sec.page, []);
    byPage.get(sec.page)!.push(sec);
  }
  console.log(`  ${c.pink}${c.bold}Sections${c.reset} ${c.dim}(${totalSections} total across ${byPage.size} pages)${c.reset}`);
  for (const [page, secs] of byPage) {
    const preview = secs.slice(0, 4).map(s => {
      const name = s.label || "Section";
      return `${c.cyan}${name}${c.reset}`;
    }).join(`${c.dim} → ${c.reset}`);
    const more = secs.length > 4 ? ` ${c.dim}+${secs.length - 4} more${c.reset}` : "";
    console.log(`    ${c.violet}>${c.reset} ${c.bold}${page}${c.reset}`);
    console.log(`      ${preview}${more}`);
  }
  console.log(`    ${c.dim}(Run option 3 "View full report" to see all details)${c.reset}`);
  ln();
  console.log(divider);

  // ── Colors (top 5) ──
  console.log(`  ${c.pink}${c.bold}Colors${c.reset} ${c.dim}(${report.colors.length} unique)${c.reset}`);
  for (const col of report.colors.slice(0, 8)) {
    const swatch = colorSwatch(col.value);
    console.log(`    ${swatch} ${c.white}${col.value.padEnd(22)}${c.reset} ${c.dim}x${col.count} in ${col.sources.slice(0, 2).join(", ")}${c.reset}`);
  }
  if (report.colors.length > 8) {
    console.log(`    ${c.dim}...and ${report.colors.length - 8} more colors${c.reset}`);
  }
  ln();
  console.log(divider);

  // ── Fonts ──
  console.log(`  ${c.pink}${c.bold}Fonts${c.reset} ${c.dim}(${report.fonts.length})${c.reset}`);
  if (report.fonts.length === 0) {
    console.log(`    ${c.dim}(none detected)${c.reset}`);
  } else {
    for (const f of report.fonts) console.log(`    ${c.cyan}>${c.reset} ${f}`);
  }
  ln();
  console.log(divider);

  // ── Images (collapsed) ──
  console.log(`  ${c.pink}${c.bold}Images${c.reset} ${c.dim}(${report.images.length})${c.reset}`);
  for (const img of report.images.slice(0, 5)) {
    const size = img.sizeKB > 0 ? `${c.yellow}${img.sizeKB}KB${c.reset}` : `${c.dim}0KB${c.reset}`;
    console.log(`    ${c.violet}>${c.reset} ${img.path} ${size}`);
  }
  if (report.images.length > 5) {
    console.log(`    ${c.dim}...and ${report.images.length - 5} more images${c.reset}`);
  }
  ln();
  console.log(divider);

  // ── Assets summary (compact) ──
  const byType = new Map<string, number>();
  for (const a of report.assets) byType.set(a.type, (byType.get(a.type) || 0) + 1);
  const assetParts: string[] = [];
  for (const [type, count] of byType) {
    const color = type === "css" ? c.cyan : type === "js" ? c.yellow : type === "image" ? c.green : type === "font" ? c.orange : c.gray;
    assetParts.push(`${color}${type}:${count}${c.reset}`);
  }
  console.log(`  ${c.pink}${c.bold}Assets${c.reset}  ${assetParts.join("  ")}`);
  ln();
}

function colorSwatch(value: string): string {
  // Try to convert hex to ANSI 256 color for a rough swatch
  const hex = value.replace("#", "");
  if (/^[0-9a-f]{3,6}$/i.test(hex)) {
    let r: number, g: number, b: number;
    if (hex.length === 3) {
      r = parseInt(hex[0] + hex[0], 16);
      g = parseInt(hex[1] + hex[1], 16);
      b = parseInt(hex[2] + hex[2], 16);
    } else {
      r = parseInt(hex.slice(0, 2), 16);
      g = parseInt(hex.slice(2, 4), 16);
      b = parseInt(hex.slice(4, 6), 16);
    }
    return `\x1b[48;2;${r};${g};${b}m  ${c.reset}`;
  }
  return `${c.bgDark}  ${c.reset}`;
}

// ─── Full Report (for detail view) ───

function printFullReport(report: ReturnType<typeof analyze>) {
  const ln = () => console.log("");
  const divider = `  ${c.dim}${"─".repeat(50)}${c.reset}`;

  ln();
  console.log(`  ${c.bgViolet}${c.white}${c.bold} FULL REPORT ${c.reset}`);
  ln();

  // All sections detail
  console.log(`  ${c.pink}${c.bold}All Sections${c.reset}`);
  console.log(divider);
  const byPage = new Map<string, typeof report.sections>();
  for (const sec of report.sections) {
    if (!byPage.has(sec.page)) byPage.set(sec.page, []);
    byPage.get(sec.page)!.push(sec);
  }
  for (const [page, secs] of byPage) {
    console.log(`\n  ${c.cyan}${c.bold}${page}${c.reset}`);
    for (const sec of secs) {
      const label = sec.label || "Section";
      const heading = sec.heading ? `${c.white}"${sec.heading.slice(0, 50)}"${c.reset}` : "";
      const techRef = `${c.dim}<${sec.tag}>${sec.id ? ` #${sec.id}` : ""}${sec.classes ? ` .${sec.classes.split(" ")[0]}` : ""}${c.reset}`;
      console.log(`    ${c.green}${String(sec.order + 1).padStart(2)}.${c.reset} ${c.pink}${c.bold}${label}${c.reset} ${heading}`);
      console.log(`        ${techRef}`);
    }
  }
  ln();
  console.log(divider);

  // All colors
  console.log(`\n  ${c.pink}${c.bold}All Colors${c.reset} ${c.dim}(${report.colors.length})${c.reset}`);
  for (const col of report.colors) {
    const swatch = colorSwatch(col.value);
    console.log(`    ${swatch} ${c.white}${col.value.padEnd(28)}${c.reset} ${c.dim}x${col.count}  ${col.sources.join(", ")}${c.reset}`);
  }
  ln();
  console.log(divider);

  // All images
  console.log(`\n  ${c.pink}${c.bold}All Images${c.reset} ${c.dim}(${report.images.length})${c.reset}`);
  for (const img of report.images) {
    const size = img.sizeKB > 0 ? `${c.yellow}${img.sizeKB}KB${c.reset}` : `${c.dim}0KB${c.reset}`;
    console.log(`    ${c.violet}>${c.reset} ${img.path} ${size} ${c.dim}in ${img.usedIn.join(", ")}${c.reset}`);
  }
  ln();
  console.log(divider);

  // All CSS/JS files
  if (report.cssFiles.length) {
    console.log(`\n  ${c.pink}${c.bold}CSS Files${c.reset}`);
    for (const f of report.cssFiles) console.log(`    ${c.cyan}>${c.reset} ${f}`);
  }
  if (report.jsFiles.length) {
    console.log(`\n  ${c.pink}${c.bold}JS Files${c.reset}`);
    for (const f of report.jsFiles) console.log(`    ${c.yellow}>${c.reset} ${f}`);
  }
  ln();
}

// ─── Markdown Report (for file save) ───

function generateReportMarkdown(report: ReturnType<typeof analyze>, projectDir: string): string {
  const lines: string[] = [];
  lines.push(`# Site Analysis Report`);
  lines.push(`**Project:** ${projectDir}`);
  lines.push(`**Template Type:** ${report.templateType}`);
  lines.push(`**Total Files:** ${report.assets.length}`);
  lines.push("");
  lines.push(`## Pages (${report.pages.length})`);
  for (const page of report.pages) {
    lines.push(`- **${page.path}** — "${page.title}"`);
    if (page.links.length) lines.push(`  Links to: ${page.links.join(", ")}`);
  }
  lines.push("");
  lines.push(`## Sections`);
  const byPage = new Map<string, typeof report.sections>();
  for (const sec of report.sections) {
    if (!byPage.has(sec.page)) byPage.set(sec.page, []);
    byPage.get(sec.page)!.push(sec);
  }
  for (const [page, secs] of byPage) {
    lines.push(`### ${page}`);
    for (const sec of secs) {
      const techRef = [sec.tag, sec.id ? `#${sec.id}` : "", sec.classes ? `.${sec.classes.split(" ")[0]}` : ""].filter(Boolean).join("");
      const heading = sec.heading ? ` — "${sec.heading.slice(0, 60)}"` : "";
      lines.push(`${sec.order + 1}. **${sec.label || "Section"}**${heading}  \`<${techRef}>\``);
    }
    lines.push("");
  }
  lines.push(`## Colors (${report.colors.length} unique)`);
  lines.push("| Color | Count | Used In |");
  lines.push("|-------|-------|---------|");
  for (const col of report.colors) lines.push(`| \`${col.value}\` | ${col.count} | ${col.sources.join(", ")} |`);
  lines.push("");
  lines.push(`## Fonts (${report.fonts.length})`);
  for (const f of report.fonts) lines.push(`- ${f}`);
  lines.push("");
  lines.push(`## Images (${report.images.length})`);
  lines.push("| Path | Size | Used In |");
  lines.push("|------|------|---------|");
  for (const img of report.images) lines.push(`| \`${img.path}\` | ${img.sizeKB}KB | ${img.usedIn.join(", ")} |`);
  lines.push("");
  const assetsByType = new Map<string, number>();
  for (const a of report.assets) assetsByType.set(a.type, (assetsByType.get(a.type) || 0) + 1);
  lines.push(`## Assets`);
  for (const [type, count] of assetsByType) lines.push(`- **${type}**: ${count} files`);
  if (report.cssFiles.length) { lines.push(""); lines.push("## CSS Files"); for (const f of report.cssFiles) lines.push(`- \`${f}\``); }
  if (report.jsFiles.length) { lines.push(""); lines.push("## JS Files"); for (const f of report.jsFiles) lines.push(`- \`${f}\``); }
  return lines.join("\n");
}

// ─── Interactive Mode ───

async function interactive() {
  console.log(`
  ${c.gray}      ▄███▄${c.reset}
  ${c.orange}    ▐${c.gray}▄▄▄▄▄▄▄${c.orange}▌${c.reset}      ${c.white}${c.bold}Site Customizer${c.reset}  ${c.dim}v1.0${c.reset}
  ${c.gray}    ▐${c.white}(${c.gray}●${c.white})${c.gray}═${c.white}(${c.gray}●${c.white})${c.gray}▌${c.reset}      ${c.dim}Template Analysis & Preview Tool${c.reset}
  ${c.gray}    ▐${c.pink} ♥${c.gray} ▽ ${c.pink}♥${c.gray} ▌${c.reset}      ${c.dim}${process.cwd()}${c.reset}
  ${c.gray}    ▐▄▄▄▄▄▄▄▌${c.reset}
  ${c.violet}      ██ ██${c.reset}
  ${c.cyan}      ▀▀ ▀▀${c.reset}
`);

  // Store last analyzed report for detail view
  let lastReport: ReturnType<typeof analyze> | null = null;
  let lastProjectDir: string | null = null;

  while (true) {
    const projects = listProjects();
    if (projects.length > 0) {
      console.log(`  ${c.gray}Projects:${c.reset} ${projects.map(p => `${c.cyan}${p}${c.reset}`).join(", ")}`);
    }

    console.log(`
  ${c.pink}${c.bold}1${c.reset} ${c.white}Import template (.zip)${c.reset}  ${c.dim}→ auto analyze + branding + preview${c.reset}
  ${c.violet}${c.bold}2${c.reset} ${c.white}Preview + Editor${c.reset}      ${c.dim}→ เปิดเว็บ + แก้ branding${c.reset}
  ${c.cyan}${c.bold}3${c.reset} ${c.white}Apply branding${c.reset}        ${c.dim}→ แก้ template ตาม branding${c.reset}
  ${c.yellow}${c.bold}4${c.reset} ${c.white}Re-analyze${c.reset}           ${c.dim}→ วิเคราะห์ + export branding ใหม่${c.reset}
  ${c.orange}${c.bold}5${c.reset} ${c.white}Undo last edit${c.reset}
  ${c.red}${c.bold}6${c.reset} ${c.white}Reset to original${c.reset}
  ${c.dim}0  Exit${c.reset}
`);

    const choice = prompt(`  ${c.pink}>${c.reset} `);

    switch (choice) {
      case "1": {
        const zipPath = prompt(`\n  ${c.cyan}Drag .zip file here:${c.reset} `).replace(/\\ /g, " ").replace(/^['"]|['"]$/g, "");
        if (!zipPath) { console.log(`  ${c.dim}Cancelled.${c.reset}`); break; }
        const resolvedPath = resolve(zipPath);
        const name = prompt(`  ${c.cyan}Project name${c.reset} ${c.dim}(Enter = auto):${c.reset} `);
        try {
          const projectDir = setup(resolvedPath, name || undefined);
          console.log(`\n  ${c.yellow}Analyzing...${c.reset}\n`);
          const report = analyze(projectDir);

          // Save report
          await Bun.write(join(projectDir, "site-report.md"), generateReportMarkdown(report, projectDir));
          await Bun.write(join(projectDir, "site-config.json"), JSON.stringify(report, null, 2));

          // Auto export branding
          const branding = exportBranding(report, projectDir);
          const projectName = projectDir.split("/").pop()!
            .replace(/^themeforest-\w+-/, "")
            .replace(/-html-template$/, "")
            .replace(/-template$/, "")
            .replace(/-/g, "-");
          const brandingFileName = `${projectName}-branding.json`;
          await Bun.write(join(projectDir, brandingFileName), JSON.stringify(branding, null, 2));

          // Show summary
          printReport(report, projectDir);
          lastReport = report;
          lastProjectDir = projectDir;

          console.log(`  ${c.green}${c.bold}Branding exported:${c.reset} ${c.cyan}${brandingFileName}${c.reset}`);
          console.log(`  ${c.dim}${Object.keys(branding.colors).length} colors, ${Object.keys(branding.fonts).length} fonts, ${Object.keys(branding.texts).length} texts, ${Object.keys(branding.images).length} images${c.reset}\n`);

          // Auto start preview + editor
          const port = prompt(`  ${c.green}Start preview + editor? Port${c.reset} ${c.dim}(Enter = 3000, n = skip):${c.reset} `);
          if (port.toLowerCase() !== "n") {
            console.log(`\n  ${c.green}Starting preview + editor...${c.reset}\n`);
            serve(projectDir, parseInt(port) || 3000);
            return;
          }
        } catch (e: any) {
          console.error(`  ${c.red}Error: ${e.message}${c.reset}`);
        }
        break;
      }

      case "2": {
        const projectDir = pickProject();
        if (!projectDir) break;
        const port = prompt(`  ${c.cyan}Port${c.reset} ${c.dim}(Enter = 3000):${c.reset} `);
        console.log(`\n  ${c.green}Starting preview + editor...${c.reset}\n`);
        serve(projectDir, parseInt(port) || 3000);
        return;
      }

      case "3": {
        const projectDir = pickProject();
        if (!projectDir) break;
        const brandingFile = readdirSync(projectDir).find(f => f.endsWith("-branding.json")) || "branding.json";
        const brandingPath = join(projectDir, brandingFile);
        if (!existsSync(brandingPath)) {
          console.log(`\n  ${c.red}No branding file found.${c.reset} Import a template first (option 1).\n`);
          break;
        }
        const confirmApply = prompt(`\n  ${c.yellow}Apply branding changes? (backup auto-created) (Y/n):${c.reset} `);
        if (confirmApply.toLowerCase() === "n") {
          console.log(`  ${c.dim}Cancelled.${c.reset}`);
          break;
        }
        try {
          const result = applyBranding(projectDir);
          console.log(`\n  ${c.green}${c.bold}Done!${c.reset} ${c.white}${result.filesChanged} files updated.${c.reset}\n`);
          for (const change of result.changes.slice(0, 20)) {
            console.log(`    ${c.violet}>${c.reset} ${change}`);
          }
          if (result.changes.length > 20) {
            console.log(`    ${c.dim}...and ${result.changes.length - 20} more files${c.reset}`);
          }
          console.log(`\n  ${c.dim}Refresh browser to see changes. Option 5 to undo.${c.reset}\n`);
        } catch (e: any) {
          console.error(`  ${c.red}Error: ${e.message}${c.reset}`);
        }
        break;
      }

      case "4": {
        const projectDir = pickProject();
        if (!projectDir) break;
        console.log(`\n  ${c.yellow}Analyzing...${c.reset}\n`);
        const report = analyze(projectDir);
        await Bun.write(join(projectDir, "site-report.md"), generateReportMarkdown(report, projectDir));
        await Bun.write(join(projectDir, "site-config.json"), JSON.stringify(report, null, 2));
        // Re-export branding
        const branding = exportBranding(report, projectDir);
        const projectName = projectDir.split("/").pop()!
          .replace(/^themeforest-\w+-/, "").replace(/-html-template$/, "").replace(/-template$/, "");
        await Bun.write(join(projectDir, `${projectName}-branding.json`), JSON.stringify(branding, null, 2));
        printReport(report, projectDir);
        console.log(`  ${c.green}Branding re-exported:${c.reset} ${c.cyan}${projectName}-branding.json${c.reset}\n`);
        lastReport = report;
        lastProjectDir = projectDir;
        break;
      }

      case "5": {
        const projectDir = pickProject();
        if (!projectDir) break;
        try {
          undo(projectDir);
          console.log(`  ${c.green}Done!${c.reset}`);
        } catch (e: any) {
          console.error(`  ${c.red}Error: ${e.message}${c.reset}`);
        }
        break;
      }

      case "6": {
        const projectDir = pickProject();
        if (!projectDir) break;
        const confirm = prompt(`  ${c.red}Are you sure? This resets ALL changes. (y/N):${c.reset} `);
        if (confirm.toLowerCase() === "y") {
          reset(projectDir);
          console.log(`  ${c.green}Done!${c.reset}`);
        } else {
          console.log(`  ${c.dim}Cancelled.${c.reset}`);
        }
        break;
      }

      case "0":
      case "q":
      case "exit":
        console.log(`\n  ${c.dim}Bye!${c.reset}\n`);
        process.exit(0);

      default:
        console.log(`  ${c.red}Invalid option.${c.reset}`);
    }
  }
}

// ─── Entry ───

const command = process.argv[2];

if (!command) {
  await interactive();
} else {
  const arg = process.argv[3];
  const arg2 = process.argv[4];

  switch (command) {
    case "init": {
      if (!arg) { console.error("Missing zip path."); break; }
      const projectDir = setup(arg, arg2);
      console.log("\nAnalyzing...\n");
      const report = analyze(projectDir);
      await Bun.write(join(projectDir, "site-report.md"), generateReportMarkdown(report, projectDir));
      await Bun.write(join(projectDir, "site-config.json"), JSON.stringify(report, null, 2));
      const branding = exportBranding(report, projectDir);
      const pName = projectDir.split("/").pop()!.replace(/^themeforest-\w+-/, "").replace(/-html-template$/, "").replace(/-template$/, "");
      await Bun.write(join(projectDir, `${pName}-branding.json`), JSON.stringify(branding, null, 2));
      printReport(report, projectDir);
      console.log(`Branding exported: ${pName}-branding.json`);
      break;
    }
    case "analyze": {
      if (!arg) { console.error("Missing project dir."); break; }
      const report = analyze(arg);
      await Bun.write(join(arg, "site-report.md"), generateReportMarkdown(report, arg));
      await Bun.write(join(arg, "site-config.json"), JSON.stringify(report, null, 2));
      printReport(report, arg);
      break;
    }
    case "preview": {
      if (!arg) { console.error("Missing project dir."); break; }
      serve(arg, parseInt(arg2 || "3000"));
      break;
    }
    case "brand": {
      if (!arg) { console.error("Missing project dir."); break; }
      const report = analyze(arg);
      const branding = exportBranding(report, arg);
      await Bun.write(join(arg, "branding.json"), JSON.stringify(branding, null, 2));
      console.log(`Exported branding.json → ${Object.keys(branding.colors).length} colors, ${Object.keys(branding.fonts).length} fonts`);
      break;
    }
    case "apply": {
      if (!arg) { console.error("Missing project dir."); break; }
      const result = applyBranding(arg);
      console.log(`Applied! ${result.filesChanged} files updated.`);
      for (const change of result.changes) console.log(`  > ${change}`);
      break;
    }
    case "undo": { if (!arg) { console.error("Missing project dir."); break; } undo(arg); break; }
    case "reset": { if (!arg) { console.error("Missing project dir."); break; } reset(arg); break; }
    default:
      console.log(`\nSite Customizer — run ${c.cyan}bun run index.ts${c.reset} for interactive mode\n`);
  }
}
