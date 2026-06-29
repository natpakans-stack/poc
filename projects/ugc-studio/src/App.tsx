import { useState } from "react";
import { Column } from "./components/Column";
import { Lightbox } from "./components/Lightbox";
import { SourceColumn } from "./columns/SourceColumn";
import { ScriptColumn } from "./columns/ScriptColumn";
import { OutputColumn, type Settings, type GenState } from "./columns/OutputColumn";
import { StoryboardStep } from "./storyboard/StoryboardStep";
import { startGenerate, getStatus, openEditor, type Avatar, type Template, type Engine, type Kind, type StoryboardResult } from "./lib/api";

const DEFAULT_SCRIPT =
  "สวัสดีค่าทุกคน วันนี้มารีวิวเซรั่มวิตามินซี AURA ทาแล้วหน้าใสขึ้นออร่า ซึมไว ไม่เหนียว ลดจุดด่างดำ วันนี้ลดพิเศษเฉพาะไลฟ์ กดสั่งเลยน้า";

export default function App() {
  // hybrid flow: "ตั้งโจทย์" brief (wizard) → studio (the 3 columns)
  const [stage, setStage] = useState<"storyboard" | "studio">("storyboard");
  // storyboard result kept (not discarded) — per-scene image/video prompts feed the pipeline later
  const [storyboard, setStoryboard] = useState<StoryboardResult | null>(null);
  // source
  const [images, setImages] = useState<File[]>([]);
  const [refVideo, setRefVideo] = useState<File | null>(null);
  const [avatarId, setAvatarId] = useState<string | null>(null);
  // script
  const [script, setScript] = useState(DEFAULT_SCRIPT);
  // output settings + template
  const [settings, setSettings] = useState<Settings>({ mode: "product_review", aspect: "9:16", duration: "15", resolution: "720p" });
  const [template, setTemplate] = useState<Template>("avatar");
  const [engine, setEngine] = useState<Engine>("higgsfield"); // where the video builds — Higgsfield (auto) or Google Flow
  // lightbox + generation
  const [zoom, setZoom] = useState<Avatar | null>(null);
  const [gen, setGen] = useState<GenState>({ phase: "idle", videoUrl: null, statusText: "", statusErr: false });

  const fail = (msg: string) => setGen({ phase: "error", videoUrl: null, statusText: msg, statusErr: true });

  async function onGenerate() {
    if (!images.length) return fail("กรุณาอัปโหลดรูปสินค้าอย่างน้อย 1 รูป");
    if (template !== "no_person" && !avatarId) return fail("กรุณาเลือก avatar (พรีเซนเตอร์)"); // avatar + full มีคน → ต้องเลือกพรีเซนเตอร์; no_person สร้างจาก prompt
    if (!script.trim()) return fail("กรุณาใส่สคริปต์");

    setGen({ phase: "sending", videoUrl: null, statusText: "กำลังอัปโหลดรูปและส่งงานสร้างวิดีโอ…", statusErr: false });
    try {
      const { jobId, refNote, kind } = await startGenerate({ images, refVideo, script: script.trim(), avatarId, template, ...settings, scenes: storyboard?.scenes });
      poll(jobId, kind, refNote);
    } catch (e) {
      fail((e as Error).message);
    }
  }

  async function onEdit() {
    try {
      const url = await openEditor();
      setGen((g) => ({ ...g, statusText: "เปิด Remotion Studio… " + url }));
      window.open(url, "_blank");
    } catch (e) {
      setGen((g) => ({ ...g, statusText: (e as Error).message, statusErr: true }));
    }
  }

  function poll(id: string, kind: Kind, refNote?: string) {
    let tries = 0;
    const base = refNote ? refNote + " · " : "";
    const slow = kind === "pipeline";
    setGen({ phase: "processing", videoUrl: null, statusText: base + (slow ? "กำลังประกอบคลิป (pipeline)… (~3–5 นาที)" : "กำลังสร้างวิดีโอ… (ปกติ 5–15 นาที)"), statusErr: false, kind });
    const iv = setInterval(async () => {
      tries++;
      try {
        const d = await getStatus(id, kind);
        if (d.status === "failed") { clearInterval(iv); return fail("สร้างไม่สำเร็จ: " + ((d as any).error || "pipeline error")); }
        if (d.url) {
          clearInterval(iv);
          setGen({ phase: "done", videoUrl: d.url, statusText: "✅ เสร็จแล้ว · " + d.url, statusErr: false, kind });
          if (kind === "pipeline") openStudio(); // import generated clips+voice into Remotion, new tab
        } else {
          setGen((g) => ({ ...g, statusText: `${base}กำลังสร้างวิดีโอ… สถานะ: ${d.status || "processing"} (${tries * 5} วิ)` }));
        }
      } catch { /* keep polling */ }
      if (tries > 240) { clearInterval(iv); fail("หมดเวลารอ — ลองเช็คใหม่ภายหลัง"); }
    }, 5000);
  }

  // open Remotion Studio (the generated composition) in a new tab; popup-block falls back to the Edit button
  async function openStudio() {
    try { window.open(await openEditor(), "_blank"); } catch { /* user can click the Edit button */ }
  }

  return (
    <>
      <div className="top">
        <span className="logo">U</span>
        <h1>UGC Studio</h1>
        <nav className="crumbs">
          <button className={stage === "storyboard" ? "on" : ""} onClick={() => setStage("storyboard")}>1 · ตั้งโจทย์{stage === "studio" ? " ✓" : ""}</button>
          <span className="sep">›</span>
          <button className={stage === "studio" ? "on" : ""} disabled={stage === "storyboard"}>2 · สตูดิโอ</button>
        </nav>
        <span className="sub">{stage === "storyboard" ? "ตั้งโจทย์ + Storyboard · Viral Intelligence" : "powered by Higgsfield · Marketing Studio"}</span>
      </div>

      {stage === "storyboard" ? (
        <StoryboardStep
          images={images} setImages={setImages}
          template={template} setTemplate={setTemplate}
          avatarId={avatarId} setAvatarId={setAvatarId} onZoom={setZoom}
          engine={engine} setEngine={setEngine}
          onUse={(s, result) => {
            // storyboard wins on length: target = the actual VO length, same estimator as §2 (chars/8) → no false "เกิน"
            const est = Math.max(5, Math.round(s.length / 8));
            setScript(s); setStoryboard(result);
            setSettings((v) => ({ ...v, duration: String(est) }));
            setStage("studio");
          }}
          onSkip={(totalSec) => { setSettings((v) => ({ ...v, duration: String(totalSec) })); setStage("studio"); }}
        />
      ) : (
      <main>
        <Column index={1} title="Source" variant="source">
          <SourceColumn
            images={images}
            avatarId={avatarId} setAvatarId={setAvatarId}
            onZoom={setZoom}
            template={template}
            personaHint={storyboard?.scenes?.[0]?.speaker}
            onBack={() => setStage("storyboard")}
          />
        </Column>

        <Column index={2} title="Script" variant="script">
          <ScriptColumn script={script} setScript={setScript} targetSec={parseInt(settings.duration, 10) || 15} />
        </Column>

        <Column index={3} title="Output" variant="output">
          <OutputColumn
            settings={settings} setSettings={setSettings}
            template={template} engine={engine}
            sceneCount={storyboard?.scenes.length}
            gen={gen} onGenerate={onGenerate} onEdit={onEdit}
            onBack={() => setStage("storyboard")}
          />
        </Column>
      </main>
      )}

      <Lightbox src={zoom?.preview_url ?? null} name={zoom?.name ?? ""} onClose={() => setZoom(null)} />
    </>
  );
}
