// UGC Studio — Bun server that drives the Higgsfield CLI + full Remotion pipeline.
// ponytail: shells out to the hf binary; async job + poll (gen takes minutes, idle-timeout can't hold the request).
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import index from "./index.html";
import { draftFullScript, runFromPlan } from "./pipeline";

const HF = "/Users/natpakansirirat/.npm-global/lib/node_modules/@higgsfield/cli/vendor/hf";
const ROOT = import.meta.dir;
const REMOTION_DIR = ROOT + "/remotion";
const JOBS = ROOT + "/jobs";
await mkdir(JOBS, { recursive: true });
// Root.tsx imports props.json — keep a valid file so the Remotion bundle never breaks (empty until first gen)
if (!existsSync(REMOTION_DIR + "/props.json")) await writeFile(REMOTION_DIR + "/props.json", "{}");

// in-memory status for background pipeline renders (full / no-person templates)
const pipeJobs = new Map<string, { status: string; url: string | null; error?: string }>();
let studio: ReturnType<typeof Bun.spawn> | null = null; // single shared Remotion Studio process
const STUDIO_PORT = 3010; // fixed so the Edit button always opens the right tab (3000/3001 may be taken)

// spawn Remotion Studio once (boots in the background; reads the latest props.json)
function ensureStudio(): string {
  if (!studio) studio = Bun.spawn(["bunx", "remotion", "studio", "--port", String(STUDIO_PORT)], { cwd: REMOTION_DIR, stdout: "ignore", stderr: "ignore", env: process.env });
  return `http://localhost:${STUDIO_PORT}`;
}

async function hf(args: string[]) {
  const p = Bun.spawn([HF, ...args], { stdout: "pipe", stderr: "pipe", env: process.env });
  const [out, err] = await Promise.all([
    new Response(p.stdout).text(),
    new Response(p.stderr).text(),
  ]);
  await p.exited;
  return { code: p.exitCode ?? 0, out: out.trim(), err: err.trim() };
}

// pull the first .mp4 url found anywhere in a parsed json blob
function findMp4(x: any): string | null {
  if (!x) return null;
  if (typeof x === "string") return x.includes(".mp4") ? x : null;
  if (Array.isArray(x)) { for (const v of x) { const r = findMp4(v); if (r) return r; } return null; }
  if (typeof x === "object") { for (const v of Object.values(x)) { const r = findMp4(v); if (r) return r; } }
  return null;
}
function findStatus(x: any): string | null {
  if (Array.isArray(x)) return findStatus(x[0]);
  if (x && typeof x === "object") return x.status ?? x.state ?? null;
  return null;
}

const json = (o: any, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });

