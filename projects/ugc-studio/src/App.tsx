import { useState } from "react";
import { Column } from "./components/Column";
import { Lightbox } from "./components/Lightbox";
import { SourceColumn } from "./columns/SourceColumn";
import { ScriptColumn } from "./columns/ScriptColumn";
import { OutputColumn, type Settings, type GenState } from "./columns/OutputColumn";
import { StoryboardStep } from "./storyboard/StoryboardStep";
import { startGenerate, getStatus, openEditor, type Avatar, type Template, type Kind } from "./lib/api";

const DEFAULT_SCRIPT =
  "สวัสดีค่าทุกคน วันนี้มารีวิวเซรั่มวิตามินซี AURA ทาแล้วหน้าใสขึ้นออร่า ซึมไว ไม่เหนียว ลดจุดด่างดำ วันนี้ลดพิเศษเฉพาะไลฟ์ กดสั่งเลยน้า";

export default function App() {
  // initial flow: storyboard step → studio (the 3 columns)
  const [stage, setStage] = useState<"storyboard" | "studio">("storyboard");
  // source
  const [images, setImages] = useState<File[]>([]);
  const [refVideo, setRefVideo] = useState<File | null>(null);
  const [avatarId, setAvatarId] = useState<string | null>(null);
  // script
  const [script, setScript] = useState(DEFAULT_SCRIPT);
  // output settings + template
  const [settings, setSettings] = useState<Settings>({ mode: "product_review", aspect: "9:16", duration: "15", resolution: "720p" });
  const [template, setTemplate] = useState<Template>("avatar");
  // lightbox + generation
  const [zoom, setZoom] = useState<Avatar | null>(null);
  const [gen, setGen] = useState<GenState>({ phase: "idle", videoUrl: null, statusText: "", statusErr: false });

  const fail = (msg: string) => setGen({ phase: "error", videoUrl: null, statusText: msg, statusErr: true });

  async function onGenerate() {
    if (!images.length) return fail("กรุณาอัปโหลดรูปสินค้าอย่างน้อย 1 รูป");
    if (!avatarId) return fail("กรุณาเลือก avatar");
    if (!script.trim()) return fail("กรุณาใส่สคริปต์");

    setGen({ phase: "sending", videoUrl: null, statusText: "กำลังอัปโหลดรูปและส่งงานสร้างวิดีโอ…", statusErr: false });
    try {
      const { jobId, refNote, kind } = await startGenerate({ images, refVideo, script: script.trim(), avatarId, template, ...settings });
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
        {stage === "studio" && <button className="back-btn" onClick={() => setStage("storyboard")}>← Storyboard</button>}
        <span className="sub">{stage === "storyboard" ? "Storyboard Generator · Viral Intelligence" : "powered by Higgsfield · Marketing Studio"}</span>
      </div>

      {stage === "storyboard" ? (
        <StoryboardStep onUse={(s) => { setScript(s); setStage("studio"); }} onSkip={() => setStage("studio")} />
      ) : (
      <main>
        <Column index={1} title="Source" variant="source">
          <SourceColumn
            images={images} setImages={setImages}
            refVideo={refVideo} setRefVideo={setRefVideo}
            avatarId={avatarId} setAvatarId={setAvatarId}
            onZoom={setZoom}
          />
        </Column>

        <Column index={2} title="Script" variant="script">
          <ScriptColumn script={script} setScript={setScript} targetSec={parseInt(settings.duration, 10) || 15} />
        </Column>

        <Column index={3} title="Output" variant="output">
          <OutputColumn
            settings={settings} setSettings={setSettings}
            template={template} setTemplate={setTemplate}
            gen={gen} onGenerate={onGenerate} onEdit={onEdit}
          />
        </Column>
      </main>
      )}

      <Lightbox src={zoom?.preview_url ?? null} name={zoom?.name ?? ""} onClose={() => setZoom(null)} />
    </>
  );
}
