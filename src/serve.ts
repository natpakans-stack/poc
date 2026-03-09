import { existsSync, readdirSync, readFileSync, writeFileSync } from "fs";
import { join, extname } from "path";
import { applyBranding, resetBranding } from "./branding";

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".htm": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".pdf": "application/pdf",
  ".xml": "application/xml",
  ".txt": "text/plain",
  ".php": "text/html", // serve PHP as HTML for preview
};

// Folders likely containing the actual template (prioritized)
const TEMPLATE_FOLDER_NAMES = [
  "template", "html", "site", "dist", "build", "public", "www", "web", "src",
];
// Folders to skip (documentation, source files, etc.)
const SKIP_FOLDER_NAMES = [
  "documentation", "docs", "doc", "psd", "sketch", "figma", "xd",
  "license", "licenses", "changelog", "help",
];

function findServeRoot(workingDir: string): string {
  // If index.html exists at root, use root
  if (existsSync(join(workingDir, "index.html"))) return workingDir;

  // Collect all subdirs with index.html
  const candidates: { name: string; path: string; priority: number }[] = [];
  try {
    for (const entry of readdirSync(workingDir, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
      const sub = join(workingDir, entry.name);
      const lower = entry.name.toLowerCase();

      // Skip non-template folders
      if (SKIP_FOLDER_NAMES.some(s => lower.includes(s))) continue;

      if (existsSync(join(sub, "index.html"))) {
        // Priority: known template names first, then by HTML file count
        const isKnown = TEMPLATE_FOLDER_NAMES.some(t => lower.includes(t));
        const htmlCount = readdirSync(sub).filter(f => f.endsWith(".html")).length;
        candidates.push({
          name: entry.name,
          path: sub,
          priority: isKnown ? 1000 + htmlCount : htmlCount,
        });
      }

      // Also check 2 levels deep (e.g. Template/HTML/)
      try {
        for (const sub2 of readdirSync(sub, { withFileTypes: true })) {
          if (!sub2.isDirectory() || sub2.name.startsWith(".")) continue;
          const sub2Path = join(sub, sub2.name);
          const lower2 = sub2.name.toLowerCase();
          if (SKIP_FOLDER_NAMES.some(s => lower2.includes(s))) continue;
          if (existsSync(join(sub2Path, "index.html"))) {
            const isKnown = TEMPLATE_FOLDER_NAMES.some(t => lower2.includes(t));
            const htmlCount = readdirSync(sub2Path).filter(f => f.endsWith(".html")).length;
            candidates.push({
              name: `${entry.name}/${sub2.name}`,
              path: sub2Path,
              priority: isKnown ? 1000 + htmlCount : htmlCount,
            });
          }
        }
      } catch {}
    }
  } catch {}

  if (candidates.length > 0) {
    // Pick highest priority (most HTML files in a known template folder)
    candidates.sort((a, b) => b.priority - a.priority);
    const best = candidates[0];
    console.log(`  Found template in ${best.name}/ (${best.priority > 1000 ? best.priority - 1000 : best.priority} HTML pages)`);
    return best.path;
  }

  return workingDir;
}

export function serve(projectDir: string, port = 3000) {
  const workingDir = join(projectDir, "working");
  if (!existsSync(workingDir)) {
    throw new Error(`No working/ directory found in ${projectDir}`);
  }
  const serveRoot = findServeRoot(workingDir);

  // Find branding file
  const brandingFile = readdirSync(projectDir).find(f => f.endsWith("-branding.json")) || "branding.json";
  const brandingPath = join(projectDir, brandingFile);

  // Try up to 10 ports if the requested one is in use
  let server: ReturnType<typeof Bun.serve> | null = null;
  let tryPort = port;
  for (let i = 0; i < 10; i++) {
    try {
      server = Bun.serve({
        port: tryPort,
        async fetch(req) {
          const url = new URL(req.url);

          // Editor page
          if (url.pathname === "/editor") {
            return new Response(generateEditorHTML(serveRoot), {
              headers: { "Content-Type": "text/html; charset=utf-8" },
            });
          }

          // API: load branding
          if (url.pathname === "/api/branding" && req.method === "GET") {
            if (existsSync(brandingPath)) {
              const data = readFileSync(brandingPath, "utf-8");
              return new Response(data, {
                headers: { "Content-Type": "application/json" },
              });
            }
            return new Response("{}", { status: 404 });
          }

          // API: save branding
          if (url.pathname === "/api/branding" && req.method === "POST") {
            try {
              const body = await req.json();
              writeFileSync(brandingPath, JSON.stringify(body, null, 2), "utf-8");
              return new Response(JSON.stringify({ ok: true }), {
                headers: { "Content-Type": "application/json" },
              });
            } catch (e: any) {
              return new Response(JSON.stringify({ error: e.message }), { status: 500 });
            }
          }

          // API: upload image replacement
          if (url.pathname === "/api/upload-image" && req.method === "POST") {
            try {
              const formData = await req.formData();
              const file = formData.get("file") as File | null;
              const targetPath = formData.get("path") as string | null;
              if (!file || !targetPath) return new Response(JSON.stringify({ error: "Missing file or path" }), { status: 400 });
              const dest = join(workingDir, targetPath);
              if (!dest.startsWith(workingDir)) return new Response(JSON.stringify({ error: "Invalid path" }), { status: 403 });
              const { mkdirSync } = await import("fs");
              // Save to working/ for immediate preview
              const dir = dest.substring(0, dest.lastIndexOf("/"));
              mkdirSync(dir, { recursive: true });
              const fileBuffer = await file.arrayBuffer();
              await Bun.write(dest, fileBuffer);
              // Also save to _uploads/ for persistence across applies
              const uploadsDir = join(projectDir, "_uploads");
              const uploadDest = join(uploadsDir, targetPath);
              const uploadDir = uploadDest.substring(0, uploadDest.lastIndexOf("/"));
              mkdirSync(uploadDir, { recursive: true });
              await Bun.write(uploadDest, fileBuffer);
              return new Response(JSON.stringify({ ok: true, path: targetPath, size: file.size }), {
                headers: { "Content-Type": "application/json" },
              });
            } catch (e: any) {
              return new Response(JSON.stringify({ error: e.message }), { status: 500 });
            }
          }

          // API: reset to original state
          if (url.pathname === "/api/reset" && req.method === "POST") {
            try {
              const config = resetBranding(projectDir);
              if (!config) return new Response(JSON.stringify({ error: "No branding file" }), { status: 404 });
              return new Response(JSON.stringify({ ok: true, data: config }), {
                headers: { "Content-Type": "application/json" },
              });
            } catch (e: any) {
              return new Response(JSON.stringify({ error: e.message }), { status: 500 });
            }
          }

          // API: serve image from workingDir (bypasses serveRoot)
          if (url.pathname.startsWith("/api/image/")) {
            const imgPath = decodeURIComponent(url.pathname.slice("/api/image/".length));
            const fullPath = join(workingDir, imgPath);
            if (!fullPath.startsWith(workingDir) || !existsSync(fullPath)) {
              return new Response("Not found", { status: 404 });
            }
            const ext = extname(fullPath).toLowerCase();
            const ct = MIME_TYPES[ext] || "application/octet-stream";
            return new Response(Bun.file(fullPath), {
              headers: { "Content-Type": ct, "Cache-Control": "no-store" },
            });
          }

          // API: save + apply branding in one step
          if (url.pathname === "/api/apply" && req.method === "POST") {
            try {
              const body = await req.json();
              writeFileSync(brandingPath, JSON.stringify(body, null, 2), "utf-8");
              const result = applyBranding(projectDir);
              return new Response(JSON.stringify({ ok: true, filesChanged: result.filesChanged, changes: result.changes }), {
                headers: { "Content-Type": "application/json" },
              });
            } catch (e: any) {
              return new Response(JSON.stringify({ error: e.message }), { status: 500 });
            }
          }

          return handleRequest(req, serveRoot);
        },
      });
      break;
    } catch (e: any) {
      if (e?.code === "EADDRINUSE") {
        console.log(`  Port ${tryPort} is in use, trying ${tryPort + 1}...`);
        tryPort++;
      } else {
        throw e;
      }
    }
  }

  if (!server) {
    throw new Error(`Could not find an available port (tried ${port}-${tryPort})`);
  }

  const portNum = server.port;
  const url = `http://localhost:${portNum}`;
  const editorUrl = `http://localhost:${portNum}/editor`;

  console.log(`
  ┌─────────────────────────────────────────────────┐
  │                                                 │
  │   Preview server running!                       │
  │   ${url.padEnd(46)}│
  │   ${editorUrl.padEnd(46)}│
  │                                                 │
  ├─────────────────────────────────────────────────┤
  │                                                 │
  │   1. Open the Preview URL in your browser       │
  │   2. Open /editor to customize branding         │
  │   3. Keep this terminal open                    │
  │                                                 │
  │   Stop server: Ctrl+C                           │
  │                                                 │
  └─────────────────────────────────────────────────┘
`);
  console.log(`  Serving: ${serveRoot}\n`);

  return server;
}

// ─── Visual Branding Editor ───

function generateEditorHTML(serveRoot: string): string {
  return `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Branding Editor</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Inter', sans-serif; background: #F8F8F9; color: #1B1D22; min-height: 100vh; padding-bottom: 60px; }

  .header { background: #fff; border-bottom: 1px solid #EBECEF; padding: 16px 24px; display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 100; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
  .header h1 { font-size: 18px; font-weight: 700; color: #1B1D22; }
  .header .subtitle { font-size: 13px; color: #6A6E83; margin-left: 12px; }
  .header-actions { display: flex; gap: 8px; }
  .reset-wrap { display: flex; gap: 4px; align-items: center; }

  .btn { padding: 8px 20px; border-radius: 8px; border: none; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.15s; }
  .btn-sm { padding: 5px 12px; font-size: 12px; }
  .btn-xs { padding: 4px 10px; font-size: 11px; border-radius: 6px; }
  .btn-primary { background: #EC599D; color: #fff; }
  .btn-primary:hover { background: #d44d8b; }
  .btn-primary:active { transform: scale(0.97); }
  .btn-ghost { background: #fff; color: #6A6E83; border: 1px solid #EBECEF; }
  .btn-ghost:hover { background: #F8F8F9; color: #1B1D22; }
  .btn-violet { background: #7279FB; color: #fff; }
  .btn-violet:hover { background: #5b63e0; }

  .toast { position: fixed; bottom: 24px; right: 24px; padding: 12px 20px; border-radius: 10px; font-size: 14px; font-weight: 500; transform: translateY(80px); opacity: 0; transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1); z-index: 200; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
  .toast.show { transform: translateY(0); opacity: 1; }
  .toast-success { background: #F0F8F0; color: #559652; border: 1px solid #559652; }
  .toast-error { background: #FDE9ED; color: #EA244F; border: 1px solid #EA244F; }

  .container { max-width: 960px; margin: 0 auto; padding: 24px; }

  /* Tabs */
  .tabs { display: flex; gap: 4px; margin-bottom: 24px; background: #fff; border: 1px solid #EBECEF; border-radius: 10px; padding: 4px; }
  .tab { padding: 8px 20px; border-radius: 8px; border: none; background: none; color: #6A6E83; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.15s; display: flex; align-items: center; gap: 6px; }
  .tab:hover { color: #1B1D22; background: #F8F8F9; }
  .tab.active { background: #1B1D22; color: #fff; }
  .tab .tab-badge { font-size: 10px; background: #EBECEF; color: #6A6E83; padding: 1px 6px; border-radius: 8px; font-weight: 600; }
  .tab.active .tab-badge { background: rgba(255,255,255,0.2); color: #fff; }

  /* Section panel — clear separation per page/group */
  .section-panel { background: #fff; border: 1px solid #EBECEF; border-radius: 12px; margin-bottom: 16px; overflow: hidden; }
  .section-header { padding: 14px 16px; border-bottom: 1px solid #EBECEF; display: flex; align-items: center; justify-content: space-between; background: #FAFAFA; cursor: pointer; user-select: none; }
  .section-header:hover { background: #F4F4F5; }
  .section-header h3 { font-size: 14px; font-weight: 600; color: #1B1D22; display: flex; align-items: center; gap: 8px; }
  .section-header .section-count { font-size: 11px; color: #6A6E83; font-weight: 400; }
  .section-header .chevron { color: #9A9DAD; transition: transform 0.2s; font-size: 12px; }
  .section-header.collapsed .chevron { transform: rotate(-90deg); }
  .section-body { padding: 16px; }
  .section-body.collapsed { display: none; }
  .section-desc { font-size: 12px; color: #9A9DAD; margin-bottom: 12px; }

  .role-badge { display: inline-block; padding: 2px 8px; border-radius: 6px; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.03em; }
  .role-primary { background: #FDEFF5; color: #EC599D; }
  .role-accent { background: #F1F2FF; color: #7279FB; }
  .role-text { background: #1B1D22; color: #fff; }
  .role-bg { background: #E6F6FC; color: #026486; }
  .role-border { background: #F0F8F0; color: #559652; }
  .role-system { background: #FEF9EB; color: #C69A2A; }
  .role-overlay { background: #EBECEF; color: #6A6E83; }
  .role-subtle { background: #F8F8F9; color: #9A9DAD; border: 1px solid #EBECEF; }
  .role-other { background: #EBECEF; color: #6A6E83; }

  .readonly-tag { display: inline-block; padding: 1px 6px; border-radius: 4px; font-size: 9px; font-weight: 600; background: #EBECEF; color: #9A9DAD; margin-left: 4px; vertical-align: middle; text-transform: uppercase; }
  .section-readonly { opacity: 0.85; }
  .color-readonly .color-swatch { cursor: default; }
  .color-readonly .color-swatch:hover::after { display: none; }
  .color-hex-readonly { font-size: 12px; color: #9A9DAD; font-family: 'SF Mono', monospace; }

  /* Color presets */
  .presets-bar { background: #fff; border: 1px solid #EBECEF; border-radius: 12px; padding: 14px 16px; margin-bottom: 16px; }
  .presets-bar h4 { font-size: 12px; font-weight: 600; color: #6A6E83; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 10px; }
  .presets-grid { display: flex; gap: 8px; flex-wrap: wrap; }
  .preset-card { display: flex; align-items: center; gap: 8px; padding: 8px 14px; border: 1px solid #EBECEF; border-radius: 8px; cursor: pointer; transition: all 0.15s; background: #fff; }
  .preset-card:hover { border-color: #7279FB; background: #F1F2FF; }
  .preset-card .preset-colors { display: flex; gap: 2px; }
  .preset-card .preset-dot { width: 16px; height: 16px; border-radius: 50%; border: 1px solid rgba(0,0,0,0.08); }
  .preset-dot-lg { width: 18px !important; height: 18px !important; }
  .preset-dot-sm { width: 12px !important; height: 12px !important; }
  .preset-card .preset-name { font-size: 12px; font-weight: 500; color: #1B1D22; }

  /* Color Grid */
  .color-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 6px; }
  .color-item { display: flex; align-items: center; gap: 10px; background: #fff; border: 1px solid #EBECEF; border-radius: 10px; padding: 8px 12px; transition: border-color 0.15s; }
  .color-item:hover { border-color: #9A9DAD; }
  .color-item:focus-within { border-color: #EC599D; }
  .color-swatch { width: 40px; height: 40px; border-radius: 8px; border: 2px solid #EBECEF; cursor: pointer; flex-shrink: 0; position: relative; box-shadow: inset 0 0 0 1px rgba(0,0,0,0.08); }
  .color-swatch input[type="color"] { position: absolute; inset: 0; opacity: 0; cursor: pointer; width: 100%; height: 100%; }
  .color-info { flex: 1; min-width: 0; }
  .color-meta { font-size: 10px; color: #9A9DAD; margin-top: 2px; }
  .color-value input { background: none; border: none; color: #1B1D22; font-size: 13px; font-weight: 500; font-family: monospace; width: 100%; outline: none; }
  .color-changed { border-color: #EC599D !important; background: #FDEFF5 !important; }

  /* Fonts */
  .font-toolbar { display: flex; gap: 8px; align-items: center; margin-bottom: 12px; padding: 10px 14px; background: #fff; border: 1px solid #EBECEF; border-radius: 10px; }
  .font-toolbar label { font-size: 12px; color: #6A6E83; white-space: nowrap; }
  .font-toolbar select, .font-toolbar input { background: #F8F8F9; border: 1px solid #EBECEF; color: #1B1D22; padding: 6px 10px; border-radius: 6px; font-size: 13px; outline: none; }
  .font-toolbar select:focus, .font-toolbar input:focus { border-color: #7279FB; }
  .font-item { display: flex; align-items: center; gap: 12px; background: #fff; border: 1px solid #EBECEF; border-radius: 10px; padding: 10px 14px; margin-bottom: 6px; transition: border-color 0.15s; }
  .font-item:focus-within { border-color: #7279FB; }
  .font-item .font-from { font-size: 12px; color: #9A9DAD; min-width: 140px; font-family: monospace; }
  .font-item .arrow { color: #EBECEF; flex-shrink: 0; }
  .font-item select { background: #F8F8F9; border: 1px solid #EBECEF; color: #1B1D22; padding: 6px 10px; border-radius: 6px; font-size: 14px; flex: 1; outline: none; }
  .font-item select:focus { border-color: #7279FB; }
  .font-item.changed { border-color: #7279FB; background: #F1F2FF; }
  .font-item.changed .font-from { text-decoration: line-through; }

  /* Images */
  .image-toolbar { display: flex; gap: 8px; align-items: center; margin-bottom: 12px; flex-wrap: wrap; }
  .image-search { padding: 6px 12px; border: 1px solid #EBECEF; border-radius: 8px; font-size: 13px; width: 200px; outline: none; }
  .image-search:focus { border-color: #7279FB; box-shadow: 0 0 0 2px rgba(114,121,251,0.15); }
  .image-filter-chips { display: flex; gap: 4px; flex-wrap: wrap; flex: 1; }
  .image-filter-chip { padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 500; background: #F8F8F9; color: #6A6E83; border: 1px solid #EBECEF; cursor: pointer; white-space: nowrap; transition: all 0.15s; }
  .image-filter-chip:hover { background: #EBECEF; }
  .image-filter-chip.active { background: #7279FB; color: #fff; border-color: #7279FB; }
  .image-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 10px; }
  .image-card { background: #fff; border: 1px solid #EBECEF; border-radius: 10px; overflow: hidden; transition: border-color 0.15s; position: relative; }
  .image-card:hover { border-color: #9A9DAD; }
  .image-card.hidden { display: none; }
  .image-preview-wrap { position: relative; width: 100%; height: 140px; background: #F8F8F9; cursor: pointer; overflow: hidden; display: flex; align-items: center; justify-content: center; }
  .image-preview-wrap:hover .image-overlay { opacity: 1; }
  .image-preview { max-width: 100%; max-height: 140px; object-fit: contain; display: block; padding: 6px; }
  .image-preview-placeholder { width: 100%; height: 140px; background: #F8F8F9; display: flex; align-items: center; justify-content: center; color: #9A9DAD; font-size: 12px; }
  .image-overlay { position: absolute; inset: 0; background: rgba(16,17,20,0.5); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; opacity: 0; transition: opacity 0.2s; border-radius: 0; }
  .image-overlay svg { width: 24px; height: 24px; fill: none; stroke: #fff; stroke-width: 2; }
  .image-overlay span { color: #fff; font-size: 12px; font-weight: 600; }
  .image-page-tags { position: absolute; top: 4px; left: 4px; display: flex; flex-wrap: wrap; gap: 2px; z-index: 2; pointer-events: none; }
  .image-page-tag { padding: 1px 6px; border-radius: 4px; font-size: 9px; font-weight: 600; background: rgba(114,121,251,0.85); color: #fff; backdrop-filter: blur(4px); white-space: nowrap; max-width: 120px; overflow: hidden; text-overflow: ellipsis; }
  .image-details { padding: 8px 10px; }
  .image-name { font-size: 12px; font-weight: 500; color: #1B1D22; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .image-dim { font-size: 10px; color: #9A9DAD; margin-top: 2px; }
  .image-pages { font-size: 10px; color: #6A6E83; margin-top: 2px; }
  .image-card.changed { border-color: #7279FB; }
  .image-card.uploading .image-preview-wrap::after { content: 'Uploading...'; position: absolute; inset: 0; background: rgba(114,121,251,0.85); display: flex; align-items: center; justify-content: center; color: #fff; font-size: 13px; font-weight: 600; }

  /* Radius */
  .radius-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 8px; }
  .radius-item { display: flex; align-items: center; gap: 12px; background: #fff; border: 1px solid #EBECEF; border-radius: 10px; padding: 10px 14px; transition: border-color 0.15s; }
  .radius-item:hover { border-color: #9A9DAD; }
  .radius-item:focus-within { border-color: #EC599D; }
  .radius-preview { width: 44px; height: 44px; background: #EC599D; flex-shrink: 0; transition: border-radius 0.2s; }
  .radius-info { flex: 1; min-width: 0; }
  .radius-value { display: flex; align-items: center; gap: 6px; }
  .radius-value input { background: none; border: none; color: #1B1D22; font-size: 14px; font-weight: 500; font-family: monospace; width: 80px; outline: none; }
  .radius-meta { font-size: 10px; color: #9A9DAD; margin-top: 2px; }
  .radius-item.changed { border-color: #EC599D; background: #FDEFF5; }

  /* Component chips */
  .comp-chips { display: flex; flex-wrap: wrap; gap: 3px; margin-top: 3px; }
  .comp-chip { display: inline-block; padding: 1px 6px; border-radius: 4px; font-size: 9px; font-weight: 600; background: #F1F2FF; color: #7279FB; white-space: nowrap; }

  /* Text items */
  .input-item { display: flex; align-items: center; gap: 12px; background: #fff; border: 1px solid #EBECEF; border-radius: 10px; padding: 10px 14px; margin-bottom: 6px; transition: border-color 0.15s; }
  .input-item:focus-within { border-color: #7279FB; }
  .input-item .label { font-size: 12px; color: #9A9DAD; min-width: 140px; font-family: monospace; }
  .input-item .arrow { color: #EBECEF; flex-shrink: 0; }
  .input-item input { background: none; border: none; color: #1B1D22; font-size: 14px; font-weight: 500; flex: 1; outline: none; }
  .input-item.changed { border-color: #7279FB; background: #F1F2FF; }

  .tab-content { display: none; }
  .tab-content.active { display: block; }
  .empty-state { text-align: center; padding: 40px; color: #9A9DAD; font-size: 14px; }
  .status-bar { position: fixed; bottom: 0; left: 0; right: 0; background: #fff; border-top: 1px solid #EBECEF; padding: 8px 24px; display: flex; align-items: center; justify-content: space-between; font-size: 12px; color: #6A6E83; }
  .changes-count { color: #EC599D; font-weight: 600; }

  /* Hidden file input */
  .hidden-input { display: none; }
</style>
</head>
<body>
<div class="header">
  <div style="display:flex;align-items:baseline;">
    <h1>Branding Editor</h1>
    <span class="subtitle">Visual customization tool</span>
  </div>
  <div class="header-actions">
    <div class="reset-wrap">
      <button class="btn btn-ghost" onclick="resetTab()">Reset Tab</button>
      <button class="btn btn-ghost btn-xs" onclick="if(confirm('Reset ทั้งหมดกลับค่าเดิม + ไฟล์เดิม?')) resetAll()" title="Reset ทั้งหมด รวมไฟล์">Reset All</button>
    </div>
    <button class="btn btn-ghost" id="saveBtn" onclick="saveBranding()">Save Draft</button>
    <button class="btn btn-primary" id="applyBtn" onclick="saveAndApply()">Save & Apply</button>
  </div>
</div>

<div class="container">
  <div class="tabs">
    <button class="tab active" onclick="switchTab('colors', this)">Colors <span class="tab-badge" id="badge-colors">0</span></button>
    <button class="tab" onclick="switchTab('fonts', this)">Fonts <span class="tab-badge" id="badge-fonts">0</span></button>
    <button class="tab" onclick="switchTab('images', this)">Images <span class="tab-badge" id="badge-images">0</span></button>
    <button class="tab" onclick="switchTab('radii', this)">Radius <span class="tab-badge" id="badge-radii">0</span></button>
  </div>
  <div id="tab-colors" class="tab-content active"></div>
  <div id="tab-fonts" class="tab-content"></div>
  <div id="tab-images" class="tab-content"></div>
  <div id="tab-radii" class="tab-content"></div>
  <div id="loading" class="empty-state">Loading branding data...</div>
</div>

<div class="status-bar">
  <span id="statusText">Ready</span>
  <span><span class="changes-count" id="changesCount">0</span> changes</span>
</div>
<div class="toast" id="toast"></div>
<input type="file" class="hidden-input" id="imageUploadInput" accept="image/*"/>

<script>
let originalData = null;
let currentData = null;
let uploadTargetPath = null;

const POPULAR_FONTS = [
  'Inter','Roboto','Open Sans','Lato','Montserrat','Poppins','Raleway','Nunito',
  'Source Sans Pro','PT Sans','Oswald','Merriweather','Playfair Display','Ubuntu',
  'Noto Sans','Noto Sans Thai','Sarabun','Prompt','Kanit','LINE Seed Sans TH',
  'Arial','Helvetica','Georgia','Times New Roman','Courier New','Verdana',
  'Trebuchet MS','Palatino','Garamond','Book Antiqua','Baskerville',
];

const COLOR_PRESETS = [
  { name: 'Corporate Blue', primary: '#2563EB', secondary: '#1E40AF', accent: '#3B82F6', text: '#1E293B', subtle: '#64748B', bg: '#F8FAFC', border: '#E2E8F0', overlay: 'rgba(15,23,42,0.6)' },
  { name: 'Fresh Green', primary: '#16A34A', secondary: '#15803D', accent: '#22C55E', text: '#14532D', subtle: '#6B7280', bg: '#F0FDF4', border: '#D1FAE5', overlay: 'rgba(20,83,45,0.6)' },
  { name: 'Modern Purple', primary: '#7C3AED', secondary: '#6D28D9', accent: '#8B5CF6', text: '#1E1B4B', subtle: '#6B7280', bg: '#FAF5FF', border: '#E9D5FF', overlay: 'rgba(30,27,75,0.6)' },
  { name: 'Warm Orange', primary: '#EA580C', secondary: '#C2410C', accent: '#F97316', text: '#431407', subtle: '#78716C', bg: '#FFF7ED', border: '#FED7AA', overlay: 'rgba(67,20,7,0.6)' },
  { name: 'Elegant Gold', primary: '#CA8A04', secondary: '#A16207', accent: '#EAB308', text: '#422006', subtle: '#78716C', bg: '#FEFCE8', border: '#FDE68A', overlay: 'rgba(66,32,6,0.6)' },
  { name: 'Soft Pink', primary: '#EC4899', secondary: '#DB2777', accent: '#F472B6', text: '#831843', subtle: '#9CA3AF', bg: '#FDF2F8', border: '#FBCFE8', overlay: 'rgba(131,24,67,0.6)' },
  { name: 'Ocean Teal', primary: '#0D9488', secondary: '#0F766E', accent: '#14B8A6', text: '#134E4A', subtle: '#6B7280', bg: '#F0FDFA', border: '#99F6E4', overlay: 'rgba(19,78,74,0.6)' },
  { name: 'Dark Minimal', primary: '#18181B', secondary: '#27272A', accent: '#71717A', text: '#09090B', subtle: '#A1A1AA', bg: '#FAFAFA', border: '#E4E4E7', overlay: 'rgba(9,9,11,0.6)' },
  { name: 'Cherry Red', primary: '#DC2626', secondary: '#B91C1C', accent: '#EF4444', text: '#450A0A', subtle: '#78716C', bg: '#FEF2F2', border: '#FECACA', overlay: 'rgba(69,10,10,0.6)' },
  { name: 'Sky Blue', primary: '#0EA5E9', secondary: '#0284C7', accent: '#38BDF8', text: '#0C4A6E', subtle: '#6B7280', bg: '#F0F9FF', border: '#BAE6FD', overlay: 'rgba(12,74,110,0.6)' },
];

const ROLE_DESC = {
  'Primary': 'Main brand colors — buttons, links, CTA, active states. Preset palettes apply here.',
  'Accent': 'Supporting brand colors — badges, highlights, decorative elements',
  'Text': 'Headings, body text, labels',
  'Subtle Text': 'Captions, placeholders, disabled text',
  'Background': 'Page, card, and section backgrounds',
  'Border': 'Dividers, input borders, card outlines',
  'System': 'Error, Warning, Success, Info — feedback colors (read-only)',
  'Overlay': 'Modal backdrops, shadows, semi-transparent layers (read-only)',
  'Other': 'Miscellaneous or uncategorized colors',
};
const READONLY_ROLES = ['System', 'Overlay'];

var activeTab = 'colors';
function switchTab(name, btn) {
  activeTab = name;
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(el => el.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
  btn.classList.add('active');
}

async function loadBranding() {
  try {
    const res = await fetch('/api/branding');
    if (!res.ok) { document.getElementById('loading').textContent = 'No branding file found. Import a template first.'; return; }
    originalData = await res.json();
    currentData = JSON.parse(JSON.stringify(originalData));
    document.getElementById('loading').style.display = 'none';
    updateBadges();
    renderColors();
    renderFonts();
    renderImages();
    renderRadii();
  } catch (e) {
    document.getElementById('loading').textContent = 'Error: ' + e.message;
  }
}

function updateBadges() {
  document.getElementById('badge-colors').textContent = Object.keys(currentData.colors || {}).length;
  document.getElementById('badge-fonts').textContent = Object.keys(currentData.fonts || {}).length;
  document.getElementById('badge-images').textContent = Object.keys(currentData.images || {}).length;
  document.getElementById('badge-radii').textContent = Object.keys(currentData.radii || {}).length;
}

// ── COLOR PRESETS ──
function renderPresets() {
  let html = '<div class="presets-bar"><h4>Preset Palettes — เลือก แล้วกด Save &amp; Apply เพื่ออัปเดต</h4><div class="presets-grid" id="presetsGrid">';
  for (let i = 0; i < COLOR_PRESETS.length; i++) {
    const p = COLOR_PRESETS[i];
    html += '<div class="preset-card" data-preset="' + i + '">';
    html += '<div class="preset-colors">';
    html += '<div class="preset-dot preset-dot-lg" style="background:' + p.primary + '" title="Primary"></div>';
    html += '<div class="preset-dot preset-dot-lg" style="background:' + p.secondary + '" title="Secondary"></div>';
    html += '<div class="preset-dot preset-dot-lg" style="background:' + p.accent + '" title="Accent"></div>';
    html += '<div class="preset-dot preset-dot-sm" style="background:' + p.text + '" title="Text"></div>';
    html += '<div class="preset-dot preset-dot-sm" style="background:' + p.bg + ';border:1px solid #EBECEF" title="BG"></div>';
    html += '</div>';
    html += '<span class="preset-name">' + esc(p.name) + '</span>';
    html += '</div>';
  }
  html += '</div></div>';
  return html;
}

function applyPreset(idx) {
  const p = COLOR_PRESETS[idx];
  if (!p) return;
  const meta = currentData._meta?.colors || {};

  // Collect primary colors for round-robin distribution
  const primaryKeys = Object.keys(currentData.colors || {}).filter(k => meta[k]?.role === 'Primary');
  const brandPool = [p.primary, p.secondary, p.accent];

  let changed = 0;
  for (const from of Object.keys(currentData.colors || {})) {
    const role = meta[from]?.role || 'Other';
    let newVal = null;

    // Preset applies to: Primary, Text, Subtle Text, Background, Border
    // Does NOT apply to: System, Overlay, Accent, Other
    if (role === 'Primary') {
      const i = primaryKeys.indexOf(from);
      newVal = brandPool[i % brandPool.length];
    } else if (role === 'Text') {
      newVal = p.text;
    } else if (role === 'Subtle Text') {
      newVal = p.subtle;
    } else if (role === 'Background') {
      newVal = p.bg;
    } else if (role === 'Border') {
      newVal = p.border;
    }
    // System, Overlay, Accent, Other → skip

    if (newVal) {
      currentData.colors[from] = newVal;
      changed++;
    }
  }

  renderColors();
  updateChangesCount();
  showToast(p.name + ' — ' + changed + ' colors selected. กด Save & Apply เพื่ออัปเดตเว็บ', 'success');
}

// Event delegation for clicks (avoids inline onclick escaping issues)
document.addEventListener('click', function(e) {
  // Preset cards
  const card = e.target.closest('[data-preset]');
  if (card) {
    applyPreset(parseInt(card.dataset.preset));
    return;
  }
  // Image filter chips
  const chip = e.target.closest('[data-img-filter]');
  if (chip) {
    imageFilterPage = chip.dataset.imgFilter;
    document.querySelectorAll('.image-filter-chip').forEach(function(c) { c.classList.remove('active'); });
    chip.classList.add('active');
    filterImages();
    return;
  }
  // Section toggle
  const header = e.target.closest('.section-header[data-section]');
  if (header) {
    const id = header.dataset.section;
    const body = document.getElementById('body-' + id);
    if (body) {
      header.classList.toggle('collapsed');
      body.classList.toggle('collapsed');
    }
  }
});

// ── COLORS ──
function renderColors() {
  const meta = currentData._meta?.colors || {};
  const entries = Object.entries(currentData.colors || {});
  const groups = {};
  const roleOrder = ['Primary','Accent','Text','Subtle Text','Background','Border','System','Overlay','Other'];
  for (const [from, to] of entries) {
    const role = meta[from]?.role || 'Other';
    if (!groups[role]) groups[role] = [];
    groups[role].push({ from, to, meta: meta[from] });
  }
  let html = renderPresets();
  for (const role of roleOrder) {
    const items = groups[role];
    if (!items || items.length === 0) continue;
    const isReadonly = READONLY_ROLES.includes(role);
    const roleCls = role === 'Primary' ? 'primary' : role === 'Accent' ? 'accent' : role === 'Text' ? 'text' : role === 'Subtle Text' ? 'subtle' : role === 'Background' ? 'bg' : role === 'Border' ? 'border' : role === 'System' ? 'system' : role === 'Overlay' ? 'overlay' : 'other';
    const sectionId = 'color-' + roleCls;
    html += '<div class="section-panel' + (isReadonly ? ' section-readonly' : '') + '">';
    html += '<div class="section-header' + (isReadonly ? ' collapsed' : '') + '" data-section="' + sectionId + '">';
    html += '<h3><span class="role-badge role-' + roleCls + '">' + esc(role) + '</span>';
    if (isReadonly) html += ' <span class="readonly-tag">Read-only</span>';
    html += ' <span class="section-count">' + items.length + ' colors</span></h3>';
    html += '<span class="chevron">&#9660;</span>';
    html += '</div>';
    html += '<div class="section-body' + (isReadonly ? ' collapsed' : '') + '" id="body-' + sectionId + '">';
    html += '<div class="section-desc">' + esc(ROLE_DESC[role] || '') + '</div>';
    html += '<div class="color-grid">';
    for (const item of items) {
      const changed = item.from !== item.to;
      const hexTo = toHex(item.to);
      const comps = item.meta?.components || [];
      const count = item.meta?.count || 0;
      html += '<div class="color-item' + (changed ? ' color-changed' : '') + (isReadonly ? ' color-readonly' : '') + '" data-color-key="' + esc(item.from) + '">';
      html += '<div class="color-swatch" style="background:' + esc(item.to) + '">';
      if (!isReadonly) html += '<input type="color" data-color-key="' + esc(item.from) + '" value="' + esc(hexTo) + '"/>';
      html += '</div>';
      html += '<div class="color-info">';
      if (isReadonly) {
        html += '<div class="color-value"><span class="color-hex-readonly">' + esc(item.to) + '</span></div>';
      } else {
        html += '<div class="color-value"><input data-color-key="' + esc(item.from) + '" value="' + esc(item.to) + '" spellcheck="false"/></div>';
      }
      if (comps.length > 0) {
        html += '<div class="comp-chips">';
        for (const c of comps) html += '<span class="comp-chip">' + esc(c) + '</span>';
        html += '<span class="color-meta" style="margin:0;padding-left:4px">x' + count + '</span>';
        html += '</div>';
      } else {
        const sources = item.meta?.sources?.slice(0,2).map(s => s.split('/').pop()).join(', ') || '';
        html += '<div class="color-meta">' + (count ? 'x'+count+' ' : '') + sources + '</div>';
      }
      html += '</div></div>';
    }
    html += '</div></div></div>';
  }
  document.getElementById('tab-colors').innerHTML = html;
}

function setColor(key, val) {
  currentData.colors[key] = val;
  renderColors();
  updateChangesCount();
}

// Event delegation for color inputs (avoids inline onclick escaping issues)
document.addEventListener('input', function(e) {
  const el = e.target;
  if (el.dataset && el.dataset.colorKey) {
    setColor(el.dataset.colorKey, el.value);
  }
  if (el.dataset && el.dataset.radiusKey) {
    currentData.radii[el.dataset.radiusKey] = el.value;
    // Live preview: update the preview box next to this input
    const item = el.closest('.radius-item');
    if (item) {
      const preview = item.querySelector('.radius-preview');
      if (preview) preview.style.borderRadius = el.value;
      item.classList.toggle('changed', el.dataset.radiusKey !== el.value);
    }
    updateChangesCount();
  }
});

// ── FONTS ──
function renderFonts() {
  const fonts = Object.entries(currentData.fonts || {});
  if (fonts.length === 0) { document.getElementById('tab-fonts').innerHTML = '<div class="empty-state">No fonts detected</div>'; return; }
  let html = '';
  html += '<div class="section-panel"><div class="section-header" data-section="font-bulk">';
  html += '<h3>Bulk Change <span class="section-count">Apply one font to all</span></h3><span class="chevron">&#9660;</span></div>';
  html += '<div class="section-body" id="body-font-bulk">';
  html += '<div class="font-toolbar" style="border:none;padding:0;background:none;margin:0">';
  html += '<label>Apply to all:</label>';
  html += '<select id="bulkFontSelect" style="flex:1"><option value="">-- Select font --</option>';
  for (const f of POPULAR_FONTS) html += '<option value="' + esc(f) + '">' + esc(f) + '</option>';
  html += '</select>';
  html += '<button class="btn btn-violet btn-sm" onclick="applyAllFonts()">Apply All</button>';
  html += '</div></div></div>';

  html += '<div class="section-panel"><div class="section-header" data-section="font-list">';
  html += '<h3>Font Mapping <span class="section-count">' + fonts.length + ' fonts</span></h3><span class="chevron">&#9660;</span></div>';
  html += '<div class="section-body" id="body-font-list">';
  html += '<div class="section-desc">Original font on the left, replacement on the right</div>';
  for (const [from, to] of fonts) {
    const changed = from !== to;
    html += '<div class="font-item' + (changed ? ' changed' : '') + '">';
    html += '<span class="font-from">' + esc(from) + '</span>';
    html += '<span class="arrow">&#8594;</span>';
    html += '<select onchange="setFont(\\''+escJs(from)+'\\',this.value)" style="font-family:\\''+esc(to)+'\\',sans-serif">';
    html += '<option value="' + esc(to) + '" selected>' + esc(to) + '</option>';
    for (const f of POPULAR_FONTS) {
      if (f === to) continue;
      html += '<option value="' + esc(f) + '" style="font-family:\\''+esc(f)+'\\',sans-serif">' + esc(f) + '</option>';
    }
    html += '</select></div>';
  }
  html += '</div></div>';
  document.getElementById('tab-fonts').innerHTML = html;
}

function setFont(key, val) {
  currentData.fonts[key] = val;
  renderFonts();
  updateChangesCount();
}

function applyAllFonts() {
  const sel = document.getElementById('bulkFontSelect');
  if (!sel.value) return;
  for (const key of Object.keys(currentData.fonts)) {
    currentData.fonts[key] = sel.value;
  }
  renderFonts();
  updateChangesCount();
  showToast('Applied "' + sel.value + '" to all fonts', 'success');
}

// ── IMAGES ──
var imageFilterPage = 'all';
function renderImages() {
  const meta = currentData._meta?.images || {};
  const entries = Object.entries(currentData.images || {});
  if (entries.length === 0) { document.getElementById('tab-images').innerHTML = '<div class="empty-state">No images detected</div>'; return; }

  // Collect all pages for filter chips
  const pageSet = new Set();
  for (const [from] of entries) {
    const pages = meta[from]?.usedIn || [];
    pages.forEach(function(p) { pageSet.add(p); });
  }
  const allPages = Array.from(pageSet).sort();

  // Toolbar: search + page filter chips
  let html = '<div class="image-toolbar">';
  html += '<input class="image-search" id="imageSearch" placeholder="Search images..." oninput="filterImages()"/>';
  html += '<div class="image-filter-chips">';
  html += '<span class="image-filter-chip' + (imageFilterPage === 'all' ? ' active' : '') + '" data-img-filter="all">All (' + entries.length + ')</span>';
  for (const pg of allPages) {
    const pgName = pg.split('/').pop().replace('.html','');
    const count = entries.filter(function(e) { return (meta[e[0]]?.usedIn || []).includes(pg); }).length;
    html += '<span class="image-filter-chip' + (imageFilterPage === pg ? ' active' : '') + '" data-img-filter="' + esc(pg) + '">' + esc(pgName) + ' (' + count + ')</span>';
  }
  html += '</div></div>';

  // Flat grid — all images visible
  html += '<div class="image-grid" id="imageGrid">';
  const t = Date.now();
  for (const [from, to] of entries) {
    const m = meta[from] || {};
    const dim = (m.width && m.height) ? m.width + '×' + m.height : '';
    const size = m.sizeKB ? m.sizeKB + 'KB' : '';
    const pages = m.usedIn || [];
    const pageNames = pages.map(function(p) { return p.split('/').pop().replace('.html',''); });
    const matchFilter = imageFilterPage === 'all' || pages.includes(imageFilterPage);
    const changed = from !== to;

    html += '<div class="image-card' + (changed ? ' changed' : '') + (matchFilter ? '' : ' hidden') + '" data-path="' + esc(from) + '" data-pages="' + esc(pages.join('|')) + '" data-name="' + esc(from.toLowerCase()) + '">';

    // Page tags
    if (pageNames.length > 0) {
      html += '<div class="image-page-tags">';
      for (var pi = 0; pi < Math.min(pageNames.length, 3); pi++) {
        html += '<span class="image-page-tag">' + esc(pageNames[pi]) + '</span>';
      }
      if (pageNames.length > 3) html += '<span class="image-page-tag">+' + (pageNames.length - 3) + '</span>';
      html += '</div>';
    }

    html += '<div class="image-preview-wrap" onclick="browseImage(\\'' + escJs(from) + '\\')">';
    html += '<img class="image-preview" src="/api/image/' + esc(from) + '?t=' + t + '" onerror="this.outerHTML=\\'<div class=image-preview-placeholder>No preview</div>\\'" loading="lazy"/>';
    html += '<div class="image-overlay"><svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke-linecap="round" stroke-linejoin="round"/></svg><span>Replace</span></div>';
    html += '</div>';
    html += '<div class="image-details">';
    html += '<div class="image-name" title="' + esc(from) + '">' + esc(from.split('/').pop()) + '</div>';
    html += '<div class="image-dim">' + [dim, size].filter(Boolean).join(' — ') + '</div>';
    html += '</div>';
    html += '</div>';
  }
  html += '</div>';
  document.getElementById('tab-images').innerHTML = html;
}

function filterImages() {
  var search = (document.getElementById('imageSearch')?.value || '').toLowerCase();
  var cards = document.querySelectorAll('#imageGrid .image-card');
  cards.forEach(function(card) {
    var matchPage = imageFilterPage === 'all' || (card.dataset.pages || '').includes(imageFilterPage);
    var matchSearch = !search || (card.dataset.name || '').includes(search);
    card.classList.toggle('hidden', !(matchPage && matchSearch));
  });
}

function browseImage(originalPath) {
  uploadTargetPath = originalPath;
  document.getElementById('imageUploadInput').click();
}

document.getElementById('imageUploadInput').addEventListener('change', async function(e) {
  const file = e.target.files[0];
  if (!file || !uploadTargetPath) return;
  const targetPath = uploadTargetPath;
  const card = document.querySelector('.image-card[data-path="' + targetPath + '"]');
  if (card) card.classList.add('uploading');

  const form = new FormData();
  form.append('file', file);
  form.append('path', targetPath);
  try {
    const res = await fetch('/api/upload-image', { method: 'POST', body: form });
    const data = await res.json();
    if (data.ok) {
      currentData.images[targetPath] = targetPath;
      showToast('Replaced ' + targetPath.split('/').pop(), 'success');
      renderImages();
      updateChangesCount();
    } else {
      showToast('Upload failed: ' + (data.error || 'Unknown'), 'error');
    }
  } catch (err) {
    showToast('Upload error: ' + err.message, 'error');
  }
  if (card) card.classList.remove('uploading');
  e.target.value = '';
  uploadTargetPath = null;
});

// ── RADII ──
function renderRadii() {
  const meta = currentData._meta?.radii || {};
  const entries = Object.entries(currentData.radii || {});
  if (entries.length === 0) { document.getElementById('tab-radii').innerHTML = '<div class="empty-state">No border-radius values detected</div>'; return; }

  let html = '<div class="section-panel"><div class="section-header" data-section="radii-all">';
  html += '<h3>Border Radius <span class="section-count">' + entries.length + ' values</span></h3><span class="chevron">&#9660;</span></div>';
  html += '<div class="section-body" id="body-radii-all">';
  html += '<div class="section-desc">Type a new value and see the preview update live (e.g. 8px, 12px, 50%, 0)</div>';
  html += '<div class="radius-grid">';
  for (const [from, to] of entries) {
    const changed = from !== to;
    const m = meta[from] || {};
    const comps = m.components || [];
    html += '<div class="radius-item' + (changed ? ' changed' : '') + '">';
    html += '<div class="radius-preview" style="border-radius:' + esc(to) + '"></div>';
    html += '<div class="radius-info">';
    html += '<div class="radius-value"><input data-radius-key="' + esc(from) + '" value="' + esc(to) + '" spellcheck="false" placeholder="e.g. 8px"/>';
    html += '<span class="color-meta">x' + (m.count || 0) + '</span></div>';
    if (comps.length > 0) {
      html += '<div class="comp-chips">';
      for (const c of comps) html += '<span class="comp-chip">' + esc(c) + '</span>';
      html += '</div>';
    }
    html += '</div></div>';
  }
  html += '</div></div></div>';
  document.getElementById('tab-radii').innerHTML = html;
}

// ── SHARED ──
function updateChangesCount() {
  let count = 0;
  for (const section of ['colors','fonts','images','radii']) {
    if (!currentData[section]) continue;
    for (const [k, v] of Object.entries(currentData[section])) { if (k !== v) count++; }
  }
  document.getElementById('changesCount').textContent = count;
  document.getElementById('statusText').textContent = count > 0 ? 'Unsaved changes' : 'Ready';
}

function resetTab() {
  const tab = activeTab;
  const tabNames = { colors: 'Colors', fonts: 'Fonts', images: 'Images', radii: 'Radius' };
  if (!originalData[tab]) return;
  currentData[tab] = JSON.parse(JSON.stringify(originalData[tab]));
  if (tab === 'colors') renderColors();
  else if (tab === 'fonts') renderFonts();
  else if (tab === 'images') { imageFilterPage = 'all'; renderImages(); }
  else if (tab === 'radii') renderRadii();
  updateChangesCount();
  showToast((tabNames[tab] || tab) + ' — reset เรียบร้อย', 'success');
}

async function resetAll() {
  try {
    const res = await fetch('/api/reset', { method: 'POST' });
    const data = await res.json();
    if (data.ok && data.data) {
      originalData = data.data;
      currentData = JSON.parse(JSON.stringify(originalData));
      updateBadges();
      renderColors(); renderFonts(); renderImages(); renderRadii();
      updateChangesCount();
      showToast('Reset ทั้งหมด — กลับสู่ค่าเดิม', 'success');
    } else {
      showToast('Reset failed: ' + (data.error || 'Unknown'), 'error');
    }
  } catch (e) {
    showToast('Reset failed: ' + e.message, 'error');
  }
}

async function saveBranding() {
  const btn = document.getElementById('saveBtn');
  btn.textContent = 'Saving...'; btn.disabled = true;
  try {
    const res = await fetch('/api/branding', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(currentData) });
    const data = await res.json();
    if (data.ok) {
      originalData = JSON.parse(JSON.stringify(currentData));
      showToast('Draft saved. Click "Save & Apply" to update template.', 'success');
    } else { showToast('Error: ' + (data.error || 'Unknown'), 'error'); }
  } catch (e) { showToast('Error: ' + e.message, 'error'); }
  btn.textContent = 'Save Draft'; btn.disabled = false;
}

async function saveAndApply() {
  const btn = document.getElementById('applyBtn');
  btn.textContent = 'Applying...'; btn.disabled = true;
  try {
    const res = await fetch('/api/apply', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(currentData) });
    const data = await res.json();
    if (data.ok) {
      originalData = JSON.parse(JSON.stringify(currentData));
      showToast(data.filesChanged + ' files updated! Refresh preview tab to see changes.', 'success');
    } else { showToast('Error: ' + (data.error || 'Unknown'), 'error'); }
  } catch (e) { showToast('Error: ' + e.message, 'error'); }
  btn.textContent = 'Save & Apply'; btn.disabled = false;
}

function showToast(msg, type) {
  const el = document.getElementById('toast');
  el.textContent = msg; el.className = 'toast toast-' + type + ' show';
  setTimeout(() => el.classList.remove('show'), 3500);
}

function toHex(val) {
  if (val.startsWith('#')) { const h = val.replace('#',''); if (h.length===3) return '#'+h[0]+h[0]+h[1]+h[1]+h[2]+h[2]; if (h.length>=6) return '#'+h.slice(0,6); }
  const m = val.match(/rgba?\\(\\s*(\\d+)\\s*,\\s*(\\d+)\\s*,\\s*(\\d+)/);
  if (m) return '#'+parseInt(m[1]).toString(16).padStart(2,'0')+parseInt(m[2]).toString(16).padStart(2,'0')+parseInt(m[3]).toString(16).padStart(2,'0');
  return '#888888';
}
function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function escJs(s) { return String(s).replace(/\\\\/g,'\\\\\\\\').replace(/'/g,"\\\\'"); }

loadBranding();
</script>
</body>
</html>`;
}

function handleRequest(req: Request, workingDir: string): Response {
  const url = new URL(req.url);
  let pathname = decodeURIComponent(url.pathname);

  if (pathname === "/") pathname = "/index.html";

  const filePath = join(workingDir, pathname);

  if (!filePath.startsWith(workingDir)) {
    return new Response("Forbidden", { status: 403 });
  }

  if (!existsSync(filePath)) {
    const withHtml = filePath + ".html";
    if (existsSync(withHtml)) {
      const file = Bun.file(withHtml);
      return new Response(file, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }
    return new Response(`Not Found: ${pathname}`, { status: 404 });
  }

  const ext = extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";
  const file = Bun.file(filePath);

  return new Response(file, {
    headers: {
      "Content-Type": contentType.includes("text") ? `${contentType}; charset=utf-8` : contentType,
      "Cache-Control": "no-cache",
    },
  });
}

// CLI entry
if (import.meta.main) {
  const projectDir = process.argv[2];
  const port = parseInt(process.argv[3] || "3000");

  if (!projectDir) {
    console.error("Usage: bun run src/serve.ts <project-dir> [port]");
    process.exit(1);
  }

  serve(projectDir, port);
}