Bun.serve({
  port: 3001,
  idleTimeout: 120, // create() uploads images then returns a job id fast; generation is polled separately
  development: { hmr: true, console: true },
  routes: { "/": index }, // Bun bundles src/main.tsx referenced by index.html
  async fetch(req) {
    const url = new URL(req.url);

    // serve rendered pipeline output (remotion/out/*.mp4)
    if (url.pathname.startsWith("/out/")) {
      return new Response(Bun.file(REMOTION_DIR + "/out/" + url.pathname.slice(5)));
    }

    // list preset avatars for the picker
    if (url.pathname === "/api/avatars") {
      const r = await hf(["marketing-studio", "avatars", "list", "--json"]);
      try { return json(JSON.parse(r.out)); } catch { return json({ error: r.err || "failed" }, 500); }
    }

    // kick off a generation, return job id immediately
    if (url.pathname === "/api/generate" && req.method === "POST") {
      try {
        const form = await req.formData();
        const script = String(form.get("script") || "").trim();
        const avatarId = String(form.get("avatarId") || "");
        const mode = String(form.get("mode") || "product_review");
        const aspect = String(form.get("aspect") || "9:16");
        const duration = String(form.get("duration") || "15");
        const resolution = String(form.get("resolution") || "720p");
        const images = form.getAll("images").filter((f): f is File => f instanceof File && f.size > 0);
        const refVideo = form.get("refVideo");

        if (!script) return json({ error: "กรุณาใส่สคริปต์" }, 400);
        if (!avatarId) return json({ error: "กรุณาเลือก avatar" }, 400);
        if (!images.length) return json({ error: "กรุณาอัปโหลดรูปสินค้าอย่างน้อย 1 รูป" }, 400);

        const jobDir = `${JOBS}/${crypto.randomUUID()}`;
        await mkdir(jobDir, { recursive: true });

        // save product images
        const imgPaths: string[] = [];
        for (const [i, f] of images.entries()) {
          const path = `${jobDir}/img${i}_${f.name.replace(/[^\w.\-]/g, "_")}`;
          await writeFile(path, Buffer.from(await f.arrayBuffer()));
          imgPaths.push(path);
        }

        // ── template routing ──
        // "full" / "no_person" → run the Remotion pipeline as a background job (minutes); poll with kind=pipeline.
        // "avatar" (default)   → Higgsfield single-shot below (presenter speaks, lip-synced).
        const template = String(form.get("template") || "avatar");
        if (template === "full" || template === "no_person") {
          const id = crypto.randomUUID();
          const outName = `web_${id}.mp4`;
          pipeJobs.set(id, { status: "processing", url: null });
          const totalDurationS = Math.max(8, Math.min(60, parseInt(duration, 10) || 15));
          ensureStudio(); // pre-warm Remotion Studio while the render runs so the Edit tab opens instantly
          // fire-and-forget; client polls /api/status?id=…&kind=pipeline
          runFromPlan(script, { productImage: imgPaths[0], totalDurationS, noPerson: template === "no_person", outName, aspect, resolution })
            .then(() => pipeJobs.set(id, { status: "completed", url: `/out/${outName}` }))
            .catch((e) => {
              const stderr = (e as any)?.stderr?.toString?.() ?? "";
              console.error(`[pipeline ${id}] exit=${(e as any)?.exitCode} ${(e as Error)?.message}\n${stderr}`);
              const raw = stderr.split("\n").filter(Boolean).pop() || String((e as Error)?.message || e);
              const msg = /cannot reach|higgsfield|ECONN|ETIMEDOUT|timeout|429|50\d/i.test(raw + " " + ((e as Error)?.message ?? ""))
                ? "เชื่อมต่อ Higgsfield ไม่สำเร็จ (บริการไม่พร้อม/credit หมด/โดน rate limit) — ลองใหม่อีกครั้ง"
                : raw.slice(0, 300);
              pipeJobs.set(id, { status: "failed", url: null, error: msg });
            });
          return json({ jobId: id, kind: "pipeline" });
        }

        // avatars json file
        const avatarsFile = `${jobDir}/avatars.json`;
        await writeFile(avatarsFile, JSON.stringify([{ id: avatarId, type: "preset" }]));

        const prompt =
          `Vertical UGC live-selling clip. A presenter sits at a cozy livestream setup and shows the product to the camera, ` +
          `foreground product, simple lifestyle background, energetic natural live-stream selling vibe. ` +
          `The host says: "${script}"`;

        const args = [
          "generate", "create", "marketing_studio_video", "--json",
          "--mode", mode,
          "--avatars", `@${avatarsFile}`,
          "--aspect_ratio", aspect,
          "--duration", duration,
          "--resolution", resolution,
          "--generate_audio", "true",
          "--prompt", prompt,
        ];
        for (const p of imgPaths) args.push("--image", p);

        // optional reference video -> ad reference (best effort, never blocks core)
        let refNote = "";
        if (refVideo instanceof File && refVideo.size > 0) {
          try {
            const vpath = `${jobDir}/ref_${refVideo.name.replace(/[^\w.\-]/g, "_")}`;
            await writeFile(vpath, Buffer.from(await refVideo.arrayBuffer()));
            const up = await hf(["upload", "create", vpath, "--json"]);
            const upId = JSON.parse(up.out)?.id;
            if (upId) {
              const adr = await hf(["marketing-studio", "ad-references", "create", "--video-input", upId, "--json"]);
              const adId = JSON.parse(adr.out)?.id;
              if (adId) { args.push("--ad_reference_id", adId); refNote = "ใช้ reference video แล้ว"; }
              else refNote = "reference video สร้าง ad-reference ไม่สำเร็จ — ข้ามไป";
            }
          } catch (e) { refNote = "reference video ข้ามไป (" + (e as Error).message + ")"; }
        }

        const r = await hf(args);
        if (r.code !== 0 && !r.out) return json({ error: r.err || "generate failed" }, 500);
        let jobId: string | null = null;
        try {
          const parsed = JSON.parse(r.out);
          jobId = Array.isArray(parsed) ? (parsed[0]?.id ?? parsed[0]) : (parsed?.id ?? parsed);
        } catch { jobId = r.out.split(/\s+/).find((t) => /[0-9a-f-]{20,}/.test(t)) ?? null; }
        if (!jobId) return json({ error: "ไม่พบ job id: " + (r.err || r.out) }, 500);
        return json({ jobId, refNote, kind: "hf" });
      } catch (e) {
        return json({ error: (e as Error).message }, 500);
      }
    }

    // draft a Thai live-selling script from a short brief (OpenAI via pipeline.generateScript)
    if (url.pathname === "/api/script" && req.method === "POST") {
      try {
        const { brief, duration } = await req.json();
        if (!brief || !String(brief).trim()) return json({ error: "กรุณาใส่ brief" }, 400);
        const script = await draftFullScript(String(brief).trim(), parseInt(duration, 10) || 15);
        return json({ script });
      } catch (e) { return json({ error: (e as Error).message }, 500); }
    }

    // launch Remotion Studio (timeline + props edit) on a fixed port — browser can't spawn it, server must
    if (url.pathname === "/api/edit" && req.method === "POST") {
      try { return json({ url: ensureStudio() }); }
      catch (e) { return json({ error: (e as Error).message }, 500); }
    }

    // poll a job's status (kind=pipeline → background render; default → Higgsfield)
    if (url.pathname === "/api/status") {
      const id = url.searchParams.get("id");
      if (!id) return json({ error: "no id" }, 400);
      if (url.searchParams.get("kind") === "pipeline") {
        const j = pipeJobs.get(id);
        return j ? json({ status: j.status, url: j.url, error: j.error }) : json({ status: "unknown", url: null });
      }
      const r = await hf(["generate", "get", id, "--json"]);
      try {
        const parsed = JSON.parse(r.out);
        return json({ status: findStatus(parsed) || "unknown", url: findMp4(parsed) });
      } catch { return json({ status: "unknown", url: null, raw: r.out || r.err }); }
    }

    return new Response("Not found", { status: 404 });
  },
});

console.log("UGC Studio → http://localhost:3001");
